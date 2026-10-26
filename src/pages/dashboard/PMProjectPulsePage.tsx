import { useState, useEffect, useRef } from "react";
import { useInRouterContext, useSearchParams, Link } from "react-router-dom";
import {
  fetchPMDashboardStats,
  fetchPMRisks,
  fetchPMActivity,
  fetchPulseRecommendations,
  fetchPulseBriefing,
} from "../../services/pmService";
import type {
  PMDashboardStats,
  WorkflowRisk,
  PMActivityItem,
  PulseRecommendationsResponse,
  PulseBriefingResponse,
} from "../../types";

// ---------------------------------------------------------------------------
// Universal NavLink (works inside or outside React Router)
// ---------------------------------------------------------------------------
function NavLink({
  to,
  children,
  className,
  ariaLabel,
  title,
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  title?: string;
}) {
  const inRouter = useInRouterContext();
  if (inRouter) {
    return (
      <Link to={to} className={className} aria-label={ariaLabel} title={title}>
        {children}
      </Link>
    );
  }
  return (
    <a href={to} className={className} aria-label={ariaLabel} title={title}>
      {children}
    </a>
  );
}

// Helper to suppress raw AI timeout/unavailability banners during live demos
function isUnavailableOrTimeoutNotice(notice?: string | null): boolean {
  if (!notice) return false;
  const l = notice.toLowerCase();
  return (
    l.includes("unavailable") ||
    l.includes("timed out") ||
    l.includes("timeout") ||
    l.includes("too long") ||
    l.includes("offline") ||
    l.includes("unreachable") ||
    l.includes("failed") ||
    l.includes("504") ||
    l.includes("503") ||
    l.includes("502")
  );
}

// ---------------------------------------------------------------------------
// Core Dashboard Component
// ---------------------------------------------------------------------------
interface PMProjectPulseCoreProps {
  searchParams: URLSearchParams;
  setSearchParams: (params: Record<string, string>, options?: any) => void;
}

