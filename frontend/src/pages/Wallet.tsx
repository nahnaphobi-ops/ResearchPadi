import { useState, useEffect, useCallback, useRef } from 'react';
import { apiErrorMessage } from '../utils/apiError';
import { skipSplashOnReturn } from '../utils/splash';
import { paymentService } from '../services/paymentService';
import AppShell from '../components/layout/AppShell';
import type { Transaction } from '../types';

const QUICK_AMOUNTS = [
  { value: 120, label: 'Standard' },
  { value: 200, label: 'Premium' },
  { value: 250, label: 'Study draft' },
];

const PRODUCT_LABELS: Record<string, string> = {
  wallet_topup: 'Wallet top-up',
  workspace_standard: 'Standard plan (30 days)',
  workspace_premium: 'Premium plan (30 days)',
  workspace_standard_refund: 'Standard plan refund',
  workspace_premium_refund: 'Premium plan refund',
  full_paper: 'Study draft',
  full_paper_refund: 'Study draft refund',
};

// A mobile money payment can be approved on the phone after the student has left the
// Paystack page. Top-ups still pending and newer than this are asked about again.
const RECHECK_WINDOW_MS = 24 * 60 * 60 * 1000;
const RECHECK_LIMIT = 3;

export default function Wallet() {
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [amount, setAmount] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  // True from the first render when returning from Paystack (?reference=…),
  // so the verifying indicator shows without a synchronous setState in an effect.
  const [verifyLoading, setVerifyLoading] = useState(() => {
    try { return new URLSearchParams(window.location.search).has('reference'); }
    catch { return false; }
  });
  // info: neither a success nor an error (a payment that is not confirmed yet).
  const [message, setMessage] = useState<{ text: string; ok: boolean; info?: boolean } | null>(null);
  const rechecked = useRef(false);

  const fetchData = useCallback(async (): Promise<Transaction[] | null> => {
    try {
      const [walletRes, historyRes] = await Promise.all([
        paymentService.getWallet(),
        paymentService.getHistory()
      ]);
      setBalance(walletRes.data.balance);
      setHistory(historyRes.data);
      return historyRes.data;
    } catch {
      console.error('Failed to fetch wallet data');
      return null;
    }
  }, []);

  const handleVerify = useCallback(async (reference: string) => {
    try {
      const res = await paymentService.verify(reference);
      if (res.data.status === 'success') {
        setMessage({ text: `Payment of GHS ${res.data.amount.toFixed(2)} confirmed! New balance: GHS ${res.data.balance.toFixed(2)}`, ok: true });
        setBalance(res.data.balance);
      } else if (res.data.status === 'pending') {
        setMessage({
          text: 'Your payment is not confirmed yet. If you approved it on your phone, your balance will update here within a few minutes.',
          ok: false,
          info: true,
        });
      }
    } catch (err) {
      setMessage({ text: apiErrorMessage(err, 'Payment verification failed'), ok: false });
    } finally {
      setVerifyLoading(false);
      window.history.replaceState({}, '', '/wallet');
      fetchData();
    }
  }, [fetchData]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const ref = new URLSearchParams(window.location.search).get('reference');
      if (ref) return handleVerify(ref);

      const rows = await fetchData();
      if (ignore || !rows || rechecked.current) return;

      const cutoff = Date.now() - RECHECK_WINDOW_MS;
      const waiting = rows
        .filter((tx) => tx.status === 'pending' && tx.product === 'wallet_topup' && tx.reference && new Date(tx.created_at).getTime() > cutoff)
        .slice(0, RECHECK_LIMIT);
      if (!waiting.length) return;
      rechecked.current = true;

      // A check that fails here means not paid, or Paystack could not be reached; the row stays as it is.
      const results = await Promise.allSettled(waiting.map((tx) => paymentService.verify(tx.reference as string)));
      if (ignore) return;
      if (results.some((r) => r.status === 'fulfilled' && r.value.data.status === 'success')) {
        setMessage({ text: 'A payment you made earlier has been confirmed and added to your balance.', ok: true });
      }
      fetchData();
    })();
    return () => { ignore = true; };
  }, [handleVerify, fetchData]);

  const handleTopUp = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return setMessage({ text: 'Enter a valid amount.', ok: false });
    if (!email) return setMessage({ text: 'Enter your email address.', ok: false });
    setLoading(true);
    setMessage(null);
    try {
      const response = await paymentService.initiate(Number(amount), email);
      if (response.data.authorizationUrl) {
        skipSplashOnReturn();
        window.location.href = response.data.authorizationUrl;
      } else {
        setMessage({ text: 'Payment initiated. Follow the instructions on the payment page.', ok: true });
      }
    } catch (err) {
      setMessage({ text: apiErrorMessage(err, 'Failed to initiate payment'), ok: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <p className="eyebrow mb-2">Payments</p>
      <h1 className="text-3xl font-bold mb-6 text-navy">Your wallet</h1>

      <div className="bg-brand text-white p-8 rounded-2xl shadow-card mb-8">
        <p className="text-sm text-white/70 mb-2">Current balance</p>
        <p className="text-5xl font-extrabold">GHS {balance.toFixed(2)}</p>
      </div>

      {message && (
        <div role="status" className={`p-4 mb-6 rounded-[10px] text-sm ${message.info ? 'bg-navy-soft text-navy' : message.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {verifyLoading && (
        <div className="p-4 mb-6 rounded-[10px] text-sm bg-navy-soft text-navy animate-pulse">
          Verifying payment...
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-[14px] border border-rule shadow-soft">
          <h2 className="text-xl font-bold mb-4 text-navy">Top up wallet</h2>
          <label htmlFor="topup-email" className="block text-sm font-medium text-ink mb-2">Email (for your Paystack receipt)</label>
          <input
            id="topup-email"
            type="email"
            autoComplete="email"
            className="w-full p-3 border rounded-[10px] mb-4"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label htmlFor="topup-amount" className="block text-sm font-medium text-ink mb-2">Amount (GHS)</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {QUICK_AMOUNTS.map((q) => (
              <button
                key={q.value}
                type="button"
                onClick={() => setAmount(String(q.value))}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                  amount === String(q.value) ? 'bg-brand text-white border-brand' : 'bg-white text-navy border-rule hover:border-brand/50'
                }`}
              >
                GHS {q.value} <span className="font-normal opacity-75">· {q.label}</span>
              </button>
            ))}
          </div>
          <input
            id="topup-amount"
            type="number"
            inputMode="decimal"
            className="w-full p-3 border rounded-[10px] mb-4"
            placeholder="e.g. 50"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button
            disabled={loading}
            onClick={handleTopUp}
            className="btn-primary w-full p-3 text-sm disabled:opacity-50"
          >
            {loading ? 'Redirecting to Paystack...' : 'Top up with Paystack'}
          </button>
          <p className="text-xs text-muted mt-3 text-center">
            Secure payment via Paystack — supports card, bank transfer, and mobile money
          </p>
        </div>

        <div className="bg-white p-6 rounded-[14px] border border-rule shadow-soft">
          <h2 className="text-xl font-bold mb-4 text-navy">Transaction history</h2>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {history.length === 0 ? (
              <p className="text-muted text-center py-8 text-sm">No transactions yet. Top-ups and payments will show here.</p>
            ) : history.map(tx => (
              <div key={tx.id} className="flex justify-between items-center p-3 bg-navy-mist rounded-[10px]">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-ink">{new Date(tx.created_at).toLocaleDateString()}</div>
                  <div className="text-xs text-muted">{(tx.product && PRODUCT_LABELS[tx.product]) || tx.product || tx.reference}</div>
                  {tx.reference && tx.product && (
                    <div className="text-[10px] text-muted font-mono break-all">Ref: {tx.reference}</div>
                  )}
                </div>
                <div className="text-right shrink-0 pl-3">
                  <div className={`whitespace-nowrap font-bold ${tx.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.type === 'credit' ? '+' : '-'}GHS {tx.amount_ghs.toFixed(2)}
                  </div>
                  <div className={`text-[10px] uppercase font-bold ${tx.status === 'success' ? 'text-green-500' : tx.status === 'pending' ? 'text-orange-500' : 'text-red-500'}`}>
                    {tx.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
