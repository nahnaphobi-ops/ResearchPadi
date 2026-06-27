import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import logo from '../../assets/logo.svg';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);

  if (!token) return null;

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-8">
          <button onClick={() => navigate('/dashboard')} className="flex items-center">
            <img src={logo} alt="ResearchPadi" className="h-10 w-auto" />
          </button>
          <div className="hidden md:flex gap-1">
            <button
              onClick={() => navigate('/dashboard')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${isActive('/dashboard') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Dashboard
            </button>
            <button
              onClick={() => navigate('/new-paper')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${isActive('/new-paper') || isActive('/new-paper/full') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              New Paper
            </button>
            <button
              onClick={() => navigate('/workspace')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${isActive('/workspace') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Workspace
            </button>
            <button
              onClick={() => navigate('/wallet')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${isActive('/wallet') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Wallet
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 hidden sm:inline">{user?.full_name?.split(' ')[0]}</span>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="text-sm text-gray-500 hover:text-gray-700 font-medium"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
