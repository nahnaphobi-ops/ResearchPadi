import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../services/apiService';
import { useAuthStore } from '../store/useAuthStore';
import BrandLogo from '../components/common/BrandLogo';
import HeroStudent from '../components/brand/HeroStudent';
import { parsePlan, planDestination, withPlan } from '../utils/planIntent';
import { apiErrorMessage } from '../utils/apiError';
import { takeAfterLogin } from '../utils/afterLogin';
import { defaultKeepSignedIn, setKeepSignedIn } from '../utils/sessionLength';
import { ArrowLeft } from 'lucide-react';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [notice, setNotice] = useState('');
  const [keepSignedIn, setKeep] = useState(defaultKeepSignedIn);
  // Only offer "Try demo" when the server has the demo account switched on.
  const [demoAvailable, setDemoAvailable] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const plan = parsePlan(searchParams.get('plan'));
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    let cancelled = false;
    authService.options()
      .then((res) => { if (!cancelled) setDemoAvailable(Boolean(res.data?.demoLogin)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

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
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to send OTP'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    setError('');
    setNotice('');
    try {
      await authService.requestOtp(phone);
      setOtp('');
      setResendTimer(60);
      setNotice(`New code sent to ${phone}. Codes expire after 5 minutes.`);
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to resend OTP'));
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
      setKeepSignedIn(keepSignedIn);
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
      navigate(planDestination(plan));
    } catch (err) {
      setError(apiErrorMessage(err, 'Demo login failed'));
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
      setKeepSignedIn(keepSignedIn);
      setAuth(token, user);
      // New users finish registering first; Register sends them on.
      const after = isNewUser ? null : takeAfterLogin();

      if (isNewUser) {
        navigate(withPlan('/register', plan));
      } else if (after) {
        navigate(after);
      } else if (user.is_admin && !plan) {
        navigate('/admin');
      } else {
        navigate(planDestination(plan));
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Invalid OTP'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-navy-mist">
      <div className="hidden lg:flex flex-col justify-between gap-10 p-12 bg-navy text-white">
        <div>
          <BrandLogo onDark markClassName="h-11 w-11" onClick={() => navigate('/')} />
        </div>
        <div className="flex flex-col items-start gap-8">
          <HeroStudent className="w-full max-w-[300px]" />
          <div className="max-w-md">
            <p className="display text-4xl leading-[1.1] mb-4">
              Research and write with <span className="text-gold">AI beside you</span>.
            </p>
            <p className="text-white/75 text-base leading-relaxed mb-6">
              The AI writing platform built for students at KNUST, UG, UCC, UPSA and every Ghanaian university.
            </p>
            <div className="flex flex-col gap-2.5">
              {['Tailored to your institution and programme', 'AI writing workspace with live suggestions', 'Plagiarism check before you submit'].map(item => (
                <div key={item} className="flex items-center gap-2.5 text-sm text-white/85">
                  <div className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="text-xs text-white/50">ResearchPadi · AbusuaITLabs · Kumasi, Ghana</p>
      </div>

      <div className="flex flex-col items-center justify-center px-5 py-12 relative">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="absolute top-5 left-5 lg:hidden inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink transition-colors"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div className="w-full max-w-md bg-white rounded-[14px] border border-rule p-8 shadow-soft">
          <div className="flex justify-center mb-4 lg:hidden">
            <BrandLogo markClassName="h-12 w-12" />
          </div>
          <h1 className="display text-3xl text-center text-navy mb-1">Welcome to ResearchPadi</h1>
          <p className="text-sm text-center text-muted mb-8">
            {step === 1 ? "Sign in or create an account with your Ghanaian phone number. We'll text you a one-time code." : `Enter the 6-digit code sent to ${phone}`}
          </p>

          {error && <div role="alert" className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-xl">{error}</div>}
          {notice && !error && <div role="status" className="p-3 mb-4 text-sm text-[var(--success-ink)] bg-green-50 rounded-xl">{notice}</div>}

          {step === 1 ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label htmlFor="phone" className="block mb-2 text-sm font-medium text-ink">Phone number</label>
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  className="w-full p-3 border rounded-[10px] focus:ring-0"
                  placeholder="e.g. 0244123456"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              <label className="flex items-start gap-2.5 text-sm text-ink cursor-pointer">
                <input type="checkbox" checked={keepSignedIn} onChange={(e) => setKeep(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--brand)]" />
                <span>
                  Keep me signed in
                  <span className="block text-xs text-muted">Stays signed in for up to 7 days. Untick on a shared computer: you'll be signed out after 30 minutes idle.</span>
                </span>
              </label>
              <button disabled={loading} className="btn-primary w-full p-3.5 text-sm disabled:opacity-50">
                {loading ? 'Sending...' : 'Send OTP'}
              </button>
              <p className="text-xs text-muted text-center leading-relaxed">
                By continuing you agree to our{' '}
                <Link to="/terms" className="text-brand font-semibold hover:underline">Terms of Service</Link> and{' '}
                <Link to="/privacy" className="text-brand font-semibold hover:underline">Privacy Policy</Link>.
              </p>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label htmlFor="otp" className="block mb-2 text-sm font-medium text-ink">One-time code</label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  autoFocus
                  className="w-full p-3 border rounded-[10px] text-center tracking-[0.35em] text-xl"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  required
                  maxLength={6}
                />
              </div>
              <button disabled={loading} className="btn-primary w-full p-3.5 text-sm disabled:opacity-50">
                {loading ? 'Verifying...' : 'Verify & continue'}
              </button>
              <div className="text-center text-sm" aria-live="polite">
                <span className="text-muted">Didn't get a code? </span>
                {resendTimer > 0 ? (
                  <span className="text-muted">Request a new one in {resendTimer}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loading}
                    className="font-semibold text-brand hover:underline disabled:opacity-50"
                  >
                    Request new code
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setStep(1); setOtp(''); setError(''); setNotice(''); }}
                className="w-full text-sm text-navy font-medium hover:underline"
              >
                Change phone number
              </button>
            </form>
          )}

          {demoAvailable && (
          <div className="mt-8 pt-6 border-t border-rule">
            <p className="text-center text-xs text-muted mb-3">Want to explore first?</p>
            <button
              type="button"
              onClick={handleTryDemo}
              disabled={loading}
              className="w-full p-3.5 bg-brand-soft text-brand rounded-[10px] font-semibold text-sm hover:bg-[#dbe5ff] active:scale-[0.97] disabled:opacity-50 transition inline-flex items-center justify-center gap-2"
            >
              {loading ? 'Loading demo...' : '✦ Try demo — no phone needed'}
            </button>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
