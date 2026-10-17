/**
 * Task Submission and Project Manager Review API Service.
 * Connects directly to FastAPI endpoints for submissions, pending reviews,
 * review decisions (Approve, Request Changes, Reject), and GitHub evidence.
 */
import type {
  GitHubEvidence,
  PendingReviewTask,
  Task,
  TaskReview,
  TaskReviewPayload,
  TaskSubmission,
  TaskSubmissionPayload,
} from "../types";

const API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const BASE = `${API}/api/v1`;

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("access_token");
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `API error ${res.status}`);
  }

  if (res.status === 204) return undefined as unknown as T;
  const text = await res.text();
  if (!text || !text.trim()) return undefined as unknown as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

/**
 * Submit an assigned task for Project Manager review.
 * When `files` are provided the request is sent as multipart/form-data
 * so the backend can receive the binary uploads; otherwise JSON is used.
 */
export async function submitTaskForReview(
  taskId: string,
  payload: TaskSubmissionPayload,
  files?: File[]
): Promise<TaskSubmission> {
  const token = localStorage.getItem("access_token");
  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  if (files && files.length > 0) {
    const fd = new FormData();
    // Append text fields
    (Object.entries(payload) as [string, string | null | undefined][]).forEach(
      ([k, v]) => {
        if (v != null) fd.append(k, String(v));
      }
    );
    // Append files
    files.forEach((f) => fd.append("files", f));

    const res = await fetch(`${BASE}/tasks/${taskId}/submit`, {
      method: "POST",
      headers: authHeader,
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? `API error ${res.status}`);
    }
    return res.json() as Promise<TaskSubmission>;
  }

  // JSON path (no files)
  return apiFetch<TaskSubmission>(`/tasks/${taskId}/submit`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Fetch all past submissions and reviews for a specific task.
 */
export async function fetchTaskSubmissions(taskId: string): Promise<TaskSubmission[]> {
  return apiFetch<TaskSubmission[]>(`/tasks/${taskId}/submissions`);
}

/**
 * Fetch tasks pending review for projects managed by current PM (or all for admin).
 */
export async function fetchPendingReviews(projectId?: string): Promise<PendingReviewTask[]> {
  const qs = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
  return apiFetch<PendingReviewTask[]>(`/tasks/pending-reviews${qs}`);
}

/**
 * Perform a review decision on a task: APPROVE, REQUEST_CHANGES, or REJECT.
 */
export async function reviewTask(
  taskId: string,
  payload: TaskReviewPayload
): Promise<{ message: string; task: Task; review: TaskReview }> {
  return apiFetch<{ message: string; task: Task; review: TaskReview }>(`/tasks/${taskId}/review`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Convenience helper to approve a task.
 */
export async function approveTask(
  taskId: string,
  review_comment?: string
): Promise<{ message: string; task: Task; review: TaskReview }> {
  return reviewTask(taskId, {
    decision: "APPROVE",
    review_comment,
  });
}

/**
 * Convenience helper to request changes on a task.
 */
export async function requestChangesTask(
  taskId: string,
  review_comment: string
): Promise<{ message: string; task: Task; review: TaskReview }> {
  return reviewTask(taskId, {
    decision: "REQUEST_CHANGES",
    review_comment,
  });
}

/**
 * Convenience helper to reject a task submission.
 */
export async function rejectTask(
  taskId: string,
  review_comment: string
): Promise<{ message: string; task: Task; review: TaskReview }> {
  return reviewTask(taskId, {
    decision: "REJECT",
    review_comment,
  });
}

/**
 * Fetch real GitHub pull request evidence (repo name, PR status, files changed, additions/deletions, review state).
 */
export async function fetchTaskGitHubEvidence(taskId: string): Promise<GitHubEvidence> {
  return apiFetch<GitHubEvidence>(`/tasks/${taskId}/github-evidence`);
}

/**
 * Returns a backend-generated signed download URL for an attachment.
 * Use this URL directly in <a href> or <img src> — it expires after 15 minutes.
 * All access is JWT-verified by the backend before the signed URL is issued.
 */
export async function getAttachmentDownloadUrl(
  taskId: string,
  attachmentId: string
): Promise<string> {
  const token = localStorage.getItem("access_token");
  const headers: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};
  const res = await fetch(
    `${BASE}/tasks/${taskId}/attachments/${attachmentId}/preview`,
    { headers }
  );
  // For inline preview/download we build a blob URL from the streamed bytes
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `API error ${res.status}`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
