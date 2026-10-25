/**
 * DashboardLayout — persistent sidebar + top header shell for all dashboard pages.
 */
import { useState, useEffect, type ReactNode } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchUnreadCount } from "../services/notificationService";
import { usePresence } from "../context/PresenceContext";
import StatusSelector from "../components/presence/StatusSelector";
import StatusDot from "../components/presence/StatusDot";
import type { UserRole } from "../types";
import { normalizeRole } from "../services/profileService";

export interface NavItem {
  id: string;
  label: string;
  path: string;
  available: boolean;
  roles?: UserRole[];
  icon: ReactNode;
}

const DashboardIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
    />
  </svg>
);
const UsersIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
    />
  </svg>
);
const ProjectsIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
    />
  </svg>
);
const TasksIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);
const ActivityIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);
const WorkflowRisksIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  </svg>
);
const AnalyticsIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
    />
  </svg>
);
const AIIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
    />
  </svg>
);
const PresenceIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const SettingsIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

const TeamTasksIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
    />
  </svg>
);

const GitHubIcon = () => (
  <svg
    className="w-5 h-5"
    fill="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.184 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0022 12.021C22 6.484 17.522 2 12 2z"
    />
  </svg>
);

const BellIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
    />
  </svg>
);

const ReviewIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
    />
  </svg>
);

export const ALL_NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    path: "/dashboard",
    available: true,
    icon: <DashboardIcon />,
  },
  {
    id: "notifications",
    label: "Notifications",
    path: "/dashboard/notifications",
    available: true,
    roles: ["ADMIN", "MANAGER", "DEVELOPER", "TEAM_MEMBER"],
    icon: <BellIcon />,
  },
  // Developer-only nav items
  {
    id: "my-tasks",
    label: "My Tasks",
    path: "/dashboard/my-tasks",
    available: true,
    roles: ["DEVELOPER", "TEAM_MEMBER"],
    icon: <TasksIcon />,
  },
  {
    id: "my-projects",
    label: "My Projects",
    path: "/dashboard/my-projects",
    available: true,
    roles: ["DEVELOPER", "TEAM_MEMBER"],
    icon: <ProjectsIcon />,
  },
  {
    id: "my-activity",
    label: "My Activity",
    path: "/dashboard/my-activity",
    available: true,
    roles: ["DEVELOPER", "TEAM_MEMBER"],
    icon: <ActivityIcon />,
  },
  {
    id: "my-risks",
    label: "My Workflow",
    path: "/dashboard/my-risks",
    available: true,
    roles: ["DEVELOPER", "TEAM_MEMBER"],
    icon: <WorkflowRisksIcon />,
  },
  // Manager-only nav items
  {
    id: "pm-project-pulse",
    label: "Project Pulse",
    path: "/dashboard/pm-project-pulse",
    available: true,
    roles: ["MANAGER"],
    icon: <AnalyticsIcon />,
  },
  {
    id: "pm-projects",
    label: "My Projects",
    path: "/dashboard/pm-projects",
    available: true,
    roles: ["MANAGER"],
    icon: <ProjectsIcon />,
  },
  {
    id: "pm-team-tasks",
    label: "Team Tasks",
    path: "/dashboard/pm-team-tasks",
    available: true,
    roles: ["MANAGER"],
    icon: <TeamTasksIcon />,
  },
  // Manager & Admin shared / role-specific nav items
  {
    id: "pm-pending-reviews",
    label: "Pending Reviews",
    path: "/dashboard/pm-reviews",
    available: true,
    roles: ["MANAGER", "ADMIN"],
    icon: <ReviewIcon />,
  },
  {
    id: "pm-smart-allocation",
    label: "Smart Allocation",
    path: "/dashboard/pm-smart-allocation",
    available: true,
    roles: ["MANAGER"],
    icon: <UsersIcon />,
  },
  {
    id: "pm-workflow-risks",
    label: "Workflow Risks",
    path: "/dashboard/pm-workflow-risks",
    available: true,
    roles: ["MANAGER"],
    icon: <WorkflowRisksIcon />,
  },
  {
    id: "pm-ai-continuity",
    label: "AI Continuity",
    path: "/dashboard/pm-ai-continuity",
    available: true,
    roles: ["MANAGER", "ADMIN"],
    icon: <AIIcon />,
  },
  {
    id: "github-integration",
    label: "GitHub Integration",
    path: "/dashboard/github-integration",
    available: true,
    roles: ["MANAGER", "ADMIN"],
    icon: <GitHubIcon />,
  },
  {
    id: "dev-ai-continuity",
    label: "AI Continuity",
    path: "/dashboard/ai-continuity",
    available: true,
    roles: ["DEVELOPER", "TEAM_MEMBER"],
    icon: <AIIcon />,
  },
  // Admin-only nav items
  {
    id: "users",
    label: "Users",
    path: "/dashboard/users",
    available: true,
    roles: ["ADMIN"],
    icon: <UsersIcon />,
  },
  {
    id: "projects",
    label: "Projects",
    path: "/dashboard/projects",
    available: true,
    roles: ["ADMIN"],
    icon: <ProjectsIcon />,
  },
  {
    id: "tasks",
    label: "Tasks",
    path: "/dashboard/tasks",
    available: true,
    roles: ["ADMIN"],
    icon: <TasksIcon />,
  },
  {
    id: "activity",
    label: "Activity Logs",
    path: "/dashboard/activity",
    available: true,
    roles: ["ADMIN"],
    icon: <ActivityIcon />,
  },
  {
    id: "workflow-risks",
    label: "Workflow Risks",
    path: "/dashboard/workflow-risks",
    available: true,
    roles: ["ADMIN"],
    icon: <WorkflowRisksIcon />,
  },
  {
    id: "settings",
    label: "Settings",
    path: "/dashboard/settings",
    available: true,
    roles: ["ADMIN"],
    icon: <SettingsIcon />,
  },
  // Future items
  {
    id: "analytics",
    label: "Analytics",
    path: "/dashboard/analytics",
    available: true,
    roles: ["ADMIN", "MANAGER", "DEVELOPER", "TEAM_MEMBER"],
    icon: <AnalyticsIcon />,
  },
  {
    id: "ai-insights",
    label: "AI Insights",
    path: "/dashboard/ai-insights",
    available: false,
    roles: [],
    icon: <AIIcon />,
  },
];

