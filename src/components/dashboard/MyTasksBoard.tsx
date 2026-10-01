import { useEffect, useState } from "react";
import { fetchAllTasks, updateTask } from "../../services/adminService";
import type { Task, TaskStatus } from "../../types";

export default function MyTasksBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllTasks();
      setTasks(data);
    } catch (err: any) {
      setError(err.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    try {
      await updateTask(taskId, { status: newStatus });
      await loadTasks();
    } catch (err: any) {
      alert("Error updating task: " + err.message);
    }
  }

  const isOverdue = (task: Task) => {
    if (!task.due_date || task.status === "COMPLETED") return false;
    return new Date() > new Date(task.due_date);
  };

  if (loading) {
    return <div className="text-surface-400 p-8 text-center animate-pulse">Loading tasks...</div>;
  }

  if (error) {
    return (
      <div className="bg-danger-500/10 border border-danger-500/20 text-danger-400 p-4 rounded-lg flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <p>{error}</p>
        </div>
        <button onClick={loadTasks} className="btn-secondary w-fit text-sm py-1.5">Retry</button>
      </div>
    );
  }

  const filteredTasks = tasks.filter(t => {
    if (priorityFilter !== "ALL" && t.priority !== priorityFilter) return false;
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const todoTasks = filteredTasks.filter(t => t.status === "TODO");
  const inProgressTasks = filteredTasks.filter(t => t.status === "IN_PROGRESS");
  const reviewTasks = filteredTasks.filter(t => t.status === "REVIEW");
  const completedTasks = filteredTasks.filter(t => t.status === "COMPLETED");
  const overdueTasks = filteredTasks.filter(isOverdue);

  const TaskCard = ({ task }: { task: Task }) => (
    <div 
      className={`glass-card p-4 flex flex-col gap-2 cursor-pointer hover:bg-surface-800/40 transition-colors ${isOverdue(task) ? 'border-danger-500/50' : ''}`}
      onClick={() => setSelectedTask(task)}
    >
      <div className="flex justify-between items-start">
        <h4 className="text-surface-100 font-semibold">{task.title}</h4>
        <span className={`text-xs px-2 py-1 rounded-full ${
          task.priority === 'CRITICAL' ? 'bg-danger-500/20 text-danger-300' :
          task.priority === 'HIGH' ? 'bg-warning-500/20 text-warning-300' :
          task.priority === 'MEDIUM' ? 'bg-primary-500/20 text-primary-300' :
          'bg-surface-700 text-surface-300'
        }`}>{task.priority}</span>
      </div>
      <p className="text-surface-400 text-sm line-clamp-2">{task.description || "No description"}</p>
      
      <div className="flex justify-between items-center mt-2 text-xs text-surface-500">
        <span>Due: {task.due_date ? new Date(task.due_date).toLocaleDateString() : "None"}</span>
        {isOverdue(task) && <span className="text-danger-400 font-semibold">Overdue!</span>}
      </div>

      <div className="mt-4 flex gap-2 justify-end border-t border-surface-700/50 pt-3" onClick={(e) => e.stopPropagation()}>
        {task.status === "TODO" && (
          <button onClick={() => handleStatusChange(task.id, "IN_PROGRESS")} className="btn-primary text-xs py-1.5 px-3">
            Start Task
          </button>
        )}
        {task.status === "IN_PROGRESS" && (
          <button onClick={() => handleStatusChange(task.id, "REVIEW")} className="btn-secondary text-xs py-1.5 px-3">
            Submit for Review
          </button>
        )}
        {task.status === "REVIEW" && (
          <>
            <button onClick={() => handleStatusChange(task.id, "IN_PROGRESS")} className="btn-secondary text-xs py-1.5 px-3">
              Needs Work
            </button>
            <button onClick={() => handleStatusChange(task.id, "COMPLETED")} className="btn-primary bg-success-500 hover:bg-success-600 text-xs py-1.5 px-3">
              Complete Task
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h3 className="section-title">My Tasks</h3>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <input 
            type="text" 
            placeholder="Search tasks..." 
            className="input-field max-w-xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select 
            className="input-field w-32" 
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="ALL">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>
      </div>

      {overdueTasks.length > 0 && (
        <div>
          <h4 className="text-danger-400 font-bold mb-3 flex items-center gap-2">
            <span>⚠️</span> Overdue Tasks ({overdueTasks.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {overdueTasks.map(t => <TaskCard key={t.id} task={t} />)}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* To Do Column */}
        <div className="space-y-4">
          <h4 className="font-semibold text-surface-300 flex items-center justify-between">
            To Do <span className="badge bg-surface-700">{todoTasks.length}</span>
          </h4>
          {todoTasks.map(t => <TaskCard key={t.id} task={t} />)}
          {todoTasks.length === 0 && <p className="text-surface-500 text-sm text-center py-4">No tasks to do.</p>}
        </div>

        {/* In Progress Column */}
        <div className="space-y-4">
          <h4 className="font-semibold text-primary-300 flex items-center justify-between">
            In Progress <span className="badge bg-primary-500/20 text-primary-300">{inProgressTasks.length}</span>
          </h4>
          {inProgressTasks.map(t => <TaskCard key={t.id} task={t} />)}
          {inProgressTasks.length === 0 && <p className="text-surface-500 text-sm text-center py-4">No tasks in progress.</p>}
        </div>

        {/* For Review Column */}
        <div className="space-y-4">
          <h4 className="font-semibold text-warning-300 flex items-center justify-between">
            For Review <span className="badge bg-warning-500/20 text-warning-300">{reviewTasks.length}</span>
          </h4>
          {reviewTasks.map(t => <TaskCard key={t.id} task={t} />)}
          {reviewTasks.length === 0 && <p className="text-surface-500 text-sm text-center py-4">No tasks for review.</p>}
        </div>

        {/* Completed Column */}
        <div className="space-y-4">
          <h4 className="font-semibold text-success-300 flex items-center justify-between">
            Completed <span className="badge bg-success-500/20 text-success-300">{completedTasks.length}</span>
          </h4>
          {completedTasks.map(t => <TaskCard key={t.id} task={t} />)}
          {completedTasks.length === 0 && <p className="text-surface-500 text-sm text-center py-4">No completed tasks.</p>}
        </div>
      </div>

      {/* Task Details Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedTask(null)}>
          <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-surface-700/50 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-surface-50">{selectedTask.title}</h2>
                <div className="flex items-center gap-3 mt-2">
                  <span className="badge bg-surface-700">{selectedTask.status.replace("_", " ")}</span>
                  <span className="badge bg-surface-700/50">{selectedTask.priority}</span>
                </div>
              </div>
              <button onClick={() => setSelectedTask(null)} className="text-surface-400 hover:text-surface-100">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 space-y-6 flex-1">
              <div>
                <h4 className="text-surface-400 text-xs font-semibold uppercase tracking-wider mb-2">Description</h4>
                <p className="text-surface-200 text-sm whitespace-pre-wrap">{selectedTask.description || "No description provided."}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-surface-400 text-xs">Due Date</p>
                  <p className="text-surface-100 text-sm">{selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString() : "None"}</p>
                </div>
                <div>
                  <p className="text-surface-400 text-xs">Created</p>
                  <p className="text-surface-100 text-sm">{selectedTask.created_at ? new Date(selectedTask.created_at).toLocaleDateString() : "Unknown"}</p>
                </div>
                <div>
                  <p className="text-surface-400 text-xs">Project</p>
                  <p className="text-surface-100 text-sm truncate">{selectedTask.project_id ? "View Project Details" : "None"}</p>
                </div>
              </div>

              {/* Workflow Timeline */}
              <div>
                <h4 className="text-surface-400 text-xs font-semibold uppercase tracking-wider mb-3">Workflow Timeline</h4>
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-surface-700 before:to-transparent">
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-surface-700 bg-surface-900 group-[.is-active]:border-primary-500 text-surface-400 group-[.is-active]:text-primary-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
                    </div>
                    <div className="w-[calc(100%-3rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-lg glass-card">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-surface-200 text-sm">Assigned</span>
                      </div>
                      <div className="text-surface-400 text-xs mt-1">{selectedTask.assigned_at ? new Date(selectedTask.assigned_at).toLocaleString() : "Not recorded"}</div>
                    </div>
                  </div>

                  <div className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group ${selectedTask.started_at ? 'is-active' : ''}`}>
                    <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-surface-700 bg-surface-900 group-[.is-active]:border-primary-500 text-surface-400 group-[.is-active]:text-primary-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
                    </div>
                    <div className="w-[calc(100%-3rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-lg glass-card">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-surface-200 text-sm">Started</span>
                      </div>
                      <div className="text-surface-400 text-xs mt-1">{selectedTask.started_at ? new Date(selectedTask.started_at).toLocaleString() : "Pending"}</div>
                    </div>
                  </div>

                  <div className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group ${selectedTask.review_started_at ? 'is-active' : ''}`}>
                    <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-surface-700 bg-surface-900 group-[.is-active]:border-primary-500 text-surface-400 group-[.is-active]:text-primary-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
                    </div>
                    <div className="w-[calc(100%-3rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-lg glass-card">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-surface-200 text-sm">Submitted for Review</span>
                      </div>
                      <div className="text-surface-400 text-xs mt-1">{selectedTask.review_started_at ? new Date(selectedTask.review_started_at).toLocaleString() : "Pending"}</div>
                    </div>
                  </div>

                  <div className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group ${selectedTask.completed_at ? 'is-active' : ''}`}>
                    <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-surface-700 bg-surface-900 group-[.is-active]:border-success-500 text-surface-400 group-[.is-active]:text-success-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    </div>
                    <div className="w-[calc(100%-3rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-lg glass-card">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-surface-200 text-sm">Completed</span>
                      </div>
                      <div className="text-surface-400 text-xs mt-1">{selectedTask.completed_at ? new Date(selectedTask.completed_at).toLocaleString() : "Pending"}</div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
            
            <div className="p-4 border-t border-surface-700/50 bg-surface-800/30 flex justify-end gap-3">
              <button onClick={() => setSelectedTask(null)} className="btn-secondary text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
