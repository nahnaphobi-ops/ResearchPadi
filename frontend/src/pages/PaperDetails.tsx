import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { paperService } from '../services/apiService';
import AppShell from '../components/layout/AppShell';

export default function PaperDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [paper, setPaper] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    paperService.getPaperDetails(id)
      .then(res => setPaper(res.data))
      .catch(() => setError('Failed to load paper details'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDownload = async () => {
    if (!id || !paper) return;
    try {
      await paperService.downloadDocx(id, paper.topic);
    } catch {
      alert('Download failed');
    }
  };

  if (loading) {
    return (
      <AppShell>
        <p className="text-center text-muted">Loading paper details...</p>
      </AppShell>
    );
  }
  if (error) {
    return (
      <AppShell>
        <p className="text-center text-red-500">{error}</p>
      </AppShell>
    );
  }
  if (!paper) {
    return (
      <AppShell>
        <p className="text-center text-muted">Paper not found</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <button onClick={() => navigate('/dashboard')} className="text-navy font-bold hover:underline mb-6 inline-block">
        &larr; Back to Dashboard
      </button>

      <div className="bg-white rounded-[14px] border border-rule p-8 shadow-soft">
        <h1 className="text-2xl font-bold mb-2 text-navy">{paper.topic}</h1>
        <p className="text-muted mb-6">{paper.course} &bull; {new Date(paper.created_at).toLocaleDateString()}</p>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div><span className="font-bold text-ink">Institution:</span> {paper.institution_name || 'N/A'}</div>
          <div><span className="font-bold text-ink">Programme:</span> {paper.programme || 'N/A'}</div>
          <div><span className="font-bold text-ink">Supervisor:</span> {paper.supervisor_name || 'N/A'}</div>
          <div><span className="font-bold text-ink">Target Words:</span> {paper.target_word_count || 12000}</div>
        </div>

        <div className="mb-6">
          <span className="font-bold text-ink text-sm">Status: </span>
          {paper.status === 'completed' ? (
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">Completed</span>
          ) : paper.status === 'failed' ? (
            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">Failed</span>
          ) : (
            <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold animate-pulse">Processing</span>
          )}
          {paper.progress_step && <span className="text-xs text-muted italic ml-2">{paper.progress_step}</span>}
        </div>

        {paper.abstract && (
          <div className="mb-6">
            <h3 className="font-bold text-navy mb-2">Abstract</h3>
            <p className="text-sm text-muted leading-relaxed">{paper.abstract}</p>
          </div>
        )}

        {paper.status === 'completed' && (
          <button onClick={handleDownload} className="bg-green-600 text-white px-6 py-3 rounded-[10px] font-bold hover:bg-green-700 transition">
            Download .docx
          </button>
        )}
      </div>
    </AppShell>
  );
}
