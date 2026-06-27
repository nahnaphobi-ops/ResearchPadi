import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.svg';
import AdinkraBackground from '../components/common/AdinkraBackground';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-white relative overflow-hidden">
      <AdinkraBackground count={16} />
      
      <header className="absolute top-0 w-full p-6 flex justify-between items-center max-w-6xl z-10">
        <img src={logo} alt="ResearchPadi" className="h-12 w-auto" />
        <button 
          onClick={() => navigate('/login')}
          className="bg-blue-600 text-white px-6 py-2 rounded-full font-bold hover:bg-blue-700 transition"
        >
          Login
        </button>
      </header>

      <main className="text-center px-4 max-w-4xl z-10">
        <h1 
          className="text-5xl md:text-7xl font-extrabold text-gray-900 mb-6 leading-tight"
          style={{ fontFamily: "'SlimSansSerif', sans-serif" }}
        >
          Ghana's first AI-powered <span className="text-blue-600">Academic Writing</span> platform.
        </h1>
        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto" style={{ fontFamily: "'SlimSansSerif', sans-serif" }}>
          Built for every Ghanaian tertiary student. Get complete research papers, 
          assignment help, and real-time writing assistance grounded in local context.
        </p>
        
        <div className="flex flex-col md:flex-row gap-4 justify-center">
          <button 
            onClick={() => navigate('/login')}
            className="bg-blue-600 text-white px-10 py-4 rounded-xl font-bold text-xl hover:bg-blue-700 transition shadow-lg transform hover:scale-105"
            style={{ fontFamily: "'SlimSansSerif', sans-serif" }}
          >
            Start Your Paper Now
          </button>
          <button 
            className="bg-white text-blue-600 border-2 border-blue-600 px-10 py-4 rounded-xl font-bold text-xl hover:bg-blue-50 transition"
            style={{ fontFamily: "'SlimSansSerif', sans-serif" }}
          >
            Learn How It Works
          </button>
        </div>

        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 opacity-60 grayscale hover:grayscale-0 transition duration-500">
          <div className="font-bold text-xl italic" style={{ fontFamily: "'SlimSansSerif', sans-serif" }}>KNUST</div>
          <div className="font-bold text-xl italic" style={{ fontFamily: "'SlimSansSerif', sans-serif" }}>Univ. of Ghana</div>
          <div className="font-bold text-xl italic" style={{ fontFamily: "'SlimSansSerif', sans-serif" }}>UCC</div>
          <div className="font-bold text-xl italic" style={{ fontFamily: "'SlimSansSerif', sans-serif" }}>Technical Univ.</div>
        </div>
      </main>

      <footer className="mt-24 p-8 border-t w-full text-center text-gray-500 z-10">
        <p style={{ fontFamily: "'SlimSansSerif', sans-serif" }}>&copy; 2026 AbusuaITLabs, Kumasi, Ghana. Supporting academic excellence across Ghana.</p>
        <a href="/admin/login" className="text-xs text-gray-400 hover:text-gray-600 underline mt-2 inline-block">
          Admin Login
        </a>
      </footer>
    </div>
  );
}
