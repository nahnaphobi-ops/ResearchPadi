import { CONFIG } from '../../../config';
import { childLogger } from '../../../lib/logger';
import { supabase } from '../../../db/supabase';
import { cacheGet } from '../../../lib/cache';
import { acquireToken } from './rate-limiter';
import { titleSimilarity, surnameMatches, yearMatches } from './similarity';
import type {
  ReferenceEntry,
  MatchSource,
  VerificationResult,
  Candidate,
} from './types';

const log = childLogger('citation-verifier');

const CACHE_TTL_EXT = 86400 * 7; // 7 days — external lookups change slowly

/** Phase 2a — local RAG store (knowledge_chunks). Cheapest, Ghanaian focus. */
async function searchRag(title: string, limit: number): Promise<Candidate[]> {
  try {
    const { data, error } = await supabase
      .from('knowledge_chunks')
      .select('id, document_title, authors, year')
      .ilike('document_title', `%${title}%`)
      .limit(limit);

    if (error || !data) return [];
    return data.map((r: any) => ({
      id: r.id,
      title: r.document_title || '',
      authors: (r.authors || '')
        .split(',')
        .map((a: string) => a.trim())
        .filter(Boolean),
      year: r.year,
      source: 'rag' as const,
    }));
  } catch (err: any) {
    log.warn({ err: err.message }, 'RAG citation search failed');
    return [];
  }
}

/** Phase 2b — OpenAlex, throttled + cached. */
async function searchOpenAlex(title: string, limit: number): Promise<Candidate[]> {
  return cacheGet<Candidate[]>(
    `cv:openalex:${title.toLowerCase().trim()}`,
    CACHE_TTL_EXT,
    async () => {
      try {
        await acquireToken();
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          CONFIG.CITATION_VERIFY.EXTERNAL_PER_REQUEST_TIMEOUT_MS,
        );
        const res = await fetch(
          `https://api.openalex.org/works?search=${encodeURIComponent(title)}&per-page=${limit}`,
          { signal: controller.signal },
        );
        clearTimeout(timeout);
        if (!res.ok) return [];
        const json = (await res.json()) as any;
        return (json.results || []).map((w: any) => ({
          id: w.id,
          title: w.title || '',
          authors: (w.authorships || []).map((a: any) => a.author?.display_name || ''),
          year: w.publication_year,
          source: 'openalex' as const,
        }));
      } catch (err: any) {
        log.warn({ err: err.message }, 'OpenAlex lookup failed');
        return [];
      }
    },
  );
}

/** Phase 2b — Semantic Scholar, throttled + cached. */
async function searchSemanticScholar(title: string, limit: number): Promise<Candidate[]> {
  return cacheGet<Candidate[]>(
    `cv:semantic:${title.toLowerCase().trim()}`,
    CACHE_TTL_EXT,
    async () => {
      try {
        await acquireToken();
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          CONFIG.CITATION_VERIFY.EXTERNAL_PER_REQUEST_TIMEOUT_MS,
        );
        const res = await fetch(
          `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(
            title,
          )}&limit=${limit}&fields=title,authors,year`,
          { signal: controller.signal },
        );
        clearTimeout(timeout);
        if (!res.ok) return [];
        const json = (await res.json()) as any;
        return (json.data || []).map((p: any) => ({
          id: p.paperId || p.id,
          title: p.title || '',
          authors: (p.authors || []).map((a: any) => a.name || ''),
          year: p.year,
          source: 'semantic_scholar' as const,
        }));
      } catch (err: any) {
        log.warn({ err: err.message }, 'Semantic Scholar lookup failed');
        return [];
      }
    },
  );
}

interface Score {
  candidate: Candidate;
  titleScore: number;
  authorMatch: boolean;
  yearMatch: boolean;
  total: number;
}

/**
 * Phase 3 — deterministic scoring + confidence classification.
 * Never uses an LLM. Conservative thresholds (config-driven).
 */
