import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { paperService } from '../services/apiService';
import { paymentService } from '../services/paymentService';
import { useAuthStore } from '../store/useAuthStore';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

export default function Dashboard() {
  const [papers, setPapers] = useState<any[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const navigate = useNavigate();

  const fetchPapers = async () => {
    try {
      const response = await paperService.listPapers();
      setPapers(response.data);
    } catch {
      console.error('Failed to fetch papers');
    } finally {
      setLoading(false);
    }
  };

  const fetchWallet = async () => {
    try {
      const response = await paymentService.getWallet();
      setWalletBalance(response.data.balance_ghs ?? 0);
    } catch {
      // Wallet may not exist yet for new users
    }
  };

  useEffect(() => {
    fetchPapers();
    fetchWallet();
    const interval = setInterval(() => {
      fetchPapers();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleDownload = async (id: string, topic: string) => {
    try {
      await paperService.downloadDocx(id, topic);
    } catch (err) {
      alert('Download failed');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <div className="flex-1 p-8 max-w-6xl mx-auto w-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Hello, {user?.full_name?.split(' ')[0] || 'Researcher'}</h1>
          <p className="text-gray-600">Welcome back to ResearchPadi Dashboard.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/new-paper')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-md"
          >
            + New Research Paper
          </button>
          <button 
            onClick={() => { logout(); navigate('/login'); }}
            className="bg-gray-200 text-gray-700 px-4 py-3 rounded-lg font-bold hover:bg-gray-300 transition"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl shadow-lg">
          <h3 className="font-medium opacity-80">Wallet Balance</h3>
          <p className="text-3xl font-bold">GHS {walletBalance.toFixed(2)}</p>
          <button onClick={() => navigate('/wallet')} className="mt-4 text-sm font-bold bg-white/20 px-3 py-1 rounded hover:bg-white/30 transition">Top Up</button>
        </div>
        <div className="p-6 bg-white rounded-xl shadow border border-gray-100">
          <h3 className="font-medium text-gray-500">Papers Completed</h3>
          <p className="text-3xl font-bold">{papers.filter(p => p.status === 'completed').length}</p>
        </div>
        <div className="p-6 bg-white rounded-xl shadow border border-gray-100">
          <h3 className="font-medium text-gray-500">Active Pipeline</h3>
          <p className="text-3xl font-bold text-orange-500">{papers.filter(p => p.status === 'processing').length}</p>
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-4">Your Papers</h2>
      <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-100">
        {loading ? (
          <div className="p-10 text-center text-gray-500">Loading your research history...</div>
        ) : papers.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            <p className="mb-4 text-lg">You haven't started any research papers yet.</p>
            <button onClick={() => navigate('/new-paper')} className="text-blue-600 font-bold hover:underline">Start your first paper →</button>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold">
              <tr>
                <th className="p-4 border-b">Topic</th>
                <th className="p-4 border-b">Status</th>
                <th className="p-4 border-b text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {papers.map((paper) => (
                <tr key={paper.id} className="hover:bg-gray-50 transition">
                  <td className="p-4">
                    <div className="font-bold text-gray-800">{paper.topic}</div>
                    <div className="text-xs text-gray-500">{paper.course} • {new Date(paper.created_at).toLocaleDateString()}</div>
                  </td>
                  <td className="p-4">
                    {paper.status === 'completed' ? (
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">Completed</span>
                    ) : paper.status === 'failed' ? (
                      <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">Failed</span>
                    ) : (
                      <div className="flex flex-col">
                        <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold inline-block w-fit mb-1 animate-pulse">Processing</span>
                        <span className="text-[10px] text-gray-500 italic">{paper.progress_step}</span>
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    {paper.status === 'completed' ? (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => navigate(`/papers/${paper.id}/review`)}
                          className="bg-purple-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-purple-700 transition"
                        >
                          Review
                        </button>
                        <button
                          onClick={() => handleDownload(paper.id, paper.topic)}
                          className="bg-green-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-green-700 transition"
                        >
                          Download
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => navigate(`/papers/${paper.id}`)}
                        className="text-blue-600 text-sm font-bold hover:underline"
                      >
                        View Details
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </div>
      <Footer />
    </div>
  );
}
