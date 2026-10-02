/**
 * PM Workflow Risks Page — shows risks scoped to the PM's managed projects.
 * Risks are auto-detected by the backend and auto-resolved when conditions clear.
 */
import { useEffect, useState, useMemo } from "react";
import { fetchPMRisks } from "../../services/pmService";
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

export default function PMWorkflowRisksPage() {
  const [risks, setRisks]           = useState<WorkflowRisk[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [search, setSearch]         = useState("");
  const [sevFilter, setSevFilter]   = useState("All");
  const [statusFilter, setStatusFilter] = useState("OPEN");  // default: show open
  const [riskTypeFilter, setRiskTypeFilter] = useState("All");

  const load = () => {
    setLoading(true);
    setError(null);
    fetchPMRisks()
      .then(setRisks)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load workflow risks"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    return risks.filter((r) => {
      const matchSearch = !search ||
        r.risk_type.toLowerCase().includes(search.toLowerCase()) ||
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.description.toLowerCase().includes(search.toLowerCase()) ||
        (r.project_name ?? "").toLowerCase().includes(search.toLowerCase());
      const matchSev    = sevFilter === "All" || r.severity === sevFilter;
      const matchStatus = statusFilter === "All" || r.status === statusFilter;
      const matchType   = riskTypeFilter === "All" || r.risk_type === riskTypeFilter;
      return matchSearch && matchSev && matchStatus && matchType;
    });
  }, [risks, search, sevFilter, statusFilter, riskTypeFilter]);

  const openRisks    = risks.filter((r) => r.status === "OPEN").length;
  const highRisks    = risks.filter((r) => r.severity === "High" && r.status === "OPEN").length;
  const overdueCount = risks.filter((r) => r.risk_type === "OVERDUE_TASK" && r.status === "OPEN").length;
  const stuckCount   = risks.filter((r) => r.risk_type === "STUCK_TASK" && r.status === "OPEN").length;
  const reviewCount  = risks.filter((r) => r.risk_type === "REVIEW_DELAY" && r.status === "OPEN").length;
  const projectDelayCount = risks.filter((r) => r.risk_type === "PROJECT_DELAY" && r.status === "OPEN").length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-surface-50">Workflow Risks</h2>
          <p className="text-surface-400 text-sm mt-1">
            {openRisks} open risk{openRisks !== 1 ? "s" : ""} in your managed projects
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge border border-primary-500/30 bg-primary-500/10 text-primary-300">
            Project Manager
          </span>
          <button onClick={load} disabled={loading}
            className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Open Risks",       value: openRisks,         color: "text-danger-300",  icon: "🚨" },
          { label: "High Severity",    value: highRisks,         color: "text-orange-300",  icon: "🔴" },
          { label: "Overdue Tasks",    value: overdueCount,      color: "text-danger-300",  icon: "⏰" },
          { label: "Stuck Tasks",      value: stuckCount,        color: "text-orange-300",  icon: "⏸" },
          { label: "Review Delays",    value: reviewCount,       color: "text-warning-300", icon: "🔄" },
          { label: "Project Delays",   value: projectDelayCount, color: "text-danger-300",  icon: "📅" },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="glass-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">{icon}</span>
              <p className="text-surface-500 text-xs uppercase tracking-wider leading-tight">{label}</p>
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col sm:flex-row flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by type, title or description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input flex-1 min-w-40"
          id="pm-risks-search"
        />
        <select value={riskTypeFilter} onChange={(e) => setRiskTypeFilter(e.target.value)} className="input sm:w-48" id="pm-risks-type-filter">
          <option value="All">All Risk Types</option>
          {RISK_TYPES.map((t) => <option key={t} value={t}>{RISK_TYPE_LABELS[t] ?? t}</option>)}
        </select>
        <select value={sevFilter} onChange={(e) => setSevFilter(e.target.value)} className="input sm:w-40" id="pm-risks-sev-filter">
          <option value="All">All Severities</option>
          {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input sm:w-36" id="pm-risks-status-filter">
          <option value="All">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="RESOLVED">Resolved</option>
        </select>
      </div>

      {error && (
        <div className="glass-card p-4 border-danger-500/30 bg-danger-500/10">
          <p className="text-danger-300 text-sm">⚠ {error}</p>
        </div>
      )}

      {/* Risk Cards */}
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
            {statusFilter === "OPEN" ? "No open risks detected" : "No risks found"}
          </p>
          <p className="text-sm mt-1">
            {statusFilter === "OPEN"
              ? "Your projects are running smoothly. Check back later."
              : "Try adjusting your filters."}
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
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-lg">{RISK_TYPE_ICONS[risk.risk_type] ?? "⚠"}</span>
                    <span className="text-xs font-mono text-primary-300 bg-primary-500/10 px-2 py-0.5 rounded">
                      {RISK_TYPE_LABELS[risk.risk_type] ?? risk.risk_type}
                    </span>
                    <span className={`badge ${SEVERITY_COLORS[risk.severity] ?? "bg-surface-700 text-surface-400"}`}>
                      {risk.severity}
                    </span>
                    <span className={`badge ${
                      risk.status === "OPEN"
                        ? "bg-danger-500/15 text-danger-300 border-danger-500/20"
                        : "bg-success-500/15 text-success-300 border-success-500/20"
                    }`}>
                      {risk.status}
                    </span>
                  </div>
                  <h3 className="text-surface-100 font-semibold text-base">{risk.title}</h3>
                  <p className="text-surface-400 text-sm mt-1">{risk.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-surface-500 flex-wrap">
                    {risk.project_name && (
                      <span>📁 {risk.project_name}</span>
                    )}
                    {risk.task_id && (
                      <span className="font-mono">Task: {risk.task_id.slice(0, 8)}…</span>
                    )}
                    <span>Detected: {new Date(risk.detected_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    {risk.resolved_at && (
                      <span className="text-success-400">Resolved: {new Date(risk.resolved_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <div className="flex justify-between items-center">
          <p className="text-surface-600 text-xs">
            Risks resolve automatically when underlying conditions clear
          </p>
          <p className="text-surface-600 text-xs">
            Showing {filtered.length} of {risks.length} risks
          </p>
        </div>
      )}
    </div>
  );
}
