import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import AIContinuityPage from "../AIContinuityPage";
import * as adminService from "../../../services/adminService";
import * as continuityService from "../../../services/continuityService";

vi.mock("../../../services/adminService", () => ({
  fetchAllProjects: vi.fn(),
}));

vi.mock("../../../services/continuityService", () => ({
  generateContinuitySummary: vi.fn(),
  askContinuityQuestion: vi.fn(),
  streamContinuityQuestion: vi.fn(),
  getContinuityAiStatus: vi.fn(),
  getContinuityDataBriefing: vi.fn(),
  updateContinuityProjectContext: vi.fn(),
}));

describe("AIContinuityPage", () => {
  const mockProjects = [
    { id: "proj-1", name: "Alpha Project", status: "active" },
    { id: "proj-2", name: "Beta System", status: "completed" },
  ];

  const mockBriefing: continuityService.ContinuitySummary = {
    project_overview: "The Alpha Project is an enterprise continuity suite.",
    previous_developer_work: "Completed authentication and schemas.",
    current_work: "Tasks in progress: Real-time telemetry.",
    pending_work: "Offline caching pending.",
    blocked_overdue_work: "No verified overdue tasks.",
    recent_github_activity: "Repository connected with 3 recent commits.",
    known_issues: "No open workflow issues.",
    important_context: "Uses PostgreSQL.",
    what_next_developer_should_know: "Review verified task records.",
    recommended_next_steps: "Review open tasks.",
    raw_context: {
      project: { id: "proj-1", name: "Alpha Project", status: "active", progress: 65, users: { name: "PM Alice" } },
      tasks: [
        { id: "t-1", title: "Auth setup", status: "COMPLETED", priority: "HIGH", users: { name: "Bob" } },
        { id: "t-2", title: "Telemetry engine", status: "IN_PROGRESS", priority: "CRITICAL", users: { name: "Charlie" } },
      ],
      risks: [],
      github: { repository: "owner/alpha", commits: [], pull_requests: [], issues: [] },
      verified_mappings: [],
      unmapped_commits: [],
      unmapped_prs: [],
    },
    next_developer_plan: [
      {
        priority: "High",
        action: "Coordinate telemetry release",
        why: "Preserves velocity",
        artifact: "Telemetry engine",
        prerequisites: "Tests pass",
        next_step: "Run benchmark",
      },
    ],
    attention_required: [
      {
        category: "CONFIRMED_ISSUE",
        title: "Telemetry Memory Spike",
        severity: "High",
        detail: "Memory buffer exceeds 500MB",
        evidence: "Risk ID: r-1",
      },
    ],
    checklist: [
      {
        step: 1,
        title: "Understand project architecture and setup",
        description: "Review architecture",
        status: "ready",
      },
    ],
    data_coverage: {
      verified_count: 5,
      total_sources: 6,
      score_percent: 83,
      sources: [
        { name: "Project Metadata", verified: true, detail: "Verified" },
      ],
      confidence_level: "High",
      missing_summary: "None",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (adminService.fetchAllProjects as any).mockResolvedValue(mockProjects);
    (continuityService.getContinuityAiStatus as any).mockResolvedValue({
      provider: "ollama",
      model: "llama3.2:1b",
      status: "ready",
      health: { available: true, model_installed: true },
    });
    (continuityService.getContinuityDataBriefing as any).mockResolvedValue(mockBriefing);
    (continuityService.streamContinuityQuestion as any).mockImplementation(
      async (_projectId: string, _q: string, _t: string, _h: any, onChunk: any) => {
        const ans = "Based on verified project records, Charlie is working on the Telemetry engine.";
        if (onChunk) onChunk(ans);
        return ans;
      }
    );
    (continuityService.askContinuityQuestion as any).mockResolvedValue({
      answer: "Based on verified project records, Charlie is working on the Telemetry engine.",
    });
  });

  const renderComponent = () =>
    render(
      <BrowserRouter>
        <AIContinuityPage />
      </BrowserRouter>
    );

  it("renders the AI Continuity Page title and project selector", async () => {
    renderComponent();

    expect(screen.getByText(/AI Project Summary & Continuity/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Alpha Project (active)")).toBeInTheDocument();
      expect(screen.getByText("Beta System (completed)")).toBeInTheDocument();
    });
  });

  it("renders the AI Continuity Assistant panel with synchronous welcome heading and input", async () => {
    renderComponent();

    expect(screen.getByText("AI Continuity Assistant")).toBeInTheDocument();
    expect(screen.getByText("Your Project. Your Intelligence.")).toBeInTheDocument();
    expect(
      screen.getByText("Your AI workspace for project understanding, development assistance, and intelligent handovers.")
    ).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/Ask about tasks, risks, PRs/i);
    expect(textarea).toBeInTheDocument();
  });

  it("submits a question from the composer and displays the user message and AI response", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Alpha Project (active)")).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/Ask about tasks, risks, PRs/i);
    fireEvent.change(textarea, { target: { value: "What should I work on first?" } });

    const sendBtn = screen.getByLabelText("Send question");
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getAllByText("What should I work on first?").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Charlie is working on the Telemetry engine/i)).toBeInTheDocument();
    });

    expect(continuityService.streamContinuityQuestion).toHaveBeenCalledWith(
      "proj-1",
      "What should I work on first?",
      expect.any(String),
      expect.any(Array),
      expect.any(Function),
      expect.any(Object)
    );
  });

  it("allows typing a manual question and sending via Enter", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Alpha Project (active)")).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/Ask about tasks, risks, PRs/i);
    fireEvent.change(textarea, { target: { value: "Who is working on telemetry?" } });

    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    await waitFor(() => {
      expect(screen.getByText("Who is working on telemetry?")).toBeInTheDocument();
      expect(screen.getByText(/Charlie is working on the Telemetry engine/i)).toBeInTheDocument();
    });
  });

  it("displays project metrics and verified tasks from the briefing", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText(/Alpha Project/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/65% Complete/i)).toBeInTheDocument();
      expect(screen.getByText(/PM Alice/i)).toBeInTheDocument();
      expect(screen.getByText("Telemetry engine")).toBeInTheDocument();
    });
  });

  it("renders the clean welcome screen with Your Project. Your Intelligence. heading and no suggestion cards", async () => {
    renderComponent();

    expect(screen.getByText("Your Project. Your Intelligence.")).toBeInTheDocument();
    expect(
      screen.getByText("Your AI workspace for project understanding, development assistance, and intelligent handovers.")
    ).toBeInTheDocument();

    // Verify negative requirement: No suggestion cards on initial welcome screen
    expect(screen.queryByText("Suggested Questions")).not.toBeInTheDocument();
    expect(screen.queryByText("Generate a project handover.")).not.toBeInTheDocument();
  });

  it("switches to the Handover Dossier view and renders sections and context editor", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText(/Alpha Project/i).length).toBeGreaterThanOrEqual(1);
    });

    const dossierTabBtn = screen.getByText("Handover Dossier");
    fireEvent.click(dossierTabBtn);

    await waitFor(() => {
      expect(screen.getByText(/Section A: Project Overview & Scope/i)).toBeInTheDocument();
      expect(screen.getByText(/Section E: Prioritized Next Developer Action Plan/i)).toBeInTheDocument();
      expect(screen.getByText("Coordinate telemetry release")).toBeInTheDocument();
      expect(screen.getByText(/Section H: 7-Step Actionable Developer Onboarding Checklist/i)).toBeInTheDocument();
      expect(screen.getByText(/83% Coverage Score/i)).toBeInTheDocument();
    });

    // Test context editor modal opening
    const editContextBtn = screen.getByText("Edit Context & Specs");
    fireEvent.click(editContextBtn);

    expect(screen.getByText("Add / Edit Project Context & Tech Stack")).toBeInTheDocument();
    expect(screen.getByText("Project Description & Objectives")).toBeInTheDocument();
  });

  it("renders the AI star symbol, heading, and the four feature boxes on the initial welcome screen", async () => {
    renderComponent();

    // Verify Welcome Hero heading & subtitle
    expect(screen.getByText("Your Project. Your Intelligence.")).toBeInTheDocument();
    expect(
      screen.getByText("Your AI workspace for project understanding, development assistance, and intelligent handovers.")
    ).toBeInTheDocument();

    // Verify the four feature boxes
    expect(screen.getByText("Handover Intelligence")).toBeInTheDocument();
    expect(
      screen.getByText("Generate or review a project handover using verified project information.")
    ).toBeInTheDocument();

    expect(screen.getByText("Project Understanding")).toBeInTheDocument();
    expect(
      screen.getByText("Ask questions about the selected project using available project records.")
    ).toBeInTheDocument();

    expect(screen.getByText("Development Assistant")).toBeInTheDocument();
    expect(
      screen.getByText("Get help with programming, debugging, and development questions.")
    ).toBeInTheDocument();

    expect(screen.getByText("Workflow Intelligence")).toBeInTheDocument();
    expect(
      screen.getByText("Understand task progress, dependencies, activity, and verified blockers.")
    ).toBeInTheDocument();

    // Negative requirement: Old suggested-question cards row is NOT on the initial welcome screen
    expect(screen.queryByText("Suggested Questions")).not.toBeInTheDocument();
  });

  it("clicking Handover Intelligence box switches to the Handover Dossier view", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Alpha Project (active)")).toBeInTheDocument();
    });

    const handoverBox = document.getElementById("feature-box-handover-intelligence")!;
    fireEvent.click(handoverBox);

    await waitFor(() => {
      expect(screen.getByText(/Section A: Project Overview & Scope/i)).toBeInTheDocument();
      expect(screen.getByText("Phase 5 Developer Handover Dossier")).toBeInTheDocument();
    });
  });

  it("clicking Project Understanding box triggers AI query and transitions to active conversation", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Alpha Project (active)")).toBeInTheDocument();
    });

    const understandingBox = document.getElementById("feature-box-project-understanding")!;
    fireEvent.click(understandingBox);

    await waitFor(() => {
      expect(
        screen.getByText(/Provide a comprehensive overview of this project's architecture/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Charlie is working on the Telemetry engine/i)).toBeInTheDocument();
    });

    expect(continuityService.streamContinuityQuestion).toHaveBeenCalledWith(
      "proj-1",
      expect.stringContaining("Provide a comprehensive overview of this project's architecture"),
      expect.any(String),
      expect.any(Array),
      expect.any(Function),
      expect.any(Object)
    );
  });

  it("clicking New Chat clears the conversation and restores the welcome screen with four boxes", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Alpha Project (active)")).toBeInTheDocument();
    });

    // Send a message via textarea composer
    const textarea = screen.getByPlaceholderText(/Ask about tasks, risks, PRs/i);
    fireEvent.change(textarea, { target: { value: "Tell me about this project" } });
    const sendBtn = screen.getByLabelText("Send question");
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText("New Chat")).toBeInTheDocument();
      expect(screen.getByText("Tell me about this project")).toBeInTheDocument();
    });

    // Feature boxes are hidden during active conversation
    expect(screen.queryByText("Handover Intelligence")).not.toBeInTheDocument();

    // Click New Chat to clear
    const newChatBtn = screen.getByText("New Chat");
    fireEvent.click(newChatBtn);

    // Welcome hero and four boxes reappear cleanly
    await waitFor(() => {
      expect(screen.getByText("Your Project. Your Intelligence.")).toBeInTheDocument();
      expect(screen.getByText("Handover Intelligence")).toBeInTheDocument();
      expect(screen.getByText("Project Understanding")).toBeInTheDocument();
      expect(screen.getByText("Development Assistant")).toBeInTheDocument();
      expect(screen.getByText("Workflow Intelligence")).toBeInTheDocument();
    });
  });
});

