import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminService } from '../../services/adminService';

export default function AdminTransactions() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);

  const fetchData = () => {
    setLoading(true);
    adminService.getTransactions({ status: status || undefined, type: type || undefined, page, limit: 20 })
      .then(setData).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [page, status, type]);

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold mb-6">Transactions</h1>
      <div className="flex gap-3 mb-6">
        <select
          className="p-2 border rounded"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">All Statuses</option>
          <option value="success">Success</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
        <select
          className="p-2 border rounded"
          value={type}
          onChange={(e) => { setType(e.target.value); setPage(1); }}
        >
          <option value="">All Types</option>
          <option value="credit">Credit</option>
          <option value="debit">Debit</option>
        </select>
      </div>

      {loading ? (
        <div className="p-10 text-center text-gray-500">Loading...</div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">User ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Product</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Reference</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {(data?.transactions || []).map((tx: any) => (
                  <tr key={tx.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">{tx.user_id?.slice(0, 8)}...</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${tx.type === 'credit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">GHS {tx.amount_ghs?.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{tx.product || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        tx.status === 'success' ? 'bg-green-100 text-green-700' :
                        tx.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{tx.reference?.slice(0, 12)}...</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(tx.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-gray-500">Page {data?.page || 1} of {data?.totalPages || 1}</div>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded disabled:opacity-50">Previous</button>
              <button disabled={page >= (data?.totalPages || 1)} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
