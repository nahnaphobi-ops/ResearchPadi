import { useCallback, useEffect, useState } from 'react';
import { apiErrorMessage } from '../../utils/apiError';
import { adminApplicationService, type AdminApplication, type Specialty } from '../../services/reviewService';

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—');

/** Admin: vet reviewer applications. Approving creates the reviewer and records who vetted them and when. */
export default function ReviewerApplications({ onChanged }: { onChanged: () => void }) {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [areas, setAreas] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (s: string) => {
    try {
      const res = await adminApplicationService.list(s);
      setApplications(res.data.applications);
      setSpecialties(res.data.specialties);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load applications'));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => { if (!cancelled) await load(status); })();
    return () => { cancelled = true; };
  }, [status, load]);

  const label = (key: string) => specialties.find((s) => s.key === key)?.label ?? key;

  const openReview = (a: AdminApplication) => {
    setOpen(open === a.id ? null : a.id);
    setNotes('');
    setAreas(a.specialties);
    setError('');
  };

  const decide = async (a: AdminApplication, decision: 'approve' | 'reject') => {
    setBusy(true);
    setError('');
    try {
      if (decision === 'approve') await adminApplicationService.approve(a.id, { notes: notes.trim() || undefined, specialties: areas });
      else await adminApplicationService.reject(a.id, notes);
      setOpen(null);
      await load(status);
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the decision'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-10">
      <h2 className="mb-3 text-xl font-bold text-navy">Reviewer applications</h2>
      <div className="mb-3 flex gap-2">
        {(['pending', 'approved', 'rejected'] as const).map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)} className={`rounded-full px-3 py-1.5 text-sm capitalize ${status === s ? 'bg-brand text-white' : 'bg-white border border-rule text-ink'}`}>{s}</button>
        ))}
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
      {applications.length === 0 && <p className="rounded-2xl border border-rule bg-white p-4 text-sm text-muted">No {status} applications.</p>}

      <div className="space-y-3">
        {applications.map((a) => (
          <div key={a.id} className="rounded-2xl border border-rule bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{a.display_name} <span className="font-normal text-muted">· {a.users?.full_name || 'no name on account'} · {a.users?.phone ?? '—'}</span></p>
                <p className="text-sm text-muted">{a.qualification} · {a.institution} · {a.years_experience} yr{a.years_experience === 1 ? '' : 's'}</p>
                <p className="mt-1 flex flex-wrap gap-1.5">
                  {a.specialties.map((k) => <span key={k} className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-navy">{label(k)}</span>)}
                </p>
                <p className="mt-1 text-xs text-muted">Applied {fmt(a.created_at)}{a.decided_at ? ` · decided ${fmt(a.decided_at)}` : ''}</p>
              </div>
              {a.status === 'pending' && (
                <button type="button" onClick={() => openReview(a)} className="btn-primary px-4 py-2 text-sm">{open === a.id ? 'Close' : 'Review'}</button>
              )}
            </div>

            {open === a.id && (
              <div className="mt-4 space-y-3 border-t border-rule pt-4 text-sm">
                {a.bio && <p className="rounded-lg bg-[#faf9f8] p-3 text-ink">{a.bio}</p>}
                {a.profile_url && (
                  <p>Profile: <a href={a.profile_url} target="_blank" rel="noopener noreferrer" className="break-all text-brand hover:underline">{a.profile_url}</a></p>
                )}
                <fieldset>
                  <legend className="mb-1 font-semibold text-ink">Approve for these areas</legend>
                  <div className="flex flex-wrap gap-2">
                    {specialties.map((s) => (
                      <label key={s.key} className={`cursor-pointer rounded-full border px-3 py-1 ${areas.includes(s.key) ? 'border-brand bg-brand-soft font-semibold text-navy' : 'border-rule text-ink'}`}>
                        <input type="checkbox" className="sr-only" checked={areas.includes(s.key)} onChange={() => setAreas((cur) => (cur.includes(s.key) ? cur.filter((k) => k !== s.key) : [...cur, s.key]))} />
                        {s.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="block">
                  <span className="mb-1 block font-semibold text-ink">Vetting notes <span className="font-normal text-muted">(what you checked; a rejection reason is shown to the applicant)</span></span>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={1000} className="w-full rounded-lg border border-rule p-2.5" placeholder="e.g. Confirmed with the college registry on 14 Oct; MPhil certificate seen." />
                </label>
                <div className="flex gap-2">
                  <button type="button" disabled={busy || areas.length === 0} onClick={() => void decide(a, 'approve')} className="btn-primary px-4 py-2 disabled:opacity-50">Approve</button>
                  <button type="button" disabled={busy || notes.trim().length < 10} onClick={() => void decide(a, 'reject')} className="rounded-[10px] border border-red-300 px-4 py-2 text-red-700 hover:bg-red-50 disabled:opacity-50">Reject</button>
                </div>
              </div>
            )}

            {a.status !== 'pending' && a.admin_notes && <p className="mt-3 border-t border-rule pt-3 text-sm text-muted">Notes: {a.admin_notes}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
