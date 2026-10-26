import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PMProjectPulsePage from '../PMProjectPulsePage';
import {
  fetchPMDashboardStats,
  fetchPMRisks,
  fetchPMActivity,
  fetchPulseRecommendations,
  fetchPulseBriefing,
} from '../../../services/pmService';
import '@testing-library/jest-dom/vitest';

vi.mock('../../../services/pmService', () => ({
  fetchPMDashboardStats: vi.fn(),
  fetchPMRisks: vi.fn(),
  fetchPMActivity: vi.fn(),
  fetchPulseRecommendations: vi.fn(),
  fetchPulseBriefing: vi.fn(),
}));

const mockStats = {
  projects: [
    {
      id: 'proj-1',
      name: 'Project 1',
      total_tasks: 10,
      completed_tasks: 5,
      in_progress_tasks: 3,
      review_tasks: 0,
      todo_tasks: 0,
      overdue_tasks: 2,
      progress: 50,
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      developers: [
        {
          developer_id: 'dev-1',
          developer_name: 'Dev One',
          total_tasks: 5,
          in_progress_tasks: 2,
          completed_tasks: 3,
          review_tasks: 0,
          todo_tasks: 0,
          overdue_tasks: 1,
        },
      ],
      health: {
        score: 79,
        components: [
          { reason: '1 Critical Risk(s)', amount: 15 },
          { reason: '2 Overdue Task(s) (Unmitigated)', amount: 6 },
        ],
        data_completeness: 'High',
      },
    },
    {
      id: 'proj-2',
      name: 'Project 2',
      total_tasks: 20,
      completed_tasks: 20,
      in_progress_tasks: 0,
      review_tasks: 0,
      todo_tasks: 0,
      overdue_tasks: 0,
      progress: 100,
      start_date: '2026-01-01',
      end_date: '2026-06-30',
      developers: [],
      health: {
        score: 100,
        components: [],
        data_completeness: 'Medium',
      },
    },
  ],
};

const mockRisks = [
  {
    id: 'risk-1',
    project_id: 'proj-1',
    severity: 'Critical',
    title: 'DB down',
    description: 'Postgres primary database connection pool exhausted',
    risk_type: 'INFRA',
    is_resolved: false,
    detected_at: '2026-10-10T00:00:00Z',
  },
  {
    id: 'risk-2',
    project_id: 'proj-1',
    severity: 'High',
    title: 'API delay',
    description: 'Upstream payment gateway response latency > 5s',
    risk_type: 'API',
    is_resolved: false,
    detected_at: '2026-10-10T00:00:00Z',
  },
];

const mockActivity = [
  {
    id: 'act-1',
    project_id: 'proj-1',
    entity_id: 'proj-1',
    description: 'Updated task API Migration to IN_PROGRESS',
    created_at: '2026-10-10T00:00:00Z',
    user_name: 'Dev One',
  },
];

const mockRecsProj1 = {
  project_id: 'proj-1',
  project_name: 'Project 1',
  health_score: 79,
  health_data_completeness: 'High',
  source: 'gemini',
  ai_status: 'SUCCESS',
  ai_notice: null,
  generated_at: '2026-10-11T12:00:00Z',
  recommendations: [
    {
      id: 'rec-1',
      category: 'RISK_MITIGATION',
      title: 'Resolve Critical Risk: DB down',
      explanation: 'Critical infrastructure failure is blocking database queries.',
      why_it_matters: 'Directly penalizes health score by 15 points and blocks sprint tasks.',
      missing_info_or_assumptions: 'Confirmation of failover replica status.',
      confidence: 'High',
      confidence_rationale: 'Derived from verified open risk and -15 health score penalty formula.',
      supporting_references: [
        { type: 'risk', id: 'risk-1', label: 'DB down' },
      ],
    },
    {
      id: 'rec-2',
      category: 'TASK_REVIEW',
      title: 'Review Overdue Task: API Migration',
      explanation: 'Task is overdue by 2 days.',
      why_it_matters: 'Delays backend release timeline.',
      missing_info_or_assumptions: 'Requires sync with assigned developer.',
      confidence: 'High',
      confidence_rationale: 'Defensible deterministic due date check.',
      supporting_references: [
        { type: 'task', id: 'task-10', label: 'API Migration' },
      ],
    },
  ],
};

