import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { paperService } from '../services/apiService';
import DownloadDisclosureModal from '../components/papers/DownloadDisclosureModal';
import {
  AlertTriangle, CheckCircle, ChevronDown, ChevronUp,
  Download, Sparkles, Wand2, ArrowLeft, RefreshCw,
} from 'lucide-react';

interface AIIndicator {
  type: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  evidence: string;
}

interface AIScore {
  isLikelyAI: boolean;
  confidence: number;
  aiScore: number;
  humanScore: number;
  indicators: AIIndicator[];
  recommendation: string;
}

interface HumanizeResult {
  humanized: string;
  beforeScore: AIScore;
  afterScore: AIScore;
}

type Tab = 'original' | 'supervised' | 'humanized';

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const humanScore = 100 - score;
  const color =
    score >= 70 ? '#FF4B4B' :
    score >= 45 ? '#F5C400' :
    '#16a34a';
  const bg =
    score >= 70 ? 'bg-red-50 border-red-200' :
    score >= 45 ? 'bg-yellow-50 border-yellow-200' :
    'bg-green-50 border-green-200';

  return (
    <div className={`rounded-xl border p-4 ${bg}`}>
      <p className="text-xs font-bold text-muted uppercase tracking-wide mb-3">{label}</p>
      <div className="flex items-end gap-4 mb-3">
        <div className="text-center">
          <p className="text-2xl font-extrabold" style={{ color }}>{score}%</p>
          <p className="text-[10px] text-muted font-medium mt-0.5">AI patterns</p>
        </div>
        <div className="flex-1 h-3 bg-white rounded-full overflow-hidden border border-rule">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${score}%`, background: color }}
          />
        </div>
        <div className="text-center">
          <p className="text-2xl font-extrabold text-navy">{humanScore}%</p>
          <p className="text-[10px] text-muted font-medium mt-0.5">Natural</p>
        </div>
      </div>
    </div>
  );
}

function IndicatorList({ indicators }: { indicators: AIIndicator[] }) {
  const [open, setOpen] = useState(false);
  if (!indicators.length) return null;

  const severityColor = (s: string) =>
    s === 'high' ? 'text-red-600 bg-red-50 border-red-200' :
    s === 'medium' ? 'text-yellow-700 bg-yellow-50 border-yellow-200' :
    'text-green-700 bg-green-50 border-green-200';

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs font-bold text-muted hover:text-navy transition"
      >
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {indicators.length} pattern{indicators.length !== 1 ? 's' : ''} detected
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5">
          {indicators.map((ind, i) => (
            <li key={i} className={`rounded-lg border px-3 py-2 text-xs ${severityColor(ind.severity)}`}>
              <span className="font-bold">{ind.type}</span> — {ind.evidence}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PaperReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [paper, setPaper] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Supervisor
  const [supervising, setSupervising] = useState(false);
  const [supervised, setSupervised] = useState<string | null>(null);

  // Humanizer
  const [humanizing, setHumanizing] = useState(false);
  const [humanizeResult, setHumanizeResult] = useState<HumanizeResult | null>(null);

  // AI score panel
  const [aiScore, setAiScore] = useState<AIScore | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);
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
    } catch (err: any) {
      setError(err.response?.data?.error || 'Supervision failed');
    } finally {
      setSupervising(false);
    }
  };

  const handleAccept = async () => {
    if (!id) return;
    const contentToSave =
      tab === 'humanized' && humanizeResult ? humanizeResult.humanized :
      tab === 'supervised' && supervised ? supervised :
      paper?.final_content;
    if (!contentToSave) return;
    try {
      await paperService.acceptSupervision(id, contentToSave);
      navigate('/dashboard');
    } catch {
      setError('Failed to save changes');
    }
  };

  const handleGetScore = async () => {
    if (!id) return;
    setScoreLoading(true);
    try {
      const { data } = await paperService.getAiScore(id);
      setAiScore(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not compute score');
    } finally {
      setScoreLoading(false);
    }
  };

  const handleHumanize = async () => {
    if (!id) return;
    setHumanizing(true);
    setError('');
    try {
      const { data } = await paperService.humanizePaper(id);
      setHumanizeResult(data);
      setTab('humanized');
      setAiScore(data.afterScore);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Humanize pass failed');
    } finally {
      setHumanizing(false);
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
    return <div className="p-8 text-center text-red-500">{error || 'Paper not found'}</div>;
  }

  const content =
    tab === 'humanized' && humanizeResult ? humanizeResult.humanized :
    tab === 'supervised' && supervised ? supervised :
    paper.final_content || '';

  const tabs: { key: Tab; label: string; available: boolean }[] = [
    { key: 'original', label: 'Original', available: true },
    { key: 'supervised', label: 'AI Supervised', available: !!supervised },
    { key: 'humanized', label: 'Naturalised', available: !!humanizeResult },
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
            {!supervised && paper.status === 'completed' && (
              <button
                onClick={handleSupervise}
                disabled={supervising}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-[10px] font-bold text-xs transition border border-white/20 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <RefreshCw size={13} className={supervising ? 'animate-spin' : ''} />
                {supervising ? 'Running Supervisor...' : 'AI Supervisor Review'}
              </button>
            )}
            {(supervised || humanizeResult) && (
              <button
                onClick={handleAccept}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-[10px] font-bold text-xs transition inline-flex items-center gap-1.5"
              >
                <CheckCircle size={13} /> Accept & Save
              </button>
            )}
            <button
              onClick={() => setShowDownload(true)}
              className="px-4 py-2 bg-white text-navy rounded-[10px] font-bold text-xs hover:bg-brand-soft transition inline-flex items-center gap-1.5"
            >
              <Download size={13} /> Download .docx
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Main content area */}
        <div>
          {error && (
            <div className="p-4 mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2">
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
                {t.key === 'humanized' && tab === 'humanized' && (
                  <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-gold" />
                )}
              </button>
            ))}
          </div>

          {/* Paper content */}
          <div className="bg-white rounded-[14px] shadow-soft border border-rule p-8">
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

        {/* Right sidebar — AI Quality Panel */}
        <aside className="space-y-4">
          {/* Writing naturalizer card */}
          <div className="bg-white rounded-[14px] border border-rule p-5 shadow-soft">
            <div className="flex items-center gap-2 mb-1">
              <Wand2 size={16} className="text-brand" />
              <h2 className="text-sm font-extrabold text-navy">Writing Naturalizer</h2>
            </div>
            <p className="text-xs text-muted leading-relaxed mb-4">
              Rewrites AI-formulaic patterns — banned words, repetitive transitions, uniform sentence rhythm — into natural, varied academic prose grounded in Ghanaian context.
            </p>

            <button
              onClick={handleHumanize}
              disabled={humanizing || paper.status !== 'completed'}
              className="btn-primary w-full py-2.5 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50 mb-3"
            >
              <Wand2 size={15} className={humanizing ? 'animate-spin' : ''} />
              {humanizing ? 'Naturalising prose...' : humanizeResult ? 'Run again' : 'Naturalise writing'}
            </button>

            {humanizeResult && (
              <div className="space-y-3">
                <ScoreGauge score={humanizeResult.beforeScore.aiScore} label="Before naturalisation" />
                <ScoreGauge score={humanizeResult.afterScore.aiScore} label="After naturalisation" />
                <p className="text-xs text-muted leading-relaxed mt-2">
                  {humanizeResult.afterScore.recommendation}
                </p>
                <IndicatorList indicators={humanizeResult.afterScore.indicators} />
              </div>
            )}
          </div>

          {/* AI score checker card */}
          <div className="bg-white rounded-[14px] border border-rule p-5 shadow-soft">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={16} className="text-gold" />
              <h2 className="text-sm font-extrabold text-navy">AI Pattern Score</h2>
            </div>
            <p className="text-xs text-muted leading-relaxed mb-4">
              Analyses the current draft for common AI writing patterns — transitions, hedging, formulaic sentence starters, and lexical diversity.
            </p>

            <button
              onClick={handleGetScore}
              disabled={scoreLoading || paper.status !== 'completed'}
              className="btn-ghost w-full py-2.5 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50 mb-3"
            >
              <Sparkles size={15} className={scoreLoading ? 'animate-spin' : ''} />
              {scoreLoading ? 'Analysing...' : aiScore ? 'Re-analyse' : 'Analyse current draft'}
            </button>

            {aiScore && (
              <div>
                <ScoreGauge
                  score={aiScore.aiScore}
                  label={tab === 'original' ? 'Original draft' : tab === 'supervised' ? 'Supervised draft' : 'Naturalised draft'}
                />
                <p className="text-xs text-muted leading-relaxed mt-3">{aiScore.recommendation}</p>
                <IndicatorList indicators={aiScore.indicators} />
              </div>
            )}
          </div>

          {/* What this does NOT do — transparency note */}
          <div className="bg-navy-mist rounded-[14px] border border-rule p-4">
            <p className="text-[11px] text-muted leading-relaxed">
              <span className="font-bold text-navy block mb-1">About this feature</span>
              This tool improves prose quality and readability. It does <em>not</em> remove cryptographic AI watermarks or assist in circumventing academic integrity checks. ResearchPadi encourages responsible, transparent use of AI-assisted writing.
            </p>
          </div>
        </aside>
      </div>
      {showDownload && id && (
        <DownloadDisclosureModal
          paperId={id}
          topic={paper.topic}
          institutionName={paper.institution_name}
          onClose={() => setShowDownload(false)}
        />
      )}
    </div>
  );
}
