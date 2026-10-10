/**
 * Turn the author strings found in Ghanaian repositories and scholarly APIs into
 * structured names, so citation styles can render "Mensah, K." or "K. Mensah" correctly.
 *
 * Handles:  "Mensah, Kwame"            (Surname, Given)
 *           "Amoah, A.G.B., Baddoo, H." (Surname, Initials pairs)
 *           "Hawa Yakubu Barry"         (natural order)
 *           "Mensah, K.; Owusu, A."     (semicolon lists)
 *           "Kwame Mensah, Ama Owusu"   (natural-order comma lists)
 */

export interface PersonName {
  family: string;
  given: string;
}

const TITLES = /^(dr|prof|professor|mr|mrs|ms|miss|rev|revd|engr|hon|sir)\.?\s+/i;
const PARTICLES = new Set(['van', 'von', 'de', 'der', 'den', 'da', 'di', 'del', 'della', 'du', 'la', 'le', 'dos', 'das', 'bin', 'ibn', 'al']);
const INITIALS = /^(?:[A-Z][a-z]?\.?\s*-?\s*){1,5}$/;

function titleCaseIfShouting(value: string): string {
  if (value !== value.toUpperCase() || !/[A-Z]{3,}/.test(value)) return value;
  return value.toLowerCase().replace(/(^|[\s\-'’])(\p{L})/gu, (_, p: string, c: string) => p + c.toUpperCase());
}

function clean(part: string): string {
  let s = part.replace(/\s+/g, ' ').trim();
  while (TITLES.test(s)) s = s.replace(TITLES, '');
  s = s.replace(/\bet\.?\s*al\.?$/i, '').replace(/[.,;]+$/, (m) => (m.includes('.') && /\b[A-Z]$/.test(s.slice(0, -m.length)) ? '.' : ''));
  return titleCaseIfShouting(s.trim());
}

function isInitials(value: string): boolean {
  return INITIALS.test(value.trim());
}

/** "Kwame Ama Mensah" → { family: "Mensah", given: "Kwame Ama" }; "Mensah K.A." → family first. */
function parseNatural(raw: string): PersonName | null {
  const name = clean(raw);
  if (!name) return null;
  const words = name.split(' ');
  if (words.length === 1) return { family: words[0], given: '' };

  // Vancouver-style "Mensah KA" / "Mensah K.A."
  const last = words[words.length - 1];
  if (isInitials(last) && !isInitials(words[0]) && words.length <= 3) {
    return { family: words.slice(0, -1).join(' '), given: last };
  }

  // Keep surname particles: "Kofi van der Puije" → "van der Puije"
  let i = words.length - 1;
  while (i > 1 && PARTICLES.has(words[i - 1].toLowerCase())) i--;
  return { family: words.slice(i).join(' '), given: words.slice(0, i).join(' ') };
}

function parseCommaSegment(segment: string): PersonName[] {
  const tokens = segment.split(',').map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) return [];
  if (tokens.length === 1) return [parseNatural(tokens[0])].filter((n): n is PersonName => !!n);

  // "Kwame Mensah, Ama Owusu" — every token is a full natural-order name.
  const allFullNames = tokens.every((t) => clean(t).split(' ').length >= 2 && !isInitials(t));
  const firstLooksLikeSurnameOnly = clean(tokens[0]).split(' ').length === 1;
  if (allFullNames && !firstLooksLikeSurnameOnly) {
    return tokens.map(parseNatural).filter((n): n is PersonName => !!n);
  }

  // "Surname, Given[, Surname, Given…]" pairs. With an odd count, only pair when the next token is initials.
  const names: PersonName[] = [];
  const even = tokens.length % 2 === 0;
  for (let i = 0; i < tokens.length; ) {
    const family = clean(tokens[i]);
    const next = tokens[i + 1];
    if (next !== undefined && (even || isInitials(next))) {
      names.push({ family, given: clean(next) });
      i += 2;
    } else {
      const n = parseNatural(tokens[i]);
      if (n) names.push(n);
      i += 1;
    }
  }
  return names.filter((n) => n.family);
}

export function parseAuthors(input: string | string[] | null | undefined): PersonName[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.flatMap((a) => (a.includes(',') ? parseCommaSegment(a).slice(0, 1) : [parseNatural(a)]))
      .filter((n): n is PersonName => !!n && !!n.family);
  }
  const text = input.replace(/\s+/g, ' ').trim();
  if (!text || /^unknown$/i.test(text)) return [];

  // Normalise list separators: ";" always splits; " and "/" & " split between names.
  const segments = text
    .replace(/\s+(?:and|&)\s+/gi, ';')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  return segments.flatMap(parseCommaSegment);
}

/** Store authors unambiguously ("Family, Given; Family, Given") so they parse back exactly. */
export function serializeAuthors(names: PersonName[]): string {
  return names.map((n) => (n.given ? `${n.family}, ${n.given}` : n.family)).join('; ');
}
