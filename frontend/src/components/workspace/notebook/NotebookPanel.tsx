import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Editor } from '@tiptap/react';
import {
  BookOpenCheck, ClipboardList, Copy, ExternalLink, FileText, FileType2, Globe, HelpCircle, Link2, Lightbulb,
  Loader2, Lock, Pencil, Plus, Quote, Send, Sparkles, StickyNote, Table, Trash2, Upload, X,
} from 'lucide-react';
import { apiErrorMessage } from '../../../utils/apiError';
import type { StreamError } from '../../../utils/sse';
import {
  notebookService, type NotebookCitation, type NotebookOutput, type NotebookSource, type NotebookSourceKind,
} from '../../../services/notebookService';
import { answerToChipHtml, answerToDocumentHtml, toCitationSource } from './citeHtml';

interface Props {
  editor: Editor | null;
  sessionId: string;
  isPremium: boolean;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  label?: string;
  citations?: NotebookCitation[];
  status?: 'streaming' | 'done' | 'error';
  error?: string;
}

const MAX_SOURCES = 20;

const KIND_ICON: Record<NotebookSourceKind, typeof FileText> = {
  pdf: FileText, docx: FileType2, txt: StickyNote, text: StickyNote, url: Globe,
};

const OUTPUTS: { kind: NotebookOutput; label: string; hint: string; icon: typeof FileText }[] = [
  { kind: 'summary', label: 'Briefing summary', hint: 'Key points, agreements and differences', icon: ClipboardList },
  { kind: 'matrix', label: 'Literature matrix', hint: 'Aim, method, findings and gap per source', icon: Table },
  { kind: 'questions', label: 'Research questions', hint: 'Five grounded questions to investigate', icon: Lightbulb },
  { kind: 'faq', label: 'FAQ', hint: 'Questions and cited answers', icon: HelpCircle },
  { kind: 'study-guide', label: 'Study guide', hint: 'Key terms, main ideas, self-check', icon: BookOpenCheck },
];

const STARTERS = ['What are the main findings across my sources?', 'Where do the sources disagree?', 'What gaps do they leave for my study?'];

/**
 * NotebookLM-style panel (Premium): the student's own sources for this document,
 * chat answered only from them with numbered citations, and one-click outputs.
 * Answers go into the document with real citations and reference-list entries.
 */
