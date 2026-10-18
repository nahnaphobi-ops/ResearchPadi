/**
 * Client privacy checks for care study text. A care study names the client by
 * initials or a pseudonym only, so contact details and ID numbers are blocked
 * and anything that looks like a full name is flagged.
 */
export interface PrivacyIssue {
  kind: 'phone' | 'email' | 'id_number' | 'address' | 'full_name';
  severity: 'block' | 'warn';
  match: string;
  message: string;
}

const HONORIFIC = String.raw`(?:Madam|Maame|Mrs|Mr|Ms|Miss|Auntie|Aunty|Nana|Opanin|Obaapanin|Master|Baby)\.?`;
const CAPITALISED = String.raw`[A-Z][a-z]{2,}(?:-[A-Z][a-z]+)?`;

const BLOCK_RULES: { kind: PrivacyIssue['kind']; re: RegExp; message: string }[] = [
  {
    kind: 'phone',
    // Ghana numbers: 0XX XXX XXXX or +233 XX XXX XXXX, with or without spaces/dashes.
    re: /(?:\+?233[\s-]?|\b0)[235]\d(?:[\s-]?\d){7}\b/g,
    message: 'Phone numbers must not appear in a care study. Remove it.',
  },
  {
    kind: 'email',
    re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g,
    message: 'Email addresses must not appear in a care study. Remove it.',
  },
  {
    kind: 'id_number',
    // Ghana Card (GHA-123456789-0).
    re: /\bGHA-?\d{9}-?\d\b/gi,
    message: 'ID numbers must not appear in a care study. Remove it.',
  },
  {
    kind: 'id_number',
    // NHIS, folder, hospital or registration numbers given with their label.
    re: /\b(?:NHIS|NHIA|folder|hospital|OPD|IPD|patient|reg(?:istration)?)\s*(?:no\.?|number|#|ID)\s*[:.]?\s*[A-Z0-9/-]*\d[A-Z0-9/-]{3,}/gi,
    message: 'Folder, NHIS and registration numbers must not appear in a care study. Remove it.',
  },
  {
    kind: 'address',
    // GhanaPost GPS digital address, e.g. AK-039-5028.
    re: /\b[A-Z]{2}-\d{3,4}-\d{4}\b/g,
    message: 'Digital addresses must not appear in a care study. Give only the town or community.',
  },
];

const WARN_RULES: { kind: PrivacyIssue['kind']; re: RegExp; message: string }[] = [
  {
    kind: 'address',
    re: /\b(?:house|hse|plot)\s*(?:no\.?|number|#)\s*[A-Z0-9/-]+/gi,
    message: 'This looks like a house address. Give only the town or community.',
  },
  {
    kind: 'full_name',
    // "Madam Pokuaa Mavis", "Mr. Samuel Owusu": honorific plus two or more names.
    re: new RegExp(String.raw`\b${HONORIFIC}\s+${CAPITALISED}(?:\s+${CAPITALISED})+\b`, 'g'),
    message: 'This looks like a full name. Use initials or a pseudonym for the client and family (e.g. "Madam A.K.").',
  },
];

const FULL_NAME = new RegExp(String.raw`\b(${HONORIFIC})\s+(${CAPITALISED}(?:\s+${CAPITALISED})+)\b`, 'g');

/**
 * Shorten titled full names to initials ("Mr. Samuel Owusu" → "Mr. S.O.").
 * Used on what a reviewer sees; the student's own documents are left as written.
 */
export function redactFullNames(text: string): string {
  return text.replace(FULL_NAME, (_whole, title: string, names: string) =>
    `${title} ${names.split(/\s+/).map((n) => `${n[0]}.`).join('')}`);
}

export function scanPrivacy(text: string): PrivacyIssue[] {
  const issues: PrivacyIssue[] = [];
  const seen = new Set<string>();
  for (const [rules, severity] of [[BLOCK_RULES, 'block'], [WARN_RULES, 'warn']] as const) {
    for (const rule of rules) {
      for (const m of text.matchAll(rule.re)) {
        const key = `${rule.kind}:${m[0]}`;
        if (seen.has(key)) continue;
        seen.add(key);
        issues.push({ kind: rule.kind, severity, match: m[0].trim(), message: rule.message });
      }
    }
  }
  return issues;
}

/** Every string inside a JSON-like value, for scanning section entries. */
export function collectText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(collectText).join('\n');
  if (value && typeof value === 'object') return Object.values(value).map(collectText).join('\n');
  return '';
}

/**
 * The client's study name must be initials or a pseudonym: one name at most,
 * not a first name plus a surname. Returns an error message, or null if fine.
 */
export function checkPseudonym(raw: string): string | null {
  const name = raw.trim();
  if (!name) return 'Enter initials or a pseudonym for your client';
  if (name.length > 40) return 'Keep the pseudonym short, e.g. "Madam A.K."';
  if (/\d|@/.test(name)) return 'Use initials or a pseudonym only — no numbers or contact details';
  const words = name
    .replace(new RegExp(`^${HONORIFIC}\\s*`, 'i'), '')
    .split(/\s+/)
    .filter(Boolean)
    // Initials ("A.", "A.K.", "AK") are fine.
    .filter((w) => !/^([A-Za-z]\.?){1,3}$/.test(w));
  if (words.length >= 2) {
    return 'That looks like a full name. Use initials (e.g. "Madam A.K.") or a pseudonym, never the client\'s real full name';
  }
  return null;
}
