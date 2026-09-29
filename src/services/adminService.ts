/**
 * Admin data service — currently backed by mock data.
 * Replace each function body with the real Supabase / FastAPI call when the DB is ready.
 * The function signatures MUST NOT change — only the implementation bodies.
 */
import type { Profile, Project, Task, ActivityLog, WorkflowRisk, Repository } from "../types";
import {
  MOCK_USERS,
  MOCK_PROJECTS,
  MOCK_TASKS,
  MOCK_ACTIVITY,
  MOCK_RISKS,
  MOCK_REPOSITORIES,
  getMockDashboardStats,
} from "./mockData";

// ---------------------------------------------------------------------------
// Dashboard stats
// ---------------------------------------------------------------------------

export interface DashboardStats {
  totalUsers: number;
  activeProjects: number;
  openTasks: number;
  openRisks: number;
  connectedRepos: number;
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  // TODO: Replace with FastAPI call → GET /api/v1/dashboard/stats
  return getMockDashboardStats();
}

// ---------------------------------------------------------------------------
// Recent activity
// ---------------------------------------------------------------------------

export async function fetchRecentActivity(limit = 10): Promise<ActivityLog[]> {
  // TODO: Replace with FastAPI call → GET /api/v1/activity?limit={limit}
  return MOCK_ACTIVITY.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Users (profiles)
// ---------------------------------------------------------------------------

export async function fetchAllUsers(): Promise<Profile[]> {
  // TODO: Replace with FastAPI call → GET /api/v1/users
  return [...MOCK_USERS];
}

export async function updateUserRole(userId: string, role: string): Promise<void> {
  // TODO: Replace with FastAPI call → PATCH /api/v1/users/{userId}
  const user = MOCK_USERS.find((u) => u.id === userId);
  if (user) user.role = role as Profile["role"];
}

export async function updateUserStatus(userId: string, isActive: boolean): Promise<void> {
  // TODO: Replace with FastAPI call → PATCH /api/v1/users/{userId}
  const user = MOCK_USERS.find((u) => u.id === userId);
  if (user) user.is_active = isActive;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function fetchAllProjects(): Promise<Project[]> {
  // TODO: Replace with FastAPI call → GET /api/v1/projects
  return [...MOCK_PROJECTS];
}

export async function createProject(data: Omit<Project, "id" | "created_at" | "updated_at">): Promise<Project> {
  // TODO: Replace with FastAPI call → POST /api/v1/projects
  const now = new Date().toISOString();
  const newProject: Project = { ...data, id: `p${Date.now()}`, created_at: now, updated_at: now };
  MOCK_PROJECTS.unshift(newProject);
  return newProject;
}

export async function updateProject(id: string, data: Partial<Project>): Promise<void> {
  // TODO: Replace with FastAPI call → PATCH /api/v1/projects/{id}
  const idx = MOCK_PROJECTS.findIndex((p) => p.id === id);
  if (idx !== -1) MOCK_PROJECTS[idx] = { ...MOCK_PROJECTS[idx], ...data, updated_at: new Date().toISOString() };
}

export async function deleteProject(id: string): Promise<void> {
  // TODO: Replace with FastAPI call → DELETE /api/v1/projects/{id}
  const idx = MOCK_PROJECTS.findIndex((p) => p.id === id);
  if (idx !== -1) MOCK_PROJECTS.splice(idx, 1);
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function fetchAllTasks(): Promise<Task[]> {
  // TODO: Replace with FastAPI call → GET /api/v1/tasks
  return [...MOCK_TASKS];
}

export async function createTask(data: Omit<Task, "id" | "created_at" | "updated_at">): Promise<Task> {
  // TODO: Replace with FastAPI call → POST /api/v1/tasks
  const now = new Date().toISOString();
  const newTask: Task = { ...data, id: `t${Date.now()}`, created_at: now, updated_at: now };
  MOCK_TASKS.unshift(newTask);
  return newTask;
}

export async function updateTask(id: string, data: Partial<Task>): Promise<void> {
  // TODO: Replace with FastAPI call → PATCH /api/v1/tasks/{id}
  const idx = MOCK_TASKS.findIndex((t) => t.id === id);
  if (idx !== -1) MOCK_TASKS[idx] = { ...MOCK_TASKS[idx], ...data, updated_at: new Date().toISOString() };
}

export async function deleteTask(id: string): Promise<void> {
  // TODO: Replace with FastAPI call → DELETE /api/v1/tasks/{id}
  const idx = MOCK_TASKS.findIndex((t) => t.id === id);
  if (idx !== -1) MOCK_TASKS.splice(idx, 1);
}

// ---------------------------------------------------------------------------
// Workflow risks
// ---------------------------------------------------------------------------

export async function fetchAllRisks(): Promise<WorkflowRisk[]> {
  // TODO: Replace with FastAPI call → GET /api/v1/workflow-risks
  return [...MOCK_RISKS];
}

export async function updateRiskStatus(id: string, status: WorkflowRisk["status"]): Promise<void> {
  // TODO: Replace with FastAPI call → PATCH /api/v1/workflow-risks/{id}
  const risk = MOCK_RISKS.find((r) => r.id === id);
  if (risk) { risk.status = status; risk.updated_at = new Date().toISOString(); }
}

// ---------------------------------------------------------------------------
// Repositories
// ---------------------------------------------------------------------------

export async function fetchAllRepositories(): Promise<Repository[]> {
  // TODO: Replace with FastAPI call → GET /api/v1/repositories
  return [...MOCK_REPOSITORIES];
}

export async function createRepository(data: Omit<Repository, "id">): Promise<Repository> {
  // TODO: Replace with FastAPI call → POST /api/v1/repositories
  const newRepo: Repository = { ...data, id: `repo${Date.now()}` };
  MOCK_REPOSITORIES.unshift(newRepo);
  return newRepo;
}

export async function updateRepository(id: string, data: Partial<Repository>): Promise<void> {
  // TODO: Replace with FastAPI call → PATCH /api/v1/repositories/{id}
  const idx = MOCK_REPOSITORIES.findIndex((r) => r.id === id);
  if (idx !== -1) MOCK_REPOSITORIES[idx] = { ...MOCK_REPOSITORIES[idx], ...data };
}

export async function deleteRepository(id: string): Promise<void> {
  // TODO: Replace with FastAPI call → DELETE /api/v1/repositories/{id}
  const idx = MOCK_REPOSITORIES.findIndex((r) => r.id === id);
  if (idx !== -1) MOCK_REPOSITORIES.splice(idx, 1);
}
