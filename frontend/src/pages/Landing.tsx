import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import BrandLogo from '../components/common/BrandLogo';
import HeroStudent from '../components/brand/HeroStudent';
import {
  ChevronDown, CheckCircle, Shield, ArrowRight, Phone, Mail,
  Search, ShoppingBag, Heart, Star, Clock, Users, BookOpen,
  Headphones, GraduationCap, FileText, Quote, DollarSign, Repeat, Share2,
} from 'lucide-react';

const navItems = [
  { label: 'Home', id: 'top' },
  { label: 'Features', id: 'about' },
  { label: 'Courses', id: 'courses' },
  { label: 'Students', id: 'students' },
  { label: 'Pricing', id: 'pricing' },
  { label: 'Contact', id: 'contact' },
];

const features = [
  { icon: GraduationCap, label: '10k+ student drafts', sub: 'Generated & reviewed' },
  { icon: Repeat, label: 'Writing workspace', sub: 'AI + citations in one tab' },
  { icon: DollarSign, label: 'GHS student pricing', sub: 'Affordable local plans' },
  { icon: Headphones, label: 'Priority support', sub: 'Human + AI supervisors' },
  { icon: Users, label: 'Ghana community', sub: 'KNUST · UG · UCC · UPSA' },
];

const courseFilters = [
  { key: 'research', title: 'Research Papers', count: '12 courses', icon: FileText },
  { key: 'thesis', title: 'Thesis Support', count: '8 courses', icon: GraduationCap },
  { key: 'review', title: 'Literature Review', count: '6 courses', icon: BookOpen },
  { key: 'cite', title: 'Citations & Edit', count: '9 courses', icon: Quote },
];

const allCourses = [
  { filter: 'research', weeks: '04 WEEKS', title: 'Complete research paper from brief to export', lessons: 12, students: 2400, level: 'Beginner', teacher: 'Ama Boateng', price: 'GHS 250', tone: 'from-brand to-navy', image: '/landing/course-research.jpg', imageAlt: 'Student writing a research paper in a university library' },
  { filter: 'thesis', weeks: '08 WEEKS', title: 'Thesis chapters with supervisor-ready structure', lessons: 18, students: 980, level: 'Advanced', teacher: 'Kwame Mensah', price: 'GHS 200', tone: 'from-gold to-[#E0B000]', image: '/landing/course-thesis.jpg', imageAlt: 'Postgraduate student working through thesis chapters' },
  { filter: 'review', weeks: '03 WEEKS', title: 'Literature reviews grounded in African journals', lessons: 10, students: 1600, level: 'Beginner', teacher: 'Efua Asante', price: 'FREE', tone: 'from-[#7EB6E9] to-brand', image: '/landing/course-literature.jpg', imageAlt: 'Academic journals and notes for a literature review' },
  { filter: 'cite', weeks: '02 WEEKS', title: 'APA, MLA, Chicago and Harvard citation studio', lessons: 8, students: 2100, level: 'Beginner', teacher: 'Yaw Osei', price: 'FREE', tone: 'from-alert to-[#E03A3A]', image: '/landing/course-citations.jpg', imageAlt: 'Student preparing academic citations at a desk' },
  { filter: 'research', weeks: '05 WEEKS', title: 'University templates for KNUST, UG, UCC and UPSA', lessons: 6, students: 3100, level: 'Beginner', teacher: 'Akosua Darko', price: 'FREE', tone: 'from-navy to-brand', image: '/landing/course-templates.jpg', imageAlt: 'Students on a Ghanaian university campus' },
  { filter: 'thesis', weeks: '06 WEEKS', title: 'Quality guards before every submission', lessons: 9, students: 1200, level: 'Intermediate', teacher: 'Kojo Ampofo', price: 'GHS 120', tone: 'from-brand to-[#7EB6E9]', image: '/landing/course-quality.jpg', imageAlt: 'Student reviewing a paper before submission' },
  { filter: 'review', weeks: '04 WEEKS', title: 'Assisted writing workspace with live AI help', lessons: 14, students: 870, level: 'Intermediate', teacher: 'Abena Sarpong', price: 'GHS 120', tone: 'from-[#24356F] to-gold', image: '/landing/course-workspace.jpg', imageAlt: 'Student writing in a campus study space' },
  { filter: 'cite', weeks: '10 WEEKS', title: 'Priority review and dissertation mode', lessons: 16, students: 540, level: 'Advanced', teacher: 'Nana Adjei', price: 'GHS 200', tone: 'from-navy to-alert', image: '/landing/course-dissertation.jpg', imageAlt: 'Postgraduate students reviewing a dissertation draft' },
];

