/**
 * Admin Activity Logs Page — searchable and filterable platform activity feed.
 */
import { useEffect, useState, useMemo } from "react";
import { fetchRecentActivity } from "../../services/adminService";
import type { ActivityLog } from "../../types";

const ENTITY_ICONS: Record<string, string> = {
  user: "👤", project: "📁", task: "✅", risk: "⚠️", repository: "📦",
  settings: "⚙️", default: "📋",
};

const ACTION_COLORS: Record<string, string> = {
  created: "text-success-400",
  updated: "text-primary-400",
  deleted: "text-danger-400",
  assigned: "text-accent-400",
  completed: "text-success-400",
  activated: "text-success-400",
  deactivated: "text-warning-400",
  resolved: "text-success-400",
  blocked: "text-danger-400",
  default: "text-surface-400",
};

function getActionColor(action: string): string {
  for (const [key, color] of Object.entries(ACTION_COLORS)) {
    if (action.toLowerCase().includes(key)) return color;
  }
  return ACTION_COLORS.default;
}

const ENTITY_TYPES = ["user", "project", "task", "risk", "repository", "settings"];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function AdminActivityLogsPage() {
  const [logs, setLogs]         = useState<ActivityLog[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState("");
  const [entityFilter, setEntityFilter] = useState("All");
  const [actionFilter, setActionFilter] = useState("All");
  const [showLimit, setShowLimit] = useState(20);

  useEffect(() => {
    fetchRecentActivity(50)
      .then(setLogs)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      const matchSearch = !search ||
        log.description.toLowerCase().includes(search.toLowerCase()) ||
        log.action.toLowerCase().includes(search.toLowerCase()) ||
        (log.user as { full_name?: string } | null)?.full_name?.toLowerCase().includes(search.toLowerCase());
      const matchEntity = entityFilter === "All" || log.entity_type.toLowerCase() === entityFilter;
      const matchAction = actionFilter === "All" || log.action.toLowerCase() === actionFilter;
      return matchSearch && matchEntity && matchAction;
    });
  }, [logs, search, entityFilter, actionFilter]);

  const visible = filtered.slice(0, showLimit);
  const uniqueActions = Array.from(new Set(logs.map((l) => l.action.toLowerCase())));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-surface-50">Activity Logs</h2>
          <p className="text-surface-400 text-sm mt-1">{logs.length} events recorded</p>
        </div>
        <span className="badge-admin">Admin Panel</span>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col sm:flex-row gap-3">
        <input
          type="text" placeholder="Search by description, action, or user…"
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="input flex-1" id="activity-search"
        />
        <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className="input sm:w-44" id="activity-entity-filter">
          <option value="All">All Entities</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="input sm:w-44" id="activity-action-filter">
          <option value="All">All Actions</option>
          {uniqueActions.map((a) => (
            <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>
          ))}
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
          <p className="text-lg font-medium">No activity found</p>
          <p className="text-sm mt-1">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <>
          <div className="glass-card overflow-hidden">
            <div className="divide-y divide-surface-700/30">
              {visible.map((log) => (
                <div key={log.id} className="flex items-start gap-4 px-6 py-4 hover:bg-surface-800/40 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-surface-700/60 flex items-center justify-center text-base shrink-0 mt-0.5">
                    {ENTITY_ICONS[log.entity_type.toLowerCase()] ?? ENTITY_ICONS.default}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-surface-200 text-sm">{log.description}</p>
                    <div className="flex items-center flex-wrap gap-2 mt-1">
                      <span className={`text-xs font-medium ${getActionColor(log.action)}`}>{log.action}</span>
                      <span className="text-surface-600 text-xs">·</span>
                      <span className="text-surface-500 text-xs capitalize">{log.entity_type}</span>
                      {(log.user as { full_name?: string } | null)?.full_name && (
                        <>
                          <span className="text-surface-600 text-xs">·</span>
                          <span className="text-surface-500 text-xs">
                            {(log.user as { full_name: string }).full_name}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-surface-600 text-xs block">{timeAgo(log.created_at)}</span>
                    <span className="text-surface-700 text-xs block mt-0.5">
                      {new Date(log.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {filtered.length > showLimit && (
            <div className="text-center">
              <button
                onClick={() => setShowLimit((n) => n + 20)}
                className="btn-ghost text-sm border border-surface-700/50"
                id="activity-load-more"
              >
                Load more ({filtered.length - showLimit} remaining)
              </button>
            </div>
          )}

          <p className="text-surface-600 text-xs text-right">
            Showing {Math.min(visible.length, filtered.length)} of {filtered.length} events
          </p>
        </>
      )}
    </div>
  );
}
