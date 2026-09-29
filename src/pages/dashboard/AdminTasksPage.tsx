/**
 * Admin Tasks Page — Create, view, edit, and delete tasks with filtering.
 */
import { useEffect, useState, useMemo } from "react";
import { fetchAllTasks, createTask, updateTask, deleteTask } from "../../services/adminService";
import { MOCK_PROJECTS, MOCK_USERS } from "../../services/mockData";
import type { Task, TaskPriority, TaskStatus } from "../../types";

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  Low:      "bg-surface-700/40 text-surface-400 border-surface-600/30",
  Medium:   "bg-primary-500/15 text-primary-300 border-primary-500/20",
  High:     "bg-warning-500/15 text-warning-300 border-warning-500/20",
  Critical: "bg-danger-500/15 text-danger-300 border-danger-500/20",
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  "To Do":       "bg-surface-700/40 text-surface-400 border-surface-600/30",
  "In Progress": "bg-primary-500/15 text-primary-300 border-primary-500/20",
  Completed:     "bg-success-500/15 text-success-300 border-success-500/20",
  Blocked:       "bg-danger-500/15 text-danger-300 border-danger-500/20",
};

const STATUSES:   TaskStatus[]   = ["To Do", "In Progress", "Completed", "Blocked"];
const PRIORITIES: TaskPriority[] = ["Low", "Medium", "High", "Critical"];

// ---------------------------------------------------------------------------
// Modal Form
// ---------------------------------------------------------------------------
interface ModalProps {
  initial?: Partial<Task>;
  onSave: (data: Partial<Task>) => Promise<void>;
  onClose: () => void;
}

