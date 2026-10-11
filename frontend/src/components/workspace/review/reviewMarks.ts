import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { findMatches } from '../search';

export interface ReviewAnchor {
  id: string;
  anchor_text: string;
  occurrence: number;
}

const reviewKey = new PluginKey<DecorationSet>('rp-review-marks');

/** Highlights the text that reviewer comments refer to; one can be marked active. */
export const ReviewMarks = Extension.create({
  name: 'reviewMarks',
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: reviewKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const meta = tr.getMeta(reviewKey) as { ranges: { from: number; to: number; active: boolean }[] } | undefined;
            if (meta) {
              return DecorationSet.create(tr.doc, meta.ranges.map((r) =>
                Decoration.inline(r.from, r.to, { class: r.active ? 'review-anchor review-anchor-active' : 'review-anchor' })));
            }
            return old.map(tr.mapping, tr.doc);
          },
        },
        props: { decorations: (state) => reviewKey.getState(state) },
      }),
    ];
  },
});

/** Where a comment's anchor text is in the document now (or null if it was edited away). */
export function locateAnchor(editor: Editor, anchor: ReviewAnchor): { from: number; to: number } | null {
  const matches = findMatches(editor.state.doc, anchor.anchor_text, { matchCase: true, wholeWord: false });
  return matches[anchor.occurrence] ?? matches[0] ?? null;
}

export function showReviewMarks(editor: Editor, anchors: ReviewAnchor[], activeId?: string | null) {
  if (editor.isDestroyed) return;
  const ranges = anchors
    .map((a) => ({ range: locateAnchor(editor, a), active: a.id === activeId }))
    .filter((r): r is { range: { from: number; to: number }; active: boolean } => r.range !== null)
    .map((r) => ({ ...r.range, active: r.active }));
  editor.view.dispatch(editor.state.tr.setMeta(reviewKey, { ranges }).setMeta('addToHistory', false));
}

/** Which occurrence of `text` starts at `from` (so a comment survives repeated phrases). */
export function occurrenceAt(editor: Editor, text: string, from: number): number {
  const matches = findMatches(editor.state.doc, text, { matchCase: true, wholeWord: false });
  const index = matches.findIndex((m) => m.from === from);
  return index === -1 ? 0 : index;
}