const mockRecsProj2 = {
  project_id: 'proj-2',
  project_name: 'Project 2',
  health_score: 100,
  health_data_completeness: 'High',
  source: 'deterministic',
  ai_status: 'FALLBACK',
  ai_notice: 'AI service rate limited. Displaying safe deterministic recommendations.',
  generated_at: '2026-10-11T12:00:00Z',
  recommendations: [
    {
      id: 'det-1',
      category: 'GENERAL',
      title: 'Maintain Current Delivery Cadence',
      explanation: 'No critical risks or blockers detected.',
      why_it_matters: 'Project health is optimal at 100.',
      missing_info_or_assumptions: 'Assumes task status is kept updated.',
      confidence: 'High',
      confidence_rationale: 'No active health deductions found.',
      supporting_references: [],
    },
  ],
};

const mockBriefingProj1 = {
  project_id: 'proj-1',
  project_name: 'Project 1',
  generated_at: '2026-10-11T12:00:00Z',
  data_freshness: 'Live snapshot as of 12:00:00 UTC',
  health_score: 79,
  health_data_completeness: 'High',
  source: 'gemini',
  ai_status: 'SUCCESS',
  ai_notice: null,
  sections: {
    health: {
      score: 79,
      status: 'Caution / Minor Degradation',
      data_completeness: 'High',
      factors: ['1 Critical Risk(s) (-15)', '2 Overdue Task(s) (-6)'],
      explanation: 'Project health is calculated deterministically at 79/100.',
    },
    completed_work: {
      tasks_count: 5,
      task_titles: ['Task A', 'Task B', 'Task C', 'Task D', 'Task E'],
      summary: '5 tasks are verified completed in DevFlow.',
    },
    in_progress_and_pending: {
      in_progress_count: 3,
      todo_count: 2,
      in_progress_tasks: ['API Migration', 'Dashboard UI'],
      pending_tasks: ['Database Indexing'],
      summary: '3 tasks active in progress and 2 queued.',
    },
    overdue_or_blocked: {
      count: 2,
      items: ['API Migration (Due: 2026-10-09)'],
      summary: '2 tasks have passed scheduled completion dates.',
    },
    unresolved_risks: {
      critical_count: 1,
      high_count: 1,
      items: ['[Critical] DB down (INFRA)', '[High] API delay (API)'],
      summary: 'Detected 1 critical and 1 high workflow risk.',
    },
    recent_activity: {
      items: ['Dev One (UPDATE): Updated task [2026-10-10]'],
      summary: '1 recent activity log recorded.',
    },
    github_context: {
      is_configured: true,
      repository: 'owner/project-1',
      recent_commits_count: 5,
      open_prs_count: 2,
      branches_count: 3,
      summary: 'Connected to owner/project-1 with 5 recent commits.',
    },
    recommended_next_actions: {
      actions: ['Mitigate Critical Risk: DB down', 'Resolve overdue API Migration'],
      summary: 'Focus on database recovery and overdue milestone.',
    },
    data_gaps: {
      gaps: [],
      reliability_impact: 'Project data completeness is high.',
    },
  },
  verified_facts: {},
};

