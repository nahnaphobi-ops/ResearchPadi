import { supabase, getWritePool } from '../../db/supabase.js';
import { chunkText } from './chunker.service.js';
import { embeddingProblem, generateEmbeddings } from './embedder.service.js';
import { CONFIG } from '../../config/index.js';
import { parseAuthors, serializeAuthors } from '../../lib/authors.js';
import { childLogger } from '../../lib/logger.js';
import { checkRepository, harvestMetadata, listSets, type OaiRecord, type RepositoryConfig } from './oai-harvester.service.js';
import { OPENALEX_GHANA, harvestOpenAlexGhana, type KnowledgeRow } from './openalex-harvester.service.js';
import { DSPACE_REPOSITORIES, listRecentItems, thesisGenre, type DSpaceItem, type DSpaceRepo } from './dspace.service.js';
import { GHANA_REPOSITORIES } from './repositories.js';
import { FirewallChallengeError, describeError } from './harvest-http.js';
import {
  RESUME, StorageLimitError, databaseLimitMb, embeddingNote, harvestSets, joinNotes, parseResume,
  skippedSetsNote, stopsSource, storageLimitMessage,
} from './harvest-policy.js';

const log = childLogger('harvester');

// Requests to each host are paced (and retried) by harvestGet in harvest-http.ts.
const INCREMENTAL_MAX_PAGES = 20; // weekly top-up: ~2,000 records per repository
const BACKFILL_MAX_PAGES = 300; // first harvest of a repository: ~30,000 records (UGSpace has ~28,000)

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
  journal?: string | null;
  publisher?: string | null;
  embedding: number[] | null;
}

/** Running totals for one source, so a run that fails part-way still logs what it saved. */
interface Progress {
  fetched: number;
  added: number;
  /** Chunks inserted without a vector because embedding failed. */
  unembedded: number;
  notes: (string | null)[];
}

const newProgress = (): Progress => ({ fetched: 0, added: 0, unembedded: 0, notes: [] });

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
    // For journals the "institution" is the journal itself; cite it as the container.
    journal: repo.platform === 'ojs' ? repo.institution : null,
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

/** Notes for the log row, including chunks that went in without vectors. */
function progressNotes(progress: Progress, ...extra: (string | null | undefined)[]): string | undefined {
  return joinNotes(...extra, ...progress.notes, embeddingNote(progress.unembedded, embeddingProblem()));
}

function warnIfUnembedded(source: string, progress: Progress) {
  if (progress.unembedded) {
    log.error({ source, unembedded: progress.unembedded, problem: embeddingProblem() }, 'Chunks saved without vectors; fix OPENAI_API_KEY and run embed-knowledge');
  }
}

// ── Database size guard ──────────────────────────────────────────────────────

/** Row + 1536-d vector + its index, for when pg_database_size can't be read. */
const CHUNK_BYTES_ESTIMATE = 14 * 1024;
const BASELINE_MB = 60;
let sizeCache: { at: number; mb: number; estimated: boolean } | null = null;

async function databaseSizeMb(): Promise<{ mb: number; estimated: boolean } | null> {
  if (sizeCache && Date.now() - sizeCache.at < 60_000) return sizeCache;
  try {
    const { rows } = await getWritePool().query('select pg_database_size(current_database())::bigint as bytes');
    sizeCache = { at: Date.now(), mb: Number(rows[0].bytes) / 1_048_576, estimated: false };
  } catch (err) {
    // No direct database connection (e.g. DATABASE_URL unset): estimate from the library's row count.
    const { count, error } = await supabase.from('knowledge_chunks').select('id', { count: 'exact', head: true });
    if (error || count == null) {
      log.warn({ err: (err as Error).message, countErr: error?.message }, 'Could not measure the database size; the size limit is not enforced');
      return null;
    }
    sizeCache = { at: Date.now(), mb: BASELINE_MB + (count * CHUNK_BYTES_ESTIMATE) / 1_048_576, estimated: true };
  }
  return sizeCache;
}

/** Throws StorageLimitError once the database reaches HARVEST_DB_LIMIT_MB (default 400, for Supabase Free). */
async function assertDatabaseRoom() {
  const limit = databaseLimitMb();
  if (!limit) return;
  const size = await databaseSizeMb();
  const message = size && storageLimitMessage(size.mb, limit, size.estimated);
  if (message) throw new StorageLimitError(message);
}

