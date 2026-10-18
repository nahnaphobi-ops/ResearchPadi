import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, GraduationCap } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import { apiErrorMessage, apiErrorStatus } from '../utils/apiError';
import { reviewDeskService, SOURCE_LABEL, type DeskItem } from '../services/reviewService';

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');

/** Reviewers: pick up open requests and continue the ones they are working on. */
export default function ReviewDesk() {
  const navigate = useNavigate();
  const [data, setData] = useState<{ open: DeskItem[]; mine: DeskItem[] } | null>(null);
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [claiming, setClaiming] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await reviewDeskService.queue();
      setData(res.data);
    } catch (err) {
      if (apiErrorStatus(err) === 403) setForbidden(true);
      else setError(apiErrorMessage(err, 'Could not load the review desk'));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => { if (!cancelled) await load(); })();
    return () => { cancelled = true; };
  }, [load]);

  const claim = async (item: DeskItem) => {
    setClaiming(item.id);
    setError('');
    try {
      await reviewDeskService.claim(item.id);
      navigate(`/review-desk/${item.id}`);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not claim that request'));
      await load();
    } finally {
      setClaiming('');
    }
  };

  if (forbidden) {
    return (
      <AppShell>
        <h1 className="text-2xl font-bold text-navy">Review desk</h1>
        <p className="mt-2 text-muted">The review desk is for approved reviewers. If you'd like to review for ResearchPadi, <Link to="/become-a-reviewer" className="font-semibold text-brand hover:underline">apply to become a reviewer</Link>.</p>
      </AppShell>
    );
  }

  return (
    <AppShell wide>
      <p className="eyebrow mb-2">Reviewer</p>
      <h1 className="text-3xl font-bold mb-2 text-navy">Review desk</h1>
      <p className="text-muted mb-8 max-w-2xl">
        Comment and suggest; don't rewrite the student's work. You never see who the student is. Everything you open is logged.
      </p>
      {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
      {!data && !error && <p className="text-muted">Loading…</p>}

      {data && (
        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-ink">Open requests ({data.open.length})</h2>
            {data.open.length === 0 && <p className="text-sm text-muted">Nothing waiting right now.</p>}
            <div className="space-y-3">
              {data.open.map((r) => (
                <div key={r.id} className="rounded-2xl border border-rule bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{r.title}</p>
                      <p className="text-sm text-muted">
                        {SOURCE_LABEL[r.source_type]} · {r.scope === 'full' ? 'whole' : 'selected part'} · {r.word_count.toLocaleString()} words
                        {r.programme ? ` · ${r.programme}` : ''}{r.institution_type ? ` (${r.institution_type})` : ''}
                      </p>
                      <p className="text-xs text-muted">Requested {fmt(r.created_at)}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-[var(--success-ink)]">You earn GHS {r.reviewer_pay_ghs.toFixed(2)}</span>
                  </div>
                  {r.notes && <p className="mt-2 rounded-lg bg-[#faf9f8] p-2.5 text-sm text-ink">“{r.notes}”</p>}
                  <button type="button" disabled={claiming === r.id} onClick={() => void claim(r)} className="btn-primary mt-3 px-4 py-2 text-sm disabled:opacity-50">
                    {claiming === r.id ? 'Claiming…' : 'Claim & start'}
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-ink">My reviews</h2>
            {data.mine.length === 0 && <p className="text-sm text-muted">You haven't taken any requests yet.</p>}
            <div className="space-y-3">
              {data.mine.map((r) => (
                <Link key={r.id} to={`/review-desk/${r.id}`} className="block rounded-2xl border border-rule bg-white p-4 hover:border-brand">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-semibold text-ink">{r.title}</p>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.status === 'returned' ? 'bg-green-50 text-[var(--success-ink)]' : 'bg-brand-soft text-brand'}`}>
                      {r.status === 'returned' ? 'Returned' : 'In review'}
                    </span>
                  </div>
                  <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted">
                    {r.status === 'returned' ? <GraduationCap size={14} /> : <Clock size={14} />}
                    {r.status === 'returned' ? `Returned ${fmt(r.returned_at)}` : `Due ${fmt(r.due_at)}`} · GHS {r.reviewer_pay_ghs.toFixed(2)}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
