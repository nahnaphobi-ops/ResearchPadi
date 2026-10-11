import { useCallback, useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { ArrowLeft, Check, Clock, CornerDownRight, GraduationCap, Loader2, MessageSquare, X } from 'lucide-react';
import { apiErrorMessage } from '../../../utils/apiError';
import {
  reviewService, STATUS_LABEL, type ReviewComment, type ReviewDetail, type ReviewSummary,
} from '../../../services/reviewService';
import { locateAnchor, showReviewMarks } from './reviewMarks';

interface Props {
  editor: Editor | null;
  sessionId: string;
  onRequestReview: () => void;
  /** Bumped by the editor after a new request is sent, to reload the list. */
  refreshKey: number;
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');

/**
 * Expert feedback for this document: request status, the reviewer's summary and
 * scores, and comments anchored to the text — jump to each one and apply or
 * dismiss its suggested edit right in the document.
 */
export default function FeedbackPanel({ editor, sessionId, onRequestReview, refreshKey }: Props) {
  const [list, setList] = useState<ReviewSummary[] | null>(null);
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await reviewService.listMine(sessionId);
        if (!cancelled) setList(res.data.requests);
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'Could not load reviews'));
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId, refreshKey]);

  // Highlight the open review's anchors in the document; clear them when leaving.
  useEffect(() => {
    if (!editor) return;
    const open = detail?.comments.filter((c) => c.status === 'open') ?? [];
    showReviewMarks(editor, open, activeId);
    return () => { if (!editor.isDestroyed) showReviewMarks(editor, []); };
  }, [editor, detail, activeId]);

  const openReview = async (id: string) => {
    setError('');
    try {
      const res = await reviewService.getMine(id);
      setDetail(res.data.request);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load the review'));
    }
  };

  const jumpTo = useCallback((c: ReviewComment) => {
    if (!editor) return;
    setActiveId(c.id);
    const range = locateAnchor(editor, c);
    if (!range) return;
    editor.chain().setTextSelection(range).scrollIntoView().run();
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

  const apply = (c: ReviewComment) => {
    if (!editor || !c.suggestion) return;
    const range = locateAnchor(editor, c);
    if (!range) { setError('That text has changed since the review, so the suggestion can’t be applied automatically.'); return; }
    editor.chain().focus().insertContentAt(range, c.suggestion).run();
    void setStatus(c, 'accepted');
  };

  const cancel = async (r: ReviewSummary) => {
    if (!window.confirm('Cancel this review request? You will get a full refund to your wallet.')) return;
    try {
      await reviewService.cancel(r.id);
      setList((l) => (l ?? []).map((x) => (x.id === r.id ? { ...x, status: 'cancelled' } : x)));
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not cancel'));
    }
  };

  if (detail) {
    const open = detail.comments.filter((c) => c.status === 'open');
    const done = detail.comments.filter((c) => c.status !== 'open');
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-rule px-3 py-2.5">
          <button type="button" onClick={() => { setDetail(null); setActiveId(null); }} className="inline-flex items-center gap-1 text-[12px] text-[#605e5c] hover:text-[#252423]"><ArrowLeft size={13} /> All reviews</button>
          <p className="mt-1 text-[13px] font-semibold text-[#252423]">{detail.title}</p>
          <p className="text-[11.5px] text-[#8a8886]">{detail.reviewer_name ? `Reviewed by ${detail.reviewer_name}` : STATUS_LABEL[detail.status]}{detail.returned_at ? ` · ${fmt(detail.returned_at)}` : ''}</p>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
          {error && <p role="alert" className="text-[12px] text-[#a4262c]">{error}</p>}
          {detail.status !== 'returned' && <p className="text-[12.5px] text-[#605e5c]">The feedback will appear here when the reviewer returns it.</p>}
          {detail.summary && (
            <div className="rounded-lg bg-[#faf5ff] p-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6d28d9]">Overall feedback</p>
              <p className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-[#252423]">{detail.summary}</p>
            </div>
          )}
          {detail.scores && (
            <div className="space-y-1">
              {detail.rubric.map((r) => (
                <div key={r.key} className="flex items-center gap-2 text-[12px]">
                  <span className="w-40 shrink-0 text-[#323130]">{r.label}</span>
                  <span className="flex gap-0.5" aria-label={`${detail.scores?.[r.key] ?? 0} out of 5`}>
                    {[1, 2, 3, 4, 5].map((n) => <span key={n} className={`h-2 w-5 rounded-sm ${n <= (detail.scores?.[r.key] ?? 0) ? 'bg-[#7c3aed]' : 'bg-[#e9d5ff]'}`} />)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {detail.status === 'returned' && (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">Comments ({open.length} open)</p>
          )}
          {open.map((c) => <CommentCard key={c.id} c={c} active={c.id === activeId} onJump={() => jumpTo(c)} onApply={() => apply(c)} onDismiss={() => void setStatus(c, 'dismissed')} />)}
          {done.length > 0 && (
            <details className="text-[12px] text-[#605e5c]">
              <summary className="cursor-pointer">Resolved ({done.length})</summary>
              <div className="mt-2 space-y-2">
                {done.map((c) => <CommentCard key={c.id} c={c} active={false} onJump={() => jumpTo(c)} onReopen={() => void setStatus(c, 'open')} />)}
              </div>
            </details>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-rule px-3 py-3">
        <button type="button" onClick={onRequestReview} className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-[#7c3aed] px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-[#6d28d9]"><GraduationCap size={15} /> Request an expert review</button>
        <p className="mt-1.5 text-[11.5px] text-[#8a8886]">A vetted reviewer comments on your work before your supervisor sees it.</p>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {error && <p role="alert" className="text-[12px] text-[#a4262c]">{error}</p>}
        {list === null && <p className="flex items-center gap-1.5 text-[12px] text-[#8a8886]"><Loader2 size={13} className="animate-spin" /> Loading…</p>}
        {list?.length === 0 && <p className="text-[12.5px] text-[#605e5c]">No reviews for this document yet.</p>}
        {list?.map((r) => (
          <div key={r.id} className="rounded-lg border border-[#e1dfdd] p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-medium text-[#252423]">{r.scope === 'full' ? 'Whole document' : 'Selected part'} · {r.word_count.toLocaleString()} words</p>
                <p className={`mt-0.5 inline-flex items-center gap-1 text-[11.5px] ${r.status === 'returned' ? 'font-semibold text-[#15803d]' : 'text-[#605e5c]'}`}>
                  {r.status === 'returned' ? <Check size={12} /> : <Clock size={12} />} {STATUS_LABEL[r.status]}
                </p>
                <p className="text-[11px] text-[#8a8886]">{r.due_at && r.status === 'in_review' ? `Due ${fmt(r.due_at)}` : `Requested ${fmt(r.created_at)}`}</p>
              </div>
              <span className="shrink-0 text-[11.5px] text-[#605e5c]">GHS {Number(r.price_ghs).toFixed(2)}</span>
            </div>
            <div className="mt-2 flex gap-1.5">
              {r.status === 'returned' && <button type="button" onClick={() => void openReview(r.id)} className="inline-flex items-center gap-1 rounded bg-[#7c3aed] px-2 py-1 text-[11.5px] font-semibold text-white"><MessageSquare size={12} /> Open feedback</button>}
              {r.status === 'pending' && <button type="button" onClick={() => void cancel(r)} className="rounded px-2 py-1 text-[11.5px] text-[#a4262c] hover:bg-[#fde7e9]">Cancel & refund</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommentCard({ c, active, onJump, onApply, onDismiss, onReopen }: {
  c: ReviewComment; active: boolean; onJump: () => void; onApply?: () => void; onDismiss?: () => void; onReopen?: () => void;
}) {
  return (
    <div className={`rounded-lg border p-2.5 ${active ? 'border-[#7c3aed] bg-[#faf5ff]' : 'border-[#e1dfdd] bg-white'}`}>
      <button type="button" onClick={onJump} className="block w-full text-left">
        <p className="line-clamp-2 border-l-2 border-[#c4b5fd] pl-2 text-[11.5px] italic text-[#605e5c]">“{c.anchor_text}”</p>
        <p className="mt-1.5 whitespace-pre-line text-[12.5px] text-[#252423]">{c.comment}</p>
      </button>
      {c.suggestion && (
        <p className="mt-1.5 flex gap-1 rounded bg-[#f0fdf4] px-2 py-1 text-[12px] text-[#166534]"><CornerDownRight size={13} className="mt-0.5 shrink-0" /> {c.suggestion}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {onApply && c.suggestion && <button type="button" onClick={onApply} className="inline-flex items-center gap-1 rounded bg-[#15803d] px-2 py-1 text-[11.5px] font-semibold text-white"><Check size={12} /> Apply suggestion</button>}
        {onDismiss && <button type="button" onClick={onDismiss} className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11.5px] text-[#323130] hover:bg-[#f3f2f1]"><X size={12} /> {c.suggestion ? 'Dismiss' : 'Mark done'}</button>}
        {onReopen && <button type="button" onClick={onReopen} className="rounded px-2 py-1 text-[11.5px] text-[#323130] hover:bg-[#f3f2f1]">Reopen</button>}
      </div>
    </div>
  );
}