function TaskModal({ initial, onSave, onClose }: ModalProps) {
  const [form, setForm] = useState({
    title:       initial?.title       ?? "",
    description: initial?.description ?? "",
    status:      (initial?.status     ?? "To Do") as TaskStatus,
    priority:    (initial?.priority   ?? "Medium") as TaskPriority,
    project_id:  initial?.project_id  ?? null as string | null,
    assigned_to: initial?.assigned_to ?? null as string | null,
    due_date:    initial?.due_date    ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = "Title is required";
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const project  = MOCK_PROJECTS.find((p) => p.id === form.project_id);
      const assignee = MOCK_USERS.find((u) => u.id === form.assigned_to);
      await onSave({
        ...form,
        project:  project  ? { id: project.id, name: project.name } : null,
        assignee: assignee ? { id: assignee.id, full_name: assignee.full_name, email: assignee.email } : null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="glass-card w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-surface-50">{initial?.id ? "Edit Task" : "New Task"}</h3>
          <button onClick={onClose} className="btn-ghost p-1" id="task-modal-close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="input-label">Title *</label>
            <input className="input w-full" id="task-title" placeholder="What needs to be done?"
              value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            {errors.title && <p className="text-danger-400 text-xs mt-1">{errors.title}</p>}
          </div>

          <div>
            <label className="input-label">Description</label>
            <textarea className="input w-full resize-none" id="task-desc" rows={3}
              placeholder="Detailed description…"
              value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Status</label>
              <select className="input w-full" id="task-status" value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Priority</label>
              <select className="input w-full" id="task-priority" value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="input-label">Project</label>
            <select className="input w-full" id="task-project" value={form.project_id ?? ""}
              onChange={(e) => setForm({ ...form, project_id: e.target.value || null })}>
              <option value="">No project</option>
              {MOCK_PROJECTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label className="input-label">Assigned To</label>
            <select className="input w-full" id="task-assignee" value={form.assigned_to ?? ""}
              onChange={(e) => setForm({ ...form, assigned_to: e.target.value || null })}>
              <option value="">Unassigned</option>
              {MOCK_USERS.filter((u) => u.is_active).map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="input-label">Due Date</label>
            <input type="date" className="input w-full" id="task-due"
              value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value || "" })} />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1" id="task-save-btn">
              {saving ? "Saving…" : initial?.id ? "Save Changes" : "Create Task"}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary" id="task-cancel-btn">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirm Delete
// ---------------------------------------------------------------------------
function ConfirmModal({ name, onConfirm, onClose }: { name: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="glass-card w-full max-w-sm p-6 space-y-4 text-center">
        <div className="w-12 h-12 rounded-full bg-danger-500/15 flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-danger-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </div>
        <div>
          <h3 className="text-surface-50 font-bold text-lg">Delete Task</h3>
          <p className="text-surface-400 text-sm mt-1">Delete <span className="text-surface-200 font-medium">{name}</span>? This cannot be undone.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onConfirm} className="btn-danger flex-1" id="task-confirm-delete">Delete</button>
          <button onClick={onClose}   className="btn-secondary flex-1" id="task-cancel-delete">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function AdminTasksPage() {
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [statusFilter, setStatusFilter]   = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [search, setSearch]     = useState("");
  const [modal, setModal]       = useState<"add" | "edit" | null>(null);
  const [editing, setEditing]   = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [toast, setToast]       = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchAllTasks()
      .then(setTasks)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const filtered = useMemo(() =>
    tasks.filter((t) => {
      const matchSearch   = !search || t.title.toLowerCase().includes(search.toLowerCase());
      const matchStatus   = statusFilter   === "All" || t.status   === statusFilter;
      const matchPriority = priorityFilter === "All" || t.priority === priorityFilter;
      return matchSearch && matchStatus && matchPriority;
    }), [tasks, search, statusFilter, priorityFilter]);

  const handleSave = async (data: Partial<Task>) => {
    if (editing) {
      await updateTask(editing.id, data);
      setTasks((prev) => prev.map((t) => t.id === editing.id ? { ...t, ...data } : t));
      showToast("Task updated successfully");
    } else {
      const now = new Date().toISOString();
      const created = await createTask({
        title:       data.title!,
        description: data.description ?? null,
        status:      data.status  ?? "To Do",
        priority:    data.priority ?? "Medium",
        project_id:  data.project_id  ?? null,
        assigned_to: data.assigned_to ?? null,
        due_date:    data.due_date  || null,
        project:     data.project  ?? null,
        assignee:    data.assignee ?? null,
        created_at:  now,
        updated_at:  now,
      });
      setTasks((prev) => [created, ...prev]);
      showToast("Task created successfully");
    }
    setModal(null);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await deleteTask(deleting.id);
    setTasks((prev) => prev.filter((t) => t.id !== deleting.id));
    showToast("Task deleted");
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
        <TaskModal
          initial={editing ?? undefined}
          onSave={handleSave}
          onClose={() => { setModal(null); setEditing(null); }}
        />
      )}
      {deleting && (
        <ConfirmModal
          name={deleting.title}
          onConfirm={handleDelete}
          onClose={() => setDeleting(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-surface-50">Tasks</h2>
          <p className="text-surface-400 text-sm mt-1">
            {tasks.filter((t) => t.status !== "Completed").length} open · {tasks.length} total across all projects
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge-admin">Admin Panel</span>
          <button onClick={() => { setEditing(null); setModal("add"); }} className="btn-primary text-sm py-2 px-4" id="add-task-btn">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Task
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col sm:flex-row gap-3">
        <input type="text" placeholder="Search tasks…" value={search}
          onChange={(e) => setSearch(e.target.value)} className="input flex-1" id="tasks-search" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input sm:w-44" id="tasks-status-filter">
          <option value="All">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="input sm:w-40" id="tasks-priority-filter">
          <option value="All">All Priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
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
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-lg font-medium">No tasks found</p>
            <p className="text-sm mt-1">Try adjusting your filters or create a new task</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-700/50">
                  {["Title", "Project", "Assigned To", "Priority", "Status", "Due Date", "Actions"].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-surface-400 uppercase tracking-wider px-6 py-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/30">
                {filtered.map((task) => (
                  <tr key={task.id} className="hover:bg-surface-800/40 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="text-surface-200 font-medium text-sm">{task.title}</p>
                      {task.description && <p className="text-surface-500 text-xs mt-0.5 line-clamp-1">{task.description}</p>}
                    </td>
                    <td className="px-6 py-4 text-surface-400 text-sm">
                      {(task.project as { name?: string } | null)?.name ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-surface-400 text-sm">
                      {(task.assignee as { full_name?: string } | null)?.full_name ?? "Unassigned"}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`badge ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`badge ${STATUS_COLORS[task.status]}`}>{task.status}</span>
                    </td>
                    <td className="px-6 py-4 text-surface-500 text-xs">
                      {task.due_date ? new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditing(task); setModal("edit"); }}
                          className="text-xs px-2.5 py-1 rounded-lg border border-primary-500/30 text-primary-400 hover:bg-primary-500/10 transition-colors"
                          id={`edit-task-${task.id}`}
                        >Edit</button>
                        <button
                          onClick={() => setDeleting(task)}
                          className="text-xs px-2.5 py-1 rounded-lg border border-danger-500/30 text-danger-400 hover:bg-danger-500/10 transition-colors"
                          id={`delete-task-${task.id}`}
                        >Delete</button>
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
          Showing {filtered.length} of {tasks.length} tasks
        </p>
      )}
    </div>
  );
}
