import { supabase } from '../../db/supabase.js';
import { childLogger } from '../../lib/logger.js';
import { chunkText } from '../rag/chunker.service.js';
import { generateEmbedding, generateEmbeddings } from '../rag/embedder.service.js';
import { MAX_SOURCE_CHARS } from './extract.service.js';
import { PLAN_LIMITS } from '../../lib/workspace-plans.js';

const log = childLogger('notebook');

// The most any plan allows; addSource takes the student's own plan limit.
export const MAX_SOURCES_PER_SESSION = PLAN_LIMITS.premium.sourcesPerDocument;
const MAX_CHUNKS_PER_SESSION = 4_000;
// ~220 words per chunk: small enough that a citation points at a specific passage.
const CHUNK_WORDS = 220;
const CHUNK_OVERLAP = 30;

export type SourceKind = 'pdf' | 'docx' | 'txt' | 'url' | 'text';

export interface NotebookSource {
  id: string;
  title: string;
  kind: SourceKind;
  url: string | null;
  authors: string | null;
  year: number | null;
  char_count: number;
  chunk_count: number;
  created_at: string;
}

const SOURCE_COLUMNS = 'id, title, kind, url, authors, year, char_count, chunk_count, created_at';

export class NotebookError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** The session must belong to the user; returns its title. */
export async function ownSession(sessionId: string, userId: string): Promise<{ title: string }> {
  const { data, error } = await supabase
    .from('workspace_sessions')
    .select('id, title')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new NotebookError('Could not load the document.', 500);
  if (!data) throw new NotebookError('Document not found.', 404);
  return { title: data.title };
}

export async function listSources(sessionId: string): Promise<NotebookSource[]> {
  const { data, error } = await supabase
    .from('notebook_sources')
    .select(SOURCE_COLUMNS)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) throw new NotebookError('Could not load sources.', 500);
  return (data ?? []) as NotebookSource[];
}

/** Throws unless the document has room for another source under this limit (403 below the most any plan allows). */
export async function assertSourceRoom(sessionId: string, maxSources = MAX_SOURCES_PER_SESSION): Promise<void> {
  const { count } = await supabase.from('notebook_sources').select('id', { count: 'exact', head: true }).eq('session_id', sessionId);
  if ((count ?? 0) < maxSources) return;
  throw maxSources < MAX_SOURCES_PER_SESSION
    ? new NotebookError(`Your plan holds up to ${maxSources} sources per document. Remove one, or upgrade for more.`, 403)
    : new NotebookError(`A document can have up to ${maxSources} sources. Remove one to add another.`);
}

export async function addSource(
  sessionId: string,
  userId: string,
  input: { kind: SourceKind; title: string; text: string; url?: string | null; authors?: string | null; year?: number | null },
  maxSources = MAX_SOURCES_PER_SESSION,
): Promise<NotebookSource> {
  const text = input.text.slice(0, MAX_SOURCE_CHARS).trim();
  if (text.length < 40) throw new NotebookError("That source doesn't contain enough text to use.");

  const [, { count: chunkCount }] = await Promise.all([
    assertSourceRoom(sessionId, maxSources),
    supabase.from('notebook_chunks').select('id', { count: 'exact', head: true }).eq('session_id', sessionId),
  ]);

  const chunks = chunkText(text, CHUNK_WORDS, CHUNK_OVERLAP);
  if ((chunkCount ?? 0) + chunks.length > MAX_CHUNKS_PER_SESSION) {
    throw new NotebookError('This document already has a lot of source material. Remove a source to add this one.');
  }

  const { data: source, error } = await supabase
    .from('notebook_sources')
    .insert({
      session_id: sessionId,
      user_id: userId,
      title: input.title.slice(0, 300) || 'Untitled source',
      kind: input.kind,
      url: input.url ?? null,
      authors: input.authors ?? null,
      year: input.year ?? null,
      char_count: text.length,
      chunk_count: chunks.length,
    })
    .select(SOURCE_COLUMNS)
    .single();
  if (error || !source) throw new NotebookError('Could not save the source.', 500);

  // Embeddings are optional: without them search falls back to keywords.
  const vectors = await generateEmbeddings(chunks);
  for (let i = 0; i < chunks.length; i += 200) {
    const { error: chunkError } = await supabase.from('notebook_chunks').insert(
      chunks.slice(i, i + 200).map((content, j) => ({
        source_id: source.id,
        session_id: sessionId,
        chunk_index: i + j,
        content,
        embedding: vectors[i + j] ?? null,
      })),
    );
    if (chunkError) {
      log.error({ err: chunkError.message }, 'Saving source chunks failed');
      await supabase.from('notebook_sources').delete().eq('id', source.id);
      throw new NotebookError('Could not save the source.', 500);
    }
  }
  return source as NotebookSource;
}

