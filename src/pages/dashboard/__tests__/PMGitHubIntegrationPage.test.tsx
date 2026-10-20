import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PMGitHubIntegrationPage from '../PMGitHubIntegrationPage';
import { fetchManagedProjects } from '../../../services/pmService';
import { fetchAllProjects } from '../../../services/adminService';
import {
  getProjectRepository,
  getCommits,
  getPullRequests,
  getIssues,
  getBranches,
} from '../../../services/githubService';
import { useAuth } from '../../../context/AuthContext';
import '@testing-library/jest-dom';

vi.mock('../../../services/pmService', () => ({
  fetchManagedProjects: vi.fn(),
}));

vi.mock('../../../services/adminService', () => ({
  fetchAllProjects: vi.fn(),
}));

vi.mock('../../../services/githubService', () => ({
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

vi.mock('../../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockProjects = [
  {
    id: 'proj-healthcare',
    name: 'Healthcare Management Platform',
    status: 'active',
  },
  {
    id: 'proj-employee',
    name: 'Employee Management Portal',
    status: 'active',
  },
  {
    id: 'proj-unconnected',
    name: 'Unconnected Project',
    status: 'active',
  },
];

const mockHealthcareRepo = {
  id: 'repo-health',
  project_id: 'proj-healthcare',
  owner: 'Healthcare-Org',
  repository_name: 'healthcare-management-platform',
  full_name: 'Healthcare-Org/healthcare-management-platform',
  html_url: 'https://github.com/Healthcare-Org/healthcare-management-platform',
  default_branch: 'main',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockEmployeeRepo = {
  id: 'repo-emp',
  project_id: 'proj-employee',
  owner: 'Devflow-Intelligent',
  repository_name: 'Employee-Management-Portal',
  full_name: 'Devflow-Intelligent/Employee-Management-Portal',
  html_url: 'https://github.com/Devflow-Intelligent/Employee-Management-Portal',
  default_branch: 'develop',
  created_at: '2026-02-01T00:00:00Z',
  updated_at: '2026-02-01T00:00:00Z',
};

describe('PMGitHubIntegrationPage - Project Switching & Repository Mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      profile: { id: 'pm-1', role: 'PROJECT_MANAGER', name: 'Test PM' },
    } as any);
    vi.mocked(fetchManagedProjects).mockResolvedValue(mockProjects as any);
    vi.mocked(getCommits).mockResolvedValue([]);
    vi.mocked(getPullRequests).mockResolvedValue([]);
    vi.mocked(getIssues).mockResolvedValue([]);
    vi.mocked(getBranches).mockResolvedValue([]);
  });

  it('displays "No GitHub repository connected" state when selected project has no repo', async () => {
    vi.mocked(getProjectRepository).mockResolvedValue(null);

    render(<PMGitHubIntegrationPage projectId="proj-unconnected" />);

    await waitFor(() => {
      expect(screen.getByText('No GitHub repository connected')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Connect GitHub Repository/i })).toBeInTheDocument();
    });
  });

  it('fetches and renders exact repository details corresponding to selected project', async () => {
    vi.mocked(getProjectRepository).mockImplementation(async (pid) => {
      if (pid === 'proj-healthcare') return mockHealthcareRepo as any;
      if (pid === 'proj-employee') return mockEmployeeRepo as any;
      return null;
    });

    render(<PMGitHubIntegrationPage projectId="proj-healthcare" />);

    await waitFor(() => {
      expect(screen.getByText('Healthcare-Org/healthcare-management-platform')).toBeInTheDocument();
      expect(screen.queryByText('Devflow-Intelligent/Employee-Management-Portal')).not.toBeInTheDocument();
    });
  });

  it('clears previous repository and loads new repo without stale data pollution when switching projects', async () => {
    vi.mocked(getProjectRepository).mockImplementation(async (pid) => {
      if (pid === 'proj-healthcare') return mockHealthcareRepo as any;
      if (pid === 'proj-employee') return mockEmployeeRepo as any;
      return null;
    });

    render(<PMGitHubIntegrationPage />);

    // Wait for projects list and first project's repo to load
    await waitFor(() => {
      expect(screen.getByText('Healthcare-Org/healthcare-management-platform')).toBeInTheDocument();
    });

    // Switch to Employee Management Portal
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'proj-employee' } });

    await waitFor(() => {
      expect(screen.getByText('Devflow-Intelligent/Employee-Management-Portal')).toBeInTheDocument();
      expect(screen.queryByText('Healthcare-Org/healthcare-management-platform')).not.toBeInTheDocument();
    });

    // Switch to unconnected project
    fireEvent.change(select, { target: { value: 'proj-unconnected' } });

    await waitFor(() => {
      expect(screen.getByText('No GitHub repository connected')).toBeInTheDocument();
      expect(screen.queryByText('Devflow-Intelligent/Employee-Management-Portal')).not.toBeInTheDocument();
      expect(screen.queryByText('Healthcare-Org/healthcare-management-platform')).not.toBeInTheDocument();
    });
  });

  it('prevents stale asynchronous responses from overwriting newly selected project data', async () => {
    let resolveFirstRequest: (value: any) => void;
    const slowFirstPromise = new Promise((resolve) => {
      resolveFirstRequest = resolve;
    });

    vi.mocked(getProjectRepository).mockImplementation(async (pid) => {
      if (pid === 'proj-healthcare') {
        return slowFirstPromise;
      }
      if (pid === 'proj-employee') {
        return mockEmployeeRepo as any;
      }
      return null;
    });

    render(<PMGitHubIntegrationPage />);

    // Wait until select dropdown has rendered the projects
    await waitFor(() => {
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('proj-healthcare');
    });

    // Fast switch to Employee Management Portal while Healthcare request is still pending
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'proj-employee' } });

    // Verify Employee Management Portal repo is displayed
    await waitFor(() => {
      expect(screen.getByText('Devflow-Intelligent/Employee-Management-Portal')).toBeInTheDocument();
    });

    // Now resolve the earlier slow Healthcare request
    resolveFirstRequest!(mockHealthcareRepo);

    // Stale Healthcare data should NOT overwrite current Employee Management Portal view
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.getByText('Devflow-Intelligent/Employee-Management-Portal')).toBeInTheDocument();
    expect(screen.queryByText('Healthcare-Org/healthcare-management-platform')).not.toBeInTheDocument();
  });
});
