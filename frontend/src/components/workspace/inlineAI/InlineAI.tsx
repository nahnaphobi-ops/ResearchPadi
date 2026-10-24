import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import type { Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import {
  ArrowDownToLine, BookOpen, Check, ChevronDown, Copy, Heading1, Heading2, Heading3, Library, Lightbulb, List, ListOrdered,
  Lock, PenLine, Quote, RotateCcw, Scissors, Send, Sparkles, SpellCheck, Square, Table, Text, Wand2, X,
} from 'lucide-react';
import { markdownToHtml, inlineContent } from './markdown';
import { streamInlineAI, type InlineAction, type InlineAIError, type InlineRequest } from './stream';
import { setAITarget } from './aiTarget';
import { notebookService, type NotebookCitation } from '../../../services/notebookService';
import { answerToDocumentHtml } from '../notebook/citeHtml';
import { onEditorDom } from '../editorDom';

interface Props {
  editor: Editor;
  isPremium: boolean;
  docTitle?: string;
  sessionId?: string;
  /** Open the citations panel (used by the toolbar's Cite button). */
  onOpenCitations?: () => void;
}

/** 'sources' writes from the student's notebook sources (notebook chat), not the inline-AI endpoint. */
type Action = InlineAction | 'sources';
const ADVICE: ReadonlySet<Action> = new Set<Action>(['feedback', 'explain']);

/** The document's headings, one per line, so drafts fit its structure. */
function documentOutline(editor: Editor): string {
  const lines: string[] = [];
  editor.state.doc.forEach((node) => {
    if (node.type.name === 'heading' && node.textContent.trim() && lines.length < 60) lines.push(node.textContent.trim());
  });
  return lines.join('\n');
}

type Mode = 'idle' | 'slash' | 'ask' | 'result' | 'upsell';
interface Target { from: number; to: number; selection: boolean }

interface SlashItem {
  id: string;
  label: string;
  hint: string;
  icon: ReactNode;
  group: 'AI' | 'Blocks';
  keywords: string;
  ai?: boolean;
}

const SELECTION_ACTIONS: { action: InlineAction; label: string }[] = [
  { action: 'improve', label: 'Improve writing' },
  { action: 'shorten', label: 'Make shorter' },
  { action: 'expand', label: 'Make longer' },
  { action: 'academic', label: 'Make more academic' },
  { action: 'simplify', label: 'Simplify language' },
  { action: 'grammar', label: 'Fix spelling & grammar' },
  { action: 'summarise', label: 'Summarise' },
  { action: 'feedback', label: 'Get feedback (no rewrite)' },
  { action: 'explain', label: 'Explain this' },
];

const SLASH_ITEMS: SlashItem[] = [
  { id: 'continue', label: 'Continue writing', hint: 'AI writes the next paragraph', icon: <PenLine size={16} />, group: 'AI', keywords: 'continue next write more', ai: true },
  { id: 'draft', label: 'Draft a section…', hint: 'Describe it, AI drafts it', icon: <Wand2 size={16} />, group: 'AI', keywords: 'draft section write generate', ai: true },
  { id: 'table', label: 'Make a table…', hint: 'AI builds a table', icon: <Table size={16} />, group: 'AI', keywords: 'table matrix compare', ai: true },
  { id: 'sources', label: 'Write from my sources…', hint: 'Cites your uploaded sources', icon: <Library size={16} />, group: 'AI', keywords: 'sources cite notebook evidence write', ai: true },
  { id: 'brainstorm', label: 'Brainstorm ideas', hint: 'Bullet list of angles', icon: <Lightbulb size={16} />, group: 'AI', keywords: 'brainstorm ideas list', ai: true },
  { id: 'summarise-above', label: 'Summarise above', hint: 'One-paragraph summary', icon: <Text size={16} />, group: 'AI', keywords: 'summary summarise summarize tldr', ai: true },
  { id: 'ask', label: 'Ask AI…', hint: 'Anything else', icon: <Sparkles size={16} />, group: 'AI', keywords: 'ask ai prompt', ai: true },
  { id: 'h1', label: 'Heading 1', hint: 'Chapter title', icon: <Heading1 size={16} />, group: 'Blocks', keywords: 'heading h1 chapter title' },
  { id: 'h2', label: 'Heading 2', hint: 'Section', icon: <Heading2 size={16} />, group: 'Blocks', keywords: 'heading h2 section' },
  { id: 'h3', label: 'Heading 3', hint: 'Sub-section', icon: <Heading3 size={16} />, group: 'Blocks', keywords: 'heading h3 subsection' },
  { id: 'ul', label: 'Bullet list', hint: 'Simple list', icon: <List size={16} />, group: 'Blocks', keywords: 'bullet list unordered' },
  { id: 'ol', label: 'Numbered list', hint: '1, 2, 3', icon: <ListOrdered size={16} />, group: 'Blocks', keywords: 'numbered ordered list' },
  { id: 'quote', label: 'Quote', hint: 'Block quotation', icon: <Quote size={16} />, group: 'Blocks', keywords: 'quote blockquote' },
  { id: 'tbl', label: 'Table', hint: '3 × 3 grid', icon: <Table size={16} />, group: 'Blocks', keywords: 'table grid' },
  { id: 'pb', label: 'Page break', hint: 'Start a new page', icon: <Square size={16} />, group: 'Blocks', keywords: 'page break new page' },
];

const CARD_WIDTH = 460;

function cardPosition(anchor: { left: number; top: number; bottom: number }, width = CARD_WIDTH): CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(width, vw - 16);
  const left = Math.max(8, Math.min(anchor.left, vw - w - 8));
  const below = anchor.bottom + 8;
  // Clamp so the card stays on screen even if its anchor has scrolled away.
  return vh - below > 280
    ? { position: 'fixed', left, top: Math.max(8, Math.min(below, vh - 140)), width: w }
    : { position: 'fixed', left, bottom: Math.max(8, Math.min(vh - anchor.top + 8, vh - 140)), width: w };
}

