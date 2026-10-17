import { useEffect, useState } from 'react';
import { apiErrorMessage } from '../utils/apiError';
import { useParams, useNavigate } from 'react-router-dom';
import { paperService } from '../services/apiService';
import DownloadDisclosureModal from '../components/papers/DownloadDisclosureModal';
import ReferenceCheck from '../components/papers/ReferenceCheck';
import type { Paper } from '../types';
import {
  AlertTriangle, BookOpen, CheckCircle, Download, ArrowLeft, RefreshCw,
} from 'lucide-react';

type Tab = 'original' | 'supervised';

export default function PaperReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [paper, setPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Supervisor
  const [supervising, setSupervising] = useState(false);
  const [supervised, setSupervised] = useState<string | null>(null);

  const [showDownload, setShowDownload] = useState(false);

  // Active tab
  const [tab, setTab] = useState<Tab>('original');

  useEffect(() => {
    if (!id) return;
    paperService.getPaperDetails(id)
      .then(res => { setPaper(res.data); })
      .catch(() => setError('Failed to load paper'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSupervise = async () => {
    if (!id) return;
    setSupervising(true);
    setError('');
    try {
      const { data } = await paperService.supervisePaper(id);
      setSupervised(data.supervised);
      setTab('supervised');
      setPaper((p) => (p ? { ...p, resupervised_at: new Date().toISOString() } : p));
    } catch (err) {
      setError(apiErrorMessage(err, 'Supervision failed'));
    } finally {
      setSupervising(false);
    }
  };

  const handleAccept = async () => {
    if (!id || !supervised) return;
    try {
      await paperService.acceptSupervision(id, supervised);
      navigate('/dashboard');
    } catch {
      setError('Failed to save changes');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-mist">
        <div className="text-center text-muted">
          <div className="mx-auto mb-3 w-8 h-8 border-2 border-rule border-t-navy rounded-full animate-spin" />
          Loading paper...
        </div>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-mist px-5">
        <div className="bg-white rounded-[14px] border border-rule p-10 text-center max-w-md w-full">
          <p className="font-bold text-navy mb-1">{error ? 'Something went wrong' : 'Paper not found'}</p>
          <p className="text-sm text-muted mb-6">{error || 'This paper may have been removed, or the link is wrong.'}</p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary px-5 py-2.5 text-sm">Back to dashboard</button>
        </div>
      </div>
    );
  }

  const content = tab === 'supervised' && supervised ? supervised : paper.final_content || '';

  const tabs: { key: Tab; label: string; available: boolean }[] = [
    { key: 'original', label: 'Original', available: true },
    { key: 'supervised', label: 'AI Supervised', available: !!supervised },
  ];

  return (
    <div className="min-h-screen bg-navy-mist">
      {/* Top bar */}
      <div className="bg-navy text-white sticky top-0 z-20 shadow-card">
        <div className="max-w-6xl mx-auto px-3 sm:px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-white/70 hover:text-white shrink-0 flex items-center gap-1 text-sm font-medium"
            >
              <ArrowLeft size={15} /> Dashboard
            </button>
            <span className="text-white/30">|</span>
            <h1 className="text-sm font-bold truncate max-w-xs sm:max-w-md">{paper.topic}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {!supervised && paper.status === 'completed' && !paper.resupervised_at && (
              <button
                onClick={handleSupervise}
                disabled={supervising}
                title="One extra supervisor review is included with each paper"
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-[10px] font-bold text-xs transition border border-white/20 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <RefreshCw size={13} className={supervising ? 'animate-spin' : ''} />
                {supervising ? 'Running Supervisor...' : 'AI Supervisor Review'}
              </button>
            )}
            {supervised && (
              <button
                onClick={handleAccept}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-[10px] font-bold text-xs transition inline-flex items-center gap-1.5"
              >
                <CheckCircle size={13} /> Accept & Save
              </button>
            )}
            {paper.status === 'completed' && (
              <button
                onClick={() => setShowDownload(true)}
                className="px-4 py-2 bg-white text-navy rounded-[10px] font-bold text-xs hover:bg-brand-soft transition inline-flex items-center gap-1.5"
              >
                <Download size={13} /> Download .docx
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Main content area */}
        <div>
          {error && (
            <div role="alert" className="p-4 mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {/* Tab switcher */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {tabs.filter(t => t.available).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 rounded-[10px] text-sm font-bold transition ${
                  tab === t.key
                    ? 'bg-navy text-white'
                    : 'bg-white text-ink border border-rule hover:bg-navy-mist'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Paper content */}
          <div className="bg-white rounded-[14px] shadow-soft border border-rule p-5 sm:p-8">
            <div className="prose max-w-none whitespace-pre-wrap font-serif text-ink leading-relaxed text-sm">
              {content || <span className="text-muted italic">No content available</span>}
            </div>
          </div>

          {!paper.final_content && paper.status !== 'completed' && (
            <div className="mt-6 p-6 bg-orange-50 border border-orange-200 rounded-[14px] text-center">
              <p className="text-orange-700 font-bold mb-1">Paper is still being processed</p>
              <p className="text-orange-600 text-sm mb-4">Current step: {paper.progress_step}</p>
              <button onClick={() => navigate('/dashboard')} className="text-navy font-bold text-sm hover:underline">
                ← Back to Dashboard
              </button>
            </div>
          )}
        </div>

        {/* Right sidebar: how to use the draft and what the reference check found */}
        <aside className="space-y-4">
          <div className="bg-white rounded-[14px] border border-rule p-5 shadow-soft">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen size={16} className="text-brand" />
              <h2 className="text-sm font-extrabold text-navy">This is a study draft</h2>
            </div>
            <p className="text-xs text-muted leading-relaxed mb-3">
              It was researched and written by AI from your brief. Use it to learn, then write your own paper.
            </p>
            <ol className="text-xs text-ink leading-relaxed list-decimal pl-4 space-y-1.5">
              <li>Read it to understand the topic and how each chapter builds on the last.</li>
              <li>Follow up the sources it uses, and check every reference before you rely on it.</li>
              <li>Write your paper in your own words. The Workspace can help you with that.</li>
            </ol>
            <p className="text-[11px] text-muted leading-relaxed mt-3">
              Don't submit this draft, or parts of it, as your own work. Most universities treat that as misconduct, and the downloaded file is marked as AI-written on every page.
            </p>
          </div>

          <ReferenceCheck paper={paper} />
        </aside>
      </div>
      {showDownload && id && (
        <DownloadDisclosureModal
          paperId={id}
          topic={paper.topic}
          onClose={() => setShowDownload(false)}
        />
      )}
    </div>
  );
}
