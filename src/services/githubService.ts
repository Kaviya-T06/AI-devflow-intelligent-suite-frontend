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

export interface GitHubBranch {
  name: string;
  last_commit_sha: string;
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
