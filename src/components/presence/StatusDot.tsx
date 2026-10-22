/**
 * StatusDot — compact presence indicator dot.
 * Renders a colored dot representing the effective status of a user.
 * Used inline next to avatars/names across the UI.
 */
import type { AvailabilityStatus } from "../../types";
import { STATUS_CONFIG, getEffectiveStatus } from "../../services/presenceService";
import type { PresenceData } from "../../types";

interface StatusDotProps {
  /** Explicit status override */
  status?: AvailabilityStatus;
  /** OR: pass presence data and status is computed automatically */
  presence?: PresenceData | null;
  size?: "xs" | "sm" | "md";
  className?: string;
  showTitle?: boolean;
}

export default function StatusDot({
  status,
  presence,
  size = "sm",
  className = "",
  showTitle = true,
}: StatusDotProps) {
  const effectiveStatus: AvailabilityStatus =
    status ?? (presence ? getEffectiveStatus(presence) : "offline");

  const config = STATUS_CONFIG[effectiveStatus] ?? STATUS_CONFIG.offline;

  const sizeClass =
    size === "xs" ? "w-2 h-2" : size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3";

  return (
    <span
      className={`${sizeClass} rounded-full shrink-0 ${config.dotClass} ${className}`}
      title={showTitle ? config.label : undefined}
      aria-label={showTitle ? config.label : undefined}
      role={showTitle ? "img" : undefined}
      aria-hidden={!showTitle ? true : undefined}
    />
  );
}
