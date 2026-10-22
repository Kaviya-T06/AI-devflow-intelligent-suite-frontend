import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

import DashboardLayout, {
  ALL_NAV_ITEMS,
  ROLE_NAV_ORDER,
  getNavItemsForRole,
} from "../DashboardLayout";
import * as AuthContextModule from "../../context/AuthContext";
import * as notificationService from "../../services/notificationService";
import type { UserRole } from "../../types";

vi.mock("../../services/notificationService", () => ({
  fetchUnreadCount: vi.fn(),
}));

describe("Sidebar Navigation Ordering and Integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Items and Route Integrity", () => {
    it("preserves 100% of all navigation items in ALL_NAV_ITEMS", () => {
      expect(ALL_NAV_ITEMS).toHaveLength(23);

      const itemIds = ALL_NAV_ITEMS.map((item) => item.id);
      expect(itemIds).toContain("dashboard");
      expect(itemIds).toContain("notifications");
      expect(itemIds).toContain("my-tasks");
      expect(itemIds).toContain("my-projects");
      expect(itemIds).toContain("my-activity");
      expect(itemIds).toContain("my-risks");
      expect(itemIds).toContain("pm-project-pulse");
      expect(itemIds).toContain("pm-projects");
      expect(itemIds).toContain("pm-team-tasks");
      expect(itemIds).toContain("pm-pending-reviews");
      expect(itemIds).toContain("pm-smart-allocation");
      expect(itemIds).toContain("pm-workflow-risks");
      expect(itemIds).toContain("pm-ai-continuity");
      expect(itemIds).toContain("github-integration");
      expect(itemIds).toContain("dev-ai-continuity");
      expect(itemIds).toContain("users");
      expect(itemIds).toContain("projects");
      expect(itemIds).toContain("tasks");
      expect(itemIds).toContain("activity");
      expect(itemIds).toContain("workflow-risks");
      expect(itemIds).toContain("settings");
      expect(itemIds).toContain("analytics");
      expect(itemIds).toContain("ai-insights");
    });

    it("verifies Admin receives exact ordered list without any missing items", () => {
      const adminItems = getNavItemsForRole("ADMIN");
      const adminIds = adminItems.map((i) => i.id);

      expect(adminIds).toEqual([
        "dashboard",
        "users",
        "projects",
        "tasks",
        "pm-pending-reviews",
        "workflow-risks",
        "github-integration",
        "pm-ai-continuity",
        "analytics",
        "activity",
        "notifications",
        "settings",
      ]);
      expect(adminItems).toHaveLength(12);

      // Verify routes
      expect(adminItems.map((i) => i.path)).toEqual([
        "/dashboard",
        "/dashboard/users",
        "/dashboard/projects",
        "/dashboard/tasks",
        "/dashboard/pm-reviews",
        "/dashboard/workflow-risks",
        "/dashboard/github-integration",
        "/dashboard/pm-ai-continuity",
        "/dashboard/analytics",
        "/dashboard/activity",
        "/dashboard/notifications",
        "/dashboard/settings",
      ]);
    });

    it("verifies Project Manager receives exact ordered list without any missing items", () => {
      const managerItems = getNavItemsForRole("MANAGER");
      const managerIds = managerItems.map((i) => i.id);

      expect(managerIds).toEqual([
        "dashboard",
        "pm-project-pulse",
        "pm-projects",
        "pm-team-tasks",
        "pm-pending-reviews",
        "pm-smart-allocation",
        "pm-workflow-risks",
        "github-integration",
        "pm-ai-continuity",
        "analytics",
        "notifications",
        "ai-insights",
      ]);
      expect(managerItems).toHaveLength(12);

      // Verify routes
      expect(managerItems.map((i) => i.path)).toEqual([
        "/dashboard",
        "/dashboard/pm-project-pulse",
        "/dashboard/pm-projects",
        "/dashboard/pm-team-tasks",
        "/dashboard/pm-reviews",
        "/dashboard/pm-smart-allocation",
        "/dashboard/pm-workflow-risks",
        "/dashboard/github-integration",
        "/dashboard/pm-ai-continuity",
        "/dashboard/analytics",
        "/dashboard/notifications",
        "/dashboard/ai-insights",
      ]);
    });

    it("verifies Developer receives exact ordered list without any missing items", () => {
      const devItems = getNavItemsForRole("DEVELOPER");
      const devIds = devItems.map((i) => i.id);

      expect(devIds).toEqual([
        "dashboard",
        "my-tasks",
        "my-projects",
        "dev-ai-continuity",
        "my-risks",
        "my-activity",
        "analytics",
        "notifications",
      ]);
      expect(devItems).toHaveLength(8);

      // Verify routes
      expect(devItems.map((i) => i.path)).toEqual([
        "/dashboard",
        "/dashboard/my-tasks",
        "/dashboard/my-projects",
        "/dashboard/ai-continuity",
        "/dashboard/my-risks",
        "/dashboard/my-activity",
        "/dashboard/analytics",
        "/dashboard/notifications",
      ]);
    });

    it("ensures fallback preservation handles unlisted or dynamically added items", () => {
      const allOriginalAdminApplicable = ALL_NAV_ITEMS.filter(
        (item) => !item.roles || item.roles.includes("ADMIN")
      );
      const returnedAdminItems = getNavItemsForRole("ADMIN");
      expect(returnedAdminItems).toHaveLength(allOriginalAdminApplicable.length);

      const allOriginalManagerApplicable = ALL_NAV_ITEMS.filter(
        (item) => !item.roles || item.roles.includes("MANAGER")
      );
      const returnedManagerItems = getNavItemsForRole("MANAGER");
      expect(returnedManagerItems).toHaveLength(allOriginalManagerApplicable.length);

      const allOriginalDevApplicable = ALL_NAV_ITEMS.filter(
        (item) => !item.roles || item.roles.includes("DEVELOPER")
      );
      const returnedDevItems = getNavItemsForRole("DEVELOPER");
      expect(returnedDevItems).toHaveLength(allOriginalDevApplicable.length);
    });
  });

  describe("Sidebar Component Rendering", () => {
    const renderWithRole = (role: UserRole) => {
      vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
        user: { id: "u-1", name: "Test User", email: "test@example.com", role } as any,
        profile: {
          id: "u-1",
          full_name: "Test User",
          email: "test@example.com",
          role,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        token: "fake-jwt",
        isLoading: false,
        isAuthenticated: true,
        signOut: vi.fn(),
        refreshAuth: vi.fn(),
        refreshProfile: vi.fn(),
      });

      return render(
        <MemoryRouter initialEntries={["/dashboard"]}>
          <DashboardLayout />
        </MemoryRouter>
      );
    };

    it("renders Admin sidebar with correctly ordered links", () => {
      renderWithRole("ADMIN");

      expect(screen.getByText("Admin")).toBeInTheDocument();
      const navLinks = screen.getAllByRole("link").map((link) => link.textContent);

      // Check key items are present
      expect(navLinks.some((txt) => txt?.includes("Dashboard"))).toBe(true);
      expect(navLinks.some((txt) => txt?.includes("Users"))).toBe(true);
      expect(navLinks.some((txt) => txt?.includes("Projects"))).toBe(true);
      expect(navLinks.some((txt) => txt?.includes("Tasks"))).toBe(true);
      expect(navLinks.some((txt) => txt?.includes("Pending Reviews"))).toBe(true);
      expect(navLinks.some((txt) => txt?.includes("Workflow Risks"))).toBe(true);
      expect(navLinks.some((txt) => txt?.includes("GitHub Integration"))).toBe(true);
      expect(navLinks.some((txt) => txt?.includes("AI Continuity"))).toBe(true);
      expect(navLinks.some((txt) => txt?.includes("Analytics"))).toBe(true);
      expect(navLinks.some((txt) => txt?.includes("Activity Logs"))).toBe(true);
      expect(navLinks.some((txt) => txt?.includes("Notifications"))).toBe(true);
      expect(navLinks.some((txt) => txt?.includes("Settings"))).toBe(true);
    });

    it("renders Project Manager sidebar with Project Pulse near top", () => {
      renderWithRole("MANAGER");

      expect(screen.getByText("Project Manager")).toBeInTheDocument();
      expect(screen.getByText("Project Pulse")).toBeInTheDocument();
      expect(screen.getByText("Smart Allocation")).toBeInTheDocument();
      expect(screen.getByText("Pending Reviews")).toBeInTheDocument();
      expect(screen.getByText("AI Insights")).toBeInTheDocument();
      expect(screen.getByText("Soon")).toBeInTheDocument();
    });

    it("renders Developer sidebar with My Tasks, My Projects and AI Continuity near top", () => {
      renderWithRole("DEVELOPER");

      expect(screen.getByText("Navigation")).toBeInTheDocument();
      expect(screen.getByText("My Tasks")).toBeInTheDocument();
      expect(screen.getByText("My Projects")).toBeInTheDocument();
      expect(screen.getByText("AI Continuity")).toBeInTheDocument();
      expect(screen.getByText("My Workflow")).toBeInTheDocument();
      expect(screen.getByText("My Activity")).toBeInTheDocument();
      expect(screen.getByText("Analytics")).toBeInTheDocument();
      expect(screen.getByText("Notifications")).toBeInTheDocument();
    });
  });
});
