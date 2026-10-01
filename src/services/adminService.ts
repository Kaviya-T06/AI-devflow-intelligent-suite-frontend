/**
 * Admin data service — calls the real FastAPI backend.
 * No mock data. All responses come from the Supabase PostgreSQL database.
 */
import type { Project, Task, ActivityLog, WorkflowRisk, Repository } from "../types";

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
    throw new Error(err.detail ?? "API error");
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Dashboard stats
// ---------------------------------------------------------------------------

export interface DashboardStats {
  totalUsers:     number;
  activeProjects: number;
  openTasks:      number;
  openRisks:      number;
  connectedRepos: number;

  total_projects: number;
  active_projects: number;
  completed_projects: number;
  on_hold_projects: number;
  planning_projects: number;
  archived_projects: number;
  average_progress: number;
  recent_projects: Array<{
    id: string;
    name: string;
    status: string;
    progress: number;
  }>;
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  return apiFetch<DashboardStats>("/dashboard/stats");
}

// ---------------------------------------------------------------------------
// Recent activity
// ---------------------------------------------------------------------------

export async function fetchRecentActivity(limit = 10): Promise<ActivityLog[]> {
  return apiFetch<ActivityLog[]>(`/activity?limit=${limit}`);
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface UserRecord {
  id:         string;
  name:       string;
  email:      string;
  role:       string;   // "admin" | "developer" | "project_manager"
  is_active:  boolean;
  created_at: string | null;
}

export async function fetchAllUsers(): Promise<UserRecord[]> {
  return apiFetch<UserRecord[]>("/users");
}

export async function createUser(data: {
  name:      string;
  email:     string;
  password:  string;
  role:      string;
  is_active: boolean;
}): Promise<UserRecord> {
  return apiFetch<UserRecord>("/users", {
    method: "POST",
    body:   JSON.stringify(data),
  });
}

export async function updateUser(
  userId: string,
  data: { name?: string; email?: string; role?: string; is_active?: boolean },
): Promise<UserRecord> {
  return apiFetch<UserRecord>(`/users/${userId}`, {
    method: "PUT",
    body:   JSON.stringify(data),
  });
}

export async function updateUserRole(userId: string, role: string): Promise<void> {
  await apiFetch(`/users/${userId}`, {
    method: "PATCH",
    body:   JSON.stringify({ role }),
  });
}

export async function updateUserStatus(userId: string, isActive: boolean): Promise<void> {
  await apiFetch(`/users/${userId}/status`, {
    method: "PATCH",
    body:   JSON.stringify({ is_active: isActive }),
  });
}

export async function deleteUser(userId: string): Promise<void> {
  await apiFetch(`/users/${userId}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function fetchAllProjects(): Promise<Project[]> {
  return apiFetch<Project[]>("/projects");
}

export async function createProject(
  data: Omit<Project, "id" | "created_at" | "updated_at">,
): Promise<Project> {
  return apiFetch<Project>("/projects", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProject(id: string, data: Partial<Project>): Promise<void> {
  await apiFetch(`/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteProject(id: string): Promise<void> {
  await apiFetch(`/projects/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function fetchAllTasks(): Promise<Task[]> {
  return apiFetch<Task[]>("/tasks");
}

export async function createTask(
  data: Omit<Task, "id" | "created_at" | "updated_at" | "assigned_at" | "started_at" | "review_started_at" | "completed_at">,
): Promise<Task> {
  return apiFetch<Task>("/tasks", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateTask(id: string, data: Partial<Task>): Promise<void> {
  await apiFetch(`/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteTask(id: string): Promise<void> {
  await apiFetch(`/tasks/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Workflow risks
// ---------------------------------------------------------------------------

export async function fetchAllRisks(): Promise<WorkflowRisk[]> {
  return apiFetch<WorkflowRisk[]>("/workflow-risks");
}

export async function updateRiskStatus(
  id: string,
  status: WorkflowRisk["status"],
): Promise<void> {
  await apiFetch(`/workflow-risks/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// ---------------------------------------------------------------------------
// Repositories
// ---------------------------------------------------------------------------

export async function fetchAllRepositories(): Promise<Repository[]> {
  return apiFetch<Repository[]>("/repositories");
}

export async function createRepository(
  data: Omit<Repository, "id">,
): Promise<Repository> {
  return apiFetch<Repository>("/repositories", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateRepository(
  id: string,
  data: Partial<Repository>,
): Promise<void> {
  await apiFetch(`/repositories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteRepository(id: string): Promise<void> {
  await apiFetch(`/repositories/${id}`, { method: "DELETE" });
}
