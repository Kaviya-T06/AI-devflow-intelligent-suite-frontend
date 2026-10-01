/**
 * Dashboard home page — role-based welcome + live Supabase stats for Admin.
 */
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import ComingSoonModule from "../../components/dashboard/ComingSoonModule";
import { checkBackendHealth } from "../../services/apiService";
import { fetchDashboardStats, fetchRecentActivity } from "../../services/adminService";
import type { UserRole } from "../../types";
import type { DashboardStats, } from "../../services/adminService";
import type { ActivityLog } from "../../types";

const ROLE_CONFIG: Record<UserRole, { title: string; subtitle: string; color: string; items: string[] }> = {
  ADMIN: {
    title: "System Administration",
    subtitle: "You have full access to manage the platform.",
    color: "from-purple-600/20 to-purple-500/5 border-purple-500/20",
    items: ["Manage user accounts and roles", "Monitor system health", "Configure platform settings"],
  },
  MANAGER: {
    title: "Project Management",
    subtitle: "Manage your projects and team performance.",
    color: "from-accent-600/20 to-accent-500/5 border-accent-500/20",
    items: ["Review project pipelines", "Track team velocity", "Monitor delivery timelines"],
  },
  DEVELOPER: {
    title: "Developer Workspace",
    subtitle: "Track your workflow and assigned work.",
    color: "from-primary-600/20 to-primary-500/5 border-primary-500/20",
    items: ["View your assigned tasks", "Monitor your workflow metrics", "Track your contribution history"],
  },
  TEAM_MEMBER: {
    title: "Team Member Workspace",
    subtitle: "View your tasks and team updates.",
    color: "from-primary-600/20 to-primary-500/5 border-primary-500/20",
    items: ["View assigned tasks", "Track your contributions", "Collaborate with your team"],
  },
};

const StatusDot = ({ ok }: { ok: boolean | null }) => {
  if (ok === null) return <div className="w-2 h-2 rounded-full bg-warning-400 animate-pulse" />;
  return <div className={`w-2 h-2 rounded-full ${ok ? "bg-success-400" : "bg-danger-400"}`} />;
};

const MODULE_PLACEHOLDERS = [
  {
    title: "Project Health",
    description: "Monitor overall project health scores, velocity trends, and risk indicators in real time.",
    milestone: "Milestone 2",
    icon: (<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>),
    accentColor: "text-danger-400",
  },
  {
    title: "Workflow Analytics",
    description: "Visualize sprint progress, commit frequency, PR cycle time, and deployment pipeline status.",
    milestone: "Milestone 2",
    icon: (<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>),
    accentColor: "text-accent-400",
  },
  {
    title: "Bottleneck Detection",
    description: "Automatically detect workflow impediments, stale PRs, blocked tickets, and team dependencies.",
    milestone: "Milestone 3",
    icon: (<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>),
    accentColor: "text-warning-400",
  },
  {
    title: "Team Activity",
    description: "Track individual and team contributions, code review activity, and collaboration patterns.",
    milestone: "Milestone 2",
    icon: (<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>),
    accentColor: "text-primary-400",
  },
  {
    title: "AI Insights",
    description: "AI-generated recommendations to improve team performance, reduce cycle time, and prevent burnout.",
    milestone: "Milestone 4",
    icon: (<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>),
    accentColor: "text-yellow-400",
  },
  {
    title: "Project History",
    description: "Maintain institutional memory with searchable project timelines, decisions, and retrospective data.",
    milestone: "Milestone 3",
    icon: (<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>),
    accentColor: "text-surface-400",
  },
];

// Admin stat card
function StatCard({ label, value, icon, color }: { label: string; value: number | null; icon: string; color: string }) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-surface-500 text-xs font-medium uppercase tracking-wider">{label}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      {value === null ? (
        <div className="h-8 w-16 bg-surface-700/60 rounded animate-pulse" />
      ) : (
        <p className={`text-3xl font-bold ${color}`}>{value}</p>
      )}
    </div>
  );
}

