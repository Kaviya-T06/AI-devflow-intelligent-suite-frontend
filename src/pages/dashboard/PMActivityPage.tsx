/**
 * PMActivityPage — Project activity feed for Project Manager role.
 * Shows recent activity for all managed projects and their tasks.
 * Filters by entity type, shows relative timestamps.
 */
import { useEffect, useState, useCallback } from "react";
import { fetchPMActivity } from "../../services/pmService";
import type { PMActivityItem } from "../../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ActivityFilter = "all" | "task" | "project";

const ACTION_ICONS: Record<string, string> = {
  TASK_CREATED:              "✅",
  TASK_STARTED:              "🚀",
  TASK_SUBMITTED_FOR_REVIEW: "👀",
  TASK_COMPLETED:            "🎯",
  TASK_ASSIGNED:             "👤",
  TASK_UPDATED:              "✏️",
  TASK_DELETED:              "🗑️",
  TASK_REASSIGNED:           "🔁",
  TASK_STATUS_CHANGED:       "🔄",
  PROJECT_CREATED:           "📁",
  PROJECT_UPDATED:           "📝",
  PROJECT_STATUS_CHANGED:    "🔄",
  PROJECT_PROGRESS_UPDATED:  "📊",
  PROJECT_MANAGER_CHANGED:   "👔",
  PROJECT_DATES_UPDATED:     "🗓️",
  PROJECT_ARCHIVED:          "📦",
};

function getActionIcon(action: string): string {
  return ACTION_ICONS[action] ?? "📋";
}

function getActionColor(action: string): string {
  if (action.startsWith("TASK_COMPLETED")) return "border-success-500/20 bg-success-500/5";
  if (action.startsWith("TASK_STARTED")) return "border-primary-500/20 bg-primary-500/5";
  if (action.startsWith("TASK_SUBMITTED")) return "border-warning-500/20 bg-warning-500/5";
  if (action.startsWith("TASK_DELETED")) return "border-danger-500/20 bg-danger-500/5";
  if (action.startsWith("PROJECT")) return "border-accent-500/20 bg-accent-500/5";
  return "border-surface-700/30 bg-surface-800/30";
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return "—";
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function isTaskAction(action: string): boolean {
  return action.startsWith("TASK_");
}

function isProjectAction(action: string): boolean {
  return action.startsWith("PROJECT_");
}

function formatAction(action: string): string {
  return action
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Activity Item Component
// ---------------------------------------------------------------------------

function ActivityItemRow({ item }: { item: PMActivityItem }) {
  const icon = getActionIcon(item.action);
  const colorClass = getActionColor(item.action);

  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border ${colorClass} transition-colors`}>
      <div className="text-xl shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-surface-200 text-sm leading-snug">{item.description}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {item.user_name && (
            <span className="text-surface-500 text-xs flex items-center gap-1">
              <span>by</span>
              <span className="text-surface-400 font-medium">{item.user_name}</span>
            </span>
          )}
          <span className="text-surface-600 text-xs">·</span>
          <span className="text-surface-500 text-xs">{relativeTime(item.created_at)}</span>
          <span className="text-surface-600 text-xs">·</span>
          <span className="text-surface-600 text-[10px] uppercase tracking-wider">
            {formatAction(item.action)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function PMActivityPage() {
  const [activity, setActivity] = useState<PMActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const loadActivity = useCallback(async () => {
    try {
      const data = await fetchPMActivity(60);
      setActivity(data);
      setError(null);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  const filteredActivity = activity.filter((item) => {
    if (filter === "all") return true;
    if (filter === "task") return isTaskAction(item.action);
    if (filter === "project") return isProjectAction(item.action);
    return true;
  });

  const FILTER_TABS: { label: string; value: ActivityFilter; count: number }[] = [
    { label: "All", value: "all", count: activity.length },
    { label: "Task", value: "task", count: activity.filter((a) => isTaskAction(a.action)).length },
    { label: "Project", value: "project", count: activity.filter((a) => isProjectAction(a.action)).length },
  ];

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-48 bg-surface-800 rounded animate-pulse" />
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 w-20 bg-surface-800 rounded-full animate-pulse" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 p-4 glass-card animate-pulse">
              <div className="w-8 h-8 bg-surface-700/60 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-surface-700/60 rounded w-3/4" />
                <div className="h-2.5 bg-surface-700/60 rounded w-1/4" />
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
          <h2 className="text-2xl font-bold text-surface-50">Project Activity</h2>
          <p className="text-surface-400 text-sm mt-1">
            Recent activity for your managed projects and team tasks.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-surface-600 text-xs hidden sm:block">
            Updated {relativeTime(lastRefreshed.toISOString())}
          </span>
          <button
            onClick={() => { setLoading(true); loadActivity(); }}
            className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-primary-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-danger-500/10 border border-danger-500/20 text-danger-400 p-4 rounded-lg flex items-start gap-3">
          <span className="text-xl shrink-0">⚠️</span>
          <div>
            <p className="font-semibold text-sm">Failed to load activity</p>
            <p className="text-xs mt-0.5 text-danger-300">{error}</p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      {!error && (
        <div className="flex items-center gap-2">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                filter === tab.value
                  ? "bg-primary-500/20 text-primary-300 border-primary-500/30"
                  : "text-surface-400 border-surface-700/50 hover:border-surface-600"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1.5 opacity-60">{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Activity list */}
      {!error && (
        <>
          {filteredActivity.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <span className="text-5xl mb-4 block">📋</span>
              <p className="text-surface-300 font-semibold text-lg">No activity yet</p>
              <p className="text-surface-500 text-sm mt-2">
                {filter === "all"
                  ? "Activity from your projects and team tasks will appear here."
                  : `No ${filter} activity recorded yet.`}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredActivity.map((item) => (
                <ActivityItemRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
