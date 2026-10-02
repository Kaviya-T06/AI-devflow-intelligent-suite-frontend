import { useEffect, useState } from "react";
import { fetchAnalyticsData } from "../../services/analyticsService";
import type { AnalyticsDashboardData } from "../../services/analyticsService";
import { useAuth } from "../../context/AuthContext";
import type { UserRole } from "../../types";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

const StatCard = ({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) => (
  <div className="glass-card p-5">
    <div className="flex items-center justify-between mb-3">
      <span className="text-surface-500 text-xs font-medium uppercase tracking-wider">{label}</span>
      <span className="text-2xl">{icon}</span>
    </div>
    <p className={`text-3xl font-bold ${color}`}>{value}</p>
  </div>
);

export default function AnalyticsPage() {
  const { profile } = useAuth();
  const role = (profile?.role ?? "DEVELOPER") as UserRole;
  const isManagerOrAdmin = role === "ADMIN" || role === "MANAGER";

  const [data, setData] = useState<AnalyticsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalyticsData()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load analytics");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-surface-400">Loading analytics data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-danger-500/10 border border-danger-500/20 text-danger-400 p-4 rounded-lg flex items-center gap-3">
        <span className="text-xl">⚠️</span>
        <p>{error}</p>
      </div>
    );
  }

  if (!data) {
    return <div className="text-surface-400 text-center py-8">No analytics data available.</div>;
  }

  const { project_metrics, task_performance_metrics, team_workflow_metrics, workflow_trends } = data;

  // Prepare chart data
  const trendsLabels = workflow_trends.tasks_created_over_time.map((d) => d.date);
  const tasksCreatedData = workflow_trends.tasks_created_over_time.map((d) => d.value);
  const tasksCompletedData = workflow_trends.tasks_completed_over_time.map((d) => d.value);

  const lineChartData = {
    labels: trendsLabels,
    datasets: [
      {
        label: "Tasks Created",
        data: tasksCreatedData,
        borderColor: "rgba(168, 85, 247, 1)",
        backgroundColor: "rgba(168, 85, 247, 0.2)",
      },
      {
        label: "Tasks Completed",
        data: tasksCompletedData,
        borderColor: "rgba(34, 197, 94, 1)",
        backgroundColor: "rgba(34, 197, 94, 0.2)",
      },
    ],
  };

  const overdueLabels = workflow_trends.overdue_tasks_over_time.map((d) => d.date);
  const overdueData = workflow_trends.overdue_tasks_over_time.map((d) => d.value);

  const barChartData = {
    labels: overdueLabels,
    datasets: [
      {
        label: "Overdue Tasks",
        data: overdueData,
        backgroundColor: "rgba(239, 68, 68, 0.7)",
      },
    ],
  };
  
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        labels: { color: "#e2e8f0" }
      },
    },
    scales: {
      x: { ticks: { color: "#94a3b8" }, grid: { color: "#334155" } },
      y: { ticks: { color: "#94a3b8" }, grid: { color: "#334155" } },
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-surface-50">Workflow Analytics & Project Health</h2>
      </div>

      <div className="space-y-6">
        <h3 className="section-title">Project Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Total Tasks" value={project_metrics.total_tasks} icon="📋" color="text-primary-300" />
          <StatCard label="Completed Tasks" value={project_metrics.completed_tasks} icon="✅" color="text-success-300" />
          <StatCard label="Active Tasks" value={project_metrics.in_progress_tasks} icon="▶️" color="text-accent-300" />
          <StatCard label="Overdue Tasks" value={project_metrics.overdue_tasks} icon="⚠️" color="text-danger-300" />
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="section-title">Workflow Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <StatCard label="Completion Rate" value={`${task_performance_metrics.completion_rate.toFixed(1)}%`} icon="📈" color="text-success-300" />
          <StatCard label="Avg Completion Time" value={`${task_performance_metrics.average_completion_time_hours.toFixed(1)}h`} icon="⏱️" color="text-primary-300" />
          <StatCard label="Avg Review Time" value={`${task_performance_metrics.average_review_duration_hours.toFixed(1)}h`} icon="👀" color="text-accent-300" />
        </div>
      </div>

      {isManagerOrAdmin && team_workflow_metrics && team_workflow_metrics.developers.length > 0 && (
        <div className="space-y-6">
          <h3 className="section-title">Team Workflow Metrics</h3>
          <div className="glass-card overflow-hidden w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-700/50 text-surface-400 text-xs uppercase tracking-wider">
                  <th className="p-4 font-medium">Developer</th>
                  <th className="p-4 font-medium">Assigned</th>
                  <th className="p-4 font-medium">Completed</th>
                  <th className="p-4 font-medium">In Progress</th>
                  <th className="p-4 font-medium">Review</th>
                  <th className="p-4 font-medium">Overdue</th>
                  <th className="p-4 font-medium">Completion Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/50 text-sm">
                {team_workflow_metrics.developers.map((dev) => (
                  <tr key={dev.developer_id} className="hover:bg-surface-700/20 transition-colors">
                    <td className="p-4 text-surface-100">{dev.developer_name}</td>
                    <td className="p-4 text-surface-300">{dev.tasks_assigned}</td>
                    <td className="p-4 text-success-400">{dev.tasks_completed}</td>
                    <td className="p-4 text-accent-400">{dev.tasks_in_progress}</td>
                    <td className="p-4 text-warning-400">{dev.tasks_waiting_for_review}</td>
                    <td className="p-4 text-danger-400">{dev.overdue_tasks}</td>
                    <td className="p-4 text-primary-400">{dev.completion_rate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="section-title mb-4">Task Completion Trend</h3>
          {trendsLabels.length > 0 ? (
            <Line data={lineChartData} options={chartOptions} />
          ) : (
            <div className="text-surface-400 text-center py-8">Not enough data to display trend</div>
          )}
        </div>
        
        <div className="glass-card p-6">
          <h3 className="section-title mb-4">Overdue Task Trend</h3>
          {overdueLabels.length > 0 ? (
            <Bar data={barChartData} options={chartOptions} />
          ) : (
            <div className="text-surface-400 text-center py-8">Not enough data to display trend</div>
          )}
        </div>
      </div>
      
    </div>
  );
}
