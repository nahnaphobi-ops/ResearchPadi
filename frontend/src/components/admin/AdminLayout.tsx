import { useNavigate, useLocation } from 'react-router-dom';
import { useAdminStore } from '../../store/useAdminStore';
import { adminService } from '../../services/adminService';
import BrandLogo from '../common/BrandLogo';

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
      <nav className="bg-[#2563eb] border-b border-white/10 sticky top-0 z-50 text-white">
        <div className="relative w-full px-3 sm:px-4 py-3 flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
          <div className="flex items-center gap-2 shrink-0">
            <BrandLogo onDark markClassName="h-9 w-auto" className="[&_span]:text-base" />
            <span className="text-white/45 font-normal text-sm">/ admin</span>
          </div>
          <div className="flex flex-wrap gap-1 lg:absolute lg:left-1/2 lg:-translate-x-1/2">
              <button
                onClick={() => navigate('/admin')}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition ${isActive('/admin') ? 'bg-white/10 text-[#bfdbfe]' : 'text-white/65 hover:bg-white/10'}`}
              >
                Overview
              </button>
              <button
                onClick={() => navigate('/admin/users')}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition ${isActive('/admin/users') ? 'bg-white/10 text-[#bfdbfe]' : 'text-white/65 hover:bg-white/10'}`}
              >
                Users
              </button>
              <button
                onClick={() => navigate('/admin/transactions')}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition ${isActive('/admin/transactions') ? 'bg-white/10 text-[#bfdbfe]' : 'text-white/65 hover:bg-white/10'}`}
              >
                Transactions
              </button>
              <button
                onClick={() => navigate('/admin/subscriptions')}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition ${isActive('/admin/subscriptions') ? 'bg-white/10 text-[#bfdbfe]' : 'text-white/65 hover:bg-white/10'}`}
              >
                Subscriptions
              </button>
              <button
                onClick={() => navigate('/admin/papers')}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition ${isActive('/admin/papers') ? 'bg-white/10 text-[#bfdbfe]' : 'text-white/65 hover:bg-white/10'}`}
              >
                Papers
              </button>
              <button
                onClick={() => navigate('/admin/writing-assist')}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition ${isActive('/admin/writing-assist') ? 'bg-white/10 text-[#bfdbfe]' : 'text-white/65 hover:bg-white/10'}`}
              >
                Writing Assist
              </button>
          </div>
          <div className="flex items-center gap-3 shrink-0 lg:ml-auto">
             <span className="text-sm text-white/55">{admin?.email}</span>
            <button
              onClick={handleLogout}
               className="text-sm text-white/65 hover:text-white font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
