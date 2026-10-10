import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { paperService } from '../services/apiService';
import { paymentService } from '../services/paymentService';
import { useAuthStore } from '../store/useAuthStore';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import DownloadDisclosureModal from '../components/papers/DownloadDisclosureModal';
import PaperStatusBadge from '../components/papers/PaperStatusBadge';
import { ArrowUpRight, Download, FileText, Plus, RefreshCw, WalletCards } from 'lucide-react';
import type { Paper } from '../types';

export default function Dashboard() {
  const [papers, setPapers] = useState<Paper[]>([]);
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
      setWalletBalance(response.data.balance ?? 0);
    } catch {
      // Wallet may not exist yet for new users
    }
  };

  useEffect(() => {
    let ignore = false;
    (async () => {
      await Promise.allSettled([fetchPapers(), fetchWallet()]);
      if (ignore) return;
    })();
    return () => { ignore = true; };
  }, []);

  // Only poll while a paper is still generating, and pause while the tab is hidden.
  const hasPaperInProgress = papers.some(p => p.status !== 'completed' && p.status !== 'failed');
  useEffect(() => {
    if (!hasPaperInProgress) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchPapers();
    }, 10000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchPapers();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [hasPaperInProgress]);

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
              {papers.filter(p => p.status !== 'completed' && p.status !== 'failed').length}
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
          {hasPaperInProgress && (
            <span className="text-xs text-muted inline-flex items-center gap-1.5">
              <RefreshCw size={12} className="animate-spin [animation-duration:3s]" /> Updating automatically
            </span>
          )}
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
            <ul className="divide-y divide-rule">
              <li className="hidden md:grid grid-cols-[1fr_160px_220px] gap-4 px-5 py-3 bg-navy-mist text-muted uppercase text-[11px] font-bold tracking-wider">
                <span>Topic</span>
                <span>Status</span>
                <span className="text-right">Action</span>
              </li>
              {papers.map((paper) => (
                <li key={paper.id} className="grid grid-cols-1 md:grid-cols-[1fr_160px_220px] gap-3 md:gap-4 md:items-center px-5 py-4 hover:bg-navy-mist transition">
                  <div className="min-w-0">
                    <button onClick={() => navigate(`/papers/${paper.id}`)} className="font-bold text-ink text-left hover:text-brand transition">
                      {paper.topic}
                    </button>
                    <div className="text-xs text-muted mt-0.5">
                      {[paper.course, new Date(paper.created_at).toLocaleDateString()].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <PaperStatusBadge status={paper.status} />
                    {paper.status !== 'completed' && paper.status !== 'failed' && paper.progress_step && (
                      <span className="text-[11px] text-muted">{paper.progress_step}</span>
                    )}
                  </div>
                  <div className="flex gap-2 md:justify-end">
                    {paper.status === 'completed' ? (
                      <>
                        <button
                          onClick={() => navigate(`/papers/${paper.id}/review`)}
                          className="btn-primary px-3.5 py-2 text-sm"
                        >
                          Review
                        </button>
                        <button
                          onClick={() => handleDownload(paper.id, paper.topic, paper.institution_name)}
                          className="btn-ghost px-3.5 py-2 text-sm inline-flex items-center gap-1.5"
                        >
                          <Download size={14} /> Download
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => navigate(`/papers/${paper.id}`)}
                        className="text-brand text-sm font-bold hover:underline"
                      >
                        View details
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
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
