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
  skills?: { name: string; level: string }[];
  experience_years?: number;
  capacity_hours_per_week?: number;
  preferred_role?: string | null;
  relevant_experience?: { title: string; company: string; years: number }[];
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

export type ProjectStatus =
  | "planning"
  | "active"
  | "on_hold"
  | "completed"
  | "archived";

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
  member_count?: number;
  task_count?: number;
  completed_task_count?: number;
  // Joined
  project_manager?: Profile | null;
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export type TaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "COMPLETED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

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
  assigned_at: string | null;
  started_at: string | null;
  review_started_at: string | null;
  completed_at: string | null;
  updated_at: string;
  required_skills?: string[];
  min_experience_years?: number;
  // Joined fields from backend flat response
  project_name?: string | null;
  developer_name?: string | null;
  
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
  project_id?: string | null;
  description: string;
  metadata?: Record<string, any> | null;
  created_at: string;
  // Joined
  user?: Pick<Profile, "id" | "full_name" | "email"> | null;
}

// ---------------------------------------------------------------------------
// Workflow Risks
// ---------------------------------------------------------------------------

export type RiskSeverity = "Low" | "Medium" | "High" | "Critical";
export type RiskStatus = "OPEN" | "RESOLVED";

export interface WorkflowRisk {
  id: string;
  risk_type: string;
  title: string;
  description: string;
  severity: RiskSeverity;
  project_id: string | null;
  project_name?: string | null;
  task_id: string | null;
  status: RiskStatus;
  is_resolved: boolean;
  detected_at: string;
  resolved_at?: string | null;
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

// ---------------------------------------------------------------------------
// Project Manager Dashboard
// ---------------------------------------------------------------------------

export interface DeveloperWorkload {
  developer_id: string;
  developer_name: string;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  review_tasks: number;
  todo_tasks: number;
  overdue_tasks: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  status: string;
  progress: number;
  start_date: string | null;
  end_date: string | null;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  review_tasks: number;
  todo_tasks: number;
  overdue_tasks: number;
  developers: DeveloperWorkload[];
}

export interface OverdueTaskSummary {
  task_id: string;
  task_title: string;
  project_id: string | null;
  project_name: string | null;
  assigned_to: string | null;
  developer_name: string | null;
  due_date: string;
  status: string;
  priority: string;
}

export interface PMDashboardStats {
  total_projects: number;
  active_projects: number;
  planning_projects: number;
  on_hold_projects: number;
  completed_projects: number;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  review_tasks: number;
  todo_tasks: number;
  overdue_tasks: number;
  average_progress: number;
  projects: ProjectSummary[];
  overdue_task_list: OverdueTaskSummary[];
}

export interface PMActivityItem {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string;
  created_at: string;
  user_name: string | null;
  user_id: string | null;
}

