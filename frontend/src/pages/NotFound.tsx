import { useNavigate } from 'react-router-dom';
import BrandLogo from '../components/common/BrandLogo';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-navy-mist">
      <BrandLogo markClassName="h-10 w-10" className="mb-6" onClick={() => navigate('/')} />
      <h1 className="text-6xl font-extrabold text-navy/20 mb-4">404</h1>
      <p className="text-xl text-muted mb-8">Page not found</p>
      <button
        onClick={() => navigate('/dashboard')}
        className="btn-primary px-6 py-3 text-sm"
      >
        Go to Dashboard
      </button>
    </div>
  );
}
