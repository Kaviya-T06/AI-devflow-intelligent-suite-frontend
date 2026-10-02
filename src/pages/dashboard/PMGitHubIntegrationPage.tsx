import { useEffect, useState, useCallback } from "react";
import { fetchManagedProjects } from "../../services/pmService";
import type { Project } from "../../types";
import {
  getProjectRepository,
  connectRepository,
  disconnectRepository,
  syncRepository,
  getCommits,
  getPullRequests,
  getIssues,
  getBranches,
} from "../../services/githubService";
import type {
  GitHubRepository,
  GitHubCommit,
  GitHubPullRequest,
  GitHubIssue,
  GitHubBranch,
} from "../../services/githubService";

type Tab = "overview" | "commits" | "pulls" | "issues" | "branches";

export default function PMGitHubIntegrationPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const [repo, setRepo] = useState<GitHubRepository | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Data states
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [pulls, setPulls] = useState<GitHubPullRequest[]>([]);
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  // Form state
  const [repoUrl, setRepoUrl] = useState("");
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    fetchManagedProjects()
      .then((data) => {
        setProjects(data);
        if (data.length > 0) {
          setSelectedProjectId(data[0].id);
        }
      })
      .catch((err) => console.error("Failed to fetch projects", err));
  }, []);

  const loadRepository = useCallback(async (projectId: string) => {
    setLoading(true);
    setError(null);
    setRepo(null);
    setCommits([]);
    setPulls([]);
    setIssues([]);
    setBranches([]);
    setActiveTab("overview");
    try {
      const repository = await getProjectRepository(projectId);
      setRepo(repository);
    } catch (err: any) {
      if (err.message && err.message.includes("None")) {
        setRepo(null);
      } else {
        setError(err.message || "Failed to load repository info");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadRepository(selectedProjectId);
    }
  }, [selectedProjectId, loadRepository]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl) return;
    setConnecting(true);
    try {
      const newRepo = await connectRepository(selectedProjectId, {
        repository_url: repoUrl,
      });
      setRepo(newRepo);
    } catch (err: any) {
      setError(err.message || "Failed to connect repository");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect this repository?"))
      return;
    try {
      await disconnectRepository(selectedProjectId);
      setRepo(null);
    } catch (err: any) {
      setError(err.message || "Failed to disconnect repository");
    }
  };

  const handleSync = async () => {
    try {
      const updatedRepo = await syncRepository(selectedProjectId);
      setRepo(updatedRepo);
      // Reload tab data
      const currentTab = activeTab;
      setActiveTab("overview"); // Force a re-render/refetch trick or just clear states
      setCommits([]);
      setPulls([]);
      setIssues([]);
      setBranches([]);
      setTimeout(() => setActiveTab(currentTab), 0);
    } catch (err: any) {
      setError(err.message || "Failed to sync repository");
    }
  };

  const loadTabData = async (tab: Tab) => {
    if (!selectedProjectId || !repo) return;
    setTabLoading(true);
    try {
      if (tab === "commits" && commits.length === 0) {
        const data = await getCommits(selectedProjectId);
        setCommits(data);
      } else if (tab === "pulls" && pulls.length === 0) {
        const data = await getPullRequests(selectedProjectId);
        setPulls(data);
      } else if (tab === "issues" && issues.length === 0) {
        const data = await getIssues(selectedProjectId);
        setIssues(data);
      } else if (tab === "branches" && branches.length === 0) {
        const data = await getBranches(selectedProjectId);
        setBranches(data);
      }
    } catch (err: any) {
      console.error("Failed to load tab data", err);
    } finally {
      setTabLoading(false);
    }
  };

  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab, selectedProjectId, repo]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-surface-50">
            GitHub Integration
          </h2>
          <p className="text-surface-400 text-sm mt-1">
            Connect your project to a GitHub repository to monitor development
            activity.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-danger-500/10 border border-danger-500/20 text-danger-400 p-4 rounded-lg">
          ⚠️ {error}
        </div>
      )}

      {/* Project Selector */}
      <div className="glass-card p-4">
        <label className="text-surface-400 text-xs uppercase font-semibold tracking-wider mb-2 block">
          Select Project
        </label>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="w-full bg-surface-900 border border-surface-700 rounded-lg px-4 py-2 text-surface-100 outline-none focus:border-primary-500 transition-colors"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-surface-400 text-sm animate-pulse">
          Loading repository information...
        </div>
      ) : !repo ? (
        /* Not Connected State */
        <div className="glass-card p-12 text-center border-dashed border-2 border-surface-700/50">
          <span className="text-5xl mb-4 block">🐙</span>
          <h3 className="text-xl font-bold text-surface-100 mb-2">
            GitHub Repository Not Connected
          </h3>
          <p className="text-surface-400 text-sm mb-8">
            Connect this project to its GitHub repository to monitor development
            activity.
          </p>
          <form
            onSubmit={handleConnect}
            className="max-w-md mx-auto space-y-4 bg-surface-800/50 p-6 rounded-lg border border-surface-700/50"
          >
            <div>
              <label className="block text-left text-surface-300 text-xs font-semibold mb-1">
                Repository URL
              </label>
              <input
                type="url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/devflow-technologies/healthcare-management-platform"
                className="w-full bg-surface-900 border border-surface-700 rounded px-3 py-2 text-surface-100 focus:border-primary-500 outline-none"
                required
              />
            </div>
            <button
              type="submit"
              disabled={connecting}
              className="btn-primary w-full py-2 flex justify-center"
            >
              {connecting ? "Connecting..." : "Connect GitHub Repository"}
            </button>
          </form>
        </div>
      ) : (
        /* Connected State */
        <div className="space-y-6">
          <div className="glass-card p-6 border-l-4 border-l-primary-500">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-surface-100 mb-1">
                  GitHub Repository Connected
                </h3>
                <p className="text-surface-300 font-medium mb-1">{repo.full_name}</p>
                <div className="flex items-center gap-4 text-sm text-surface-400 mt-2">
                  <span>
                    Default branch:{" "}
                    <span className="font-mono text-surface-300">
                      {repo.default_branch}
                    </span>
                  </span>
                  <span>•</span>
                  <span>
                    Connected on{" "}
                    {new Date(repo.created_at).toLocaleDateString()}
                  </span>
                  {repo.last_synced_at && (
                    <>
                      <span>•</span>
                      <span>
                        Last synchronized:{" "}
                        {new Date(repo.last_synced_at).toLocaleString()}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <a
                  href={repo.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary text-xs px-3 py-1.5 flex items-center justify-center"
                >
                  Open GitHub Repository
                </a>
                <button
                  onClick={handleSync}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  Sync
                </button>
                <button
                  onClick={handleDisconnect}
                  className="btn-danger text-xs px-3 py-1.5"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-surface-700/50 mb-4">
            {[
              { id: "overview", label: "Overview" },
              { id: "commits", label: "Recent Commits" },
              { id: "pulls", label: "Pull Requests" },
              { id: "issues", label: "Issues" },
              { id: "branches", label: "Branches" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as Tab)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === t.id
                    ? "border-primary-500 text-primary-400"
                    : "border-transparent text-surface-400 hover:text-surface-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="glass-card p-0 min-h-[300px]">
            {tabLoading && activeTab !== "overview" ? (
              <div className="p-6 text-center text-surface-500 animate-pulse">
                Loading data from GitHub...
              </div>
            ) : activeTab === "overview" ? (
              <div className="p-6 space-y-4">
                <h4 className="text-lg font-semibold text-surface-200">
                  Repository Details
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-surface-800/50 p-4 rounded-lg">
                    <p className="text-surface-500 text-xs uppercase mb-1">
                      Owner
                    </p>
                    <p className="text-surface-200 font-medium">{repo.owner}</p>
                  </div>
                  <div className="bg-surface-800/50 p-4 rounded-lg">
                    <p className="text-surface-500 text-xs uppercase mb-1">
                      Repository Name
                    </p>
                    <p className="text-surface-200 font-medium">
                      {repo.repository_name}
                    </p>
                  </div>
                  <div className="bg-surface-800/50 p-4 rounded-lg">
                    <p className="text-surface-500 text-xs uppercase mb-1">
                      Associated Project
                    </p>
                    <p className="text-surface-200 font-medium">
                      {selectedProject?.name}
                    </p>
                  </div>
                </div>
              </div>
            ) : activeTab === "commits" ? (
              <div className="divide-y divide-surface-700/50">
                {commits.length === 0 ? (
                  <p className="p-6 text-surface-500 text-center">
                    No recent commits found.
                  </p>
                ) : (
                  commits.map((c) => (
                    <div
                      key={c.sha}
                      className="p-4 hover:bg-surface-800/30 transition-colors flex justify-between items-center"
                    >
                      <div className="min-w-0">
                        <p className="text-surface-200 text-sm font-medium truncate">
                          {c.message}
                        </p>
                        <p className="text-surface-500 text-xs mt-1">
                          {c.author} committed on{" "}
                          {new Date(c.date).toLocaleString()}
                        </p>
                      </div>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-mono bg-surface-700/50 text-surface-300 px-2 py-1 rounded ml-4 shrink-0 hover:bg-surface-700 transition-colors"
                      >
                        {c.sha.substring(0, 7)}
                      </a>
                    </div>
                  ))
                )}
              </div>
            ) : activeTab === "pulls" ? (
              <div className="divide-y divide-surface-700/50">
                {pulls.length === 0 ? (
                  <p className="p-6 text-surface-500 text-center">
                    No pull requests found.
                  </p>
                ) : (
                  pulls.map((pr) => (
                    <div
                      key={pr.number}
                      className="p-4 hover:bg-surface-800/30 transition-colors flex justify-between items-center"
                    >
                      <div className="min-w-0">
                        <a
                          href={pr.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-surface-200 text-sm font-medium hover:text-primary-400 truncate"
                        >
                          {pr.title}
                        </a>
                        <p className="text-surface-500 text-xs mt-1">
                          #{pr.number} opened on{" "}
                          {new Date(pr.created_at).toLocaleDateString()} by{" "}
                          {pr.author}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ml-4 shrink-0 ${
                          pr.state === "open"
                            ? "bg-success-500/20 text-success-400"
                            : "bg-accent-500/20 text-accent-400"
                        }`}
                      >
                        {pr.state}
                      </span>
                    </div>
                  ))
                )}
              </div>
            ) : activeTab === "issues" ? (
              <div className="divide-y divide-surface-700/50">
                {issues.length === 0 ? (
                  <p className="p-6 text-surface-500 text-center">
                    No issues found.
                  </p>
                ) : (
                  issues.map((issue) => (
                    <div
                      key={issue.number}
                      className="p-4 hover:bg-surface-800/30 transition-colors flex justify-between items-center"
                    >
                      <div className="min-w-0">
                        <a
                          href={issue.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-surface-200 text-sm font-medium hover:text-primary-400 truncate"
                        >
                          {issue.title}
                        </a>
                        <p className="text-surface-500 text-xs mt-1">
                          #{issue.number} opened on{" "}
                          {new Date(issue.created_at).toLocaleDateString()} by{" "}
                          {issue.author}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ml-4 shrink-0 ${
                          issue.state === "open"
                            ? "bg-success-500/20 text-success-400"
                            : "bg-accent-500/20 text-accent-400"
                        }`}
                      >
                        {issue.state}
                      </span>
                    </div>
                  ))
                )}
              </div>
            ) : activeTab === "branches" ? (
              <div className="divide-y divide-surface-700/50">
                {branches.length === 0 ? (
                  <p className="p-6 text-surface-500 text-center">
                    No branches found.
                  </p>
                ) : (
                  branches.map((b) => (
                    <div
                      key={b.name}
                      className="p-4 hover:bg-surface-800/30 transition-colors flex justify-between items-center"
                    >
                      <div className="flex items-center gap-3">
                        <svg
                          className="w-4 h-4 text-surface-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
                          />
                        </svg>
                        <span className="text-surface-200 font-mono text-sm">
                          {b.name}
                        </span>
                        {b.name === repo.default_branch && (
                          <span className="badge bg-surface-700/50 text-surface-300 text-[10px] ml-2">
                            Default
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono text-surface-500 ml-4 shrink-0">
                        {b.last_commit_sha.substring(0, 7)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
