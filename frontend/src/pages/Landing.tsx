import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import logo from '../assets/logo.svg';
import hero from '../assets/hero.png';
import AdinkraBackground from '../components/common/AdinkraBackground';
import { Shield, Star, BookOpen, FileText, CheckCircle, GraduationCap, Menu, X } from 'lucide-react';

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQs', href: '#faqs' },
  { label: 'Contact', href: '#contact' },
];

const testimonials = [
  { name: 'Akosua M.', institution: 'Univ. of Ghana', text: 'ResearchPadi saved me hours on my final year project. The AI understands Ghanaian academic context perfectly.', rating: 5 },
  { name: 'Kwame A.', institution: 'KNUST', text: 'I used to struggle with citations. Now my papers are properly referenced in minutes. Game changer!', rating: 5 },
  { name: 'Esi B.', institution: 'UCC', text: 'The AI writes like a Ghanaian student would. It references local sources and follows our academic guidelines.', rating: 5 },
];

const institutions = [
  'KNUST', 'Univ. of Ghana', 'UCC', 'UPSA', 'GIMPA', 'Ashesi',
];

const features = [
  { icon: FileText, title: 'AI-Powered Writing', desc: 'Generate complete research papers and assignments with AI trained on Ghanaian academic standards.' },
  { icon: BookOpen, title: 'Local Context', desc: 'References local sources, follows Ghanaian academic guidelines, and understands our educational system.' },
  { icon: Shield, title: 'Plagiarism-Free', desc: 'Every paper is original, with proper citations in APA, MLA, Chicago, and Harvard formats.' },
  { icon: GraduationCap, title: '24/7 Support', desc: 'Get help anytime with real-time writing assistance from our AI trained on Ghanaian curricula.' },
];

const comparisonData = [
  { aspect: 'Ghanaian Academic Context', researchpadi: 'Deeply understands Ghanaian curricula, local references, and academic standards', chatgpt: 'Generic global knowledge, no Ghana-specific context' },
  { aspect: 'Citation Formats', researchpadi: 'APA, MLA, Chicago, Harvard - formatted for Ghanaian universities', chatgpt: 'Basic citations, often incorrect or hallucinated' },
  { aspect: 'Local Language Support', researchpadi: 'Understands Twi, Ga, Ewe, Hausa, and Pidgin alongside English', chatgpt: 'English only, no Ghanaian language support' },
  { aspect: 'Plagiarism Check', researchpadi: 'Built-in plagiarism detection against local and global sources', chatgpt: 'No plagiarism checking capability' },
  { aspect: 'Academic Structure', researchpadi: 'Follows Ghanaian university paper structures, formatting, and guidelines', chatgpt: 'Generic academic structure, no local alignment' },
  { aspect: 'Cost', researchpadi: 'Affordable student plans starting from as low as GHS 5 per paper', chatgpt: 'Subscription-based, not designed for academic writing' },
];

