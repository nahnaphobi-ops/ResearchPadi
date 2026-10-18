import { entriesText, type CareStudyTemplate, type SectionEntries } from '../care-study/template.service.js';

/**
 * Helpers for human reviews of any generation: what a reviewer is allowed to
 * take, which checklist applies, and how a paper or care study is turned into
 * the HTML snapshot a reviewer reads.
 */
export type SourceType = 'workspace' | 'paper' | 'care_study';
export const SOURCE_TYPES: SourceType[] = ['workspace', 'paper', 'care_study'];

/** Areas a reviewer can be vetted for. Add to this list to open a new area. */
export const SPECIALTIES = [
  { key: 'midwifery', label: 'Midwifery' },
  { key: 'general_nursing', label: 'General nursing' },
  { key: 'public_health', label: 'Public health' },
  { key: 'research_methods', label: 'Research methods & statistics' },
  { key: 'academic_writing', label: 'Academic writing & APA' },
  { key: 'education', label: 'Education' },
  { key: 'business', label: 'Business & management' },
  { key: 'science_engineering', label: 'Science & engineering' },
] as const;
export type SpecialtyKey = (typeof SPECIALTIES)[number]['key'];
const SPECIALTY_KEYS: Set<string> = new Set(SPECIALTIES.map((s) => s.key));
export const specialtyLabel = (key: string) => SPECIALTIES.find((s) => s.key === key)?.label ?? key;

/** Keeps only known specialty keys, without duplicates. */
export function cleanSpecialties(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.filter((k): k is string => typeof k === 'string' && SPECIALTY_KEYS.has(k)))];
}

/**
 * A request with a specialty (care studies) can only be taken by reviewers
 * vetted for it. Requests without one can be taken by any active reviewer.
 */
export const reviewerCanTake = (reviewerSpecialties: string[] | null | undefined, requestSpecialty: string | null | undefined) =>
  !requestSpecialty || (reviewerSpecialties ?? []).includes(requestSpecialty);

export const RUBRIC = [
  { key: 'structure', label: 'Structure & flow' },
  { key: 'objectives', label: 'Objectives match findings' },
  { key: 'methodology', label: 'Methodology' },
  { key: 'citations', label: 'Citations & APA' },
  { key: 'writing', label: 'Academic writing' },
  { key: 'context', label: 'Ghana context' },
] as const;

export const CARE_STUDY_RUBRIC = [
  { key: 'nursing_process', label: 'Nursing process followed' },
  { key: 'consistency', label: 'Draft matches the notes' },
  { key: 'care_plans', label: 'Care plans: problem to evaluation' },
  { key: 'rationale', label: 'Rationale & theory' },
  { key: 'writing', label: 'Clinical language & clarity' },
  { key: 'professionalism', label: 'Privacy, consent & professionalism' },
] as const;

export const rubricFor = (sourceType: string | null | undefined): readonly { key: string; label: string }[] =>
  sourceType === 'care_study' ? CARE_STUDY_RUBRIC : RUBRIC;

// ── Snapshots ─────────────────────────────────────────────────────────────

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const isTableLine = (line: string) => /^\s*\|.*\|\s*$/.test(line);
const splitRow = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
const isSeparator = (cells: string[]) => cells.every((c) => /^:?-{2,}:?$/.test(c));

