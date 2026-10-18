import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { careStudyService } from '../services/careStudyService';
import { apiErrorMessage } from '../utils/apiError';
import ReviewRequestDialog from '../components/reviews/ReviewRequestDialog';
import SeriesCharts from '../components/care-study/SeriesCharts';
import { isAxiosError } from 'axios';
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ClipboardCheck, Download, GraduationCap, History, Lightbulb, Lock, MessageCircleQuestion, Plus, Sparkles, Trash2, X,
} from 'lucide-react';
import type {
  CareStudy, CareStudySectionRow, CareStudyTemplate, CareStudyVersion, CheckIssue, HelpResult, PrivacyIssue, SectionEntries, TemplateField, TemplateSection,
} from '../types/careStudy';

const filled = (v?: string) => !!v && v.trim().length > 0;

/** Same rule as the API: what must be entered before this section can be drafted. */
function missingRequired(section: TemplateSection, entries: SectionEntries | undefined, sourcesReady: boolean): string[] {
  const missing: string[] = [];
  for (const f of section.fields ?? []) if (f.required && !filled(entries?.fields?.[f.key])) missing.push(f.label);
  if (section.repeat) {
    const items = entries?.items ?? [];
    if (items.length < section.repeat.min) missing.push(`At least ${section.repeat.min} ${section.repeat.label.toLowerCase()} entr${section.repeat.min === 1 ? 'y' : 'ies'}`);
    items.forEach((item, i) => {
      for (const f of section.repeat!.fields) if (f.required && !filled(item[f.key])) missing.push(`${section.repeat!.label} ${i + 1}: ${f.label}`);
    });
  }
  if (section.requires_sources && !sourcesReady) missing.push('Sources (none found yet; try drafting again in a few minutes)');
  return missing;
}

/** A saved set of notes as "Label: value" lines, for the history. */
function notesText(section: TemplateSection, entries: SectionEntries): string {
  const lines: string[] = [];
  for (const f of section.fields ?? []) if (filled(entries.fields?.[f.key])) lines.push(`${f.label}: ${entries.fields![f.key]}`);
  (entries.items ?? []).forEach((item, i) => {
    lines.push(`${section.repeat?.label ?? 'Entry'} ${i + 1}:`);
    for (const f of section.repeat?.fields ?? []) if (filled(item[f.key])) lines.push(`  ${f.label}: ${item[f.key]}`);
  });
  return lines.join('\n') || '(empty)';
}