export const ROLE_NAV_ORDER: Record<UserRole, string[]> = {
  ADMIN: [
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
  ],
  MANAGER: [
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
  ],
  DEVELOPER: [
    "dashboard",
    "my-tasks",
    "my-projects",
    "dev-ai-continuity",
    "my-risks",
    "my-activity",
    "analytics",
    "notifications",
  ],
  TEAM_MEMBER: [
    "dashboard",
    "my-tasks",
    "my-projects",
    "dev-ai-continuity",
    "my-risks",
    "my-activity",
    "analytics",
    "notifications",
  ],
};

/**
 * Returns navigation items ordered by role workflow while guaranteeing 100% feature preservation.
 */
export function getNavItemsForRole(role: UserRole): NavItem[] {
  const applicableItems = ALL_NAV_ITEMS.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(role);
  });

  const itemMap = new Map<string, NavItem>();
  applicableItems.forEach((item) => itemMap.set(item.id, item));

  const preferredOrder = ROLE_NAV_ORDER[role] || [];
  const orderedItems: NavItem[] = [];

  for (const id of preferredOrder) {
    const item = itemMap.get(id);
    if (item) {
      orderedItems.push(item);
      itemMap.delete(id);
    }
  }

  // Safety fallback: append any remaining accessible items that weren't in the list
  for (const remainingItem of itemMap.values()) {
    orderedItems.push(remainingItem);
  }

  return orderedItems;
}