export default function NotebookPanel({ editor, sessionId, isPremium }: Props) {
  const navigate = useNavigate();
  const [sources, setSources] = useState<NotebookSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<'menu' | 'link' | 'text' | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [linkValue, setLinkValue] = useState('');
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [editing, setEditing] = useState<{ id: string; title: string; authors: string; year: string } | null>(null);
  const [tab, setTab] = useState<'chat' | 'create'>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [activeCite, setActiveCite] = useState<{ index: number; n: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isPremium || !sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await notebookService.list(sessionId);
        if (!cancelled) setSources(res.data.sources);
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'Could not load your sources'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; abortRef.current?.abort(); };
  }, [sessionId, isPremium]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // ── Sources ─────────────────────────────────────────────────────────────
  const addWith = useCallback(async (label: string, request: () => Promise<{ data: { source: NotebookSource } }>) => {
    setBusy(label);
    setError('');
    try {
      const res = await request();
      setSources((list) => [...list, res.data.source]);
      setAdding(null);
      setLinkValue('');
      setPasteTitle('');
      setPasteText('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not add that source'));
    } finally {
      setBusy('');
    }
  }, []);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { setError('Files can be up to 15 MB.'); return; }
    void addWith(`Reading ${file.name}…`, () => notebookService.addFile(sessionId, file));
  };

  const saveDetails = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setError('');
    try {
      const res = await notebookService.update(sessionId, editing.id, {
        title: editing.title,
        authors: editing.authors,
        year: editing.year.trim() ? Number(editing.year) : null,
      });
      setSources((list) => list.map((s) => (s.id === res.data.source.id ? res.data.source : s)));
      setEditing(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the details'));
    }
  };

  const removeSource = async (source: NotebookSource) => {
    if (!window.confirm(`Remove “${source.title}” from this document's sources?`)) return;
    try {
      await notebookService.remove(sessionId, source.id);
      setSources((list) => list.filter((s) => s.id !== source.id));
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not remove the source'));
    }
  };

  // ── Chat and outputs ────────────────────────────────────────────────────
  const ask = useCallback(async (
    request: { type: 'chat'; question: string } | { type: 'generate'; kind: NotebookOutput; label: string },
  ) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setActiveCite(null);
    setError('');

    const history = messages
      .filter((m) => m.status !== 'error' && m.content)
      .map((m) => ({ role: m.role, content: m.content }));
    const userMessage: Message = request.type === 'chat'
      ? { role: 'user', content: request.question }
      : { role: 'user', content: request.label, label: 'Create' };
    setMessages((list) => [...list, userMessage, { role: 'assistant', content: '', status: 'streaming', citations: [] }]);

    const patchLast = (patch: Partial<Message> | ((m: Message) => Partial<Message>)) =>
      setMessages((list) => {
        const next = [...list];
        const last = next[next.length - 1];
        next[next.length - 1] = { ...last, ...(typeof patch === 'function' ? patch(last) : patch) };
        return next;
      });

    try {
      const { truncated } = await notebookService.stream(
        sessionId,
        request.type === 'chat' ? { type: 'chat', question: request.question, history } : { type: 'generate', kind: request.kind },
        {
          onSources: (citations) => patchLast({ citations }),
          onDelta: (text) => patchLast((m) => ({ content: m.content + text })),
        },
        controller.signal,
      );
      patchLast({ status: 'done', error: truncated ? 'This answer reached the length limit and may be cut off.' : undefined });
    } catch (err) {
      if (controller.signal.aborted) return;
      const e = err as StreamError;
      patchLast({ status: 'error', error: e.message || 'Something went wrong.' });
    }
  }, [messages, sessionId]);

  const submitQuestion = (e: FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    setQuestion('');
    void ask({ type: 'chat', question: q });
  };

  const insertAnswer = (m: Message) => {
    if (!editor) return;
    editor.chain().focus().insertContent(answerToDocumentHtml(m.content, m.citations ?? [])).run();
  };

  const onChipClick = (index: number) => (e: MouseEvent<HTMLDivElement>) => {
    const chip = (e.target as HTMLElement).closest('.cite-chip') as HTMLElement | null;
    if (!chip) return;
    const n = Number(chip.dataset.n);
    setActiveCite((cur) => (cur && cur.index === index && cur.n === n ? null : { index, n }));
  };

  // ── Not Premium ─────────────────────────────────────────────────────────
  if (!isPremium) {
    return (
      <div className="p-5">
        <p className="flex items-center gap-2 text-[14px] font-semibold text-[#252423]"><Sparkles size={16} className="text-[#7c3aed]" /> Your sources, with AI that cites them</p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-[#605e5c]">
          Add your lecture notes, PDFs, Word files and links, then ask questions answered only from them, with every claim numbered back to its source.
          Create a literature matrix, summary or research questions in one click and insert them with real citations.
        </p>
        <button type="button" onClick={() => navigate('/subscribe?plan=premium')} className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[#7c3aed] px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-[#6d28d9]">
          <Lock size={13} /> Unlock with Premium
        </button>
      </div>
    );
  }

  const full = sources.length >= MAX_SOURCES;

  return (
    <div className="flex h-full flex-col">
      {/* Sources */}
      <div className="border-b border-rule px-3 py-2.5">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[#605e5c]">Your sources <span className="font-normal normal-case text-[#8a8886]">({sources.length}/{MAX_SOURCES})</span></p>
          <button
            type="button"
            disabled={full || Boolean(busy)}
            onClick={() => setAdding((a) => (a ? null : 'menu'))}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold text-[#6d28d9] hover:bg-[#f3e8ff] disabled:opacity-40"
            aria-expanded={adding !== null}
          >
            <Plus size={14} /> Add
          </button>
        </div>

        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md,application/pdf" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />

        {adding === 'menu' && (
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <AddOption icon={<Upload size={15} />} label="Upload file" onClick={() => { setAdding(null); fileRef.current?.click(); }} />
            <AddOption icon={<Link2 size={15} />} label="Web link" onClick={() => setAdding('link')} />
            <AddOption icon={<StickyNote size={15} />} label="Paste text" onClick={() => setAdding('text')} />
          </div>
        )}
        {adding === 'link' && (
          <form onSubmit={(e) => { e.preventDefault(); if (linkValue.trim()) void addWith('Reading the page…', () => notebookService.addUrl(sessionId, linkValue.trim())); }} className="mt-2 flex gap-1.5">
            <input autoFocus type="url" value={linkValue} onChange={(e) => setLinkValue(e.target.value)} placeholder="https://… (web page or PDF)" aria-label="Link to add" className="min-w-0 flex-1 rounded-md border border-[#c8c6c4] px-2 py-1.5 text-[12.5px] outline-none focus:border-[#7c3aed]" />
            <button type="submit" disabled={!linkValue.trim() || Boolean(busy)} className="rounded-md bg-[#7c3aed] px-2.5 text-[12px] font-semibold text-white disabled:opacity-40">Add</button>
          </form>
        )}
        {adding === 'text' && (
          <form onSubmit={(e) => { e.preventDefault(); if (pasteText.trim()) void addWith('Saving…', () => notebookService.addText(sessionId, pasteTitle.trim(), pasteText)); }} className="mt-2 space-y-1.5">
            <input autoFocus value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)} placeholder="Title (e.g. Week 3 lecture notes)" aria-label="Title" className="w-full rounded-md border border-[#c8c6c4] px-2 py-1.5 text-[12.5px] outline-none focus:border-[#7c3aed]" />
            <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={5} placeholder="Paste the text here…" aria-label="Text" className="w-full resize-y rounded-md border border-[#c8c6c4] px-2 py-1.5 text-[12.5px] outline-none focus:border-[#7c3aed]" />
            <div className="flex justify-end gap-1.5">
              <button type="button" onClick={() => setAdding(null)} className="rounded-md px-2.5 py-1 text-[12px] text-[#323130] hover:bg-[#f3f2f1]">Cancel</button>
              <button type="submit" disabled={!pasteText.trim() || Boolean(busy)} className="rounded-md bg-[#7c3aed] px-2.5 py-1 text-[12px] font-semibold text-white disabled:opacity-40">Add</button>
            </div>
          </form>
        )}

        {busy && <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[#605e5c]"><Loader2 size={13} className="animate-spin" /> {busy}</p>}
        {error && <p role="alert" className="mt-2 text-[12px] text-[#a4262c]">{error}</p>}

        <div className="mt-2 max-h-[30vh] space-y-1 overflow-y-auto">
          {loading && <p className="text-[12px] text-[#8a8886]">Loading…</p>}
          {!loading && sources.length === 0 && !busy && (
            <p className="rounded-md bg-[#faf5ff] px-2.5 py-2 text-[12px] leading-relaxed text-[#5b21b6]">
              Add lecture notes, PDFs, Word files or links. Answers here come only from what you add.
            </p>
          )}
          {sources.map((s) => {
            const Icon = KIND_ICON[s.kind];
            if (editing?.id === s.id) {
              return (
                <form key={s.id} onSubmit={saveDetails} className="space-y-1.5 rounded-md border border-[#e9d5ff] p-2">
                  <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} aria-label="Title" className="w-full rounded border border-[#c8c6c4] px-2 py-1 text-[12px]" />
                  <input value={editing.authors} onChange={(e) => setEditing({ ...editing, authors: e.target.value })} placeholder="Authors: Owusu, Kwame; Mensah, Ama" aria-label="Authors" className="w-full rounded border border-[#c8c6c4] px-2 py-1 text-[12px]" />
                  <div className="flex gap-1.5">
                    <input value={editing.year} onChange={(e) => setEditing({ ...editing, year: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="Year" inputMode="numeric" aria-label="Year" className="w-20 rounded border border-[#c8c6c4] px-2 py-1 text-[12px]" />
                    <span className="flex-1" />
                    <button type="button" onClick={() => setEditing(null)} className="rounded px-2 text-[12px] text-[#323130] hover:bg-[#f3f2f1]">Cancel</button>
                    <button type="submit" className="rounded bg-[#7c3aed] px-2 text-[12px] font-semibold text-white">Save</button>
                  </div>
                  <p className="text-[11px] text-[#8a8886]">Authors and year are used when you cite this source.</p>
                </form>
              );
            }
            return (
              <div key={s.id} className="group flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-[#f3f2f1]">
                <Icon size={15} className="shrink-0 text-[#605e5c]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] text-[#252423]" title={s.title}>{s.title}</p>
                  <p className="truncate text-[11px] text-[#8a8886]">
                    {[s.authors?.split(';')[0]?.split(',')[0], s.year].filter(Boolean).join(', ') || 'Add author & year to cite'} · {s.chunk_count} {s.chunk_count === 1 ? 'passage' : 'passages'}
                  </p>
                </div>
                <button type="button" onClick={() => setEditing({ id: s.id, title: s.title, authors: s.authors ?? '', year: s.year ? String(s.year) : '' })} aria-label={`Edit details of ${s.title}`} title="Edit details" className="rounded p-1 text-[#605e5c] opacity-0 hover:bg-white group-hover:opacity-100 focus:opacity-100"><Pencil size={13} /></button>
                <button type="button" onClick={() => void removeSource(s)} aria-label={`Remove ${s.title}`} title="Remove" className="rounded p-1 text-[#a4262c] opacity-0 hover:bg-white group-hover:opacity-100 focus:opacity-100"><Trash2 size={13} /></button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat / Create */}
      <div className="flex border-b border-rule text-[12px]" role="tablist">
        {(['chat', 'create'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`flex-1 py-2 font-semibold ${tab === t ? 'border-b-2 border-[#7c3aed] text-[#6d28d9]' : 'text-[#605e5c] hover:text-[#252423]'}`}>
            {t === 'chat' ? 'Chat with sources' : 'Create'}
          </button>
        ))}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {tab === 'create' && (
          <div className="grid gap-1.5">
            {OUTPUTS.map((o) => (
              <button key={o.kind} type="button" disabled={!sources.length} onClick={() => { setTab('chat'); void ask({ type: 'generate', kind: o.kind, label: o.label }); }} className="flex items-center gap-2.5 rounded-lg border border-[#e1dfdd] px-2.5 py-2 text-left hover:border-[#c4b5fd] hover:bg-[#faf5ff] disabled:opacity-40">
                <o.icon size={16} className="shrink-0 text-[#7c3aed]" />
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-medium text-[#252423]">{o.label}</span>
                  <span className="block text-[11px] text-[#8a8886]">{o.hint}</span>
                </span>
              </button>
            ))}
            {!sources.length && <p className="text-[12px] text-[#8a8886]">Add a source first.</p>}
          </div>
        )}

        {tab === 'chat' && messages.length === 0 && (
          <div className="space-y-1.5">
            <p className="text-[12px] text-[#605e5c]">Ask anything about your sources. Every answer cites them by number.</p>
            {STARTERS.map((q) => (
              <button key={q} type="button" disabled={!sources.length} onClick={() => void ask({ type: 'chat', question: q })} className="block w-full rounded-lg border border-[#e1dfdd] px-2.5 py-1.5 text-left text-[12px] text-[#323130] hover:border-[#c4b5fd] hover:bg-[#faf5ff] disabled:opacity-40">
                {q}
              </button>
            ))}
          </div>
        )}

        {tab === 'chat' && messages.map((m, i) => (
          m.role === 'user' ? (
            <div key={i} className="ml-6 rounded-lg bg-[#f3e8ff] px-2.5 py-1.5 text-[12.5px] text-[#3b0764]">
              {m.label && <span className="mr-1 font-semibold">{m.label}:</span>}{m.content}
            </div>
          ) : (
            <div key={i} className="rounded-lg border border-[#e1dfdd] bg-white">
              <div className="px-2.5 py-2">
                {m.content
                  ? <div onClick={onChipClick(i)} className="inline-ai-preview notebook-answer text-[12.5px] leading-relaxed text-[#252423]" dangerouslySetInnerHTML={{ __html: answerToChipHtml(m.content, m.citations ?? []) }} />
                  : m.status === 'streaming' && <p className="flex items-center gap-1.5 text-[12px] text-[#8a8886]"><Loader2 size={13} className="animate-spin" /> Reading your sources…</p>}
                {m.error && <p className={`mt-1 text-[12px] ${m.status === 'error' ? 'text-[#a4262c]' : 'text-[#8a6914]'}`}>{m.error}</p>}
              </div>

              {activeCite?.index === i && (() => {
                const c = m.citations?.find((x) => x.n === activeCite.n);
                if (!c) return null;
                return (
                  <div className="mx-2.5 mb-2 rounded-md border border-[#e9d5ff] bg-[#faf5ff] p-2">
                    <div className="flex items-start gap-2">
                      <span className="cite-chip shrink-0">{c.n}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold text-[#252423]">{c.title}</p>
                        <p className="text-[11px] text-[#605e5c]">{[c.authors, c.year].filter(Boolean).join(', ') || 'No author or year yet'}</p>
                      </div>
                      <button type="button" onClick={() => setActiveCite(null)} aria-label="Close" className="text-[#8a8886] hover:text-[#252423]"><X size={13} /></button>
                    </div>
                    {c.snippet && <p className="mt-1.5 line-clamp-4 text-[11.5px] italic text-[#605e5c]">“{c.snippet}…”</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button type="button" disabled={!editor} onClick={() => editor?.chain().focus().insertCitation([toCitationSource(c)]).run()} className="inline-flex items-center gap-1 rounded bg-[#7c3aed] px-2 py-1 text-[11.5px] font-semibold text-white disabled:opacity-40"><Quote size={12} /> Cite in document</button>
                      {c.url && <a href={c.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11.5px] text-[#323130] hover:bg-white"><ExternalLink size={12} /> Open</a>}
                    </div>
                  </div>
                );
              })()}

              {m.status === 'done' && m.content && (
                <div className="flex gap-1 border-t border-[#f3f2f1] px-1.5 py-1">
                  <button type="button" disabled={!editor} onClick={() => insertAnswer(m)} className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11.5px] font-semibold text-[#6d28d9] hover:bg-[#f3e8ff] disabled:opacity-40"><Plus size={12} /> Insert with citations</button>
                  <button type="button" onClick={() => void navigator.clipboard?.writeText(m.content.replace(/\[(\d+)\]/g, ''))} className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11.5px] text-[#323130] hover:bg-[#f3f2f1]"><Copy size={12} /> Copy</button>
                </div>
              )}
            </div>
          )
        ))}
      </div>

      {tab === 'chat' && (
        <form onSubmit={submitQuestion} className="flex items-center gap-1.5 border-t border-rule px-2 py-2">
          <input value={question} onChange={(e) => setQuestion(e.target.value)} disabled={!sources.length} placeholder={sources.length ? 'Ask about your sources…' : 'Add a source to start'} aria-label="Ask about your sources" className="min-w-0 flex-1 rounded-md border border-[#c8c6c4] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#7c3aed] disabled:bg-[#faf9f8]" />
          <button type="submit" disabled={!question.trim() || !sources.length} aria-label="Send" className="rounded-md bg-[#7c3aed] p-2 text-white disabled:opacity-40"><Send size={14} /></button>
        </form>
      )}
    </div>
  );
}

function AddOption({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1 rounded-lg border border-[#e1dfdd] px-1 py-2 text-[11.5px] text-[#323130] hover:border-[#c4b5fd] hover:bg-[#faf5ff]">
      <span className="text-[#7c3aed]">{icon}</span>
      {label}
    </button>
  );
}