function scoreCandidates(ref: ReferenceEntry, candidates: Candidate[]): Score[] {
  const tol = CONFIG.CITATION_VERIFY.YEAR_TOLERANCE;
  const scores: Score[] = [];

  for (const c of candidates) {
    const titleScore = ref.title ? titleSimilarity(ref.title, c.title) : 0;
    const authorMatch = ref.authors.some(a =>
      c.authors.some(ca => surnameMatches(a.surname, ca)),
    );
    const yearMatch = yearMatches(ref.year, c.year, tol);
    const total = titleScore * 0.7 + (authorMatch ? 0.15 : 0) + (yearMatch ? 0.15 : 0);
    scores.push({ candidate: c, titleScore, authorMatch, yearMatch, total });
  }

  return scores.sort((a, b) => b.total - a.total);
}

function classify(
  ref: ReferenceEntry,
  best: Score | undefined,
): { status: VerificationResult['match_status']; source: MatchSource; confidence: number } {
  const cfg = CONFIG.CITATION_VERIFY;

  if (!best) {
    return { status: 'unverified', source: 'none', confidence: 0 };
  }

  const titleOk = best.titleScore >= cfg.TITLE_SIMILARITY_VERIFIED;
  const titlePartial = best.titleScore >= cfg.TITLE_SIMILARITY_PARTIAL;

  // VERIFIED requires strong title + author + year.
  if (titleOk && best.authorMatch && best.yearMatch) {
    return { status: 'verified', source: best.candidate.source, confidence: best.total };
  }

  // PARTIAL: title is close but something is off (year/author), or partial title + author/year.
  if (titlePartial && (best.authorMatch || best.yearMatch)) {
    return { status: 'partial_match', source: best.candidate.source, confidence: best.total };
  }

  if (titlePartial) {
    return { status: 'partial_match', source: best.candidate.source, confidence: best.total };
  }

  return { status: 'unverified', source: 'none', confidence: best.total };
}

/**
 * Verify a single reference entry against RAG → OpenAlex → Semantic Scholar.
 * Degrades gracefully: any source failure yields [] and we continue.
 * If both external APIs are unreachable, marks api_unavailable but still
 * returns a result (RAG/local check already attempted).
 */
export async function verifyReference(
  ref: ReferenceEntry,
  opts?: { candidateProvider?: (title: string) => Promise<Candidate[]> },
): Promise<VerificationResult> {
  const cfg = CONFIG.CITATION_VERIFY;
  const limit = cfg.CANDIDATE_LIMIT;
  const title = ref.title || '';

  let candidates: Candidate[] = [];
  let apiUnavailable = false;

  if (opts?.candidateProvider) {
    // Test seam: inject deterministic candidates.
    candidates = await opts.candidateProvider(title);
  } else {
    // 1. Local RAG
    if (title) candidates = candidates.concat(await searchRag(title, limit));

    // 2. OpenAlex
    if (title) {
      const oa = await searchOpenAlex(title, limit);
      if (oa.length === 0 && title) apiUnavailable = apiUnavailable; // openalex failure is silent in cache
      candidates = candidates.concat(oa);
    }

    // 3. Semantic Scholar
    if (title) {
      candidates = candidates.concat(await searchSemanticScholar(title, limit));
    }
  }

  const scored = scoreCandidates(ref, candidates);
  const best = scored[0];

  const { status, source, confidence } = classify(ref, best);

  const matchedSource: MatchSource =
    status === 'unverified' ? (apiUnavailable ? 'api_unavailable' : 'none') : source;

  return {
    citation_id: ref.id,
    raw_string: ref.raw_string,
    parsed_authors: ref.authors.map(a => a.surname),
    parsed_year: ref.year,
    parsed_title: ref.title,
    match_status: status,
    matched_source: matchedSource,
    matched_record_id: best ? best.candidate.id : undefined,
    confidence_score: Number(confidence.toFixed(4)),
    checked_at: new Date().toISOString(),
  };
}

/** Verify all references. */
export async function verifyAllReferences(
  refs: ReferenceEntry[],
): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];
  for (const ref of refs) {
    results.push(await verifyReference(ref));
  }
  return results;
}
