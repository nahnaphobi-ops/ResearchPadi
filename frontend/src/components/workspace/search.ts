import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';

export interface SearchMatch {
  from: number;
  to: number;
}

interface SearchState {
  matches: SearchMatch[];
  current: number;
}

export const searchPluginKey = new PluginKey<DecorationSet>('rp-search');

/** Highlights search matches; the Find & Replace panel pushes results via setSearchHighlights(). */
export const SearchHighlight = Extension.create({
  name: 'searchHighlight',
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: searchPluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const meta = tr.getMeta(searchPluginKey) as SearchState | undefined;
            if (meta) {
              return DecorationSet.create(
                tr.doc,
                meta.matches.map((m, i) =>
                  Decoration.inline(m.from, m.to, { class: i === meta.current ? 'search-match search-match-current' : 'search-match' })
                )
              );
            }
            return old.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return searchPluginKey.getState(state);
          },
        },
      }),
    ];
  },
});

export function setSearchHighlights(editor: Editor, matches: SearchMatch[], current: number) {
  editor.view.dispatch(editor.state.tr.setMeta(searchPluginKey, { matches, current }));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Find matches inside each text block, mapping string offsets back to document positions. */
export function findMatches(doc: PMNode, query: string, opts: { matchCase: boolean; wholeWord: boolean }): SearchMatch[] {
  if (!query) return [];
  const flags = opts.matchCase ? 'g' : 'gi';
  const source = opts.wholeWord ? `\\b${escapeRegExp(query)}\\b` : escapeRegExp(query);
  const matches: SearchMatch[] = [];

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    // One char per document position, so string index → pos + 1 + index.
    let text = '';
    node.forEach((child) => {
      text += child.isText ? child.text ?? '' : '￼'.repeat(child.nodeSize);
    });
    const re = new RegExp(source, flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) { re.lastIndex++; continue; }
      matches.push({ from: pos + 1 + m.index, to: pos + 1 + m.index + m[0].length });
    }
    return false;
  });

  return matches;
}

/** Replace one match, keeping the formatting of the text it replaces. */
export function replaceMatch(editor: Editor, match: SearchMatch, replacement: string) {
  const { state } = editor;
  const marks = state.doc.resolve(match.from).marksAcross(state.doc.resolve(match.to)) ?? [];
  const tr = state.tr;
  if (replacement) tr.replaceWith(match.from, match.to, state.schema.text(replacement, marks));
  else tr.delete(match.from, match.to);
  editor.view.dispatch(tr);
}

/** Replace every match in one undoable step. Returns how many were replaced. */
export function replaceAll(editor: Editor, matches: SearchMatch[], replacement: string) {
  if (!matches.length) return 0;
  const { state } = editor;
  const tr = state.tr;
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const marks = state.doc.resolve(m.from).marksAcross(state.doc.resolve(m.to)) ?? [];
    if (replacement) tr.replaceWith(m.from, m.to, state.schema.text(replacement, marks));
    else tr.delete(m.from, m.to);
  }
  editor.view.dispatch(tr);
  return matches.length;
}

type CaseMode = 'sentence' | 'lower' | 'upper' | 'title' | 'toggle';

function transformCase(text: string, mode: CaseMode) {
  switch (mode) {
    case 'lower': return text.toLowerCase();
    case 'upper': return text.toUpperCase();
    case 'title': return text.toLowerCase().replace(/(^|[\s\-–—(“"'])(\p{L})/gu, (_, p, c: string) => p + c.toUpperCase());
    case 'toggle': return [...text].map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join('');
    case 'sentence':
    default:
      return text.toLowerCase().replace(/(^\s*\p{L}|[.!?]\s+\p{L})/gu, (s) => s.toUpperCase());
  }
}

/** Word's "Change Case" on the current selection, preserving each run's formatting. */
export function changeCase(editor: Editor, mode: CaseMode) {
  const { state } = editor;
  const { from, to } = state.selection;
  if (from === to) return false;

  const runs: { pos: number; text: string }[] = [];
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText || !node.text) return;
    const start = Math.max(from, pos);
    const end = Math.min(to, pos + node.text.length);
    if (end > start) runs.push({ pos: start, text: node.text.slice(start - pos, end - pos) });
  });

  const joined = runs.map((r) => r.text).join('');
  const transformed = transformCase(joined, mode);
  if (transformed.length !== joined.length) return false; // e.g. ß → SS; skip rather than corrupt

  const tr = state.tr;
  let offset = 0;
  for (const run of runs) {
    const next = transformed.slice(offset, offset + run.text.length);
    offset += run.text.length;
    if (next !== run.text) {
      const marks = state.doc.resolve(run.pos + 1).marks();
      tr.replaceWith(run.pos, run.pos + run.text.length, state.schema.text(next, marks));
    }
  }
  editor.view.dispatch(tr);
  return true;
}
