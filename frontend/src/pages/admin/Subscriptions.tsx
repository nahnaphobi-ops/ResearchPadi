import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminService } from '../../services/adminService';

export default function AdminSubscriptions() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminService.getSubscriptions().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold mb-6">Subscriptions</h1>

      {loading ? (
        <div className="p-10 text-center text-gray-500">Loading...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">User</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Plan</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Started</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Expires</th>
              </tr>
            </thead>
            <tbody>
              {(data?.subscriptions || []).map((sub: any) => (
                <tr key={sub.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">{sub.users?.full_name || sub.user_id?.slice(0, 8) + '...'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${sub.plan === 'premium' ? 'bg-gray-100 text-gray-700' : 'bg-gray-100 text-gray-700'}`}>
                      {sub.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      sub.status === 'active' ? 'bg-green-100 text-green-700' :
                      sub.status === 'expired' ? 'bg-gray-100 text-gray-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {sub.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(sub.started_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
