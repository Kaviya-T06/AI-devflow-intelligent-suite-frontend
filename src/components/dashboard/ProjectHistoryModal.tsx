import { useEffect, useState } from "react";
import { fetchProjectHistory } from "../../services/pmService";
import type { ActivityLog } from "../../types";

export default function ProjectHistoryModal({
  projectId,
  projectName,
  onClose,
}: {
  projectId: string;
  projectName: string;
  onClose: () => void;
}) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProjectHistory(projectId)
      .then(setLogs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-900 border border-surface-700 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="p-5 border-b border-surface-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-surface-50">Project History</h2>
            <p className="text-sm text-surface-400 mt-1">{projectName}</p>
          </div>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-200">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          {loading ? (
            <p className="text-surface-400 text-center py-8">Loading history...</p>
          ) : error ? (
            <p className="text-danger-400 text-center py-8">Error: {error}</p>
          ) : logs.length === 0 ? (
            <p className="text-surface-400 text-center py-8">No history events found.</p>
          ) : (
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-surface-700 before:to-transparent">
              {logs.map((log) => (
                <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-surface-700 bg-surface-800 text-surface-300 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-surface-700 bg-surface-800/50 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-primary-300 text-xs uppercase tracking-wider">{log.action.replace(/_/g, " ")}</span>
                      <span className="text-[10px] text-surface-500">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-surface-300 text-sm mt-1">{log.description}</p>
                    {log.user && (
                      <p className="text-surface-500 text-xs mt-2 italic">By: {log.user.full_name}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
