/**
 * PM Service — API calls for Project Manager role dashboard.
 * All functions make authenticated calls to the FastAPI backend.
 * No mock data. All data comes from the live database.
 */
import type {
  PMDashboardStats,
  PMActivityItem,
  Task,
  Project,
  ActivityLog,
} from "../types";

const API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const BASE = `${API}/api/v1`;

// ---------------------------------------------------------------------------
// Shared fetch helper
// ---------------------------------------------------------------------------

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
  // Handle 204 No Content
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// PM Dashboard Stats
// ---------------------------------------------------------------------------

/**
 * Fetch PM-specific dashboard stats.
 * Scoped to projects managed by the current user (enforced by backend).
 */
export async function fetchPMDashboardStats(): Promise<PMDashboardStats> {
  return apiFetch<PMDashboardStats>("/dashboard/pm-stats");
}

// ---------------------------------------------------------------------------
// PM Activity Feed
// ---------------------------------------------------------------------------

/**
 * Fetch recent activity for the PM's managed projects.
 */
export async function fetchPMActivity(limit = 20): Promise<PMActivityItem[]> {
  return apiFetch<PMActivityItem[]>(`/dashboard/pm-activity?limit=${limit}`);
}

// ---------------------------------------------------------------------------
// Projects (PM-scoped)
// ---------------------------------------------------------------------------

/**
 * Fetch all projects managed by the current PM.
 * Backend enforces the filter via project_manager_id.
 */
export async function fetchManagedProjects(statusFilter?: string): Promise<Project[]> {
  const qs = statusFilter ? `?status=${statusFilter}` : "";
  return apiFetch<Project[]>(`/projects${qs}`);
}

/**
 * Update a project (PM can only update their managed projects).
 */
export async function updateManagedProject(
  projectId: string,
  data: {
    name?: string;
    description?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
  }
): Promise<Project> {
  return apiFetch<Project>(`/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ---------------------------------------------------------------------------
// Tasks (PM-scoped)
// ---------------------------------------------------------------------------

/**
 * Fetch tasks for a specific project (PM can only see their projects' tasks).
 */
export async function fetchProjectTasks(projectId: string): Promise<Task[]> {
  return apiFetch<Task[]>(`/tasks?project_id=${projectId}`);
}

/**
 * Fetch all tasks across managed projects.
 */
export async function fetchAllManagedTasks(): Promise<Task[]> {
  return apiFetch<Task[]>("/tasks");
}

/**
 * Create a task for a managed project.
 */
export async function createManagedTask(data: {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  project_id?: string | null;
  assigned_to?: string | null;
  due_date?: string | null;
  required_skills?: string[];
  min_experience_years?: number;
}): Promise<Task> {
  return apiFetch<Task>("/tasks", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Update a task (PM can update tasks in their managed projects).
 */
export async function updateManagedTask(
  taskId: string,
  data: {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    project_id?: string | null;
    assigned_to?: string | null;
    due_date?: string | null;
    required_skills?: string[];
    min_experience_years?: number;
  }
): Promise<Task> {
  return apiFetch<Task>(`/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/**
 * Delete a task from a managed project.
 */
export async function deleteManagedTask(taskId: string): Promise<void> {
  return apiFetch<void>(`/tasks/${taskId}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Assignable users (for task assignment by PM)
// ---------------------------------------------------------------------------

export interface AssignableUser {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
}

/**
 * Fetch developers and PMs available for task assignment.
 * Returns active users with developer or project_manager roles.
 */
export async function fetchAssignableUsers(): Promise<AssignableUser[]> {
  return apiFetch<AssignableUser[]>("/dashboard/pm-users");
}

// ---------------------------------------------------------------------------
// Workflow Risks (PM-scoped)
// ---------------------------------------------------------------------------

import type { WorkflowRisk } from "../types";

/**
 * Fetch workflow risks for the PM's managed projects.
 * Backend scopes results to projects where current user is project_manager.
 */
export async function fetchPMRisks(filters?: {
  status?: string;
  severity?: string;
  risk_type?: string;
  project_id?: string;
}): Promise<WorkflowRisk[]> {
  const params = new URLSearchParams();
  if (filters?.status)     params.set("status",     filters.status);
  if (filters?.severity)   params.set("severity",   filters.severity);
  if (filters?.risk_type)  params.set("risk_type",  filters.risk_type);
  if (filters?.project_id) params.set("project_id", filters.project_id);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<WorkflowRisk[]>(`/workflow-risks${qs}`);
}

/**
 * Fetch workflow risks relevant to the current developer's tasks.
 */
export async function fetchMyRisks(): Promise<WorkflowRisk[]> {
  return apiFetch<WorkflowRisk[]>("/workflow-risks");
}

export async function fetchProjectHistory(projectId: string): Promise<ActivityLog[]> {
  return apiFetch<ActivityLog[]>(`/projects/${projectId}/history`);
}

// ---------------------------------------------------------------------------
// Developer Recommendations
// ---------------------------------------------------------------------------

export interface TaskRecommendation {
  developer_id: string;
  developer_name: string;
  match_score: number;
  score_breakdown: Record<string, number>;
  matched_skills: string[];
  missing_skills: string[];
  experience_relevance: string;
  workload_warning: string | null;
  explanation: string;
}

/** Normalize the raw backend candidate object into the frontend TaskRecommendation shape */
function normalizeRecommendation(raw: any): TaskRecommendation {
  const dev = raw.developer ?? {};
  
  // Rely on backend's fields for skills
  const requiredSkills: string[] = raw.task_required_skills ?? [];
  const missing: string[] = raw.missing_skills ?? [];
  const matched: string[] = requiredSkills.filter(
    (s) => !missing.map((m) => m.toLowerCase()).includes(s.toLowerCase())
  );

  const rawScore: number = raw.match_score ?? 0;
  // Backend returns score as 0-100 integer; normalize to 0-1 for percentage display
  const matchScore = rawScore > 1 ? rawScore / 100 : rawScore;

  const expYears: number = dev.experience_years ?? 0;
  const activeTasks: number = dev.active_task_count ?? 0;
  const capacity: number = dev.capacity_hours_per_week ?? 40;
  const utilization = (activeTasks * 10) / Math.max(capacity, 1);

  return {
    developer_id: dev.id ?? raw.developer_id ?? "",
    developer_name: dev.full_name ?? dev.name ?? raw.developer_name ?? "Unknown",
    match_score: matchScore,
    score_breakdown: raw.score_breakdown ?? {},
    matched_skills: matched,
    missing_skills: missing,
    experience_relevance: `${expYears} year${expYears !== 1 ? "s" : ""} of experience`,
    workload_warning:
      utilization > 0.8
        ? `High workload: ${activeTasks} active task${activeTasks !== 1 ? "s" : ""} (${Math.round(utilization * 100)}% capacity)`
        : null,
    explanation: raw.ai_explanation ?? raw.basic_explanation ?? "",
  };
}

export async function fetchTaskRecommendations(taskId: string): Promise<TaskRecommendation[]> {
  const raw = await apiFetch<any[]>(`/tasks/${taskId}/recommendations`);
  return (raw ?? []).map(normalizeRecommendation);
}

