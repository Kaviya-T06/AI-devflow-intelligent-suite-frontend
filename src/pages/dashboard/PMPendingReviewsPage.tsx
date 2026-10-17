/**
 * PMPendingReviewsPage — Dedicated Pending Reviews page for Project Managers.
 * Displays all tasks in REVIEW status across projects managed by the authenticated user.
 * Provides real-time review actions, GitHub pull request inspection, and full submission history.
 */
import { useEffect, useState, useCallback } from "react";
import { fetchPendingReviews } from "../../services/taskSubmissionService";
import { fetchAllProjects } from "../../services/adminService";
import type { PendingReviewTask, Project } from "../../types";
import TaskReviewModal from "../../components/dashboard/TaskReviewModal";

export default function PMPendingReviewsPage() {
  const [pendingTasks, setPendingTasks] = useState<PendingReviewTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Review modal state
  const [reviewingTask, setReviewingTask] = useState<PendingReviewTask | null>(null);

  const loadPendingReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const projFilter = selectedProjectId !== "ALL" ? selectedProjectId : undefined;
      const [reviewsData, projectsData] = await Promise.all([
        fetchPendingReviews(projFilter),
        fetchAllProjects().catch(() => []),
      ]);
      setPendingTasks(reviewsData);
      setProjects(projectsData);
    } catch (err: any) {
      setError(err.message || "Failed to load pending reviews.");
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadPendingReviews();
  }, [loadPendingReviews]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-surface-50 flex items-center gap-2.5">
            <span>🔍</span> Pending Reviews
            <span className="badge bg-warning-500/20 text-warning-300 border border-warning-500/30 text-xs px-2.5 py-0.5 rounded-full">
              {pendingTasks.length} Awaiting Review
            </span>
          </h2>
          <p className="text-surface-400 text-sm mt-1">
            Inspect developer submissions, verify deliverables, review GitHub PR evidence, and approve or request changes.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {projects.length > 0 && (
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-surface-800 border border-surface-700/60 rounded-lg px-3 py-1.5 text-xs text-surface-200 focus:outline-none focus:border-primary-500"
            >
              <option value="ALL">All Managed Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={loadPendingReviews}
            disabled={loading}
            className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 shrink-0"
          >
            <svg
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-danger-500/10 border border-danger-500/20 text-danger-400 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <p className="text-sm">{error}</p>
          </div>
          <button onClick={loadPendingReviews} className="btn-secondary text-xs py-1 px-3">
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="glass-card p-12 text-center animate-pulse space-y-3">
          <div className="w-8 h-8 rounded-full bg-surface-700 mx-auto" />
          <p className="text-surface-400 text-sm">Loading pending reviews...</p>
        </div>
      ) : pendingTasks.length === 0 ? (
        /* Empty state */
        <div className="glass-card p-12 text-center rounded-2xl">
          <span className="text-4xl mb-3 block">🎉</span>
          <h3 className="text-surface-100 font-bold text-lg">All Caught Up!</h3>
          <p className="text-surface-400 text-sm max-w-md mx-auto mt-1">
            There are currently no tasks pending your review. When developers submit their work for review, they will appear here.
          </p>
        </div>
      ) : (
        /* Pending reviews table / cards */
        <div className="glass-card overflow-hidden rounded-2xl border border-surface-700/50">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-surface-700/50 bg-surface-800/40 text-surface-400 font-semibold uppercase tracking-wider">
                  <th className="px-5 py-3.5">Task Title</th>
                  <th className="px-5 py-3.5">Project</th>
                  <th className="px-5 py-3.5">Developer</th>
                  <th className="px-5 py-3.5">Submission Date</th>
                  <th className="px-5 py-3.5 text-center">Submissions</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Review Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/30">
                {pendingTasks.map((t) => (
                  <tr
                    key={t.task_id}
                    className="hover:bg-surface-800/40 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-surface-100 text-sm">
                          {t.task_title}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full ${
                            t.priority === "CRITICAL"
                              ? "bg-danger-500/20 text-danger-300"
                              : t.priority === "HIGH"
                              ? "bg-warning-500/20 text-warning-300"
                              : t.priority === "MEDIUM"
                              ? "bg-primary-500/20 text-primary-300"
                              : "bg-surface-700 text-surface-400"
                          }`}
                        >
                          {t.priority}
                        </span>
                      </div>
                      {t.latest_submission?.work_summary && (
                        <p className="text-surface-400 text-[11px] line-clamp-1 mt-0.5 max-w-sm">
                          {t.latest_submission.work_summary}
                        </p>
                      )}
                    </td>

                    <td className="px-5 py-4 text-surface-300 font-medium">
                      {t.project_name || "—"}
                    </td>

                    <td className="px-5 py-4">
                      <span className="text-surface-200 font-medium block">
                        {t.developer_name || "Unassigned"}
                      </span>
                      {t.developer_email && (
                        <span className="text-surface-500 text-[11px]">
                          {t.developer_email}
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-surface-300">
                      {t.submitted_at
                        ? new Date(t.submitted_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Recently"}
                    </td>

                    <td className="px-5 py-4 text-center">
                      <span className="badge bg-surface-700/60 text-surface-200 font-mono text-xs px-2.5 py-1 rounded-full">
                        #{t.submission_count || 1}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-center">
                      <span className="text-xs px-2.5 py-1 rounded-full bg-warning-500/15 text-warning-300 border border-warning-500/30 font-medium">
                        REVIEW
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => setReviewingTask(t)}
                        className="btn-primary text-xs py-1.5 px-3.5 inline-flex items-center gap-1.5 shadow-sm"
                      >
                        <span>View Submission</span>
                        <span>→</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detailed Review Modal */}
      {reviewingTask && (
        <TaskReviewModal
          isOpen={true}
          task={reviewingTask}
          onClose={() => setReviewingTask(null)}
          onDecisionCompleted={() => {
            loadPendingReviews();
          }}
        />
      )}
    </div>
  );
}
