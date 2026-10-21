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

export interface NextDeveloperPlanItem {
  priority: "Critical" | "High" | "Medium" | "Low" | string;
  action: string;
  why: string;
  artifact: string;
  prerequisites: string;
  next_step: string;
}

export interface AttentionRequiredItem {
  category: "CONFIRMED_ISSUE" | "POTENTIAL_CONCERN" | "UNCHECKED_AREA" | string;
  title: string;
  severity: "Critical" | "High" | "Medium" | "Low" | string;
  detail: string;
  evidence: string;
}

export interface ChecklistItem {
  step: number;
  title: string;
  description: string;
  status: "completed" | "attention" | "ready" | string;
}

export interface DataCoverageSource {
  name: string;
  verified: boolean;
  detail: string;
}

export interface DataCoverageAudit {
  verified_count: number;
  total_sources: number;
  score_percent: number;
  sources: DataCoverageSource[];
  confidence_level: "High" | "Moderate" | "Low" | string;
  missing_summary: string;
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
      branches?: any[];
      branches_error?: string | null;
    };
    verified_mappings: string[];
    unmapped_commits: any[];
    unmapped_prs: any[];
  };
  is_preliminary_inference?: boolean;
  inference_rationale?: string;
  next_developer_plan?: NextDeveloperPlanItem[];
  attention_required?: AttentionRequiredItem[];
  checklist?: ChecklistItem[];
  data_coverage?: DataCoverageAudit;
}

export interface ProjectContextUpdatePayload {
  description?: string;
  tech_stack?: string;
  repository_url?: string;
  handover_notes?: string;
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
  messages?: ChatMessage[],
  signal?: AbortSignal
): Promise<{ answer: string }> {
  const path = projectId && projectId !== "general"
    ? `/api/v1/projects/${projectId}/continuity/ask`
    : `/api/v1/continuity/ask`;
  return request<{ answer: string }>(
    path,
    {
      method: "POST",
      body: JSON.stringify({ question, messages }),
      signal,
    },
    token
  );
}

export async function streamContinuityQuestion(
  projectId: string,
  question: string,
  token: string,
  messages?: ChatMessage[],
  onChunk?: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const path = projectId && projectId !== "general"
    ? `/api/v1/projects/${projectId}/continuity/stream`
    : `/api/v1/continuity/stream`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ question, messages }),
      signal,
    });

    if (!response.ok) {
      const fallback = await askContinuityQuestion(projectId, question, token, messages, signal);
      if (onChunk) onChunk(fallback.answer);
      return fallback.answer;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      const fallback = await askContinuityQuestion(projectId, question, token, messages, signal);
      if (onChunk) onChunk(fallback.answer);
      return fallback.answer;
    }

    const decoder = new TextDecoder("utf-8");
    let accumulated = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;

        const jsonStr = trimmed.slice(5).trim();
        if (!jsonStr) continue;

        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.done) break;
          if (parsed.chunk) {
            accumulated += parsed.chunk;
            if (onChunk) onChunk(accumulated);
          }
        } catch {
          // ignore partial parse errors
        }
      }
    }

    if (!accumulated.trim()) {
      const fallback = await askContinuityQuestion(projectId, question, token, messages, signal);
      if (onChunk) onChunk(fallback.answer);
      return fallback.answer;
    }

    return accumulated;
  } catch (err: any) {
    if (err.name === "AbortError" || signal?.aborted) {
      throw err;
    }
    // Graceful fallback to askContinuityQuestion on network/stream errors
    const fallback = await askContinuityQuestion(projectId, question, token, messages, signal);
    if (onChunk) onChunk(fallback.answer);
    return fallback.answer;
  }
}
export interface AIStatusResponse {
  provider: string;
  model: string;
  status: "ready" | "unavailable";
  health?: {
    available?: boolean;
    model_installed?: boolean;
    installed_models?: string[];
    error?: string;
  };
}

export async function getContinuityAiStatus(projectId: string, token: string): Promise<AIStatusResponse> {
  const path = projectId && projectId !== "general"
    ? `/api/v1/projects/${projectId}/continuity/status`
    : `/api/v1/continuity/status`;
  return request<AIStatusResponse>(
    path,
    {
      method: "GET",
    },
    token
  );
}

export async function getContinuityDataBriefing(projectId: string, token: string): Promise<ContinuitySummary> {
  return request<ContinuitySummary>(
    `/api/v1/projects/${projectId}/continuity/briefing`,
    {
      method: "GET",
    },
    token
  );
}

export async function updateContinuityProjectContext(
  projectId: string,
  data: ProjectContextUpdatePayload,
  token: string
): Promise<ContinuitySummary> {
  return request<ContinuitySummary>(
    `/api/v1/projects/${projectId}/continuity/context`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
    token
  );
}
