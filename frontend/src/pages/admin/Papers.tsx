import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminService } from '../../services/adminService';

export default function AdminPapers() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const fetchData = () => {
    setLoading(true);
    adminService.getPapers({ status: status || undefined, page, limit: 20 })
      .then(setData).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [page, status]);

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold mb-6">Papers</h1>
      <div className="flex gap-3 mb-6">
        <select
          className="p-2 border rounded"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">All Statuses</option>
          <option value="processing">Processing</option>
          <option value="researching">Researching</option>
          <option value="drafting">Drafting</option>
          <option value="supervising">Supervising</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
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
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Title</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Words</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Created</th>
                </tr>
              </thead>
              <tbody>
                {(data?.papers || []).map((paper: any) => (
                  <tr key={paper.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">{paper.user_id?.slice(0, 8)}...</td>
                    <td className="px-4 py-3 font-medium">{paper.title || 'Untitled'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        paper.status === 'completed' ? 'bg-green-100 text-green-700' :
                        paper.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {paper.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{paper.actual_word_count || 0} / {paper.target_word_count || 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(paper.created_at).toLocaleDateString()}</td>
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
