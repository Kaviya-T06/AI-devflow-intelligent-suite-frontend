import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";

import NotificationsPage from "../NotificationsPage";
import * as notificationService from "../../../services/notificationService";
import * as AuthContextModule from "../../../context/AuthContext";
import type { Notification } from "../../../types";

const mockNotifications: Notification[] = [
  {
    id: "notif-1",
    recipient_id: "user-1",
    type: "TASK_ASSIGNED",
    title: "New Task Assigned",
    message: "You have been assigned to implement auth system.",
    project_id: "proj-1",
    task_id: "task-1",
    is_read: false,
    read_at: null,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "notif-2",
    recipient_id: "user-1",
    type: "RISK_ALERT",
    title: "Critical Workflow Risk",
    message: "High risk of delay detected on backend API.",
    project_id: "proj-1",
    task_id: null,
    is_read: true,
    read_at: new Date(Date.now() - 1800000).toISOString(),
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
];

describe("NotificationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: { id: "user-1", email: "alex@example.com" } as any,
      profile: { id: "user-1", full_name: "Alex Dev", role: "DEVELOPER" } as any,
      token: "fake-jwt",
      isLoading: false,
      isAuthenticated: true,
      signOut: vi.fn(),
      refreshAuth: vi.fn(),
      refreshProfile: vi.fn(),
    });

    vi.spyOn(notificationService, "fetchNotifications").mockResolvedValue({
      items: [...mockNotifications],
      unread_count: 1,
      total: 2,
    });
    vi.spyOn(notificationService, "markAsRead").mockImplementation(async (id) => ({
      ...mockNotifications.find((n) => n.id === id)!,
      is_read: true,
      read_at: new Date().toISOString(),
    }));
    vi.spyOn(notificationService, "markAllAsRead").mockResolvedValue(0);
    vi.spyOn(notificationService, "deleteNotification").mockResolvedValue(undefined);
    vi.spyOn(notificationService, "triggerOverdueCheck").mockResolvedValue(undefined);
  });

  it("renders notifications page with All, Unread, and Read filter tabs", async () => {
    render(
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("All (2)")).toBeInTheDocument();
    expect(screen.getByText("Unread (1)")).toBeInTheDocument();
    expect(screen.getByText("Read (1)")).toBeInTheDocument();
    expect(screen.getByText("New Task Assigned")).toBeInTheDocument();
    expect(screen.getByText("Critical Workflow Risk")).toBeInTheDocument();
  });

  it("filters unread notifications when Unread tab is clicked", async () => {
    render(
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("New Task Assigned")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Unread (1)"));
    expect(screen.getByText("New Task Assigned")).toBeInTheDocument();
    expect(screen.queryByText("Critical Workflow Risk")).not.toBeInTheDocument();
  });

  it("filters read notifications when Read tab is clicked", async () => {
    render(
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Critical Workflow Risk")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Read (1)"));
    expect(screen.getByText("Critical Workflow Risk")).toBeInTheDocument();
    expect(screen.queryByText("New Task Assigned")).not.toBeInTheDocument();
  });

  it("marking notification as read updates status and keeps it in notification history", async () => {
    render(
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("New Task Assigned")).toBeInTheDocument();

    const markReadBtn = screen.getByTitle("Mark as read");
    fireEvent.click(markReadBtn);

    await waitFor(() => {
      expect(notificationService.markAsRead).toHaveBeenCalledWith("notif-1");
    });

    // Both notifications remain in the list
    expect(screen.getByText("New Task Assigned")).toBeInTheDocument();
    expect(screen.getByText("Critical Workflow Risk")).toBeInTheDocument();
  });

  it("marking all as read updates all items and keeps them in history", async () => {
    render(
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Mark all as read")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Mark all as read"));

    await waitFor(() => {
      expect(notificationService.markAllAsRead).toHaveBeenCalled();
    });

    // Both notifications still exist in history
    expect(screen.getByText("New Task Assigned")).toBeInTheDocument();
    expect(screen.getByText("Critical Workflow Risk")).toBeInTheDocument();
  });

  it("explicit deletion removes notification when delete button is clicked", async () => {
    render(
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("New Task Assigned")).toBeInTheDocument();

    const deleteBtns = screen.getAllByTitle("Delete notification");
    fireEvent.click(deleteBtns[0]);

    await waitFor(() => {
      expect(notificationService.deleteNotification).toHaveBeenCalledWith("notif-1");
    });

    expect(screen.queryByText("New Task Assigned")).not.toBeInTheDocument();
    expect(screen.getByText("Critical Workflow Risk")).toBeInTheDocument();
  });

  it("displays overdue task notification with actual project name, task title, developer, and days overdue", async () => {
    const overdueNotif: Notification = {
      id: "notif-overdue-1",
      recipient_id: "user-1",
      type: "TASK_OVERDUE",
      title: "Overdue Task — Employee Management Portal",
      project_name: "Employee Management Portal",
      task_title: "Implement RBAC Auth Module",
      assigned_to_name: "Alex Dev",
      due_date: "2026-10-20",
      days_overdue: 5,
      message: "Task: 'Implement RBAC Auth Module'. Assigned to Alex Dev. Due on 2026-10-20 (5 days overdue).",
      project_id: "proj-emp",
      task_id: "task-rbac",
      is_read: false,
      read_at: null,
      created_at: new Date().toISOString(),
    };

    vi.spyOn(notificationService, "fetchNotifications").mockResolvedValue({
      items: [overdueNotif],
      unread_count: 1,
      total: 1,
    });

    render(
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>
    );

    // 1. Notification title displays actual project name
    expect(await screen.findByText("Overdue Task — Employee Management Portal")).toBeInTheDocument();

    // 2. Task title is clearly displayed below it
    expect(screen.getByText("Implement RBAC Auth Module")).toBeInTheDocument();

    // 3. Assigned developer is displayed
    expect(screen.getByText("Alex Dev")).toBeInTheDocument();

    // 4. Due date and overdue days are displayed
    expect(screen.getByText(/5 days overdue/i)).toBeInTheDocument();

    // 5. "View Task →" action is preserved
    expect(screen.getByText("View Task →")).toBeInTheDocument();
  });

  it("displays 'Overdue Task — Project name unavailable' when project name is unavailable", async () => {
    const overdueUnavailable: Notification = {
      id: "notif-overdue-2",
      recipient_id: "user-1",
      type: "TASK_OVERDUE",
      title: "Overdue Task in Project",
      project_name: null,
      task_title: "Legacy Script Migration",
      assigned_to_name: null,
      due_date: "2026-10-10",
      days_overdue: 15,
      message: "Task: 'Legacy Script Migration'. Due on 2026-10-10 (15 days overdue).",
      project_id: null,
      task_id: "task-legacy",
      is_read: false,
      read_at: null,
      created_at: new Date().toISOString(),
    };

    vi.spyOn(notificationService, "fetchNotifications").mockResolvedValue({
      items: [overdueUnavailable],
      unread_count: 1,
      total: 1,
    });

    render(
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>
    );

    // Displays "Project name unavailable" rather than vague phrase "in project"
    expect(await screen.findByText("Overdue Task — Project name unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Overdue Task in Project")).not.toBeInTheDocument();
    expect(screen.getByText("Legacy Script Migration")).toBeInTheDocument();
  });
});
