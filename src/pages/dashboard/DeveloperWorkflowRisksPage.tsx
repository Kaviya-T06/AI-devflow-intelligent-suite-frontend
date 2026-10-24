/**
 * Developer Workflow Risks Page — personal risk workspace.
 * Shows risks tied to the developer's own tasks.
 * Supports progress updates, blocker escalation, and guided corrective actions.
 *
 * Does NOT expose org-wide or other users' information (enforced on backend).
 */
import { useEffect, useState, useMemo } from "react";
import { fetchMyRisks } from "../../services/pmService";
import type { WorkflowRisk, RiskSeverity } from "../../types";
import RiskDetailModal from "../../components/risks/RiskDetailModal";
import { useAuth } from "../../context/AuthContext";

const SEVERITY_COLORS: Record<RiskSeverity, string> = {
  Low:      "bg-surface-700/40 text-surface-400 border-surface-600/30",
  Medium:   "bg-warning-500/15 text-warning-300 border-warning-500/20",
  High:     "bg-orange-500/15 text-orange-300 border-orange-500/20",
  Critical: "bg-danger-500/15 text-danger-300 border-danger-500/20",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN:        "bg-danger-500/15 text-danger-300 border-danger-500/20",
  IN_PROGRESS: "bg-primary-500/15 text-primary-300 border-primary-500/20",
  RESOLVED:    "bg-success-500/15 text-success-300 border-success-500/20",
  REOPENED:    "bg-warning-500/15 text-warning-300 border-warning-500/20",
};

const RISK_TYPE_LABELS: Record<string, string> = {
  STUCK_TASK:    "Stuck Task",
  REVIEW_DELAY:  "Review Delay",
  OVERDUE_TASK:  "Overdue Task",
  WORKLOAD_RISK: "High Workload",
  PROJECT_DELAY: "Project Delay",
};

const RISK_TYPE_ICONS: Record<string, string> = {
  STUCK_TASK:    "⏸",
  REVIEW_DELAY:  "🔄",
  OVERDUE_TASK:  "⏰",
  WORKLOAD_RISK: "⚡",
  PROJECT_DELAY: "📅",
};

const RISK_TYPE_ADVICE: Record<string, string> = {
  STUCK_TASK:    "This task has been in progress longer than expected. Add an update or flag a blocker to get unblocked.",
  REVIEW_DELAY:  "Your submission is awaiting review. Add a follow-up comment or check with your reviewer.",
  OVERDUE_TASK:  "This task has passed its due date. Add a progress update and let your PM know the expected completion.",
  WORKLOAD_RISK: "You have many active tasks. Consider discussing priorities with your Project Manager.",
  PROJECT_DELAY: "The project has missed its target deadline. Coordinate with your PM on the path forward.",
};

