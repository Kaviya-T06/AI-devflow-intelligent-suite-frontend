/**
 * RiskDetailModal — full investigation panel with audit timeline, corrective action,
 * escalation, comments, and lifecycle controls.
 *
 * Shown when a user clicks a risk row or card. Renders role-appropriate actions only.
 * All state mutations call the real backend and refresh the parent list.
 */
import { useState, useEffect } from "react";
import type { WorkflowRisk } from "../../types";
import Modal from "../ui/Modal";
import {
  fetchRiskDetail,
  setRiskActionPlan,
  addRiskComment,
  escalateRisk,
  resolveRisk,
  reopenRisk,
  assignRiskOwner,
  updateRiskStatus,
} from "../../services/pmService";

const SEVERITY_COLORS: Record<string, string> = {
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

const ACTION_ICONS: Record<string, string> = {
  DETECTED: "🔍",
  AUTO_RESOLVED: "✅",
  REOPENED_RECURRING: "🔁",
  REOPENED: "🔁",
  STATUS_OPEN: "📂",
  STATUS_IN_PROGRESS: "▶️",
  STATUS_RESOLVED: "✅",
  STATUS_REOPENED: "🔁",
  ACTION_PLAN_CREATED: "📋",
  ACTION_OVERDUE: "⏰",
  BLOCKER_FLAGGED: "🚨",
  PROGRESS_UPDATE: "💬",
  ESCALATED: "🔺",
  RESOLVED: "✅",
  RESOLVED_VERIFIED: "✅🔒",
  OWNER_ASSIGNED: "👤",
};

function fmt(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface Props {
  riskId: string;
  userRole: "ADMIN" | "MANAGER" | "DEVELOPER";
  userId: string;
  onClose: () => void;
  onUpdated?: (updated: WorkflowRisk) => void;
}

type Panel = "overview" | "action" | "comments" | "history" | "escalate" | "resolve";

export default function RiskDetailModal({ riskId, userRole, userId: _userId, onClose, onUpdated }: Props) {
  const [risk, setRisk] = useState<WorkflowRisk | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("overview");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form state
  const [commentText, setCommentText] = useState("");
  const [commentBlocker, setCommentBlocker] = useState(false);
  const [commentEvidence, setCommentEvidence] = useState("");
  const [actionPlan, setActionPlan] = useState("");
  const [actionOwner, setActionOwner] = useState("");
  const [recoveryDeadline, setRecoveryDeadline] = useState("");
  const [escTarget, setEscTarget] = useState("PROJECT_MANAGER");
  const [escReason, setEscReason] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [verifyOnResolve, setVerifyOnResolve] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [showReopen, setShowReopen] = useState(false);
  const [assignOwner, setAssignOwner] = useState("");

  const canActAsPM = userRole === "MANAGER" || userRole === "ADMIN";

  const loadRisk = async () => {
    try {
      setLoading(true);
      setError(null);
      const r = await fetchRiskDetail(riskId);
      setRisk(r);
      // Pre-fill forms with existing data
      setActionPlan(r.corrective_action_plan ?? "");
      setRecoveryDeadline(r.recovery_deadline ? r.recovery_deadline.split("T")[0] : "");
      setActionOwner(r.action_owner_id ?? "");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load risk details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRisk(); }, [riskId]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleAction = async (fn: () => Promise<WorkflowRisk>, successText: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await fn();
      setRisk(updated);
      onUpdated?.(updated);
      showSuccess(successText);
      setPanel("overview");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  const isActive = risk && !risk.is_resolved && risk.status !== "RESOLVED";

  if (loading) {
    return (
      <Modal isOpen onClose={onClose} title="Loading Workflow Risk Details" maxWidthClass="max-w-md">
        <div className="py-12 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
          <p className="text-surface-400 text-sm">Loading risk details…</p>
        </div>
      </Modal>
    );
  }

  if (!risk) {
    return (
      <Modal
        isOpen
        onClose={onClose}
        title="Risk Not Found"
        maxWidthClass="max-w-md"
        footer={<button onClick={onClose} className="btn-secondary text-sm py-2 px-4">Close</button>}
      >
        <div className="py-6 text-center">
          <p className="text-danger-300 text-sm">{error ?? "Risk not found"}</p>
        </div>
      </Modal>
    );
  }

  const customHeader = (
    <div className="shrink-0">
      {/* Header Info */}
      <div className={`p-4 sm:p-5 border-b border-surface-700/50 border-l-4 rounded-t-2xl bg-surface-900/90 backdrop-blur-md ${
        risk.severity === "Critical" || risk.severity === "High" ? "border-l-danger-500"
          : risk.severity === "Medium" ? "border-l-warning-500" : "border-l-surface-600"
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className={`badge ${SEVERITY_COLORS[risk.severity] ?? "bg-surface-700 text-surface-400"}`}>{risk.severity}</span>
              <span className={`badge ${STATUS_COLORS[risk.status] ?? "bg-surface-700 text-surface-400"}`}>{risk.status.replace("_", " ")}</span>
              {risk.is_escalated && <span className="badge bg-danger-500/20 text-danger-200 border-danger-500/30">🔺 Escalated</span>}
              {risk.is_recurring && <span className="badge bg-purple-500/15 text-purple-300 border-purple-500/20">🔁 Recurring #{risk.recurrence_count}</span>}
            </div>
            <h2 className="text-surface-50 font-bold text-base sm:text-lg leading-snug break-words">{risk.title}</h2>
            {risk.description && (
              <p className="text-surface-400 text-xs sm:text-sm mt-1 line-clamp-2">{risk.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-surface-400 hover:text-surface-200 p-1.5 rounded-lg hover:bg-surface-800 transition-colors shrink-0 mt-0.5"
            aria-label="Close dialog"
            title="Close (Esc)"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* Tab Nav — fixed in header */}
      <div className="flex gap-1 px-4 sm:px-5 pt-2 border-b border-surface-700/50 bg-surface-900/60 overflow-x-auto shrink-0">
        {(["overview", "action", "comments", "history"] as Panel[]).map(p => (
          <button
            key={p}
            onClick={() => setPanel(p)}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-t-lg transition-colors capitalize shrink-0 ${
              panel === p ? "bg-primary-500/20 text-primary-300 border-b-2 border-primary-500" : "text-surface-400 hover:text-surface-300 hover:bg-surface-800/40"
            }`}
          >
            {p === "comments" ? `Discussion (${risk.comments_count})` : p === "history" ? `Audit (${risk.history.length})` : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );

  const footer = (
    <div className="w-full">
      {/* Escalate panel */}
      {panel === "escalate" && (
        <div className="space-y-3">
          <p className="text-surface-300 text-sm font-medium">Escalate this risk</p>
          {canActAsPM && (
            <select className="input w-full" value={escTarget} onChange={e => setEscTarget(e.target.value)}>
              <option value="PROJECT_MANAGER">→ Project Manager</option>
              <option value="ADMIN">→ Admin / Leadership</option>
            </select>
          )}
          <textarea className="input w-full h-20 resize-none text-sm" placeholder="Reason for escalation (required)…" value={escReason} onChange={e => setEscReason(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={() => setPanel("overview")} className="btn-secondary flex-1 py-2 text-sm">Cancel</button>
            <button disabled={submitting || !escReason.trim()} onClick={() =>
              handleAction(() => escalateRisk(riskId, escTarget, escReason), "Risk escalated successfully.")
            } className="btn-primary flex-1 py-2 text-sm text-orange-200">
              {submitting ? "Escalating…" : "Escalate"}
            </button>
          </div>
        </div>
      )}

      {/* Resolve panel */}
      {panel === "resolve" && (
        <div className="space-y-3">
          <p className="text-surface-300 text-sm font-medium">Resolve this risk</p>
          <textarea className="input w-full h-20 resize-none text-sm" placeholder="Resolution notes (required)…" value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} />
          {canActAsPM && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={verifyOnResolve} onChange={e => setVerifyOnResolve(e.target.checked)} className="w-4 h-4" />
              <span className="text-sm text-success-300">Sign off with formal verification</span>
            </label>
          )}
          <div className="flex gap-2">
            <button onClick={() => setPanel("overview")} className="btn-secondary flex-1 py-2 text-sm">Cancel</button>
            <button disabled={submitting || !resolutionNotes.trim()} onClick={() =>
              handleAction(() => resolveRisk(riskId, { resolution_notes: resolutionNotes, verify: verifyOnResolve }), "Risk resolved.")
            } className="btn-primary flex-1 py-2 text-sm text-success-200">
              {submitting ? "Resolving…" : "Resolve Risk"}
            </button>
          </div>
        </div>
      )}

      {/* Reopen panel */}
      {showReopen && (
        <div className="space-y-3">
          <p className="text-surface-300 text-sm font-medium">Reopen this risk</p>
          <textarea className="input w-full h-20 resize-none text-sm" placeholder="Reason for reopening (required)…" value={reopenReason} onChange={e => setReopenReason(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={() => setShowReopen(false)} className="btn-secondary flex-1 py-2 text-sm">Cancel</button>
            <button disabled={submitting || !reopenReason.trim()} onClick={() =>
              handleAction(() => reopenRisk(riskId, reopenReason).then(r => { setShowReopen(false); return r; }), "Risk reopened.")
            } className="btn-primary flex-1 py-2 text-sm text-warning-200">
              {submitting ? "Reopening…" : "Reopen Risk"}
            </button>
          </div>
        </div>
      )}

      {/* Default footer controls */}
      {panel !== "escalate" && panel !== "resolve" && !showReopen && (
        <div className="flex flex-wrap gap-2 justify-between items-center">
          <button onClick={onClose} className="btn-secondary text-sm py-2 px-4">Close</button>
          <div className="flex flex-wrap gap-2 items-center">
            {isActive && (
              <>
                <button onClick={() => setPanel("action")} className="btn-secondary text-sm py-2 px-3">📋 Action Plan</button>
                <button onClick={() => setPanel("comments")} className="btn-secondary text-sm py-2 px-3">💬 Add Update</button>
                {!risk.is_escalated && (
                  <button onClick={() => setPanel("escalate")} className="btn-secondary text-sm py-2 px-3 text-orange-300">🔺 Escalate</button>
                )}
                {canActAsPM && (
                  <button onClick={() => setPanel("resolve")} className="btn-secondary text-sm py-2 px-3 text-success-300">✓ Resolve</button>
                )}
              </>
            )}
            {risk.is_resolved && canActAsPM && (
              <button onClick={() => setShowReopen(true)} className="btn-secondary text-sm py-2 px-3 text-warning-300">🔁 Reopen</button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
      ariaLabel={`Risk Details: ${risk.title}`}
      maxWidthClass="max-w-3xl"
      customHeader={customHeader}
      bodyClassName="p-4 sm:p-5 pb-8 sm:pb-12 space-y-4"
      footer={footer}
      footerClassName="p-3 sm:p-4 bg-surface-900/90 backdrop-blur-sm"
    >
      {error && <div className="p-3 bg-danger-500/10 border border-danger-500/20 rounded-lg text-danger-300 text-sm">⚠ {error}</div>}
      {successMsg && <div className="p-3 bg-success-500/10 border border-success-500/20 rounded-lg text-success-300 text-sm">✓ {successMsg}</div>}

      {/* ── OVERVIEW ── */}
      {panel === "overview" && (
        <div className="space-y-4">
          {/* Detection */}
          <Section title="Detection">
            <Row label="Risk Type" value={<code className="text-primary-300 bg-primary-500/10 px-2 py-0.5 rounded text-xs">{risk.risk_type}</code>} />
            <Row label="Detection Rule" value={risk.detection_rule} />
            <Row label="Detection Reason" value={risk.detection_reason} />
            <Row label="Severity Reason" value={risk.severity_reason} />
            <Row label="First Detected" value={fmt(risk.detected_at)} />
            <Row label="Last Updated" value={fmt(risk.updated_at)} />
          </Section>

          {/* Linked entities */}
          <Section title="Linked Records">
            {risk.project_name && <Row label="Project" value={<span className="text-primary-300">{risk.project_name}</span>} />}
            {risk.task_title && <Row label="Task" value={<span>{risk.task_title} <span className="text-surface-500 text-xs">[{risk.task_status}]</span></span>} />}
            {risk.task_due_date && <Row label="Task Due Date" value={<span className={risk.overdue_duration_days ? "text-danger-300" : "text-surface-300"}>{fmtDate(risk.task_due_date)}{risk.overdue_duration_days ? ` — overdue by ${risk.overdue_duration_days}d` : ""}</span>} />}
            {risk.assignee_name && <Row label="Assignee" value={risk.assignee_name} />}
            {risk.project_manager_name && <Row label="Project Manager" value={risk.project_manager_name} />}
            {risk.owner_name && <Row label="Risk Owner" value={risk.owner_name} />}
            {risk.github_pr_url && (
              <Row label="Pull Request" value={
                <a href={risk.github_pr_url} target="_blank" rel="noreferrer" className="text-primary-400 hover:underline text-sm truncate block max-w-full">{risk.github_pr_url}</a>
              } />
            )}
          </Section>

          {/* Corrective Action */}
          {risk.corrective_action_plan && (
            <Section title="Corrective Action Plan">
              <p className="text-surface-300 text-sm whitespace-pre-wrap">{risk.corrective_action_plan}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                <Row label="Action Owner" value={risk.action_owner_name} />
                <Row label="Recovery Deadline" value={<span className={risk.is_action_overdue ? "text-danger-300 font-medium" : ""}>{fmtDate(risk.recovery_deadline)}{risk.is_action_overdue ? " ⚠ OVERDUE" : ""}</span>} />
                <Row label="Action Status" value={risk.action_status} />
              </div>
            </Section>
          )}

          {/* Escalation */}
          {risk.is_escalated && (
            <Section title="Escalation">
              <Row label="Escalated To" value={risk.escalated_to} />
              <Row label="Escalated By" value={risk.escalated_by_name} />
              <Row label="Escalated At" value={fmt(risk.escalated_at)} />
              <Row label="Reason" value={risk.escalation_reason} />
            </Section>
          )}

          {/* Resolution */}
          {risk.is_resolved && (
            <Section title="Resolution">
              <Row label="Resolution Notes" value={risk.resolution_notes} />
              <Row label="Resolved By" value={risk.resolved_by_name} />
              <Row label="Resolved At" value={fmt(risk.resolved_at)} />
              {risk.verified_by && <>
                <Row label="Verified By" value={risk.verified_by_name} />
                <Row label="Verification Notes" value={risk.verification_notes} />
              </>}
            </Section>
          )}
        </div>
      )}

      {/* ── ACTION PLAN ── */}
      {panel === "action" && (
        <div className="space-y-4">
          <p className="text-surface-400 text-sm">Set or update the corrective action plan for this risk. This will move the risk to <strong className="text-primary-300">In Progress</strong>.</p>
          <div className="space-y-3">
            <div>
              <label className="text-surface-400 text-xs font-medium uppercase mb-1 block">Action Plan <span className="text-danger-300">*</span></label>
              <textarea
                className="input w-full h-28 resize-y"
                placeholder="Describe the corrective actions to take…"
                value={actionPlan}
                onChange={e => setActionPlan(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-surface-400 text-xs font-medium uppercase mb-1 block">Recovery Deadline</label>
                <input type="date" className="input w-full" value={recoveryDeadline} onChange={e => setRecoveryDeadline(e.target.value)} />
              </div>
              {canActAsPM && (
                <div>
                  <label className="text-surface-400 text-xs font-medium uppercase mb-1 block">Action Owner (User ID)</label>
                  <input className="input w-full text-xs font-mono" placeholder="User UUID" value={actionOwner} onChange={e => setActionOwner(e.target.value)} />
                </div>
              )}
            </div>
            <button disabled={submitting || !actionPlan.trim()} onClick={() =>
              handleAction(() => setRiskActionPlan(riskId, {
                action_plan: actionPlan,
                recovery_deadline: recoveryDeadline || undefined,
                action_owner_id: actionOwner || undefined,
              }), "Corrective action plan saved.")
            } className="btn-primary w-full">
              {submitting ? "Saving…" : "Save Action Plan"}
            </button>
          </div>

          {/* Quick status + assign */}
          {canActAsPM && isActive && (
            <div className="border-t border-surface-700/50 pt-4 space-y-3">
              <p className="text-surface-500 text-xs font-semibold uppercase">Quick Actions</p>
              <div className="flex flex-wrap gap-2">
                {risk.status === "OPEN" && (
                  <button onClick={() => handleAction(() => updateRiskStatus(riskId, "IN_PROGRESS", undefined, "Investigation started"), "Status updated to In Progress")}
                    disabled={submitting} className="btn-secondary text-sm">
                    ▶ Mark In Progress
                  </button>
                )}
                <button onClick={() => setPanel("escalate")} className="btn-secondary text-sm text-orange-300">🔺 Escalate</button>
                <button onClick={() => setPanel("resolve")} className="btn-secondary text-sm text-success-300">✓ Resolve</button>
              </div>
              <div className="flex gap-2">
                <input className="input flex-1 text-xs font-mono" placeholder="Assign owner User ID" value={assignOwner} onChange={e => setAssignOwner(e.target.value)} />
                <button disabled={submitting || !assignOwner.trim()} onClick={() =>
                  handleAction(() => assignRiskOwner(riskId, assignOwner), "Owner assigned.")
                } className="btn-secondary text-sm">Assign</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── COMMENTS ── */}
      {panel === "comments" && (
        <div className="space-y-4">
          {/* Existing comments */}
          {risk.comments.length === 0 ? (
            <p className="text-surface-500 text-sm text-center py-8">No discussion yet. Add the first update below.</p>
          ) : (
            <div className="space-y-3">
              {risk.comments.map(c => (
                <div key={c.id} className={`rounded-xl p-4 ${c.is_blocker ? "bg-danger-500/10 border border-danger-500/20" : "bg-surface-800/60 border border-surface-700/30"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-surface-300 text-sm font-medium">{c.user_name}</span>
                    {c.user_role && <span className="text-xs text-surface-500 uppercase">{c.user_role}</span>}
                    {c.is_blocker && <span className="text-danger-300 text-xs font-bold">🚨 BLOCKER</span>}
                    <span className="text-surface-600 text-xs ml-auto">{fmt(c.created_at)}</span>
                  </div>
                  <p className="text-surface-300 text-sm whitespace-pre-wrap">{c.content}</p>
                  {c.evidence_url && (
                    <a href={c.evidence_url} target="_blank" rel="noreferrer" className="text-primary-400 text-xs hover:underline mt-1 block truncate">🔗 {c.evidence_url}</a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* New comment form */}
          <div className="border-t border-surface-700/50 pt-4 space-y-3">
            <textarea
              className="input w-full h-24 resize-y"
              placeholder="Add a progress update, comment, or evidence link…"
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
            />
            <div className="flex flex-wrap gap-3 items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={commentBlocker} onChange={e => setCommentBlocker(e.target.checked)} className="w-4 h-4" />
                <span className="text-sm text-danger-300">Flag as Blocker</span>
              </label>
              <input
                className="input flex-1 min-w-40 text-xs"
                placeholder="Evidence / PR URL (optional)"
                value={commentEvidence}
                onChange={e => setCommentEvidence(e.target.value)}
              />
            </div>
            <button disabled={submitting || !commentText.trim()} onClick={() =>
              handleAction(() => addRiskComment(riskId, {
                content: commentText,
                is_blocker: commentBlocker,
                evidence_url: commentEvidence || undefined,
              }).then(r => { setCommentText(""); setCommentBlocker(false); setCommentEvidence(""); return r; }),
              "Comment added.")
            } className="btn-primary w-full">
              {submitting ? "Submitting…" : commentBlocker ? "Submit Blocker Alert" : "Add Comment"}
            </button>

            {/* Escalate shortcut for developers */}
            {!canActAsPM && (
              <button onClick={() => setPanel("escalate")} className="btn-secondary w-full text-orange-300">
                🔺 Request Help / Escalate Blocker
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── HISTORY ── */}
      {panel === "history" && (
        <div>
          {risk.history.length === 0 ? (
            <p className="text-surface-500 text-sm text-center py-8">No audit history available yet.</p>
          ) : (
            <ol className="relative border-l border-surface-700/50 ml-4 space-y-6">
              {[...risk.history].reverse().map((h) => (
                <li key={h.id} className="ml-6">
                  <span className="absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full bg-surface-800 border border-surface-600 text-sm">
                    {ACTION_ICONS[h.action] ?? "•"}
                  </span>
                  <div className="bg-surface-800/40 border border-surface-700/30 rounded-xl p-3">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-mono text-primary-400 bg-primary-500/10 px-2 rounded">{h.action}</span>
                      <span className="text-surface-400 text-xs">{h.user_name ?? "System"}</span>
                      <span className="text-surface-600 text-xs ml-auto">{fmt(h.timestamp)}</span>
                    </div>
                    <p className="text-surface-300 text-sm">{h.details}</p>
                    {(h.previous_value || h.new_value) && (
                      <div className="flex gap-2 mt-1 text-xs text-surface-500">
                        {h.previous_value && <span>From: <code className="text-danger-400">{h.previous_value}</code></span>}
                        {h.new_value && <span>To: <code className="text-success-400">{h.new_value}</code></span>}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </Modal>
  );
}

// Helpers
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-4 space-y-2">
      <p className="text-surface-400 text-xs font-semibold uppercase tracking-wider border-b border-surface-700/30 pb-2 mb-3">{title}</p>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: React.ReactNode | string | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2 text-sm">
      <span className="text-surface-500 sm:w-36 shrink-0 text-xs sm:text-sm font-medium sm:font-normal">{label}</span>
      <span className="text-surface-300 flex-1 min-w-0 break-words">{value}</span>
    </div>
  );
}
