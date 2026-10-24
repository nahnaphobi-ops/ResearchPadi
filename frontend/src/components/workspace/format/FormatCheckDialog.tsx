import { useEffect, useMemo } from 'react';
import type { Editor } from '@tiptap/react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, X, XCircle } from 'lucide-react';
import { checkFormat } from './formatCheck';
import { getCitationStyle, getCitedSources } from '../citations/CitationExtension';

interface Props {
  editor: Editor;
  institutionType?: string;
  onClose: () => void;
}

const ICONS = {
  pass: <CheckCircle2 size={16} className="text-[#107c10] shrink-0" />,
  warn: <AlertTriangle size={16} className="text-[#c19c00] shrink-0" />,
  fail: <XCircle size={16} className="text-[#a4262c] shrink-0" />,
};

/** The format check, with each finding linked to its place in the document. */
export default function FormatCheckDialog({ editor, institutionType, onClose }: Props) {
  const findings = useMemo(() => checkFormat(editor.state.doc, {
    institutionType,
    citationStyle: getCitationStyle(editor.state),
    citations: getCitedSources(editor.state).length,
  }), [editor, institutionType]);
  const sorted = [...findings].sort((a, b) => ['fail', 'warn', 'pass'].indexOf(a.status) - ['fail', 'warn', 'pass'].indexOf(b.status));
  const issues = findings.filter((f) => f.status !== 'pass').length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const show = (pos: number) => {
    editor.chain().focus().setTextSelection(pos + 1).scrollIntoView().run();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] bg-navy/40 grid place-items-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="format-title" className="w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-rule bg-white shadow-card">
        <div className="flex items-start justify-between gap-3 border-b border-rule px-5 py-4">
          <div>
            <h2 id="format-title" className="flex items-center gap-2 text-lg font-extrabold text-navy"><ClipboardCheck size={18} className="text-brand" /> Format check</h2>
            <p className="mt-0.5 text-xs text-muted">
              {issues ? `${issues} thing${issues === 1 ? '' : 's'} to look at.` : 'Nothing to fix.'} Based on what most Ghanaian institutions ask for; your department's guide has the final word.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted hover:bg-navy-mist"><X size={18} /></button>
        </div>
        <ul className="divide-y divide-rule">
          {sorted.map((f, i) => (
            <li key={i} className="flex gap-3 px-5 py-3">
              {ICONS[f.status]}
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold text-navy">{f.title}</p>
                {f.detail && <p className="mt-0.5 text-xs leading-relaxed text-muted">{f.detail}</p>}
              </div>
              {f.pos !== undefined && (
                <button type="button" onClick={() => show(f.pos!)} className="self-start text-xs font-semibold text-brand hover:underline">Show</button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
