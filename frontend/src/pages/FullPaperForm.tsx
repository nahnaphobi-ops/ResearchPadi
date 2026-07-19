import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { paperService } from '../services/apiService';
import { useAuthStore } from '../store/useAuthStore';

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRefine = async () => {
    if (!formData.topic.trim()) return;
    setRefining(true);
    try {
      const { data } = await paperService.refineTopic({
        topic: formData.topic,
        course: formData.course,
        institution_type: formData.institution_type,
      });
      setFormData(prev => ({ ...prev, topic: data.refined }));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Topic refinement failed');
    } finally {
      setRefining(false);
    }
  };

  const handleGenerateQuestions = async () => {
    if (!formData.topic.trim()) return;
    setGeneratingQuestions(true);
    try {
      const { data } = await paperService.generateQuestions({
        topic: formData.topic,
        course: formData.course,
        institution_type: formData.institution_type,
      });
      setFormData(prev => ({ ...prev, research_questions: data.questions }));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Question generation failed');
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
    } catch (err: any) {
      setError(err.response?.data?.error || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">New Full Paper</h1>
      <p className="mb-6 text-gray-600">Provide your paper details below. Our AI pipeline will research, draft, and review a complete academic paper.</p>

      {error && <div className="p-4 mb-6 bg-red-100 text-red-700 rounded-lg">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">

        <div>
          <label className="block font-bold mb-1">Research Topic</label>
          <div className="flex gap-2">
            <input
              name="topic"
              className="flex-1 p-3 border-2 rounded-lg focus:border-gray-500"
              placeholder="e.g. The Impact of Mobile Money on Small Scale Businesses in Kumasi"
              required
              onChange={handleChange}
              value={formData.topic}
            />
            <button
              type="button"
              onClick={handleRefine}
              disabled={refining || !formData.topic.trim()}
              className="px-4 py-3 bg-gray-800 text-white rounded-lg text-sm font-semibold hover:bg-gray-900 disabled:bg-gray-400 whitespace-nowrap"
            >
              {refining ? 'Refining...' : 'Refine with AI'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Click "Refine with AI" to sharpen your topic for academic writing.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-bold mb-1">Course/Subject</label>
            <input name="course" className="w-full p-3 border rounded-lg focus:border-gray-500" required onChange={handleChange} placeholder="e.g. Economics" value={formData.course} />
          </div>
          <div>
            <label className="block font-bold mb-1">Supervisor Name (Optional)</label>
            <input name="supervisor_name" className="w-full p-3 border rounded-lg focus:border-gray-500" onChange={handleChange} placeholder="e.g. Dr. Owusu" value={formData.supervisor_name} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block font-bold">Research Questions / Hypothesis</label>
            <button
              type="button"
              onClick={handleGenerateQuestions}
              disabled={generatingQuestions || !formData.topic.trim()}
              className="text-sm text-gray-800 font-semibold hover:text-gray-900 disabled:text-gray-400"
            >
              {generatingQuestions ? 'Generating...' : 'Generate from Topic'}
            </button>
          </div>
          <textarea
            name="research_questions"
            className="w-full p-3 border rounded-lg focus:border-gray-500 text-sm"
            placeholder="Enter your research questions or hypothesis. You can write them yourself or click 'Generate from Topic' to have AI create them."
            onChange={handleChange}
            value={formData.research_questions}
            rows={4}
          />
        </div>

        <div>
          <label className="block font-bold mb-1">
            Target Word Count: <span className="text-gray-800">{formData.target_word_count.toLocaleString()}</span> words
          </label>
          <input
            type="range"
            name="target_word_count"
            min={3000}
            max={25000}
            step={500}
            value={formData.target_word_count}
            onChange={handleChange}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-600"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>3,000</span>
            <span>12,000 (typical)</span>
            <span>25,000</span>
          </div>
        </div>

        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h3 className="font-bold mb-4 text-gray-800">Review Institution Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block text-gray-600 mb-1">Institution</label>
              <input name="institution_name" className="w-full p-2 border rounded" value={formData.institution_name} onChange={handleChange} />
            </div>
            <div>
              <label className="block text-gray-600 mb-1">Programme</label>
              <input name="programme" className="w-full p-2 border rounded" value={formData.programme} onChange={handleChange} />
            </div>
          </div>
        </div>

        <div className="p-6 bg-gray-100 rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <span className="font-bold">Service Fee</span>
            <span className="text-xl font-bold text-gray-800">GHS 250.00</span>
          </div>
          <p className="text-xs text-gray-500">By clicking 'Start Pipeline', the amount will be deducted from your wallet balance. Ensure you have sufficient funds.</p>
        </div>

        <button
          disabled={loading}
          className="w-full p-4 bg-gray-800 text-white rounded-xl font-bold text-lg hover:bg-gray-900 disabled:bg-gray-400 transition"
        >
          {loading ? 'Initiating Pipeline...' : 'Start Research & Drafting'}
        </button>
      </form>
    </div>
  );
}
