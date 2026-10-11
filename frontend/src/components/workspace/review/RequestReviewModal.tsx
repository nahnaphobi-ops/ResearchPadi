import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Editor } from '@tiptap/react';
import { DOMSerializer } from '@tiptap/pm/model';
import { GraduationCap, Lock, X } from 'lucide-react';
import { apiErrorMessage } from '../../../utils/apiError';
import { paymentService } from '../../../services/paymentService';
import { reviewService, type ReviewPricing, type ReviewScope } from '../../../services/reviewService';

interface Props {
  editor: Editor;
  sessionId: string;
  isPremium: boolean;
  /** Save the document first so the reviewer sees the latest version. */
  onBeforeSubmit: () => Promise<void>;
  onClose: () => void;
  onSubmitted: () => void;
}

/** The current selection as HTML (for "review this part only"). */
function selectionHtml(editor: Editor): string {
  const { from, to, empty } = editor.state.selection;
  if (empty) return '';
  const fragment = editor.state.doc.slice(from, to).content;
  const div = document.createElement('div');
  div.appendChild(DOMSerializer.fromSchema(editor.schema).serializeFragment(fragment));
  return div.innerHTML;
}

export default function RequestReviewModal({ editor, sessionId, isPremium, onBeforeSubmit, onClose, onSubmitted }: Props) {
  const navigate = useNavigate();
  const [pricing, setPricing] = useState<ReviewPricing | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [excerpt] = useState(() => selectionHtml(editor));
  const [scope, setScope] = useState<ReviewScope>(() => (selectionHtml(editor) ? 'excerpt' : 'full'));
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isPremium) return;
    let cancelled = false;
    (async () => {
      try {
        const [p, w] = await Promise.all([reviewService.pricing(), paymentService.getWallet()]);
        if (!cancelled) { setPricing(p.data); setBalance(Number(w.data.balance ?? 0)); }
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'Could not load prices'));
      }
    })();
    return () => { cancelled = true; };
  }, [isPremium]);

  const price = pricing ? (scope === 'full' ? pricing.full : pricing.excerpt) : null;
  const short = price !== null && balance !== null && balance < price;

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await onBeforeSubmit();
      await reviewService.create({ sessionId, scope, excerptHtml: scope === 'excerpt' ? excerpt : undefined, notes: notes.trim() || undefined });
      onSubmitted();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not request the review'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4 no-print" role="dialog" aria-modal="true" aria-labelledby="review-title">
      <div className="w-full max-w-md rounded-xl bg-white shadow-[0_16px_40px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between border-b border-[#edebe9] px-5 py-3.5">
          <h2 id="review-title" className="flex items-center gap-2 text-[15px] font-semibold text-[#252423]"><GraduationCap size={18} className="text-[#7c3aed]" /> Request an expert review</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-[#605e5c] hover:bg-[#f3f2f1]"><X size={18} /></button>
        </div>

        {!isPremium ? (
          <div className="px-5 py-5">
            <p className="text-[13px] leading-relaxed text-[#605e5c]">
              A vetted Ghanaian lecturer or postgraduate reads your work and leaves comments, suggested edits and a scored checklist before you submit to your supervisor. Expert reviews are part of Premium.
            </p>
            <button type="button" onClick={() => navigate('/subscribe?plan=premium')} className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[#7c3aed] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[#6d28d9]"><Lock size={14} /> Unlock with Premium</button>
          </div>
        ) : (
          <div className="space-y-4 px-5 py-4">
            <p className="text-[12.5px] leading-relaxed text-[#605e5c]">
              A vetted reviewer reads your work and returns comments, suggested edits and a checklist score{pricing ? ` within ${pricing.turnaroundHours} hours` : ''}. Reviewers give feedback; they do not rewrite your work.
            </p>

            <fieldset className="space-y-2">
              <legend className="mb-1 text-[12px] font-semibold text-[#323130]">What should be reviewed?</legend>
              <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 ${scope === 'full' ? 'border-[#7c3aed] bg-[#faf5ff]' : 'border-[#e1dfdd]'}`}>
                <input type="radio" name="scope" checked={scope === 'full'} onChange={() => setScope('full')} className="mt-0.5" />
                <span className="flex-1 text-[13px] text-[#252423]">Whole document</span>
                {pricing && <span className="text-[13px] font-semibold text-[#252423]">GHS {pricing.full.toFixed(2)}</span>}
              </label>
              <label className={`flex items-start gap-2.5 rounded-lg border p-2.5 ${excerpt ? 'cursor-pointer' : 'opacity-50'} ${scope === 'excerpt' ? 'border-[#7c3aed] bg-[#faf5ff]' : 'border-[#e1dfdd]'}`}>
                <input type="radio" name="scope" disabled={!excerpt} checked={scope === 'excerpt'} onChange={() => setScope('excerpt')} className="mt-0.5" />
                <span className="flex-1 text-[13px] text-[#252423]">
                  Selected part only (e.g. one chapter)
                  {!excerpt && <span className="block text-[11.5px] text-[#8a8886]">Select a chapter in the document first.</span>}
                </span>
                {pricing && <span className="text-[13px] font-semibold text-[#252423]">GHS {pricing.excerpt.toFixed(2)}</span>}
              </label>
            </fieldset>

            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-[#323130]">Notes for the reviewer <span className="font-normal text-[#8a8886]">(optional)</span></span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} placeholder="e.g. My supervisor said chapter 2 lacks Ghanaian sources. Please check the methodology too." className="w-full resize-y rounded-md border border-[#c8c6c4] px-2.5 py-2 text-[12.5px] outline-none focus:border-[#7c3aed]" />
            </label>

            {balance !== null && (
              <p className={`text-[12px] ${short ? 'text-[#a4262c]' : 'text-[#605e5c]'}`}>
                Wallet balance: GHS {balance.toFixed(2)}{short && ' — not enough for this review.'}
              </p>
            )}
            {error && <p role="alert" className="text-[12px] text-[#a4262c]">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              {short ? (
                <button type="button" onClick={() => navigate('/wallet')} className="rounded-md bg-[#7c3aed] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#6d28d9]">Top up wallet</button>
              ) : (
                <>
                  <button type="button" onClick={onClose} className="rounded-md px-3.5 py-2 text-[13px] text-[#323130] hover:bg-[#f3f2f1]">Cancel</button>
                  <button type="button" disabled={submitting || !pricing} onClick={() => void submit()} className="rounded-md bg-[#7c3aed] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#6d28d9] disabled:opacity-50">
                    {submitting ? 'Sending…' : price !== null ? `Pay GHS ${price.toFixed(2)} & request` : 'Request review'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
