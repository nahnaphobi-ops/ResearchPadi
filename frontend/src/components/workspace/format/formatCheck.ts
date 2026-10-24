import type { Node as PMNode } from '@tiptap/pm/model';
import type { CitationStyleId } from '../citations/types';

/**
 * Checks a project against the layout most Ghanaian institutions ask for:
 * five chapters, an abstract, numbered sections in order, numbered tables
 * and figures, a reference list, Times New Roman 12 and the expected
 * citation style. Rules only, no AI. Departments differ, so every finding
 * says what to check rather than claiming a rule of the student's school.
 */
export type Status = 'pass' | 'warn' | 'fail';

export interface Finding {
  status: Status;
  title: string;
  detail: string;
  /** Where to look in the document. */
  pos?: number;
}

export interface FormatOptions {
  institutionType?: string;
  citationStyle: CitationStyleId;
  citations: number;
}

const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const chapterNumber = (text: string): number | null => {
  const m = text.match(/^\s*chapter\s+(\d+|one|two|three|four|five|six)\b/i);
  if (!m) return null;
  return /^\d+$/.test(m[1]) ? Number(m[1]) : WORDS[m[1].toLowerCase()];
};

const EXPECTED_STYLES: Record<string, CitationStyleId[]> = {
  university: ['apa7'],
  nmtc: ['apa7'],
  college_of_education: ['apa7'],
  technical_university: ['apa7', 'harvard'],
};
const STYLE_NAMES: Partial<Record<CitationStyleId, string>> = { apa7: 'APA 7th', harvard: 'Harvard' };

interface Heading { level: number; text: string; pos: number; chapter: number | null }

