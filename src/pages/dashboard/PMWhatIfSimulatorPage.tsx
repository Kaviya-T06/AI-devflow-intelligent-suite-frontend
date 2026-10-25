import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { 
  fetchManagedProjects, 
  simulateDeadlineChange, 
  simulateDeveloperUnavailability,
  fetchAssignableUsers,
  fetchSimulatorData,
  updateTaskEstimate,
  updateDeveloperCapacity,
} from "../../services/pmService";
import type { 
  DeadlineSimulationResponse,
  UnavailabilitySimulationResponse,
  AssignableUser,
  ProjectSimulatorData,
} from "../../services/pmService";
import type { Project } from "../../types";

export default function PMWhatIfSimulatorPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [searchParams] = useSearchParams();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  
  const [activeTab, setActiveTab] = useState<"deadline" | "unavailability">("deadline");
  
  // Deadline scenario inputs
  const [proposedDate, setProposedDate] = useState<string>("");
  
  // Unavailability scenario inputs
  const [selectedDeveloperId, setSelectedDeveloperId] = useState<string>("");
  const [absenceStartDate, setAbsenceStartDate] = useState<string>("");
  const [absenceEndDate, setAbsenceEndDate] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(true);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const [deadlineResult, setDeadlineResult] = useState<DeadlineSimulationResponse | null>(null);
  const [unavailabilityResult, setUnavailabilityResult] = useState<UnavailabilitySimulationResponse | null>(null);

  // Project data management state
  const [simulatorData, setSimulatorData] = useState<ProjectSimulatorData | null>(null);
  const [loadingSimData, setLoadingSimData] = useState<boolean>(false);
  const [showDataEditor, setShowDataEditor] = useState<boolean>(false);
  const [dataEditorTab, setDataEditorTab] = useState<"tasks" | "developers">("tasks");
  const [taskEstimatesInput, setTaskEstimatesInput] = useState<Record<string, string>>({});
  const [devCapacityInput, setDevCapacityInput] = useState<Record<string, string>>({});
  const [savingFieldId, setSavingFieldId] = useState<string | null>(null);
  const [dataSaveSuccess, setDataSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [projectsData, usersData] = await Promise.all([
          fetchManagedProjects(),
          fetchAssignableUsers()
        ]);
        setProjects(projectsData);
        setAssignableUsers(usersData.filter(u => u.role === "DEVELOPER" || u.role === "TEAM_MEMBER"));
        const paramId = searchParams.get("projectId") || searchParams.get("project_id");
        if (paramId && projectsData.some(p => p.id === paramId)) {
          setSelectedProjectId(paramId);
        } else if (projectsData.length > 0) {
          setSelectedProjectId(projectsData[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load initial data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Fetch project simulator data when selected project changes
  useEffect(() => {
    if (!selectedProjectId) {
      setSimulatorData(null);
      return;
    }
    async function loadProjectData() {
      setLoadingSimData(true);
      try {
        const data = await fetchSimulatorData(selectedProjectId);
        setSimulatorData(data);
        // Pre-fill local input states
        const estimates: Record<string, string> = {};
        data.tasks.forEach(t => {
          estimates[t.id] = t.estimated_hours !== null && t.estimated_hours !== undefined ? String(t.estimated_hours) : "";
        });
        setTaskEstimatesInput(estimates);

        const capacities: Record<string, string> = {};
        data.developers.forEach(d => {
          capacities[d.developer_id] = d.capacity_hours_per_week !== null && d.capacity_hours_per_week !== undefined ? String(d.capacity_hours_per_week) : "40";
        });
        setDevCapacityInput(capacities);
      } catch (err) {
        console.error("Failed to load simulator data:", err);
      } finally {
        setLoadingSimData(false);
      }
    }
    loadProjectData();
  }, [selectedProjectId]);

  const resetResults = () => {
    setDeadlineResult(null);
    setUnavailabilityResult(null);
    setError(null);
  };

  const handleSaveTaskEstimate = async (taskId: string) => {
    if (!selectedProjectId) return;
    const rawVal = taskEstimatesInput[taskId];
    const numVal = parseFloat(rawVal);
    if (isNaN(numVal) || numVal < 0) {
      setError("Please enter a valid non-negative number of hours.");
      return;
    }
    setSavingFieldId(`task-${taskId}`);
    setError(null);
    setDataSaveSuccess(null);
    try {
      const res = await updateTaskEstimate(selectedProjectId, taskId, numVal);
      setDataSaveSuccess(res.message || `Updated estimate for task to ${numVal} hours.`);
      // Refresh simulator data
      const updated = await fetchSimulatorData(selectedProjectId);
      setSimulatorData(updated);
      if (proposedDate && activeTab === "deadline") {
        const simRes = await simulateDeadlineChange(selectedProjectId, proposedDate);
        setDeadlineResult(simRes);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save estimate");
    } finally {
      setSavingFieldId(null);
    }
  };

  const handleSaveDeveloperCapacity = async (developerId: string) => {
    if (!selectedProjectId) return;
    const rawVal = devCapacityInput[developerId];
    const numVal = parseFloat(rawVal);
    if (isNaN(numVal) || numVal < 0 || numVal > 168) {
      setError("Please enter a valid weekly capacity between 0 and 168 hours.");
      return;
    }
    setSavingFieldId(`dev-${developerId}`);
    setError(null);
    setDataSaveSuccess(null);
    try {
      await updateDeveloperCapacity(selectedProjectId, developerId, numVal);
      setDataSaveSuccess(`Updated developer capacity to ${numVal} hrs/week.`);
      // Refresh simulator data
      const updated = await fetchSimulatorData(selectedProjectId);
      setSimulatorData(updated);
      if (proposedDate && activeTab === "deadline") {
        const simRes = await simulateDeadlineChange(selectedProjectId, proposedDate);
        setDeadlineResult(simRes);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save capacity");
    } finally {
      setSavingFieldId(null);
    }
  };

  const handleSimulateDeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !proposedDate) {
      setError("Please select a project and a proposed date.");
      return;
    }
    
    setSimulating(true);
    resetResults();
    
    try {
      const data = await simulateDeadlineChange(selectedProjectId, proposedDate);
      setDeadlineResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setSimulating(false);
    }
  };

  const handleSimulateUnavailability = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !selectedDeveloperId || !absenceStartDate || !absenceEndDate) {
      setError("Please fill in all fields.");
      return;
    }
    
    if (new Date(absenceEndDate) < new Date(absenceStartDate)) {
      setError("End date cannot be before start date.");
      return;
    }
    
    setSimulating(true);
    resetResults();
    
    try {
      const data = await simulateDeveloperUnavailability(selectedProjectId, {
        developer_id: selectedDeveloperId,
        start_date: absenceStartDate,
        end_date: absenceEndDate
      });
      setUnavailabilityResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setSimulating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-48 bg-surface-800 rounded animate-pulse" />
        <div className="glass-card p-5 animate-pulse space-y-4">
          <div className="h-12 bg-surface-700/60 rounded" />
        </div>
      </div>
    );
  }

function fmtDate(d: string | null | undefined): string {
  if (!d) return "None set";
  try {
    return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return String(d);
  }
}

function countWorkingDays(startDateStr: string | null | undefined, endDateStr: string | null | undefined): number {
  if (!startDateStr || !endDateStr) return 0;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  if (end <= start) return 0;

  let count = 0;
  const cur = new Date(start);
  cur.setDate(cur.getDate() + 1);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function computeCapacity(workingDays: number, developers: { capacity_hours_per_week?: number | null }[]): number {
  if (workingDays <= 0) return 0;
  const weeks = workingDays / 5.0;
  let total = 0;
  for (const dev of developers) {
    if (dev.capacity_hours_per_week !== null && dev.capacity_hours_per_week !== undefined) {
      total += Number(dev.capacity_hours_per_week) * weeks;
    }
  }
  return Math.round(total * 10) / 10;
}

  const todayStr = new Date().toISOString().split("T")[0];
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  // CURRENT BASELINE METRICS
  const currentDeadline = deadlineResult?.baseline.current_deadline ?? simulatorData?.current_deadline ?? selectedProject?.end_date ?? null;
  const currentWorkingDays = deadlineResult?.baseline.working_days !== undefined
    ? deadlineResult.baseline.working_days
    : (currentDeadline ? countWorkingDays(todayStr, currentDeadline) : 0);

  const currentRemainingTasks = deadlineResult?.baseline.remaining_tasks ?? simulatorData?.total_remaining_tasks ?? 0;
  const tasksWithEstimates = deadlineResult?.baseline.tasks_with_estimates ?? simulatorData?.tasks_with_estimates ?? 0;
  const tasksMissingEstimates = deadlineResult?.baseline.tasks_missing_estimates ?? simulatorData?.tasks_missing_estimates ?? 0;

  const currentAvailableCapacity = deadlineResult?.baseline.available_capacity_hours !== undefined && deadlineResult.baseline.available_capacity_hours !== null
    ? deadlineResult.baseline.available_capacity_hours
    : (simulatorData ? computeCapacity(currentWorkingDays, simulatorData.developers) : null);

  const currentEffort = deadlineResult?.baseline.remaining_estimated_effort_hours !== undefined && deadlineResult.baseline.remaining_estimated_effort_hours !== null
    ? deadlineResult.baseline.remaining_estimated_effort_hours
    : (simulatorData ? simulatorData.total_estimated_effort_hours : null);

  const currentCapacityGap = tasksMissingEstimates > 0
    ? null
    : (currentAvailableCapacity !== null && currentEffort !== null
        ? Math.round((currentAvailableCapacity - currentEffort) * 10) / 10
        : null);

  // HYPOTHETICAL SCENARIO METRICS
  const hypotheticalDeadline = deadlineResult?.scenario.proposed_deadline ?? (proposedDate || null);
  const hypotheticalWorkingDays = deadlineResult?.scenario.working_days !== undefined
    ? deadlineResult.scenario.working_days
    : (hypotheticalDeadline ? countWorkingDays(todayStr, hypotheticalDeadline) : 0);

  const hypotheticalRemainingTasks = deadlineResult?.scenario.remaining_tasks ?? currentRemainingTasks;

  const hypotheticalCapacity = deadlineResult?.scenario.available_capacity_hours !== undefined && deadlineResult.scenario.available_capacity_hours !== null
    ? deadlineResult.scenario.available_capacity_hours
    : (hypotheticalDeadline && simulatorData ? computeCapacity(hypotheticalWorkingDays, simulatorData.developers) : null);

  const hypotheticalEffort = deadlineResult?.scenario.remaining_estimated_effort_hours !== undefined && deadlineResult.scenario.remaining_estimated_effort_hours !== null
    ? deadlineResult.scenario.remaining_estimated_effort_hours
    : currentEffort;

  const hypotheticalCapacityGap = tasksMissingEstimates > 0
    ? null
    : (deadlineResult?.scenario.capacity_gap_hours !== undefined && deadlineResult.scenario.capacity_gap_hours !== null
        ? deadlineResult.scenario.capacity_gap_hours
        : (hypotheticalCapacity !== null && hypotheticalEffort !== null
            ? Math.round((hypotheticalCapacity - hypotheticalEffort) * 10) / 10
            : null));

  // IMPACT DIFFERENCES
  const daysDiff = hypotheticalDeadline && currentDeadline
    ? hypotheticalWorkingDays - currentWorkingDays
    : null;

  const capacityDiff = hypotheticalCapacity !== null && currentAvailableCapacity !== null
    ? Math.round((hypotheticalCapacity - currentAvailableCapacity) * 10) / 10
    : null;

  const gapDiff = tasksMissingEstimates > 0
    ? null
    : (hypotheticalCapacityGap !== null && currentCapacityGap !== null
        ? Math.round((hypotheticalCapacityGap - currentCapacityGap) * 10) / 10
        : null);

  // FEASIBILITY EVALUATION (Only when available data supports a reliable conclusion)
  const isPastOrTodayDeadline = hypotheticalDeadline
    ? new Date(hypotheticalDeadline).getTime() <= new Date().setHours(0, 0, 0, 0)
    : false;

  let feasibilityBadge: { label: string; subtext: string; colorClass: string; bgClass: string; borderClass: string } | null = null;

  if (tasksMissingEstimates > 0) {
    feasibilityBadge = {
      label: "Unavailable",
      subtext: "Effort estimates missing for remaining tasks",
      colorClass: "text-warning-400",
      bgClass: "bg-warning-500/10",
      borderClass: "border-warning-500/30",
    };
  } else if (!hypotheticalDeadline) {
    feasibilityBadge = {
      label: "Pending Selection",
      subtext: "Select a proposed deadline to evaluate",
      colorClass: "text-surface-400",
      bgClass: "bg-surface-800",
      borderClass: "border-surface-700",
    };
  } else if (isPastOrTodayDeadline) {
    feasibilityBadge = {
      label: "Infeasible",
      subtext: "Proposed deadline is today or in the past (0 working days)",
      colorClass: "text-danger-400",
      bgClass: "bg-danger-500/10",
      borderClass: "border-danger-500/30",
    };
  } else if (hypotheticalCapacity === 0 || hypotheticalCapacity === null) {
    feasibilityBadge = {
      label: "Capacity Missing",
      subtext: "Assigned developers have 0 recorded working hours",
      colorClass: "text-warning-400",
      bgClass: "bg-warning-500/10",
      borderClass: "border-warning-500/30",
    };
  } else if (hypotheticalCapacityGap !== null && hypotheticalCapacityGap < 0) {
    const shortfall = Math.abs(hypotheticalCapacityGap);
    feasibilityBadge = {
      label: "Capacity Shortfall",
      subtext: `Workload exceeds capacity by ${shortfall} hrs`,
      colorClass: "text-danger-400",
      bgClass: "bg-danger-500/10",
      borderClass: "border-danger-500/30",
    };
  } else if (hypotheticalCapacityGap !== null && hypotheticalCapacityGap >= 0) {
    feasibilityBadge = {
      label: "Feasible",
      subtext: `Sufficient capacity (+${hypotheticalCapacityGap} hrs buffer)`,
      colorClass: "text-success-400",
      bgClass: "bg-success-500/10",
      borderClass: "border-success-500/30",
    };
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-surface-50 flex items-center gap-2.5">
            <svg className="w-6 h-6 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            What-If Simulator
          </h2>
          <p className="text-surface-400 text-sm">
            Compare your current project schedule with a proposed scenario.
          </p>
        </div>

        {selectedProjectId && (
          <button
            type="button"
            onClick={() => setShowDataEditor(!showDataEditor)}
            className="self-start sm:self-center flex items-center gap-2 px-3.5 py-1.5 bg-surface-800 hover:bg-surface-700 text-surface-200 border border-surface-700 rounded-lg text-xs font-medium transition-colors"
          >
            <span>{showDataEditor ? "Hide" : "Manage"} Estimates</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
              simulatorData?.sufficient_data_for_simulation 
                ? "bg-success-500/20 text-success-300" 
                : "bg-warning-500/20 text-warning-300"
            }`}>
              {simulatorData?.sufficient_data_for_simulation ? "Ready" : "Incomplete"}
            </span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-surface-700/50">
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "deadline" ? "border-primary-500 text-primary-400" : "border-transparent text-surface-400 hover:text-surface-200"
          }`}
          onClick={() => { setActiveTab("deadline"); resetResults(); }}
        >
          Deadline Change
        </button>
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "unavailability" ? "border-primary-500 text-primary-400" : "border-transparent text-surface-400 hover:text-surface-200"
          }`}
          onClick={() => { setActiveTab("unavailability"); resetResults(); }}
        >
          Developer Unavailability
        </button>
      </div>

      {/* Project Data & Estimates Management Drawer */}
      {showDataEditor && (
        loadingSimData ? (
          <div className="glass-card p-5 text-center text-surface-400 text-xs animate-pulse">
            Loading project data…
          </div>
        ) : simulatorData ? (
          <div className="glass-card p-5 border-primary-500/30 animate-fade-in space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-surface-700/60">
              <div>
                <h3 className="font-bold text-surface-100 text-sm flex items-center gap-2">
                  <span>📊</span> Manage Task Estimates & Developer Capacity
                </h3>
                <p className="text-xs text-surface-400 mt-0.5">
                  Saved values are stored directly in the database and immediately update both Current and Hypothetical metrics.
                </p>
              </div>
              
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="bg-surface-800 px-2.5 py-1 rounded-md text-surface-300 border border-surface-700">
                  Tasks: <strong>{simulatorData.tasks_with_estimates}/{simulatorData.total_remaining_tasks}</strong> estimated
                </span>
                <span className="bg-surface-800 px-2.5 py-1 rounded-md text-surface-300 border border-surface-700">
                  Effort: <strong>{simulatorData.total_estimated_effort_hours}h</strong>
                </span>
                <span className="bg-surface-800 px-2.5 py-1 rounded-md text-surface-300 border border-surface-700">
                  Developers: <strong>{simulatorData.developers_with_capacity}/{simulatorData.developers.length}</strong> with capacity
                </span>
              </div>
            </div>

            {dataSaveSuccess && (
              <div className="bg-success-500/10 border border-success-500/20 text-success-300 p-2.5 rounded-lg text-xs flex items-center gap-2">
                <span>✅</span> {dataSaveSuccess}
              </div>
            )}

            <div className="flex border-b border-surface-700/40 text-xs">
              <button
                onClick={() => setDataEditorTab("tasks")}
                className={`px-3 py-2 font-medium border-b-2 transition-colors ${
                  dataEditorTab === "tasks" ? "border-primary-500 text-primary-400" : "border-transparent text-surface-400 hover:text-surface-200"
                }`}
              >
                Remaining Tasks & Estimates ({simulatorData.tasks.length})
              </button>
              <button
                onClick={() => setDataEditorTab("developers")}
                className={`px-3 py-2 font-medium border-b-2 transition-colors ${
                  dataEditorTab === "developers" ? "border-primary-500 text-primary-400" : "border-transparent text-surface-400 hover:text-surface-200"
                }`}
              >
                Assigned Developer Capacities ({simulatorData.developers.length})
              </button>
            </div>

            {dataEditorTab === "tasks" ? (
              <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                {simulatorData.tasks.length === 0 ? (
                  <p className="text-xs text-surface-500 py-3 text-center">No remaining tasks in this project.</p>
                ) : (
                  simulatorData.tasks.map((task) => (
                    <div key={task.id} className="bg-surface-800/60 p-3 rounded-lg border border-surface-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-surface-100">{task.title}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-700 text-surface-300">{task.status}</span>
                          {task.estimated_hours === null && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning-500/15 text-warning-300 border border-warning-500/20">
                              ⚠️ Needs estimate
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-surface-400">
                          Assignee: <span className="text-surface-300">{task.assigned_to_name || "Unassigned"}</span>
                          {task.due_date && <> • Due: <span className="text-surface-300">{task.due_date}</span></>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <label className="text-[11px] text-surface-400">Estimated Hours:</label>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            placeholder="Hours"
                            value={taskEstimatesInput[task.id] ?? ""}
                            onChange={(e) => setTaskEstimatesInput({ ...taskEstimatesInput, [task.id]: e.target.value })}
                            className="w-20 bg-surface-900 border border-surface-700 rounded px-2 py-1 text-xs text-surface-100 focus:outline-none focus:border-primary-500 font-mono"
                          />
                        </div>
                        <button
                          onClick={() => handleSaveTaskEstimate(task.id)}
                          disabled={savingFieldId === `task-${task.id}`}
                          className="px-2.5 py-1 bg-primary-600 hover:bg-primary-500 text-white rounded text-xs transition-colors font-medium"
                        >
                          {savingFieldId === `task-${task.id}` ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                {simulatorData.developers.length === 0 ? (
                  <p className="text-xs text-surface-500 py-3 text-center">No developers assigned to remaining tasks.</p>
                ) : (
                  simulatorData.developers.map((dev) => (
                    <div key={dev.developer_id} className="bg-surface-800/60 p-3 rounded-lg border border-surface-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-surface-100">{dev.name}</span>
                          {dev.has_capacity ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-success-500/20 text-success-300">
                              {dev.capacity_hours_per_week}h/week
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning-500/20 text-warning-300">
                              ⚠️ Missing Capacity
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-surface-400">
                          {dev.email} • {dev.assigned_tasks_count} assigned task(s)
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <label className="text-[11px] text-surface-400">Weekly Capacity:</label>
                          <input
                            type="number"
                            min="0"
                            max="168"
                            step="1"
                            placeholder="Hrs/wk"
                            value={devCapacityInput[dev.developer_id] ?? ""}
                            onChange={(e) => setDevCapacityInput({ ...devCapacityInput, [dev.developer_id]: e.target.value })}
                            className="w-20 bg-surface-900 border border-surface-700 rounded px-2 py-1 text-xs text-surface-100 focus:outline-none focus:border-primary-500 font-mono"
                          />
                        </div>
                        <button
                          onClick={() => handleSaveDeveloperCapacity(dev.developer_id)}
                          disabled={savingFieldId === `dev-${dev.developer_id}`}
                          className="px-2.5 py-1 bg-primary-600 hover:bg-primary-500 text-white rounded text-xs transition-colors font-medium"
                        >
                          {savingFieldId === `dev-${dev.developer_id}` ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ) : null
      )}

      {/* Simulation Controls Bar */}
      <div className="glass-card p-4 rounded-xl border border-surface-700/60 bg-surface-900/60">
        {activeTab === "deadline" ? (
          <form onSubmit={handleSimulateDeadline} className="flex flex-col md:flex-row items-stretch md:items-end gap-3.5">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-surface-400 text-xs font-semibold mb-1 uppercase tracking-wider">
                Select Project
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => { setSelectedProjectId(e.target.value); resetResults(); }}
                className="w-full bg-surface-800 border border-surface-700/60 rounded-lg px-3 py-2 text-surface-100 text-sm focus:outline-none focus:border-primary-500/50"
              >
                <option value="">— Select a project —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="w-full md:w-56">
              <label className="block text-surface-400 text-xs font-semibold mb-1 uppercase tracking-wider">
                Proposed Deadline
              </label>
              <input
                type="date"
                value={proposedDate}
                onChange={(e) => {
                  setProposedDate(e.target.value);
                  if (deadlineResult) setDeadlineResult(null);
                }}
                className="w-full bg-surface-800 border border-surface-700/60 rounded-lg px-3 py-2 text-surface-100 text-sm focus:outline-none focus:border-primary-500/50 font-mono"
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={simulating || !selectedProjectId || !proposedDate}
                className="px-5 py-2 bg-primary-600 hover:bg-primary-500 disabled:bg-surface-700 disabled:text-surface-500 text-white font-medium text-sm rounded-lg transition-colors flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-primary-500/20"
              >
                {simulating ? "Simulating…" : "Run Simulation"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSimulateUnavailability} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-surface-400 text-xs font-medium mb-1">Select Project</label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => { setSelectedProjectId(e.target.value); resetResults(); }}
                  className="w-full bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2 text-surface-100 text-sm focus:outline-none focus:border-primary-500/50"
                >
                  <option value="">— Select a project —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-surface-400 text-xs font-medium mb-1">Select Developer</label>
                <select
                  value={selectedDeveloperId}
                  onChange={(e) => setSelectedDeveloperId(e.target.value)}
                  className="w-full bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2 text-surface-100 text-sm focus:outline-none focus:border-primary-500/50"
                  required
                >
                  <option value="">— Select a developer —</option>
                  {assignableUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-surface-400 text-xs font-medium mb-1">Absence Start</label>
                <input
                  type="date"
                  value={absenceStartDate}
                  onChange={(e) => setAbsenceStartDate(e.target.value)}
                  className="w-full bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2 text-surface-100 text-sm focus:outline-none focus:border-primary-500/50"
                  required
                />
              </div>
              <div>
                <label className="block text-surface-400 text-xs font-medium mb-1">Absence End</label>
                <input
                  type="date"
                  value={absenceEndDate}
                  onChange={(e) => setAbsenceEndDate(e.target.value)}
                  className="w-full bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2 text-surface-100 text-sm focus:outline-none focus:border-primary-500/50"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={simulating || !selectedProjectId || !selectedDeveloperId || !absenceStartDate || !absenceEndDate}
              className="px-5 py-2 bg-primary-600 hover:bg-primary-500 disabled:bg-surface-700 disabled:text-surface-500 text-white font-medium text-sm rounded-lg transition-colors"
            >
              {simulating ? "Simulating…" : "Run Simulation"}
            </button>
          </form>
        )}

        {error && (
          <div className="mt-3 bg-danger-500/10 border border-danger-500/20 text-danger-400 p-2.5 rounded-lg text-xs flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}
      </div>

      {/* Main Side-by-Side Current vs. Hypothetical Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CURRENT PANEL */}
        <div className="glass-card p-6 rounded-2xl border border-surface-700/70 bg-surface-900/40 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-surface-700/60">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-surface-400"></span>
              <h3 className="text-base font-bold text-surface-100 tracking-wide">CURRENT</h3>
            </div>
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded bg-surface-800 text-surface-300 border border-surface-700">
              Verified Baseline
            </span>
          </div>

          <div className="space-y-3">
            {/* 1. Current Deadline */}
            <div className="p-3.5 rounded-xl bg-surface-800/50 border border-surface-700/40 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider block">Current Deadline</span>
                <span className="text-lg font-bold text-surface-100 mt-0.5 block">{currentDeadline ? fmtDate(currentDeadline) : "No deadline set"}</span>
              </div>
              <span className="text-xs text-surface-400 text-right">
                {currentWorkingDays !== null && currentWorkingDays > 0 ? `${currentWorkingDays} working days` : "—"}
              </span>
            </div>

            {/* 2. Remaining Tasks */}
            <div className="p-3.5 rounded-xl bg-surface-800/50 border border-surface-700/40 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider block">Remaining Tasks</span>
                <span className="text-lg font-bold text-surface-100 mt-0.5 block">{currentRemainingTasks}</span>
              </div>
              <span className="text-xs text-right">
                {tasksMissingEstimates > 0 ? (
                  <span className="text-warning-400 font-medium">⚠️ {tasksMissingEstimates} unestimated</span>
                ) : (
                  <span className="text-success-400 font-medium">✓ All tasks estimated</span>
                )}
              </span>
            </div>

            {/* 3. Available Developer Capacity */}
            <div className="p-3.5 rounded-xl bg-surface-800/50 border border-surface-700/40 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider block">Available Capacity</span>
                <span className="text-lg font-bold text-surface-100 mt-0.5 block">
                  {currentAvailableCapacity !== null ? `${currentAvailableCapacity} hrs` : "—"}
                </span>
              </div>
              <span className="text-xs text-surface-400 text-right">
                {currentWorkingDays > 0 ? `Across ${currentWorkingDays} working days` : "Current capacity"}
              </span>
            </div>

            {/* 4. Estimated Effort Required */}
            <div className="p-3.5 rounded-xl bg-surface-800/50 border border-surface-700/40 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider block">Estimated Effort Required</span>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <span className="text-lg font-bold text-surface-100">
                    {currentEffort !== null ? `${currentEffort} hrs` : "—"}
                  </span>
                  {tasksMissingEstimates > 0 && (
                    <span className="text-[11px] text-warning-400 font-medium bg-warning-500/10 px-2 py-0.5 rounded border border-warning-500/20">
                      Unavailable — effort estimates missing
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs text-surface-400 text-right">
                {tasksMissingEstimates > 0 ? `${tasksWithEstimates} of ${currentRemainingTasks} estimated` : "Total pending scope"}
              </span>
            </div>

            {/* 5. Capacity Gap */}
            <div className="p-3.5 rounded-xl bg-surface-800/50 border border-surface-700/40 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider block">Capacity Gap</span>
                <div className="flex items-center gap-2 mt-0.5">
                  {tasksMissingEstimates > 0 ? (
                    <span className="text-xs text-warning-400 font-semibold bg-warning-500/10 px-2.5 py-1 rounded border border-warning-500/20">
                      Unavailable — effort estimates missing
                    </span>
                  ) : currentCapacityGap !== null ? (
                    <span className={`text-lg font-bold ${currentCapacityGap >= 0 ? "text-success-400" : "text-danger-400"}`}>
                      {currentCapacityGap > 0 ? `+${currentCapacityGap} hrs` : `${currentCapacityGap} hrs`}
                    </span>
                  ) : (
                    <span className="text-lg font-bold text-surface-400">—</span>
                  )}
                </div>
              </div>
              <span className="text-xs text-surface-400 text-right">
                {tasksMissingEstimates > 0
                  ? "Add estimates to calculate"
                  : currentCapacityGap !== null
                    ? (currentCapacityGap > 0 ? "Capacity surplus" : (currentCapacityGap === 0 ? "Exact match" : `Shortfall of ${Math.abs(currentCapacityGap)}h`))
                    : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* HYPOTHETICAL PANEL */}
        <div className="glass-card p-6 rounded-2xl border border-primary-500/40 bg-primary-950/10 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-primary-500/30">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary-400 animate-pulse"></span>
              <h3 className="text-base font-bold text-primary-300 tracking-wide">HYPOTHETICAL</h3>
            </div>
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded bg-primary-500/15 text-primary-300 border border-primary-500/30">
              Proposed Scenario
            </span>
          </div>

          <div className="space-y-3">
            {/* 1. Proposed Deadline */}
            <div className="p-3.5 rounded-xl bg-surface-800/60 border border-primary-500/20 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider block">Proposed Deadline</span>
                <span className="text-lg font-bold text-primary-300 mt-0.5 block">
                  {hypotheticalDeadline ? fmtDate(hypotheticalDeadline) : "Select a proposed date"}
                </span>
              </div>
              <span className="text-xs text-surface-400 text-right">
                {hypotheticalWorkingDays !== null && hypotheticalDeadline ? `${hypotheticalWorkingDays} working days` : "—"}
              </span>
            </div>

            {/* 2. Remaining Tasks */}
            <div className="p-3.5 rounded-xl bg-surface-800/60 border border-primary-500/20 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider block">Remaining Tasks</span>
                <span className="text-lg font-bold text-surface-100 mt-0.5 block">{hypotheticalRemainingTasks}</span>
              </div>
              <span className="text-xs text-surface-400 text-right">
                Same project scope
              </span>
            </div>

            {/* 3. Available Capacity */}
            <div className="p-3.5 rounded-xl bg-surface-800/60 border border-primary-500/20 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider block">Available Capacity</span>
                <span className="text-lg font-bold text-surface-100 mt-0.5 block">
                  {hypotheticalCapacity !== null ? `${hypotheticalCapacity} hrs` : "—"}
                </span>
              </div>
              <span className="text-xs text-surface-400 text-right">
                {hypotheticalWorkingDays > 0 ? `Across ${hypotheticalWorkingDays} working days` : "Recalculated"}
              </span>
            </div>

            {/* 4. Estimated Effort Required */}
            <div className="p-3.5 rounded-xl bg-surface-800/60 border border-primary-500/20 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider block">Estimated Effort Required</span>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <span className="text-lg font-bold text-surface-100">
                    {hypotheticalEffort !== null ? `${hypotheticalEffort} hrs` : "—"}
                  </span>
                  {tasksMissingEstimates > 0 && (
                    <span className="text-[11px] text-warning-400 font-medium bg-warning-500/10 px-2 py-0.5 rounded border border-warning-500/20">
                      Unavailable — effort estimates missing
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs text-surface-400 text-right">
                Same project scope
              </span>
            </div>

            {/* 5. Capacity Gap */}
            <div className="p-3.5 rounded-xl bg-surface-800/60 border border-primary-500/20 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider block">Capacity Gap</span>
                <div className="flex items-center gap-2 mt-0.5">
                  {tasksMissingEstimates > 0 ? (
                    <span className="text-xs text-warning-400 font-semibold bg-warning-500/10 px-2.5 py-1 rounded border border-warning-500/20">
                      Unavailable — effort estimates missing
                    </span>
                  ) : hypotheticalCapacityGap !== null ? (
                    <span className={`text-lg font-bold ${hypotheticalCapacityGap >= 0 ? "text-success-400" : "text-danger-400"}`}>
                      {hypotheticalCapacityGap > 0 ? `+${hypotheticalCapacityGap} hrs` : `${hypotheticalCapacityGap} hrs`}
                    </span>
                  ) : (
                    <span className="text-lg font-bold text-surface-400">—</span>
                  )}
                </div>
              </div>
              <span className="text-xs text-surface-400 text-right">
                {tasksMissingEstimates > 0
                  ? "Add estimates to calculate"
                  : hypotheticalCapacityGap !== null
                    ? (hypotheticalCapacityGap > 0 ? "Capacity surplus" : (hypotheticalCapacityGap === 0 ? "Exact match" : `Shortfall of ${Math.abs(hypotheticalCapacityGap)}h`))
                    : "Run simulation to calculate"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Concise Impact Comparison Section */}
      <div className="glass-card p-5 rounded-2xl border border-surface-700/60 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-surface-700/50">
          <div className="flex items-center gap-2">
            <span className="text-primary-400 text-base">⚡</span>
            <h3 className="text-sm font-bold text-surface-100 uppercase tracking-wider">Impact Comparison</h3>
          </div>
          <span className="text-xs text-surface-400">
            Net difference between Current and Proposed Scenario
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Deadline Difference */}
          <div className="p-4 rounded-xl bg-surface-800/40 border border-surface-700/50 flex flex-col justify-between min-h-[105px]">
            <span className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider">Deadline Difference</span>
            <div className="mt-1">
              {daysDiff === null ? (
                <span className="text-lg font-bold text-surface-400">—</span>
              ) : daysDiff < 0 ? (
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-lg font-bold text-warning-400">Earlier by {Math.abs(daysDiff)} days</span>
                  <span className="text-xs text-warning-400/80 font-medium">({Math.abs(daysDiff)} working days)</span>
                </div>
              ) : daysDiff > 0 ? (
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-lg font-bold text-primary-300">Later by {daysDiff} days</span>
                  <span className="text-xs text-primary-300/80 font-medium">(+{daysDiff} working days)</span>
                </div>
              ) : (
                <span className="text-lg font-bold text-surface-200">0 days (Same date)</span>
              )}
            </div>
            <span className="text-[11px] text-surface-400 mt-1">
              {currentWorkingDays}d current → {hypotheticalWorkingDays}d proposed
            </span>
          </div>

          {/* 2. Available-Capacity Difference */}
          <div className="p-4 rounded-xl bg-surface-800/40 border border-surface-700/50 flex flex-col justify-between min-h-[105px]">
            <span className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider">Available Capacity Difference</span>
            <div className="mt-1">
              {capacityDiff === null ? (
                <span className="text-lg font-bold text-surface-400">—</span>
              ) : capacityDiff < 0 ? (
                <span className="text-lg font-bold text-danger-400">
                  {capacityDiff} hrs <span className="text-xs font-normal">↓ reduction</span>
                </span>
              ) : capacityDiff > 0 ? (
                <span className="text-lg font-bold text-success-400">
                  +{capacityDiff} hrs <span className="text-xs font-normal">↑ capacity</span>
                </span>
              ) : (
                <span className="text-lg font-bold text-surface-200">0 hrs (No change)</span>
              )}
            </div>
            <span className="text-[11px] text-surface-400 mt-1">
              {currentAvailableCapacity !== null ? `${currentAvailableCapacity}h` : "—"} → {hypotheticalCapacity !== null ? `${hypotheticalCapacity}h` : "—"}
            </span>
          </div>

          {/* 3. Capacity-Gap Difference */}
          <div className="p-4 rounded-xl bg-surface-800/40 border border-surface-700/50 flex flex-col justify-between min-h-[105px]">
            <span className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider">Capacity Gap Difference</span>
            <div className="mt-1">
              {tasksMissingEstimates > 0 ? (
                <span className="text-xs font-semibold text-warning-400">Unavailable — effort estimates missing</span>
              ) : gapDiff === null ? (
                <span className="text-lg font-bold text-surface-400">—</span>
              ) : gapDiff < 0 ? (
                <span className="text-lg font-bold text-danger-400">
                  {gapDiff} hrs <span className="text-xs font-normal">↓ tighter buffer</span>
                </span>
              ) : gapDiff > 0 ? (
                <span className="text-lg font-bold text-success-400">
                  +{gapDiff} hrs <span className="text-xs font-normal">↑ larger buffer</span>
                </span>
              ) : (
                <span className="text-lg font-bold text-surface-200">0 hrs (Neutral)</span>
              )}
            </div>
            <span className="text-[11px] text-surface-400 mt-1">
              {tasksMissingEstimates > 0
                ? "Requires all task estimates"
                : `${currentCapacityGap !== null ? (currentCapacityGap > 0 ? `+${currentCapacityGap}h` : `${currentCapacityGap}h`) : "—"} → ${hypotheticalCapacityGap !== null ? (hypotheticalCapacityGap > 0 ? `+${hypotheticalCapacityGap}h` : `${hypotheticalCapacityGap}h`) : "—"}`}
            </span>
          </div>

          {/* 4. Feasibility Result */}
          <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[105px] ${feasibilityBadge ? `${feasibilityBadge.bgClass} ${feasibilityBadge.borderClass}` : "bg-surface-800/40 border-surface-700/50"}`}>
            <span className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider">Feasibility Result</span>
            <div className="mt-1">
              {feasibilityBadge ? (
                <span className={`text-base font-bold ${feasibilityBadge.colorClass}`}>
                  {feasibilityBadge.label}
                </span>
              ) : (
                <span className="text-base font-bold text-surface-400">—</span>
              )}
            </div>
            <span className="text-[11px] text-surface-300 mt-1 truncate">
              {feasibilityBadge?.subtext ?? "Select deadline to evaluate"}
            </span>
          </div>
        </div>
      </div>

      {/* Developer Unavailability Scenario Specific Details (if tab active) */}
      {activeTab === "unavailability" && unavailabilityResult?.scenario.affected_tasks && unavailabilityResult.scenario.affected_tasks.length > 0 && (
        <div className="glass-card p-5 border-primary-500/30">
          <h3 className="text-sm font-bold text-surface-100 mb-3 flex items-center gap-2">
            <span>👥</span> Affected Tasks & Smart Allocation Replacements
          </h3>
          <p className="text-xs text-surface-400 mb-4">
            The developer has {unavailabilityResult.scenario.affected_tasks.length} pending task(s). Recommendations for reassignment:
          </p>
          <div className="space-y-3">
            {unavailabilityResult.scenario.affected_tasks.map((task: any) => {
              const rep = (unavailabilityResult.scenario.replacements || []).find((r: any) => r.task_id === task.id);
              return (
                <div key={task.id} className="bg-surface-800 p-3 rounded border border-surface-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div>
                    <div className="text-sm font-medium text-surface-100">{task.title}</div>
                    <div className="text-xs text-surface-400 mt-1">Status: {task.status} • Effort: {task.estimated_hours || "Unknown"} hrs</div>
                  </div>
                  {rep ? (
                    <div className="bg-primary-500/10 border border-primary-500/20 px-3 py-2 rounded text-xs flex items-center gap-2 shrink-0">
                      <span className="text-primary-400 font-medium">{rep.suggested_developer_name}</span>
                      <span className="bg-primary-500/20 text-primary-300 px-1.5 py-0.5 rounded">
                        {rep.match_score}% Match
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-surface-500 italic">No replacement found</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Optional AI Explanation */}
      {(deadlineResult?.ai_explanation || unavailabilityResult?.ai_explanation) && (
        <div className="glass-card p-5 border-accent-500/30">
          <h3 className="font-bold text-accent-400 mb-2 flex items-center gap-2 text-sm">
            <span>⚡</span> AI Insights
          </h3>
          <div className="text-xs text-surface-300 whitespace-pre-wrap leading-relaxed">
            {deadlineResult?.ai_explanation || unavailabilityResult?.ai_explanation}
          </div>
        </div>
      )}
    </div>
  );
}
