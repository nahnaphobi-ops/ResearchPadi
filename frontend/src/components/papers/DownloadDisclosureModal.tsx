import { useEffect, useState } from 'react';
import { FileText, Shield, X } from 'lucide-react';
import { paperService } from '../../services/apiService';

interface DownloadDisclosureModalProps {
  paperId: string;
  topic: string;
  onClose: () => void;
}

/**
 * Download a study draft. The file always says it was written by AI (a notice
 * at the top, a label on every page and in the file's metadata), so there is
 * nothing to choose here, only an explanation of what the student is getting.
 */
export default function DownloadDisclosureModal({ paperId, topic, onClose }: DownloadDisclosureModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleDownload = async () => {
    setDownloading(true);
    setError('');
    try {
      await paperService.downloadDocx(paperId, topic);
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
        aria-labelledby="download-title"
        className="w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto bg-white rounded-2xl border border-rule shadow-card"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-rule">
          <div>
            <p className="eyebrow mb-1">Study draft</p>
            <h2 id="download-title" className="text-lg font-extrabold text-navy leading-tight">Download your study draft</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:bg-navy-mist" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {error && <div role="alert" className="p-3 text-sm text-red-700 bg-red-50 rounded-xl">{error}</div>}

          <p className="text-sm text-ink leading-relaxed">
            This Word file is clearly marked as written by AI: a notice at the top, a label on every page, and a note in
            the file's details.
          </p>

          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800 mb-2">How to use it</p>
            <ul className="text-sm text-ink leading-relaxed list-disc pl-5 space-y-1">
              <li>Study it to understand your topic and how the chapters fit together.</li>
              <li>Follow up the sources, and check every reference before you use it.</li>
              <li>Write your own paper in your own words. Don't submit this draft, or parts of it, as your work.</li>
            </ul>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-rule flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-[11px] text-muted inline-flex items-center gap-1.5">
            <Shield size={12} className="text-gold" /> Marked as AI-generated
          </p>
          <div className="flex gap-2 justify-end">
            <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <FileText size={14} /> {downloading ? 'Preparing…' : 'Download study draft'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
