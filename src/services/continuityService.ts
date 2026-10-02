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
    throw new Error(errorBody.detail || `HTTP ${response.status}`);
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

export async function askContinuityQuestion(projectId: string, question: string, token: string): Promise<{ answer: string }> {
  return request<{ answer: string }>(
    `/api/v1/projects/${projectId}/continuity/ask`,
    {
      method: "POST",
      body: JSON.stringify({ question }),
    },
    token
  );
}
