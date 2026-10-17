import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BrandLogo from '../common/BrandLogo';
import Footer from '../layout/Footer';

export const CONTACT_EMAIL = 'hello@researchpadi.com';
export const OPERATOR = 'AbusuaITLabs, Kumasi, Ghana';

const LEGAL_LINKS = [
  { to: '/terms', label: 'Terms of Service' },
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/refunds', label: 'Refund Policy' },
];

/** Shared shell for the Terms, Privacy and Refund pages. */
export default function LegalPage({ title, updated, intro, children }: {
  title: string;
  updated: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col bg-navy-mist">
      <header className="bg-white border-b border-rule">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <BrandLogo markClassName="h-9 w-9" onClick={() => navigate('/')} />
          <nav className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs sm:text-sm">
            {LEGAL_LINKS.map((l) => (
              <Link key={l.to} to={l.to} className="text-muted hover:text-navy font-medium">{l.label}</Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-10">
        <article className="bg-white rounded-[14px] border border-rule shadow-soft p-6 sm:p-10 text-sm text-ink leading-relaxed">
          <p className="eyebrow mb-2">ResearchPadi</p>
          <h1 className="text-3xl font-extrabold text-navy mb-1">{title}</h1>
          <p className="text-xs text-muted mb-6">Last updated {updated}</p>
          <div className="text-[15px] text-ink leading-relaxed mb-2">{intro}</div>
          {children}
        </article>
      </main>
      <Footer />
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-navy mb-2">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}
