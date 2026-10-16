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
      await updateTaskEstimate(selectedProjectId, taskId, numVal);
      setDataSaveSuccess(`Updated estimate for task to ${numVal} hours.`);
      // Refresh simulator data
      const updated = await fetchSimulatorData(selectedProjectId);
      setSimulatorData(updated);
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

  // Common rendering for the baseline vs scenario comparison
  const renderComparison = (
    baseline: any, 
    scenario: any, 
    concerns: string[], 
    aiExplanation: string | undefined, 
    type: "deadline" | "unavailability"
  ) => {
    const isPartialGap = scenario.capacity_gap_status === "partial";
    const isUnavailableGap = scenario.capacity_gap_status === "unavailable" || scenario.capacity_gap_hours === null;

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-primary-500/10 border border-primary-500/20 text-primary-300 p-4 rounded-xl flex items-start gap-3">
          <span className="text-xl">✨</span>
          <div>
            <h4 className="font-semibold text-sm">Simulation Complete</h4>
            <p className="text-xs mt-1 text-primary-400/80">
              Comparing verified current baseline against your proposed hypothetical scenario based on real database records.
            </p>
          </div>
        </div>

        {/* Missing Data Notification Banner */}
        {scenario.missing_data_items && scenario.missing_data_items.length > 0 && (
          <div className="bg-warning-500/10 border border-warning-500/30 text-warning-300 p-4 rounded-xl text-xs space-y-1.5">
            <div className="font-semibold flex items-center gap-2 text-sm text-warning-400">
              <span>⚠️</span> Note on Missing Project Inputs
            </div>
            <ul className="list-disc list-inside space-y-1 text-surface-300 pl-1">
              {scenario.missing_data_items.map((item: string, idx: number) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
            <p className="text-[11px] text-warning-400/90 pt-1">
              💡 Tip: Click <strong>"Manage Estimates & Capacity"</strong> below to supply missing values for 100% complete calculations.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Baseline Card */}
          <div className="glass-card p-5 relative overflow-hidden">
            <h3 className="text-sm font-bold text-surface-300 uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>✓ Verified Baseline</span>
              {baseline.working_days !== undefined && (
                <span className="text-xs font-normal text-surface-400">
                  {baseline.working_days} working days
                </span>
              )}
            </h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs text-surface-500">Current Deadline</p>
                <p className="font-semibold text-surface-100 text-lg">
                  {baseline.current_deadline ? new Date(baseline.current_deadline).toLocaleDateString() : "None"}
                </p>
                {baseline.working_days !== undefined && baseline.working_days > 0 && (
                  <p className="text-[11px] text-surface-400 mt-0.5">
                    {baseline.working_days} business days ({baseline.working_weeks} weeks)
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs text-surface-500">Remaining Tasks</p>
                <p className="font-semibold text-surface-100 text-lg">{baseline.remaining_tasks}</p>
                {baseline.tasks_missing_estimates !== undefined && baseline.tasks_missing_estimates > 0 && (
                  <p className="text-[11px] text-warning-400 mt-0.5">
                    {baseline.tasks_with_estimates} estimated • {baseline.tasks_missing_estimates} lacking estimates
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs text-surface-500">Total Estimated Effort</p>
                <p className="font-semibold text-surface-100 text-lg">
                  {baseline.remaining_estimated_effort_hours !== null ? (
                    <>
                      {baseline.remaining_estimated_effort_hours}{" "}
                      <span className="text-sm font-normal text-surface-400">hours</span>
                    </>
                  ) : (
                    <span className="text-sm text-surface-500 italic">Unavailable — no effort estimates recorded</span>
                  )}
                </p>
                {baseline.tasks_missing_estimates > 0 && baseline.remaining_estimated_effort_hours !== null && (
                  <p className="text-[11px] text-warning-400 mt-0.5">
                    Partial sum from {baseline.tasks_with_estimates} estimated task(s)
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs text-surface-500">Available Capacity</p>
                <p className="font-semibold text-surface-100 text-lg">
                  {baseline.available_capacity_hours}{" "}
                  <span className="text-sm font-normal text-surface-400">hours</span>
                </p>
                {baseline.developers_missing_capacity > 0 && (
                  <p className="text-[11px] text-warning-400 mt-0.5">
                    {baseline.developers_missing_capacity} developer(s) missing capacity record
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Scenario Card */}
          <div className="glass-card p-5 border-primary-500/30 relative overflow-hidden">
            <h3 className="text-sm font-bold text-primary-400 uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>📅 Proposed Scenario</span>
              {scenario.working_days !== undefined && (
                <span className="text-xs font-normal text-primary-300">
                  {scenario.working_days} working days
                </span>
              )}
            </h3>
            
            <div className="space-y-4 relative z-10">
              {type === "deadline" && (
                <div>
                  <p className="text-xs text-surface-500">Proposed Deadline</p>
                  <p className="font-semibold text-primary-300 text-lg">
                    {new Date(scenario.proposed_deadline).toLocaleDateString()}
                  </p>
                  <p className="text-[11px] text-surface-400 mt-0.5">
                    {scenario.working_days ?? 0} business days ({scenario.working_weeks ?? 0} weeks) remaining
                  </p>
                </div>
              )}
              {type === "unavailability" && (
                <div>
                  <p className="text-xs text-surface-500">Capacity Removed</p>
                  <p className="font-semibold text-danger-400 text-lg">
                    -{scenario.capacity_removed_hours} <span className="text-sm font-normal text-surface-400">hours</span>
                  </p>
                </div>
              )}
              
              <div>
                <p className="text-xs text-surface-500">Remaining Tasks</p>
                <p className="font-semibold text-surface-100 text-lg">{scenario.remaining_tasks}</p>
              </div>

              <div>
                <p className="text-xs text-surface-500">Total Estimated Effort</p>
                <p className="font-semibold text-surface-100 text-lg">
                  {scenario.remaining_estimated_effort_hours !== null ? (
                    <>
                      {scenario.remaining_estimated_effort_hours}{" "}
                      <span className="text-sm font-normal text-surface-400">hours</span>
                    </>
                  ) : (
                    <span className="text-sm text-surface-500 italic">Unavailable — no effort data</span>
                  )}
                </p>
                {scenario.tasks_missing_estimates > 0 && scenario.remaining_estimated_effort_hours !== null && (
                  <p className="text-[11px] text-warning-400 mt-0.5">
                    Partial sum ({scenario.tasks_missing_estimates} task(s) unestimated)
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs text-surface-500">Available Capacity</p>
                <p className="font-semibold text-surface-100 text-lg">
                  {scenario.available_capacity_hours}{" "}
                  <span className="text-sm font-normal text-surface-400">hours</span>
                </p>
              </div>
              
              <div className="pt-1 border-t border-surface-700/50">
                <p className="text-xs text-surface-500">Projected Capacity Gap</p>
                <div className="mt-0.5">
                  {isUnavailableGap ? (
                    <p className="font-semibold text-surface-400 text-base">
                      Cannot calculate — missing effort or capacity data
                    </p>
                  ) : scenario.capacity_gap_hours && scenario.capacity_gap_hours > 0 ? (
                    <div>
                      <p className="font-semibold text-lg text-danger-400">
                        {scenario.capacity_gap_hours} hours deficit
                        {isPartialGap && <span className="text-xs font-normal ml-1.5 text-warning-400">(Partial)</span>}
                      </p>
                      <p className="text-[11px] text-surface-400 mt-0.5">
                        Formula: Effort ({scenario.remaining_estimated_effort_hours}h) - Capacity ({scenario.available_capacity_hours}h)
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold text-lg text-success-400">
                        No gap (Available capacity covers work)
                      </p>
                      <p className="text-[11px] text-surface-400 mt-0.5">
                        Surplus: {Math.max(0, (scenario.available_capacity_hours || 0) - (scenario.remaining_estimated_effort_hours || 0))} hours available
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Affected Tasks and Replacements (Unavailability only) */}
        {type === "unavailability" && scenario.affected_tasks && scenario.affected_tasks.length > 0 && (
          <div className="glass-card p-5 border-primary-500/30">
            <h3 className="text-sm font-bold text-surface-100 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Affected Tasks & Smart Allocation Replacements
            </h3>
            <p className="text-xs text-surface-400 mb-4">
              The developer has {scenario.affected_tasks.length} pending task(s). Recommendations for reassignment from the Smart Allocation engine:
            </p>
            <div className="space-y-3">
              {scenario.affected_tasks.map((task: any) => {
                const rep = (scenario.replacements || []).find((r: any) => r.task_id === task.id);
                return (
                  <div key={task.id} className="bg-surface-800 p-3 rounded border border-surface-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <div>
                      <div className="text-sm font-medium text-surface-100">{task.title}</div>
                      <div className="text-xs text-surface-400 mt-1">Status: {task.status} • Effort: {task.estimated_hours || task.estimated_effort || "Unknown"} hrs</div>
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

        {/* AI Explanation */}
        {aiExplanation && (
          <div className="glass-card p-5 border-accent-500/30">
            <h3 className="font-bold text-accent-400 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              AI Insights
            </h3>
            <div className="text-sm text-surface-200 whitespace-pre-wrap leading-relaxed">
              {aiExplanation}
            </div>
          </div>
        )}

        {/* Insights and Concerns */}
        <div className="glass-card p-5">
          <h3 className="font-bold text-surface-100 mb-4 flex items-center gap-2">
            <span>⚠️</span> Schedule Assessment & Concerns
          </h3>
          
          {concerns.length > 0 ? (
            <ul className="space-y-3">
              {concerns.map((concern, idx) => (
                <li key={idx} className="flex items-start gap-3 bg-warning-500/10 p-3 rounded-lg border border-warning-500/20">
                  <span className="shrink-0 mt-0.5 text-warning-400">⚠️</span>
                  <span className="text-sm text-warning-300">{concern}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="bg-success-500/10 p-3 rounded-lg border border-success-500/20 text-success-300 text-sm flex items-center gap-2">
              <span>✅</span> No immediate schedule concerns detected with this proposal.
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-surface-50 flex items-center gap-2">
            <svg className="w-6 h-6 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            AI What-If Simulator
          </h2>
          <p className="text-surface-400 text-sm mt-1">
            Simulate hypothetical project schedule and capacity changes safely using actual project data.
          </p>
        </div>

        {/* Project Data Editor Toggle Button */}
        {selectedProjectId && (
          <button
            onClick={() => setShowDataEditor(!showDataEditor)}
            className="flex items-center gap-2 px-3.5 py-2 bg-surface-800 hover:bg-surface-700 text-surface-200 border border-surface-700 rounded-lg text-xs font-medium transition-colors"
          >
            <span>{showDataEditor ? "Hide" : "Manage"} Estimates & Capacity</span>
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

      {/* Project Data Editor Section */}
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
                <span>📊</span> Project Data & Readiness for Simulation
              </h3>
              <p className="text-xs text-surface-400 mt-0.5">
                Ensure tasks have estimated hours and developers have weekly capacity configured for exact calculations.
              </p>
            </div>
            
            {/* Summary Pills */}
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

          {/* Sub-tabs for Task Estimates vs Developer Capacity */}
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
                          className="w-20 bg-surface-900 border border-surface-700 rounded px-2 py-1 text-xs text-surface-100 focus:outline-none focus:border-primary-500"
                        />
                      </div>
                      <button
                        onClick={() => handleSaveTaskEstimate(task.id)}
                        disabled={savingFieldId === `task-${task.id}`}
                        className="px-2.5 py-1 bg-primary-600 hover:bg-primary-500 text-white rounded text-xs transition-colors"
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
                          className="w-20 bg-surface-900 border border-surface-700 rounded px-2 py-1 text-xs text-surface-100 focus:outline-none focus:border-primary-500"
                        />
                      </div>
                      <button
                        onClick={() => handleSaveDeveloperCapacity(dev.developer_id)}
                        disabled={savingFieldId === `dev-${dev.developer_id}`}
                        className="px-2.5 py-1 bg-primary-600 hover:bg-primary-500 text-white rounded text-xs transition-colors"
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
      ) : null)}

      {/* Tabs */}
      <div className="flex border-b border-surface-700/50">
        <button
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "deadline" ? "border-primary-500 text-primary-400" : "border-transparent text-surface-400 hover:text-surface-200"
          }`}
          onClick={() => { setActiveTab("deadline"); resetResults(); }}
        >
          Deadline Change
        </button>
        <button
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "unavailability" ? "border-primary-500 text-primary-400" : "border-transparent text-surface-400 hover:text-surface-200"
          }`}
          onClick={() => { setActiveTab("unavailability"); resetResults(); }}
        >
          Developer Unavailability
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-6">
            <h3 className="font-bold text-surface-100 mb-4">Simulation Scenario</h3>
            
            {activeTab === "deadline" ? (
              <form onSubmit={handleSimulateDeadline} className="space-y-4">
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
                  <label className="block text-surface-400 text-xs font-medium mb-1">Proposed Deadline</label>
                  <input
                    type="date"
                    value={proposedDate}
                    onChange={(e) => setProposedDate(e.target.value)}
                    className="w-full bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2 text-surface-100 text-sm focus:outline-none focus:border-primary-500/50"
                    required
                  />
                </div>
                
                {error && (
                  <div className="bg-danger-500/10 border border-danger-500/20 text-danger-400 p-3 rounded-lg text-sm">⚠️ {error}</div>
                )}
                
                <button
                  type="submit"
                  disabled={simulating || !selectedProjectId || !proposedDate}
                  className="w-full bg-primary-600 hover:bg-primary-500 disabled:bg-surface-700 disabled:text-surface-500 text-white font-medium text-sm py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {simulating ? "Running..." : "Run Simulation"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSimulateUnavailability} className="space-y-4">
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
                <div className="grid grid-cols-2 gap-3">
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

                {error && (
                  <div className="bg-danger-500/10 border border-danger-500/20 text-danger-400 p-3 rounded-lg text-sm">⚠️ {error}</div>
                )}
                
                <button
                  type="submit"
                  disabled={simulating || !selectedProjectId || !selectedDeveloperId || !absenceStartDate || !absenceEndDate}
                  className="w-full bg-primary-600 hover:bg-primary-500 disabled:bg-surface-700 disabled:text-surface-500 text-white font-medium text-sm py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {simulating ? "Running..." : "Run Simulation"}
                </button>
              </form>
            )}
          </div>
          
          <div className="bg-surface-800/40 p-4 rounded-xl border border-surface-700/50">
            <h4 className="text-sm font-semibold text-surface-200 flex items-center gap-2">
              <svg className="w-4 h-4 text-warning-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Information
            </h4>
            <p className="text-xs text-surface-400 mt-2 leading-relaxed">
              This simulation processes real database tasks and assigned developer capacities through FastAPI. Results are hypothetical projections and do not alter real project data or deadlines.
            </p>
          </div>
        </div>

        {/* Results Column */}
        <div className="lg:col-span-2">
          {activeTab === "deadline" && deadlineResult ? (
            renderComparison(deadlineResult.baseline, deadlineResult.scenario, deadlineResult.scenario.schedule_concerns, deadlineResult.ai_explanation, "deadline")
          ) : activeTab === "unavailability" && unavailabilityResult ? (
            renderComparison(unavailabilityResult.baseline, unavailabilityResult.scenario, unavailabilityResult.scenario.schedule_concerns, unavailabilityResult.ai_explanation, "unavailability")
          ) : (
            <div className="glass-card h-full min-h-[400px] flex flex-col items-center justify-center p-8 text-center border-dashed border-surface-700/60">
              <svg className="w-16 h-16 text-surface-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              <h3 className="text-lg font-bold text-surface-300 mb-2">Configure Simulation</h3>
              <p className="text-sm text-surface-500 max-w-sm">
                Select a project and proposed changes to preview hypothetical capacity and schedule impacts.
              </p>
            </div>
          )}
          
          {/* Assumptions & Limitations for either result */}
          {(deadlineResult || unavailabilityResult) && (
            <div className="glass-card p-5 border-dashed border-surface-700/60 bg-surface-800/20 mt-4">
              <h3 className="font-bold text-surface-400 text-sm mb-3">Assumptions & Methodology</h3>
              <ul className="list-disc list-inside space-y-1.5 text-xs text-surface-500">
                {(activeTab === "deadline" ? deadlineResult?.assumptions_and_limitations : unavailabilityResult?.assumptions_and_limitations)?.map((lim, idx) => (
                  <li key={idx}>{lim}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