export function checkFormat(doc: PMNode, opts: FormatOptions): Finding[] {
  const findings: Finding[] = [];
  const headings: Heading[] = [];
  const captions: { kind: 'Table' | 'Figure'; label: string; pos: number }[] = [];
  const fonts = new Map<string, number>();
  const sizes = new Map<string, number>();
  const spacings = new Map<string, number>();
  let hasBibliography = false;
  let chapter: number | null = null;
  let firstTablePos: number | null = null;
  let tablesWithoutCaption = 0;
  let lastParagraphText = '';

  doc.descendants((node, pos) => {
    if (node.type.name === 'bibliography') hasBibliography = true;
    if (node.type.name === 'heading') {
      const text = node.textContent.trim();
      const ch = chapterNumber(text);
      if (ch !== null) chapter = ch;
      headings.push({ level: Number(node.attrs.level), text, pos, chapter });
      if (node.attrs.lineHeight) spacings.set(String(node.attrs.lineHeight), (spacings.get(String(node.attrs.lineHeight)) ?? 0) + 1);
      return false;
    }
    if (node.type.name === 'table') {
      if (firstTablePos === null) firstTablePos = pos;
      if (!/^(Table|Figure)\s+\d/.test(lastParagraphText) && !/^(Table|Figure)\s+\d/.test(lastParagraphText.split('\n')[0])) tablesWithoutCaption++;
      return false;
    }
    if (node.type.name === 'paragraph') {
      const text = node.textContent.trim();
      if (text) {
        const m = text.match(/^(Table|Figure)\s+(\d+(?:\.\d+)?)\b/);
        if (m && text.length < 200) captions.push({ kind: m[1] as 'Table' | 'Figure', label: m[2], pos });
        if (!m || text.length >= 200) {
          const lh = String(node.attrs.lineHeight ?? '');
          if (lh) spacings.set(lh, (spacings.get(lh) ?? 0) + 1);
        }
        // A caption is the paragraph just before the table, or the one before that (APA: number, then title).
        lastParagraphText = /^(Table|Figure)\s+\d/.test(text) ? text : /^(Table|Figure)\s+\d/.test(lastParagraphText) ? `${lastParagraphText}\n${text}` : text;
      }
      node.descendants((child) => {
        if (!child.isText) return;
        const style = child.marks.find((mk) => mk.type.name === 'textStyle');
        const family = style?.attrs.fontFamily as string | undefined;
        const size = style?.attrs.fontSize as string | undefined;
        const n = child.text?.length ?? 0;
        if (family) fonts.set(family, (fonts.get(family) ?? 0) + n);
        if (size) sizes.set(size, (sizes.get(size) ?? 0) + n);
      });
      return false;
    }
    return true;
  });

  // ── Structure ──
  const chapters = [...new Set(headings.map((h) => chapterNumber(h.text)).filter((n): n is number => n !== null))];
  const missing = [1, 2, 3, 4, 5].filter((n) => !chapters.includes(n));
  if (!chapters.length) {
    findings.push({ status: 'warn', title: 'No chapter headings found', detail: 'Use Heading 1 for "CHAPTER ONE: INTRODUCTION" and so on, so the structure and contents page work.' });
  } else if (missing.length) {
    findings.push({ status: 'warn', title: `Chapter${missing.length > 1 ? 's' : ''} ${missing.join(', ')} not found yet`, detail: 'Most Ghanaian projects have five chapters: Introduction, Literature Review, Methodology, Results and Discussion, and Summary, Conclusions and Recommendations. Check your department\'s guide.' });
  } else {
    findings.push({ status: 'pass', title: 'Chapters 1 to 5 are all there', detail: '' });
  }

  const abstract = headings.find((h) => /^abstract\b/i.test(h.text));
  findings.push(abstract
    ? { status: 'pass', title: 'Abstract heading found', detail: '', pos: abstract.pos }
    : { status: 'warn', title: 'No abstract', detail: 'Add an "ABSTRACT" heading before Chapter One (usually 250 to 350 words, one paragraph).' });

  if (opts.institutionType === 'university') {
    const withoutSummary = chapters.filter((ch) => !headings.some((h) => h.chapter === ch && /summary/i.test(h.text)));
    if (chapters.length && withoutSummary.length) {
      findings.push({ status: 'warn', title: `No chapter summary in chapter${withoutSummary.length > 1 ? 's' : ''} ${withoutSummary.join(', ')}`, detail: 'University projects usually end each chapter with a short summary. Check your guide.' });
    }
  }

  // ── Section numbering: 1.1, 1.2 … within each chapter ──
  const problems: { text: string; pos: number }[] = [];
  const lastByParent = new Map<string, number>();
  for (const h of headings) {
    const m = h.text.match(/^(\d+(?:\.\d+)+)\b/);
    if (!m) continue;
    const parts = m[1].split('.').map(Number);
    if (h.chapter !== null && parts[0] !== h.chapter) {
      problems.push({ text: `"${m[1]}" is in Chapter ${h.chapter}`, pos: h.pos });
      continue;
    }
    const parent = parts.slice(0, -1).join('.');
    const expected = (lastByParent.get(parent) ?? 0) + 1;
    const n = parts[parts.length - 1];
    if (n !== expected && !(n === 0 && expected === 1)) problems.push({ text: `"${m[1]}" comes after ${parent}.${expected - 1 || 0}`, pos: h.pos });
    lastByParent.set(parent, n);
  }
  findings.push(problems.length
    ? { status: 'warn', title: `Section numbers out of order (${problems.length})`, detail: problems.slice(0, 4).map((p) => p.text).join('; '), pos: problems[0].pos }
    : { status: 'pass', title: 'Section numbers are in order', detail: '' });

  // ── Tables and figures ──
  for (const kind of ['Table', 'Figure'] as const) {
    const list = captions.filter((c) => c.kind === kind);
    const seen = new Set<string>();
    const dupes = list.filter((c) => (seen.has(c.label) ? true : (seen.add(c.label), false)));
    const byChapter = new Map<string, number[]>();
    for (const c of list) {
      const [prefix, num] = c.label.includes('.') ? c.label.split('.') : ['', c.label];
      byChapter.set(prefix, [...(byChapter.get(prefix) ?? []), Number(num)]);
    }
    const gaps = [...byChapter.entries()].filter(([, nums]) => nums.some((n, i) => n !== i + 1));
    if (dupes.length) findings.push({ status: 'warn', title: `${kind} ${dupes[0].label} is used twice`, detail: `Each ${kind.toLowerCase()} needs its own number.`, pos: dupes[0].pos });
    else if (gaps.length) findings.push({ status: 'warn', title: `${kind} numbers skip or repeat`, detail: `Number them in order (${kind} 4.1, 4.2, 4.3 …).`, pos: list[0]?.pos });
    else if (list.length) findings.push({ status: 'pass', title: `${list.length} ${kind.toLowerCase()}${list.length === 1 ? '' : 's'} numbered in order`, detail: '' });
  }
  if (tablesWithoutCaption) {
    findings.push({ status: 'warn', title: `${tablesWithoutCaption} table${tablesWithoutCaption === 1 ? ' has' : 's have'} no "Table" label above`, detail: 'APA puts "Table 4.1" in bold, then the title in italics, above each table.', pos: firstTablePos ?? undefined });
  }

  // ── References and citation style ──
  if (opts.citations && !hasBibliography && !headings.some((h) => /^(references|bibliography|works cited)\b/i.test(h.text))) {
    findings.push({ status: 'fail', title: 'Citations but no reference list', detail: 'Insert the reference list (References › Bibliography); it updates itself.' });
  } else if (opts.citations) {
    findings.push({ status: 'pass', title: 'Reference list present', detail: '' });
  }
  const expected = EXPECTED_STYLES[opts.institutionType ?? 'university'] ?? EXPECTED_STYLES.university;
  if (opts.citations && !expected.includes(opts.citationStyle)) {
    findings.push({ status: 'warn', title: 'Citation style may not match your institution', detail: `Most ${opts.institutionType === 'technical_university' ? 'technical universities' : 'Ghanaian institutions'} use ${expected.map((s) => STYLE_NAMES[s]).join(' or ')}. Check your guide, then change it in the Citations panel.` });
  }

  // ── Font and spacing ──
  const otherFonts = [...fonts.keys()].filter((f) => !/times new roman/i.test(f));
  findings.push(otherFonts.length
    ? { status: 'warn', title: 'Fonts other than Times New Roman', detail: `${otherFonts.join(', ')}. Most guides ask for Times New Roman throughout.` }
    : { status: 'pass', title: 'Font: Times New Roman', detail: '' });
  const otherSizes = [...sizes.keys()].filter((s) => !/^12(pt|px)?$/.test(s.replace(/\s/g, '')) && !/^1[46](pt)?$/.test(s));
  if (otherSizes.length) findings.push({ status: 'warn', title: 'Body text not in 12 pt', detail: `Sizes used: ${otherSizes.join(', ')}. Body text is usually 12 pt (headings may be larger).` });
  const odd = [...spacings.keys()].filter((s) => !['1.5', '2', '2.0'].includes(s));
  if (odd.length) findings.push({ status: 'warn', title: 'Line spacing other than 1.5 or double', detail: `Spacing used: ${odd.join(', ')}. Most guides ask for 1.5 or double spacing (Home › Paragraph › Line spacing).` });
  else findings.push({ status: 'pass', title: 'Line spacing 1.5 or double', detail: '' });

  return findings;
}
