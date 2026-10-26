import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PMWhatIfSimulatorPage from "../PMWhatIfSimulatorPage";
import {
  fetchManagedProjects,
  fetchAssignableUsers,
  fetchSimulatorData,
  simulateDeadlineChange,
  updateTaskEstimate,
  updateDeveloperCapacity,
} from "../../../services/pmService";

vi.mock("../../../services/pmService", () => ({
  fetchManagedProjects: vi.fn(),
  fetchAssignableUsers: vi.fn(),
  fetchSimulatorData: vi.fn(),
  simulateDeadlineChange: vi.fn(),
  simulateDeveloperUnavailability: vi.fn(),
  updateTaskEstimate: vi.fn(),
  updateDeveloperCapacity: vi.fn(),
}));

const mockProjects = [
  {
    id: "p1",
    name: "Alpha Project",
    status: "IN_PROGRESS",
    start_date: "2026-09-01",
    end_date: "2026-11-20",
  },
];

const mockUsers = [
  { id: "dev1", name: "Alice Dev", email: "alice@test.com", role: "DEVELOPER" },
];

describe("PMWhatIfSimulatorPage - Redesigned Current vs. Hypothetical Comparison", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetchManagedProjects as any).mockResolvedValue(mockProjects);
    (fetchAssignableUsers as any).mockResolvedValue(mockUsers);
  });

  it("renders side-by-side Current vs. Hypothetical comparison and Impact Comparison", async () => {
    (fetchSimulatorData as any).mockResolvedValue({
      project_id: "p1",
      current_deadline: "2026-11-20",
      total_remaining_tasks: 3,
      tasks_with_estimates: 3,
      tasks_missing_estimates: 0,
      total_estimated_effort_hours: 60,
      sufficient_data_for_simulation: true,
      tasks: [],
      developers: [{ developer_id: "dev1", name: "Alice Dev", capacity_hours_per_week: 40 }],
    });

    render(
      <MemoryRouter>
        <PMWhatIfSimulatorPage />
      </MemoryRouter>
    );

    // 1. Heading & Subtitle
    expect(await screen.findByRole("heading", { name: /What-If Simulator/i })).toBeInTheDocument();
    expect(screen.getByText("Compare your current project schedule with a proposed scenario.")).toBeInTheDocument();
    expect(screen.queryByText(/Scenario Overview/i)).not.toBeInTheDocument();

    // 2. Side-by-side panels
    expect(screen.getByRole("heading", { name: "CURRENT" })).toBeInTheDocument();
    expect(screen.getByText("Verified Baseline")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "HYPOTHETICAL" })).toBeInTheDocument();
    expect(screen.getByText("Proposed Scenario")).toBeInTheDocument();

    // 3. 5 Metrics in panels
    expect(screen.getByText("Current Deadline")).toBeInTheDocument();
    expect(screen.getAllByText("Proposed Deadline").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Remaining Tasks").length).toBe(2);
    expect(screen.getAllByText("Available Capacity").length).toBe(2);
    expect(screen.getAllByText("Estimated Effort Required").length).toBe(2);
    expect(screen.getAllByText("Capacity Gap").length).toBe(2);

    // 4. Impact Comparison Section
    expect(screen.getByRole("heading", { name: "Impact Comparison" })).toBeInTheDocument();
    expect(screen.getByText("Deadline Difference")).toBeInTheDocument();
    expect(screen.getByText("Available Capacity Difference")).toBeInTheDocument();
    expect(screen.getByText("Capacity Gap Difference")).toBeInTheDocument();
    expect(screen.getByText("Feasibility Result")).toBeInTheDocument();
  });

  it("handles incomplete estimates with inline 'Unavailable — effort estimates missing' without large warning banners or false gaps", async () => {
    (fetchSimulatorData as any).mockResolvedValue({
      project_id: "p1",
      current_deadline: "2026-11-20",
      total_remaining_tasks: 4,
      tasks_with_estimates: 2,
      tasks_missing_estimates: 2,
      total_estimated_effort_hours: 40,
      sufficient_data_for_simulation: false,
      tasks: [
        { id: "t1", title: "Task 1", status: "TODO", estimated_hours: 20 },
        { id: "t2", title: "Task 2", status: "TODO", estimated_hours: null },
      ],
      developers: [{ developer_id: "dev1", name: "Alice Dev", capacity_hours_per_week: 40 }],
    });

    render(
      <MemoryRouter>
        <PMWhatIfSimulatorPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Alpha Project")).toBeInTheDocument();
    const projectSelect = screen.getByRole("combobox");
    fireEvent.change(projectSelect, { target: { value: "p1" } });

    // Inline status should be present beside affected metrics
    const inlineMissingStatuses = await screen.findAllByText("Unavailable — effort estimates missing");
    expect(inlineMissingStatuses.length).toBeGreaterThan(0);

    // No large warning banner explaining compressed schedules
    expect(screen.queryByText(/Schedule Assessment/i)).not.toBeInTheDocument();

    // Feasibility Result should accurately indicate Unavailable
    expect(screen.getByText("Effort estimates missing for remaining tasks")).toBeInTheDocument();
  });

  it("correctly compares an earlier proposed deadline (timeline compression, reduced capacity, tighter buffer)", async () => {
    (fetchSimulatorData as any).mockResolvedValue({
      project_id: "p1",
      current_deadline: "2026-11-20",
      total_remaining_tasks: 2,
      tasks_with_estimates: 2,
      tasks_missing_estimates: 0,
      total_estimated_effort_hours: 40,
      sufficient_data_for_simulation: true,
      tasks: [],
      developers: [{ developer_id: "dev1", name: "Alice Dev", capacity_hours_per_week: 40 }],
    });

    (simulateDeadlineChange as any).mockResolvedValue({
      scenario_type: "deadline_change",
      baseline: {
        project_id: "p1",
        current_deadline: "2026-11-20",
        remaining_tasks: 2,
        available_capacity_hours: 160,
        remaining_estimated_effort_hours: 40,
        tasks_with_estimates: 2,
        tasks_missing_estimates: 0,
      },
      scenario: {
        proposed_deadline: "2026-11-10",
        working_days: 12,
        available_capacity_hours: 96,
        remaining_tasks: 2,
        remaining_estimated_effort_hours: 40,
        capacity_gap_hours: 56, // 96 - 40 = +56
        capacity_gap_status: "calculated",
        tasks_missing_estimates: 0,
        schedule_concerns: [],
      },
      assumptions_and_limitations: [],
    });

    render(
      <MemoryRouter>
        <PMWhatIfSimulatorPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Alpha Project")).toBeInTheDocument();
    const projectSelect = screen.getByRole("combobox");
    fireEvent.change(projectSelect, { target: { value: "p1" } });

    // Enter earlier proposed deadline
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2026-11-10" } });

    const runBtn = screen.getByRole("button", { name: /Run Simulation/i });
    fireEvent.click(runBtn);

    // Verify simulation recalculation without mutating project baseline
    expect(await screen.findByText("+56 hrs")).toBeInTheDocument();
    // Capacity reduction difference
    expect(screen.getByText(/↓ reduction/i)).toBeInTheDocument();
    expect(screen.getAllByText(/-64 hrs/i).length).toBe(2); // Both capacity reduction (-64) and tighter buffer (-64)
    // Capacity gap tighter buffer
    expect(screen.getByText(/↓ tighter buffer/i)).toBeInTheDocument();
    // Feasible status with buffer
    expect(screen.getByText("Feasible")).toBeInTheDocument();
    expect(screen.getByText(/Sufficient capacity \(\+56 hrs buffer\)/i)).toBeInTheDocument();
  });

  it("correctly compares a later proposed deadline (extended timeline, increased capacity, larger buffer)", async () => {
    (fetchSimulatorData as any).mockResolvedValue({
      project_id: "p1",
      current_deadline: "2026-11-20",
      total_remaining_tasks: 3,
      tasks_with_estimates: 3,
      tasks_missing_estimates: 0,
      total_estimated_effort_hours: 120,
      sufficient_data_for_simulation: true,
      tasks: [],
      developers: [{ developer_id: "dev1", name: "Alice Dev", capacity_hours_per_week: 40 }],
    });

    (simulateDeadlineChange as any).mockResolvedValue({
      scenario_type: "deadline_change",
      baseline: {
        project_id: "p1",
        current_deadline: "2026-11-20",
        remaining_tasks: 3,
        available_capacity_hours: 100,
        remaining_estimated_effort_hours: 120,
        tasks_with_estimates: 3,
        tasks_missing_estimates: 0,
      },
      scenario: {
        proposed_deadline: "2026-11-27",
        working_days: 25,
        available_capacity_hours: 200,
        remaining_tasks: 3,
        remaining_estimated_effort_hours: 120,
        capacity_gap_hours: 80, // 200 - 120 = +80
        capacity_gap_status: "calculated",
        tasks_missing_estimates: 0,
        schedule_concerns: [],
      },
      assumptions_and_limitations: [],
    });

    render(
      <MemoryRouter>
        <PMWhatIfSimulatorPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Alpha Project")).toBeInTheDocument();
    const projectSelect = screen.getByRole("combobox");
    fireEvent.change(projectSelect, { target: { value: "p1" } });

    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2026-11-27" } });

    const runBtn = screen.getByRole("button", { name: /Run Simulation/i });
    fireEvent.click(runBtn);

    // Verify later proposed deadline effects
    expect(await screen.findByText("+80 hrs")).toBeInTheDocument();
    expect(screen.getByText(/↑ capacity/i)).toBeInTheDocument();
    expect(screen.getAllByText(/\+100 hrs/i).length).toBe(2); // Both capacity increase (+100) and larger buffer (+100)
    expect(screen.getByText(/↑ larger buffer/i)).toBeInTheDocument();
    expect(screen.getByText("Feasible")).toBeInTheDocument();
  });

  it("allows entering and saving task estimates and developer capacities via Manage Estimates", async () => {
    (fetchSimulatorData as any).mockResolvedValue({
      project_id: "p1",
      current_deadline: "2026-11-20",
      total_remaining_tasks: 1,
      tasks_with_estimates: 0,
      tasks_missing_estimates: 1,
      total_estimated_effort_hours: 0,
      sufficient_data_for_simulation: false,
      tasks: [
        { id: "task-99", title: "Refactor Database", status: "TODO", estimated_hours: null },
      ],
      developers: [
        { developer_id: "dev-10", name: "Alice Dev", email: "alice@test.com", capacity_hours_per_week: null, has_capacity: false },
      ],
    });

    (updateTaskEstimate as any).mockResolvedValue({
      task_id: "task-99",
      estimated_hours: 15,
      message: "Successfully updated",
    });

    (updateDeveloperCapacity as any).mockResolvedValue({
      developer_id: "dev-10",
      capacity_hours_per_week: 35,
      message: "Successfully updated",
    });

    render(
      <MemoryRouter>
        <PMWhatIfSimulatorPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Alpha Project")).toBeInTheDocument();
    const projectSelect = screen.getByRole("combobox");
    fireEvent.change(projectSelect, { target: { value: "p1" } });

    // Click Manage Estimates button
    const manageBtn = await screen.findByRole("button", { name: /Manage Estimates/i });
    fireEvent.click(manageBtn);

    // Save task estimate
    const hoursInput = await screen.findByPlaceholderText("Hours");
    fireEvent.change(hoursInput, { target: { value: "15" } });
    const saveBtn = screen.getByRole("button", { name: "Save" });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateTaskEstimate).toHaveBeenCalledWith("p1", "task-99", 15);
    });

    // Switch to developer capacity tab
    const devTabBtn = screen.getByRole("button", { name: /Assigned Developer Capacities/i });
    fireEvent.click(devTabBtn);

    // Enter weekly capacity and save
    const capInput = await screen.findByPlaceholderText("Hrs/wk");
    fireEvent.change(capInput, { target: { value: "35" } });
    const saveDevBtn = screen.getByRole("button", { name: "Save" });
    fireEvent.click(saveDevBtn);

    await waitFor(() => {
      expect(updateDeveloperCapacity).toHaveBeenCalledWith("p1", "dev-10", 35);
    });
  });

  it("regression test: reconciles 154h current capacity, 17h hypothetical capacity, and 19h estimated effort", async () => {
    (fetchSimulatorData as any).mockResolvedValue({
      project_id: "p1",
      current_deadline: "2026-11-20",
      total_remaining_tasks: 2,
      tasks_with_estimates: 2,
      tasks_missing_estimates: 0,
      total_estimated_effort_hours: 19,
      sufficient_data_for_simulation: true,
      tasks: [],
      developers: [{ developer_id: "dev1", name: "Alice Dev", capacity_hours_per_week: 40 }],
    });

    (simulateDeadlineChange as any).mockResolvedValue({
      scenario_type: "deadline_change",
      baseline: {
        project_id: "p1",
        current_deadline: "2026-11-20",
        remaining_tasks: 2,
        available_capacity_hours: 154,
        remaining_estimated_effort_hours: 19,
        capacity_gap_hours: 135,
        tasks_with_estimates: 2,
        tasks_missing_estimates: 0,
      },
      scenario: {
        proposed_deadline: "2026-10-30",
        working_days: 4,
        available_capacity_hours: 17,
        remaining_tasks: 2,
        remaining_estimated_effort_hours: 19,
        capacity_gap_hours: -2,
        capacity_gap_status: "calculated",
        tasks_missing_estimates: 0,
        schedule_concerns: [],
      },
      assumptions_and_limitations: [],
    });

    render(
      <MemoryRouter>
        <PMWhatIfSimulatorPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Alpha Project")).toBeInTheDocument();
    const projectSelect = screen.getByRole("combobox");
    fireEvent.change(projectSelect, { target: { value: "p1" } });

    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2026-10-30" } });

    const runBtn = screen.getByRole("button", { name: /Run Simulation/i });
    fireEvent.click(runBtn);

    // Baseline: Available Capacity: 154 hrs, Effort: 19 hrs -> Gap: +135 hrs
    expect(await screen.findByText("154 hrs")).toBeInTheDocument();
    expect(screen.getByText("+135 hrs")).toBeInTheDocument();

    // Hypothetical: Available Capacity: 17 hrs, Effort: 19 hrs -> Gap: -2 hrs
    expect(screen.getByText("17 hrs")).toBeInTheDocument();
    expect(screen.getByText("-2 hrs")).toBeInTheDocument();

    // Available Capacity Difference = 17 - 154 = -137 hrs
    // Capacity Gap Difference = -2 - (+135) = -137 hrs
    const diff137Elements = screen.getAllByText(/-137 hrs/i);
    expect(diff137Elements.length).toBe(2);

    // Feasibility status badge: Capacity Shortfall & Workload exceeds capacity by 2 hrs
    expect(screen.getByText("Capacity Shortfall")).toBeInTheDocument();
    expect(screen.getByText(/Workload exceeds capacity by 2 hrs/i)).toBeInTheDocument();
  });
});
