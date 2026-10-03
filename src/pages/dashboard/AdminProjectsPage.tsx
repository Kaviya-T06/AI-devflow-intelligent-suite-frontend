/**
 * Admin Projects Page — Create, view, edit, and delete projects.
 */
import { useEffect, useState, useMemo } from "react";
import {
  fetchAllProjects,
  createProject,
  updateProject,
  fetchAllUsers,
  type UserRecord,
} from "../../services/adminService";
import { normalizeRole } from "../../services/profileService";
import { useAuth } from "../../context/AuthContext";
import type { Project, ProjectStatus } from "../../types";
import ProjectHistoryModal from "../../components/dashboard/ProjectHistoryModal";

const STATUS_COLORS: Record<ProjectStatus, string> = {
  active:    "bg-success-500/15 text-success-300 border-success-500/20",
  planning:  "bg-primary-500/15 text-primary-300 border-primary-500/20",
  completed: "bg-surface-700/40 text-surface-400 border-surface-600/30",
  on_hold:   "bg-warning-500/15 text-warning-300 border-warning-500/20",
  archived:  "bg-surface-700/40 text-surface-400 border-surface-600/30",
};

const STATUS_LABELS: Record<ProjectStatus, string> = {
  planning:  "Planning",
  active:    "Active",
  on_hold:   "On Hold",
  completed: "Completed",
  archived:  "Archived",
};

const STATUSES: ProjectStatus[] = ["planning", "active", "on_hold", "completed", "archived"];



const ProgressBar = ({ value }: { value: number }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
    <span className="text-xs text-surface-400 w-8 text-right">{value}%</span>
  </div>
);

// ---------------------------------------------------------------------------
// Modal Form
// ---------------------------------------------------------------------------
interface ModalProps {
  initial?: Partial<Project>;
  onSave: (data: Partial<Project>) => Promise<void>;
  onClose: () => void;
  managers: UserRecord[];
}

