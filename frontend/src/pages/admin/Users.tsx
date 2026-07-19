import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminService } from '../../services/adminService';

export default function AdminUsers() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [institutionType, setInstitutionType] = useState('');
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  const fetchData = () => {
    setLoading(true);
    adminService.getUsers({ search: search || undefined, institution_type: institutionType || undefined, page, limit: 20 })
      .then(setData).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [page, institutionType]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchData();
  };

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold mb-6">Users</h1>
      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by name, phone, institution..."
          className="flex-1 p-2 border rounded"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="p-2 border rounded"
          value={institutionType}
          onChange={(e) => setInstitutionType(e.target.value)}
        >
          <option value="">All Institutions</option>
          <option value="university">University</option>
          <option value="nmtc">NMTC</option>
          <option value="technical_university">Technical University</option>
          <option value="college_of_education">College of Education</option>
        </select>
        <button type="submit" className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900">Search</button>
      </form>

      {loading ? (
        <div className="p-10 text-center text-gray-500">Loading...</div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
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
                {(data?.users || []).map((user: any) => (
                  <tr key={user.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/admin/users/${user.id}`)}>
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
                className="px-3 py-1 border rounded disabled:opacity-50"
              >Previous</button>
              <button
                disabled={page >= (data?.totalPages || 1)}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >Next</button>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
