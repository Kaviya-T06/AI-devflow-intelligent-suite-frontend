import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProjectDetailPage from "../ProjectDetailPage";
import * as pmService from "../../../services/pmService";
import * as githubService from "../../../services/githubService";
import { useAuth } from "../../../context/AuthContext";
import type { Task, ActivityLog, Project } from "../../../types";

// Mock AuthContext
vi.mock("../../../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

// Mock services
vi.mock("../../../services/pmService", () => ({
  fetchProjectTasks: vi.fn(),
  fetchProjectHistory: vi.fn(),
  simulateDeadlineChange: vi.fn(),
  fetchSimulatorData: vi.fn(),
  updateTaskEstimate: vi.fn(),
  updateDeveloperCapacity: vi.fn(),
}));

vi.mock("../../../services/githubService", () => ({
  getProjectRepository: vi.fn(),
  connectRepository: vi.fn(),
  disconnectRepository: vi.fn(),
  syncRepository: vi.fn(),
  createProjectBranch: vi.fn(),
  getCommits: vi.fn(),
  getPullRequests: vi.fn(),
  getIssues: vi.fn(),
  getBranches: vi.fn(),
  assignBranchDeveloper: vi.fn(),
  unassignBranchDeveloper: vi.fn(),
  fetchProjectAssignableDevelopers: vi.fn(),
}));

vi.mock("../../../services/adminService", () => ({
  deleteProject: vi.fn(),
}));

const mockDevProfile = {
  id: "dev-123",
  name: "Developer Alice",
  email: "alice@example.com",
  role: "DEVELOPER" as const,
};

const smartCampusId = "proj-smart-campus-999";
const hospitalCrmId = "proj-hospital-crm-888";

const mockSmartCampusProject: Project = {
  id: smartCampusId,
  name: "Smart Campus Resource Booking System",
  description: "Campus resource reservation app",
  status: "active",
  progress: 50,
  start_date: "2026-01-01",
  end_date: "2026-12-31",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const mockTasks: Task[] = [
  {
    id: "task-sc-1",
    title: "Smart Campus Room Booking API",
    project_id: smartCampusId,
    status: "COMPLETED",
    priority: "HIGH",
    developer_name: "Developer Alice",
    due_date: "2026-11-01",
    estimated_hours: 12,
  },
  {
    id: "task-sc-2",
    title: "Smart Campus QR Scanner UI",
    project_id: smartCampusId,
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    developer_name: "Developer Bob",
    due_date: "2026-11-15",
    estimated_hours: 8,
  },
  {
    id: "task-sc-3",
    title: "Smart Campus Audit Review",
    project_id: smartCampusId,
    status: "REVIEW",
    priority: "LOW",
    developer_name: "Developer Alice",
    due_date: "2026-11-20",
    estimated_hours: 4,
  },
  // Foreign task from another project that must NEVER appear
  {
    id: "task-hc-99",
    title: "Hospital CRM Patient Form",
    project_id: hospitalCrmId,
    status: "TODO",
    priority: "HIGH",
    developer_name: "Developer Alice",
    due_date: "2026-11-05",
    estimated_hours: 16,
  },
];

const mockHistory: ActivityLog[] = [
  {
    id: "act-sc-1",
    user_id: "dev-123",
    action: "TASK_COMPLETED",
    entity_type: "task",
    entity_id: "task-sc-1",
    project_id: smartCampusId,
    description: "Completed Smart Campus Room Booking API",
    created_at: "2026-10-25T10:00:00Z",
    user: { id: "dev-123", full_name: "Developer Alice", email: "alice@example.com" },
  },
  // Foreign activity that must be filtered out
  {
    id: "act-hc-99",
    user_id: "dev-123",
    action: "TASK_CREATED",
    entity_type: "task",
    entity_id: "task-hc-99",
    project_id: hospitalCrmId,
    description: "Created Hospital CRM Patient Form",
    created_at: "2026-10-24T10:00:00Z",
    user: { id: "dev-123", full_name: "Developer Alice", email: "alice@example.com" },
  },
];

function renderPage(projectId = smartCampusId) {
  // Mock global fetch for /projects/:id
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes(`/api/v1/projects/${smartCampusId}`)) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockSmartCampusProject),
      });
    }
    return Promise.reject(new Error("Not found"));
  });

  return render(
    <MemoryRouter initialEntries={[`/dashboard/projects/${projectId}`]}>
      <Routes>
        <Route path="/dashboard/projects/:projectId" element={<ProjectDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProjectDetailPage Project-Scoped Filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      profile: mockDevProfile,
      user: { id: mockDevProfile.id, email: mockDevProfile.email } as any,
      session: null,
      loading: false,
      signOut: vi.fn(),
    } as any);
    vi.mocked(pmService.fetchProjectTasks).mockResolvedValue(mockTasks);
    vi.mocked(pmService.fetchProjectHistory).mockResolvedValue(mockHistory);
    vi.mocked(githubService.getProjectRepository).mockResolvedValue(null);
  });

  it("fetches tasks and history using the selected project ID", async () => {
    renderPage(smartCampusId);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 2, name: /Smart Campus Resource Booking System/i })
      ).toBeInTheDocument();
    });

    expect(pmService.fetchProjectTasks).toHaveBeenCalledWith(smartCampusId);

    // Switch to History tab to trigger history loading
    const historyTabBtn = screen.getByRole("button", { name: /History/i });
    fireEvent.click(historyTabBtn);

    await waitFor(() => {
      expect(pmService.fetchProjectHistory).toHaveBeenCalledWith(smartCampusId);
    });
  });

  it("calculates Task Summary counts in OverviewTab exclusively from selected project tasks", async () => {
    renderPage(smartCampusId);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 2, name: /Smart Campus Resource Booking System/i })
      ).toBeInTheDocument();
    });

    // 3 Smart Campus tasks total (Completed: 1, In Prog: 1, Review: 1, Todo: 0)
    // The 4th task belongs to Hospital CRM and must be excluded!
    await waitFor(() => {
      expect(screen.getByText("Task Summary")).toBeInTheDocument();
    });

    // Total should be 3, not 4
    const totalCount = screen.getByText("Total").parentElement;
    expect(totalCount).toHaveTextContent("3");

    const completedCount = screen.getByText("Completed").parentElement;
    expect(completedCount).toHaveTextContent("1");

    const inProgCount = screen.getByText("In Prog").parentElement;
    expect(inProgCount).toHaveTextContent("1");

    const reviewCount = screen.getByText("Review").parentElement;
    expect(reviewCount).toHaveTextContent("1");

    const todoCount = screen.getByText("Todo").parentElement;
    expect(todoCount).toHaveTextContent("0");
  });

  it("displays only tasks belonging to the selected project in Tasks tab", async () => {
    renderPage(smartCampusId);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 2, name: /Smart Campus Resource Booking System/i })
      ).toBeInTheDocument();
    });

    // Switch to Tasks tab
    const tasksTabBtn = screen.getByRole("button", { name: /Tasks/i });
    fireEvent.click(tasksTabBtn);

    await waitFor(() => {
      expect(screen.getByText("Smart Campus Room Booking API")).toBeInTheDocument();
      expect(screen.getByText("Smart Campus QR Scanner UI")).toBeInTheDocument();
      expect(screen.getByText("Smart Campus Audit Review")).toBeInTheDocument();
    });

    // Foreign task must NOT be present
    expect(screen.queryByText("Hospital CRM Patient Form")).not.toBeInTheDocument();
  });

  it("displays only history events and workflow progress for the selected project in History tab", async () => {
    renderPage(smartCampusId);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 2, name: /Smart Campus Resource Booking System/i })
      ).toBeInTheDocument();
    });

    // Switch to History tab
    const historyTabBtn = screen.getByRole("button", { name: /History/i });
    fireEvent.click(historyTabBtn);

    await waitFor(() => {
      expect(screen.getByText(/Workflow Progress — Smart Campus Resource Booking System/i)).toBeInTheDocument();
    });

    // History event from Smart Campus should be visible
    expect(screen.getByText("Completed Smart Campus Room Booking API")).toBeInTheDocument();

    // History event from Hospital CRM must NOT be visible
    expect(screen.queryByText("Created Hospital CRM Patient Form")).not.toBeInTheDocument();
  });
});