const pricingPlans = [
  {
    name: 'Complete Paper',
    price: 'GHS 250',
    period: '/paper',
    desc: 'Full end-to-end AI paper generation',
    features: ['Complete paper written for you', 'AI writing + quality guards', 'APA/MLA/Chicago/Harvard', 'University templates', 'AI/human supervisor review'],
    cta: 'Order a Paper',
    highlighted: false,
  },
  {
    name: 'Standard',
    price: 'GHS 120',
    period: '/month',
    desc: 'Assisted writing for regular students',
    features: ['AI writing assist', 'All citation formats', 'All university templates', 'Quality guards', 'Email support'],
    cta: 'Start Standard',
    highlighted: true,
  },
  {
    name: 'Premium',
    price: 'GHS 200',
    period: '/month',
    desc: 'Assisted writing with full features',
    features: ['Everything in Standard', 'Priority AI/human supervisors', 'Thesis/dissertation mode', 'Literature review AI', 'Priority support'],
    cta: 'Start Premium',
    highlighted: false,
  },
];

const testimonials = [
  { name: 'Akosua M.', institution: 'KNUST, Kumasi', text: 'ResearchPadi generated my methodology chapter overnight. My supervisor approved it first review — I couldn\'t believe how well-formatted and locally referenced it was.', role: 'BSc Computer Science', initials: 'AM' },
  { name: 'Kwame A.', institution: 'University of Ghana, Legon', text: 'The literature review AI found Ghanaian and African journal sources I never knew existed. No other tool does that — it\'s built for us, not just adapted for us.', role: 'MA Development Studies', initials: 'KA' },
  { name: 'Efua B.', institution: 'UCC, Cape Coast', text: 'I submitted my final-year project two weeks ahead of schedule. The quality guard caught citation gaps before I sent it to my supervisor. Absolute lifesaver.', role: 'BSc Business Admin', initials: 'EB' },
];

const faqs = [
  { q: 'What makes ResearchPadi different from ChatGPT?', a: 'ResearchPadi is trained specifically on Ghanaian academic standards, curricula, and local sources. It understands university formatting, prioritizes African journals, and keeps your draft inside a research workspace — not a generic chat thread.' },
  { q: 'Is the content really plagiarism-free?', a: 'Yes. Every paper generated by ResearchPadi is original. We also include a plagiarism scanner that checks against global databases and local academic repositories before you submit.' },
  { q: 'Which universities does ResearchPadi support?', a: 'We support Ghanaian tertiary institutions including KNUST, University of Ghana, UCC, UPSA, GIMPA, Ashesi, Technical Universities, and more.' },
  { q: 'Can I use ResearchPadi for my thesis or dissertation?', a: 'Yes. Premium includes thesis mode with chapter-by-chapter writing, advanced literature review AI, and reports suitable for postgraduate submissions.' },
  { q: 'How accurate are the citations?', a: 'Citations are cross-referenced against academic databases. We support APA, MLA, Chicago, and Harvard, tuned for Ghanaian and African sources.' },
];

