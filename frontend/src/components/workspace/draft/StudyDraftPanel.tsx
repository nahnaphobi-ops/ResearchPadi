import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type MouseEvent } from 'react';
import type { Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import { BookOpen, ClipboardCheck, Lightbulb, Loader2, MessageSquareText, Search } from 'lucide-react';
import { workspaceService, type CoachMode, type StudyDraft } from '../../../services/workspaceService';
import { apiErrorMessage } from '../../../utils/apiError';
import { markdownToHtml } from '../inlineAI/markdown';
import { draftOverlap, type OverlapResult } from '../../../utils/overlap';

interface Props {
  editor: Editor | null;
  sessionId: string;
}

/** Text the student wrote under a heading ("2.3 …" matched by number), up to the next heading of the same or higher level. */
function studentSectionText(editor: Editor, heading: string): string {
  const number = heading.match(/^(\d+\.\d+)/)?.[1];
  const parts: string[] = [];
  let inside = false;
  let level = 0;
  editor.state.doc.forEach((node) => {
    if (node.type.name === 'heading') {
      const text = node.textContent.trim();
      const isTarget = number ? text.startsWith(`${number} `) || text === number : text.toLowerCase() === heading.toLowerCase();
      if (isTarget) { inside = true; level = Number(node.attrs.level); return; }
      if (inside && Number(node.attrs.level) <= level) inside = false;
      return;
    }
    if (inside) parts.push(node.textContent);
  });
  return parts.join('\n').trim();
}

const block = (e: ClipboardEvent | MouseEvent) => e.preventDefault();

/**
 * The study draft beside the student's own document: read it section by
 * section (copying is switched off), get a plan or feedback from the coach,
 * and check how much of their wording repeats the draft.
 */
export default function StudyDraftPanel({ editor, sessionId }: Props) {
  const [draft, setDraft] = useState<StudyDraft | null>(null);
  const [error, setError] = useState('');
  const [section, setSection] = useState('');
  const [coachMode, setCoachMode] = useState<CoachMode | null>(null);
  const [coachText, setCoachText] = useState('');
  const [coachBusy, setCoachBusy] = useState(false);
  const [coachError, setCoachError] = useState('');
  const [overlap, setOverlap] = useState<OverlapResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    workspaceService.getStudyDraft(sessionId)
      .then((res) => {
        if (cancelled) return;
        setDraft(res.data);
        setSection(res.data.sections.find((s) => s.number.includes('.'))?.heading ?? res.data.sections[0]?.heading ?? '');
      })
      .catch((err) => { if (!cancelled) setError(apiErrorMessage(err, 'Could not load the study draft')); });
    return () => { cancelled = true; abortRef.current?.abort(); };
  }, [sessionId]);

  const current = useMemo(() => draft?.sections.find((s) => s.heading === section), [draft, section]);

  const runCoach = async (mode: CoachMode) => {
    if (!editor || !section) return;
    const { from, to, empty } = editor.state.selection;
    const selected = empty ? '' : editor.state.doc.textBetween(from, to, '\n', ' ');
    const text = mode === 'feedback' ? (selected.split(/\s+/).length >= 25 ? selected : studentSectionText(editor, section)) : undefined;
    if (mode === 'feedback' && (!text || text.split(/\s+/).length < 25)) {
      setCoachMode(mode);
      setCoachText('');
      setCoachError(`Write at least a short paragraph under "${section}" in your document (or select it), then ask again.`);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setCoachMode(mode);
    setCoachText('');
    setCoachError('');
    setCoachBusy(true);
    try {
      let out = '';
      await workspaceService.coach(sessionId, { mode, heading: section, text }, (delta) => { out += delta; setCoachText(out); }, controller.signal);
    } catch (err) {
      if (!controller.signal.aborted) setCoachError((err as Error).message || 'The coach could not finish.');
    } finally {
      setCoachBusy(false);
    }
  };

  const checkWording = () => {
    if (!editor || !draft) return;
    setOverlap(draftOverlap(draft.fullText, editor.getText({ blockSeparator: '\n' })));
  };

  const findInDocument = (text: string) => {
    if (!editor) return;
    let target: { from: number; to: number } | null = null;
    const start = text.slice(0, 40);
    editor.state.doc.descendants((node, pos) => {
      if (target) return false;
      if (node.isTextblock && node.textContent.trim().startsWith(start)) target = { from: pos + 1, to: pos + 1 + node.content.size };
      return !target;
    });
    if (!target) return;
    const { from, to } = target;
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, from, to)).scrollIntoView());
    editor.view.focus();
  };

  if (error) return <p role="alert" className="p-4 text-[12.5px] text-[#a4262c]">{error}</p>;
  if (!draft) return <p className="p-4 flex items-center gap-2 text-[12.5px] text-[#605e5c]"><Loader2 size={14} className="animate-spin" /> Loading your study draft…</p>;

  const pct = overlap ? Math.round(overlap.share * 100) : 0;
  const tone = pct >= 25 ? 'text-[#a4262c] bg-[#fde7e9] border-[#f1bbbc]' : pct >= 10 ? 'text-[#8a6914] bg-[#fff4ce] border-[#f2d98c]' : 'text-[#107c10] bg-[#dff6dd] border-[#a7d8a2]';

  return (
    <div className="flex flex-col h-full text-[#252423]">
      <div className="px-3 py-2.5 border-b border-rule">
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold"><BookOpen size={14} className="text-brand" /> Study draft · for reference</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-[#605e5c]">Read a section, close it, then write it your way. Copying is switched off here, and the coach gives pointers, never text to paste.</p>
        <label htmlFor="draft-section" className="sr-only">Section</label>
        <select
          id="draft-section"
          value={section}
          onChange={(e) => { setSection(e.target.value); setCoachMode(null); setCoachText(''); setCoachError(''); }}
          className="mt-2 w-full h-8 px-1.5 text-[12px] border border-[#8a8886] rounded-sm bg-white"
        >
          {draft.sections.map((s) => <option key={s.heading} value={s.heading}>{s.number.includes('.') ? '  ' : ''}{s.heading}</option>)}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div
          onCopy={block}
          onCut={block}
          onContextMenu={block}
          onDragStart={block as never}
          className="mx-3 mt-3 max-h-[34vh] overflow-y-auto rounded-md border border-[#e1dfdd] bg-[#faf9f8] p-3 text-[12.5px] leading-relaxed whitespace-pre-wrap select-none"
          aria-label="Study draft section (read only)"
        >
          {current?.text || <span className="text-[#8a8886]">This section is empty in the draft.</span>}
        </div>

        <div className="px-3 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">Coach</p>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <button type="button" disabled={coachBusy} onClick={() => void runCoach('guide')} className="flex items-center justify-center gap-1.5 rounded-md border border-[#e1dfdd] px-2 py-2 text-[12px] hover:border-brand hover:bg-brand-soft disabled:opacity-50">
              <Lightbulb size={14} className="text-brand" /> Plan this section
            </button>
            <button type="button" disabled={coachBusy} onClick={() => void runCoach('feedback')} className="flex items-center justify-center gap-1.5 rounded-md border border-[#e1dfdd] px-2 py-2 text-[12px] hover:border-brand hover:bg-brand-soft disabled:opacity-50">
              <MessageSquareText size={14} className="text-brand" /> Feedback on mine
            </button>
          </div>
          {coachMode && (
            <div className="mt-2 rounded-md border border-[#c7e0f4] bg-[#f3f9fd] p-2.5" aria-live="polite">
              {coachBusy && !coachText && <p className="flex items-center gap-1.5 text-[12px] text-[#605e5c]"><Loader2 size={13} className="animate-spin" /> {coachMode === 'guide' ? 'Planning…' : 'Reading your section…'}</p>}
              {coachText && <div className="inline-ai-preview text-[12.5px] leading-relaxed" dangerouslySetInnerHTML={{ __html: markdownToHtml(coachText) }} />}
              {coachError && <p className="text-[12px] text-[#a4262c]">{coachError}</p>}
            </div>
          )}
        </div>

        <div className="px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">Own words check</p>
          <button type="button" onClick={checkWording} className="mt-1.5 w-full flex items-center justify-center gap-1.5 rounded-md border border-[#e1dfdd] px-2 py-2 text-[12px] hover:border-brand hover:bg-brand-soft">
            <ClipboardCheck size={14} className="text-brand" /> Check my wording against the draft
          </button>
          {overlap && (
            <div className="mt-2 space-y-1.5">
              {overlap.checkedWords === 0 ? (
                <p className="text-[12px] text-[#605e5c]">Write a few paragraphs first; headings are not checked.</p>
              ) : (
                <p className={`rounded-md border px-2.5 py-2 text-[12px] ${tone}`}>
                  <strong>{pct}%</strong> of your writing repeats the draft's wording.{' '}
                  {pct >= 25 ? 'Rewrite the paragraphs below in your own words.' : pct >= 10 ? 'Look again at the paragraphs below.' : 'This is your own writing. Keep going.'}
                </p>
              )}
              {overlap.tooClose.map((p, i) => (
                <div key={i} className="flex items-start gap-2 rounded-md border border-[#e1dfdd] px-2 py-1.5">
                  <span className="shrink-0 text-[11px] font-bold text-[#a4262c]">{Math.round(p.share * 100)}%</span>
                  <span className="min-w-0 flex-1 text-[11.5px] text-[#323130]">{p.excerpt}</span>
                  <button type="button" onClick={() => findInDocument(p.text)} aria-label="Find this paragraph in your document" title="Find in document" className="shrink-0 rounded p-1 text-[#605e5c] hover:bg-[#f3f2f1]"><Search size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