export default function DeveloperWorkflowRisksPage() {
  const { profile } = useAuth();

  const [risks, setRisks]     = useState<WorkflowRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("OPEN");
  const [selectedRiskId, setSelectedRiskId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchMyRisks();
      setRisks(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load workflow risks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() =>
    risks.filter((r) => statusFilter === "All" || r.status === statusFilter),
    [risks, statusFilter]
  );

  const openCount       = risks.filter(r => r.status === "OPEN" || r.status === "REOPENED").length;
  const inProgressCount = risks.filter(r => r.status === "IN_PROGRESS").length;
  const resolvedCount   = risks.filter(r => r.is_resolved).length;
  const blockerCount    = risks.filter(r => r.comments.some(c => c.is_blocker) && !r.is_resolved).length;

  const handleUpdated = (updated: WorkflowRisk) => {
    setRisks(prev => prev.map(r => r.id === updated.id ? updated : r));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-surface-50">My Workflow Conditions</h2>
          <p className="text-surface-400 text-sm mt-1">
            {openCount > 0
              ? `${openCount} active condition${openCount !== 1 ? "s" : ""} on your tasks — action required`
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

      {/* Summary mini-cards */}
      {risks.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Active",      value: openCount,       color: openCount > 0 ? "text-danger-300" : "text-success-300" },
            { label: "In Progress", value: inProgressCount, color: "text-primary-300" },
            { label: "Resolved",    value: resolvedCount,   color: "text-success-300" },
            { label: "Blockers",    value: blockerCount,    color: blockerCount > 0 ? "text-danger-300" : "text-surface-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass-card p-3">
              <p className="text-surface-500 text-xs uppercase tracking-wider">{label}</p>
              <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {["OPEN", "IN_PROGRESS", "RESOLVED", "All"].map((s) => {
          const count = s === "OPEN"
            ? openCount
            : s === "IN_PROGRESS" ? inProgressCount
            : s === "RESOLVED" ? resolvedCount
            : risks.length;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${
                statusFilter === s
                  ? "bg-primary-500/20 text-primary-300 border border-primary-500/30"
                  : "text-surface-400 hover:text-surface-300"
              }`}
            >
              {s === "All" ? "All" : s.replace("_", " ").charAt(0) + s.replace("_", " ").slice(1).toLowerCase()}
              {count > 0 && (
                <span className={`ml-2 text-xs px-1.5 rounded-full ${
                  s === "OPEN" && count > 0 ? "bg-danger-500/20 text-danger-300"
                    : "bg-surface-700/60 text-surface-400"
                }`}>{count}</span>
              )}
            </button>
          );
        })}
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
            {statusFilter === "OPEN" ? "All clear! 🎉" : "No conditions found"}
          </p>
          <p className="text-sm mt-2">
            {statusFilter === "OPEN"
              ? "No active workflow conditions on your tasks right now."
              : "Switch to 'Open' to see active conditions."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((risk) => (
            <div
              key={risk.id}
              onClick={() => setSelectedRiskId(risk.id)}
              className={`glass-card p-5 border-l-4 cursor-pointer hover:bg-surface-800/50 transition-colors ${
                risk.severity === "Critical" ? "border-l-danger-600"
                  : risk.severity === "High"   ? "border-l-danger-500"
                  : risk.severity === "Medium" ? "border-l-warning-500"
                  : "border-l-surface-600"
              }`}
            >
              <div className="flex items-start gap-4">
                <span className="text-2xl mt-0.5 shrink-0">{RISK_TYPE_ICONS[risk.risk_type] ?? "⚠"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="text-surface-100 font-semibold">
                      {RISK_TYPE_LABELS[risk.risk_type] ?? risk.risk_type}
                    </h3>
                    <span className={`badge ${SEVERITY_COLORS[risk.severity] ?? "bg-surface-700 text-surface-400"}`}>
                      {risk.severity}
                    </span>
                    <span className={`badge ${STATUS_COLORS[risk.status] ?? "bg-surface-700 text-surface-400"} text-xs`}>
                      {risk.status.replace("_", " ")}
                    </span>
                    {risk.is_escalated && <span className="badge bg-orange-500/20 text-orange-300 border-orange-500/30 text-xs">🔺 Escalated</span>}
                    {risk.is_action_overdue && <span className="badge bg-danger-500/20 text-danger-300 border-danger-500/30 text-xs">⏰ Action Overdue</span>}
                  </div>

                  <p className="text-surface-300 text-sm">{risk.description}</p>

                  {/* Guided advice for open conditions */}
                  {(risk.status === "OPEN" || risk.status === "REOPENED") && RISK_TYPE_ADVICE[risk.risk_type] && (
                    <div className="mt-2 p-3 bg-primary-500/5 border border-primary-500/15 rounded-lg">
                      <p className="text-surface-400 text-xs">
                        💡 <strong className="text-primary-300">Suggested action:</strong> {RISK_TYPE_ADVICE[risk.risk_type]}
                      </p>
                    </div>
                  )}

                  {/* Action plan if set */}
                  {risk.corrective_action_plan && (
                    <div className="mt-2 p-3 bg-surface-800/60 border border-surface-700/30 rounded-lg">
                      <p className="text-surface-500 text-xs font-semibold uppercase mb-1">Your Action Plan</p>
                      <p className="text-surface-300 text-sm">{risk.corrective_action_plan}</p>
                      {risk.recovery_deadline && (
                        <p className={`text-xs mt-1 ${risk.is_action_overdue ? "text-danger-400" : "text-surface-500"}`}>
                          🎯 Recovery target: {new Date(risk.recovery_deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          {risk.is_action_overdue && " — OVERDUE"}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Quick info row */}
                  <div className="flex flex-wrap gap-4 mt-3 text-xs text-surface-500">
                    {risk.task_title && (
                      <span>📌 {risk.task_title}
                        {risk.overdue_duration_days && (
                          <span className="text-danger-400 ml-1">· {risk.overdue_duration_days}d overdue</span>
                        )}
                      </span>
                    )}
                    {risk.project_name && <span>📁 {risk.project_name}</span>}
                    <span>Detected: {new Date(risk.detected_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    {risk.comments_count > 0 && <span>💬 {risk.comments_count} comment{risk.comments_count !== 1 ? "s" : ""}</span>}
                    {risk.github_pr_url && <span>🔗 PR linked</span>}
                  </div>
                </div>

                <div className="shrink-0 flex flex-col gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedRiskId(risk.id); }}
                    className={`btn-secondary text-xs px-4 py-1.5 whitespace-nowrap ${
                      risk.status === "OPEN" || risk.status === "REOPENED"
                        ? "border-primary-500/30 text-primary-300"
                        : ""
                    }`}
                  >
                    {risk.is_resolved ? "View Details" : "Take Action →"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && risks.length > 0 && (
        <div className="flex justify-between items-center">
          <p className="text-surface-600 text-xs">
            Click any condition to add updates, flag blockers, or escalate to your PM
          </p>
          <p className="text-surface-600 text-xs">
            Showing {filtered.length} of {risks.length} conditions
          </p>
        </div>
      )}

      {/* Detail Modal */}
      {selectedRiskId && profile && (
        <RiskDetailModal
          riskId={selectedRiskId}
          userRole="DEVELOPER"
          userId={profile.id}
          onClose={() => setSelectedRiskId(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
