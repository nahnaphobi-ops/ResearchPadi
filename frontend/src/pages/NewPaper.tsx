import { useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { ArrowRight, CheckCircle, FileText, PenLine, Stethoscope } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

const services = [
  {
    key: 'full',
    icon: FileText,
    iconClass: 'bg-navy text-white',
    title: 'Study Draft',
    desc: 'Our AI researches and drafts a full paper from your topic, for you to study from and then rewrite in your own words.',
    points: ['3,000–25,000 words, you choose', 'References checked, doubtful ones flagged', 'Clearly marked as AI-written'],
    price: 'GHS 250',
    priceNote: 'per draft, paid from your wallet',
    cta: 'Order a study draft',
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
    priceNote: 'per 30 days · Standard or Premium',
    cta: 'Open workspace',
    path: '/workspace',
  },
];

// Nursing and midwifery training college students only.
const careStudyService = {
  key: 'care-study',
  icon: Stethoscope,
  iconClass: 'bg-gold/20 text-navy',
  title: 'Care Study',
  desc: 'Write up your final-year care study from your own client, step by step. We organise, explain and polish — you supply every clinical fact.',
  points: ['Guided by the nursing process', 'Draft each section once your details are in', 'Supervisor export with your notes beside the draft'],
  price: 'GHS 250',
  priceNote: 'per care study, paid from your wallet',
  cta: 'Start a care study',
  path: '/care-studies',
};

export default function NewPaper() {
  const navigate = useNavigate();
  const isNmtc = useAuthStore((s) => s.user?.institution_type === 'nmtc');
  const shown = isNmtc ? [...services, careStudyService] : services;

  return (
    <AppShell>
      <p className="eyebrow mb-3 text-center">Start writing</p>
      <h1 className="text-3xl font-bold mb-2 text-center text-navy">Choose your service</h1>
      <p className="text-sm text-muted text-center mb-8">Study from a full AI draft, or write your paper yourself with AI beside you.</p>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${shown.length > 2 ? 'xl:grid-cols-3' : ''} gap-6`}>
        {shown.map((s) => {
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
