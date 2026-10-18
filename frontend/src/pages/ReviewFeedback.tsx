import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EditorContent, useEditor } from '@tiptap/react';
import { ArrowLeft, Check, Clock, Copy, CornerDownRight, X } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import { workspaceExtensions } from '../components/workspace/editorSetup';
import { locateAnchor, showReviewMarks } from '../components/workspace/review/reviewMarks';
import { apiErrorMessage } from '../utils/apiError';
import { reviewService, SOURCE_LABEL, STATUS_LABEL, type ReviewComment, type ReviewDetail } from '../services/reviewService';

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');

/**
 * A returned review of a paper or care study: the text the reviewer read, their
 * comments anchored to it, the checklist scores and overall feedback. (Reviews
 * of workspace documents are read inside the document itself.)
 */
export default function ReviewFeedback() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const editor = useEditor({
    extensions: workspaceExtensions({ placeholder: '' }),
    editable: false,
    content: '',
    editorProps: { attributes: { class: 'focus:outline-none' } },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await reviewService.getMine(id);
        if (!cancelled) setDetail(res.data.request);
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'Could not load this review'));
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (editor && detail?.content_snapshot) editor.commands.setContent(detail.content_snapshot);
  }, [editor, detail?.id, detail?.content_snapshot]);

  useEffect(() => {
    if (!editor || !detail) return;
    showReviewMarks(editor, detail.comments.filter((c) => c.status === 'open'), activeId);
  }, [editor, detail, activeId]);

  const jumpTo = useCallback((c: ReviewComment) => {
    if (!editor) return;
    setActiveId(c.id);
    const range = locateAnchor(editor, c);
    if (range) editor.chain().setTextSelection(range).scrollIntoView().run();
  }, [editor]);

  const setStatus = async (c: ReviewComment, status: ReviewComment['status']) => {
    if (!detail) return;
    try {
      await reviewService.setCommentStatus(detail.id, c.id, status);
      setDetail({ ...detail, comments: detail.comments.map((x) => (x.id === c.id ? { ...x, status } : x)) });
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update the comment'));
    }
  };

  const copy = async (c: ReviewComment) => {
    if (!c.suggestion) return;
    try {
      await navigator.clipboard.writeText(c.suggestion);
      setCopied(c.id);
      setTimeout(() => setCopied((x) => (x === c.id ? null : x)), 2000);
    } catch {
      setError('Could not copy. Select the suggestion and copy it by hand.');
    }
  };

  const cancel = async () => {
    if (!detail || !window.confirm('Cancel this review request? You will get a full refund to your wallet.')) return;
    try {
      await reviewService.cancel(detail.id);
      navigate('/reviews');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not cancel'));
    }
  };

  if (error && !detail) {
    return (
      <AppShell>
        <Link to="/reviews" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={14} /> Reviews</Link>
        <p className="mt-4 text-red-700">{error}</p>
      </AppShell>
    );
  }

  const open = detail?.comments.filter((c) => c.status === 'open') ?? [];
  const done = detail?.comments.filter((c) => c.status !== 'open') ?? [];

  return (
    <AppShell wide>
      <Link to="/reviews" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={14} /> Reviews</Link>
      {!detail ? <p className="mt-4 text-muted">Loading…</p> : (
        <>
          <div className="mt-3 mb-5">
            <p className="eyebrow mb-1">{SOURCE_LABEL[detail.source_type]} review</p>
            <h1 className="text-2xl font-bold text-navy">{detail.title}</h1>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted">
              {detail.status === 'returned' ? <Check size={14} className="text-green-700" /> : <Clock size={14} />}
              {detail.reviewer_name && detail.status === 'returned' ? `Reviewed by ${detail.reviewer_name} · ${fmt(detail.returned_at)}` : STATUS_LABEL[detail.status]}
              {detail.status === 'in_review' && detail.due_at ? ` · due ${fmt(detail.due_at)}` : ''}
            </p>
          </div>

          {detail.status === 'pending' && (
            <div className="mb-5 rounded-[14px] border border-rule bg-white p-4 text-sm text-ink">
              A reviewer will pick this up soon. Until a reviewer starts, you can cancel for a full refund.
              <button type="button" onClick={() => void cancel()} className="ml-3 text-red-700 hover:underline">Cancel &amp; refund</button>
            </div>
          )}
          {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0 rounded-xl border border-[#d2d0ce] bg-white px-6 py-8 sm:px-12">
              {detail.content_snapshot ? <EditorContent editor={editor} className="word-doc" /> : <p className="text-muted">This review is shown inside its document.</p>}
            </div>

            <aside className="space-y-4">
              {detail.status !== 'returned' && <p className="text-sm text-muted">The feedback will appear here when the reviewer returns it.</p>}

              {detail.summary && (
                <div className="rounded-xl border border-rule bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand">Overall feedback</p>
                  <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink">{detail.summary}</p>
                </div>
              )}

              {detail.scores && (
                <div className="space-y-1.5 rounded-xl border border-rule bg-white p-4">
                  {detail.rubric.map((r) => (
                    <div key={r.key} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-ink">{r.label}</span>
                      <span className="flex gap-0.5" aria-label={`${detail.scores?.[r.key] ?? 0} out of 5`}>
                        {[1, 2, 3, 4, 5].map((n) => <span key={n} className={`h-2 w-5 rounded-sm ${n <= (detail.scores?.[r.key] ?? 0) ? 'bg-brand' : 'bg-brand-soft'}`} />)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {detail.status === 'returned' && (
                <div>
                  <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Comments ({open.length} open)</h2>
                  <div className="space-y-2">
                    {open.map((c) => (
                      <div key={c.id} className={`rounded-xl border bg-white p-3 ${c.id === activeId ? 'border-brand' : 'border-rule'}`}>
                        <button type="button" onClick={() => jumpTo(c)} className="block w-full text-left">
                          <p className="line-clamp-2 border-l-2 border-brand/40 pl-2 text-xs italic text-muted">“{c.anchor_text}”</p>
                          <p className="mt-1.5 whitespace-pre-line text-sm text-ink">{c.comment}</p>
                        </button>
                        {c.suggestion && <p className="mt-1.5 flex gap-1 rounded bg-green-50 px-2 py-1 text-sm text-[var(--success-ink)]"><CornerDownRight size={14} className="mt-0.5 shrink-0" /> {c.suggestion}</p>}
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          {c.suggestion && (
                            <button type="button" onClick={() => void copy(c)} className="inline-flex items-center gap-1 rounded-md bg-brand px-2 py-1 font-semibold text-white">
                              <Copy size={12} /> {copied === c.id ? 'Copied' : 'Copy suggestion'}
                            </button>
                          )}
                          <button type="button" onClick={() => void setStatus(c, c.suggestion ? 'dismissed' : 'accepted')} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-ink hover:bg-navy-mist">
                            <X size={12} /> {c.suggestion ? 'Dismiss' : 'Mark done'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {done.length > 0 && (
                    <details className="mt-3 text-sm text-muted">
                      <summary className="cursor-pointer">Resolved ({done.length})</summary>
                      <div className="mt-2 space-y-2">
                        {done.map((c) => (
                          <div key={c.id} className="rounded-xl border border-rule bg-white p-3">
                            <p className="line-clamp-2 border-l-2 border-brand/40 pl-2 text-xs italic">“{c.anchor_text}”</p>
                            <p className="mt-1 whitespace-pre-line text-sm text-ink">{c.comment}</p>
                            <button type="button" onClick={() => void setStatus(c, 'open')} className="mt-1 text-xs text-brand hover:underline">Reopen</button>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </AppShell>
  );
}
