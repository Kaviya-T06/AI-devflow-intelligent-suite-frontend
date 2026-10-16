/**
 * GitHub Service — API calls for GitHub Integration
 */
const API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const BASE = `${API}/api/v1/github`;

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
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export interface GitHubRepository {
  id: string;
  project_id: string;
  github_repository_id?: string;
  owner: string;
  repository_name: string;
  full_name: string;
  html_url: string;
  default_branch: string;
  connected_by?: string;
  created_at: string;
  updated_at: string;
  last_synced_at?: string;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  author: string;
  state: string;
  created_at: string;
  updated_at: string;
  url: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  author: string;
  state: string;
  created_at: string;
  url: string;
}

export interface LinkedDeveloperDetails {
  id: string;
  name: string;
  email?: string | null;
  task_id?: string | null;
  task_title?: string | null;
}

export interface GitHubBranch {
  name: string;
  last_commit_sha: string;
  last_commit_message?: string | null;
  last_commit_author?: string | null;
  last_commit_date?: string | null;
  associated_pull_request?: number | null;
  linked_developer?: LinkedDeveloperDetails | string | null;
  creator?: string | null;
}

export interface BranchAssignableDeveloper {
  id: string;
  name: string;
  email?: string | null;
  role?: string | null;
  tasks: { id: string; title: string; status: string }[];
}

export interface TaskGitHubContext {
  task_id: string;
  project_id: string;
  repository_name?: string | null;
  repository_url?: string | null;
  associated_branch?: string | null;
  associated_pull_request_number?: number | null;
  associated_pull_request_url?: string | null;
  available_branches: string[];
}

export async function getProjectRepository(
  projectId: string,
): Promise<GitHubRepository | null> {
  try {
    return await apiFetch<GitHubRepository>(
      `/projects/${projectId}/repository`,
    );
  } catch (e: any) {
    if (
      e.message.includes("404") ||
      e.message.includes("Not Found") ||
      e.message.includes("None")
    ) {
      return null;
    }
    throw e;
  }
}

export async function connectRepository(
  projectId: string,
  data: {
    repository_url: string;
  },
): Promise<GitHubRepository> {
  return apiFetch<GitHubRepository>(`/projects/${projectId}/repository`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function disconnectRepository(projectId: string): Promise<void> {
  return apiFetch<void>(`/projects/${projectId}/repository`, {
    method: "DELETE",
  });
}

export async function syncRepository(projectId: string): Promise<GitHubRepository> {
  return apiFetch<GitHubRepository>(`/projects/${projectId}/repository/sync`, {
    method: "POST",
  });
}

export async function getCommits(projectId: string): Promise<GitHubCommit[]> {
  return apiFetch<GitHubCommit[]>(`/projects/${projectId}/commits`);
}

export async function getPullRequests(
  projectId: string,
): Promise<GitHubPullRequest[]> {
  return apiFetch<GitHubPullRequest[]>(`/projects/${projectId}/pulls`);
}

export async function getIssues(projectId: string): Promise<GitHubIssue[]> {
  return apiFetch<GitHubIssue[]>(`/projects/${projectId}/issues`);
}

export async function getBranches(projectId: string): Promise<GitHubBranch[]> {
  return apiFetch<GitHubBranch[]>(`/projects/${projectId}/branches`);
}

export async function createProjectBranch(
  projectId: string,
  data: {
    branch_name: string;
    base_branch?: string;
    task_id?: string;
  },
): Promise<GitHubBranch> {
  return apiFetch<GitHubBranch>(`/projects/${projectId}/branches`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function associateTaskBranch(
  taskId: string,
  branchName: string,
): Promise<{ message: string; branch_name: string }> {
  return apiFetch<{ message: string; branch_name: string }>(`/tasks/${taskId}/branch`, {
    method: "POST",
    body: JSON.stringify({ branch_name: branchName }),
  });
}

export async function associateTaskPullRequest(
  taskId: string,
  data: {
    pull_request_number?: number;
    pull_request_url: string;
  },
): Promise<{ message: string; pull_request_number?: number; pull_request_url: string }> {
  return apiFetch<{ message: string; pull_request_number?: number; pull_request_url: string }>(
    `/tasks/${taskId}/pull-request`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}

export async function getTaskGitHubContext(
  taskId: string,
): Promise<TaskGitHubContext> {
  return apiFetch<TaskGitHubContext>(`/tasks/${taskId}/github-context`);
}

export async function fetchProjectAssignableDevelopers(
  projectId: string
): Promise<BranchAssignableDeveloper[]> {
  return apiFetch<BranchAssignableDeveloper[]>(
    `/projects/${projectId}/assignable-developers`
  );
}

export async function assignBranchDeveloper(
  projectId: string,
  branchName: string,
  data: { developer_id: string; task_id?: string | null }
): Promise<{ message: string; branch_name: string; developer_id: string; developer_name?: string }> {
  return apiFetch<{ message: string; branch_name: string; developer_id: string; developer_name?: string }>(
    `/projects/${projectId}/branches/${encodeURIComponent(branchName)}/assign`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

export async function unassignBranchDeveloper(
  projectId: string,
  branchName: string
): Promise<{ message: string; branch_name: string }> {
  return apiFetch<{ message: string; branch_name: string }>(
    `/projects/${projectId}/branches/${encodeURIComponent(branchName)}/assign`,
    {
      method: "DELETE",
    }
  );
}

