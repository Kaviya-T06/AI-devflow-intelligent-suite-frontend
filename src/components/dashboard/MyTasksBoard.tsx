import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchAllTasks, fetchAllProjects, updateTask } from "../../services/adminService";
import { useAuth } from "../../context/AuthContext";
import type { Task, TaskStatus, Project } from "../../types";
import Modal from "../ui/Modal";
import {
  getTaskGitHubContext,
  associateTaskBranch,
  associateTaskPullRequest,
  type TaskGitHubContext,
} from "../../services/githubService";

export default function MyTasksBoard() {
  const { profile } = useAuth();
  const role = (profile?.role ?? "DEVELOPER") as "ADMIN" | "MANAGER" | "DEVELOPER";
  const canApprove = role === "ADMIN" || role === "MANAGER";

  const [searchParams, setSearchParams] = useSearchParams();
  const projectParam = searchParams.get("project");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [projectFilter, setProjectFilter] = useState(projectParam ?? "ALL");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [githubContext, setGithubContext] = useState<TaskGitHubContext | null>(null);
  const [ghLoading, setGhLoading] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [prUrlInput, setPrUrlInput] = useState("");
  const [branchSaving, setBranchSaving] = useState(false);
  const [prSaving, setPrSaving] = useState(false);
  const [ghError, setGhError] = useState<string | null>(null);
  const [ghSuccess, setGhSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedTask) {
      setGithubContext(null);
      setSelectedBranch("");
      setPrUrlInput("");
      setGhError(null);
      setGhSuccess(null);
      return;
    }
    setGhLoading(true);
    setGhError(null);
    setGhSuccess(null);
    getTaskGitHubContext(selectedTask.id)
      .then((ctx) => {
        setGithubContext(ctx);
        if (ctx.associated_branch) setSelectedBranch(ctx.associated_branch);
        if (ctx.associated_pull_request_url) setPrUrlInput(ctx.associated_pull_request_url);
      })
      .catch((err) => {
        console.warn("GitHub context not available for task", err);
      })
      .finally(() => setGhLoading(false));
  }, [selectedTask]);

  const handleAssociateBranch = async () => {
    if (!selectedTask || !selectedBranch) return;
    setBranchSaving(true);
    setGhError(null);
    try {
      await associateTaskBranch(selectedTask.id, selectedBranch);
      setGhSuccess(`Branch "${selectedBranch}" associated with task.`);
      const updated = await getTaskGitHubContext(selectedTask.id);
      setGithubContext(updated);
    } catch (err: any) {
      setGhError(err.message || "Failed to associate branch");
    } finally {
      setBranchSaving(false);
    }
  };

  const handleAssociatePR = async () => {
    if (!selectedTask || !prUrlInput.trim()) return;
    setPrSaving(true);
    setGhError(null);
    try {
      await associateTaskPullRequest(selectedTask.id, { pull_request_url: prUrlInput.trim() });
      setGhSuccess("Pull request associated with task.");
      const updated = await getTaskGitHubContext(selectedTask.id);
      setGithubContext(updated);
    } catch (err: any) {
      setGhError(err.message || "Failed to associate pull request");
    } finally {
      setPrSaving(false);
    }
  };

  useEffect(() => {
    if (projectParam) {
      setProjectFilter(projectParam);
    }
  }, [projectParam]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [tasksData, projectsData] = await Promise.all([
        fetchAllTasks(),
        fetchAllProjects().catch(() => []),
      ]);
      setTasks(tasksData);
      setProjects(projectsData);
    } catch (err: any) {
      setError(err.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }

  async function loadTasks() {
    return loadData();
  }

  async function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    try {
      await updateTask(taskId, { status: newStatus });
      await loadTasks();
    } catch (err: any) {
      alert("Error updating task: " + err.message);
    }
  }

  const isOverdue = (task: Task) => {
    if (!task.due_date || task.status === "COMPLETED") return false;
    return new Date() > new Date(task.due_date);
  };

  if (loading) {
    return <div className="text-surface-400 p-8 text-center animate-pulse">Loading tasks...</div>;
  }

  if (error) {
    return (
      <div className="bg-danger-500/10 border border-danger-500/20 text-danger-400 p-4 rounded-lg flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <p>{error}</p>
        </div>
        <button onClick={loadTasks} className="btn-secondary w-fit text-sm py-1.5">Retry</button>
      </div>
    );
  }

  const filteredTasks = tasks.filter(t => {
    if (projectFilter !== "ALL" && t.project_id !== projectFilter) return false;
    if (priorityFilter !== "ALL" && t.priority !== priorityFilter) return false;
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const activeProject = projects.find(p => p.id === projectFilter);

  const todoTasks = filteredTasks.filter(t => t.status === "TODO");
  const inProgressTasks = filteredTasks.filter(t => t.status === "IN_PROGRESS");
  const reviewTasks = filteredTasks.filter(t => t.status === "REVIEW");
  const completedTasks = filteredTasks.filter(t => t.status === "COMPLETED");
  const overdueTasks = filteredTasks.filter(isOverdue);

  const TaskCard = ({ task }: { task: Task }) => (
    <div 
      className={`glass-card p-4 flex flex-col gap-2 cursor-pointer hover:bg-surface-800/40 transition-colors ${isOverdue(task) ? 'border-danger-500/50' : ''}`}
      onClick={() => setSelectedTask(task)}
    >
      <div className="flex justify-between items-start">
        <h4 className="text-surface-100 font-semibold">{task.title}</h4>
        <span className={`text-xs px-2 py-1 rounded-full ${
          task.priority === 'CRITICAL' ? 'bg-danger-500/20 text-danger-300' :
          task.priority === 'HIGH' ? 'bg-warning-500/20 text-warning-300' :
          task.priority === 'MEDIUM' ? 'bg-primary-500/20 text-primary-300' :
          'bg-surface-700 text-surface-300'
        }`}>{task.priority}</span>
      </div>
      <p className="text-surface-400 text-sm line-clamp-2">{task.description || "No description"}</p>
      
      <div className="flex justify-between items-center mt-2 text-xs text-surface-500">
        <span>Due: {task.due_date ? new Date(task.due_date).toLocaleDateString() : "None"}</span>
        {isOverdue(task) && <span className="text-danger-400 font-semibold">Overdue!</span>}
      </div>

      <div className="mt-4 flex gap-2 justify-end items-center border-t border-surface-700/50 pt-3" onClick={(e) => e.stopPropagation()}>
        {task.status === "TODO" && (
          <button onClick={() => handleStatusChange(task.id, "IN_PROGRESS")} className="btn-primary text-xs py-1.5 px-3">
            Start Task
          </button>
        )}
        {task.status === "IN_PROGRESS" && (
          <button onClick={() => handleStatusChange(task.id, "REVIEW")} className="btn-secondary text-xs py-1.5 px-3">
            Submit for Review
          </button>
        )}
        {task.status === "REVIEW" && (
          <>
            {canApprove ? (
              <>
                <button onClick={() => handleStatusChange(task.id, "IN_PROGRESS")} className="btn-secondary text-xs py-1.5 px-3">
                  Needs Work
                </button>
                <button onClick={() => handleStatusChange(task.id, "COMPLETED")} className="btn-primary bg-success-500 hover:bg-success-600 text-xs py-1.5 px-3">
                  Approve Task
                </button>
              </>
            ) : (
              <span className="text-xs text-warning-400 font-medium flex items-center gap-1.5 py-1 px-2 rounded bg-warning-500/10 border border-warning-500/20">
                <span className="text-[10px]">⏳</span> Awaiting PM Review
              </span>
            )}
          </>
        )}
        {task.status === "COMPLETED" && (
          <span className="text-xs text-success-400 font-medium flex items-center gap-1 py-1 px-2 rounded bg-success-500/10 border border-success-500/20">
            <span>✓</span> Completed
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="section-title">My Tasks</h3>
          {activeProject && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-primary-400 font-medium">Filtered by project: {activeProject.name}</span>
              <button
                onClick={() => {
                  setProjectFilter("ALL");
                  searchParams.delete("project");
                  setSearchParams(searchParams);
                }}
                className="text-xs text-surface-400 hover:text-surface-200 underline"
              >
                Clear
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <input 
            type="text" 
            placeholder="Search tasks..." 
            className="input-field max-w-xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {projects.length > 0 && (
            <select
              className="input-field w-40 text-xs"
              value={projectFilter}
              onChange={(e) => {
                const val = e.target.value;
                setProjectFilter(val);
                if (val === "ALL") {
                  searchParams.delete("project");
                  setSearchParams(searchParams);
                } else {
                  setSearchParams({ project: val });
                }
              }}
            >
              <option value="ALL">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <select 
            className="input-field w-32 text-xs" 
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="ALL">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>
      </div>

      {overdueTasks.length > 0 && (
        <div>
          <h4 className="text-danger-400 font-bold mb-3 flex items-center gap-2">
            <span>⚠️</span> Overdue Tasks ({overdueTasks.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {overdueTasks.map(t => <TaskCard key={t.id} task={t} />)}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* To Do Column */}
        <div className="space-y-4">
          <h4 className="font-semibold text-surface-300 flex items-center justify-between">
            To Do <span className="badge bg-surface-700">{todoTasks.length}</span>
          </h4>
          {todoTasks.map(t => <TaskCard key={t.id} task={t} />)}
          {todoTasks.length === 0 && <p className="text-surface-500 text-sm text-center py-4">No tasks to do.</p>}
        </div>

        {/* In Progress Column */}
        <div className="space-y-4">
          <h4 className="font-semibold text-primary-300 flex items-center justify-between">
            In Progress <span className="badge bg-primary-500/20 text-primary-300">{inProgressTasks.length}</span>
          </h4>
          {inProgressTasks.map(t => <TaskCard key={t.id} task={t} />)}
          {inProgressTasks.length === 0 && <p className="text-surface-500 text-sm text-center py-4">No tasks in progress.</p>}
        </div>

        {/* For Review Column */}
        <div className="space-y-4">
          <h4 className="font-semibold text-warning-300 flex items-center justify-between">
            For Review <span className="badge bg-warning-500/20 text-warning-300">{reviewTasks.length}</span>
          </h4>
          {reviewTasks.map(t => <TaskCard key={t.id} task={t} />)}
          {reviewTasks.length === 0 && <p className="text-surface-500 text-sm text-center py-4">No tasks for review.</p>}
        </div>

        {/* Completed Column */}
        <div className="space-y-4">
          <h4 className="font-semibold text-success-300 flex items-center justify-between">
            Completed <span className="badge bg-success-500/20 text-success-300">{completedTasks.length}</span>
          </h4>
          {completedTasks.map(t => <TaskCard key={t.id} task={t} />)}
          {completedTasks.length === 0 && <p className="text-surface-500 text-sm text-center py-4">No completed tasks.</p>}
        </div>
      </div>

      {/* Task Details Modal */}
      {selectedTask && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedTask(null)}
          title={selectedTask.title}
          subtitle={`Status: ${selectedTask.status.replace("_", " ")} • Priority: ${selectedTask.priority}`}
          maxWidthClass="max-w-3xl"
        >
          <div className="p-4 sm:p-6 space-y-6">
            <div>
              <h4 className="text-surface-400 text-xs font-semibold uppercase tracking-wider mb-2">Description</h4>
              <p className="text-surface-200 text-sm whitespace-pre-wrap">{selectedTask.description || "No description provided."}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-surface-400 text-xs">Due Date</p>
                <p className="text-surface-100 text-sm">{selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString() : "None"}</p>
              </div>
              <div>
                <p className="text-surface-400 text-xs">Created</p>
                <p className="text-surface-100 text-sm">{selectedTask.created_at ? new Date(selectedTask.created_at).toLocaleDateString() : "Unknown"}</p>
              </div>
              <div>
                <p className="text-surface-400 text-xs">Priority</p>
                <p className="text-surface-100 text-sm">{selectedTask.priority}</p>
              </div>
              <div>
                <p className="text-surface-400 text-xs">Status</p>
                <p className="text-surface-100 text-sm font-semibold text-primary-400">{selectedTask.status.replace("_", " ")}</p>
              </div>
            </div>

            {/* Workflow Action Controls */}
            <div className="p-3 bg-surface-800/40 rounded-xl border border-surface-700/50 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h5 className="text-xs font-semibold text-surface-200">Task Actions</h5>
                <p className="text-[11px] text-surface-400">Advance task status through the verified workflow</p>
              </div>
              <div className="flex items-center gap-2">
                {selectedTask.status === "TODO" && (
                  <button
                    onClick={() => {
                      handleStatusChange(selectedTask.id, "IN_PROGRESS");
                      setSelectedTask({ ...selectedTask, status: "IN_PROGRESS" });
                    }}
                    className="btn-primary text-xs py-1.5 px-3"
                  >
                    🚀 Start Task
                  </button>
                )}
                {selectedTask.status === "IN_PROGRESS" && (
                  <button
                    onClick={() => {
                      handleStatusChange(selectedTask.id, "REVIEW");
                      setSelectedTask({ ...selectedTask, status: "REVIEW" });
                    }}
                    className="btn-primary text-xs py-1.5 px-3"
                  >
                    👀 Submit for Review
                  </button>
                )}
                {selectedTask.status === "REVIEW" && canApprove && (
                  <>
                    <button
                      onClick={() => {
                        handleStatusChange(selectedTask.id, "COMPLETED");
                        setSelectedTask({ ...selectedTask, status: "COMPLETED" });
                      }}
                      className="bg-success-600 hover:bg-success-500 text-white font-medium text-xs py-1.5 px-3 rounded-lg transition-colors"
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => {
                        handleStatusChange(selectedTask.id, "IN_PROGRESS");
                        setSelectedTask({ ...selectedTask, status: "IN_PROGRESS" });
                      }}
                      className="bg-warning-600 hover:bg-warning-500 text-white font-medium text-xs py-1.5 px-3 rounded-lg transition-colors"
                    >
                      ↩ Request Revisions
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* GitHub Integration Context for Task */}
            <div className="bg-surface-800/60 p-4 rounded-xl border border-surface-700/50 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-surface-200 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <svg className="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  GitHub Repository Context
                </h4>
                {githubContext?.repository_name ? (
                  <a
                    href={githubContext.repository_url || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary-400 hover:text-primary-300 hover:underline flex items-center gap-1"
                  >
                    <span>{githubContext.repository_name}</span>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                ) : (
                  <span className="text-xs text-surface-500 italic">No repository connected to this project</span>
                )}
              </div>

              {ghError && (
                <p className="text-xs text-danger-400 bg-danger-500/10 p-2 rounded border border-danger-500/20">{ghError}</p>
              )}
              {ghSuccess && (
                <p className="text-xs text-success-300 bg-success-500/10 p-2 rounded border border-success-500/20">{ghSuccess}</p>
              )}

              {ghLoading ? (
                <p className="text-xs text-surface-500 py-1">Loading repository context…</p>
              ) : githubContext?.repository_name ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {/* Branch Association */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider block">
                      Associated Branch
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        disabled={branchSaving}
                        className="bg-surface-900 border border-surface-700 rounded-lg px-2.5 py-1.5 text-xs text-surface-200 flex-1 focus:outline-none focus:border-primary-500"
                      >
                        <option value="">{githubContext.associated_branch ? `Current: ${githubContext.associated_branch}` : "— Select Branch —"}</option>
                        {githubContext.available_branches.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleAssociateBranch}
                        disabled={branchSaving || !selectedBranch || selectedBranch === githubContext.associated_branch}
                        className="btn-secondary text-xs px-2.5 py-1.5 disabled:opacity-50"
                      >
                        {branchSaving ? "Saving..." : "Link"}
                      </button>
                    </div>
                    {githubContext.associated_branch && (
                      <p className="text-[11px] text-surface-400">
                        Active branch: <span className="font-mono text-primary-300 font-medium">{githubContext.associated_branch}</span>
                      </p>
                    )}
                  </div>

                  {/* Pull Request Association */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider block">
                      Associated Pull Request
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="https://github.com/.../pull/1"
                        value={prUrlInput}
                        onChange={(e) => setPrUrlInput(e.target.value)}
                        disabled={prSaving}
                        className="bg-surface-900 border border-surface-700 rounded-lg px-2.5 py-1.5 text-xs text-surface-200 flex-1 focus:outline-none focus:border-primary-500 placeholder:text-surface-600"
                      />
                      <button
                        onClick={handleAssociatePR}
                        disabled={prSaving || !prUrlInput.trim()}
                        className="btn-secondary text-xs px-2.5 py-1.5 disabled:opacity-50"
                      >
                        {prSaving ? "Saving..." : "Link"}
                      </button>
                    </div>
                    {githubContext.associated_pull_request_url && (
                      <p className="text-[11px] text-surface-400 flex items-center gap-1.5">
                        <span>PR #{githubContext.associated_pull_request_number || "link"}:</span>
                        <a
                          href={githubContext.associated_pull_request_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary-400 hover:text-primary-300 underline font-medium truncate max-w-[180px]"
                        >
                          {githubContext.associated_pull_request_url}
                        </a>
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Workflow Timeline */}
            <div>
              <h4 className="text-surface-400 text-xs font-semibold uppercase tracking-wider mb-3">Workflow Timeline</h4>
              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-surface-700 before:to-transparent">
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-surface-700 bg-surface-900 group-[.is-active]:border-primary-500 text-surface-400 group-[.is-active]:text-primary-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
                  </div>
                  <div className="w-[calc(100%-3rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-lg glass-card">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-surface-200 text-sm">Assigned</span>
                    </div>
                    <div className="text-surface-400 text-xs mt-1">{selectedTask.assigned_at ? new Date(selectedTask.assigned_at).toLocaleString() : "Not recorded"}</div>
                  </div>
                </div>

                <div className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group ${selectedTask.started_at ? 'is-active' : ''}`}>
                  <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-surface-700 bg-surface-900 group-[.is-active]:border-primary-500 text-surface-400 group-[.is-active]:text-primary-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
                  </div>
                  <div className="w-[calc(100%-3rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-lg glass-card">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-surface-200 text-sm">Started</span>
                    </div>
                    <div className="text-surface-400 text-xs mt-1">{selectedTask.started_at ? new Date(selectedTask.started_at).toLocaleString() : "Pending"}</div>
                  </div>
                </div>

                <div className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group ${selectedTask.review_started_at ? 'is-active' : ''}`}>
                  <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-surface-700 bg-surface-900 group-[.is-active]:border-primary-500 text-surface-400 group-[.is-active]:text-primary-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
                  </div>
                  <div className="w-[calc(100%-3rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-lg glass-card">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-surface-200 text-sm">Submitted for Review</span>
                    </div>
                    <div className="text-surface-400 text-xs mt-1">{selectedTask.review_started_at ? new Date(selectedTask.review_started_at).toLocaleString() : "Pending"}</div>
                  </div>
                </div>

                <div className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group ${selectedTask.completed_at ? 'is-active' : ''}`}>
                  <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-surface-700 bg-surface-900 group-[.is-active]:border-success-500 text-surface-400 group-[.is-active]:text-success-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  </div>
                  <div className="w-[calc(100%-3rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-lg glass-card">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-surface-200 text-sm">Completed</span>
                    </div>
                    <div className="text-surface-400 text-xs mt-1">{selectedTask.completed_at ? new Date(selectedTask.completed_at).toLocaleString() : "Pending"}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-surface-700/50 flex justify-end">
              <button onClick={() => setSelectedTask(null)} className="btn-secondary text-sm">Close</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
