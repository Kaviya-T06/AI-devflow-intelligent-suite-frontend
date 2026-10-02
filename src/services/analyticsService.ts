import { getCurrentSession } from "./authService";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export interface ProjectMetrics {
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  in_progress_tasks: number;
  review_tasks: number;
  overdue_tasks: number;
  completion_percentage: number;
  average_task_completion_time_hours: number;
  average_task_cycle_time_hours: number;
}

export interface TaskPerformanceMetrics {
  total_tasks_created: number;
  total_completed: number;
  total_overdue: number;
  completion_rate: number;
  average_completion_time_hours: number;
  average_time_in_progress_hours: number;
  average_review_duration_hours: number;
}

export interface DeveloperMetrics {
  developer_id: string;
  developer_name: string;
  tasks_assigned: number;
  tasks_completed: number;
  tasks_in_progress: number;
  tasks_waiting_for_review: number;
  overdue_tasks: number;
  completion_rate: number;
}

export interface TeamWorkflowMetrics {
  developers: DeveloperMetrics[];
}

export interface ProjectHealth {
  project_progress: number;
  completion_rate: number;
  overdue_task_count: number;
  tasks_waiting_for_review: number;
  active_tasks: number;
  remaining_tasks: number;
}

export interface TrendDataPoint {
  date: string;
  value: number;
}

export interface WorkflowTrends {
  tasks_completed_over_time: TrendDataPoint[];
  tasks_created_over_time: TrendDataPoint[];
  overdue_tasks_over_time: TrendDataPoint[];
  project_progress_over_time: TrendDataPoint[];
  average_completion_time_over_time: TrendDataPoint[];
}

export interface AnalyticsDashboardData {
  project_metrics: ProjectMetrics;
  task_performance_metrics: TaskPerformanceMetrics;
  team_workflow_metrics?: TeamWorkflowMetrics;
  project_health: ProjectHealth;
  workflow_trends: WorkflowTrends;
}

export async function fetchAnalyticsData(projectId?: string): Promise<AnalyticsDashboardData> {
  const session = getCurrentSession();
  if (!session) throw new Error("No active session");

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.token}`,
  };

  const url = new URL(`${API_BASE_URL}/api/v1/analytics`);
  if (projectId) {
    url.searchParams.append("project_id", projectId);
  }

  const response = await fetch(url.toString(), { headers });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(errorBody.detail || `HTTP ${response.status}`);
  }

  return response.json() as Promise<AnalyticsDashboardData>;
}
