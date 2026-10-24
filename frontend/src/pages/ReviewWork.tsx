import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EditorContent, useEditor } from '@tiptap/react';
import { ArrowLeft, Clock, CornerDownRight, MessageSquarePlus, Trash2 } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import { workspaceExtensions } from '../components/workspace/editorSetup';
import { locateAnchor, occurrenceAt, showReviewMarks } from '../components/workspace/review/reviewMarks';
import { apiErrorMessage } from '../utils/apiError';
import { reviewDeskService, SOURCE_LABEL, type DeskDetail, type ReviewComment } from '../services/reviewService';

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');

/**
 * Reviewer's workspace: the student's snapshot rendered read-only through the
 * editor schema (which also strips unsafe HTML), comments anchored to selected
 * text with optional suggested edits, a 1–5 checklist and an overall summary.
 */
export default function ReviewWork() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [request, setRequest] = useState<DeskDetail | null>(null);
  const [error, setError] = useState('');
  const [selection, setSelection] = useState<{ text: string; from: number } | null>(null);
  const [draft, setDraft] = useState<{ text: string; occurrence: number; comment: string; suggestion: string } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [summary, setSummary] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  const editor = useEditor({
    extensions: workspaceExtensions({ placeholder: '' }),
    editable: false,
    content: '',
    editorProps: { attributes: { class: 'focus:outline-none' } },
    onSelectionUpdate: ({ editor: ed }) => {
      const { from, to, empty } = ed.state.selection;
      const text = empty ? '' : ed.state.doc.textBetween(from, to, ' ').trim();
      setSelection(text ? { text: text.slice(0, 2_000), from } : null);
    },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await reviewDeskService.get(id);
        if (cancelled) return;
        setRequest(res.data.request);
        setSummary(res.data.request.summary ?? '');
        setScores(res.data.request.scores ?? {});
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'Could not open this review'));
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Load the snapshot into the read-only editor once both exist.
  useEffect(() => {
    if (editor && request) editor.commands.setContent(request.content_snapshot);
  }, [editor, request?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (editor && request) showReviewMarks(editor, request.comments, activeId);
  }, [editor, request, activeId]);

  const editable = request?.status === 'in_review';

  const startComment = () => {
    if (!editor || !selection) return;
    setDraft({ text: selection.text, occurrence: occurrenceAt(editor, selection.text, selection.from), comment: '', suggestion: '' });
  };

  const saveComment = async () => {
    if (!draft || !request) return;
    setBusy(true);
    setError('');
    try {
      const res = await reviewDeskService.addComment(request.id, {
        anchorText: draft.text,
        occurrence: draft.occurrence,
        comment: draft.comment,
        suggestion: draft.suggestion.trim() || undefined,
      });
      setRequest({ ...request, comments: [...request.comments, res.data.comment] });
      setDraft(null);
      setSelection(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the comment'));
    } finally {
      setBusy(false);
    }
  };

  const removeComment = async (c: ReviewComment) => {
    if (!request) return;
    try {
      await reviewDeskService.deleteComment(request.id, c.id);
      setRequest({ ...request, comments: request.comments.filter((x) => x.id !== c.id) });
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not delete the comment'));
    }
  };

  const jumpTo = useCallback((c: ReviewComment) => {
    if (!editor) return;
    setActiveId(c.id);
    const range = locateAnchor(editor, c);
    if (range) editor.chain().setTextSelection(range).scrollIntoView().run();
  }, [editor]);

  const submit = async () => {
    if (!request) return;
    if (!window.confirm('Return this review to the student? You won’t be able to change it afterwards.')) return;
    setBusy(true);
    setError('');
    try {
      await reviewDeskService.returnReview(request.id, { summary, scores });
      navigate('/review-desk');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not return the review'));
    } finally {
      setBusy(false);
    }
  };

  const releaseIt = async () => {
    if (!request || !window.confirm('Give this request back to the queue? Your comments will be removed.')) return;
    try {
      await reviewDeskService.release(request.id);
      navigate('/review-desk');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not release the request'));
    }
  };

  if (error && !request) {
    return (
      <AppShell>
        <Link to="/review-desk" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={14} /> Review desk</Link>
        <p className="mt-4 text-red-700">{error}</p>
      </AppShell>
    );
  }

  return (
    <AppShell wide>
      <Link to="/review-desk" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={14} /> Review desk</Link>
      {!request ? <p className="mt-4 text-muted">Loading…</p> : (
        <>
          <div className="mt-3 mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-navy">{request.title}</h1>
              <p className="text-sm text-muted">
                {SOURCE_LABEL[request.source_type]} · {request.scope === 'full' ? 'whole' : 'selected part'} · {request.word_count.toLocaleString()} words
                {request.programme ? ` · ${request.programme}` : ''}{request.institution_type ? ` (${request.institution_type})` : ''}
              </p>
            </div>
            <p className="inline-flex items-center gap-1.5 text-sm text-muted">
              <Clock size={14} /> {request.status === 'returned' ? `Returned ${fmt(request.returned_at)}` : `Due ${fmt(request.due_at)}`} · you earn GHS {request.reviewer_pay_ghs.toFixed(2)}
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            {/* The work */}
            <div className="min-w-0">
              {request.source_type === 'care_study' && (
                <p className="mb-3 rounded-xl border border-rule bg-white p-3 text-sm text-ink">
                  {request.specialty === 'research_methods' ? (
                    <>
                      <span className="font-semibold">Research project. </span>
                      Each section shows the student's own notes, then her draft. The notes are the only facts about the study and its results. Flag any figure or detail in the draft that the notes do not support, any objective without a finding, and anything marked [Student to supply: …] that is still missing. Do not add results yourself.
                    </>
                  ) : (
                    <>
                      <span className="font-semibold">Care study. </span>
                      Each section shows the student's own notes, then her draft. The notes are the only facts about the client. Flag any draft detail the notes do not support, and anything marked [Student to supply: …] that is still missing. Do not add clinical facts yourself.
                    </>
                  )}
                </p>
              )}
              {request.notes && <p className="mb-3 rounded-xl bg-brand-soft p-3 text-sm text-ink"><span className="font-semibold">Student's note: </span>{request.notes}</p>}
              {editable && (
                <div className="sticky top-16 z-10 mb-2 flex items-center gap-2 rounded-lg border border-rule bg-white/95 px-3 py-2 text-sm backdrop-blur">
                  {selection
                    ? <><span className="min-w-0 flex-1 truncate text-muted">“{selection.text}”</span><button type="button" onClick={startComment} className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#7c3aed] px-2.5 py-1 text-xs font-semibold text-white"><MessageSquarePlus size={13} /> Comment</button></>
                    : <span className="text-muted">Select text in the document to comment on it or suggest an edit.</span>}
                </div>
              )}
              <div className="rounded-xl border border-[#d2d0ce] bg-white px-6 py-8 sm:px-12">
                <EditorContent editor={editor} className="word-doc" />
              </div>
            </div>

            {/* Feedback */}
            <aside className="space-y-4">
              {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

              {draft && (
                <div className="rounded-xl border border-[#c4b5fd] bg-[#faf5ff] p-3">
                  <p className="line-clamp-3 border-l-2 border-[#a78bfa] pl-2 text-xs italic text-muted">“{draft.text}”</p>
                  <textarea autoFocus value={draft.comment} onChange={(e) => setDraft({ ...draft, comment: e.target.value })} rows={3} placeholder="Your comment for the student" aria-label="Comment" className="mt-2 w-full rounded-md border border-[#c8c6c4] p-2 text-sm outline-none focus:border-[#7c3aed]" />
                  <textarea value={draft.suggestion} onChange={(e) => setDraft({ ...draft, suggestion: e.target.value })} rows={2} placeholder="Suggested replacement text (optional)" aria-label="Suggested edit" className="mt-1.5 w-full rounded-md border border-[#c8c6c4] p-2 text-sm outline-none focus:border-[#7c3aed]" />
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" onClick={() => setDraft(null)} className="rounded-md px-3 py-1.5 text-sm text-ink hover:bg-white">Cancel</button>
                    <button type="button" disabled={busy || !draft.comment.trim()} onClick={() => void saveComment()} className="rounded-md bg-[#7c3aed] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Save comment</button>
                  </div>
                </div>
              )}

              <div>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Comments ({request.comments.length})</h2>
                {request.comments.length === 0 && <p className="text-sm text-muted">No comments yet.</p>}
                <div className="space-y-2">
                  {request.comments.map((c) => (
                    <div key={c.id} className={`rounded-xl border p-3 ${c.id === activeId ? 'border-[#7c3aed]' : 'border-rule'} bg-white`}>
                      <button type="button" onClick={() => jumpTo(c)} className="block w-full text-left">
                        <p className="line-clamp-2 border-l-2 border-[#c4b5fd] pl-2 text-xs italic text-muted">“{c.anchor_text}”</p>
                        <p className="mt-1.5 whitespace-pre-line text-sm text-ink">{c.comment}</p>
                      </button>
                      {c.suggestion && <p className="mt-1.5 flex gap-1 rounded bg-green-50 px-2 py-1 text-sm text-[var(--success-ink)]"><CornerDownRight size={14} className="mt-0.5 shrink-0" /> {c.suggestion}</p>}
                      {editable && <button type="button" onClick={() => void removeComment(c)} className="mt-2 inline-flex items-center gap-1 text-xs text-red-700 hover:underline"><Trash2 size={12} /> Delete</button>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-rule bg-white p-3">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Checklist</h2>
                <div className="space-y-2">
                  {request.rubric.map((r) => (
                    <div key={r.key} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-ink">{r.label}</span>
                      <span className="flex gap-1" role="radiogroup" aria-label={r.label}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button key={n} type="button" role="radio" aria-checked={scores[r.key] === n} disabled={!editable} onClick={() => setScores((s) => ({ ...s, [r.key]: n }))}
                            className={`h-7 w-7 rounded-md text-xs font-semibold ${scores[r.key] === n ? 'bg-[#7c3aed] text-white' : 'bg-[#f3f2f1] text-ink hover:bg-[#e9d5ff]'} disabled:cursor-default`}>
                            {n}
                          </button>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
                <label className="mt-3 block text-sm">
                  <span className="mb-1 block font-semibold text-ink">Overall feedback</span>
                  <textarea value={summary} onChange={(e) => setSummary(e.target.value)} readOnly={!editable} rows={6} placeholder="Strengths, the most important changes to make, and what to check before submitting." className="w-full rounded-md border border-[#c8c6c4] p-2 text-sm outline-none focus:border-[#7c3aed]" />
                </label>
                {editable && (
                  <div className="mt-3 flex flex-wrap justify-between gap-2">
                    <button type="button" onClick={() => void releaseIt()} className="rounded-md px-3 py-2 text-sm text-muted hover:bg-[#f3f2f1]">Give back to queue</button>
                    <button type="button" disabled={busy} onClick={() => void submit()} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">Return to student</button>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </>
      )}
    </AppShell>
  );
}
