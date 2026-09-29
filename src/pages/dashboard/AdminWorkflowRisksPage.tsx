/**
 * Admin Workflow Risks Page — view, filter, and update risk status.
 */
import { useEffect, useState, useMemo } from "react";
import { fetchAllRisks, updateRiskStatus } from "../../services/adminService";
import { MOCK_PROJECTS } from "../../services/mockData";
import type { WorkflowRisk, RiskSeverity, RiskStatus } from "../../types";

const SEVERITY_COLORS: Record<RiskSeverity, string> = {
  Low:      "bg-surface-700/40 text-surface-400 border-surface-600/30",
  Medium:   "bg-warning-500/15 text-warning-300 border-warning-500/20",
  High:     "bg-orange-500/15 text-orange-300 border-orange-500/20",
  Critical: "bg-danger-500/15 text-danger-300 border-danger-500/20",
};

const STATUS_COLORS: Record<RiskStatus, string> = {
  Open:       "bg-danger-500/15 text-danger-300 border-danger-500/20",
  Monitoring: "bg-warning-500/15 text-warning-300 border-warning-500/20",
  Resolved:   "bg-success-500/15 text-success-300 border-success-500/20",
};

const SEVERITIES: RiskSeverity[] = ["Low", "Medium", "High", "Critical"];
const STATUSES:   RiskStatus[]   = ["Open", "Monitoring", "Resolved"];

function getProjectName(projectId: string | null): string {
  if (!projectId) return "—";
  return MOCK_PROJECTS.find((p) => p.id === projectId)?.name ?? projectId;
}

export default function AdminWorkflowRisksPage() {
  const [risks, setRisks]       = useState<WorkflowRisk[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState("");
  const [sevFilter, setSevFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [updating, setUpdating] = useState<string | null>(null);
  const [toast, setToast]       = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchAllRisks()
      .then(setRisks)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const filtered = useMemo(() => {
    return risks.filter((r) => {
      const matchSearch = !search ||
        r.risk_type.toLowerCase().includes(search.toLowerCase()) ||
        r.description.toLowerCase().includes(search.toLowerCase()) ||
        getProjectName(r.project_id).toLowerCase().includes(search.toLowerCase());
      const matchSev    = sevFilter === "All"    || r.severity === sevFilter;
      const matchStatus = statusFilter === "All" || r.status   === statusFilter;
      return matchSearch && matchSev && matchStatus;
    });
  }, [risks, search, sevFilter, statusFilter]);

  const handleStatusChange = async (risk: WorkflowRisk, status: RiskStatus) => {
    setUpdating(risk.id);
    try {
      await updateRiskStatus(risk.id, status);
      setRisks((prev) => prev.map((r) => r.id === risk.id ? { ...r, status } : r));
      showToast(`Risk status updated to "${status}"`);
    } catch {
      setError("Failed to update risk status");
    } finally {
      setUpdating(null);
    }
  };

  const openCount      = risks.filter((r) => r.status === "Open").length;
  const criticalCount  = risks.filter((r) => r.severity === "Critical").length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 glass-card px-5 py-3 bg-success-500/20 border-success-500/30 text-success-300 text-sm animate-slide-in">
          ✓ {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-surface-50">Workflow Risks</h2>
          <p className="text-surface-400 text-sm mt-1">
            {openCount} open risk{openCount !== 1 ? "s" : ""} · {criticalCount} critical
          </p>
        </div>
        <span className="badge-admin">Admin Panel</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(["Open", "Monitoring", "Resolved"] as RiskStatus[]).map((s) => (
          <div key={s} className="glass-card p-4">
            <p className="text-surface-500 text-xs uppercase tracking-wider">{s}</p>
            <p className="text-2xl font-bold text-surface-50 mt-1">{risks.filter((r) => r.status === s).length}</p>
          </div>
        ))}
        <div className="glass-card p-4 border-danger-500/20">
          <p className="text-surface-500 text-xs uppercase tracking-wider">Critical</p>
          <p className="text-2xl font-bold text-danger-300 mt-1">{criticalCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col sm:flex-row gap-3">
        <input
          type="text" placeholder="Search by type, description or project…"
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="input flex-1" id="risks-search"
        />
        <select value={sevFilter} onChange={(e) => setSevFilter(e.target.value)} className="input sm:w-44" id="risks-sev-filter">
          <option value="All">All Severities</option>
          {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input sm:w-44" id="risks-status-filter">
          <option value="All">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && (
        <div className="glass-card p-4 border-danger-500/30 bg-danger-500/10">
          <p className="text-danger-300 text-sm">{error}</p>
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
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-lg font-medium">No risks found</p>
            <p className="text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-700/50">
                  {["Project", "Risk Type", "Severity", "Description", "Status", "Detected", "Actions"].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-surface-400 uppercase tracking-wider px-6 py-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/30">
                {filtered.map((risk) => (
                  <tr key={risk.id} className="hover:bg-surface-800/40 transition-colors">
                    <td className="px-6 py-4 text-surface-300 text-sm font-medium whitespace-nowrap">
                      {getProjectName(risk.project_id)}
                    </td>
                    <td className="px-6 py-4 text-surface-200 text-sm font-medium whitespace-nowrap">
                      {risk.risk_type}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`badge ${SEVERITY_COLORS[risk.severity]}`}>{risk.severity}</span>
                    </td>
                    <td className="px-6 py-4 text-surface-400 text-sm max-w-xs">
                      <p className="line-clamp-2">{risk.description}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`badge ${STATUS_COLORS[risk.status]}`}>{risk.status}</span>
                    </td>
                    <td className="px-6 py-4 text-surface-500 text-xs whitespace-nowrap">
                      {new Date(risk.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={risk.status}
                        onChange={(e) => handleStatusChange(risk, e.target.value as RiskStatus)}
                        disabled={updating === risk.id}
                        className="input py-1 text-xs w-36"
                        id={`risk-status-${risk.id}`}
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && (
        <p className="text-surface-600 text-xs text-right">
          Showing {filtered.length} of {risks.length} risks
        </p>
      )}
    </div>
  );
}
