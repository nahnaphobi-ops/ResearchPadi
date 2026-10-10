import { useState, useEffect } from 'react';
import { apiErrorMessage } from '../utils/apiError';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { subscriptionService } from '../services/subscriptionService';
import { paymentService } from '../services/paymentService';
import AppShell from '../components/layout/AppShell';
import { CheckCircle, WalletCards } from 'lucide-react';
import { WORKSPACE_PLANS } from '../data/plans';

const PLANS = {
  standard: { ...WORKSPACE_PLANS.standard, featured: false },
  premium: { ...WORKSPACE_PLANS.premium, featured: true },
};

export default function Subscribe() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedPlan = searchParams.get('plan');
  const [selectedPlan, setSelectedPlan] = useState<keyof typeof PLANS | null>(
    requestedPlan === 'standard' || requestedPlan === 'premium' ? requestedPlan : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeSub, setActiveSub] = useState<{ plan: string; expires_at: string } | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [fetching, setFetching] = useState(true);
  const PLANS_TYPED = PLANS as Record<string, typeof PLANS[keyof typeof PLANS]>;
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [subRes, walletRes] = await Promise.all([
          subscriptionService.getActive(),
          paymentService.getWallet(),
        ]);
        setActiveSub(subRes.data.subscription);
        setWalletBalance(walletRes.data.balance || 0);
      } catch {
        // ignore
      } finally {
        setFetching(false);
      }
    };
    fetchData();
  }, []);

  const handleSubscribe = async (plan: string) => {
    setLoading(true);
    setError('');
    try {
      await subscriptionService.subscribe(plan);
      navigate('/workspace');
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to subscribe'));
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <AppShell>
        <p className="text-center text-muted">Loading plans...</p>
      </AppShell>
    );
  }

  if (activeSub) {
    return (
      <AppShell>
        <div className="flex justify-center">
          <div className="bg-white rounded-[14px] border border-rule shadow-soft p-8 max-w-md w-full text-center">
            <p className="eyebrow mb-3">Workspace</p>
            <h2 className="text-2xl font-bold mb-2 text-navy">Already subscribed</h2>
            <p className="text-muted mb-4">
              You have an active <strong>{PLANS_TYPED[activeSub.plan]?.name || activeSub.plan}</strong> subscription.
            </p>
            <p className="text-sm text-muted mb-6">
              Expires: {new Date(activeSub.expires_at).toLocaleDateString()}
            </p>
            <button
              onClick={() => navigate('/workspace')}
              className="btn-primary w-full p-3 text-sm"
            >
              Go to Workspace
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full mt-2 p-3 text-muted hover:text-navy font-medium transition"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <p className="eyebrow mb-2 text-center">Pricing</p>
      <h1 className="text-3xl font-bold text-center mb-2 text-navy">Choose your plan</h1>
      <p className="text-center text-muted mb-6">
        Get AI-powered writing assistance for your research papers
      </p>

      <div className="mx-auto mb-8 max-w-md flex items-center justify-between gap-3 rounded-[14px] border border-rule bg-white px-5 py-3">
        <span className="text-sm text-muted inline-flex items-center gap-2">
          <WalletCards size={16} className="text-brand" /> Wallet balance
        </span>
        <span className="text-sm font-bold text-navy">GHS {walletBalance.toFixed(2)}</span>
      </div>

      {error && (
        <div className="p-3 mb-6 text-red-700 bg-red-100 rounded-[10px] text-center">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(PLANS).map(([key, plan]) => {
          const isSelected = selectedPlan === key;
          const canAfford = walletBalance >= plan.price;

          return (
            <button
              type="button"
              key={key}
              aria-pressed={isSelected}
              className={`text-left bg-white rounded-[14px] border-2 p-6 sm:p-8 transition ${
                isSelected ? 'border-brand ring-4 ring-brand-soft' : 'border-rule hover:border-brand/40'
              } ${plan.featured ? 'shadow-card' : 'shadow-soft'}`}
              onClick={() => setSelectedPlan(key as keyof typeof PLANS)}
            >
              {plan.featured && (
                <span className="inline-block mb-3 px-3 py-1 bg-navy text-white rounded-full text-xs font-bold tracking-wide">
                  BEST VALUE
                </span>
              )}
              <h2 className="text-2xl font-bold mb-1 text-navy">{plan.name}</h2>
              <p className="text-sm text-muted mb-3">{plan.desc}</p>
              <div className="text-3xl font-bold mb-4 text-ink">
                GHS {plan.price}
                <span className="text-sm font-normal text-muted"> / 30 days</span>
              </div>
              <ul className="space-y-3 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-ink">
                    <CheckCircle size={15} className="text-brand mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {!canAfford && (
                <p className="text-xs text-red-700">
                  Your wallet needs GHS {(plan.price - walletBalance).toFixed(2)} more for this plan.
                </p>
              )}
            </button>
          );
        })}
      </div>

      {selectedPlan ? (
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          {walletBalance >= PLANS[selectedPlan].price ? (
            <button
              onClick={() => handleSubscribe(selectedPlan)}
              disabled={loading}
              className="btn-primary w-full sm:w-auto px-8 py-4 text-base disabled:opacity-50"
            >
              {loading ? 'Processing...' : `Get ${PLANS[selectedPlan].name} · GHS ${PLANS[selectedPlan].price} for 30 days`}
            </button>
          ) : (
            <button
              onClick={() => navigate('/wallet')}
              className="btn-primary w-full sm:w-auto px-8 py-4 text-base inline-flex items-center justify-center gap-2"
            >
              <WalletCards size={18} /> Top up wallet to subscribe
            </button>
          )}
          <p className="text-xs text-muted">Paid once from your wallet for 30 days of access. No automatic renewal.</p>
        </div>
      ) : (
        <p className="mt-8 text-center text-sm text-muted">Select a plan to continue.</p>
      )}
    </AppShell>
  );
}