export default function Landing() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-blue-50 to-white relative overflow-hidden">
      <AdinkraBackground count={16} />

      {/* Navigation Bar */}
      <nav className="relative z-20 w-full border-b border-blue-100/50 bg-white/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center shrink-0">
            <img src={logo} alt="ResearchPadi" className="h-10 sm:h-14 w-auto" />
          </button>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map(link => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href.replace('#', ''))}
                className="text-sm font-medium text-gray-600 hover:text-blue-600 transition"
              >
                {link.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="hidden sm:inline-block text-sm font-medium text-gray-600 hover:text-blue-600 transition"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/login')}
              className="bg-blue-600 text-white px-5 sm:px-6 py-2 rounded-full font-bold text-sm hover:bg-blue-700 transition shadow-md"
            >
              Get Started
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-600"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-blue-100 bg-white px-4 py-4 space-y-3">
            {navLinks.map(link => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href.replace('#', ''))}
                className="block w-full text-left text-sm font-medium text-gray-600 hover:text-blue-600 py-2 transition"
              >
                {link.label}
              </button>
            ))}
            <button
              onClick={() => { setMobileMenuOpen(false); navigate('/login'); }}
              className="block w-full text-left text-sm font-medium text-gray-600 hover:text-blue-600 py-2 transition"
            >
              Sign In
            </button>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 px-4 sm:px-6 py-12 sm:py-16 lg:py-24 max-w-6xl mx-auto w-full">
        <div className="flex-1 text-center lg:text-left">
          <h1
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 mb-4 sm:mb-6 leading-tight"
            style={{ fontFamily: "'SlimSansSerif', sans-serif" }}
          >
            Ghana's first AI-powered <span className="text-blue-600">Academic Writing</span> platform.
          </h1>
          <p className="text-base sm:text-lg text-gray-600 mb-8 max-w-xl" style={{ fontFamily: "'SlimSansSerif', sans-serif" }}>
            Built for every Ghanaian tertiary student. Get complete research papers,
            assignment help, and real-time writing assistance grounded in local context.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => navigate('/login')}
              className="bg-blue-600 text-white px-8 py-3.5 rounded-xl font-bold text-lg hover:bg-blue-700 transition shadow-lg transform hover:scale-105"
              style={{ fontFamily: "'SlimSansSerif', sans-serif" }}
            >
              Start Your Paper Now
            </button>
            <button
              onClick={() => scrollTo('features')}
              className="bg-white text-blue-600 border-2 border-blue-600 px-8 py-3.5 rounded-xl font-bold text-lg hover:bg-blue-50 transition"
              style={{ fontFamily: "'SlimSansSerif', sans-serif" }}
            >
              Learn How It Works
            </button>
          </div>
        </div>

        <div className="flex-1 flex justify-center lg:justify-end mt-8 lg:mt-0">
          <img
            src={hero}
            alt="ResearchPadi AI Academic Writing Platform"
            className="w-full max-w-md lg:max-w-lg rounded-2xl shadow-2xl border border-blue-100"
          />
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 py-16 sm:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4" style={{ fontFamily: "'SlimSansSerif', sans-serif" }}>
              Everything you need to excel
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto" style={{ fontFamily: "'SlimSansSerif', sans-serif" }}>
              ResearchPadi is built specifically for Ghanaian students, combining AI power with local academic expertise.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className="bg-blue-50 rounded-2xl p-6 border border-blue-100 hover:shadow-lg transition">
                  <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-600">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why ResearchPadi vs ChatGPT */}
      <section className="relative z-10 py-16 sm:py-24 bg-blue-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4" style={{ fontFamily: "'SlimSansSerif', sans-serif" }}>
              Why ResearchPadi beats ChatGPT
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto" style={{ fontFamily: "'SlimSansSerif', sans-serif" }}>
              Generic AI tools weren't built for Ghanaian students. ResearchPadi was.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-blue-200 shadow-lg">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="px-4 sm:px-6 py-4 text-sm sm:text-base font-bold">Feature</th>
                  <th className="px-4 sm:px-6 py-4 text-sm sm:text-base font-bold text-center">ResearchPadi</th>
                  <th className="px-4 sm:px-6 py-4 text-sm sm:text-base font-bold text-center">ChatGPT / Generic AI</th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-blue-50/50'}>
                    <td className="px-4 sm:px-6 py-4 text-sm sm:text-base font-medium text-gray-900 border-b border-blue-100">{row.aspect}</td>
                    <td className="px-4 sm:px-6 py-4 text-sm sm:text-base text-center border-b border-blue-100">
                      <span className="inline-flex items-center gap-1.5 text-green-700 font-medium">
                        <CheckCircle className="w-4 h-4 shrink-0" /> {row.researchpadi}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm sm:text-base text-center text-gray-500 border-b border-blue-100">{row.chatgpt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-center mt-10">
            <button
              onClick={() => navigate('/login')}
              className="bg-blue-600 text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition shadow-lg transform hover:scale-105"
              style={{ fontFamily: "'SlimSansSerif', sans-serif" }}
            >
              Start Writing the Ghanaian Way
            </button>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="relative z-10 py-16 sm:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Supported Institutions */}
          <div className="mb-16">
            <h3 className="text-center text-sm font-semibold uppercase tracking-wider text-gray-500 mb-8">
              Trusted by students at
            </h3>
            <div className="flex flex-wrap justify-center gap-8 sm:gap-12">
              {institutions.map(inst => (
                <div key={inst} className="font-bold text-xl sm:text-2xl text-gray-400 italic" style={{ fontFamily: "'SlimSansSerif', sans-serif" }}>
                  {inst}
                </div>
              ))}
            </div>
          </div>

          {/* Testimonials */}
          <div className="mb-16">
            <h3 className="text-center text-2xl sm:text-3xl font-extrabold text-gray-900 mb-10" style={{ fontFamily: "'SlimSansSerif', sans-serif" }}>
              What students are saying
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {testimonials.map((t, i) => (
                <div key={i} className="bg-white rounded-2xl p-6 border border-blue-100 shadow-sm hover:shadow-md transition">
                  <div className="flex gap-1 mb-3">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-sm text-gray-700 mb-4 italic">"{t.text}"</p>
                  <div>
                    <p className="font-bold text-sm text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.institution}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security Badges */}
          <div className="flex flex-wrap justify-center gap-6 sm:gap-10">
            <div className="flex items-center gap-2 text-gray-500">
              <Shield className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium">SSL Encrypted</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <Shield className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium">GDPR Compliant</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <Shield className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium">100% Original Content</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <Shield className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium">Secure Payments</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-16 sm:py-24 bg-gradient-to-r from-blue-600 to-blue-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4" style={{ fontFamily: "'SlimSansSerif', sans-serif" }}>
            Ready to write your best paper?
          </h2>
          <p className="text-lg text-blue-100 mb-8 max-w-xl mx-auto" style={{ fontFamily: "'SlimSansSerif', sans-serif" }}>
            Join thousands of Ghanaian students already using ResearchPadi.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="bg-white text-blue-600 px-10 py-4 rounded-xl font-bold text-lg hover:bg-blue-50 transition shadow-lg transform hover:scale-105"
            style={{ fontFamily: "'SlimSansSerif', sans-serif" }}
          >
            Start Your Paper Now
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-200 bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            <div>
              <img src={logo} alt="ResearchPadi" className="h-10 w-auto mb-4" />
              <p className="text-sm text-gray-400" style={{ fontFamily: "'SlimSansSerif', sans-serif" }}>
                Ghana's first AI-powered academic writing platform, built for every Ghanaian tertiary student.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-gray-300 mb-3 text-sm uppercase tracking-wider">Product</h4>
              <ul className="space-y-2">
                {['Features', 'Pricing', 'FAQs', 'Contact'].map(item => (
                  <li key={item}>
                    <button onClick={() => scrollTo(item.toLowerCase())} className="text-sm text-gray-400 hover:text-white transition">
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-gray-300 mb-3 text-sm uppercase tracking-wider">Company</h4>
              <ul className="space-y-2">
                {['About', 'Blog', 'Privacy Policy', 'Terms of Service'].map(item => (
                  <li key={item}>
                    <span className="text-sm text-gray-400 hover:text-white transition cursor-pointer">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-gray-300 mb-3 text-sm uppercase tracking-wider">Contact</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>Kumasi, Ghana</li>
                <li>hello@researchpadi.com</li>
                <li>+233 (0) 50 000 0000</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 text-center text-sm text-gray-500">
            &copy; {new Date().getFullYear()} AbusuaITLabs, Kumasi, Ghana. Supporting academic excellence across Ghana.
          </div>
        </div>
      </footer>
    </div>
  );
}