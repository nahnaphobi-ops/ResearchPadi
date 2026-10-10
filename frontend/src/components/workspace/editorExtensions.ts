import { Extension, Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
    paragraphLineHeight: {
      setParagraphLineHeight: (lineHeight: string) => ReturnType;
    };
    paragraphSpacing: {
      setSpaceAfter: (spaceAfter: string | null) => ReturnType;
    };
    indent: {
      indent: () => ReturnType;
      outdent: () => ReturnType;
    };
    pageBreak: {
      setPageBreak: () => ReturnType;
    };
  }
}

/** Font size on the textStyle mark, e.g. "12pt". */
export const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] as string[] };
  },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null as string | null,
          parseHTML: (element: HTMLElement) => element.style.fontSize?.replace(/['"]+/g, '') || null,
          renderHTML: (attributes: { fontSize?: string | null }) =>
            attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontSize: (fontSize) => ({ chain }) => chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize: () => ({ chain }) =>
        chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

/** Line spacing on paragraphs and headings, e.g. "1.5". */
export const LineHeight = Extension.create({
  name: 'paragraphLineHeight',
  addOptions() {
    return { types: ['paragraph', 'heading'] as string[], defaultLineHeight: '1.5' };
  },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        lineHeight: {
          default: this.options.defaultLineHeight as string | null,
          parseHTML: (element: HTMLElement) => element.style.lineHeight || this.options.defaultLineHeight,
          renderHTML: (attributes: { lineHeight?: string | null }) =>
            attributes.lineHeight ? { style: `line-height: ${attributes.lineHeight}` } : {},
        },
      },
    }];
  },
  addCommands() {
    return {
      setParagraphLineHeight: (lineHeight) => ({ commands }) =>
        this.options.types.map((type) => commands.updateAttributes(type, { lineHeight })).some(Boolean),
    };
  },
});

/** "Space after paragraph" like Word's paragraph spacing, e.g. "8pt". */
export const ParagraphSpacing = Extension.create({
  name: 'paragraphSpacing',
  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        spaceAfter: {
          default: null as string | null,
          parseHTML: (element: HTMLElement) => element.style.marginBottom || null,
          renderHTML: (attributes: { spaceAfter?: string | null }) =>
            attributes.spaceAfter ? { style: `margin-bottom: ${attributes.spaceAfter}` } : {},
        },
      },
    }];
  },
  addCommands() {
    return {
      setSpaceAfter: (spaceAfter) => ({ commands }) =>
        ['paragraph', 'heading'].map((type) => commands.updateAttributes(type, { spaceAfter })).some(Boolean),
    };
  },
});

const INDENT_STEP_EM = 2.5;
const MAX_INDENT_LEVEL = 8;

/**
 * Word-style Increase/Decrease Indent. Inside a list it nests or un-nests the
 * item; elsewhere it shifts the paragraph by a fixed step (stored as a level).
 */
export const Indent = Extension.create({
  name: 'indent',
  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        indent: {
          default: 0,
          parseHTML: (element: HTMLElement) => {
            const ml = parseFloat(element.style.marginLeft || '0');
            return ml > 0 ? Math.min(MAX_INDENT_LEVEL, Math.round(ml / INDENT_STEP_EM)) : 0;
          },
          renderHTML: (attributes: { indent?: number }) =>
            attributes.indent ? { style: `margin-left: ${attributes.indent * INDENT_STEP_EM}em` } : {},
        },
      },
    }];
  },
  addCommands() {
    const shift = (delta: number) => () => ({ editor, commands }: { editor: import('@tiptap/core').Editor; commands: import('@tiptap/core').SingleCommands }) => {
      if (editor.isActive('listItem')) {
        return delta > 0 ? commands.sinkListItem('listItem') : commands.liftListItem('listItem');
      }
      if (editor.isActive('taskItem')) {
        return delta > 0 ? commands.sinkListItem('taskItem') : commands.liftListItem('taskItem');
      }
      const type = editor.isActive('heading') ? 'heading' : 'paragraph';
      const current = Number(editor.getAttributes(type).indent || 0);
      const next = Math.max(0, Math.min(MAX_INDENT_LEVEL, current + delta));
      return commands.updateAttributes(type, { indent: next });
    };
    return {
      indent: shift(1),
      outdent: shift(-1),
    };
  },
  addKeyboardShortcuts() {
    return {
      // Tab indents outside lists (lists keep their own Tab handling).
      Tab: () => (this.editor.isActive('listItem') || this.editor.isActive('taskItem') ? false : this.editor.commands.indent()),
      'Shift-Tab': () => (this.editor.isActive('listItem') || this.editor.isActive('taskItem') ? false : this.editor.commands.outdent()),
    };
  },
});

/** Manual page break (Ctrl+Enter), rendered as a page gap and exported to print. */
export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: 'div[data-page-break]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-page-break': 'true', class: 'page-break' })];
  },
  addCommands() {
    return {
      setPageBreak: () => ({ chain }) =>
        chain().insertContent({ type: this.name }).insertContent({ type: 'paragraph' }).run(),
    };
  },
  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => this.editor.commands.setPageBreak(),
    };
  },
});
