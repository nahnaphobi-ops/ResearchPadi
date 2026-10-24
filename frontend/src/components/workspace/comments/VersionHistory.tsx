import { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { History, Loader2, RotateCcw, Save, X } from 'lucide-react';
import { sharingService, type VersionSummary } from '../../../services/sharingService';
import { apiErrorMessage } from '../../../utils/apiError';
import { workspaceExtensions } from '../editorSetup';

interface Props {
  sessionId: string;
  /** Saves any unsaved changes first, so the current text is what gets kept. */
  onBeforeChange: () => Promise<void>;
  onRestored: (content: string) => void;
  onClose: () => void;
}

const when = (iso: string) => new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Earlier versions of the document: kept automatically every 15 minutes or so
 * while writing, saved by hand, and before every restore. Restoring never
 * loses the current text: it is kept as a version first.
 */
export default function VersionHistory({ sessionId, onBeforeChange, onRestored, onClose }: Props) {
  const [versions, setVersions] = useState<VersionSummary[] | null>(null);
  const [selected, setSelected] = useState<VersionSummary | null>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const preview = useEditor({ extensions: workspaceExtensions({ placeholder: '' }), editable: false, content: '' });

  const load = async () => {
    try {
      const { data } = await sharingService.versions(sessionId);
      setVersions(data.versions);
    } catch (err) {
      setVersions([]);
      setError(apiErrorMessage(err, 'Could not load the version history.'));
    }
  };

  useEffect(() => {
    let cancelled = false;
    sharingService.versions(sessionId)
      .then(({ data }) => { if (!cancelled) setVersions(data.versions); })
      .catch((err) => {
        if (cancelled) return;
        setVersions([]);
        setError(apiErrorMessage(err, 'Could not load the version history.'));
      });
    return () => { cancelled = true; };
  }, [sessionId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const open = async (v: VersionSummary) => {
    setSelected(v);
    setError('');
    try {
      const { data } = await sharingService.version(sessionId, v.id);
      preview?.commands.setContent(data.version.content);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load that version.'));
    }
  };

  const saveNow = async () => {
    setBusy('save');
    setError('');
    try {
      await onBeforeChange();
      await sharingService.saveVersion(sessionId, label.trim());
      setLabel('');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save a version.'));
    } finally {
      setBusy('');
    }
  };

  const restore = async () => {
    if (!selected || !window.confirm('Bring back this version? Your current text is kept as a version first, so you can switch back.')) return;
    setBusy('restore');
    setError('');
    try {
      await onBeforeChange();
      const { data } = await sharingService.restore(sessionId, selected.id);
      onRestored(data.session.content ?? '');
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not restore that version.'));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-navy/40 grid place-items-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="history-title" className="flex h-[min(44rem,calc(100vh-2rem))] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-rule bg-white shadow-card">
        <div className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3">
          <h2 id="history-title" className="flex items-center gap-2 text-lg font-extrabold text-navy"><History size={18} className="text-brand" /> Version history</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted hover:bg-navy-mist"><X size={18} /></button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <div className="flex max-h-[40%] w-full flex-col border-b border-rule sm:max-h-none sm:w-72 sm:border-b-0 sm:border-r">
            <div className="space-y-1.5 border-b border-rule p-3">
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name this version (optional)" aria-label="Version name" className="w-full rounded-md border border-[#c8c6c4] px-2 py-1.5 text-sm" />
              <button type="button" onClick={() => void saveNow()} disabled={busy !== ''} className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
                {busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save a version now
              </button>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto p-2">
              {versions === null && <li className="p-2 text-sm text-muted">Loading…</li>}
              {versions?.length === 0 && <li className="p-2 text-sm text-muted">No versions yet. One is kept automatically every 15 minutes or so while you write.</li>}
              {versions?.map((v) => (
                <li key={v.id}>
                  <button type="button" onClick={() => void open(v)} className={`w-full rounded-md px-2.5 py-2 text-left text-sm ${selected?.id === v.id ? 'bg-brand-soft text-navy' : 'hover:bg-navy-mist'}`}>
                    <span className="block font-semibold">{when(v.created_at)}</span>
                    <span className="block text-xs text-muted">{v.label ? `${v.label} · ` : ''}{v.word_count.toLocaleString()} words</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            {error && <p role="alert" className="border-b border-rule bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
            {selected ? (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 font-serif text-[15px] leading-relaxed word-doc"><EditorContent editor={preview} /></div>
                <div className="flex justify-end gap-2 border-t border-rule px-4 py-3">
                  <button type="button" onClick={() => void restore()} disabled={busy !== ''} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
                    {busy === 'restore' ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Restore this version
                  </button>
                </div>
              </>
            ) : (
              <p className="m-auto max-w-xs p-6 text-center text-sm text-muted">Choose a version to read it. You can bring any version back; your current text is kept too.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
