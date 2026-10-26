import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';

import LoginPage from '../../auth/LoginPage';
import ProtectedRoute from '../../../components/auth/ProtectedRoute';
import * as authService from '../../../services/authService';
import { AuthProvider, useAuth } from '../../../context/AuthContext';

// Mock authService login & logout
vi.mock('../../../services/authService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/authService')>();
  return {
    ...actual,
    loginUser: vi.fn(),
    logoutUser: vi.fn(),
  };
});

function TestDashboardHub() {
  const { user } = useAuth();
  return (
    <div>
      <h1>Dashboard Hub</h1>
      <p data-testid="user-role">{user?.role}</p>
    </div>
  );
}

describe('Initial Route and Authentication Flow', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('1. opening root URL / displays the Login page by default (does not redirect to dashboard)', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<TestDashboardHub />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    // Shows Login page content
    expect(screen.getByText('Sign in to your workspace')).toBeInTheDocument();
    expect(screen.getByText('Choose your role to continue.')).toBeInTheDocument();
    // Does not redirect to dashboard
    expect(screen.queryByText('Dashboard Hub')).not.toBeInTheDocument();
  });

  it('2. unauthenticated access to protected route /dashboard redirects to /login', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<TestDashboardHub />} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    // Protected route redirects to login
    expect(screen.getByText('Sign in to your workspace')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard Hub')).not.toBeInTheDocument();
  });

  it('3. invalid, malformed, or expired token in localStorage is rejected and redirects to login', () => {
    // Put an expired / malformed token in localStorage
    localStorage.setItem('access_token', 'malformed.jwt.token');
    localStorage.setItem('auth_user', JSON.stringify({ id: 'pm-1', role: 'MANAGER', name: 'Test PM' }));

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<TestDashboardHub />} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    // Stale/invalid token is rejected and cleared
    expect(screen.getByText('Sign in to your workspace')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard Hub')).not.toBeInTheDocument();
    expect(localStorage.getItem('access_token')).toBeNull();
  });

  it('4. successful login redirects to /dashboard with authenticated role', async () => {
    // Generate valid future exp timestamp
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({ sub: 'dev-1', exp: futureExp }));
    const validJwt = `${header}.${payload}.signature`;

    vi.mocked(authService.loginUser).mockImplementation(async () => {
      localStorage.setItem('access_token', validJwt);
      localStorage.setItem('auth_user', JSON.stringify({ id: 'dev-1', name: 'Alice Dev', email: 'alice@test.com', role: 'DEVELOPER' }));
      return {
        access_token: validJwt,
        token_type: 'bearer',
        user: { id: 'dev-1', name: 'Alice Dev', email: 'alice@test.com', role: 'DEVELOPER' },
      };
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<TestDashboardHub />} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    // Select role to show form
    fireEvent.click(screen.getByText('Developer'));

    // Fill login form
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'alice@test.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Dashboard Hub')).toBeInTheDocument();
    });
    expect(screen.getByTestId('user-role')).toHaveTextContent('DEVELOPER');
  });

  it('5. logout clears authentication state and returns user to /login', async () => {
    function TestProtectedWithLogout() {
      const { signOut } = useAuth();
      return (
        <div>
          <h1>Dashboard Hub</h1>
          <button onClick={signOut}>Log Out</button>
        </div>
      );
    }

    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({ sub: 'pm-1', exp: futureExp }));
    const validJwt = `${header}.${payload}.signature`;

    localStorage.setItem('access_token', validJwt);
    localStorage.setItem('auth_user', JSON.stringify({ id: 'pm-1', name: 'Bob PM', email: 'bob@test.com', role: 'MANAGER' }));

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<TestProtectedWithLogout />} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Dashboard Hub')).toBeInTheDocument();

    // Click Log Out
    fireEvent.click(screen.getByText('Log Out'));

    await waitFor(() => {
      expect(screen.getByText('Sign in to your workspace')).toBeInTheDocument();
    });
    expect(screen.queryByText('Dashboard Hub')).not.toBeInTheDocument();
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('auth_user')).toBeNull();
  });
});
