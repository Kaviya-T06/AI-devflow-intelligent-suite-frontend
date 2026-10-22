/**
 * StatusBadge — larger pill badge showing a user's availability label.
 * Shown in team presence lists, admin views, task assignment dropdowns.
 */
import type { AvailabilityStatus } from "../../types";
import { STATUS_CONFIG } from "../../services/presenceService";
import StatusDot from "./StatusDot";

interface StatusBadgeProps {
  status: AvailabilityStatus;
  showDot?: boolean;
  compact?: boolean;
  className?: string;
}

export default function StatusBadge({
  status,
  showDot = true,
  compact = false,
  className = "",
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.offline;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${config.bgClass} ${config.borderClass} text-surface-200 ${className}`}
    >
      {showDot && <StatusDot status={status} size="xs" showTitle={false} />}
      {!compact && config.label}
    </span>
  );
}
