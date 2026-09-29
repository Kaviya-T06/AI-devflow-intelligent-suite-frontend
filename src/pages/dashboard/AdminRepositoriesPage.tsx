/**
 * Admin Repositories Page — view, add, edit, and remove connected repositories.
 */
import { useEffect, useState, useMemo } from "react";
import {
  fetchAllRepositories,
  createRepository,
  updateRepository,
  deleteRepository,
} from "../../services/adminService";
import { MOCK_PROJECTS } from "../../services/mockData";
import type { Repository, RepoProvider } from "../../types";

const PROVIDERS: RepoProvider[] = ["GitHub", "GitLab", "Bitbucket"];

const PROVIDER_COLORS: Record<RepoProvider, string> = {
  GitHub:    "bg-surface-700/60 text-surface-300 border-surface-600/40",
  GitLab:    "bg-orange-500/15 text-orange-300 border-orange-500/20",
  Bitbucket: "bg-primary-500/15 text-primary-300 border-primary-500/20",
};

const STATUS_COLORS: Record<string, string> = {
  Active:       "bg-success-500/15 text-success-300 border-success-500/20",
  Disconnected: "bg-danger-500/15 text-danger-300 border-danger-500/20",
};

function getProjectName(projectId: string | null): string {
  if (!projectId) return "—";
  return MOCK_PROJECTS.find((p) => p.id === projectId)?.name ?? projectId;
}

// ---------------------------------------------------------------------------
// Modal form
// ---------------------------------------------------------------------------
interface ModalProps {
  initial?: Partial<Repository>;
  onSave: (data: Partial<Repository>) => Promise<void>;
  onClose: () => void;
}

