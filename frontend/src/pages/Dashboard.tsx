import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { paperService } from '../services/apiService';
import { paymentService } from '../services/paymentService';
import { useAuthStore } from '../store/useAuthStore';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { ArrowUpRight, FileText, Plus, RefreshCw, WalletCards } from 'lucide-react';

export default function Dashboard() {
  const [papers, setPapers] = useState<any[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore(state => state.user);
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
    } catch {
      alert('Download failed');
    }
  };

  const firstName = user?.full_name?.split(' ')[0] || 'Researcher';

  return (
    <div className="min-h-screen flex flex-col app-shell">
      <Navbar />
      <main className="flex-1 px-5 py-10 lg:px-8 max-w-6xl mx-auto w-full">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
          <div>
            <p className="eyebrow mb-3">Research desk</p>
            <h1 className="display text-4xl lg:text-5xl text-[#0f172a]">Good to see you, {firstName}.</h1>
            <p className="text-[#64748b] mt-3 max-w-xl text-sm leading-relaxed">
              Pick up where you left off, or start something new. Papers, writing sessions, and wallet live here.
            </p>
          </div>
          <button
            onClick={() => navigate('/new-paper')}
            className="btn-primary px-5 py-3 text-sm inline-flex items-center gap-2 self-start lg:self-auto"
          >
            <Plus size={17} /> New research paper
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <div className="p-6 bg-[#2563eb] text-white rounded-2xl relative overflow-hidden">
            <div className="absolute -right-6 -top-8 w-28 h-28 rounded-full border border-white/10" />
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-medium text-white/65">Available balance</h3>
              <WalletCards size={18} className="text-white/50" />
            </div>
            <p className="display text-3xl">GHS {walletBalance.toFixed(2)}</p>
            <button
              onClick={() => navigate('/wallet')}
              className="mt-5 text-sm font-bold text-[#2563eb] bg-white px-3.5 py-2 rounded-xl hover:bg-[#dbeafe] transition inline-flex items-center gap-1"
            >
              Manage wallet <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="p-6 bg-white rounded-2xl border border-[#e2e8f0]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-medium text-[#64748b]">Completed</h3>
              <FileText size={18} className="text-[#2563eb]" />
            </div>
            <p className="display text-3xl text-[#0f172a]">
              {papers.filter(p => p.status === 'completed').length}
              <span className="text-sm text-[#94a3b8] font-normal ml-2 tracking-normal" style={{ fontFamily: 'Atkinson Hyperlegible, sans-serif' }}>all time</span>
            </p>
          </div>
          <div className="p-6 bg-white rounded-2xl border border-[#e2e8f0]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-medium text-[#64748b]">In progress</h3>
              <span className="status-dot" />
            </div>
            <p className="display text-3xl text-[#2563eb]">
              {papers.filter(p => p.status === 'processing').length}
              <span className="text-sm text-[#94a3b8] font-normal ml-2 tracking-normal" style={{ fontFamily: 'Atkinson Hyperlegible, sans-serif' }}>active</span>
            </p>
          </div>
        </div>

        <div className="flex items-end justify-between mb-5">
          <div>
            <p className="eyebrow mb-1">Library</p>
            <h2 className="display text-3xl text-[#0f172a]">Your papers</h2>
          </div>
          <span className="text-xs text-[#94a3b8] inline-flex items-center gap-1.5">
            <RefreshCw size={12} /> updates every 10s
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden">
          {loading ? (
            <div className="p-14 text-center text-[#64748b]">
              <div className="mx-auto mb-3 w-8 h-8 border-2 border-[#e2e8f0] border-t-[#2563eb] rounded-full animate-spin" />
              Loading your research history...
            </div>
          ) : papers.length === 0 ? (
            <div className="p-14 text-center text-[#64748b]">
              <FileText className="mx-auto mb-4 text-[#2563eb]" size={28} />
              <p className="mb-4 text-lg text-[#0f172a]">You haven&apos;t started any research papers yet.</p>
              <button onClick={() => navigate('/new-paper')} className="text-[#2563eb] font-bold hover:underline">
                Start your first paper →
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#f4f7fc] text-[#64748b] uppercase text-[11px] font-bold tracking-wider">
                <tr>
                  <th className="p-4 border-b border-[#e2e8f0]">Topic</th>
                  <th className="p-4 border-b border-[#e2e8f0]">Status</th>
                  <th className="p-4 border-b border-[#e2e8f0] text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {papers.map((paper) => (
                  <tr key={paper.id} className="hover:bg-[#f4f7fc] transition">
                    <td className="p-4">
                      <div className="font-bold text-[#0f172a]">{paper.topic}</div>
                      <div className="text-xs text-[#64748b] mt-0.5">{paper.course} · {new Date(paper.created_at).toLocaleDateString()}</div>
                    </td>
                    <td className="p-4">
                      {paper.status === 'completed' ? (
                        <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold">Completed</span>
                      ) : paper.status === 'failed' ? (
                        <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-bold">Failed</span>
                      ) : (
                        <div className="flex flex-col">
                          <span className="px-2.5 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs font-bold inline-block w-fit mb-1 animate-pulse">Processing</span>
                          <span className="text-[10px] text-[#94a3b8] italic">{paper.progress_step}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {paper.status === 'completed' ? (
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => navigate(`/papers/${paper.id}/review`)}
                            className="btn-primary px-3.5 py-2 text-sm"
                          >
                            Review
                          </button>
                          <button
                            onClick={() => handleDownload(paper.id, paper.topic)}
                            className="bg-green-600 text-white px-3.5 py-2 rounded-xl text-sm font-bold hover:bg-green-700 transition"
                          >
                            Download
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => navigate(`/papers/${paper.id}`)}
                          className="text-[#2563eb] text-sm font-bold hover:underline"
                        >
                          View details
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
