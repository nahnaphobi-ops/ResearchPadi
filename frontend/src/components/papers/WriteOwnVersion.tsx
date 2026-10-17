import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, PenLine, X } from 'lucide-react';
import { workspaceService } from '../../services/workspaceService';
import { apiErrorMessage, apiErrorStatus } from '../../utils/apiError';

/**
 * Opens (or creates) the student's own document for a study draft: its
 * headings only, with the draft and a coach beside it in the Workspace.
 */
export default function WriteOwnVersion({ paperId, variant = 'light' }: { paperId: string; variant?: 'light' | 'dark' }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [needsPlan, setNeedsPlan] = useState(false);
  const [error, setError] = useState('');

  const open = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await workspaceService.createFromDraft(paperId);
      navigate(`/workspace/${data.id}?panel=draft`);
    } catch (err) {
      const message = apiErrorMessage(err, 'Could not open your document');
      if (apiErrorStatus(err) === 403 && /subscription/i.test(message)) setNeedsPlan(true);
      else setError(message);
    } finally {
      setBusy(false);
    }
  };

  const button = variant === 'dark'
    ? 'px-4 py-2 bg-gold text-navy rounded-[10px] font-bold text-xs hover:brightness-95 transition inline-flex items-center gap-1.5 disabled:opacity-60'
    : 'btn-primary px-5 py-3 text-sm inline-flex items-center gap-2 disabled:opacity-60';

  return (
    <div className="relative inline-block">
      <button type="button" onClick={() => void open()} disabled={busy} className={button}>
        {busy ? <Loader2 size={variant === 'dark' ? 13 : 16} className="animate-spin" /> : <PenLine size={variant === 'dark' ? 13 : 16} />} Write your own version
      </button>
      {error && <p role="alert" className="mt-1 text-xs text-red-600 max-w-xs">{error}</p>}
      {needsPlan && (
        <div role="dialog" aria-label="Workspace plan needed" className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-rule bg-white p-4 text-left text-ink shadow-card">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-navy">Write it in the Workspace</p>
            <button type="button" onClick={() => setNeedsPlan(false)} aria-label="Close" className="text-muted hover:text-navy"><X size={15} /></button>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Your own version opens in the Workspace with the draft beside it, a coach for each section and an own-words check.
            Plans start at GHS 120 for 30 days.
          </p>
          <button type="button" onClick={() => navigate('/subscribe?plan=standard')} className="btn-primary mt-3 w-full px-3 py-2 text-xs">See Workspace plans</button>
        </div>
      )}
    </div>
  );
}
