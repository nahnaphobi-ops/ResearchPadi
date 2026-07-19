import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscriptionService } from '../services/subscriptionService';
import { paymentService } from '../services/paymentService';
import Navbar from '../components/layout/Navbar';

const PLANS = {
  standard: {
    name: 'Standard',
    price: 120,
    color: 'blue',
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
    color: 'green',
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
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">Loading plans...</p>
        </div>
      </div>
    );
  }

  if (activeSub) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
            <div className="text-4xl mb-4">✅</div>
            <h2 className="text-2xl font-bold mb-2">Already Subscribed</h2>
            <p className="text-gray-600 mb-4">
              You have an active <strong>{PLANS_TYPED[activeSub.plan]?.name || activeSub.plan}</strong> subscription.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Expires: {new Date(activeSub.expires_at).toLocaleDateString()}
            </p>
            <button
              onClick={() => navigate('/workspace')}
              className="w-full p-3 bg-gray-800 text-white rounded-lg font-bold hover:bg-gray-900 transition"
            >
              Go to Workspace
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full mt-2 p-3 text-gray-600 hover:text-gray-800 font-medium transition"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-2">Choose Your Plan</h1>
          <p className="text-center text-gray-600 mb-8">
            Get AI-powered writing assistance for your research papers
          </p>

          {error && (
            <div className="p-3 mb-6 text-red-700 bg-red-100 rounded-lg text-center">{error}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {Object.entries(PLANS).map(([key, plan]) => {
              const isSelected = selectedPlan === key;
              const canAfford = walletBalance >= plan.price;
              const borderColor = plan.color === 'green' ? 'border-gray-200' : 'border-gray-200';
              const activeBorder = plan.color === 'green' ? 'border-gray-500 ring-2 ring-gray-200' : 'border-gray-500 ring-2 ring-gray-200';

              return (
                <div
                  key={key}
                  className={`bg-white rounded-xl shadow-lg border-2 p-8 transition cursor-pointer ${
                    isSelected ? activeBorder : `${borderColor} hover:border-gray-300`
                  }`}
                    onClick={() => setSelectedPlan(key as keyof typeof PLANS)}
                >
                  {plan.color === 'green' && (
                    <span className="inline-block mb-3 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                      BEST VALUE
                    </span>
                  )}
                  <h2 className="text-2xl font-bold mb-1">{plan.name}</h2>
                  <div className="text-3xl font-bold mb-4">
                    GHS {plan.price}
                    <span className="text-sm font-normal text-gray-500">/month</span>
                  </div>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-green-500 mt-0.5">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="text-xs text-gray-500 mb-4">
                    Wallet balance: GHS {walletBalance.toFixed(2)}
                  </div>
                  {!canAfford && (
                    <p className="text-xs text-red-500 mb-4">
                      Insufficient balance. You need GHS {plan.price}.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {selectedPlan && (
            <div className="mt-8 text-center">
              <button
                onClick={() => handleSubscribe(selectedPlan)}
                disabled={loading || walletBalance < PLANS[selectedPlan!].price}
                className="px-8 py-4 bg-gray-800 text-white rounded-lg font-bold text-lg hover:bg-gray-900 disabled:bg-gray-400 transition"
              >
                {loading ? 'Processing...' : `Subscribe to ${PLANS[selectedPlan!].name} - GHS ${PLANS[selectedPlan!].price}/mo`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
