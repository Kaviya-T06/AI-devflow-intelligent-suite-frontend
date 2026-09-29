/**
 * Admin Users Page — view, search, filter, and manage all platform users.
 */
import { useEffect, useState, useMemo } from "react";
import { fetchAllUsers, updateUserRole, updateUserStatus } from "../../services/adminService";
import type { Profile, UserRole } from "../../types";

const ROLES: UserRole[] = ["ADMIN", "MANAGER", "DEVELOPER", "TEAM_MEMBER"];
const STATUSES = ["All", "Active", "Inactive"];

const RoleBadge = ({ role }: { role: string }) => {
  const cls =
    role === "ADMIN" ? "badge-admin" :
    role === "MANAGER" ? "badge-manager" :
    role === "DEVELOPER" ? "badge-developer" :
    "badge";
  return <span className={cls}>{role}</span>;
};

const StatusBadge = ({ active }: { active: boolean }) => (
  <span className={`badge ${active ? "bg-success-500/15 text-success-300 border-success-500/20" : "bg-surface-700/40 text-surface-400 border-surface-600/30"}`}>
    {active ? "Active" : "Inactive"}
  </span>
);

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [updating, setUpdating] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAllUsers();
      setUsers(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        !search ||
        u.full_name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());
      const matchRole = roleFilter === "All" || u.role === roleFilter;
      const matchStatus =
        statusFilter === "All" ||
        (statusFilter === "Active" && u.is_active) ||
        (statusFilter === "Inactive" && !u.is_active);
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const handleRoleChange = async (userId: string, role: string) => {
    setUpdating(userId + "-role");
    try {
      await updateUserRole(userId, role);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: role as UserRole } : u));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to update role");
    } finally {
      setUpdating(null);
    }
  };

  const handleStatusToggle = async (user: Profile) => {
    setUpdating(user.id + "-status");
    try {
      await updateUserStatus(user.id, !user.is_active);
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_active: !u.is_active } : u));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-surface-50">Users</h2>
          <p className="text-surface-400 text-sm mt-1">{users.length} total users on the platform</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge-admin">Admin Panel</span>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input flex-1"
          id="users-search"
        />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="input sm:w-44" id="users-role-filter">
          <option value="All">All Roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input sm:w-40" id="users-status-filter">
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="glass-card p-4 border-danger-500/30 bg-danger-500/10">
          <p className="text-danger-300 text-sm">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-surface-400">
            <p className="text-lg font-medium">No users found</p>
            <p className="text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-700/50">
                  <th className="text-left text-xs font-semibold text-surface-400 uppercase tracking-wider px-6 py-4">Name</th>
                  <th className="text-left text-xs font-semibold text-surface-400 uppercase tracking-wider px-6 py-4">Email</th>
                  <th className="text-left text-xs font-semibold text-surface-400 uppercase tracking-wider px-6 py-4">Role</th>
                  <th className="text-left text-xs font-semibold text-surface-400 uppercase tracking-wider px-6 py-4">Status</th>
                  <th className="text-left text-xs font-semibold text-surface-400 uppercase tracking-wider px-6 py-4">Created</th>
                  <th className="text-left text-xs font-semibold text-surface-400 uppercase tracking-wider px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/30">
                {filtered.map((user) => (
                  <tr key={user.id} className="hover:bg-surface-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-600 to-accent-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                          {user.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                        </div>
                        <span className="text-surface-200 font-medium text-sm">{user.full_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-surface-400 text-sm">{user.email}</td>
                    <td className="px-6 py-4">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        disabled={updating === user.id + "-role"}
                        className="input py-1 text-xs w-36"
                        id={`role-${user.id}`}
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="px-6 py-4"><StatusBadge active={user.is_active} /></td>
                    <td className="px-6 py-4 text-surface-500 text-xs">
                      {new Date(user.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleStatusToggle(user)}
                        disabled={updating === user.id + "-status"}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium ${
                          user.is_active
                            ? "border-warning-500/30 text-warning-400 hover:bg-warning-500/10"
                            : "border-success-500/30 text-success-400 hover:bg-success-500/10"
                        }`}
                        id={`toggle-status-${user.id}`}
                      >
                        {updating === user.id + "-status" ? "..." : user.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer count */}
      {!loading && (
        <p className="text-surface-600 text-xs text-right">
          Showing {filtered.length} of {users.length} users
        </p>
      )}
    </div>
  );
}
