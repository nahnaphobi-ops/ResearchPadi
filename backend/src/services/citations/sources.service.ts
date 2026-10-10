import { supabase } from '../../db/supabase.js';
import { parseAuthors, serializeAuthors } from '../../lib/authors.js';
import { childLogger } from '../../lib/logger.js';
import { searchKnowledge, type KnowledgeHit } from '../rag/retriever.service.js';
import { DSPACE_REPOSITORIES, dspaceItemToSource, searchGhanaRepositories } from '../rag/dspace.service.js';
import { generateEmbeddings } from '../rag/embedder.service.js';
import { chunkText } from '../rag/chunker.service.js';
import { CONFIG } from '../../config/index.js';
import { searchOpenAlex } from './openalex.service.js';
import { searchSemanticScholar } from './semantic.service.js';
import { normaliseDoi, sourceKey, type Source, type SourceOrigin, type SourceType } from './source.types.js';

const log = childLogger('sources');

/** Friendly repository names for knowledge-base source_name values. */
const REPOSITORY_LABELS: Record<string, string> = {
  UGSpace: 'UGSpace',
  KNUST: 'KNUSTSpace',
  Ashesi_AIR: 'Ashesi Institutional Repository',
  HF_NMTC_Berekum: 'Holy Family NMTC Berekum Repository',
  UCC: 'UCC Institutional Repository',
  UEW: 'UEW Institutional Repository',
};

const OPENALEX_GHANA_SOURCE = 'OpenAlex (Ghana)';

function inferType(hit: KnowledgeHit, authorCount: number): { type: SourceType; genre?: string } {
  const declared = (hit.document_type || '').toLowerCase();
  if (declared.includes('thesis') || declared.includes('dissertation')) return { type: 'thesis', genre: hit.document_type || 'Thesis' };
  if (declared.includes('article')) return { type: 'article' };
  if (declared.includes('book')) return { type: declared.includes('chapter') ? 'chapter' : 'book' };
  if (declared.includes('report')) return { type: 'report' };
  if (hit.journal || hit.doi) return { type: 'article' };
  if (/care study/i.test(hit.document_title)) return { type: 'report', genre: 'Patient/family care study' };
  if (hit.source_name === OPENALEX_GHANA_SOURCE) return { type: 'article' };
  // Ghanaian repositories are mostly student theses; multi-author items are usually staff articles.
  return authorCount > 1 ? { type: 'article' } : { type: 'thesis', genre: 'Thesis' };
}

export function knowledgeHitToSource(hit: KnowledgeHit): Source {
  const authors = parseAuthors(hit.authors);
  const { type, genre } = inferType(hit, authors.length);
  const doi = normaliseDoi(hit.doi);
  return {
    id: doi ? `doi:${doi}` : `kb:${hit.source_url || hit.id}`,
    title: hit.document_title.replace(/\s+/g, ' ').trim(),
    authors,
    year: hit.year,
    type,
    genre,
    containerTitle: hit.journal || undefined,
    doi,
    url: hit.source_url || (doi ? `https://doi.org/${doi}` : undefined),
    publisher: hit.publisher || undefined,
    institution: hit.institution || undefined,
    repository: hit.source_name ? REPOSITORY_LABELS[hit.source_name] : undefined,
    origin: 'ghana-repository',
    ghanaian: true,
    snippet: hit.chunk_text?.slice(0, 600),
  };
}

export interface FindSourcesOptions {
  ghanaFirst?: boolean;
  yearFrom?: number;
  limit?: number;
  origins?: SourceOrigin[];
}

/** Merge two records of the same work, keeping whichever fields are filled in. */
function merge(a: Source, b: Source): Source {
  const pick = <K extends keyof Source>(k: K) => (a[k] !== undefined && a[k] !== '' ? a[k] : b[k]);
  return {
    ...a,
    authors: a.authors.length >= b.authors.length ? a.authors : b.authors,
    year: a.year ?? b.year,
    containerTitle: pick('containerTitle'),
    volume: pick('volume'),
    issue: pick('issue'),
    pages: pick('pages'),
    doi: pick('doi'),
    url: pick('url'),
    publisher: pick('publisher'),
    institution: pick('institution'),
    snippet: pick('snippet'),
    ghanaian: a.ghanaian || b.ghanaian,
    citedByCount: Math.max(a.citedByCount ?? 0, b.citedByCount ?? 0) || undefined,
  };
}

/**
 * One search across the Ghanaian knowledge base, Ghana-affiliated OpenAlex works,
 * global OpenAlex and Semantic Scholar — de-duplicated and ranked.
 */
