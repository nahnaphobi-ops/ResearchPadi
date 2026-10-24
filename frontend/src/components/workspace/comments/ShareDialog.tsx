import { useEffect, useState } from 'react';
import { Check, Copy, Eye, Link2, Loader2, MessageSquare, PenLine, X } from 'lucide-react';
import { sharingService, shareUrl, type Share, type ShareRole } from '../../../services/sharingService';
import { apiErrorMessage } from '../../../utils/apiError';

interface Props {
  sessionId: string;
  onClose: () => void;
  /** Whether a working edit link exists (the document is then edited live). */
  onLiveChange?: (live: boolean) => void;
}

const ROLES: { role: ShareRole; label: string; hint: string; icon: typeof Eye }[] = [
  { role: 'view', label: 'Can view', hint: 'Read the document; no account needed', icon: Eye },
  { role: 'comment', label: 'Can comment', hint: 'Read and comment, e.g. your supervisor; no account needed', icon: MessageSquare },
  { role: 'edit', label: 'Can edit', hint: 'Write with you at the same time, e.g. group members; they sign in', icon: PenLine },
];

/** Links to the document for a supervisor, classmates or group members. Turning a link off stops it at once. */
export default function ShareDialog({ sessionId, onClose, onLiveChange }: Props) {
  const [shares, setShares] = useState<Share[] | null>(null);
  const [busy, setBusy] = useState<ShareRole | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    sharingService.shares(sessionId)
      .then(({ data }) => setShares(data.shares))
      .catch((err) => { setShares([]); setError(apiErrorMessage(err, 'Could not load your links.')); });
  }, [sessionId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl(token));
      setCopied(token);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('Could not copy. Select the link and copy it yourself.');
    }
  };

  const create = async (role: ShareRole) => {
    setBusy(role);
    setError('');
    try {
      const { data } = await sharingService.share(sessionId, role);
      setShares((list) => [data.share, ...(list ?? [])]);
      if (role === 'edit') onLiveChange?.(true);
      void copy(data.share.token);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create the link.'));
    } finally {
      setBusy(null);
    }
  };

  const turnOff = async (s: Share) => {
    try {
      const { data } = await sharingService.unshare(sessionId, s.id);
      setShares((list) => (list ?? []).filter((x) => x.id !== s.id));
      if (s.role === 'edit') onLiveChange?.(data.collaborative);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not turn off that link.'));
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-navy/40 grid place-items-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="share-title" className="w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-rule bg-white shadow-card">
        <div className="flex items-start justify-between gap-3 border-b border-rule px-5 py-4">
          <div>
            <h2 id="share-title" className="text-lg font-extrabold text-navy">Share this document</h2>
            <p className="mt-0.5 text-xs text-muted">Anyone with a link can open it, so share links only with people you trust.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted hover:bg-navy-mist"><X size={18} /></button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-2">
            {ROLES.map((r) => (
              <button key={r.role} type="button" disabled={busy !== null} onClick={() => void create(r.role)} className="flex items-center gap-3 rounded-xl border border-rule px-3 py-2.5 text-left hover:border-brand hover:bg-brand-soft disabled:opacity-50">
                <r.icon size={18} className="shrink-0 text-brand" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-navy">New link: {r.label.toLowerCase()}</span>
                  <span className="block text-xs text-muted">{r.hint}</span>
                </span>
                {busy === r.role ? <Loader2 size={15} className="animate-spin text-muted" /> : <Link2 size={15} className="text-muted" />}
              </button>
            ))}
          </div>

          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">Links that work now</p>
            {shares === null ? (
              <p className="flex items-center gap-1.5 text-sm text-muted"><Loader2 size={14} className="animate-spin" /> Loading…</p>
            ) : shares.length === 0 ? (
              <p className="text-sm text-muted">No links yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {shares.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 rounded-lg border border-rule px-2.5 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-navy">{ROLES.find((r) => r.role === s.role)?.label}</span>
                      <span className="block truncate text-[11px] text-muted">{shareUrl(s.token)}</span>
                    </span>
                    <button type="button" onClick={() => void copy(s.token)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-brand hover:bg-brand-soft">
                      {copied === s.token ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
                    </button>
                    <button type="button" onClick={() => void turnOff(s)} className="rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50">Turn off</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
