import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import BrandLogo from '../components/common/BrandLogo';
import HeroStudent from '../components/brand/HeroStudent';
import { testimonials } from '../data/testimonials';
import { navItems, useCases, pricingPlans, faqs } from '../data/landing';
import { withPlan } from '../utils/planIntent';
import {
  ChevronDown, CheckCircle, Shield, ArrowRight, MapPin, Mail,
  Star, GraduationCap, MessageCircle, Menu, X,
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
  const [scrolled, setScrolled] = useState(false);

  // Sections alternate white and mist. Without testimonials, pricing and
  // contact swap shades so two mist sections never sit back to back.
  const hasTestimonials = testimonials.length > 0;

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

  // The nav's edge only shows once content scrolls beneath it.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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
    <div className="relative flex flex-col min-h-screen bg-white text-ink overflow-x-clip pb-[76px] md:pb-0">
      <nav className={`nav-material sticky top-0 z-50 ${scrolled || mobileMenuOpen ? 'is-scrolled' : ''}`}>
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
          <BrandLogo markClassName="h-9 w-9" onClick={() => scrollTo('top')} />

          <div className="hidden lg:flex items-center gap-7">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="text-sm font-medium text-ink/70 hover:text-navy transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-1 ml-auto lg:ml-0">
            <button onClick={() => navigate('/login')} className="px-3 py-2 text-sm font-semibold text-navy hover:text-brand transition-colors">
              Log in
            </button>
            <button onClick={() => navigate('/login')} className="btn-primary px-4 py-2 text-sm">
              Get started
            </button>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden -mr-2 p-2 text-navy"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        <div id="mobile-menu" className={`disclosure lg:hidden ${mobileMenuOpen ? 'is-open' : ''}`} inert={!mobileMenuOpen}>
          <div>
            <div className="border-t border-rule px-5 pt-2 pb-4">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className="block w-full text-left py-3 text-base font-medium text-navy"
                >
                  {item.label}
                </button>
              ))}
              <div className="grid grid-cols-2 gap-2 pt-3 md:hidden">
                <button onClick={() => navigate('/login')} className="btn-ghost py-2.5 text-sm">Log in</button>
                <button onClick={() => navigate('/login')} className="btn-primary py-2.5 text-sm">Get started</button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden bg-navy-mist">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 pt-14 sm:pt-20 pb-16 sm:pb-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-rule bg-white px-3.5 py-1.5 text-xs font-medium text-navy mb-6 fade-up">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden="true" /> Built for Ghanaian academic work
            </p>
            <h1 className="text-[2.5rem] sm:text-[3.25rem] lg:text-[3.75rem] font-bold leading-[1.05] tracking-[-0.03em] text-navy mb-6 fade-up fade-up-delay">
              Write your research paper with&nbsp;<span className="text-brand">AI beside you</span>.
            </h1>
            <p className="text-[17px] text-ink/70 leading-relaxed mb-8 max-w-[30rem] fade-up fade-up-delay-2">
              ResearchPadi helps you research, structure, cite and check your paper. Built for students at KNUST, UG, UCC, UPSA and every Ghanaian university.
            </p>
            <div className="flex flex-wrap gap-3 fade-up fade-up-delay-3">
              <button onClick={() => navigate('/login')} className="btn-primary px-6 py-3.5 text-base inline-flex items-center gap-2">
                Get started <ArrowRight size={16} />
              </button>
              <button onClick={() => scrollTo('pricing')} className="btn-ghost px-6 py-3.5 text-base">
                See pricing
              </button>
            </div>
          </div>
          <HeroStudent className="w-full max-w-[460px] mx-auto lg:ml-auto fade-up fade-up-delay" />
        </div>
      </section>

      <section id="about" className="py-20 sm:py-28">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="reveal">
            {/* Two columns, the right one offset: every gap stays 12px. */}
            <div className="grid grid-cols-2 gap-3 items-start">
              <div className="flex flex-col gap-3">
                <div className="relative h-44 sm:h-48 rounded-2xl bg-brand overflow-hidden flex flex-col justify-end p-4 sm:p-5">
                  <img src="/landing/feature-ai.webp" alt="" width={480} height={480} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover object-[center_28%] pointer-events-none select-none" />
                  <div className="absolute inset-0 bg-gradient-to-t from-brand from-25% via-brand/90 via-50% to-brand/0 pointer-events-none" />
                  <p className="relative text-xs font-medium text-white/80 mb-1">AI generation</p>
                  <p className="relative text-white font-semibold text-sm sm:text-base leading-snug">Turn your brief into an academic-ready structure</p>
                </div>
                <div className="relative h-40 rounded-2xl bg-navy overflow-hidden flex flex-col justify-end p-4 sm:p-5">
                  <img src="/landing/feature-quality.webp" alt="" width={480} height={480} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover object-[center_32%] pointer-events-none select-none" />
                  <div className="absolute inset-0 bg-gradient-to-t from-navy from-25% via-navy/90 via-50% to-navy/0 pointer-events-none" />
                  <p className="relative text-xs font-medium text-white/70 mb-1">Quality guard</p>
                  <p className="relative text-white font-semibold text-sm sm:text-base leading-snug">Plagiarism check before export</p>
                </div>
              </div>
              <div className="flex flex-col gap-3 mt-8">
                <div className="relative h-44 sm:h-48 rounded-2xl bg-gold overflow-hidden flex flex-col justify-end p-4 sm:p-5">
                  <img src="/landing/feature-citations.webp" alt="" width={480} height={480} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover object-[center_28%] pointer-events-none select-none" />
                  <div className="absolute inset-0 bg-gradient-to-t from-gold from-25% via-gold/90 via-50% to-gold/0 pointer-events-none" />
                  <p className="relative text-xs font-medium text-navy/70 mb-1">Citations</p>
                  <p className="relative text-navy font-semibold text-sm sm:text-base leading-snug">APA · MLA · Chicago · Harvard</p>
                </div>
                <div className="h-40 rounded-2xl bg-brand-soft flex flex-col items-center justify-center gap-2 px-4 text-center">
                  <GraduationCap className="text-brand" size={32} />
                  <p className="text-sm font-semibold text-brand leading-snug">Your institution's format</p>
                </div>
              </div>
            </div>
          </div>
          <div className="reveal reveal-delay-1">
            <h2 className="text-3xl sm:text-[2.5rem] font-bold leading-[1.1] text-navy mb-5">
              An AI writing tool built for Ghanaian academic standards.
            </h2>
            <p className="text-base text-ink/70 leading-relaxed mb-7">
              Generic AI tools don't know your institution, Ghanaian university repositories, or the structure your supervisor expects. ResearchPadi is built around them.
            </p>
            <ul className="space-y-3 mb-8">
              {[
                'Drafts tailored to your institution — KNUST, UG, UCC, UPSA, GIMPA & more',
                'APA, MLA, Chicago, Harvard — tuned for African sources',
                'Plagiarism guard, quality checks, and AI supervisor review',
                'Rich writing workspace with live AI suggestions & citations',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-base font-medium text-navy">
                  <CheckCircle size={18} className="text-brand mt-0.5 shrink-0" /> {item}
                </li>
              ))}
            </ul>
            <button onClick={() => navigate('/login')} className="btn-primary px-6 py-3 text-base inline-flex items-center gap-2">
              Create your account <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      <section id="offer" className="py-20 sm:py-28 bg-navy-mist">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8">
          <div className="text-center mb-12 reveal">
            <h2 className="text-3xl sm:text-[2.5rem] font-bold leading-[1.1] text-navy">Everything you need to write with confidence</h2>
            <p className="text-base text-ink/70 mt-4 max-w-lg mx-auto">From first draft to final export — pick what you need and the plan that covers it.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {useCases.map((item, i) => {
              const Icon = item.icon;
              return (
                <article key={item.key} className={`flex flex-col bg-white rounded-2xl border border-rule overflow-hidden shadow-soft reveal reveal-delay-${(i % 4) + 1}`}>
                  <div className="relative h-40 bg-navy-soft">
                    <img src={item.image} alt={item.imageAlt} width={720} height={480} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover object-center" />
                    <span className="absolute left-4 bottom-4 grid h-10 w-10 place-items-center rounded-xl bg-white text-brand shadow-soft">
                      <Icon size={18} />
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="text-base font-semibold text-navy leading-snug mb-2">{item.title}</h3>
                    <p className="text-sm text-ink/70 leading-relaxed mb-4">{item.desc}</p>
                    <ul className="space-y-2 mb-5">
                      {item.points.map((point) => (
                        <li key={point} className="flex items-start gap-2 text-sm leading-snug text-ink">
                          <CheckCircle size={14} className="mt-0.5 shrink-0 text-brand" />
                          {point}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto pt-4 border-t border-rule">
                      <p className="text-xs font-medium text-muted mb-2">{item.planLabel}</p>
                      <button
                        onClick={() => navigate(withPlan('/login', item.plan))}
                        className="text-sm font-semibold text-brand hover:text-brand-hover inline-flex items-center gap-1 transition-colors"
                      >
                        Get started <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {hasTestimonials && (
      <section id="students" className="py-20 sm:py-28">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8">
          <div className="text-center mb-12 reveal">
            <h2 className="text-3xl sm:text-[2.5rem] font-bold leading-[1.1] text-navy">What Ghanaian students say</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <blockquote key={t.initials} className={`rounded-2xl bg-white border border-rule p-6 shadow-soft reveal reveal-delay-${i + 1}`}>
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: 5 }).map((_, s) => <Star key={s} size={12} className="text-gold" fill="currentColor" />)}
                </div>
                <p className="text-base text-ink leading-relaxed mb-6">“{t.text}”</p>
                <div className="flex items-center gap-3 pt-4 border-t border-rule">
                  <div className="w-10 h-10 rounded-full bg-brand text-white text-xs font-semibold grid place-items-center shrink-0">{t.initials}</div>
                  <div>
                    <p className="text-sm font-semibold text-navy">{t.name}</p>
                    <p className="text-xs text-muted">{t.role}</p>
                    <p className="text-xs text-brand font-medium">{t.institution}</p>
                  </div>
                </div>
              </blockquote>
            ))}
          </div>
        </div>
      </section>
      )}

      <section id="pricing" className={`py-20 sm:py-28 ${hasTestimonials ? 'bg-navy-mist' : ''}`}>
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8">
          <div className="text-center mb-14 reveal">
            <h2 className="text-3xl sm:text-[2.5rem] font-bold leading-[1.1] text-navy">Student-friendly plans. No surprises.</h2>
            <p className="text-base text-ink/70 mt-4 max-w-xl mx-auto">All prices in GHS. 30-day plans never auto-renew. No hidden fees.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
            {pricingPlans.map((plan, i) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl p-7 reveal reveal-delay-${i + 1} ${
                  plan.highlighted ? 'bg-navy text-white shadow-card' : 'bg-white border border-rule'
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-7 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white">
                    Most popular
                  </span>
                )}
                <h3 className={`text-lg font-semibold ${plan.highlighted ? 'text-white' : 'text-navy'}`}>{plan.name}</h3>
                <p className={`text-sm mt-1 mb-6 min-h-[2.5rem] ${plan.highlighted ? 'text-white/70' : 'text-ink/70'}`}>{plan.desc}</p>
                <div className="flex items-baseline gap-1.5 mb-6">
                  <span className={`text-[2rem] font-bold leading-none tracking-[-0.02em] ${plan.highlighted ? 'text-white' : 'text-navy'}`}>{plan.price}</span>
                  <span className={`text-sm ${plan.highlighted ? 'text-white/60' : 'text-muted'}`}>{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <CheckCircle className={`w-4 h-4 shrink-0 mt-0.5 ${plan.highlighted ? 'text-gold' : 'text-brand'}`} />
                      <span className={`text-sm ${plan.highlighted ? 'text-white/85' : 'text-ink/80'}`}>{feat}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate(withPlan('/login', plan.key))}
                  className={`mt-auto w-full py-3 text-sm ${plan.highlighted ? 'btn-primary' : 'btn-ghost'}`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className={`py-20 sm:py-28 ${hasTestimonials ? '' : 'bg-navy-mist'}`}>
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          <div className="bg-navy text-white rounded-2xl p-7 sm:p-9 reveal">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gold mb-3">Get in touch</p>
            <h2 className="text-2xl sm:text-3xl font-bold leading-tight mb-3">Your next paper starts with one brief.</h2>
            <p className="text-base text-white/75 leading-relaxed mb-8">Questions about plans, payment, or your university's format? Message us — we reply Mon–Fri, 8am–6pm.</p>
            <div className="space-y-3 mb-8">
              <a href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-3 text-sm text-white/85 hover:text-gold transition-colors w-fit"><Mail size={16} /> {CONTACT_EMAIL}</a>
              <div className="flex items-center gap-3 text-sm text-white/85"><MapPin size={16} /> Kumasi, Ghana</div>
            </div>
            <div className="flex flex-wrap gap-3">
              {whatsappHref && (
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="bg-[#25D366] text-white px-6 py-3 rounded-[10px] text-sm font-semibold inline-flex items-center gap-2 hover:brightness-95 active:scale-[0.97] transition">
                  <MessageCircle size={16} /> Chat on WhatsApp
                </a>
              )}
              <a href={`mailto:${CONTACT_EMAIL}`} className="btn-primary px-6 py-3 text-sm inline-flex items-center gap-2">
                <Mail size={16} /> Email us
              </a>
              <button onClick={() => navigate('/login')} className="border border-white/20 text-white px-6 py-3 rounded-[10px] text-sm font-semibold hover:bg-white/10 active:scale-[0.97] transition">
                Create your account
              </button>
            </div>
          </div>

          <div id="faqs" className="scroll-mt-24 reveal reveal-delay-1">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy mb-6">Frequently asked questions</h2>
            <div className="space-y-2">
              {faqs.map((faq, i) => {
                const open = openFaq === i;
                return (
                  <div key={faq.q} className={`rounded-xl border bg-white transition-colors ${open ? 'border-brand/40' : 'border-rule'}`}>
                    <button
                      onClick={() => setOpenFaq(open ? null : i)}
                      aria-expanded={open}
                      aria-controls={`faq-${i}`}
                      className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                    >
                      <span className="text-base font-semibold text-navy">{faq.q}</span>
                      <ChevronDown className={`w-4 h-4 text-muted shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
                    </button>
                    <div id={`faq-${i}`} className={`disclosure ${open ? 'is-open' : ''}`} inert={!open}>
                      <div>
                        <p className="px-5 pb-5 text-sm text-ink/70 leading-relaxed">{faq.a}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-navy text-white">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <BrandLogo onDark markClassName="h-9 w-9" className="[&_span]:text-sm [&_span]:normal-case" />
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {navItems.map((item) => (
                <button key={item.id} onClick={() => scrollTo(item.id)} className="text-sm text-white/70 hover:text-white transition-colors">
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs text-white/60">
            <p>&copy; {new Date().getFullYear()} ResearchPadi &middot; Kumasi, Ghana</p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className="inline-flex items-center gap-1.5"><Shield size={12} className="text-gold" /> SSL secured</span>
              <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link to="/refunds" className="hover:text-white transition-colors">Refunds</Link>
            </div>
          </div>
        </div>
      </footer>

      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 nav-material border-t border-rule px-4 py-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-navy leading-tight">Ready to write?</p>
          <p className="text-xs text-muted leading-tight mt-0.5">Free plan, no payment</p>
        </div>
        <button onClick={() => navigate('/login')} className="btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-1.5 shrink-0">
          Get started <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
