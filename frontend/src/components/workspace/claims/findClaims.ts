import type { Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { findMatches } from '../search';
import type { Source } from '../citations/types';

/**
 * The sentences of a document that make claims: those citing the student's
 * own uploaded sources (checked against them), those citing other sources
 * (which can't be checked until uploaded), and those that state a figure with
 * no citation at all.
 */
export interface FoundSentence {
  id: string;
  /** The sentence without its citations. */
  text: string;
  /** Where it was, for "Show in document". */
  from: number;
  to: number;
  /** A run of it with no citation inside, to find it again after edits. */
  anchor: string;
  /** Uploaded sources it cites (notebook source ids). */
  sourceIds: string[];
  /** Titles of the other sources it cites. */
  otherSources: string[];
}

export interface FoundClaims {
  checkable: FoundSentence[];
  notUploaded: FoundSentence[];
  needsCitation: FoundSentence[];
}

const STATISTIC = /\d+(?:\.\d+)?\s?(?:%|percent\b|per cent\b)|\b\d{1,3}(?:,\d{3})+\b/i;
const OBJECT = '￼';

export function findClaims(doc: PMNode, range?: { from: number; to: number }): FoundClaims {
  const found: FoundClaims = { checkable: [], notUploaded: [], needsCitation: [] };
  let n = 0;

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    if (node.type.name !== 'paragraph') return false;
    if (range && (pos + node.nodeSize < range.from || pos > range.to)) return false;

    // One character per document position, as in findMatches; citations are recorded where they sit.
    let text = '';
    const citations: { at: number; sources: Source[] }[] = [];
    node.forEach((child) => {
      if (child.isText) text += child.text ?? '';
      else {
        if (child.type.name === 'citation') citations.push({ at: text.length, sources: (child.attrs.sources ?? []) as Source[] });
        text += OBJECT.repeat(child.nodeSize);
      }
    });

    // Sentence starts: the paragraph start, and after . ! or ? followed by a space.
    const starts = [0];
    for (const m of text.matchAll(/[.!?]+\s+(?=\S)/g)) starts.push(m.index + m[0].length);

    starts.forEach((start, i) => {
      const end = i + 1 < starts.length ? starts[i + 1] : text.length;
      const raw = text.slice(start, end);
      const sentence = raw.replaceAll(OBJECT, '').replace(/\s+/g, ' ').trim();
      if (sentence.length < 15) return;

      const sources = citations.filter((c) => c.at >= start && (c.at < end || (i + 1 === starts.length && c.at === end))).flatMap((c) => c.sources);
      const sourceIds = [...new Set(sources.filter((s) => s.origin === 'notebook' && s.id.startsWith('nb-')).map((s) => s.id.slice(3)))];
      const otherSources = [...new Set(sources.filter((s) => s.origin !== 'notebook').map((s) => s.title))];
      const chunks = raw.split(OBJECT).map((c) => c.trim()).sort((a, b) => b.length - a.length);
      const lead = raw.length - raw.trimStart().length;
      const item: FoundSentence = {
        id: `c${++n}`,
        text: sentence,
        from: pos + 1 + start + lead,
        to: pos + 1 + start + raw.trimEnd().length,
        anchor: (chunks[0] ?? sentence).slice(0, 80),
        sourceIds,
        otherSources,
      };
      if (sourceIds.length) found.checkable.push(item);
      else if (otherSources.length) found.notUploaded.push(item);
      else if (STATISTIC.test(sentence)) found.needsCitation.push(item);
    });
    return false;
  });

  return found;
}

/** Selects the sentence in the document (finding it by its text if the document changed) and scrolls to it. */
export function showSentence(editor: Editor, s: FoundSentence): boolean {
  const { doc } = editor.state;
  const here = s.to <= doc.content.size ? doc.textBetween(s.from, s.to, ' ', ' ').replace(/\s+/g, ' ').trim() : '';
  let range: { from: number; to: number } | null = here.includes(s.anchor) ? { from: s.from, to: s.to } : null;
  if (!range) range = findMatches(doc, s.anchor, { matchCase: true, wholeWord: false })[0] ?? null;
  if (!range) return false;
  return editor.chain().focus().setTextSelection(range).scrollIntoView().run();
}
