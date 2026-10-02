/**
 * DashboardLayout — persistent sidebar + top header shell for all dashboard pages.
 */
import { useState, type ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { UserRole } from "../types";

interface NavItem {
  id: string;
  label: string;
  path: string;
  available: boolean;
  roles?: UserRole[];
  icon: ReactNode;
}

const DashboardIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>);
const UsersIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>);
const ProjectsIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>);
const TasksIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const ActivityIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const WorkflowRisksIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>);
const RepositoriesIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>);
const AnalyticsIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>);
const AIIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>);
const SettingsIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>);

const TeamTasksIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>);

const ALL_NAV_ITEMS: NavItem[] = [
  { id: "dashboard",       label: "Dashboard",       path: "/dashboard",                    available: true,  icon: <DashboardIcon />      },
  // Developer-only nav items
  { id: "my-tasks",        label: "My Tasks",        path: "/dashboard/my-tasks",           available: true,  roles: ["DEVELOPER"], icon: <TasksIcon />           },
  { id: "my-projects",     label: "My Projects",     path: "/dashboard/my-projects",        available: true,  roles: ["DEVELOPER"], icon: <ProjectsIcon />        },
  { id: "my-activity",     label: "My Activity",     path: "/dashboard/my-activity",        available: true,  roles: ["DEVELOPER"], icon: <ActivityIcon />        },
  { id: "notifications",   label: "Notifications",   path: "/dashboard/notifications",      available: true,  roles: ["DEVELOPER"], icon: <WorkflowRisksIcon />   },
  // Manager-only nav items
  { id: "pm-projects",     label: "My Projects",     path: "/dashboard/pm-projects",        available: true,  roles: ["MANAGER"], icon: <ProjectsIcon />        },
  { id: "pm-team-tasks",   label: "Team Tasks",      path: "/dashboard/pm-team-tasks",      available: true,  roles: ["MANAGER"], icon: <TeamTasksIcon />       },
  { id: "pm-activity",     label: "Project Activity", path: "/dashboard/pm-activity",       available: true,  roles: ["MANAGER"], icon: <ActivityIcon />        },
  // Admin-only nav items
  { id: "users",           label: "Users",            path: "/dashboard/users",              available: true,  roles: ["ADMIN"], icon: <UsersIcon />           },
  { id: "projects",        label: "Projects",         path: "/dashboard/projects",           available: true,  roles: ["ADMIN"], icon: <ProjectsIcon />        },
  { id: "tasks",           label: "Tasks",            path: "/dashboard/tasks",              available: true,  roles: ["ADMIN"], icon: <TasksIcon />           },
  { id: "activity",        label: "Activity Logs",    path: "/dashboard/activity",           available: true,  roles: ["ADMIN"], icon: <ActivityIcon />        },
  { id: "workflow-risks",  label: "Workflow Risks",   path: "/dashboard/workflow-risks",     available: true,  roles: ["ADMIN"], icon: <WorkflowRisksIcon />   },
  { id: "repositories",   label: "Repositories",     path: "/dashboard/repositories",       available: true,  roles: ["ADMIN"], icon: <RepositoriesIcon />    },
  { id: "settings",        label: "Settings",         path: "/dashboard/settings",           available: true,  roles: ["ADMIN"], icon: <SettingsIcon />        },
  // Future items
  { id: "analytics",      label: "Analytics",        path: "/dashboard/analytics",          available: true, roles: ["ADMIN", "MANAGER", "DEVELOPER"], icon: <AnalyticsIcon />       },
  { id: "ai-insights",    label: "AI Insights",       path: "/dashboard/ai-insights",        available: false, roles: ["ADMIN"], icon: <AIIcon />              },
];


const RoleBadge = ({ role }: { role: UserRole }) => {
  const cls = role === "ADMIN" ? "badge-admin" : role === "MANAGER" ? "badge-manager" : "badge-developer";
  return <span className={cls}>{role}</span>;
};

