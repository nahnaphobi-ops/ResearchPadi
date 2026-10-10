import { useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { ArrowRight, CheckCircle, FileText, PenLine } from 'lucide-react';

const services = [
  {
    key: 'full',
    icon: FileText,
    iconClass: 'bg-navy text-white',
    title: 'Full Paper Service',
    desc: 'Our AI researches, drafts, and reviews a complete research paper from your topic and brief.',
    points: ['3,000–25,000 words, you choose', 'APA 7th Edition citations', 'AI supervisor review before delivery'],
    price: 'GHS 250',
    priceNote: 'per paper, paid from your wallet',
    cta: 'Start a paper',
    path: '/new-paper/full',
  },
  {
    key: 'workspace',
    icon: PenLine,
    iconClass: 'bg-brand-soft text-brand',
    title: 'Assisted Workspace',
    desc: 'Write the paper yourself with real-time AI help, suggestions, and citation search.',
    points: ['AI writing assistant (expand, rewrite, continue)', 'Real-time citation search', 'Rich text editor with auto-save'],
    price: 'From GHS 120',
    priceNote: 'per month · Standard or Premium',
    cta: 'Open workspace',
    path: '/workspace',
  },
];

export default function NewPaper() {
  const navigate = useNavigate();

  return (
    <AppShell>
      <p className="eyebrow mb-3 text-center">Start writing</p>
      <h1 className="text-3xl font-bold mb-2 text-center text-navy">Choose your service</h1>
      <p className="text-sm text-muted text-center mb-8">Let AI write the whole paper, or write it yourself with AI beside you.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {services.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              type="button"
              className="group flex flex-col text-left bg-white p-7 sm:p-8 rounded-[14px] border border-rule hover:border-brand/50 hover:shadow-card transition"
              onClick={() => navigate(s.path)}
            >
              <div className={`w-12 h-12 rounded-full grid place-items-center mb-4 ${s.iconClass}`}>
                <Icon size={20} />
              </div>
              <h2 className="text-2xl font-bold mb-2 text-navy">{s.title}</h2>
              <p className="text-muted mb-5">{s.desc}</p>
              <ul className="text-sm text-ink space-y-2 mb-6">
                {s.points.map((p) => (
                  <li key={p} className="flex items-start gap-2">
                    <CheckCircle size={15} className="text-brand mt-0.5 shrink-0" /> {p}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-5 border-t border-rule flex items-end justify-between gap-3">
                <div>
                  <div className="text-xl font-bold text-navy">{s.price}</div>
                  <div className="text-xs text-muted">{s.priceNote}</div>
                </div>
                <span className="inline-flex items-center gap-1 text-sm font-bold text-brand whitespace-nowrap group-hover:gap-2 transition-all">
                  {s.cta} <ArrowRight size={15} />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </AppShell>
  );
}
