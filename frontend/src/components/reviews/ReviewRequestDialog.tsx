import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, X } from 'lucide-react';
import { apiErrorMessage } from '../../utils/apiError';
import { paymentService } from '../../services/paymentService';
import { reviewService, type ReviewPart, type ReviewPricing, type ReviewScope, type ReviewSourceType } from '../../services/reviewService';

interface Props {
  sourceType: Exclude<ReviewSourceType, 'workspace'>;
  sourceId: string;
  /** A research project is a care_study source with its own wording. */
  researchProject?: boolean;
  /** Run before sending, e.g. save unsaved notes so the reviewer sees the latest version. */
  onBeforeSubmit?: () => Promise<boolean>;
  onClose: () => void;
  /** Called with the new request's id after a successful, paid request. */
  onSubmitted: (requestId: string) => void;
}

const COPY: Record<Props['sourceType'], { whole: string; part: string; partNoun: string; intro: string }> = {
  paper: {
    whole: 'The whole paper',
    part: 'One chapter',
    partNoun: 'chapter',
    intro: 'A vetted Ghanaian lecturer or postgraduate reads your paper and returns comments, suggested edits and a scored checklist before you submit to your supervisor.',
  },
  care_study: {
    whole: 'The whole care study',
    part: 'One section',
    partNoun: 'section',
    intro: 'A reviewer vetted in your field (midwifery or general nursing) reads your notes beside the draft and checks the nursing process, care plans and consistency. They give feedback; they do not rewrite your work or replace your supervisor.',
  },
};

const RESEARCH_COPY = {
  whole: 'The whole research project',
  part: 'One section',
  partNoun: 'section',
  intro: 'A reviewer vetted in research methods reads your notes beside the draft and checks your objectives, methodology, ethics and consistency. They give feedback; they do not rewrite your work or replace your supervisor.',
};

/** Ask for a human review of a generated paper, care study or research project, paid from the wallet. */
export default function ReviewRequestDialog({ sourceType, sourceId, researchProject, onBeforeSubmit, onClose, onSubmitted }: Props) {
  const navigate = useNavigate();
  const copy = researchProject ? RESEARCH_COPY : COPY[sourceType];
  const [pricing, setPricing] = useState<ReviewPricing | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [parts, setParts] = useState<ReviewPart[]>([]);
  const [scope, setScope] = useState<ReviewScope>('full');
  const [part, setPart] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, w, options] = await Promise.all([
          reviewService.pricing(),
          paymentService.getWallet(),
          reviewService.sourceOptions(sourceType, sourceId),
        ]);
        if (cancelled) return;
        setPricing(p.data);
        setBalance(Number(w.data.balance ?? 0));
        setParts(options.data.parts);
        setPart(options.data.parts[0]?.key ?? '');
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'Could not load the review options'));
      }
    })();
    return () => { cancelled = true; };
  }, [sourceType, sourceId]);

  const price = pricing ? (scope === 'full' ? pricing.full : pricing.excerpt) : null;
  const short = price !== null && balance !== null && balance < price;

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      if (onBeforeSubmit && !(await onBeforeSubmit())) return;
      const res = await reviewService.create({
        sourceType,
        sourceId,
        scope,
        part: scope === 'excerpt' ? part : undefined,
        notes: notes.trim() || undefined,
      });
      onSubmitted(res.data.request.id);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not request the review'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-labelledby="review-dialog-title">
      <div className="w-full max-w-md rounded-[14px] bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-rule px-5 py-3.5">
          <h2 id="review-dialog-title" className="flex items-center gap-2 font-bold text-navy"><GraduationCap size={18} className="text-brand" /> Request a supervisor review</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-muted hover:bg-navy-mist"><X size={18} /></button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <p className="text-sm leading-relaxed text-muted">
            {copy.intro}{pricing ? ` Feedback within ${pricing.turnaroundHours} hours.` : ''}
          </p>

          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-semibold text-ink">What should be reviewed?</legend>
            <label className={`flex cursor-pointer items-start gap-2.5 rounded-[10px] border p-3 ${scope === 'full' ? 'border-brand bg-brand-soft/40' : 'border-rule'}`}>
              <input type="radio" name="scope" checked={scope === 'full'} onChange={() => setScope('full')} className="mt-1 accent-brand" />
              <span className="flex-1 text-sm text-ink">{copy.whole}</span>
              {pricing && <span className="text-sm font-semibold text-ink">GHS {pricing.full.toFixed(2)}</span>}
            </label>
            <label className={`flex items-start gap-2.5 rounded-[10px] border p-3 ${parts.length ? 'cursor-pointer' : 'opacity-50'} ${scope === 'excerpt' ? 'border-brand bg-brand-soft/40' : 'border-rule'}`}>
              <input type="radio" name="scope" disabled={!parts.length} checked={scope === 'excerpt'} onChange={() => setScope('excerpt')} className="mt-1 accent-brand" />
              <span className="flex-1 text-sm text-ink">
                {copy.part}
                {scope === 'excerpt' && parts.length > 0 && (
                  <select aria-label={`Choose a ${copy.partNoun}`} value={part} onChange={(e) => setPart(e.target.value)} className="mt-1.5 block w-full rounded-lg border border-rule p-2 text-sm">
                    {parts.map((p) => <option key={p.key} value={p.key}>{p.label} ({p.words.toLocaleString()} words)</option>)}
                  </select>
                )}
              </span>
              {pricing && <span className="text-sm font-semibold text-ink">GHS {pricing.excerpt.toFixed(2)}</span>}
            </label>
          </fieldset>

          {sourceType === 'care_study' && (
            <p className="rounded-[10px] bg-navy-mist p-3 text-xs text-ink">
              {researchProject ? 'The reviewer sees your notes and the draft, never your name or phone number.' : 'The reviewer sees your pseudonym, your notes and the draft, never your name or phone number.'} Details like phone numbers and ID numbers are blocked before anything is sent.
            </p>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-ink">Notes for the reviewer <span className="font-normal text-muted">(optional)</span></span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} placeholder="e.g. My supervisor asked me to strengthen the care plans." className="w-full resize-y rounded-[10px] border border-rule p-2.5 text-sm outline-none focus:border-brand" />
          </label>

          {balance !== null && (
            <p className={`text-sm ${short ? 'text-red-700' : 'text-muted'}`}>
              Wallet balance: GHS {balance.toFixed(2)}{short && ' — not enough for this review.'}
            </p>
          )}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            {short ? (
              <button type="button" onClick={() => navigate('/wallet')} className="btn-primary px-4 py-2 text-sm">Top up wallet</button>
            ) : (
              <>
                <button type="button" onClick={onClose} className="rounded-[10px] px-4 py-2 text-sm text-ink hover:bg-navy-mist">Cancel</button>
                <button type="button" disabled={submitting || !pricing || (scope === 'excerpt' && !part)} onClick={() => void submit()} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
                  {submitting ? 'Sending…' : price !== null ? `Pay GHS ${price.toFixed(2)} & request` : 'Request review'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
