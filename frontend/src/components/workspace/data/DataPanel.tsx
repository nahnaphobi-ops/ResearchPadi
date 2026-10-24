import { useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { BarChart3, FileSpreadsheet, Loader2, Plus, Upload } from 'lucide-react';
import { dataService, type Analysis, type AnalysisKind, type ColumnInfo, type Dataset } from '../../../services/dataService';
import { apiErrorMessage } from '../../../utils/apiError';
import { barChartSvg, svgToPng } from './charts';
import { chartFor, nextLabels, resultHtml, tableFor } from './insert';

interface Props {
  editor: Editor | null;
  sessionId: string;
}

// The data and the last result stay in this tab only (never saved), kept while the
// document is open, so closing the panel to place the cursor (on phones) loses nothing.
const loaded = new Map<string, { data: Dataset; columns: ColumnInfo[]; fileName: string }>();
const lastRun = new Map<string, { kind: AnalysisKind; a: string; b: string; result: Analysis | null }>();

const KINDS: { kind: AnalysisKind; label: string; hint: string; two: boolean; aNumeric?: boolean; bNumeric?: boolean; aLabel: string; bLabel?: string }[] = [
  { kind: 'frequencies', label: 'Frequency table', hint: 'How many chose each answer, with percentages', two: false, aLabel: 'Question' },
  { kind: 'summary', label: 'Mean and SD', hint: 'For number answers such as age or income', two: false, aNumeric: true, aLabel: 'Question (numbers)' },
  { kind: 'crosstab', label: 'Cross-tabulation and chi-square', hint: 'Whether answers to one question differ by another', two: true, aLabel: 'Rows', bLabel: 'Columns' },
  { kind: 'group-means', label: 'Compare means (ANOVA)', hint: 'A number answer compared across groups', two: true, aNumeric: true, aLabel: 'Number to compare', bLabel: 'Groups' },
  { kind: 'correlation', label: 'Correlation', hint: 'Whether two number answers rise and fall together', two: true, aNumeric: true, bNumeric: true, aLabel: 'First', bLabel: 'Second' },
];

/**
 * Chapter 4 from the student's own questionnaire data: frequency tables,
 * cross-tabulations with chi-square, means, ANOVA and correlations, computed
 * in code and inserted as APA tables with an optional chart and a short
 * reading that may only use the numbers shown.
 */
export default function DataPanel({ editor, sessionId }: Props) {
  const [state, setState] = useState(() => loaded.get(sessionId) ?? null);
  const [kind, setKind] = useState<AnalysisKind>(() => lastRun.get(sessionId)?.kind ?? 'frequencies');
  const [a, setA] = useState(() => lastRun.get(sessionId)?.a ?? '');
  const [b, setB] = useState(() => lastRun.get(sessionId)?.b ?? '');
  const [result, setResult] = useState<Analysis | null>(() => lastRun.get(sessionId)?.result ?? null);
  const [withChart, setWithChart] = useState(true);
  const [withReading, setWithReading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const spec = KINDS.find((k) => k.kind === kind)!;
  const choicesA = useMemo(() => (state?.columns ?? []).filter((c) => !spec.aNumeric || c.numeric), [state, spec]);
  const choicesB = useMemo(() => (state?.columns ?? []).filter((c) => (spec.bNumeric ? c.numeric : true) && c.name !== a), [state, spec, a]);
  const hasChart = result ? chartFor(result) !== null : false;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy('Reading your data…');
    setError('');
    setResult(null);
    try {
      const { data } = await dataService.parse(file);
      const next = { data: data.data, columns: data.columns, fileName: file.name };
      loaded.set(sessionId, next);
      lastRun.delete(sessionId);
      setState(next);
      setA('');
      setB('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not read that file.'));
    } finally {
      setBusy('');
    }
  };

  const request = () => ({ data: state!.data, kind, a, b: spec.two ? b : undefined });

  const run = async () => {
    if (!state || !a || (spec.two && !b)) return;
    setBusy('Working it out…');
    setError('');
    setNote('');
    try {
      const { data } = await dataService.analyse(request());
      setResult(data.result);
      lastRun.set(sessionId, { kind, a, b, result: data.result });
    } catch (err) {
      setResult(null);
      setError(apiErrorMessage(err, 'Could not analyse that.'));
    } finally {
      setBusy('');
    }
  };

  const insert = async () => {
    if (!editor || !result) return;
    setBusy('Adding it to your document…');
    setError('');
    setNote('');
    try {
      const labels = nextLabels(editor);
      const chart = withChart ? chartFor(result) : null;
      const figure = chart ? { label: labels.figure, title: chart.title, png: await svgToPng(barChartSvg(chart.chart)) } : undefined;
      let reading: string | null = null;
      if (withReading) {
        try {
          const { data } = await dataService.reading({ ...request(), tableLabel: labels.table });
          reading = data.reading;
          if (!reading && data.message) setNote(data.message);
        } catch (err) {
          setNote(apiErrorMessage(err, 'The short reading could not be written, so the table went in without it.'));
        }
      }
      editor.chain().focus().insertContent(resultHtml({ table: tableFor(result), tableLabel: labels.table, figure, reading })).run();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add it to your document.');
    } finally {
      setBusy('');
    }
  };

  const table = result ? tableFor(result) : null;

  return (
    <div className="p-3 space-y-3 text-[12.5px] text-[#252423]">
      <div>
        <p className="flex items-center gap-1.5 font-semibold text-[13px]"><BarChart3 size={15} className="text-brand" /> Analyse your data</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-[#605e5c]">
          Upload your questionnaire responses (Excel or CSV, one row per respondent). The numbers are worked out exactly, not by AI, and your data stays in this tab.
        </p>
      </div>

      <input ref={fileRef} type="file" accept=".xlsx,.csv,.tsv,.txt" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
      {state ? (
        <div className="flex items-center gap-2 rounded-md border border-[#e1dfdd] px-2.5 py-2">
          <FileSpreadsheet size={16} className="text-[#15803d] shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium" title={state.fileName}>{state.fileName}</p>
            <p className="text-[11px] text-[#8a8886]">{state.data.rows.length} respondents · {state.columns.length} questions</p>
          </div>
          <button type="button" onClick={() => fileRef.current?.click()} className="text-[11.5px] font-semibold text-brand hover:underline">Change</button>
        </div>
      ) : (
        <button type="button" onClick={() => fileRef.current?.click()} disabled={Boolean(busy)} className="w-full flex flex-col items-center gap-1 rounded-lg border-2 border-dashed border-[#c8c6c4] px-3 py-5 hover:border-brand hover:bg-brand-soft disabled:opacity-50">
          <Upload size={18} className="text-brand" />
          <span className="font-semibold">Upload Excel or CSV</span>
          <span className="text-[11px] text-[#8a8886]">Google Forms: Responses › Download responses (.csv)</span>
        </button>
      )}

      {state && (
        <>
          <div className="grid gap-1.5" role="radiogroup" aria-label="What to work out">
            {KINDS.map((k) => (
              <button
                key={k.kind}
                type="button"
                role="radio"
                aria-checked={kind === k.kind}
                onClick={() => { setKind(k.kind); setResult(null); setA(''); setB(''); }}
                className={`text-left rounded-md border px-2.5 py-1.5 ${kind === k.kind ? 'border-brand bg-brand-soft' : 'border-[#e1dfdd] hover:border-[#c8c6c4]'}`}
              >
                <span className="block font-medium">{k.label}</span>
                <span className="block text-[11px] text-[#8a8886]">{k.hint}</span>
              </button>
            ))}
          </div>

          <label className="block">
            <span className="text-[11px] font-semibold text-[#605e5c]">{spec.aLabel}</span>
            <select value={a} onChange={(e) => { setA(e.target.value); setResult(null); }} className="mt-0.5 w-full rounded-md border border-[#c8c6c4] bg-white px-2 py-1.5">
              <option value="">Choose…</option>
              {choicesA.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </label>
          {spec.two && (
            <label className="block">
              <span className="text-[11px] font-semibold text-[#605e5c]">{spec.bLabel}</span>
              <select value={b} onChange={(e) => { setB(e.target.value); setResult(null); }} className="mt-0.5 w-full rounded-md border border-[#c8c6c4] bg-white px-2 py-1.5">
                <option value="">Choose…</option>
                {choicesB.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </label>
          )}
          {spec.aNumeric && !choicesA.length && <p className="text-[11px] text-[#8a6914]">None of your questions has only number answers.</p>}

          <button type="button" onClick={() => void run()} disabled={!a || (spec.two && !b) || Boolean(busy)} className="w-full rounded-md bg-brand px-3 py-2 font-semibold text-white disabled:opacity-40">
            Work it out
          </button>
        </>
      )}

      {busy && <p className="flex items-center gap-1.5 text-[#605e5c]"><Loader2 size={13} className="animate-spin" /> {busy}</p>}
      {error && <p role="alert" className="text-[#a4262c]">{error}</p>}

      {table && result && (
        <div className="space-y-2 rounded-md border border-[#e1dfdd] p-2.5">
          <p className="italic">{table.title}</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11.5px]">
              <thead><tr>{table.header.map((h) => <th key={h} className="border-b border-[#8a8886] px-1.5 py-1 text-left font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i}>{r.map((c, j) => <td key={j} className="border-b border-[#edebe9] px-1.5 py-1">{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          {table.note && <p className="text-[11px] text-[#605e5c]"><em>Note.</em> {table.note}</p>}
          {hasChart && (
            <label className="flex items-center gap-2"><input type="checkbox" checked={withChart} onChange={(e) => setWithChart(e.target.checked)} className="accent-brand" /> Add a bar chart</label>
          )}
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={withReading} onChange={(e) => setWithReading(e.target.checked)} className="accent-brand mt-0.5" />
            <span>Add a short reading of the table <span className="text-[#8a8886]">(AI, using only these numbers; you add the discussion)</span></span>
          </label>
          <button type="button" onClick={() => void insert()} disabled={!editor || Boolean(busy)} className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-brand px-3 py-1.5 font-semibold text-brand hover:bg-brand-soft disabled:opacity-40">
            <Plus size={14} /> Insert at the cursor
          </button>
          {note && <p className="text-[11px] text-[#8a6914]">{note}</p>}
        </div>
      )}
    </div>
  );
}
