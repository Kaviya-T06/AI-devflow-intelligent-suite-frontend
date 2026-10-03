import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchAllProjects } from "../../services/adminService";
import { generateContinuitySummary, askContinuityQuestion } from "../../services/continuityService";
import type { ContinuitySummary } from "../../services/continuityService";

export default function AIContinuityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialProjectId = searchParams.get("project") || "";

  const [projects, setProjects] = useState<{id: string, name: string, status: string}[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId);
  const [loadingProjects, setLoadingProjects] = useState(true);
  
  const [summary, setSummary] = useState<ContinuitySummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [question, setQuestion] = useState("");
  const [chatLog, setChatLog] = useState<{role: 'user' | 'ai', text: string}[]>([]);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    async function loadProjects() {
      try {
        const data = await fetchAllProjects();
        const fetchedProjects = data.map(p => ({
          id: p.id,
          name: p.name,
          status: p.status
        }));
        setProjects(fetchedProjects);
        if (!selectedProjectId && fetchedProjects.length > 0) {
          setSelectedProjectId(fetchedProjects[0].id);
        }
      } catch (err) {
        console.error("Failed to load projects", err);
      } finally {
        setLoadingProjects(false);
      }
    }
    loadProjects();
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!selectedProjectId) return;
    setLoadingSummary(true);
    setSummaryError(null);
    setSummary(null);
    setChatLog([]);
    try {
      const token = localStorage.getItem("access_token") || "";
      const result = await generateContinuitySummary(selectedProjectId, token);
      setSummary(result);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Failed to generate summary");
    } finally {
      setLoadingSummary(false);
    }
  }, [selectedProjectId]);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !selectedProjectId) return;
    
    const currentQ = question;
    setQuestion("");
    setChatLog(prev => [...prev, { role: 'user', text: currentQ }]);
    setAsking(true);
    
    try {
      const token = localStorage.getItem("access_token") || "";
      const result = await askContinuityQuestion(selectedProjectId, currentQ, token);
      setChatLog(prev => [...prev, { role: 'ai', text: result.answer }]);
    } catch (err) {
      setChatLog(prev => [...prev, { role: 'ai', text: "Error: Could not retrieve answer." }]);
    } finally {
      setAsking(false);
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      setSearchParams({ project: selectedProjectId });
    }
  }, [selectedProjectId, setSearchParams]);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-surface-50 flex items-center gap-2">
            <span className="text-2xl">🧠</span> AI Continuity
          </h2>
          <p className="text-surface-400 text-sm mt-1">
            Generate project handover context and ask AI questions based on real, verified development history.
          </p>
        </div>
      </div>

      <div className="glass-card p-5">
        <label className="block text-sm font-medium text-surface-300 mb-2">Select Project</label>
        <div className="flex gap-4 items-center">
          <select
            className="input max-w-md"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            disabled={loadingProjects || loadingSummary}
          >
            {projects.length === 0 && <option value="">No projects available</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.status})</option>
            ))}
          </select>
          <button
            onClick={handleGenerate}
            disabled={!selectedProjectId || loadingSummary}
            className="btn btn-primary"
          >
            {loadingSummary ? "Analyzing Project History..." : "Generate AI Handover"}
          </button>
        </div>
        {summaryError && <p className="text-danger-400 text-sm mt-3">{summaryError}</p>}
      </div>

      {loadingSummary && (
        <div className="glass-card p-10 flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-surface-300 font-medium text-lg animate-pulse">Gathering verified project context, tasks, and GitHub history...</p>
        </div>
      )}

      {summary && !loadingSummary && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card p-6">
              <h3 className="text-xl font-bold text-surface-100 mb-4 border-b border-surface-700/50 pb-2">Project Overview</h3>
              <p className="text-surface-300 whitespace-pre-wrap">{summary.project_overview}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-card p-6">
                <h3 className="text-lg font-bold text-surface-100 mb-3 border-b border-surface-700/50 pb-2">Previous Developer Work</h3>
                <p className="text-surface-300 whitespace-pre-wrap text-sm">{summary.previous_developer_work}</p>
              </div>
              <div className="glass-card p-6">
                <h3 className="text-lg font-bold text-surface-100 mb-3 border-b border-surface-700/50 pb-2">Current Work</h3>
                <p className="text-surface-300 whitespace-pre-wrap text-sm">{summary.current_work}</p>
              </div>
              <div className="glass-card p-6">
                <h3 className="text-lg font-bold text-surface-100 mb-3 border-b border-surface-700/50 pb-2">Pending Work</h3>
                <p className="text-surface-300 whitespace-pre-wrap text-sm">{summary.pending_work}</p>
              </div>
              <div className="glass-card p-6 border border-warning-500/20">
                <h3 className="text-lg font-bold text-warning-300 mb-3 border-b border-warning-500/20 pb-2">Blocked / Overdue Work</h3>
                <p className="text-surface-300 whitespace-pre-wrap text-sm">{summary.blocked_overdue_work}</p>
              </div>
            </div>

            <div className="glass-card p-6">
              <h3 className="text-lg font-bold text-surface-100 mb-3 border-b border-surface-700/50 pb-2">Recent GitHub Activity</h3>
              <p className="text-surface-300 whitespace-pre-wrap text-sm">{summary.recent_github_activity}</p>
            </div>

            <div className="glass-card p-6 bg-primary-900/10 border border-primary-500/20">
              <h3 className="text-xl font-bold text-primary-300 mb-4 border-b border-primary-500/20 pb-2">What the Next Developer Should Know</h3>
              <p className="text-surface-300 whitespace-pre-wrap">{summary.what_next_developer_should_know}</p>
              
              <h4 className="font-semibold text-primary-400 mt-6 mb-2">Recommended Next Steps:</h4>
              <p className="text-surface-300 whitespace-pre-wrap text-sm">{summary.recommended_next_steps}</p>
              
              {summary.known_issues && summary.known_issues.trim().length > 0 && summary.known_issues.toLowerCase() !== "none" && (
                <>
                  <h4 className="font-semibold text-danger-400 mt-6 mb-2">Known Issues:</h4>
                  <p className="text-surface-300 whitespace-pre-wrap text-sm">{summary.known_issues}</p>
                </>
              )}
              
              <h4 className="font-semibold text-surface-200 mt-6 mb-2">Important Context:</h4>
              <p className="text-surface-300 whitespace-pre-wrap text-sm">{summary.important_context}</p>
            </div>
          </div>

          <div className="lg:col-span-1 glass-card p-0 flex flex-col h-[600px] sticky top-24">
            <div className="p-4 border-b border-surface-700/50 bg-surface-800/50 rounded-t-xl">
              <h3 className="font-bold text-surface-100 flex items-center gap-2">
                💬 Ask AI About This Project
              </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatLog.length === 0 ? (
                <div className="text-center text-surface-500 text-sm mt-10">
                  Ask questions about the project history, completed tasks, or open PRs.
                </div>
              ) : (
                chatLog.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-primary-600 text-white rounded-br-none' : 'bg-surface-700 text-surface-200 rounded-bl-none'}`}>
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                ))
              )}
              {asking && (
                <div className="flex justify-start">
                  <div className="bg-surface-700 text-surface-200 p-3 rounded-lg rounded-bl-none flex gap-1">
                    <span className="animate-bounce">.</span><span className="animate-bounce" style={{animationDelay: "150ms"}}>.</span><span className="animate-bounce" style={{animationDelay: "300ms"}}>.</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-surface-700/50 bg-surface-800/30 rounded-b-xl">
              <form onSubmit={handleAsk} className="flex gap-2">
                <input
                  type="text"
                  className="input flex-1 text-sm bg-surface-900 border-surface-600 focus:border-primary-500"
                  placeholder="e.g., What did the previous developer work on?"
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  disabled={asking}
                />
                <button type="submit" disabled={asking || !question.trim()} className="btn btn-primary px-3 py-2">
                  <svg className="w-4 h-4 transform rotate-90" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
