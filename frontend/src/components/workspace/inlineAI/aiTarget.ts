import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const aiTargetKey = new PluginKey<DecorationSet>('rp-ai-target');

/**
 * Keeps the text the AI is working on highlighted while focus is in the AI box
 * (the browser hides the real selection then). Positions follow edits.
 */
export const AITargetHighlight = Extension.create({
  name: 'aiTargetHighlight',
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: aiTargetKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const meta = tr.getMeta(aiTargetKey) as { from: number; to: number } | null | undefined;
            if (meta === null) return DecorationSet.empty;
            if (meta) return DecorationSet.create(tr.doc, [Decoration.inline(meta.from, meta.to, { class: 'ai-target' })]);
            return old.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations: (state) => aiTargetKey.getState(state),
        },
      }),
    ];
  },
});

export function setAITarget(editor: Editor, range: { from: number; to: number } | null) {
  if (editor.isDestroyed) return;
  editor.view.dispatch(editor.state.tr.setMeta(aiTargetKey, range).setMeta('addToHistory', false));
}
