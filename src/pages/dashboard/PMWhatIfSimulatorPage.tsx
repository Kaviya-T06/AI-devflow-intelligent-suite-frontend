import { useState, useEffect } from "react";
import { 
  fetchManagedProjects, 
  simulateDeadlineChange, 
  simulateDeveloperUnavailability,
  fetchAssignableUsers
} from "../../services/pmService";
import type { 
  DeadlineSimulationResponse,
  UnavailabilitySimulationResponse,
  AssignableUser
} from "../../services/pmService";
import type { Project } from "../../types";

export default function PMWhatIfSimulatorPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
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

  useEffect(() => {
    async function loadData() {
      try {
        const [projectsData, usersData] = await Promise.all([
          fetchManagedProjects(),
          fetchAssignableUsers()
        ]);
        setProjects(projectsData);
        setAssignableUsers(usersData.filter(u => u.role === "DEVELOPER" || u.role === "TEAM_MEMBER"));
        if (projectsData.length > 0) {
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

  const resetResults = () => {
    setDeadlineResult(null);
    setUnavailabilityResult(null);
    setError(null);
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
  const renderComparison = (baseline: any, scenario: any, concerns: string[], aiExplanation: string | undefined, type: "deadline" | "unavailability") => {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-primary-500/10 border border-primary-500/20 text-primary-300 p-4 rounded-xl flex items-start gap-3">
          <span className="text-xl">✨</span>
          <div>
            <h4 className="font-semibold text-sm">Simulation Complete</h4>
            <p className="text-xs mt-1 text-primary-400/80">Comparing current baseline against your proposed scenario.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Baseline Card */}
          <div className="glass-card p-5 relative overflow-hidden">
            <h3 className="text-sm font-bold text-surface-300 uppercase tracking-wider mb-4">Current Baseline</h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs text-surface-500">Deadline</p>
                <p className="font-semibold text-surface-100 text-lg">
                  {baseline.current_deadline ? new Date(baseline.current_deadline).toLocaleDateString() : "None"}
                </p>
              </div>
              <div>
                <p className="text-xs text-surface-500">Remaining Tasks</p>
                <p className="font-semibold text-surface-100 text-lg">{baseline.remaining_tasks}</p>
              </div>
              <div>
                <p className="text-xs text-surface-500">Total Estimated Effort</p>
                <p className="font-semibold text-surface-100 text-lg">
                  {baseline.remaining_estimated_effort_hours !== null ? baseline.remaining_estimated_effort_hours : "Unknown"} <span className="text-sm font-normal text-surface-400">{baseline.remaining_estimated_effort_hours !== null ? "hours" : ""}</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-surface-500">Available Capacity</p>
                <p className="font-semibold text-surface-100 text-lg">
                  {baseline.available_capacity_hours} <span className="text-sm font-normal text-surface-400">hours</span>
                </p>
              </div>
            </div>
          </div>

          {/* Scenario Card */}
          <div className="glass-card p-5 border-primary-500/30 relative overflow-hidden">
            <h3 className="text-sm font-bold text-primary-400 uppercase tracking-wider mb-4">Proposed Scenario</h3>
            
            <div className="space-y-4 relative z-10">
              {type === "deadline" && (
                <div>
                  <p className="text-xs text-surface-500">Deadline</p>
                  <p className="font-semibold text-primary-300 text-lg">
                    {new Date(scenario.proposed_deadline).toLocaleDateString()}
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
                  {scenario.remaining_estimated_effort_hours !== null ? scenario.remaining_estimated_effort_hours : "Unknown"} <span className="text-sm font-normal text-surface-400">{scenario.remaining_estimated_effort_hours !== null ? "hours" : ""}</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-surface-500">Available Capacity</p>
                <p className="font-semibold text-surface-100 text-lg">
                  {scenario.available_capacity_hours} <span className="text-sm font-normal text-surface-400">hours</span>
                </p>
              </div>
              
              <div>
                <p className="text-xs text-surface-500">Projected Capacity Gap</p>
                <p className={`font-semibold text-lg ${scenario.capacity_gap_hours ? "text-danger-400" : (scenario.remaining_estimated_effort_hours === null ? "text-surface-400" : "text-success-400")}`}>
                  {scenario.capacity_gap_hours ? `${scenario.capacity_gap_hours} hours` : (scenario.remaining_estimated_effort_hours === null ? "Unavailable" : "None")}
                </p>
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
              The developer has {scenario.affected_tasks.length} pending task(s). Here are top recommendations for reassignment from the Smart Allocation engine.
            </p>
            <div className="space-y-3">
              {scenario.affected_tasks.map((task: any) => {
                const rep = (scenario.replacements || []).find((r: any) => r.task_id === task.id);
                return (
                  <div key={task.id} className="bg-surface-800 p-3 rounded border border-surface-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <div>
                      <div className="text-sm font-medium text-surface-100">{task.title}</div>
                      <div className="text-xs text-surface-400 mt-1">Status: {task.status} • Effort: {task.estimated_effort || "Unknown"} hrs</div>
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
          <h3 className="font-bold text-surface-100 mb-4">Analysis & Schedule Concerns</h3>
          
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
      <div>
        <h2 className="text-2xl font-bold text-surface-50 flex items-center gap-2">
          <svg className="w-6 h-6 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          AI What-If Simulator
        </h2>
        <p className="text-surface-400 text-sm mt-1">
          Simulate hypothetical project changes safely without modifying real project data.
        </p>
      </div>

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
              This simulation processes active tasks and capacities. The results are hypothetical and do not alter real project data.
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
              <h3 className="font-bold text-surface-400 text-sm mb-3">Assumptions & Missing Data Limitations</h3>
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