function FieldInput({ field, value, onChange, idPrefix }: { field: TemplateField; value: string; onChange: (v: string) => void; idPrefix: string }) {
  const id = `${idPrefix}-${field.key}`;
  const common = 'w-full p-2.5 border rounded-[10px] text-sm';
  return (
    <div>
      <label htmlFor={id} className="block font-semibold text-ink text-sm mb-0.5">
        {field.label} {field.required ? <span className="text-red-600" aria-label="required">*</span> : <span className="font-normal text-muted text-xs">(optional)</span>}
      </label>
      <p className="text-xs text-muted mb-1">{field.hint}</p>
      {field.type === 'textarea' ? (
        <textarea id={id} className={common} rows={4} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input
          id={id}
          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'datetime' ? 'datetime-local' : 'text'}
          step={field.type === 'number' ? 'any' : undefined}
          className={common}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function IssueList({ issues }: { issues: PrivacyIssue[] }) {
  if (!issues.length) return null;
  const blocking = issues.some((i) => i.severity === 'block');
  return (
    <div role="alert" className={`p-3 rounded-[10px] text-sm ${blocking ? 'bg-red-100 text-red-700' : 'bg-orange-50 text-orange-800 border border-orange-200'}`}>
      <p className="font-bold mb-1 inline-flex items-center gap-1.5"><AlertTriangle size={14} /> {blocking ? 'Not saved — remove these personal details' : 'Check client privacy'}</p>
      <ul className="list-disc ml-5 space-y-0.5">
        {issues.map((i, n) => <li key={n}><span className="font-mono">{i.match}</span> — {i.message}</li>)}
      </ul>
    </div>
  );
}

export default function CareStudyEditor() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [study, setStudy] = useState<CareStudy | null>(null);
  const [template, setTemplate] = useState<CareStudyTemplate | null>(null);
  const [rows, setRows] = useState<Record<string, CareStudySectionRow>>({});
  const [activeKey, setActiveKey] = useState('');
  const [entries, setEntries] = useState<SectionEntries>({});
  const [dirty, setDirty] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftDirty, setDraftDirty] = useState(false);
  const [busy, setBusy] = useState<'' | 'save' | 'draft' | 'edit' | 'check' | 'help' | 'export'>('');
  const [error, setError] = useState('');
  const [privacy, setPrivacy] = useState<PrivacyIssue[]>([]);
  const [draftNotice, setDraftNotice] = useState<{ flagged: string[]; removed: string[] } | null>(null);
  const [lockedMissing, setLockedMissing] = useState<string[]>([]);
  const [history, setHistory] = useState<CareStudyVersion[] | null>(null);
  const [checkIssues, setCheckIssues] = useState<CheckIssue[] | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [helpQuestion, setHelpQuestion] = useState('');
  const [helpAnswer, setHelpAnswer] = useState<HelpResult | null>(null);

  /** Show one section: its saved entries and draft. */
  const openSection = (tpl: CareStudyTemplate, saved: Record<string, CareStudySectionRow>, key: string) => {
    const target = tpl.sections.find((s) => s.key === key);
    if (!target) return;
    setActiveKey(key);
    setEntries(saved[key]?.entries ?? { fields: {}, items: target.repeat ? [] : undefined });
    setDraftText(saved[key]?.draft ?? '');
    setDirty(false);
    setDraftDirty(false);
    setPrivacy([]);
    setDraftNotice(null);
    setLockedMissing([]);
    setHistory(null);
  };

  useEffect(() => {
    careStudyService.get(id)
      .then(({ data }) => {
        setStudy(data.study);
        setTemplate(data.template);
        setRows(data.sections);
        openSection(data.template, data.sections, data.template.sections[0]?.key ?? '');
      })
      .catch((err) => setError(apiErrorMessage(err, 'Could not load this care study')));
  }, [id]);

  const section = template?.sections.find((s) => s.key === activeKey);
  // Theory sections need retrieved sources; before the first search we assume they will be found.
  const sourcesReady = !study?.sources_fetched_at || (study?.sources?.length ?? 0) > 0;

  const missing = useMemo(() => (section ? missingRequired(section, entries, sourcesReady) : []), [section, entries, sourcesReady]);

  const setField = (key: string, value: string) => {
    setEntries((e) => ({ ...e, fields: { ...(e.fields ?? {}), [key]: value } }));
    setDirty(true);
  };
  const setItemField = (index: number, key: string, value: string) => {
    setEntries((e) => ({ ...e, items: (e.items ?? []).map((it, i) => (i === index ? { ...it, [key]: value } : it)) }));
    setDirty(true);
  };
  const addItem = () => { setEntries((e) => ({ ...e, items: [...(e.items ?? []), {}] })); setDirty(true); };
  const removeItem = (index: number) => { setEntries((e) => ({ ...e, items: (e.items ?? []).filter((_, i) => i !== index) })); setDirty(true); };

  const saveNotes = useCallback(async (): Promise<boolean> => {
    if (!section) return false;
    setBusy('save');
    setError('');
    try {
      const { data } = await careStudyService.saveSection(id, section.key, entries);
      setPrivacy(data.warnings);
      setRows((r) => ({ ...r, [section.key]: { ...r[section.key], entries, updated_at: data.updated_at } }));
      setDirty(false);
      return true;
    } catch (err) {
      if (isAxiosError<{ issues?: PrivacyIssue[] }>(err) && err.response?.data?.issues) setPrivacy(err.response.data.issues);
      setError(apiErrorMessage(err, 'Could not save'));
      return false;
    } finally {
      setBusy('');
    }
  }, [id, section, entries]);

  const goTo = async (key: string) => {
    if (key === activeKey) return;
    if (draftDirty && !window.confirm('You have unsaved changes to the draft. Leave without saving them?')) return;
    if (dirty && !(await saveNotes())) return;
    if (template) openSection(template, rows, key);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const draft = async () => {
    if (!section || missing.length) return;
    if (dirty && !(await saveNotes())) return;
    if (draftText && !window.confirm('Drafting again replaces the current draft (your earlier version stays in the history). Continue?')) return;
    setBusy('draft');
    setError('');
    setLockedMissing([]);
    try {
      const { data } = await careStudyService.draft(id, section.key);
      setDraftText(data.draft);
      setDraftDirty(false);
      setDraftNotice({ flagged: data.flaggedValues, removed: data.removedCitations });
      setRows((r) => ({ ...r, [section.key]: { ...r[section.key], draft: data.draft, drafted_at: data.drafted_at } }));
      if (!study?.sources_fetched_at) careStudyService.get(id).then(({ data: d }) => setStudy(d.study)).catch(() => {});
    } catch (err) {
      if (isAxiosError<{ missing?: string[] }>(err) && err.response?.data?.missing) setLockedMissing(err.response.data.missing);
      setError(apiErrorMessage(err, 'Drafting failed'));
    } finally {
      setBusy('');
    }
  };

  const saveDraftEdit = async (): Promise<boolean> => {
    if (!section) return false;
    setBusy('edit');
    setError('');
    try {
      const { data } = await careStudyService.editDraft(id, section.key, draftText);
      setPrivacy(data.warnings);
      setRows((r) => ({ ...r, [section.key]: { ...r[section.key], draft: draftText } }));
      setDraftDirty(false);
      return true;
    } catch (err) {
      if (isAxiosError<{ issues?: PrivacyIssue[] }>(err) && err.response?.data?.issues) setPrivacy(err.response.data.issues);
      setError(apiErrorMessage(err, 'Could not save your edit'));
      return false;
    } finally {
      setBusy('');
    }
  };

  /** Save notes and draft edits before anything that reads the saved study (check, export, review). */
  const saveAll = async (): Promise<boolean> => {
    if (dirty && !(await saveNotes())) return false;
    if (draftDirty && !(await saveDraftEdit())) return false;
    return true;
  };

  // Warn before closing or reloading the tab with unsaved work.
  useEffect(() => {
    if (!dirty && !draftDirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, draftDirty]);

  const loadHistory = async () => {
    if (!section) return;
    if (history) { setHistory(null); return; }
    try {
      const { data } = await careStudyService.versions(id, section.key);
      setHistory(data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load the history'));
    }
  };

  const runCheck = async () => {
    if (!(await saveAll())) return;
    setBusy('check');
    setError('');
    try {
      const { data } = await careStudyService.check(id);
      setCheckIssues(data.issues);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not check your work'));
    } finally {
      setBusy('');
    }
  };

  const askHelp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!helpQuestion.trim()) return;
    setBusy('help');
    try {
      const { data } = await careStudyService.help(id, helpQuestion);
      setHelpAnswer(data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not answer right now'));
    } finally {
      setBusy('');
    }
  };

  const exportDocx = async (format: 'clean' | 'supervisor') => {
    if (!study || !template) return;
    if (!(await saveAll())) return;
    if (format === 'clean') {
      // Tell the student what the submission copy will still show as missing.
      const undrafted = template.sections.filter((s) => !rows[s.key]?.draft).length;
      const gaps = Object.values(rows).reduce((n, r) => n + (r.draft?.match(/\[Student to supply:/g)?.length ?? 0), 0);
      if ((undrafted > 0 || gaps > 0)
        && !window.confirm(`Your study still has ${undrafted} section${undrafted === 1 ? '' : 's'} not drafted and ${gaps} item${gaps === 1 ? '' : 's'} marked [Student to supply: …]. They will appear highlighted in the document. Download anyway?`)) return;
    }
    setBusy('export');
    try {
      await careStudyService.exportDocx(id, study.pseudonym, format);
    } catch (err) {
      setError(apiErrorMessage(err, 'Export failed'));
    } finally {
      setBusy('');
    }
  };

  if (!study || !template || !section) {
    return (
      <AppShell>
        {error ? (
          <div role="alert" className="p-4 bg-red-100 text-red-700 rounded-[10px] text-sm">{error}</div>
        ) : (
          <div className="py-16 text-center text-muted">
            <div className="mx-auto mb-3 w-8 h-8 border-2 border-rule border-t-brand rounded-full animate-spin" />
            Loading care study...
          </div>
        )}
      </AppShell>
    );
  }

  const sectionState = (s: TemplateSection) => {
    const row = s.key === activeKey ? { ...rows[s.key], entries } : rows[s.key];
    if (row?.draft) return 'drafted';
    return missingRequired(s, row?.entries, sourcesReady).length ? 'todo' : 'ready';
  };
  const placeholderCount = (draftText.match(/\[Student to supply:/g) ?? []).length;
  const current = rows[section.key];
  // Compare as times: the database and the API write timestamps in different formats.
  const stale = !!current?.drafted_at && !!current?.updated_at && Date.parse(current.updated_at) > Date.parse(current.drafted_at);

  return (
    <AppShell wide>
      <button onClick={() => navigate('/care-studies')} className="text-sm text-muted hover:text-navy font-medium inline-flex items-center gap-1.5 mb-4">
        <ArrowLeft size={15} /> All care studies
      </button>

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 mb-6">
        <div>
          <p className="eyebrow mb-1">{template.name}</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-navy">{study.pseudonym}{study.focus ? ` · ${study.focus}` : ''}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setHelpOpen((o) => !o)} className="btn-ghost px-4 py-2 text-sm inline-flex items-center gap-1.5"><MessageCircleQuestion size={15} /> Ask for help</button>
          <button onClick={runCheck} disabled={busy === 'check'} className="btn-ghost px-4 py-2 text-sm inline-flex items-center gap-1.5 disabled:opacity-50"><ClipboardCheck size={15} /> {busy === 'check' ? 'Checking...' : 'Check my work'}</button>
          <button onClick={() => setReviewOpen(true)} className="btn-ghost px-4 py-2 text-sm inline-flex items-center gap-1.5"><GraduationCap size={15} /> Request supervisor review</button>
          <button onClick={() => void exportDocx('supervisor')} disabled={busy === 'export'} className="btn-ghost px-4 py-2 text-sm inline-flex items-center gap-1.5 disabled:opacity-50" title="Your notes beside the draft, so a supervisor can see what is yours"><Download size={15} /> Supervisor copy</button>
          <button onClick={() => void exportDocx('clean')} disabled={busy === 'export'} className="btn-primary px-4 py-2 text-sm inline-flex items-center gap-1.5 disabled:opacity-50" title="The care study as a document to submit"><Download size={15} /> {busy === 'export' ? 'Exporting...' : 'Download study'}</button>
        </div>
      </div>

      {error && <div role="alert" className="p-4 mb-4 bg-red-100 text-red-700 rounded-[10px] text-sm">{error}</div>}

      {reviewOpen && (
        <ReviewRequestDialog
          sourceType="care_study"
          sourceId={id}
          onBeforeSubmit={saveAll}
          onClose={() => setReviewOpen(false)}
          onSubmitted={(requestId) => navigate(`/reviews/${requestId}`)}
        />
      )}

      {helpOpen && (
        <div className="mb-6 p-5 bg-white rounded-[14px] border border-rule shadow-soft">
          <div className="flex justify-between items-start gap-3 mb-2">
            <p className="font-bold text-navy">Ask about your care study</p>
            <button onClick={() => setHelpOpen(false)} aria-label="Close help" className="text-muted hover:text-navy"><X size={16} /></button>
          </div>
          <form onSubmit={askHelp} className="flex flex-col sm:flex-row gap-2">
            <input className="flex-1 p-2.5 border rounded-[10px] text-sm" value={helpQuestion} onChange={(e) => setHelpQuestion(e.target.value)} placeholder='e.g. "What goes in the family history?"' />
            <button disabled={busy === 'help' || !helpQuestion.trim()} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">{busy === 'help' ? 'Thinking...' : 'Ask'}</button>
          </form>
          {helpAnswer && (
            <div className="mt-3 text-sm text-ink">
              <p className="whitespace-pre-wrap">{helpAnswer.message}</p>
              {helpAnswer.kind === 'checklist' && helpAnswer.checklist.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {helpAnswer.checklist.map((s) => (
                    <li key={s.key}>
                      <button onClick={() => goTo(s.key)} className="font-semibold text-brand hover:underline">{s.title}</button>
                      <ul className="list-disc ml-5 text-muted">{s.missing.map((m) => <li key={m}>{m}</li>)}</ul>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {checkIssues && (
        <div className="mb-6 p-5 bg-white rounded-[14px] border border-rule shadow-soft">
          <div className="flex justify-between items-start gap-3 mb-1">
            <p className="font-bold text-navy inline-flex items-center gap-1.5"><ClipboardCheck size={16} /> Check my work</p>
            <button onClick={() => setCheckIssues(null)} aria-label="Close check results" className="text-muted hover:text-navy"><X size={16} /></button>
          </div>
          <p className="text-xs text-muted mb-3">These are questions to look at, not corrections. Confirm anything clinical with your supervisor — this check does not replace clinical judgement.</p>
          {checkIssues.length === 0 ? (
            <p className="text-sm text-green-700 inline-flex items-center gap-1.5"><CheckCircle2 size={15} /> Nothing to flag right now.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {checkIssues.map((issue, i) => {
                const target = template.sections.find((s) => s.key === issue.section);
                return (
                  <li key={i} className="flex gap-2">
                    <AlertTriangle size={14} className="text-orange-600 mt-0.5 shrink-0" />
                    <span>
                      {issue.message}
                      {target && <> <button onClick={() => goTo(target.key)} className="text-brand font-semibold hover:underline">Go to {target.title}</button></>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <nav aria-label="Care study sections" className="bg-white rounded-[14px] border border-rule p-4 h-fit lg:sticky lg:top-4">
          {template.stages.map((stage) => {
            const inStage = template.sections.filter((s) => s.stage === stage.key);
            if (!inStage.length) return null;
            return (
              <div key={stage.key} className="mb-4 last:mb-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">{stage.label}</p>
                <ul className="space-y-0.5">
                  {inStage.map((s) => {
                    const state = sectionState(s);
                    return (
                      <li key={s.key}>
                        <button
                          onClick={() => goTo(s.key)}
                          aria-current={s.key === activeKey ? 'step' : undefined}
                          className={`w-full text-left text-sm px-2.5 py-1.5 rounded-lg flex items-center gap-2 ${s.key === activeKey ? 'bg-brand-soft text-navy font-semibold' : 'text-ink hover:bg-navy-mist'}`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${state === 'drafted' ? 'bg-green-600' : state === 'ready' ? 'bg-brand' : 'bg-rule border border-muted/40'}`}
                            title={state === 'drafted' ? 'Drafted' : state === 'ready' ? 'Ready to draft' : 'Details needed'}
                          />
                          {s.title}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          <p className="text-[11px] text-muted mt-3 border-t border-rule pt-3">
            <span className="inline-block w-2 h-2 rounded-full bg-rule border border-muted/40 mr-1" /> details needed
            <span className="inline-block w-2 h-2 rounded-full bg-brand ml-2 mr-1" /> ready
            <span className="inline-block w-2 h-2 rounded-full bg-green-600 ml-2 mr-1" /> drafted
          </p>
        </nav>

        <section className="space-y-6 min-w-0">
          <div className="bg-white rounded-[14px] border border-rule p-5 sm:p-7 shadow-soft space-y-5">
            <div>
              {section.part && <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1">{section.part}</p>}
              <h2 className="text-xl font-bold text-navy">{section.title}</h2>
            </div>

            <div className="p-4 rounded-[10px] bg-navy-mist border border-rule text-sm">
              <p className="font-bold text-navy mb-1 inline-flex items-center gap-1.5"><Lightbulb size={15} /> Why this matters</p>
              <p className="text-ink">{section.why}</p>
            </div>

            <div className="space-y-4">
              {(section.fields ?? []).map((f) => (
                <FieldInput key={f.key} field={f} idPrefix={section.key} value={entries.fields?.[f.key] ?? ''} onChange={(v) => setField(f.key, v)} />
              ))}
            </div>

            {section.repeat && (
              <div className="space-y-4">
                {(entries.items ?? []).map((item, i) => (
                  <div key={i} className="p-4 border border-rule rounded-[10px] space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="font-bold text-navy text-sm">{section.repeat!.label} {i + 1}</p>
                      <button onClick={() => removeItem(i)} className="text-muted hover:text-red-600 text-xs inline-flex items-center gap-1" aria-label={`Remove ${section.repeat!.label} ${i + 1}`}>
                        <Trash2 size={13} /> Remove
                      </button>
                    </div>
                    {section.repeat!.fields.map((f) => (
                      <FieldInput key={f.key} field={f} idPrefix={`${section.key}-${i}`} value={item[f.key] ?? ''} onChange={(v) => setItemField(i, f.key, v)} />
                    ))}
                  </div>
                ))}
                <button onClick={addItem} className="btn-ghost px-4 py-2 text-sm inline-flex items-center gap-1.5">
                  <Plus size={15} /> Add {section.repeat.label.toLowerCase()}
                </button>
              </div>
            )}

            {section.charts && section.charts.length > 0 && <SeriesCharts specs={section.charts} entries={entries} />}

            <IssueList issues={privacy} />

            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-rule">
              <button onClick={saveNotes} disabled={!dirty || busy === 'save'} className="btn-ghost px-4 py-2 text-sm disabled:opacity-50">
                {busy === 'save' ? 'Saving...' : dirty ? 'Save my notes' : 'Notes saved'}
              </button>
              <span className="text-xs text-muted">Every save is kept in the history.</span>
            </div>
          </div>

          <div className="bg-white rounded-[14px] border border-rule p-5 sm:p-7 shadow-soft space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="font-bold text-navy">Draft</h3>
              <div className="flex flex-wrap gap-2">
                <button onClick={loadHistory} className="btn-ghost px-3 py-2 text-xs inline-flex items-center gap-1.5"><History size={14} /> {history ? 'Hide history' : 'History'}</button>
                <button
                  onClick={draft}
                  disabled={missing.length > 0 || busy === 'draft'}
                  className="btn-primary px-4 py-2 text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                  aria-describedby={missing.length ? 'draft-locked' : undefined}
                >
                  {missing.length > 0 ? <Lock size={14} /> : <Sparkles size={14} />}
                  {busy === 'draft' ? 'Drafting...' : draftText ? 'Draft again' : 'Draft this section'}
                </button>
              </div>
            </div>

            {missing.length > 0 && (
              <div id="draft-locked" className="p-4 rounded-[10px] bg-navy-mist border border-rule text-sm">
                <p className="font-bold text-navy mb-1 inline-flex items-center gap-1.5"><Lock size={14} /> Drafting unlocks when you have entered:</p>
                <ul className="list-disc ml-5 text-ink">{missing.map((m) => <li key={m}>{m}</li>)}</ul>
              </div>
            )}
            {lockedMissing.length > 0 && missing.length === 0 && (
              <div className="p-4 rounded-[10px] bg-orange-50 border border-orange-200 text-sm text-orange-800">
                <ul className="list-disc ml-5">{lockedMissing.map((m) => <li key={m}>{m}</li>)}</ul>
              </div>
            )}

            {stale && !draftDirty && (
              <p className="text-sm text-orange-800 bg-orange-50 border border-orange-200 rounded-[10px] p-3">You changed your notes after this draft was made. Draft again so they match.</p>
            )}

            {draftNotice && (draftNotice.flagged.length > 0 || draftNotice.removed.length > 0) && (
              <div className="p-3 rounded-[10px] bg-orange-50 border border-orange-200 text-sm text-orange-800 space-y-1">
                {draftNotice.flagged.length > 0 && <p>These values were not in your notes, so they were replaced with a [Student to supply: check …] note. Confirm each one from the records or delete it: {draftNotice.flagged.join(', ')}.</p>}
                {draftNotice.removed.length > 0 && <p>These citations were not among the sources found for your study and were removed: {draftNotice.removed.join('; ')}.</p>}
              </div>
            )}

            {draftText ? (
              <>
                {placeholderCount > 0 && (
                  <p className="text-sm text-ink">
                    <span className="font-bold text-orange-700">{placeholderCount}</span> item{placeholderCount === 1 ? '' : 's'} marked <span className="font-mono text-xs">[Student to supply: …]</span> still need your real details.
                  </p>
                )}
                <textarea
                  aria-label="Draft text"
                  className="w-full p-3 border rounded-[10px] text-sm font-[inherit] leading-relaxed"
                  rows={18}
                  value={draftText}
                  onChange={(e) => { setDraftText(e.target.value); setDraftDirty(true); }}
                />
                <div className="flex items-center gap-3">
                  <button onClick={() => void saveDraftEdit()} disabled={!draftDirty || busy === 'edit'} className="btn-ghost px-4 py-2 text-sm disabled:opacity-50">
                    {busy === 'edit' ? 'Saving...' : draftDirty ? 'Save my edits' : 'Edits saved'}
                  </button>
                  <span className="text-xs text-muted">Your edits are kept separately from the AI draft in the history.</span>
                </div>
              </>
            ) : (
              missing.length === 0 && <p className="text-sm text-muted">Ready. The draft uses only what you entered above, and marks anything missing for you to fill in.</p>
            )}

            {history && (
              <div className="border-t border-rule pt-4">
                <p className="font-bold text-navy text-sm mb-2">History for this section</p>
                {history.length === 0 ? <p className="text-sm text-muted">Nothing saved yet.</p> : (
                  <ul className="space-y-2">
                    {history.map((v) => (
                      <li key={v.id}>
                        <details className="text-sm border border-rule rounded-[10px] p-3">
                          <summary className="cursor-pointer">
                            <span className="font-semibold text-ink">{v.kind === 'notes' ? 'Your notes' : v.kind === 'draft' ? 'AI draft' : 'Your edit'}</span>
                            <span className="text-muted"> · {new Date(v.created_at).toLocaleString()}</span>
                          </summary>
                          <pre className="mt-2 whitespace-pre-wrap text-xs text-ink font-[inherit]">
                            {'text' in v.content ? v.content.text : notesText(section, v.content)}
                          </pre>
                        </details>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
