const FILTER_META = /[,().\\*]/g;
const ILIKE_WILDCARDS = /[%_]/g;

/**
 * Strip PostgREST `.or()` / `.ilike()` metacharacters so user input cannot
 * widen or inject filters (commas separate OR clauses; dots select operators).
 */
export function sanitizeIlikeTerm(raw: unknown, maxLen = 80): string {
  return String(raw ?? '')
    .slice(0, maxLen)
    .replace(FILTER_META, ' ')
    .replace(ILIKE_WILDCARDS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function ilikeContains(term: string): string {
  return `%${term}%`;
}
