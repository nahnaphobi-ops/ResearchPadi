import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Clock, FileText, GraduationCap } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import { apiErrorMessage } from '../utils/apiError';
import { reviewService, STATUS_LABEL, type ReviewSummary } from '../services/reviewService';

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '');

/** All of a student's expert review requests, with a link back into each document. */
export default function Reviews() {
  const [requests, setRequests] = useState<ReviewSummary[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await reviewService.listMine();
        if (!cancelled) setRequests(res.data.requests);
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'Could not load your reviews'));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <AppShell>
      <p className="eyebrow mb-2">Premium</p>
      <h1 className="text-3xl font-bold mb-2 text-navy">Expert reviews</h1>
      <p className="text-muted mb-8 max-w-2xl">
        A vetted Ghanaian lecturer or postgraduate reads your work and returns comments, suggested edits and a scored checklist before you submit to your supervisor.
        Request one from any document: <span className="font-medium text-ink">Review › Request Review</span> in the workspace.
      </p>

      {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
      {requests === null && !error && <p className="text-muted">Loading…</p>}
      {requests?.length === 0 && (
        <div className="rounded-2xl border border-rule bg-white p-8 text-center">
          <GraduationCap className="mx-auto mb-3 text-brand" size={32} />
          <p className="font-semibold text-ink">No reviews yet</p>
          <p className="mt-1 text-sm text-muted">Open a document in the workspace and choose Request Review.</p>
          <Link to="/workspace" className="btn-primary mt-4 inline-block px-4 py-2 text-sm">Go to workspace</Link>
        </div>
      )}

      <div className="space-y-3">
        {requests?.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-rule bg-white p-5">
            <FileText className="shrink-0 text-muted" size={22} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink">{r.title}</p>
              <p className="text-sm text-muted">
                {r.scope === 'full' ? 'Whole document' : 'Selected part'} · {r.word_count.toLocaleString()} words · GHS {Number(r.price_ghs).toFixed(2)} · requested {fmt(r.created_at)}
              </p>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${r.status === 'returned' ? 'bg-green-50 text-[var(--success-ink)]' : r.status === 'cancelled' ? 'bg-[#f3f2f1] text-muted' : 'bg-brand-soft text-brand'}`}>
              {r.status === 'returned' ? <Check size={13} /> : <Clock size={13} />} {STATUS_LABEL[r.status]}
            </span>
            {r.session_id && (
              <Link to={`/workspace/${r.session_id}?panel=feedback`} className="text-sm font-semibold text-brand hover:underline">
                {r.status === 'returned' ? 'Open feedback' : 'Open document'}
              </Link>
            )}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
