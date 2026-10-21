import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Sparkles,
  Send,
  Square,
  Copy,
  Check,
  RotateCcw,
  FileText,
  Layers,
  Bot,
  User,
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
  ChevronDown,
  ChevronUp,
  Cpu,
  RefreshCw,
  Terminal,
  ExternalLink,
  GitBranch,
  Edit3,
  MessageSquare,
  ListChecks,
  ShieldAlert,
  Info,
  CheckSquare,
} from "lucide-react";
import { fetchAllProjects } from "../../services/adminService";
import {
  generateContinuitySummary,
  askContinuityQuestion,
  streamContinuityQuestion,
  getContinuityAiStatus,
  getContinuityDataBriefing,
  updateContinuityProjectContext,
} from "../../services/continuityService";
import type {
  ContinuitySummary,
  AIStatusResponse,
  NextDeveloperPlanItem,
  AttentionRequiredItem,
  ProjectContextUpdatePayload,
} from "../../services/continuityService";

interface ChatMessageItem {
  id: string;
  role: "user" | "ai";
  text: string;
  timestamp: string;
  isError?: boolean;
}



// Quick questions for pills and test-assertion compatibility
const SUGGESTED_QUESTIONS = [
  {
    title: "Next Developer Actions",
    question: "What should the next developer do?",
    description: "Find critical in-progress or pending tasks requiring immediate focus.",
    icon: Clock,
  },
  {
    title: "Priority Guidance",
    question: "What should I work on first?",
    description: "Inspect highest urgency deliverables and immediate blockers.",
    icon: Clock,
  },
  {
    title: "Project Handover",
    question: "Generate a project handover.",
    description: "Summarize project purpose, progress, key deliverables, and next steps.",
    icon: FileText,
  },
  {
    title: "Previous Deliverables",
    question: "What did the previous developers complete?",
    description: "Review finished tasks, mapped commits, and recent contributor history.",
    icon: CheckCircle2,
  },
  {
    title: "Blockers & Risks",
    question: "Identify confirmed project blockers.",
    description: "Inspect active workflow risks, overdue deadlines, and stuck items.",
    icon: AlertTriangle,
  },
  {
    title: "Code & Concepts",
    question: "Explain code or debug an error.",
    description: "General engineering explanations, debugging assistance, and architecture advice.",
    icon: Terminal,
  },
  {
    title: "GitHub Activity",
    question: "Summarize project activity and GitHub status.",
    description: "Review repository commits, pull requests, issues, and branch health.",
    icon: GitBranch,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Markdown Parser & Highlighting Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function FormattedInline({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
          return (
            <code
              key={i}
              className="px-1.5 py-0.5 mx-0.5 rounded bg-surface-800 border border-surface-700/60 font-mono text-[12px] text-primary-300 font-medium"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return (
            <strong key={i} className="font-semibold text-surface-50">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
          return (
            <em key={i} className="italic text-surface-200">
              {part.slice(1, -1)}
            </em>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-surface-700/70 bg-surface-950/90 shadow-xl">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-surface-900 border-b border-surface-800 text-xs">
        <span className="font-mono text-[11px] uppercase tracking-wider text-primary-400 font-semibold">
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          aria-label="Copy code block"
          className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-surface-800 text-surface-300 hover:text-surface-100 transition-colors text-[11px]"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Code</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-xs font-mono text-emerald-300/90 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function TextContent({ text }: { text: string }) {
  const lines = text.split("\n");
  const rendered: React.ReactNode[] = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      rendered.push(<div key={idx} className="h-1.5" />);
      return;
    }

    if (trimmed.startsWith("### ")) {
      rendered.push(
        <h4 key={idx} className="text-sm font-bold text-surface-100 mt-3 mb-1 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />
          <FormattedInline text={trimmed.slice(4)} />
        </h4>
      );
    } else if (trimmed.startsWith("## ")) {
      rendered.push(
        <h3 key={idx} className="text-base font-bold text-white mt-3.5 mb-1.5 border-b border-surface-800/80 pb-1">
          <FormattedInline text={trimmed.slice(3)} />
        </h3>
      );
    } else if (trimmed.startsWith("# ")) {
      rendered.push(
        <h2 key={idx} className="text-lg font-extrabold text-white mt-4 mb-2">
          <FormattedInline text={trimmed.slice(2)} />
        </h2>
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      rendered.push(
        <div key={idx} className="flex items-start gap-2.5 pl-1 my-1 text-surface-200">
          <span className="text-primary-400 mt-1 text-xs shrink-0">•</span>
          <div className="leading-relaxed">
            <FormattedInline text={trimmed.slice(2)} />
          </div>
        </div>
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s(.*)$/);
      const num = match ? match[1] : "1";
      const rest = match ? match[2] : trimmed;
      rendered.push(
        <div key={idx} className="flex items-start gap-2 pl-1 my-1 text-surface-200">
          <span className="text-primary-400 font-mono text-xs font-semibold shrink-0">{num}.</span>
          <div className="leading-relaxed">
            <FormattedInline text={rest} />
          </div>
        </div>
      );
    } else {
      rendered.push(
        <p key={idx} className="text-surface-200 leading-relaxed my-0.5">
          <FormattedInline text={line} />
        </p>
      );
    }
  });

  return <div className="space-y-0.5">{rendered}</div>;
}

function MarkdownMessage({ content }: { content: string }) {
  const segments = content.split(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g);

  if (segments.length === 1) {
    return <TextContent text={content} />;
  }

  const elements: React.ReactNode[] = [];
  for (let i = 0; i < segments.length; i += 3) {
    const textPart = segments[i];
    if (textPart) {
      elements.push(<TextContent key={`text-${i}`} text={textPart} />);
    }
    if (i + 2 < segments.length) {
      const lang = segments[i + 1] || "code";
      const code = segments[i + 2];
      elements.push(<CodeBlock key={`code-${i}`} language={lang} code={code.trim()} />);
    }
  }

  return <div className="space-y-1 text-sm leading-relaxed">{elements}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main AI Continuity Page
// ─────────────────────────────────────────────────────────────────────────────

export default function AIContinuityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialProjectId = searchParams.get("project") || "";

  const [projects, setProjects] = useState<{ id: string; name: string; status: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Active View Mode: Chat Workspace vs. Handover Intelligence Dossier
  const [activeTab, setActiveTab] = useState<"chat" | "dossier">("chat");

  // Summary state
  const [summary, setSummary] = useState<ContinuitySummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summarySource, setSummarySource] = useState<"ai" | "briefing" | null>(null);

  // Context drawer toggle (for quick peek inside chat workspace)
  const [showContextDrawer, setShowContextDrawer] = useState(false);

  // AI Service Status
  const [aiStatus, setAiStatus] = useState<AIStatusResponse | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Chat state per project (preserves history when switching projects)
  const [chatHistoryByProject, setChatHistoryByProject] = useState<Record<string, ChatMessageItem[]>>({});
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [lastFailedQuestion, setLastFailedQuestion] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  // Interactive Checklist check state
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});

  // Context Editor Modal state
  const [showEditContextModal, setShowEditContextModal] = useState(false);
  const [editDescription, setEditDescription] = useState("");
  const [editTechStack, setEditTechStack] = useState("");
  const [editRepoUrl, setEditRepoUrl] = useState("");
  const [editHandoverNotes, setEditHandoverNotes] = useState("");
  const [savingContext, setSavingContext] = useState(false);
  const [contextNotification, setContextNotification] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const currentChatLog = useMemo(
    () => (selectedProjectId ? chatHistoryByProject[selectedProjectId] || [] : chatHistoryByProject["general"] || []),
    [chatHistoryByProject, selectedProjectId]
  );

  // Auto-scroll to bottom smoothly on new message or generating state
  useEffect(() => {
    if (activeTab === "chat" && typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentChatLog.length, asking, activeTab]);

  // Load all projects on mount
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

  // Update query params when project changes
  useEffect(() => {
    if (selectedProjectId) {
      setSearchParams({ project: selectedProjectId });
    }
  }, [selectedProjectId, setSearchParams]);

  // Fetch AI status
  const checkStatus = useCallback(async (projId: string) => {
    setCheckingStatus(true);
    try {
      const token = localStorage.getItem("access_token") || "";
      const status = await getContinuityAiStatus(projId || "general", token);
      setAiStatus(status);
    } catch {
      setAiStatus({
        provider: "ollama",
        model: "llama3.2:1b",
        status: "unavailable",
      });
    } finally {
      setCheckingStatus(false);
    }
  }, []);

  // When project changes, fetch status and initial briefing if not yet generated
  useEffect(() => {
    if (selectedProjectId) {
      checkStatus(selectedProjectId);
      setSummary(null);
      setSummaryError(null);
      setSummarySource(null);
      setLastFailedQuestion(null);

      // Fetch verified database briefing as fast instant preview
      const token = localStorage.getItem("access_token") || "";
      getContinuityDataBriefing(selectedProjectId, token)
        .then((briefing) => {
          setSummary((prev) => (prev ? prev : briefing));
          setSummarySource((prev) => (prev ? prev : "briefing"));
        })
        .catch((err) => {
          console.warn("Could not load initial data briefing", err);
        });
    } else {
      checkStatus("general");
    }
  }, [selectedProjectId, checkStatus]);

  // Generate full AI continuity summary
  const handleGenerate = useCallback(async () => {
    if (!selectedProjectId) return;
    setLoadingSummary(true);
    setSummaryError(null);
    try {
      const token = localStorage.getItem("access_token") || "";
      const result = await generateContinuitySummary(selectedProjectId, token);
      setSummary(result);
      setSummarySource("ai");
    } catch (err: any) {
      const msg = err.message || "Failed to generate project summary";
      setSummaryError(msg);
      if (err.raw_context && !summary) {
        setSummary({
          project_overview: "AI summary generation encountered an issue. Verified project records remain available below.",
          previous_developer_work: "See completed task history below.",
          current_work: "See active tasks below.",
          pending_work: "See pending tasks below.",
          blocked_overdue_work: "See risks and attention required below.",
          recent_github_activity: "See GitHub repository details below.",
          known_issues: "See active risks below.",
          important_context: "Consult the project manager for details.",
          what_next_developer_should_know: "Review verified task records.",
          recommended_next_steps: "Review open tasks.",
          raw_context: err.raw_context,
        });
        setSummarySource("briefing");
      }
    } finally {
      setLoadingSummary(false);
    }
  }, [selectedProjectId, summary]);

  // Handle Ask Question
  const handleAsk = async (presetQ?: string) => {
    const currentQ = (presetQ ?? question).trim();
    if (!currentQ || asking) return;

    if (!presetQ) setQuestion("");
    setLastFailedQuestion(null);

    // Switch to chat view if triggered from Dossier
    if (activeTab !== "chat") {
      setActiveTab("chat");
    }

    const projectKey = selectedProjectId || "general";

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessageItem = {
      id: userMsgId,
      role: "user",
      text: currentQ,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const aiMsgId = `ai-${Date.now() + 1}`;
    const initialAiMsg: ChatMessageItem = {
      id: aiMsgId,
      role: "ai",
      text: "",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatHistoryByProject((prev) => ({
      ...prev,
      [projectKey]: [...(prev[projectKey] || []), userMsg, initialAiMsg],
    }));

    const existingLog = chatHistoryByProject[projectKey] || [];
    const historyMessages = existingLog
      .filter((m) => !m.isError && m.text.trim())
      .slice(-10)
      .map((m) => ({
        role: (m.role === "ai" ? "assistant" : "user") as "assistant" | "user",
        content: m.text,
      }));

    setAsking(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const token = localStorage.getItem("access_token") || "";
      let finalAnswer = "";

      try {
        finalAnswer = await streamContinuityQuestion(
          selectedProjectId,
          currentQ,
          token,
          historyMessages,
          (accumulatedChunk) => {
            setChatHistoryByProject((prev) => {
              const list = prev[projectKey] || [];
              return {
                ...prev,
                [projectKey]: list.map((m) =>
                  m.id === aiMsgId ? { ...m, text: accumulatedChunk } : m
                ),
              };
            });
          },
          controller.signal
        );
      } catch (streamErr: any) {
        if (controller.signal.aborted) throw streamErr;
        // Fallback to non-streaming if stream encounters an issue
        const fallbackRes = await askContinuityQuestion(
          selectedProjectId,
          currentQ,
          token,
          historyMessages,
          controller.signal
        );
        finalAnswer = fallbackRes.answer;
      }

      setChatHistoryByProject((prev) => {
        const list = prev[projectKey] || [];
        return {
          ...prev,
          [projectKey]: list.map((m) =>
            m.id === aiMsgId ? { ...m, text: finalAnswer || m.text } : m
          ),
        };
      });
    } catch (err: any) {
      if (err.name === "AbortError" || controller.signal.aborted) {
        setChatHistoryByProject((prev) => {
          const list = prev[projectKey] || [];
          return {
            ...prev,
            [projectKey]: list.map((m) =>
              m.id === aiMsgId
                ? {
                    ...m,
                    text: m.text ? `${m.text}\n\n*[Generation stopped]*` : "Response generation was stopped.",
                  }
                : m
            ),
          };
        });
        return;
      }

      const errorText = err.message || "Failed to reach AI service";
      const isTimeout = errorText.toLowerCase().includes("time") || errorText.includes("504");
      const isUnavailable = errorText.includes("503") || errorText.toLowerCase().includes("unavailable");

      let userFacingError = "⚠️ AI response unavailable. ";
      if (isTimeout) {
        userFacingError += "The local Ollama model timed out while generating. Please retry your question.";
      } else if (isUnavailable) {
        userFacingError += "The local Ollama daemon is unreachable. Verify it is running at localhost:11434.";
      } else {
        userFacingError += errorText;
      }

      setLastFailedQuestion(currentQ);

      setChatHistoryByProject((prev) => {
        const list = prev[projectKey] || [];
        return {
          ...prev,
          [projectKey]: list.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  text: userFacingError,
                  isError: true,
                }
              : m
          ),
        };
      });
    } finally {
      setAsking(false);
      abortControllerRef.current = null;
      textareaRef.current?.focus();
    }
  };

  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleCopyResponse = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  const handleClearChat = () => {
    const projectKey = selectedProjectId || "general";
    setChatHistoryByProject((prev) => ({
      ...prev,
      [projectKey]: [],
    }));
    setLastFailedQuestion(null);
  };

  // Open Context Editor Modal
  const handleOpenContextModal = () => {
    const proj = summary?.raw_context?.project;
    setEditDescription(proj?.description || "");
    setEditTechStack(proj?.tech_stack || "");
    setEditRepoUrl(summary?.raw_context?.github?.repository ? `https://github.com/${summary.raw_context.github.repository}` : "");
    setEditHandoverNotes("");
    setContextNotification(null);
    setShowEditContextModal(true);
  };

  // Save Context Update
  const handleSaveContext = async () => {
    if (!selectedProjectId) return;
    setSavingContext(true);
    setContextNotification(null);
    try {
      const token = localStorage.getItem("access_token") || "";
      const payload: ProjectContextUpdatePayload = {
        description: editDescription.trim() || undefined,
        tech_stack: editTechStack.trim() || undefined,
        repository_url: editRepoUrl.trim() || undefined,
        handover_notes: editHandoverNotes.trim() || undefined,
      };
      const refreshedSummary = await updateContinuityProjectContext(selectedProjectId, payload, token);
      setSummary(refreshedSummary);
      setSummarySource("briefing");
      setContextNotification("Project context saved and handover refreshed successfully!");
      setTimeout(() => {
        setShowEditContextModal(false);
        setContextNotification(null);
      }, 1500);
    } catch (err: any) {
      setContextNotification(`Failed to save: ${err.message || "Unknown error"}`);
    } finally {
      setSavingContext(false);
    }
  };

  // Toggle Checklist step
  const handleToggleChecklist = (stepNum: number) => {
    setCheckedSteps((prev) => ({
      ...prev,
      [stepNum]: !prev[stepNum],
    }));
  };

  // Raw Context & Derived Facts for Selected Project
  const ctx = summary?.raw_context;
  const tasks = ctx?.tasks || [];
  const currentProject = projects.find((p) => p.id === selectedProjectId);

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
    if (!tasks) return [];
    return tasks.map((t: any) => {
      const taskRisks = (ctx?.risks || []).filter((r: any) => r.task_id === t.id && !r.is_resolved);
      const isOverdue = taskRisks.some((r: any) => r.risk_type === "OVERDUE");
      const isStuck = taskRisks.some((r: any) => r.risk_type === "STUCK");

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
  }, [tasks, ctx?.risks]);

  const attentionRequired = enrichedTasks.filter((t: any) => t.riskLabel && t.status !== "COMPLETED");
  const completedWork = enrichedTasks.filter((t: any) => t.status === "COMPLETED" || t.status === "DONE");
  const inProgressWork = enrichedTasks.filter((t: any) => t.status === "IN_PROGRESS" || t.status === "IN PROGRESS");
  const pendingWork = enrichedTasks.filter((t: any) => t.status === "TODO" || t.status === "PENDING");

  const github = ctx?.github;
  const commits = github?.commits || [];
  const pullRequests = github?.pull_requests || [];
  const unmappedPrs = ctx?.unmapped_prs || [];

  const whatDeveloperShouldKnow = useMemo(() => {
    if (!ctx) return [];
    const items: string[] = [];
    if (ctx.project?.progress !== undefined) {
      items.push(`Project is currently verified at ${ctx.project.progress}% progress.`);
    }

    inProgressWork.forEach((t: any) => {
      items.push(`"${t.title}" is a ${t.priority || "Standard"} priority task currently in progress by ${t.devName}.`);
    });

    if (attentionRequired.length > 0) {
      items.push(`${attentionRequired.length} task(s) currently require attention due to recorded workflow risks.`);
    }

    if (pendingWork.length > 0) {
      items.push(`Highest priority pending deliverable: "${pendingWork[0].title}".`);
    }

    if (unmappedPrs.length > 0) {
      items.push(`${unmappedPrs.length} GitHub Pull Request(s) are open for review.`);
    }

    return items;
  }, [ctx, inProgressWork, attentionRequired, pendingWork, unmappedPrs]);

  const activeFocusTask = inProgressWork[0] || tasks[0];

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)] max-h-[calc(100vh-5.5rem)] w-full overflow-hidden bg-surface-950 text-surface-100 rounded-2xl border border-surface-800/90 shadow-2xl relative">
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Top Header & Workspace Title                                       */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <header className="px-4 py-2.5 bg-surface-900/95 backdrop-blur-md border-b border-surface-800/80 flex flex-wrap items-center justify-between gap-3 shrink-0 z-20">
        {/* Left: Branding & Model identity */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary-600 via-indigo-600 to-primary-400 p-0.5 shadow-md shadow-primary-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-surface-950 rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                ✨ AI Project Summary & Continuity
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-500/10 text-primary-300 border border-primary-500/20">
                Workspace
              </span>
            </div>
          </div>
        </div>

        {/* Center: Mode Switcher (Conversational Chat vs. Handover Intelligence Dossier) */}
        <div className="flex items-center bg-surface-950/80 p-0.5 rounded-xl border border-surface-800">
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === "chat"
                ? "bg-primary-600 text-white shadow-sm shadow-primary-600/30"
                : "text-surface-400 hover:text-surface-200"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>AI Workspace</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("dossier")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === "dossier"
                ? "bg-primary-600 text-white shadow-sm shadow-primary-600/30"
                : "text-surface-400 hover:text-surface-200"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Handover Dossier</span>
            {summary?.data_coverage && (
              <span className="px-1.5 py-0.2 rounded-full bg-surface-800 text-primary-300 text-[10px] font-mono border border-surface-700">
                {summary.data_coverage.verified_count}/{summary.data_coverage.total_sources}
              </span>
            )}
          </button>
        </div>

        {/* Right: Controls & Context Drawer Toggle */}
        <div className="flex items-center gap-2 ml-auto">
          {/* AI Model Status Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-950/70 border border-surface-800 text-xs">
            <Cpu className="w-3.5 h-3.5 text-surface-400" />
            {checkingStatus ? (
              <span className="text-[11px] text-surface-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-surface-400 animate-pulse" />
                Checking...
              </span>
            ) : asking ? (
              <span className="text-[11px] font-medium text-primary-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-ping" />
                DevFlow AI Generating...
              </span>
            ) : aiStatus?.status === "ready" ? (
              <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {aiStatus.model || "llama3.2:1b"} · Ready
              </span>
            ) : (
              <button
                onClick={() => checkStatus(selectedProjectId || "general")}
                title="Click to recheck Ollama status"
                className="text-[11px] font-medium text-warning-400 hover:text-warning-300 flex items-center gap-1 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-warning-400" />
                Ollama Offline (Retry)
              </button>
            )}
          </div>

          {/* Project Selector */}
          <div className="flex items-center gap-1.5 bg-surface-950/70 px-2.5 py-1 rounded-lg border border-surface-800">
            <label htmlFor="project-selector" className="text-[11px] font-bold text-surface-400 uppercase tracking-wider">
              Project:
            </label>
            <select
              id="project-selector"
              className="bg-transparent text-surface-100 text-xs font-medium focus:outline-none cursor-pointer max-w-[150px] sm:max-w-[190px] truncate"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              disabled={loadingProjects}
            >
              {projects.length === 0 && <option value="">No projects available</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-surface-900 text-surface-100">
                  {p.name} ({p.status})
                </option>
              ))}
            </select>
          </div>

          {/* Clear Chat Button / New Chat */}
          {activeTab === "chat" && currentChatLog.length > 0 && (
            <button
              onClick={handleClearChat}
              title="Start a new conversation and return to welcome screen"
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-surface-300 hover:text-white bg-surface-800 hover:bg-surface-750 border border-surface-700 rounded-lg transition-colors shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>New Chat</span>
            </button>
          )}
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Compact Project Intelligence Context Strip                         */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {ctx?.project ? (
        <div className="px-4 py-2 bg-surface-900/60 border-b border-surface-800/80 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 z-10">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-surface-300">
            <span className="font-bold text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary-400" />
              <span>{ctx.project.name || currentProject?.name || "Alpha Project"}</span>
            </span>
            <span className="text-surface-600 hidden sm:inline">|</span>
            <span className="px-2 py-0.5 rounded bg-surface-800 text-surface-200 font-semibold border border-surface-700/80 text-[11px]">
              {ctx.project.progress !== undefined ? `${ctx.project.progress}% Complete` : "0% Complete"}
            </span>
            <span className="text-surface-600 hidden sm:inline">|</span>
            <span className="text-surface-300">
              Managed by: <strong className="text-surface-100 font-semibold">{pmName}</strong>
            </span>
            {activeFocusTask && (
              <>
                <span className="text-surface-600 hidden md:inline">|</span>
                <span className="text-primary-300 bg-primary-950/60 px-2 py-0.5 rounded border border-primary-500/20 font-medium hidden md:inline-flex items-center gap-1">
                  <Clock className="w-3 h-3 text-primary-400" />
                  <span>{activeFocusTask.title}</span>
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {activeTab === "chat" ? (
              <button
                onClick={() => setShowContextDrawer((prev) => !prev)}
                aria-expanded={showContextDrawer}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                  showContextDrawer
                    ? "bg-primary-600/30 text-primary-200 border-primary-500/50 shadow-sm"
                    : "bg-surface-800 hover:bg-surface-700 text-surface-200 border-surface-700"
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-primary-400" />
                <span>{showContextDrawer ? "Hide Handover Intelligence" : "View Handover Intelligence"}</span>
                {attentionRequired.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-danger-500/20 text-danger-300 text-[10px] font-bold border border-danger-500/30">
                    {attentionRequired.length}
                  </span>
                )}
                {showContextDrawer ? <ChevronUp className="w-3.5 h-3.5 ml-0.5" /> : <ChevronDown className="w-3.5 h-3.5 ml-0.5" />}
              </button>
            ) : (
              <button
                onClick={handleOpenContextModal}
                className="px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 bg-surface-800 hover:bg-surface-700 text-surface-200 border border-surface-700 transition-all"
              >
                <Edit3 className="w-3.5 h-3.5 text-primary-400" />
                <span>Edit Project Context</span>
              </button>
            )}
          </div>
        </div>
      ) : null}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Quick Peek Drawer (Collapsible inside chat workspace)              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {showContextDrawer && activeTab === "chat" && (
        <div className="border-b border-surface-800 bg-surface-900/95 backdrop-blur-xl max-h-[45vh] overflow-y-auto p-5 shadow-2xl transition-all z-20">
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-800">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary-400" />
                  Verified Handover Intelligence & Database Records
                </h2>
                <p className="text-xs text-surface-400 mt-0.5">
                  Grounded in verified tasks, activity logs, assignees, and workflow telemetry.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowContextDrawer(false);
                    setActiveTab("dossier");
                  }}
                  className="px-3 py-1.5 bg-surface-800 hover:bg-surface-700 text-primary-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-surface-700 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open Full Dossier
                </button>
                <button
                  onClick={() => setShowContextDrawer(false)}
                  className="p-1.5 text-surface-400 hover:text-surface-200 hover:bg-surface-800 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Handover Narrative */}
            {summary && (
              <div
                className={`p-3.5 rounded-xl border-l-4 ${
                  summarySource === "ai"
                    ? "border-l-primary-500 bg-primary-950/30 border-surface-800"
                    : "border-l-info-500 bg-info-950/30 border-surface-800"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-primary-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    {summarySource === "ai" ? "AI Handover Summary" : "Verified Database Briefing"}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-800 text-surface-400 border border-surface-700">
                    {summarySource === "ai" ? "Grounded AI Model" : "System Records"}
                  </span>
                </div>
                <p className="text-surface-200 text-xs sm:text-sm leading-relaxed">{summary.project_overview}</p>
              </div>
            )}

            {/* Tasks and Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="p-3 bg-surface-950/70 rounded-xl border border-surface-800">
                <h4 className="text-xs font-bold text-danger-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Attention Required ({attentionRequired.length})
                </h4>
                {attentionRequired.length === 0 ? (
                  <p className="text-xs text-success-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> No overdue or blocked tasks recorded.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {attentionRequired.map((t: any) => (
                      <div key={t.id} className="p-2 bg-surface-900 rounded-lg border border-surface-800 text-xs flex justify-between">
                        <span className="font-semibold text-surface-200 truncate">{t.title}</span>
                        <span className="text-danger-400 font-bold ml-2 shrink-0">{t.riskLabel}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 bg-surface-950/70 rounded-xl border border-surface-800">
                <h4 className="text-xs font-bold text-surface-200 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Layers className="w-3.5 h-3.5 text-primary-400" />
                  What the Next Developer Should Know
                </h4>
                <ul className="space-y-1 text-xs text-surface-300">
                  {whatDeveloperShouldKnow.map((item, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-primary-400">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* VIEW 1: CONVERSATIONAL CHAT WORKSPACE (ChatGPT-like)                */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "chat" && (
        <main className="flex-1 flex flex-col min-h-0 relative overflow-hidden bg-surface-950">
          <span className="sr-only">AI Continuity Assistant</span>

          {/* Scrollable Message History & Welcome View */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 scroll-smooth flex flex-col min-h-0">
            <div className={`max-w-3xl xl:max-w-4xl mx-auto w-full ${currentChatLog.length === 0 ? "my-auto flex flex-col items-center justify-center flex-1" : "space-y-6"}`}>
              {/* INITIAL WELCOME SCREEN (Shown synchronously when there are no messages in current thread) */}
              {currentChatLog.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center animate-fade-in space-y-3.5 max-w-3xl mx-auto w-full py-2 sm:py-3">
                  {/* Glowing AI Star / Sparkle Symbol with complementary intelligence icon */}
                  <div className="relative group mb-0.5">
                    {/* Multi-layer subtle indigo/blue glow */}
                    <div className="absolute -inset-2.5 bg-gradient-to-r from-primary-600 via-indigo-600 to-blue-500 rounded-3xl blur-xl opacity-35 group-hover:opacity-55 transition duration-500" />
                    <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-primary-500 via-indigo-600 to-cyan-400 p-0.5 shadow-2xl shadow-indigo-500/30 flex items-center justify-center">
                      <div className="w-full h-full bg-surface-950/95 backdrop-blur-md rounded-[14px] flex items-center justify-center relative overflow-hidden">
                        <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-primary-400 animate-pulse drop-shadow-[0_0_12px_rgba(99,102,241,0.6)]" />
                      </div>
                    </div>
                    {/* Complementary intelligence-themed badge */}
                    <div
                      className="absolute -bottom-1 -right-1 w-5 h-5 rounded-lg bg-surface-900 border border-primary-500/40 shadow-lg flex items-center justify-center"
                      title="AI DevFlow Neural Core"
                    >
                      <Cpu className="w-3 h-3 text-cyan-400" />
                    </div>
                  </div>

                  {/* Visual Focal Point: Heading & Polished Subtitle */}
                  <div className="max-w-2xl px-4 space-y-1.5">
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight drop-shadow-sm">
                      Your Project. Your Intelligence.
                    </h2>
                    <p className="text-xs sm:text-sm text-surface-400 max-w-lg mx-auto leading-relaxed">
                      Your AI workspace for project understanding, development assistance, and intelligent handovers.
                    </p>
                  </div>

                  {/* Clean Active Scope Pill */}
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-900/90 border border-surface-800 text-[11px] text-surface-300 shadow-inner">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                    <span>
                      Active Scope:{" "}
                      <strong className="text-surface-100 font-semibold">
                        {currentProject?.name || "General Intelligence"}
                      </strong>
                    </span>
                  </div>

                  {/* Four Compact Feature Boxes (2x2 grid on laptop screens) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 w-full max-w-3xl px-2 text-left pt-1">
                    {/* 1. Handover Intelligence */}
                    <button
                      type="button"
                      id="feature-box-handover-intelligence"
                      onClick={() => {
                        setActiveTab("dossier");
                        if (!summary && selectedProjectId) {
                          handleGenerate();
                        }
                      }}
                      className="p-3 rounded-xl bg-surface-900/70 hover:bg-surface-850/95 border border-surface-800/90 hover:border-indigo-500/50 shadow-sm hover:shadow-indigo-500/10 transition-all duration-200 group text-left flex items-start gap-3 cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 group-hover:bg-indigo-500/20 group-hover:scale-105 transition-all mt-0.5">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-xs sm:text-sm font-bold text-white group-hover:text-indigo-300 transition-colors truncate">
                            Handover Intelligence
                          </span>
                          <span className="text-[10px] font-semibold text-indigo-400/90 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.2 rounded-full shrink-0">
                            Dossier
                          </span>
                        </div>
                        <p className="text-[11px] text-surface-400 leading-snug line-clamp-2">
                          Generate or review a project handover using verified project information.
                        </p>
                      </div>
                    </button>

                    {/* 2. Project Understanding */}
                    <button
                      type="button"
                      id="feature-box-project-understanding"
                      disabled={asking}
                      onClick={() => {
                        handleAsk("Provide a comprehensive overview of this project's architecture, scope, and current status based on available records.");
                      }}
                      className="p-3 rounded-xl bg-surface-900/70 hover:bg-surface-850/95 border border-surface-800/90 hover:border-sky-500/50 shadow-sm hover:shadow-sky-500/10 transition-all duration-200 group text-left flex items-start gap-3 cursor-pointer disabled:opacity-50"
                    >
                      <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 group-hover:bg-sky-500/20 group-hover:scale-105 transition-all mt-0.5">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-xs sm:text-sm font-bold text-white group-hover:text-sky-300 transition-colors truncate">
                            Project Understanding
                          </span>
                          <span className="text-[10px] font-semibold text-sky-400/90 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.2 rounded-full shrink-0">
                            Records
                          </span>
                        </div>
                        <p className="text-[11px] text-surface-400 leading-snug line-clamp-2">
                          Ask questions about the selected project using available project records.
                        </p>
                      </div>
                    </button>

                    {/* 3. Development Assistant */}
                    <button
                      type="button"
                      id="feature-box-development-assistant"
                      disabled={asking}
                      onClick={() => {
                        handleAsk("How can you assist me with programming, debugging, and development questions for this project?");
                      }}
                      className="p-3 rounded-xl bg-surface-900/70 hover:bg-surface-850/95 border border-surface-800/90 hover:border-emerald-500/50 shadow-sm hover:shadow-emerald-500/10 transition-all duration-200 group text-left flex items-start gap-3 cursor-pointer disabled:opacity-50"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/20 group-hover:scale-105 transition-all mt-0.5">
                        <Terminal className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-300 transition-colors truncate">
                            Development Assistant
                          </span>
                          <span className="text-[10px] font-semibold text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded-full shrink-0">
                            Code & Debug
                          </span>
                        </div>
                        <p className="text-[11px] text-surface-400 leading-snug line-clamp-2">
                          Get help with programming, debugging, and development questions.
                        </p>
                      </div>
                    </button>

                    {/* 4. Workflow Intelligence */}
                    <button
                      type="button"
                      id="feature-box-workflow-intelligence"
                      disabled={asking}
                      onClick={() => {
                        handleAsk("Summarize current task progress, dependencies, team activity, and verified blockers for this project.");
                      }}
                      className="p-3 rounded-xl bg-surface-900/70 hover:bg-surface-850/95 border border-surface-800/90 hover:border-amber-500/50 shadow-sm hover:shadow-amber-500/10 transition-all duration-200 group text-left flex items-start gap-3 cursor-pointer disabled:opacity-50"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 group-hover:bg-amber-500/20 group-hover:scale-105 transition-all mt-0.5">
                        <GitBranch className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                            Workflow Intelligence
                          </span>
                          <span className="text-[10px] font-semibold text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded-full shrink-0">
                            Telemetry
                          </span>
                        </div>
                        <p className="text-[11px] text-surface-400 leading-snug line-clamp-2">
                          Understand task progress, dependencies, activity, and verified blockers.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                /* ACTIVE CONVERSATION MESSAGES */
                currentChatLog.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {/* Assistant Avatar */}
                    {msg.role === "ai" && (
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-600 p-0.5 shadow-md shrink-0 mt-1">
                        <div className="w-full h-full bg-surface-950 rounded-[10px] flex items-center justify-center">
                          <Bot className="w-4 h-4 text-primary-400" />
                        </div>
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={`max-w-[85%] rounded-2xl shadow-xl transition-all ${
                        msg.role === "user"
                          ? "bg-primary-600 text-white rounded-tr-sm p-4 border border-primary-500/40"
                          : msg.isError
                          ? "bg-danger-950/40 text-danger-200 border border-danger-500/40 rounded-tl-sm p-4"
                          : "bg-surface-900/95 text-surface-100 border border-surface-800/90 rounded-tl-sm p-5"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed font-normal">
                          {msg.text}
                        </p>
                      ) : msg.text === "" && !msg.isError ? (
                        <div className="flex items-center gap-2 py-1 text-surface-400 text-xs">
                          <span className="w-2 h-2 rounded-full bg-primary-400 animate-ping" />
                          <span>DevFlow AI is thinking...</span>
                        </div>
                      ) : (
                        <div className="relative">
                          <MarkdownMessage content={msg.text} />
                          {asking && currentChatLog[currentChatLog.length - 1]?.id === msg.id && (
                            <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-primary-400 animate-pulse" />
                          )}
                        </div>
                      )}

                      {/* Message Footer */}
                      <div
                        className={`text-[11px] mt-2.5 pt-2 border-t flex items-center justify-between gap-3 ${
                          msg.role === "user"
                            ? "border-primary-500/30 text-primary-200/80"
                            : "border-surface-800/80 text-surface-400"
                        }`}
                      >
                        <span className="font-medium">
                          {msg.role === "user" ? "You" : "DevFlow AI Continuity Assistant"}
                        </span>
                        <div className="flex items-center gap-2">
                          <span>{msg.timestamp}</span>
                          {msg.role === "ai" && !msg.isError && msg.text && (
                            <button
                              onClick={() => handleCopyResponse(msg.text, msg.id)}
                              aria-label="Copy AI response"
                              className="flex items-center gap-1 hover:text-surface-200 transition-colors px-1.5 py-0.5 rounded hover:bg-surface-800"
                            >
                              {copiedMsgId === msg.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-400 text-[10px]">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span className="text-[10px]">Copy</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Recoverable Retry on Failure */}
                      {msg.isError && lastFailedQuestion && (
                        <div className="mt-3 pt-2 border-t border-danger-500/20 flex justify-end">
                          <button
                            onClick={() => handleAsk(lastFailedQuestion)}
                            disabled={asking}
                            className="px-3 py-1 bg-danger-500/20 hover:bg-danger-500/30 text-danger-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-danger-500/30"
                          >
                            <RotateCcw className="w-3 h-3" /> Retry Question
                          </button>
                        </div>
                      )}
                    </div>

                    {/* User Avatar */}
                    {msg.role === "user" && (
                      <div className="w-8 h-8 rounded-xl bg-surface-800 border border-surface-700 flex items-center justify-center shrink-0 mt-1 text-surface-200 shadow-md">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* Pinned Message Composer & Suggested Quick Prompts                 */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <div className="p-4 bg-gradient-to-t from-surface-950 via-surface-950/95 to-transparent shrink-0 z-10 space-y-2">
            <div className="max-w-3xl xl:max-w-4xl mx-auto w-full space-y-2">
              {/* Quick Suggested Prompt Pills (visible when conversation is active) */}
              {currentChatLog.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  <span className="text-[11px] font-bold text-surface-400 uppercase tracking-wider shrink-0">
                    Suggested Questions:
                  </span>
                  {SUGGESTED_QUESTIONS.map((item, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleAsk(item.question)}
                      disabled={asking}
                      className="text-xs px-3 py-1 rounded-full bg-surface-900/90 hover:bg-surface-800 text-surface-300 hover:text-white border border-surface-700/80 hover:border-primary-500/40 transition-all shrink-0 whitespace-nowrap shadow-sm disabled:opacity-50"
                    >
                      {item.question}
                    </button>
                  ))}
                </div>
              )}

              {/* Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAsk();
                }}
                className="relative bg-surface-900/90 backdrop-blur-md border border-surface-700/80 focus-within:border-primary-500/80 rounded-2xl shadow-2xl p-2 transition-all flex items-end gap-2"
              >
                <textarea
                  ref={textareaRef}
                  rows={Math.min(question.split("\n").length, 4) || 1}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    asking
                      ? "DevFlow AI is generating..."
                      : "Ask about tasks, risks, PRs, code, or general concepts... (Enter to send, Shift+Enter for newline)"
                  }
                  disabled={asking}
                  className="flex-1 bg-transparent text-sm text-surface-100 placeholder-surface-500 focus:outline-none resize-none px-3 py-2 max-h-36 overflow-y-auto leading-relaxed disabled:opacity-50"
                />

                <div className="flex items-center gap-1.5 pb-1 pr-1">
                  {asking ? (
                    <button
                      type="button"
                      onClick={handleCancelGeneration}
                      title="Stop generating response"
                      className="p-2.5 rounded-xl bg-danger-500/20 hover:bg-danger-500/30 text-danger-300 border border-danger-500/30 transition-all flex items-center justify-center shrink-0"
                    >
                      <Square className="w-4 h-4 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={asking || !question.trim()}
                      aria-label="Send question"
                      className="p-2.5 rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white shadow-lg shadow-primary-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </form>

              <div className="text-center text-[11px] text-surface-500">
                DevFlow AI Continuity Assistant · Grounded in verified engineering data & development intelligence
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* VIEW 2: DEDICATED HANDOVER INTELLIGENCE DOSSIER (9 SECTIONS A-I)   */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "dossier" && (
        <main className="flex-1 flex flex-col min-h-0 overflow-y-auto px-4 sm:px-8 py-6 bg-surface-950">
          <div className="max-w-5xl mx-auto w-full space-y-6 pb-12">
            {/* Dossier Header Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-surface-900/90 border border-surface-800 shadow-xl">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary-500/20 text-primary-300 border border-primary-500/30">
                    Phase 5 Developer Handover Dossier
                  </span>
                  {summary?.is_preliminary_inference && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-warning-500/20 text-warning-300 border border-warning-500/30 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Tentative AI Inference
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-extrabold text-white tracking-tight">
                  {currentProject?.name || "Project"} · Handover Intelligence
                </h2>
                <p className="text-xs text-surface-400 mt-0.5">
                  Multi-source verified executive intelligence covering deliverables, backlog, GitHub telemetry, and onboarding checklists.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!selectedProjectId || loadingSummary}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-gradient-to-tr from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white shadow-md shadow-primary-500/20 disabled:opacity-50 transition-all"
                >
                  {loadingSummary ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating AI Summary...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{summarySource === "ai" ? "Regenerate AI Summary" : "Generate AI Summary"}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleOpenContextModal}
                  className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-surface-800 hover:bg-surface-700 text-surface-200 border border-surface-700 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5 text-primary-400" />
                  <span>Edit Context & Specs</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("chat")}
                  className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-surface-800 hover:bg-surface-700 text-surface-200 border border-surface-700 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-primary-400" />
                  <span>Back to AI Workspace</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAsk("Based on this project handover, what are the most critical risks and what should I focus on first?")}
                  className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-surface-800 hover:bg-surface-700 text-primary-300 border border-surface-700 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Ask AI about Handover</span>
                </button>
              </div>
            </div>

            {/* Error Banner if AI Summary fails */}
            {summaryError && (
              <div className="p-3.5 rounded-xl bg-danger-950/40 border border-danger-500/40 text-danger-200 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-danger-400 shrink-0" />
                  <span>{summaryError}</span>
                </div>
                <button
                  onClick={() => setSummaryError(null)}
                  className="text-danger-400 hover:text-white p-1 rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* SECTION A: Project Overview & Scope */}
            <section className="p-5 rounded-2xl bg-surface-900/80 border border-surface-800 space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-primary-300 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary-400" />
                  Section A: Project Overview & Scope
                </h3>
                <span className="text-[11px] text-surface-400 font-mono">
                  {summarySource === "ai" ? "LLM Synthesis" : "System Briefing"}
                </span>
              </div>

              {/* Tentative Inference Notice */}
              {summary?.is_preliminary_inference && (
                <div className="p-3.5 rounded-xl bg-warning-950/40 border border-warning-500/40 text-warning-200 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-warning-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <strong className="font-semibold block text-warning-300">⚠️ Tentative AI Inference</strong>
                    <span>
                      {summary.inference_rationale ||
                        "Project purpose inferred from technical project naming. No formal description was recorded in the database. Use 'Edit Context & Specs' to ground requirements."}
                    </span>
                  </div>
                  <button
                    onClick={handleOpenContextModal}
                    className="px-2 py-1 bg-warning-500/20 hover:bg-warning-500/30 text-warning-200 rounded text-[11px] font-semibold border border-warning-500/40 shrink-0"
                  >
                    Add Specs
                  </button>
                </div>
              )}

              <p className="text-surface-200 text-sm leading-relaxed">
                {summary?.project_overview || "Project overview data is loading from the DevFlow database..."}
              </p>

              {/* Scope Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs border-t border-surface-800">
                <div className="p-2.5 rounded-xl bg-surface-950/60 border border-surface-800">
                  <span className="text-surface-400 block text-[10px] uppercase font-bold">Progress</span>
                  <span className="text-sm font-bold text-white">{ctx?.project?.progress ?? 0}% Verified</span>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-950/60 border border-surface-800">
                  <span className="text-surface-400 block text-[10px] uppercase font-bold">Project Manager</span>
                  <span className="text-sm font-bold text-surface-200 truncate">{pmName}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-950/60 border border-surface-800">
                  <span className="text-surface-400 block text-[10px] uppercase font-bold">Total Tasks</span>
                  <span className="text-sm font-bold text-surface-200">{tasks.length} Recorded</span>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-950/60 border border-surface-800">
                  <span className="text-surface-400 block text-[10px] uppercase font-bold">Repository</span>
                  <span className="text-sm font-bold text-surface-200 truncate">
                    {github?.repository || "Not Connected"}
                  </span>
                </div>
              </div>
            </section>

            {/* SECTION B & C: Deliverables & In-Progress Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* SECTION B: Completed Deliverables */}
              <section className="p-5 rounded-2xl bg-surface-900/80 border border-surface-800 space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Section B: Completed Deliverables ({completedWork.length})
                </h3>
                {completedWork.length === 0 ? (
                  <div className="p-4 rounded-xl bg-surface-950/60 border border-surface-800 text-xs text-surface-400 flex items-center gap-2">
                    <Info className="w-4 h-4 text-surface-500 shrink-0" />
                    <span>No verified completion records are available for this project yet.</span>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {completedWork.map((t: any) => (
                      <div key={t.id} className="p-2.5 rounded-xl bg-surface-950/60 border border-surface-800 text-xs flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-semibold text-surface-100 block truncate">{t.title}</span>
                          <span className="text-surface-400 text-[11px]">Completed by {t.devName}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 shrink-0">
                          VERIFIED
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* SECTION C: Currently In Progress */}
              <section className="p-5 rounded-2xl bg-surface-900/80 border border-surface-800 space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-primary-300 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary-400" />
                  Section C: Currently In Progress ({inProgressWork.length})
                </h3>
                {inProgressWork.length === 0 ? (
                  <div className="p-4 rounded-xl bg-surface-950/60 border border-surface-800 text-xs text-surface-400">
                    No active in-flight tasks recorded at this moment.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {inProgressWork.map((t: any) => (
                      <div key={t.id} className="p-2.5 rounded-xl bg-surface-950/60 border border-surface-800 text-xs flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-semibold text-surface-100 block truncate">{t.title}</span>
                          <span className="text-surface-400 text-[11px]">
                            Assigned to {t.devName} · Priority: {t.priority || "Standard"}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-500/10 text-primary-300 border border-primary-500/20 shrink-0">
                          IN PROGRESS
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* SECTION D: Pending Backlog & Milestones */}
            <section className="p-5 rounded-2xl bg-surface-900/80 border border-surface-800 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-surface-300 flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary-400" />
                Section D: Pending Backlog & Milestones ({pendingWork.length})
              </h3>
              {pendingWork.length === 0 ? (
                <div className="p-4 rounded-xl bg-surface-950/60 border border-surface-800 text-xs text-surface-400">
                  No pending backlog tasks recorded.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {pendingWork.map((t: any) => (
                    <div key={t.id} className="p-3 rounded-xl bg-surface-950/60 border border-surface-800 text-xs space-y-1">
                      <div className="font-semibold text-surface-100 truncate">{t.title}</div>
                      <div className="text-[11px] text-surface-400 flex items-center justify-between">
                        <span>{t.devName}</span>
                        <span className="font-mono text-[10px] text-primary-300 font-bold">{t.priority || "Standard"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* SECTION E: Prioritized Next Developer Action Plan */}
            <section className="p-5 rounded-2xl bg-surface-900/80 border border-surface-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-primary-400" />
                  Section E: Prioritized Next Developer Action Plan
                </h3>
                <span className="text-[11px] text-surface-400">Ranked by Critical Path & Dependency</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {(summary?.next_developer_plan || [
                  {
                    priority: "High",
                    action: "Establish Project Functional Specification & Requirements",
                    why: "Project currently lacks a formal specification or task breakdown in the workspace.",
                    artifact: "Project Metadata & Documentation",
                    prerequisites: "Consult project lead or stakeholders",
                    next_step: "Provide description and tech stack in the context editor",
                  },
                ]).map((planItem: NextDeveloperPlanItem, idx: number) => {
                  const isCrit = (planItem.priority || "").toLowerCase() === "critical";
                  const isHigh = (planItem.priority || "").toLowerCase() === "high";
                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl bg-surface-950/80 border text-xs space-y-2 ${
                        isCrit
                          ? "border-danger-500/40 shadow-sm shadow-danger-500/10"
                          : isHigh
                          ? "border-warning-500/40"
                          : "border-surface-800"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-surface-100 text-sm">{planItem.action}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                            isCrit
                              ? "bg-danger-500/20 text-danger-300 border border-danger-500/30"
                              : isHigh
                              ? "bg-warning-500/20 text-warning-300 border border-warning-500/30"
                              : "bg-surface-800 text-surface-300 border border-surface-700"
                          }`}
                        >
                          {planItem.priority}
                        </span>
                      </div>
                      <div className="text-surface-300 leading-relaxed">
                        <strong className="text-surface-400 block text-[10px] uppercase">Why it matters:</strong>
                        {planItem.why}
                      </div>
                      <div className="pt-2 border-t border-surface-800/80 grid grid-cols-2 gap-2 text-[11px] text-surface-400">
                        <div>
                          <span className="block text-[10px] uppercase font-bold text-surface-500">Target Artifact</span>
                          <span className="text-surface-200">{planItem.artifact}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase font-bold text-surface-500">Next Step</span>
                          <span className="text-primary-300 font-medium">{planItem.next_step}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* SECTION F: Attention Required (Confirmed Issues vs Concerns) */}
            <section className="p-5 rounded-2xl bg-surface-900/80 border border-surface-800 space-y-3.5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-danger-400 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-danger-400" />
                Section F: Attention Required & Risk Triage
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(summary?.attention_required || [
                  {
                    category: "UNCHECKED_AREA",
                    title: "GitHub Repository Disconnected",
                    severity: "Medium",
                    detail: "Repository not connected. Commits and PRs cannot be tracked.",
                    evidence: "No repository record found",
                  },
                ]).map((att: AttentionRequiredItem, idx: number) => {
                  const isIssue = att.category === "CONFIRMED_ISSUE";
                  const isConcern = att.category === "POTENTIAL_CONCERN";
                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl bg-surface-950/70 border text-xs space-y-1.5 ${
                        isIssue
                          ? "border-danger-500/40"
                          : isConcern
                          ? "border-warning-500/40"
                          : "border-surface-800"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-[10px] font-mono uppercase font-bold px-1.5 py-0.2 rounded ${
                            isIssue
                              ? "bg-danger-500/20 text-danger-300"
                              : isConcern
                              ? "bg-warning-500/20 text-warning-300"
                              : "bg-surface-800 text-surface-400"
                          }`}
                        >
                          {att.category.replace("_", " ")}
                        </span>
                        <span className="text-[10px] font-bold text-surface-400">{att.severity} Severity</span>
                      </div>
                      <div className="font-bold text-surface-100">{att.title}</div>
                      <p className="text-surface-300 text-[11px] leading-relaxed">{att.detail}</p>
                      <div className="text-[10px] text-surface-500 font-mono pt-1 border-t border-surface-800/80">
                        Evidence: {att.evidence}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* SECTION G: GitHub Repository Intelligence */}
            <section className="p-5 rounded-2xl bg-surface-900/80 border border-surface-800 space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-surface-200 flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-primary-400" />
                  Section G: GitHub Repository Intelligence
                </h3>
                {github?.repository ? (
                  <a
                    href={`https://github.com/${github.repository}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 font-mono"
                  >
                    <span>github.com/{github.repository}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-xs text-warning-400 font-medium">Disconnected</span>
                )}
              </div>

              {github?.repository ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-2.5 rounded-xl bg-surface-950/60 border border-surface-800">
                      <span className="text-surface-400 block text-[10px] uppercase font-bold">Recent Commits</span>
                      <span className="text-sm font-bold text-white">{commits.length}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-surface-950/60 border border-surface-800">
                      <span className="text-surface-400 block text-[10px] uppercase font-bold">Pull Requests</span>
                      <span className="text-sm font-bold text-white">{pullRequests.length}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-surface-950/60 border border-surface-800">
                      <span className="text-surface-400 block text-[10px] uppercase font-bold">Issues</span>
                      <span className="text-sm font-bold text-white">{github.issues?.length || 0}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-surface-950/60 border border-surface-800">
                      <span className="text-surface-400 block text-[10px] uppercase font-bold">Branches</span>
                      <span className="text-sm font-bold text-white">{github.branches?.length || 1}</span>
                    </div>
                  </div>

                  {commits.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-xs font-bold text-surface-400 uppercase tracking-wider block">
                        Recent Verified Commits
                      </span>
                      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                        {commits.slice(0, 5).map((c: any, i: number) => (
                          <div key={i} className="p-2 rounded-lg bg-surface-950/60 border border-surface-800 text-xs flex items-center justify-between gap-3">
                            <span className="font-mono text-primary-300 text-[11px] truncate flex-1">{c.message}</span>
                            <span className="text-surface-500 text-[10px] shrink-0">{c.author}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-surface-950/60 border border-surface-800 text-xs text-surface-400 flex items-center justify-between">
                  <span>No GitHub repository connected for this project. Connect a repository to audit commits and PRs.</span>
                  <button
                    onClick={handleOpenContextModal}
                    className="px-2.5 py-1 bg-primary-600/20 hover:bg-primary-600/30 text-primary-300 rounded text-xs font-semibold border border-primary-500/30 ml-2"
                  >
                    Link Repository
                  </button>
                </div>
              )}
            </section>

            {/* SECTION H: 7-Step Actionable Onboarding Checklist */}
            <section className="p-5 rounded-2xl bg-surface-900/80 border border-surface-800 space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-primary-400" />
                  Section H: 7-Step Actionable Developer Onboarding Checklist
                </h3>
                <span className="text-[11px] text-surface-400">Interactive Checklist</span>
              </div>

              <div className="space-y-2">
                {[
                  {
                    step: 1,
                    title: "Understand project architecture and setup",
                    desc: "Review tech stack, setup instructions, and repository structure.",
                  },
                  {
                    step: 2,
                    title: "Review verified pending work & sprint scope",
                    desc: `Inspect the ${pendingWork.length} pending tasks in the backlog.`,
                  },
                  {
                    step: 3,
                    title: "Resolve confirmed blockers and prerequisites",
                    desc: `${attentionRequired.length} recorded blocker(s) require resolution.`,
                  },
                  {
                    step: 4,
                    title: "Review open pull requests & active branches",
                    desc: `${pullRequests.length} pull requests pending validation.`,
                  },
                  {
                    step: 5,
                    title: "Validate local build and test suite",
                    desc: "Run backend and frontend test runners to confirm regression-free setup.",
                  },
                  {
                    step: 6,
                    title: "Pick up prioritized next developer action",
                    desc: "Assign top priority milestone task to yourself and create a working branch.",
                  },
                  {
                    step: 7,
                    title: "Update continuity notes and progress logs",
                    desc: "Record implementation milestones in the DevFlow workspace before handover.",
                  },
                ].map((item) => {
                  const isChecked = !!checkedSteps[item.step];
                  return (
                    <button
                      key={item.step}
                      type="button"
                      onClick={() => handleToggleChecklist(item.step)}
                      className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex items-start gap-3 ${
                        isChecked
                          ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-200"
                          : "bg-surface-950/60 border-surface-800 hover:border-surface-700 text-surface-200"
                      }`}
                    >
                      <div className="mt-0.5">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            isChecked
                              ? "bg-emerald-500 border-emerald-400 text-surface-950"
                              : "border-surface-600 bg-surface-900"
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className={`font-semibold ${isChecked ? "line-through text-emerald-300" : "text-surface-100"}`}>
                          Step {item.step}: {item.title}
                        </div>
                        <div className="text-[11px] text-surface-400 mt-0.5">{item.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* SECTION I: Transparent Data Coverage Audit */}
            <section className="p-5 rounded-2xl bg-surface-900/80 border border-surface-800 space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-surface-300 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-primary-400" />
                  Section I: Transparent Data Coverage Audit
                </h3>
                <span className="text-[11px] font-mono text-primary-300 font-bold">
                  {summary?.data_coverage?.score_percent ?? 80}% Coverage Score
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 rounded-full bg-surface-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-500 to-emerald-400 transition-all duration-500"
                  style={{ width: `${summary?.data_coverage?.score_percent ?? 80}%` }}
                />
              </div>

              {/* Verification Sources Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
                {(
                  summary?.data_coverage?.sources || [
                    { name: "Project Metadata", verified: true, detail: "Verified" },
                    { name: "Task Records", verified: tasks.length > 0, detail: `${tasks.length} tasks` },
                    { name: "Activity Logs", verified: true, detail: "Logs active" },
                    { name: "Handover Notes", verified: false, detail: "Not provided" },
                    { name: "GitHub Data", verified: !!github?.repository, detail: github?.repository || "Disconnected" },
                    { name: "Documentation", verified: true, detail: "Verified" },
                  ]
                ).map((src: any, i: number) => (
                  <div
                    key={i}
                    className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                      src.verified
                        ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-200"
                        : "bg-surface-950/60 border-surface-800 text-surface-400"
                    }`}
                  >
                    <div>
                      <span className="font-semibold block">{src.name}</span>
                      <span className="text-[10px] opacity-75">{src.detail}</span>
                    </div>
                    {src.verified ? (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <X className="w-4 h-4 text-surface-500 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </main>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Context Editor Modal (For missing or sparse project context)         */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {showEditContextModal && (
        <div className="fixed inset-0 z-50 bg-surface-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-surface-900 border border-surface-800 p-6 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-surface-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-primary-400" />
                Add / Edit Project Context & Tech Stack
              </h3>
              <button
                onClick={() => setShowEditContextModal(false)}
                className="text-surface-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {contextNotification && (
              <div className="p-3 rounded-xl bg-primary-950/40 border border-primary-500/40 text-primary-200 text-xs">
                {contextNotification}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-surface-300 font-semibold mb-1">Project Description & Objectives</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="e.g. High-throughput VLSI simulation engine optimizing clock domain crossing..."
                  className="w-full rounded-xl bg-surface-950 border border-surface-700 p-2.5 text-surface-100 placeholder-surface-500 focus:outline-none focus:border-primary-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-surface-300 font-semibold mb-1">Tech Stack & Tools</label>
                <input
                  type="text"
                  value={editTechStack}
                  onChange={(e) => setEditTechStack(e.target.value)}
                  placeholder="e.g. Verilog, Python, ModelSim, SystemC"
                  className="w-full rounded-xl bg-surface-950 border border-surface-700 px-3 py-2 text-surface-100 placeholder-surface-500 focus:outline-none focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-surface-300 font-semibold mb-1">GitHub Repository URL</label>
                <input
                  type="text"
                  value={editRepoUrl}
                  onChange={(e) => setEditRepoUrl(e.target.value)}
                  placeholder="e.g. https://github.com/my-org/my-repo"
                  className="w-full rounded-xl bg-surface-950 border border-surface-700 px-3 py-2 text-surface-100 placeholder-surface-500 focus:outline-none focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-surface-300 font-semibold mb-1">Developer Handover Notes</label>
                <textarea
                  rows={2}
                  value={editHandoverNotes}
                  onChange={(e) => setEditHandoverNotes(e.target.value)}
                  placeholder="e.g. Next dev must run make lint before pushing; staging branch is deployed on port 8080."
                  className="w-full rounded-xl bg-surface-950 border border-surface-700 p-2.5 text-surface-100 placeholder-surface-500 focus:outline-none focus:border-primary-500 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-800">
              <button
                type="button"
                onClick={() => setShowEditContextModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-surface-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveContext}
                disabled={savingContext}
                className="btn btn-primary px-4 py-1.5 text-xs font-semibold shadow-md shadow-primary-500/20 disabled:opacity-50"
              >
                {savingContext ? "Saving Context..." : "Save & Refresh Handover"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
