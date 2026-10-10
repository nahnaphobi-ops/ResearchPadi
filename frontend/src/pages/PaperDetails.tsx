import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { paperService } from '../services/apiService';
import AppShell from '../components/layout/AppShell';
import DownloadDisclosureModal from '../components/papers/DownloadDisclosureModal';
import PaperStatusBadge from '../components/papers/PaperStatusBadge';
import { ArrowLeft, Download, FileSearch } from 'lucide-react';
import type { Paper } from '../types';

export default function PaperDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [paper, setPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDownload, setShowDownload] = useState(false);

  useEffect(() => {
    if (!id) return;
    paperService.getPaperDetails(id)
      .then(res => setPaper(res.data))
      .catch(() => setError('Failed to load paper details'))
      .finally(() => setLoading(false));
  }, [id]);

  // Keep the status fresh while the paper is still generating.
  const inProgress = !!paper && paper.status !== 'completed' && paper.status !== 'failed';
  useEffect(() => {
    if (!id || !inProgress) return;
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      paperService.getPaperDetails(id).then(res => setPaper(res.data)).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [id, inProgress]);

  const backLink = (
    <button onClick={() => navigate('/dashboard')} className="text-sm text-muted hover:text-navy font-medium inline-flex items-center gap-1.5 mb-6">
      <ArrowLeft size={15} /> Back to dashboard
    </button>
  );

  if (loading) {
    return (
      <AppShell>
        <div className="py-16 text-center text-muted">
          <div className="mx-auto mb-3 w-8 h-8 border-2 border-rule border-t-brand rounded-full animate-spin" />
          Loading paper details...
        </div>
      </AppShell>
    );
  }
  if (error || !paper) {
    return (
      <AppShell>
        {backLink}
        <div className="bg-white rounded-[14px] border border-rule p-10 text-center">
          <p className="font-bold text-navy mb-1">{error ? 'Something went wrong' : 'Paper not found'}</p>
          <p className="text-sm text-muted">{error || 'This paper may have been removed, or the link is wrong.'}</p>
        </div>
      </AppShell>
    );
  }

  const details = [
    { label: 'Institution', value: paper.institution_name },
    { label: 'Programme', value: paper.programme },
    { label: 'Supervisor', value: paper.supervisor_name },
    { label: 'Target words', value: (paper.target_word_count || 12000).toLocaleString() },
  ];

  return (
    <AppShell>
      {backLink}

      <div className="bg-white rounded-[14px] border border-rule p-6 sm:p-8 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2">
          <h1 className="text-2xl font-bold text-navy">{paper.topic}</h1>
          <PaperStatusBadge status={paper.status} className="shrink-0 self-start" />
        </div>
        <p className="text-muted mb-6">{[paper.course, new Date(paper.created_at).toLocaleDateString()].filter(Boolean).join(' · ')}</p>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mb-6 text-sm">
          {details.map((d) => (
            <div key={d.label}>
              <dt className="text-muted">{d.label}</dt>
              <dd className="font-semibold text-ink">{d.value || '—'}</dd>
            </div>
          ))}
        </dl>

        {inProgress && (
          <div className="mb-6 p-4 rounded-xl bg-orange-50 border border-orange-200 text-sm">
            <p className="font-bold text-orange-700">Your paper is being written</p>
            <p className="text-orange-700">{paper.progress_step || 'Working on it'} · this page updates automatically.</p>
          </div>
        )}
        {paper.status === 'failed' && (
          <div className="mb-6 p-4 rounded-xl bg-red-100 text-sm text-red-700">
            Generation failed{paper.progress_step ? `: ${paper.progress_step}` : ''}. Contact hello@researchpadi.com and we'll sort it out.
          </div>
        )}

        {paper.abstract && (
          <div className="mb-6">
            <h3 className="font-bold text-navy mb-2">Abstract</h3>
            <p className="text-sm text-muted leading-relaxed">{paper.abstract}</p>
          </div>
        )}

        {paper.status === 'completed' && (
          <div className="flex flex-wrap gap-3">
            <button onClick={() => navigate(`/papers/${paper.id}/review`)} className="btn-primary px-5 py-3 text-sm inline-flex items-center gap-2">
              <FileSearch size={16} /> Review paper
            </button>
            <button onClick={() => setShowDownload(true)} className="btn-ghost px-5 py-3 text-sm inline-flex items-center gap-2">
              <Download size={16} /> Download .docx
            </button>
          </div>
        )}
      </div>
      {showDownload && id && (
        <DownloadDisclosureModal
          paperId={id}
          topic={paper.topic}
          institutionName={paper.institution_name}
          onClose={() => setShowDownload(false)}
        />
      )}
    </AppShell>
  );
}
