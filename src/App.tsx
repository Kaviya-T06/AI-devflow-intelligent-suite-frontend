/**
 * Root application component — sets up routing and auth provider.
 */
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import RoleRoute from "./components/auth/RoleRoute";
import DashboardLayout from "./layouts/DashboardLayout";

// Pages
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import DashboardPage from "./pages/dashboard/DashboardPage";
import ProfilePage from "./pages/dashboard/ProfilePage";
import ComingSoonPage from "./pages/dashboard/ComingSoonPage";
import MyTasksPage from "./pages/dashboard/MyTasksPage";
import MyProjectsPage from "./pages/dashboard/MyProjectsPage";
import MyActivityPage from "./pages/dashboard/MyActivityPage";
import NotificationsPage from "./pages/dashboard/NotificationsPage";
import AdminUsersPage from "./pages/dashboard/AdminUsersPage";
import AdminProjectsPage from "./pages/dashboard/AdminProjectsPage";
import AdminTasksPage from "./pages/dashboard/AdminTasksPage";
import AdminActivityLogsPage from "./pages/dashboard/AdminActivityLogsPage";
import AdminWorkflowRisksPage from "./pages/dashboard/AdminWorkflowRisksPage";
import AdminRepositoriesPage from "./pages/dashboard/AdminRepositoriesPage";
import AdminSettingsPage from "./pages/dashboard/AdminSettingsPage";
import AnalyticsPage from "./pages/dashboard/AnalyticsPage";
// Project Manager pages
import PMProjectsPage from "./pages/dashboard/PMProjectsPage";
import PMTeamTasksPage from "./pages/dashboard/PMTeamTasksPage";
import PMActivityPage from "./pages/dashboard/PMActivityPage";
import PMGitHubIntegrationPage from "./pages/dashboard/PMGitHubIntegrationPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected dashboard routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/dashboard/profile" element={<ProfilePage />} />

              {/* Developer-only modules */}
              <Route
                element={
                  <RoleRoute allowedRoles={["DEVELOPER", "TEAM_MEMBER"]} />
                }
              >
                <Route path="/dashboard/my-tasks" element={<MyTasksPage />} />
                <Route
                  path="/dashboard/my-projects"
                  element={<MyProjectsPage />}
                />
                <Route
                  path="/dashboard/my-activity"
                  element={<MyActivityPage />}
                />
                <Route
                  path="/dashboard/notifications"
                  element={<NotificationsPage />}
                />
              </Route>

              {/* Project Manager modules */}
              <Route element={<RoleRoute allowedRoles={["MANAGER"]} />}>
                <Route
                  path="/dashboard/pm-projects"
                  element={<PMProjectsPage />}
                />
                <Route
                  path="/dashboard/pm-team-tasks"
                  element={<PMTeamTasksPage />}
                />
                <Route
                  path="/dashboard/pm-activity"
                  element={<PMActivityPage />}
                />
                <Route
                  path="/dashboard/github-integration"
                  element={<PMGitHubIntegrationPage />}
                />
              </Route>

              {/* Admin-only modules */}
              <Route element={<RoleRoute allowedRoles={["ADMIN"]} />}>
                <Route path="/dashboard/users" element={<AdminUsersPage />} />
                <Route
                  path="/dashboard/projects"
                  element={<AdminProjectsPage />}
                />
                <Route path="/dashboard/tasks" element={<AdminTasksPage />} />
                <Route
                  path="/dashboard/activity"
                  element={<AdminActivityLogsPage />}
                />
                <Route
                  path="/dashboard/workflow-risks"
                  element={<AdminWorkflowRisksPage />}
                />
                <Route
                  path="/dashboard/repositories"
                  element={<AdminRepositoriesPage />}
                />
                <Route
                  path="/dashboard/settings"
                  element={<AdminSettingsPage />}
                />
              </Route>

              {/* Future modules */}
              <Route path="/dashboard/analytics" element={<AnalyticsPage />} />
              <Route
                path="/dashboard/bottlenecks"
                element={<ComingSoonPage />}
              />
              <Route path="/dashboard/team" element={<ComingSoonPage />} />
              <Route path="/dashboard/history" element={<ComingSoonPage />} />
              <Route
                path="/dashboard/ai-insights"
                element={<ComingSoonPage />}
              />
            </Route>
          </Route>

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