function PMProjectPulseCore({ searchParams, setSearchParams }: PMProjectPulseCoreProps) {
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<PMDashboardStats | null>(null);
  const [allRisks, setAllRisks] = useState<WorkflowRisk[]>([]);
  const [allActivity, setAllActivity] = useState<PMActivityItem[]>([]);

  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    () => searchParams.get("project") || ""
  );
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Tab State: "briefing" | "recommendations"
  const [activeTab, setActiveTab] = useState<"briefing" | "recommendations">("briefing");

  // Phase 4: AI Recommendations State
  const [recommendations, setRecommendations] = useState<PulseRecommendationsResponse | null>(null);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [recsError, setRecsError] = useState<string | null>(null);

  // Card-level & shared expansion state for Recovery Recommendations
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});
  const [showMethodology, setShowMethodology] = useState(false);

  const toggleCardExpanded = (id: string) => {
    setExpandedCardIds((prev) => ({
      ...prev,
      [id]: !(prev[id] ?? true),
    }));
  };

  // Phase 5: AI Project Briefing State
  const [briefing, setBriefing] = useState<PulseBriefingResponse | null>(null);
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const [briefingError, setBriefingError] = useState<string | null>(null);

  // Concurrency & stale context guards
  const isRefreshingRef = useRef(false);
  const activeProjectIdRef = useRef<string>("");

  const loadData = async (isManualRefresh = false) => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;

    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [pmStats, risks, activities] = await Promise.all([
        fetchPMDashboardStats(),
        fetchPMRisks(),
        fetchPMActivity(50),
      ]);

      setStats(pmStats);
      setAllRisks(risks);
      setAllActivity(activities);
      setLastUpdated(new Date());

      if (pmStats.projects && pmStats.projects.length > 0) {
        const urlProj = searchParams.get("project");
        const matched =
          pmStats.projects.find((p) => p.id === urlProj) ||
          pmStats.projects.find((p) => p.id === selectedProjectId) ||
          pmStats.projects[0];

        const targetId = matched.id;
        activeProjectIdRef.current = targetId;

        if (selectedProjectId !== targetId) {
          setSelectedProjectId(targetId);
          setSearchParams({ project: targetId });
        }

        loadBriefing(targetId);
        loadRecommendations(targetId);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load Project Pulse data");
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const loadBriefing = async (projId: string) => {
    if (!projId) return;
    try {
      setLoadingBriefing(true);
      setBriefingError(null);
      const data = await fetchPulseBriefing(projId);
      if (activeProjectIdRef.current === projId) {
        setBriefing(data);
      }
    } catch (err: any) {
      if (activeProjectIdRef.current === projId) {
        setBriefingError(err.message || "Failed to load project briefing");
      }
    } finally {
      if (activeProjectIdRef.current === projId) {
        setLoadingBriefing(false);
      }
    }
  };

  const loadRecommendations = async (projId: string) => {
    if (!projId) return;
    try {
      setLoadingRecs(true);
      setRecsError(null);
      const recsData = await fetchPulseRecommendations(projId);
      if (activeProjectIdRef.current === projId) {
        setRecommendations(recsData);
      }
    } catch (err: any) {
      if (activeProjectIdRef.current === projId) {
        setRecsError(err.message || "Failed to load recovery recommendations");
      }
    } finally {
      if (activeProjectIdRef.current === projId) {
        setLoadingRecs(false);
      }
    }
  };

  const handleProjectSelect = (newProjectId: string) => {
    if (newProjectId === selectedProjectId) return;
    activeProjectIdRef.current = newProjectId;
    setSelectedProjectId(newProjectId);
    setSearchParams({ project: newProjectId });

    // Stale context prevention: reset previous project context immediately
    setBriefing(null);
    setRecommendations(null);
    loadBriefing(newProjectId);
    loadRecommendations(newProjectId);
  };

  useEffect(() => {
    loadData(false);
  }, []);

  // Synchronize when searchParams project changes externally
  useEffect(() => {
    const urlProj = searchParams.get("project");
    if (urlProj && urlProj !== selectedProjectId && stats?.projects?.some((p) => p.id === urlProj)) {
      handleProjectSelect(urlProj);
    }
  }, [searchParams]);

  // Tab keyboard accessibility
  const handleTabKeyDown = (
    e: React.KeyboardEvent,
    tab: "briefing" | "recommendations"
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setActiveTab(tab);
    } else if (e.key === "ArrowRight") {
      setActiveTab("recommendations");
    } else if (e.key === "ArrowLeft") {
      setActiveTab("briefing");
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-64" role="status" aria-label="Loading Project Pulse">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-surface-400">Loading Project Pulse...</p>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-center" role="alert">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={() => loadData(false)} className="btn-primary" aria-label="Retry loading Project Pulse">
          Retry
        </button>
      </div>
    );
  }

  const projects = stats?.projects || [];
  if (projects.length === 0) {
    return (
      <div className="text-center p-12 bg-surface-800/50 rounded-xl border border-surface-700/50">
        <p className="text-surface-300">You don't have any active projects yet.</p>
        <p className="text-surface-500 text-sm mt-2">Create a project to see its Pulse.</p>
      </div>
    );
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || projects[0];

  // Derived Task Metrics
  const totalTasks = selectedProject.total_tasks || 0;
  const completedTasks = selectedProject.completed_tasks || 0;
  const inProgressTasks = selectedProject.in_progress_tasks || 0;
  const reviewTasks = selectedProject.review_tasks || 0;
  const todoTasks = selectedProject.todo_tasks || 0;
  const overdueTasks = selectedProject.overdue_tasks || 0;

  const completedPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const inProgressPct = totalTasks > 0 ? Math.round((inProgressTasks / totalTasks) * 100) : 0;
  const reviewPct = totalTasks > 0 ? Math.round((reviewTasks / totalTasks) * 100) : 0;
  const todoPct = totalTasks > 0 ? Math.round((todoTasks / totalTasks) * 100) : 0;
  const overduePct = totalTasks > 0 ? Math.round((overdueTasks / totalTasks) * 100) : 0;

  // Derived Risk Metrics
  const projectRisks = allRisks.filter((r) => r.project_id === selectedProject.id && !r.is_resolved);
  const unresolvedCritical = projectRisks.filter((r) => r.severity === "Critical");
  const unresolvedHigh = projectRisks.filter((r) => r.severity === "High");
  const unresolvedMedium = projectRisks.filter((r) => r.severity === "Medium");
  const unresolvedLow = projectRisks.filter((r) => r.severity === "Low");

  // Activity
  const projectActivity = allActivity.filter((a) => a.entity_id === selectedProject.id).slice(0, 5);

  // Health Score Metrics
  const health = selectedProject.health || { score: 100, components: [], data_completeness: "High" };
  const score = health.score;
  const deductions = health.components;

  const getHealthStatus = (s: number) => {
    if (s >= 80) return { label: "Optimal / Healthy", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" };
    if (s >= 60) return { label: "Caution / Degraded", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" };
    return { label: "Critical / High Risk", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" };
  };
  const healthStatus = getHealthStatus(score);

  // Developer Workload metrics
  const developers = selectedProject.developers || [];
  const assignedTasksCount = developers.reduce((sum, d) => sum + (d.total_tasks || 0), 0);
  const unassignedTasksCount = Math.max(0, totalTasks - assignedTasksCount);

  // Badge helpers
  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case "RISK_MITIGATION":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "TASK_REVIEW":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "WORKLOAD_REBALANCE":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "ALLOCATION_OPPORTUNITY":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "DEADLINE_CONFIRMATION":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      default:
        return "bg-surface-700 text-surface-300 border-surface-600";
    }
  };

  const getConfidenceBadgeClass = (confidence: string) => {
    switch (confidence) {
      case "High":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "Medium":
        return "bg-yellow-500/10 text-yellow-400 border-yellow-500/30";
      default:
        return "bg-surface-700 text-surface-400 border-surface-600";
    }
  };

  const getReferenceIcon = (type: string) => {
    switch (type) {
      case "risk":
        return "🚨";
      case "task":
        return "📋";
      case "developer":
      case "workload":
        return "👤";
      case "github":
        return "🐙";
      default:
        return "🔗";
    }
  };

  const getReferenceLink = (type: string, _id?: string) => {
    switch (type) {
      case "task":
        return `/dashboard/pm-team-tasks?project=${selectedProject.id}`;
      case "risk":
        return `/dashboard/pm-workflow-risks?project=${encodeURIComponent(selectedProject.name || selectedProject.id)}`;
      case "developer":
      case "workload":
        return `/dashboard/pm-smart-allocation?project=${selectedProject.id}`;
      case "github":
        return "/dashboard/github-integration";
      default:
        return `/dashboard/pm-team-tasks?project=${selectedProject.id}`;
    }
  };

  // Deduplicated Unified Overdue Task model
  interface UnifiedOverdueTask {
    key: string;
    taskId: string;
    taskTitle: string;
    assigneeName: string;
    dueDate: string;
    status: string;
    hasRisk: boolean;
    riskId?: string;
    riskTitle?: string;
    riskSeverity?: string;
    riskDetails?: string;
    specificRecommendedAction: string;
    taskRec?: PulseRecommendation;
    riskRec?: PulseRecommendation;
    evidenceReferences: SupportingReference[];
    assumptions: string[];
    methodologies: string[];
    confidence: string;
  }

  // Grouping & deduplication for Recovery Recommendations
  const allRecs = recommendations?.recommendations || [];

  const riskMitigationRecs = allRecs.filter((r) => r.category === "RISK_MITIGATION");
  const taskReviewRecs = allRecs.filter((r) => r.category === "TASK_REVIEW");
  const allocationRecs = allRecs.filter((r) => r.category === "ALLOCATION_OPPORTUNITY");
  const otherRecs = allRecs.filter(
    (r) => !["RISK_MITIGATION", "TASK_REVIEW", "ALLOCATION_OPPORTUNITY"].includes(r.category)
  );

  const getTaskInfoFromRec = (rec: PulseRecommendation) => {
    const taskRef = rec.supporting_references?.find((ref) => ref.type === "task");
    if (taskRef) {
      return { id: taskRef.id, label: taskRef.label.replace(/^Task:\s*/i, "") };
    }
    if (rec.actionable_entity_type === "task" && rec.actionable_entity_id) {
      const match = rec.title.match(/Task:\s*(.+)$/i);
      return { id: rec.actionable_entity_id, label: match ? match[1] : rec.actionable_entity_id };
    }
    const match = rec.title.match(/Overdue Task:\s*(.+)$/i);
    if (match) {
      return { id: match[1].toLowerCase().replace(/\s+/g, "-"), label: match[1].trim() };
    }
    return null;
  };

  const unifiedOverdueTasks: UnifiedOverdueTask[] = [];
  const claimedRiskRecIds = new Set<string>();

  // 1. Process all task review recommendations into single unified cards
  taskReviewRecs.forEach((tRec) => {
    const tInfo = getTaskInfoFromRec(tRec);
    const taskId = tInfo?.id || tRec.actionable_entity_id || tRec.id;
    const taskTitle = tInfo?.label || tRec.title.replace(/^Review\s+Overdue\s+Task:\s*/i, "");

    // Link corresponding risk recommendation if present
    const linkedRiskRec = riskMitigationRecs.find((rRec) => {
      const rTaskInfo = getTaskInfoFromRec(rRec);
      return (
        (rTaskInfo && rTaskInfo.id === taskId) ||
        (rTaskInfo && rTaskInfo.label.toLowerCase() === taskTitle.toLowerCase()) ||
        rRec.explanation.toLowerCase().includes(taskTitle.toLowerCase())
      );
    });

    if (linkedRiskRec) {
      claimedRiskRecIds.add(linkedRiskRec.id);
    }

    // Link database risk record from projectRisks if present
    const linkedDbRisk = projectRisks.find(
      (r) =>
        (r.task_id && String(r.task_id) === String(taskId)) ||
        (r.title && r.title.toLowerCase().includes(taskTitle.toLowerCase()))
    );

    // Extract Developer
    let assigneeName = "Unassigned";
    const assigneeMatch =
      tRec.explanation.match(/assigned to ([^).,]+)/i) ||
      (linkedRiskRec && linkedRiskRec.explanation.match(/assigned to ([^).,]+)/i));
    if (assigneeMatch && assigneeMatch[1]) {
      assigneeName = assigneeMatch[1].trim();
    } else {
      const devRef = [...(tRec.supporting_references || []), ...(linkedRiskRec?.supporting_references || [])].find(
        (ref) => ref.type === "developer"
      );
      if (devRef) {
        assigneeName = devRef.label.replace(/^Developer:\s*/i, "").split(" ")[0];
      }
    }

    // Extract Due Date
    let dueDate = "Overdue";
    const dueMatch =
      tRec.explanation.match(/by\s+([0-9]{4}-[0-9]{2}-[0-9]{2}(?:T[0-9:]+)?)/i) ||
      tRec.explanation.match(/overdue by\s+([^,.]+)/i);
    if (dueMatch && dueMatch[1]) {
      dueDate = dueMatch[1].trim();
    }

    // Extract Status
    let status = "Delayed";
    const statusMatch = tRec.explanation.match(/in\s+([A-Z_]+)\s+state/i);
    if (statusMatch && statusMatch[1]) {
      status = statusMatch[1].trim();
    }

    // Risk details
    const hasRisk = Boolean(linkedRiskRec || linkedDbRisk);
    const riskSeverity =
      linkedDbRisk?.severity ||
      (linkedRiskRec && /critical/i.test(linkedRiskRec.title) ? "Critical" : "High") ||
      "Schedule";
    const riskTitle =
      linkedRiskRec?.title.replace(/^Resolve\s+(Critical|High|Medium|Low)\s+Risk:\s*/i, "") ||
      linkedDbRisk?.title ||
      (hasRisk ? "Delivery Risk" : "Schedule Lag");
    const riskId = linkedRiskRec?.actionable_entity_id || linkedRiskRec?.id || linkedDbRisk?.id;
    const riskDetails =
      linkedRiskRec?.why_it_matters ||
      linkedDbRisk?.description ||
      (hasRisk
        ? "Threatens sprint delivery and applies deterministic health score deduction."
        : "Past due date applies an unmitigated penalty (-3 pts) to project health score.");

    // Practical, specific recommended action
    let action = "";
    if (hasRisk && assigneeName !== "Unassigned") {
      action = `Resolve ${riskTitle} with ${assigneeName}: verify root cause and system dependencies, unblock the pull request review, and adjust target milestone to avert further health deductions.`;
    } else if (hasRisk) {
      action = `Assign an owner immediately to resolve ${riskTitle} on ${taskTitle}, inspect blocking infrastructure, and re-estimate delivery schedule.`;
    } else if (assigneeName !== "Unassigned") {
      action = `Conduct an urgent check-in with ${assigneeName} on ${taskTitle}: identify delivery bottlenecks, confirm PR status (${status}), and establish a realistic completion date.`;
    } else {
      action = `Assign an available developer with matching skills to ${taskTitle} and set an updated sprint delivery target.`;
    }

    // Combine Supporting References
    const refMap = new Map<string, SupportingReference>();
    (tRec.supporting_references || []).forEach((r) => refMap.set(`${r.type}:${r.id}`, r));
    (linkedRiskRec?.supporting_references || []).forEach((r) => refMap.set(`${r.type}:${r.id}`, r));
    if (hasRisk && riskId && !refMap.has(`risk:${riskId}`)) {
      refMap.set(`risk:${riskId}`, { type: "risk", id: riskId, label: `${riskSeverity} Risk: ${riskTitle}` });
    }
    if (!refMap.has(`task:${taskId}`)) {
      refMap.set(`task:${taskId}`, { type: "task", id: taskId, label: `Task: ${taskTitle}` });
    }

    // Assumptions
    const assumptions: string[] = [];
    if (tRec.missing_info_or_assumptions) assumptions.push(tRec.missing_info_or_assumptions);
    if (
      linkedRiskRec?.missing_info_or_assumptions &&
      linkedRiskRec.missing_info_or_assumptions !== tRec.missing_info_or_assumptions
    ) {
      assumptions.push(linkedRiskRec.missing_info_or_assumptions);
    }

    // Methodologies
    const methodologies: string[] = [];
    if (tRec.confidence_rationale) methodologies.push(tRec.confidence_rationale);
    if (
      linkedRiskRec?.confidence_rationale &&
      linkedRiskRec.confidence_rationale !== tRec.confidence_rationale
    ) {
      methodologies.push(linkedRiskRec.confidence_rationale);
    }

    unifiedOverdueTasks.push({
      key: `unified-task-${taskId}`,
      taskId,
      taskTitle,
      assigneeName,
      dueDate,
      status,
      hasRisk,
      riskId,
      riskTitle,
      riskSeverity,
      riskDetails,
      specificRecommendedAction: action,
      taskRec: tRec,
      riskRec: linkedRiskRec,
      evidenceReferences: Array.from(refMap.values()),
      assumptions,
      methodologies,
      confidence: tRec.confidence || linkedRiskRec?.confidence || "High",
    });
  });

  // 2. Process any risk mitigation recommendations tied to a task not yet unified
  riskMitigationRecs.forEach((rRec) => {
    if (claimedRiskRecIds.has(rRec.id)) return;
    const tInfo = getTaskInfoFromRec(rRec);
    if (!tInfo) return; // Standalone risk

    const existing = unifiedOverdueTasks.find(
      (u) => u.taskId === tInfo.id || u.taskTitle.toLowerCase() === tInfo.label.toLowerCase()
    );
    if (existing) {
      claimedRiskRecIds.add(rRec.id);
      return;
    }

    claimedRiskRecIds.add(rRec.id);
    const taskId = tInfo.id;
    const taskTitle = tInfo.label;
    const riskSeverity = /critical/i.test(rRec.title) ? "Critical" : "High";
    const riskTitle = rRec.title.replace(/^Resolve\s+(Critical|High|Medium|Low)\s+Risk:\s*/i, "");
    const riskId = rRec.actionable_entity_id || rRec.id;

    let assigneeName = "Unassigned";
    const match = rRec.explanation.match(/assigned to ([^).,]+)/i);
    if (match && match[1]) assigneeName = match[1].trim();

    unifiedOverdueTasks.push({
      key: `unified-risk-task-${taskId}`,
      taskId,
      taskTitle,
      assigneeName,
      dueDate: "Overdue",
      status: "Delayed",
      hasRisk: true,
      riskId,
      riskTitle,
      riskSeverity,
      riskDetails: rRec.why_it_matters || rRec.explanation,
      specificRecommendedAction: `Execute urgent mitigation on ${riskTitle} with ${assigneeName}: resolve delivery blocker, confirm test passes, and reset sprint timeline.`,
      riskRec: rRec,
      evidenceReferences: rRec.supporting_references || [],
      assumptions: rRec.missing_info_or_assumptions ? [rRec.missing_info_or_assumptions] : [],
      methodologies: rRec.confidence_rationale ? [rRec.confidence_rationale] : [],
      confidence: rRec.confidence || "High",
    });
  });

  // Standalone risk recommendations (not tied to an overdue task)
  const standaloneRiskRecs = riskMitigationRecs.filter((r) => !claimedRiskRecIds.has(r.id));

  // Top summary metrics
  const dbHighRisks = projectRisks.filter((r) => r.severity === "Critical" || r.severity === "High");
  const totalHighRiskCount = Math.max(dbHighRisks.length, riskMitigationRecs.length);
  const totalOverdueTaskCount = Math.max(overdueTasks, unifiedOverdueTasks.length);

  // GitHub Context from briefing if present
  const githubContext = briefing?.sections?.github_context;
  const isGitHubConfigured = Boolean(githubContext?.is_configured);

  return (
    <div className="space-y-6 animate-fade-in" role="main" aria-label="Project Pulse Dashboard">
      {/* Top Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-surface-800/80">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-surface-100 flex items-center gap-2">
              <span>Project Pulse</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping inline-block" title="Live System Pulse"></span>
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary-500/15 text-primary-300 border border-primary-500/30 font-medium">
              PM Command Center
            </span>
          </div>
          <p className="text-surface-400 text-sm mt-1">
            Real-time health, executive briefings, risk radar, and AI recovery recommendations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {lastUpdated && (
            <span className="text-xs text-surface-400 bg-surface-800/60 px-2.5 py-1 rounded-lg border border-surface-700/50">
              {isRefreshing ? "Refreshing..." : `Updated: ${lastUpdated.toLocaleTimeString()}`}
            </span>
          )}
          <select
            value={selectedProjectId}
            onChange={(e) => handleProjectSelect(e.target.value)}
            className="input-field max-w-xs text-sm py-2"
            aria-label="Select Project"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => loadData(true)}
            disabled={loading || isRefreshing}
            className="btn-secondary px-3 py-2 text-sm flex items-center gap-1.5 shrink-0"
            title="Refresh dashboard data"
            aria-label="Refresh Project Pulse data"
          >
            <svg
              className={`w-4 h-4 ${isRefreshing ? "animate-spin text-primary-400" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span className="hidden sm:inline">{isRefreshing ? "Refreshing" : "Refresh"}</span>
          </button>
        </div>
      </header>

      {/* Partial Data Notice Banner when completeness is not High or Gaps exist */}
      {health.data_completeness !== "High" && (
        <section
          className="p-3.5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-start gap-3 text-xs text-yellow-300"
          role="region"
          aria-label="Partial Data Warning"
        >
          <svg className="w-5 h-5 shrink-0 text-yellow-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <p className="font-semibold text-yellow-200">System Telemetry Advisory</p>
            <p className="mt-0.5 leading-relaxed">
              Project data completeness is marked as <strong>{health.data_completeness}</strong>. Calculated metrics strictly incorporate all available ground truth records while omitting unconfigured external integrations.
            </p>
          </div>
        </section>
      )}

      {/* Row 1: Executive KPI Cards (Health Score & Task Execution) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health Score Card */}
        <section className="lg:col-span-1 glass-card p-5 flex flex-col justify-between" aria-label="Project Health Score">
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-base font-semibold text-surface-100 flex items-center gap-2">
                <span>Health Score</span>
                <span className="text-[10px] text-surface-400 uppercase tracking-wider font-mono">(Deterministic)</span>
              </h3>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${healthStatus.bg} ${healthStatus.color}`}>
                {healthStatus.label}
              </span>
            </div>

            {/* Circular Gauge Meter */}
            <div className="flex items-center justify-center py-4 border-y border-surface-700/40">
              <div className="relative flex items-center justify-center">
                <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 90 90">
                  <circle
                    cx="45"
                    cy="45"
                    r="38"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-surface-700/40"
                    fill="transparent"
                  />
                  <circle
                    cx="45"
                    cy="45"
                    r="38"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeDasharray={238.76}
                    strokeDashoffset={238.76 - (score / 100) * 238.76}
                    strokeLinecap="round"
                    className={score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-red-400"}
                    fill="transparent"
                  />
                </svg>
                <div className="absolute text-center flex flex-col items-center">
                  <span className={`text-4xl font-extrabold ${score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-red-400"}`}>
                    {score}
                  </span>
                  <span className="text-[11px] text-surface-400 font-medium -mt-1">out of 100</span>
                </div>
              </div>
            </div>

            {/* Explanation & Factor Deductions */}
            <div className="mt-4 space-y-2.5">
              <div className="flex justify-between items-center text-xs text-surface-300">
                <span className="font-semibold">Health Deductions:</span>
                <span className="text-surface-400">Completeness: {health.data_completeness}</span>
              </div>

              {deductions.length === 0 ? (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-400 flex items-center gap-2">
                  <span>✓</span>
                  <span>No active deductions. Project delivery on track.</span>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {deductions.map((d, i) => (
                    <div key={i} className="flex justify-between items-center text-xs p-1.5 bg-surface-900/50 rounded border border-surface-700/30">
                      <span className="text-surface-300 truncate max-w-[200px]" title={d.reason}>{d.reason}</span>
                      <span className="text-red-400 font-bold ml-2">-{d.amount}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="text-[11px] text-surface-500 mt-4 pt-3 border-t border-surface-700/30 leading-relaxed">
            Calculated deterministically from open workflow risks and overdue milestones without AI hallucination.
          </p>
        </section>

        {/* Task Progress & Full Status Distribution Card */}
        <section className="lg:col-span-2 glass-card p-5 flex flex-col justify-between" aria-label="Task Execution and Status Distribution">
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
              <div>
                <h3 className="text-base font-semibold text-surface-100">Task Execution & Status Distribution</h3>
                <p className="text-xs text-surface-400 mt-0.5">
                  Proportional progress across active, review, completed, and overdue work.
                </p>
              </div>
              <NavLink
                to={`/dashboard/pm-team-tasks?project=${selectedProject.id}`}
                className="text-xs text-primary-400 hover:text-primary-300 font-medium flex items-center gap-1 group py-1"
                ariaLabel="Manage Tasks for this project"
              >
                <span>Manage Tasks</span>
                <span className="transform transition-transform group-hover:translate-x-1">&rarr;</span>
              </NavLink>
            </div>

            {/* Overall Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-surface-300 font-medium">Sprint Completion</span>
                <span className="text-surface-100 font-bold">{selectedProject.progress}% ({completedTasks}/{totalTasks} tasks)</span>
              </div>
              <div className="w-full bg-surface-700/60 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-primary-500 h-2.5 rounded-full transition-all duration-700"
                  style={{ width: `${selectedProject.progress || 0}%` }}
                ></div>
              </div>
            </div>

            {/* Proportional Stacked Status Distribution Bar */}
            <div className="mb-5">
              <p className="text-xs text-surface-400 mb-1.5 font-medium">Status Distribution Bar:</p>
              <div
                className="w-full h-3.5 rounded-lg overflow-hidden flex bg-surface-700/40 border border-surface-600/30"
                role="progressbar"
                aria-label="Task Status Distribution"
                aria-valuenow={selectedProject.progress || 0}
              >
                {totalTasks > 0 ? (
                  <>
                    {completedTasks > 0 && (
                      <div
                        style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
                        className="bg-emerald-500 h-full transition-all duration-500"
                        title={`Completed: ${completedTasks} (${completedPct}%)`}
                      />
                    )}
                    {inProgressTasks > 0 && (
                      <div
                        style={{ width: `${(inProgressTasks / totalTasks) * 100}%` }}
                        className="bg-primary-500 h-full transition-all duration-500"
                        title={`In Progress: ${inProgressTasks} (${inProgressPct}%)`}
                      />
                    )}
                    {reviewTasks > 0 && (
                      <div
                        style={{ width: `${(reviewTasks / totalTasks) * 100}%` }}
                        className="bg-amber-500 h-full transition-all duration-500"
                        title={`In Review: ${reviewTasks} (${reviewPct}%)`}
                      />
                    )}
                    {todoTasks > 0 && (
                      <div
                        style={{ width: `${(todoTasks / totalTasks) * 100}%` }}
                        className="bg-surface-500 h-full transition-all duration-500"
                        title={`Todo: ${todoTasks} (${todoPct}%)`}
                      />
                    )}
                    {overdueTasks > 0 && (
                      <div
                        style={{ width: `${(overdueTasks / totalTasks) * 100}%` }}
                        className="bg-red-500 h-full transition-all duration-500"
                        title={`Overdue: ${overdueTasks} (${overduePct}%)`}
                      />
                    )}
                  </>
                ) : (
                  <div className="w-full h-full bg-surface-700/30 text-[10px] text-surface-500 flex items-center justify-center">
                    No tasks recorded
                  </div>
                )}
              </div>
            </div>

            {/* 5 Responsive Status Metric Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-surface-800/60 p-3 rounded-xl border border-surface-700/50">
                <p className="text-surface-400 text-[11px] uppercase tracking-wider mb-0.5">Total</p>
                <p className="text-xl font-bold text-surface-100">{totalTasks}</p>
                <p className="text-[10px] text-surface-500">100%</p>
              </div>
              <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                <p className="text-emerald-400 text-[11px] uppercase tracking-wider mb-0.5">Completed</p>
                <p className="text-xl font-bold text-emerald-300">{completedTasks}</p>
                <p className="text-[10px] text-emerald-400/80">{completedPct}%</p>
              </div>
              <div className="bg-primary-500/10 p-3 rounded-xl border border-primary-500/20">
                <p className="text-primary-400 text-[11px] uppercase tracking-wider mb-0.5">In Progress</p>
                <p className="text-xl font-bold text-primary-300">{inProgressTasks}</p>
                <p className="text-[10px] text-primary-400/80">{inProgressPct}%</p>
              </div>
              <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                <p className="text-amber-400 text-[11px] uppercase tracking-wider mb-0.5">In Review</p>
                <p className="text-xl font-bold text-amber-300">{reviewTasks}</p>
                <p className="text-[10px] text-amber-400/80">{reviewPct}%</p>
              </div>
              <div className="bg-red-500/10 p-3 rounded-xl border border-red-500/20 col-span-2 sm:col-span-1">
                <p className="text-red-400 text-[11px] uppercase tracking-wider mb-0.5">Overdue</p>
                <p className="text-xl font-bold text-red-300">{overdueTasks}</p>
                <p className="text-[10px] text-red-400/80">{overduePct}%</p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-surface-700/30 flex flex-wrap justify-between items-center text-xs text-surface-400 gap-2">
            <span>
              Unassigned backlog: <strong className="text-surface-200">{unassignedTasksCount} tasks</strong>
            </span>
            <span>
              Schedule: {selectedProject.start_date ? new Date(selectedProject.start_date).toLocaleDateString() : "—"} to {selectedProject.end_date ? new Date(selectedProject.end_date).toLocaleDateString() : "—"}
            </span>
          </div>
        </section>
      </div>

      {/* Row 2: Intelligence & Decision Support Tabs */}
      <div className="space-y-4">
        {/* Tab Navigation */}
        <div className="flex border-b border-surface-700/60 gap-4 overflow-x-auto" aria-label="Pulse Intelligence Views">
          <button
            id="tab-briefing"
            aria-selected={activeTab === "briefing"}
            aria-controls="panel-briefing"
            onClick={() => setActiveTab("briefing")}
            onKeyDown={(e) => handleTabKeyDown(e, "briefing")}
            className={`pb-3 px-3 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap focus:outline-none focus:ring-1 focus:ring-primary-500 rounded-t ${
              activeTab === "briefing"
                ? "border-primary-500 text-primary-300"
                : "border-transparent text-surface-400 hover:text-surface-200"
            }`}
          >
            <span>📄</span>
            <span>Project Briefing</span>
          </button>
          <button
            id="tab-recommendations"
            aria-selected={activeTab === "recommendations"}
            aria-controls="panel-recommendations"
            onClick={() => setActiveTab("recommendations")}
            onKeyDown={(e) => handleTabKeyDown(e, "recommendations")}
            className={`pb-3 px-3 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap focus:outline-none focus:ring-1 focus:ring-primary-500 rounded-t ${
              activeTab === "recommendations"
                ? "border-primary-500 text-primary-300"
                : "border-transparent text-surface-400 hover:text-surface-200"
            }`}
          >
            <span>💡</span>
            <span>Recovery Recommendations</span>
          </button>
        </div>

        {/* TAB 1: EXECUTIVE PROJECT BRIEFING */}
        {activeTab === "briefing" && (
          <div
            id="panel-briefing"
            role="tabpanel"
            aria-labelledby="tab-briefing"
            className="glass-card p-6 border-primary-500/20 bg-surface-900/40 space-y-6"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-surface-700/50">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-bold text-surface-100">Executive Project Briefing</h3>
                  {briefing && (
                    <>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                          briefing.source === "gemini"
                            ? "bg-primary-500/10 text-primary-300 border-primary-500/30"
                            : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                        }`}
                      >
                        {briefing.source === "gemini" ? "AI-Grounded Briefing" : "Safe Deterministic Briefing"}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-surface-800 text-surface-300 border border-surface-700">
                        Completeness: {briefing.health_data_completeness}
                      </span>
                    </>
                  )}
                </div>
                {briefing && (
                  <div className="flex items-center gap-3 text-xs text-surface-400 mt-1">
                    <span>Generated: {new Date(briefing.generated_at).toLocaleTimeString()}</span>
                    <span>•</span>
                    <span>{briefing.data_freshness}</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => loadBriefing(selectedProject.id)}
                disabled={loadingBriefing}
                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-2 shrink-0"
                aria-label="Regenerate Executive Project Briefing"
              >
                {loadingBriefing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin"></div>
                    Generating Briefing...
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Regenerate Briefing
                  </>
                )}
              </button>
            </div>

            {/* AI Notice / Fallback Banner */}
            {briefing?.ai_notice && !isUnavailableOrTimeoutNotice(briefing.ai_notice) && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3 text-xs text-amber-300" role="alert">
                <svg className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-semibold text-amber-200">Advisory Notice</p>
                  <p className="mt-0.5">{briefing.ai_notice}</p>
                </div>
              </div>
            )}

            {/* Partial Data Notice if Completeness is not High */}
            {briefing && briefing.health_data_completeness !== "High" && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-start gap-3 text-xs text-yellow-300">
                <svg className="w-5 h-5 shrink-0 text-yellow-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="font-semibold text-yellow-200">Partial Data Snapshot</p>
                  <p className="mt-0.5">
                    Some schedule dates or repository integrations are not yet fully configured. Briefing certainty is marked as {briefing.health_data_completeness}.
                  </p>
                </div>
              </div>
            )}

            {briefingError && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center" role="alert">
                <p className="text-red-400 text-sm mb-2">{briefingError}</p>
                <button
                  onClick={() => loadBriefing(selectedProject.id)}
                  className="btn-secondary text-xs px-3 py-1"
                  aria-label="Retry loading project briefing"
                >
                  Retry Briefing
                </button>
              </div>
            )}

            {loadingBriefing && !briefing && (
              <div className="flex flex-col items-center justify-center p-12">
                <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-surface-400 text-xs mt-3">Synthesizing 9-section project briefing from verified records...</p>
              </div>
            )}

            {briefing && (
              <div className="space-y-6">
                {/* Grid of the 9 Briefing Sections */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* 1. Health Summary */}
                  <div className="p-4 bg-surface-800/60 rounded-xl border border-surface-700/60 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold text-primary-400 uppercase tracking-wider">1. Project Health</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-surface-700 text-surface-200 font-bold">
                          {briefing.sections.health.score}/100
                        </span>
                      </div>
                      <p className="text-xs text-surface-200 leading-relaxed font-medium">
                        Status: <span className="text-primary-300 font-semibold">{briefing.sections.health.status}</span>
                      </p>
                      <p className="text-xs text-surface-300 mt-1.5 leading-relaxed">{briefing.sections.health.explanation}</p>
                    </div>
                    {briefing.sections.health.factors.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-surface-700/40 text-[11px] text-surface-400">
                        <p className="font-semibold text-surface-300 mb-1">Key Factors:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                          {briefing.sections.health.factors.map((f, i) => (
                            <li key={i} className="truncate">{f}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* 2. Completed Work */}
                  <div className="p-4 bg-surface-800/60 rounded-xl border border-surface-700/60 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">2. Completed Work</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-bold">
                          {briefing.sections.completed_work.tasks_count} Tasks
                        </span>
                      </div>
                      <p className="text-xs text-surface-300 leading-relaxed">{briefing.sections.completed_work.summary}</p>
                    </div>
                    {briefing.sections.completed_work.task_titles.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-surface-700/40 text-[11px] text-surface-400 flex flex-wrap gap-1">
                        {briefing.sections.completed_work.task_titles.slice(0, 3).map((t, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-green-500/10 text-green-300 rounded border border-green-500/20 truncate max-w-[180px]">
                            ✓ {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 3. In-Progress & Pending Work */}
                  <div className="p-4 bg-surface-800/60 rounded-xl border border-surface-700/60 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">3. In-Progress & Queued</span>
                        <div className="flex gap-1">
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {briefing.sections.in_progress_and_pending.in_progress_count} Active
                          </span>
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-surface-700 text-surface-300">
                            {briefing.sections.in_progress_and_pending.todo_count} TODO
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-surface-300 leading-relaxed">{briefing.sections.in_progress_and_pending.summary}</p>
                    </div>
                    {briefing.sections.in_progress_and_pending.in_progress_tasks.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-surface-700/40 text-[11px] text-surface-400">
                        <p className="font-semibold text-surface-300 mb-1">Active Items:</p>
                        <p className="truncate text-blue-300">{briefing.sections.in_progress_and_pending.in_progress_tasks.slice(0, 2).join(", ")}</p>
                      </div>
                    )}
                  </div>

                  {/* 4. Overdue or Blocked Work */}
                  <div className="p-4 bg-surface-800/60 rounded-xl border border-surface-700/60 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">4. Overdue & Blocked</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${
                          briefing.sections.overdue_or_blocked.count > 0
                            ? "bg-red-500/10 text-red-400 border-red-500/20"
                            : "bg-surface-700 text-surface-400 border-surface-600"
                        }`}>
                          {briefing.sections.overdue_or_blocked.count}
                        </span>
                      </div>
                      <p className="text-xs text-surface-300 leading-relaxed">{briefing.sections.overdue_or_blocked.summary}</p>
                    </div>
                    {briefing.sections.overdue_or_blocked.items.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-surface-700/40 text-[11px] text-red-300 space-y-0.5">
                        {briefing.sections.overdue_or_blocked.items.slice(0, 2).map((item, i) => (
                          <p key={i} className="truncate">⚠️ {item}</p>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 5. Unresolved Critical & High Risks */}
                  <div className="p-4 bg-surface-800/60 rounded-xl border border-surface-700/60 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">5. Unresolved Risks</span>
                        <div className="flex gap-1">
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-bold">
                            {briefing.sections.unresolved_risks.critical_count} Crit
                          </span>
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                            {briefing.sections.unresolved_risks.high_count} High
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-surface-300 leading-relaxed">{briefing.sections.unresolved_risks.summary}</p>
                    </div>
                    {briefing.sections.unresolved_risks.items.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-surface-700/40 text-[11px] text-red-300 space-y-0.5">
                        {briefing.sections.unresolved_risks.items.slice(0, 2).map((r, i) => (
                          <p key={i} className="truncate">🚨 {r}</p>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 6. Recent Activity */}
                  <div className="p-4 bg-surface-800/60 rounded-xl border border-surface-700/60 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">6. Recent Activity</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          {briefing.sections.recent_activity.items.length} Logs
                        </span>
                      </div>
                      <p className="text-xs text-surface-300 leading-relaxed">{briefing.sections.recent_activity.summary}</p>
                    </div>
                    {briefing.sections.recent_activity.items.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-surface-700/40 text-[11px] text-surface-400 space-y-0.5">
                        {briefing.sections.recent_activity.items.slice(0, 2).map((a, i) => (
                          <p key={i} className="truncate">• {a}</p>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 7. GitHub Context */}
                  <div className="p-4 bg-surface-800/60 rounded-xl border border-surface-700/60 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold text-surface-300 uppercase tracking-wider">7. GitHub Context</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
                          briefing.sections.github_context.is_configured
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-surface-700 text-surface-400 border-surface-600"
                        }`}>
                          {briefing.sections.github_context.is_configured ? "Connected" : "Not Connected"}
                        </span>
                      </div>
                      <p className="text-xs text-surface-300 leading-relaxed">{briefing.sections.github_context.summary}</p>
                    </div>
                    {briefing.sections.github_context.is_configured && (
                      <div className="mt-3 pt-2 border-t border-surface-700/40 flex justify-between text-[11px] text-surface-400">
                        <span>Commits: {briefing.sections.github_context.recent_commits_count}</span>
                        <span>PRs: {briefing.sections.github_context.open_prs_count}</span>
                        <span>Branches: {briefing.sections.github_context.branches_count}</span>
                      </div>
                    )}
                  </div>

                  {/* 8. Recommended Next Actions */}
                  <div className="p-4 bg-surface-800/60 rounded-xl border border-surface-700/60 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">8. Next Actions</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {briefing.sections.recommended_next_actions.actions.length} Priorities
                        </span>
                      </div>
                      <p className="text-xs text-surface-300 leading-relaxed">{briefing.sections.recommended_next_actions.summary}</p>
                    </div>
                    {briefing.sections.recommended_next_actions.actions.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-surface-700/40 text-[11px] text-emerald-300 space-y-1">
                        {briefing.sections.recommended_next_actions.actions.map((act, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <span className="text-emerald-400 shrink-0">→</span>
                            <span className="truncate">{act}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 9. Data Gaps & Reliability Limitations */}
                  <div className="p-4 bg-surface-800/60 rounded-xl border border-surface-700/60 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">9. Data Gaps</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          briefing.sections.data_gaps.gaps.length > 0
                            ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        }`}>
                          {briefing.sections.data_gaps.gaps.length > 0 ? `${briefing.sections.data_gaps.gaps.length} Gaps` : "Complete"}
                        </span>
                      </div>
                      <p className="text-xs text-surface-300 leading-relaxed">{briefing.sections.data_gaps.reliability_impact}</p>
                    </div>
                    {briefing.sections.data_gaps.gaps.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-surface-700/40 text-[11px] text-yellow-300/80 space-y-0.5">
                        {briefing.sections.data_gaps.gaps.slice(0, 2).map((g, i) => (
                          <p key={i} className="truncate">• {g}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Safeguard Notice */}
                <div className="p-3 bg-surface-800/30 rounded-lg border border-surface-700/30 text-[11px] text-surface-400 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <span>
                    🛡️ <strong>Source Facts Safeguard:</strong> This briefing strictly distinguishes source ground truth from AI synthesis. Missing GitHub context is not treated as project failure. Task completion is determined solely by recorded DevFlow task statuses.
                  </span>
                  <span className="text-[10px] text-surface-500 shrink-0">
                    Deterministic Health: {briefing.health_score}/100
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: RECOVERY RECOMMENDATIONS */}
        {activeTab === "recommendations" && (
          <div
            id="panel-recommendations"
            role="tabpanel"
            aria-labelledby="tab-recommendations"
            className="glass-card p-6 border-primary-500/20 bg-surface-900/40"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 pb-4 border-b border-surface-700/50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-surface-100">Recovery Recommendations</h3>
                  {recommendations && (
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                        recommendations.source === "gemini"
                          ? "bg-primary-500/10 text-primary-300 border-primary-500/30"
                          : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                      }`}
                    >
                      {recommendations.source === "gemini" ? "AI-Grounded Plan" : "Safe Deterministic Plan"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-surface-400 mt-1">
                  Practical, evidence-grounded guidance to resolve risks and optimize project recovery.
                </p>
              </div>

              <button
                onClick={() => loadRecommendations(selectedProject.id)}
                disabled={loadingRecs}
                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-2 shrink-0"
                aria-label="Re-evaluate Recovery Plan"
              >
                {loadingRecs ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin"></div>
                    Analyzing Evidence...
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Re-evaluate Plan
                  </>
                )}
              </button>
            </div>

            {/* AI Notice / Fallback Banner */}
            {recommendations?.ai_notice && !isUnavailableOrTimeoutNotice(recommendations.ai_notice) && (
              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3 text-xs text-amber-300" role="alert">
                <svg className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-semibold text-amber-200">Advisory Notice</p>
                  <p className="mt-0.5">{recommendations.ai_notice}</p>
                </div>
              </div>
            )}

            {recsError && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center" role="alert">
                <p className="text-red-400 text-sm mb-2">{recsError}</p>
                <button
                  onClick={() => loadRecommendations(selectedProject.id)}
                  className="btn-secondary text-xs px-3 py-1"
                  aria-label="Retry loading recovery recommendations"
                >
                  Retry Analysis
                </button>
              </div>
            )}

            {loadingRecs && !recommendations && (
              <div className="flex flex-col items-center justify-center p-8">
                <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-surface-400 text-xs mt-3">Synthesizing project evidence & recovery paths...</p>
              </div>
            )}

            {recommendations && (
              <div className="space-y-5">
                {recommendations.recommendations.length === 0 ? (
                  <p className="text-surface-400 text-sm italic text-center py-6">
                    No active recovery blockers detected. Project health is on track.
                  </p>
                ) : (
                  <>
                    {/* ─────────────────────────────────────────────────────────── */}
                    {/* TOP SUMMARY METRICS: TOTAL HIGH-RISK & OVERDUE TASKS COUNTS */}
                    {/* ─────────────────────────────────────────────────────────── */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* High-Risk Items Metric */}
                      <div className="p-4 rounded-xl bg-surface-900/60 border border-rose-500/30 flex items-center justify-between shadow-sm">
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                            <span>🚨</span> Total High-Risk Items
                          </p>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-extrabold text-surface-100">
                              {totalHighRiskCount}
                            </span>
                            <span className="text-xs text-surface-400">
                              {totalHighRiskCount === 1 ? "high-risk item" : "high-risk items"}
                            </span>
                          </div>
                          <p className="text-[11px] text-surface-400">
                            Critical & high severity delivery risks across sprint scope
                          </p>
                        </div>
                        <NavLink
                          to={`/dashboard/pm-workflow-risks?project=${encodeURIComponent(selectedProject.name)}`}
                          className="text-xs px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-medium shrink-0"
                          title="Inspect all project risks in Risk Radar"
                        >
                          Risk Radar →
                        </NavLink>
                      </div>

                      {/* Overdue Tasks Metric */}
                      <div className="p-4 rounded-xl bg-surface-900/60 border border-amber-500/30 flex items-center justify-between shadow-sm">
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                            <span>⏱️</span> Total Overdue Tasks
                          </p>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-extrabold text-surface-100">
                              {totalOverdueTaskCount}
                            </span>
                            <span className="text-xs text-surface-400">
                              {totalOverdueTaskCount === 1 ? "overdue task" : "overdue tasks"}
                            </span>
                          </div>
                          <p className="text-[11px] text-surface-400">
                            Tasks past due date consolidated into single recovery actions
                          </p>
                        </div>
                        <NavLink
                          to={`/dashboard/pm-team-tasks?project=${selectedProject.id}`}
                          className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium shrink-0"
                          title="Inspect all team tasks"
                        >
                          Team Tasks →
                        </NavLink>
                      </div>
                    </div>

                    {/* ─────────────────────────────────────────────────────────── */}
                    {/* UNIFIED OVERDUE TASKS (ONE CARD PER OVERDUE TASK)           */}
                    {/* ─────────────────────────────────────────────────────────── */}
                    {unifiedOverdueTasks.length > 0 && (
                      <div className="space-y-3 pt-1">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1.5 border-b border-surface-800">
                          <div>
                            <h4 className="text-sm font-bold text-surface-200 flex items-center gap-2">
                              <span>⏱️</span>
                              <span>Overdue Task Recovery Actions</span>
                              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                                {unifiedOverdueTasks.length} {unifiedOverdueTasks.length === 1 ? "Overdue Task" : "Overdue Tasks"}
                              </span>
                            </h4>
                            <p className="text-[11px] text-surface-400 mt-0.5">
                              Each overdue task displayed only once, combining risk info, assigned developer, due date, status, and targeted recovery action.
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {unifiedOverdueTasks.map((task) => (
                            <div
                              key={task.key}
                              className="p-5 bg-surface-900/70 rounded-xl border border-amber-500/30 flex flex-col justify-between hover:border-amber-500/50 transition-colors shadow-sm"
                            >
                              <div className="space-y-3.5">
                                {/* Top Badges */}
                                <div className="flex flex-wrap justify-between items-start gap-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 tracking-wide uppercase">
                                      Overdue Task
                                    </span>
                                    {task.hasRisk && (
                                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 tracking-wide uppercase">
                                        🚨 {task.riskSeverity} Risk Linked
                                      </span>
                                    )}
                                  </div>
                                  <span
                                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getConfidenceBadgeClass(task.confidence)}`}
                                  >
                                    {task.confidence} Confidence
                                  </span>
                                </div>

                                {/* Task Title & Context */}
                                <div>
                                  <h4 className="text-base font-semibold text-surface-100 flex items-center gap-2">
                                    <span>Review Overdue Task: {task.taskTitle}</span>
                                  </h4>
                                  {task.taskRec && (
                                    <p className="text-xs text-surface-300 mt-1 leading-relaxed">
                                      {task.taskRec.explanation}
                                    </p>
                                  )}
                                </div>

                                {/* Developer, Due Date, Status Metadata */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-lg bg-surface-800/60 border border-surface-700/50 text-xs">
                                  <div>
                                    <span className="text-[10px] text-surface-500 uppercase tracking-wider block font-medium">Assigned Developer</span>
                                    <span className="text-surface-200 font-semibold flex items-center gap-1.5 mt-0.5">
                                      <span>👤</span>
                                      <span>{task.assigneeName}</span>
                                    </span>
                                  </div>

                                  <div>
                                    <span className="text-[10px] text-surface-500 uppercase tracking-wider block font-medium">Target Due Date</span>
                                    <span className="text-amber-400 font-semibold flex items-center gap-1.5 mt-0.5">
                                      <span>📅</span>
                                      <span>{task.dueDate}</span>
                                    </span>
                                  </div>

                                  <div>
                                    <span className="text-[10px] text-surface-500 uppercase tracking-wider block font-medium">Task Status</span>
                                    <span className="text-surface-200 font-semibold flex items-center gap-1.5 mt-0.5">
                                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                                      <span>{task.status}</span>
                                    </span>
                                  </div>
                                </div>

                                {/* Combined Risk Information Block */}
                                <div className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                                  task.hasRisk
                                    ? "bg-rose-500/10 border-rose-500/25 text-rose-200"
                                    : "bg-surface-800/40 border-surface-700/40 text-surface-300"
                                }`}>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold flex items-center gap-1.5">
                                      <span>{task.hasRisk ? "🚨" : "⏱️"}</span>
                                      <span className={task.hasRisk ? "text-rose-300 font-bold" : "text-surface-300"}>
                                        {task.hasRisk
                                          ? `Resolve ${task.riskSeverity} Risk: ${task.riskTitle}`
                                          : `Schedule Risk: ${task.riskTitle}`}
                                      </span>
                                    </span>

                                    {task.riskId && (
                                      <NavLink
                                        to={getReferenceLink("risk", task.riskId)}
                                        className="text-[11px] underline text-rose-300 hover:text-rose-100 shrink-0 font-medium"
                                        title={`Inspect risk details: ${task.riskTitle}`}
                                      >
                                        Inspect Risk →
                                      </NavLink>
                                    )}
                                  </div>
                                  <p className="text-[11px] leading-relaxed text-surface-300">
                                    {task.riskDetails}
                                  </p>
                                </div>

                                {/* Specific Recommended Action */}
                                <div className="p-3 rounded-lg bg-primary-500/10 border border-primary-500/20 text-xs space-y-1">
                                  <span className="font-bold text-primary-300 flex items-center gap-1.5">
                                    <span>⚡</span>
                                    <span>Specific Recommended Action:</span>
                                  </span>
                                  <p className="text-surface-200 leading-relaxed text-[11px]">
                                    {task.specificRecommendedAction}
                                  </p>
                                </div>

                                {/* Navigation Action Links */}
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                  <NavLink
                                    to={getReferenceLink("task", task.taskId)}
                                    className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 hover:text-primary-300"
                                    title={`View task details: ${task.taskTitle}`}
                                  >
                                    <span>📋</span>
                                    <span>View Task →</span>
                                  </NavLink>
                                  {task.riskId && (
                                    <NavLink
                                      to={getReferenceLink("risk", task.riskId)}
                                      className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 hover:text-rose-300 text-rose-200 border-rose-500/30"
                                      title={`Inspect risk details: ${task.riskTitle}`}
                                    >
                                      <span>🚨</span>
                                      <span>Inspect Risk Details →</span>
                                    </NavLink>
                                  )}
                                </div>

                                {/* Expandable Section: Evidence, Assumptions & Method */}
                                <div className="pt-2 border-t border-surface-700/40">
                                  <button
                                    type="button"
                                    onClick={() => toggleCardExpanded(task.taskId)}
                                    className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1.5 font-medium transition-colors focus:outline-none"
                                    aria-expanded={expandedCardIds[task.taskId] ?? true}
                                  >
                                    <span>
                                      {(expandedCardIds[task.taskId] ?? true)
                                        ? "▲ Hide Evidence & Assumptions"
                                        : "▼ View Evidence & Assumptions"}
                                    </span>
                                    <span className="text-[10px] text-surface-500">
                                      ({task.evidenceReferences.length} evidence links)
                                    </span>
                                  </button>

                                  {(expandedCardIds[task.taskId] ?? true) && (
                                    <div className="mt-3 p-3 bg-surface-950/60 rounded-lg border border-surface-700/50 space-y-2.5 text-xs">
                                      {/* Supporting Evidence */}
                                      {task.evidenceReferences.length > 0 && (
                                        <div>
                                          <span className="text-[11px] font-semibold text-surface-400 block mb-1.5">
                                            Supporting References & Evidence:
                                          </span>
                                          <div className="flex flex-wrap gap-1.5 items-center">
                                            {task.evidenceReferences.map((ref, idx) => (
                                              <NavLink
                                                key={idx}
                                                to={getReferenceLink(ref.type, ref.id)}
                                                className="text-[11px] px-2 py-0.5 rounded bg-surface-800 text-surface-300 border border-surface-600/50 flex items-center gap-1 hover:border-primary-500/50 hover:text-primary-300 transition-colors"
                                                title={`Inspect ${ref.type}: ${ref.label}`}
                                              >
                                                <span>{getReferenceIcon(ref.type)}</span>
                                                <span className="truncate max-w-[200px]">{ref.label}</span>
                                              </NavLink>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Assumptions */}
                                      {task.assumptions.length > 0 && (
                                        <div>
                                          <span className="text-[11px] font-semibold text-yellow-400/90 block mb-0.5">
                                            Assumptions:
                                          </span>
                                          <ul className="list-disc list-inside text-[11px] text-surface-400 space-y-0.5 italic">
                                            {task.assumptions.map((assump, idx) => (
                                              <li key={idx}>{assump}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}

                                      {/* Methodology */}
                                      {task.methodologies.length > 0 && (
                                        <div className="pt-2 border-t border-surface-800/80 flex flex-wrap items-center justify-between text-[10px] text-surface-500 gap-2">
                                          <span><strong>Method:</strong> {task.methodologies.join(" • ")}</span>
                                          <span className="font-semibold text-surface-400">{task.confidence} Confidence</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ─────────────────────────────────────────────────────────── */}
                    {/* STANDALONE CRITICAL & HIGH-SEVERITY RISKS                    */}
                    {/* ─────────────────────────────────────────────────────────── */}
                    {standaloneRiskRecs.length > 0 && (
                      <div className="space-y-3 pt-1">
                        <div className="flex items-center justify-between pb-1.5 border-b border-surface-800">
                          <h4 className="text-sm font-bold text-surface-200 flex items-center gap-2">
                            <span>🚨</span>
                            <span>Critical & High-Severity Risks</span>
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">
                              {standaloneRiskRecs.length} {standaloneRiskRecs.length === 1 ? "Risk" : "Risks"}
                            </span>
                          </h4>
                          <NavLink
                            to={`/dashboard/pm-workflow-risks?project=${encodeURIComponent(selectedProject.name)}`}
                            className="text-xs text-rose-300 hover:text-rose-200 flex items-center gap-1 font-medium"
                          >
                            Risk Radar →
                          </NavLink>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {standaloneRiskRecs.map((rec) => (
                            <div
                              key={rec.id}
                              className="p-4 bg-surface-800/60 rounded-xl border border-rose-500/30 flex flex-col justify-between hover:border-rose-500/50 transition-colors shadow-sm"
                            >
                              <div>
                                <div className="flex justify-between items-start gap-2 mb-2">
                                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${getCategoryBadgeClass(rec.category)}`}>
                                    {rec.category.replace(/_/g, " ")}
                                  </span>
                                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getConfidenceBadgeClass(rec.confidence)}`}>
                                    {rec.confidence} Confidence
                                  </span>
                                </div>

                                <h4 className="text-sm font-semibold text-surface-100">{rec.title}</h4>
                                <p className="text-xs text-surface-300 mt-1.5 leading-relaxed">{rec.explanation}</p>

                                <div className="mt-3 p-2.5 bg-surface-900/60 rounded-lg border border-surface-700/40 text-xs">
                                  <span className="font-semibold text-rose-300">Why it matters: </span>
                                  <span className="text-surface-300">{rec.why_it_matters}</span>
                                </div>

                                <div className="pt-2 border-t border-surface-700/40 mt-3">
                                  <button
                                    type="button"
                                    onClick={() => toggleCardExpanded(rec.id)}
                                    className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1.5 font-medium transition-colors focus:outline-none"
                                    aria-expanded={expandedCardIds[rec.id] ?? true}
                                  >
                                    <span>
                                      {(expandedCardIds[rec.id] ?? true)
                                        ? "▲ Hide Evidence & Assumptions"
                                        : "▼ View Evidence & Assumptions"}
                                    </span>
                                  </button>

                                  {(expandedCardIds[rec.id] ?? true) && (
                                    <div className="mt-2.5 p-2.5 bg-surface-950/60 rounded-lg border border-surface-700/50 space-y-2 text-xs">
                                      {rec.supporting_references && rec.supporting_references.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 items-center">
                                          <span className="text-[11px] text-surface-500 mr-1">Evidence:</span>
                                          {rec.supporting_references.map((ref, idx) => (
                                            <NavLink
                                              key={idx}
                                              to={getReferenceLink(ref.type, ref.id)}
                                              className="text-[11px] px-2 py-0.5 rounded bg-surface-800 text-surface-300 border border-surface-600/50 flex items-center gap-1 hover:border-primary-500/50 hover:text-primary-300 transition-colors"
                                              title={`Inspect ${ref.type}: ${ref.label}`}
                                            >
                                              <span>{getReferenceIcon(ref.type)}</span>
                                              <span className="truncate max-w-[180px]">{ref.label}</span>
                                            </NavLink>
                                          ))}
                                        </div>
                                      )}

                                      {rec.missing_info_or_assumptions && (
                                        <p className="text-[11px] text-surface-400 italic">
                                          <span className="text-yellow-400/90 not-italic font-medium">Assumptions: </span>
                                          {rec.missing_info_or_assumptions}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="mt-3 pt-2.5 border-t border-surface-700/30 flex justify-between items-center text-[10px] text-surface-500">
                                <span>Method: {rec.confidence_rationale}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ─────────────────────────────────────────────────────────── */}
                    {/* PRIORITY 3: ALLOCATION OPPORTUNITIES (DISTINCT CARDS)        */}
                    {/* ─────────────────────────────────────────────────────────── */}
                    {allocationRecs.length > 0 && (
                      <div className="space-y-3 pt-1">
                        <div className="flex items-center justify-between pb-1.5 border-b border-surface-800">
                          <h4 className="text-sm font-bold text-surface-200 flex items-center gap-2">
                            <span>💡</span>
                            <span>Developer Allocation Opportunities</span>
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                              {allocationRecs.length} {allocationRecs.length === 1 ? "Opportunity" : "Opportunities"}
                            </span>
                          </h4>
                          <NavLink
                            to={`/dashboard/pm-smart-allocation?project=${selectedProject.id}`}
                            className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 font-medium"
                          >
                            Smart Allocation Studio →
                          </NavLink>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {allocationRecs.map((rec) => (
                            <div
                              key={rec.id}
                              className="p-4 bg-surface-800/60 rounded-xl border border-blue-500/30 flex flex-col justify-between hover:border-blue-500/50 transition-colors shadow-sm"
                            >
                              <div>
                                <div className="flex justify-between items-start gap-2 mb-2">
                                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border bg-blue-500/10 text-blue-400 border-blue-500/20">
                                    ALLOCATION OPPORTUNITY
                                  </span>
                                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getConfidenceBadgeClass(rec.confidence)}`}>
                                    {rec.confidence} Confidence
                                  </span>
                                </div>

                                <h4 className="text-sm font-semibold text-surface-100">{rec.title}</h4>
                                <p className="text-xs text-surface-300 mt-1.5 leading-relaxed">{rec.explanation}</p>

                                <div className="mt-3 p-2.5 bg-surface-900/60 rounded-lg border border-surface-700/40 text-xs">
                                  <span className="font-semibold text-primary-400">Why it matters: </span>
                                  <span className="text-surface-300">{rec.why_it_matters}</span>
                                </div>

                                {rec.supporting_references && rec.supporting_references.length > 0 && (
                                  <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                                    <span className="text-[11px] text-surface-500 mr-1">Evidence:</span>
                                    {rec.supporting_references.map((ref, idx) => (
                                      <NavLink
                                        key={idx}
                                        to={getReferenceLink(ref.type, ref.id)}
                                        className="text-[11px] px-2 py-0.5 rounded bg-surface-700/60 text-surface-300 border border-surface-600/50 flex items-center gap-1 hover:border-primary-500/50 hover:text-primary-300 transition-colors"
                                        title={`Inspect ${ref.type}: ${ref.label}`}
                                      >
                                        <span>{getReferenceIcon(ref.type)}</span>
                                        <span className="truncate max-w-[180px]">{ref.label}</span>
                                      </NavLink>
                                    ))}
                                  </div>
                                )}

                                {rec.missing_info_or_assumptions && (
                                  <p className="text-[11px] text-surface-500 mt-2.5 italic">
                                    <span className="text-yellow-500/80 not-italic font-medium">Assumptions: </span>
                                    {rec.missing_info_or_assumptions}
                                  </p>
                                )}
                              </div>

                              <div className="mt-3 pt-2.5 border-t border-surface-700/30 flex justify-between items-center text-[10px] text-surface-500">
                                <span>Method: {rec.confidence_rationale}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ─────────────────────────────────────────────────────────── */}
                    {/* OTHER DISTINCT RECOMMENDATIONS                               */}
                    {/* ─────────────────────────────────────────────────────────── */}
                    {otherRecs.length > 0 && (
                      <div className="space-y-3 pt-1">
                        <h4 className="text-sm font-bold text-surface-200 flex items-center gap-2 pb-1.5 border-b border-surface-800">
                          <span>📌</span>
                          <span>Additional Recovery Guidance</span>
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {otherRecs.map((rec) => (
                            <div
                              key={rec.id}
                              className="p-4 bg-surface-800/60 rounded-xl border border-surface-700/60 flex flex-col justify-between hover:border-surface-600 transition-colors shadow-sm"
                            >
                              <div>
                                <div className="flex justify-between items-start gap-2 mb-2">
                                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${getCategoryBadgeClass(rec.category)}`}>
                                    {rec.category.replace(/_/g, " ")}
                                  </span>
                                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getConfidenceBadgeClass(rec.confidence)}`}>
                                    {rec.confidence} Confidence
                                  </span>
                                </div>

                                <h4 className="text-sm font-semibold text-surface-100">{rec.title}</h4>
                                <p className="text-xs text-surface-300 mt-1.5 leading-relaxed">{rec.explanation}</p>

                                <div className="mt-3 p-2.5 bg-surface-900/60 rounded-lg border border-surface-700/40 text-xs">
                                  <span className="font-semibold text-primary-400">Why it matters: </span>
                                  <span className="text-surface-300">{rec.why_it_matters}</span>
                                </div>

                                {rec.supporting_references && rec.supporting_references.length > 0 && (
                                  <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                                    <span className="text-[11px] text-surface-500 mr-1">Evidence:</span>
                                    {rec.supporting_references.map((ref, idx) => (
                                      <NavLink
                                        key={idx}
                                        to={getReferenceLink(ref.type, ref.id)}
                                        className="text-[11px] px-2 py-0.5 rounded bg-surface-700/60 text-surface-300 border border-surface-600/50 flex items-center gap-1 hover:border-primary-500/50 hover:text-primary-300 transition-colors"
                                        title={`Inspect ${ref.type}: ${ref.label}`}
                                      >
                                        <span>{getReferenceIcon(ref.type)}</span>
                                        <span className="truncate max-w-[180px]">{ref.label}</span>
                                      </NavLink>
                                    ))}
                                  </div>
                                )}

                                {rec.missing_info_or_assumptions && (
                                  <p className="text-[11px] text-surface-500 mt-2.5 italic">
                                    <span className="text-yellow-500/80 not-italic font-medium">Assumptions: </span>
                                    {rec.missing_info_or_assumptions}
                                  </p>
                                )}
                              </div>

                              <div className="mt-3 pt-2.5 border-t border-surface-700/30 flex justify-between items-center text-[10px] text-surface-500">
                                <span>Method: {rec.confidence_rationale}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ─────────────────────────────────────────────────────────── */}
                    {/* SHARED EXPANDABLE DETAILS: METHODOLOGY & HEALTH PENALTY RULES*/}
                    {/* ─────────────────────────────────────────────────────────── */}
                    <div className="rounded-xl border border-surface-700/60 bg-surface-900/60 overflow-hidden">
                      <button
                        onClick={() => setShowMethodology((prev) => !prev)}
                        aria-expanded={showMethodology}
                        className="w-full p-4 flex items-center justify-between text-left hover:bg-surface-800/40 transition-colors focus:outline-none"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">📐</span>
                          <div>
                            <h4 className="text-xs font-semibold text-surface-200">
                              Calculation Methodology & Health Penalty Rules
                            </h4>
                            <p className="text-[11px] text-surface-400">
                              Shared deterministic health penalty deductions, schedule calculation rules, and PM safeguards.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-primary-400 font-medium">
                          <span>{showMethodology ? "Hide Details" : "View Details"}</span>
                          <span className="font-mono text-[10px]">{showMethodology ? "▲" : "▼"}</span>
                        </div>
                      </button>

                      {showMethodology && (
                        <div className="p-4 pt-1 border-t border-surface-800/80 text-xs text-surface-300 space-y-3.5 bg-surface-950/30">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="p-3 rounded-lg bg-surface-800/50 border border-surface-700/50">
                              <p className="font-semibold text-rose-300 mb-1 flex items-center gap-1.5">
                                <span>🚨</span> Critical Risk Deduction
                              </p>
                              <p className="text-[11px] text-surface-400 leading-relaxed">
                                Each unresolved Critical workflow risk incurs a deterministic <strong>-15 points</strong> penalty against the project health score until mitigated.
                              </p>
                            </div>

                            <div className="p-3 rounded-lg bg-surface-800/50 border border-surface-700/50">
                              <p className="font-semibold text-amber-300 mb-1 flex items-center gap-1.5">
                                <span>⚠️</span> High Risk Deduction
                              </p>
                              <p className="text-[11px] text-surface-400 leading-relaxed">
                                Each unresolved High workflow risk incurs a deterministic <strong>-10 points</strong> penalty until an approved mitigation plan is executed.
                              </p>
                            </div>

                            <div className="p-3 rounded-lg bg-surface-800/50 border border-surface-700/50">
                              <p className="font-semibold text-yellow-300 mb-1 flex items-center gap-1.5">
                                <span>⏱️</span> Overdue Task Deduction
                              </p>
                              <p className="text-[11px] text-surface-400 leading-relaxed">
                                Each unmitigated overdue task deducts <strong>-3 points</strong> based on deterministic comparison between target due date and UTC time.
                              </p>
                            </div>
                          </div>

                          <div className="p-3 rounded-lg bg-surface-800/30 border border-surface-700/40 text-[11px] text-surface-400 space-y-1.5">
                            <p>
                              <strong className="text-surface-300">Smart Allocation Scoring Formula:</strong> Candidate matching computes a weighted compatibility score based on Skill Alignment (50%), Historical Experience (20%), Active Workload (20%), and Delivery History (10%).
                            </p>
                            <p>
                              <strong className="text-surface-300">PM Advisory Safeguard:</strong> DevFlow recommendations are strictly advisory for human review. DevFlow never automatically reassigns developers, modifies task deadlines, or alters risk statuses without project manager confirmation.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Non-destructive advisory notice */}
                <div className="p-3 bg-surface-800/30 rounded-lg border border-surface-700/30 text-[11px] text-surface-400 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    💡 <strong>PM Advisory Safeguard:</strong> Recommendations are advisory. DevFlow never automatically reassigns developers, modifies task deadlines, or alters risk statuses without project manager confirmation.
                  </span>
                  <span className="text-[10px] text-surface-400 shrink-0 font-medium">
                    Health Score: <span className="text-surface-100 font-bold">{recommendations.health_score}/100</span> (Uncompromised)
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Row 3: Operational Modules (Risk Radar, Workload Summary, GitHub Integration, Activity) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Module 1: Risk Radar with Severity & Evidence */}
        <section className="glass-card p-5 flex flex-col justify-between" aria-label="Risk Radar">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="text-base font-semibold text-surface-100 flex items-center gap-2">
                  <span>Risk Radar</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30 font-medium">
                    {projectRisks.length} Active
                  </span>
                </h3>
                <p className="text-xs text-surface-400 mt-0.5">Workflow bottlenecks, overdue dates, and blockers.</p>
              </div>
              <NavLink
                to={`/dashboard/pm-workflow-risks?project=${encodeURIComponent(selectedProject.name || selectedProject.id)}`}
                className="text-xs text-primary-400 hover:text-primary-300 font-medium flex items-center gap-1 group py-1"
                ariaLabel="Open Risk Center"
              >
                <span>Risk Center</span>
                <span className="transform transition-transform group-hover:translate-x-1">&rarr;</span>
              </NavLink>
            </div>

            {/* Severity Breakdown Bar */}
            <div className="grid grid-cols-4 gap-2 mb-4 text-center">
              <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                <span className="text-xs font-bold text-red-400 block">{unresolvedCritical.length}</span>
                <span className="text-[10px] text-surface-400 uppercase">Critical</span>
              </div>
              <div className="p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <span className="text-xs font-bold text-orange-400 block">{unresolvedHigh.length}</span>
                <span className="text-[10px] text-surface-400 uppercase">High</span>
              </div>
              <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <span className="text-xs font-bold text-amber-400 block">{unresolvedMedium.length}</span>
                <span className="text-[10px] text-surface-400 uppercase">Medium</span>
              </div>
              <div className="p-2 bg-surface-700/40 border border-surface-600/30 rounded-lg">
                <span className="text-xs font-bold text-surface-300 block">{unresolvedLow.length}</span>
                <span className="text-[10px] text-surface-400 uppercase">Low</span>
              </div>
            </div>

            {/* List of Active Risks with Evidence */}
            {projectRisks.length === 0 ? (
              <div className="text-center py-6 text-xs text-surface-400 italic bg-surface-800/30 rounded-lg border border-surface-700/30">
                ✓ No active workflow risks detected for this project.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {projectRisks.map((risk) => (
                  <div
                    key={risk.id}
                    className="p-3 bg-surface-800/60 rounded-xl border border-surface-700/50 hover:border-surface-600 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            risk.severity === "Critical"
                              ? "bg-red-500/15 text-red-300 border-red-500/30"
                              : risk.severity === "High"
                              ? "bg-orange-500/15 text-orange-300 border-orange-500/30"
                              : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                          }`}
                        >
                          {risk.severity}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-surface-700 text-surface-300">
                          {risk.risk_type.replace(/_/g, " ")}
                        </span>
                      </div>
                      <span className="text-[10px] text-surface-500 shrink-0">
                        {risk.detected_at ? new Date(risk.detected_at).toLocaleDateString() : ""}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-surface-100 mt-1">{risk.title}</p>
                    {risk.description && (
                      <p className="text-xs text-surface-400 mt-1 leading-relaxed bg-surface-900/40 p-2 rounded border border-surface-700/30">
                        <strong className="text-surface-300">Evidence: </strong>
                        {risk.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-surface-700/30 flex justify-between items-center text-xs text-surface-400">
            <span>Detection: Auto-detected via backend telemetry</span>
            <NavLink
              to={`/dashboard/pm-workflow-risks?project=${encodeURIComponent(selectedProject.name || selectedProject.id)}`}
              className="text-primary-400 hover:underline"
            >
              Manage all risks &rarr;
            </NavLink>
          </div>
        </section>

        {/* Module 2: Developer Workload Summary with Completeness Indicators */}
        <section className="glass-card p-5 flex flex-col justify-between" aria-label="Developer Workload Summary">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="text-base font-semibold text-surface-100">Workload Summary</h3>
                <p className="text-xs text-surface-400 mt-0.5">Assigned developers, active allocation & capacity.</p>
              </div>
              <NavLink
                to={`/dashboard/pm-smart-allocation?project=${selectedProject.id}`}
                className="text-xs text-primary-400 hover:text-primary-300 font-medium flex items-center gap-1 group py-1"
                ariaLabel="Open Smart Allocation"
              >
                <span>Smart Allocation</span>
                <span className="transform transition-transform group-hover:translate-x-1">&rarr;</span>
              </NavLink>
            </div>

            {/* Data Completeness & Assignment Health Pill */}
            <div className="p-2.5 bg-surface-800/60 rounded-lg border border-surface-700/50 flex justify-between items-center text-xs mb-4">
              <span className="text-surface-300 font-medium">Assignment Completeness:</span>
              <span
                className={`px-2 py-0.5 rounded font-semibold text-[11px] border ${
                  unassignedTasksCount === 0
                    ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-300 border-amber-500/20"
                }`}
              >
                {unassignedTasksCount === 0 ? "100% Assigned" : `${unassignedTasksCount} Unassigned Tasks`}
              </span>
            </div>

            {/* Developers List */}
            {developers.length === 0 ? (
              <div className="text-center py-6 text-xs text-surface-400 italic bg-surface-800/30 rounded-lg border border-surface-700/30">
                No developers assigned to tasks in this project yet. Use Smart Allocation to allocate team members.
              </div>
            ) : (
              <div className="space-y-3.5 max-h-72 overflow-y-auto pr-1">
                {developers.map((dev) => {
                  const devActive = dev.in_progress_tasks || 0;
                  const devTotal = dev.total_tasks || 0;
                  const capacityStatus =
                    devActive > 4
                      ? { label: "Heavy Load", color: "text-red-400 bg-red-500/10 border-red-500/20" }
                      : devActive >= 2
                      ? { label: "Balanced", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" }
                      : { label: "Capacity Available", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" };

                  return (
                    <div key={dev.developer_id} className="p-3 bg-surface-800/50 rounded-xl border border-surface-700/40">
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary-600/30 border border-primary-500/30 text-primary-300 flex items-center justify-center font-bold text-[10px]">
                            {dev.developer_name ? dev.developer_name.slice(0, 2).toUpperCase() : "DV"}
                          </div>
                          <span className="font-semibold text-surface-100">{dev.developer_name}</span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${capacityStatus.color}`}>
                          {capacityStatus.label}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-[11px] text-surface-400 mb-1">
                        <span>{devActive} in-progress / {devTotal} total tasks</span>
                        <span>{dev.completed_tasks || 0} completed</span>
                      </div>

                      {/* Workload Mini Bar */}
                      <div className="w-full flex h-1.5 rounded-full overflow-hidden bg-surface-700">
                        {devTotal > 0 && (
                          <>
                            <div className="bg-emerald-500" style={{ width: `${((dev.completed_tasks || 0) / devTotal) * 100}%` }} title="Completed" />
                            <div className="bg-primary-500" style={{ width: `${(devActive / devTotal) * 100}%` }} title="In Progress" />
                            <div className="bg-amber-500" style={{ width: `${((dev.review_tasks || 0) / devTotal) * 100}%` }} title="Review" />
                            <div className="bg-surface-500" style={{ width: `${((dev.todo_tasks || 0) / devTotal) * 100}%` }} title="Todo" />
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-surface-700/30 flex justify-between items-center text-xs text-surface-400">
            <span>Rebalance via AI skill match</span>
            <NavLink to={`/dashboard/pm-smart-allocation?project=${selectedProject.id}`} className="text-primary-400 hover:underline">
              Open Smart Allocation &rarr;
            </NavLink>
          </div>
        </section>

        {/* Module 3: GitHub Integration Status */}
        <section className="glass-card p-5 flex flex-col justify-between" aria-label="GitHub Integration Status">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="text-base font-semibold text-surface-100 flex items-center gap-2">
                  <span>GitHub Integration</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                      isGitHubConfigured
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : "bg-surface-700 text-surface-400 border-surface-600"
                    }`}
                  >
                    {isGitHubConfigured ? "Connected" : "Not Configured"}
                  </span>
                </h3>
                <p className="text-xs text-surface-400 mt-0.5">Repository telemetry, commits, PRs, and branch context.</p>
              </div>
              <NavLink
                to="/dashboard/github-integration"
                className="text-xs text-primary-400 hover:text-primary-300 font-medium flex items-center gap-1 group py-1"
                ariaLabel="Manage GitHub Integration"
              >
                <span>GitHub Hub</span>
                <span className="transform transition-transform group-hover:translate-x-1">&rarr;</span>
              </NavLink>
            </div>

            {isGitHubConfigured ? (
              <div className="space-y-3">
                <div className="p-3 bg-surface-800/60 rounded-xl border border-surface-700/50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🐙</span>
                    <span className="font-semibold text-sm text-surface-100">
                      {githubContext?.repository || "Connected Repository"}
                    </span>
                  </div>
                  <p className="text-xs text-surface-300 leading-relaxed">
                    Repository telemetry actively synced with project workspace and branch tracking.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 bg-surface-800/40 rounded-lg border border-surface-700/40">
                    <span className="text-sm font-bold text-surface-100 block">
                      {githubContext?.recent_commits_count ?? 0}
                    </span>
                    <span className="text-[10px] text-surface-400 uppercase">Commits</span>
                  </div>
                  <div className="p-2.5 bg-surface-800/40 rounded-lg border border-surface-700/40">
                    <span className="text-sm font-bold text-surface-100 block">
                      {githubContext?.open_prs_count ?? 0}
                    </span>
                    <span className="text-[10px] text-surface-400 uppercase">Open PRs</span>
                  </div>
                  <div className="p-2.5 bg-surface-800/40 rounded-lg border border-surface-700/40">
                    <span className="text-sm font-bold text-surface-100 block">
                      {githubContext?.branches_count ?? 0}
                    </span>
                    <span className="text-[10px] text-surface-400 uppercase">Branches</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-surface-800/40 rounded-xl border border-surface-700/40 text-xs text-surface-400 space-y-2.5">
                <p className="leading-relaxed">
                  No external VCS linked. Work items and sprint velocity are measured using internal task updates.
                </p>
                <div className="pt-2">
                  <NavLink
                    to="/dashboard/github-integration"
                    className="btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1.5"
                    ariaLabel="Connect GitHub Repository"
                  >
                    <span>Connect Repository</span>
                    <span>&rarr;</span>
                  </NavLink>
                </div>
              </div>
            )}
          </div>

          <p className="text-[11px] text-surface-500 mt-4 pt-3 border-t border-surface-700/30">
            Source Ground Truth: Task progress remains authoritative regardless of repository connection state.
          </p>
        </section>

        {/* Module 4: Recent Project Activity Timeline */}
        <section className="glass-card p-5 flex flex-col justify-between" aria-label="Recent Project Activity">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="text-base font-semibold text-surface-100">Recent Project Activity</h3>
                <p className="text-xs text-surface-400 mt-0.5">Audit log of task status transitions and project updates.</p>
              </div>
              <NavLink
                to={`/dashboard/pm-activity?project=${selectedProject.id}`}
                className="text-xs text-primary-400 hover:text-primary-300 font-medium flex items-center gap-1 group py-1"
                ariaLabel="View All Project Activity Logs"
              >
                <span>Full Timeline</span>
                <span className="transform transition-transform group-hover:translate-x-1">&rarr;</span>
              </NavLink>
            </div>

            {projectActivity.length === 0 ? (
              <div className="text-center py-6 text-xs text-surface-400 italic bg-surface-800/30 rounded-lg border border-surface-700/30">
                No recent activity recorded for this project.
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {projectActivity.map((act) => (
                  <div key={act.id} className="flex gap-3 text-xs p-2 rounded-lg bg-surface-800/30 border border-surface-700/30">
                    <div className="mt-1 flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-primary-500"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-surface-200 leading-snug">
                        <span className="font-semibold text-surface-100">{act.user_name || "System"}</span>{" "}
                        {act.description}
                      </p>
                      <p className="text-[10px] text-surface-500 mt-0.5">
                        {new Date(act.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-surface-700/30 flex justify-between items-center text-xs text-surface-400">
            <span>Audit log: Retained up to 50 recent events</span>
            <NavLink to={`/dashboard/pm-activity?project=${selectedProject.id}`} className="text-primary-400 hover:underline">
              View all activity &rarr;
            </NavLink>
          </div>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Outer Export Component — Supports both inside & outside React Router contexts
// ---------------------------------------------------------------------------
function PMProjectPulseWithRouter() {
  const [searchParams, setSearchParams] = useSearchParams();
  return <PMProjectPulseCore searchParams={searchParams} setSearchParams={setSearchParams} />;
}

function PMProjectPulseWithoutRouter() {
  const [params, setParams] = useState(
    () => new URLSearchParams(typeof window !== "undefined" ? window.location.search : "")
  );

  const updateParams = (newParams: Record<string, string>) => {
    const sp = new URLSearchParams(newParams);
    setParams(sp);
    if (typeof window !== "undefined") {
      const search = sp.toString();
      window.history.pushState(null, "", search ? `?${search}` : window.location.pathname);
    }
  };

  return <PMProjectPulseCore searchParams={params} setSearchParams={updateParams} />;
}

export default function PMProjectPulsePage() {
  const inRouter = useInRouterContext();
  if (inRouter) {
    return <PMProjectPulseWithRouter />;
  }
  return <PMProjectPulseWithoutRouter />;
}
