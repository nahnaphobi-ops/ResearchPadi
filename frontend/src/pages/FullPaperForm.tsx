import { useEffect, useState } from 'react';
import { apiErrorMessage } from '../utils/apiError';
import { useNavigate } from 'react-router-dom';
import { paperService } from '../services/apiService';
import { paymentService } from '../services/paymentService';
import { useAuthStore } from '../store/useAuthStore';
import AppShell from '../components/layout/AppShell';
import { ArrowLeft, Sparkles } from 'lucide-react';

const PAPER_FEE_GHS = 250;

export default function FullPaperForm() {
  const user = useAuthStore(state => state.user);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    topic: '',
    course: '',
    institution_name: user?.institution_name || '',
    institution_type: user?.institution_type || 'university',
    programme: user?.programme || '',
    supervisor_name: '',
    target_word_count: 12000,
    research_questions: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refining, setRefining] = useState(false);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    paymentService.getWallet()
      .then((res) => setWalletBalance(res.data.balance ?? 0))
      .catch(() => setWalletBalance(null));
  }, []);

  const canAfford = walletBalance === null || walletBalance >= PAPER_FEE_GHS;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'target_word_count' ? Number(value) : value }));
  };

  const handleRefine = async () => {
    if (!formData.topic.trim()) return;
    setRefining(true);
    setError('');
    try {
      const { data } = await paperService.refineTopic({
        topic: formData.topic,
        course: formData.course,
        institution_type: formData.institution_type,
      });
      setFormData(prev => ({ ...prev, topic: data.refined }));
    } catch (err) {
      setError(apiErrorMessage(err, 'Topic refinement failed'));
    } finally {
      setRefining(false);
    }
  };

  const handleGenerateQuestions = async () => {
    if (!formData.topic.trim()) return;
    setGeneratingQuestions(true);
    setError('');
    try {
      const { data } = await paperService.generateQuestions({
        topic: formData.topic,
        course: formData.course,
        institution_type: formData.institution_type,
      });
      setFormData(prev => ({ ...prev, research_questions: data.questions }));
    } catch (err) {
      setError(apiErrorMessage(err, 'Question generation failed'));
    } finally {
      setGeneratingQuestions(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await paperService.submitFullPaper(formData);
      navigate(`/dashboard`);
    } catch (err) {
      setError(apiErrorMessage(err, 'Submission failed'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <button onClick={() => navigate('/new-paper')} className="text-sm text-muted hover:text-navy font-medium inline-flex items-center gap-1.5 mb-6">
        <ArrowLeft size={15} /> Back
      </button>
      <p className="eyebrow mb-2">Full paper</p>
      <h1 className="text-3xl font-bold mb-2 text-navy">New full paper</h1>
      <p className="mb-6 text-muted">Provide your paper details below. Our AI pipeline will research, draft, and review a complete academic paper.</p>

      {error && <div role="alert" className="p-4 mb-6 bg-red-100 text-red-700 rounded-[10px] text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">

        <div>
          <label htmlFor="topic" className="block font-bold mb-1 text-ink">Research topic</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="topic"
              name="topic"
              className="flex-1 p-3 border-2 rounded-[10px]"
              placeholder="e.g. The Impact of Mobile Money on Small Scale Businesses in Kumasi"
              required
              onChange={handleChange}
              value={formData.topic}
            />
            <button
              type="button"
              onClick={handleRefine}
              disabled={refining || !formData.topic.trim()}
              className="btn-primary px-4 py-3 text-sm disabled:opacity-50 whitespace-nowrap inline-flex items-center justify-center gap-1.5"
            >
              <Sparkles size={15} /> {refining ? 'Refining...' : 'Refine with AI'}
            </button>
          </div>
          <p className="text-xs text-muted mt-1">Click "Refine with AI" to sharpen your topic for academic writing.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="course" className="block font-bold mb-1 text-ink">Course / subject</label>
            <input id="course" name="course" className="w-full p-3 border rounded-[10px]" required onChange={handleChange} placeholder="e.g. Economics" value={formData.course} />
          </div>
          <div>
            <label htmlFor="supervisor_name" className="block font-bold mb-1 text-ink">Supervisor name <span className="font-normal text-muted">(optional)</span></label>
            <input id="supervisor_name" name="supervisor_name" className="w-full p-3 border rounded-[10px]" onChange={handleChange} placeholder="e.g. Dr. Owusu" value={formData.supervisor_name} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3 mb-1">
            <label htmlFor="research_questions" className="block font-bold text-ink">Research questions / hypothesis</label>
            <button
              type="button"
              onClick={handleGenerateQuestions}
              disabled={generatingQuestions || !formData.topic.trim()}
              className="text-sm text-brand font-semibold hover:underline disabled:text-muted disabled:no-underline shrink-0"
            >
              {generatingQuestions ? 'Generating...' : 'Generate from topic'}
            </button>
          </div>
          <textarea
            id="research_questions"
            name="research_questions"
            className="w-full p-3 border rounded-[10px] text-sm"
            placeholder="Enter your research questions or hypothesis, or click 'Generate from topic' to have AI draft them."
            onChange={handleChange}
            value={formData.research_questions}
            rows={4}
          />
        </div>

        <div>
          <label htmlFor="target_word_count" className="block font-bold mb-1 text-ink">
            Target word count: <span className="text-brand">{formData.target_word_count.toLocaleString()}</span> words
          </label>
          <input
            id="target_word_count"
            type="range"
            name="target_word_count"
            min={3000}
            max={25000}
            step={500}
            value={formData.target_word_count}
            onChange={handleChange}
            className="w-full h-2 bg-rule rounded-lg appearance-none cursor-pointer accent-brand"
          />
          <div className="flex justify-between text-xs text-muted mt-1">
            <span>3,000</span>
            <span>12,000 (typical)</span>
            <span>25,000</span>
          </div>
        </div>

        <div className="bg-navy-mist p-5 sm:p-6 rounded-[14px] border border-rule">
          <h3 className="font-bold mb-1 text-navy">Your institution</h3>
          <p className="text-xs text-muted mb-4">Taken from your profile. Change it here if this paper is for somewhere else.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <label htmlFor="institution_name" className="block text-muted mb-1">Institution</label>
              <input id="institution_name" name="institution_name" className="w-full p-2.5 border rounded-[10px]" value={formData.institution_name} onChange={handleChange} />
            </div>
            <div>
              <label htmlFor="programme" className="block text-muted mb-1">Programme</label>
              <input id="programme" name="programme" className="w-full p-2.5 border rounded-[10px]" value={formData.programme} onChange={handleChange} />
            </div>
          </div>
        </div>

        <div className="p-6 bg-navy text-white rounded-[14px]">
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold">Service fee</span>
            <span className="text-xl font-bold">GHS {PAPER_FEE_GHS.toFixed(2)}</span>
          </div>
          {walletBalance !== null && (
            <div className="flex justify-between items-center text-sm mb-3">
              <span className="text-white/70">Wallet balance</span>
              <span className={canAfford ? 'text-white/90 font-semibold' : 'text-gold font-semibold'}>GHS {walletBalance.toFixed(2)}</span>
            </div>
          )}
          <p className="text-xs text-white/70">
            The fee is deducted from your wallet when you click "Start research &amp; drafting".
          </p>
          {!canAfford && (
            <button
              type="button"
              onClick={() => navigate('/wallet')}
              className="mt-4 bg-gold text-navy px-4 py-2 rounded-[10px] text-sm font-bold hover:brightness-95 transition"
            >
              Top up GHS {(PAPER_FEE_GHS - (walletBalance ?? 0)).toFixed(2)} to continue
            </button>
          )}
        </div>

        <button
          disabled={loading || !canAfford}
          className="btn-primary w-full p-4 text-lg disabled:opacity-50"
        >
          {loading ? 'Starting...' : 'Start research & drafting'}
        </button>
      </form>
    </AppShell>
  );
}
