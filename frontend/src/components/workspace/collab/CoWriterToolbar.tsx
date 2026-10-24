import { useEditorState, type Editor } from '@tiptap/react';
import { Bold, Heading1, Heading2, Heading3, Italic, List, ListOrdered, Redo2, Underline, Undo2 } from 'lucide-react';

/** The formatting a co-writer needs on a shared document: the owner keeps the full ribbon. */
export default function CoWriterToolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      canUndo: !e.isDestroyed && e.can().undo(),
      canRedo: !e.isDestroyed && e.can().redo(),
    }),
  });

  const buttons = [
    { label: 'Undo', icon: Undo2, run: () => editor.chain().focus().undo().run(), disabled: !state.canUndo },
    { label: 'Redo', icon: Redo2, run: () => editor.chain().focus().redo().run(), disabled: !state.canRedo },
    null,
    { label: 'Bold', icon: Bold, run: () => editor.chain().focus().toggleBold().run(), active: state.bold },
    { label: 'Italic', icon: Italic, run: () => editor.chain().focus().toggleItalic().run(), active: state.italic },
    { label: 'Underline', icon: Underline, run: () => editor.chain().focus().toggleUnderline().run(), active: state.underline },
    null,
    { label: 'Heading 1', icon: Heading1, run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: state.h1 },
    { label: 'Heading 2', icon: Heading2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: state.h2 },
    { label: 'Heading 3', icon: Heading3, run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: state.h3 },
    null,
    { label: 'Bulleted list', icon: List, run: () => editor.chain().focus().toggleBulletList().run(), active: state.bullet },
    { label: 'Numbered list', icon: ListOrdered, run: () => editor.chain().focus().toggleOrderedList().run(), active: state.ordered },
  ];

  return (
    <div role="toolbar" aria-label="Formatting" className="sticky top-0 z-10 -mx-6 -mt-8 mb-6 flex flex-wrap items-center gap-0.5 border-b border-rule bg-white/95 px-4 py-1.5 backdrop-blur sm:-mx-12">
      {buttons.map((b, i) => (b === null ? (
        <span key={i} className="mx-1 h-5 w-px bg-rule" aria-hidden />
      ) : (
        <button
          key={b.label}
          type="button"
          onClick={b.run}
          disabled={b.disabled}
          aria-label={b.label}
          aria-pressed={b.active}
          title={b.label}
          className={`grid h-8 w-8 place-items-center rounded text-navy hover:bg-navy-mist disabled:opacity-30 ${b.active ? 'bg-brand-soft text-brand' : ''}`}
        >
          <b.icon size={16} />
        </button>
      )))}
    </div>
  );
}
