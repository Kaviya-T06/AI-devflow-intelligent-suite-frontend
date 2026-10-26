import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
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
    (continuityService.generateContinuitySummary as any).mockResolvedValue(mockBriefing);
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

    expect(screen.getByText("AI Continuity")).toBeInTheDocument();

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

  it("displays project metrics and verified tasks in the Handover Dossier view", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText(/Alpha Project/i).length).toBeGreaterThanOrEqual(1);
    });

    const dossierTabBtn = screen.getByText("Handover Dossier");
    fireEvent.click(dossierTabBtn);

    await waitFor(() => {
      expect(screen.getByText(/Section A: Project Overview & Scope/i)).toBeInTheDocument();
      expect(screen.getAllByText(/65% Complete/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/PM Alice/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Telemetry engine").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders the welcome screen with Your Project. Your Intelligence. heading, original 4 cards, and suggested questions", async () => {
    renderComponent();

    expect(screen.getByText("Your Project. Your Intelligence.")).toBeInTheDocument();
    expect(
      screen.getByText("Your AI workspace for project understanding, development assistance, and intelligent handovers.")
    ).toBeInTheDocument();

    // Verify 4 original cards
    expect(screen.getByText("Project Overview")).toBeInTheDocument();
    expect(screen.getByText("Previous Developer Work")).toBeInTheDocument();
    expect(screen.getByText("Current Work")).toBeInTheDocument();
    expect(screen.getByText("Pending Work")).toBeInTheDocument();

    // Verify suggested questions chips
    expect(screen.getByText("Suggested Questions")).toBeInTheDocument();
    expect(screen.getByText("What is the current project status?")).toBeInTheDocument();
    expect(screen.getByText("What work is still pending?")).toBeInTheDocument();
    expect(screen.getByText("What did the previous developer complete?")).toBeInTheDocument();
    expect(screen.getByText("Which tasks have been pending for a long time?")).toBeInTheDocument();
    expect(screen.getByText("What should the next developer do first?")).toBeInTheDocument();
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

  it("clicking a suggested question chip submits the question through the chat flow", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Alpha Project (active)")).toBeInTheDocument();
    });

    const questionChip = screen.getByText("What is the current project status?");
    fireEvent.click(questionChip);

    await waitFor(() => {
      expect(screen.getByText("What is the current project status?")).toBeInTheDocument();
      expect(screen.getByText(/Charlie is working on the Telemetry engine/i)).toBeInTheDocument();
    });

    expect(continuityService.streamContinuityQuestion).toHaveBeenCalledWith(
      "proj-1",
      "What is the current project status?",
      expect.any(String),
      expect.any(Array),
      expect.any(Function),
      expect.any(Object)
    );
  });

  it("clicking Handover Dossier tab switches to the Handover Dossier view", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Alpha Project (active)")).toBeInTheDocument();
    });

    const dossierTab = screen.getByText("Handover Dossier");
    fireEvent.click(dossierTab);

    await waitFor(() => {
      expect(screen.getByText(/Section A: Project Overview & Scope/i)).toBeInTheDocument();
      expect(screen.getByText("Phase 5 Developer Handover Dossier")).toBeInTheDocument();
    });
  });

  it("submitting a question transitions from welcome screen to active conversation", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Alpha Project (active)")).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/Ask about tasks, risks, PRs/i);
    fireEvent.change(textarea, { target: { value: "Provide a comprehensive overview of this project's architecture" } });
    const sendBtn = screen.getByLabelText("Send question");
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(
        screen.getByText("Provide a comprehensive overview of this project's architecture")
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

  it("clicking New Chat clears the conversation and restores the clean welcome screen", async () => {
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

    // Click New Chat to clear
    const newChatBtn = screen.getByText("New Chat");
    fireEvent.click(newChatBtn);

    // Welcome hero reappears cleanly
    await waitFor(() => {
      expect(screen.getByText("Your Project. Your Intelligence.")).toBeInTheDocument();
      expect(
        screen.getByText("Your AI workspace for project understanding, development assistance, and intelligent handovers.")
      ).toBeInTheDocument();
    });
  });

  it("hides the four handover boxes on the initial screen and makes them accessible post-interaction", async () => {
    renderComponent();

    // Acceptance criteria 1 & 2: Welcome hero only, four boxes NOT visible initially
    expect(screen.getByText("Your Project. Your Intelligence.")).toBeInTheDocument();
    expect(screen.queryByText("Box 1 of 4")).not.toBeInTheDocument();
    expect(screen.queryByText("Box 2 of 4")).not.toBeInTheDocument();
    expect(screen.queryByText("Box 3 of 4")).not.toBeInTheDocument();
    expect(screen.queryByText("Box 4 of 4")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Alpha Project (active)")).toBeInTheDocument();
    });

    // Acceptance criteria 3: Start interacting with chat
    const textarea = screen.getByPlaceholderText(/Ask about tasks, risks, PRs/i);
    fireEvent.change(textarea, { target: { value: "What should I know before starting work?" } });
    const sendBtn = screen.getByLabelText("Send question");
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText("What should I know before starting work?")).toBeInTheDocument();
      expect(screen.getByText(/Charlie is working on the Telemetry engine/i)).toBeInTheDocument();
    });

    // Verify the "4 Handover Boxes" strip below the generated summary is removed
    expect(screen.queryByText("4 Handover Boxes")).not.toBeInTheDocument();
    expect(screen.queryByText("View 4 Handover Boxes")).not.toBeInTheDocument();

    // Handover intelligence remains accessible via the header toggle
    const viewBoxesBtn = screen.getByText("View Handover Intelligence");
    fireEvent.click(viewBoxesBtn);

    // Verify all 4 boxes are rendered with full project data
    await waitFor(() => {
      expect(screen.getByText("What the Next Developer Should Know")).toBeInTheDocument();
      expect(screen.getByText("Completed and Pending Work")).toBeInTheDocument();
      expect(screen.getByText(/Items Requiring Attention/i)).toBeInTheDocument();
      expect(screen.getByText("Recorded Tasks, GitHub Pull Requests, and Issues")).toBeInTheDocument();
    });
  });
});

