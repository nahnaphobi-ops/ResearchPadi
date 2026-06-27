import { useNavigate, useLocation } from 'react-router-dom';
import { useAdminStore } from '../../store/useAdminStore';
import { adminService } from '../../services/adminService';
import logo from '../../assets/logo.svg';

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
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <img src={logo} alt="ResearchPadi" className="h-10 w-auto" />
            <div className="flex gap-1">
              <button
                onClick={() => navigate('/admin')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${isActive('/admin') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                Overview
              </button>
              <button
                onClick={() => navigate('/admin/users')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${isActive('/admin/users') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                Users
              </button>
              <button
                onClick={() => navigate('/admin/transactions')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${isActive('/admin/transactions') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                Transactions
              </button>
              <button
                onClick={() => navigate('/admin/subscriptions')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${isActive('/admin/subscriptions') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                Subscriptions
              </button>
              <button
                onClick={() => navigate('/admin/papers')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${isActive('/admin/papers') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                Papers
              </button>
              <button
                onClick={() => navigate('/admin/writing-assist')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${isActive('/admin/writing-assist') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                Writing Assist
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{admin?.email}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-700 font-medium"
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
