/**
 * Admin Workflow Risks Page — view and filter auto-detected workflow risks.
 * Risks are resolved automatically by the backend when conditions clear.
 */
import { useEffect, useState, useMemo } from "react";
import { fetchAllRisks, fetchAllProjects } from "../../services/adminService";
import type { WorkflowRisk, RiskSeverity, Project } from "../../types";

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

const SEVERITIES: RiskSeverity[] = ["Low", "Medium", "High", "Critical"];
const RISK_TYPES = ["STUCK_TASK", "REVIEW_DELAY", "OVERDUE_TASK", "PROJECT_DELAY", "WORKLOAD_RISK"];

function getProjectName(projectId: string | null, projects: Project[]): string {
  if (!projectId) return "—";
  return projects.find((p) => p.id === projectId)?.name ?? projectId.slice(0, 8) + "…";
}

export default function AdminWorkflowRisksPage() {
  const [risks, setRisks]             = useState<WorkflowRisk[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [search, setSearch]           = useState("");
  const [sevFilter, setSevFilter]     = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [riskTypeFilter, setRiskTypeFilter] = useState("All");
  const [projectFilter, setProjectFilter] = useState("All");

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([fetchAllRisks(), fetchAllProjects()])
      .then(([r, p]) => { setRisks(r); setAllProjects(p); })
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
        getProjectName(r.project_id, allProjects).toLowerCase().includes(search.toLowerCase());
      const matchSev    = sevFilter === "All"    || r.severity === sevFilter;
      const matchStatus = statusFilter === "All" || r.status === statusFilter;
      const matchType   = riskTypeFilter === "All" || r.risk_type === riskTypeFilter;
      const matchProj   = projectFilter === "All" || r.project_id === projectFilter;
      return matchSearch && matchSev && matchStatus && matchType && matchProj;
    });
  }, [risks, search, sevFilter, statusFilter, riskTypeFilter, projectFilter, allProjects]);

  // Metrics
  const openRisks       = risks.filter((r) => r.status === "OPEN").length;
  const highRisks       = risks.filter((r) => r.severity === "High" && r.status === "OPEN").length;
  const mediumRisks     = risks.filter((r) => r.severity === "Medium" && r.status === "OPEN").length;
  const lowRisks        = risks.filter((r) => r.severity === "Low" && r.status === "OPEN").length;
  const resolvedRisks   = risks.filter((r) => r.status === "RESOLVED").length;
  const overdueCount    = risks.filter((r) => r.risk_type === "OVERDUE_TASK" && r.status === "OPEN").length;
  const reviewCount     = risks.filter((r) => r.risk_type === "REVIEW_DELAY" && r.status === "OPEN").length;
  const stuckCount      = risks.filter((r) => r.risk_type === "STUCK_TASK" && r.status === "OPEN").length;
  const projectDelayCount = risks.filter((r) => r.risk_type === "PROJECT_DELAY" && r.status === "OPEN").length;

  // Projects that have risks (for filter dropdown)
  const riskyProjects = allProjects.filter((p) => risks.some((r) => r.project_id === p.id));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-surface-50">Workflow Risks</h2>
          <p className="text-surface-400 text-sm mt-1">
            {openRisks} open · {highRisks} high severity · auto-detected from live workflow data
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge-admin">Admin Panel</span>
          <button
            onClick={load}
            disabled={loading}
            className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: "Open",           value: openRisks,         color: "text-danger-300" },
          { label: "High",           value: highRisks,         color: "text-orange-300" },
          { label: "Medium",         value: mediumRisks,       color: "text-warning-300" },
          { label: "Low",            value: lowRisks,          color: "text-surface-300" },
          { label: "Resolved",       value: resolvedRisks,     color: "text-success-300" },
          { label: "Overdue Tasks",  value: overdueCount,      color: "text-danger-300" },
          { label: "Review Delays",  value: reviewCount,       color: "text-warning-300" },
          { label: "Stuck Tasks",    value: stuckCount,        color: "text-orange-300" },
        ].map(({ label, value, color }) => (
          <div key={label} className="glass-card p-3">
            <p className="text-surface-500 text-xs uppercase tracking-wider leading-tight">{label}</p>
            <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col sm:flex-row flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by type, title, description or project…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input flex-1 min-w-48"
          id="risks-search"
        />
        <select value={riskTypeFilter} onChange={(e) => setRiskTypeFilter(e.target.value)} className="input sm:w-48" id="risks-type-filter">
          <option value="All">All Risk Types</option>
          {RISK_TYPES.map((t) => <option key={t} value={t}>{RISK_TYPE_LABELS[t] ?? t}</option>)}
        </select>
        <select value={sevFilter} onChange={(e) => setSevFilter(e.target.value)} className="input sm:w-40" id="risks-sev-filter">
          <option value="All">All Severities</option>
          {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input sm:w-36" id="risks-status-filter">
          <option value="All">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="RESOLVED">Resolved</option>
        </select>
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="input sm:w-48" id="risks-proj-filter">
          <option value="All">All Projects</option>
          {riskyProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {error && (
        <div className="glass-card p-4 border-danger-500/30 bg-danger-500/10">
          <p className="text-danger-300 text-sm">⚠ {error}</p>
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
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-lg font-medium">No workflow risks detected</p>
            <p className="text-sm mt-1">Adjust filters or wait for risk detection to run</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-700/50">
                  {["Risk Type", "Project", "Task", "Severity", "Title", "Description", "Status", "Detected", "Resolved"].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-surface-400 uppercase tracking-wider px-4 py-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/30">
                {filtered.map((risk) => (
                  <tr key={risk.id} className="hover:bg-surface-800/40 transition-colors">
                    <td className="px-4 py-4">
                      <span className="text-xs font-mono text-primary-300 bg-primary-500/10 px-2 py-0.5 rounded">
                        {RISK_TYPE_LABELS[risk.risk_type] ?? risk.risk_type}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-surface-300 text-sm whitespace-nowrap">
                      {getProjectName(risk.project_id, allProjects)}
                    </td>
                    <td className="px-4 py-4 text-surface-500 text-xs whitespace-nowrap font-mono">
                      {risk.task_id ? risk.task_id.slice(0, 8) + "…" : "—"}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`badge ${SEVERITY_COLORS[risk.severity] ?? "bg-surface-700 text-surface-400"}`}>
                        {risk.severity}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-surface-200 text-sm font-medium max-w-xs">
                      <p className="truncate">{risk.title}</p>
                    </td>
                    <td className="px-4 py-4 text-surface-400 text-sm max-w-xs">
                      <p className="line-clamp-2">{risk.description}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`badge ${
                        risk.status === "OPEN"
                          ? "bg-danger-500/15 text-danger-300 border-danger-500/20"
                          : "bg-success-500/15 text-success-300 border-success-500/20"
                      }`}>
                        {risk.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-surface-500 text-xs whitespace-nowrap">
                      {new Date(risk.detected_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-4 text-surface-500 text-xs whitespace-nowrap">
                      {risk.resolved_at
                        ? new Date(risk.resolved_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && (
        <div className="flex justify-between items-center">
          <p className="text-surface-600 text-xs">
            Risks auto-resolve when underlying conditions are cleared
          </p>
          <p className="text-surface-600 text-xs text-right">
            Showing {filtered.length} of {risks.length} risks
          </p>
        </div>
      )}
    </div>
  );
}
