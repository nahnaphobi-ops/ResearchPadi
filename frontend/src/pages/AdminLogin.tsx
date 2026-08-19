import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../services/adminService';
import { useAdminStore } from '../store/useAdminStore';
import BrandLogo from '../components/common/BrandLogo';

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
    <div className="flex flex-col items-center justify-center min-h-screen bg-navy-mist">
      <div className="w-full max-w-md p-8 bg-white rounded-[14px] border border-rule shadow-soft">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <BrandLogo markClassName="h-12 w-12" />
          </div>
          <h2 className="text-2xl font-bold text-navy">Admin portal</h2>
        </div>
        {error && <div className="p-3 mb-4 text-red-700 bg-red-100 rounded-[10px]">{error}</div>}

        {step === 'credentials' ? (
          <form onSubmit={handleCredentialsSubmit}>
            <label className="block mb-2 font-medium text-ink">Email</label>
            <input
              type="email"
              className="w-full p-3 mb-4 border rounded-[10px]"
              placeholder="admin@researchpadi.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label className="block mb-2 font-medium text-ink">Password</label>
            <input
              type="password"
              className="w-full p-3 mb-4 border rounded-[10px]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              disabled={loading}
              className="btn-primary w-full p-3 text-sm disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit}>
            <p className="mb-4 text-sm text-muted text-center">
              Enter the 6-digit OTP sent to your email
            </p>
            <label className="block mb-2 font-medium text-ink">OTP Code</label>
            <input
              type="text"
              className="w-full p-3 mb-4 border rounded-[10px] text-center tracking-widest text-xl"
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
              maxLength={6}
              autoFocus
            />
            <button
              disabled={loading}
              className="btn-primary w-full p-3 text-sm disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button
              type="button"
              onClick={handleBackToLogin}
              className="w-full mt-4 text-navy hover:underline"
            >
              Back to Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