function RepoModal({ initial, onSave, onClose }: ModalProps) {
  const [form, setForm] = useState({
    repository_name: initial?.repository_name ?? "",
    repository_url:  initial?.repository_url  ?? "",
    provider:        (initial?.provider ?? "GitHub") as RepoProvider,
    project_id:      initial?.project_id ?? null as string | null,
    status:          initial?.status ?? "Active",
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.repository_name.trim()) errs.repository_name = "Repository name is required";
    if (!form.repository_url.trim())  errs.repository_url  = "Repository URL is required";
    try { new URL(form.repository_url); } catch { errs.repository_url = "Must be a valid URL"; }
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      await onSave({
        ...form,
        connected_at: initial?.connected_at ?? new Date().toISOString(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="glass-card w-full max-w-lg p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-surface-50">{initial?.id ? "Edit Repository" : "Add Repository"}</h3>
          <button onClick={onClose} className="btn-ghost p-1" id="repo-modal-close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="input-label">Repository Name *</label>
            <input className="input w-full" id="repo-name" placeholder="my-awesome-repo"
              value={form.repository_name} onChange={(e) => setForm({ ...form, repository_name: e.target.value })} />
            {errors.repository_name && <p className="text-danger-400 text-xs mt-1">{errors.repository_name}</p>}
          </div>

          <div>
            <label className="input-label">Repository URL *</label>
            <input className="input w-full" id="repo-url" placeholder="https://github.com/org/repo"
              value={form.repository_url} onChange={(e) => setForm({ ...form, repository_url: e.target.value })} />
            {errors.repository_url && <p className="text-danger-400 text-xs mt-1">{errors.repository_url}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Provider</label>
              <select className="input w-full" id="repo-provider" value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value as RepoProvider })}>
                {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Status</label>
              <select className="input w-full" id="repo-status" value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="Active">Active</option>
                <option value="Disconnected">Disconnected</option>
              </select>
            </div>
          </div>

          <div>
            <label className="input-label">Project (optional)</label>
            <select className="input w-full" id="repo-project" value={form.project_id ?? ""}
              onChange={(e) => setForm({ ...form, project_id: e.target.value || null })}>
              <option value="">No project</option>
              {MOCK_PROJECTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1" id="repo-save-btn">
              {saving ? "Saving…" : initial?.id ? "Save Changes" : "Add Repository"}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary" id="repo-cancel-btn">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirm delete modal
// ---------------------------------------------------------------------------
function ConfirmModal({ name, onConfirm, onClose }: { name: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="glass-card w-full max-w-sm p-6 space-y-4 text-center">
        <div className="w-12 h-12 rounded-full bg-danger-500/15 flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-danger-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </div>
        <div>
          <h3 className="text-surface-50 font-bold text-lg">Remove Repository</h3>
          <p className="text-surface-400 text-sm mt-1">Remove <span className="text-surface-200 font-medium">{name}</span>? This cannot be undone.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onConfirm} className="btn-danger flex-1" id="repo-confirm-delete">Remove</button>
          <button onClick={onClose}   className="btn-secondary flex-1" id="repo-cancel-delete">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function AdminRepositoriesPage() {
  const [repos, setRepos]     = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [search, setSearch]   = useState("");
  const [provFilter, setProvFilter] = useState("All");
  const [modal, setModal]     = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<Repository | null>(null);
  const [deleting, setDeleting] = useState<Repository | null>(null);
  const [toast, setToast]     = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchAllRepositories()
      .then(setRepos)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const filtered = useMemo(() =>
    repos.filter((r) => {
      const matchSearch = !search ||
        r.repository_name.toLowerCase().includes(search.toLowerCase()) ||
        getProjectName(r.project_id).toLowerCase().includes(search.toLowerCase());
      const matchProv = provFilter === "All" || r.provider === provFilter;
      return matchSearch && matchProv;
    }), [repos, search, provFilter]);

  const handleSave = async (data: Partial<Repository>) => {
    if (editing) {
      await updateRepository(editing.id, data);
      setRepos((prev) => prev.map((r) => r.id === editing.id ? { ...r, ...data } : r));
      showToast("Repository updated successfully");
    } else {
      const created = await createRepository(data as Omit<Repository, "id">);
      setRepos((prev) => [created, ...prev]);
      showToast("Repository added successfully");
    }
    setModal(null);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await deleteRepository(deleting.id);
    setRepos((prev) => prev.filter((r) => r.id !== deleting.id));
    showToast("Repository removed");
    setDeleting(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {toast && (
        <div className="fixed top-4 right-4 z-50 glass-card px-5 py-3 bg-success-500/20 border-success-500/30 text-success-300 text-sm animate-slide-in">
          ✓ {toast}
        </div>
      )}

      {modal && (
        <RepoModal
          initial={editing ?? undefined}
          onSave={handleSave}
          onClose={() => { setModal(null); setEditing(null); }}
        />
      )}

      {deleting && (
        <ConfirmModal
          name={deleting.repository_name}
          onConfirm={handleDelete}
          onClose={() => setDeleting(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-surface-50">Repositories</h2>
          <p className="text-surface-400 text-sm mt-1">
            {repos.filter((r) => r.status === "Active").length} active · {repos.length} total connected
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge-admin">Admin Panel</span>
          <button onClick={() => { setEditing(null); setModal("add"); }} className="btn-primary text-sm py-2 px-4" id="add-repo-btn">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Repository
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col sm:flex-row gap-3">
        <input type="text" placeholder="Search by name or project…"
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="input flex-1" id="repos-search" />
        <select value={provFilter} onChange={(e) => setProvFilter(e.target.value)} className="input sm:w-44" id="repos-provider-filter">
          <option value="All">All Providers</option>
          {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

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
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
            <p className="text-lg font-medium">No repositories found</p>
            <p className="text-sm mt-1">Try adjusting your search or add a new repository</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-700/50">
                  {["Repository", "Project", "Provider", "Status", "Connected", "Actions"].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-surface-400 uppercase tracking-wider px-6 py-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/30">
                {filtered.map((repo) => (
                  <tr key={repo.id} className="hover:bg-surface-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-surface-200 font-medium text-sm">{repo.repository_name}</p>
                      <a href={repo.repository_url} target="_blank" rel="noreferrer"
                        className="text-primary-400 text-xs hover:underline truncate max-w-[200px] block mt-0.5">
                        {repo.repository_url}
                      </a>
                    </td>
                    <td className="px-6 py-4 text-surface-400 text-sm">{getProjectName(repo.project_id)}</td>
                    <td className="px-6 py-4">
                      <span className={`badge ${PROVIDER_COLORS[repo.provider]}`}>{repo.provider}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`badge ${STATUS_COLORS[repo.status] ?? STATUS_COLORS.Active}`}>{repo.status}</span>
                    </td>
                    <td className="px-6 py-4 text-surface-500 text-xs">
                      {new Date(repo.connected_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setEditing(repo); setModal("edit"); }}
                          className="text-xs px-3 py-1.5 rounded-lg border border-primary-500/30 text-primary-400 hover:bg-primary-500/10 transition-colors"
                          id={`edit-repo-${repo.id}`}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleting(repo)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-danger-500/30 text-danger-400 hover:bg-danger-500/10 transition-colors"
                          id={`delete-repo-${repo.id}`}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && (
        <p className="text-surface-600 text-xs text-right">
          Showing {filtered.length} of {repos.length} repositories
        </p>
      )}
    </div>
  );
}
