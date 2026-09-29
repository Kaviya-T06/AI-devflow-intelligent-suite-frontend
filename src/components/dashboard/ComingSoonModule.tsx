/**
 * ComingSoonModule — reusable placeholder card for future dashboard modules.
 */
import type { ReactNode } from "react";

interface ComingSoonModuleProps {
  title: string;
  description: string;
  milestone?: string;
  icon?: ReactNode;
  accentColor?: string;
}

const DefaultIcon = () => (
  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
  </svg>
);

export default function ComingSoonModule({
  title,
  description,
  milestone = "Milestone 2",
  icon,
  accentColor = "text-primary-400",
}: ComingSoonModuleProps) {
  return (
    <div className="coming-soon-card">
      <div className={`${accentColor} opacity-60`}>
        {icon || <DefaultIcon />}
      </div>
      <div>
        <h3 className="section-title mb-1">{title}</h3>
        <p className="section-subtitle max-w-xs">{description}</p>
      </div>
      <div className="flex items-center gap-2 px-4 py-2 bg-surface-700/50 rounded-full border border-surface-600/40">
        <div className="w-1.5 h-1.5 rounded-full bg-warning-400 animate-pulse" />
        <span className="text-xs text-surface-400 font-medium">
          Available in {milestone}
        </span>
      </div>
    </div>
  );
}
