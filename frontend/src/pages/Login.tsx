import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/apiService';
import { useAuthStore } from '../store/useAuthStore';
import logo from '../assets/logo.svg';
import AdinkraBackground from '../components/common/AdinkraBackground';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await authService.requestOtp(phone);
      setStep(2);
      setResendTimer(60);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    setError('');
    try {
      await authService.requestOtp(phone);
      setResendTimer(60);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleTryDemo = async () => {
    setLoading(true);
    setError('');
    try {
      await authService.requestOtp('+233200000000');
      const response = await authService.verifyOtp('+233200000000', '123456');
      const { token, user, isNewUser } = response.data;
      setAuth(token, user);

      if (isNewUser) {
        const reg = await authService.updateProfile({
          full_name: 'Demo Student',
          institution_type: 'university',
          institution_name: 'University of Ghana',
          programme: 'BSc Computer Science',
          level: '300L',
        });
        if (reg.data.token) setAuth(reg.data.token, reg.data.user);
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await authService.verifyOtp(phone, otp);
      const { token, user, isNewUser } = response.data;
      setAuth(token, user);
      
      if (isNewUser) {
        navigate('/register');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 relative overflow-hidden">
      <AdinkraBackground count={10} />

      <button
        type="button"
        onClick={() => navigate('/')}
        className="absolute top-5 left-5 z-20 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
        Back to Home
      </button>

      <div className="w-full max-w-md p-8 bg-white rounded shadow-lg z-10">
        <img src={logo} alt="ResearchPadi" className="h-20 w-auto mx-auto mb-6" />
        {error && <div className="p-3 mb-4 text-red-700 bg-red-100 rounded">{error}</div>}
        
        {step === 1 ? (
          <form onSubmit={handleRequestOtp}>
            <label className="block mb-2 font-medium" style={{ fontFamily: "'SlimSansSerif', sans-serif" }}>Phone Number</label>
            <input 
              type="text" 
              className="w-full p-3 mb-4 border rounded focus:ring-2 focus:ring-gray-500" 
              placeholder="e.g. 0244123456"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <button 
              disabled={loading}
              className="w-full p-3 bg-gray-800 text-white rounded font-bold hover:bg-gray-900 disabled:bg-gray-400"
              style={{ fontFamily: "'SlimSansSerif', sans-serif" }}
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <p className="mb-4 text-sm text-gray-600 text-center" style={{ fontFamily: "'SlimSansSerif', sans-serif" }}>
              Enter the 6-digit code sent to {phone}
            </p>
            <label className="block mb-2 font-medium" style={{ fontFamily: "'SlimSansSerif', sans-serif" }}>Enter OTP</label>
            <input 
              type="text" 
              className="w-full p-3 mb-4 border rounded text-center tracking-widest text-xl focus:ring-2 focus:ring-gray-500" 
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
              maxLength={6}
            />
            <button 
              disabled={loading}
              className="w-full p-3 bg-green-600 text-white rounded font-bold hover:bg-green-700 disabled:bg-green-300"
              style={{ fontFamily: "'SlimSansSerif', sans-serif" }}
            >
              {loading ? 'Verifying...' : 'Verify & Login'}
            </button>
            <button 
              type="button"
              onClick={() => setStep(1)} 
              className="w-full mt-4 text-gray-800 hover:underline"
            >
              Change Phone Number
            </button>
            <button 
              type="button"
              onClick={handleResendOtp}
              disabled={resendTimer > 0 || loading}
              className="w-full mt-2 text-sm text-gray-500 hover:text-gray-700 disabled:text-gray-300"
            >
              {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
            </button>
          </form>
        )}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={handleTryDemo}
            disabled={loading}
            className="w-full p-3 mb-4 bg-[#C5CEBD] text-gray-900 rounded font-bold hover:bg-[#a8b49e] disabled:bg-gray-400 transition"
          >
            {loading ? 'Loading Demo...' : 'Try Demo Account'}
          </button>
          <a href="/admin/login" className="text-xs text-gray-400 hover:text-gray-600 underline">
            Admin Login
          </a>
        </div>
      </div>
    </div>
  );
}
