import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { paperService } from '../services/apiService';
import { paymentService } from '../services/paymentService';
import { useAuthStore } from '../store/useAuthStore';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import DownloadDisclosureModal from '../components/papers/DownloadDisclosureModal';
import { ArrowUpRight, FileText, Plus, RefreshCw, WalletCards } from 'lucide-react';

export default function Dashboard() {
  const [papers, setPapers] = useState<any[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [downloadTarget, setDownloadTarget] = useState<{ id: string; topic: string; institution?: string } | null>(null);
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

  const handleDownload = (id: string, topic: string, institution?: string) => {
    setDownloadTarget({ id, topic, institution });
  };

  const firstName = user?.full_name?.split(' ')[0] || 'Researcher';

  return (
    <div className="min-h-screen flex flex-col app-shell">
      <Navbar />
      <main className="flex-1 px-5 py-10 lg:px-8 max-w-6xl mx-auto w-full">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
          <div>
            <p className="eyebrow mb-3">Research desk</p>
            <h1 className="display text-4xl lg:text-5xl text-navy">Welcome back, {firstName}.</h1>
            <p className="text-muted mt-3 max-w-xl text-sm leading-relaxed">
              Your papers, writing workspace, and wallet — all in one place. Pick up where you left off or start a new draft.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 self-start lg:self-auto">
            <button
              onClick={() => navigate('/new-paper')}
              className="btn-primary px-5 py-3 text-sm inline-flex items-center gap-2"
            >
              <Plus size={17} /> New AI paper
            </button>
            <button
              onClick={() => navigate('/workspace')}
              className="btn-ghost px-5 py-3 text-sm inline-flex items-center gap-2"
            >
              Open workspace
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          <div className="p-6 bg-brand text-white rounded-2xl relative overflow-hidden">
            <div className="absolute -right-6 -top-8 w-28 h-28 rounded-full border border-white/10" />
            <div className="absolute -left-4 bottom-0 w-20 h-20 rounded-full bg-white/5" />
            <div className="flex items-center justify-between mb-5 relative z-10">
              <h3 className="text-sm font-medium text-white/65">Wallet balance</h3>
              <WalletCards size={18} className="text-white/50" />
            </div>
            <p className="display text-3xl relative z-10">GHS {walletBalance.toFixed(2)}</p>
            <button
              onClick={() => navigate('/wallet')}
              className="mt-5 text-sm font-bold text-brand bg-white px-3.5 py-2 rounded-[10px] hover:bg-brand-soft transition inline-flex items-center gap-1 relative z-10"
            >
              Manage <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="p-6 bg-white rounded-[14px] border border-rule">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-medium text-muted">Papers completed</h3>
              <FileText size={18} className="text-brand" />
            </div>
            <p className="display text-3xl text-navy">
              {papers.filter(p => p.status === 'completed').length}
              <span className="text-sm text-muted font-normal ml-2 tracking-normal">total</span>
            </p>
          </div>
          <div className="p-6 bg-white rounded-[14px] border border-rule">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-medium text-muted">In progress</h3>
              <span className="status-dot" />
            </div>
            <p className="display text-3xl text-navy">
              {papers.filter(p => p.status === 'processing').length}
              <span className="text-sm text-muted font-normal ml-2 tracking-normal">generating</span>
            </p>
          </div>
          <div className="p-6 bg-navy-mist rounded-[14px] border border-rule flex flex-col justify-between">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-medium text-muted">Writing workspace</h3>
              <ArrowUpRight size={18} className="text-brand" />
            </div>
            <p className="text-sm text-navy font-semibold leading-snug mb-4">AI-assisted writing, citations &amp; quality checks — all in one tab.</p>
            <button
              onClick={() => navigate('/workspace')}
              className="btn-primary px-3.5 py-2 text-sm inline-flex items-center gap-1 self-start"
            >
              Open workspace <ArrowUpRight size={14} />
            </button>
          </div>
        </div>

        <div className="flex items-end justify-between mb-5">
          <div>
            <p className="eyebrow mb-1">Paper library</p>
            <h2 className="display text-3xl text-navy">Your research papers</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted inline-flex items-center gap-1.5">
              <RefreshCw size={12} /> auto-refreshes every 10s
            </span>
            <button onClick={() => navigate('/new-paper')} className="btn-primary px-4 py-2 text-xs inline-flex items-center gap-1.5">
              <Plus size={14} /> New paper
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[14px] border border-rule overflow-hidden">
          {loading ? (
            <div className="p-14 text-center text-muted">
              <div className="mx-auto mb-3 w-8 h-8 border-2 border-rule border-t-navy rounded-full animate-spin" />
              Loading your research history...
            </div>
          ) : papers.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-16 h-16 bg-brand-soft rounded-2xl grid place-items-center mx-auto mb-5">
                <FileText className="text-brand" size={28} />
              </div>
              <p className="mb-2 text-lg font-bold text-navy">No papers yet</p>
              <p className="text-sm text-muted mb-6 max-w-xs mx-auto">Provide a topic and brief — ResearchPadi will generate a complete, supervisor-ready draft.</p>
              <button onClick={() => navigate('/new-paper')} className="btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2">
                <Plus size={15} /> Generate your first paper
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-navy-mist text-muted uppercase text-[11px] font-bold tracking-wider">
                <tr>
                  <th className="p-4 border-b border-rule">Topic</th>
                  <th className="p-4 border-b border-rule">Status</th>
                  <th className="p-4 border-b border-rule text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {papers.map((paper) => (
                  <tr key={paper.id} className="hover:bg-navy-mist transition">
                    <td className="p-4">
                      <div className="font-bold text-ink">{paper.topic}</div>
                      <div className="text-xs text-muted mt-0.5">{paper.course} · {new Date(paper.created_at).toLocaleDateString()}</div>
                    </td>
                    <td className="p-4">
                      {paper.status === 'completed' ? (
                        <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold">Completed</span>
                      ) : paper.status === 'failed' ? (
                        <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-bold">Failed</span>
                      ) : (
                        <div className="flex flex-col">
                          <span className="px-2.5 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs font-bold inline-block w-fit mb-1 animate-pulse">Processing</span>
                          <span className="text-[10px] text-muted italic">{paper.progress_step}</span>
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
                            onClick={() => handleDownload(paper.id, paper.topic, paper.institution_name)}
                            className="bg-green-600 text-white px-3.5 py-2 rounded-[10px] text-sm font-bold hover:bg-green-700 transition"
                          >
                            Download
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => navigate(`/papers/${paper.id}`)}
                          className="text-navy text-sm font-bold hover:underline"
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
      {downloadTarget && (
        <DownloadDisclosureModal
          paperId={downloadTarget.id}
          topic={downloadTarget.topic}
          institutionName={downloadTarget.institution}
          onClose={() => setDownloadTarget(null)}
        />
      )}
    </div>
  );
}
