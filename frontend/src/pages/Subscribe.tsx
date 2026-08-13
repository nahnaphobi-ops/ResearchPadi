import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscriptionService } from '../services/subscriptionService';
import { paymentService } from '../services/paymentService';
import AppShell from '../components/layout/AppShell';

const PLANS = {
  standard: {
    name: 'Standard',
    price: 120,
    featured: false,
    features: [
      'Up to 5 workspace sessions',
      'AI writing assistance (continue, expand, shorten, rewrite)',
      'Citation search (OpenAlex + Semantic Scholar)',
      'GPT-4o powered',
    ],
  },
  premium: {
    name: 'Premium',
    price: 200,
    featured: true,
    features: [
      'Unlimited workspace sessions',
      'Advanced AI (tone, grammar, outline, abstract)',
      'Claude Sonnet powered',
      'Full RAG citations (Ghanaian repositories)',
      'Export to DOCX',
      'Priority support',
    ],
  },
};

export default function Subscribe() {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<keyof typeof PLANS | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeSub, setActiveSub] = useState<any>(null);
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
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to subscribe');
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
      <p className="text-center text-muted mb-8">
        Get AI-powered writing assistance for your research papers
      </p>

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
              className={`text-left bg-white rounded-[14px] border-2 p-8 transition ${
                isSelected ? 'border-navy ring-2 ring-navy-soft' : 'border-rule hover:border-navy/40'
              } ${plan.featured ? 'shadow-card' : 'shadow-soft'}`}
              onClick={() => setSelectedPlan(key as keyof typeof PLANS)}
            >
              {plan.featured && (
                <span className="inline-block mb-3 px-3 py-1 bg-navy text-white rounded-full text-xs font-bold">
                  BEST VALUE
                </span>
              )}
              <h2 className="text-2xl font-bold mb-1 text-navy">{plan.name}</h2>
              <div className="text-3xl font-bold mb-4 text-ink">
                GHS {plan.price}
                <span className="text-sm font-normal text-muted">/month</span>
              </div>
              <ul className="space-y-3 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-ink">
                    <span className="text-accent-green mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="text-xs text-muted mb-4">
                Wallet balance: GHS {walletBalance.toFixed(2)}
              </div>
              {!canAfford && (
                <p className="text-xs text-red-500 mb-2">
                  Insufficient balance. You need GHS {plan.price}.
                </p>
              )}
            </button>
          );
        })}
      </div>

      {selectedPlan && (
        <div className="mt-8 text-center">
          <button
            onClick={() => handleSubscribe(selectedPlan)}
            disabled={loading || walletBalance < PLANS[selectedPlan!].price}
            className="btn-primary px-8 py-4 text-lg disabled:opacity-50"
          >
            {loading ? 'Processing...' : `Subscribe to ${PLANS[selectedPlan!].name} - GHS ${PLANS[selectedPlan!].price}/mo`}
          </button>
        </div>
      )}
    </AppShell>
  );
}
