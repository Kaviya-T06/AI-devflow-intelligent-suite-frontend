/**
 * PMTeamTasksPage — Team task management for Project Manager role.
 * Shows all tasks across managed projects with full CRUD.
 * Developers own status transitions; PM manages assignments, priority, dates.
 */
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchAllManagedTasks,
  fetchProjectTasks,
  fetchPMDashboardStats,
  createManagedTask,
  updateManagedTask,
  deleteManagedTask,
  fetchAssignableUsers,
  type AssignableUser,
} from "../../services/pmService";
import type { Task, PMDashboardStats } from "../../types";

// ---------------------------------------------------------------------------
// Types & Helpers
// ---------------------------------------------------------------------------

type StatusFilter = "ALL" | "TODO" | "IN_PROGRESS" | "REVIEW" | "COMPLETED";

function getStatusBadgeClass(status: string): string {
  switch (status.toUpperCase()) {
    case "TODO":        return "bg-surface-700/50 text-surface-300";
    case "IN_PROGRESS": return "bg-primary-500/15 text-primary-300 border border-primary-500/20";
    case "REVIEW":      return "bg-warning-500/15 text-warning-300 border border-warning-500/20";
    case "COMPLETED":   return "bg-success-500/15 text-success-300 border border-success-500/20";
    default:            return "bg-surface-700/50 text-surface-400";
  }
}

function getPriorityBadgeClass(priority: string): string {
  switch (priority.toUpperCase()) {
    case "LOW":      return "bg-surface-700/50 text-surface-400";
    case "MEDIUM":   return "bg-primary-500/15 text-primary-300";
    case "HIGH":     return "bg-warning-500/15 text-warning-300";
    case "CRITICAL": return "bg-danger-500/15 text-danger-300";
    default:         return "bg-surface-700/50 text-surface-400";
  }
}

