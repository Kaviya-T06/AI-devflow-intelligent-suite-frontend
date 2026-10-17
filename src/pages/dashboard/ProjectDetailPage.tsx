/**
 * ProjectDetailPage — tabbed project detail view for PM and Developer roles.
 *
 * Tabs:
 *   Overview — project metadata, progress, task summary
 *   Tasks    — filterable tasks list for this project
 *   GitHub   — repository connect/sync, branches, commits, PRs, issues
 *   History  — inline project-scoped activity timeline + GitHub events
 *   What-If  — read-only deadline simulation (MANAGER / ADMIN only)
 *
 * Route: /dashboard/projects/:projectId
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  fetchProjectHistory,
  fetchProjectTasks,
  simulateDeadlineChange,
  fetchSimulatorData,
  updateTaskEstimate,
  updateDeveloperCapacity,
} from "../../services/pmService";
import { deleteProject } from "../../services/adminService";
import type {
  DeadlineSimulationResponse,
  ProjectSimulatorData,
} from "../../services/pmService";
import {
  getProjectRepository,
  connectRepository,
  disconnectRepository,
  syncRepository,
  createProjectBranch,
  getCommits,
  getPullRequests,
  getIssues,
  getBranches,
  assignBranchDeveloper,
  unassignBranchDeveloper,
  fetchProjectAssignableDevelopers,
} from "../../services/githubService";
import type {
  GitHubRepository,
  GitHubCommit,
  GitHubPullRequest,
  GitHubIssue,
  GitHubBranch,
  BranchAssignableDeveloper,
} from "../../services/githubService";
import Modal from "../../components/ui/Modal";
import type { ActivityLog, Task, Project } from "../../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function ago(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  if (isNaN(ms)) return "—";
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const API = (import.meta as any).env?.VITE_API_BASE_URL ?? "http://localhost:8000";
  const token = localStorage.getItem("access_token");
  return fetch(`${API}/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? `API error ${res.status}`);
    }
    if (res.status === 204) return undefined as unknown as T;
    return res.json() as Promise<T>;
  });
}

// ---------------------------------------------------------------------------
// Tab types
// ---------------------------------------------------------------------------

type Tab = "overview" | "tasks" | "github" | "history" | "whatif";

const ALL_TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "tasks",    label: "Tasks",    icon: "✅" },
  { id: "github",   label: "GitHub",   icon: "🐙" },
  { id: "history",  label: "History",  icon: "📜" },
  { id: "whatif",   label: "What-If",  icon: "🔬" },
];

function statusBadge(status: string) {
  const cls =
    status === "active"    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/20" :
    status === "planning"  ? "bg-blue-500/15 text-blue-300 border-blue-500/20" :
    status === "on_hold"   ? "bg-amber-500/15 text-amber-300 border-amber-500/20" :
    status === "completed" ? "bg-purple-500/15 text-purple-300 border-purple-500/20" :
                             "bg-surface-700/50 text-surface-400 border-surface-700/50";
  return `badge text-xs px-2.5 py-1 rounded-full font-medium capitalize border ${cls}`;
}

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------

function OverviewTab({ project, tasks }: { project: Project; tasks: Task[] }) {
  const total    = tasks.length;
  const done     = tasks.filter((t) => t.status === "COMPLETED").length;
  const inProg   = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const rev      = tasks.filter((t) => t.status === "REVIEW").length;
  const todo     = tasks.filter((t) => t.status === "TODO").length;
  const overdue  = tasks.filter((t) => t.due_date && t.status !== "COMPLETED" && new Date() > new Date(t.due_date)).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-surface-50">{project.name}</h3>
            {project.description && <p className="text-surface-400 text-sm mt-1">{project.description}</p>}
          </div>
          <span className={statusBadge(project.status)}>{project.status.replace("_", " ")}</span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><p className="text-surface-500 text-xs">Start Date</p><p className="text-surface-200 font-medium">{fmt(project.start_date)}</p></div>
          <div><p className="text-surface-500 text-xs">Deadline</p><p className="text-surface-200 font-medium">{fmt(project.end_date)}</p></div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-surface-400">Progress</span>
            <span className="text-primary-400 font-semibold">{project.progress}%</span>
          </div>
          <div className="w-full h-2 bg-surface-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, Math.max(0, project.progress))}%` }} />
          </div>
        </div>
      </div>
      <div className="glass-card p-6">
        <h4 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-4">Task Summary</h4>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { l: "Total",     v: total,   c: "text-surface-200" },
            { l: "Todo",      v: todo,    c: "text-surface-400" },
            { l: "In Prog",   v: inProg,  c: "text-primary-300" },
            { l: "Review",    v: rev,     c: "text-warning-300" },
            { l: "Completed", v: done,    c: "text-success-300" },
            { l: "Overdue",   v: overdue, c: "text-danger-400"  },
          ].map((item) => (
            <div key={item.l} className="bg-surface-800/60 p-3 rounded-lg text-center">
              <p className={`text-xl font-bold ${item.c}`}>{item.v}</p>
              <p className="text-surface-500 text-[10px] mt-0.5">{item.l}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tasks Tab
// ---------------------------------------------------------------------------

function TasksTab({ tasks, loading }: { tasks: Task[]; loading: boolean }) {
  const [filter, setFilter] = useState("ALL");
  const filtered = useMemo(
    () => filter === "ALL" ? tasks : tasks.filter((t) => t.status === filter),
    [tasks, filter]
  );
  const sCls: Record<string, string> = {
    TODO:        "bg-surface-700/50 text-surface-300",
    IN_PROGRESS: "bg-primary-500/15 text-primary-300 border border-primary-500/20",
    REVIEW:      "bg-warning-500/15 text-warning-300 border border-warning-500/20",
    COMPLETED:   "bg-success-500/15 text-success-300 border border-success-500/20",
  };
  const pCls: Record<string, string> = {
    LOW: "text-surface-400", MEDIUM: "text-warning-400", HIGH: "text-danger-400", CRITICAL: "text-red-400",
  };

  if (loading) return (
    <div className="space-y-3 animate-pulse">
      {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-surface-800 rounded-lg" />)}
    </div>
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex gap-2 flex-wrap">
        {["ALL","TODO","IN_PROGRESS","REVIEW","COMPLETED"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${filter === s
              ? "bg-primary-500/20 text-primary-300 border border-primary-500/30"
              : "text-surface-400 border border-surface-700/50 hover:border-surface-600"}`}>
            {s.replace("_", " ")}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="glass-card p-10 text-center"><p className="text-surface-400 text-sm">No tasks found.</p></div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => {
            const od = task.due_date && task.status !== "COMPLETED" && new Date() > new Date(task.due_date);
            return (
              <div key={task.id} className={`glass-card p-4 flex items-center gap-4 ${od ? "border-danger-500/30" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-surface-100 font-medium text-sm truncate">{task.title}</p>
                    {od && <span className="text-[10px] bg-danger-500/10 text-danger-400 px-1.5 py-0.5 rounded border border-danger-500/20 shrink-0">⚠️ Overdue</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-surface-500">
                    {task.developer_name && <span>👤 {task.developer_name}</span>}
                    {task.due_date && <span>📅 Due {fmt(task.due_date)}</span>}
                    <span className={pCls[task.priority] || "text-surface-400"}>⚡ {task.priority}</span>
                    {(task.estimated_hours ?? task.estimated_effort) !== undefined && (task.estimated_hours ?? task.estimated_effort) !== null ? (
                      <span className="text-primary-300 font-medium">⏱️ {task.estimated_hours ?? task.estimated_effort}h</span>
                    ) : (
                      <span className="text-warning-400/80 italic">⏱️ No estimate</span>
                    )}
                  </div>
                </div>
                <span className={`badge text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${sCls[task.status] || ""}`}>
                  {task.status.replace("_", " ")}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GitHub Tab
// ---------------------------------------------------------------------------

type GHSub = "overview" | "branches" | "commits" | "pulls" | "issues";

function GitHubTab({ projectId }: { projectId: string }) {
  const { profile } = useAuth();
  const isMgr = profile?.role === "MANAGER" || profile?.role === "ADMIN";

  const [repo, setRepo]             = useState<GitHubRepository | null>(null);
  const [loading, setLoading]       = useState(true);
  const [err, setErr]               = useState<string | null>(null);
  const [notice, setNotice]         = useState<string | null>(null);
  const [sub, setSub]               = useState<GHSub>("overview");
  const [tLoading, setTLoading]     = useState(false);
  const [commits, setCommits]       = useState<GitHubCommit[]>([]);
  const [pulls, setPulls]           = useState<GitHubPullRequest[]>([]);
  const [issues, setIssues]         = useState<GitHubIssue[]>([]);
  const [branches, setBranches]     = useState<GitHubBranch[]>([]);
  const [repoUrl, setRepoUrl]       = useState("");
  const [connecting, setConn]       = useState(false);
  const [syncing, setSyncing]       = useState(false);
  const [showNB, setShowNB]         = useState(false);
  const [bName, setBName]           = useState("");
  const [bBase, setBBase]           = useState("main");
  const [bBusy, setBBusy]           = useState(false);
  const [bErr, setBErr]             = useState<string | null>(null);

  // Link developer to branch state
  const [linkModalBranch, setLinkModalBranch] = useState<GitHubBranch | null>(null);
  const [assignableDevs, setAssignableDevs] = useState<BranchAssignableDeveloper[]>([]);
  const [loadingAssignables, setLoadingAssignables] = useState(false);
  const [selectedDevId, setSelectedDevId] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [savingLink, setSavingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const loadRepo = useCallback(async () => {
    setLoading(true); setErr(null); setNotice(null); setRepo(null);
    setCommits([]); setPulls([]); setIssues([]); setBranches([]); setSub("overview");
    try {
      const r = await getProjectRepository(projectId);
      setRepo(r);
      if (r?.default_branch) setBBase(r.default_branch);
    } catch (e: any) {
      if (!e.message?.includes("404") && !e.message?.includes("Not Found")) setErr(e.message || "Failed to load repo");
    } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { loadRepo(); }, [loadRepo]);

  const loadSub = useCallback(async (t: GHSub) => {
    if (!repo) return;
    setTLoading(true);
    try {
      if (t === "commits")  setCommits(await getCommits(projectId));
      if (t === "pulls")    setPulls(await getPullRequests(projectId));
      if (t === "issues")   setIssues(await getIssues(projectId));
      if (t === "branches") setBranches(await getBranches(projectId));
    } catch (e: any) { setErr(e.message || "Failed to load"); }
    finally { setTLoading(false); }
  }, [repo, projectId]);

  const onSub = (t: GHSub) => { setSub(t); if (t !== "overview") loadSub(t); };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault(); setConn(true); setErr(null);
    try {
      const r = await connectRepository(projectId, { repository_url: repoUrl.trim() });
      setRepo(r); setRepoUrl(""); setNotice("Repository connected successfully.");
    } catch (e: any) { setErr(e.message || "Failed to connect"); }
    finally { setConn(false); }
  };

  const handleSync = async () => {
    setSyncing(true); setErr(null); setNotice(null);
    try {
      const r = await syncRepository(projectId);
      setRepo(r); setNotice("Repository synchronized.");
      if (sub !== "overview") await loadSub(sub);
    } catch (e: any) { setErr(e.message || "Sync failed"); }
    finally { setSyncing(false); }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Disconnect this repository from the project?")) return;
    try {
      await disconnectRepository(projectId);
      setRepo(null); setCommits([]); setPulls([]); setIssues([]); setBranches([]);
      setNotice("Repository disconnected.");
    } catch (e: any) { setErr(e.message || "Failed to disconnect"); }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault(); setBErr(null); setBBusy(true);
    try {
      await createProjectBranch(projectId, { branch_name: bName.trim(), base_branch: bBase });
      setNotice(`Branch "${bName.trim()}" created.`);
      setBName(""); setShowNB(false);
      await loadSub("branches");
    } catch (e: any) { setBErr(e.message || "Failed to create branch"); }
    finally { setBBusy(false); }
  };

  const handleOpenLinkModal = async (branch: GitHubBranch) => {
    setLinkModalBranch(branch);
    setLinkError(null);
    let devId = "";
    let taskId = "";
    if (typeof branch.linked_developer === "object" && branch.linked_developer) {
      devId = branch.linked_developer.id || "";
      taskId = branch.linked_developer.task_id || "";
    }
    setSelectedDevId(devId);
    setSelectedTaskId(taskId);
    setLoadingAssignables(true);
    try {
      const devs = await fetchProjectAssignableDevelopers(projectId);
      setAssignableDevs(devs);
    } catch (e: any) {
      console.error("Failed to load assignable developers", e);
    } finally {
      setLoadingAssignables(false);
    }
  };

  const handleSaveBranchLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkModalBranch || !selectedDevId) return;
    setSavingLink(true);
    setLinkError(null);
    try {
      await assignBranchDeveloper(projectId, linkModalBranch.name, {
        developer_id: selectedDevId,
        task_id: selectedTaskId || null,
      });
      setLinkModalBranch(null);
      const updated = await getBranches(projectId);
      setBranches(updated);
      setNotice(`Branch "${linkModalBranch.name}" successfully linked.`);
    } catch (err: any) {
      setLinkError(err.message || "Failed to link developer to branch");
    } finally {
      setSavingLink(false);
    }
  };

  const handleUnlinkBranch = async (branchName: string) => {
    if (!window.confirm(`Are you sure you want to unlink the developer from branch "${branchName}"?`)) return;
    try {
      await unassignBranchDeveloper(projectId, branchName);
      const updated = await getBranches(projectId);
      setBranches(updated);
      setNotice(`Developer unlinked from branch "${branchName}".`);
    } catch (err: any) {
      setErr(err.message || "Failed to unlink developer");
    }
  };

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-12 bg-surface-800 rounded-lg" /><div className="h-32 bg-surface-800 rounded-lg" />
    </div>
  );

  if (!repo) return (
    <div className="glass-card p-8 text-center space-y-4 animate-fade-in">
      <span className="text-5xl block">🐙</span>
      <h3 className="text-surface-100 font-semibold">No GitHub Repository Connected</h3>
      <p className="text-surface-400 text-sm">Connect a GitHub repository to view branches, commits, and pull requests.</p>
      {isMgr ? (
        <form onSubmit={handleConnect} className="max-w-md mx-auto space-y-3 text-left">
          <div>
            <label className="block text-surface-400 text-xs font-medium mb-1">Repository URL</label>
            <input type="url" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repository"
              className="w-full bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2 text-surface-100 text-sm focus:outline-none focus:border-primary-500/50"
              required />
            <p className="text-surface-600 text-xs mt-1">Must be a public GitHub repository URL.</p>
          </div>
          {err && <p className="text-danger-400 text-xs">⚠️ {err}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={connecting || !repoUrl.trim()} className="btn-primary text-sm px-4 py-2">
              {connecting ? "Connecting…" : "Connect Repository"}
            </button>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="btn-secondary text-sm px-4 py-2">🐙 GitHub</a>
          </div>
        </form>
      ) : (
        <p className="text-surface-500 text-sm">Only project managers or admins can connect a repository.</p>
      )}
    </div>
  );

  const SUBS: { id: GHSub; label: string }[] = [
    { id: "overview",  label: "Overview" },
    { id: "branches",  label: "Branches" },
    { id: "commits",   label: "Commits" },
    { id: "pulls",     label: "Pull Requests" },
    { id: "issues",    label: "Issues" },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🐙</span>
          <div>
            <a href={repo.html_url} target="_blank" rel="noreferrer" className="text-primary-400 hover:underline font-semibold">{repo.full_name}</a>
            <p className="text-surface-500 text-xs mt-0.5">
              Default: <code className="text-surface-300">{repo.default_branch}</code>
              {repo.last_synced_at && ` · Synced ${ago(repo.last_synced_at)}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a href={repo.html_url} target="_blank" rel="noreferrer" className="btn-secondary text-xs px-3 py-1.5">Open ↗</a>
          <button onClick={handleSync} disabled={syncing} className="btn-secondary text-xs px-3 py-1.5">
            {syncing ? "Syncing…" : "🔄 Sync"}
          </button>
          {isMgr && (
            <button onClick={handleDisconnect} className="text-xs px-3 py-1.5 rounded-lg border border-danger-500/30 text-danger-400 hover:bg-danger-500/10 transition-colors">
              Disconnect
            </button>
          )}
        </div>
      </div>

      {notice && <div className="bg-success-500/10 border border-success-500/20 text-success-400 p-3 rounded-lg text-sm">✓ {notice}</div>}
      {err    && <div className="bg-danger-500/10 border border-danger-500/20 text-danger-400 p-3 rounded-lg text-sm">⚠️ {err}</div>}

      <div className="flex border-b border-surface-700/50 gap-1 overflow-x-auto">
        {SUBS.map((t) => (
          <button key={t.id} onClick={() => onSub(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              sub === t.id ? "border-primary-500 text-primary-400" : "border-transparent text-surface-400 hover:text-surface-200"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tLoading ? (
        <div className="text-center text-surface-400 py-8 text-sm animate-pulse">Loading…</div>
      ) : (
        <div className="space-y-2">
          {sub === "overview" && (
            <div className="glass-card p-5 space-y-3">
              <h4 className="font-semibold text-surface-200 text-sm uppercase tracking-wider">Repository Details</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div><p className="text-surface-500 text-xs">Owner</p><p className="text-surface-200 font-medium">{repo.owner}</p></div>
                <div><p className="text-surface-500 text-xs">Name</p><p className="text-surface-200 font-medium">{repo.repository_name}</p></div>
                <div><p className="text-surface-500 text-xs">Default Branch</p><p className="text-surface-200 font-medium">{repo.default_branch}</p></div>
              </div>
              <p className="text-surface-500 text-xs">Clone the repository locally and push code, then click Sync to refresh data here.</p>
            </div>
          )}

          {sub === "branches" && (
            <div className="space-y-3">
              {isMgr && (
                <div className="flex justify-end">
                  <button onClick={() => setShowNB(!showNB)} className="btn-primary text-xs px-3 py-1.5">+ New Branch</button>
                </div>
              )}
              {showNB && (
                <form onSubmit={handleCreateBranch} className="glass-card p-4 space-y-3">
                  <h4 className="font-semibold text-surface-200 text-sm">Create Branch</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-surface-400 text-xs mb-1">Branch Name</label>
                      <input type="text" value={bName} onChange={(e) => setBName(e.target.value)}
                        placeholder="feature/my-branch"
                        className="w-full bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2 text-surface-100 text-sm focus:outline-none focus:border-primary-500/50"
                        required />
                    </div>
                    <div>
                      <label className="block text-surface-400 text-xs mb-1">Base Branch</label>
                      <input type="text" value={bBase} onChange={(e) => setBBase(e.target.value)}
                        className="w-full bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2 text-surface-100 text-sm focus:outline-none focus:border-primary-500/50"
                        required />
                    </div>
                  </div>
                  {bErr && <p className="text-danger-400 text-xs">⚠️ {bErr}</p>}
                  <div className="flex gap-2">
                    <button type="submit" disabled={bBusy} className="btn-primary text-xs px-4 py-1.5">{bBusy ? "Creating…" : "Create"}</button>
                    <button type="button" onClick={() => setShowNB(false)} className="btn-secondary text-xs px-4 py-1.5">Cancel</button>
                  </div>
                </form>
              )}
              {branches.length === 0
                ? <div className="glass-card p-8 text-center text-surface-400 text-sm">No branches found. Click Sync to refresh.</div>
                : branches.map((b) => {
                    const linkedDevName =
                      typeof b.linked_developer === "object" && b.linked_developer !== null
                        ? b.linked_developer.name
                        : typeof b.linked_developer === "string"
                        ? b.linked_developer
                        : "Not linked";
                    const linkedDevTask =
                      typeof b.linked_developer === "object" && b.linked_developer !== null
                        ? b.linked_developer.task_title
                        : null;
                    const isLinked = linkedDevName !== "Not linked";

                    return (
                      <div key={b.name} className="glass-card p-4">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-surface-100 font-mono font-medium text-sm">{b.name}</p>
                              {b.name === repo.default_branch && (
                                <span className="badge bg-primary-500/20 text-primary-300 text-[10px]">
                                  Default
                                </span>
                              )}
                              {b.associated_pull_request && (
                                <span className="badge bg-purple-500/15 text-purple-300 border border-purple-500/20 text-[10px] px-2 py-0.5 rounded-full shrink-0">
                                  PR #{b.associated_pull_request}
                                </span>
                              )}
                            </div>
                            {b.last_commit_message && <p className="text-surface-400 text-xs mt-1 truncate">{b.last_commit_message}</p>}
                            <div className="flex gap-3 mt-1.5 text-[11px] text-surface-400 flex-wrap items-center">
                              {b.last_commit_sha && <span className="font-mono text-surface-400">{b.last_commit_sha.slice(0, 7)}</span>}
                              <span>Author: <strong className="text-surface-300 font-normal">{b.last_commit_author || "Unknown"}</strong></span>
                              {b.last_commit_date && <span>• {ago(b.last_commit_date)}</span>}
                              <span>• Linked dev: <strong className={isLinked ? "text-primary-300 font-semibold" : "text-surface-400 italic font-normal"}>{linkedDevName}</strong></span>
                              {linkedDevTask && (
                                <span className="badge bg-surface-700/60 text-surface-300 text-[10px] px-2 py-0.5 rounded">
                                  Task: {linkedDevTask}
                                </span>
                              )}
                            </div>
                          </div>
                          {isMgr && (
                            <div className="flex items-center gap-2 shrink-0 pt-1 md:pt-0">
                              <button
                                onClick={() => handleOpenLinkModal(b)}
                                className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1 hover:border-primary-500/50 transition-colors"
                                title={isLinked ? "Change developer or task" : "Assign branch to developer"}
                              >
                                <span>🔗</span>
                                <span>{isLinked ? "Change Link" : "Link Developer"}</span>
                              </button>
                              {isLinked && (
                                <button
                                  onClick={() => handleUnlinkBranch(b.name)}
                                  className="text-xs py-1 px-2 rounded border border-danger-500/30 text-danger-400 hover:bg-danger-500/10 transition-colors"
                                  title="Unlink developer from this branch"
                                >
                                  Unlink
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
              }
            </div>
          )}

          {sub === "commits" && (
            <div className="space-y-2">
              {commits.length === 0
                ? <div className="glass-card p-8 text-center text-surface-400 text-sm">No commits found. Click Sync to refresh.</div>
                : commits.map((c) => (
                  <div key={c.sha} className="glass-card p-4 flex items-start gap-3">
                    <span className="text-lg shrink-0">🔨</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-surface-100 text-sm font-medium truncate">{c.message}</p>
                      <div className="flex gap-3 mt-1 text-[11px] text-surface-500">
                        <span className="font-mono">{c.sha.slice(0, 7)}</span>
                        <span>by {c.author}</span>
                        <span>{ago(c.date)}</span>
                      </div>
                    </div>
                    <a href={c.url} target="_blank" rel="noreferrer" className="text-primary-400 text-xs hover:underline shrink-0">View ↗</a>
                  </div>
                ))
              }
            </div>
          )}

          {sub === "pulls" && (
            <div className="space-y-2">
              {pulls.length === 0
                ? <div className="glass-card p-8 text-center text-surface-400 text-sm">No pull requests found.</div>
                : pulls.map((pr) => (
                  <div key={pr.number} className="glass-card p-4 flex items-start gap-3">
                    <span className="text-lg shrink-0">🔀</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-surface-100 text-sm font-medium truncate">{pr.title}</p>
                        <span className={`badge text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
                          pr.state === "open" ? "bg-success-500/15 text-success-300" :
                          pr.state === "merged" ? "bg-purple-500/15 text-purple-300" :
                          "bg-surface-700/50 text-surface-400"}`}>{pr.state}</span>
                      </div>
                      <div className="flex gap-3 mt-1 text-[11px] text-surface-500">
                        <span>#{pr.number}</span><span>by {pr.author}</span>
                        <span>{ago(pr.updated_at || pr.created_at)}</span>
                      </div>
                    </div>
                    <a href={pr.url} target="_blank" rel="noreferrer" className="text-primary-400 text-xs hover:underline shrink-0">View ↗</a>
                  </div>
                ))
              }
            </div>
          )}

          {sub === "issues" && (
            <div className="space-y-2">
              {issues.length === 0
                ? <div className="glass-card p-8 text-center text-surface-400 text-sm">No issues found.</div>
                : issues.map((issue) => (
                  <div key={issue.number} className="glass-card p-4 flex items-start gap-3">
                    <span className="text-lg shrink-0">⚠️</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-surface-100 text-sm font-medium">{issue.title}</p>
                      <div className="flex gap-3 mt-1 text-[11px] text-surface-500">
                        <span>#{issue.number}</span><span>by {issue.author}</span>
                        <span className={issue.state === "open" ? "text-success-400" : "text-surface-500"}>{issue.state}</span>
                      </div>
                    </div>
                    <a href={issue.url} target="_blank" rel="noreferrer" className="text-primary-400 text-xs hover:underline shrink-0">View ↗</a>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      )}

      {/* Link Developer / Assign Branch Modal */}
      {linkModalBranch && (
        <Modal
          isOpen={!!linkModalBranch}
          onClose={() => setLinkModalBranch(null)}
          title="🔗 Link Developer / Assign Branch"
        >
          <div className="space-y-4">
            <div className="p-3 bg-surface-800/60 rounded-lg border border-surface-700/50 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-surface-400">Branch:</span>
                <span className="font-mono text-surface-200 font-semibold">{linkModalBranch.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-400">Latest Commit:</span>
                <span className="text-surface-300 truncate max-w-[280px]">{linkModalBranch.last_commit_message || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-400">Commit Author:</span>
                <span className="text-surface-300 font-medium">{linkModalBranch.last_commit_author || "Unknown"}</span>
              </div>
            </div>

            <form onSubmit={handleSaveBranchLink} className="space-y-4">
              <div>
                <label className="block text-surface-300 text-xs font-semibold mb-1.5">
                  Select Developer <span className="text-danger-400">*</span>
                </label>
                {loadingAssignables ? (
                  <p className="text-xs text-surface-500 animate-pulse">Loading project developers…</p>
                ) : assignableDevs.length === 0 ? (
                  <p className="text-xs text-warning-400">No developers found for this project.</p>
                ) : (
                  <select
                    value={selectedDevId}
                    onChange={(e) => {
                      setSelectedDevId(e.target.value);
                      setSelectedTaskId("");
                    }}
                    className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-surface-100 text-sm focus:outline-none focus:border-primary-500"
                    required
                  >
                    <option value="">-- Choose an assigned developer --</option>
                    {assignableDevs.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.email ? `(${d.email})` : ""} {d.tasks.length > 0 ? `— ${d.tasks.length} task(s)` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedDevId && (
                <div>
                  <label className="block text-surface-300 text-xs font-semibold mb-1.5">
                    Associate with Task <span className="text-surface-500 font-normal">(Optional)</span>
                  </label>
                  {(() => {
                    const dev = assignableDevs.find((d) => d.id === selectedDevId);
                    const devTasks = dev?.tasks || [];
                    return (
                      <select
                        value={selectedTaskId}
                        onChange={(e) => setSelectedTaskId(e.target.value)}
                        className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-surface-100 text-sm focus:outline-none focus:border-primary-500"
                      >
                        <option value="">-- None / General Branch --</option>
                        {devTasks.map((t) => (
                          <option key={t.id} value={t.id}>
                            [{t.status}] {t.title}
                          </option>
                        ))}
                      </select>
                    );
                  })()}
                </div>
              )}

              {linkError && (
                <div className="p-3 bg-danger-500/10 border border-danger-500/20 rounded-lg text-danger-400 text-xs">
                  ⚠️ {linkError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-800">
                <button
                  type="button"
                  onClick={() => setLinkModalBranch(null)}
                  className="btn-secondary text-xs px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLink || !selectedDevId}
                  className="btn-primary text-xs px-4 py-2 disabled:opacity-50"
                >
                  {savingLink ? "Saving Link…" : "Save Assignment"}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// History Tab — inline project activity + GitHub events
// ---------------------------------------------------------------------------

function HistoryTab({ projectId, projectName, tasks }: { projectId: string; projectName: string; tasks: Task[] }) {
  const [logs, setLogs]         = useState<ActivityLog[]>([]);
  const [ghC, setGhC]           = useState<GitHubCommit[]>([]);
  const [ghP, setGhP]           = useState<GitHubPullRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState<string | null>(null);
  const [filter, setFilter]     = useState("ALL");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchProjectHistory(projectId).catch(() => [] as ActivityLog[]),
      getProjectRepository(projectId).catch(() => null),
    ]).then(async ([ls, repo]) => {
      setLogs(ls);
      if (repo) {
        const [c, p] = await Promise.all([
          getCommits(projectId).catch(() => [] as GitHubCommit[]),
          getPullRequests(projectId).catch(() => [] as GitHubPullRequest[]),
        ]);
        setGhC(c); setGhP(p);
      }
    }).catch((e) => setErr(e.message || "Failed to load history"))
      .finally(() => setLoading(false));
  }, [projectId]);

  const total  = tasks.length;
  const done   = tasks.filter((t) => t.status === "COMPLETED").length;
  const inProg = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const rev    = tasks.filter((t) => t.status === "REVIEW").length;
  const pct    = total > 0 ? Math.round((done / total) * 100) : 0;

  const unified = useMemo(() => {
    const items: { id: string; cat: string; title: string; desc: string; actor?: string | null; ts: string; src: string; url?: string | null; icon: string }[] = [];
    for (const l of logs) {
      const gh = l.action.startsWith("GITHUB_");
      const tk = l.action.startsWith("TASK_");
      items.push({ id: `l-${l.id}`, cat: gh ? "GITHUB" : tk ? "TASK" : "WORKFLOW",
        title: l.action.replace(/_/g, " "), desc: l.description,
        actor: l.user?.full_name || null, ts: l.created_at, src: "System",
        icon: gh ? "🐙" : tk ? "✓" : "📁" });
    }
    for (const c of ghC)
      items.push({ id: `c-${c.sha}`, cat: "GITHUB", title: `Commit ${c.sha.slice(0, 7)}`,
        desc: c.message, actor: c.author, ts: c.date, src: "GitHub", url: c.url, icon: "🔨" });
    for (const p of ghP)
      items.push({ id: `p-${p.number}`, cat: "GITHUB", title: `PR #${p.number} (${p.state})`,
        desc: p.title, actor: p.author, ts: p.updated_at || p.created_at, src: "GitHub", url: p.url, icon: "🔀" });
    items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    return items;
  }, [logs, ghC, ghP]);

  const visible = useMemo(
    () => filter === "ALL" ? unified : unified.filter((i) => i.cat === filter),
    [unified, filter]
  );

  if (loading) return (
    <div className="space-y-3 animate-pulse">
      {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-surface-800 rounded-lg" />)}
    </div>
  );
  if (err) return <div className="glass-card p-6 text-center text-danger-400 text-sm">⚠️ {err}</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      {total > 0 && (
        <div className="glass-card p-4 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="font-semibold text-surface-300">Workflow Progress — {projectName}</span>
            <span className="text-primary-400 font-bold">{pct}%</span>
          </div>
          <div className="w-full h-1.5 bg-surface-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs pt-1">
            {[
              { l: "Total",   v: total,   c: "text-surface-200" },
              { l: "Done",    v: done,    c: "text-success-300" },
              { l: "In Prog", v: inProg,  c: "text-primary-300" },
              { l: "Review",  v: rev,     c: "text-warning-300" },
            ].map((s) => (
              <div key={s.l} className="bg-surface-900/50 p-1.5 rounded">
                <span className={`text-[10px] block ${s.c}`}>{s.l}</span>
                <span className="font-semibold text-surface-200">{s.v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap items-center">
        {["ALL","TASK","GITHUB","WORKFLOW"].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded text-xs transition-colors ${filter === f
              ? "bg-primary-500/20 text-primary-300 font-medium border border-primary-500/30"
              : "text-surface-400 hover:text-surface-200 bg-surface-800/40 border border-surface-700/40"}`}>
            {f === "ALL" ? "All History" : f}
          </button>
        ))}
        <span className="ml-auto text-surface-600 text-xs">{visible.length} event{visible.length !== 1 ? "s" : ""}</span>
      </div>

      {visible.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <span className="text-4xl block mb-3">📜</span>
          <p className="text-surface-300 font-semibold">No Events Found</p>
          <p className="text-surface-500 text-sm mt-1">
            {filter !== "ALL" ? `No "${filter}" events recorded yet.` : "No activity recorded for this project yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((item) => (
            <div key={item.id} className="glass-card p-3.5 flex items-start gap-3 text-xs">
              <span className="text-base shrink-0 mt-0.5">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-surface-200">{item.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${item.src === "GitHub" ? "bg-purple-500/15 text-purple-300" : "bg-surface-800 text-surface-400"}`}>
                      {item.src}
                    </span>
                  </div>
                  <span className="text-[10px] text-surface-500 shrink-0">{ago(item.ts)}</span>
                </div>
                <p className="text-surface-300 leading-relaxed">{item.desc}</p>
                <div className="flex items-center justify-between mt-1.5 text-[11px] text-surface-500">
                  {item.actor && <span>By: {item.actor}</span>}
                  {item.url && <a href={item.url} target="_blank" rel="noreferrer" className="text-primary-400 hover:underline">View ↗</a>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// What-If Tab — read-only deadline simulation & effort/capacity management
// ---------------------------------------------------------------------------

function WhatIfTab({ project }: { project: Project }) {
  const [proposedDate, setDate]       = useState("");
  const [simulating, setSim]          = useState(false);
  const [err, setErr]                 = useState<string | null>(null);
  const [result, setResult]           = useState<DeadlineSimulationResponse | null>(null);

  // Project simulator data & estimates/capacity editor
  const [simData, setSimData]         = useState<ProjectSimulatorData | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [showEditor, setShowEditor]   = useState(false);
  const [editorTab, setEditorTab]     = useState<"tasks" | "developers">("tasks");
  const [taskInputs, setTaskInputs]   = useState<Record<string, string>>({});
  const [devInputs, setDevInputs]     = useState<Record<string, string>>({});
  const [savingField, setSavingField] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const loadSimData = useCallback(async () => {
    setLoadingData(true);
    try {
      const data = await fetchSimulatorData(project.id);
      setSimData(data);
      const tInp: Record<string, string> = {};
      data.tasks.forEach((t) => {
        tInp[t.id] = t.estimated_hours !== null && t.estimated_hours !== undefined ? String(t.estimated_hours) : "";
      });
      setTaskInputs(tInp);

      const dInp: Record<string, string> = {};
      data.developers.forEach((d) => {
        dInp[d.developer_id] = d.capacity_hours_per_week !== null && d.capacity_hours_per_week !== undefined
          ? String(d.capacity_hours_per_week)
          : "40";
      });
      setDevInputs(dInp);
    } catch (e: any) {
      console.error("Failed to load simulator data:", e);
    } finally {
      setLoadingData(false);
    }
  }, [project.id]);

  useEffect(() => {
    loadSimData();
  }, [loadSimData]);

  const handleSaveTaskEstimate = async (taskId: string) => {
    const raw = taskInputs[taskId];
    const val = parseFloat(raw);
    if (isNaN(val) || val < 0) {
      setErr("Please enter a valid non-negative number of hours.");
      return;
    }
    setSavingField(`task-${taskId}`);
    setErr(null);
    setSaveSuccess(null);
    try {
      await updateTaskEstimate(project.id, taskId, val);
      setSaveSuccess(`Updated estimate for task to ${val} hours.`);
      const updated = await fetchSimulatorData(project.id);
      setSimData(updated);
      if (proposedDate && result) {
        const simRes = await simulateDeadlineChange(project.id, proposedDate);
        setResult(simRes);
      }
    } catch (e: any) {
      setErr(e.message || "Failed to save estimate");
    } finally {
      setSavingField(null);
    }
  };

  const handleSaveDeveloperCapacity = async (developerId: string) => {
    const raw = devInputs[developerId];
    const val = parseFloat(raw);
    if (isNaN(val) || val < 0 || val > 168) {
      setErr("Please enter a valid weekly capacity between 0 and 168 hours.");
      return;
    }
    setSavingField(`dev-${developerId}`);
    setErr(null);
    setSaveSuccess(null);
    try {
      await updateDeveloperCapacity(project.id, developerId, val);
      setSaveSuccess(`Updated developer capacity to ${val} hrs/week.`);
      const updated = await fetchSimulatorData(project.id);
      setSimData(updated);
      if (proposedDate && result) {
        const simRes = await simulateDeadlineChange(project.id, proposedDate);
        setResult(simRes);
      }
    } catch (e: any) {
      setErr(e.message || "Failed to save capacity");
    } finally {
      setSavingField(null);
    }
  };

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposedDate) return;
    setSim(true);
    setErr(null);
    setResult(null);
    try {
      setResult(await simulateDeadlineChange(project.id, proposedDate));
    } catch (e: any) {
      setErr(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setSim(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-800/40 p-4 rounded-xl border border-surface-700/50 text-xs text-surface-400 leading-relaxed">
        <div>
          <span className="font-semibold text-warning-400">🔬 Simulation Mode:</span> This is{" "}
          <strong className="text-surface-300">read-only</strong>. Running a simulation{" "}
          <strong className="text-surface-300">never</strong> modifies real project data or deadlines.
          Results are hypothetical calculations based on actual project tasks and developer records.
        </div>
        <button
          onClick={() => setShowEditor(!showEditor)}
          className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-surface-700/80 hover:bg-surface-700 text-surface-200 border border-surface-600 rounded-lg text-xs font-medium transition-colors"
        >
          <span>{showEditor ? "Hide" : "Manage"} Estimates & Capacity</span>
          {simData && (
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
              simData.sufficient_data_for_simulation
                ? "bg-success-500/20 text-success-300"
                : "bg-warning-500/20 text-warning-300"
            }`}>
              {simData.sufficient_data_for_simulation ? "Ready" : "Incomplete"}
            </span>
          )}
        </button>
      </div>

      {/* Project Data & Estimates Management Section */}
      {showEditor && (
        loadingData ? (
          <div className="glass-card p-5 text-center text-surface-400 text-xs animate-pulse">
            Loading project estimates &amp; developer capacity…
          </div>
        ) : simData ? (
          <div className="glass-card p-5 border-primary-500/30 animate-fade-in space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-surface-700/60">
            <div>
              <h3 className="font-bold text-surface-100 text-sm flex items-center gap-2">
                <span>📊</span> Manage Task Estimates & Developer Capacity
              </h3>
              <p className="text-xs text-surface-400 mt-0.5">
                Saved values are stored directly in the database and immediately power the What-If calculation.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="bg-surface-800 px-2.5 py-1 rounded-md text-surface-300 border border-surface-700">
                Tasks: <strong>{simData.tasks_with_estimates}/{simData.total_remaining_tasks}</strong> estimated
              </span>
              <span className="bg-surface-800 px-2.5 py-1 rounded-md text-surface-300 border border-surface-700">
                Total Effort: <strong>{simData.total_estimated_effort_hours}h</strong>
              </span>
              <span className="bg-surface-800 px-2.5 py-1 rounded-md text-surface-300 border border-surface-700">
                Developers: <strong>{simData.developers_with_capacity}/{simData.developers.length}</strong> with capacity
              </span>
            </div>
          </div>

          {saveSuccess && (
            <div className="bg-success-500/10 border border-success-500/20 text-success-300 p-2.5 rounded-lg text-xs flex items-center gap-2">
              <span>✅</span> {saveSuccess}
            </div>
          )}

          <div className="flex border-b border-surface-700/40 text-xs">
            <button
              onClick={() => setEditorTab("tasks")}
              className={`px-3 py-2 font-medium border-b-2 transition-colors ${
                editorTab === "tasks" ? "border-primary-500 text-primary-400" : "border-transparent text-surface-400 hover:text-surface-200"
              }`}
            >
              Remaining Tasks & Estimates ({simData.tasks.length})
            </button>
            <button
              onClick={() => setEditorTab("developers")}
              className={`px-3 py-2 font-medium border-b-2 transition-colors ${
                editorTab === "developers" ? "border-primary-500 text-primary-400" : "border-transparent text-surface-400 hover:text-surface-200"
              }`}
            >
              Assigned Developer Capacities ({simData.developers.length})
            </button>
          </div>

          {editorTab === "tasks" ? (
            <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
              {simData.tasks.length === 0 ? (
                <p className="text-xs text-surface-500 py-3 text-center">No remaining tasks in this project.</p>
              ) : (
                simData.tasks.map((task) => (
                  <div key={task.id} className="bg-surface-800/60 p-3 rounded-lg border border-surface-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
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
                          value={taskInputs[task.id] ?? ""}
                          onChange={(e) => setTaskInputs({ ...taskInputs, [task.id]: e.target.value })}
                          className="w-20 bg-surface-900 border border-surface-700 rounded px-2 py-1 text-xs text-surface-100 focus:outline-none focus:border-primary-500 font-mono"
                        />
                      </div>
                      <button
                        onClick={() => handleSaveTaskEstimate(task.id)}
                        disabled={savingField === `task-${task.id}`}
                        className="px-2.5 py-1 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded text-xs transition-colors font-medium"
                      >
                        {savingField === `task-${task.id}` ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
              {simData.developers.length === 0 ? (
                <p className="text-xs text-surface-500 py-3 text-center">No developers assigned to remaining tasks.</p>
              ) : (
                simData.developers.map((dev) => (
                  <div key={dev.developer_id} className="bg-surface-800/60 p-3 rounded-lg border border-surface-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
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
                          value={devInputs[dev.developer_id] ?? ""}
                          onChange={(e) => setDevInputs({ ...devInputs, [dev.developer_id]: e.target.value })}
                          className="w-20 bg-surface-900 border border-surface-700 rounded px-2 py-1 text-xs text-surface-100 focus:outline-none focus:border-primary-500 font-mono"
                        />
                      </div>
                      <button
                        onClick={() => handleSaveDeveloperCapacity(dev.developer_id)}
                        disabled={savingField === `dev-${dev.developer_id}`}
                        className="px-2.5 py-1 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded text-xs transition-colors font-medium"
                      >
                        {savingField === `dev-${dev.developer_id}` ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ) : null)}

      {/* Simulator Inputs & Results Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div>
          <div className="glass-card p-5 space-y-4">
            <h3 className="font-bold text-surface-100 text-sm">🔬 Deadline Simulation</h3>
            <div className="space-y-3 p-3 bg-surface-800/50 rounded-lg border border-surface-700/50">
              <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider">✓ Verified Current Facts</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-surface-500">Project</span>
                  <span className="text-surface-200 font-medium truncate max-w-[170px]">{project.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-500">Current Deadline</span>
                  <span className="text-surface-200 font-medium">{fmt(project.end_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-500">Remaining Tasks</span>
                  <span className="text-surface-200 font-medium">{simData?.total_remaining_tasks ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-500">Total Recorded Effort</span>
                  <span className="text-primary-400 font-medium">{simData ? `${simData.total_estimated_effort_hours}h` : "—"}</span>
                </div>
              </div>
            </div>
            <form onSubmit={run} className="space-y-4">
              <div>
                <label className="block text-surface-400 text-xs font-medium mb-1">
                  📅 Proposed Deadline <span className="text-warning-400">(Hypothetical)</span>
                </label>
                <input
                  type="date"
                  value={proposedDate}
                  onChange={(e) => { setDate(e.target.value); setResult(null); }}
                  className="w-full bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2 text-surface-100 text-sm focus:outline-none focus:border-primary-500/50"
                  required
                />
              </div>
              {err && <div className="bg-danger-500/10 border border-danger-500/20 text-danger-400 p-3 rounded-lg text-xs">⚠️ {err}</div>}
              <button
                type="submit"
                disabled={simulating || !proposedDate}
                className="w-full bg-primary-600 hover:bg-primary-500 disabled:bg-surface-700 disabled:text-surface-500 text-white font-medium text-sm py-2.5 rounded-lg transition-colors"
              >
                {simulating ? "Running Simulation…" : "Run Simulation"}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          {result ? (
            <div className="space-y-4">
              <div className="bg-primary-500/10 border border-primary-500/20 text-primary-300 p-4 rounded-xl flex items-start gap-3">
                <span className="text-xl">✨</span>
                <div>
                  <h4 className="font-semibold text-sm">Simulation Complete (Read-Only)</h4>
                  <p className="text-xs mt-1 text-primary-400/80">
                    Comparing verified current baseline against your proposed hypothetical scenario. No project data was modified.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-card p-5">
                  <h3 className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-4 flex items-center justify-between">
                    <span>✓ Verified Baseline</span>
                    {result.baseline.working_days !== undefined && (
                      <span className="text-xs font-normal text-surface-400">
                        {result.baseline.working_days} working days
                      </span>
                    )}
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-surface-500 text-xs">Current Deadline</p>
                      <p className="font-semibold text-surface-100">
                        {result.baseline.current_deadline ? fmt(result.baseline.current_deadline) : "None set"}
                        {result.baseline.working_days !== undefined && (
                          <span className="text-xs text-surface-400 font-normal ml-2">({result.baseline.working_days} working days)</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-surface-500 text-xs">Remaining Tasks</p>
                      <p className="font-semibold text-surface-100">{result.baseline.remaining_tasks}</p>
                    </div>
                    <div>
                      <p className="text-surface-500 text-xs">Remaining Effort</p>
                      <p className="font-semibold text-surface-100">
                        {result.baseline.remaining_estimated_effort_hours !== null ? (
                          <>
                            <span>{result.baseline.remaining_estimated_effort_hours} hours</span>
                            {result.baseline.tasks_missing_estimates ? (
                              <span className="block text-warning-400 text-xs font-normal mt-0.5">
                                ⚠️ Partial: {result.baseline.tasks_missing_estimates} of {result.baseline.remaining_tasks} tasks lack estimates
                              </span>
                            ) : (
                              <span className="block text-success-400 text-xs font-normal mt-0.5">
                                ✓ All {result.baseline.remaining_tasks} tasks estimated
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-surface-500 italic text-xs">Unavailable — no effort estimates recorded</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-surface-500 text-xs">Available Capacity</p>
                      <p className="font-semibold text-surface-100">
                        {result.baseline.available_capacity_hours} hours
                        {result.baseline.developers_missing_capacity ? (
                          <span className="block text-warning-400 text-xs font-normal mt-0.5">
                            ⚠️ {result.baseline.developers_missing_capacity} assigned developers lack weekly capacity
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="glass-card p-5 border-warning-500/30">
                  <h3 className="text-xs font-bold text-warning-400 uppercase tracking-wider mb-4 flex items-center justify-between">
                    <span>📅 Hypothetical Scenario</span>
                    {result.scenario.working_days !== undefined && (
                      <span className="text-xs font-normal text-warning-300">
                        {result.scenario.working_days} working days
                      </span>
                    )}
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-surface-500 text-xs">Proposed Deadline</p>
                      <p className="font-semibold text-warning-300">
                        {fmt(result.scenario.proposed_deadline)}
                        {result.scenario.working_days !== undefined && (
                          <span className="text-xs text-surface-400 font-normal ml-2">({result.scenario.working_days} working days)</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-surface-500 text-xs">Remaining Tasks</p>
                      <p className="font-semibold text-surface-100">{result.scenario.remaining_tasks}</p>
                    </div>
                    <div>
                      <p className="text-surface-500 text-xs">Capacity Gap</p>
                      <p className={`font-semibold ${
                        result.scenario.capacity_gap_hours !== null && result.scenario.capacity_gap_hours > 0
                          ? "text-danger-400"
                          : result.scenario.capacity_gap_hours === 0
                          ? "text-success-400"
                          : "text-emerald-400"
                      }`}>
                        {result.scenario.capacity_gap_hours !== null ? (
                          <>
                            {result.scenario.capacity_gap_hours > 0 ? `+${result.scenario.capacity_gap_hours} hours (Deficit)` : `${result.scenario.capacity_gap_hours} hours (Surplus)`}
                            <span className="block text-[11px] text-surface-500 font-mono font-normal mt-0.5">
                              Formula: Effort ({result.scenario.remaining_estimated_effort_hours ?? "?"}h) − Capacity ({result.scenario.available_capacity_hours}h)
                            </span>
                          </>
                        ) : (
                          <span className="text-surface-500 italic text-xs">Cannot calculate — missing effort or capacity data</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-surface-500 text-xs">Available Capacity</p>
                      <p className="font-semibold text-surface-100">{result.scenario.available_capacity_hours} hours</p>
                    </div>
                  </div>
                </div>
              </div>

              {result.scenario.missing_data_items && result.scenario.missing_data_items.length > 0 && (
                <div className="bg-warning-500/10 border border-warning-500/20 text-warning-300 p-4 rounded-xl text-xs space-y-1.5">
                  <div className="font-semibold flex items-center gap-2">
                    <span>⚠️</span><span>Data Inputs Missing for Complete Calculation:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 pl-2 text-warning-300/90">
                    {result.scenario.missing_data_items.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-warning-400/90 pt-1">
                    💡 Click <strong>"Manage Estimates & Capacity"</strong> above to enter missing estimates or developer capacities.
                  </p>
                </div>
              )}

              {result.scenario.schedule_concerns.length > 0 && (
                <div className="glass-card p-5">
                  <h3 className="font-bold text-surface-100 mb-3 text-sm">⚠️ Schedule Concerns</h3>
                  <ul className="space-y-2">
                    {result.scenario.schedule_concerns.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 bg-warning-500/10 p-3 rounded border border-warning-500/20 text-xs text-warning-300">
                        <span className="shrink-0">⚠️</span><span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.ai_explanation && (
                <div className="glass-card p-5 border-accent-500/30">
                  <h3 className="font-bold text-accent-400 mb-3 text-sm">⚡ AI Insights</h3>
                  <p className="text-surface-200 text-sm whitespace-pre-wrap leading-relaxed">{result.ai_explanation}</p>
                </div>
              )}

              {result.assumptions_and_limitations.length > 0 && (
                <div className="glass-card p-4 border-dashed border-surface-700/60 bg-surface-800/20">
                  <h4 className="font-bold text-surface-500 text-xs mb-2 uppercase tracking-wider">ℹ️ Limitations &amp; Unavailable Data</h4>
                  <ul className="list-disc list-inside space-y-1 text-xs text-surface-600">
                    {result.assumptions_and_limitations.map((l, i) => <li key={i}>{l}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="glass-card h-full min-h-[300px] flex flex-col items-center justify-center p-8 text-center border-dashed border-surface-700/60">
              <span className="text-5xl mb-4">🔬</span>
              <h3 className="text-lg font-bold text-surface-300 mb-2">Configure Simulation</h3>
              <p className="text-sm text-surface-500 max-w-sm">
                Enter a proposed deadline and click Run Simulation to see the hypothetical impact.
                No real data will be changed.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ProjectDetailPage() {
  const { projectId }               = useParams<{ projectId: string }>();
  const navigate                    = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile }                 = useAuth();
  const isMgr = profile?.role === "MANAGER" || profile?.role === "ADMIN";

  const [project, setProject]   = useState<Project | null>(null);
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tLoading, setTLoading] = useState(true);
  const [err, setErr]           = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    apiFetch<Project>(`/projects/${projectId}`)
      .then((p) => { setProject(p); setErr(null); })
      .catch((e) => setErr(e.message || "Failed to load project"))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    setTLoading(true);
    fetchProjectTasks(projectId)
      .then(setTasks).catch(() => setTasks([]))
      .finally(() => setTLoading(false));
  }, [projectId]);

  const visibleTabs = ALL_TABS.filter((t) => !(t.id === "whatif" && !isMgr));
  const rawTab = searchParams.get("tab") as Tab | null;
  const activeTab: Tab = visibleTabs.some((t) => t.id === rawTab) ? rawTab! : "overview";
  const setTab = (t: Tab) => setSearchParams({ tab: t });

  if (!projectId) return <div className="p-8 text-center text-surface-400">No project selected.</div>;

  if (loading) return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-64 bg-surface-800 rounded" />
      <div className="h-12 bg-surface-800 rounded-xl" />
      <div className="h-48 bg-surface-800 rounded-xl" />
    </div>
  );

  if (err || !project) return (
    <div className="space-y-4">
      <button onClick={() => navigate(-1)} className="btn-secondary text-sm px-4 py-2">← Back</button>
      <div className="bg-danger-500/10 border border-danger-500/20 text-danger-400 p-5 rounded-xl">{err || "Project not found."}</div>
    </div>
  );

  const isAdmin = profile?.role === "ADMIN";
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteProject = async () => {
    if (!project) return;
    setDeleting(true);
    try {
      await deleteProject(project.id);
      navigate("/dashboard/projects");
    } catch (e: any) {
      setErr(e.message || "Failed to delete project");
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={() => navigate(-1)} className="text-surface-400 hover:text-surface-200 transition-colors">←</button>
        <span className="text-surface-600">/</span>
        <span className="text-surface-400">Projects</span>
        <span className="text-surface-600">/</span>
        <span className="text-surface-200 font-medium truncate">{project.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-surface-50">{project.name}</h2>
          {project.description && <p className="text-surface-400 text-sm mt-1">{project.description}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className={statusBadge(project.status)}>{project.status.replace("_", " ")}</span>
          {isAdmin && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="text-xs px-3 py-1.5 rounded-lg border border-danger-500/30 text-danger-400 hover:bg-danger-500/10 transition-colors"
              id="delete-project-btn"
            >
              Delete Project
            </button>
          )}
        </div>
      </div>

      {showDeleteModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowDeleteModal(false)}
          title="Delete Project Permanently"
          maxWidthClass="max-w-sm"
        >
          <div className="space-y-4 p-4 text-center">
            <div className="w-12 h-12 rounded-full bg-danger-500/20 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-danger-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-surface-200 text-sm font-semibold">{project.name}</p>
              <p className="text-surface-400 text-xs mt-1">
                Are you sure you want to permanently delete this project? This will remove all associated tasks, risks, and activity logs.
              </p>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="btn-secondary text-xs px-4 py-2"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteProject}
                disabled={deleting}
                className="btn-danger text-xs px-4 py-2"
                id="confirm-delete-project-btn"
              >
                {deleting ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-surface-700/50 gap-1 overflow-x-auto">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            id={`project-tab-${tab.id}`}
            onClick={() => setTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === tab.id
                ? "border-primary-500 text-primary-400"
                : "border-transparent text-surface-400 hover:text-surface-200 hover:border-surface-600"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "overview" && <OverviewTab project={project} tasks={tasks} />}
        {activeTab === "tasks"    && <TasksTab tasks={tasks} loading={tLoading} />}
        {activeTab === "github"   && <GitHubTab projectId={project.id} />}
        {activeTab === "history"  && <HistoryTab projectId={project.id} projectName={project.name} tasks={tasks} />}
        {activeTab === "whatif" && isMgr && <WhatIfTab project={project} />}
      </div>
    </div>
  );
}