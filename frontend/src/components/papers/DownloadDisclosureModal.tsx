import { useEffect, useState } from 'react';
import { Shield, X } from 'lucide-react';
import { paperService } from '../../services/apiService';

export interface DisclosureTemplate {
  id: string;
  name: string;
  category: string;
  content: string;
}

interface DownloadDisclosureModalProps {
  paperId: string;
  topic: string;
  institutionName?: string;
  onClose: () => void;
}

export default function DownloadDisclosureModal({
  paperId,
  topic,
  institutionName,
  onClose,
}: DownloadDisclosureModalProps) {
  const [templates, setTemplates] = useState<DisclosureTemplate[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [includeStatement, setIncludeStatement] = useState(true);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    paperService.listDisclosureTemplates(institutionName)
      .then((res) => {
        const list: DisclosureTemplate[] = res.data.templates || [];
        setTemplates(list);
        const suggested = res.data.suggestedId as string;
        setSelectedId(list.some((t) => t.id === suggested) ? suggested : list[0]?.id || '');
      })
      .catch(() => setError('Could not load disclosure templates'))
      .finally(() => setLoading(false));
  }, [institutionName]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const selected = templates.find((t) => t.id === selectedId);

  const handleDownload = async () => {
    if (!selectedId) {
      setError('Select a disclosure template to continue');
      return;
    }
    setDownloading(true);
    setError('');
    try {
      await paperService.downloadDocx(paperId, topic, {
        disclosureId: selectedId,
        includeStatement,
      });
      onClose();
    } catch {
      setError('Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] bg-navy/40 backdrop-blur-sm grid place-items-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="disclosure-title"
        className="w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto bg-white rounded-2xl border border-rule shadow-card"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-rule">
          <div>
            <p className="eyebrow mb-1">EU AI Act · Article 50</p>
            <h2 id="disclosure-title" className="text-lg font-extrabold text-navy leading-tight">Choose an AI disclosure</h2>
            <p className="text-xs text-muted mt-1">Required before exporting. This marks the file as AI-assisted and adds provenance metadata.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:bg-navy-mist" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {error && <div role="alert" className="p-3 text-sm text-red-700 bg-red-50 rounded-xl">{error}</div>}

          {loading ? (
            <p className="text-sm text-muted">Loading templates…</p>
          ) : (
            <>
              <div>
                <label htmlFor="disclosure-template" className="block mb-2 text-sm font-medium text-ink">Institution / style template</label>
                <select
                  id="disclosure-template"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full p-3 border rounded-[10px]"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.category})
                    </option>
                  ))}
                </select>
              </div>

              {selected && (
                <div className="rounded-xl bg-navy-mist border border-rule p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-brand mb-2">Statement preview</p>
                  <p className="text-sm text-ink leading-relaxed">{selected.content}</p>
                </div>
              )}

              <label className="flex items-start gap-2.5 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={includeStatement}
                  onChange={(e) => setIncludeStatement(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  Insert this disclosure as a visible section at the end of the document.
                  <span className="block text-xs text-muted mt-0.5">C2PA-style provenance is always written into the file metadata.</span>
                </span>
              </label>
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-rule flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-[11px] text-muted inline-flex items-center gap-1.5">
            <Shield size={12} className="text-gold" /> Machine-readable AI origin mark
          </p>
          <div className="flex gap-2 justify-end">
            <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
            <button
              onClick={handleDownload}
              disabled={loading || downloading || !selectedId}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
            >
              {downloading ? 'Preparing…' : 'Download marked .docx'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
