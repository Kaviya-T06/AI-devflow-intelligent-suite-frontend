/**
 * Admin Users Page — full user management.
 * Add / Edit / Activate-Deactivate / Delete users.
 * Reads current user from AuthContext to prevent self-deletion.
 */
import { useEffect, useState, useMemo } from "react";
import {
  fetchAllUsers,
  createUser,
  updateUser,
  updateUserStatus,
  deleteUser,
  type UserRecord,
} from "../../services/adminService";
import { useAuth } from "../../context/AuthContext";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DB_ROLES = ["admin", "developer", "project_manager"] as const;
type DbRole = typeof DB_ROLES[number];

const ROLE_LABEL: Record<DbRole, string> = {
  admin:           "Admin",
  developer:       "Developer",
  project_manager: "Project Manager",
};

const ROLE_BADGE: Record<DbRole, string> = {
  admin:           "badge-admin",
  developer:       "badge-developer",
  project_manager: "badge-manager",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const RoleBadge = ({ role }: { role: string }) => {
  const cls = ROLE_BADGE[role as DbRole] ?? "badge";
  return <span className={cls}>{ROLE_LABEL[role as DbRole] ?? role}</span>;
};

const StatusBadge = ({ active }: { active: boolean }) => (
  <span
    className={`badge ${
      active
        ? "bg-success-500/15 text-success-300 border-success-500/20"
        : "bg-surface-700/40 text-surface-400 border-surface-600/30"
    }`}
  >
    {active ? "Active" : "Inactive"}
  </span>
);

// ---------------------------------------------------------------------------
// Add / Edit Modal
// ---------------------------------------------------------------------------

interface UserFormData {
  name:      string;
  email:     string;
  password:  string;
  role:      DbRole;
  is_active: boolean;
}

interface ModalProps {
  mode:    "add" | "edit";
  initial?: UserRecord;
  onSave:  (data: UserFormData) => Promise<void>;
  onClose: () => void;
}

function UserModal({ mode, initial, onSave, onClose }: ModalProps) {
  const [form, setForm] = useState<UserFormData>({
    name:      initial?.name      ?? "",
    email:     initial?.email     ?? "",
    password:  "",
    role:      (initial?.role as DbRole) ?? "developer",
    is_active: initial?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!form.name.trim())  e.name  = "Name is required";
    if (!form.email.trim()) e.email = "Email is required";
    if (mode === "add" && form.password.length < 6)
      e.password = "Password must be at least 6 characters";
    return e;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err: unknown) {
      setErrors({ _global: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="glass-card w-full max-w-md p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-surface-50">
            {mode === "add" ? "Add User" : "Edit User"}
          </h3>
          <button onClick={onClose} className="btn-ghost p-1" id="user-modal-close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {errors._global && (
          <div className="glass-card p-3 border-danger-500/30 bg-danger-500/10">
            <p className="text-danger-300 text-sm">{errors._global}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="input-label">Full Name *</label>
            <input
              id="user-name" className="input w-full" placeholder="Jane Smith"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            {errors.name && <p className="text-danger-400 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="input-label">Email *</label>
            <input
              id="user-email" type="email" className="input w-full"
              placeholder="jane@example.com"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            {errors.email && <p className="text-danger-400 text-xs mt-1">{errors.email}</p>}
          </div>

          {/* Password — only required for Add; shown but optional for Edit */}
          <div>
            <label className="input-label">
              Password {mode === "add" ? "*" : <span className="text-surface-500">(leave blank to keep unchanged)</span>}
            </label>
            <input
              id="user-password" type="password" className="input w-full"
              placeholder={mode === "add" ? "Min 6 characters" : "Leave blank to keep unchanged"}
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            {errors.password && <p className="text-danger-400 text-xs mt-1">{errors.password}</p>}
          </div>

          {/* Role */}
          <div>
            <label className="input-label">Role</label>
            <select
              id="user-role" className="input w-full"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as DbRole })}
            >
              {DB_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox" id="user-active"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="w-4 h-4 accent-primary-500"
            />
            <label htmlFor="user-active" className="text-surface-300 text-sm">
              Active account
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit" disabled={saving}
              className="btn-primary flex-1" id="user-save-btn"
            >
              {saving ? "Saving…" : mode === "add" ? "Create User" : "Save Changes"}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary" id="user-cancel-btn">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirm Delete Modal
// ---------------------------------------------------------------------------

function ConfirmDeleteModal({
  userName,
  onConfirm,
  onClose,
}: {
  userName: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="glass-card w-full max-w-sm p-6 space-y-4 text-center">
        <div className="w-12 h-12 rounded-full bg-danger-500/15 flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-danger-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <div>
          <h3 className="text-surface-50 font-bold text-lg">Delete User</h3>
          <p className="text-surface-400 text-sm mt-1">
            Delete <span className="text-surface-200 font-medium">{userName}</span>? This cannot be undone.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={onConfirm} className="btn-danger flex-1" id="user-confirm-delete">Delete</button>
          <button onClick={onClose}   className="btn-secondary flex-1" id="user-cancel-delete">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();

  const [users, setUsers]       = useState<UserRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState("");
  const [roleFilter, setRoleFilter]     = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [toast, setToast]       = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Modal state
  const [modal, setModal]       = useState<"add" | "edit" | null>(null);
  const [editing, setEditing]   = useState<UserRecord | null>(null);
  const [deleting, setDeleting] = useState<UserRecord | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------------

  const load = () => {
    setLoading(true);
    setError(null);
    fetchAllUsers()
      .then(setUsers)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load users"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const filtered = useMemo(() =>
    users.filter((u) => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q);
      const matchRole   = roleFilter   === "all" || u.role === roleFilter;
      const matchStatus = statusFilter === "all" ||
        (statusFilter === "active"   && u.is_active) ||
        (statusFilter === "inactive" && !u.is_active);
      return matchSearch && matchRole && matchStatus;
    }),
  [users, search, roleFilter, statusFilter]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSave = async (data: UserFormData) => {
    if (modal === "add") {
      const created = await createUser({
        name:      data.name,
        email:     data.email,
        password:  data.password,
        role:      data.role,
        is_active: data.is_active,
      });
      setUsers((prev) => [created, ...prev]);
      showToast("User created successfully");
    } else if (editing) {
      const updates: Parameters<typeof updateUser>[1] = {
        name:      data.name,
        email:     data.email,
        role:      data.role,
        is_active: data.is_active,
      };
      const updated = await updateUser(editing.id, updates);
      setUsers((prev) => prev.map((u) => u.id === editing.id ? updated : u));
      showToast("User updated successfully");
    }
    setModal(null);
    setEditing(null);
  };

  const handleStatusToggle = async (user: UserRecord) => {
    if (currentUser?.id === user.id) {
      showToast("You cannot change your own account status.", "error");
      return;
    }
    setToggling(user.id);
    try {
      await updateUserStatus(user.id, !user.is_active);
      setUsers((prev) =>
        prev.map((u) => u.id === user.id ? { ...u, is_active: !u.is_active } : u),
      );
      showToast(`User ${!user.is_active ? "activated" : "deactivated"} successfully`);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed to update status", "error");
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteUser(deleting.id);
      setUsers((prev) => prev.filter((u) => u.id !== deleting.id));
      showToast("User deleted successfully");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed to delete user", "error");
    } finally {
      setDeleting(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 glass-card px-5 py-3 text-sm animate-slide-in ${
            toast.type === "error"
              ? "bg-danger-500/20 border-danger-500/30 text-danger-300"
              : "bg-success-500/20 border-success-500/30 text-success-300"
          }`}
        >
          {toast.type === "success" ? "✓ " : "✕ "}{toast.msg}
        </div>
      )}

      {/* Modals */}
      {modal && (
        <UserModal
          mode={modal}
          initial={editing ?? undefined}
          onSave={handleSave}
          onClose={() => { setModal(null); setEditing(null); }}
        />
      )}
      {deleting && (
        <ConfirmDeleteModal
          userName={deleting.name}
          onConfirm={handleDelete}
          onClose={() => setDeleting(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-surface-50">Users</h2>
          <p className="text-surface-400 text-sm mt-1">
            {users.filter((u) => u.is_active).length} active · {users.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge-admin">Admin Panel</span>
          <button
            onClick={() => { setEditing(null); setModal("add"); }}
            className="btn-primary text-sm py-2 px-4"
            id="add-user-btn"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add User
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input flex-1"
          id="users-search"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="input sm:w-48"
          id="users-role-filter"
        >
          <option value="all">All Roles</option>
          {DB_ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input sm:w-40"
          id="users-status-filter"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
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
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-lg font-medium">No users found</p>
            <p className="text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-700/50">
                  {["Name", "Email", "Role", "Status", "Created", "Actions"].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-surface-400 uppercase tracking-wider px-6 py-4">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/30">
                {filtered.map((user) => {
                  const isSelf = currentUser?.id === user.id;
                  return (
                    <tr key={user.id} className="hover:bg-surface-800/40 transition-colors group">
                      {/* Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-600 to-accent-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                            {user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                          </div>
                          <div>
                            <p className="text-surface-200 font-medium text-sm">{user.name}</p>
                            {isSelf && <p className="text-xs text-primary-400">(you)</p>}
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-6 py-4 text-surface-400 text-sm">{user.email}</td>

                      {/* Role */}
                      <td className="px-6 py-4">
                        <RoleBadge role={user.role} />
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <StatusBadge active={user.is_active} />
                      </td>

                      {/* Created */}
                      <td className="px-6 py-4 text-surface-500 text-xs">
                        {user.created_at
                          ? new Date(user.created_at).toLocaleDateString("en-US", {
                              month: "short", day: "numeric", year: "numeric",
                            })
                          : "—"}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Edit */}
                          <button
                            onClick={() => { setEditing(user); setModal("edit"); }}
                            className="text-xs px-2.5 py-1 rounded-lg border border-primary-500/30 text-primary-400 hover:bg-primary-500/10 transition-colors"
                            id={`edit-user-${user.id}`}
                          >
                            Edit
                          </button>

                          {/* Activate / Deactivate */}
                          <button
                            onClick={() => handleStatusToggle(user)}
                            disabled={toggling === user.id || isSelf}
                            title={isSelf ? "You cannot change your own status" : undefined}
                            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                              user.is_active
                                ? "border-warning-500/30 text-warning-400 hover:bg-warning-500/10"
                                : "border-success-500/30 text-success-400 hover:bg-success-500/10"
                            }`}
                            id={`toggle-user-${user.id}`}
                          >
                            {toggling === user.id ? "…" : user.is_active ? "Deactivate" : "Activate"}
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setDeleting(user)}
                            disabled={isSelf}
                            title={isSelf ? "You cannot delete your own account" : undefined}
                            className="text-xs px-2.5 py-1 rounded-lg border border-danger-500/30 text-danger-400 hover:bg-danger-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            id={`delete-user-${user.id}`}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
