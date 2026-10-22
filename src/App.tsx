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
import PMProjectPulsePage from "./pages/dashboard/PMProjectPulsePage";
import PMTeamTasksPage from "./pages/dashboard/PMTeamTasksPage";
import PMActivityPage from "./pages/dashboard/PMActivityPage";
import PMGitHubIntegrationPage from "./pages/dashboard/PMGitHubIntegrationPage";
import PMWorkflowRisksPage from "./pages/dashboard/PMWorkflowRisksPage";
import PMSmartAllocationPage from "./pages/dashboard/PMSmartAllocationPage";
import PMWhatIfSimulatorPage from "./pages/dashboard/PMWhatIfSimulatorPage";
import PMPendingReviewsPage from "./pages/dashboard/PMPendingReviewsPage";
// Developer pages
import DeveloperWorkflowRisksPage from "./pages/dashboard/DeveloperWorkflowRisksPage";
import AIContinuityPage from "./pages/dashboard/AIContinuityPage";
import ProjectDetailPage from "./pages/dashboard/ProjectDetailPage";
import { useAuth } from "./context/AuthContext";
import LoadingScreen from "./components/ui/LoadingScreen";

function RootRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}

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
              <Route path="/dashboard/notifications" element={<NotificationsPage />} />
              <Route path="/dashboard/projects/:projectId" element={<ProjectDetailPage />} />
              <Route path="/dashboard/project/:projectId" element={<ProjectDetailPage />} />

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
                  path="/dashboard/ai-continuity"
                  element={<AIContinuityPage />}
                />
                <Route
                  path="/dashboard/my-risks"
                  element={<DeveloperWorkflowRisksPage />}
                />
              </Route>

              {/* Project Manager modules */}
              <Route element={<RoleRoute allowedRoles={["MANAGER"]} />}>
                <Route
                  path="/dashboard/pm-projects"
                  element={<PMProjectsPage />}
                />
                <Route
                  path="/dashboard/pm-project-pulse"
                  element={<PMProjectPulsePage />}
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
                  path="/dashboard/pm-workflow-risks"
                  element={<PMWorkflowRisksPage />}
                />
                <Route
                  path="/dashboard/pm-smart-allocation"
                  element={<PMSmartAllocationPage />}
                />
                <Route
                  path="/dashboard/pm-what-if-simulator"
                  element={<PMWhatIfSimulatorPage />}
                />
              </Route>

              {/* GitHub Integration — accessible to Managers and Admins */}
              <Route element={<RoleRoute allowedRoles={["MANAGER", "ADMIN"]} />}>
                <Route
                  path="/dashboard/github-integration"
                  element={<PMGitHubIntegrationPage />}
                />
              </Route>

              {/* Review & Oversight modules accessible to Managers and Admins */}
              <Route
                element={<RoleRoute allowedRoles={["MANAGER", "ADMIN"]} />}
              >
                <Route
                  path="/dashboard/pm-reviews"
                  element={<PMPendingReviewsPage />}
                />
              </Route>

              {/* PM and Admin AI Continuity module */}
              <Route element={<RoleRoute allowedRoles={["MANAGER", "ADMIN"]} />}>
                <Route
                  path="/dashboard/pm-ai-continuity"
                  element={<AIContinuityPage />}
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

          {/* Default routes: unauthenticated users redirect to /login; authenticated users go to /dashboard */}
          <Route path="/" element={<RootRoute />} />
          <Route path="*" element={<RootRoute />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
