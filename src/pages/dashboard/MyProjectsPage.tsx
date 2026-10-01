import { useEffect, useState } from "react";
import { fetchAllProjects, fetchAllTasks } from "../../services/adminService";
import type { Project, Task } from "../../types";

export default function MyProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchAllProjects(), fetchAllTasks()])
      .then(([pData, tData]) => {
        setProjects(pData);
        setTasks(tData);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-32 bg-surface-800 rounded-xl" />
      <div className="h-32 bg-surface-800 rounded-xl" />
    </div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-surface-50">My Projects</h2>
        <p className="text-surface-400 text-sm mt-1">Projects you are contributing to.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {projects.length === 0 ? (
          <p className="text-surface-400 text-sm">No projects assigned yet.</p>
        ) : (
          projects.map(p => {
            const projectTasks = tasks.filter(t => t.project_id === p.id);
            const todo = projectTasks.filter(t => t.status === "TODO").length;
            const inProgress = projectTasks.filter(t => t.status === "IN_PROGRESS").length;
            const review = projectTasks.filter(t => t.status === "REVIEW").length;

            return (
              <div key={p.id} className="glass-card p-5 flex flex-col h-full">
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-bold text-surface-100">{p.name}</h3>
                    <span className="badge bg-surface-700/50">{p.status.replace("_", " ")}</span>
                  </div>
                  <p className="text-surface-400 text-sm mt-2 line-clamp-3">{p.description || "No description provided."}</p>
                </div>
                
                <div className="mt-4 p-3 bg-surface-800/30 rounded-lg">
                  <h4 className="text-xs font-semibold text-surface-300 uppercase tracking-wider mb-2">My Tasks Summary</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-surface-400">Total:</span>
                      <span className="font-medium text-surface-100">{projectTasks.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-surface-400">To Do:</span>
                      <span className="font-medium text-surface-100">{todo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-surface-400">In Progress:</span>
                      <span className="font-medium text-primary-400">{inProgress}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-surface-400">Review:</span>
                      <span className="font-medium text-warning-400">{review}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-surface-700/50">
                  <div className="flex justify-between text-xs text-surface-400 mb-1.5">
                    <span>Project Progress</span>
                    <span className="text-primary-400 font-semibold">{p.progress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-700 rounded-full">
                    <div className="h-full bg-primary-500 rounded-full transition-all duration-500" style={{ width: `${p.progress}%` }} />
                  </div>
                  <p className="text-xs text-surface-400 mt-2 text-center font-medium">
                    {p.completed_task_count ?? 0} / {p.task_count ?? 0} tasks completed overall
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
