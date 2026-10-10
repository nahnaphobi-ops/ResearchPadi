import { useNavigate } from 'react-router-dom';
import BrandLogo from '../components/common/BrandLogo';
import { useAuthStore } from '../store/useAuthStore';

export default function NotFound() {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-navy-mist px-5 text-center">
      <BrandLogo markClassName="h-10 w-10" className="mb-6" onClick={() => navigate('/')} />
      <h1 className="text-6xl font-extrabold text-navy/20 mb-4">404</h1>
      <p className="text-xl font-bold text-navy mb-2">Page not found</p>
      <p className="text-sm text-muted mb-8 max-w-sm">The link may be broken, or the page may have moved.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button onClick={() => navigate(token ? '/dashboard' : '/')} className="btn-primary px-6 py-3 text-sm">
          {token ? 'Go to dashboard' : 'Go to homepage'}
        </button>
        <button onClick={() => navigate(-1)} className="btn-ghost px-6 py-3 text-sm">
          Go back
        </button>
      </div>
    </div>
  );
}
