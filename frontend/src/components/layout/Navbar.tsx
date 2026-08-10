import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import BrandLogo from '../common/BrandLogo';
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
        ? 'bg-[#dbeafe] text-[#1d4ed8]'
        : 'text-[#64748b] hover:bg-[#f4f7fc] hover:text-[#0f172a]'
    }`;

  return (
    <nav className="bg-white/80 backdrop-blur-xl border-b border-[#e2e8f0] sticky top-0 z-50">
      <div className="relative w-full px-3 sm:px-4 py-3 flex items-center justify-between gap-3">
        <BrandLogo markClassName="h-9 w-auto" onClick={() => navigate('/dashboard')} />

        <div className="hidden md:flex gap-1 absolute left-1/2 -translate-x-1/2">
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

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm text-[#64748b] hidden sm:inline">
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
