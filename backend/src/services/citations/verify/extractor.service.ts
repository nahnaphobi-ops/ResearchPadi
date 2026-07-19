import { childLogger } from '../../../lib/logger.js';
import { aiCall } from '../../ai/gateway.service.js';
import { normalizeText } from './similarity.js';
import type {
  ParsedAuthor,
  ParsedCitation,
  InTextCitation,
  ReferenceEntry,
  ExtractionMethod,
} from './types.js';

const log = childLogger('citation-extractor');

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter}`;
}

/**
 * Parse an author name into surname + given.
 * Handles "Mensah, K." and "Kwame Mensah" and "K. Mensah".
 */
export function parseAuthor(raw: string): ParsedAuthor {
  const trimmed = raw.trim().replace(/\.$/, '').trim();
  if (trimmed.includes(',')) {
    const [surname, ...rest] = trimmed.split(',');
    return { raw: trimmed, surname: surname.trim(), given: rest.join(' ').trim() || undefined };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { raw: trimmed, surname: parts[0] };
  const surname = parts[parts.length - 1];
  const given = parts.slice(0, -1).join(' ');
  return { raw: trimmed, surname, given: given || undefined };
}

function parseAuthorList(raw: string): ParsedAuthor[] {
  return raw
    .split(/,|&| and /i)
    .map(a => a.trim())
    .filter(Boolean)
    .map(parseAuthor);
}

// --- In-text citation regexes (APA-ish) ---
// (Mensah, 2021)
// (Mensah & Owusu, 2019)
// (Mensah, Owusu & Boateng, 2019)
// Mensah (2021) found ...  -> narrative
const IN_TEXT_PAREN = /\(([^()]+?,\s*\d{4}[a-z]?)\)/g;
const NARRATIVE = /([A-Z][\p{L}.]+(?:\s*(?:&|and)?\s*[A-Z][\p{L}.]+)*)\s*\((\d{4}[a-z]?)\)/gu;

// --- Reference-list entry regexes ---
const YEAR_RE = /(?:\(?(\d{4}[a-z]?)\)?)/;
const DOI_RE = /(?:doi:|https?:\/\/doi\.org\/)(10\.\S+)/i;
const URL_RE = /https?:\/\/[^\s,]+/;
const TITLE_SPLIT_RE = /\((\d{4}[a-z]?)\)\.\s*(.*?)(?:\.|$)|\.([^*](?:.*?))(?:\.|$)/;

function extractYear(s: string): number | undefined {
  const m = s.match(YEAR_RE);
  if (m) return parseInt(m[1].replace(/[a-z]/, ''), 10);
  return undefined;
}

function extractDoi(s: string): string | undefined {
  const m = s.match(DOI_RE);
  return m ? m[1] : undefined;
}

function extractUrl(s: string): string | undefined {
  const m = s.match(URL_RE);
  return m ? m[0].replace(/[.,]$/, '') : undefined;
}

/**
 * Attempt to parse a single reference-list entry with regex.
 * Returns null when it cannot confidently determine authors + year + title.
 */
function parseReferenceEntry(raw: string): ReferenceEntry | null {
  const year = extractYear(raw);
  if (year == null) return null;

  // Authors are typically at the start, before the year.
  const beforeYear = raw.substring(0, raw.search(YEAR_RE));
  const authorPart = beforeYear.replace(/[.\s]*$/, '');
  if (!authorPart.trim()) return null;

  const authors = parseAuthorList(authorPart);

  // Title: text after the year, before the publisher/DOI/URL.
  const afterYear = raw.substring(raw.search(YEAR_RE) + raw.match(YEAR_RE)![0].length);
  let title: string | undefined;
  const titleMatch = afterYear.match(/\.\s*\**([^*].+?)\**\s*\./);
  if (titleMatch) {
    title = titleMatch[1].trim().replace(/\*+/g, '');
  } else {
    const rest = afterYear.replace(/^[.\s]+/, '').replace(/\*+/g, '').trim();
    if (rest.length > 10) title = rest.split(/\.\s/)[0];
  }

  if (!title) return null;

  const publisher = afterYear
    .replace(titleMatch ? titleMatch[0] : title!, '')
    .replace(DOI_RE, '')
    .replace(URL_RE, '')
    .replace(/\*/g, '')
    .replace(/\./g, ' ')
    .trim();

  return {
    id: nextId('ref'),
    authors,
    year,
    title,
    publisher: publisher || undefined,
    doi: extractDoi(raw),
    url: extractUrl(raw),
    raw_string: raw.trim(),
    source_location: 'reference_list',
    extraction_method: 'regex',
  };
}

/**
 * Phase 1 — deterministic first pass for the whole document.
 * Extracts in-text citations and reference-list entries.
 * Entries the regex cannot confidently parse are sent to an LLM extraction
 * call (marked llm_assisted) — but NEVER auto-verified on that basis.
 */
export async function extractCitations(
  fullText: string,
  referenceList?: string,
): Promise<{ inText: InTextCitation[]; references: ReferenceEntry[] }> {
  const inText: InTextCitation[] = [];
  const references: ReferenceEntry[] = [];

  // --- In-text (parenthetical) ---
  for (const m of fullText.matchAll(IN_TEXT_PAREN)) {
    const inner = m[1].trim();
    const yearMatch = inner.match(/(\d{4}[a-z]?)\s*$/);
    if (!yearMatch) continue;
    const year = parseInt(yearMatch[1].replace(/[a-z]/, ''), 10);
    const authorPart = inner.replace(/,\s*\d{4}[a-z]?$/, '').trim();
    const authors = authorPart ? parseAuthorList(authorPart) : [];
    inText.push({
      id: nextId('it'),
      authors,
      year,
      raw_string: m[0],
      source_location: 'in_text',
      extraction_method: 'regex',
    });
  }

  // --- In-text (narrative) ---
  for (const m of fullText.matchAll(NARRATIVE)) {
    const namePart = m[1].trim();
    const year = parseInt(m[2].replace(/[a-z]/, ''), 10);
    const authors = parseAuthorList(namePart);
    inText.push({
      id: nextId('it'),
      authors,
      year,
      raw_string: m[0],
      source_location: 'in_text',
      extraction_method: 'regex',
    });
  }

  // --- Reference list ---
  const refBlock = referenceList ?? extractReferenceBlock(fullText);
  const entries = refBlock
    .split(/\n+/)
    .map(l => l.trim())
    .filter(l => /^\d+\.|^- |^• /.test(l) || l.length > 20)
    .map(l => l.replace(/^\d+\.\s*|^-\s*|^•\s*/, ''))
    .filter(Boolean);

  const llmCandidates: string[] = [];
  for (const e of entries) {
    const parsed = parseReferenceEntry(e);
    if (parsed) {
      references.push(parsed);
    } else {
      llmCandidates.push(e);
    }
  }

  if (llmCandidates.length > 0) {
    const llmParsed = await llmExtractReferences(llmCandidates);
    references.push(...llmParsed);
  }

  log.info(
    { inText: inText.length, references: references.length },
    'Citation extraction complete',
  );

  return { inText, references };
}

/** Heuristically isolate a reference-list block from full text. */
function extractReferenceBlock(fullText: string): string {
  const idx = fullText.search(/\breferences\b\s*\n/i);
  if (idx === -1) return '';
  return fullText.substring(idx);
}

/**
 * Narrow, low-risk LLM use: parse only free-form reference strings the
 * regex could not handle. Output is strictly structured; the result is
 * marked llm_assisted so downstream logic never treats it as verified.
 */
async function llmExtractReferences(rawEntries: string[]): Promise<ReferenceEntry[]> {
  try {
    const prompt = `Parse each reference into JSON. Return an array of objects: { authors: string[], year: number, title: string, publisher?: string, doi?: string, url?: string }.
Only output valid JSON, no prose.
References:
${rawEntries.map((e, i) => `${i + 1}. ${e}`).join('\n')}`;

    const res = await aiCall({
      prompt,
      tier: 'drafting',
      cachePrompt: false,
      meta: { action: 'citation_extract' },
    });

    const json = JSON.parse(res.text);
    if (!Array.isArray(json)) return [];
    return json.map((o: any) => ({
      id: nextId('ref'),
      authors: Array.isArray(o.authors) ? o.authors.map((a: string) => parseAuthor(a)) : [],
      year: o.year ? parseInt(String(o.year).replace(/[a-z]/, ''), 10) : undefined,
      title: o.title,
      publisher: o.publisher,
      doi: o.doi,
      url: o.url,
      raw_string: '',
      source_location: 'reference_list' as const,
      extraction_method: 'llm_assisted' as ExtractionMethod,
    }));
  } catch (err: any) {
    log.warn({ err: err.message }, 'LLM reference extraction failed; skipping unparsable entries');
    return [];
  }
}