/**
 * Notion-style AI in the document (Premium): a toolbar on selected text, a "/"
 * menu on an empty line, Ctrl/⌘+J for Ask AI, and a result card that streams the
 * answer and lets the student replace, insert below, retry or refine it.
 */
export default function InlineAI({ editor, isPremium, docTitle, sessionId, onOpenCitations }: Props) {
  const navigate = useNavigate();
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const [mode, setModeState] = useState<Mode>('idle');
  const modeRef = useRef<Mode>('idle');
  const setMode = (m: Mode) => { modeRef.current = m; setModeState(m); };

  // The state drives rendering; the ref gives event handlers the latest value.
  const targetRef = useRef<Target | null>(null);
  const [target, setTargetState] = useState<Target | null>(null);
  const setTarget = useCallback((t: Target | null) => { targetRef.current = t; setTargetState(t); }, []);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const [askAction, setAskAction] = useState<Action>('ask');
  const [resultAction, setResultAction] = useState<Action>('ask');
  const [citations, setCitations] = useState<NotebookCitation[]>([]);
  const [copied, setCopied] = useState(false);
  const [askPlaceholder, setAskPlaceholder] = useState('');
  const [askText, setAskText] = useState('');
  const [result, setResult] = useState('');
  const [status, setStatus] = useState<'streaming' | 'done' | 'error'>('done');
  const [note, setNote] = useState('');
  const [refineText, setRefineText] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const lastRequest = useRef<(Omit<InlineRequest, 'action'> & { action: Action }) | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // ── Close everything ─────────────────────────────────────────────────────
  const close = useCallback(() => {
    abortRef.current?.abort();
    setAITarget(editor, null);
    setTarget(null);
    setMode('idle');
    setAskText('');
    setRefineText('');
    setResult('');
    setNote('');
    setMoreOpen(false);
  }, [editor, setTarget]);

  // ── Run an AI action and stream the answer ───────────────────────────────
  const run = useCallback(async (req: { action: Action; prompt?: string }) => {
    const t = targetRef.current;
    if (!t) return;
    if (!isPremium) { setMode('upsell'); return; }

    const doc = editor.state.doc;
    const from = Math.min(t.from, doc.content.size);
    const to = Math.min(t.to, doc.content.size);
    const isRefine = req.action === 'refine';
    const body = {
      ...req,
      text: isRefine ? lastRequest.current?.text : t.selection ? doc.textBetween(from, to, '\n', ' ') : undefined,
      before: doc.textBetween(Math.max(0, from - 6000), from, '\n', ' '),
      after: doc.textBetween(to, Math.min(doc.content.size, to + 2000), '\n', ' '),
      previous: isRefine ? result : undefined,
      title: docTitle,
      outline: documentOutline(editor),
    };
    if (!isRefine) { lastRequest.current = body; setCanRetry(true); setResultAction(req.action); }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setResult('');
    setNote('');
    setRefineText('');
    setStatus('streaming');
    setMode('result');
    editor.commands.scrollIntoView();
    if (t.selection) setAITarget(editor, { from, to });

    let text = '';
    setCitations([]);
    setCopied(false);
    try {
      let truncated = false;
      if (req.action === 'sources') {
        if (!sessionId) throw new Error('Open the Sources panel and add a source first.');
        ({ truncated } = await notebookService.stream(
          sessionId,
          { type: 'chat', question: `Write one or two paragraphs for my paper about: ${req.prompt}. Use only my sources and cite each point by number.`, history: [] },
          { onSources: setCitations, onDelta: (delta) => { text += delta; setResult(text); } },
          controller.signal,
        ));
      } else {
        ({ truncated } = await streamInlineAI({ ...body, action: req.action }, (delta) => { text += delta; setResult(text); }, controller.signal));
      }
      setStatus('done');
      if (truncated) setNote('The answer reached the length limit and may be cut off.');
      if (!text.trim()) { setStatus('error'); setNote('The AI returned nothing. Try again or rephrase.'); }
    } catch (e) {
      if (controller.signal.aborted) return;
      const err = e as InlineAIError;
      if (err.code === 'PREMIUM_REQUIRED') { setMode('upsell'); return; }
      setStatus('error');
      setNote(err.message || 'Something went wrong.');
    }
  }, [editor, isPremium, docTitle, result, sessionId]);

  // ── Open the Ask AI box at the selection or cursor ───────────────────────
  const openAsk = useCallback((action: Action = 'ask', placeholder?: string) => {
    const { from, to, empty } = editor.state.selection;
    editor.commands.scrollIntoView();
    setTarget({ from, to, selection: !empty });
    if (!isPremium) { setMode('upsell'); return; }
    if (!empty) setAITarget(editor, { from, to });
    setAskAction(action);
    setAskPlaceholder(placeholder ?? (empty ? 'Ask AI to write anything…' : 'Tell AI what to do with the selected text…'));
    setAskText('');
    setMode('ask');
  }, [editor, isPremium, setTarget]);

  const runOnSelection = useCallback((action: InlineAction) => {
    const { from, to, empty } = editor.state.selection;
    if (empty) return;
    setTarget({ from, to, selection: true });
    targetRef.current = { from, to, selection: true };
    setMoreOpen(false);
    void run({ action });
  }, [editor, run, setTarget]);

  const retry = useCallback(() => {
    const last = lastRequest.current;
    if (last) void run({ action: last.action, prompt: last.prompt });
  }, [run]);

  // ── Accept the answer ────────────────────────────────────────────────────
  const accept = useCallback((how: 'replace' | 'below' | 'insert') => {
    const t = targetRef.current;
    if (!t || !result.trim()) return;
    const html = resultAction === 'sources' ? answerToDocumentHtml(result, citations) : markdownToHtml(result);
    const doc = editor.state.doc;
    const chain = editor.chain().focus();
    if (how === 'replace') {
      chain.insertContentAt({ from: t.from, to: t.to }, inlineContent(html) ?? html).run();
    } else if (how === 'below') {
      const $to = doc.resolve(Math.min(t.to, doc.content.size));
      chain.insertContentAt($to.depth > 0 ? $to.after(1) : t.to, html).run();
    } else {
      const $at = doc.resolve(Math.min(t.from, doc.content.size));
      // Never pour headings and lists into a table cell: put the answer after the table.
      let tableDepth = 0;
      for (let d = $at.depth; d > 0; d--) if ($at.node(d).type.name === 'table') { tableDepth = d; break; }
      const emptyBlock = $at.depth > 0 && $at.parent.isTextblock && $at.parent.content.size === 0;
      const at = tableDepth ? $at.after(tableDepth) : emptyBlock ? { from: $at.before(), to: $at.after() } : t.from;
      chain.insertContentAt(at, html).run();
    }
    close();
  }, [editor, result, close, resultAction, citations]);

  const copyResult = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
    } catch {
      setNote('Your browser blocked copying. Select the text and press Ctrl+C.');
    }
  }, [result]);

  // ── "/" menu ─────────────────────────────────────────────────────────────
  const runSlash = useCallback((id: string) => {
    const block = (cmd: () => void) => { cmd(); close(); };
    switch (id) {
      case 'continue': return void run({ action: 'continue' });
      case 'draft': return openAsk('draft', 'What should this section cover? e.g. "2.3 Theoretical framework on TAM"');
      case 'table': return openAsk('table', 'What should the table show? e.g. "Summary of studies on mobile learning in Ghana"');
      case 'sources': return openAsk('sources', 'What should the paragraph say? e.g. "barriers to mobile money for market women"');
      case 'brainstorm': return void run({ action: 'brainstorm' });
      case 'summarise-above': return void run({ action: 'summarise-above' });
      case 'ask': return openAsk('ask');
      case 'h1': return block(() => editor.chain().focus().setNode('heading', { level: 1 }).run());
      case 'h2': return block(() => editor.chain().focus().setNode('heading', { level: 2 }).run());
      case 'h3': return block(() => editor.chain().focus().setNode('heading', { level: 3 }).run());
      case 'ul': return block(() => editor.chain().focus().toggleBulletList().run());
      case 'ol': return block(() => editor.chain().focus().toggleOrderedList().run());
      case 'quote': return block(() => editor.chain().focus().toggleBlockquote().run());
      case 'tbl': return block(() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run());
      case 'pb': return block(() => editor.chain().focus().insertContent({ type: 'pageBreak' }).run());
    }
  }, [editor, run, openAsk, close]);

  const filtered = useMemo(() => {
    const q = slashQuery.trim().toLowerCase();
    return q ? SLASH_ITEMS.filter((i) => i.label.toLowerCase().includes(q) || i.keywords.includes(q)) : SLASH_ITEMS;
  }, [slashQuery]);
  const filteredRef = useRef(filtered);
  const slashIndexRef = useRef(slashIndex);
  useEffect(() => {
    filteredRef.current = filtered;
    slashIndexRef.current = slashIndex;
  }, [filtered, slashIndex]);

  const chooseSlash = useCallback((item: SlashItem) => {
    const t = targetRef.current;
    if (!t) return;
    editor.chain().focus().deleteRange({ from: t.from, to: t.to }).run(); // remove "/query"
    const pos = editor.state.selection.from;
    setTarget({ from: pos, to: pos, selection: false });
    if (item.ai && !isPremium) { setMode('upsell'); return; }
    runSlash(item.id);
  }, [editor, isPremium, setTarget, runSlash]);

  // ── Follow the editor: map the target through edits, detect "/" ──────────
  useEffect(() => {
    const detectSlash = () => {
      const { selection } = editor.state;
      if (!(selection instanceof TextSelection) || !selection.empty) return null;
      const $from = selection.$from;
      if ($from.parent.type.name !== 'paragraph') return null;
      const text = $from.parent.textContent;
      if ($from.parentOffset !== text.length) return null;
      const m = text.match(/^\/([a-z ]{0,24})$/i);
      return m ? { query: m[1], from: $from.start(), to: $from.pos } : null;
    };

    const onTransaction = ({ transaction }: { transaction: { docChanged: boolean; mapping: { map: (pos: number, assoc?: number) => number } } }) => {
      const t = targetRef.current;
      if (t && transaction.docChanged && modeRef.current !== 'slash') {
        setTarget({ ...t, from: transaction.mapping.map(t.from, -1), to: transaction.mapping.map(t.to, 1) });
      }
      if (modeRef.current === 'idle' || modeRef.current === 'slash') {
        const slash = editor.isFocused ? detectSlash() : null;
        if (slash) {
          setTarget({ from: slash.from, to: slash.to, selection: false });
          setSlashQuery((q) => { if (q !== slash.query) setSlashIndex(0); return slash.query; });
          if (modeRef.current !== 'slash') { setSlashIndex(0); setMode('slash'); }
        } else if (modeRef.current === 'slash') {
          setTarget(null);
          setMode('idle');
        }
      }
      rerender();
    };
    const onFocusChange = () => rerender();
    editor.on('transaction', onTransaction);
    editor.on('focus', onFocusChange);
    editor.on('blur', onFocusChange);
    return () => {
      editor.off('transaction', onTransaction);
      editor.off('focus', onFocusChange);
      editor.off('blur', onFocusChange);
    };
  }, [editor, setTarget]);

  // Hide the toolbar while the mouse is still selecting.
  useEffect(() => onEditorDom(editor, (dom) => {
    const down = () => setDragging(true);
    const up = () => setDragging(false);
    dom.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    return () => { dom.removeEventListener('pointerdown', down); window.removeEventListener('pointerup', up); };
  }), [editor]);

  // Keep floating UI attached while the page scrolls or resizes.
  useEffect(() => {
    const onMove = () => rerender();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => { window.removeEventListener('scroll', onMove, true); window.removeEventListener('resize', onMove); };
  }, []);

  // Keyboard: Ctrl/⌘+J, "/" menu navigation, Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j' && (editor.isFocused || modeRef.current === 'idle')) {
        e.preventDefault();
        openAsk();
        return;
      }
      if (modeRef.current === 'slash') {
        const items = filteredRef.current;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault(); e.stopPropagation();
          if (!items.length) return;
          const step = e.key === 'ArrowDown' ? 1 : -1;
          setSlashIndex((i) => (i + step + items.length) % items.length);
        } else if (e.key === 'Enter' && items.length) {
          e.preventDefault(); e.stopPropagation();
          chooseSlash(items[Math.min(slashIndexRef.current, items.length - 1)]);
        } else if (e.key === 'Escape') {
          e.preventDefault(); e.stopPropagation();
          setTarget(null);
          setMode('idle');
        }
      } else if (e.key === 'Escape' && modeRef.current !== 'idle') {
        e.preventDefault();
        close();
        editor.commands.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [editor, openAsk, chooseSlash, close, setTarget]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // ── Where to draw ─────────────────────────────────────────────────────────
  const anchorFor = (from: number, to: number) => {
    try {
      const size = editor.state.doc.content.size;
      const a = editor.view.coordsAtPos(Math.min(from, size));
      const b = editor.view.coordsAtPos(Math.min(to, size));
      return { left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), bottom: Math.max(a.bottom, b.bottom) };
    } catch {
      return null;
    }
  };

  const sel = editor.state.selection;
  const showToolbar =
    mode === 'idle' && !dragging && editor.isFocused && editor.isEditable &&
    sel instanceof TextSelection && !sel.empty && sel.to - sel.from <= 20_000;
  const anchor = showToolbar ? anchorFor(sel.from, sel.to) : target ? anchorFor(target.from, target.to) : null;

  if (!anchor) return null;
  const keep = (e: React.MouseEvent) => e.preventDefault(); // keep the editor selection

  let content: ReactNode = null;

  if (showToolbar) {
    const top = anchor.top - 46 < 8 ? anchor.bottom + 8 : anchor.top - 46;
    content = (
      <div
        role="toolbar"
        aria-label="AI actions"
        onMouseDown={keep}
        style={{ position: 'fixed', top, left: Math.max(8, Math.min(anchor.left, window.innerWidth - 420)) }}
        className="z-[70] flex items-center gap-0.5 rounded-lg border border-[#c8c6c4] bg-white p-1 shadow-[0_6px_18px_rgba(0,0,0,0.16)] no-print"
      >
        <button type="button" onClick={() => openAsk()} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] font-semibold text-[#6d28d9] hover:bg-[#f3e8ff]">
          <Sparkles size={14} /> Ask AI {!isPremium && <Lock size={11} />}
        </button>
        <span className="mx-0.5 h-5 w-px bg-[#e1dfdd]" />
        <ToolbarButton icon={<Wand2 size={14} />} label="Improve" onClick={() => runOnSelection('improve')} />
        <ToolbarButton icon={<Scissors size={14} />} label="Shorten" onClick={() => runOnSelection('shorten')} />
        <ToolbarButton icon={<SpellCheck size={14} />} label="Grammar" onClick={() => runOnSelection('grammar')} />
        {onOpenCitations && <ToolbarButton icon={<BookOpen size={14} />} label="Cite" onClick={onOpenCitations} />}
        <div className="relative">
          <button type="button" onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen} className="inline-flex items-center gap-0.5 rounded-md px-2 py-1.5 text-[12.5px] text-[#323130] hover:bg-[#f3f2f1]">
            More <ChevronDown size={13} />
          </button>
          {moreOpen && (
            <div role="menu" className="absolute right-0 top-full mt-1 w-52 rounded-lg border border-[#c8c6c4] bg-white py-1 shadow-[0_6px_18px_rgba(0,0,0,0.16)]">
              {SELECTION_ACTIONS.map((a) => (
                <button key={a.action} type="button" role="menuitem" onClick={() => runOnSelection(a.action)} className="block w-full px-3 py-1.5 text-left text-[12.5px] text-[#323130] hover:bg-[#f3f2f1]">
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  } else if (mode === 'slash') {
    content = (
      <div
        role="listbox"
        aria-label="Insert"
        onMouseDown={keep}
        style={cardPosition(anchor, 300)}
        className="z-[70] max-h-[340px] overflow-y-auto rounded-lg border border-[#c8c6c4] bg-white py-1 shadow-[0_6px_18px_rgba(0,0,0,0.16)] no-print"
      >
        {filtered.length === 0 && <p className="px-3 py-2 text-[12.5px] text-[#605e5c]">No matches</p>}
        {(['AI', 'Blocks'] as const).map((group) => {
          const items = filtered.filter((i) => i.group === group);
          if (!items.length) return null;
          return (
            <div key={group}>
              <p className="px-3 pt-1.5 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[#8a8886]">
                {group === 'AI' ? 'AI writing' : 'Basic blocks'}{group === 'AI' && !isPremium ? ' · Premium' : ''}
              </p>
              {items.map((item) => {
                const index = filtered.indexOf(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={index === slashIndex}
                    onMouseEnter={() => setSlashIndex(index)}
                    onClick={() => chooseSlash(item)}
                    className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left ${index === slashIndex ? 'bg-[#f3f2f1]' : ''}`}
                  >
                    <span className={`flex h-7 w-7 items-center justify-center rounded-md border ${item.ai ? 'border-[#e9d5ff] bg-[#faf5ff] text-[#6d28d9]' : 'border-[#e1dfdd] text-[#323130]'}`}>{item.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] text-[#252423]">{item.label}</span>
                      <span className="block truncate text-[11px] text-[#8a8886]">{item.hint}</span>
                    </span>
                    {item.ai && !isPremium && <Lock size={12} className="text-[#8a8886]" />}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  } else if (mode === 'ask') {
    const hasSelection = target?.selection;
    const chips: { label: string; action: Action }[] = askAction !== 'ask' ? [] : hasSelection
      ? SELECTION_ACTIONS.slice(0, 5)
      : [{ label: 'Continue writing', action: 'continue' }, { label: 'Brainstorm ideas', action: 'brainstorm' }, { label: 'Summarise above', action: 'summarise-above' }];
    content = (
      <div style={cardPosition(anchor)} className="z-[70] rounded-xl border border-[#d8b4fe] bg-white p-2 shadow-[0_10px_28px_rgba(0,0,0,0.18)] no-print">
        <form
          onSubmit={(e) => { e.preventDefault(); if (askText.trim()) void run({ action: askAction, prompt: askText.trim() }); }}
          className="flex items-center gap-2"
        >
          <Sparkles size={16} className="ml-1 shrink-0 text-[#7c3aed]" />
          <input
            autoFocus
            value={askText}
            onChange={(e) => setAskText(e.target.value)}
            placeholder={askPlaceholder}
            aria-label="Ask AI"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-[13.5px] text-[#252423] outline-none placeholder:text-[#a19f9d]"
          />
          <button type="submit" disabled={!askText.trim()} aria-label="Send" className="rounded-md bg-[#7c3aed] p-1.5 text-white disabled:opacity-40">
            <Send size={14} />
          </button>
        </form>
        {chips.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5 border-t border-[#f3f2f1] pt-2">
            {chips.map((c) => (
              <button key={c.action} type="button" onClick={() => void run({ action: c.action })} className="rounded-full border border-[#e1dfdd] px-2.5 py-1 text-[11.5px] text-[#323130] hover:border-[#c4b5fd] hover:bg-[#faf5ff]">
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  } else if (mode === 'result') {
    const hasSelection = target?.selection;
    content = (
      <div style={cardPosition(anchor)} className="z-[70] flex max-h-[min(460px,70vh)] flex-col rounded-xl border border-[#d8b4fe] bg-white shadow-[0_10px_28px_rgba(0,0,0,0.18)] no-print" aria-live="polite">
        <div className="flex items-center gap-2 border-b border-[#f3f2f1] px-3 py-2 text-[12px] text-[#6d28d9]">
          <Sparkles size={14} />
          <span className="font-semibold">{status === 'streaming' ? (ADVICE.has(resultAction) ? 'Reading…' : 'Writing…') : status === 'error' ? 'Could not finish' : resultAction === 'feedback' ? 'Feedback for you' : resultAction === 'explain' ? 'Explanation' : resultAction === 'sources' ? 'From your sources' : 'AI suggestion'}</span>
          {status === 'streaming' && <span className="ml-auto inline-flex gap-1"><Dot /><Dot delay={150} /><Dot delay={300} /></span>}
        </div>
        <div className="min-h-[48px] flex-1 overflow-y-auto px-3 py-2">
          {result
            ? <div className="inline-ai-preview text-[13.5px] leading-relaxed text-[#252423]" dangerouslySetInnerHTML={{ __html: markdownToHtml(result) }} />
            : status === 'streaming' && <p className="text-[12.5px] text-[#a19f9d]">Thinking…</p>}
          {note && <p className={`mt-1 text-[12px] ${status === 'error' ? 'text-[#a4262c]' : 'text-[#8a6914]'}`}>{note}</p>}
        </div>
        <div className="border-t border-[#f3f2f1] px-2 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {ADVICE.has(resultAction) ? (
              <ActionButton disabled={status !== 'done'} onClick={() => void copyResult()} icon={copied ? <Check size={14} /> : <Copy size={14} />} label={copied ? 'Copied' : 'Copy'} />
            ) : hasSelection ? (
              <>
                <ActionButton primary disabled={status !== 'done'} onClick={() => accept('replace')} icon={<Check size={14} />} label="Replace selection" />
                <ActionButton disabled={status !== 'done'} onClick={() => accept('below')} icon={<ArrowDownToLine size={14} />} label="Insert below" />
              </>
            ) : (
              <ActionButton primary disabled={status !== 'done'} onClick={() => accept('insert')} icon={<Check size={14} />} label="Insert" />
            )}
            <ActionButton disabled={status === 'streaming' || !canRetry} onClick={retry} icon={<RotateCcw size={14} />} label="Try again" />
            <ActionButton onClick={() => { close(); editor.commands.focus(); }} icon={<X size={14} />} label={status === 'streaming' ? 'Stop' : ADVICE.has(resultAction) ? 'Done' : 'Discard'} />
          </div>
          {status === 'done' && result.trim() && !ADVICE.has(resultAction) && resultAction !== 'sources' && (
            <form onSubmit={(e) => { e.preventDefault(); if (refineText.trim()) void run({ action: 'refine', prompt: refineText.trim() }); }} className="mt-2 flex items-center gap-2 rounded-lg border border-[#e1dfdd] px-2">
              <input value={refineText} onChange={(e) => setRefineText(e.target.value)} placeholder="Tell AI what to change… e.g. “more formal”, “add a Ghana example”" aria-label="Refine the answer" className="min-w-0 flex-1 bg-transparent py-1.5 text-[12.5px] outline-none placeholder:text-[#a19f9d]" />
              <button type="submit" disabled={!refineText.trim()} aria-label="Refine" className="p-1 text-[#7c3aed] disabled:opacity-40"><Send size={14} /></button>
            </form>
          )}
        </div>
      </div>
    );
  } else if (mode === 'upsell') {
    content = (
      <div style={cardPosition(anchor, 360)} className="z-[70] rounded-xl border border-[#d8b4fe] bg-white p-4 shadow-[0_10px_28px_rgba(0,0,0,0.18)] no-print" role="dialog" aria-label="Premium feature">
        <p className="flex items-center gap-2 text-[14px] font-semibold text-[#252423]"><Sparkles size={16} className="text-[#7c3aed]" /> AI in your document is Premium</p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#605e5c]">Rewrite, shorten, expand and draft sections right where you write, with answers that stream in as you watch.</p>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => navigate('/subscribe?plan=premium')} className="rounded-md bg-[#7c3aed] px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#6d28d9]">See Premium</button>
          <button type="button" onClick={() => { close(); editor.commands.focus(); }} className="rounded-md px-3 py-1.5 text-[12.5px] text-[#323130] hover:bg-[#f3f2f1]">Not now</button>
        </div>
      </div>
    );
  }

  return content ? createPortal(content, document.body) : null;
}

function ToolbarButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[12.5px] text-[#323130] hover:bg-[#f3f2f1]">
      {icon} <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function ActionButton({ icon, label, onClick, primary, disabled }: { icon: ReactNode; label: string; onClick: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium disabled:opacity-40 ${primary ? 'bg-[#7c3aed] text-white hover:bg-[#6d28d9]' : 'text-[#323130] hover:bg-[#f3f2f1]'}`}
    >
      {icon} {label}
    </button>
  );
}

function Dot({ delay = 0 }: { delay?: number }) {
  return <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#a78bfa]" style={{ animationDelay: `${delay}ms` }} />;
}
