import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchAllProjects } from "../../services/adminService";
import { generateContinuitySummary, askContinuityQuestion } from "../../services/continuityService";
import type { ContinuitySummary } from "../../services/continuityService";

export default function AIContinuityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialProjectId = searchParams.get("project") || "";

  const [projects, setProjects] = useState<{ id: string; name: string; status: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const [summary, setSummary] = useState<ContinuitySummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [question, setQuestion] = useState("");
  const [chatLog, setChatLog] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    async function loadProjects() {
      try {
        const data = await fetchAllProjects();
        const fetchedProjects = data.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
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

  const handleAsk = async (e?: React.FormEvent, presetQ?: string) => {
    if (e) e.preventDefault();

    const currentQ = presetQ ?? question;
    if (!currentQ.trim() || !selectedProjectId) return;

    if (!presetQ) setQuestion("");

    // Prepare bounded conversation history (latest 10 messages) excluding error messages
    const historyMessages = chatLog
      .filter((m) => !m.text.includes("AI answer temporarily unavailable") && !m.text.includes("⚠️"))
      .slice(-10)
      .map((m) => ({
        role: (m.role === "ai" ? "assistant" : "user") as "assistant" | "user",
        content: m.text,
      }));

    setChatLog((prev) => [...prev, { role: "user", text: currentQ }]);
    setAsking(true);

    try {
      const token = localStorage.getItem("access_token") || "";
      const result = await askContinuityQuestion(selectedProjectId, currentQ, token, historyMessages);

      let answerText = result.answer;
      if (
        answerText.includes("I cannot answer that right now") ||
        answerText.includes("Provider Error") ||
        answerText.includes("Quota")
      ) {
        answerText = "⚠️ AI answer temporarily unavailable.\nPlease try again shortly.";
      }

      setChatLog((prev) => [...prev, { role: "ai", text: answerText }]);
    } catch (err) {
      setChatLog((prev) => [
        ...prev,
        { role: "ai", text: "⚠️ AI answer temporarily unavailable.\nPlease try again shortly." },
      ]);
    } finally {
      setAsking(false);
    }
  };

  const handleProjectChange = (newProjectId: string) => {
    if (newProjectId !== selectedProjectId) {
      setSelectedProjectId(newProjectId);
      setChatLog([]);
      setSummary(null);
      setSummaryError(null);
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      setSearchParams({ project: selectedProjectId });
    }
  }, [selectedProjectId, setSearchParams]);

  const ctx = summary?.raw_context;

  const pmName = useMemo(() => {
    if (!ctx?.project) return "Unknown";
    const u = ctx.project.users;
    if (Array.isArray(u)) return u[0]?.name || "Unknown";
    return u?.name || "Unknown";
  }, [ctx]);

  const getDevName = (task: any) => {
    const u = task?.users;
    if (Array.isArray(u)) return u[0]?.name || "Unassigned";
    return u?.name || "Unassigned";
  };

  const enrichedTasks = useMemo(() => {
    if (!ctx?.tasks) return [];
    return ctx.tasks.map((t) => {
      const taskRisks = (ctx.risks || []).filter((r) => r.task_id === t.id && !r.is_resolved);
      const isOverdue = taskRisks.some((r) => r.risk_type === "OVERDUE");
      const isStuck = taskRisks.some((r) => r.risk_type === "STUCK");

      let riskLabel = "";
      if (isOverdue && isStuck) riskLabel = "OVERDUE + STUCK";
      else if (isOverdue) riskLabel = "OVERDUE";
      else if (isStuck) riskLabel = "STUCK";

      return {
        ...t,
        devName: getDevName(t),
        riskLabel,
        isOverdue,
        isStuck,
      };
    });
  }, [ctx]);

  const attentionRequired = enrichedTasks.filter((t) => t.riskLabel && t.status !== "COMPLETED");
  const completedWork = enrichedTasks.filter((t) => t.status === "COMPLETED");
  const inProgressWork = enrichedTasks.filter((t) => t.status === "IN_PROGRESS");
  const pendingWork = enrichedTasks.filter((t) => t.status === "TODO");

  const github = ctx?.github;
  const hasGithub = !!github?.repository;
  const unmappedPrs = ctx?.unmapped_prs || [];
  const unmappedCommits = ctx?.unmapped_commits || [];
  const hasVerifiedMappings = (ctx?.verified_mappings || []).length > 0;

  const isAiUnavailable = useMemo(() => {
    if (!summary) return false;
    return (
      summary.project_overview.includes("Provider Error") ||
      summary.project_overview.includes("Rate Limit") ||
      summary.project_overview.includes("Quota") ||
      summary.project_overview.includes("Temporarily Unavailable")
    );
  }, [summary]);

  const riskCounts = useMemo(() => {
    const overdue = (ctx?.risks || []).filter((r) => r.risk_type === "OVERDUE" && !r.is_resolved).length;
    const stuck = (ctx?.risks || []).filter((r) => r.risk_type === "STUCK" && !r.is_resolved).length;
    const openUnmappedPrs = unmappedPrs.length;
    const issues = github?.issues?.length || 0;
    return { overdue, stuck, openUnmappedPrs, issues };
  }, [ctx, unmappedPrs, github]);

  const whatDeveloperShouldKnow = useMemo(() => {
    if (!ctx) return [];
    const items: string[] = [];
    items.push(`Project is currently ${ctx.project.progress}% complete.`);

    inProgressWork.forEach((t) => {
      items.push(`"${t.title}" is a ${t.priority} task currently in progress.`);
    });

    if (pendingWork.length > 0) {
      items.push(`"${pendingWork[0].title}" is still pending.`);
    }

    if (unmappedPrs.length > 0) {
      items.push(`${unmappedPrs.length} GitHub PRs are currently open.`);
    }

    if (hasGithub && !hasVerifiedMappings) {
      items.push("GitHub activities are not yet verified against DevFlow tasks.");
    }

    return items;
  }, [ctx, inProgressWork, pendingWork, unmappedPrs, hasGithub, hasVerifiedMappings]);

  const systemRecommendations = useMemo(() => {
    if (!ctx) return [];

    const recs: { id: number; title: string; desc: string }[] = [];
    let counter = 1;

    attentionRequired.forEach((t) => {
      recs.push({
        id: counter++,
        title: `Address ${(t.title || "").toLowerCase()}`,
        desc: `Review the current "${t.title}" task assigned to ${t.devName} and resolve its current workflow risk (${t.riskLabel}) if verified.`,
      });
    });

    pendingWork.slice(0, 2).forEach((t) => {
      recs.push({
        id: counter++,
        title: `Complete ${(t.title || "").toLowerCase()}`,
        desc: `"${t.title}" is still pending and should be addressed when supported by the verified workflow.`,
      });
    });

    inProgressWork.slice(0, 2).forEach((t) => {
      recs.push({
        id: counter++,
        title: `Review ${(t.title || "").toLowerCase()}`,
        desc: `Check the current progress of "${t.title}" assigned to ${t.devName}.`,
      });
    });

    if (unmappedPrs.length > 0) {
      recs.push({
        id: counter++,
        title: "Review open GitHub pull requests",
        desc: `There are currently ${unmappedPrs.length} open PRs. Map these to DevFlow tasks if applicable.`,
      });
    }

    return recs;
  }, [ctx, attentionRequired, pendingWork, inProgressWork, unmappedPrs]);

  return (
    <div className="space-y-8 animate-fade-in pb-20 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-surface-50 flex items-center gap-2">
            <span className="text-2xl">🚀</span> Developer Handover
          </h2>
          <p className="text-surface-400 text-sm mt-1">
            Instant, verified project continuity powered by AI and real development data.
          </p>
        </div>
      </div>

      <div className="glass-card p-5 border border-surface-700/50">
        <label className="block text-sm font-medium text-surface-300 mb-2">Select Project</label>
        <div className="flex gap-4 items-center">
          <select
            className="input max-w-md bg-surface-800"
            value={selectedProjectId}
            onChange={(e) => handleProjectChange(e.target.value)}
            disabled={loadingProjects || loadingSummary}
          >
            {projects.length === 0 && <option value="">No projects available</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.status})
              </option>
            ))}
          </select>
          <button
            onClick={handleGenerate}
            disabled={!selectedProjectId || loadingSummary}
            className="btn btn-primary"
          >
            {loadingSummary ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Analyzing Project...
              </span>
            ) : (
              "Generate AI Handover"
            )}
          </button>
        </div>
        {summaryError && <p className="text-danger-400 text-sm mt-3">{summaryError}</p>}
      </div>

      {loadingSummary && (
        <div className="glass-card p-12 flex flex-col items-center justify-center space-y-6 border border-primary-500/20 bg-primary-900/5">
          <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
          <div className="text-center">
            <p className="text-primary-100 font-medium text-lg">Synthesizing Project Handover...</p>
            <p className="text-primary-300/60 text-sm mt-1">
              Connecting GitHub commits, active tasks, and risk indicators.
            </p>
          </div>
        </div>
      )}

      {summary && !loadingSummary && ctx && (
        <div className="space-y-8">
          <div className="glass-card p-8 border border-surface-700/50 bg-surface-800/30">
            <div className="mb-8">
              <h1 className="text-3xl font-extrabold text-white">{ctx.project.name}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <span className="px-3 py-1 bg-primary-500/20 text-primary-300 text-xs font-bold rounded-md uppercase tracking-wider border border-primary-500/30">
                  {ctx.project.status}
                </span>
                <span className="text-surface-300 text-sm font-bold uppercase tracking-wider">
                  {ctx.project.progress}% COMPLETE
                </span>
              </div>
              <div className="mt-4 text-sm text-surface-400">
                Managed by <strong className="text-surface-200">{pmName}</strong>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-surface-900/60 rounded-xl border border-surface-700 text-center">
                <div className="text-3xl font-bold text-danger-400">{riskCounts.overdue}</div>
                <div className="text-[11px] uppercase tracking-wider text-surface-400 mt-2 font-medium">Overdue</div>
              </div>
              <div className="p-4 bg-surface-900/60 rounded-xl border border-surface-700 text-center">
                <div className="text-3xl font-bold text-warning-400">{riskCounts.stuck}</div>
                <div className="text-[11px] uppercase tracking-wider text-surface-400 mt-2 font-medium">Stuck</div>
              </div>
              <div className="p-4 bg-surface-900/60 rounded-xl border border-surface-700 text-center">
                <div className="text-3xl font-bold text-info-400">{riskCounts.openUnmappedPrs}</div>
                <div className="text-[11px] uppercase tracking-wider text-surface-400 mt-2 font-medium">Open PRs</div>
              </div>
              <div className="p-4 bg-surface-900/60 rounded-xl border border-surface-700 text-center">
                <div className="text-3xl font-bold text-surface-200">{riskCounts.issues}</div>
                <div className="text-[11px] uppercase tracking-wider text-surface-400 mt-2 font-medium">GitHub Issues</div>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 border-l-4 border-l-primary-500 bg-primary-900/10">
            <h3 className="text-sm font-bold text-primary-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="text-lg">✨</span> AI Handover Summary
            </h3>
            {isAiUnavailable ? (
              <div className="bg-warning-900/20 border border-warning-500/30 p-4 rounded-lg mt-3">
                <h4 className="text-warning-400 font-bold flex items-center gap-2 mb-1">
                  ⚠️ AI Summary Temporarily Unavailable
                </h4>
                <p className="text-warning-200/70 text-sm">
                  The AI model is currently unavailable. The verified project handover information below is still available.
                </p>
              </div>
            ) : (
              <p className="text-surface-100 text-lg leading-relaxed font-medium">{summary.project_overview}</p>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-8">
              <div className="glass-card p-6 border border-surface-700/50">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-surface-100">What the Next Developer Should Know</h3>
                  <p className="text-surface-400 text-sm mt-1">
                    Key context to understand before taking over this project.
                  </p>
                </div>

                <div className="space-y-4">
                  {whatDeveloperShouldKnow.map((item, idx) => {
                    let icon = "🔹";
                    if (item.includes("COMPLETE") || item.includes("complete")) icon = "📊";
                    else if (item.includes("Critical") || item.includes("High")) icon = "🔴";
                    else if (item.includes("progress")) icon = "🔵";
                    else if (item.includes("pending")) icon = "⏳";
                    else if (item.includes("GitHub PRs")) icon = "🔗";
                    else if (item.includes("GitHub activities")) icon = "ℹ️";

                    return (
                      <div key={idx} className="flex items-start gap-3">
                        <span className="text-lg leading-none mt-0.5">{icon}</span>
                        <p className="text-surface-200 text-md">{item}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="glass-card p-6 border border-surface-700/50">
                <h3 className="text-xl font-bold text-danger-400 mb-6 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-danger-500 animate-pulse"></span>
                  Attention Required
                </h3>

                {attentionRequired.length === 0 ? (
                  <div className="space-y-2">
                    <p className="text-success-400 text-sm flex items-center gap-2">
                      <span>✓</span> No verified overdue tasks
                    </p>
                    <p className="text-success-400 text-sm flex items-center gap-2">
                      <span>✓</span> No verified stuck tasks
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {attentionRequired.map((t) => (
                      <div key={t.id} className="p-4 bg-surface-900/60 rounded-xl border border-surface-700">
                        <h4 className="text-surface-100 font-bold mb-3">{t.title}</h4>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-sm text-surface-300 bg-surface-800 px-3 py-1 rounded-md border border-surface-600">
                            {t.devName}
                          </span>
                          <span className="text-xs font-bold text-surface-400 uppercase tracking-wider">
                            {t.priority}
                          </span>
                          <div className="h-4 w-px bg-surface-700 mx-1"></div>
                          {t.isOverdue && (
                            <span className="text-[11px] font-bold px-2 py-1 rounded-md bg-danger-500/20 text-danger-300 uppercase">
                              🔴 OVERDUE
                            </span>
                          )}
                          {t.isStuck && (
                            <span className="text-[11px] font-bold px-2 py-1 rounded-md bg-warning-500/20 text-warning-300 uppercase">
                              🟠 STUCK
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass-card p-6 border border-surface-700/50">
                <h3 className="text-xl font-bold text-info-400 mb-6 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-info-500"></span>
                  Currently In Progress
                </h3>
                {inProgressWork.length === 0 ? (
                  <p className="text-surface-400 text-sm italic">No active work in progress.</p>
                ) : (
                  <div className="space-y-4">
                    {inProgressWork.map((t) => (
                      <div key={t.id} className="p-4 bg-surface-900/60 rounded-xl border border-surface-700">
                        <h4 className="text-surface-100 font-bold mb-3">{t.title}</h4>
                        <div className="flex flex-wrap items-center gap-3">
                          <span
                            className={`text-[11px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${
                              t.priority === "CRITICAL"
                                ? "bg-danger-500/20 text-danger-300"
                                : t.priority === "HIGH"
                                  ? "bg-warning-500/20 text-warning-300"
                                  : "bg-surface-700 text-surface-300"
                            }`}
                          >
                            {t.priority}
                          </span>
                          <span className="text-sm text-surface-300 bg-surface-800 px-3 py-1 rounded-md border border-surface-600">
                            {t.devName}
                          </span>
                          <span className="text-xs text-surface-400 font-medium">Status: IN PROGRESS</span>

                          {(t.isOverdue || t.isStuck) && (
                            <>
                              <div className="h-4 w-px bg-surface-700 mx-1"></div>
                              {t.isOverdue && <span className="text-[11px] font-bold text-danger-400">🔴 OVERDUE</span>}
                              {t.isStuck && <span className="text-[11px] font-bold text-warning-400">🟠 STUCK</span>}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass-card p-6 border border-surface-700/50">
                <h3 className="text-xl font-bold text-surface-200 mb-6">Pending Work</h3>
                {pendingWork.length === 0 ? (
                  <p className="text-surface-400 text-sm italic">No pending tasks.</p>
                ) : (
                  <div className="space-y-4">
                    {pendingWork.map((t, idx) => (
                      <div
                        key={t.id}
                        className="flex items-start gap-4 p-4 bg-surface-900/40 rounded-xl border border-surface-800 hover:bg-surface-800/60 transition-colors"
                      >
                        <div className="text-2xl font-black text-surface-700 leading-none mt-1">
                          {String(idx + 1).padStart(2, "0")}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-surface-200 font-bold mb-1 flex items-center gap-2">
                            {t.title}
                            {t.isOverdue && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-danger-500/20 text-danger-300 uppercase">
                                🔴 OVERDUE
                              </span>
                            )}
                          </h4>
                          <p className="text-sm text-surface-400">
                            Assigned to <span className="text-surface-300 font-medium">{t.devName}</span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass-card p-6 border border-surface-700/50">
                <h3 className="text-xl font-bold text-success-400 mb-6 flex items-center gap-2">✓ Completed Work</h3>
                {completedWork.length === 0 ? (
                  <p className="text-surface-400 text-sm italic">No completed tasks yet.</p>
                ) : (
                  <div className="space-y-3">
                    {completedWork.map((t) => (
                      <div
                        key={t.id}
                        className="flex justify-between items-center p-3 border-b border-surface-700/50 last:border-0 hover:bg-surface-800/30 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-success-500">✓</span>
                          <span className="text-surface-300 text-sm font-medium">{t.title}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-surface-400 text-sm">{t.devName}</span>
                          <span className="text-[10px] uppercase font-bold text-surface-500 px-2 py-1 rounded bg-surface-800">
                            {t.priority}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass-card p-6 border border-surface-700/50 bg-primary-900/10">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-primary-400 flex items-center gap-2">
                    <span className="text-2xl">💡</span> Key Developer Takeaways
                  </h3>
                  <p className="text-surface-400 text-sm mt-1">
                    AI-synthesized insights for a smooth onboarding experience.
                  </p>
                </div>

                <div className="space-y-6">
                  {summary.current_work && summary.current_work !== "N/A" && summary.current_work !== "None" && (
                    <div>
                      <h4 className="text-sm font-bold text-surface-300 uppercase tracking-wider mb-2">Current Focus</h4>
                      <p className="text-surface-200 text-sm leading-relaxed">{summary.current_work}</p>
                    </div>
                  )}

                  {summary.previous_developer_work &&
                    summary.previous_developer_work !== "N/A" &&
                    summary.previous_developer_work !== "None" && (
                      <div>
                        <h4 className="text-sm font-bold text-surface-300 uppercase tracking-wider mb-2">
                          Important Decisions & Completed Work
                        </h4>
                        <p className="text-surface-200 text-sm leading-relaxed">{summary.previous_developer_work}</p>
                      </div>
                    )}

                  {summary.what_next_developer_should_know &&
                    summary.what_next_developer_should_know !== "N/A" &&
                    summary.what_next_developer_should_know !== "None" && (
                      <div>
                        <h4 className="text-sm font-bold text-surface-300 uppercase tracking-wider mb-2">
                          Things to Understand
                        </h4>
                        <p className="text-surface-200 text-sm leading-relaxed">{summary.what_next_developer_should_know}</p>
                      </div>
                    )}

                  {summary.blocked_overdue_work &&
                    summary.blocked_overdue_work !== "N/A" &&
                    summary.blocked_overdue_work !== "None" && (
                      <div>
                        <h4 className="text-sm font-bold text-surface-300 uppercase tracking-wider mb-2">
                          Important Dependencies & Blockers
                        </h4>
                        <p className="text-surface-200 text-sm leading-relaxed">{summary.blocked_overdue_work}</p>
                      </div>
                    )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-1 space-y-8">
              <div className="glass-card p-6 border border-primary-500/30 bg-gradient-to-b from-primary-900/10 to-transparent">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-primary-300">Recommended Next Steps</h3>
                  <p className="text-surface-400 text-xs mt-1">
                    Prioritized actions based on the current verified project state.
                  </p>
                </div>

                <div className="space-y-4">
                  {summary.recommended_next_steps && summary.recommended_next_steps !== "N/A" && (
                    <div className="bg-surface-900/50 p-3 rounded-lg border border-primary-500/20">
                      <p className="text-sm text-surface-200 leading-relaxed">{summary.recommended_next_steps}</p>
                    </div>
                  )}

                  {systemRecommendations.length > 0 ? (
                    systemRecommendations.map((rec, idx) => (
                      <div key={idx} className="flex items-start gap-4">
                        <div className="text-sm font-bold text-primary-400 mt-1">{String(rec.id).padStart(2, "0")}</div>
                        <div>
                          <h4 className="text-surface-200 font-bold text-sm mb-1">{rec.title}</h4>
                          <p className="text-sm text-surface-400 leading-snug">{rec.desc}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-surface-400 text-sm">No specific recommendations at this time.</p>
                  )}
                </div>
              </div>

              <div className="glass-card p-6 border border-surface-700/50">
                <h3 className="text-xl font-bold text-surface-100 mb-6">GitHub Activity</h3>

                {!hasGithub ? (
                  <p className="text-surface-400 text-sm italic">No GitHub repository connected.</p>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <div className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">Repository</div>
                      <div className="text-sm text-info-400 bg-info-900/20 px-3 py-2 rounded-md border border-info-500/20 font-mono break-all">
                        {github.repository}
                      </div>
                    </div>

                    <div className="h-px bg-surface-700/50 w-full"></div>

                    <div>
                      <div className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-3">Open Pull Requests</div>
                      {unmappedPrs.length === 0 ? (
                        <p className="text-surface-400 text-sm">No open pull requests.</p>
                      ) : (
                        <div className="space-y-4">
                          <div className="text-surface-300 font-medium text-sm">{unmappedPrs.length} Open PRs</div>
                          {unmappedPrs.map((pr: any, i: number) => (
                            <div key={i} className="flex gap-3">
                              <span className="text-surface-500 font-bold text-sm mt-0.5">{i + 1}.</span>
                              <div>
                                <div className="text-sm font-medium text-surface-200 leading-snug">{pr.title}</div>
                                <div className="text-xs text-surface-400 mt-1">{pr.author} · {pr.state}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="h-px bg-surface-700/50 w-full"></div>

                    <div>
                      <div className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-3">Recent Commits</div>
                      {unmappedCommits.length === 0 ? (
                        <p className="text-surface-400 text-sm">No recent commits.</p>
                      ) : (
                        <div className="space-y-3">
                          {unmappedCommits.slice(0, 5).map((c: any, i: number) => (
                            <div key={i} className="text-sm text-surface-300">
                              <div className="text-info-400 font-mono text-xs mb-1">{c.sha ? c.sha.substring(0, 6) : "—"}</div>
                              <div className="font-medium">{c.message.split("\n")[0]}</div>
                              <div className="text-xs text-surface-500 mt-0.5">{c.author}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="h-px bg-surface-700/50 w-full"></div>

                    <div>
                      <div className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-3">Verification Status</div>
                      {!hasVerifiedMappings ? (
                        <div className="text-sm text-surface-300 bg-surface-800/50 p-3 rounded-lg border border-surface-700/50 flex items-start gap-2">
                          <span className="text-info-400">ℹ️</span>
                          <span>GitHub activities are currently not verified against DevFlow tasks.</span>
                        </div>
                      ) : (
                        <div className="text-sm text-success-300 bg-success-900/20 p-3 rounded-lg border border-success-500/20 flex items-start gap-2">
                          <span>✓</span>
                          <span>GitHub activities are verified and mapped to DevFlow tasks.</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="glass-card p-6 border border-surface-700/50 bg-surface-900/40">
                <h3 className="text-lg font-bold text-surface-300 mb-4">Important Context</h3>
                <ul className="space-y-2 list-disc list-outside ml-4">
                  <li className="text-sm text-surface-400 leading-relaxed">
                    {hasGithub && !hasVerifiedMappings
                      ? "GitHub activities currently have no verified DevFlow task mappings."
                      : "Project is actively connected and mappings are up to date."}
                  </li>
                  {summary.known_issues && summary.known_issues.trim() && (
                    <li className="text-sm text-surface-400 leading-relaxed">{summary.known_issues}</li>
                  )}
                  {summary.important_context && summary.important_context.trim() && (
                    <li className="text-sm text-surface-400 leading-relaxed">{summary.important_context}</li>
                  )}
                </ul>
              </div>

              <div className="glass-card p-0 flex flex-col h-[600px] border-primary-500/30 shadow-2xl shadow-primary-500/10 rounded-xl overflow-hidden">
                <div className="p-5 border-b border-surface-700/50 bg-surface-800">
                  <h3 className="font-bold text-surface-100 flex items-center gap-2">💬 Ask AI About This Project</h3>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-surface-900/50">
                  {chatLog.length === 0 ? (
                    <div className="space-y-4">
                      <p className="text-surface-400 text-sm font-medium">Suggested questions:</p>
                      <div className="flex flex-col gap-2">
                        {[
                          "What should I work on first?",
                          "What did the previous developers complete?",
                          "Which tasks need attention?",
                          "What are the current project risks?",
                          "Which GitHub PRs should I review?",
                          "What should I know before taking over this project?",
                        ].map((q, i) => (
                          <button
                            key={i}
                            onClick={() => handleAsk(undefined, q)}
                            disabled={asking}
                            className="text-sm bg-surface-800 hover:bg-primary-900/50 text-surface-200 border border-surface-600 hover:border-primary-500/50 px-4 py-2.5 rounded-lg transition-colors text-left"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    chatLog.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[90%] p-3.5 rounded-xl text-sm ${
                            msg.role === "user"
                              ? "bg-primary-600 text-white rounded-br-sm shadow-md"
                              : "bg-surface-800 text-surface-200 rounded-bl-sm border border-surface-700 shadow-md"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                        </div>
                      </div>
                    ))
                  )}
                  {asking && (
                    <div className="flex justify-start">
                      <div className="bg-surface-800 border border-surface-700 text-surface-200 p-4 rounded-xl rounded-bl-sm flex gap-1.5 shadow-md">
                        <span className="w-1.5 h-1.5 bg-surface-400 rounded-full animate-bounce"></span>
                        <span
                          className="w-1.5 h-1.5 bg-surface-400 rounded-full animate-bounce"
                          style={{ animationDelay: "150ms" }}
                        ></span>
                        <span
                          className="w-1.5 h-1.5 bg-surface-400 rounded-full animate-bounce"
                          style={{ animationDelay: "300ms" }}
                        ></span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-surface-700/50 bg-surface-800">
                  <form onSubmit={handleAsk} className="flex gap-3">
                    <input
                      type="text"
                      className="input flex-1 text-sm bg-surface-900 border-surface-600 focus:border-primary-500 placeholder-surface-500 px-4 py-3 rounded-lg"
                      placeholder="Ask a question about this project..."
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      disabled={asking}
                    />
                    <button
                      type="submit"
                      disabled={asking || !question.trim()}
                      className="btn btn-primary px-4 py-3 shadow-lg shadow-primary-500/20 rounded-lg"
                    >
                      <svg className="w-5 h-5 transform rotate-90" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                      </svg>
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {summary && !loadingSummary && !ctx && (
        <div className="glass-card p-8 border border-danger-500/30 bg-danger-900/5 text-center">
          <h3 className="text-xl font-bold text-danger-400 mb-4">⚠️ Fallback AI Mode</h3>
          <p className="text-surface-200 mb-6">{summary.project_overview}</p>
          <p className="text-surface-400 text-sm">{summary.important_context}</p>
        </div>
      )}
    </div>
  );
}
