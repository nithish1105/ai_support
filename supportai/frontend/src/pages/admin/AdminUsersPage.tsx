import { useEffect, useState } from 'react';
import { Users, Search, CheckCircle, XCircle, ShieldCheck, User, Headphones, RefreshCw } from 'lucide-react';
import { authAPI, agentsAPI } from '../../services/api';
import { User as UserType } from '../../types';
import AdminSidebar from '../../components/admin/AdminSidebar';

function RoleBadge({ role }: { role: string }) {
  const cfg: Record<string, string> = {
    ADMIN: 'bg-[#111111] text-white',
    SUPERVISOR: 'bg-orange-100 text-orange-700',
    AGENT: 'bg-green-100 text-green-700',
    CUSTOMER: 'bg-gray-100 text-gray-600',
  };
  const icons: Record<string, React.ReactNode> = {
    ADMIN: <ShieldCheck size={11} />,
    SUPERVISOR: <ShieldCheck size={11} />,
    AGENT: <Headphones size={11} />,
    CUSTOMER: <User size={11} />,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg[role] ?? 'bg-gray-100 text-gray-600'}`}>
      {icons[role]}
      {role}
    </span>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const fetchUsers = () => {
    setLoading(true);
    setError('');
    authAPI.listUsers()
      .then((res) => {
        setUsers(res.data ?? []);
      })
      .catch(() => setError('Failed to load users.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const roles = ['ADMIN', 'SUPERVISOR', 'AGENT', 'CUSTOMER'];

  return (
    <div className="flex min-h-screen bg-[#F8F8F8]">
      <AdminSidebar />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-black">User Management</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {filtered.length} user{filtered.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={fetchUsers}
              className="btn-secondary text-sm py-2 px-4 flex items-center gap-2"
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>
        </div>

        <div className="px-8 py-6">
          {/* Filters */}
          <div className="card p-4 mb-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field pl-9 py-2 text-sm"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="input-field py-2 text-sm pr-8 appearance-none cursor-pointer min-w-[150px]"
            >
              <option value="">All Roles</option>
              {roles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-24">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="card p-8 text-center">
              <p className="text-orange-600 font-medium">{error}</p>
              <button onClick={fetchUsers} className="btn-primary mt-4 text-sm py-2 px-5">
                Retry
              </button>
            </div>
          )}

          {/* Table */}
          {!loading && !error && (
            <div className="card overflow-hidden">
              {filtered.length === 0 ? (
                <div className="p-12 text-center">
                  <Users size={40} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No users found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3.5">
                          Name
                        </th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3.5">
                          Email
                        </th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3.5">
                          Role
                        </th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3.5">
                          Status
                        </th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3.5">
                          Online
                        </th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3.5">
                          Joined
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filtered.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                {u.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-black">{u.name}</p>
                                {u.phone && <p className="text-xs text-gray-400">{u.phone}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{u.email}</td>
                          <td className="px-6 py-4">
                            <RoleBadge role={u.role} />
                          </td>
                          <td className="px-6 py-4">
                            {u.is_active ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                                <CheckCircle size={13} /> Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400">
                                <XCircle size={13} /> Inactive
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-medium ${
                                u.is_online ? 'text-green-600' : 'text-gray-400'
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  u.is_online ? 'bg-green-500' : 'bg-gray-300'
                                }`}
                              />
                              {u.is_online ? 'Online' : 'Offline'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-gray-400">
                            {new Date(u.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