function ProjectModal({ initial, onSave, onClose, managers }: ModalProps) {
  const [form, setForm] = useState({
    name:               initial?.name ?? "",
    description:        initial?.description ?? "",
    status:             (initial?.status ?? "planning") as ProjectStatus,
    project_manager_id: initial?.project_manager_id ?? null as string | null,
    progress:           initial?.progress ?? 0,
    start_date:         initial?.start_date ?? "",
    end_date:           initial?.end_date ?? "",
  });
  const [saving, setSaving]   = useState(false);
  const [errors, setErrors]   = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Project name is required";
    if (form.progress < 0 || form.progress > 100) errs.progress = "Progress must be 0–100";
    if (form.start_date && form.end_date && form.end_date < form.start_date)
      errs.end_date = "End date must be after start date";
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const manager = managers.find((m) => m.id === form.project_manager_id) ?? null;
      await onSave({ ...form, project_manager: manager ? { id: manager.id, full_name: manager.name, email: manager.email, role: normalizeRole(manager.role), is_active: manager.is_active, created_at: "", updated_at: "" } : null });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="glass-card w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-surface-50">{initial?.id ? "Edit Project" : "New Project"}</h3>
          <button type="button" onClick={onClose} className="btn-ghost p-1" id="project-modal-close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="input-label">Project Name *</label>
            <input className="input w-full" id="project-name" placeholder="My Awesome Project"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            {errors.name && <p className="text-danger-400 text-xs mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="input-label">Description</label>
            <textarea className="input w-full resize-none" id="project-desc" rows={3}
              placeholder="Brief description of the project…"
              value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="input-label">Status</label>
              <select className="input w-full" id="project-status" value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="input-label">Project Manager</label>
            <select className="input w-full" id="project-manager" value={form.project_manager_id ?? ""}
              onChange={(e) => setForm({ ...form, project_manager_id: e.target.value || null })}>
              <option value="">Unassigned</option>
              {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Start Date</label>
              <input type="date" className="input w-full" id="project-start"
                value={form.start_date ?? ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div>
              <label className="input-label">End Date</label>
              <input type="date" className="input w-full" id="project-end"
                value={form.end_date ?? ""} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              {errors.end_date && <p className="text-danger-400 text-xs mt-1">{errors.end_date}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1" id="project-save-btn">
              {saving ? "Saving…" : initial?.id ? "Save Changes" : "Create Project"}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary" id="project-cancel-btn">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// View Details Modal
// ---------------------------------------------------------------------------
function ProjectDetailsModal({ project, onClose }: { project: Project; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="glass-card w-full max-w-lg p-6 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-surface-50">{project.name}</h3>
          <button onClick={onClose} className="btn-ghost p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <p className="text-surface-600 text-xs uppercase tracking-wider mb-1">Description</p>
            <p className="text-surface-200 text-sm leading-relaxed">{project.description || "No description provided."}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-surface-600 text-xs uppercase tracking-wider mb-1">Status</p>
              <span className={`badge ${STATUS_COLORS[project.status]}`}>{STATUS_LABELS[project.status] ?? project.status}</span>
            </div>
            <div>
              <p className="text-surface-600 text-xs uppercase tracking-wider mb-1">Progress</p>
              <div className="mt-1">
                <ProgressBar value={project.progress} />
              </div>
            </div>
            <div>
              <p className="text-surface-600 text-xs uppercase tracking-wider mb-1">Project Manager</p>
              <p className="text-surface-200 text-sm font-medium">
                {(project.project_manager as { full_name?: string } | null)?.full_name ?? "Unassigned"}
              </p>
            </div>
            <div>
              <p className="text-surface-600 text-xs uppercase tracking-wider mb-1">Timeline</p>
              <p className="text-surface-200 text-sm">
                {project.start_date ? new Date(project.start_date).toLocaleDateString() : "TBD"} – {project.end_date ? new Date(project.end_date).toLocaleDateString() : "TBD"}
              </p>
            </div>
            <div>
              <p className="text-surface-600 text-xs uppercase tracking-wider mb-1">Created</p>
              <p className="text-surface-200 text-sm">{project.created_at ? new Date(project.created_at).toLocaleDateString() : "Unknown"}</p>
            </div>
            <div>
              <p className="text-surface-600 text-xs uppercase tracking-wider mb-1">Last Updated</p>
              <p className="text-surface-200 text-sm">{project.updated_at ? new Date(project.updated_at).toLocaleDateString() : "Unknown"}</p>
            </div>
          </div>
        </div>
        
        <div className="pt-2">
          <button onClick={onClose} className="btn-secondary w-full">Close</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirm Archive Modal
// ---------------------------------------------------------------------------
function ConfirmModal({ name, onConfirm, onClose }: { name: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="glass-card w-full max-w-sm p-6 space-y-4 text-center">
        <div className="w-12 h-12 rounded-full bg-danger-500/15 flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-danger-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </div>
        <div>
          <h3 className="text-surface-50 font-bold text-lg">Archive Project</h3>
          <p className="text-surface-400 text-sm mt-1">Archive <span className="text-surface-200 font-medium">{name}</span>? It will no longer be active.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onConfirm} className="btn-danger flex-1" id="project-confirm-archive">Archive</button>
          <button onClick={onClose}   className="btn-secondary flex-1" id="project-cancel-archive">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function AdminProjectsPage() {
  const { profile } = useAuth();
  const role = (profile?.role ?? "DEVELOPER") as "ADMIN" | "MANAGER" | "DEVELOPER";
  const isAdmin = role === "ADMIN";
  const isManager = role === "MANAGER";
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [managers, setManagers] = useState<UserRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [modal, setModal]       = useState<"add" | "edit" | null>(null);
  const [editing, setEditing]   = useState<Project | null>(null);
  const [archiving, setArchiving] = useState<Project | null>(null);
  const [viewing, setViewing]   = useState<Project | null>(null);
  const [historyProject, setHistoryProject] = useState<Project | null>(null);
  const [toast, setToast]       = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetchAllProjects(),
      fetchAllUsers(),
    ])
      .then(([projs, users]) => {
        setProjects(projs);
        setManagers(users.filter((u) => u.role === "project_manager"));
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const filtered = useMemo(() =>
    projects.filter((p) => {
      const matchSearch = !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description ?? "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "All" || p.status === statusFilter;
      return matchSearch && matchStatus;
    }), [projects, search, statusFilter]);

  const handleSave = async (data: Partial<Project>) => {
    try {
      if (editing) {
        await updateProject(editing.id, {
          ...data,
          project_manager_id: data.project_manager_id || null,
          start_date: data.start_date || null,
          end_date: data.end_date || null,
        });
        setProjects((prev) => prev.map((p) => p.id === editing.id ? { ...p, ...data } : p));
        showToast("Project updated successfully");
      } else {
        const created = await createProject({
          name: data.name!,
          description: data.description || null,
          status: data.status || "planning",
          project_manager_id: data.project_manager_id || null,
          progress: data.progress ?? 0,
          start_date: data.start_date || null,
          end_date: data.end_date || null,
        } as any);
        setProjects((prev) => [created, ...prev]);
        showToast("Project created successfully");
      }
      setModal(null);
      setEditing(null);
    } catch (e: any) {
      setError(e.message || "Failed to save project");
    }
  };

  const handleArchive = async () => {
    if (!archiving) return;
    try {
      await updateProject(archiving.id, { status: "archived" });
      setProjects((prev) => prev.map(p => p.id === archiving.id ? { ...p, status: "archived" } : p));
      showToast("Project archived");
    } catch (e: any) {
      setError(e.message || "Failed to archive project");
    } finally {
      setArchiving(null);
    }
  };
  
  const canManageProject = (p: Project) => {
    if (isAdmin) return true;
    if (isManager && p.project_manager_id === profile?.id) return true;
    return false;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {toast && (
        <div className="fixed top-4 right-4 z-50 glass-card px-5 py-3 bg-success-500/20 border-success-500/30 text-success-300 text-sm animate-slide-in">
          ✓ {toast}
        </div>
      )}
      {modal && (
        <ProjectModal
          initial={editing ?? undefined}
          managers={managers}
          onSave={handleSave}
          onClose={() => { setModal(null); setEditing(null); }}
        />
      )}
      {viewing && (
        <ProjectDetailsModal project={viewing} onClose={() => setViewing(null)} />
      )}
      {archiving && (
        <ConfirmModal
          name={archiving.name}
          onConfirm={handleArchive}
          onClose={() => setArchiving(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-surface-50">Projects</h2>
          <p className="text-surface-400 text-sm mt-1">
            {projects.filter((p) => p.status === "active").length} active · {projects.length} total
          </p>
        </div>
        {(isAdmin || isManager) && (
          <div className="flex items-center gap-2">
            <span className="badge-admin">Admin Panel</span>
            <button onClick={() => { setEditing(null); setModal("add"); }} className="btn-primary text-sm py-2 px-4" id="add-project-btn">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              New Project
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col sm:flex-row gap-3">
        <input type="text" placeholder="Search projects…" value={search}
          onChange={(e) => setSearch(e.target.value)} className="input flex-1" id="projects-search" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input sm:w-44" id="projects-status-filter">
          <option value="All">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      {error && (
        <div className="glass-card p-4 border-danger-500/30 bg-danger-500/10">
          <p className="text-danger-300 text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card text-center py-16 text-surface-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          <p className="text-lg font-medium">No projects found</p>
          <p className="text-sm mt-1">Try adjusting your filters or create a new project</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((project) => (
            <div key={project.id} className="glass-card p-6 space-y-4 hover:border-primary-500/20 transition-colors group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-surface-100 font-semibold text-base truncate">{project.name}</h3>
                  <p className="text-surface-400 text-sm mt-1 line-clamp-2">{project.description || "No description"}</p>
                </div>
                <span className={`badge shrink-0 ${STATUS_COLORS[project.status]}`}>{STATUS_LABELS[project.status] ?? project.status}</span>
              </div>

              <div>
                <ProgressBar value={project.progress} />
                <p className="text-xs text-surface-400 mt-1 text-center font-medium">
                  {project.completed_task_count ?? 0} / {project.task_count ?? 0} tasks completed
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <p className="text-surface-600 text-xs">Project Manager</p>
                  <p className="text-surface-300 text-sm font-medium mt-0.5">
                    {(project.project_manager as { full_name?: string } | null)?.full_name ?? "Unassigned"}
                  </p>
                </div>
                <div>
                  <p className="text-surface-600 text-xs">Timeline</p>
                  <p className="text-surface-300 text-sm font-medium mt-0.5">
                    {project.start_date
                      ? `${new Date(project.start_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })} – ${project.end_date ? new Date(project.end_date).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "TBD"}`
                      : "Not set"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setViewing(project)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-surface-500/30 text-surface-300 hover:bg-surface-500/10 transition-colors"
                >
                  View Details
                </button>
                <button
                  onClick={() => setHistoryProject(project)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-accent-500/30 text-accent-400 hover:bg-accent-500/10 transition-colors"
                >
                  History
                </button>
                {canManageProject(project) && (
                  <>
                    <button
                      onClick={() => { setEditing(project); setModal("edit"); }}
                      className="text-xs px-3 py-1.5 rounded-lg border border-primary-500/30 text-primary-400 hover:bg-primary-500/10 transition-colors"
                      id={`edit-project-${project.id}`}
                    >
                      Edit
                    </button>
                    {project.status !== "archived" && (
                      <button
                        onClick={() => setArchiving(project)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-danger-500/30 text-danger-400 hover:bg-danger-500/10 transition-colors"
                        id={`archive-project-${project.id}`}
                      >
                        Archive
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={() => window.location.href = `/dashboard/admin/tasks?project_id=${project.id}`}
                  className="text-xs px-3 py-1.5 rounded-lg border border-primary-500/30 text-primary-400 hover:bg-primary-500/10 transition-colors"
                >
                  Tasks
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <p className="text-surface-600 text-xs text-right">
          Showing {filtered.length} of {projects.length} projects
        </p>
      )}

      {historyProject && (
        <ProjectHistoryModal
          projectId={historyProject.id}
          projectName={historyProject.name}
          onClose={() => setHistoryProject(null)}
        />
      )}
    </div>
  );
}
