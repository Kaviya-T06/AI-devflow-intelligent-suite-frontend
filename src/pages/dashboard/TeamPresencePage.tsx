/**
 * TeamPresencePage — displays live presence and availability of all workspace users.
 *
 * Access: Admin, Manager, Developer (all authenticated roles).
 * - Admin & Manager: full monitoring view with all filters.
 * - Developer: team collaboration view (same data, slightly different framing).
 *
 * Features: real-time updates, role/availability filters, search, last-seen.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  fetchTeamPresence,
  formatLastSeen,
  presenceWS,
} from "../../services/presenceService";
import StatusDot from "../../components/presence/StatusDot";
import StatusBadge from "../../components/presence/StatusBadge";
import type { PresenceData, AvailabilityStatus } from "../../types";

type RoleFilter = "all" | "admin" | "project_manager" | "developer";
type AvailFilter = "all" | "available" | "busy" | "do_not_disturb" | "away" | "offline";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  project_manager: "Project Manager",
  developer: "Developer",
};

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function UserPresenceCard({ user }: { user: PresenceData }) {
  const effectiveStatus = (user.effective_status ?? "offline") as AvailabilityStatus;
  const lastSeen = formatLastSeen(user.last_seen_at);
  const roleLabel = ROLE_LABELS[user.user_role ?? ""] ?? (user.user_role ?? "");

  return (
    <div className="glass-card p-4 flex items-start gap-3 hover:bg-surface-800/60 transition-colors">
      {/* Avatar with status dot */}
      <div className="relative shrink-0">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-600 to-accent-500 flex items-center justify-center text-white font-bold text-sm">
          {getInitials(user.user_name)}
        </div>
        <StatusDot
          status={effectiveStatus}
          size="xs"
          className="absolute -bottom-0.5 -right-0.5 border-2 border-surface-800"
        />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <p className="text-surface-100 font-medium text-sm truncate">{user.user_name ?? "Unknown"}</p>
            <p className="text-surface-500 text-xs truncate">{user.user_email ?? ""}</p>
          </div>
          <StatusBadge status={effectiveStatus} />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {roleLabel && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-surface-700/60 text-surface-400 border border-surface-600/30">
              {roleLabel}
            </span>
          )}
          {user.status_message && (
            <span className="text-xs text-surface-400 italic truncate max-w-[180px]">
              "{user.status_message}"
            </span>
          )}
        </div>

        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-surface-600">
          <span
            className={`w-1.5 h-1.5 rounded-full ${user.is_online ? "bg-green-500" : "bg-slate-600"}`}
          />
          <span>{user.is_online ? "Online" : `Last seen ${lastSeen}`}</span>
          {user.status_expires_at && (
            <span className="ml-2 text-amber-500/80">
              ↩ {formatLastSeen(user.status_expires_at)} (reverts)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TeamPresencePage() {
  const { profile } = useAuth();
  const isAdminOrManager =
    profile?.role === "ADMIN" || profile?.role === "MANAGER";

  const [presence, setPresence] = useState<PresenceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isLive, setIsLive] = useState(false);

  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [availFilter, setAvailFilter] = useState<AvailFilter>("all");
  const [search, setSearch] = useState("");

  const [stats, setStats] = useState({
    total: 0,
    online: 0,
    available: 0,
    busy: 0,
  });

  const isMounted = useRef(true);

  const loadPresence = useCallback(async () => {
    try {
      const data = await fetchTeamPresence({
        role: roleFilter !== "all" ? roleFilter : undefined,
        availability: availFilter !== "all" ? availFilter : undefined,
        search: search || undefined,
      });
      if (!isMounted.current) return;
      setPresence(data.users);
      setStats({
        total: data.total,
        online: data.online_count,
        available: data.available_count,
        busy: data.busy_count,
      });
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      if (isMounted.current)
        setError(err instanceof Error ? err.message : "Failed to load team presence");
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [roleFilter, availFilter, search]);

  // Initial load + live refresh every 15 seconds
  useEffect(() => {
    isMounted.current = true;
    loadPresence();
    const timer = setInterval(loadPresence, 15000);
    return () => {
      isMounted.current = false;
      clearInterval(timer);
    };
  }, [loadPresence]);

  // WebSocket live updates - when any user changes status, refresh team list
  useEffect(() => {
    const handler = (msg: { type: string; data: unknown }) => {
      if (msg.type === "PRESENCE_UPDATE") {
        // Merge single user update into local state
        const updated = msg.data as PresenceData;
        setPresence((prev) => {
          const idx = prev.findIndex((u) => u.user_id === updated.user_id);
          if (idx === -1) return prev;
          const next = [...prev];
          next[idx] = updated;
          return next;
        });
        setIsLive(true);
      }
    };
    presenceWS.addHandler(handler);
    return () => presenceWS.removeHandler(handler);
  }, []);

  const filteredPresence = presence;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">
            {isAdminOrManager ? "Team Presence" : "Team Availability"}
          </h1>
          <p className="text-surface-400 text-sm mt-1">
            {isAdminOrManager
              ? "Monitor availability and coordinate with your team in real time."
              : "See who's available and online for collaboration."}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-surface-500">
          {isLive && (
            <span className="flex items-center gap-1 text-green-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live
            </span>
          )}
          <span>Updated {formatLastSeen(lastRefresh.toISOString())}</span>
          <button
            onClick={() => loadPresence()}
            className="p-1.5 rounded-lg hover:bg-surface-700/50 text-surface-400 hover:text-surface-200 transition-colors"
            title="Refresh"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Members", value: stats.total, dot: null },
          { label: "Online Now", value: stats.online, dot: "bg-green-500" },
          { label: "Available", value: stats.available, dot: "bg-green-400" },
          { label: "Busy / DND", value: stats.busy, dot: "bg-yellow-500" },
        ].map(({ label, value, dot }) => (
          <div key={label} className="glass-card px-4 py-3 text-center">
            <p className="text-2xl font-bold text-surface-100">{value}</p>
            <p className="text-xs text-surface-500 mt-0.5 flex items-center justify-center gap-1.5">
              {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email…"
          className="input flex-1 min-w-48"
          id="team-presence-search"
        />
        {isAdminOrManager && (
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
            className="input w-44"
            id="team-presence-role-filter"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="project_manager">Project Manager</option>
            <option value="developer">Developer</option>
          </select>
        )}
        <select
          value={availFilter}
          onChange={(e) => setAvailFilter(e.target.value as AvailFilter)}
          className="input w-48"
          id="team-presence-avail-filter"
        >
          <option value="all">All Statuses</option>
          <option value="available">Available</option>
          <option value="busy">Busy</option>
          <option value="do_not_disturb">Do Not Disturb</option>
          <option value="away">Away</option>
          <option value="offline">Offline</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="glass-card p-6 border-danger-500/30 bg-danger-500/10 text-center">
          <p className="text-danger-300">{error}</p>
          <button onClick={loadPresence} className="btn-primary mt-3 text-sm">
            Retry
          </button>
        </div>
      ) : filteredPresence.length === 0 ? (
        <div className="glass-card py-16 text-center text-surface-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-lg font-medium">No team members found</p>
          <p className="text-sm mt-1">Try clearing your filters.</p>
        </div>
      ) : (
        <>
          {/* Online section */}
          {filteredPresence.some((u) => u.is_online) && (
            <section>
              <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Online ({filteredPresence.filter((u) => u.is_online).length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredPresence
                  .filter((u) => u.is_online)
                  .map((u) => (
                    <UserPresenceCard key={u.user_id} user={u} />
                  ))}
              </div>
            </section>
          )}

          {/* Offline section */}
          {filteredPresence.some((u) => !u.is_online) && (
            <section className="mt-2">
              <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-600" />
                Offline ({filteredPresence.filter((u) => !u.is_online).length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredPresence
                  .filter((u) => !u.is_online)
                  .map((u) => (
                    <UserPresenceCard key={u.user_id} user={u} />
                  ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* DND notice for managers */}
      {isAdminOrManager && (
        <div className="glass-card p-4 border-surface-700/40 text-xs text-surface-500 flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 shrink-0 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Team members in <strong className="text-purple-400">Do Not Disturb</strong> mode will not receive non-urgent notifications. Critical alerts like risk events and overdue tasks are always delivered. This view supports coordination only — no covert activity tracking.
          </span>
        </div>
      )}
    </div>
  );
}
