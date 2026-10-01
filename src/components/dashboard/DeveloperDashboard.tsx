import { useEffect, useState } from "react";
import { fetchAllTasks, fetchAllProjects, fetchRecentActivity } from "../../services/adminService";
import type { Task, Project, ActivityLog } from "../../types";

export default function DeveloperDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchAllTasks(), fetchAllProjects(), fetchRecentActivity(5)])
      .then(([t, p, a]) => {
        setTasks(t);
        setProjects(p);
        setActivity(a);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="animate-pulse space-y-6">
      <div className="h-24 bg-surface-800 rounded-xl" />
      <div className="h-48 bg-surface-800 rounded-xl" />
    </div>;
  }

  const todo = tasks.filter(t => t.status === "TODO");
  const inProgress = tasks.filter(t => t.status === "IN_PROGRESS");
  const review = tasks.filter(t => t.status === "REVIEW");
  const completed = tasks.filter(t => t.status === "COMPLETED");
  
  const isOverdue = (task: Task) => {
    if (!task.due_date || task.status === "COMPLETED") return false;
    return new Date() > new Date(task.due_date);
  };
  const overdueTasks = tasks.filter(isOverdue);

  const upcomingTasks = tasks
    .filter(t => t.status !== "COMPLETED" && t.due_date && !isOverdue(t))
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
    .slice(0, 5);

  const StatCard = ({ label, value, color }: { label: string, value: number, color: string }) => (
    <div className={`glass-card p-4 border-l-4 ${color}`}>
      <p className="text-surface-400 text-xs font-medium uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-surface-50 mt-1">{value}</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Work Summary */}
      <div>
        <h3 className="section-title mb-4">Work Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard label="Total Tasks" value={tasks.length} color="border-surface-600" />
          <StatCard label="To Do" value={todo.length} color="border-surface-400" />
          <StatCard label="In Progress" value={inProgress.length} color="border-primary-500" />
          <StatCard label="For Review" value={review.length} color="border-warning-500" />
          <StatCard label="Completed" value={completed.length} color="border-success-500" />
          <StatCard label="Overdue" value={overdueTasks.length} color="border-danger-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Needs Attention */}
        <div>
          <h3 className="section-title mb-4 text-warning-400">Needs Attention (Overdue)</h3>
          <div className="glass-card overflow-hidden divide-y divide-surface-700/30">
            {overdueTasks.length === 0 ? (
              <p className="p-5 text-surface-400 text-sm text-center">You're all caught up!</p>
            ) : (
              overdueTasks.map(t => (
                <div key={t.id} className="p-4 flex items-center justify-between hover:bg-surface-800/50">
                  <div>
                    <p className="text-surface-100 font-medium text-sm">{t.title}</p>
                    <p className="text-surface-500 text-xs mt-1">Due {new Date(t.due_date!).toLocaleDateString()}</p>
                  </div>
                  <span className="badge bg-danger-500/20 text-danger-300">Overdue</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div>
          <h3 className="section-title mb-4">Upcoming Deadlines</h3>
          <div className="glass-card overflow-hidden divide-y divide-surface-700/30">
            {upcomingTasks.length === 0 ? (
              <p className="p-5 text-surface-400 text-sm text-center">No upcoming deadlines.</p>
            ) : (
              upcomingTasks.map(t => (
                <div key={t.id} className="p-4 flex items-center justify-between hover:bg-surface-800/50">
                  <div>
                    <p className="text-surface-100 font-medium text-sm">{t.title}</p>
                    <p className="text-surface-500 text-xs mt-1">Due {new Date(t.due_date!).toLocaleDateString()}</p>
                  </div>
                  <span className="badge bg-surface-700">{t.status.replace("_", " ")}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Current Projects Overview */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title">Current Projects</h3>
          <a href="/dashboard/my-projects" className="text-primary-400 text-xs hover:underline">View all →</a>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.slice(0, 4).map(p => (
            <div key={p.id} className="glass-card p-4 hover:bg-surface-800/50 transition-colors">
              <h4 className="text-surface-100 font-medium">{p.name}</h4>
              <p className="text-surface-400 text-xs line-clamp-1 mt-1">{p.description || "No description"}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="badge bg-surface-700/50 border-surface-600/30">{p.status.replace("_", " ")}</span>
                <span className="text-primary-400 font-semibold text-xs">{p.progress}%</span>
              </div>
            </div>
          ))}
          {projects.length === 0 && <p className="text-surface-400 text-sm py-4">No projects assigned.</p>}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title">Recent Activity</h3>
        </div>
        <div className="glass-card overflow-hidden divide-y divide-surface-700/30">
          {activity.length === 0 ? (
            <p className="p-5 text-surface-400 text-sm text-center">No recent activity.</p>
          ) : (
            activity.map(log => (
              <div key={log.id} className="p-4 flex items-start gap-3 hover:bg-surface-800/50 transition-colors">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-700 flex items-center justify-center text-xs">
                  {log.entity_type === 'task' ? '✅' : '📋'}
                </div>
                <div>
                  <p className="text-surface-100 text-sm">{log.description}</p>
                  <p className="text-surface-500 text-xs mt-1">
                    {new Date(log.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
