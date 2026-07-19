import { useState, useEffect } from 'react';
import { paymentService } from '../services/paymentService';
import Navbar from '../components/layout/Navbar';

export default function Wallet() {
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [amount, setAmount] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [message, setMessage] = useState('');
  const fetchData = async () => {
    try {
      const [walletRes, historyRes] = await Promise.all([
        paymentService.getWallet(),
        paymentService.getHistory()
      ]);
      setBalance(walletRes.data.balance);
      setHistory(historyRes.data);
    } catch {
      console.error('Failed to fetch wallet data');
    }
  };

  useEffect(() => {
    fetchData();
    // Check URL for Paystack callback
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('reference');
    if (ref) handleVerify(ref);
  }, []);

  const handleVerify = async (reference: string) => {
    setVerifyLoading(true);
    setMessage('');
    try {
      const res = await paymentService.verify(reference);
      if (res.data.status === 'success') {
        setMessage(`Payment of GHS ${res.data.amount.toFixed(2)} confirmed! New balance: GHS ${res.data.balance.toFixed(2)}`);
        setBalance(res.data.balance);
        fetchData(); // refresh history
      }
    } catch (err: any) {
      setMessage(err.response?.data?.error || 'Payment verification failed');
    } finally {
      setVerifyLoading(false);
      // Clean URL
      window.history.replaceState({}, '', '/wallet');
    }
  };

  const handleTopUp = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return alert('Enter a valid amount');
    if (!email) return alert('Enter your email address');
    setLoading(true);
    setMessage('');
    try {
      const response = await paymentService.initiate(Number(amount), email);
      if (response.data.authorizationUrl) {
        window.location.href = response.data.authorizationUrl;
      } else {
        setMessage('Payment initiated. Follow the instructions on the payment page.');
      }
    } catch (err: any) {
      setMessage(err.response?.data?.error || 'Failed to initiate payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Your Wallet</h1>

          {/* Balance Card */}
          <div className="bg-white p-8 rounded-xl shadow-lg mb-8 border border-gray-100">
            <p className="text-lg text-gray-600 mb-2">Current Balance</p>
            <p className="text-5xl font-extrabold text-green-600">GHS {balance.toFixed(2)}</p>
          </div>

          {/* Messages */}
          {message && (
            <div className={`p-4 mb-6 rounded-lg text-sm ${message.includes('confirmed') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {message}
            </div>
          )}

          {verifyLoading && (
            <div className="p-4 mb-6 rounded-lg text-sm bg-gray-100 text-gray-700 animate-pulse">
              Verifying payment...
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Top Up */}
            <div className="bg-white p-6 rounded-xl shadow border border-gray-100">
              <h2 className="text-xl font-bold mb-4">Top Up Wallet</h2>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email (for Paystack receipt)</label>
              <input
                type="email"
                className="w-full p-3 border rounded-lg mb-4 focus:ring-2 focus:ring-gray-500 outline-none"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount (GHS)</label>
              <input
                type="number"
                className="w-full p-3 border rounded-lg mb-4 focus:ring-2 focus:ring-gray-500 outline-none"
                placeholder="e.g. 50"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <button
                disabled={loading}
                onClick={handleTopUp}
                className="w-full p-3 bg-gray-800 text-white rounded-lg font-bold hover:bg-gray-900 disabled:bg-gray-400 transition"
              >
                {loading ? 'Redirecting to Paystack...' : 'Top Up with Paystack'}
              </button>
              <p className="text-xs text-gray-400 mt-3 text-center">
                Secure payment via Paystack — supports card, bank transfer, and mobile money
              </p>
            </div>

            {/* Transaction History */}
            <div className="bg-white p-6 rounded-xl shadow border border-gray-100">
              <h2 className="text-xl font-bold mb-4">Transaction History</h2>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {history.length === 0 ? (
                  <p className="text-gray-500 italic text-center py-8">No transactions yet.</p>
                ) : history.map(tx => (
                  <div key={tx.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="text-sm font-bold">{new Date(tx.created_at).toLocaleDateString()}</div>
                      <div className="text-[10px] text-gray-500">{tx.product || tx.reference}</div>
                    </div>
                    <div className="text-right">
                      <div className={tx.type === 'credit' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
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
        </div>
      </div>
    </div>
  );
}
