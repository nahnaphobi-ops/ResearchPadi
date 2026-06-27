import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditor } from '@tiptap/react';
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
import { workspaceService } from '../services/workspaceService';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { exportToDocx } from '../utils/exportDocx';
// Navbar removed – not used in editor layout

import { WorkspaceHeader } from '../components/workspace/WorkspaceHeader';
import { EditorArea } from '../components/workspace/EditorArea';
import { SidePanel } from '../components/workspace/SidePanel';



// Custom FontSize extension using textStyle mark
import { Extension } from '@tiptap/core';

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (element) => element.style.fontSize?.replace(/['"]+/g, ''),
          renderHTML: (attributes: any) => {
            if (!attributes.fontSize) return {};
            return { style: `font-size: ${attributes.fontSize}` };
          },
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ chain }: any) => {
        return chain().setMark('textStyle', { fontSize }).run();
      },
      unsetFontSize: () => ({ chain }: any) => {
        return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run();
      },
    };
  },
});

// Custom LineHeight extension
const LineHeight = Extension.create({
  name: 'lineHeight',
  addOptions() { return { types: ['paragraph', 'heading'], defaultLineHeight: '1.5' }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        lineHeight: {
          default: this.options.defaultLineHeight,
          parseHTML: (element) => element.style.lineHeight || this.options.defaultLineHeight,
          renderHTML: (attributes: any) => {
            if (!attributes.lineHeight) return {};
            return { style: `line-height: ${attributes.lineHeight}` };
          },
        },
      },
    }];
  },
  addCommands() {
    return {
      setLineHeight: (lineHeight: string) => ({ commands }: any) => {
        return this.options.types.every((type: string) =>
          commands.updateAttributes(type, { lineHeight })
        );
      },
    };
  },
});

export default function WorkspaceEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeSession, setActiveSession, updateSessionContent } = useWorkspaceStore();
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const [sidePanel, setSidePanel] = useState<'ai' | 'citations' | null>(null);
  const [aiSelectedText, setAiSelectedText] = useState('');
  const [fullDocText, setFullDocText] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      Placeholder.configure({ placeholder: 'Start writing your paper here...' }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      LineHeight,
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
    ],
    content: activeSession?.content || '',
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[700px] px-16 py-12',
        style: 'font-family: Times New Roman; font-size: 12px; line-height: 1.5;',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      updateSessionContent(html);
      const text = editor.getText();
      setWordCount(text.split(/\s+/).filter(Boolean).length);
      setCharCount(text.length);
      setFullDocText(text);
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        setAiSelectedText(editor.state.doc.textBetween(from, to));
      } else {
        setAiSelectedText('');
      }
    },
  });

  // Load session — only run once on mount (not when editor changes)
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!id || loadedRef.current) return;
    loadedRef.current = true;
    const loadSession = async () => {
      try {
        const res = await workspaceService.getSession(id);
        setActiveSession(res.data);
        const trySetContent = () => {
          const ed = editorRef.current;
          if (ed && res.data.content && ed.getHTML() !== res.data.content) {
            ed.commands.setContent(res.data.content);
            const text = ed.getText();
            setWordCount(text.split(/\s+/).filter(Boolean).length);
            setCharCount(text.length);
            setFullDocText(text);
          } else if (!ed) {
            setTimeout(trySetContent, 100);
          }
        };
        trySetContent();
      } catch (err: any) {
        console.error('Failed to load session:', err);
        if (err.response?.status === 403) navigate('/subscribe');
        else setError(err.response?.data?.error || err.message || 'Failed to load session');
      }
    };
    loadSession();
  }, [id, setActiveSession, navigate]);

  // Auto-save every 30s
  useEffect(() => {
    if (!id || !activeSession) return;
    const interval = setInterval(async () => {
      try {
        setSaving(true);
        await workspaceService.updateSession(id, { content: editor?.getHTML() || '' });
        setLastSaved(new Date());
      } catch { /* silent */ } finally { setSaving(false); }
    }, 30000);
    return () => clearInterval(interval);
  }, [id, activeSession, editor]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    setError('');
    try {
      await workspaceService.updateSession(id, { content: editor?.getHTML() || '' });
      setLastSaved(new Date());
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleInsertAIContent = useCallback((text: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(text).run();
  }, [editor]);

  const handleExportDocx = useCallback(() => {
    if (!editor || !activeSession) return;
    exportToDocx(editor.getHTML(), activeSession.title || 'Untitled');
  }, [editor, activeSession]);

  const handleInsertToc = useCallback(() => {
    if (!editor) return;
    const json = editor.getJSON();
    const headings: { level: number; text: string }[] = [];
    json.content?.forEach(node => {
      if (node.type === 'heading' && node.attrs) {
        const firstChild = node.content?.[0] as { text?: string } | undefined;
        headings.push({ level: node.attrs.level as number, text: firstChild?.text || '' });
      }
    });
    if (headings.length === 0) {
      alert('No headings found. Add headings (H1, H2, H3) to generate a Table of Contents.');
      return;
    }
    let tocHtml = '<h2>Table of Contents</h2>';
    headings.forEach(h => {
      const indent = (h.level - 1) * 1.5;
      tocHtml += `<p style="margin-left: ${indent}em;"><a href="#">${h.text}</a></p>`;
    });
    tocHtml += '<hr />';
    editor.chain().focus().insertContent(tocHtml).run();
  }, [editor]);

    if (!activeSession && !error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
          <p className="text-gray-500">Loading session...</p>
        </div>
      );
    }

  return (
    <div className="h-screen flex flex-col bg-white">
      <WorkspaceHeader
        wordCount={wordCount}
        charCount={charCount}
        lastSaved={lastSaved}
        saving={saving}
        onSave={handleSave}
      />

      {/* Error */}
      {error && <div className="px-4 py-2 bg-red-100 text-red-700 text-sm shrink-0">{error}</div>}

      <EditorArea editor={editor} handleExportDocx={handleExportDocx} handleInsertToc={handleInsertToc} />
      <SidePanel
        sidePanel={sidePanel}
        setSidePanel={setSidePanel}
        sessionId={id || ''}
        aiSelectedText={aiSelectedText}
        fullDocText={fullDocText}
        onInsertAIContent={handleInsertAIContent}
      />
    </div>
  );
}
