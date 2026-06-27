import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminService } from '../../services/adminService';

export default function AdminOverview() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    adminService.getOverview().then(setData).catch(() => setError('Failed to load overview')).finally(() => setLoading(false));
  }, []);

  if (loading) return <AdminLayout><div className="p-10 text-center text-gray-500">Loading...</div></AdminLayout>;
  if (error) return <AdminLayout><div className="p-10 text-center text-red-500">{error}</div></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold mb-6">Dashboard Overview</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500 mb-1">Total Users</div>
          <div className="text-3xl font-bold">{data?.totalUsers || 0}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500 mb-1">Total Revenue</div>
          <div className="text-3xl font-bold text-green-600">GHS {data?.totalRevenue?.toFixed(2) || '0.00'}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500 mb-1">Active Subscriptions</div>
          <div className="text-3xl font-bold">{data?.activeSubscriptions || 0}</div>
          <div className="text-xs text-gray-400 mt-1">Standard: {data?.activeStandard || 0} | Premium: {data?.activePremium || 0}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500 mb-1">Papers</div>
          <div className="text-3xl font-bold">{data?.totalPapers || 0}</div>
          <div className="text-xs text-gray-400 mt-1">Completed: {data?.completedPapers || 0} | Processing: {data?.processingPapers || 0}</div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500 mb-1">Today's Revenue</div>
          <div className="text-2xl font-bold text-green-600">GHS {data?.todayRevenue?.toFixed(2) || '0.00'}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500 mb-1">Failed Transactions</div>
          <div className="text-2xl font-bold text-red-600">{data?.failedTransactions || 0}</div>
        </div>
      </div>
    </AdminLayout>
  );
}
