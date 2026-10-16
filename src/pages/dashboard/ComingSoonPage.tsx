/**
 * Generic "Module Coming Soon" page used for all unimplemented nav routes.
 */
import { useLocation } from "react-router-dom";

const MODULE_MAP: Record<string, { title: string; description: string }> = {
  "/dashboard/projects": {
    title: "Projects",
    description: "Create and manage development projects, link GitHub repositories, and track project delivery.",
  },
  "/dashboard/workflow": {
    title: "Workflow",
    description: "Visualize your team's development workflow from idea to deployment.",
  },
  "/dashboard/analytics": {
    title: "Analytics",
    description: "Deep-dive metrics: sprint velocity, PR cycle time, deployment frequency, and more.",
  },
  "/dashboard/bottlenecks": {
    title: "Bottleneck Detection",
    description: "AI-powered detection of workflow impediments, stale reviews, and blocked work items.",
  },
  "/dashboard/team": {
    title: "Team",
    description: "Collaborate, review team contributions, and manage member roles and responsibilities.",
  },
  "/dashboard/history": {
    title: "Project History",
    description: "Searchable timeline of all project decisions and retrospective data.",
  },
  "/dashboard/ai-insights": {
    title: "AI Insights",
    description: "AI-generated recommendations to optimize velocity, reduce risk, and prevent team burnout.",
  },
  "/dashboard/settings": {
    title: "Settings",
    description: "Configure platform preferences, notification rules, and integration credentials.",
  },
};

export default function ComingSoonPage() {
  const location = useLocation();
  const info = MODULE_MAP[location.pathname] || {
    title: "This Module",
    description: "This section is under development and will be available soon.",
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
      <div className="coming-soon-card max-w-lg w-full">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-surface-700/60 border border-surface-600/40 flex items-center justify-center">
          <svg className="w-8 h-8 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>

        <div className="text-center">
          <h2 className="text-xl font-bold text-surface-100 mb-2">{info.title}</h2>
          <p className="text-surface-400 text-sm max-w-sm leading-relaxed">{info.description}</p>
        </div>

        <div className="flex items-center gap-2 px-5 py-2.5 bg-surface-700/40 rounded-full border border-surface-600/30">
          <div className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
          <span className="text-sm text-surface-400">
            Module will be available soon
          </span>
        </div>
      </div>
    </div>
  );
}
