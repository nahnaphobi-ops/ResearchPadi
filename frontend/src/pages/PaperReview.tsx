import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { paperService } from '../services/apiService';

export default function PaperReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [paper, setPaper] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [supervising, setSupervising] = useState(false);
  const [supervised, setSupervised] = useState<string | null>(null);
  const [tab, setTab] = useState<'original' | 'supervised'>('original');
  const [error, setError] = useState('');

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
    } catch (err: any) {
      setError(err.response?.data?.error || 'Supervision failed');
    } finally {
      setSupervising(false);
    }
  };

  const handleAccept = async () => {
    if (!id || !supervised) return;
    try {
      await paperService.acceptSupervision(id, supervised);
      alert('Supervised version accepted!');
      navigate('/dashboard');
    } catch {
      setError('Failed to accept revision');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading paper...</div>;
  }

  if (!paper) {
    return <div className="p-8 text-center text-red-500">Paper not found</div>;
  }

  const content = tab === 'supervised' && supervised ? supervised : paper.final_content || '';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="text-gray-500 hover:text-gray-800">&larr; Dashboard</button>
            <h1 className="text-lg font-bold truncate max-w-md">{paper.topic}</h1>
          </div>
          <div className="flex items-center gap-3">
            {!supervised && (
              <button
                onClick={handleSupervise}
                disabled={supervising}
                className="px-5 py-2 bg-gray-800 text-white rounded-lg font-bold text-sm hover:bg-gray-900 disabled:bg-gray-400"
              >
                {supervising ? 'Running Review...' : 'Run AI Supervisor Review'}
              </button>
            )}
            {supervised && (
              <>
                <button
                  onClick={handleAccept}
                  className="px-5 py-2 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700"
                >
                  Accept & Save
                </button>
                <button
                  onClick={() => paperService.downloadDocx(id!, paper.topic)}
                  className="px-5 py-2 bg-gray-800 text-white rounded-lg font-bold text-sm hover:bg-gray-900"
                >
                  Download
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-6">
        {error && <div className="p-4 mb-6 bg-red-100 text-red-700 rounded-lg">{error}</div>}

        {supervised && (
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setTab('original')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition ${tab === 'original' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              Original
            </button>
            <button
              onClick={() => setTab('supervised')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition ${tab === 'supervised' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              Supervised {tab === 'supervised' && <span className="ml-1 text-yellow-300">&#9679;</span>}
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl shadow border border-gray-100 p-8">
          <div className="prose max-w-none whitespace-pre-wrap font-serif text-gray-800 leading-relaxed text-sm">
            {content || <span className="text-gray-400 italic">No content available</span>}
          </div>
        </div>

        {!paper.final_content && paper.status !== 'completed' && (
          <div className="mt-6 p-6 bg-orange-50 border border-orange-200 rounded-xl text-center">
            <p className="text-orange-700 font-bold mb-2">Paper is still being processed</p>
            <p className="text-orange-600 text-sm">Current step: {paper.progress_step}</p>
            <button onClick={() => navigate('/dashboard')} className="mt-4 text-gray-800 font-bold text-sm hover:underline">
              Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}