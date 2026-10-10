import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminService } from '../../services/adminService';
import type { AdminUser, Paged } from '../../types/admin';

interface UsersResponse extends Paged {
  users: AdminUser[];
}

export default function AdminUsers() {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [committedSearch, setCommittedSearch] = useState('');
  const [institutionType, setInstitutionType] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let ignore = false;
    adminService.getUsers({ search: committedSearch || undefined, institution_type: institutionType || undefined, page, limit: 20 })
      .then((d) => { if (!ignore) setData(d); })
      .catch(() => {})
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [page, institutionType, committedSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setCommittedSearch(search);
  };

  return (
    <AdminLayout>
      <p className="eyebrow mb-2">Admin</p>
      <h1 className="text-2xl font-bold mb-6 text-navy">Users</h1>
      <form onSubmit={handleSearch} className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          aria-label="Search users"
          placeholder="Search by name, phone, institution..."
          className="flex-1 min-w-0 p-2.5 border rounded-[10px]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="p-2.5 border rounded-[10px]"
          value={institutionType}
          onChange={(e) => setInstitutionType(e.target.value)}
        >
          <option value="">All Institutions</option>
          <option value="university">University</option>
          <option value="nmtc">NMTC</option>
          <option value="technical_university">Technical University</option>
          <option value="college_of_education">College of Education</option>
        </select>
        <button type="submit" className="btn-primary px-4 py-2.5 text-sm">Search</button>
      </form>

      {loading ? (
        <div className="p-10 text-center text-gray-500">Loading...</div>
      ) : (
        <>
          <div className="bg-white rounded-[14px] border border-rule shadow-soft overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Phone</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Institution</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Programme</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Joined</th>
                </tr>
              </thead>
              <tbody>
                {(data?.users || []).map((user) => (
                  <tr key={user.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">{user.full_name || '-'}</td>
                    <td className="px-4 py-3">{user.phone}</td>
                    <td className="px-4 py-3">{user.institution_name || '-'}</td>
                    <td className="px-4 py-3">{user.programme || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(user.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-gray-500">Page {data?.page || 1} of {data?.totalPages || 1}</div>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="btn-ghost px-3 py-1.5 text-sm disabled:opacity-50"
              >Previous</button>
              <button
                disabled={page >= (data?.totalPages || 1)}
                onClick={() => setPage(p => p + 1)}
                className="btn-ghost px-3 py-1.5 text-sm disabled:opacity-50"
              >Next</button>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
