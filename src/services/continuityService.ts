const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: response.statusText }));
    const detail = errorBody.detail;
    if (detail && typeof detail === "object" && detail.message) {
      const error: any = new Error(detail.message);
      error.raw_context = detail.raw_context;
      throw error;
    }
    throw new Error(detail || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export interface ContinuitySummary {
  project_overview: string;
  previous_developer_work: string;
  current_work: string;
  pending_work: string;
  blocked_overdue_work: string;
  recent_github_activity: string;
  known_issues: string;
  important_context: string;
  what_next_developer_should_know: string;
  recommended_next_steps: string;
  raw_context?: {
    project: any;
    tasks: any[];
    risks: any[];
    github: {
      repository: string | null;
      commits: any[];
      pull_requests: any[];
      issues: any[];
    };
    verified_mappings: string[];
    unmapped_commits: any[];
    unmapped_prs: any[];
  };
}

export async function generateContinuitySummary(projectId: string, token: string): Promise<ContinuitySummary> {
  return request<ContinuitySummary>(
    `/api/v1/projects/${projectId}/continuity/generate`,
    {
      method: "POST",
    },
    token
  );
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function askContinuityQuestion(
  projectId: string, 
  question: string, 
  token: string,
  messages?: ChatMessage[]
): Promise<{ answer: string }> {
  return request<{ answer: string }>(
    `/api/v1/projects/${projectId}/continuity/ask`,
    {
      method: "POST",
      body: JSON.stringify({ question, messages }),
    },
    token
  );
}

