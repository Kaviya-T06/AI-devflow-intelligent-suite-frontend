import { useEffect, useState, useMemo } from "react";
import { fetchProjectHistory, fetchProjectTasks } from "../../services/pmService";
import {
  getProjectRepository,
  getCommits,
  getPullRequests,
  type GitHubRepository,
  type GitHubCommit,
  type GitHubPullRequest,
} from "../../services/githubService";
import type { ActivityLog, Task } from "../../types";
import Modal from "../ui/Modal";

interface UnifiedModalItem {
  id: string;
  category: "TASK" | "GITHUB" | "WORKFLOW" | "AI";
  title: string;
  description: string;
  actor?: string | null;
  timestamp: string;
  source: "GitHub" | "System";
  url?: string | null;
  icon: string;
}

export default function ProjectHistoryModal({
  projectId,
  projectName,
  onClose,
}: {
  projectId: string;
  projectName: string;
  onClose: () => void;
}) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [repo, setRepo] = useState<GitHubRepository | null>(null);
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [pulls, setPulls] = useState<GitHubPullRequest[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("ALL");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchProjectHistory(projectId).catch(() => []),
      fetchProjectTasks(projectId).catch(() => []),
      getProjectRepository(projectId).catch(() => null),
    ])
      .then(async ([logsData, tasksData, repoData]) => {
        setLogs(logsData);
        setTasks(tasksData);
        setRepo(repoData);

        if (repoData) {
          const [cData, pData] = await Promise.all([
            getCommits(projectId).catch(() => []),
            getPullRequests(projectId).catch(() => []),
          ]);
          setCommits(cData);
          setPulls(pData);
        }
      })
      .catch((err) => setError(err.message || "Failed to load project history"))
      .finally(() => setLoading(false));
  }, [projectId]);

  // Workflow progress overview calculation
  const workflow = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "COMPLETED").length;
    const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
    const review = tasks.filter((t) => t.status === "REVIEW").length;
    const todo = tasks.filter((t) => t.status === "TODO").length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, review, todo, percent };
  }, [tasks]);

  // Unified items
  const unifiedItems: UnifiedModalItem[] = useMemo(() => {
    const items: UnifiedModalItem[] = [];

    for (const log of logs) {
      const isTask = log.action.startsWith("TASK_");
      items.push({
        id: `log-${log.id}`,
        category: isTask ? "TASK" : "WORKFLOW",
        title: log.action.replace(/_/g, " "),
        description: log.description,
        actor: log.user?.full_name || "System",
        timestamp: log.created_at,
        source: "System",
        icon: isTask ? "✅" : "📁",
      });
    }

    for (const c of commits) {
      items.push({
        id: `gh-${c.sha}`,
        category: "GITHUB",
        title: `Commit ${c.sha.slice(0, 7)}`,
        description: c.message,
        actor: c.author,
        timestamp: c.date,
        source: "GitHub",
        url: c.url,
        icon: "🔨",
      });
    }

    for (const p of pulls) {
      items.push({
        id: `gh-pr-${p.number}`,
        category: "GITHUB",
        title: `PR #${p.number} (${p.state})`,
        description: p.title,
        actor: p.author,
        timestamp: p.updated_at || p.created_at,
        source: "GitHub",
        url: p.url,
        icon: "🔀",
      });
    }

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return items;
  }, [logs, commits, pulls]);

  const filteredItems = useMemo(() => {
    if (filter === "ALL") return unifiedItems;
    return unifiedItems.filter((i) => i.category === filter);
  }, [unifiedItems, filter]);

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Project History & Timeline"
      subtitle={projectName}
      maxWidthClass="max-w-3xl"
      ariaLabel={`Project History for ${projectName}`}
    >
      <div className="space-y-4">
        {/* Workflow Summary */}
        {tasks.length > 0 && (
          <div className="bg-surface-800/50 p-4 rounded-xl border border-surface-700/50 space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-surface-300">Workflow Progress</span>
              <span className="text-primary-400 font-bold">{workflow.percent}% Completed</span>
            </div>
            <div className="w-full h-1.5 bg-surface-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full"
                style={{ width: `${workflow.percent}%` }}
              />
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs pt-1">
              <div className="bg-surface-900/50 p-1.5 rounded">
                <span className="text-[10px] text-surface-500 block">Total</span>
                <span className="font-semibold text-surface-200">{workflow.total}</span>
              </div>
              <div className="bg-surface-900/50 p-1.5 rounded">
                <span className="text-[10px] text-success-400 block">Completed</span>
                <span className="font-semibold text-success-300">{workflow.completed}</span>
              </div>
              <div className="bg-surface-900/50 p-1.5 rounded">
                <span className="text-[10px] text-primary-400 block">In Prog</span>
                <span className="font-semibold text-primary-300">{workflow.inProgress}</span>
              </div>
              <div className="bg-surface-900/50 p-1.5 rounded">
                <span className="text-[10px] text-warning-400 block">Review</span>
                <span className="font-semibold text-warning-300">{workflow.review}</span>
              </div>
            </div>
          </div>
        )}

        {/* GitHub Status */}
        {repo && (
          <div className="bg-purple-900/20 border border-purple-500/20 rounded-lg p-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span>🐙</span>
              <span className="text-purple-200 font-medium">{repo.full_name}</span>
              <span className="text-surface-500">({commits.length} commits, {pulls.length} PRs)</span>
            </div>
            <a
              href={repo.html_url}
              target="_blank"
              rel="noreferrer"
              className="text-primary-400 hover:underline"
            >
              GitHub →
            </a>
          </div>
        )}

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 pt-1">
          {["ALL", "TASK", "GITHUB", "WORKFLOW"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                filter === f
                  ? "bg-primary-500/20 text-primary-300 font-medium border border-primary-500/30"
                  : "text-surface-400 hover:text-surface-200 bg-surface-800/40 border border-surface-700/40"
              }`}
            >
              {f === "ALL" ? "All History" : f}
            </button>
          ))}
        </div>

        {/* Timeline Feed */}
        {loading ? (
          <p className="text-surface-400 text-center py-8 text-sm">Loading project history…</p>
        ) : error ? (
          <p className="text-danger-400 text-center py-8 text-sm">Error: {error}</p>
        ) : filteredItems.length === 0 ? (
          <p className="text-surface-400 text-center py-8 text-sm">No events found for this filter.</p>
        ) : (
          <div className="space-y-3 pt-2">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-lg border border-surface-700/60 bg-surface-850/50 flex items-start gap-3 text-xs"
              >
                <span className="text-base shrink-0 mt-0.5">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-surface-200 text-xs">{item.title}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded ${
                          item.source === "GitHub"
                            ? "bg-purple-500/15 text-purple-300"
                            : "bg-surface-800 text-surface-400"
                        }`}
                      >
                        {item.source}
                      </span>
                    </div>
                    <span className="text-[10px] text-surface-500 shrink-0">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-surface-300 text-xs leading-relaxed">{item.description}</p>
                  <div className="flex items-center justify-between gap-2 mt-2 text-[11px] text-surface-500">
                    {item.actor && <span>By: {item.actor}</span>}
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary-400 hover:underline"
                      >
                        View commit/PR ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
