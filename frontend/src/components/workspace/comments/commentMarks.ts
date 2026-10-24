import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { locateAnchor, type ReviewAnchor } from '../review/reviewMarks';

const commentKey = new PluginKey<DecorationSet>('rp-comment-marks');

/**
 * Highlights the passages that comments refer to (separately from paid-review
 * marks, so both can show at once); one can be marked active.
 */
export const CommentMarks = Extension.create({
  name: 'commentMarks',
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: commentKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const meta = tr.getMeta(commentKey) as { ranges: { from: number; to: number; active: boolean }[] } | undefined;
            if (meta) {
              return DecorationSet.create(tr.doc, meta.ranges.map((r) =>
                Decoration.inline(r.from, r.to, { class: r.active ? 'comment-anchor comment-anchor-active' : 'comment-anchor' })));
            }
            return old.map(tr.mapping, tr.doc);
          },
        },
        props: { decorations: (state) => commentKey.getState(state) },
      }),
    ];
  },
});

export function showCommentMarks(editor: Editor, anchors: ReviewAnchor[], activeId?: string | null) {
  if (editor.isDestroyed) return;
  const ranges = anchors
    .map((a) => ({ range: locateAnchor(editor, a), active: a.id === activeId }))
    .filter((r): r is { range: { from: number; to: number }; active: boolean } => r.range !== null)
    .map((r) => ({ ...r.range, active: r.active }));
  editor.view.dispatch(editor.state.tr.setMeta(commentKey, { ranges }).setMeta('addToHistory', false));
}
