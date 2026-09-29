/**
 * TypeScript types for AI DevFlow Intelligence Suite.
 * Central type definitions shared across the entire frontend.
 */

// ---------------------------------------------------------------------------
// User / Auth
// ---------------------------------------------------------------------------

export type UserRole = "ADMIN" | "MANAGER" | "DEVELOPER" | "TEAM_MEMBER";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  avatar_url?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Auth context
// ---------------------------------------------------------------------------

export interface AuthState {
  user: import("@supabase/supabase-js").User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

export interface HealthResponse {
  status: string;
  environment: string;
  version: string;
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  available: boolean; // false = shows "coming in next milestone"
  roles?: UserRole[]; // if set, only these roles see this item
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export type ProjectStatus = "Active" | "Planning" | "Completed" | "On Hold";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  project_manager_id: string | null;
  progress: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  project_manager?: Profile | null;
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export type TaskStatus = "To Do" | "In Progress" | "Completed" | "Blocked";
export type TaskPriority = "Low" | "Medium" | "High" | "Critical";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  project_id: string | null;
  assigned_to: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  project?: Pick<Project, "id" | "name"> | null;
  assignee?: Pick<Profile, "id" | "full_name" | "email"> | null;
}

// ---------------------------------------------------------------------------
// Activity Logs
// ---------------------------------------------------------------------------

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string;
  created_at: string;
  // Joined
  user?: Pick<Profile, "id" | "full_name" | "email"> | null;
}

// ---------------------------------------------------------------------------
// Workflow Risks
// ---------------------------------------------------------------------------

export type RiskSeverity = "Low" | "Medium" | "High" | "Critical";
export type RiskStatus = "Open" | "Monitoring" | "Resolved";

export interface WorkflowRisk {
  id: string;
  project_id: string | null;
  task_id: string | null;
  risk_type: string;
  severity: RiskSeverity;
  description: string;
  status: RiskStatus;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Repositories
// ---------------------------------------------------------------------------

export type RepoProvider = "GitHub" | "GitLab" | "Bitbucket";

export interface Repository {
  id: string;
  project_id: string | null;
  repository_name: string;
  repository_url: string;
  provider: RepoProvider;
  status: string;
  connected_at: string;
}