export default function Landing() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [filter, setFilter] = useState('research');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const nodes = document.querySelectorAll('.reveal');
    if (!nodes.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: '0px 0px -8% 0px' }
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [filter]);

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    if (id === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const visibleCourses = allCourses.filter((c) => c.filter === filter);

  return (
    <div className="relative flex flex-col min-h-screen bg-white text-ink overflow-x-hidden">
      <div className="bg-navy text-white text-xs">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-white/80">
            <span className="inline-flex items-center gap-1.5"><Phone size={12} /> Kumasi, Ghana</span>
            <span className="inline-flex items-center gap-1.5"><Mail size={12} /> hello@researchpadi.com</span>
            <span className="hidden sm:inline">Mon – Fri, 8am – 6pm</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-white/70">
              <Share2 size={13} />
            </div>
            <button onClick={() => navigate('/login')} className="font-semibold hover:text-gold">
              Login / Register
            </button>
          </div>
        </div>
      </div>

      <nav className="sticky top-0 z-50 bg-white border-b border-rule">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 h-[78px] flex items-center justify-between gap-4">
          <BrandLogo markClassName="h-10 w-10" onClick={() => scrollTo('top')} />

          <div className="hidden lg:flex items-center gap-6">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="text-[12px] font-bold uppercase tracking-wide text-navy hover:text-brand transition inline-flex items-center gap-1"
              >
                {item.label}
                {item.id !== 'contact' && item.id !== 'top' && <ChevronDown size={12} className="text-muted" />}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <label className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') scrollTo('courses'); }}
                placeholder="Search..."
                className="h-10 w-40 lg:w-48 rounded-full border border-rule pl-9 pr-3 text-sm"
              />
            </label>
            <button onClick={() => scrollTo('courses')} className="relative p-2 text-navy" aria-label="Saved">
              <Heart size={18} />
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-alert text-white text-[10px] font-bold grid place-items-center">1</span>
            </button>
            <button onClick={() => scrollTo('pricing')} className="relative p-2 text-navy" aria-label="Plans">
              <ShoppingBag size={18} />
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-alert text-white text-[10px] font-bold grid place-items-center">0</span>
            </button>
            <button onClick={() => scrollTo('contact')} className="btn-primary px-4 py-2.5 text-xs inline-flex items-center gap-1">
              Contact us <ArrowRight size={13} />
            </button>
          </div>

          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2 text-navy text-xl" aria-label="Menu">
            {mobileMenuOpen ? '×' : '☰'}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-rule bg-white px-4 py-4 space-y-1">
            {navItems.map((item) => (
              <button key={item.id} onClick={() => scrollTo(item.id)} className="block w-full text-left py-2 text-sm font-bold uppercase text-navy">
                {item.label}
              </button>
            ))}
            <button onClick={() => navigate('/login')} className="btn-primary w-full py-2.5 text-sm mt-2">Login / Register</button>
          </div>
        )}
      </nav>

      <section className="relative overflow-hidden bg-navy-mist">
        <div className="absolute left-[8%] top-16 h-32 w-32 rounded-full bg-brand/10" />
        <div className="absolute right-[40%] bottom-10 h-20 w-20 rounded-full border-2 border-brand/20" />
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 pt-12 sm:pt-16 pb-10 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-[11px] font-extrabold tracking-[0.18em] uppercase text-alert mb-4 fade-up">AI-powered academic writing · Built for Ghana</p>
            <h1 className="text-[2.35rem] sm:text-5xl lg:text-[3.4rem] font-extrabold leading-[1.12] text-navy mb-6 fade-up fade-up-delay">
              From brief to&nbsp;
              <span className="text-brand">supervisor-ready</span>
              &nbsp;draft in minutes.
            </h1>
            <p className="text-sm text-muted leading-relaxed mb-6 max-w-md fade-up fade-up-delay">
              ResearchPadi writes, cites, and quality-checks your research paper — tuned for KNUST, UG, UCC, UPSA, and every Ghanaian university format.
            </p>
            <ul className="space-y-2 mb-7 fade-up fade-up-delay-2">
              {['Local university templates & citation formats', 'AI writing workspace with live suggestions', 'Plagiarism guard before every submission'].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm font-semibold text-navy">
                  <CheckCircle size={16} className="text-brand flex-shrink-0" /> {item}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3 fade-up fade-up-delay-3">
              <button onClick={() => navigate('/login')} className="btn-primary px-6 py-3 text-sm inline-flex items-center gap-2">
                Start writing free <ArrowRight size={15} />
              </button>
              <button onClick={() => scrollTo('pricing')} className="bg-navy text-white px-6 py-3 rounded-[10px] text-sm font-bold inline-flex items-center gap-2 hover:bg-navy-hover transition">
                See plans <ArrowRight size={15} />
              </button>
            </div>
          </div>
          <HeroStudent className="max-w-[480px] mx-auto lg:ml-auto fade-up fade-up-delay" />
        </div>

        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 pb-10">
          <div className="bg-white rounded-2xl shadow-card grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-rule">
            {features.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center gap-3 px-5 py-5">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand shrink-0">
                    <Icon size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-navy leading-tight">{item.label}</p>
                    <p className="text-[11px] text-muted mt-0.5 leading-tight">{item.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="about" className="py-20 sm:py-28">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <div className="relative reveal">
            <div className="grid grid-cols-2 gap-3">
              <div className="relative h-44 rounded-2xl bg-brand overflow-hidden flex flex-col justify-end p-5">
                <img src="/landing/feature-ai.jpg" alt="" className="absolute inset-0 w-full h-full object-cover object-[center_28%] pointer-events-none select-none" />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-brand via-brand/70 to-transparent pointer-events-none" />
                <p className="relative text-[10px] font-bold text-white/70 uppercase tracking-wide mb-1">AI Generation</p>
                <p className="relative text-white font-extrabold text-sm leading-snug">Full paper from a 3-line brief</p>
              </div>
              <div className="relative h-44 rounded-2xl bg-gold mt-8 overflow-hidden flex flex-col justify-end p-5">
                <img src="/landing/feature-citations.jpg" alt="" className="absolute inset-0 w-full h-full object-cover object-[center_28%] pointer-events-none select-none" />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-gold via-gold/75 to-transparent pointer-events-none" />
                <p className="relative text-[10px] font-bold text-navy/60 uppercase tracking-wide mb-1">Citations</p>
                <p className="relative text-navy font-extrabold text-sm leading-snug">APA · MLA · Chicago · Harvard</p>
              </div>
              <div className="relative h-36 rounded-2xl bg-navy overflow-hidden flex flex-col justify-end p-5">
                <img src="/landing/feature-quality.jpg" alt="" className="absolute inset-0 w-full h-full object-cover object-[center_32%] pointer-events-none select-none" />
                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-navy via-navy/75 to-transparent pointer-events-none" />
                <p className="relative text-[10px] font-bold text-white/50 uppercase tracking-wide mb-1">Quality Guard</p>
                <p className="relative text-white font-extrabold text-sm leading-snug">Plagiarism check before export</p>
              </div>
              <div className="h-36 rounded-2xl bg-brand-soft -mt-4 flex items-center justify-center flex-col gap-2">
                <GraduationCap className="text-brand" size={36} />
                <p className="text-[11px] font-bold text-brand text-center leading-tight px-3">10k+ drafts completed</p>
              </div>
            </div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-24 w-24 rounded-full bg-white text-navy grid place-content-center text-center shadow-card border-4 border-brand/20">
              <p className="text-base font-extrabold leading-none text-brand">GHS</p>
              <p className="text-[9px] font-bold uppercase tracking-wide mt-1 text-navy/70">Student plans</p>
            </div>
          </div>
          <div className="reveal reveal-delay-1">
            <p className="eyebrow mb-3">Why ResearchPadi?</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-navy leading-tight mb-4">
              The only AI writing tool built for Ghanaian academic standards.
            </h2>
            <p className="text-sm text-muted leading-relaxed mb-6">
              Generic AI tools don't know KNUST formatting, African journal databases, or Ghanaian citation conventions. ResearchPadi does — it was built to match the exact standards your supervisors expect.
            </p>
            <ul className="space-y-3 mb-8">
              {[
                'University templates for KNUST, UG, UCC, UPSA, GIMPA & more',
                'APA, MLA, Chicago, Harvard — tuned for African sources',
                'Plagiarism guard, quality checks, and AI supervisor review',
                'Rich writing workspace with live AI suggestions & citations',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm font-semibold text-navy">
                  <CheckCircle size={16} className="text-brand mt-0.5 shrink-0" /> {item}
                </li>
              ))}
            </ul>
            <button onClick={() => navigate('/login')} className="btn-primary px-6 py-3 text-sm inline-flex items-center gap-2">
              Create free account <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </section>

      <section id="courses" className="py-16 sm:py-24 bg-navy-mist">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8">
          <div className="text-center mb-10 reveal">
            <p className="eyebrow mb-3">What ResearchPadi covers</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-navy">Everything you need to submit with confidence</h2>
            <p className="text-sm text-muted mt-3 max-w-lg mx-auto">From first draft to final export — all the academic writing tools Ghanaian students need, in one platform.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {courseFilters.map((item) => {
              const Icon = item.icon;
              const active = filter === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setFilter(item.key)}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-4 text-left transition ${
                    active ? 'bg-brand text-white shadow-card' : 'bg-white text-navy border border-rule hover:border-brand/40'
                  }`}
                >
                  <span className={`grid h-11 w-11 place-items-center rounded-xl ${active ? 'bg-white/15' : 'bg-brand-soft text-brand'}`}>
                    <Icon size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-extrabold">{item.title}</span>
                    <span className={`text-xs ${active ? 'text-white/75' : 'text-muted'}`}>{item.count}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {visibleCourses.map((course, i) => (
              <article key={course.title} className={`bg-white rounded-2xl border border-rule overflow-hidden shadow-soft hover:-translate-y-1 transition reveal reveal-delay-${(i % 4) + 1}`}>
                <div className={`relative h-36 bg-gradient-to-br ${course.tone}`}>
                  <img src={course.image} alt={course.imageAlt} className="absolute inset-0 w-full h-full object-cover" />
                  <span className="absolute left-3 top-3 rounded bg-alert px-2 py-1 text-[10px] font-extrabold text-white">{course.weeks}</span>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-1 text-gold mb-2">
                    {Array.from({ length: 5 }).map((_, s) => <Star key={s} size={12} fill="currentColor" />)}
                    <span className="text-[11px] text-muted ml-1">(4.9)</span>
                  </div>
                  <h3 className="font-extrabold text-navy text-sm leading-snug mb-3 min-h-[40px]">{course.title}</h3>
                  <div className="flex flex-wrap gap-3 text-[11px] text-muted mb-4">
                    <span className="inline-flex items-center gap-1"><BookOpen size={12} /> {course.lessons} Lessons</span>
                    <span className="inline-flex items-center gap-1"><Users size={12} /> {course.students}</span>
                    <span className="inline-flex items-center gap-1"><Clock size={12} /> {course.level}</span>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-rule">
                    <div className="flex items-center gap-2">
                      <span className="h-7 w-7 rounded-full bg-brand-soft text-brand text-[10px] font-bold grid place-items-center">
                        {course.teacher.split(' ').map((n) => n[0]).join('')}
                      </span>
                      <p className="text-xs font-semibold text-navy">{course.teacher}</p>
                    </div>
                    <span className={`text-sm font-extrabold ${course.price === 'FREE' ? 'text-alert' : 'text-navy'}`}>{course.price}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="text-center mt-10">
            <button onClick={() => navigate('/login')} className="btn-primary px-6 py-3 text-sm inline-flex items-center gap-2">
              View all courses <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </section>

      <section id="students" className="py-16 sm:py-24">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8">
          <div className="text-center mb-10 reveal">
            <p className="eyebrow mb-3">Real students. Real results.</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-navy">Ghanaian students trust ResearchPadi</h2>
            <div className="flex items-center justify-center gap-1 mt-3">
              {Array.from({ length: 5 }).map((_, s) => <Star key={s} size={14} className="text-gold" fill="currentColor" />)}
              <span className="text-xs text-muted ml-2">4.9 · 10k+ submissions</span>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <blockquote key={t.initials} className={`rounded-2xl bg-white border border-rule p-6 shadow-soft hover:-translate-y-1 transition reveal reveal-delay-${i + 1}`}>
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: 5 }).map((_, s) => <Star key={s} size={12} className="text-gold" fill="currentColor" />)}
                </div>
                <p className="text-sm text-ink leading-relaxed mb-6">“{t.text}”</p>
                <div className="flex items-center gap-3 pt-4 border-t border-rule">
                  <div className="w-10 h-10 rounded-full bg-brand text-white text-xs font-bold grid place-items-center shrink-0">{t.initials}</div>
                  <div>
                    <p className="text-sm font-bold text-navy">{t.name}</p>
                    <p className="text-xs text-muted">{t.role}</p>
                    <p className="text-[11px] text-brand font-semibold">{t.institution}</p>
                  </div>
                </div>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-16 sm:py-24 bg-navy-mist">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8">
          <div className="text-center mb-12 reveal">
            <p className="eyebrow mb-3">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-navy">Student-friendly plans. No surprises.</h2>
            <p className="text-sm text-muted mt-3 max-w-lg mx-auto">All prices in GHS. Cancel anytime. No hidden fees.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {pricingPlans.map((plan, i) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-7 transition hover:-translate-y-1 reveal reveal-delay-${i + 1} ${
                  plan.highlighted ? 'bg-navy text-white shadow-card' : 'bg-white border border-rule'
                }`}
              >
                {plan.highlighted && (
                  <div className="inline-flex bg-brand text-white text-[10px] font-bold px-3 py-1 rounded mb-4 uppercase tracking-wider">
                    Most popular
                  </div>
                )}
                <h3 className={`text-lg font-extrabold mb-1 ${plan.highlighted ? 'text-white' : 'text-navy'}`}>{plan.name}</h3>
                <p className={`text-xs mb-5 ${plan.highlighted ? 'text-white/70' : 'text-muted'}`}>{plan.desc}</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className={`text-3xl font-extrabold ${plan.highlighted ? 'text-white' : 'text-navy'}`}>{plan.price}</span>
                  <span className={`text-sm ${plan.highlighted ? 'text-white/60' : 'text-muted'}`}>{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-7">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <CheckCircle className={`w-4 h-4 shrink-0 mt-0.5 ${plan.highlighted ? 'text-gold' : 'text-brand'}`} />
                      <span className={`text-sm ${plan.highlighted ? 'text-white/85' : 'text-muted'}`}>{feat}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate('/login')}
                  className={`w-full py-3 rounded-[10px] font-bold text-sm transition ${
                    plan.highlighted ? 'bg-brand text-white hover:bg-brand-hover' : 'btn-primary'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="py-16 sm:py-24">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-8 items-start">
          <div className="bg-navy text-white rounded-2xl p-7 sm:p-8 reveal relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full border border-white/10" />
            <div className="absolute -right-4 -bottom-8 w-24 h-24 rounded-full bg-brand/20" />
            <p className="eyebrow text-gold mb-3 relative z-10">Get started today</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-2 relative z-10">Your supervisor-ready draft is one brief away.</h2>
            <p className="text-sm text-white/70 mb-8 relative z-10">Join thousands of Ghanaian students — write, cite, and submit with confidence.</p>
            <div className="space-y-3 mb-8 relative z-10">
              <div className="flex items-center gap-3 text-sm text-white/85"><Mail size={16} /> hello@researchpadi.com</div>
              <div className="flex items-center gap-3 text-sm text-white/85"><Phone size={16} /> Kumasi, Ghana · Mon–Fri 8am–6pm</div>
            </div>
            <div className="flex flex-wrap gap-3 relative z-10">
              <button onClick={() => navigate('/login')} className="btn-primary px-6 py-3 text-sm inline-flex items-center gap-2">
                Create free account <ArrowRight size={16} />
              </button>
              <button onClick={() => scrollTo('pricing')} className="border border-white/20 text-white px-6 py-3 rounded-[10px] text-sm font-bold hover:bg-white/10 transition">
                View pricing
              </button>
            </div>
          </div>

          <div id="faqs" className="reveal reveal-delay-1">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-navy mb-6">Frequently asked questions</h2>
            <div className="space-y-2">
              {faqs.map((faq, i) => (
                <div key={faq.q} className={`rounded-xl border bg-white transition ${openFaq === i ? 'border-brand/40' : 'border-rule'}`}>
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between px-5 py-4 text-left">
                    <span className="text-sm font-bold text-ink pr-4">{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-muted shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-4">
                      <p className="text-sm text-muted leading-relaxed">{faq.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-navy py-8 text-white">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <BrandLogo onDark markClassName="h-9 w-9" className="[&_span]:text-sm [&_span]:normal-case" />
            {[{ label: 'Features', id: 'about' }, { label: 'Courses', id: 'courses' }, { label: 'Pricing', id: 'pricing' }, { label: 'Contact', id: 'contact' }].map((item) => (
              <button key={item.id} onClick={() => scrollTo(item.id)} className="text-xs text-white/60 hover:text-white transition">
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-white/50">
            <p>&copy; {new Date().getFullYear()} ResearchPadi &middot; Kumasi, Ghana</p>
            <span className="text-white/20">|</span>
            <span className="inline-flex items-center gap-1"><Shield size={11} className="text-gold" /> SSL secured</span>
            <span className="inline-flex items-center gap-1"><CheckCircle size={11} className="text-gold" /> KNUST · UG · UCC · UPSA</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
