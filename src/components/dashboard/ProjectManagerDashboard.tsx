/**
 * ProjectManagerDashboard — live dashboard component for MANAGER role.
 * Fetches PM-scoped stats, projects, and overdue tasks.
 * Auto-refreshes every 30 seconds. Shows proper loading/error states.
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  fetchPMDashboardStats,
} from "../../services/pmService";
import type { PMDashboardStats, ProjectSummary, OverdueTaskSummary } from "../../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStatusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case "active":
      return "bg-success-500/15 text-success-300 border border-success-500/20";
    case "planning":
      return "bg-surface-700/50 text-surface-300";
    case "on_hold":
      return "bg-warning-500/15 text-warning-300 border border-warning-500/20";
    case "completed":
      return "bg-accent-500/15 text-accent-300 border border-accent-500/20";
    case "archived":
      return "bg-surface-700/30 text-surface-500";
    default:
      return "bg-surface-700/50 text-surface-400";
  }
}

function getPriorityBadgeClass(priority: string): string {
  switch (priority.toUpperCase()) {
    case "LOW":
      return "bg-surface-700/50 text-surface-400";
    case "MEDIUM":
      return "bg-primary-500/15 text-primary-300";
    case "HIGH":
      return "bg-warning-500/15 text-warning-300";
    case "CRITICAL":
      return "bg-danger-500/15 text-danger-300";
    default:
      return "bg-surface-700/50 text-surface-400";
  }
}

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "yesterday";
  return `${diffDays}d ago`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className="glass-card p-5 animate-pulse">
      <div className="h-3 w-20 bg-surface-700/60 rounded mb-3" />
      <div className="h-8 w-12 bg-surface-700/60 rounded" />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  loading,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
  loading?: boolean;
}) {
  if (loading) return <SkeletonCard />;
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-surface-500 text-xs font-medium uppercase tracking-wider">
          {label}
        </span>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectSummary }) {
  const navigate = useNavigate();
  const progressColor =
    project.progress >= 80
      ? "bg-success-500"
      : project.progress >= 40
      ? "bg-primary-500"
      : "bg-warning-500";

  return (
    <div className="glass-card p-5 hover:bg-surface-800/50 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-surface-100 font-semibold text-sm truncate">
            {project.name}
          </h4>
          {project.description && (
            <p className="text-surface-400 text-xs mt-1 line-clamp-1">
              {project.description}
            </p>
          )}
        </div>
        <span
          className={`badge shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadgeClass(
            project.status
          )}`}
        >
          {formatStatusLabel(project.status)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-surface-500 text-xs">Progress</span>
          <span className="text-surface-300 text-xs font-semibold">
            {project.progress}%
          </span>
        </div>
        <div className="w-full h-1.5 bg-surface-700 rounded-full">
          <div
            className={`h-full ${progressColor} rounded-full transition-all duration-500`}
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </div>

      {/* Task counts */}
      <div className="grid grid-cols-4 gap-2 text-center mb-3">
        {[
          { label: "Todo", value: project.todo_tasks, color: "text-surface-400" },
          { label: "Progress", value: project.in_progress_tasks, color: "text-primary-400" },
          { label: "Review", value: project.review_tasks, color: "text-warning-400" },
          { label: "Done", value: project.completed_tasks, color: "text-success-400" },
        ].map((item) => (
          <div key={item.label} className="bg-surface-800/50 rounded p-1.5">
            <p className={`text-base font-bold ${item.color}`}>{item.value}</p>
            <p className="text-surface-500 text-[10px] leading-tight">{item.label}</p>
          </div>
        ))}
      </div>

      {project.overdue_tasks > 0 && (
        <div className="flex items-center gap-1.5 text-danger-400 text-xs mb-3">
          <span>⚠️</span>
          <span>{project.overdue_tasks} overdue task{project.overdue_tasks !== 1 ? "s" : ""}</span>
        </div>
      )}

      <button
        onClick={() =>
          navigate(`/dashboard/pm-team-tasks?project=${project.id}`)
        }
        className="text-primary-400 text-xs hover:text-primary-300 hover:underline transition-colors"
      >
        View Tasks →
      </button>
    </div>
  );
}