export async function updateSource(
  sessionId: string,
  sourceId: string,
  patch: { title?: unknown; authors?: unknown; year?: unknown },
): Promise<NotebookSource> {
  const updates: Record<string, unknown> = {};
  if (typeof patch.title === 'string' && patch.title.trim()) updates.title = patch.title.trim().slice(0, 300);
  if (typeof patch.authors === 'string') updates.authors = patch.authors.trim().slice(0, 500) || null;
  if (patch.year === null || patch.year === '') updates.year = null;
  else if (patch.year !== undefined) {
    const year = Number(patch.year);
    if (!Number.isInteger(year) || year < 1800 || year > 2100) throw new NotebookError('Year must be between 1800 and 2100.');
    updates.year = year;
  }
  if (!Object.keys(updates).length) throw new NotebookError('Nothing to update.');

  const { data, error } = await supabase
    .from('notebook_sources')
    .update(updates)
    .eq('id', sourceId)
    .eq('session_id', sessionId)
    .select(SOURCE_COLUMNS)
    .maybeSingle();
  if (error) throw new NotebookError('Could not update the source.', 500);
  if (!data) throw new NotebookError('Source not found.', 404);
  return data as NotebookSource;
}

export async function deleteSource(sessionId: string, sourceId: string): Promise<void> {
  const { error } = await supabase.from('notebook_sources').delete().eq('id', sourceId).eq('session_id', sessionId);
  if (error) throw new NotebookError('Could not remove the source.', 500);
}

export interface SourceExcerpt {
  source: NotebookSource;
  /** 1-based number the model cites as [n]. */
  n: number;
  passages: string[];
}

/** What the client needs to show and insert a citation for each numbered source. */
export function citationList(excerpts: SourceExcerpt[]) {
  return excerpts.map((e) => ({
    n: e.n,
    sourceId: e.source.id,
    title: e.source.title,
    authors: e.source.authors,
    year: e.source.year,
    url: e.source.url,
    kind: e.source.kind,
    snippet: e.passages[0]?.slice(0, 280) ?? '',
  }));
}

/**
 * Most relevant passages for a question, grouped by source and numbered by
 * source, so [2] always means "the second source in the list".
 */
export async function searchSources(sessionId: string, query: string, limit = 10, only?: string[]): Promise<SourceExcerpt[]> {
  const sources = await listSources(sessionId);
  if (!sources.length) return [];
  const chosen = only?.length ? new Set(only) : null;
  const embedding = await generateEmbedding(query).catch(() => null);

  const { data, error } = await supabase.rpc('search_notebook', {
    p_session: sessionId,
    p_query: query,
    p_embedding: embedding,
    // Fetch extra when filtering to chosen sources, then trim.
    p_limit: chosen ? limit * 4 : limit,
  });
  if (error) throw new NotebookError('Could not search your sources.', 500);

  let rows = ((data ?? []) as { source_id: string; chunk_index: number; content: string }[])
    .filter((r) => !chosen || chosen.has(r.source_id))
    .slice(0, limit);
  if (!rows.length) {
    // No keyword overlap and no embeddings: fall back to each source's opening passages.
    const { data: first } = await supabase
      .from('notebook_chunks')
      .select('source_id, chunk_index, content')
      .eq('session_id', sessionId)
      .lt('chunk_index', 2)
      .order('chunk_index');
    rows = ((first ?? []) as typeof rows).filter((r) => !chosen || chosen.has(r.source_id));
  }

  const bySource = new Map<string, string[]>();
  for (const row of rows) {
    const list = bySource.get(row.source_id) ?? [];
    list.push(row.content);
    bySource.set(row.source_id, list);
  }
  return sources
    .map((source, i) => ({ source, n: i + 1, passages: bySource.get(source.id) ?? [] }))
    .filter((e) => e.passages.length);
}

/**
 * Text from every source for whole-notebook outputs (summary, literature matrix…),
 * shared out evenly so one long PDF doesn't crowd out the rest.
 */
export async function sourceDigest(sessionId: string, maxChars = 60_000, only?: string[]): Promise<SourceExcerpt[]> {
  const all = await listSources(sessionId);
  // Numbers stay those of the full list, so [3] always means the third source.
  const numbered = all.map((source, i) => ({ source, n: i + 1 })).filter((e) => !only?.length || only.includes(e.source.id));
  if (!numbered.length) return [];
  const perSource = Math.floor(maxChars / numbered.length);

  return Promise.all(numbered.map(async ({ source, n }) => {
    const take = Math.max(1, Math.ceil(perSource / 1_400)); // ~1,400 characters per chunk
    const { data } = await supabase
      .from('notebook_chunks')
      .select('content')
      .eq('source_id', source.id)
      .order('chunk_index')
      .limit(take);
    let budget = perSource;
    const passages: string[] = [];
    for (const row of data ?? []) {
      if (budget <= 0) break;
      passages.push(row.content.slice(0, budget));
      budget -= row.content.length;
    }
    return { source, n, passages };
  }));
}
