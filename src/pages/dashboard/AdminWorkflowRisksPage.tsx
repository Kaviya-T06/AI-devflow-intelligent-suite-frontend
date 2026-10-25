/**
 * Admin Workflow Risks Page — organization-wide risk visibility with full
 * investigation, corrective action, escalation, and resolution controls.
 *
 * All data comes from the real backend. No mock values.
 */
import { useEffect, useState, useMemo } from "react";
import {
  fetchAllRisks,
  fetchAllProjects,
  fetchRiskMetrics,
} from "../../services/adminService";
import type { WorkflowRisk, RiskSeverity, Project, WorkflowRiskMetrics } from "../../types";
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

const SEVERITIES: RiskSeverity[] = ["Low", "Medium", "High", "Critical"];
const RISK_TYPES = ["STUCK_TASK", "REVIEW_DELAY", "OVERDUE_TASK", "PROJECT_DELAY", "WORKLOAD_RISK"];
const STATUSES   = ["OPEN", "IN_PROGRESS", "RESOLVED", "REOPENED"];

function getProjectName(projectId: string | null, projects: Project[]): string {
  if (!projectId) return "—";
  return projects.find((p) => p.id === projectId)?.name ?? projectId.slice(0, 8) + "…";
}

export default function AdminWorkflowRisksPage() {
  const { profile } = useAuth();

  const [risks, setRisks]       = useState<WorkflowRisk[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [metrics, setMetrics]   = useState<WorkflowRiskMetrics | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const [search, setSearch]           = useState("");
  const [sevFilter, setSevFilter]     = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [riskTypeFilter, setRiskTypeFilter] = useState("All");
  const [projectFilter, setProjectFilter] = useState("All");
  const [escalatedOnly, setEscalatedOnly] = useState(false);

  const [selectedRiskId, setSelectedRiskId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, p, m] = await Promise.all([
        fetchAllRisks(),
        fetchAllProjects(),
        fetchRiskMetrics().catch(() => null),
      ]);
      setRisks(r);
      setAllProjects(p);
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
        getProjectName(r.project_id, allProjects).toLowerCase().includes(search.toLowerCase());
      const matchSev    = sevFilter === "All"    || r.severity === sevFilter;
      const matchStatus = statusFilter === "All" || r.status === statusFilter;
      const matchType   = riskTypeFilter === "All" || r.risk_type === riskTypeFilter;
      const matchProj   = projectFilter === "All" || r.project_id === projectFilter;
      const matchEsc    = !escalatedOnly || r.is_escalated;
      return matchSearch && matchSev && matchStatus && matchType && matchProj && matchEsc;
    });
  }, [risks, search, sevFilter, statusFilter, riskTypeFilter, projectFilter, escalatedOnly, allProjects]);

  // Metrics (live from API when available, else computed from list)
  const m = metrics ?? {
    total_risks:         risks.length,
    open_risks:          risks.filter(r => r.status === "OPEN").length,
    in_progress_risks:   risks.filter(r => r.status === "IN_PROGRESS").length,
    resolved_risks:      risks.filter(r => r.is_resolved).length,
    critical_count:      risks.filter(r => r.severity === "Critical" && !r.is_resolved).length,
    high_count:          risks.filter(r => r.severity === "High" && !r.is_resolved).length,
    medium_count:        risks.filter(r => r.severity === "Medium" && !r.is_resolved).length,
    low_count:           risks.filter(r => r.severity === "Low" && !r.is_resolved).length,
    overdue_tasks_count: risks.filter(r => r.risk_type === "OVERDUE_TASK" && !r.is_resolved).length,
    review_delays_count: risks.filter(r => r.risk_type === "REVIEW_DELAY" && !r.is_resolved).length,
    stuck_tasks_count:   risks.filter(r => r.risk_type === "STUCK_TASK" && !r.is_resolved).length,
    project_delays_count:risks.filter(r => r.risk_type === "PROJECT_DELAY" && !r.is_resolved).length,
    overdue_actions_count:risks.filter(r => r.is_action_overdue && !r.is_resolved).length,
    escalated_count:     risks.filter(r => r.is_escalated && !r.is_resolved).length,
    recurring_count:     risks.filter(r => r.is_recurring).length,
    reopened_risks:      risks.filter(r => r.status === "REOPENED").length,
    workload_risks_count:risks.filter(r => r.risk_type === "WORKLOAD_RISK" && !r.is_resolved).length,
  };

  const riskyProjects = allProjects.filter((p) => risks.some((r) => r.project_id === p.id));

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
            {m.open_risks} open · {m.high_count + m.critical_count} high/critical · {m.escalated_count} escalated — real-time from live data
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge-admin">Admin Panel</span>
          <button onClick={load} disabled={loading}
            className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {[
          { label: "Open",           value: m.open_risks,          color: "text-danger-300" },
          { label: "Critical",       value: m.critical_count,      color: "text-danger-400" },
          { label: "High",           value: m.high_count,          color: "text-orange-300" },
          { label: "Escalated",      value: m.escalated_count,     color: "text-danger-300" },
          { label: "Resolved",       value: m.resolved_risks,      color: "text-success-300" },
          { label: "Overdue Tasks",  value: m.overdue_tasks_count, color: "text-danger-300" },
          { label: "Stuck Tasks",    value: m.stuck_tasks_count,   color: "text-orange-300" },
          { label: "Overdue Actions",value: m.overdue_actions_count, color: "text-danger-300" },
        ].map(({ label, value, color }) => (
          <div key={label} className="glass-card p-3 flex flex-col justify-between min-w-0 h-full">
            <p className="text-surface-500 text-xs uppercase tracking-wider leading-tight min-w-0 break-words">{label}</p>
            <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col sm:flex-row flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by type, title, task, assignee, or project…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input flex-1 min-w-48"
          id="risks-search"
        />
        <select value={riskTypeFilter} onChange={(e) => setRiskTypeFilter(e.target.value)} className="input sm:w-44" id="risks-type-filter">
          <option value="All">All Risk Types</option>
          {RISK_TYPES.map((t) => <option key={t} value={t}>{RISK_TYPE_LABELS[t] ?? t}</option>)}
        </select>
        <select value={sevFilter} onChange={(e) => setSevFilter(e.target.value)} className="input sm:w-36" id="risks-sev-filter">
          <option value="All">All Severities</option>
          {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input sm:w-36" id="risks-status-filter">
          <option value="All">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="input sm:w-44" id="risks-proj-filter">
          <option value="All">All Projects</option>
          {riskyProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
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
            <p className="text-sm mt-1">Adjust filters or wait for the next detection run</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-700/50">
                  {["Risk Type", "Project", "Task / Assignee", "Severity", "Status", "Detected", "Owner", "Actions"].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-surface-400 uppercase tracking-wider px-4 py-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/30">
                {filtered.map((risk) => (
                  <tr
                    key={risk.id}
                    className="hover:bg-surface-800/40 transition-colors cursor-pointer"
                    onClick={() => setSelectedRiskId(risk.id)}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-mono text-primary-300 bg-primary-500/10 px-2 py-0.5 rounded">
                          {RISK_TYPE_LABELS[risk.risk_type] ?? risk.risk_type}
                        </span>
                        {risk.is_escalated && <span title="Escalated" className="text-danger-300 text-xs">🔺</span>}
                        {risk.is_recurring && <span title="Recurring" className="text-purple-300 text-xs">🔁</span>}
                      </div>
                      <p className="text-surface-200 text-xs mt-1 font-medium truncate max-w-40">{risk.title}</p>
                    </td>
                    <td className="px-4 py-4 text-surface-300 text-sm whitespace-nowrap">
                      {getProjectName(risk.project_id, allProjects)}
                    </td>
                    <td className="px-4 py-4">
                      {risk.task_title ? (
                        <div>
                          <p className="text-surface-300 text-sm truncate max-w-36">{risk.task_title}</p>
                          {risk.assignee_name && <p className="text-surface-500 text-xs">{risk.assignee_name}</p>}
                          {risk.overdue_duration_days && (
                            <p className="text-danger-400 text-xs">⏰ {risk.overdue_duration_days}d overdue</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-surface-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`badge ${SEVERITY_COLORS[risk.severity] ?? "bg-surface-700 text-surface-400"}`}>
                        {risk.severity}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`badge ${STATUS_COLORS[risk.status] ?? "bg-surface-700 text-surface-400"}`}>
                        {risk.status.replace("_", " ")}
                      </span>
                      {risk.is_action_overdue && (
                        <p className="text-danger-400 text-xs mt-1">Action overdue</p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-surface-500 text-xs whitespace-nowrap">
                      {new Date(risk.detected_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-4 text-surface-400 text-xs">
                      {risk.owner_name ?? risk.assignee_name ?? "—"}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedRiskId(risk.id); }}
                        className="btn-secondary text-xs px-3 py-1"
                      >
                        Investigate
                      </button>
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
            Click any row to investigate · Actions, escalations, and resolutions persist to database
          </p>
          <p className="text-surface-600 text-xs text-right">
            Showing {filtered.length} of {risks.length} risks
          </p>
        </div>
      )}

      {/* Detail Modal */}
      {selectedRiskId && profile && (
        <RiskDetailModal
          riskId={selectedRiskId}
          userRole={profile.role === "MANAGER" ? "MANAGER" : profile.role === "DEVELOPER" ? "DEVELOPER" : "ADMIN"}
          userId={profile.id}
          onClose={() => setSelectedRiskId(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
