import { useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import BrandLogo from '../common/BrandLogo';
import { LayoutDashboard, PenLine, PanelsTopLeft, WalletCards, LogOut, Menu, X } from 'lucide-react';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);

  const [mobileOpen, setMobileOpen] = useState(false);

  if (!token) return null;

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const linkClass = (path: string) =>
    `px-3 py-2 rounded-full text-sm font-medium transition flex items-center gap-2 ${
      isActive(path)
        ? 'bg-brand-soft text-brand font-semibold'
        : 'text-muted hover:bg-navy-mist hover:text-navy'
    }`;

  const navLinks = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/new-paper', icon: PenLine, label: 'New Paper' },
    { path: '/workspace', icon: PanelsTopLeft, label: 'Workspace' },
    { path: '/wallet', icon: WalletCards, label: 'Wallet' },
  ];

  return (
    <nav className="bg-white/95 backdrop-blur-xl border-b border-rule sticky top-0 z-50">
      <div className="relative w-full px-3 sm:px-5 py-3 flex items-center justify-between gap-3">
        <BrandLogo markClassName="h-9 w-9" onClick={() => navigate('/dashboard')} />

        <div className="hidden md:flex gap-1 absolute left-1/2 -translate-x-1/2">
          {navLinks.map(({ path, icon: Icon, label }) => (
            <button key={path} onClick={() => navigate(path)} className={linkClass(path)}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline text-sm font-medium text-navy">
            {user?.full_name?.split(' ')[0]}
          </span>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="hidden md:flex text-sm text-muted hover:text-navy font-medium items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-navy-mist transition"
          >
            <LogOut size={15} />
            Logout
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-navy rounded-lg hover:bg-navy-mist transition"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-rule bg-white px-4 py-3 space-y-1">
          {navLinks.map(({ path, icon: Icon, label }) => (
            <button
              key={path}
              onClick={() => { navigate(path); setMobileOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                isActive(path) ? 'bg-brand-soft text-brand' : 'text-navy hover:bg-navy-mist'
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-muted hover:bg-navy-mist transition"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      )}
    </nav>
  );
}
