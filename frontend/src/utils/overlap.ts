/**
 * How much of the student's writing repeats the study draft's wording.
 * Compares five-word runs: a paragraph that shares many of them with the
 * draft follows it too closely, even if a few words were swapped.
 */

const RUN = 5;
/** Paragraphs shorter than this (headings, captions) are not checked. */
const MIN_WORDS = 12;
export const TOO_CLOSE = 0.3;

const words = (text: string) =>
  text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);

function runs(list: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i + RUN <= list.length; i++) out.push(list.slice(i, i + RUN).join(' '));
  return out;
}

export interface OverlapResult {
  /** Share of the student's checked writing that repeats the draft, 0–1. */
  share: number;
  checkedWords: number;
  tooClose: { excerpt: string; share: number; text: string }[];
}

export function draftOverlap(draftText: string, studentText: string): OverlapResult {
  const draftRuns = new Set(runs(words(draftText)));
  let matched = 0;
  let total = 0;
  let checkedWords = 0;
  const tooClose: OverlapResult['tooClose'] = [];

  for (const paragraph of studentText.split(/\n+/)) {
    const list = words(paragraph);
    if (list.length < MIN_WORDS) continue;
    checkedWords += list.length;
    const own = runs(list);
    const hits = own.filter((r) => draftRuns.has(r)).length;
    matched += hits;
    total += own.length;
    const share = own.length ? hits / own.length : 0;
    if (share >= TOO_CLOSE) {
      const trimmed = paragraph.trim();
      tooClose.push({ excerpt: trimmed.length > 90 ? `${trimmed.slice(0, 90)}…` : trimmed, share, text: trimmed });
    }
  }
  return { share: total ? matched / total : 0, checkedWords, tooClose };
}
