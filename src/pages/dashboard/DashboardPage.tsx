/**
 * Dashboard home page — role-based welcome + live Supabase stats for Admin.
 */
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import DeveloperDashboard from "../../components/dashboard/DeveloperDashboard";
import ProjectManagerDashboard from "../../components/dashboard/ProjectManagerDashboard";
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
  const showStats = isAdmin; // Only Admin sees the full platform stats here; Manager has its own dashboard component

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);

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
      <div>
        <h2 className="text-2xl font-bold text-surface-50">
          {greeting}, {profile?.full_name?.split(" ")[0] || "there"} 👋
        </h2>
        <p className="text-surface-400 mt-1 text-sm">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
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

      {/* Project Manager Dashboard */}
      {isManager && <ProjectManagerDashboard />}

      {/* Developer Dashboard */}
      {!showStats && !isManager && <DeveloperDashboard />}

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

      {/* Account info (only show for managers, if any, or general if we want. But since DEVELOPER dashboard handles itself, we skip here) */}
      {!isAdmin && !showStats && false && (
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


    </div>
  );
}