function Sidebar({ isOpen, onClose, role }: { isOpen: boolean; onClose: () => void; role: UserRole }) {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const isAdmin = role === "ADMIN";
  const isManager = role === "MANAGER";

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  // Derive display name: profile → email prefix → "?"
  const displayName = profile?.full_name ||
    (user?.email ? user.email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "");
  const displayEmail = profile?.email || user?.email || "";
  const initials = displayName
    ? displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : (displayEmail[0] ?? "A").toUpperCase();

  // Filter nav items based on role
  const navItems = ALL_NAV_ITEMS.filter((item) => {
    if (!item.roles) return true; // available to all
    return item.roles.includes(role);
  });

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={onClose} />}

      <aside className={["fixed top-0 left-0 h-full w-64 z-30 flex flex-col", "bg-surface-900 border-r border-surface-700/50", "transition-transform duration-300 ease-in-out", isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"].join(" ")}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-surface-700/50">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-glow shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
          </div>
          <div className="min-w-0">
            <p className="gradient-text font-bold text-sm leading-none">AI DevFlow</p>
            <p className="text-surface-500 text-xs mt-0.5 truncate">Intelligence Suite</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
          {isAdmin && <p className="text-surface-600 text-xs font-semibold uppercase tracking-wider px-2 mb-2">Admin</p>}
          {isManager && <p className="text-surface-600 text-xs font-semibold uppercase tracking-wider px-2 mb-2">Project Manager</p>}
          {!isAdmin && !isManager && <p className="text-surface-600 text-xs font-semibold uppercase tracking-wider px-2 mb-2">Navigation</p>}
          {navItems.map((item) => {
            if (item.available) {
              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  end={item.path === "/dashboard"}
                  className={({ isActive }) => isActive ? "nav-item-active" : "nav-item"}
                  onClick={onClose}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              );
            }
            return (
              <div key={item.id} className="nav-item opacity-40 cursor-not-allowed" title="Coming in next milestone">
                {item.icon}
                <span>{item.label}</span>
                <span className="ml-auto text-xs text-surface-600 shrink-0">Soon</span>
              </div>
            );
          })}
        </nav>

        {/* User profile */}
        <div className="border-t border-surface-700/50 p-3">
          <NavLink
            to="/dashboard/profile"
            className={({ isActive }) => `flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 ${isActive ? "bg-primary-500/15 border border-primary-500/20" : "hover:bg-surface-700/50"}`}
            onClick={onClose}
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-600 to-accent-500 flex items-center justify-center text-white font-bold text-sm shrink-0">{initials}</div>
            <div className="min-w-0 flex-1">
              <p className="text-surface-200 text-sm font-medium truncate">{displayName || "Admin"}</p>
              <p className="text-surface-500 text-xs truncate">{displayEmail}</p>
            </div>
          </NavLink>
          {(profile?.role || role) && <div className="px-3 pb-1 pt-0.5"><RoleBadge role={profile?.role || role} /></div>}
          <button id="sidebar-logout" onClick={handleLogout} className="btn-danger w-full mt-2 text-sm py-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

function TopHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const { profile } = useAuth();
  return (
    <header className="h-16 bg-surface-900/80 backdrop-blur-md border-b border-surface-700/50 flex items-center gap-4 px-4 lg:px-6 sticky top-0 z-10">
      <button className="lg:hidden p-2 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-700/50 transition-colors" onClick={onMenuClick} aria-label="Open navigation">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>
      <div className="flex-1">
        <h1 className="text-surface-100 font-semibold text-sm lg:text-base">AI DevFlow <span className="text-surface-500 font-normal">Intelligence Suite</span></h1>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden sm:flex badge bg-primary-500/15 text-primary-300 border border-primary-500/20">Milestone 3</span>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-600 to-accent-500 flex items-center justify-center text-white font-bold text-xs">
          {profile?.full_name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
        </div>
      </div>
    </header>
  );
}

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile } = useAuth();
  // Default to ADMIN when profile hasn't loaded yet (pre-DB: fallback profile synthesized in profileService)
  const role = (profile?.role ?? "ADMIN") as UserRole;

  return (
    <div className="min-h-screen flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} role={role} />
      <div className="flex-1 flex flex-col lg:ml-64 min-w-0">
        <TopHeader onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
