import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { careStudyService } from '../services/careStudyService';
import { paymentService } from '../services/paymentService';
import { useAuthStore } from '../store/useAuthStore';
import { apiErrorMessage } from '../utils/apiError';
import { ArrowLeft, ArrowRight, FlaskConical, ShieldCheck, Stethoscope } from 'lucide-react';
import type { CareStudy, CareStudyTemplate } from '../types/careStudy';

type StudySummary = Pick<CareStudy, 'id' | 'template_id' | 'pseudonym' | 'focus' | 'created_at' | 'updated_at'>;

const kindOf = (t: CareStudyTemplate | undefined) => t?.kind ?? 'care_study';

/**
 * Care studies and research projects share one engine and one set of pages; the
 * address says which one is shown: /care-studies, or /care-studies?kind=research.
 */
export default function CareStudyList() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const research = params.get('kind') === 'research';
  const kind = research ? 'research_project' : 'care_study';
  const noun = research ? 'research project' : 'care study';
  const user = useAuthStore((s) => s.user);
  const [studies, setStudies] = useState<StudySummary[]>([]);
  const [templates, setTemplates] = useState<CareStudyTemplate[]>([]);
  const [price, setPrice] = useState(250);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    template_id: '',
    pseudonym: '',
    focus: '',
    institution_name: user?.institution_name || '',
    supervisor_name: '',
    consent: false,
    declaration: false,
  });

  useEffect(() => {
    Promise.all([careStudyService.list(), careStudyService.templates()])
      .then(([listRes, tplRes]) => {
        const all = tplRes.data.templates;
        const ofKind = all.filter((t) => kindOf(t) === kind);
        setStudies(listRes.data);
        setTemplates(all);
        setPrice(tplRes.data.price);
        setForm((f) => ({ ...f, template_id: ofKind.some((t) => t.id === f.template_id) ? f.template_id : ofKind[0]?.id || '' }));
        setShowForm(!listRes.data.some((s) => kindOf(all.find((t) => t.id === s.template_id)) === kind));
      })
      .catch((err) => setError(apiErrorMessage(err, `Could not load your ${noun}s`)))
      .finally(() => setLoading(false));
    paymentService.getWallet().then((res) => setBalance(res.data.balance ?? 0)).catch(() => setBalance(null));
  }, [kind, noun]);

  const template = templates.find((t) => t.id === form.template_id);
  const shownTemplates = templates.filter((t) => kindOf(t) === kind);
  const shownStudies = studies.filter((s) => kindOf(templates.find((t) => t.id === s.template_id)) === kind);
  const canAfford = balance === null || balance >= price;
  const ready = !!form.template_id && (research ? form.focus.trim() : form.pseudonym.trim()) && form.consent && form.declaration && canAfford;

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const { data } = await careStudyService.create(research ? { ...form, pseudonym: '' } : form);
      navigate(`/care-studies/${data.study.id}`);
    } catch (err) {
      setError(apiErrorMessage(err, `Could not start the ${noun}`));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setCreating(false);
    }
  };

  const templateName = (id: string) => templates.find((t) => t.id === id)?.name ?? (research ? 'Research project' : 'Care study');
  const Icon = research ? FlaskConical : Stethoscope;

  return (
    <AppShell>
      <button onClick={() => navigate('/new-paper')} className="text-sm text-muted hover:text-navy font-medium inline-flex items-center gap-1.5 mb-6">
        <ArrowLeft size={15} /> Back
      </button>
      <p className="eyebrow mb-2">{research ? 'Research project' : 'Care study'}</p>
      <h1 className="text-3xl font-bold mb-2 text-navy">{research ? 'Your research projects' : 'Your care studies'}</h1>
      <p className="mb-6 text-muted">
        {research
          ? 'You enter the details of the study you carried out and the results you found, step by step. ResearchPadi helps you organise them, explains the methods, finds Ghanaian and clinical sources for your literature review and polishes the language. It never makes up results.'
          : 'You enter what you saw and did for your client, step by step. ResearchPadi helps you organise it, explains the theory behind your care, and polishes the language. It never makes up clinical details.'}
      </p>

      {error && <div role="alert" className="p-4 mb-6 bg-red-100 text-red-700 rounded-[10px] text-sm">{error}</div>}

      {loading ? (
        <div className="py-16 text-center text-muted">
          <div className="mx-auto mb-3 w-8 h-8 border-2 border-rule border-t-brand rounded-full animate-spin" />
          Loading...
        </div>
      ) : (
        <>
          {shownStudies.length > 0 && (
            <ul className="space-y-3 mb-8">
              {shownStudies.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => navigate(`/care-studies/${s.id}`)}
                    className="w-full text-left bg-white p-5 rounded-[14px] border border-rule hover:border-brand/50 hover:shadow-card transition flex items-center justify-between gap-4"
                  >
                    <span>
                      <span className="block font-bold text-navy">{research ? s.focus || 'Untitled research project' : `${s.pseudonym}${s.focus ? ` · ${s.focus}` : ''}`}</span>
                      <span className="block text-xs text-muted">{templateName(s.template_id)} · last edited {new Date(s.updated_at).toLocaleDateString()}</span>
                    </span>
                    <ArrowRight size={16} className="text-brand shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!showForm ? (
            <button onClick={() => setShowForm(true)} className="btn-primary px-5 py-3 text-sm inline-flex items-center gap-2">
              <Icon size={16} /> Start a new {noun}
            </button>
          ) : (
            <form onSubmit={handleCreate} className="space-y-6 bg-white p-6 sm:p-8 rounded-[14px] border border-rule shadow-soft">
              <h2 className="text-xl font-bold text-navy">Start a new {noun}</h2>

              <div>
                <label htmlFor="template_id" className="block font-bold mb-1 text-ink">Type of {noun}</label>
                <select id="template_id" className="w-full p-3 border rounded-[10px]" value={form.template_id} onChange={(e) => set({ template_id: e.target.value })}>
                  {shownTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {template && (
                  <>
                    <p className="text-sm text-muted mt-2">{template.description}</p>
                    <p className="text-xs text-muted mt-1 italic">{template.notice}</p>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {!research && (
                  <div>
                    <label htmlFor="pseudonym" className="block font-bold mb-1 text-ink">Client's initials or pseudonym</label>
                    <input id="pseudonym" className="w-full p-3 border rounded-[10px]" required value={form.pseudonym} onChange={(e) => set({ pseudonym: e.target.value })} placeholder='e.g. "Madam A.K."' />
                    <p className="text-xs text-muted mt-1">Never your client's full name. Use the same initials or pseudonym all through the study.</p>
                  </div>
                )}
                <div className={research ? 'sm:col-span-2' : ''}>
                  <label htmlFor="focus" className="block font-bold mb-1 text-ink">{template?.focus_label ?? (research ? 'Research topic' : 'Diagnosis')}</label>
                  <input id="focus" className="w-full p-3 border rounded-[10px]" required={research} value={form.focus} onChange={(e) => set({ focus: e.target.value })} maxLength={200} />
                  <p className="text-xs text-muted mt-1">{template?.focus_hint}</p>
                </div>
                <div>
                  <label htmlFor="institution_name" className="block text-muted mb-1 text-sm">Your college</label>
                  <input id="institution_name" className="w-full p-2.5 border rounded-[10px]" value={form.institution_name} onChange={(e) => set({ institution_name: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="supervisor_name" className="block text-muted mb-1 text-sm">Supervisor <span className="text-xs">(optional)</span></label>
                  <input id="supervisor_name" className="w-full p-2.5 border rounded-[10px]" value={form.supervisor_name} onChange={(e) => set({ supervisor_name: e.target.value })} />
                </div>
              </div>

              <fieldset className="space-y-3 p-4 bg-navy-mist rounded-[10px] border border-rule">
                <legend className="sr-only">Declarations</legend>
                <p className="font-bold text-navy inline-flex items-center gap-2"><ShieldCheck size={16} /> Before you start</p>
                <label className="flex gap-3 text-sm text-ink">
                  <input type="checkbox" className="mt-1 accent-brand" checked={form.consent} onChange={(e) => set({ consent: e.target.checked })} />
                  <span>
                    {research
                      ? 'My participants gave informed consent, and I followed my college\'s ethics process (permission or clearance) for this study.'
                      : 'My client (and her family, where involved) agreed to be the subject of this care study.'}
                  </span>
                </label>
                <label className="flex gap-3 text-sm text-ink">
                  <input type="checkbox" className="mt-1 accent-brand" checked={form.declaration} onChange={(e) => set({ declaration: e.target.checked })} />
                  <span>
                    {research
                      ? 'I carried out this study myself. Everything I enter, including every figure and result, is from my own data and records.'
                      : 'I personally cared for this client. Everything I enter is what I saw and did, taken from my own notes and her records.'}
                  </span>
                </label>
              </fieldset>

              <div className="p-5 bg-navy text-white rounded-[14px]">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold">{research ? 'Research project fee' : 'Care study fee'}</span>
                  <span className="text-xl font-bold">GHS {price.toFixed(2)}</span>
                </div>
                {balance !== null && (
                  <div className="flex justify-between items-center text-sm mb-2">
                    <span className="text-white/70">Wallet balance</span>
                    <span className={canAfford ? 'text-white/90 font-semibold' : 'text-gold font-semibold'}>GHS {balance.toFixed(2)}</span>
                  </div>
                )}
                <p className="text-xs text-white/70">
                  {research ? 'Paid once from your wallet when you start. Covers drafting, checks and export for this research project.' : 'Paid once from your wallet when you start. Covers drafting, checks and export for this client.'}
                </p>
                {!canAfford && (
                  <button type="button" onClick={() => navigate('/wallet')} className="mt-3 bg-gold text-navy px-4 py-2 rounded-[10px] text-sm font-bold hover:brightness-95 transition">
                    Top up GHS {(price - (balance ?? 0)).toFixed(2)} to continue
                  </button>
                )}
              </div>

              <button disabled={!ready || creating} className="btn-primary w-full p-4 text-lg disabled:opacity-50">
                {creating ? 'Starting...' : `Start ${noun}`}
              </button>
            </form>
          )}
        </>
      )}
    </AppShell>
  );
}
