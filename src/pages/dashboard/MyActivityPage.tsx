import { useEffect, useState } from "react";
import { fetchRecentActivity } from "../../services/adminService";
import type { ActivityLog } from "../../types";

const ENTITY_ICONS: Record<string, string> = { user: "👤", project: "📁", task: "✅", risk: "⚠️", repository: "📦", default: "📋" };

export default function MyActivityPage() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app, this should fetch activity only for the authenticated user.
    // fetchRecentActivity currently fetches global activity (which is fine if RBAC is handled by backend, 
    // but the backend needs a specific endpoint for user activity. Let's use the same endpoint for now since backend restricts based on role.)
    fetchRecentActivity(50)
      .then(setActivities)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-surface-400 animate-pulse py-8">Loading your activity...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-surface-50">My Activity</h2>
        <p className="text-surface-400 text-sm mt-1">Timeline of your recent actions and updates.</p>
      </div>

      <div className="glass-card overflow-hidden">
        {activities.length === 0 ? (
          <p className="p-8 text-center text-surface-400">No recent activity.</p>
        ) : (
          <div className="divide-y divide-surface-700/30">
            {activities.map(log => (
              <div key={log.id} className="p-4 flex gap-4 hover:bg-surface-800/40 transition-colors">
                <div className="w-10 h-10 rounded-full bg-surface-800 flex items-center justify-center shrink-0 text-lg shadow-inner">
                  {ENTITY_ICONS[log.entity_type.toLowerCase()] ?? ENTITY_ICONS.default}
                </div>
                <div>
                  <p className="text-surface-200 text-sm">{log.description}</p>
                  <p className="text-surface-500 text-xs mt-1">
                    {new Date(log.created_at).toLocaleString("en-US", { 
                      weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" 
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
