import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PMWorkflowRisksPage from '../PMWorkflowRisksPage';
import DeveloperWorkflowRisksPage from '../DeveloperWorkflowRisksPage';
import AdminWorkflowRisksPage from '../AdminWorkflowRisksPage';
import * as pmService from '../../../services/pmService';
import * as adminService from '../../../services/adminService';
import { useAuth } from '../../../context/AuthContext';
import '@testing-library/jest-dom';
import type { WorkflowRisk, WorkflowRiskMetrics } from '../../../types';

vi.mock('../../../services/pmService', () => ({
  fetchPMRisks: vi.fn(),
  fetchMyRisks: vi.fn(),
  fetchRiskMetrics: vi.fn(),
  fetchRiskDetail: vi.fn(),
  setRiskActionPlan: vi.fn(),
  addRiskComment: vi.fn(),
  escalateRisk: vi.fn(),
  resolveRisk: vi.fn(),
  reopenRisk: vi.fn(),
  assignRiskOwner: vi.fn(),
  updateRiskStatus: vi.fn(),
}));

vi.mock('../../../services/adminService', () => ({
  fetchAllRisks: vi.fn(),
  fetchAllProjects: vi.fn(),
  fetchRiskMetrics: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockRisk: WorkflowRisk = {
  id: 'risk-1',
  project_id: 'proj-1',
  project_name: 'AI Suite Enterprise',
  task_id: 'task-101',
  task_title: 'Implement Authentication & RBAC Engine',
  task_status: 'IN_PROGRESS',
  task_due_date: '2026-10-20T00:00:00Z',
  overdue_duration_days: 4,
  assignee_id: 'dev-1',
  assignee_name: 'Jane Developer',
  project_manager_id: 'pm-1',
  project_manager_name: 'Bob Manager',
  owner_id: 'pm-1',
  owner_name: 'Bob Manager',
  title: 'Task Overdue: Implement Authentication & RBAC Engine',
  description: 'Task is overdue by 4 days with high blocker potential.',
  risk_type: 'OVERDUE_TASK',
  severity: 'High',
  status: 'OPEN',
  detection_rule: 'RULE_TASK_OVERDUE',
  detection_reason: 'Due date passed without submission',
  severity_reason: 'Overdue duration exceeds 3 business days',
  detected_at: '2026-10-21T10:00:00Z',
  updated_at: '2026-10-24T12:00:00Z',
  is_resolved: false,
  is_escalated: false,
  is_recurring: false,
  recurrence_count: 0,
  corrective_action_plan: 'Reassign unblocked subtasks and complete PR review.',
  action_owner_id: 'pm-1',
  action_owner_name: 'Bob Manager',
  recovery_deadline: '2026-10-28T00:00:00Z',
  action_status: 'PENDING',
  is_action_overdue: false,
  comments_count: 2,
  comments: [
    {
      id: 'c-1',
      risk_id: 'risk-1',
      user_id: 'dev-1',
      user_name: 'Jane Developer',
      user_role: 'DEVELOPER',
      content: 'Awaiting backend schema migration before final push.',
      is_blocker: true,
      evidence_url: 'https://github.com/org/repo/pull/42',
      created_at: '2026-10-22T09:00:00Z',
    },
  ],
  history: [
    {
      id: 'h-1',
      risk_id: 'risk-1',
      action: 'DETECTED',
      user_name: 'System',
      timestamp: '2026-10-21T10:00:00Z',
      details: 'Risk detected by automatic background monitor.',
    },
  ],
};

const mockMetrics: WorkflowRiskMetrics = {
  total_risks: 1,
  open_risks: 1,
  in_progress_risks: 0,
  resolved_risks: 0,
  critical_count: 0,
  high_count: 1,
  medium_count: 0,
  low_count: 0,
  overdue_tasks_count: 1,
  review_delays_count: 0,
  stuck_tasks_count: 0,
  project_delays_count: 0,
  overdue_actions_count: 0,
  escalated_count: 0,
  recurring_count: 0,
  reopened_risks: 0,
  workload_risks_count: 0,
};

describe('Workflow Risks Layout & Modal Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.overflow = '';
    vi.mocked(useAuth).mockReturnValue({
      profile: {
        id: 'user-1',
        full_name: 'Test User',
        email: 'user@example.com',
        role: 'MANAGER',
      },
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
      refreshProfile: vi.fn(),
      loading: false,
    } as any);

    vi.mocked(pmService.fetchPMRisks).mockResolvedValue([mockRisk]);
    vi.mocked(pmService.fetchRiskMetrics).mockResolvedValue(mockMetrics);
    vi.mocked(pmService.fetchRiskDetail).mockResolvedValue(mockRisk);
    vi.mocked(pmService.fetchMyRisks).mockResolvedValue([mockRisk]);
    vi.mocked(adminService.fetchAllRisks).mockResolvedValue([mockRisk]);
    vi.mocked(adminService.fetchAllProjects).mockResolvedValue([
      { id: 'proj-1', name: 'AI Suite Enterprise', status: 'ACTIVE' } as any,
    ]);
    vi.mocked(adminService.fetchRiskMetrics).mockResolvedValue(mockMetrics);
  });

  describe('Project Manager Workflow Risks Page', () => {
    it('renders all 8 metric cards with responsive layout classes and non-overflowing text', async () => {
      render(<PMWorkflowRisksPage />);

      await waitFor(() => {
        expect(screen.getByText('Workflow Risks')).toBeInTheDocument();
      });

      // Verify the 8 cards exist
      const labels = [
        'Open',
        'In Progress',
        'High / Critical',
        'Escalated',
        'Overdue Tasks',
        'Stuck Tasks',
        'Review Delays',
        'Overdue Actions',
      ];

      for (const label of labels) {
        const el = screen.getByText(label);
        expect(el).toBeInTheDocument();
        // Check text container classes prevent overflow
        expect(el.className).toContain('break-words');
        expect(el.className).toContain('min-w-0');
      }

      // Verify the grid container uses responsive breakpoints
      const gridContainer = screen.getByText('Open').closest('.grid');
      expect(gridContainer).toBeInTheDocument();
      expect(gridContainer?.className).toContain('xl:grid-cols-8');
      expect(gridContainer?.className).toContain('grid-cols-2');
      expect(gridContainer?.className).toContain('sm:grid-cols-4');
    });

    it('opens Manage modal in a viewport-level portal centered with visible tabs and footer', async () => {
      render(<PMWorkflowRisksPage />);

      await waitFor(() => {
        expect(screen.getByText('Manage →')).toBeInTheDocument();
      });

      const manageBtn = screen.getByText('Manage →');
      fireEvent.click(manageBtn);

      await waitFor(() => {
        // Modal dialog role rendered
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        // Directly mounted in body (viewport portal)
        expect(dialog.parentElement).toBe(document.body);
        // Fixed positioning covering viewport
        expect(dialog.className).toContain('fixed inset-0');
        expect(dialog.className).toContain('items-center');
        expect(dialog.className).toContain('justify-center');
      });

      // Body overflow locked
      expect(document.body.style.overflow).toBe('hidden');

      // Verify tabs are rendered in fixed header
      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Action')).toBeInTheDocument();
      expect(screen.getByText(/Discussion/)).toBeInTheDocument();
      expect(screen.getByText(/Audit/)).toBeInTheDocument();

      // Verify footer actions are visible
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
      expect(screen.getByText('📋 Action Plan')).toBeInTheDocument();
      expect(screen.getByText('💬 Add Update')).toBeInTheDocument();
      expect(screen.getByText('🔺 Escalate')).toBeInTheDocument();
      expect(screen.getByText('✓ Resolve')).toBeInTheDocument();

      // Test Escape key closes modal and unlocks body scroll
      fireEvent.keyDown(window, { key: 'Escape' });
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('Developer Workflow Risks Page', () => {
    it('opens Take Action modal in viewport portal, switches tabs, and shows all content', async () => {
      vi.mocked(useAuth).mockReturnValue({
        profile: {
          id: 'dev-1',
          full_name: 'Jane Developer',
          email: 'jane@example.com',
          role: 'DEVELOPER',
        },
        isAuthenticated: true,
      } as any);

      render(<DeveloperWorkflowRisksPage />);

      await waitFor(() => {
        expect(screen.getByText('Take Action →')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Take Action →'));

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(dialog.parentElement).toBe(document.body);
      });

      // Switch to Discussion tab
      fireEvent.click(screen.getByText(/Discussion/));
      expect(screen.getByPlaceholderText(/Add a progress update/)).toBeInTheDocument();

      // Switch to Audit tab
      fireEvent.click(screen.getByText(/Audit/));
      expect(screen.getByText('Risk detected by automatic background monitor.')).toBeInTheDocument();

      // Switch to Action tab
      fireEvent.click(screen.getByText('Action'));
      expect(screen.getByText('Save Action Plan')).toBeInTheDocument();

      // Close modal
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Admin Workflow Risks Page', () => {
    it('opens Investigate modal in viewport portal and preserves Admin styling', async () => {
      vi.mocked(useAuth).mockReturnValue({
        profile: {
          id: 'admin-1',
          full_name: 'Admin User',
          email: 'admin@example.com',
          role: 'ADMIN',
        },
        isAuthenticated: true,
      } as any);

      render(<AdminWorkflowRisksPage />);

      await waitFor(() => {
        expect(screen.getByText('Investigate')).toBeInTheDocument();
      });

      // Verify Admin grid cards responsive class
      const adminCriticalCards = screen.getAllByText('Critical');
      const adminOpenCard = adminCriticalCards[0];
      const gridContainer = adminOpenCard.closest('.grid');
      expect(gridContainer?.className).toContain('xl:grid-cols-8');

      // Click Investigate
      fireEvent.click(screen.getByText('Investigate'));

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(dialog.parentElement).toBe(document.body);
      });

      // Verify title in modal heading and severity badge
      expect(screen.getByRole('heading', { name: /Task Overdue: Implement Authentication & RBAC Engine/ })).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toHaveTextContent('High');
      expect(screen.getByRole('dialog')).toHaveTextContent('OPEN');

      // Close via header button
      const closeBtn = screen.getByRole('button', { name: 'Close dialog' });
      fireEvent.click(closeBtn);
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });
});
