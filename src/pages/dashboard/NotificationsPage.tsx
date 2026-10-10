import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  fetchNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  triggerOverdueCheck,
} from "../../services/notificationService";
import type { Notification, NotificationType } from "../../types";

type FilterTab = "ALL" | "UNREAD" | "TASKS" | "RISKS";

export default function NotificationsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState<boolean>(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchNotifications();
      setNotifications(res.items || []);
      setUnreadCount(res.unread_count || 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load notifications.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setProcessingId(id);
    try {
      await markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err: unknown) {
      console.error("Failed to mark as read:", err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    setMarkingAll(true);
    try {
      await markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err: unknown) {
      console.error("Failed to mark all as read:", err);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setProcessingId(id);
    try {
      await deleteNotification(id);
      const target = notifications.find((n) => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (target && !target.is_read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err: unknown) {
      console.error("Failed to delete notification:", err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleTriggerOverdueScan = async () => {
    try {
      await triggerOverdueCheck();
      await loadNotifications();
    } catch (err: unknown) {
      console.error("Failed to scan overdue tasks:", err);
    }
  };

  const handleNavigateToTarget = (n: Notification) => {
    if (!n.is_read) {
      handleMarkAsRead(n.id);
    }
    const role = profile?.role || "DEVELOPER";
    if (n.task_id) {
      if (role === "DEVELOPER") {
        navigate("/dashboard/my-tasks");
      } else if (role === "MANAGER") {
        navigate("/dashboard/pm-team-tasks");
      } else {
        navigate("/dashboard/tasks");
      }
    } else if (n.project_id) {
      if (role === "DEVELOPER") {
        navigate("/dashboard/my-projects");
      } else if (role === "MANAGER") {
        navigate("/dashboard/pm-projects");
      } else {
        navigate("/dashboard/projects");
      }
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === "UNREAD") return !n.is_read;
    if (activeTab === "TASKS")
      return [
        "TASK_ASSIGNED",
        "TASK_STATUS_CHANGED",
        "TASK_OVERDUE",
        "SMART_ALLOCATION",
      ].includes(n.type);
    if (activeTab === "RISKS") return n.type === "RISK_ALERT";
    return true;
  });

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case "TASK_ASSIGNED":
      case "SMART_ALLOCATION":
        return (
          <div className="w-10 h-10 rounded-xl bg-primary-500/20 text-primary-400 border border-primary-500/30 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
        );
      case "TASK_STATUS_CHANGED":
      case "PM_UPDATE":
        return (
          <div className="w-10 h-10 rounded-xl bg-accent-500/20 text-accent-400 border border-accent-500/30 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        );
      case "TASK_OVERDUE":
      case "RISK_ALERT":
        return (
          <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        );
      case "GITHUB_EVENT":
        return (
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-xl bg-surface-700 text-surface-300 border border-surface-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
        );
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const dt = new Date(isoString);
      const diffMs = Date.now() - dt.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-surface-50 flex items-center gap-3">
            Notifications
            {unreadCount > 0 && (
              <span className="badge bg-primary-500/20 text-primary-300 border border-primary-500/30 font-semibold px-2.5 py-0.5 rounded-full text-xs">
                {unreadCount} unread
              </span>
            )}
          </h2>
          <p className="text-surface-400 text-sm mt-1">
            Real-time alerts, task updates, risk notifications, and team assignments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              disabled={markingAll}
              className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"
            >
              <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {markingAll ? "Marking..." : "Mark all as read"}
            </button>
          )}
          <button
            onClick={handleTriggerOverdueScan}
            title="Scan for overdue tasks"
            className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Scan Overdue
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-surface-700/50 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("ALL")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === "ALL"
              ? "bg-primary-500/20 text-primary-300 border border-primary-500/30"
              : "text-surface-400 hover:text-surface-200 hover:bg-surface-800"
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setActiveTab("UNREAD")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === "UNREAD"
              ? "bg-primary-500/20 text-primary-300 border border-primary-500/30"
              : "text-surface-400 hover:text-surface-200 hover:bg-surface-800"
          }`}
        >
          Unread ({unreadCount})
        </button>
        <button
          onClick={() => setActiveTab("TASKS")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === "TASKS"
              ? "bg-primary-500/20 text-primary-300 border border-primary-500/30"
              : "text-surface-400 hover:text-surface-200 hover:bg-surface-800"
          }`}
        >
          Tasks
        </button>
        <button
          onClick={() => setActiveTab("RISKS")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === "RISKS"
              ? "bg-primary-500/20 text-primary-300 border border-primary-500/30"
              : "text-surface-400 hover:text-surface-200 hover:bg-surface-800"
          }`}
        >
          Risks
        </button>
      </div>

      {/* Loading Skeleton State */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card p-4 flex items-center gap-4 animate-pulse">
              <div className="w-10 h-10 rounded-xl bg-surface-700/50" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-surface-700/50 rounded w-1/3" />
                <div className="h-3 bg-surface-700/50 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State with Retry */}
      {!loading && error && (
        <div className="glass-card p-8 text-center border border-red-500/30 bg-red-500/5">
          <svg className="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-base font-semibold text-surface-200">Unable to load notifications</h3>
          <p className="text-surface-400 text-sm mt-1">{error}</p>
          <button
            onClick={loadNotifications}
            className="btn-primary mt-4 text-xs px-4 py-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredNotifications.length === 0 && (
        <div className="glass-card p-12 text-center">
          <svg className="w-12 h-12 text-surface-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <h3 className="text-lg font-medium text-surface-200">No notifications found</h3>
          <p className="text-surface-500 text-sm mt-2">
            {activeTab === "UNREAD"
              ? "You're all caught up! No unread notifications."
              : "We'll notify you when tasks, risks, or assignments require your attention."}
          </p>
        </div>
      )}

      {/* Notification List */}
      {!loading && !error && filteredNotifications.length > 0 && (
        <div className="space-y-3">
          {filteredNotifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleNavigateToTarget(n)}
              className={`glass-card p-4 flex items-start justify-between gap-4 transition-all cursor-pointer ${
                !n.is_read
                  ? "bg-surface-800/90 border-l-4 border-l-primary-500 shadow-md"
                  : "opacity-80 hover:opacity-100"
              }`}
            >
              <div className="flex items-start gap-4 min-w-0 flex-1">
                {getIcon(n.type)}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-surface-100 truncate">
                      {n.title}
                    </h4>
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-primary-400 shrink-0" title="Unread" />
                    )}
                  </div>
                  <p className="text-surface-300 text-xs mt-1 leading-relaxed">
                    {n.message}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-surface-500 mt-2">
                    <span>{formatDate(n.created_at)}</span>
                    {n.task_id && (
                      <span className="hover:text-primary-400 font-medium">
                        View Task →
                      </span>
                    )}
                    {!n.task_id && n.project_id && (
                      <span className="hover:text-primary-400 font-medium">
                        View Project →
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                {!n.is_read && (
                  <button
                    onClick={(e) => handleMarkAsRead(n.id, e)}
                    disabled={processingId === n.id}
                    title="Mark as read"
                    className="p-1.5 rounded-lg text-surface-400 hover:text-primary-400 hover:bg-surface-700/50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={(e) => handleDelete(n.id, e)}
                  disabled={processingId === n.id}
                  title="Dismiss notification"
                  className="p-1.5 rounded-lg text-surface-400 hover:text-red-400 hover:bg-surface-700/50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
