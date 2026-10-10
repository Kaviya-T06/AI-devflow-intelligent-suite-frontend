/**
 * PMSmartAllocationPage regression tests.
 *
 * All tests use mocked pmService APIs — no real database or network calls are made.
 * Covers the task-sync bug, statusFilter, empty-state variations, recommendation
 * flow, PM-approval assignment, project switching, and error display.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PMSmartAllocationPage from "../PMSmartAllocationPage";
import {
  fetchAllManagedTasks,
  fetchProjectTasks,
  fetchPMDashboardStats,
  fetchAssignableUsers,
  fetchTaskRecommendations,
  updateManagedTask,
  createManagedTask,
} from "../../../services/pmService";

vi.mock("../../../services/pmService", () => ({
  fetchAllManagedTasks: vi.fn(),
  fetchProjectTasks: vi.fn(),
  fetchPMDashboardStats: vi.fn(),
  fetchAssignableUsers: vi.fn(),
  fetchTaskRecommendations: vi.fn(),
  updateManagedTask: vi.fn(),
  createManagedTask: vi.fn(),
  deleteManagedTask: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<ReturnType<typeof makeTask>> = {}) {
  return {
    id: "task-1",
    title: "Fix auth bug",
    description: "Critical login issue",
    status: "TODO" as const,
    priority: "HIGH" as const,
    project_id: "proj-1",
    project_name: "Project Alpha",
    assigned_to: null,          // unassigned — should appear in Smart Allocation
    developer_name: null,
    due_date: "2026-12-31",
    required_skills: ["React", "TypeScript"],
    min_experience_years: 2,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    assigned_at: null,
    started_at: null,
    review_started_at: null,
    completed_at: null,
    ...overrides,
  };
}

const STATS = {
  total_projects: 1,
  active_projects: 1,
  planning_projects: 0,
  on_hold_projects: 0,
  completed_projects: 0,
  total_tasks: 1,
  completed_tasks: 0,
  in_progress_tasks: 0,
  review_tasks: 0,
  todo_tasks: 1,
  overdue_tasks: 0,
  average_progress: 0,
  projects: [{ id: "proj-1", name: "Project Alpha" }],
  overdue_task_list: [],
};

const USERS = [
  { id: "dev-1", name: "Alice Dev", email: "alice@test.com", role: "DEVELOPER", is_active: true },
];

// ---------------------------------------------------------------------------
// 1. Task sync: task created in Team Tasks appears in Smart Allocation
// ---------------------------------------------------------------------------

describe("Task sync — tasks from Team Tasks appear in Smart Allocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetchPMDashboardStats as any).mockResolvedValue(STATS);
    (fetchAssignableUsers as any).mockResolvedValue(USERS);
    (fetchTaskRecommendations as any).mockResolvedValue([]);
    (updateManagedTask as any).mockResolvedValue({ ...makeTask(), assigned_to: "dev-1", developer_name: "Alice Dev" });
    (createManagedTask as any).mockResolvedValue(makeTask({ id: "task-new", title: "New Task" }));
  });

  it("shows a task that has no assignee (the sync bug scenario)", async () => {
    // Task has no assigned_to — simulates a task just created in Team Tasks
    (fetchAllManagedTasks as any).mockResolvedValue([makeTask()]);

    render(<MemoryRouter><PMSmartAllocationPage /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText("Fix auth bug")).toBeInTheDocument();
    });
  });

  it("excludes tasks that already have assigned_to set", async () => {
    const assigned = makeTask({ assigned_to: "dev-1", developer_name: "Alice Dev" });
    (fetchAllManagedTasks as any).mockResolvedValue([assigned]);

    render(<MemoryRouter><PMSmartAllocationPage /></MemoryRouter>);

    // Wait for load; the task should NOT appear (it is already assigned)
    await waitFor(() => {
      expect(screen.queryByText("Fix auth bug")).not.toBeInTheDocument();
      expect(screen.getByText("All tasks are already assigned")).toBeInTheDocument();
    });
  });

  it("shows tasks that have developer_name but no assigned_to (stale join data guard)", async () => {
    // Edge case: developer_name set by join but assigned_to is null —
    // should still appear because assigned_to is the authoritative field.
    const stale = makeTask({ developer_name: "Ghost Dev", assigned_to: null });
    (fetchAllManagedTasks as any).mockResolvedValue([stale]);

    render(<MemoryRouter><PMSmartAllocationPage /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText("Fix auth bug")).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Status filter tabs are rendered and applied
// ---------------------------------------------------------------------------

describe("Status filter tabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetchPMDashboardStats as any).mockResolvedValue(STATS);
    (fetchAssignableUsers as any).mockResolvedValue(USERS);
    (fetchTaskRecommendations as any).mockResolvedValue([]);
    (updateManagedTask as any).mockResolvedValue(makeTask());
    (createManagedTask as any).mockResolvedValue(makeTask());
  });

  it("renders All / Todo / In Progress / Review / Completed tabs", async () => {
    (fetchAllManagedTasks as any).mockResolvedValue([makeTask()]);

    render(<MemoryRouter><PMSmartAllocationPage /></MemoryRouter>);

    await waitFor(() => {
      // Use getAllByRole to avoid ambiguity with "All Projects" option text
      const buttons = screen.getAllByRole("button");
      const labels = buttons.map((b) => b.textContent ?? "");
      expect(labels.some((l) => /^All\s*\(/.test(l))).toBe(true);
      expect(labels.some((l) => /^Todo\s*\(/.test(l))).toBe(true);
      expect(labels.some((l) => /^In Progress\s*\(/.test(l))).toBe(true);
      expect(labels.some((l) => /^Review\s*\(/.test(l))).toBe(true);
      expect(labels.some((l) => /^Completed\s*\(/.test(l))).toBe(true);
    });
  });

  it("filters tasks by status when a tab is clicked", async () => {
    const todoTask = makeTask({ id: "t1", title: "Todo task",  status: "TODO" });
    const inProgressTask = makeTask({ id: "t2", title: "In-prog task", status: "IN_PROGRESS" });
    (fetchAllManagedTasks as any).mockResolvedValue([todoTask, inProgressTask]);

    render(<MemoryRouter><PMSmartAllocationPage /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText("Todo task")).toBeInTheDocument();
      expect(screen.getByText("In-prog task")).toBeInTheDocument();
    });

    // Click "In Progress" tab
    fireEvent.click(screen.getByText(/^In Progress/));

    await waitFor(() => {
      expect(screen.getByText("In-prog task")).toBeInTheDocument();
      expect(screen.queryByText("Todo task")).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Empty state variants
// ---------------------------------------------------------------------------

describe("Empty state messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetchPMDashboardStats as any).mockResolvedValue(STATS);
    (fetchAssignableUsers as any).mockResolvedValue(USERS);
    (fetchTaskRecommendations as any).mockResolvedValue([]);
    (updateManagedTask as any).mockResolvedValue(makeTask());
    (createManagedTask as any).mockResolvedValue(makeTask());
  });

  it("shows 'No tasks yet' when API returns empty array", async () => {
    (fetchAllManagedTasks as any).mockResolvedValue([]);

    render(<MemoryRouter><PMSmartAllocationPage /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText("No tasks yet")).toBeInTheDocument();
    });
  });

  it("shows 'All tasks are already assigned' when every task has assigned_to", async () => {
    (fetchAllManagedTasks as any).mockResolvedValue([
      makeTask({ assigned_to: "dev-1", developer_name: "Alice Dev" }),
    ]);

    render(<MemoryRouter><PMSmartAllocationPage /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText("All tasks are already assigned")).toBeInTheDocument();
    });
  });

  it("shows filter-mismatch message with Clear filters button when status tab narrows to zero", async () => {
    const task = makeTask({ status: "TODO" });
    (fetchAllManagedTasks as any).mockResolvedValue([task]);

    render(<MemoryRouter><PMSmartAllocationPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText("Fix auth bug")).toBeInTheDocument());

    // Click "Review" tab — no tasks in review
    fireEvent.click(screen.getByText(/^Review/));

    await waitFor(() => {
      expect(screen.getByText("No tasks match the current filters")).toBeInTheDocument();
      expect(screen.getByText("Clear filters")).toBeInTheDocument();
    });

    // Clear filters should restore task
    fireEvent.click(screen.getByText("Clear filters"));

    await waitFor(() => {
      expect(screen.getByText("Fix auth bug")).toBeInTheDocument();
    });
  });

  it("shows API error message when fetch fails", async () => {
    (fetchAllManagedTasks as any).mockRejectedValue(new Error("Network error"));

    render(<MemoryRouter><PMSmartAllocationPage /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText("Failed to load tasks")).toBeInTheDocument();
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// 4. Recommendations + PM approval assignment
// ---------------------------------------------------------------------------

describe("Recommendations and PM approval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetchAllManagedTasks as any).mockResolvedValue([makeTask()]);
    (fetchPMDashboardStats as any).mockResolvedValue(STATS);
    (fetchAssignableUsers as any).mockResolvedValue(USERS);
    (updateManagedTask as any).mockResolvedValue(
      makeTask({ assigned_to: "dev-1", developer_name: "Alice Dev" })
    );
  });

  it("fetches and displays recommendations when Smart Allocate is clicked", async () => {
    (fetchTaskRecommendations as any).mockResolvedValue([
      {
        developer_id: "dev-1",
        developer_name: "Alice Dev",
        match_score: 0.88,
        score_breakdown: {},
        matched_skills: ["React", "TypeScript"],
        missing_skills: [],
        experience_relevance: "3 years of experience",
        workload_warning: null,
        explanation: "Strong skills match.",
      },
    ]);

    render(<MemoryRouter><PMSmartAllocationPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText("Fix auth bug")).toBeInTheDocument());

    fireEvent.click(screen.getByTitle("AI Developer Recommendation"));

    await waitFor(() => {
      expect(screen.getByText("AI Recommendations")).toBeInTheDocument();
      expect(screen.getByText("Alice Dev")).toBeInTheDocument();
      expect(screen.getByText("88%")).toBeInTheDocument();
      // Explanation is wrapped in literal " " in the JSX; match via regex
      expect(screen.getByText(/Strong skills match/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it("requires PM explicit confirm-dialog approval before calling updateManagedTask", async () => {
    (fetchTaskRecommendations as any).mockResolvedValue([
      {
        developer_id: "dev-1",
        developer_name: "Alice Dev",
        match_score: 0.9,
        score_breakdown: {},
        matched_skills: ["React"],
        missing_skills: [],
        experience_relevance: "2 years",
        workload_warning: null,
        explanation: "Good match.",
      },
    ]);

    render(<MemoryRouter><PMSmartAllocationPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText("Fix auth bug")).toBeInTheDocument());
    fireEvent.click(screen.getByTitle("AI Developer Recommendation"));

    await waitFor(() => expect(screen.getByText("Confirm Assignment")).toBeInTheDocument());

    // Cancel the confirm — assignment must NOT be called
    vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByText("Confirm Assignment"));

    await waitFor(() => {
      expect(updateManagedTask).not.toHaveBeenCalled();
    });

    // Now approve — assignment MUST be called
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByText("Confirm Assignment"));

    await waitFor(() => {
      expect(updateManagedTask).toHaveBeenCalledWith("task-1", { assigned_to: "dev-1" });
    });
  });

  it("removes assigned task from list after successful assignment and refresh", async () => {
    let callCount = 0;
    (fetchAllManagedTasks as any).mockImplementation(async () => {
      callCount++;
      // First call: unassigned task; subsequent calls: task now assigned
      return callCount === 1
        ? [makeTask()]
        : [makeTask({ assigned_to: "dev-1", developer_name: "Alice Dev" })];
    });
    (fetchTaskRecommendations as any).mockResolvedValue([
      {
        developer_id: "dev-1",
        developer_name: "Alice Dev",
        match_score: 0.9,
        score_breakdown: {},
        matched_skills: ["React"],
        missing_skills: [],
        experience_relevance: "2 years",
        workload_warning: null,
        explanation: "Good match.",
      },
    ]);

    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<MemoryRouter><PMSmartAllocationPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText("Fix auth bug")).toBeInTheDocument());
    fireEvent.click(screen.getByTitle("AI Developer Recommendation"));
    await waitFor(() => expect(screen.getByText("Confirm Assignment")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Confirm Assignment"));

    // After assignment the modal closes and loadData is called again.
    // The task is now assigned, so it should disappear from the allocation list.
    await waitFor(() => {
      expect(screen.queryByText("Fix auth bug")).not.toBeInTheDocument();
      expect(screen.getByText("All tasks are already assigned")).toBeInTheDocument();
    });
  });

  it("shows 'No recommendations available' for empty response", async () => {
    (fetchTaskRecommendations as any).mockResolvedValue([]);

    render(<MemoryRouter><PMSmartAllocationPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText("Fix auth bug")).toBeInTheDocument());
    fireEvent.click(screen.getByTitle("AI Developer Recommendation"));

    await waitFor(() => {
      expect(screen.getByText("No recommendations available")).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// 5. Project switching does not show stale tasks
// ---------------------------------------------------------------------------

describe("Project switching", () => {
  it("fetches project-scoped tasks when a project is selected", async () => {
    (fetchPMDashboardStats as any).mockResolvedValue({
      ...STATS,
      projects: [
        { id: "proj-1", name: "Project Alpha" },
        { id: "proj-2", name: "Project Beta" },
      ],
    });
    (fetchAssignableUsers as any).mockResolvedValue(USERS);
    (fetchTaskRecommendations as any).mockResolvedValue([]);
    (fetchAllManagedTasks as any).mockResolvedValue([
      makeTask({ id: "t-alpha", title: "Alpha Task", project_id: "proj-1" }),
      makeTask({ id: "t-beta",  title: "Beta Task",  project_id: "proj-2" }),
    ]);
    (fetchProjectTasks as any).mockResolvedValue([
      makeTask({ id: "t-beta", title: "Beta Task", project_id: "proj-2", project_name: "Project Beta" }),
    ]);
    (updateManagedTask as any).mockResolvedValue(makeTask());
    (createManagedTask as any).mockResolvedValue(makeTask());

    render(<MemoryRouter><PMSmartAllocationPage /></MemoryRouter>);

    // Both tasks visible initially
    await waitFor(() => {
      expect(screen.getByText("Alpha Task")).toBeInTheDocument();
      expect(screen.getByText("Beta Task")).toBeInTheDocument();
    });

    // Switch project dropdown to Project Beta
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "proj-2" } });

    await waitFor(() => {
      expect(fetchProjectTasks).toHaveBeenCalledWith("proj-2");
      expect(screen.getByText("Beta Task")).toBeInTheDocument();
      expect(screen.queryByText("Alpha Task")).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// 6. Required Skills column renders correctly
// ---------------------------------------------------------------------------

describe("Required skills column", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetchPMDashboardStats as any).mockResolvedValue(STATS);
    (fetchAssignableUsers as any).mockResolvedValue(USERS);
    (fetchTaskRecommendations as any).mockResolvedValue([]);
    (updateManagedTask as any).mockResolvedValue(makeTask());
    (createManagedTask as any).mockResolvedValue(makeTask());
  });

  it("shows skill pills for tasks with required_skills", async () => {
    (fetchAllManagedTasks as any).mockResolvedValue([
      makeTask({ required_skills: ["React", "TypeScript"] }),
    ]);

    render(<MemoryRouter><PMSmartAllocationPage /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText("React")).toBeInTheDocument();
      expect(screen.getByText("TypeScript")).toBeInTheDocument();
    });
  });

  it("shows 'Any (add via Edit)' for tasks with no required_skills", async () => {
    (fetchAllManagedTasks as any).mockResolvedValue([
      makeTask({ required_skills: [] }),
    ]);

    render(<MemoryRouter><PMSmartAllocationPage /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText("Any (add via Edit)")).toBeInTheDocument();
    });
  });
});
