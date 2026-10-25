/**
 * StatusSelector — compact dropdown for changing one's own availability status.
 * Integrated into the sidebar below the user avatar.
 * Supports custom message and optional expiry time.
 */
import { useState, useRef, useEffect } from "react";
import type { AvailabilityStatus, PresenceData, PresenceUpdatePayload } from "../../types";
import { STATUS_CONFIG } from "../../services/presenceService";
import StatusDot from "./StatusDot";

const ALL_STATUSES: AvailabilityStatus[] = [
  "available",
  "busy",
  "do_not_disturb",
  "away",
  "offline",
];

interface StatusSelectorProps {
  myPresence: PresenceData | null;
  loading?: boolean;
  error?: string | null;
  isReconnecting?: boolean;
  onUpdate: (payload: PresenceUpdatePayload) => Promise<void>;
  onClear: () => Promise<void>;
}

export default function StatusSelector({
  myPresence,
  loading = false,
  error = null,
  isReconnecting = false,
  onUpdate,
  onClear,
}: StatusSelectorProps) {
  const [open, setOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [expiryOption, setExpiryOption] = useState<string>("none");
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const effectiveStatus =
    (myPresence?.effective_status as AvailabilityStatus) ?? "offline";
  const config = STATUS_CONFIG[effectiveStatus] ?? STATUS_CONFIG.offline;

  // Pre-populate message field from current presence
  useEffect(() => {
    if (open && myPresence) {
      setStatusMsg(myPresence.status_message ?? "");
    }
  }, [open, myPresence]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCustomizing(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function getExpiryIso(option: string): string | undefined {
    if (option === "none") return undefined;
    const now = new Date();
    if (option === "30m") now.setMinutes(now.getMinutes() + 30);
    else if (option === "1h") now.setHours(now.getHours() + 1);
    else if (option === "2h") now.setHours(now.getHours() + 2);
    else if (option === "eod") {
      now.setHours(18, 0, 0, 0);
      if (now < new Date()) now.setDate(now.getDate() + 1);
    }
    return now.toISOString();
  }

  async function handleSelectStatus(status: AvailabilityStatus) {
    setSaving(true);
    try {
      if (status === "available") {
        await onClear();
      } else {
        const payload: PresenceUpdatePayload = {
          availability_status: status,
          status_message: statusMsg || undefined,
          status_expires_at: getExpiryIso(expiryOption),
        };
        await onUpdate(payload);
      }
    } finally {
      setSaving(false);
      setOpen(false);
      setCustomizing(false);
    }
  }

  async function handleSaveCustom() {
    const currentStatus =
      (myPresence?.availability_status as AvailabilityStatus) ?? "available";
    setSaving(true);
    try {
      await onUpdate({
        availability_status: currentStatus,
        status_message: statusMsg || undefined,
        status_expires_at: getExpiryIso(expiryOption),
        clear_expiry: expiryOption === "none",
      });
    } finally {
      setSaving(false);
      setOpen(false);
      setCustomizing(false);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        id="status-selector-btn"
        onClick={() => { setOpen((p) => !p); setCustomizing(false); }}
        className="w-full flex items-center justify-between gap-1.5 rounded-lg px-2.5 py-1 text-xs text-surface-300 hover:text-surface-100 bg-surface-800/60 hover:bg-surface-700/60 transition-colors border border-surface-700/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-400"
        aria-label="Change your status"
        title={loading ? "Loading…" : isReconnecting ? "Reconnecting…" : `Status: ${config.label}`}
        disabled={saving}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          {isReconnecting ? (
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shrink-0" />
          ) : (
            <StatusDot status={effectiveStatus} size="xs" showTitle={false} />
          )}
          <span className="truncate max-w-[130px]">
            {isReconnecting
              ? "Reconnecting…"
              : loading
              ? "Loading…"
              : config.label}
          </span>
        </span>
        <ChevronDownIcon />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute bottom-full mb-2 left-0 z-50 w-64 rounded-xl bg-surface-800 border border-surface-700/60 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2 border-b border-surface-700/50 flex items-center justify-between">
            <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
              Set Status
            </span>
            {isReconnecting && (
              <span className="text-xs text-yellow-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                Reconnecting
              </span>
            )}
          </div>

          {/* Status options */}
          {!customizing && (
            <>
              <div className="py-1">
                {ALL_STATUSES.map((s) => {
                  const cfg = STATUS_CONFIG[s];
                  const isActive = effectiveStatus === s;
                  return (
                    <button
                      key={s}
                      onClick={() => handleSelectStatus(s)}
                      disabled={saving}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors disabled:opacity-50 ${
                        isActive
                          ? "bg-surface-700/60 text-surface-100"
                          : "text-surface-300 hover:bg-surface-700/40 hover:text-surface-100"
                      }`}
                    >
                      <StatusDot status={s} size="xs" showTitle={false} />
                      <span className="flex-1">{cfg.label}</span>
                      {isActive && <CheckIcon />}
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-surface-700/40 px-3 py-2">
                <button
                  onClick={() => setCustomizing(true)}
                  className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
                >
                  + Add message & expiry…
                </button>
              </div>

              {/* Current message preview */}
              {myPresence?.status_message && (
                <div className="px-3 pb-2 flex items-start gap-1.5">
                  <span className="text-xs text-surface-500 italic truncate">
                    "{myPresence.status_message}"
                  </span>
                  <button
                    onClick={onClear}
                    className="ml-auto text-xs text-surface-600 hover:text-danger-400 transition-colors shrink-0"
                    title="Clear status"
                  >
                    ✕
                  </button>
                </div>
              )}
            </>
          )}

          {/* Custom message & expiry panel */}
          {customizing && (
            <div className="p-3 space-y-3">
              <div>
                <label className="block text-xs text-surface-400 mb-1">Status message (optional)</label>
                <input
                  type="text"
                  value={statusMsg}
                  onChange={(e) => setStatusMsg(e.target.value)}
                  maxLength={200}
                  placeholder="What are you up to?"
                  className="w-full bg-surface-700/50 border border-surface-600/50 rounded-lg px-2.5 py-1.5 text-sm text-surface-100 placeholder-surface-500 focus:outline-none focus:border-primary-500/70"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-surface-400 mb-1">Clear after</label>
                <select
                  value={expiryOption}
                  onChange={(e) => setExpiryOption(e.target.value)}
                  className="w-full bg-surface-700/50 border border-surface-600/50 rounded-lg px-2.5 py-1.5 text-sm text-surface-100 focus:outline-none focus:border-primary-500/70"
                >
                  <option value="none">Don't auto-clear</option>
                  <option value="30m">30 minutes</option>
                  <option value="1h">1 hour</option>
                  <option value="2h">2 hours</option>
                  <option value="eod">End of day (6 PM)</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCustomizing(false)}
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs text-surface-400 border border-surface-600/40 hover:bg-surface-700/40 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSaveCustom}
                  disabled={saving}
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white transition-colors"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="px-3 py-2 border-t border-surface-700/40">
              <p className="text-xs text-danger-400">{error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Small SVG helpers
function ChevronDownIcon() {
  return (
    <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
