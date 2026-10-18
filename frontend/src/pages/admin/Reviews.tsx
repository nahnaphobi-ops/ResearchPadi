import { useCallback, useEffect, useState, type FormEvent } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { apiErrorMessage } from '../../utils/apiError';
import ReviewerApplications from '../../components/admin/ReviewerApplications';
import { reviewService, adminReviewService, SOURCE_LABEL, STATUS_LABEL, type AdminReviewer, type AdminReviewRow, type Specialty } from '../../services/reviewService';

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—');

/** Admin: every review request, reviewer assignment, refunds, and the reviewer roster. */
export default function AdminReviews() {
  const [status, setStatus] = useState('');
  const [requests, setRequests] = useState<AdminReviewRow[]>([]);
  const [reviewers, setReviewers] = useState<AdminReviewer[]>([]);
  const [share, setShare] = useState(0.65);
  const [specialtyList, setSpecialtyList] = useState<Specialty[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ phone: '', displayName: '', bio: '' });

  const load = useCallback(async (s: string) => {
    try {
      const res = await adminReviewService.list(s || undefined);
      setRequests(res.data.requests);
      setReviewers(res.data.reviewers);
      setShare(res.data.reviewerShare);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load reviews'));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => { if (!cancelled) await load(status); })();
    return () => { cancelled = true; };
  }, [status, load]);

  const act = async (fn: () => Promise<unknown>, fallback: string) => {
    setError('');
    try {
      await fn();
      await load(status);
    } catch (err) {
      setError(apiErrorMessage(err, fallback));
    }
  };

  const addReviewer = (e: FormEvent) => {
    e.preventDefault();
    void act(async () => {
      await adminReviewService.addReviewer({ phone: form.phone, displayName: form.displayName, bio: form.bio || undefined });
      setForm({ phone: '', displayName: '', bio: '' });
    }, 'Could not add the reviewer');
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await reviewService.pricing();
        if (!cancelled) setSpecialtyList(res.data.specialties);
      } catch {
        // The roster still works without the labels.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const specialtyName = (key: string) => specialtyList.find((s) => s.key === key)?.label ?? key;
  const toggleSpecialty = (v: AdminReviewer, key: string) => {
    const next = v.specialties.includes(key) ? v.specialties.filter((k) => k !== key) : [...v.specialties, key];
    void act(() => adminReviewService.setSpecialties(v.user_id, next), 'Could not update specialties');
  };

  const nameOf = (id: string | null) => reviewers.find((r) => r.user_id === id)?.display_name ?? '—';
  const earned = (id: string) => requests.filter((r) => r.reviewer_id === id && r.status === 'returned').reduce((sum, r) => sum + Number(r.price_ghs) * share, 0);

  return (
    <AdminLayout>
      <p className="eyebrow mb-2">Admin</p>
      <h1 className="text-2xl font-bold mb-6 text-navy">Expert reviews</h1>
      {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}

      <ReviewerApplications onChanged={() => void load(status)} />

      <h2 className="mb-3 text-xl font-bold text-navy">Requests</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        {['', 'pending', 'in_review', 'returned', 'cancelled'].map((s) => (
          <button key={s || 'all'} type="button" onClick={() => setStatus(s)} className={`rounded-full px-3 py-1.5 text-sm ${status === s ? 'bg-brand text-white' : 'bg-white border border-rule text-ink'}`}>
            {s ? STATUS_LABEL[s as keyof typeof STATUS_LABEL] : 'All'}
          </button>
        ))}
      </div>

      <div className="mb-10 overflow-x-auto rounded-2xl border border-rule bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[#faf9f8] text-left text-xs uppercase tracking-wide text-muted">
            <tr><th className="p-3">Document</th><th className="p-3">Status</th><th className="p-3">Price</th><th className="p-3">Reviewer</th><th className="p-3">Requested</th><th className="p-3">Due</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {requests.length === 0 && <tr><td colSpan={7} className="p-4 text-muted">No requests.</td></tr>}
            {requests.map((r) => {
              const open = r.status === 'pending' || r.status === 'in_review';
              return (
                <tr key={r.id} className="border-t border-rule">
                  <td className="p-3"><p className="font-medium text-ink">{r.title}</p><p className="text-xs text-muted">{SOURCE_LABEL[r.source_type]}{r.specialty ? ` · needs ${specialtyName(r.specialty)}` : ''} · {r.scope === 'full' ? 'whole' : 'part'} · {r.word_count.toLocaleString()} words</p></td>
                  <td className="p-3">{STATUS_LABEL[r.status]}</td>
                  <td className="p-3">GHS {Number(r.price_ghs).toFixed(2)}</td>
                  <td className="p-3">
                    {open ? (
                      <select value={r.reviewer_id ?? ''} onChange={(e) => void act(() => adminReviewService.assign(r.id, e.target.value || null), 'Could not assign')} aria-label="Reviewer" className="rounded border border-rule px-2 py-1">
                        <option value="">Unassigned</option>
                        {reviewers.filter((v) => v.active && (!r.specialty || v.specialties.includes(r.specialty))).map((v) => <option key={v.user_id} value={v.user_id}>{v.display_name}</option>)}
                      </select>
                    ) : nameOf(r.reviewer_id)}
                  </td>
                  <td className="p-3 text-muted">{fmt(r.created_at)}</td>
                  <td className={`p-3 ${r.due_at && r.status === 'in_review' && new Date(r.due_at) < new Date() ? 'font-semibold text-red-700' : 'text-muted'}`}>{r.status === 'in_review' ? fmt(r.due_at) : '—'}</td>
                  <td className="p-3">
                    {open && <button type="button" onClick={() => { if (window.confirm('Cancel and refund the student in full?')) void act(() => adminReviewService.cancel(r.id), 'Could not cancel'); }} className="text-sm text-red-700 hover:underline">Cancel & refund</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 text-xl font-bold text-navy">Reviewers</h2>
      <form onSubmit={addReviewer} className="mb-4 grid gap-2 rounded-2xl border border-rule bg-white p-4 sm:grid-cols-[1fr_1fr_2fr_auto]">
        <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone (must have signed up)" aria-label="Reviewer phone" className="rounded border border-rule px-3 py-2 text-sm" />
        <input required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="Name students see, e.g. Dr. A. Mensah" aria-label="Display name" className="rounded border border-rule px-3 py-2 text-sm" />
        <input value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Short bio (optional)" aria-label="Bio" className="rounded border border-rule px-3 py-2 text-sm" />
        <button type="submit" className="btn-primary px-4 py-2 text-sm">Add reviewer</button>
      </form>
      <div className="overflow-x-auto rounded-2xl border border-rule bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[#faf9f8] text-left text-xs uppercase tracking-wide text-muted">
            <tr><th className="p-3">Name</th><th className="p-3">Phone</th><th className="p-3">Areas</th><th className="p-3">Earned (returned)</th><th className="p-3">Status</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {reviewers.length === 0 && <tr><td colSpan={6} className="p-4 text-muted">No reviewers yet.</td></tr>}
            {reviewers.map((v) => (
              <tr key={v.user_id} className="border-t border-rule">
                <td className="p-3"><p className="font-medium text-ink">{v.display_name}</p>{v.bio && <p className="text-xs text-muted">{v.bio}</p>}{v.qualification && <p className="text-xs text-muted">{v.qualification}{v.institution ? `, ${v.institution}` : ''}</p>}{v.vetted_at && <p className="text-xs text-muted">Vetted {fmt(v.vetted_at)}{v.vetting_notes ? ` · ${v.vetting_notes}` : ''}</p>}</td>
                <td className="p-3 text-muted">{v.users?.phone ?? '—'}</td>
                <td className="p-3">
                  {editing === v.user_id ? (
                    <div className="flex max-w-xs flex-wrap gap-1.5">
                      {specialtyList.map((sp) => (
                        <label key={sp.key} className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-xs ${v.specialties.includes(sp.key) ? 'border-brand bg-brand-soft font-semibold text-navy' : 'border-rule text-ink'}`}>
                          <input type="checkbox" className="sr-only" checked={v.specialties.includes(sp.key)} onChange={() => toggleSpecialty(v, sp.key)} />
                          {sp.label}
                        </label>
                      ))}
                      <button type="button" onClick={() => setEditing(null)} className="text-xs text-brand hover:underline">Done</button>
                    </div>
                  ) : (
                    <>
                      <span className="text-xs text-ink">{v.specialties.length ? v.specialties.map(specialtyName).join(', ') : 'None (general requests only)'}</span>
                      <button type="button" onClick={() => setEditing(v.user_id)} className="ml-2 text-xs text-brand hover:underline">Edit</button>
                    </>
                  )}
                </td>
                <td className="p-3">GHS {earned(v.user_id).toFixed(2)}</td>
                <td className="p-3">{v.active ? 'Active' : 'Inactive'}</td>
                <td className="p-3"><button type="button" onClick={() => void act(() => adminReviewService.setReviewerActive(v.user_id, !v.active), 'Could not update')} className="text-sm text-brand hover:underline">{v.active ? 'Deactivate' : 'Activate'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
