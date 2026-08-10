import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { LayoutDashboard, PenLine, PanelsTopLeft, WalletCards, LogOut } from 'lucide-react';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);

  if (!token) return null;

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const linkClass = (path: string) =>
    `px-3 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
      isActive(path)
        ? 'bg-[#e9eef5] text-[#1e3a5f]'
        : 'text-[#64748b] hover:bg-[#f8fafc] hover:text-[#0f172a]'
    }`;

  return (
    <nav className="bg-white/80 backdrop-blur-xl border-b border-[#e2e8f0] sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-5 lg:px-8 py-3 flex justify-between items-center">
        <div className="flex items-center gap-8">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2.5" aria-label="Go to dashboard">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-[#1e3a5f] text-white font-bold text-lg">R</span>
            <span className="hidden sm:block text-lg font-bold tracking-tight text-[#0f172a]">
              Research<span className="text-[#2563eb]">Padi</span>
            </span>
          </button>
          <div className="hidden md:flex gap-1">
            <button onClick={() => navigate('/dashboard')} className={linkClass('/dashboard')}>
              <LayoutDashboard size={15} /> Dashboard
            </button>
            <button onClick={() => navigate('/new-paper')} className={linkClass('/new-paper')}>
              <PenLine size={15} /> New Paper
            </button>
            <button onClick={() => navigate('/workspace')} className={linkClass('/workspace')}>
              <PanelsTopLeft size={15} /> Workspace
            </button>
            <button onClick={() => navigate('/wallet')} className={linkClass('/wallet')}>
              <WalletCards size={15} /> Wallet
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[#64748b] hidden sm:inline border-l border-[#e2e8f0] pl-4">
            {user?.full_name?.split(' ')[0]}
          </span>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="text-sm text-[#64748b] hover:text-[#0f172a] font-medium flex items-center gap-1.5"
          >
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
