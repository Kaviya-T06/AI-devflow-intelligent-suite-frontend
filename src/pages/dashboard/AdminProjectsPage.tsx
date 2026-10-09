/**
 * Admin Projects Page — Create, view, edit, and delete projects.
 * Rebuilt using a table-based layout.
 */
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
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
    <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden w-24">
      <div
        className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
    <span className="text-xs text-surface-400 w-8 text-right">{value}%</span>
  </div>
);

// Lock body scroll when modal is open
function useLockBodyScroll() {
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);
}

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
  useLockBodyScroll();
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
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="glass-card w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in relative">
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
          
          <div>
            <label className="input-label">Progress %</label>
            <input type="number" min="0" max="100" className="input w-full"
              value={form.progress} onChange={(e) => setForm({ ...form, progress: parseInt(e.target.value) || 0 })} />
            {errors.progress && <p className="text-danger-400 text-xs mt-1">{errors.progress}</p>}
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
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// View Details Modal
// ---------------------------------------------------------------------------
function ProjectDetailsModal({ project, onClose }: { project: Project; onClose: () => void }) {
  useLockBodyScroll();
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="glass-card w-full max-w-lg p-6 space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in relative">
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
              <p className="text-surface-600 text-xs uppercase tracking-wider mb-1">Team Size</p>
              <p className="text-surface-200 text-sm">{project.member_count ?? 0} members</p>
            </div>
            <div>
              <p className="text-surface-600 text-xs uppercase tracking-wider mb-1">Tasks</p>
              <p className="text-surface-200 text-sm">
                {project.completed_task_count ?? 0} / {project.task_count ?? 0} completed
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
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Confirm Archive Modal
// ---------------------------------------------------------------------------
function ConfirmModal({ name, onConfirm, onClose }: { name: string; onConfirm: () => void; onClose: () => void }) {
  useLockBodyScroll();
  return createPortal(
    <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="glass-card w-full max-w-sm p-6 space-y-4 text-center shadow-2xl animate-fade-in relative">
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
    </div>,
    document.body
  );
}

function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block text-left">
      <button onClick={() => setOpen(!open)} className="p-1 rounded hover:bg-surface-700 text-surface-400 transition-colors">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-surface-800 ring-1 ring-surface-700 z-50 py-1" onClick={() => setOpen(false)}>
            {children}
          </div>
        </>
      )}
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
  
  // Filters and Sorting
  const [search, setSearch]     = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [managerFilter, setManagerFilter] = useState("All");
  const [sortField, setSortField] = useState<"name" | "status">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  
  // Modals state
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

  const filtered = useMemo(() => {
    const result = projects.filter((p) => {
      const matchSearch = !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description ?? "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "All" || p.status === statusFilter;
      const matchManager = managerFilter === "All" || 
        (managerFilter === "Unassigned" ? !p.project_manager_id : p.project_manager_id === managerFilter);
      return matchSearch && matchStatus && matchManager;
    });

    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === "status") {
        comparison = a.status.localeCompare(b.status);
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [projects, search, statusFilter, managerFilter, sortField, sortOrder]);

  const handleSort = (field: "name" | "status") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <span className="opacity-30 inline-block ml-1">↕</span>;
    return <span className="inline-block ml-1">{sortOrder === "asc" ? "↑" : "↓"}</span>;
  };

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
        await createProject({
          name: data.name!,
          description: data.description || null,
          status: data.status || "planning",
          project_manager_id: data.project_manager_id || null,
          progress: data.progress ?? 0,
          start_date: data.start_date || null,
          end_date: data.end_date || null,
        } as any);
        // fetch projects to get full joined data
        const updatedProjs = await fetchAllProjects();
        setProjects(updatedProjs);
        showToast("Project created successfully");
      }
      setModal(null);
      setEditing(null);
    } catch (e: any) {
      setError(e.message || "Failed to save project");
    }
  };

  const handleQuickAssign = async (projectId: string, newManagerId: string) => {
    const managerId = newManagerId === "unassigned" ? null : newManagerId;
    try {
      await updateProject(projectId, { project_manager_id: managerId });
      const manager = managers.find((m) => m.id === managerId) ?? null;
      setProjects((prev) => prev.map((p) => p.id === projectId ? {
        ...p,
        project_manager_id: managerId,
        project_manager: manager ? { id: manager.id, full_name: manager.name, email: manager.email, role: normalizeRole(manager.role), is_active: manager.is_active, created_at: "", updated_at: "" } : null
      } : p));
      showToast("Manager assigned successfully");
    } catch (e: any) {
      setError(e.message || "Failed to assign manager");
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

  const totalProjects = projects.length;
  const activeCount = projects.filter(p => p.status === "active").length;
  const unassignedCount = projects.filter(p => !p.project_manager_id).length;
  const onHoldCount = projects.filter(p => p.status === "on_hold").length;

  return (
    <div className="space-y-6 animate-fade-in relative z-0 pb-20">
      {toast && (
        <div className="fixed top-4 right-4 z-[99999] glass-card px-5 py-3 bg-success-500/20 border-success-500/30 text-success-300 text-sm animate-slide-in shadow-xl">
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
          <p className="text-surface-400 text-sm mt-1">Manage software projects, teams, and timelines.</p>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex flex-col justify-center">
          <p className="text-xs text-surface-400 uppercase tracking-wider font-semibold">Total Projects</p>
          <p className="text-2xl font-bold text-surface-50 mt-1">{totalProjects}</p>
        </div>
        <div className="glass-card p-4 border border-success-500/20 bg-success-500/5 flex flex-col justify-center">
          <p className="text-xs text-success-400/80 uppercase tracking-wider font-semibold">Active</p>
          <p className="text-2xl font-bold text-success-400 mt-1">{activeCount}</p>
        </div>
        <div className="glass-card p-4 border border-danger-500/20 bg-danger-500/5 flex flex-col justify-center">
          <p className="text-xs text-danger-400/80 uppercase tracking-wider font-semibold">Without Manager</p>
          <p className="text-2xl font-bold text-danger-400 mt-1">{unassignedCount}</p>
        </div>
        <div className="glass-card p-4 border border-warning-500/20 bg-warning-500/5 flex flex-col justify-center">
          <p className="text-xs text-warning-400/80 uppercase tracking-wider font-semibold">On Hold</p>
          <p className="text-2xl font-bold text-warning-400 mt-1">{onHoldCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col sm:flex-row gap-3 items-center">
        <div className="flex-1 w-full relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <input type="text" placeholder="Search projects…" value={search}
            onChange={(e) => setSearch(e.target.value)} className="input w-full pl-9" id="projects-search" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input sm:w-44" id="projects-status-filter">
          <option value="All">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)} className="input sm:w-48">
          <option value="All">All Managers</option>
          <option value="Unassigned">Unassigned Only</option>
          {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {error && (
        <div className="glass-card p-4 border-danger-500/30 bg-danger-500/10">
          <p className="text-danger-300 text-sm">{error}</p>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="glass-card overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-surface-700 bg-surface-800/50">
                <th className="p-4 text-xs font-semibold text-surface-400 uppercase tracking-wider cursor-pointer select-none hover:text-surface-200 transition-colors" onClick={() => handleSort("name")}>
                  Project <SortIcon field="name" />
                </th>
                <th className="p-4 text-xs font-semibold text-surface-400 uppercase tracking-wider">
                  Manager
                </th>
                <th className="p-4 text-xs font-semibold text-surface-400 uppercase tracking-wider cursor-pointer select-none hover:text-surface-200 transition-colors" onClick={() => handleSort("status")}>
                  Status <SortIcon field="status" />
                </th>
                <th className="p-4 text-xs font-semibold text-surface-400 uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-surface-400">
                    <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    <p className="text-lg font-medium">No projects found</p>
                  </td>
                </tr>
              ) : (
                filtered.map((project) => (
                  <tr key={project.id} className="hover:bg-surface-800/30 transition-colors">
                    <td className="p-4 align-middle">
                      <div className="font-bold text-surface-100 text-base">{project.name}</div>
                      <div className="text-xs text-surface-400 mt-1" title={project.description || ""}>
                        {project.description || "No description"}
                      </div>
                    </td>
                    <td className="p-4 align-middle">
                      {isAdmin || isManager ? (
                        <select
                          className="input !py-1.5 !px-2.5 !text-sm !bg-surface-800 border-surface-600 hover:border-primary-500/50 focus:border-primary-500 w-full shadow-sm"
                          value={project.project_manager_id || "unassigned"}
                          onChange={(e) => handleQuickAssign(project.id, e.target.value)}
                        >
                          <option value="unassigned" className="text-surface-400 italic">Unassigned</option>
                          {managers.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-sm text-surface-200">
                          {(project.project_manager as { full_name?: string } | null)?.full_name ?? <span className="italic text-surface-500">Unassigned</span>}
                        </div>
                      )}
                    </td>
                    <td className="p-4 align-middle">
                      <span className={`badge ${STATUS_COLORS[project.status]}`}>{STATUS_LABELS[project.status] ?? project.status}</span>
                    </td>
                    <td className="p-4 align-middle text-right">
                      <DropdownMenu>
                        <button
                          onClick={() => setViewing(project)}
                          className="block w-full text-left px-4 py-2.5 text-sm text-surface-200 hover:bg-surface-700 hover:text-white transition-colors"
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => window.location.href = `/dashboard/admin/tasks?project_id=${project.id}`}
                          className="block w-full text-left px-4 py-2.5 text-sm text-surface-200 hover:bg-surface-700 hover:text-white transition-colors"
                        >
                          Tasks
                        </button>
                        <button
                          onClick={() => setHistoryProject(project)}
                          className="block w-full text-left px-4 py-2.5 text-sm text-surface-200 hover:bg-surface-700 hover:text-white transition-colors"
                        >
                          History
                        </button>
                        {canManageProject(project) && (
                          <>
                            <div className="my-1 border-t border-surface-700"></div>
                            <button
                              onClick={() => { setEditing(project); setModal("edit"); }}
                              className="block w-full text-left px-4 py-2.5 text-sm text-surface-200 hover:bg-surface-700 hover:text-white transition-colors"
                              id={`edit-project-${project.id}`}
                            >
                              Edit Project
                            </button>
                            {project.status !== "archived" && (
                              <button
                                onClick={() => setArchiving(project)}
                                className="block w-full text-left px-4 py-2.5 text-sm text-danger-400 hover:bg-danger-500/10 transition-colors"
                                id={`archive-project-${project.id}`}
                              >
                                Archive Project
                              </button>
                            )}
                          </>
                        )}
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
