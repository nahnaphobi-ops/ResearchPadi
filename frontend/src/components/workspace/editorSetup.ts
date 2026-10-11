import type { Extensions } from '@tiptap/core';
import { StarterKit } from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extension-placeholder';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import { Highlight } from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Image } from '@tiptap/extension-image';
import { Typography } from '@tiptap/extension-typography';
import { Underline } from '@tiptap/extension-underline';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { FontSize, Indent, LineHeight, PageBreak, ParagraphSpacing } from './editorExtensions';
import { SearchHighlight } from './search';
import { Bibliography, Citation, CitationManager } from './citations/CitationExtension';
import { AITargetHighlight } from './inlineAI/aiTarget';
import { ReviewMarks } from './review/reviewMarks';

/**
 * The document schema shared by the editor and the reviewer's read-only view.
 * Rendering through the same schema also sanitises stored HTML: anything the
 * schema doesn't know (scripts, event handlers, unknown tags) is dropped.
 */
export function workspaceExtensions(opts: { placeholder?: string } = {}): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      underline: false, // registered below with the rest of the formatting marks
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
    }),
    Placeholder.configure({ placeholder: opts.placeholder ?? 'Start writing your paper here…' }),
    TextStyle,
    Color,
    FontFamily,
    FontSize,
    LineHeight,
    ParagraphSpacing,
    Indent,
    PageBreak,
    SearchHighlight,
    AITargetHighlight,
    ReviewMarks,
    Citation,
    Bibliography,
    CitationManager,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Highlight.configure({ multicolor: true }),
    Underline,
    Subscript,
    Superscript,
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    Image,
    Typography,
    TaskList,
    TaskItem.configure({ nested: true }),
  ];
}
