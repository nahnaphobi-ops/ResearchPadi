import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, GraduationCap, XCircle } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import { apiErrorMessage } from '../utils/apiError';
import {
  reviewerApplicationService, type ApplicationForm, type ReviewerApplication, type Specialty,
} from '../services/reviewService';

const empty: ApplicationForm = {
  display_name: '',
  institution: '',
  qualification: '',
  specialties: [],
  years_experience: 0,
  bio: '',
  profile_url: '',
  declaration: false,
};

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '');

/** Nurses, midwives, lecturers and postgraduates apply here; an admin vets the application. */
export default function BecomeReviewer() {
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<ReviewerApplication | null>(null);
  const [isReviewer, setIsReviewer] = useState(false);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [form, setForm] = useState<ApplicationForm>(empty);
  const [reapplying, setReapplying] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await reviewerApplicationService.mine();
        if (cancelled) return;
        setApplication(res.data.application);
        setIsReviewer(res.data.isReviewer);
        setSpecialties(res.data.specialties);
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'Could not load your application'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggle = (key: string) =>
    setForm((f) => ({ ...f, specialties: f.specialties.includes(key) ? f.specialties.filter((k) => k !== key) : [...f.specialties, key] }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      await reviewerApplicationService.apply(form);
      const res = await reviewerApplicationService.mine();
      setApplication(res.data.application);
      setReapplying(false);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not send your application'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSending(false);
    }
  };

  const label = (key: string) => specialties.find((s) => s.key === key)?.label ?? key;
  const showForm = !loading && !isReviewer && (!application || application.status === 'rejected') && (reapplying || !application);

  return (
    <AppShell>
      <Link to="/reviews" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink mb-6"><ArrowLeft size={14} /> Reviews</Link>
      <p className="eyebrow mb-2">Reviewers</p>
      <h1 className="text-3xl font-bold mb-2 text-navy">Become a reviewer</h1>
      <p className="text-muted mb-8 max-w-2xl">
        Nurses, midwives, lecturers and postgraduate researchers can review students' work for ResearchPadi and earn from each review. We check every application before anyone can see a student's work.
      </p>

      {error && <div role="alert" className="mb-6 rounded-[10px] bg-red-100 p-4 text-sm text-red-700">{error}</div>}
      {loading && <p className="text-muted">Loading…</p>}

      {isReviewer && (
        <div className="rounded-[14px] border border-rule bg-white p-6">
          <p className="inline-flex items-center gap-2 font-bold text-navy"><CheckCircle2 className="text-green-700" size={18} /> You're an approved reviewer</p>
          <p className="mt-1 text-sm text-muted">Open the review desk to see requests in your areas.</p>
          <Link to="/review-desk" className="btn-primary mt-4 inline-block px-4 py-2 text-sm">Go to the review desk</Link>
        </div>
      )}

      {!loading && !isReviewer && application?.status === 'approved' && (
        <div className="rounded-[14px] border border-rule bg-white p-6">
          <p className="inline-flex items-center gap-2 font-bold text-navy"><Clock size={18} className="text-brand" /> Your reviewer access is paused</p>
          <p className="mt-1 text-sm text-muted">Your application was approved, but an admin has paused your access to the review desk. Contact hello@researchpadi.com if you think this is a mistake.</p>
        </div>
      )}

      {!loading && !isReviewer && application?.status === 'pending' && (
        <div className="rounded-[14px] border border-rule bg-white p-6">
          <p className="inline-flex items-center gap-2 font-bold text-navy"><Clock size={18} className="text-brand" /> Your application is being checked</p>
          <p className="mt-1 text-sm text-muted">Sent {fmt(application.created_at)}. We'll text you when there's a decision.</p>
          <ApplicationSummary application={application} label={label} />
        </div>
      )}

      {!loading && !isReviewer && application?.status === 'rejected' && !reapplying && (
        <div className="rounded-[14px] border border-rule bg-white p-6">
          <p className="inline-flex items-center gap-2 font-bold text-navy"><XCircle size={18} className="text-red-700" /> Your application wasn't approved</p>
          {application.admin_notes && <p className="mt-2 rounded-lg bg-navy-mist p-3 text-sm text-ink">{application.admin_notes}</p>}
          <button type="button" onClick={() => { setForm({ ...empty, display_name: application.display_name, institution: application.institution, qualification: application.qualification }); setReapplying(true); }} className="btn-primary mt-4 px-4 py-2 text-sm">
            Apply again
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={submit} className="space-y-5 rounded-[14px] border border-rule bg-white p-6 shadow-soft sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="display_name" className="mb-1 block font-bold text-ink">Name students will see</label>
              <input id="display_name" required maxLength={80} className="w-full rounded-[10px] border p-3" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="e.g. Dr. A. Mensah" />
              <p className="mt-1 text-xs text-muted">Students never see your phone number.</p>
            </div>
            <div>
              <label htmlFor="years" className="mb-1 block font-bold text-ink">Years of experience</label>
              <input id="years" type="number" min={0} max={60} required className="w-full rounded-[10px] border p-3" value={form.years_experience} onChange={(e) => setForm({ ...form, years_experience: Number(e.target.value) })} />
            </div>
            <div>
              <label htmlFor="institution" className="mb-1 block font-bold text-ink">Institution or workplace</label>
              <input id="institution" required maxLength={150} className="w-full rounded-[10px] border p-3" value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} placeholder="e.g. Holy Family Nursing and Midwifery Training College" />
            </div>
            <div>
              <label htmlFor="qualification" className="mb-1 block font-bold text-ink">Highest qualification</label>
              <input id="qualification" required maxLength={150} className="w-full rounded-[10px] border p-3" value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} placeholder="e.g. MPhil Midwifery" />
            </div>
          </div>

          <fieldset>
            <legend className="mb-1 font-bold text-ink">What can you review?</legend>
            <p className="mb-2 text-xs text-muted">Choose the areas you are qualified in. Care studies are only sent to reviewers vetted for midwifery or general nursing.</p>
            <div className="flex flex-wrap gap-2">
              {specialties.map((s) => (
                <label key={s.key} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${form.specialties.includes(s.key) ? 'border-brand bg-brand-soft text-navy font-semibold' : 'border-rule text-ink hover:border-brand/50'}`}>
                  <input type="checkbox" className="sr-only" checked={form.specialties.includes(s.key)} onChange={() => toggle(s.key)} />
                  {s.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="bio" className="mb-1 block font-bold text-ink">Short bio <span className="font-normal text-muted">(optional)</span></label>
            <textarea id="bio" rows={3} maxLength={500} className="w-full rounded-[10px] border p-3 text-sm" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="A sentence or two about your teaching or clinical background." />
          </div>

          <div>
            <label htmlFor="profile_url" className="mb-1 block font-bold text-ink">Link to your profile or CV <span className="font-normal text-muted">(optional)</span></label>
            <input id="profile_url" type="url" className="w-full rounded-[10px] border p-3" value={form.profile_url} onChange={(e) => setForm({ ...form, profile_url: e.target.value })} placeholder="https://" />
            <p className="mt-1 text-xs text-muted">A LinkedIn page, your college staff page, or a shared CV. It helps us check your application faster.</p>
          </div>

          <label className="flex gap-3 rounded-[10px] bg-navy-mist p-4 text-sm text-ink">
            <input type="checkbox" required className="mt-1 accent-brand" checked={form.declaration} onChange={(e) => setForm({ ...form, declaration: e.target.checked })} />
            <span>The details above are true. I will keep every student's work confidential and give honest feedback without rewriting their work.</span>
          </label>

          <button disabled={sending || form.specialties.length === 0} className="btn-primary inline-flex items-center gap-2 px-6 py-3 disabled:opacity-50">
            <GraduationCap size={16} /> {sending ? 'Sending…' : 'Send application'}
          </button>
        </form>
      )}
    </AppShell>
  );
}

function ApplicationSummary({ application, label }: { application: ReviewerApplication; label: (key: string) => string }) {
  return (
    <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      <div><dt className="text-muted">Name students see</dt><dd className="font-semibold text-ink">{application.display_name}</dd></div>
      <div><dt className="text-muted">Institution</dt><dd className="font-semibold text-ink">{application.institution}</dd></div>
      <div><dt className="text-muted">Qualification</dt><dd className="font-semibold text-ink">{application.qualification}</dd></div>
      <div><dt className="text-muted">Areas</dt><dd className="font-semibold text-ink">{application.specialties.map(label).join(', ')}</dd></div>
    </dl>
  );
}
