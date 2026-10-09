import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PMTeamTasksPage from "../PMTeamTasksPage";
import { 
  fetchProjectTasks, 
  fetchAllManagedTasks, 
  fetchPMDashboardStats, 
  fetchAssignableUsers,
  fetchTaskRecommendations,
  updateManagedTask,
  createManagedTask
} from "../../../services/pmService";

vi.mock("../../../services/pmService", () => ({
  fetchProjectTasks: vi.fn(),
  fetchAllManagedTasks: vi.fn(),
  fetchPMDashboardStats: vi.fn(),
  fetchAssignableUsers: vi.fn(),
  fetchTaskRecommendations: vi.fn(),
  updateManagedTask: vi.fn(),
  createManagedTask: vi.fn(),
  deleteManagedTask: vi.fn(),
}));

describe("PMTeamTasksPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetchAllManagedTasks as any).mockResolvedValue([
      {
        id: "task-1",
        title: "Test Task",
        status: "TODO",
        priority: "HIGH",
        due_date: "2026-12-01",
        required_skills: ["React"],
        min_experience_years: 2,
      }
    ]);
    (fetchPMDashboardStats as any).mockResolvedValue({
      projects: [{ id: "proj-1", name: "Project 1" }]
    });
    (fetchAssignableUsers as any).mockResolvedValue([
      { id: "dev-1", name: "Dev One", role: "DEVELOPER" }
    ]);
    // Stub mutations so they don't throw
    (createManagedTask as any).mockResolvedValue({ id: "task-new", title: "New AI Task", status: "TODO", priority: "MEDIUM" });
    (updateManagedTask as any).mockResolvedValue({ id: "task-1", title: "Test Task", status: "TODO", priority: "HIGH" });
  });

  it("renders tasks and handles task creation with skills", async () => {
    render(
      <MemoryRouter>
        <PMTeamTasksPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Test Task")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Create Task"));

    // Wait for modal to open
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Task title")).toBeInTheDocument();
    });

    const titleInput = screen.getByPlaceholderText("Task title");
    fireEvent.change(titleInput, { target: { value: "New AI Task" } });

    // Skills input uses placeholder "React, Node.js"
    const skillsInput = screen.getByPlaceholderText("React, Node.js");
    fireEvent.change(skillsInput, { target: { value: "Python, ML" } });

    // Min experience input has no placeholder — query by display value (initial is 0)
    const expInputs = screen.getAllByDisplayValue("0");
    const expInput = expInputs[expInputs.length - 1]; // last one is min_experience_years
    fireEvent.change(expInput, { target: { value: "3" } });

    // Submit — we can just submit the form that contains the title input
    fireEvent.submit(titleInput.closest('form')!);

    await waitFor(() => {
      expect(createManagedTask).toHaveBeenCalledWith(expect.objectContaining({
        title: "New AI Task",
        required_skills: ["Python", "ML"],
        min_experience_years: 3,
      }));
    });
  });

  it("displays recommendations and handles assignment", async () => {
    (fetchTaskRecommendations as any).mockResolvedValue([
      {
        developer_id: "dev-2",
        developer_name: "AI Expert",
        match_score: 0.95,
        matched_skills: ["Python", "ML"],
        missing_skills: [],
        experience_relevance: "Highly relevant",
        workload_warning: null,
        explanation: "Perfect match based on skills.",
        score_breakdown: {},
      }
    ]);

    render(
      <MemoryRouter>
        <PMTeamTasksPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Test Task")).toBeInTheDocument();
    });

    // Click the AI Recommendation button (we added it as title="AI Developer Recommendation")
    fireEvent.click(screen.getByTitle("AI Developer Recommendation"));

    await waitFor(() => {
      expect(screen.getByText("AI Recommendations")).toBeInTheDocument();
      expect(screen.getByText("AI Expert")).toBeInTheDocument();
      expect(screen.getByText("95%")).toBeInTheDocument();
    });

    // Mock confirm dialog
    vi.spyOn(window, "confirm").mockReturnValue(true);

    fireEvent.click(screen.getByText(/Confirm Assignment/i));

    await waitFor(() => {
      expect(updateManagedTask).toHaveBeenCalledWith("task-1", { assigned_to: "dev-2" });
    });
  });

  it("handles empty recommendations gracefully", async () => {
    (fetchTaskRecommendations as any).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <PMTeamTasksPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Test Task")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle("AI Developer Recommendation"));

    await waitFor(() => {
      expect(screen.getByText("No recommendations available")).toBeInTheDocument();
    });
  });
});
