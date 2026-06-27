import React from 'react';
import { EditorContent } from '@tiptap/react';
import Toolbar from '../workspace/Toolbar';

interface Props {
  editor: any; // TipTap Editor instance
  handleExportDocx: () => void;
  handleInsertToc: () => void;
}

export const EditorArea: React.FC<Props> = ({ editor, handleExportDocx, handleInsertToc }) => (
  <div className="flex-1 flex flex-col overflow-hidden">
    <div className="shrink-0">
      <Toolbar editor={editor} onExportDocx={handleExportDocx} onInsertToc={handleInsertToc} />
    </div>
    <div className="flex-1 overflow-y-auto bg-[#e8e8e8] p-6">
      <div className="mx-auto bg-white shadow-xl border border-gray-300" style={{ maxWidth: '816px', minHeight: '1056px' }}>
        <EditorContent
          editor={editor}
          className="[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[960px] [&_.ProseMirror]:px-16 [&_.ProseMirror]:py-16 [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-gray-400 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_table]:w-full [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-gray-300 [&_.ProseMirror_td]:p-2 [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-gray-300 [&_.ProseMirror_th]:p-2 [&_.ProseMirror_th]:bg-gray-100 [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:rounded [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-gray-300 [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:italic [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_pre]:bg-gray-900 [&_.ProseMirror_pre]:text-gray-100 [&_.ProseMirror_pre]:p-4 [&_.ProseMirror_pre]:rounded [&_.ProseMirror_pre]:font-mono [&_.ProseMirror_code]:bg-gray-100 [&_.ProseMirror_code]:px-1.5 [&_.ProseMirror_code]:py-0.5 [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:text-sm"
        />
      </div>
    </div>
  </div>
);
