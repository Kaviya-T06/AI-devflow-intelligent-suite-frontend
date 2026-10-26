import { useEffect, useState, useCallback, useRef } from "react";
import { fetchManagedProjects } from "../../services/pmService";
import { fetchAllProjects } from "../../services/adminService";
import { getCachedProjects } from "../../services/projectsCache";
import { useAuth } from "../../context/AuthContext";
import type { Project } from "../../types";
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

type Tab = "overview" | "commits" | "pulls" | "issues" | "branches";

export default function PMGitHubIntegrationPage({ projectId }: { projectId?: string } = {}) {
  const [projects, setProjects] = useState<Project[]>(() => getCachedProjects() || []);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    if (projectId) return projectId;
    const cached = getCachedProjects();
    return cached && cached.length > 0 ? cached[0].id : "";
  });
  const [loadingProjects, setLoadingProjects] = useState<boolean>(() => !Boolean(getCachedProjects()?.length));
  const [projectError, setProjectError] = useState<string | null>(null);
  const repoCacheRef = useRef<Record<string, GitHubRepository | null>>({});

  const [repo, setRepo] = useState<GitHubRepository | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Data states
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [pulls, setPulls] = useState<GitHubPullRequest[]>([]);
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [loadingTabs, setLoadingTabs] = useState<Partial<Record<Tab, boolean>>>({});
  const [tabErrors, setTabErrors] = useState<Partial<Record<Tab, string | null>>>({});
  const [loadedTabs, setLoadedTabs] = useState<Partial<Record<Tab, boolean>>>({});

  // Form state
  const [repoUrl, setRepoUrl] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Create branch modal state
  const [showCreateBranchModal, setShowCreateBranchModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [baseBranch, setBaseBranch] = useState("main");
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);

  // Link developer modal state
  const [linkModalBranch, setLinkModalBranch] = useState<GitHubBranch | null>(null);
  const [assignableDevs, setAssignableDevs] = useState<BranchAssignableDeveloper[]>([]);
  const [loadingAssignables, setLoadingAssignables] = useState(false);
  const [selectedDevId, setSelectedDevId] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [savingLink, setSavingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const { profile } = useAuth();
  const isAdmin = profile?.role === "ADMIN";

  // Track the current load request to prevent stale async responses from
  // overwriting data that belongs to a different (more recently selected) project.
  const activeLoadRef = useRef<symbol | null>(null);
  // Always reflect the latest selectedProjectId so tab-data guards work correctly.
  const selectedProjectIdRef = useRef<string>(selectedProjectId);

  // Keep ref in sync with state on every render.
  selectedProjectIdRef.current = selectedProjectId;

  useEffect(() => {
    if (projectId) {
      setSelectedProjectId(projectId);
    }
    let isMounted = true;
    const fetchFn = isAdmin ? fetchAllProjects : fetchManagedProjects;
    fetchFn()
      .then((data) => {
        if (!isMounted) return;
        setProjects(data);
        if (data.length > 0 && !selectedProjectIdRef.current) {
          setSelectedProjectId(data[0].id);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Failed to fetch projects", err);
        setProjectError("Failed to load projects. Please try again.");
      })
      .finally(() => {
        if (isMounted) setLoadingProjects(false);
      });
    return () => {
      isMounted = false;
    };
  }, [projectId, isAdmin]);

  const loadRepository = useCallback(async (pId: string, force = false) => {
    if (!pId) {
      setRepo(null);
      setLoading(false);
      return;
    }
    // Create a unique token for this specific load request.
    const requestToken = Symbol(pId);
    activeLoadRef.current = requestToken;

    // Immediately clear all previous project's data before fetching new data.
    setLoading(true);
    setError(null);
    setSyncMessage(null);
    setRepo(null);
    setCommits([]);
    setPulls([]);
    setIssues([]);
    setBranches([]);
    setLoadingTabs({});
    setTabErrors({});
    setLoadedTabs({});
    setActiveTab("overview");

    // Check if we have cached repository info for this project
    if (!force && pId in repoCacheRef.current) {
      const cached = repoCacheRef.current[pId];
      setRepo(cached);
      setLoading(false);
      if (cached?.default_branch) {
        setBaseBranch(cached.default_branch);
      }
      return;
    }

    try {
      const repository = await getProjectRepository(pId);

      // Guard: discard this response if a newer project was selected while
      // this request was in flight.
      if (activeLoadRef.current !== requestToken) return;

      repoCacheRef.current[pId] = repository;
      setRepo(repository);
      if (repository?.default_branch) {
        setBaseBranch(repository.default_branch);
      }
    } catch (err: any) {
      // Guard: discard stale error responses too.
      if (activeLoadRef.current !== requestToken) return;

      const msg = (err?.message || "").toLowerCase();
      if (
        msg.includes("none") ||
        msg.includes("404") ||
        msg.includes("not found") ||
        msg.includes("no repository connected") ||
        msg.includes("no github repository connected")
      ) {
        repoCacheRef.current[pId] = null;
        setRepo(null);
      } else {
        setError(err.message || "Failed to load repository info");
      }
    } finally {
      // Guard: only clear the loading spinner if this is still the active request.
      if (activeLoadRef.current === requestToken) {
        setLoading(false);
      }
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
      repoCacheRef.current[selectedProjectId] = newRepo;
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
      repoCacheRef.current[selectedProjectId] = null;
      setRepo(null);
    } catch (err: any) {
      setError(err.message || "Failed to disconnect repository");
    }
  };

  const handleSync = async () => {
    if (!selectedProjectId) return;
    setSyncing(true);
    setError(null);
    setSyncMessage(null);
    try {
      const updated = await syncRepository(selectedProjectId);
      repoCacheRef.current[selectedProjectId] = updated;
      setRepo(updated);
      setSyncMessage("Repository synchronized successfully with GitHub.");
      // Refresh tab data
      if (activeTab !== "overview") {
        await loadTabData(activeTab, true);
      }
    } catch (err: any) {
      setError(err.message || "Failed to sync repository");
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim() || !selectedProjectId) return;
    setCreatingBranch(true);
    setBranchError(null);
    try {
      await createProjectBranch(selectedProjectId, {
        branch_name: newBranchName.trim(),
        base_branch: baseBranch || repo?.default_branch || "main",
      });
      setShowCreateBranchModal(false);
      setNewBranchName("");
      const updatedBranches = await getBranches(selectedProjectId);
      setBranches(updatedBranches);
    } catch (err: any) {
      setBranchError(err.message || "Failed to create branch");
    } finally {
      setCreatingBranch(false);
    }
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

    if (selectedProjectId) {
      setLoadingAssignables(true);
      try {
        const devs = await fetchProjectAssignableDevelopers(selectedProjectId);
        setAssignableDevs(devs);
      } catch (e: any) {
        console.error("Failed to load assignable developers", e);
      } finally {
        setLoadingAssignables(false);
      }
    }
  };

  const handleSaveBranchLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !linkModalBranch || !selectedDevId) return;
    setSavingLink(true);
    setLinkError(null);
    try {
      await assignBranchDeveloper(selectedProjectId, linkModalBranch.name, {
        developer_id: selectedDevId,
        task_id: selectedTaskId || null,
      });
      setLinkModalBranch(null);
      const updated = await getBranches(selectedProjectId);
      setBranches(updated);
    } catch (err: any) {
      setLinkError(err.message || "Failed to link developer to branch");
    } finally {
      setSavingLink(false);
    }
  };

  const handleUnlinkBranch = async (branchName: string) => {
    if (!selectedProjectId) return;
    if (!confirm(`Are you sure you want to unlink the developer from branch "${branchName}"?`)) return;
    try {
      await unassignBranchDeveloper(selectedProjectId, branchName);
      const updated = await getBranches(selectedProjectId);
      setBranches(updated);
    } catch (err: any) {
      setError(err.message || "Failed to unlink developer");
    }
  };

  const loadTabData = useCallback(
    async (tab: Tab, force = false) => {
      if (!selectedProjectId || !repo || tab === "overview") return;
      if (!force && loadedTabs[tab]) return;

      // Capture the project ID this fetch is for, so we can verify it on completion.
      // Use a ref-snapshot to get the live value at call time; subsequent checks
      // also read from the ref so stale closures cannot cause cross-project pollution.
      const fetchingForProject = selectedProjectIdRef.current;

      setLoadingTabs((prev) => ({ ...prev, [tab]: true }));
      setTabErrors((prev) => ({ ...prev, [tab]: null }));

      try {
        if (tab === "commits") {
          const data = await getCommits(fetchingForProject);
          // Discard if the user switched projects while this request was in flight.
          if (selectedProjectIdRef.current !== fetchingForProject) return;
          setCommits(data);
        } else if (tab === "pulls") {
          const data = await getPullRequests(fetchingForProject);
          if (selectedProjectIdRef.current !== fetchingForProject) return;
          setPulls(data);
        } else if (tab === "issues") {
          const data = await getIssues(fetchingForProject);
          if (selectedProjectIdRef.current !== fetchingForProject) return;
          setIssues(data);
        } else if (tab === "branches") {
          const data = await getBranches(fetchingForProject);
          if (selectedProjectIdRef.current !== fetchingForProject) return;
          setBranches(data);
        }
        if (selectedProjectIdRef.current !== fetchingForProject) return;
        setLoadedTabs((prev) => ({ ...prev, [tab]: true }));
      } catch (err: any) {
        if (selectedProjectIdRef.current !== fetchingForProject) return;
        console.error(`Failed to load ${tab} data:`, err);
        setTabErrors((prev) => ({
          ...prev,
          [tab]: err.message || `Failed to load ${tab} from GitHub.`,
        }));
      } finally {
        if (selectedProjectIdRef.current !== fetchingForProject) return;
        setLoadingTabs((prev) => ({ ...prev, [tab]: false }));
      }
    },
    [selectedProjectId, repo, loadedTabs]
  );

  useEffect(() => {
    if (repo && selectedProjectId && activeTab !== "overview") {
      loadTabData(activeTab);
    }
  }, [activeTab, selectedProjectId, repo, loadTabData]);

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
        <div className="flex items-center justify-between mb-2">
          <label className="text-surface-400 text-xs uppercase font-semibold tracking-wider block">
            Select Project
          </label>
          {loadingProjects && (
            <span className="text-surface-400 text-xs flex items-center gap-1.5 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-ping" />
              Loading projects…
            </span>
          )}
        </div>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          disabled={loadingProjects && projects.length === 0}
          className="w-full bg-surface-900 border border-surface-700 rounded-lg px-4 py-2 text-surface-100 outline-none focus:border-primary-500 transition-colors cursor-pointer"
        >
          {loadingProjects && projects.length === 0 ? (
            <option value="">Loading projects…</option>
          ) : projectError && projects.length === 0 ? (
            <option value="">Error loading projects</option>
          ) : projects.length === 0 ? (
            <option value="">No projects available</option>
          ) : null}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {loadingProjects && projects.length === 0 && !selectedProjectId ? (
        <div className="glass-card p-12 text-center border border-surface-700/40 animate-pulse text-surface-400 text-sm">
          Loading accessible projects...
        </div>
      ) : !loadingProjects && projects.length === 0 && !selectedProjectId ? (
        <div className="glass-card p-12 text-center border-dashed border-2 border-surface-700/50">
          <span className="text-4xl mb-3 block">📁</span>
          <h3 className="text-lg font-bold text-surface-100 mb-1">
            No projects available
          </h3>
          <p className="text-surface-400 text-sm">
            {projectError || "You do not have any accessible projects assigned yet."}
          </p>
        </div>
      ) : loading ? (
        <div className="glass-card p-8 text-center text-surface-400 text-sm animate-pulse">
          Loading repository information...
        </div>
      ) : !repo ? (
        /* Not Connected State */
        <div className="glass-card p-12 text-center border-dashed border-2 border-surface-700/50">
          <span className="text-5xl mb-4 block">🐙</span>
          <h3 className="text-xl font-bold text-surface-100 mb-2">
            No GitHub repository connected
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
              <div className="flex flex-wrap gap-2">
                <a
                  href={repo.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary text-xs px-3 py-1.5 flex items-center justify-center gap-1"
                >
                  <span>Open GitHub</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                  title="Synchronize repository branches, commits, and pull requests"
                >
                  <svg className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>{syncing ? "Syncing..." : "Sync Repository"}</span>
                </button>
                <button
                  onClick={handleDisconnect}
                  className="btn-danger text-xs px-3 py-1.5"
                >
                  Disconnect
                </button>
              </div>
            </div>
            {syncMessage && (
              <p className="mt-3 text-xs text-success-300 bg-success-500/10 p-2 rounded border border-success-500/20">{syncMessage}</p>
            )}
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
            {loadingTabs[activeTab] && activeTab !== "overview" ? (
              <div className="p-8 text-center text-surface-400 animate-pulse" data-testid={`tab-loading-${activeTab}`}>
                Loading {activeTab === "commits" ? "commits" : activeTab === "pulls" ? "pull requests" : activeTab === "issues" ? "issues" : "branches"} from GitHub...
              </div>
            ) : tabErrors[activeTab] && activeTab !== "overview" ? (
              <div className="p-8 text-center" data-testid={`tab-error-${activeTab}`}>
                <div className="inline-block p-4 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-400 max-w-lg text-left">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">⚠️</span>
                    <div className="space-y-1">
                      <h4 className="font-semibold text-sm">
                        Failed to load {activeTab === "commits" ? "commits" : activeTab === "pulls" ? "pull requests" : activeTab === "issues" ? "issues" : "branches"}
                      </h4>
                      <p className="text-xs text-danger-300 mt-1">{tabErrors[activeTab]}</p>
                      <button
                        onClick={() => loadTabData(activeTab, true)}
                        className="mt-3 btn-secondary text-xs px-3 py-1.5"
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                </div>
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
              <div className="space-y-4">
                <div className="p-4 bg-surface-800/40 border-b border-surface-700/50 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-surface-100">Discovered Branches</h4>
                    <p className="text-xs text-surface-400">
                      Synchronized branches from GitHub repository with developer assignments.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCreateBranchModal(true)}
                    className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>New Branch</span>
                  </button>
                </div>

                <div className="divide-y divide-surface-700/50">
                  {branches.length === 0 ? (
                    <p className="p-6 text-surface-500 text-center">
                      No branches found. Click Sync Repository to retrieve branches.
                    </p>
                  ) : (
                    branches.map((b) => {
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
                        <div
                          key={b.name}
                          className="p-4 hover:bg-surface-800/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-surface-100 font-mono text-sm font-semibold">
                                {b.name}
                              </span>
                              {b.name === repo.default_branch && (
                                <span className="badge bg-primary-500/20 text-primary-300 text-[10px]">
                                  Default
                                </span>
                              )}
                              {b.associated_pull_request && (
                                <span className="badge bg-purple-500/20 text-purple-300 text-[10px]">
                                  PR #{b.associated_pull_request}
                                </span>
                              )}
                            </div>
                            {b.last_commit_message && (
                              <p className="text-surface-300 text-xs truncate max-w-lg">
                                {b.last_commit_message}
                              </p>
                            )}
                            <div className="flex items-center gap-3 text-[11px] text-surface-400 flex-wrap">
                              <span>Author: <strong className="text-surface-300">{b.last_commit_author || "Unknown"}</strong></span>
                              {b.last_commit_date && (
                                <span>• {new Date(b.last_commit_date).toLocaleString()}</span>
                              )}
                              <span>• Linked dev: <strong className={isLinked ? "text-primary-300 font-semibold" : "text-surface-400 italic"}>{linkedDevName}</strong></span>
                              {linkedDevTask && (
                                <span className="badge bg-surface-700/60 text-surface-300 text-[10px] px-2 py-0.5 rounded">
                                  Task: {linkedDevTask}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            <span className="text-xs font-mono bg-surface-900 border border-surface-700 text-surface-300 px-2 py-1 rounded">
                              {b.last_commit_sha ? b.last_commit_sha.substring(0, 7) : "—"}
                            </span>
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
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Create Branch Modal */}
      {showCreateBranchModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowCreateBranchModal(false)}
          title="Create New Branch"
          subtitle={`Create a new branch in ${repo?.full_name || "repository"}`}
          maxWidthClass="max-w-md"
        >
          <form onSubmit={handleCreateBranch} className="p-4 sm:p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-surface-300 mb-1">
                Branch Name <span className="text-danger-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. feature/login-page"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                required
                className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-surface-100 text-sm focus:outline-none focus:border-primary-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-300 mb-1">
                Base Branch
              </label>
              <select
                value={baseBranch}
                onChange={(e) => setBaseBranch(e.target.value)}
                className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-surface-100 text-sm focus:outline-none focus:border-primary-500 font-mono"
              >
                {branches.length > 0 ? (
                  branches.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name}
                    </option>
                  ))
                ) : (
                  <option value={repo?.default_branch || "main"}>
                    {repo?.default_branch || "main"}
                  </option>
                )}
              </select>
            </div>

            {branchError && (
              <p className="text-xs text-danger-400 bg-danger-500/10 p-2 rounded border border-danger-500/20">
                {branchError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateBranchModal(false)}
                className="btn-secondary text-xs px-3 py-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingBranch || !newBranchName.trim()}
                className="btn-primary text-xs px-4 py-2"
              >
                {creatingBranch ? "Creating..." : "Create Branch"}
              </button>
            </div>
          </form>
        </Modal>
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
