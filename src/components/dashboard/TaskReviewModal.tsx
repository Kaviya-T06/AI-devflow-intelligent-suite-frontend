import { useEffect, useState } from "react";
import Modal from "../ui/Modal";
import {
  fetchTaskGitHubEvidence,
  fetchTaskSubmissions,
  getAttachmentDownloadUrl,
  reviewTask,
} from "../../services/taskSubmissionService";
import type {
  GitHubEvidence,
  PendingReviewTask,
  ReviewDecision,
  Task,
  TaskAttachment,
  TaskSubmission,
} from "../../types";

interface TaskReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: PendingReviewTask | Task;
  onDecisionCompleted: () => void;
}

// ---------- AttachmentList sub-component ----------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentList({
  taskId,
  attachments,
}: {
  taskId: string;
  attachments: TaskAttachment[];
}) {
  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadBlob = async (att: TaskAttachment) => {
    if (blobUrls[att.id] || loading[att.id]) return;
    setLoading((prev) => ({ ...prev, [att.id]: true }));
    try {
      const url = await getAttachmentDownloadUrl(taskId, att.id);
      setBlobUrls((prev) => ({ ...prev, [att.id]: url }));
    } catch (e: any) {
      setErrors((prev) => ({ ...prev, [att.id]: e.message ?? "Failed to load" }));
    } finally {
      setLoading((prev) => ({ ...prev, [att.id]: false }));
    }
  };

  if (attachments.length === 0) return null;

  return (
    <div>
      <span className="text-surface-400 font-semibold uppercase tracking-wider text-[11px] block mb-1.5">
        Attachments ({attachments.length})
      </span>
      <div className="flex flex-wrap gap-2">
        {attachments.map((att) => {
          const isImage = att.mime_type.startsWith("image/");
          const url = blobUrls[att.id];
          return (
            <div
              key={att.id}
              className="bg-surface-900/70 border border-surface-700/60 rounded-lg p-2 flex items-center gap-2 max-w-xs"
            >
              {/* Preview / thumbnail */}
              {isImage ? (
                url ? (
                  <img
                    src={url}
                    alt={att.filename}
                    className="w-10 h-10 rounded object-cover border border-surface-700 shrink-0"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => loadBlob(att)}
                    disabled={loading[att.id]}
                    className="w-10 h-10 rounded bg-surface-800 border border-surface-700 flex items-center justify-center text-[9px] text-surface-500 hover:bg-surface-700 shrink-0"
                  >
                    {loading[att.id] ? "…" : "Preview"}
                  </button>
                )
              ) : (
                <div className="w-10 h-10 rounded bg-surface-800 border border-surface-700 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              )}

              {/* Filename + size + download */}
              <div className="flex-1 min-w-0">
                <p className="text-surface-200 text-[11px] font-medium truncate">{att.filename}</p>
                <p className="text-surface-500 text-[10px]">{formatBytes(att.size)}</p>
                {errors[att.id] && (
                  <p className="text-danger-400 text-[9px]">{errors[att.id]}</p>
                )}
              </div>

              {/* Download button */}
              <a
                href={url || "#"}
                download={att.filename}
                onClick={(e) => {
                  if (!url) {
                    e.preventDefault();
                    loadBlob(att);
                  }
                }}
                title="Download"
                className="text-primary-400 hover:text-primary-300 shrink-0 p-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TaskReviewModal({
  isOpen,
  onClose,
  task,
  onDecisionCompleted,
}: TaskReviewModalProps) {
  const isPending = "task_id" in task;
  const taskId = isPending ? (task as PendingReviewTask).task_id : (task as Task).id;
  const taskTitle = isPending ? (task as PendingReviewTask).task_title : (task as Task).title;
  const taskDesc = isPending ? (task as PendingReviewTask).task_description : (task as Task).description;
  const acceptanceCriteria = isPending ? (task as PendingReviewTask).acceptance_criteria : (task as Task).acceptance_criteria;
  const projectName = task.project_name || "Project";
  const devName = task.developer_name || "Assigned Developer";

  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [githubEvidence, setGithubEvidence] = useState<GitHubEvidence | null>(null);
  const [loadingGh, setLoadingGh] = useState(false);

  // Review Form Action State
  const [activeAction, setActiveAction] = useState<ReviewDecision | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !taskId) return;

    setLoadingHistory(true);
    fetchTaskSubmissions(taskId)
      .then((data) => {
        setSubmissions(data);
      })
      .catch((err) => {
        console.warn("Failed to load task submissions:", err);
      })
      .finally(() => setLoadingHistory(false));

    setLoadingGh(true);
    fetchTaskGitHubEvidence(taskId)
      .then((ev) => {
        setGithubEvidence(ev);
      })
      .catch((err) => {
        console.warn("GitHub evidence fetch notice:", err);
      })
      .finally(() => setLoadingGh(false));
  }, [isOpen, taskId]);

  const latestSubmission = submissions.length > 0 ? submissions[submissions.length - 1] : null;

  const handleExecuteAction = async (decision: ReviewDecision) => {
    setCommentError(null);
    setActionError(null);

    // Validate required comment for REQUEST_CHANGES and REJECT
    if (decision === "REQUEST_CHANGES" || decision === "REJECT") {
      if (!reviewComment.trim()) {
        setCommentError(
          decision === "REQUEST_CHANGES"
            ? "Feedback is required when requesting changes."
            : "A reason is required when rejecting a submission."
        );
        return;
      }
    }

    setActionLoading(true);
    try {
      await reviewTask(taskId, {
        decision,
        review_comment: reviewComment.trim() || undefined,
      });

      const decisionMsg =
        decision === "APPROVE"
          ? "Task approved and marked as COMPLETED!"
          : decision === "REQUEST_CHANGES"
          ? "Changes requested. Task returned to IN_PROGRESS for developer."
          : "Submission rejected. Feedback recorded and task updated.";

      setActionSuccess(decisionMsg);
      setTimeout(() => {
        onDecisionCompleted();
        onClose();
      }, 1000);
    } catch (err: any) {
      setActionError(err.message || "Failed to submit review decision.");
      setActionLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!actionLoading) onClose();
      }}
      title="Task Review & Verification"
      subtitle={`Reviewing: "${taskTitle}" • ${projectName}`}
      maxWidthClass="max-w-4xl"
    >
      <div className="p-4 sm:p-6 space-y-6 max-h-[82vh] overflow-y-auto">
        {actionSuccess && (
          <div className="bg-success-500/10 border border-success-500/20 text-success-300 p-3.5 rounded-xl text-sm flex items-center gap-2">
            <span>✅</span>
            <span className="font-medium">{actionSuccess}</span>
          </div>
        )}

        {actionError && (
          <div className="bg-danger-500/10 border border-danger-500/20 text-danger-400 p-3.5 rounded-xl text-sm flex items-center gap-2">
            <span>⚠️</span>
            <span>{actionError}</span>
          </div>
        )}

        {/* SECTION A: Task Information */}
        <div className="glass-card p-4 rounded-xl border border-surface-700/50 space-y-3">
          <div className="flex items-center justify-between border-b border-surface-700/40 pb-2">
            <h4 className="text-surface-200 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <span>📋</span> Section A: Task Information
            </h4>
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                  task.priority === "CRITICAL"
                    ? "bg-danger-500/20 text-danger-300"
                    : task.priority === "HIGH"
                    ? "bg-warning-500/20 text-warning-300"
                    : task.priority === "MEDIUM"
                    ? "bg-primary-500/20 text-primary-300"
                    : "bg-surface-700 text-surface-300"
                }`}
              >
                {task.priority} Priority
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-warning-500/15 text-warning-300 border border-warning-500/25 font-medium">
                {task.status}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-surface-400 block font-medium">Project</span>
              <span className="text-surface-100 font-semibold">{projectName}</span>
            </div>
            <div>
              <span className="text-surface-400 block font-medium">Assigned Developer</span>
              <span className="text-surface-100 font-semibold">{devName}</span>
            </div>
            <div>
              <span className="text-surface-400 block font-medium">Due Date</span>
              <span className="text-surface-100">
                {task.due_date ? new Date(task.due_date).toLocaleDateString() : "None"}
              </span>
            </div>
          </div>

          <div>
            <span className="text-surface-400 text-xs block font-medium mb-1">Description</span>
            <p className="text-surface-200 text-xs whitespace-pre-wrap bg-surface-900/60 p-2.5 rounded-lg border border-surface-800">
              {taskDesc || "No description provided."}
            </p>
          </div>

          {acceptanceCriteria && (
            <div>
              <span className="text-surface-400 text-xs block font-medium mb-1">
                Acceptance Criteria
              </span>
              <p className="text-surface-200 text-xs whitespace-pre-wrap bg-surface-900/60 p-2.5 rounded-lg border border-surface-800 font-mono text-[11px]">
                {acceptanceCriteria}
              </p>
            </div>
          )}
        </div>

        {/* SECTION B: Developer Submission */}
        <div className="glass-card p-4 rounded-xl border border-surface-700/50 space-y-3">
          <div className="flex items-center justify-between border-b border-surface-700/40 pb-2">
            <h4 className="text-surface-200 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <span>✍️</span> Section B: Developer Submission
              {latestSubmission && (
                <span className="badge bg-primary-500/20 text-primary-300 text-[10px] lowercase font-normal">
                  submission #{latestSubmission.submission_number}
                </span>
              )}
            </h4>
            {latestSubmission && (
              <span className="text-surface-400 text-[11px]">
                {new Date(latestSubmission.created_at).toLocaleString()}
              </span>
            )}
          </div>

          {loadingHistory ? (
            <p className="text-surface-400 text-xs py-3 animate-pulse">Loading submission details...</p>
          ) : !latestSubmission ? (
            <p className="text-surface-500 text-xs py-3 italic">
              No formal submission form recorded for this review.
            </p>
          ) : (
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-surface-400 font-semibold uppercase tracking-wider text-[11px] block mb-1">
                  Work Summary
                </span>
                <p className="text-surface-100 bg-surface-900/80 p-3 rounded-lg border border-surface-800 whitespace-pre-wrap">
                  {latestSubmission.work_summary}
                </p>
              </div>

              <div>
                <span className="text-surface-400 font-semibold uppercase tracking-wider text-[11px] block mb-1">
                  Implementation Details
                </span>
                <p className="text-surface-100 bg-surface-900/80 p-3 rounded-lg border border-surface-800 whitespace-pre-wrap font-mono text-[11px]">
                  {latestSubmission.implementation_details}
                </p>
              </div>

              <div>
                <span className="text-surface-400 font-semibold uppercase tracking-wider text-[11px] block mb-1">
                  Testing Performed
                </span>
                <p className="text-surface-100 bg-surface-900/80 p-3 rounded-lg border border-surface-800 whitespace-pre-wrap">
                  {latestSubmission.testing_performed}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {latestSubmission.pull_request_url && (
                  <div className="bg-surface-900/60 p-2.5 rounded-lg border border-surface-800">
                    <span className="text-surface-400 block text-[11px] font-medium mb-1">
                      Pull Request URL
                    </span>
                    <a
                      href={latestSubmission.pull_request_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary-400 hover:text-primary-300 underline font-medium truncate block flex items-center gap-1.5"
                    >
                      <span>{latestSubmission.pull_request_url}</span>
                      <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                )}

                {latestSubmission.deliverable_url && (
                  <div className="bg-surface-900/60 p-2.5 rounded-lg border border-surface-800">
                    <span className="text-surface-400 block text-[11px] font-medium mb-1">
                      Deliverable URL
                    </span>
                    <a
                      href={latestSubmission.deliverable_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary-400 hover:text-primary-300 underline font-medium truncate block flex items-center gap-1.5"
                    >
                      <span>{latestSubmission.deliverable_url}</span>
                      <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                )}
              </div>

              {latestSubmission.additional_comments && (
                <div>
                  <span className="text-surface-400 font-semibold uppercase tracking-wider text-[11px] block mb-1">
                    Additional Comments
                  </span>
                  <p className="text-surface-300 bg-surface-900/40 p-2.5 rounded-lg border border-surface-800 italic">
                    "{latestSubmission.additional_comments}"
                  </p>
                </div>
              )}

              {/* Attachments for this submission */}
              {latestSubmission.attachments && latestSubmission.attachments.length > 0 && (
                <AttachmentList taskId={taskId} attachments={latestSubmission.attachments} />
              )}
            </div>
          )}
        </div>

        {/* SECTION C: GitHub Evidence */}
        <div className="glass-card p-4 rounded-xl border border-surface-700/50 space-y-3">
          <div className="flex items-center justify-between border-b border-surface-700/40 pb-2">
            <h4 className="text-surface-200 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              Section C: GitHub Evidence & Code Verification
            </h4>
            {githubEvidence?.pull_request_url && (
              <a
                href={githubEvidence.pull_request_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary-400 hover:text-primary-300 underline flex items-center gap-1"
              >
                <span>Open PR on GitHub</span>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>

          {loadingGh ? (
            <p className="text-surface-400 text-xs py-2 animate-pulse">Verifying GitHub repository & PR evidence...</p>
          ) : !githubEvidence || !githubEvidence.available ? (
            <div className="bg-surface-900/60 p-3 rounded-lg border border-surface-800 text-xs text-surface-400 space-y-1">
              <p className="text-surface-300 font-medium">
                {githubEvidence?.message || "No GitHub pull request associated with this submission."}
              </p>
              {githubEvidence?.pull_request_url && (
                <p>
                  You can inspect the pull request link directly:{" "}
                  <a
                    href={githubEvidence.pull_request_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary-400 underline"
                  >
                    {githubEvidence.pull_request_url}
                  </a>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-900/80 p-3 rounded-lg border border-surface-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-surface-100 text-sm">
                      {githubEvidence.title || "Pull Request"}
                    </span>
                    <span className="font-mono text-surface-400 text-xs">
                      #{githubEvidence.pull_request_number}
                    </span>
                  </div>
                  <p className="text-surface-400 text-[11px] mt-0.5">
                    Repository: <span className="font-mono text-surface-200">{githubEvidence.repository_name}</span> · Author: <span className="text-surface-200">{githubEvidence.author || "Unknown"}</span>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`badge text-xs px-2.5 py-1 rounded-full font-medium ${
                      githubEvidence.is_merged
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                        : githubEvidence.status === "open"
                        ? "bg-success-500/20 text-success-300 border border-success-500/30"
                        : "bg-surface-700 text-surface-400"
                    }`}
                  >
                    {githubEvidence.is_merged ? "Merged" : (githubEvidence.status || "Open")}
                  </span>
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-success-400 font-semibold">+{githubEvidence.additions ?? 0}</span>
                    <span className="text-danger-400 font-semibold">-{githubEvidence.deletions ?? 0}</span>
                  </div>
                </div>
              </div>

              {/* Changed files */}
              {githubEvidence.changed_files && githubEvidence.changed_files.length > 0 && (
                <div>
                  <span className="text-surface-400 text-[11px] font-semibold uppercase tracking-wider block mb-1">
                    Modified Files ({githubEvidence.changed_files.length})
                  </span>
                  <div className="max-h-36 overflow-y-auto space-y-1 bg-surface-900/60 p-2 rounded-lg border border-surface-800">
                    {githubEvidence.changed_files.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-[11px] font-mono py-1 px-2 rounded hover:bg-surface-800/60"
                      >
                        <span className="text-surface-200 truncate max-w-[420px]">{file.filename}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded ${
                              file.status === "added"
                                ? "bg-success-500/20 text-success-300"
                                : file.status === "removed"
                                ? "bg-danger-500/20 text-danger-300"
                                : "bg-primary-500/20 text-primary-300"
                            }`}
                          >
                            {file.status}
                          </span>
                          <span className="text-success-400">+{file.additions}</span>
                          <span className="text-danger-400">-{file.deletions}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION D: Review History */}
        <div className="glass-card p-4 rounded-xl border border-surface-700/50 space-y-3">
          <div className="flex items-center justify-between border-b border-surface-700/40 pb-2">
            <h4 className="text-surface-200 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <span>🕒</span> Section D: Historical Submissions & Reviews
            </h4>
            <span className="text-surface-400 text-[11px]">
              {submissions.length} submission{submissions.length !== 1 ? "s" : ""} on record
            </span>
          </div>

          {loadingHistory ? (
            <p className="text-surface-400 text-xs py-2 animate-pulse">Loading audit history...</p>
          ) : submissions.length === 0 ? (
            <p className="text-surface-500 text-xs py-2 italic">No past submission history.</p>
          ) : (
            <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="bg-surface-900/60 p-3 rounded-lg border border-surface-800 text-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-surface-200">
                      Submission #{sub.submission_number}
                    </span>
                    <span className="text-surface-500 text-[11px]">
                      {new Date(sub.created_at).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-surface-300 text-[11px] line-clamp-2">
                    <strong className="text-surface-400">Summary:</strong> {sub.work_summary}
                  </p>

                  {/* Attachments for this past submission */}
                  {sub.attachments && sub.attachments.length > 0 && (
                    <div className="border-t border-surface-800/80 pt-2">
                      <AttachmentList taskId={taskId} attachments={sub.attachments} />
                    </div>
                  )}

                  {/* Reviews for this submission */}
                  {sub.reviews && sub.reviews.length > 0 && (
                    <div className="border-t border-surface-800/80 pt-2 space-y-1.5">
                      <span className="text-surface-400 font-semibold text-[10px] uppercase tracking-wider block">
                        Manager Decisions:
                      </span>
                      {sub.reviews.map((rev) => (
                        <div
                          key={rev.id}
                          className="bg-surface-800/50 p-2 rounded border border-surface-700/50 flex flex-col gap-1 text-[11px]"
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                                rev.decision === "APPROVE"
                                  ? "bg-success-500/20 text-success-300"
                                  : rev.decision === "REQUEST_CHANGES"
                                  ? "bg-warning-500/20 text-warning-300"
                                  : "bg-danger-500/20 text-danger-300"
                              }`}
                            >
                              {rev.decision.replace("_", " ")}
                            </span>
                            <span className="text-surface-500 text-[10px]">
                              by {rev.reviewer_name || "Manager"} · {new Date(rev.created_at).toLocaleString()}
                            </span>
                          </div>
                          {rev.review_comment && (
                            <p className="text-surface-200 italic mt-0.5">"{rev.review_comment}"</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION E: Review Actions */}
        <div className="p-4 bg-surface-900/90 rounded-xl border border-primary-500/30 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-surface-100 text-sm font-bold flex items-center gap-2">
                <span>⚖️</span> Section E: Manager Decision
              </h4>
              <p className="text-surface-400 text-xs mt-0.5">
                Select a decision and provide necessary feedback for the assigned developer.
              </p>
            </div>
            {activeAction && (
              <button
                type="button"
                onClick={() => {
                  setActiveAction(null);
                  setReviewComment("");
                  setCommentError(null);
                }}
                className="text-surface-400 hover:text-surface-200 text-xs underline"
              >
                Clear Selection
              </button>
            )}
          </div>

          {/* Decision selection buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => {
                setActiveAction("APPROVE");
                setCommentError(null);
              }}
              disabled={actionLoading}
              className={`p-3 rounded-xl border text-center transition-all ${
                activeAction === "APPROVE"
                  ? "bg-success-500/20 border-success-500 text-success-300 ring-2 ring-success-500/20"
                  : "bg-surface-800/60 border-surface-700/60 hover:border-success-500/50 text-surface-200"
              }`}
            >
              <span className="text-lg block mb-1">✅</span>
              <span className="font-bold text-xs uppercase tracking-wider block">Approve</span>
              <span className="text-[10px] text-surface-400 block mt-0.5">
                Mark COMPLETED & recalculate progress
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveAction("REQUEST_CHANGES");
                setCommentError(null);
              }}
              disabled={actionLoading}
              className={`p-3 rounded-xl border text-center transition-all ${
                activeAction === "REQUEST_CHANGES"
                  ? "bg-warning-500/20 border-warning-500 text-warning-300 ring-2 ring-warning-500/20"
                  : "bg-surface-800/60 border-surface-700/60 hover:border-warning-500/50 text-surface-200"
              }`}
            >
              <span className="text-lg block mb-1">🔄</span>
              <span className="font-bold text-xs uppercase tracking-wider block">Request Changes</span>
              <span className="text-[10px] text-surface-400 block mt-0.5">
                Return to IN_PROGRESS for revision
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveAction("REJECT");
                setCommentError(null);
              }}
              disabled={actionLoading}
              className={`p-3 rounded-xl border text-center transition-all ${
                activeAction === "REJECT"
                  ? "bg-danger-500/20 border-danger-500 text-danger-300 ring-2 ring-danger-500/20"
                  : "bg-surface-800/60 border-surface-700/60 hover:border-danger-500/50 text-surface-200"
              }`}
            >
              <span className="text-lg block mb-1">❌</span>
              <span className="font-bold text-xs uppercase tracking-wider block">Reject</span>
              <span className="text-[10px] text-surface-400 block mt-0.5">
                Record rejection & guidance path
              </span>
            </button>
          </div>

          {/* Feedback comment input */}
          {activeAction && (
            <div className="space-y-2 pt-2 animate-fade-in">
              <label className="block text-surface-300 text-xs font-semibold">
                {activeAction === "APPROVE" ? (
                  <>
                    Approval Comments <span className="text-surface-500 font-normal lowercase">(optional)</span>
                  </>
                ) : activeAction === "REQUEST_CHANGES" ? (
                  <>
                    Feedback for Requested Changes <span className="text-danger-400">*</span>
                  </>
                ) : (
                  <>
                    Rejection Reason & Next Steps <span className="text-danger-400">*</span>
                  </>
                )}
              </label>
              <textarea
                rows={3}
                value={reviewComment}
                onChange={(e) => {
                  setReviewComment(e.target.value);
                  if (commentError) setCommentError(null);
                }}
                placeholder={
                  activeAction === "APPROVE"
                    ? "Great work on this task! All acceptance criteria met."
                    : activeAction === "REQUEST_CHANGES"
                    ? "Please add unit tests for edge cases and update the error boundary before resubmission..."
                    : "Task deliverable did not satisfy requirements because..."
                }
                disabled={actionLoading}
                className={`w-full bg-surface-950 border ${
                  commentError ? "border-danger-500" : "border-surface-700"
                } rounded-lg p-3 text-xs text-surface-100 focus:outline-none focus:border-primary-500 resize-none`}
              />
              {commentError && (
                <p className="text-danger-400 text-[11px] font-medium">{commentError}</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleExecuteAction(activeAction)}
                  disabled={actionLoading}
                  className={`text-xs px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50 transition-colors ${
                    activeAction === "APPROVE"
                      ? "bg-success-600 hover:bg-success-500 text-white"
                      : activeAction === "REQUEST_CHANGES"
                      ? "bg-warning-600 hover:bg-warning-500 text-white"
                      : "bg-danger-600 hover:bg-danger-500 text-white"
                  }`}
                >
                  {actionLoading ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>Confirm {activeAction.replace("_", " ")}</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Close Button */}
        <div className="pt-2 border-t border-surface-700/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={actionLoading}
            className="btn-secondary text-xs px-4 py-2"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