function isOverdue(task: Task): boolean {
  if (!task.due_date || task.status === "COMPLETED") return false;
  return new Date() > new Date(task.due_date);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Create / Edit Task Modal
// ---------------------------------------------------------------------------

interface TaskFormData {
  title: string;
  description: string;
  project_id: string;
  assigned_to: string;
  priority: string;
  due_date: string;
}

function TaskModal({
  mode,
  task,
  projects,
  users,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  task?: Task | null;
  projects: Array<{ id: string; name: string }>;
  users: AssignableUser[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState<TaskFormData>({
    title: task?.title ?? "",
    description: task?.description ?? "",
    project_id: task?.project_id ?? (projects[0]?.id ?? ""),
    assigned_to: task?.assigned_to ?? "",
    priority: task?.priority ?? "MEDIUM",
    due_date: task?.due_date
      ? new Date(task.due_date).toISOString().split("T")[0]
      : "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Task title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const description = form.description.trim() || undefined;
      const project_id = form.project_id || null;
      const assigned_to = form.assigned_to || null;
      const due_date = form.due_date || null;

      if (mode === "create") {
        await createManagedTask({
          title: form.title.trim(),
          description,
          project_id,
          assigned_to,
          priority: form.priority,
          due_date,
          status: "TODO",
        });
      } else if (task) {
        await updateManagedTask(task.id, {
          title: form.title.trim(),
          description,
          project_id,
          assigned_to,
          priority: form.priority,
          due_date,
        });
      }

      setSuccess(true);
      setTimeout(() => {
        onSave();
        onClose();
      }, 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-card w-full max-w-lg p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-surface-50 font-bold text-lg">
            {mode === "create" ? "Create Task" : "Edit Task"}
          </h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-200 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {success && (
          <div className="bg-success-500/10 border border-success-500/20 text-success-300 p-3 rounded-lg mb-4 text-sm flex items-center gap-2">
            ✅ Task {mode === "create" ? "created" : "updated"} successfully!
          </div>
        )}
        {error && (
          <div className="bg-danger-500/10 border border-danger-500/20 text-danger-400 p-3 rounded-lg mb-4 text-sm flex items-center gap-2">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-surface-400 text-xs font-medium mb-1">
              Title <span className="text-danger-400">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Task title"
              required
              className="w-full bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2 text-surface-100 text-sm focus:outline-none focus:border-primary-500/50 placeholder:text-surface-600"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-surface-400 text-xs font-medium mb-1">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              placeholder="Task description (optional)"
              className="w-full bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2 text-surface-100 text-sm focus:outline-none focus:border-primary-500/50 placeholder:text-surface-600 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Project */}
            <div>
              <label className="block text-surface-400 text-xs font-medium mb-1">Project</label>
              <select
                name="project_id"
                value={form.project_id}
                onChange={handleChange}
                className="w-full bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2 text-surface-100 text-sm focus:outline-none focus:border-primary-500/50"
              >
                <option value="">— No project —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Assigned To */}
            <div>
              <label className="block text-surface-400 text-xs font-medium mb-1">Assign To</label>
              <select
                name="assigned_to"
                value={form.assigned_to}
                onChange={handleChange}
                className="w-full bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2 text-surface-100 text-sm focus:outline-none focus:border-primary-500/50"
              >
                <option value="">— Unassigned —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            <div>
              <label className="block text-surface-400 text-xs font-medium mb-1">Priority</label>
              <select
                name="priority"
                value={form.priority}
                onChange={handleChange}
                className="w-full bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2 text-surface-100 text-sm focus:outline-none focus:border-primary-500/50"
              >
                {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-surface-400 text-xs font-medium mb-1">Due Date</label>
              <input
                type="date"
                name="due_date"
                value={form.due_date}
                onChange={handleChange}
                className="w-full bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2 text-surface-100 text-sm focus:outline-none focus:border-primary-500/50"
              />
            </div>
          </div>

          {/* Note for PM about status */}
          <p className="text-surface-600 text-xs italic">
            Note: Task status is updated by the assigned developer. You can manage assignments, priority, and due dates here.
          </p>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-primary-600 hover:bg-primary-500 text-white font-medium text-sm py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : mode === "create" ? "Create Task" : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-surface-700/50 hover:bg-surface-700 text-surface-300 font-medium text-sm py-2.5 px-4 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation dialog
// ---------------------------------------------------------------------------

function DeleteConfirm({
  task,
  onConfirm,
  onCancel,
}: {
  task: Task;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteManagedTask(task.id);
      onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-card w-full max-w-sm p-6 animate-fade-in">
        <h3 className="text-surface-50 font-bold text-lg mb-2">Delete Task?</h3>
        <p className="text-surface-400 text-sm mb-4">
          Are you sure you want to delete <strong className="text-surface-200">"{task.title}"</strong>? This cannot be undone.
        </p>
        {error && <p className="text-danger-400 text-xs mb-3">⚠️ {error}</p>}
        <div className="flex gap-3">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 bg-danger-600 hover:bg-danger-500 text-white font-medium text-sm py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 bg-surface-700/50 hover:bg-surface-700 text-surface-300 font-medium text-sm py-2.5 px-4 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

const REFRESH_INTERVAL_MS = 30_000;

export default function PMTeamTasksPage() {
  const [searchParams] = useSearchParams();
  const projectIdParam = searchParams.get("project");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<PMDashboardStats | null>(null);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [projectFilter, setProjectFilter] = useState<string>(projectIdParam ?? "");
  const [searchQuery, setSearchQuery] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [tasksData, statsData, usersData] = await Promise.all([
        projectFilter ? fetchProjectTasks(projectFilter) : fetchAllManagedTasks(),
        fetchPMDashboardStats(),
        fetchAssignableUsers(),
      ]);
      setTasks(tasksData);
      setStats(statsData);
      setUsers(usersData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [projectFilter]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadData]);

  // Keep project filter in sync with URL param
  useEffect(() => {
    if (projectIdParam) setProjectFilter(projectIdParam);
  }, [projectIdParam]);

  const projects = stats?.projects.map((p) => ({ id: p.id, name: p.name })) ?? [];

  // Apply filters
  const filteredTasks = tasks.filter((t) => {
    const statusMatch = statusFilter === "ALL" || t.status === statusFilter;
    const searchMatch =
      !searchQuery ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.developer_name ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    return statusMatch && searchMatch;
  });

  const STATUS_TABS: { label: string; value: StatusFilter }[] = [
    { label: "All", value: "ALL" },
    { label: "Todo", value: "TODO" },
    { label: "In Progress", value: "IN_PROGRESS" },
    { label: "Review", value: "REVIEW" },
    { label: "Completed", value: "COMPLETED" },
  ];

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-48 bg-surface-800 rounded animate-pulse" />
        <div className="glass-card p-5 animate-pulse space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-surface-700/60 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-surface-50">Team Tasks</h2>
          <p className="text-surface-400 text-sm mt-1">
            Manage and monitor tasks across your projects. Developers update task status.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={loadData}
            className="text-surface-400 hover:text-primary-300 transition-colors p-1.5 rounded-lg hover:bg-surface-700/50"
            title="Refresh"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Task
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-danger-500/10 border border-danger-500/20 text-danger-400 p-4 rounded-lg flex items-start gap-3">
          <span className="text-xl shrink-0">⚠️</span>
          <div>
            <p className="font-semibold text-sm">Failed to load tasks</p>
            <p className="text-xs mt-0.5 text-danger-300">{error}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      {!error && (
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Project filter */}
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2 text-surface-300 text-sm focus:outline-none focus:border-primary-500/50 min-w-[180px]"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {/* Search */}
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search tasks or developers…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-800 border border-surface-700/50 rounded-lg pl-10 pr-4 py-2 text-surface-200 text-sm focus:outline-none focus:border-primary-500/50 placeholder:text-surface-600"
            />
          </div>

          {/* Status tabs */}
          <div className="flex items-center gap-1 bg-surface-800/50 rounded-lg p-1 border border-surface-700/30 flex-wrap">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  statusFilter === tab.value
                    ? "bg-primary-600 text-white"
                    : "text-surface-400 hover:text-surface-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tasks table */}
      {!error && (
        <>
          {filteredTasks.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <span className="text-5xl mb-4 block">📋</span>
              <p className="text-surface-300 font-semibold text-lg">No tasks found</p>
              <p className="text-surface-500 text-sm mt-2">
                {tasks.length === 0
                  ? "Create your first task to get started."
                  : "No tasks match the current filters."}
              </p>
            </div>
          ) : (
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-surface-700/30">
                      {["Task", "Project", "Assignee", "Priority", "Status", "Due Date", "Actions"].map((h) => (
                        <th key={h} className="px-4 py-3 text-surface-500 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((task) => {
                      const overdue = isOverdue(task);
                      return (
                        <tr
                          key={task.id}
                          className="border-b border-surface-700/20 hover:bg-surface-800/40 transition-colors"
                        >
                          <td className="px-4 py-3 max-w-[200px]">
                            <p className="text-surface-200 text-sm font-medium truncate">{task.title}</p>
                            {task.description && (
                              <p className="text-surface-500 text-xs truncate">{task.description}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-surface-400 text-sm whitespace-nowrap">
                            {task.project_name ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-surface-400 text-sm whitespace-nowrap">
                            {task.developer_name ?? <span className="text-surface-600 italic">Unassigned</span>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`badge text-xs px-2 py-0.5 rounded-full font-medium ${getPriorityBadgeClass(task.priority)}`}>
                              {task.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`badge text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadgeClass(task.status)}`}>
                              {task.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={overdue ? "text-danger-400 text-xs font-medium" : "text-surface-400 text-sm"}>
                              {overdue ? "⚠️ " : ""}{formatDate(task.due_date)}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setEditingTask(task)}
                                className="text-surface-400 hover:text-primary-300 transition-colors"
                                title="Edit task"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setDeletingTask(task)}
                                className="text-surface-400 hover:text-danger-400 transition-colors"
                                title="Delete task"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 border-t border-surface-700/20 text-surface-600 text-xs">
                Showing {filteredTasks.length} of {tasks.length} tasks
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showCreateModal && (
        <TaskModal
          mode="create"
          projects={projects}
          users={users}
          onClose={() => setShowCreateModal(false)}
          onSave={loadData}
        />
      )}
      {editingTask && (
        <TaskModal
          mode="edit"
          task={editingTask}
          projects={projects}
          users={users}
          onClose={() => setEditingTask(null)}
          onSave={loadData}
        />
      )}
      {deletingTask && (
        <DeleteConfirm
          task={deletingTask}
          onConfirm={() => { setDeletingTask(null); loadData(); }}
          onCancel={() => setDeletingTask(null)}
        />
      )}
    </div>
  );
}