// Activity item
const ENTITY_ICONS: Record<string, string> = { user: "👤", project: "📁", task: "✅", risk: "⚠️", repository: "📦", default: "📋" };

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const role = (profile?.role ?? "ADMIN") as UserRole;
  const roleConfig = ROLE_CONFIG[role] ?? ROLE_CONFIG.DEVELOPER;
  const isAdmin = role === "ADMIN";
  const isManager = role === "MANAGER";
  const showStats = isAdmin || isManager;

  const [backendStatus, setBackendStatus] = useState<boolean | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);

  useEffect(() => {
    checkBackendHealth().then(() => setBackendStatus(true)).catch(() => setBackendStatus(false));
  }, []);

  useEffect(() => {
    if (showStats) {
      fetchDashboardStats()
        .then(setStats)
        .catch(err => setStatsError(err.message || "Failed to load dashboard stats"));
    }
    if (isAdmin) {
      fetchRecentActivity(5).then(setRecentActivity).catch(console.error);
    }
  }, [showStats, isAdmin]);

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-surface-50">
            {greeting}, {profile?.full_name?.split(" ")[0] || "there"} 👋
          </h2>
          <p className="text-surface-400 mt-1 text-sm">
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="glass-card px-4 py-2.5 flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <StatusDot ok={true} />
              <span className="text-xs text-surface-400">Supabase</span>
            </div>
            <div className="w-px h-4 bg-surface-700" />
            <div className="flex items-center gap-1.5">
              <StatusDot ok={backendStatus} />
              <span className="text-xs text-surface-400">Backend API</span>
            </div>
          </div>
        </div>
      </div>

      {/* Role card */}
      <div className={`glass-card bg-gradient-to-r ${roleConfig.color} p-6`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-bold text-surface-50">{roleConfig.title}</h3>
              <span className={role === "ADMIN" ? "badge-admin" : role === "MANAGER" ? "badge-manager" : "badge-developer"}>{role}</span>
            </div>
            <p className="text-surface-400 text-sm mb-4">{roleConfig.subtitle}</p>
            <ul className="space-y-2">
              {roleConfig.items.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-surface-300">
                  <svg className="w-4 h-4 text-primary-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Dashboard Stats (Admin / Manager) */}
      {showStats && (
        <div className="space-y-8">
          <div>
            <h3 className="section-title mb-4">Project Statistics</h3>
            {statsError ? (
              <div className="bg-danger-500/10 border border-danger-500/20 text-danger-400 p-4 rounded-lg flex items-center gap-3">
                <span className="text-xl">⚠️</span>
                <p>{statsError}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                <StatCard label="Total Projects" value={stats?.total_projects ?? null} icon="📁" color="text-primary-300" />
                <StatCard label="Active" value={stats?.active_projects ?? null} icon="▶️" color="text-success-300" />
                <StatCard label="Completed" value={stats?.completed_projects ?? null} icon="✅" color="text-accent-300" />
                <StatCard label="On Hold" value={stats?.on_hold_projects ?? null} icon="⏸️" color="text-warning-300" />
                <StatCard label="Planning" value={stats?.planning_projects ?? null} icon="📝" color="text-surface-300" />
                <StatCard label="Archived" value={stats?.archived_projects ?? null} icon="📦" color="text-surface-400" />
                <StatCard label="Avg Progress (%)" value={stats?.average_progress ?? null} icon="📊" color="text-primary-400" />
              </div>
            )}
          </div>

          {!statsError && stats?.recent_projects && stats.recent_projects.length > 0 && (
            <div>
              <h3 className="section-title mb-4">Recent Projects</h3>
              <div className="glass-card overflow-hidden divide-y divide-surface-700/30">
                {stats.recent_projects.map(p => (
                  <div key={p.id} className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">📁</span>
                      <div>
                        <p className="text-surface-100 font-medium text-sm">{p.name}</p>
                        <p className="text-surface-400 text-xs capitalize">{p.status.replace("_", " ")}</p>
                      </div>
                    </div>
                    <div className="text-right w-32">
                      <span className="text-surface-300 text-sm font-semibold">{p.progress}%</span>
                      <div className="w-full h-1.5 bg-surface-700 rounded-full mt-1.5">
                        <div className="h-full bg-primary-500 rounded-full transition-all duration-500" style={{ width: `${p.progress}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isAdmin && !statsError && (
            <div>
              <h3 className="section-title mb-4">Platform Overview</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                <StatCard label="Total Users" value={stats?.totalUsers ?? null} icon="👥" color="text-primary-300" />
                <StatCard label="Active Projects" value={stats?.activeProjects ?? null} icon="📁" color="text-success-300" />
                <StatCard label="Open Tasks" value={stats?.openTasks ?? null} icon="✅" color="text-accent-300" />
                <StatCard label="Workflow Risks" value={stats?.openRisks ?? null} icon="⚠️" color="text-warning-300" />
                <StatCard label="Repositories" value={stats?.connectedRepos ?? null} icon="📦" color="text-surface-300" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Admin recent activity */}
      {isAdmin && recentActivity.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Recent Activity</h3>
            <a href="/dashboard/activity" className="text-primary-400 text-xs hover:underline">View all →</a>
          </div>
          <div className="glass-card overflow-hidden divide-y divide-surface-700/30">
            {recentActivity.map((log) => (
              <div key={log.id} className="flex items-start gap-3 px-5 py-3.5">
                <span className="text-base mt-0.5">{ENTITY_ICONS[log.entity_type.toLowerCase()] ?? ENTITY_ICONS.default}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-surface-300 text-sm">{log.description}</p>
                  <p className="text-surface-600 text-xs mt-0.5">
                    {new Date(log.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Account info (non-admin) */}
      {!isAdmin && (
        <div>
          <h3 className="section-title mb-4">Your Account</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Email", value: profile?.email || user?.email || "—", icon: "📧" },
              { label: "Role", value: profile?.role || "—", icon: "🏷️" },
              { label: "Status", value: profile?.is_active ? "Active" : "Inactive", icon: "✅" },
            ].map((item) => (
              <div key={item.label} className="glass-card p-4">
                <p className="text-surface-500 text-xs font-medium mb-1 flex items-center gap-1.5">
                  <span>{item.icon}</span>{item.label}
                </p>
                <p className="text-surface-100 font-semibold text-sm truncate">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming modules */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <h3 className="section-title">Platform Modules</h3>
          <span className="badge bg-surface-700/50 text-surface-400 border border-surface-600/40">Modules unlock progressively</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {MODULE_PLACEHOLDERS.map((mod) => (
            <ComingSoonModule key={mod.title} {...mod} />
          ))}
        </div>
      </div>
    </div>
  );
}