const mockBriefingProj2 = {
  project_id: 'proj-2',
  project_name: 'Project 2',
  generated_at: '2026-10-11T12:00:00Z',
  data_freshness: 'Live snapshot as of 12:00:00 UTC',
  health_score: 100,
  health_data_completeness: 'Medium',
  source: 'deterministic',
  ai_status: 'FALLBACK',
  ai_notice: 'AI service rate limited. Displaying safe deterministic briefing.',
  sections: {
    health: {
      score: 100,
      status: 'Healthy',
      data_completeness: 'Medium',
      factors: ['No active deductions'],
      explanation: 'Project health is optimal at 100/100.',
    },
    completed_work: {
      tasks_count: 20,
      task_titles: ['Setup', 'Deploy'],
      summary: 'All 20 tasks are verified completed.',
    },
    in_progress_and_pending: {
      in_progress_count: 0,
      todo_count: 0,
      in_progress_tasks: [],
      pending_tasks: [],
      summary: 'No active or pending tasks.',
    },
    overdue_or_blocked: {
      count: 0,
      items: [],
      summary: 'No overdue tasks detected.',
    },
    unresolved_risks: {
      critical_count: 0,
      high_count: 0,
      items: [],
      summary: 'No critical or high severity risks are open.',
    },
    recent_activity: {
      items: [],
      summary: 'No recent activity recorded.',
    },
    github_context: {
      is_configured: false,
      repository: null,
      recent_commits_count: 0,
      open_prs_count: 0,
      branches_count: 0,
      summary: 'GitHub repository integration is not configured. Project progress is tracked through DevFlow tasks.',
    },
    recommended_next_actions: {
      actions: ['Maintain current project delivery cadence.'],
      summary: 'Project is on track.',
    },
    data_gaps: {
      gaps: ['GitHub repository integration is not connected.'],
      reliability_impact: 'Briefing certainty is moderate until repository is connected.',
    },
  },
  verified_facts: {},
};

