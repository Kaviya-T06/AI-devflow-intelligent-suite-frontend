import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '@testing-library/jest-dom';

import RoleRoute from '../../../components/auth/RoleRoute';
import PMPendingReviewsPage from '../PMPendingReviewsPage';
import * as AuthContextModule from '../../../context/AuthContext';
import * as taskSubmissionService from '../../../services/taskSubmissionService';
import * as adminService from '../../../services/adminService';

vi.mock('../../../services/taskSubmissionService', () => ({
  fetchPendingReviews: vi.fn(),
  reviewTask: vi.fn(),
  fetchTaskSubmissions: vi.fn(),
  fetchTaskGitHubEvidence: vi.fn(),
}));

vi.mock('../../../services/adminService', () => ({
  fetchAllProjects: vi.fn(),
}));

describe('RoleRoute and Pending Reviews Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows Project Manager (role: "MANAGER") to access /dashboard/pm-reviews', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'pm-1', name: 'Rahul', email: 'rahul@test.com', role: 'project_manager' },
      profile: {
        id: 'pm-1',
        full_name: 'Rahul Kumar',
        email: 'rahul@test.com',
        role: 'MANAGER',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      token: 'valid-token',
      isLoading: false,
      isAuthenticated: true,
      signOut: vi.fn(),
      refreshAuth: vi.fn(),
      refreshProfile: vi.fn(),
    });

    vi.mocked(taskSubmissionService.fetchPendingReviews).mockResolvedValue([
      {
        task_id: 'task-101',
        task_title: 'Auth Pipeline Refactor',
        task_description: 'Refactor JWT auth checks',
        priority: 'HIGH',
        status: 'REVIEW',
        project_name: 'Alpha Project',
        developer_name: 'Dev One',
        submission_count: 1,
        latest_submission: {
          id: 'sub-1',
          task_id: 'task-101',
          submitted_by: 'dev-1',
          work_summary: 'Finished unit tests and middleware',
          implementation_details: 'Added token validation',
          testing_performed: 'All 12 tests passed',
          submission_number: 1,
          status: 'PENDING',
          created_at: new Date().toISOString(),
          reviews: [],
        },
      },
    ]);
    vi.mocked(adminService.fetchAllProjects).mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={['/dashboard/pm-reviews']}>
        <Routes>
          <Route path="/dashboard" element={<div>Dashboard Home</div>} />
          <Route element={<RoleRoute allowedRoles={['MANAGER', 'ADMIN']} />}>
            <Route path="/dashboard/pm-reviews" element={<PMPendingReviewsPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Pending Reviews')).toBeInTheDocument();
      expect(screen.getByText('Auth Pipeline Refactor')).toBeInTheDocument();
      expect(screen.queryByText('Dashboard Home')).not.toBeInTheDocument();
    });
  });

  it('allows Admin (role: "ADMIN") to access /dashboard/pm-reviews', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'admin-1', name: 'Alice Admin', email: 'admin@test.com', role: 'admin' },
      profile: {
        id: 'admin-1',
        full_name: 'Alice Admin',
        email: 'admin@test.com',
        role: 'ADMIN',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      token: 'valid-admin-token',
      isLoading: false,
      isAuthenticated: true,
      signOut: vi.fn(),
      refreshAuth: vi.fn(),
      refreshProfile: vi.fn(),
    });

    vi.mocked(taskSubmissionService.fetchPendingReviews).mockResolvedValue([]);
    vi.mocked(adminService.fetchAllProjects).mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={['/dashboard/pm-reviews']}>
        <Routes>
          <Route path="/dashboard" element={<div>Dashboard Home</div>} />
          <Route element={<RoleRoute allowedRoles={['MANAGER', 'ADMIN']} />}>
            <Route path="/dashboard/pm-reviews" element={<PMPendingReviewsPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Pending Reviews')).toBeInTheDocument();
      expect(screen.getByText('All Caught Up!')).toBeInTheDocument();
      expect(screen.queryByText('Dashboard Home')).not.toBeInTheDocument();
    });
  });

  it('redirects Developer to /dashboard when attempting to access /dashboard/pm-reviews', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'dev-1', name: 'Dev One', email: 'dev@test.com', role: 'developer' },
      profile: {
        id: 'dev-1',
        full_name: 'Dev One',
        email: 'dev@test.com',
        role: 'DEVELOPER',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      token: 'valid-dev-token',
      isLoading: false,
      isAuthenticated: true,
      signOut: vi.fn(),
      refreshAuth: vi.fn(),
      refreshProfile: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/dashboard/pm-reviews']}>
        <Routes>
          <Route path="/dashboard" element={<div>Dashboard Home</div>} />
          <Route element={<RoleRoute allowedRoles={['MANAGER', 'ADMIN']} />}>
            <Route path="/dashboard/pm-reviews" element={<PMPendingReviewsPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Dashboard Home')).toBeInTheDocument();
      expect(screen.queryByText('Pending Reviews')).not.toBeInTheDocument();
    });
  });

  it('renders loading screen and avoids premature redirect when session is loading', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      profile: null,
      token: null,
      isLoading: true,
      isAuthenticated: false,
      signOut: vi.fn(),
      refreshAuth: vi.fn(),
      refreshProfile: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/dashboard/pm-reviews']}>
        <Routes>
          <Route path="/dashboard" element={<div>Dashboard Home</div>} />
          <Route element={<RoleRoute allowedRoles={['MANAGER', 'ADMIN']} />}>
            <Route path="/dashboard/pm-reviews" element={<PMPendingReviewsPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // RoleRoute shows loading screen without redirecting to /dashboard
    expect(screen.queryByText('Dashboard Home')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated user to /login', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      profile: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
      signOut: vi.fn(),
      refreshAuth: vi.fn(),
      refreshProfile: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/dashboard/pm-reviews']}>
        <Routes>
          <Route path="/login" element={<div>Login Screen</div>} />
          <Route path="/dashboard" element={<div>Dashboard Home</div>} />
          <Route element={<RoleRoute allowedRoles={['MANAGER', 'ADMIN']} />}>
            <Route path="/dashboard/pm-reviews" element={<PMPendingReviewsPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Login Screen')).toBeInTheDocument();
      expect(screen.queryByText('Pending Reviews')).not.toBeInTheDocument();
    });
  });
});
