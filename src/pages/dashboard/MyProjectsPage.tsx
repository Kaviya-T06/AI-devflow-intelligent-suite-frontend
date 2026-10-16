import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAllProjects, fetchAllTasks } from "../../services/adminService";
import type { Project, Task, ProjectStatus } from "../../types";

type SortOption = "DEFAULT" | "IMPORTANT" | "OVERDUE" | "PROGRESS_DESC" | "PROGRESS_ASC" | "NAME";

export default function MyProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [onlyOverdueFilter, setOnlyOverdueFilter] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("IMPORTANT");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchAllProjects(), fetchAllTasks()])
      .then(([pData, tData]) => {
        setProjects(pData);
        setTasks(tData);
        setError(null);
      })
      .catch((err) => {
        setError(err.message || "Failed to load projects");
      })
      .finally(() => setLoading(false));
  }, []);

  const isTaskOverdue = (task: Task) => {
    if (!task.due_date || task.status === "COMPLETED") return false;
    return new Date() > new Date(task.due_date);
  };

  // Compute metrics per project
  const projectMetrics = useMemo(() => {
    const map = new Map<
      string,
      {
        total: number;
        todo: number;
        inProgress: number;
        review: number;
        completed: number;
        overdue: number;
      }
    >();

    for (const p of projects) {
      const pTasks = tasks.filter((t) => t.project_id === p.id);
      map.set(p.id, {
        total: pTasks.length,
        todo: pTasks.filter((t) => t.status === "TODO").length,
        inProgress: pTasks.filter((t) => t.status === "IN_PROGRESS").length,
        review: pTasks.filter((t) => t.status === "REVIEW").length,
        completed: pTasks.filter((t) => t.status === "COMPLETED").length,
        overdue: pTasks.filter(isTaskOverdue).length,
      });
    }
    return map;
  }, [projects, tasks]);

  // Filtered & Sorted projects
  const filteredProjects = useMemo(() => {
    let result = projects.filter((p) => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const nameMatch = p.name.toLowerCase().includes(query);
        const descMatch = (p.description || "").toLowerCase().includes(query);
        if (!nameMatch && !descMatch) return false;
      }

      // Status filter
      if (statusFilter !== "ALL" && p.status !== statusFilter) {
        return false;
      }

      // Overdue filter
      if (onlyOverdueFilter) {
        const metrics = projectMetrics.get(p.id);
        if (!metrics || metrics.overdue === 0) return false;
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      const metricsA = projectMetrics.get(a.id) || { total: 0, overdue: 0, inProgress: 0, todo: 0 };
      const metricsB = projectMetrics.get(b.id) || { total: 0, overdue: 0, inProgress: 0, todo: 0 };

      if (sortBy === "OVERDUE") {
        // Projects with more overdue tasks come first
        if (metricsB.overdue !== metricsA.overdue) {
          return metricsB.overdue - metricsA.overdue;
        }
        return b.progress - a.progress;
      }

      if (sortBy === "IMPORTANT") {
        // Prioritize: projects with overdue tasks first, then active projects with pending tasks
        if (metricsB.overdue !== metricsA.overdue) {
          return metricsB.overdue - metricsA.overdue;
        }
        const aActive = a.status === "active" ? 1 : 0;
        const bActive = b.status === "active" ? 1 : 0;
        if (bActive !== aActive) return bActive - aActive;

        const aUnfinished = metricsA.todo + metricsA.inProgress;
        const bUnfinished = metricsB.todo + metricsB.inProgress;
        return bUnfinished - aUnfinished;
      }

      if (sortBy === "PROGRESS_DESC") {
        return b.progress - a.progress;
      }

      if (sortBy === "PROGRESS_ASC") {
        return a.progress - b.progress;
      }

      if (sortBy === "NAME") {
        return a.name.localeCompare(b.name);
      }

      // DEFAULT
      return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
    });

    return result;
  }, [projects, tasks, searchQuery, statusFilter, onlyOverdueFilter, sortBy, projectMetrics]);

  const activeFilterCount = (statusFilter !== "ALL" ? 1 : 0) + (onlyOverdueFilter ? 1 : 0);

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setOnlyOverdueFilter(false);
    setSortBy("IMPORTANT");
  };

  const getStatusBadge = (status: ProjectStatus) => {
    switch (status) {
      case "active":
        return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20";
      case "planning":
        return "bg-blue-500/15 text-blue-300 border border-blue-500/20";
      case "on_hold":
        return "bg-amber-500/15 text-amber-300 border border-amber-500/20";
      case "completed":
        return "bg-purple-500/15 text-purple-300 border border-purple-500/20";
      default:
        return "bg-surface-700/50 text-surface-400";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-surface-800 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <div className="h-56 bg-surface-800 rounded-xl" />
          <div className="h-56 bg-surface-800 rounded-xl" />
          <div className="h-56 bg-surface-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-danger-500/10 border border-danger-500/20 text-danger-400 p-5 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <p>{error}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="btn-secondary text-xs px-3 py-1.5"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-surface-50">My Projects</h2>
        <p className="text-surface-400 text-sm mt-1">
          Projects you are contributing to. Select any project to jump directly to its tasks.
        </p>
      </div>

      {/* Toolbar: Search, Filter Popover, and Sort */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search projects by name or description…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-800 border border-surface-700/50 rounded-lg pl-9 pr-4 py-2 text-surface-200 text-sm focus:outline-none focus:border-primary-500/50 placeholder:text-surface-600"
          />
        </div>

        {/* Filter and Sort actions */}
        <div className="flex items-center gap-2 relative">
          {/* Filter Popover Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all duration-200 ${
                activeFilterCount > 0
                  ? "bg-primary-500/15 border-primary-500/30 text-primary-300 font-medium"
                  : "bg-surface-800 border-surface-700/50 text-surface-300 hover:text-surface-100 hover:border-surface-600"
              }`}
              title="Filter projects"
              aria-label="Filter projects"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              <span>Filter</span>
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-primary-500 text-white text-xs flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Filter Dropdown Popover */}
            {showFilterDropdown && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowFilterDropdown(false)}
                />
                <div className="absolute right-0 mt-2 w-64 bg-surface-800 border border-surface-700 rounded-xl shadow-xl p-4 z-30 space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-surface-700/50">
                    <span className="text-xs font-semibold text-surface-300 uppercase tracking-wider">
                      Filters
                    </span>
                    {activeFilterCount > 0 && (
                      <button
                        onClick={resetFilters}
                        className="text-xs text-primary-400 hover:text-primary-300"
                      >
                        Reset all
                      </button>
                    )}
                  </div>

                  {/* Status select */}
                  <div>
                    <label className="block text-xs text-surface-400 mb-1.5 font-medium">
                      Project Status
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full bg-surface-900 border border-surface-700 rounded-lg px-2.5 py-1.5 text-xs text-surface-200 focus:outline-none focus:border-primary-500"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="active">Active</option>
                      <option value="planning">Planning</option>
                      <option value="on_hold">On Hold</option>
                      <option value="completed">Completed</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>

                  {/* Overdue checkbox */}
                  <div>
                    <label className="flex items-center gap-2 text-xs text-surface-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={onlyOverdueFilter}
                        onChange={(e) => setOnlyOverdueFilter(e.target.checked)}
                        className="rounded bg-surface-900 border-surface-700 text-primary-500 focus:ring-primary-500 w-4 h-4"
                      />
                      <span>Only with overdue tasks</span>
                    </label>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-surface-800 border border-surface-700/50 rounded-lg px-3 py-2 text-surface-300 text-xs sm:text-sm focus:outline-none focus:border-primary-500/50"
            >
              <option value="IMPORTANT">Important first</option>
              <option value="OVERDUE">Overdue first</option>
              <option value="DEFAULT">Recently updated</option>
              <option value="PROGRESS_DESC">Highest progress</option>
              <option value="PROGRESS_ASC">Lowest progress</option>
              <option value="NAME">Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Projects List / Grid */}
      {filteredProjects.length === 0 ? (
        <div className="glass-card p-12 text-center max-w-lg mx-auto">
          <span className="text-4xl mb-3 block">🔍</span>
          <h3 className="text-lg font-bold text-surface-100">No projects found</h3>
          <p className="text-surface-400 text-sm mt-1">
            {projects.length === 0
              ? "You are not assigned to any projects yet."
              : "No projects match the current search or filters."}
          </p>
          {(searchQuery || activeFilterCount > 0) && (
            <button
              onClick={resetFilters}
              className="mt-4 btn-secondary text-xs px-4 py-2"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProjects.map((p) => {
            const metrics = projectMetrics.get(p.id) || {
              total: 0,
              todo: 0,
              inProgress: 0,
              review: 0,
              completed: 0,
              overdue: 0,
            };

            return (
              <div
                key={p.id}
                className="glass-card p-5 flex flex-col justify-between h-full hover:border-surface-600/80 transition-all duration-200"
              >
                <div>
                  {/* Card Header: Title & Status */}
                  <div className="flex justify-between items-start gap-2">
                    <h3
                      onClick={() => navigate(`/dashboard/projects/${p.id}`)}
                      className="text-lg font-bold text-surface-100 leading-snug line-clamp-1 cursor-pointer hover:text-primary-400 transition-colors"
                      title={`View ${p.name} details`}
                    >
                      {p.name}
                    </h3>
                    <span
                      className={`badge text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${getStatusBadge(
                        p.status
                      )}`}
                    >
                      {p.status.replace("_", " ")}
                    </span>
                  </div>

                  <p className="text-surface-400 text-xs mt-2 line-clamp-2 min-h-[32px]">
                    {p.description || "No description provided."}
                  </p>

                  {/* Tasks Summary */}
                  <div className="mt-4 p-3 bg-surface-800/40 rounded-lg border border-surface-700/30">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider">
                        My Tasks Summary
                      </h4>
                      {metrics.overdue > 0 && (
                        <span className="text-[11px] font-semibold text-danger-400 bg-danger-500/10 px-2 py-0.5 rounded border border-danger-500/20">
                          ⚠️ {metrics.overdue} overdue
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div className="bg-surface-900/60 p-1.5 rounded">
                        <span className="block text-surface-500 text-[10px]">Total</span>
                        <span className="font-semibold text-surface-200">{metrics.total}</span>
                      </div>
                      <div className="bg-surface-900/60 p-1.5 rounded">
                        <span className="block text-surface-500 text-[10px]">To Do</span>
                        <span className="font-semibold text-surface-200">{metrics.todo}</span>
                      </div>
                      <div className="bg-surface-900/60 p-1.5 rounded">
                        <span className="block text-primary-400 text-[10px]">In Prog</span>
                        <span className="font-semibold text-primary-300">{metrics.inProgress}</span>
                      </div>
                      <div className="bg-surface-900/60 p-1.5 rounded">
                        <span className="block text-warning-400 text-[10px]">Review</span>
                        <span className="font-semibold text-warning-300">{metrics.review}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer: Progress and Go to Tasks Button */}
                <div className="mt-5 pt-4 border-t border-surface-700/50 space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-surface-400 mb-1.5">
                      <span>Project Progress</span>
                      <span className="text-primary-400 font-semibold">{p.progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-surface-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, p.progress))}%` }}
                      />
                    </div>
                  </div>

                  {/* Action Buttons: Details and Tasks */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/dashboard/projects/${p.id}`)}
                      className="flex-1 btn-secondary text-xs py-2 flex items-center justify-center gap-1.5 transition-all duration-200"
                      title={`View details for ${p.name}`}
                    >
                      <span>Details</span>
                    </button>
                    <button
                      onClick={() => navigate(`/dashboard/my-tasks?project=${p.id}`)}
                      className="flex-1 btn-primary text-xs py-2 flex items-center justify-center gap-1.5 group shadow-sm hover:shadow-glow transition-all duration-200"
                      title={`View tasks for ${p.name}`}
                    >
                      <span>Tasks</span>
                      <svg
                        className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
