import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <h1 className="text-6xl font-extrabold text-gray-300 mb-4">404</h1>
      <p className="text-xl text-gray-600 mb-8">Page not found</p>
      <button
        onClick={() => navigate('/dashboard')}
        className="bg-gray-800 text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-900 transition"
      >
        Go to Dashboard
      </button>
    </div>
  );
}