type LineKind = 'h2' | 'h3' | 'p';
function classify(line: string): LineKind {
  const t = line.trim();
  if (/^CHAPTER\b/i.test(t) && t.length < 120) return 'h2';
  if (/^#{1,2}\s/.test(t)) return 'h2';
  if (/^#{3,6}\s/.test(t)) return 'h3';
  // "2.1 Concepts" is a heading; "1. Reassure the client" is a list item.
  if (/^\d+(\.\d+)+\.?\s+\S/.test(t) && t.length < 100 && !/[.!?]$/.test(t)) return 'h3';
  if (t.length < 90 && /[A-Z]{3}/.test(t) && t === t.toUpperCase() && !/[.!?]$/.test(t)) return 'h3';
  return 'p';
}

/** Plain or lightly marked-up text (papers, drafts) → editor HTML. Tables stay tables. */
export function textToHtml(text: string): string {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (isTableLine(lines[i])) {
      const start = i;
      while (i + 1 < lines.length && isTableLine(lines[i + 1])) i++;
      const rows = lines.slice(start, i + 1).map(splitRow).filter((cells) => !isSeparator(cells));
      out.push(
        `<table><tbody>${rows
          .map((cells, r) => `<tr>${cells.map((c) => `<${r === 0 ? 'th' : 'td'}>${escapeHtml(c.replace(/<br\s*\/?>/gi, ' '))}</${r === 0 ? 'th' : 'td'}>`).join('')}</tr>`)
          .join('')}</tbody></table>`,
      );
      continue;
    }
    const line = lines[i].replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
    if (!line) continue;
    const kind = classify(lines[i]);
    out.push(`<${kind}>${escapeHtml(line)}</${kind}>`);
  }
  return out.join('');
}

export interface ReviewPart { key: string; label: string; words: number }

const wordsOf = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** Chapters of a generated paper, for "review one chapter" (headings as written by the pipeline). */
export function paperChapters(content: string): { key: string; label: string; text: string }[] {
  const heading = /^[ \t]*(?:\*\*|#{1,4}[ \t]*)?CHAPTER[ \t]+(\d+)\b[ \t:.\-–—]*(.*)$/gim;
  const matches = [...content.matchAll(heading)];
  if (!matches.length) return [];
  const refs = content.search(/^[ \t]*(?:\*\*|#{1,4}[ \t]*)?References\b/im);
  return matches.map((m, i) => {
    const end = i + 1 < matches.length ? matches[i + 1].index! : refs > m.index! ? refs : content.length;
    return {
      key: m[1],
      label: `Chapter ${m[1]}${m[2].trim() ? `: ${m[2].replace(/\*+$/, '').trim()}` : ''}`,
      text: content.slice(m.index, end).trim(),
    };
  });
}

export function paperParts(content: string): ReviewPart[] {
  return paperChapters(content).map((c) => ({ key: c.key, label: c.label, words: wordsOf(c.text) }));
}

interface CareSection { entries?: SectionEntries; draft?: string | null }

function careSectionHtml(template: CareStudyTemplate, key: string, row: CareSection | undefined): string {
  const section = template.sections.find((s) => s.key === key);
  if (!section) return '';
  const notes = entriesText(section, row?.entries);
  const noteLines = notes
    ? notes.split('\n').map((l) => {
        const m = l.match(/^(\s*)([^:]{1,80}):\s(.*)$/);
        return m ? `<p>${escapeHtml(m[1])}<strong>${escapeHtml(m[2])}:</strong> ${escapeHtml(m[3])}</p>` : `<p>${escapeHtml(l)}</p>`;
      }).join('')
    : '<p><em>Nothing entered.</em></p>';
  const draft = row?.draft ? textToHtml(row.draft) : '<p><em>Not drafted yet.</em></p>';
  return `<h2>${escapeHtml(section.title)}</h2><h3>Student's own notes</h3>${noteLines}<h3>Draft</h3>${draft}`;
}

/** Sections with something in them, for "review one section". */
export function careStudyParts(template: CareStudyTemplate, sections: Record<string, CareSection | undefined>): ReviewPart[] {
  return template.sections
    .filter((s) => entriesText(s, sections[s.key]?.entries) || sections[s.key]?.draft)
    .map((s) => ({
      key: s.key,
      label: s.title,
      words: wordsOf(`${entriesText(s, sections[s.key]?.entries)} ${sections[s.key]?.draft ?? ''}`),
    }));
}

/** The whole care study (or one section) as the reviewer sees it: her notes beside the draft. */
export function careStudySnapshot(
  template: CareStudyTemplate,
  study: { pseudonym: string; focus?: string | null },
  sections: Record<string, CareSection | undefined>,
  onlyKey?: string
): string {
  const keys = onlyKey
    ? [onlyKey]
    : careStudyParts(template, sections).map((p) => p.key);
  const head = `<h1>${escapeHtml(template.name)}</h1><p><em>Client: ${escapeHtml(study.pseudonym)}${study.focus ? ` · ${escapeHtml(template.focus_label)}: ${escapeHtml(study.focus)}` : ''}. Check the draft against the student's own notes; anything marked [Student to supply: …] is still missing.</em></p>`;
  return head + keys.map((k) => careSectionHtml(template, k, sections[k])).join('');
}
