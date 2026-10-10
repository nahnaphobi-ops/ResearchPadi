import { useState } from 'react';
import { apiErrorMessage } from '../utils/apiError';
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
  const [otpMessage, setOtpMessage] = useState('');
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
        setOtpMessage(result.message || '');
        setStep('otp');
      } else {
        setAuth(result.token, result.refreshToken, result.admin);
        navigate('/admin');
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Login failed'));
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
    } catch (err) {
      setError(apiErrorMessage(err, 'OTP verification failed'));
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-navy-mist px-5">
      <div className="w-full max-w-md p-6 sm:p-8 bg-white rounded-[14px] border border-rule shadow-soft">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <BrandLogo markClassName="h-12 w-12" />
          </div>
          <h2 className="text-2xl font-bold text-navy">Admin portal</h2>
        </div>
        {error && <div role="alert" className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-[10px]">{error}</div>}

        {step === 'credentials' ? (
          <form onSubmit={handleCredentialsSubmit}>
            <label htmlFor="admin-email" className="block mb-2 font-medium text-ink">Email</label>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              className="w-full p-3 mb-4 border rounded-[10px]"
              placeholder="admin@researchpadi.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label htmlFor="admin-password" className="block mb-2 font-medium text-ink">Password</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              className="w-full p-3 mb-4 border rounded-[10px]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              disabled={loading}
              className="btn-primary w-full p-3 text-sm disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit}>
            <p className="mb-4 text-sm text-muted text-center">
              {otpMessage || 'Enter the 6-digit code we sent you.'}
            </p>
            <label htmlFor="admin-otp" className="block mb-2 font-medium text-ink">One-time code</label>
            <input
              id="admin-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
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
              {loading ? 'Verifying...' : 'Verify code'}
            </button>
            <button
              type="button"
              onClick={handleBackToLogin}
              className="w-full mt-4 text-navy hover:underline"
            >
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
