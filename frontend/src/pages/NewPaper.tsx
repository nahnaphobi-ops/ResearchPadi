import { useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { FileText, PenLine } from 'lucide-react';

export default function NewPaper() {
  const navigate = useNavigate();

  return (
    <AppShell>
      <p className="eyebrow mb-3 text-center">Start writing</p>
      <h1 className="text-3xl font-bold mb-8 text-center text-navy">Choose your service</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          type="button"
          className="text-left bg-white p-8 rounded-[14px] border border-rule hover:border-navy hover:shadow-card transition"
          onClick={() => navigate('/new-paper/full')}
        >
          <div className="w-12 h-12 rounded-full bg-navy text-white grid place-items-center mb-4">
            <FileText size={20} />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-navy">Full Paper Service</h2>
          <p className="text-muted mb-4">Our AI writes your complete 10,000–15,000 word research paper from scratch.</p>
          <ul className="text-sm text-muted space-y-2 mb-6">
            <li>• Comprehensive research included</li>
            <li>• APA 7th Edition formatting</li>
            <li>• Human-like writing style</li>
          </ul>
          <div className="text-xl font-bold text-navy">GHS 250</div>
        </button>

        <button
          type="button"
          className="text-left bg-white p-8 rounded-[14px] border border-rule hover:border-navy hover:shadow-card transition"
          onClick={() => navigate('/subscribe')}
        >
          <div className="w-12 h-12 rounded-full bg-navy-soft text-navy grid place-items-center mb-4">
            <PenLine size={20} />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-navy">Assisted Workspace</h2>
          <p className="text-muted mb-4">Write your paper with real-time AI assistance, suggestions, and citation finding.</p>
          <ul className="text-sm text-muted space-y-2 mb-6">
            <li>• AI writing assistant (expand, rewrite, continue)</li>
            <li>• Real-time citation search</li>
            <li>• Rich text editor with auto-save</li>
          </ul>
          <div className="text-sm text-muted mb-2">
            Standard from GHS 120/mo • Premium from GHS 200/mo
          </div>
          <div className="text-xl font-bold text-navy">Get started →</div>
        </button>
      </div>
    </AppShell>
  );
}
