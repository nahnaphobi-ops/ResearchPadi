import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import BrandLogo from '../components/common/BrandLogo';
import HeroStudent from '../components/brand/HeroStudent';
import { testimonials } from '../data/testimonials';
import { navItems, useCases, pricingPlans, faqs } from '../data/landing';
import { withPlan } from '../utils/planIntent';
import {
  ChevronDown, CheckCircle, Shield, ArrowRight, MapPin, Mail,
  Star, GraduationCap, MessageCircle, Quote, Wallet,
} from 'lucide-react';

const CONTACT_EMAIL = 'hello@researchpadi.com';
// Optional: international format without "+", e.g. 233241234567
const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined;
const whatsappHref = WHATSAPP_NUMBER
  ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hi ResearchPadi, I have a question.')}`
  : null;

export default function Landing() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

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
  }, []);

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    if (id === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="relative flex flex-col min-h-screen bg-white text-ink overflow-x-hidden pb-[76px] md:pb-0">
      <div className="bg-navy text-white text-xs">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-white/80">
            <span className="hidden sm:inline-flex items-center gap-1.5"><MapPin size={12} /> Kumasi, Ghana</span>
            <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex items-center gap-1.5 hover:text-gold">
              <Mail size={12} /> {CONTACT_EMAIL}
            </a>
          </div>
          <button onClick={() => navigate('/login')} className="font-semibold hover:text-gold">
            Login / Register
          </button>
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
                className="text-[12px] font-bold uppercase tracking-wide text-navy hover:text-brand transition"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button onClick={() => scrollTo('contact')} className="btn-primary px-4 py-2.5 text-xs inline-flex items-center gap-1">
              Contact us <ArrowRight size={13} />
            </button>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-navy text-xl"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
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
            <p className="inline-flex items-center gap-2 rounded-full bg-navy px-4 py-1.5 text-[10px] sm:text-[11px] font-bold tracking-[0.08em] text-gold mb-5 fade-up">
              <span className="h-1.5 w-1.5 rounded-full bg-gold/80" aria-hidden="true" /> Built for Ghanaian academic work
            </p>
            <h1 className="text-[2.35rem] sm:text-5xl lg:text-[3.4rem] font-extrabold leading-[1.12] text-navy mb-6 fade-up fade-up-delay">
              From brief to&nbsp;
              <span className="text-brand">supervisor-ready</span>
              &nbsp;draft in minutes.
            </h1>
            <p className="text-sm text-muted leading-relaxed mb-6 max-w-md fade-up fade-up-delay">
              ResearchPadi writes, cites, and quality-checks your research paper — written for students at KNUST, UG, UCC, UPSA and every Ghanaian university.
            </p>
            <ul className="space-y-2 mb-7 fade-up fade-up-delay-2">
              {['Tailored to your institution and programme', 'AI writing workspace with live suggestions', 'Plagiarism check before you submit'].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm font-semibold text-navy">
                  <CheckCircle size={16} className="text-brand flex-shrink-0" /> {item}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3 fade-up fade-up-delay-3">
              <button onClick={() => navigate('/login')} className="btn-primary px-7 py-3.5 text-sm inline-flex items-center gap-2 shadow-card">
                Get started <ArrowRight size={15} />
              </button>
              <button onClick={() => scrollTo('pricing')} className="btn-ghost px-7 py-3.5 text-sm">
                See pricing
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-5 fade-up fade-up-delay-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-navy">
                <Shield size={14} className="text-brand shrink-0" /> Plagiarism check before export
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-navy">
                <GraduationCap size={14} className="text-brand shrink-0" /> Ghanaian academic standards
              </span>
            </div>
          </div>
          <HeroStudent className="max-w-[480px] mx-auto lg:ml-auto fade-up fade-up-delay" />
        </div>

        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 pb-10 sm:pb-14">
          <div className="reveal bg-white rounded-2xl shadow-card border border-rule px-5 py-4 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-center">
            <p className="text-sm font-bold text-navy inline-flex items-center gap-2">
              <GraduationCap size={16} className="text-brand shrink-0" />
              For <span className="text-brand">KNUST · UG · UCC · UPSA</span> students
            </p>
            <span className="hidden sm:block h-4 w-px bg-rule" aria-hidden="true" />
            <p className="text-xs font-semibold text-muted tracking-wide inline-flex items-center gap-1.5">
              <Quote size={13} className="text-brand shrink-0" /> APA · MLA · Chicago · Harvard
            </p>
            <span className="hidden sm:block h-4 w-px bg-rule" aria-hidden="true" />
            <p className="text-xs font-semibold text-muted tracking-wide inline-flex items-center gap-1.5">
              <Wallet size={13} className="text-brand shrink-0" /> Priced in GHS for students
            </p>
          </div>
        </div>
      </section>

      <section id="about" className="py-20 sm:py-28">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <div className="relative reveal">
            <div className="grid grid-cols-2 gap-3">
              <div className="relative h-44 rounded-2xl bg-brand overflow-hidden flex flex-col justify-end p-4 sm:p-5">
                <img src="/landing/feature-ai.webp" alt="" width={480} height={480} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover object-[center_28%] pointer-events-none select-none" />
                <div className="absolute inset-0 bg-gradient-to-t from-brand via-brand/80 to-brand/10 sm:inset-x-0 sm:top-auto sm:h-24 sm:via-brand/70 sm:to-transparent pointer-events-none" />
                <p className="relative text-[10px] font-bold text-white/80 uppercase tracking-wide mb-1">AI Generation</p>
                <p className="relative text-white font-extrabold text-sm leading-snug">Turn your brief into an academic-ready structure</p>
              </div>
              <div className="relative h-44 rounded-2xl bg-gold mt-8 overflow-hidden flex flex-col justify-end p-4 sm:p-5">
                <img src="/landing/feature-citations.webp" alt="" width={480} height={480} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover object-[center_28%] pointer-events-none select-none" />
                <div className="absolute inset-0 bg-gradient-to-t from-gold via-gold/85 to-gold/10 sm:inset-x-0 sm:top-auto sm:h-24 sm:via-gold/75 sm:to-transparent pointer-events-none" />
                <p className="relative text-[10px] font-bold text-navy/70 uppercase tracking-wide mb-1">Citations</p>
                <p className="relative text-navy font-extrabold text-sm leading-snug">APA · MLA · Chicago · Harvard</p>
              </div>
              <div className="relative h-36 rounded-2xl bg-navy overflow-hidden flex flex-col justify-end p-4 sm:p-5">
                <img src="/landing/feature-quality.webp" alt="" width={480} height={480} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover object-[center_32%] pointer-events-none select-none" />
                <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/80 to-navy/10 sm:inset-x-0 sm:top-auto sm:h-20 sm:via-navy/75 sm:to-transparent pointer-events-none" />
                <p className="relative text-[10px] font-bold text-white/70 uppercase tracking-wide mb-1">Quality Guard</p>
                <p className="relative text-white font-extrabold text-sm leading-snug">Plagiarism check before export</p>
              </div>
              <div className="h-36 rounded-2xl bg-brand-soft -mt-4 flex items-center justify-center flex-col gap-2">
                <GraduationCap className="text-brand" size={36} />
                <p className="text-[11px] font-bold text-brand text-center leading-tight px-3">For KNUST · UG · UCC · UPSA students</p>
              </div>
            </div>
            <div className="hidden sm:grid absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-24 w-24 rounded-full bg-white text-navy place-content-center text-center shadow-card border-4 border-brand/20">
              <p className="text-base font-extrabold leading-none text-brand">GHS</p>
              <p className="text-[9px] font-bold uppercase tracking-wide mt-1 text-navy/70">Student plans</p>
            </div>
          </div>
          <div className="reveal reveal-delay-1">
            <p className="eyebrow mb-3">Why ResearchPadi?</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-navy leading-tight mb-4">
              An AI writing tool built for Ghanaian academic standards.
            </h2>
            <p className="text-sm text-muted leading-relaxed mb-6">
              Generic AI tools don't know your institution, Ghanaian university repositories, or the structure your supervisor expects. ResearchPadi is built around them.
            </p>
            <ul className="space-y-3 mb-8">
              {[
                'Drafts tailored to your institution — KNUST, UG, UCC, UPSA, GIMPA & more',
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
              Create your account <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </section>

      <section id="offer" className="py-16 sm:py-24 bg-navy-mist">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8">
          <div className="text-center mb-10 reveal">
            <p className="eyebrow mb-3">What you get</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-navy">Everything you need to submit with confidence</h2>
            <p className="text-sm text-muted mt-3 max-w-lg mx-auto">From first draft to final export — pick what you need and the plan that covers it.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {useCases.map((item, i) => {
              const Icon = item.icon;
              return (
                <article key={item.key} className={`flex flex-col bg-white rounded-2xl border border-rule overflow-hidden shadow-soft hover:-translate-y-1 transition reveal reveal-delay-${(i % 4) + 1}`}>
                  <div className="relative h-36 bg-navy-soft">
                    <img src={item.image} alt={item.imageAlt} width={720} height={480} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover object-center" />
                    <span className="absolute left-3 bottom-3 grid h-10 w-10 place-items-center rounded-xl bg-white text-brand shadow-soft">
                      <Icon size={18} />
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="font-extrabold text-navy text-sm leading-snug mb-2">{item.title}</h3>
                    <p className="text-xs text-muted leading-relaxed mb-3">{item.desc}</p>
                    <ul className="space-y-1.5 mb-4">
                      {item.points.map((point) => (
                        <li key={point} className="flex items-start gap-1.5 text-[12px] leading-snug text-ink">
                          <CheckCircle size={13} className="mt-0.5 shrink-0 text-brand" />
                          {point}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto pt-3 border-t border-rule">
                      <p className="text-[11px] font-bold text-navy mb-2">{item.planLabel}</p>
                      <button
                        onClick={() => navigate(withPlan('/login', item.plan))}
                        className="text-xs font-bold text-brand hover:text-brand-hover inline-flex items-center gap-1"
                      >
                        Get started <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {testimonials.length > 0 && (
      <section id="students" className="py-16 sm:py-24">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8">
          <div className="text-center mb-10 reveal">
            <p className="eyebrow mb-3">From real students</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-navy">What Ghanaian students say</h2>
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
      )}

      <section id="pricing" className="py-16 sm:py-24 bg-navy-mist">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8">
          <div className="text-center mb-12 reveal">
            <p className="eyebrow mb-3">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-navy">Student-friendly plans. No surprises.</h2>
            <p className="text-sm text-muted mt-3 max-w-lg mx-auto">All prices in GHS. Monthly plans never auto-renew. No hidden fees.</p>
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
                  onClick={() => navigate(withPlan('/login', plan.key))}
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
            <p className="eyebrow text-gold mb-3 relative z-10">Get in touch</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-2 relative z-10">Your supervisor-ready draft is one brief away.</h2>
            <p className="text-sm text-white/70 mb-8 relative z-10">Questions about plans, payment, or your university's format? Message us — we reply Mon–Fri, 8am–6pm.</p>
            <div className="space-y-3 mb-8 relative z-10">
              <a href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-3 text-sm text-white/85 hover:text-gold w-fit"><Mail size={16} /> {CONTACT_EMAIL}</a>
              <div className="flex items-center gap-3 text-sm text-white/85"><MapPin size={16} /> Kumasi, Ghana</div>
            </div>
            <div className="flex flex-wrap gap-3 relative z-10">
              {whatsappHref && (
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="bg-[#25D366] text-white px-6 py-3 rounded-[10px] text-sm font-bold inline-flex items-center gap-2 hover:brightness-95 transition">
                  <MessageCircle size={16} /> Chat on WhatsApp
                </a>
              )}
              <a href={`mailto:${CONTACT_EMAIL}`} className="btn-primary px-6 py-3 text-sm inline-flex items-center gap-2">
                <Mail size={16} /> Email us
              </a>
              <button onClick={() => navigate('/login')} className="border border-white/20 text-white px-6 py-3 rounded-[10px] text-sm font-bold hover:bg-white/10 transition">
                Create your account
              </button>
            </div>
          </div>

          <div id="faqs" className="reveal reveal-delay-1">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-navy mb-6">Frequently asked questions</h2>
            <div className="space-y-2">
              {faqs.map((faq, i) => (
                <div key={faq.q} className={`rounded-xl border bg-white transition ${openFaq === i ? 'border-brand/40' : 'border-rule'}`}>
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    aria-expanded={openFaq === i}
                    className="w-full flex items-center justify-between px-5 py-4 text-left"
                  >
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
            {navItems.filter((item) => item.id !== 'top').map((item) => (
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

      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-rule px-4 py-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold text-navy leading-tight">Ready to write?</p>
          <p className="text-[11px] text-muted leading-tight">Plans from GHS 120</p>
        </div>
        <button onClick={() => navigate('/login')} className="btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-1.5 shrink-0">
          Get started <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
