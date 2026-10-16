/**
 * PMActivityPage — Enhanced Project History & Evidence-based Workflow Timeline.
 * Shows unified project timeline (tasks, project updates, risks, AI events),
 * GitHub commits/PRs when connected, workflow progress overview, and filters.
 */
import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchPMActivity,
  fetchManagedProjects,
  fetchProjectTasks,
  fetchMyRisks,
} from "../../services/pmService";
import {
  getProjectRepository,
  getCommits,
  getPullRequests,
  type GitHubRepository,
  type GitHubCommit,
  type GitHubPullRequest,
} from "../../services/githubService";
import type { PMActivityItem, Project, Task, WorkflowRisk } from "../../types";

// ---------------------------------------------------------------------------
// Unified Timeline Types
// ---------------------------------------------------------------------------

export type TimelineCategory = "ALL" | "TASK" | "GITHUB" | "WORKFLOW" | "RISK" | "AI";

export interface UnifiedTimelineEvent {
  id: string;
  category: TimelineCategory;
  title: string;
  description: string;
  actor?: string | null;
  timestamp: string;
  source: "GitHub" | "System";
  url?: string | null;
  icon: string;
  badgeColor: string;
  meta?: Record<string, any>;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return "—";
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function classifyAction(action: string): TimelineCategory {
  const upper = action.toUpperCase();
  if (upper.startsWith("TASK_")) return "TASK";
  if (upper.startsWith("PROJECT_") || upper.includes("PROGRESS")) return "WORKFLOW";
  if (upper.includes("RISK") || upper.includes("BLOCK")) return "RISK";
  if (upper.includes("AI_") || upper.includes("CONTINUITY") || upper.includes("HANDOVER")) return "AI";
  return "WORKFLOW";
}

function getActionIcon(action: string, category: TimelineCategory): string {
  if (category === "GITHUB") return "🐙";
  if (category === "AI") return "🤖";
  if (category === "RISK") return "⚠️";
  
  const upper = action.toUpperCase();
  if (upper.includes("COMPLETED")) return "🎯";
  if (upper.includes("STARTED")) return "🚀";
  if (upper.includes("REVIEW")) return "👀";
  if (upper.includes("CREATED")) return "✨";
  if (upper.includes("ASSIGN")) return "👤";
  if (upper.includes("DELETE")) return "🗑️";
  if (upper.includes("PROJECT")) return "📁";
  return "📋";
}

function getCategoryBadge(category: TimelineCategory) {
  switch (category) {
    case "GITHUB":
      return "bg-purple-500/15 text-purple-300 border border-purple-500/20";
    case "TASK":
      return "bg-primary-500/15 text-primary-300 border border-primary-500/20";
    case "WORKFLOW":
      return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20";
    case "RISK":
      return "bg-danger-500/15 text-danger-300 border border-danger-500/20";
    case "AI":
      return "bg-accent-500/15 text-accent-300 border border-accent-500/20";
    default:
      return "bg-surface-700/50 text-surface-400";
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function PMActivityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialProjectId = searchParams.get("project") || "";

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId);

  // Data states
  const [activityLogs, setActivityLogs] = useState<PMActivityItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [risks, setRisks] = useState<WorkflowRisk[]>([]);
  const [githubRepo, setGithubRepo] = useState<GitHubRepository | null>(null);
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [pullRequests, setPullRequests] = useState<GitHubPullRequest[]>([]);
  
  // Loading & Error states
  const [loading, setLoading] = useState(true);
  const [githubLoading, setGithubLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [githubError, setGithubError] = useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<TimelineCategory>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // 1. Initial Load: Projects list
  useEffect(() => {
    fetchManagedProjects()
      .then((data) => {
        setProjects(data);
        if (!selectedProjectId && data.length > 0) {
          // If no project in URL, default to first or stay on all
        }
      })
      .catch((err) => console.error("Failed to load projects", err));
  }, []);

  // 2. Sync URL query
  useEffect(() => {
    const p = searchParams.get("project");
    if (p !== null && p !== selectedProjectId) {
      setSelectedProjectId(p);
    }
  }, [searchParams]);

  // 3. Load Main Data for the selected project (or all)
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [actData, tasksData, risksData] = await Promise.all([
        fetchPMActivity(100, selectedProjectId || undefined),
        selectedProjectId ? fetchProjectTasks(selectedProjectId).catch(() => []) : Promise.resolve([]),
        fetchMyRisks().catch(() => []),
      ]);
      setActivityLogs(actData);
      setTasks(tasksData);
      setRisks(risksData);
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(err.message || "Failed to load project history data");
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 4. Load GitHub context if a project is selected
  useEffect(() => {
    if (!selectedProjectId) {
      setGithubRepo(null);
      setCommits([]);
      setPullRequests([]);
      setGithubError(null);
      return;
    }

    setGithubLoading(true);
    setGithubError(null);
    getProjectRepository(selectedProjectId)
      .then(async (repo) => {
        setGithubRepo(repo);
        if (repo) {
          try {
            const [cData, pData] = await Promise.all([
              getCommits(selectedProjectId).catch((e) => {
                console.warn("Commits not accessible:", e);
                return [];
              }),
              getPullRequests(selectedProjectId).catch((e) => {
                console.warn("Pull requests not accessible:", e);
                return [];
              }),
            ]);
            setCommits(cData);
            setPullRequests(pData);
          } catch (e: any) {
            setGithubError("Could not retrieve GitHub commits or pull requests.");
          }
        } else {
          setCommits([]);
          setPullRequests([]);
        }
      })
      .catch((err) => {
        setGithubRepo(null);
        setGithubError(err.message || "Failed to check GitHub repository");
      })
      .finally(() => setGithubLoading(false));
  }, [selectedProjectId]);

  // 5. Merge all events into Unified Timeline
  const unifiedTimeline: UnifiedTimelineEvent[] = useMemo(() => {
    const list: UnifiedTimelineEvent[] = [];

    // A. Internal Activity Logs
    for (const log of activityLogs) {
      const cat = classifyAction(log.action);
      list.push({
        id: `log-${log.id}`,
        category: cat,
        title: log.action.replace(/_/g, " "),
        description: log.description,
        actor: log.user_name || "System",
        timestamp: log.created_at,
        source: "System",
        icon: getActionIcon(log.action, cat),
        badgeColor: getCategoryBadge(cat),
      });
    }

    // B. GitHub Commits
    for (const c of commits) {
      list.push({
        id: `gh-commit-${c.sha}`,
        category: "GITHUB",
        title: `Commit: ${c.sha.slice(0, 7)}`,
        description: c.message,
        actor: c.author,
        timestamp: c.date,
        source: "GitHub",
        url: c.url,
        icon: "🔨",
        badgeColor: getCategoryBadge("GITHUB"),
      });
    }

    // C. GitHub Pull Requests
    for (const pr of pullRequests) {
      list.push({
        id: `gh-pr-${pr.number}`,
        category: "GITHUB",
        title: `Pull Request #${pr.number} (${pr.state})`,
        description: pr.title,
        actor: pr.author,
        timestamp: pr.updated_at || pr.created_at,
        source: "GitHub",
        url: pr.url,
        icon: "🔀",
        badgeColor: getCategoryBadge("GITHUB"),
      });
    }

    // D. Sort chronologically (newest first)
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return list;
  }, [activityLogs, commits, pullRequests]);

  // 6. Workflow progress metrics calculation from real tasks
  const workflowMetrics = useMemo(() => {
    if (!selectedProjectId && tasks.length === 0) {
      return null;
    }
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "COMPLETED").length;
    const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
    const review = tasks.filter((t) => t.status === "REVIEW").length;
    const todo = tasks.filter((t) => t.status === "TODO").length;
    
    const now = new Date();
    const overdue = tasks.filter((t) => {
      if (!t.due_date || t.status === "COMPLETED") return false;
      return new Date(t.due_date) < now;
    }).length;

    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    const projectRisks = risks.filter((r) => r.project_id === selectedProjectId);

    return {
      total,
      completed,
      inProgress,
      review,
      todo,
      overdue,
      percent,
      risksCount: projectRisks.length,
      projectRisks,
    };
  }, [tasks, selectedProjectId, risks]);

  // 7. Filtered timeline events
  const filteredTimeline = useMemo(() => {
    return unifiedTimeline.filter((ev) => {
      // Category filter
      if (selectedCategory !== "ALL" && ev.category !== selectedCategory) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = ev.title.toLowerCase().includes(q);
        const matchDesc = ev.description.toLowerCase().includes(q);
        const matchActor = (ev.actor || "").toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchActor) return false;
      }
      return true;
    });
  }, [unifiedTimeline, selectedCategory, searchQuery]);

  const selectedProjectObj = projects.find((p) => p.id === selectedProjectId);

  const CATEGORY_TABS: { label: string; value: TimelineCategory }[] = [
    { label: "All Activity", value: "ALL" },
    { label: "Tasks", value: "TASK" },
    { label: "GitHub", value: "GITHUB" },
    { label: "Workflow", value: "WORKFLOW" },
    { label: "Risks", value: "RISK" },
    { label: "AI & Handover", value: "AI" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Project Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-surface-50">Project History</h2>
          <p className="text-surface-400 text-sm mt-1">
            Complete, evidence-based workflow timeline, task status transitions, and GitHub activity.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Project dropdown */}
          <select
            value={selectedProjectId}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedProjectId(val);
              if (val) {
                setSearchParams({ project: val });
              } else {
                searchParams.delete("project");
                setSearchParams(searchParams);
              }
            }}
            className="bg-surface-800 border border-surface-700/60 rounded-lg px-3 py-2 text-surface-200 text-sm focus:outline-none focus:border-primary-500/50 min-w-[200px]"
          >
            <option value="">All Managed Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <span className="text-surface-500 text-xs hidden md:inline">
            Updated {relativeTime(lastRefreshed.toISOString())}
          </span>
          <button
            onClick={() => loadData()}
            className="btn-secondary p-2 text-surface-400 hover:text-surface-100"
            title="Refresh history"
            aria-label="Refresh history"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-danger-500/10 border border-danger-500/20 text-danger-400 p-4 rounded-lg flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-semibold text-sm">Failed to load project history</p>
            <p className="text-xs text-danger-300 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Workflow Progress Overview Card */}
      {workflowMetrics && selectedProjectId && (
        <div className="glass-card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-surface-700/40">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-surface-100">
                  {selectedProjectObj?.name || "Project"} — Workflow Progress
                </h3>
                <span className="badge text-[11px] px-2 py-0.5 rounded-full bg-primary-500/15 text-primary-300 border border-primary-500/20">
                  {selectedProjectObj?.status?.replace("_", " ") || "Active"}
                </span>
              </div>
              <p className="text-surface-400 text-xs mt-0.5">
                Calculated from real task statuses and workflow records
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold gradient-text">{workflowMetrics.percent}%</span>
              <span className="text-surface-400 text-xs font-medium">Completed</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-surface-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full transition-all duration-500"
              style={{ width: `${workflowMetrics.percent}%` }}
            />
          </div>

          {/* Key Metric Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
            <div className="bg-surface-850/60 p-3 rounded-lg border border-surface-700/30">
              <span className="block text-surface-500 text-xs">Total Tasks</span>
              <span className="text-lg font-bold text-surface-100">{workflowMetrics.total}</span>
            </div>
            <div className="bg-surface-850/60 p-3 rounded-lg border border-surface-700/30">
              <span className="block text-success-400 text-xs">Completed</span>
              <span className="text-lg font-bold text-success-300">{workflowMetrics.completed}</span>
            </div>
            <div className="bg-surface-850/60 p-3 rounded-lg border border-surface-700/30">
              <span className="block text-primary-400 text-xs">In Progress</span>
              <span className="text-lg font-bold text-primary-300">{workflowMetrics.inProgress}</span>
            </div>
            <div className="bg-surface-850/60 p-3 rounded-lg border border-surface-700/30">
              <span className="block text-warning-400 text-xs">In Review</span>
              <span className="text-lg font-bold text-warning-300">{workflowMetrics.review}</span>
            </div>
            <div className="bg-surface-850/60 p-3 rounded-lg border border-surface-700/30">
              <span className="block text-surface-400 text-xs">To Do</span>
              <span className="text-lg font-bold text-surface-200">{workflowMetrics.todo}</span>
            </div>
            <div className="bg-surface-850/60 p-3 rounded-lg border border-surface-700/30">
              <span className="block text-danger-400 text-xs">Overdue</span>
              <span className="text-lg font-bold text-danger-300">
                {workflowMetrics.overdue > 0 ? `⚠️ ${workflowMetrics.overdue}` : "0"}
              </span>
            </div>
          </div>

          {/* Active Risks / Blockers notice if any */}
          {workflowMetrics.risksCount > 0 && (
            <div className="bg-danger-500/10 border border-danger-500/20 p-3 rounded-lg flex items-start gap-2.5">
              <span className="text-base text-danger-400 mt-0.5">⚠️</span>
              <div>
                <p className="text-xs font-semibold text-danger-300">
                  {workflowMetrics.risksCount} active workflow {workflowMetrics.risksCount === 1 ? "risk" : "risks"} detected
                </p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {workflowMetrics.projectRisks.map((r) => (
                    <span
                      key={r.id}
                      className="text-[11px] bg-danger-500/15 text-danger-200 px-2 py-0.5 rounded border border-danger-500/30"
                    >
                      {r.risk_type.replace(/_/g, " ")}: {r.description || r.title || "Requires attention"}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* GitHub Repository Status Bar */}
      {selectedProjectId && (
        <div className="glass-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-800 flex items-center justify-center text-base border border-surface-700 shrink-0">
              🐙
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-surface-200">GitHub Repository:</span>
                {githubLoading ? (
                  <span className="text-surface-500 animate-pulse">Checking repository…</span>
                ) : githubRepo ? (
                  <a
                    href={githubRepo.html_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary-400 hover:text-primary-300 font-medium hover:underline flex items-center gap-1"
                  >
                    <span>{githubRepo.full_name}</span>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                ) : (
                  <span className="text-surface-500 italic">No repository linked</span>
                )}
              </div>
              <p className="text-surface-500 text-[11px] mt-0.5">
                {githubRepo
                  ? `Default branch: ${githubRepo.default_branch} · Loaded ${commits.length} commits & ${pullRequests.length} PRs`
                  : "Link a GitHub repository under GitHub Integration to view commit and PR history."}
              </p>
            </div>
          </div>

          {githubError && (
            <span className="text-danger-400 bg-danger-500/10 px-2.5 py-1 rounded border border-danger-500/20 shrink-0">
              ⚠️ {githubError}
            </span>
          )}
        </div>
      )}

      {/* Controls: Search & Category Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {CATEGORY_TABS.map((tab) => {
            const count =
              tab.value === "ALL"
                ? unifiedTimeline.length
                : unifiedTimeline.filter((e) => e.category === tab.value).length;
            return (
              <button
                key={tab.value}
                onClick={() => setSelectedCategory(tab.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 border ${
                  selectedCategory === tab.value
                    ? "bg-primary-500/20 text-primary-300 border-primary-500/30 font-semibold"
                    : "text-surface-400 border-surface-700/50 hover:border-surface-600 bg-surface-800/40"
                }`}
              >
                <span>{tab.label}</span>
                <span className="text-[10px] opacity-70 bg-surface-900/60 px-1.5 py-0.2 rounded-full">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative max-w-xs">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search timeline…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-800 border border-surface-700/50 rounded-lg pl-8 pr-3 py-1.5 text-surface-200 text-xs focus:outline-none focus:border-primary-500/50 placeholder:text-surface-600"
          />
        </div>
      </div>

      {/* Unified Timeline List */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 bg-surface-800/60 rounded-xl" />
          ))}
        </div>
      ) : filteredTimeline.length === 0 ? (
        <div className="glass-card p-12 text-center max-w-md mx-auto">
          <span className="text-4xl mb-3 block">📜</span>
          <h3 className="text-base font-bold text-surface-100">No history events found</h3>
          <p className="text-surface-400 text-xs mt-1">
            {selectedCategory === "ALL"
              ? "No recorded events or GitHub activity found for this selection."
              : `No events in the "${selectedCategory}" category.`}
          </p>
          {(selectedCategory !== "ALL" || searchQuery) && (
            <button
              onClick={() => {
                setSelectedCategory("ALL");
                setSearchQuery("");
              }}
              className="mt-4 btn-secondary text-xs px-3 py-1.5"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="relative pl-6 sm:pl-8 space-y-3.5 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-surface-700/60">
          {filteredTimeline.map((item) => (
            <div
              key={item.id}
              className="relative glass-card p-4 hover:border-surface-600/80 transition-all duration-200 group"
            >
              {/* Timeline Node Dot */}
              <div className="absolute -left-6 sm:-left-8 top-4 w-6 h-6 rounded-full bg-surface-900 border border-surface-700 flex items-center justify-center text-xs shadow shrink-0">
                {item.icon}
              </div>

              {/* Event Content */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${item.badgeColor}`}>
                      {item.category}
                    </span>
                    <span className="text-surface-400 text-xs font-semibold">{item.title}</span>
                    <span className="text-surface-600 text-xs">·</span>
                    <span className="text-surface-500 text-xs">{relativeTime(item.timestamp)}</span>
                    <span className="text-surface-600 text-xs">·</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                        item.source === "GitHub"
                          ? "bg-purple-500/10 text-purple-300 border border-purple-500/20"
                          : "bg-surface-800 text-surface-400 border border-surface-700/50"
                      }`}
                    >
                      {item.source}
                    </span>
                  </div>

                  <p className="text-surface-200 text-sm leading-relaxed break-words">{item.description}</p>

                  {item.actor && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-surface-500">
                      <span>Author:</span>
                      <span className="text-surface-300 font-medium">{item.actor}</span>
                    </div>
                  )}
                </div>

                {/* External GitHub Link if present */}
                {item.url && (
                  <div className="shrink-0 pt-1 sm:pt-0">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary text-[11px] px-2.5 py-1 inline-flex items-center gap-1 text-primary-300 hover:text-white"
                      title="View on GitHub"
                    >
                      <span>View on GitHub</span>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
