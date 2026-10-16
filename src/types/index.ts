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
  available: boolean; // false = shows "coming soon"
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
  estimated_hours?: number | null;
  estimated_effort?: number | null;
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

export interface HealthScoreComponent {
  reason: string;
  amount: number;
}

export interface ProjectHealth {
  score: number;
  components: HealthScoreComponent[];
  data_completeness: string;
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
  health?: ProjectHealth;
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

// ---------------------------------------------------------------------------
// Project Pulse Phase 4 AI Recommendations
// ---------------------------------------------------------------------------

export interface SupportingReference {
  type: string;
  id: string;
  label: string;
}

export interface PulseRecommendation {
  id: string;
  category: string;
  title: string;
  explanation: string;
  why_it_matters: string;
  missing_info_or_assumptions: string;
  confidence: "High" | "Medium" | "Low";
  confidence_rationale: string;
  supporting_references: SupportingReference[];
  actionable_entity_id?: string | null;
  actionable_entity_type?: string | null;
}

export interface PulseRecommendationsResponse {
  project_id: string;
  project_name: string;
  health_score: number;
  health_data_completeness: string;
  recommendations: PulseRecommendation[];
  source: "gemini" | "deterministic";
  ai_status: "SUCCESS" | "FALLBACK" | "OFFLINE";
  ai_notice?: string | null;
  generated_at: string;
}

// ---------------------------------------------------------------------------
// Project Pulse Phase 5 AI Briefing
// ---------------------------------------------------------------------------

export interface HealthSection {
  score: number;
  status: string;
  data_completeness: string;
  factors: string[];
  explanation: string;
}

export interface CompletedWorkSection {
  tasks_count: number;
  task_titles: string[];
  summary: string;
}

export interface InProgressAndPendingSection {
  in_progress_count: number;
  todo_count: number;
  in_progress_tasks: string[];
  pending_tasks: string[];
  summary: string;
}

export interface OverdueOrBlockedSection {
  count: number;
  items: string[];
  summary: string;
}

export interface UnresolvedRisksSection {
  critical_count: number;
  high_count: number;
  items: string[];
  summary: string;
}

export interface RecentActivitySection {
  items: string[];
  summary: string;
}

export interface GitHubContextSection {
  is_configured: boolean;
  repository?: string | null;
  recent_commits_count: number;
  open_prs_count: number;
  branches_count: number;
  summary: string;
}

export interface RecommendedNextActionsSection {
  actions: string[];
  summary: string;
}

export interface DataGapsSection {
  gaps: string[];
  reliability_impact: string;
}

export interface PulseBriefingSections {
  health: HealthSection;
  completed_work: CompletedWorkSection;
  in_progress_and_pending: InProgressAndPendingSection;
  overdue_or_blocked: OverdueOrBlockedSection;
  unresolved_risks: UnresolvedRisksSection;
  recent_activity: RecentActivitySection;
  github_context: GitHubContextSection;
  recommended_next_actions: RecommendedNextActionsSection;
  data_gaps: DataGapsSection;
}

export interface PulseBriefingResponse {
  project_id: string;
  project_name: string;
  generated_at: string;
  data_freshness: string;
  health_score: number;
  health_data_completeness: string;
  sections: PulseBriefingSections;
  verified_facts: Record<string, any>;
  source: "gemini" | "deterministic";
  ai_status: "SUCCESS" | "FALLBACK" | "OFFLINE";
  ai_notice?: string | null;
}



// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export type NotificationType =
  | "PROJECT_ASSIGNED"
  | "TASK_ASSIGNED"
  | "TASK_STATUS_CHANGED"
  | "TASK_REVIEW_REQUESTED"
  | "TASK_COMPLETED"
  | "TASK_OVERDUE"
  | "RISK_ALERT"
  | "SMART_ALLOCATION"
  | "GITHUB_EVENT"
  | "PM_UPDATE";

export interface Notification {
  id: string;
  recipient_id: string;
  type: NotificationType;
  title: string;
  message: string;
  project_id: string | null;
  task_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  items: Notification[];
  unread_count: number;
  total: number;
}