const RoleBadge = ({ role }: { role: UserRole }) => {
  const cls =
    role === "ADMIN"
      ? "badge-admin"
      : role === "MANAGER"
        ? "badge-manager"
        : "badge-developer";
  return <span className={cls}>{role}</span>;
};

function Sidebar({
  isOpen,
  onClose,
  role,
  unreadCount,
}: {
  isOpen: boolean;
  onClose: () => void;
  role: UserRole;
  unreadCount: number;
}) {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const { myPresence, loading: presenceLoading, error: presenceError, isReconnecting, updateStatus, clearStatus } = usePresence();
  const isAdmin = role === "ADMIN";
  const isManager = role === "MANAGER";

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  // Derive display name: profile → email prefix → "?"
  const displayName =
    profile?.full_name ||
    (user?.email
      ? user.email
          .split("@")[0]
          .replace(/[._-]/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
      : "");
  const displayEmail = profile?.email || user?.email || "";
  const initials = displayName
    ? displayName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : (displayEmail[0] ?? "A").toUpperCase();

  // Filter and order nav items based on role workflow
  const navItems = getNavItemsForRole(role);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={[
          "fixed top-0 left-0 h-full w-60 z-30 flex flex-col",
          "bg-surface-900 border-r border-surface-700/50",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-surface-700/50">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-glow shrink-0">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="gradient-text font-bold text-sm leading-tight">
              AI DevFlow Intelligence Suite
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-0.5">
          {isAdmin && (
            <p className="text-surface-600 text-xs font-semibold uppercase tracking-wider px-2 mb-2">
              Admin
            </p>
          )}
          {isManager && (
            <p className="text-surface-600 text-xs font-semibold uppercase tracking-wider px-2 mb-2">
              Project Manager
            </p>
          )}
          {!isAdmin && !isManager && (
            <p className="text-surface-600 text-xs font-semibold uppercase tracking-wider px-2 mb-2">
              Navigation
            </p>
          )}
          {navItems.map((item) => {
            if (item.available) {
              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  end={item.path === "/dashboard"}
                  className={({ isActive }) =>
                    isActive ? "nav-item-active" : "nav-item"
                  }
                  onClick={onClose}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.id === "notifications" && unreadCount > 0 && (
                    <span className="ml-auto bg-primary-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </NavLink>
              );
            }
            return (
              <div
                key={item.id}
                className="nav-item opacity-40 cursor-not-allowed"
                title="Coming soon"
              >
                {item.icon}
                <span>{item.label}</span>
                <span className="ml-auto text-xs text-surface-600 shrink-0">
                  Soon
                </span>
              </div>
            );
          })}
        </nav>

        {/* User profile & presence section */}
        <div className="border-t border-surface-700/50 p-2 space-y-1 shrink-0 bg-surface-900/50">
          <NavLink
            to="/dashboard/profile"
            className={({ isActive }) =>
              `flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${
                isActive
                  ? "bg-primary-500/15 border border-primary-500/20"
                  : "hover:bg-surface-800/60"
              }`
            }
            onClick={onClose}
          >
            <div className="relative shrink-0">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-600 to-accent-500 flex items-center justify-center text-white font-semibold text-xs">
                {initials}
              </div>
              {/* Online presence indicator dot on avatar */}
              <StatusDot
                presence={myPresence}
                size="xs"
                className="absolute -bottom-0.5 -right-0.5 border-2 border-surface-900"
              />
            </div>
            <div className="min-w-0 flex-1 flex items-center justify-between gap-1">
              <p className="text-surface-200 text-xs font-medium truncate">
                {displayName || "Admin"}
              </p>
              {(profile?.role || role) && (
                <span className="scale-90 origin-right shrink-0">
                  <RoleBadge role={profile?.role || role} />
                </span>
              )}
            </div>
          </NavLink>

          {/* Status selector - compact dropdown near bottom */}
          <div className="pt-0.5">
            <StatusSelector
              myPresence={myPresence}
              loading={presenceLoading}
              error={presenceError}
              isReconnecting={isReconnecting}
              onUpdate={updateStatus}
              onClear={clearStatus}
            />
          </div>

          {/* Team Presence compact navigation item with minimal vertical padding */}
          <NavLink
            to="/dashboard/team-presence"
            className={({ isActive }) =>
              `flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? "bg-primary-500/15 text-primary-300 border border-primary-500/20"
                  : "text-surface-400 hover:text-surface-200 hover:bg-surface-800/60"
              }`
            }
            onClick={onClose}
          >
            <span className="w-4 h-4 flex items-center justify-center shrink-0">
              <PresenceIcon />
            </span>
            <span>Team Presence</span>
          </NavLink>

          {/* Sign Out button - compact and visually consistent */}
          <button
            id="sidebar-logout"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium text-surface-400 hover:text-danger-300 hover:bg-danger-500/10 border border-surface-700/40 transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

function TopHeader({ onMenuClick, unreadCount }: { onMenuClick: () => void; unreadCount: number }) {
  const { profile } = useAuth();
  const { myPresence } = usePresence();
  const navigate = useNavigate();

  const initials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  return (
    <header className="h-14 bg-surface-900/80 backdrop-blur-md border-b border-surface-700/50 flex items-center gap-4 px-4 lg:px-6 sticky top-0 z-10">
      <button
        className="lg:hidden p-2 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-700/50 transition-colors"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>
      <div className="flex-1">
        <h1 className="gradient-text font-bold text-sm lg:text-base tracking-wide">
          AI DevFlow Intelligence Suite
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <button
          id="top-header-team-presence"
          onClick={() => navigate("/dashboard/team-presence")}
          aria-label="View team presence"
          title="Team Presence & Availability"
          className="p-2 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          <PresenceIcon />
        </button>
        <button
          id="top-header-notification-bell"
          onClick={() => navigate("/dashboard/notifications")}
          aria-label="View notifications"
          title={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
          className="relative p-2 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unreadCount > 0 && (
            <span
              id="notification-bell-badge"
              className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-primary-500 rounded-full animate-pulse border-2 border-surface-900"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => navigate("/dashboard/profile")}
          aria-label="View your profile"
          title="Your profile"
          className="relative w-8 h-8 rounded-full bg-gradient-to-br from-primary-600 to-accent-500 flex items-center justify-center text-white font-bold text-xs hover:ring-2 hover:ring-primary-400 hover:ring-offset-2 hover:ring-offset-surface-900 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-900"
        >
          {initials}
          <StatusDot
            presence={myPresence}
            size="xs"
            className="absolute -bottom-0.5 -right-0.5 border border-surface-900"
          />
        </button>
      </div>
    </header>
  );
}

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const { profile, user } = useAuth();
  const location = useLocation();
  const role = (profile?.role ?? (user?.role ? normalizeRole(user.role) : "DEVELOPER")) as UserRole;

  const isAIContinuity = location.pathname.includes("ai-continuity");

  useEffect(() => {
    let isMounted = true;
    const loadUnread = async () => {
      try {
        const count = await fetchUnreadCount();
        if (isMounted) setUnreadCount(count);
      } catch (err) {
        // Silent fallback
      }
    };
    loadUnread();
    const interval = setInterval(loadUnread, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className={`min-h-screen flex ${isAIContinuity ? "h-screen overflow-hidden" : ""}`}>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        role={role}
        unreadCount={unreadCount}
      />
      <div className={`flex-1 flex flex-col lg:ml-60 min-w-0 ${isAIContinuity ? "h-full overflow-hidden" : ""}`}>
        <TopHeader onMenuClick={() => setSidebarOpen(true)} unreadCount={unreadCount} />
        <main
          className={`flex-1 ${
            isAIContinuity
              ? "p-0 overflow-hidden flex flex-col min-h-0"
              : "p-4 lg:p-8 overflow-y-auto"
          }`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
