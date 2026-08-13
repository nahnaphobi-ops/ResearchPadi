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
      <p className="eyebrow mb-2">Admin</p>
      <h1 className="text-2xl font-bold mb-6 text-navy">Dashboard overview</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-[14px] border border-rule shadow-soft">
          <div className="text-sm text-muted mb-1">Total Users</div>
          <div className="text-3xl font-bold text-navy">{data?.totalUsers || 0}</div>
        </div>
        <div className="bg-white p-6 rounded-[14px] border border-rule shadow-soft">
          <div className="text-sm text-muted mb-1">Total Revenue</div>
          <div className="text-3xl font-bold text-green-600">GHS {data?.totalRevenue?.toFixed(2) || '0.00'}</div>
        </div>
        <div className="bg-white p-6 rounded-[14px] border border-rule shadow-soft">
          <div className="text-sm text-muted mb-1">Active Subscriptions</div>
          <div className="text-3xl font-bold text-navy">{data?.activeSubscriptions || 0}</div>
          <div className="text-xs text-muted mt-1">Standard: {data?.activeStandard || 0} | Premium: {data?.activePremium || 0}</div>
        </div>
        <div className="bg-white p-6 rounded-[14px] border border-rule shadow-soft">
          <div className="text-sm text-muted mb-1">Papers</div>
          <div className="text-3xl font-bold text-navy">{data?.totalPapers || 0}</div>
          <div className="text-xs text-muted mt-1">Completed: {data?.completedPapers || 0} | Processing: {data?.processingPapers || 0}</div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-[14px] border border-rule shadow-soft">
          <div className="text-sm text-muted mb-1">Today's Revenue</div>
          <div className="text-2xl font-bold text-green-600">GHS {data?.todayRevenue?.toFixed(2) || '0.00'}</div>
        </div>
        <div className="bg-white p-6 rounded-[14px] border border-rule shadow-soft">
          <div className="text-sm text-muted mb-1">Failed Transactions</div>
          <div className="text-2xl font-bold text-red-600">{data?.failedTransactions || 0}</div>
        </div>
      </div>
    </AdminLayout>
  );
}
