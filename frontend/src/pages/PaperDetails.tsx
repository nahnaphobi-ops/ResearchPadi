import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { paperService } from '../services/apiService';

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

  if (loading) return <div className="p-8 text-center text-gray-500">Loading paper details...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!paper) return <div className="p-8 text-center text-gray-500">Paper not found</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <button onClick={() => navigate('/dashboard')} className="text-gray-800 font-bold hover:underline mb-6 inline-block">
        &larr; Back to Dashboard
      </button>

      <div className="bg-white rounded-xl shadow border border-gray-100 p-8">
        <h1 className="text-2xl font-bold mb-2">{paper.topic}</h1>
        <p className="text-gray-500 mb-6">{paper.course} &bull; {new Date(paper.created_at).toLocaleDateString()}</p>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div><span className="font-bold text-gray-700">Institution:</span> {paper.institution_name || 'N/A'}</div>
          <div><span className="font-bold text-gray-700">Programme:</span> {paper.programme || 'N/A'}</div>
          <div><span className="font-bold text-gray-700">Supervisor:</span> {paper.supervisor_name || 'N/A'}</div>
          <div><span className="font-bold text-gray-700">Target Words:</span> {paper.target_word_count || 12000}</div>
        </div>

        <div className="mb-6">
          <span className="font-bold text-gray-700 text-sm">Status: </span>
          {paper.status === 'completed' ? (
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">Completed</span>
          ) : paper.status === 'failed' ? (
            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">Failed</span>
          ) : (
            <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold animate-pulse">Processing</span>
          )}
          {paper.progress_step && <span className="text-xs text-gray-500 italic ml-2">{paper.progress_step}</span>}
        </div>

        {paper.abstract && (
          <div className="mb-6">
            <h3 className="font-bold text-gray-700 mb-2">Abstract</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{paper.abstract}</p>
          </div>
        )}

        {paper.status === 'completed' && (
          <button onClick={handleDownload} className="bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 transition">
            Download .docx
          </button>
        )}
      </div>
    </div>
  );
}
