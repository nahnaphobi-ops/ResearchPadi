import { useState, useEffect, useCallback, useRef } from 'react';
import { apiErrorMessage, apiErrorStatus } from '../utils/apiError';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditor, type JSONContent } from '@tiptap/react';
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
import { WorkspaceHeader } from '../components/workspace/WorkspaceHeader';
import { EditorArea } from '../components/workspace/EditorArea';
import { SidePanel } from '../components/workspace/SidePanel';
import { StatusBar } from '../components/workspace/StatusBar';
import FindReplace from '../components/workspace/FindReplace';
import Ribbon from '../components/workspace/ribbon/Ribbon';
import { FontSize, Indent, LineHeight, PageBreak, ParagraphSpacing } from '../components/workspace/editorExtensions';
import { SearchHighlight } from '../components/workspace/search';
import { Bibliography, Citation, CitationManager } from '../components/workspace/citations/CitationExtension';
import { MARGINS, PAGE_SIZES, loadPageSettings, pageDimensions, savePageSettings, type PageSettings } from '../components/workspace/pageLayout';

const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;

export default function WorkspaceEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeSession, setActiveSession, updateSessionContent } = useWorkspaceStore();
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [sidePanel, setSidePanel] = useState<'ai' | 'citations' | null>(null);
  const [aiSelectedText, setAiSelectedText] = useState('');
  const [fullDocText, setFullDocText] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [selectedWords, setSelectedWords] = useState(0);
  // On phones an A4 sheet is wider than the screen, so open in Web Layout (reflowing) by default.
  const [settings, setSettings] = useState<PageSettings>(() => {
    const stored = loadPageSettings();
    return typeof window !== 'undefined' && window.innerWidth < 768 ? { ...stored, view: 'web' } : stored;
  });
  const [pageMetrics, setPageMetrics] = useState({ pageCount: 1, currentPage: 1 });
  const [find, setFind] = useState<'find' | 'replace' | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const savedHtmlRef = useRef<string | null>(null);

  const updateSettings = useCallback((patch: Partial<PageSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      savePageSettings(next);
      return next;
    });
  }, []);

  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        underline: false, // registered below with the rest of the formatting marks
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      Placeholder.configure({ placeholder: 'Start writing your paper here…' }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      LineHeight,
      ParagraphSpacing,
      Indent,
      PageBreak,
      SearchHighlight,
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
    ],
    content: activeSession?.content || '',
    editorProps: {
      attributes: {
        class: 'focus:outline-none',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor }) => {
      updateSessionContent(editor.getHTML());
      const text = editor.getText();
      setWordCount(countWords(text));
      setFullDocText(text);
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      const selected = from !== to ? editor.state.doc.textBetween(from, to, ' ') : '';
      setAiSelectedText(selected);
      setSelectedWords(selected ? countWords(selected) : 0);
    },
  });

  // Browser spellcheck follows the Review > Spelling toggle. setOptions is safe
  // before the editor view mounts (it is applied when the view is created).
  useEffect(() => {
    if (!editor) return;
    editor.setOptions({
      editorProps: {
        attributes: { class: 'focus:outline-none', spellcheck: settings.spellcheck ? 'true' : 'false' },
      },
    });
  }, [editor, settings.spellcheck]);

  // Load session — only run once on mount (not when editor changes)
  const editorRef = useRef(editor);
  useEffect(() => { editorRef.current = editor; }, [editor]);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!id || loadedRef.current) return;
    loadedRef.current = true;
    const loadSession = async () => {
      try {
        const res = await workspaceService.getSession(id);
        setActiveSession(res.data);
        savedHtmlRef.current = res.data.content || '';
        const trySetContent = () => {
          const ed = editorRef.current;
          if (ed && res.data.content && ed.getHTML() !== res.data.content) {
            ed.commands.setContent(res.data.content);
            const text = ed.getText();
            setWordCount(countWords(text));
            setFullDocText(text);
          } else if (!ed) {
            setTimeout(trySetContent, 100);
          }
        };
        trySetContent();
      } catch (err) {
        console.error('Failed to load session:', err);
        if (apiErrorStatus(err) === 403) navigate('/subscribe');
        else setError(apiErrorMessage(err, 'Failed to load session'));
      }
    };
    loadSession();
  }, [id, setActiveSession, navigate]);

  const save = useCallback(async (manual: boolean) => {
    if (!id || !editor) return;
    const html = editor.getHTML();
    if (!manual && html === savedHtmlRef.current) return; // nothing changed since the last save
    setSaving(true);
    if (manual) setError('');
    try {
      await workspaceService.updateSession(id, { content: html });
      savedHtmlRef.current = html;
      setLastSaved(new Date());
    } catch (err) {
      if (manual) setError(apiErrorMessage(err, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  }, [id, editor]);

  // Auto-save every 30s when there are changes.
  useEffect(() => {
    if (!id || !activeSession) return;
    const interval = setInterval(() => { void save(false); }, 30000);
    return () => clearInterval(interval);
  }, [id, activeSession, save]);

  const handleSave = useCallback(() => { void save(true); }, [save]);

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
    const headings: { level: number; text: string }[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'heading' && node.textContent.trim()) {
        headings.push({ level: Number(node.attrs.level), text: node.textContent.trim() });
      }
      return node.type.name !== 'heading';
    });
    if (headings.length === 0) {
      notify('No headings found. Use the Heading styles (Home › Styles) for chapter and section titles first.');
      return;
    }
    const toc: JSONContent[] = [
      { type: 'heading', attrs: { level: 1, textAlign: 'center' }, content: [{ type: 'text', text: 'Table of Contents' }] },
      ...headings.map((h) => ({
        type: 'paragraph',
        attrs: { indent: Math.max(0, h.level - 1) },
        content: [{ type: 'text', text: h.text }],
      })),
      { type: 'pageBreak' },
    ];
    editor.chain().focus().insertContent(toc).run();
  }, [editor, notify]);

  const handlePrint = useCallback(() => window.print(), []);

  const handleFitWidth = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const { width } = pageDimensions(settings);
    const available = scroller.clientWidth - 48;
    updateSettings({ zoom: Math.max(50, Math.min(200, Math.floor((available / width) * 100))) });
  }, [settings, updateSettings]);

  // Word keyboard shortcuts that the browser would otherwise take.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === 's') { e.preventDefault(); handleSave(); }
      else if (key === 'f') { e.preventDefault(); setFind('find'); }
      else if (key === 'h') { e.preventDefault(); setFind('replace'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSave]);

  const togglePanel = useCallback((panel: 'ai' | 'citations') => {
    setSidePanel((cur) => (cur === panel ? null : panel));
  }, []);

  if (!activeSession && !error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f3f2f1]">
        <div className="mx-auto mb-3 w-8 h-8 border-2 border-[#c8c6c4] border-t-[#2b579a] rounded-full animate-spin" />
        <p className="text-[#605e5c] text-sm">Opening document…</p>
      </div>
    );
  }

  const margins = MARGINS[settings.margins];

  return (
    <div className="h-screen flex flex-col bg-[#f3f2f1] workspace-shell">
      {/* Print with the chosen paper size and margins. */}
      <style>{`@media print { @page { size: ${PAGE_SIZES[settings.size].css} ${settings.orientation}; margin: ${margins.top}px ${margins.right}px ${margins.bottom}px ${margins.left}px; } }`}</style>

      <WorkspaceHeader
        editor={editor}
        lastSaved={lastSaved}
        saving={saving}
        onSave={handleSave}
        sidePanel={sidePanel}
        onTogglePanel={togglePanel}
      />

      {editor && (
        <Ribbon
          editor={editor}
          settings={settings}
          onSettingsChange={updateSettings}
          pageCount={pageMetrics.pageCount}
          onSave={handleSave}
          onExportDocx={handleExportDocx}
          onPrint={handlePrint}
          onInsertToc={handleInsertToc}
          onOpenFind={setFind}
          onOpenPanel={(panel) => setSidePanel(panel)}
          onTogglePanel={() => setSidePanel((cur) => (cur ? null : 'ai'))}
          onFitWidth={handleFitWidth}
          onBack={() => navigate('/workspace')}
          notify={notify}
          lastSaved={lastSaved}
        />
      )}

      {error && (
        <div role="alert" className="px-4 py-2 bg-[#fde7e9] text-[#a4262c] text-sm shrink-0 flex items-center justify-between gap-3 no-print">
          <span>{error}</span>
          <button onClick={() => setError('')} className="hover:underline text-xs font-semibold" aria-label="Dismiss error">Dismiss</button>
        </div>
      )}

      <div className="flex-1 flex min-h-0 relative">
        <EditorArea
          editor={editor}
          settings={settings}
          onPageMetrics={setPageMetrics}
          scrollRef={scrollRef}
        >
          {editor && find && (
            <FindReplace
              editor={editor}
              mode={find}
              onModeChange={setFind}
              onClose={() => setFind(null)}
              notify={notify}
            />
          )}
        </EditorArea>
        <SidePanel
          editor={editor}
          sidePanel={sidePanel}
          setSidePanel={setSidePanel}
          sessionId={id || ''}
          aiSelectedText={aiSelectedText}
          fullDocText={fullDocText}
          onInsertAIContent={handleInsertAIContent}
        />
        {toast && (
          <div role="status" className="absolute left-1/2 -translate-x-1/2 bottom-4 z-50 max-w-[90%] bg-[#323130] text-white text-[12.5px] px-4 py-2 rounded shadow-lg no-print">
            {toast}
          </div>
        )}
      </div>

      <StatusBar
        currentPage={pageMetrics.currentPage}
        pageCount={pageMetrics.pageCount}
        wordCount={wordCount}
        selectedWords={selectedWords}
        settings={settings}
        onSettingsChange={updateSettings}
      />
    </div>
  );
}
