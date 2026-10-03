/**
 * PMProjectsPage — Full project listing for MANAGER role.
 * Shows all projects assigned to the current PM, with task breakdowns,
 * developer workloads, and quick status controls.
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { fetchPMDashboardStats, updateManagedProject, fetchProjectHistory } from "../../services/pmService";
import type { PMDashboardStats, ProjectSummary, DeveloperWorkload, ActivityLog } from "../../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type StatusFilter = "all" | "active" | "planning" | "on_hold" | "completed";

const STATUS_TABS: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Planning", value: "planning" },
  { label: "On Hold", value: "on_hold" },
  { label: "Completed", value: "completed" },
];

function getStatusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case "active":    return "bg-success-500/15 text-success-300 border border-success-500/20";
    case "planning":  return "bg-surface-700/50 text-surface-300";
    case "on_hold":   return "bg-warning-500/15 text-warning-300 border border-warning-500/20";
    case "completed": return "bg-accent-500/15 text-accent-300 border border-accent-500/20";
    case "archived":  return "bg-surface-700/30 text-surface-500";
    default:          return "bg-surface-700/50 text-surface-400";
  }
}

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getProgressColor(progress: number): string {
  if (progress >= 80) return "bg-success-500";
  if (progress >= 40) return "bg-primary-500";
  return "bg-warning-500";
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function DeveloperAvatar({ dev }: { dev: DeveloperWorkload }) {
  const initials = dev.developer_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div
      className="relative group"
      title={`${dev.developer_name}: ${dev.total_tasks} tasks`}
    >
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-600 to-accent-500 flex items-center justify-center text-white font-bold text-[10px] shrink-0 border-2 border-surface-800 -ml-1 first:ml-0">
        {initials}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Allowed manual status transitions (PM cannot set COMPLETED or ARCHIVED)
// ---------------------------------------------------------------------------

const MANUAL_STATUS_OPTIONS = [
  { value: "active",   label: "Active" },
  { value: "planning", label: "Planning" },
  { value: "on_hold",  label: "On Hold" },
];

import ProjectHistoryModal from "../../components/dashboard/ProjectHistoryModal";

// ---------------------------------------------------------------------------
// Project Card
// ---------------------------------------------------------------------------

function ProjectCard({
  project,
  onStatusChange,
  onViewHistory,
}: {
  project: ProjectSummary;
  onStatusChange: (id: string, status: string) => void;
  onViewHistory: (project: ProjectSummary) => void;
}) {
  const navigate = useNavigate();
  const [editingStatus, setEditingStatus] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleStatusSelect = async (newStatus: string) => {
    setSaving(true);
    setSaveError(null);
    try {
      await updateManagedProject(project.id, { status: newStatus });
      onStatusChange(project.id, newStatus);
      setEditingStatus(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  const isAutoControlled = project.status === "completed" || project.status === "archived";
  const progressColor = getProgressColor(project.progress);

  return (
    <div className="glass-card p-5 flex flex-col gap-4 hover:bg-surface-800/30 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-surface-100 font-semibold text-base truncate">{project.name}</h3>
          {project.description && (
            <p className="text-surface-400 text-xs mt-1 line-clamp-2">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`badge text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadgeClass(project.status)}`}>
            {formatStatusLabel(project.status)}
          </span>
          {!isAutoControlled && (
            <button
              onClick={() => setEditingStatus((v) => !v)}
              title="Change status"
              className="text-surface-500 hover:text-surface-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Status editor */}
      {editingStatus && !isAutoControlled && (
        <div className="p-3 bg-surface-800/60 rounded-lg border border-surface-700/50">
          <p className="text-surface-400 text-xs mb-2">Set project status:</p>
          <div className="flex flex-wrap gap-2">
            {MANUAL_STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                disabled={saving || project.status === opt.value}
                onClick={() => handleStatusSelect(opt.value)}
                className={`text-xs px-3 py-1 rounded-full border transition-all ${
                  project.status === opt.value
                    ? "bg-surface-700 text-surface-300 border-surface-600 cursor-default"
                    : "border-surface-600 text-surface-400 hover:border-primary-500 hover:text-primary-300"
                } disabled:opacity-50`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {saveError && (
            <p className="text-danger-400 text-xs mt-2">⚠️ {saveError}</p>
          )}
          {saving && <p className="text-surface-500 text-xs mt-2">Saving…</p>}
        </div>
      )}

      {/* Auto-controlled note */}
      {isAutoControlled && (
        <p className="text-surface-600 text-xs italic">
          Status is automatically managed ({project.status === "completed" ? "all tasks done" : "archived"}).
        </p>
      )}

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-surface-500 text-xs">Progress</span>
          <span className="text-surface-200 text-xs font-bold">{project.progress}%</span>
        </div>
        <div className="w-full h-2 bg-surface-700 rounded-full">
          <div
            className={`h-full ${progressColor} rounded-full transition-all duration-700`}
            style={{ width: `${project.progress}%` }}
          />
        </div>
        <p className="text-surface-600 text-xs mt-1">
          {project.completed_tasks} / {project.total_tasks} tasks completed
        </p>
      </div>

      {/* Task breakdown */}
      <div className="grid grid-cols-5 gap-1.5 text-center">
        {[
          { label: "Todo",     value: project.todo_tasks,        color: "text-surface-400" },
          { label: "Active",   value: project.in_progress_tasks,  color: "text-primary-400" },
          { label: "Review",   value: project.review_tasks,       color: "text-warning-400" },
          { label: "Done",     value: project.completed_tasks,    color: "text-success-400" },
          { label: "Overdue",  value: project.overdue_tasks,      color: "text-danger-400" },
        ].map((item) => (
          <div key={item.label} className="bg-surface-800/60 rounded p-1.5">
            <p className={`text-sm font-bold ${item.color}`}>{item.value}</p>
            <p className="text-surface-600 text-[9px] leading-tight">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Dates */}
      {(project.start_date || project.end_date) && (
        <div className="flex items-center justify-between text-xs text-surface-500">
          <span>🗓 {formatDate(project.start_date)}</span>
          <span>→</span>
          <span>{formatDate(project.end_date)}</span>
        </div>
      )}

      {/* Developers */}
      {project.developers.length > 0 && (
        <div>
          <p className="text-surface-500 text-xs mb-1.5">Team</p>
          <div className="flex items-center gap-1 flex-wrap">
            {project.developers.map((dev) => (
              <div
                key={dev.developer_id}
                className="flex items-center gap-1.5 bg-surface-800/60 rounded-full px-2 py-0.5 text-xs text-surface-300"
                title={`${dev.total_tasks} tasks | ${dev.completed_tasks} done | ${dev.overdue_tasks} overdue`}
              >
                <DeveloperAvatar dev={dev} />
                <span>{dev.developer_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View Tasks & History link */}
      <div className="pt-2 border-t border-surface-700/30 flex justify-between">
        <button
          onClick={() => navigate(`/dashboard/pm-team-tasks?project=${project.id}`)}
          className="text-primary-400 text-xs hover:text-primary-300 hover:underline transition-colors"
        >
          View Tasks →
        </button>
        <button
          onClick={() => onViewHistory(project)}
          className="text-accent-400 text-xs hover:text-accent-300 hover:underline transition-colors"
        >
          View History →
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function PMProjectsPage() {
  const [stats, setStats] = useState<PMDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [historyProject, setHistoryProject] = useState<ProjectSummary | null>(null);

  const loadData = useCallback(async () => {
    try {
      const data = await fetchPMDashboardStats();
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Optimistically update project status in local state
  const handleStatusChange = (projectId: string, newStatus: string) => {
    if (!stats) return;
    setStats((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        projects: prev.projects.map((p) =>
          p.id === projectId ? { ...p, status: newStatus } : p
        ),
      };
    });
  };

  const filteredProjects: ProjectSummary[] = stats
    ? filter === "all"
      ? stats.projects
      : stats.projects.filter((p) => p.status.toLowerCase() === filter)
    : [];

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-48 bg-surface-800 rounded animate-pulse" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-20 bg-surface-800 rounded-full animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card p-5 space-y-3 animate-pulse">
              <div className="h-5 bg-surface-700/60 rounded w-3/4" />
              <div className="h-3 bg-surface-700/60 rounded w-full" />
              <div className="h-2 bg-surface-700/60 rounded w-full" />
              <div className="grid grid-cols-5 gap-1">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className="h-10 bg-surface-700/60 rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-surface-50">My Projects</h2>
          <p className="text-surface-400 text-sm mt-1">
            Projects you manage — progress is calculated automatically from task completion.
          </p>
        </div>
        {stats && (
          <div className="flex items-center gap-2">
            <span className="badge bg-primary-500/15 text-primary-300 border border-primary-500/20">
              {stats.total_projects} project{stats.total_projects !== 1 ? "s" : ""}
            </span>
            <button
              onClick={loadData}
              className="text-surface-400 hover:text-primary-300 transition-colors p-1.5 rounded-lg hover:bg-surface-700/50"
              title="Refresh"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-danger-500/10 border border-danger-500/20 text-danger-400 p-4 rounded-lg flex items-start gap-3">
          <span className="text-xl shrink-0">⚠️</span>
          <div>
            <p className="font-semibold text-sm">Failed to load projects</p>
            <p className="text-xs mt-0.5 text-danger-300">{error}</p>
          </div>
        </div>
      )}

      {/* Status filter tabs */}
      {!error && (
        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_TABS.map((tab) => {
            const count = stats
              ? tab.value === "all"
                ? stats.projects.length
                : stats.projects.filter((p) => p.status === tab.value).length
              : 0;
            return (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  filter === tab.value
                    ? "bg-primary-500/20 text-primary-300 border border-primary-500/30"
                    : "text-surface-400 border border-surface-700/50 hover:border-surface-600"
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className="ml-1.5 opacity-60">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Projects grid */}
      {!error && (
        <>
          {filteredProjects.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <span className="text-5xl mb-4 block">📁</span>
              <p className="text-surface-300 font-semibold text-lg">
                {filter === "all" ? "No projects yet" : `No ${formatStatusLabel(filter)} projects`}
              </p>
              <p className="text-surface-500 text-sm mt-2">
                {filter === "all"
                  ? "Projects assigned to you will appear here."
                  : `You have no projects with "${formatStatusLabel(filter)}" status.`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onStatusChange={handleStatusChange}
                  onViewHistory={setHistoryProject}
                />
              ))}
            </div>
          )}
        </>
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
