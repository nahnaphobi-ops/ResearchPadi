import type { Editor } from '@tiptap/core';

const mountedDom = (editor: Editor): HTMLElement | null => {
  if (editor.isDestroyed) return null;
  try {
    return editor.view.dom;
  } catch {
    return null; // not mounted yet: TipTap throws instead of returning nothing
  }
};

/**
 * Listeners on the editor's DOM, attached once the editor is mounted. A new
 * editor (when a document goes live) mounts a moment after React renders it,
 * so effects can't count on its DOM being there yet. Returns the cleanup.
 */
export function onEditorDom(editor: Editor, attach: (dom: HTMLElement) => () => void): () => void {
  let detach: (() => void) | null = null;
  const run = () => {
    const dom = mountedDom(editor);
    if (dom && !detach) detach = attach(dom);
  };
  run();
  if (!detach) editor.on('mount', run);
  return () => {
    editor.off('mount', run);
    detach?.();
  };
}