/** Insert rows whose source_url isn't in the knowledge base yet. Returns works added. */
async function insertFresh(rows: Omit<StoredRow, 'embedding'>[], progress: Progress): Promise<number> {
  const urls = [...new Set(rows.map((r) => r.source_url))];
  if (!urls.length) return 0;
  const { data: existing, error: lookupError } = await supabase.from('knowledge_chunks').select('source_url').in('source_url', urls);
  // Without the lookup every row would look new and be inserted twice.
  if (lookupError) throw new Error(`Checking existing chunks failed: ${lookupError.message}`);
  const known = new Set((existing ?? []).map((e: { source_url: string }) => e.source_url));
  const fresh = rows.filter((r) => !known.has(r.source_url));
  if (!fresh.length) return 0;
  await assertDatabaseRoom();
  const vectors = await generateEmbeddings(fresh.map((r) => `${r.document_title}. ${r.chunk_text}`));
  const { error } = await supabase.from('knowledge_chunks').insert(fresh.map((r, i) => ({ ...r, embedding: vectors[i] ?? null })));
  if (error) throw new Error(error.message);
  progress.unembedded += fresh.filter((_, i) => !vectors[i]).length;
  const added = new Set(fresh.map((r) => r.source_url)).size;
  progress.added += added;
  return added;
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

/** DSpace 7: page through items newest-first until we reach the last run. Returns true when complete. */
async function harvestViaRest(repo: DSpaceRepo, since: string | undefined, maxPages: number, progress: Progress) {
  for (let page = 0; page < maxPages; page++) {
    const { items, totalPages } = await listRecentItems(repo, page, 100);
    const fresh = since ? items.filter((it) => !it.accessioned || it.accessioned.slice(0, 10) >= since) : items;
    progress.fetched += fresh.length;
    await insertFresh(fresh.flatMap(dspaceItemToRows), progress);
    const reachedLastRun = since && fresh.length < items.length;
    if (reachedLastRun || page + 1 >= totalPages || !items.length) return true;
  }
  return false;
}

/**
 * OAI-PMH; falls back to harvesting collection by collection when the repository needs a set.
 * Returns true when complete; a collection that keeps failing is skipped and noted.
 */
async function harvestViaOai(repo: RepositoryConfig, since: string | undefined, maxPages: number, progress: Progress) {
  let pagesUsed = 0;

  const runSet = async (set?: string) => {
    let cursor: string | undefined;
    while (pagesUsed < maxPages) {
      const result = await harvestMetadata(repo, cursor ? undefined : since, undefined, cursor, 100, cursor ? undefined : set);
      // An empty collection costs one request but no page budget (UEW has 195 collections).
      if (result.records.length || result.cursor) pagesUsed++;
      progress.fetched += result.records.length;
      await insertFresh(result.records.flatMap((r) => recordToRows(r, repo)), progress);
      if (!result.cursor) return true;
      cursor = result.cursor;
    }
    return false;
  };

  let exhausted = await runSet();
  if (progress.fetched === 0) {
    const collections = (await listSets(repo)).filter((s) => s.startsWith('col_'));
    const result = await harvestSets(collections, runSet);
    exhausted = result.exhausted;
    progress.notes.push(skippedSetsNote(result.failed));
  }
  return exhausted;
}

export interface HarvestResult {
  repo: string;
  fetched: number;
  added: number;
  complete: boolean;
  /** The database size limit was reached; the run stops here. */
  stopped?: boolean;
}

/**
 * Harvest one repository incrementally (since its last successful run). `blockedHosts`
 * collects hosts whose firewall challenged us, so the run skips their other journals.
 */
export async function harvestRepository(repo: RepositoryConfig, opts: { maxPages?: number; from?: string; blockedHosts?: Set<string> } = {}): Promise<HarvestResult> {
  const dspace = DSPACE_REPOSITORIES.find((d) => d.sourceName === repo.name);
  const host = new URL(dspace?.baseUrl ?? repo.oaiBaseUrl).host;
  if (opts.blockedHosts?.has(host)) {
    await logHarvest(repo.name, 0, 0, 'error', `Skipped: ${host}'s firewall challenged an earlier request in this run`);
    return { repo: repo.name, fetched: 0, added: 0, complete: false };
  }

  const from = opts.from ?? (await lastSuccessfulHarvest(repo.name));
  const maxPages = opts.maxPages ?? (from ? INCREMENTAL_MAX_PAGES : BACKFILL_MAX_PAGES);
  const progress = newProgress();

  try {
    if (!dspace) {
      const check = await checkRepository(repo);
      if (!check.ok) {
        if (check.blocked) opts.blockedHosts?.add(host);
        await logHarvest(repo.name, 0, 0, 'error', `Unreachable: the OAI-PMH Identify request failed (${check.reason})`);
        log.warn({ repo: repo.name, reason: check.reason }, 'Repository unreachable; skipped');
        return { repo: repo.name, fetched: 0, added: 0, complete: false };
      }
    }
    const exhausted = dspace
      ? await harvestViaRest(dspace, from, maxPages, progress)
      : await harvestViaOai(repo, from, maxPages, progress);
    // Only a complete pass counts as "success" (the next run's starting point).
    await logHarvest(repo.name, progress.fetched, progress.added, exhausted ? 'success' : 'partial', progressNotes(progress));
    log.info({ repo: repo.name, via: dspace ? 'rest' : 'oai', since: from ?? 'beginning', fetched: progress.fetched, added: progress.added, complete: exhausted }, 'Repository harvested');
    warnIfUnembedded(repo.name, progress);
    return { repo: repo.name, fetched: progress.fetched, added: progress.added, complete: exhausted };
  } catch (err) {
    if (err instanceof FirewallChallengeError) opts.blockedHosts?.add(err.host);
    // Reaching the size limit isn't a failure: what was saved stands and the next run carries on.
    const stopped = err instanceof StorageLimitError;
    const message = describeError(err);
    await logHarvest(repo.name, progress.fetched, progress.added, stopped ? 'partial' : 'error', progressNotes(progress, message));
    if (stopped) log.warn({ repo: repo.name, fetched: progress.fetched, added: progress.added }, message);
    else log.error({ repo: repo.name, err: message, fetched: progress.fetched, added: progress.added }, 'Repository harvest failed');
    warnIfUnembedded(repo.name, progress);
    return { repo: repo.name, fetched: progress.fetched, added: progress.added, complete: false, stopped };
  }
}

// ── OpenAlex: research by authors at Ghanaian institutions ───────────────────

const OPENALEX_FIRST_YEAR = 2010;

async function latestLog(source: string) {
  const { data } = await supabase
    .from('harvest_logs')
    .select('status, error_message')
    .eq('source', source)
    .order('harvested_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as { status: string; error_message: string | null } | null;
}

/** Harvest one OpenAlex date range; a partial run records its position so the next run carries on. */
async function harvestOpenAlexRange(source: string, range: { from: string; to?: string }, maxPages: number): Promise<HarvestResult> {
  const last = await latestLog(source);
  const resume = last?.status === 'partial' ? parseResume(last.error_message) : undefined;
  const progress = newProgress();
  const save = (rows: KnowledgeRow[], works: number) => {
    progress.fetched += works;
    return insertFresh(rows, progress);
  };
  try {
    let result;
    try {
      result = await harvestOpenAlexGhana(range, maxPages, save, resume);
    } catch (err) {
      if (!resume || stopsSource(err)) throw err;
      log.warn({ source, err: describeError(err) }, 'Saved OpenAlex position no longer works; starting the range again');
      result = await harvestOpenAlexGhana(range, maxPages, save);
    }
    // The resume position must come first in the message (see parseResume).
    const message = progressNotes(progress, result.complete ? undefined : `${RESUME}${result.nextCursor}`, result.note);
    await logHarvest(source, progress.fetched, progress.added, result.complete ? 'success' : 'partial', message);
    log.info({ source, ...range, fetched: progress.fetched, added: progress.added, complete: result.complete }, 'OpenAlex range harvested');
    warnIfUnembedded(source, progress);
    return { repo: source, fetched: progress.fetched, added: progress.added, complete: result.complete };
  } catch (err) {
    const stopped = err instanceof StorageLimitError;
    const message = describeError(err);
    await logHarvest(source, progress.fetched, progress.added, stopped ? 'partial' : 'error', progressNotes(progress, message));
    if (stopped) log.warn({ source }, message);
    else log.error({ source, err: message }, 'OpenAlex harvest failed');
    warnIfUnembedded(source, progress);
    return { repo: source, fetched: progress.fetched, added: progress.added, complete: false, stopped };
  }
}

/** The newest past year whose works haven't all been harvested yet. */
async function nextBackfillYear(): Promise<number | null> {
  const { data } = await supabase.from('harvest_logs').select('source').like('source', `${OPENALEX_GHANA} %`).eq('status', 'success');
  const done = new Set((data ?? []).map((r: { source: string }) => r.source));
  for (let year = new Date().getUTCFullYear() - 1; year >= OPENALEX_FIRST_YEAR; year--) {
    if (!done.has(`${OPENALEX_GHANA} ${year}`)) return year;
  }
  return null;
}

/**
 * Each run: recent works since the last complete run, then one more past year
 * (newest first), so the whole back-catalogue fills in over the weeks.
 */
export async function harvestOpenAlex(opts: { maxPages?: number } = {}) {
  const since = (await lastSuccessfulHarvest(OPENALEX_GHANA)) ?? new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
  const results = [await harvestOpenAlexRange(OPENALEX_GHANA, { from: since }, opts.maxPages ?? 10)];
  if (results[0].stopped) return results;
  const year = await nextBackfillYear();
  if (year) results.push(await harvestOpenAlexRange(`${OPENALEX_GHANA} ${year}`, { from: `${year}-01-01`, to: `${year}-12-31` }, opts.maxPages ?? 50));
  return results;
}

/**
 * Weekly job: every Ghanaian repository and journal in turn, then OpenAlex.
 * `repos` limits the repositories (an empty list means none); OpenAlex runs
 * by default only when no repositories were named. Stops early at the database size limit.
 */
export async function runFullHarvest(opts: { maxPages?: number; repos?: string[]; openAlex?: boolean } = {}) {
  const repos = opts.repos ? GHANA_REPOSITORIES.filter((r) => opts.repos!.includes(r.name)) : GHANA_REPOSITORIES;
  const results: HarvestResult[] = [];
  const blockedHosts = new Set<string>();
  for (const repo of repos) {
    const result = await harvestRepository(repo, { maxPages: opts.maxPages, blockedHosts });
    results.push(result);
    if (result.stopped) return results;
  }
  if (opts.openAlex ?? !opts.repos) results.push(...(await harvestOpenAlex({ maxPages: opts.maxPages })));
  return results;
}
