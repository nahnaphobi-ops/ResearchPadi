import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../services/adminService';
import { useAdminStore } from '../store/useAdminStore';
import logo from '../assets/logo.svg';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [adminId, setAdminId] = useState('');
  const navigate = useNavigate();
  const setAuth = useAdminStore(state => state.setAuth);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await adminService.login(email, password);
      if (result.mfa_required) {
        setAdminId(result.admin_id);
        setStep('otp');
      } else {
        setAuth(result.token, result.refreshToken, result.admin);
        navigate('/admin');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await adminService.verifyOtp(adminId, otp);
      setAuth(result.token, result.refreshToken, result.admin);
      navigate('/admin');
    } catch (err: any) {
      setError(err.response?.data?.error || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setStep('credentials');
    setOtp('');
    setError('');
    setAdminId('');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded shadow-lg">
        <div className="text-center mb-6">
          <img src={logo} alt="ResearchPadi" className="h-16 w-auto mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">Admin Portal</h2>
        </div>
        {error && <div className="p-3 mb-4 text-red-700 bg-red-100 rounded">{error}</div>}

        {step === 'credentials' ? (
          <form onSubmit={handleCredentialsSubmit}>
            <label className="block mb-2 font-medium">Email</label>
            <input
              type="email"
              className="w-full p-3 mb-4 border rounded focus:ring-2 focus:ring-gray-500"
              placeholder="admin@researchpadi.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label className="block mb-2 font-medium">Password</label>
            <input
              type="password"
              className="w-full p-3 mb-4 border rounded focus:ring-2 focus:ring-gray-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              disabled={loading}
              className="w-full p-3 bg-gray-800 text-white rounded font-bold hover:bg-gray-900 disabled:bg-gray-400"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit}>
            <p className="mb-4 text-sm text-gray-600 text-center">
              Enter the 6-digit OTP sent to your email
            </p>
            <label className="block mb-2 font-medium">OTP Code</label>
            <input
              type="text"
              className="w-full p-3 mb-4 border rounded text-center tracking-widest text-xl focus:ring-2 focus:ring-gray-500"
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
              maxLength={6}
              autoFocus
            />
            <button
              disabled={loading}
              className="w-full p-3 bg-gray-800 text-white rounded font-bold hover:bg-gray-900 disabled:bg-gray-400"
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button
              type="button"
              onClick={handleBackToLogin}
              className="w-full mt-4 text-gray-800 hover:underline"
            >
              Back to Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
