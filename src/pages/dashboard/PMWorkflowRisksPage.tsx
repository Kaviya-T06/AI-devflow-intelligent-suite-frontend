/**
 * PM Workflow Risks Page — project-scoped risk management for Project Managers.
 * Full investigation, corrective action, escalation, resolution, and audit history.
 *
 * All data is scoped to the PM's managed projects by the backend RBAC layer.
 */
import { useEffect, useState, useMemo } from "react";
import {
  fetchPMRisks,
  fetchRiskMetrics,
} from "../../services/pmService";
import type { WorkflowRisk, RiskSeverity, WorkflowRiskMetrics } from "../../types";
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
  PROJECT_DELAY: "Project Delay",
  WORKLOAD_RISK: "Workload Risk",
};

const RISK_TYPE_ICONS: Record<string, string> = {
  STUCK_TASK:    "⏸",
  REVIEW_DELAY:  "🔄",
  OVERDUE_TASK:  "⏰",
  PROJECT_DELAY: "📅",
  WORKLOAD_RISK: "⚡",
};

const SEVERITIES: RiskSeverity[] = ["Low", "Medium", "High", "Critical"];
const RISK_TYPES = ["STUCK_TASK", "REVIEW_DELAY", "OVERDUE_TASK", "PROJECT_DELAY", "WORKLOAD_RISK"];
const STATUSES   = ["OPEN", "IN_PROGRESS", "RESOLVED", "REOPENED"];

