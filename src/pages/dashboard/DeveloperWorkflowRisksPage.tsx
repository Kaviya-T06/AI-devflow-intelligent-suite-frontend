/**
 * Developer Workflow Risks Page — shows risks relevant to the developer's own tasks.
 * Only shows workflow conditions that affect the developer's assigned work.
 * Does NOT expose org-wide risk information.
 */
import { useEffect, useState, useMemo } from "react";
import { fetchMyRisks } from "../../services/pmService";
import type { WorkflowRisk, RiskSeverity } from "../../types";

const SEVERITY_COLORS: Record<RiskSeverity, string> = {
  Low:      "bg-surface-700/40 text-surface-400 border-surface-600/30",
  Medium:   "bg-warning-500/15 text-warning-300 border-warning-500/20",
  High:     "bg-orange-500/15 text-orange-300 border-orange-500/20",
  Critical: "bg-danger-500/15 text-danger-300 border-danger-500/20",
};

const RISK_TYPE_LABELS: Record<string, string> = {
  STUCK_TASK:    "Stuck Task",
  REVIEW_DELAY:  "Review Delay",
  OVERDUE_TASK:  "Overdue Task",
  WORKLOAD_RISK: "High Workload",
};

const RISK_TYPE_ICONS: Record<string, string> = {
  STUCK_TASK:    "⏸",
  REVIEW_DELAY:  "🔄",
  OVERDUE_TASK:  "⏰",
  WORKLOAD_RISK: "⚡",
};

const RISK_TYPE_ADVICE: Record<string, string> = {
  STUCK_TASK:    "This task has been in progress for a long time. Consider reaching out to your team lead.",
  REVIEW_DELAY:  "This task is waiting for review. Consider following up with your reviewer.",
  OVERDUE_TASK:  "This task has passed its due date. Update your team on the status.",
  WORKLOAD_RISK: "You have many active tasks. Consider prioritizing or discussing with your manager.",
};

export default function DeveloperWorkflowRisksPage() {
  const [risks, setRisks]     = useState<WorkflowRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("OPEN");

  const load = () => {
    setLoading(true);
    setError(null);
    fetchMyRisks()
      .then(setRisks)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load workflow risks"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    return risks.filter((r) =>
      statusFilter === "All" || r.status === statusFilter
    );
  }, [risks, statusFilter]);

  const openCount  = risks.filter((r) => r.status === "OPEN").length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-surface-50">My Workflow Conditions</h2>
          <p className="text-surface-400 text-sm mt-1">
            {openCount > 0
              ? `${openCount} active condition${openCount !== 1 ? "s" : ""} detected on your tasks`
              : "No active conditions on your tasks"}
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 self-start">
          <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2">
        {["OPEN", "RESOLVED", "All"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${
              statusFilter === s
                ? "bg-primary-500/20 text-primary-300 border border-primary-500/30"
                : "text-surface-400 hover:text-surface-300"
            }`}
          >
            {s === "All" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            {s === "OPEN" && openCount > 0 && (
              <span className="ml-2 bg-danger-500/20 text-danger-300 text-xs px-1.5 rounded-full">
                {openCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="glass-card p-4 border-danger-500/30 bg-danger-500/10">
          <p className="text-danger-300 text-sm">⚠ {error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card text-center py-16 text-surface-400">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xl font-medium text-surface-300">
            {statusFilter === "OPEN" ? "All clear!" : "No conditions found"}
          </p>
          <p className="text-sm mt-2">
            {statusFilter === "OPEN"
              ? "No workflow conditions detected on your tasks right now."
              : "Try switching to 'Open' to see active conditions."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((risk) => (
            <div key={risk.id} className={`glass-card p-5 border-l-4 ${
              risk.severity === "High" || risk.severity === "Critical"
                ? "border-l-danger-500"
                : risk.severity === "Medium"
                ? "border-l-warning-500"
                : "border-l-surface-600"
            }`}>
              <div className="flex items-start gap-4">
                <span className="text-2xl mt-0.5">{RISK_TYPE_ICONS[risk.risk_type] ?? "⚠"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="text-surface-100 font-semibold">
                      {RISK_TYPE_LABELS[risk.risk_type] ?? risk.risk_type}
                    </h3>
                    <span className={`badge ${SEVERITY_COLORS[risk.severity] ?? "bg-surface-700 text-surface-400"}`}>
                      {risk.severity}
                    </span>
                    <span className={`badge text-xs ${
                      risk.status === "OPEN"
                        ? "bg-danger-500/15 text-danger-300 border-danger-500/20"
                        : "bg-success-500/15 text-success-300 border-success-500/20"
                    }`}>
                      {risk.status}
                    </span>
                  </div>
                  <p className="text-surface-300 text-sm">{risk.description}</p>
                  {risk.status === "OPEN" && RISK_TYPE_ADVICE[risk.risk_type] && (
                    <p className="text-surface-500 text-xs mt-2 italic">
                      💡 {RISK_TYPE_ADVICE[risk.risk_type]}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-surface-500 flex-wrap">
                    {risk.task_id && (
                      <span className="font-mono">Task: {risk.task_id.slice(0, 8)}…</span>
                    )}
                    <span>Detected: {new Date(risk.detected_at).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric"
                    })}</span>
                    {risk.resolved_at && (
                      <span className="text-success-400">
                        Resolved: {new Date(risk.resolved_at).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric"
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && risks.length > 0 && (
        <p className="text-surface-600 text-xs text-right">
          Showing {filtered.length} of {risks.length} conditions
        </p>
      )}
    </div>
  );
}