function OverdueRow({ task }: { task: OverdueTaskSummary }) {
  const isActuallyOverdue =
    task.due_date && new Date() > new Date(task.due_date);
  return (
    <tr className="border-b border-surface-700/30 hover:bg-surface-800/40 transition-colors">
      <td className="px-4 py-3 text-surface-200 text-sm font-medium">
        {task.task_title}
      </td>
      <td className="px-4 py-3 text-surface-400 text-sm">
        {task.project_name ?? "—"}
      </td>
      <td className="px-4 py-3 text-surface-400 text-sm">
        {task.developer_name ?? "Unassigned"}
      </td>
      <td className="px-4 py-3 text-sm">
        <span className={isActuallyOverdue ? "text-danger-400 font-medium" : "text-surface-400"}>
          {new Date(task.due_date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </td>
      <td className="px-4 py-3">
        <span
          className={`badge text-xs px-2 py-0.5 rounded-full font-medium ${getPriorityBadgeClass(
            task.priority
          )}`}
        >
          {task.priority}
        </span>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const REFRESH_INTERVAL_MS = 30_000;

export default function ProjectManagerDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<PMDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const loadStats = useCallback(async () => {
    try {
      const data = await fetchPMDashboardStats();
      setStats(data);
      setError(null);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load dashboard stats"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadStats]);

  const handleManualRefresh = () => {
    setLoading(true);
    loadStats();
  };

  const now = new Date();
  const greeting =
    now.getHours() < 12
      ? "Good morning"
      : now.getHours() < 18
      ? "Good afternoon"
      : "Good evening";

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="section-title">
            {greeting}, {profile?.full_name?.split(" ")[0] ?? "Manager"} 👋
          </h3>
          <p className="text-surface-500 text-xs mt-1">
            Last updated: {relativeTime(lastRefreshed.toISOString())}
          </p>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-primary-300 transition-colors disabled:opacity-50"
          title="Refresh dashboard"
        >
          <svg
            className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>

      {/* Error banner — never silently hide errors */}
      {error && (
        <div className="bg-danger-500/10 border border-danger-500/20 text-danger-400 p-4 rounded-lg flex items-start gap-3">
          <span className="text-xl shrink-0">⚠️</span>
          <div>
            <p className="font-semibold text-sm">Failed to load dashboard</p>
            <p className="text-xs mt-0.5 text-danger-300">{error}</p>
          </div>
        </div>
      )}

      {/* Stat cards */}
      {!error && (
        <>
          <div>
            <h4 className="text-surface-400 text-xs font-semibold uppercase tracking-wider mb-3">
              Projects
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
              <StatCard
                label="My Projects"
                value={stats?.total_projects ?? 0}
                icon="📁"
                color="text-primary-300"
                loading={loading}
              />
              <StatCard
                label="Active"
                value={stats?.active_projects ?? 0}
                icon="▶️"
                color="text-success-300"
                loading={loading}
              />
              <StatCard
                label="Planning"
                value={stats?.planning_projects ?? 0}
                icon="📝"
                color="text-surface-300"
                loading={loading}
              />
              <StatCard
                label="On Hold"
                value={stats?.on_hold_projects ?? 0}
                icon="⏸️"
                color="text-warning-300"
                loading={loading}
              />
              <StatCard
                label="Completed"
                value={stats?.completed_projects ?? 0}
                icon="✅"
                color="text-accent-300"
                loading={loading}
              />
            </div>
          </div>

          <div>
            <h4 className="text-surface-400 text-xs font-semibold uppercase tracking-wider mb-3">
              Tasks
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Total Tasks"
                value={stats?.total_tasks ?? 0}
                icon="📋"
                color="text-surface-200"
                loading={loading}
              />
              <StatCard
                label="Completed"
                value={stats?.completed_tasks ?? 0}
                icon="✅"
                color="text-success-300"
                loading={loading}
              />
              <StatCard
                label="In Progress"
                value={stats?.in_progress_tasks ?? 0}
                icon="🚀"
                color="text-primary-300"
                loading={loading}
              />
              <StatCard
                label="Overdue"
                value={stats?.overdue_tasks ?? 0}
                icon="⚠️"
                color="text-danger-300"
                loading={loading}
              />
            </div>
          </div>

          {/* Average progress */}
          {!loading && stats && (
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-surface-400 text-sm font-medium">
                  📊 Average Project Progress
                </span>
                <span className="text-2xl font-bold gradient-text">
                  {stats.average_progress.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-surface-700 rounded-full">
                <div
                  className="h-full bg-gradient-to-r from-primary-600 to-accent-500 rounded-full transition-all duration-700"
                  style={{ width: `${stats.average_progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Projects list */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title">My Projects</h3>
              <button
                onClick={() => navigate("/dashboard/pm-projects")}
                className="text-primary-400 text-xs hover:underline"
              >
                View all →
              </button>
            </div>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="glass-card p-5 animate-pulse space-y-3">
                    <div className="h-4 bg-surface-700/60 rounded w-3/4" />
                    <div className="h-3 bg-surface-700/60 rounded w-full" />
                    <div className="h-2 bg-surface-700/60 rounded w-full" />
                    <div className="grid grid-cols-4 gap-2">
                      {Array.from({ length: 4 }).map((_, j) => (
                        <div key={j} className="h-10 bg-surface-700/60 rounded" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : stats?.projects && stats.projects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {stats.projects.slice(0, 6).map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            ) : (
              <div className="glass-card p-10 text-center">
                <span className="text-4xl mb-3 block">📁</span>
                <p className="text-surface-300 font-medium">No projects yet</p>
                <p className="text-surface-500 text-sm mt-1">
                  Projects assigned to you will appear here.
                </p>
              </div>
            )}
          </div>

          {/* Overdue tasks */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title text-danger-400">
                Overdue Tasks
                {stats && stats.overdue_task_list.length > 0 && (
                  <span className="ml-2 badge bg-danger-500/15 text-danger-300 border border-danger-500/20 text-xs">
                    {stats.overdue_task_list.length}
                  </span>
                )}
              </h3>
              <button
                onClick={() => navigate("/dashboard/pm-team-tasks")}
                className="text-primary-400 text-xs hover:underline"
              >
                Manage Tasks →
              </button>
            </div>
            {loading ? (
              <div className="glass-card p-5 animate-pulse space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 bg-surface-700/60 rounded" />
                ))}
              </div>
            ) : !stats || stats.overdue_task_list.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <span className="text-3xl mb-2 block">🎉</span>
                <p className="text-surface-300 font-medium">No overdue tasks</p>
                <p className="text-surface-500 text-sm mt-1">
                  Your team is on track!
                </p>
              </div>
            ) : (
              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-surface-700/30">
                        <th className="px-4 py-3 text-surface-500 text-xs font-semibold uppercase tracking-wider">
                          Task
                        </th>
                        <th className="px-4 py-3 text-surface-500 text-xs font-semibold uppercase tracking-wider">
                          Project
                        </th>
                        <th className="px-4 py-3 text-surface-500 text-xs font-semibold uppercase tracking-wider">
                          Developer
                        </th>
                        <th className="px-4 py-3 text-surface-500 text-xs font-semibold uppercase tracking-wider">
                          Due Date
                        </th>
                        <th className="px-4 py-3 text-surface-500 text-xs font-semibold uppercase tracking-wider">
                          Priority
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.overdue_task_list.map((task) => (
                        <OverdueRow key={task.task_id} task={task} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Recent activity (first 5 overdue items as summary) */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title">Recent Activity</h3>
              <button
                onClick={() => navigate("/dashboard/pm-activity")}
                className="text-primary-400 text-xs hover:underline"
              >
                View all activity →
              </button>
            </div>
            {loading ? (
              <div className="glass-card divide-y divide-surface-700/30">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-4 animate-pulse">
                    <div className="w-8 h-8 bg-surface-700/60 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-surface-700/60 rounded w-3/4" />
                      <div className="h-2.5 bg-surface-700/60 rounded w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-card overflow-hidden divide-y divide-surface-700/30">
                {stats && stats.overdue_task_list.slice(0, 5).length > 0 ? (
                  stats.overdue_task_list.slice(0, 5).map((task) => (
                    <div
                      key={task.task_id}
                      className="flex items-start gap-3 px-5 py-3.5 hover:bg-surface-800/50 transition-colors"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-danger-500/10 border border-danger-500/20 flex items-center justify-center text-sm">
                        ⚠️
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-surface-200 text-sm font-medium truncate">
                          {task.task_title}
                        </p>
                        <p className="text-surface-500 text-xs mt-0.5">
                          {task.developer_name ?? "Unassigned"} · {task.project_name ?? "—"} · Due{" "}
                          {new Date(task.due_date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      <span
                        className={`badge text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${getPriorityBadgeClass(
                          task.priority
                        )}`}
                      >
                        {task.priority}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="p-5 text-surface-400 text-sm text-center">
                    No recent activity.
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