export default function PMWorkflowRisksPage() {
  const { profile } = useAuth();

  const [risks, setRisks]       = useState<WorkflowRisk[]>([]);
  const [metrics, setMetrics]   = useState<WorkflowRiskMetrics | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const [search, setSearch]             = useState("");
  const [sevFilter, setSevFilter]       = useState("All");
  const [statusFilter, setStatusFilter] = useState("OPEN");
  const [riskTypeFilter, setRiskTypeFilter] = useState("All");
  const [escalatedOnly, setEscalatedOnly] = useState(false);

  const [selectedRiskId, setSelectedRiskId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, m] = await Promise.all([
        fetchPMRisks(),
        fetchRiskMetrics().catch(() => null),
      ]);
      setRisks(r);
      if (m) setMetrics(m);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load workflow risks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return risks.filter((r) => {
      const matchSearch = !search ||
        r.risk_type.toLowerCase().includes(search.toLowerCase()) ||
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.description.toLowerCase().includes(search.toLowerCase()) ||
        (r.task_title ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (r.assignee_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (r.project_name ?? "").toLowerCase().includes(search.toLowerCase());
      const matchSev    = sevFilter === "All" || r.severity === sevFilter;
      const matchStatus = statusFilter === "All" || r.status === statusFilter;
      const matchType   = riskTypeFilter === "All" || r.risk_type === riskTypeFilter;
      const matchEsc    = !escalatedOnly || r.is_escalated;
      return matchSearch && matchSev && matchStatus && matchType && matchEsc;
    });
  }, [risks, search, sevFilter, statusFilter, riskTypeFilter, escalatedOnly]);

  // Metrics
  const m = metrics ?? {
    open_risks:          risks.filter(r => r.status === "OPEN").length,
    in_progress_risks:   risks.filter(r => r.status === "IN_PROGRESS").length,
    high_count:          risks.filter(r => r.severity === "High" && !r.is_resolved).length,
    critical_count:      risks.filter(r => r.severity === "Critical" && !r.is_resolved).length,
    overdue_tasks_count: risks.filter(r => r.risk_type === "OVERDUE_TASK" && !r.is_resolved).length,
    stuck_tasks_count:   risks.filter(r => r.risk_type === "STUCK_TASK" && !r.is_resolved).length,
    review_delays_count: risks.filter(r => r.risk_type === "REVIEW_DELAY" && !r.is_resolved).length,
    project_delays_count:risks.filter(r => r.risk_type === "PROJECT_DELAY" && !r.is_resolved).length,
    overdue_actions_count:risks.filter(r => r.is_action_overdue && !r.is_resolved).length,
    escalated_count:     risks.filter(r => r.is_escalated && !r.is_resolved).length,
    resolved_risks:      risks.filter(r => r.is_resolved).length,
    recurring_count:     risks.filter(r => r.is_recurring).length,
    total_risks: risks.length, medium_count: 0, low_count: 0, reopened_risks: 0, workload_risks_count: 0,
  };

  const handleUpdated = (updated: WorkflowRisk) => {
    setRisks(prev => prev.map(r => r.id === updated.id ? updated : r));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-surface-50">Workflow Risks</h2>
          <p className="text-surface-400 text-sm mt-1">
            {m.open_risks} open · {m.in_progress_risks} in-progress · {m.escalated_count} escalated in your managed projects
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge border border-primary-500/30 bg-primary-500/10 text-primary-300">Project Manager</span>
          <button onClick={load} disabled={loading}
            className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Metrics cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {[
          { label: "Open",           value: m.open_risks,          color: "text-danger-300",  icon: "🚨" },
          { label: "In Progress",    value: m.in_progress_risks,   color: "text-primary-300", icon: "▶" },
          { label: "High / Critical",value: m.high_count + m.critical_count, color: "text-orange-300", icon: "🔴" },
          { label: "Escalated",      value: m.escalated_count,     color: "text-danger-300",  icon: "🔺" },
          { label: "Overdue Tasks",  value: m.overdue_tasks_count, color: "text-danger-300",  icon: "⏰" },
          { label: "Stuck Tasks",    value: m.stuck_tasks_count,   color: "text-orange-300",  icon: "⏸" },
          { label: "Review Delays",  value: m.review_delays_count, color: "text-warning-300", icon: "🔄" },
          { label: "Overdue Actions",value: m.overdue_actions_count,color: "text-danger-300", icon: "📋" },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="glass-card p-3 sm:p-3.5 flex flex-col justify-between min-w-0 h-full">
            <div className="flex items-start gap-1.5 min-w-0 mb-1.5">
              <span className="text-sm shrink-0 leading-none mt-0.5" aria-hidden="true">{icon}</span>
              <p className="text-surface-400 text-xs uppercase tracking-wider leading-tight min-w-0 break-words flex-1 font-medium">{label}</p>
            </div>
            <p className={`text-xl sm:text-2xl font-bold ${color} leading-none mt-auto`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col sm:flex-row flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search risks, tasks, or assignees…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input flex-1 min-w-40"
          id="pm-risks-search"
        />
        <select value={riskTypeFilter} onChange={(e) => setRiskTypeFilter(e.target.value)} className="input sm:w-44" id="pm-risks-type-filter">
          <option value="All">All Risk Types</option>
          {RISK_TYPES.map((t) => <option key={t} value={t}>{RISK_TYPE_LABELS[t] ?? t}</option>)}
        </select>
        <select value={sevFilter} onChange={(e) => setSevFilter(e.target.value)} className="input sm:w-36" id="pm-risks-sev-filter">
          <option value="All">All Severities</option>
          {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input sm:w-36" id="pm-risks-status-filter">
          <option value="All">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={escalatedOnly} onChange={e => setEscalatedOnly(e.target.checked)} className="w-4 h-4" />
          <span className="text-sm text-surface-400">Escalated only</span>
        </label>
      </div>

      {error && (
        <div className="glass-card p-4 border-danger-500/30 bg-danger-500/10">
          <p className="text-danger-300 text-sm">⚠ {error}</p>
        </div>
      )}

      {/* Risk cards list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card text-center py-16 text-surface-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-lg font-medium">
            {statusFilter === "OPEN" ? "No open risks in your projects" : "No risks match your filters"}
          </p>
          <p className="text-sm mt-1">
            {statusFilter === "OPEN" ? "Your projects are running smoothly." : "Try adjusting filters."}
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
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-lg">{RISK_TYPE_ICONS[risk.risk_type] ?? "⚠"}</span>
                    <span className="text-xs font-mono text-primary-300 bg-primary-500/10 px-2 py-0.5 rounded">
                      {RISK_TYPE_LABELS[risk.risk_type] ?? risk.risk_type}
                    </span>
                    <span className={`badge ${SEVERITY_COLORS[risk.severity] ?? "bg-surface-700 text-surface-400"}`}>{risk.severity}</span>
                    <span className={`badge ${STATUS_COLORS[risk.status] ?? "bg-surface-700 text-surface-400"}`}>{risk.status.replace("_", " ")}</span>
                    {risk.is_escalated && <span className="badge bg-danger-500/20 text-danger-300 border-danger-500/30 text-xs">🔺 Escalated</span>}
                    {risk.is_recurring  && <span className="badge bg-purple-500/15 text-purple-300 border-purple-500/20 text-xs">🔁 Recurring</span>}
                    {risk.is_action_overdue && <span className="badge bg-danger-500/20 text-danger-300 border-danger-500/30 text-xs">⏰ Action Overdue</span>}
                  </div>
                  <h3 className="text-surface-100 font-semibold text-base">{risk.title}</h3>
                  <p className="text-surface-400 text-sm mt-1 line-clamp-2">{risk.description}</p>

                  {/* Investigation snapshot */}
                  <div className="flex flex-wrap gap-4 mt-3 text-xs text-surface-500">
                    {risk.project_name && <span>📁 {risk.project_name}</span>}
                    {risk.task_title && (
                      <span>
                        📌 {risk.task_title}
                        {risk.assignee_name && <span className="text-surface-600"> · {risk.assignee_name}</span>}
                      </span>
                    )}
                    {risk.overdue_duration_days && (
                      <span className="text-danger-400">⏰ {risk.overdue_duration_days}d overdue</span>
                    )}
                    {risk.corrective_action_plan && (
                      <span className="text-primary-400">📋 Action plan set</span>
                    )}
                    {risk.recovery_deadline && (
                      <span className={risk.is_action_overdue ? "text-danger-400" : "text-surface-400"}>
                        🎯 Due {new Date(risk.recovery_deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                    <span>Detected: {new Date(risk.detected_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    {risk.resolved_at && (
                      <span className="text-success-400">Resolved: {new Date(risk.resolved_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    )}
                    {risk.comments_count > 0 && <span>💬 {risk.comments_count}</span>}
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:items-end shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedRiskId(risk.id); }}
                    className="btn-secondary text-xs px-4 py-1.5 whitespace-nowrap"
                  >
                    {risk.is_resolved ? "View History" : "Manage →"}
                  </button>
                  {risk.owner_name && (
                    <span className="text-surface-500 text-xs">👤 {risk.owner_name}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <div className="flex justify-between items-center">
          <p className="text-surface-600 text-xs">
            Click any risk to investigate, assign actions, escalate, or resolve
          </p>
          <p className="text-surface-600 text-xs">
            Showing {filtered.length} of {risks.length} risks
          </p>
        </div>
      )}

      {/* Detail Modal */}
      {selectedRiskId && profile && (
        <RiskDetailModal
          riskId={selectedRiskId}
          userRole="MANAGER"
          userId={profile.id}
          onClose={() => setSelectedRiskId(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
