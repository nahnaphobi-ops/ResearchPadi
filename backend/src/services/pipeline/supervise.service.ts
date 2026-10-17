import { routeSupervision, tokensForWords } from '../ai/router.service.js';
import { buildChapterSupervisionPrompt, buildSupervisionSystemPrompt } from '../ai/prompts.js';
import { childLogger } from '../../lib/logger.js';

const log = childLogger('supervise');

export interface ChapterInfo {
  num: number;
  title: string;
  wordTarget: number;
}

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** Chapter titles plus their section headings, so each review sees the whole paper's shape. */
function paperOutline(chapters: string[], info: ChapterInfo[]): string {
  const heading = /^\s*(#{1,4}\s+.+|\d+(\.\d+)+\.?\s+\S.*)$/;
  return info
    .map((ch, i) => {
      const sections = (chapters[i] ?? '')
        .split('\n')
        .filter((line) => heading.test(line))
        .slice(0, 15)
        .map((line) => `   ${line.replace(/^#+\s*/, '').trim()}`);
      return [`Chapter ${ch.num}: ${ch.title}`, ...sections].join('\n');
    })
    .join('\n');
}

/** The part of Chapter 1 that states the objectives / research questions. */
function objectivesExcerpt(chapter1: string): string {
  const at = chapter1.search(/objectives?|research questions?/i);
  const start = at === -1 ? 0 : Math.max(0, at - 200);
  return chapter1.slice(start, start + 2500);
}

/**
 * Supervisor pass, one chapter per call. Reviewing the whole paper in one call
 * cut the output off at the model's token limit (about 6,000 words), so most of
 * a default 12,000-word paper was lost. Per chapter, each output fits, and the
 * shared instructions and source list are cached after the first call.
 *
 * If a review still comes back cut off or empty, the drafted chapter is kept.
 */
export const superviseChapters = async (
  chapters: string[],
  info: ChapterInfo[],
  paperData: any,
  allSources: any[],
  plan?: string
): Promise<string[]> => {
  const systemPrompt = buildSupervisionSystemPrompt(
    paperData.topic,
    paperData.course,
    paperData.institution_type,
    paperData.target_word_count || info.reduce((sum, ch) => sum + ch.wordTarget, 0),
    allSources,
    plan
  );
  const outline = paperOutline(chapters, info);
  const revised = [...chapters];

  const review = async (i: number) => {
    const ch = info[i];
    const draft = chapters[i];
    const reference: { label: string; text: string }[] = [];
    if (ch.num === 4 || ch.num === 5) reference.push({ label: 'Chapter 1 objectives', text: objectivesExcerpt(chapters[0] ?? '') });
    if (ch.num === 5) {
      const ch4 = info.findIndex((c) => c.num === 4);
      if (ch4 !== -1) reference.push({ label: 'Chapter 4 (findings)', text: revised[ch4] });
    }

    const words = Math.max(ch.wordTarget, wordCount(draft));
    try {
      const { text, truncated } = await routeSupervision(
        buildChapterSupervisionPrompt(ch.num, ch.title, draft, ch.wordTarget, outline, reference),
        { systemPrompt, maxTokens: tokensForWords(Math.ceil(words * 1.15)), meta: { chapter: ch.num } }
      );
      if (truncated || !text.trim()) {
        log.warn({ chapter: ch.num, truncated }, 'Supervision output unusable; keeping the drafted chapter');
        return;
      }
      revised[i] = text.trim();
    } catch (err: any) {
      log.error({ chapter: ch.num, err: err.message }, 'Supervision failed; keeping the drafted chapter');
    }
  };

  // Chapter 1 first writes the prompt cache; 2–4 then read it in parallel;
  // Chapter 5 last, so it is checked against the revised Chapter 4.
  const order = info.map((_, i) => i);
  const last = info.findIndex((c) => c.num === 5);
  const first = order[0];
  if (first !== undefined) await review(first);
  await Promise.all(order.filter((i) => i !== first && i !== last).map(review));
  if (last !== -1 && last !== first) await review(last);

  return revised;
};

const CHAPTER_HEADING = /^[ \t]*(?:\*\*|#{1,4}[ \t]*)?CHAPTER[ \t]+(\d+)\b[ \t:.\-–—]*(.*)$/gim;
const REFERENCES_HEADING = /^[ \t]*(?:\*\*|#{1,4}[ \t]*)?References\b/im;

/**
 * Split an assembled paper (abstract, CHAPTER 1…5, References) back into parts.
 * Returns null when no chapter headings are found.
 */
export function splitPaper(content: string): { head: string; chapters: string[]; info: ChapterInfo[]; tail: string } | null {
  const matches = [...content.matchAll(CHAPTER_HEADING)];
  if (matches.length === 0) return null;

  const head = content.slice(0, matches[0].index).trim();
  const lastStart = matches[matches.length - 1].index!;
  const refsAt = content.slice(lastStart).search(REFERENCES_HEADING);
  const bodyEnd = refsAt === -1 ? content.length : lastStart + refsAt;

  const chapters: string[] = [];
  const info: ChapterInfo[] = [];
  matches.forEach((m, i) => {
    const end = i + 1 < matches.length ? matches[i + 1].index! : bodyEnd;
    const text = content.slice(m.index, end).trim();
    chapters.push(text);
    info.push({
      num: Number(m[1]),
      title: m[2].replace(/\*+$/, '').trim() || `Chapter ${m[1]}`,
      wordTarget: wordCount(text),
    });
  });

  return { head, chapters, info, tail: content.slice(bodyEnd).trim() };
}

/** Re-run the supervisor on a finished paper, chapter by chapter, keeping abstract and references. */
export const superviseAssembledPaper = async (content: string, paperData: any, allSources: any[], plan?: string): Promise<string> => {
  const parts = splitPaper(content);
  if (!parts) {
    throw Object.assign(new Error("Couldn't find the chapter headings in this paper, so it can't be reviewed chapter by chapter."), { status: 422 });
  }
  const revised = await superviseChapters(parts.chapters, parts.info, paperData, allSources, plan);
  return [parts.head, ...revised, parts.tail].filter(Boolean).join('\n\n');
};