export async function findSources(query: string, opts: FindSourcesOptions = {}): Promise<Source[]> {
  const q = query.replace(/\s+/g, ' ').trim();
  if (!q) return [];
  const want = (o: SourceOrigin) => !opts.origins?.length || opts.origins.includes(o);
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 40);
  const ghanaFirst = opts.ghanaFirst ?? true;

  const [kb, live, oaGhana, oaGlobal, s2] = await Promise.all([
    want('ghana-repository') ? searchKnowledge(q, { limit: 10, yearFrom: opts.yearFrom }).then((h) => h.map(knowledgeHitToSource)) : [],
    want('ghana-repository') ? searchGhanaRepositories(q, { perRepo: 4, yearFrom: opts.yearFrom }).then((items) => items.map(dspaceItemToSource)) : [],
    want('openalex') ? searchOpenAlex(q, { ghanaOnly: true, yearFrom: opts.yearFrom, perPage: 10 }) : [],
    want('openalex') ? searchOpenAlex(q, { yearFrom: opts.yearFrom, perPage: 10 }) : [],
    want('semantic-scholar') ? searchSemanticScholar(q, { yearFrom: opts.yearFrom, limit: 8 }) : [],
  ]);

  // Reciprocal-rank scoring per list, weighted by how relevant that list is for Ghanaian students.
  const lists: [Source[], number][] = [[live, 1.0], [kb, 0.95], [oaGhana, 0.95], [oaGlobal, 0.75], [s2, 0.7]];
  const byKey = new Map<string, { source: Source; score: number }>();
  for (const [list, weight] of lists) {
    list.forEach((s, rank) => {
      const key = sourceKey(s);
      const score = weight / (rank + 3);
      const existing = byKey.get(key);
      if (existing) byKey.set(key, { source: merge(existing.source, s), score: existing.score + score });
      else byKey.set(key, { source: s, score });
    });
  }

  const ranked = [...byKey.values()]
    .map((e) => ({ ...e, score: e.score + (ghanaFirst && e.source.ghanaian ? 0.08 : 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((e) => e.source);

  // Grow the knowledge base with the Ghanaian works students are finding, so paper
  // generation and claim checks can draw on them too.
  void ingestIntoKnowledgeBase([...live, ...oaGhana]).catch((err) => log.warn({ err: (err as Error).message }, 'Background ingest failed'));

  return ranked;
}

const REPO_BY_LABEL = new Map(DSPACE_REPOSITORIES.map((r) => [r.label, r]));

/**
 * Store Ghanaian works (repository items and Ghana-affiliated OpenAlex articles)
 * that have abstracts in the knowledge base, skipping ones already there.
 */
async function ingestIntoKnowledgeBase(works: Source[]) {
  const candidates = works.filter((w) => w.ghanaian && w.snippet && w.snippet.length > 200 && w.url).slice(0, 15);
  if (!candidates.length) return;

  const dois = candidates.map((w) => w.doi).filter((d): d is string => !!d);
  const urls = candidates.map((w) => w.url!).filter(Boolean);
  const [byDoi, byUrl] = await Promise.all([
    dois.length ? supabase.from('knowledge_chunks').select('doi').in('doi', dois) : Promise.resolve({ data: [] as { doi: string }[] }),
    supabase.from('knowledge_chunks').select('source_url').in('source_url', urls),
  ]);
  const known = new Set<string>([
    ...((byDoi.data ?? []) as { doi: string | null }[]).map((r) => (r.doi || '').toLowerCase()),
    ...((byUrl.data ?? []) as { source_url: string | null }[]).map((r) => r.source_url || ''),
  ]);

  const pending: { w: Source; chunk: string; index: number }[] = [];
  for (const w of candidates) {
    if ((w.doi && known.has(w.doi)) || known.has(w.url!)) continue;
    known.add(w.url!);
    chunkText(w.snippet!, CONFIG.RAG.CHUNK_SIZE, CONFIG.RAG.CHUNK_OVERLAP).forEach((chunk, index) => pending.push({ w, chunk, index }));
  }
  if (!pending.length) return;

  const vectors = await generateEmbeddings(pending.map((p) => `${p.w.title}. ${p.chunk}`));
  const rows = pending.map(({ w, chunk, index }, i) => {
    const repo = w.repository ? REPO_BY_LABEL.get(w.repository) : undefined;
    return {
      source_name: repo?.sourceName ?? OPENALEX_GHANA_SOURCE,
      source_url: w.url,
      document_title: w.title,
      authors: serializeAuthors(w.authors) || null,
      year: w.year,
      institution: w.institution ?? repo?.institution ?? null,
      field: 'General',
      chunk_text: chunk,
      chunk_index: index,
      doi: w.doi ?? null,
      journal: w.containerTitle ?? null,
      publisher: w.publisher ?? null,
      document_type: w.genre ?? w.type,
      embedding: vectors[i],
    };
  });
  const { error } = await supabase.from('knowledge_chunks').insert(rows);
  if (error) log.warn({ err: error.message }, 'Could not store Ghanaian works');
  else log.info({ works: new Set(rows.map((r) => r.source_url)).size, chunks: rows.length }, 'Knowledge base grew from student searches');
}
