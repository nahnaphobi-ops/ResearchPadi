import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/apiService';
import { useAuthStore } from '../store/useAuthStore';
import BrandLogo from '../components/common/BrandLogo';
import HeroStudent from '../components/brand/HeroStudent';

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
    <div className="min-h-screen grid lg:grid-cols-2 bg-navy-mist">
      <div className="hidden lg:flex relative flex-col justify-between p-12 bg-navy text-white overflow-hidden">
        <div className="relative z-10">
          <BrandLogo onDark markClassName="h-10 w-10" onClick={() => navigate('/')} />
        </div>
        <div className="relative z-10 flex flex-col items-start gap-8">
          <HeroStudent className="w-full max-w-sm" />
          <div className="max-w-md">
            <p className="display text-4xl leading-tight mb-4">Online education feels like a real classroom.</p>
            <p className="text-white/70 text-sm leading-relaxed">
              Sign in to continue drafting, citing, and refining academic work built for Ghanaian universities.
            </p>
          </div>
        </div>
        <p className="relative z-10 text-xs text-white/40">AbusuaITLabs · Kumasi, Ghana</p>
      </div>

      <div className="flex flex-col items-center justify-center px-5 py-12 relative">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="absolute top-5 left-5 lg:hidden inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink transition"
        >
          ← Back
        </button>

        <div className="w-full max-w-md bg-white rounded-[14px] border border-rule p-8 shadow-soft">
          <div className="flex justify-center mb-4 lg:hidden">
            <BrandLogo markClassName="h-12 w-auto" />
          </div>
          <h1 className="display text-3xl text-center text-navy mb-1">Welcome back</h1>
          <p className="text-sm text-center text-muted mb-8">
            {step === 1 ? 'Enter your phone number to receive a one-time code.' : `Enter the code sent to ${phone}`}
          </p>

          {error && <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-xl">{error}</div>}

          {step === 1 ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block mb-2 text-sm font-medium text-ink">Phone number</label>
                <input
                  type="text"
                  className="w-full p-3 border rounded-[10px] focus:ring-0"
                  placeholder="e.g. 0244123456"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              <button disabled={loading} className="btn-primary w-full p-3.5 text-sm disabled:opacity-50">
                {loading ? 'Sending...' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block mb-2 text-sm font-medium text-ink">One-time code</label>
                <input
                  type="text"
                  className="w-full p-3 border rounded-[10px] text-center tracking-[0.35em] text-xl"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  maxLength={6}
                />
              </div>
              <button disabled={loading} className="btn-primary w-full p-3.5 text-sm disabled:opacity-50">
                {loading ? 'Verifying...' : 'Verify & continue'}
              </button>
              <button type="button" onClick={() => setStep(1)} className="w-full text-sm text-navy font-medium hover:underline">
                Change phone number
              </button>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendTimer > 0 || loading}
                className="w-full text-sm text-muted hover:text-ink disabled:text-rule"
              >
                {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
              </button>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-rule">
            <button
              type="button"
              onClick={handleTryDemo}
              disabled={loading}
              className="w-full p-3.5 mb-3 bg-brand-soft text-brand rounded-[10px] font-bold text-sm hover:bg-[#dbe5ff] disabled:opacity-50 transition"
            >
              {loading ? 'Loading demo...' : 'Try demo account'}
            </button>
            <a href="/admin/login" className="block text-center text-xs text-muted hover:text-ink underline">
              Admin login
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