describe('PMProjectPulsePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(fetchPMDashboardStats).mockImplementation(() => new Promise(() => {}));
    vi.mocked(fetchPMRisks).mockImplementation(() => new Promise(() => {}));
    vi.mocked(fetchPMActivity).mockImplementation(() => new Promise(() => {}));
    vi.mocked(fetchPulseRecommendations).mockImplementation(() => new Promise(() => {}));
    vi.mocked(fetchPulseBriefing).mockImplementation(() => new Promise(() => {}));

    render(<PMProjectPulsePage />);
    expect(screen.getByText(/Loading Project Pulse/i)).toBeInTheDocument();
  });

  it('renders error state on API failure', async () => {
    vi.mocked(fetchPMDashboardStats).mockRejectedValue(new Error('API Failure'));
    vi.mocked(fetchPMRisks).mockResolvedValue([]);
    vi.mocked(fetchPMActivity).mockResolvedValue([]);
    vi.mocked(fetchPulseRecommendations).mockResolvedValue(mockRecsProj1 as any);
    vi.mocked(fetchPulseBriefing).mockResolvedValue(mockBriefingProj1 as any);

    render(<PMProjectPulsePage />);

    await waitFor(() => {
      expect(screen.getByText('API Failure')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('renders empty state when no active projects exist', async () => {
    vi.mocked(fetchPMDashboardStats).mockResolvedValue({ projects: [] } as any);
    vi.mocked(fetchPMRisks).mockResolvedValue([]);
    vi.mocked(fetchPMActivity).mockResolvedValue([]);
    vi.mocked(fetchPulseRecommendations).mockResolvedValue(mockRecsProj1 as any);
    vi.mocked(fetchPulseBriefing).mockResolvedValue(mockBriefingProj1 as any);

    render(<PMProjectPulsePage />);

    await waitFor(() => {
      expect(screen.getByText(/You don't have any active projects yet/i)).toBeInTheDocument();
    });
  });

  it('renders dashboard with Phase 5 Executive Project Briefing across all 9 sections', async () => {
    vi.mocked(fetchPMDashboardStats).mockResolvedValue(mockStats as any);
    vi.mocked(fetchPMRisks).mockResolvedValue(mockRisks as any);
    vi.mocked(fetchPMActivity).mockResolvedValue(mockActivity as any);
    vi.mocked(fetchPulseRecommendations).mockResolvedValue(mockRecsProj1 as any);
    vi.mocked(fetchPulseBriefing).mockResolvedValue(mockBriefingProj1 as any);

    render(<PMProjectPulsePage />);

    await waitFor(() => {
      expect(screen.getByText('Project Pulse')).toBeInTheDocument();
    });

    // Check Phase 5 Briefing rendering
    await waitFor(() => {
      expect(screen.getByText('Executive Project Briefing')).toBeInTheDocument();
      expect(screen.getByText('AI-Grounded Briefing')).toBeInTheDocument();
      expect(screen.getByText(/Live snapshot as of 12:00:00 UTC/i)).toBeInTheDocument();

      // Check all 9 briefing sections are visible
      expect(screen.getByText(/1\. Project Health/i)).toBeInTheDocument();
      expect(screen.getByText(/2\. Completed Work/i)).toBeInTheDocument();
      expect(screen.getByText(/3\. In-Progress & Queued/i)).toBeInTheDocument();
      expect(screen.getByText(/4\. Overdue & Blocked/i)).toBeInTheDocument();
      expect(screen.getByText(/5\. Unresolved Risks/i)).toBeInTheDocument();
      expect(screen.getByText(/6\. Recent Activity/i)).toBeInTheDocument();
      expect(screen.getByText(/7\. GitHub Context/i)).toBeInTheDocument();
      expect(screen.getByText(/8\. Next Actions/i)).toBeInTheDocument();
      expect(screen.getByText(/9\. Data Gaps/i)).toBeInTheDocument();

      // Content inside sections
      expect(screen.getByText('5 Tasks')).toBeInTheDocument();
      expect(screen.getByText('Mitigate Critical Risk: DB down')).toBeInTheDocument();
      expect(screen.getByText(/Connected to owner\/project-1/i)).toBeInTheDocument();
    });

    // Switch to Phase 4 tab
    const recsTab = screen.getByRole('button', { name: /Recovery Recommendations/i });
    fireEvent.click(recsTab);

    await waitFor(() => {
      expect(screen.getByText('Resolve Critical Risk: DB down')).toBeInTheDocument();
      expect(screen.getByText('Review Overdue Task: API Migration')).toBeInTheDocument();
    });
  });

  it('handles project switching, clears stale context, and displays partial data/fallback state', async () => {
    vi.mocked(fetchPMDashboardStats).mockResolvedValue(mockStats as any);
    vi.mocked(fetchPMRisks).mockResolvedValue(mockRisks as any);
    vi.mocked(fetchPMActivity).mockResolvedValue(mockActivity as any);
    vi.mocked(fetchPulseRecommendations).mockImplementation((projId: string) => {
      if (projId === 'proj-2') return Promise.resolve(mockRecsProj2 as any);
      return Promise.resolve(mockRecsProj1 as any);
    });
    vi.mocked(fetchPulseBriefing).mockImplementation((projId: string) => {
      if (projId === 'proj-2') return Promise.resolve(mockBriefingProj2 as any);
      return Promise.resolve(mockBriefingProj1 as any);
    });

    render(<PMProjectPulsePage />);

    await waitFor(() => {
      expect(screen.getByText('Executive Project Briefing')).toBeInTheDocument();
      expect(screen.getByText('AI-Grounded Briefing')).toBeInTheDocument();
    });

    // Switch project to proj-2
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'proj-2' } });

    // Verify Project 2 loaded with deterministic fallback and partial data warning
    await waitFor(() => {
      expect(screen.getByText('Safe Deterministic Briefing')).toBeInTheDocument();
      expect(screen.getByText(/Partial Data Snapshot/i)).toBeInTheDocument();
      expect(screen.getByText(/GitHub repository integration is not configured/i)).toBeInTheDocument();
      expect(screen.getByText(/AI service rate limited/i)).toBeInTheDocument();
    });
  });

  it('renders complete integrated dashboard modules: Health Score, Status Distribution, Risk Radar, Workload Summary, and GitHub Status', async () => {
    vi.mocked(fetchPMDashboardStats).mockResolvedValue(mockStats as any);
    vi.mocked(fetchPMRisks).mockResolvedValue(mockRisks as any);
    vi.mocked(fetchPMActivity).mockResolvedValue(mockActivity as any);
    vi.mocked(fetchPulseRecommendations).mockResolvedValue(mockRecsProj1 as any);
    vi.mocked(fetchPulseBriefing).mockResolvedValue(mockBriefingProj1 as any);

    render(
      <MemoryRouter>
        <PMProjectPulsePage />
      </MemoryRouter>
    );

    // 1. Health Score details
    await waitFor(() => {
      expect(screen.getByText('79')).toBeInTheDocument();
      expect(screen.getByText('Caution / Degraded')).toBeInTheDocument();
      expect(screen.getByText('1 Critical Risk(s)')).toBeInTheDocument();
      expect(screen.getByText('-15')).toBeInTheDocument();
      expect(screen.getByText('2 Overdue Task(s) (Unmitigated)')).toBeInTheDocument();
      expect(screen.getByText('-6')).toBeInTheDocument();
    });

    // 2. Task Progress and Status Distribution
    expect(screen.getByText(/Task Execution & Status Distribution/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /Task Status Distribution/i })).toBeInTheDocument();
    expect(screen.getByText(/50% \(5\/10 tasks\)/i)).toBeInTheDocument();

    // 3. Risk Radar with Severity Breakdown & Evidence
    expect(screen.getByText('Risk Radar')).toBeInTheDocument();
    expect(screen.getByText('DB down')).toBeInTheDocument();
    expect(screen.getByText('API delay')).toBeInTheDocument();
    expect(screen.getByText(/Postgres primary database connection pool exhausted/i)).toBeInTheDocument();
    expect(screen.getByText(/Upstream payment gateway response latency > 5s/i)).toBeInTheDocument();

    // 4. Developer Workload with Completeness
    expect(screen.getByText('Workload Summary')).toBeInTheDocument();
    expect(screen.getAllByText('Dev One').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('5 Unassigned Tasks')).toBeInTheDocument();

    // 5. GitHub Integration Card
    expect(screen.getByText('GitHub Integration')).toBeInTheDocument();
    expect(screen.getByText('owner/project-1')).toBeInTheDocument();

    // 6. Recent Project Activity Timeline
    expect(screen.getByText('Recent Project Activity')).toBeInTheDocument();
    expect(screen.getByText(/Updated task API Migration to IN_PROGRESS/i)).toBeInTheDocument();
  });

  it('supports action navigation links preserving project parameter', async () => {
    vi.mocked(fetchPMDashboardStats).mockResolvedValue(mockStats as any);
    vi.mocked(fetchPMRisks).mockResolvedValue(mockRisks as any);
    vi.mocked(fetchPMActivity).mockResolvedValue(mockActivity as any);
    vi.mocked(fetchPulseRecommendations).mockResolvedValue(mockRecsProj1 as any);
    vi.mocked(fetchPulseBriefing).mockResolvedValue(mockBriefingProj1 as any);

    render(
      <MemoryRouter>
        <PMProjectPulsePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Manage Tasks')).toBeInTheDocument();
    });

    // Check Task view link
    const manageTasksLink = screen.getByRole('link', { name: /Manage Tasks for this project/i });
    expect(manageTasksLink).toHaveAttribute('href', '/dashboard/pm-team-tasks?project=proj-1');

    // Check Risk Center link
    const riskCenterLink = screen.getByRole('link', { name: /Open Risk Center/i });
    expect(riskCenterLink).toHaveAttribute('href', '/dashboard/pm-workflow-risks?project=Project%201');

    // Check Smart Allocation link
    const smartAllocLinks = screen.getAllByRole('link', { name: /Smart Allocation/i });
    expect(smartAllocLinks[0]).toHaveAttribute('href', '/dashboard/pm-smart-allocation?project=proj-1');

    // Check Full Timeline activity link
    const timelineLink = screen.getByRole('link', { name: /View All Project Activity Logs/i });
    expect(timelineLink).toHaveAttribute('href', '/dashboard/pm-activity?project=proj-1');

    // Check GitHub settings link
    const githubLink = screen.getByRole('link', { name: /Manage GitHub Integration/i });
    expect(githubLink).toHaveAttribute('href', '/dashboard/github-integration');

    // Check deep-links inside Recovery Recommendations
    const recsTab = screen.getByRole('button', { name: /Recovery Recommendations/i });
    fireEvent.click(recsTab);

    await waitFor(() => {
      const riskEvidenceLink = screen.getByTitle('Inspect risk: DB down');
      expect(riskEvidenceLink).toHaveAttribute('href', '/dashboard/pm-workflow-risks?project=Project%201');

      const taskEvidenceLink = screen.getByTitle('Inspect task: API Migration');
      expect(taskEvidenceLink).toHaveAttribute('href', '/dashboard/pm-team-tasks?project=proj-1');
    });
  });

  it('handles dashboard refresh without creating duplicate requests', async () => {
    vi.mocked(fetchPMDashboardStats).mockResolvedValue(mockStats as any);
    vi.mocked(fetchPMRisks).mockResolvedValue(mockRisks as any);
    vi.mocked(fetchPMActivity).mockResolvedValue(mockActivity as any);
    vi.mocked(fetchPulseRecommendations).mockResolvedValue(mockRecsProj1 as any);
    vi.mocked(fetchPulseBriefing).mockResolvedValue(mockBriefingProj1 as any);

    render(
      <MemoryRouter>
        <PMProjectPulsePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Project Pulse')).toBeInTheDocument();
    });

    const initialStatsCalls = vi.mocked(fetchPMDashboardStats).mock.calls.length;
    expect(initialStatsCalls).toBe(1);

    const refreshButton = screen.getByRole('button', { name: /Refresh Project Pulse data/i });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(vi.mocked(fetchPMDashboardStats).mock.calls.length).toBe(2);
    });
  });

  it('handles partial failures gracefully when briefing fails', async () => {
    vi.mocked(fetchPMDashboardStats).mockResolvedValue(mockStats as any);
    vi.mocked(fetchPMRisks).mockResolvedValue(mockRisks as any);
    vi.mocked(fetchPMActivity).mockResolvedValue(mockActivity as any);
    vi.mocked(fetchPulseRecommendations).mockResolvedValue(mockRecsProj1 as any);
    vi.mocked(fetchPulseBriefing).mockRejectedValue(new Error('Briefing synthesis failed'));

    render(
      <MemoryRouter>
        <PMProjectPulsePage />
      </MemoryRouter>
    );

    // Dashboard still renders normally
    await waitFor(() => {
      expect(screen.getByText('Project Pulse')).toBeInTheDocument();
      expect(screen.getByText('79')).toBeInTheDocument();
      expect(screen.getByText('Risk Radar')).toBeInTheDocument();
    });

    // Briefing displays specific inline error with retry button
    await waitFor(() => {
      expect(screen.getByText('Briefing synthesis failed')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry loading project briefing/i })).toBeInTheDocument();
    });

    // Clicking retry attempts to load briefing again
    vi.mocked(fetchPulseBriefing).mockResolvedValue(mockBriefingProj1 as any);
    const retryBtn = screen.getByRole('button', { name: /Retry loading project briefing/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('AI-Grounded Briefing')).toBeInTheDocument();
    });
  });

  it('handles partial failures gracefully when recommendations fails', async () => {
    vi.mocked(fetchPMDashboardStats).mockResolvedValue(mockStats as any);
    vi.mocked(fetchPMRisks).mockResolvedValue(mockRisks as any);
    vi.mocked(fetchPMActivity).mockResolvedValue(mockActivity as any);
    vi.mocked(fetchPulseRecommendations).mockRejectedValue(new Error('Recommendations service timeout'));
    vi.mocked(fetchPulseBriefing).mockResolvedValue(mockBriefingProj1 as any);

    render(
      <MemoryRouter>
        <PMProjectPulsePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Project Pulse')).toBeInTheDocument();
    });

    // Switch to recommendations tab
    const recsTab = screen.getByRole('button', { name: /Recovery Recommendations/i });
    fireEvent.click(recsTab);

    // Displays inline recommendations error and retry button
    await waitFor(() => {
      expect(screen.getByText('Recommendations service timeout')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry loading recovery recommendations/i })).toBeInTheDocument();
    });
  });

  it('initializes with project from URL search parameters if provided', async () => {
    vi.mocked(fetchPMDashboardStats).mockResolvedValue(mockStats as any);
    vi.mocked(fetchPMRisks).mockResolvedValue(mockRisks as any);
    vi.mocked(fetchPMActivity).mockResolvedValue(mockActivity as any);
    vi.mocked(fetchPulseRecommendations).mockResolvedValue(mockRecsProj2 as any);
    vi.mocked(fetchPulseBriefing).mockResolvedValue(mockBriefingProj2 as any);

    render(
      <MemoryRouter initialEntries={['/dashboard/pm-project-pulse?project=proj-2']}>
        <PMProjectPulsePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('proj-2');
    });

    await waitFor(() => {
      expect(screen.getByText('Safe Deterministic Briefing')).toBeInTheDocument();
    });
  });

  it('supports keyboard navigation across intelligence tabs', async () => {
    vi.mocked(fetchPMDashboardStats).mockResolvedValue(mockStats as any);
    vi.mocked(fetchPMRisks).mockResolvedValue(mockRisks as any);
    vi.mocked(fetchPMActivity).mockResolvedValue(mockActivity as any);
    vi.mocked(fetchPulseRecommendations).mockResolvedValue(mockRecsProj1 as any);
    vi.mocked(fetchPulseBriefing).mockResolvedValue(mockBriefingProj1 as any);

    const { container } = render(
      <MemoryRouter>
        <PMProjectPulsePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Executive Project Briefing')).toBeInTheDocument();
    });

    const briefingTab = container.querySelector('#tab-briefing') as HTMLElement;
    const recsTab = container.querySelector('#tab-recommendations') as HTMLElement;
    expect(briefingTab).toBeInTheDocument();
    expect(recsTab).toBeInTheDocument();

    // Press ArrowRight on briefing tab to switch to recommendations
    fireEvent.keyDown(briefingTab, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(screen.getByText('Resolve Critical Risk: DB down')).toBeInTheDocument();
    });

    // Press ArrowLeft on recommendations tab to switch back to briefing
    fireEvent.keyDown(recsTab, { key: 'ArrowLeft' });

    await waitFor(() => {
      expect(screen.getByText('Executive Project Briefing')).toBeInTheDocument();
    });
  });

  it('refines recovery recommendations by removing duplicate cards and unifying each overdue task into a single card with top summary counts', async () => {
    const mockGroupedRecs = {
      project_id: 'proj-1',
      project_name: 'Project 1',
      health_score: 75,
      health_data_completeness: 'High',
      source: 'gemini',
      ai_status: 'SUCCESS',
      ai_notice: null,
      generated_at: '2026-10-11T12:00:00Z',
      recommendations: [
        {
          id: 'rec-1',
          category: 'RISK_MITIGATION',
          title: 'Resolve Critical Risk: DB down',
          explanation: 'Postgres primary database connection pool exhausted for API Migration, assigned to Dev One.',
          why_it_matters: 'Directly penalizes health score by 15 points and blocks sprint tasks.',
          missing_info_or_assumptions: 'Confirmation of failover replica status.',
          confidence: 'High',
          confidence_rationale: 'Derived from verified open risk and -15 health score penalty formula.',
          supporting_references: [
            { type: 'risk', id: 'risk-1', label: 'DB down' },
            { type: 'task', id: 'task-10', label: 'API Migration' },
          ],
        },
        {
          id: 'rec-2',
          category: 'TASK_REVIEW',
          title: 'Review Overdue Task: API Migration',
          explanation: 'Task is overdue by 2 days and assigned to Dev One.',
          why_it_matters: 'Delays backend release timeline.',
          missing_info_or_assumptions: 'Requires sync with assigned developer.',
          confidence: 'High',
          confidence_rationale: 'Defensible deterministic due date check.',
          supporting_references: [
            { type: 'task', id: 'task-10', label: 'API Migration' },
          ],
        },
        {
          id: 'rec-3',
          category: 'ALLOCATION_OPPORTUNITY',
          title: 'Consider Assigning Dev Two to Task: Auth Flow',
          explanation: 'Smart Allocation matched Dev Two with 92% compatibility based on skills and capacity.',
          why_it_matters: 'Accelerates completion of blocked auth components.',
          missing_info_or_assumptions: 'Verify availability during sprint.',
          confidence: 'High',
          confidence_rationale: 'Computed via Smart Allocation multi-factor scoring.',
          supporting_references: [
            { type: 'developer', id: 'dev-2', label: 'Dev Two (92% match)' },
            { type: 'task', id: 'task-20', label: 'Auth Flow' },
          ],
        },
      ],
    };

    vi.mocked(fetchPMDashboardStats).mockResolvedValue(mockStats as any);
    vi.mocked(fetchPMRisks).mockResolvedValue(mockRisks as any);
    vi.mocked(fetchPMActivity).mockResolvedValue(mockActivity as any);
    vi.mocked(fetchPulseRecommendations).mockResolvedValue(mockGroupedRecs as any);
    vi.mocked(fetchPulseBriefing).mockResolvedValue(mockBriefingProj1 as any);

    render(
      <MemoryRouter>
        <PMProjectPulsePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Executive Project Briefing')).toBeInTheDocument();
    });

    const recsTab = screen.getByRole('button', { name: /Recovery Recommendations/i });
    fireEvent.click(recsTab);

    // Verify Top Summary Metrics
    await waitFor(() => {
      expect(screen.getByText('Total High-Risk Items')).toBeInTheDocument();
      expect(screen.getByText('Total Overdue Tasks')).toBeInTheDocument();
    });

    // Verify Single Unified Card per Overdue Task (no duplicate cards)
    const overdueHeaders = screen.getAllByText('Review Overdue Task: API Migration');
    expect(overdueHeaders).toHaveLength(1);

    // Verify Combined Risk Information inside the single card
    expect(screen.getByText(/Resolve Critical Risk: DB down/i)).toBeInTheDocument();

    // Verify Developer, Status, and Due Date
    expect(screen.getAllByText('Dev One').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Specific Recommended Action:/i)).toBeInTheDocument();

    // Verify Action links
    expect(screen.getByRole('link', { name: /View Task →/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Inspect Risk →/i })).toBeInTheDocument();

    // Verify Expandable Evidence, Assumptions & Methodology
    expect(screen.getByText(/Hide Evidence & Assumptions/i)).toBeInTheDocument();

    // Verify Allocation Opportunities are preserved
    expect(screen.getByText('Consider Assigning Dev Two to Task: Auth Flow')).toBeInTheDocument();

    // Verify Shared Methodology Section is preserved and expandable
    const methodologyBtn = screen.getByText('Calculation Methodology & Health Penalty Rules');
    expect(methodologyBtn).toBeInTheDocument();
    fireEvent.click(methodologyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Critical Risk Deduction/i)).toBeInTheDocument();
      expect(screen.getByText(/-15 points/i)).toBeInTheDocument();
      expect(screen.getByText(/Overdue Task Deduction/i)).toBeInTheDocument();
      expect(screen.getByText(/-3 points/i)).toBeInTheDocument();
    });
  });
});
