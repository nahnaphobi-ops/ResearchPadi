import { supabase } from '../../db/supabase.js';
import { chunkText } from './chunker.service.js';
import { generateEmbeddings } from './embedder.service.js';
import { CONFIG } from '../../config/index.js';
import { parseAuthors, serializeAuthors } from '../../lib/authors.js';
import { childLogger } from '../../lib/logger.js';
import { harvestMetadata, listSets, type OaiRecord, type RepositoryConfig } from './oai-harvester.service.js';
import { DSPACE_REPOSITORIES, listRecentItems, thesisGenre, type DSpaceItem, type DSpaceRepo } from './dspace.service.js';
import { GHANA_REPOSITORIES } from './repositories.js';

const log = childLogger('harvester');

const PAGE_DELAY_MS = 1000; // be gentle with university servers
const INCREMENTAL_MAX_PAGES = 20; // weekly top-up: ~2,000 records per repository
const BACKFILL_MAX_PAGES = 200; // first harvest of a repository: ~20,000 records

interface StoredRow {
  source_name: string;
  source_url: string;
  document_title: string;
  authors: string | null;
  year: number | null;
  institution: string;
  field: string;
  chunk_text: string;
  chunk_index: number;
  document_type: string | null;
  language: string | null;
  doi: string | null;
  embedding: number[] | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function pickUrl(record: OaiRecord): string | null {
  const http = record.links.find((l) => /^https?:\/\//i.test(l) && !/doi\.org/i.test(l));
  return http || record.links.find((l) => /^https?:\/\//i.test(l)) || null;
}

function pickDoi(record: OaiRecord): string | null {
  for (const l of record.links) {
    const m = l.match(/10\.\d{4,9}\/\S+/);
    if (m) return m[0].toLowerCase();
  }
  return null;
}

function pickYear(date: string): number | null {
  const m = date.match(/\b(19|20)\d{2}\b/);
  if (!m) return null;
  const y = Number(m[0]);
  return y <= new Date().getFullYear() + 1 ? y : null;
}

/** Turn one OAI record into knowledge_chunks rows (no embeddings yet). */
function recordToRows(record: OaiRecord, repo: RepositoryConfig): Omit<StoredRow, 'embedding'>[] {
  const title = record.title.replace(/\s+/g, ' ').trim();
  const url = pickUrl(record);
  if (!title || !url) return [];

  const abstract = record.description.replace(/\s+/g, ' ').trim();
  // Without an abstract, still index the title so the work is findable and citable.
  const chunks = abstract ? chunkText(abstract, CONFIG.RAG.CHUNK_SIZE, CONFIG.RAG.CHUNK_OVERLAP) : [title];
  const authors = serializeAuthors(parseAuthors(record.creators)) || null;

  return chunks.map((chunk, i) => ({
    source_name: repo.name,
    source_url: url,
    document_title: title,
    authors,
    year: pickYear(record.date),
    institution: repo.institution,
    field: record.subject[0]?.slice(0, 120) || 'General',
    chunk_text: chunk,
    chunk_index: i,
    document_type: record.type?.slice(0, 80) || null,
    language: record.language?.slice(0, 20) || null,
    doi: pickDoi(record),
  }));
}

async function lastSuccessfulHarvest(source: string): Promise<string | undefined> {
  const { data } = await supabase
    .from('harvest_logs')
    .select('harvested_at')
    .eq('source', source)
    .eq('status', 'success')
    .order('harvested_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.harvested_at) return undefined;
  // Overlap by a day so nothing published around the last run is missed.
  const since = new Date(new Date(data.harvested_at).getTime() - 24 * 60 * 60 * 1000);
  return since.toISOString().slice(0, 10);
}

async function logHarvest(source: string, fetched: number, added: number, status: 'success' | 'partial' | 'error', errorMessage?: string) {
  await supabase.from('harvest_logs').insert({ source, records_fetched: fetched, records_added: added, status, error_message: errorMessage ?? null });
}

/** Insert rows whose source_url isn't in the knowledge base yet. Returns works added. */
async function insertFresh(rows: Omit<StoredRow, 'embedding'>[]): Promise<number> {
  const urls = [...new Set(rows.map((r) => r.source_url))];
  if (!urls.length) return 0;
  const { data: existing } = await supabase.from('knowledge_chunks').select('source_url').in('source_url', urls);
  const known = new Set((existing ?? []).map((e: { source_url: string }) => e.source_url));
  const fresh = rows.filter((r) => !known.has(r.source_url));
  if (!fresh.length) return 0;
  const vectors = await generateEmbeddings(fresh.map((r) => `${r.document_title}. ${r.chunk_text}`));
  const { error } = await supabase.from('knowledge_chunks').insert(fresh.map((r, i) => ({ ...r, embedding: vectors[i] ?? null })));
  if (error) throw new Error(error.message);
  return new Set(fresh.map((r) => r.source_url)).size;
}

function dspaceItemToRows(item: DSpaceItem): Omit<StoredRow, 'embedding'>[] {
  const chunks = item.abstract ? chunkText(item.abstract, CONFIG.RAG.CHUNK_SIZE, CONFIG.RAG.CHUNK_OVERLAP) : [item.title];
  const isThesis = /thesis|dissertation/i.test(item.type);
  return chunks.map((chunk, i) => ({
    source_name: item.repo.sourceName,
    source_url: item.url,
    document_title: item.title,
    authors: serializeAuthors(parseAuthors(item.authorsRaw)) || null,
    year: item.year,
    institution: item.repo.institution,
    field: item.subjects[0]?.slice(0, 120) || 'General',
    chunk_text: chunk,
    chunk_index: i,
    document_type: isThesis ? thesisGenre(item) : item.type?.slice(0, 80) || null,
    language: null,
    doi: item.doi ?? null,
  }));
}

/** DSpace 7: page through items newest-first until we reach the last run. */
async function harvestViaRest(repo: DSpaceRepo, since: string | undefined, maxPages: number) {
  let fetched = 0;
  let added = 0;
  let exhausted = false;
  for (let page = 0; page < maxPages; page++) {
    const { items, totalPages } = await listRecentItems(repo, page, 100);
    const fresh = since ? items.filter((it) => !it.accessioned || it.accessioned.slice(0, 10) >= since) : items;
    fetched += fresh.length;
    added += await insertFresh(fresh.flatMap(dspaceItemToRows));
    const reachedLastRun = since && fresh.length < items.length;
    if (reachedLastRun || page + 1 >= totalPages || !items.length) { exhausted = true; break; }
    await sleep(PAGE_DELAY_MS);
  }
  return { fetched, added, exhausted };
}

/** OAI-PMH; falls back to harvesting collection by collection when the repository needs a set. */
async function harvestViaOai(repo: RepositoryConfig, since: string | undefined, maxPages: number) {
  let fetched = 0;
  let added = 0;
  let pagesUsed = 0;

  const runSet = async (set?: string) => {
    let cursor: string | undefined;
    while (pagesUsed < maxPages) {
      const result = await harvestMetadata(repo, cursor ? undefined : since, undefined, cursor, 100, cursor ? undefined : set);
      pagesUsed++;
      fetched += result.records.length;
      added += await insertFresh(result.records.flatMap((r) => recordToRows(r, repo)));
      if (!result.hasMore || !result.cursor) return true;
      cursor = result.cursor;
      await sleep(PAGE_DELAY_MS);
    }
    return false;
  };

  let exhausted = await runSet();
  if (fetched === 0) {
    const collections = (await listSets(repo)).filter((s) => s.startsWith('col_'));
    exhausted = true;
    for (const set of collections) {
      if (!(await runSet(set))) { exhausted = false; break; }
    }
  }
  return { fetched, added, exhausted };
}

/** Harvest one repository incrementally (since its last successful run). */
export async function harvestRepository(repo: RepositoryConfig, opts: { maxPages?: number; from?: string } = {}) {
  const from = opts.from ?? (await lastSuccessfulHarvest(repo.name));
  const maxPages = opts.maxPages ?? (from ? INCREMENTAL_MAX_PAGES : BACKFILL_MAX_PAGES);
  const dspace = DSPACE_REPOSITORIES.find((d) => d.sourceName === repo.name);

  try {
    const { fetched, added, exhausted } = dspace
      ? await harvestViaRest(dspace, from, maxPages)
      : await harvestViaOai(repo, from, maxPages);
    // Only a complete pass counts as "success" (the next run's starting point).
    await logHarvest(repo.name, fetched, added, exhausted ? 'success' : 'partial');
    log.info({ repo: repo.name, via: dspace ? 'rest' : 'oai', since: from ?? 'beginning', fetched, added, complete: exhausted }, 'Repository harvested');
    return { repo: repo.name, fetched, added, complete: exhausted };
  } catch (err) {
    const message = (err as Error).message;
    await logHarvest(repo.name, 0, 0, 'error', message);
    log.error({ repo: repo.name, err: message }, 'Repository harvest failed');
    return { repo: repo.name, fetched: 0, added: 0, complete: false };
  }
}

/** Weekly job: harvest every Ghanaian repository in turn. */
export async function runFullHarvest(opts: { maxPages?: number; repos?: string[] } = {}) {
  const repos = opts.repos?.length ? GHANA_REPOSITORIES.filter((r) => opts.repos!.includes(r.name)) : GHANA_REPOSITORIES;
  const results = [];
  for (const repo of repos) results.push(await harvestRepository(repo, { maxPages: opts.maxPages }));
  return results;
}
