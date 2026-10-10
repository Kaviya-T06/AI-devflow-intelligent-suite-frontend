/**
 * Notification Service — interacts with backend notification API endpoints.
 */
import type { Notification, NotificationListResponse } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const authToken = token || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
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

  if (response.status === 204) {
    return null as unknown as T;
  }

  return response.json() as Promise<T>;
}

export async function fetchNotifications(token?: string, limit = 50, offset = 0): Promise<NotificationListResponse> {
  return request<NotificationListResponse>(`/api/v1/notifications?limit=${limit}&offset=${offset}`, {}, token);
}

export async function fetchUnreadCount(token?: string): Promise<number> {
  const res = await request<{ unread_count: number }>("/api/v1/notifications/unread-count", {}, token);
  return res.unread_count;
}

export async function markAsRead(notificationId: string, token?: string): Promise<Notification> {
  return request<Notification>(`/api/v1/notifications/${notificationId}/read`, { method: "PATCH" }, token);
}

export async function markAllAsRead(token?: string): Promise<number> {
  const res = await request<{ unread_count: number }>("/api/v1/notifications/read-all", { method: "PATCH" }, token);
  return res.unread_count;
}

export async function deleteNotification(notificationId: string, token?: string): Promise<void> {
  await request<void>(`/api/v1/notifications/${notificationId}`, { method: "DELETE" }, token);
}

export async function triggerOverdueCheck(token?: string): Promise<void> {
  await request<void>("/api/v1/notifications/check-overdue", { method: "POST" }, token);
}
