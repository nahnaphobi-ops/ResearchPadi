import { SEVERITIES, SUGGESTION_TYPES } from './spans.js';

/**
 * JSON schemas for structured outputs (output_config.format). The API enforces
 * them, except when a response is cut off at max_tokens, so every response is
 * still checked here before use.
 */

const sentenceItem = (extra: Record<string, unknown>, required: string[]) => ({
  type: 'object',
  additionalProperties: false,
  properties: {
    section: { type: 'string' },
    sentence: { type: 'string', description: 'The exact sentence from the paper, copied character for character.' },
    ...extra,
  },
  required: ['section', 'sentence', ...required],
});

export const READER_NOTES_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { section: { type: 'string' }, summary: { type: 'string' } },
        required: ['section', 'summary'],
      },
    },
    unsupported_claims: {
      type: 'array',
      items: sentenceItem(
        {
          source_key: { type: 'string', description: 'Key of the cited source, e.g. S3, or "" when none is cited.' },
          issue: { type: 'string', enum: ['no_citation', 'source_does_not_support', 'source_may_not_support'] },
          detail: { type: 'string' },
        },
        ['source_key', 'issue', 'detail'],
      ),
    },
    citation_problems: {
      type: 'array',
      items: sentenceItem(
        {
          problem: { type: 'string', enum: ['missing', 'malformed', 'not_in_sources', 'uncited_reference'] },
          detail: { type: 'string' },
        },
        ['problem', 'detail'],
      ),
    },
    issues: {
      type: 'array',
      items: sentenceItem(
        {
          kind: { type: 'string', enum: ['inconsistency', 'repetition', 'weak', 'unclear'] },
          detail: { type: 'string' },
        },
        ['kind', 'detail'],
      ),
    },
  },
  required: ['summary', 'unsupported_claims', 'citation_problems', 'issues'],
} as const;

export interface ReaderNotes {
  summary: { section: string; summary: string }[];
  unsupported_claims: { section: string; sentence: string; source_key: string; issue: string; detail: string }[];
  citation_problems: { section: string; sentence: string; problem: string; detail: string }[];
  issues: { section: string; sentence: string; kind: string; detail: string }[];
}

export const SUPERVISOR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          section: { type: 'string' },
          type: { type: 'string', enum: [...SUGGESTION_TYPES] },
          severity: { type: 'string', enum: [...SEVERITIES] },
          original: { type: 'string', description: 'Exact text from the paper, verbatim.' },
          suggested: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['id', 'section', 'type', 'severity', 'original', 'suggested', 'reason'],
      },
    },
  },
  required: ['suggestions'],
} as const;

/** The model's output was not the JSON we asked for. The message never contains model or paper text. */
export class ReviewOutputError extends Error {}

const list = (v: unknown) => (Array.isArray(v) ? v : []);
const s = (v: unknown) => (typeof v === 'string' ? v : '');

export function parseReaderNotes(text: string): ReaderNotes {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ReviewOutputError('Reader notes were not valid JSON');
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.summary)) {
    throw new ReviewOutputError('Reader notes did not match the schema');
  }
  return {
    summary: list(data.summary).map((x: any) => ({ section: s(x?.section), summary: s(x?.summary) })),
    unsupported_claims: list(data.unsupported_claims)
      .map((x: any) => ({ section: s(x?.section), sentence: s(x?.sentence), source_key: s(x?.source_key), issue: s(x?.issue), detail: s(x?.detail) }))
      .filter((x) => x.sentence),
    citation_problems: list(data.citation_problems)
      .map((x: any) => ({ section: s(x?.section), sentence: s(x?.sentence), problem: s(x?.problem), detail: s(x?.detail) }))
      .filter((x) => x.sentence),
    issues: list(data.issues)
      .map((x: any) => ({ section: s(x?.section), sentence: s(x?.sentence), kind: s(x?.kind), detail: s(x?.detail) }))
      .filter((x) => x.sentence),
  };
}

export function mergeReaderNotes(parts: ReaderNotes[]): ReaderNotes {
  return {
    summary: parts.flatMap((p) => p.summary),
    unsupported_claims: parts.flatMap((p) => p.unsupported_claims),
    citation_problems: parts.flatMap((p) => p.citation_problems),
    issues: parts.flatMap((p) => p.issues),
  };
}

export function noteCount(n: ReaderNotes): number {
  return n.unsupported_claims.length + n.citation_problems.length + n.issues.length;
}

/**
 * The complete objects at the start of the array under `key`, from JSON that
 * may be cut off part-way (a response that hit max_tokens). Objects after the
 * cut are lost; every object returned parsed on its own.
 */
export function salvageArrayItems(text: string, key: string): unknown[] {
  const keyAt = text.indexOf(`"${key}"`);
  if (keyAt === -1) return [];
  const open = text.indexOf('[', keyAt);
  if (open === -1) return [];

  const items: unknown[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = open + 1; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        try {
          items.push(JSON.parse(text.slice(start, i + 1)));
        } catch {
          // a malformed object: skip it
        }
        start = -1;
      }
    } else if (c === ']' && depth === 0) break;
  }
  return items;
}

/** Suggestions from a supervisor response; salvages complete items when it was cut off. */
export function parseSuggestions(text: string, truncated: boolean): { items: unknown[]; salvaged: boolean } {
  try {
    const data = JSON.parse(text);
    if (data && Array.isArray(data.suggestions)) return { items: data.suggestions, salvaged: false };
  } catch {
    // fall through to salvage
  }
  if (!truncated) throw new ReviewOutputError('Supervisor output was not valid JSON');
  return { items: salvageArrayItems(text, 'suggestions'), salvaged: true };
}
