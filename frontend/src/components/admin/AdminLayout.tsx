import { useNavigate, useLocation } from 'react-router-dom';
import { useAdminStore } from '../../store/useAdminStore';
import { adminService } from '../../services/adminService';
import BrandLogo from '../common/BrandLogo';

const adminLinks = [
  { path: '/admin', label: 'Overview' },
  { path: '/admin/users', label: 'Users' },
  { path: '/admin/transactions', label: 'Transactions' },
  { path: '/admin/subscriptions', label: 'Subscriptions' },
  { path: '/admin/papers', label: 'Papers' },
  { path: '/admin/writing-assist', label: 'Writing Assist' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const admin = useAdminStore(state => state.admin);
  const logout = useAdminStore(state => state.logout);

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    try {
      await adminService.logout();
    } catch {
      // proceed with local logout even if API call fails
    }
    logout();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen app-shell">
      <nav className="bg-navy-deep border-b border-white/10 sticky top-0 z-50 text-white">
        <div className="w-full px-3 sm:px-4 py-3 flex flex-wrap lg:flex-nowrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <BrandLogo onDark markClassName="h-9 w-9" className="[&_span]:text-base" />
            <span className="text-white/45 font-normal text-sm">/ admin</span>
          </div>
          <div className="flex items-center gap-3 shrink-0 lg:order-last">
            <span className="hidden sm:inline text-sm text-white/55 truncate max-w-[200px]">{admin?.email}</span>
            <button onClick={handleLogout} className="text-sm text-white/65 hover:text-white font-medium">
              Logout
            </button>
          </div>
          <div className="w-full lg:w-auto flex gap-1 overflow-x-auto -mx-1 px-1 pb-1 lg:pb-0">
            {adminLinks.map((link) => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                aria-current={isActive(link.path) ? 'page' : undefined}
                className={`px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                  isActive(link.path) ? 'bg-brand text-white' : 'text-white/65 hover:bg-white/10'
                }`}
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
