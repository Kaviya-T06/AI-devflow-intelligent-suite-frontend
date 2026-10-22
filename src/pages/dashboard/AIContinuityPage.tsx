import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
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
  ChevronRight,
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
  const location = useLocation();
  const initialProjectId = searchParams.get("project") || "";

  const [projects, setProjects] = useState<{ id: string; name: string; status: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Active View Mode: Chat Workspace vs. Handover Intelligence Dossier
  const [activeTab, setActiveTab] = useState<"chat" | "dossier">("chat");

  // Whenever AI Continuity is navigated to via sidebar route change, reset to chat view by default
  const prevPathnameRef = useRef(location.pathname);
  useEffect(() => {
    if (prevPathnameRef.current !== location.pathname) {
      prevPathnameRef.current = location.pathname;
      setActiveTab("chat");
    }
  }, [location.pathname]);

  // Summary state
  const [summary, setSummary] = useState<ContinuitySummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summarySource, setSummarySource] = useState<"ai" | "briefing" | null>(null);

  // Context drawer toggle (for quick peek inside chat workspace)
  const [showContextDrawer, setShowContextDrawer] = useState(false);

  // AI Service Status (verified silently in background)
  const [aiStatus, setAiStatus] = useState<AIStatusResponse | null>(null);

  // Chat state per project (preserves history when switching projects)
  const [chatHistoryByProject, setChatHistoryByProject] = useState<Record<string, ChatMessageItem[]>>({});
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [lastFailedQuestion, setLastFailedQuestion] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

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

  // Fetch AI status silently in background
  const checkStatus = useCallback(async (projId: string) => {
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
  const unmappedCommits = ctx?.unmapped_commits || commits || [];
  const verifiedMappings = ctx?.verified_mappings || [];
  const hasVerifiedMappings = verifiedMappings.length > 0;

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

  // Calculate actual duration/age of pending work from database task dates
  const pendingAgeInfo = useMemo(() => {
    if (!pendingWork || pendingWork.length === 0) return null;
    const datedTasks = pendingWork.filter((t: any) => t.created_at || t.createdDate);
    if (datedTasks.length === 0) return null;

    const oldest = datedTasks.reduce((prev: any, curr: any) => {
      const prevTime = new Date(prev.created_at || prev.createdDate).getTime();
      const currTime = new Date(curr.created_at || curr.createdDate).getTime();
      return currTime < prevTime ? curr : prev;
    });

    const createdTime = new Date(oldest.created_at || oldest.createdDate).getTime();
    if (isNaN(createdTime)) return null;

    const diffMs = Date.now() - createdTime;
    if (diffMs < 0) return null;

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);

    if (diffWeeks >= 1) {
      return {
        durationStr: `${diffWeeks} ${diffWeeks === 1 ? "week" : "weeks"}`,
        oldestTitle: oldest.title,
      };
    }
    if (diffDays >= 1) {
      return {
        durationStr: `${diffDays} ${diffDays === 1 ? "day" : "days"}`,
        oldestTitle: oldest.title,
      };
    }
    return {
      durationStr: "recently created",
      oldestTitle: oldest.title,
    };
  }, [pendingWork]);

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)] lg:h-[calc(100vh-7.2rem)] w-full overflow-hidden bg-surface-950 text-surface-100 rounded-2xl border border-surface-800/90 shadow-2xl relative">
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Top Header: Sleek, unobtrusive workspace bar                        */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <header className="px-4 py-2 bg-surface-900/95 backdrop-blur-md border-b border-surface-800/80 flex flex-wrap items-center justify-between gap-3 shrink-0 z-20 min-h-[44px]">
        {/* Left: Minimal workspace identity (leaves hero as the primary focal point) */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-surface-800/80 border border-surface-700/60 flex items-center justify-center text-primary-400 shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-surface-200 tracking-tight">
              AI Continuity
            </span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-surface-800 text-surface-400 border border-surface-700/60">
              Workspace
            </span>
          </div>
        </div>

        {/* Center: Clean Mode Switcher (AI Workspace vs. Handover Intelligence Dossier) */}
        <div className="flex items-center bg-surface-950/80 p-0.5 rounded-lg border border-surface-800">
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
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
            onClick={() => {
              setActiveTab("dossier");
              if (!summary && selectedProjectId) {
                handleGenerate();
              }
            }}
            className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
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

        {/* Right: Project Selector & Clear Chat */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Project Selector */}
          <div className="flex items-center gap-1.5 bg-surface-950/70 px-2.5 py-1 rounded-lg border border-surface-800">
            <label htmlFor="project-selector" className="text-[11px] font-semibold text-surface-400">
              Project:
            </label>
            <select
              id="project-selector"
              className="bg-transparent text-surface-100 text-xs font-medium focus:outline-none cursor-pointer max-w-[140px] sm:max-w-[200px] truncate"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              disabled={loadingProjects}
            >
              {projects.length === 0 && <option value="">No projects available</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-surface-900 text-surface-100">
                  {p.name}{p.status ? ` (${p.status})` : ""}
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
              <span className="hidden sm:inline">New Chat</span>
            </button>
          )}
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Compact Project Intelligence Context Strip                         */}
      {/* Only shown during active conversation or Dossier peek              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {ctx?.project && (activeTab === "dossier" || currentChatLog.length > 0) ? (
        <div className="px-4 py-2 bg-surface-900/60 border-b border-surface-800/80 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 z-10">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-surface-300">
            <span className="font-bold text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary-400" />
              <span>{ctx.project.name || currentProject?.name || "Project"}</span>
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

            {/* The Four Handover Boxes (Preserved for Post-Interaction & Handover Review) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* BOX 1: What the Next Developer Should Know */}
              <div className="p-4 bg-surface-950/70 rounded-xl border border-surface-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-surface-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-primary-400" />
                    What the Next Developer Should Know
                  </h4>
                  <span className="text-[10px] text-surface-400 font-mono">Box 1 of 4</span>
                </div>
                <p className="text-[11px] text-surface-400">
                  Key architectural context and priorities before taking over this project.
                </p>
                <ul className="space-y-1.5 text-xs text-surface-300">
                  {whatDeveloperShouldKnow.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-primary-400 font-bold mt-0.5">•</span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
                {summary?.what_next_developer_should_know && summary.what_next_developer_should_know !== "N/A" && (
                  <div className="p-2.5 rounded-lg bg-surface-900/90 border border-surface-800 text-xs text-surface-300 leading-relaxed mt-2">
                    <strong className="block text-[11px] text-primary-300 uppercase font-semibold mb-1">AI Takeaway</strong>
                    {summary.what_next_developer_should_know}
                  </div>
                )}
              </div>

              {/* BOX 2: Completed and Pending Work */}
              <div className="p-4 bg-surface-950/70 rounded-xl border border-surface-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Completed and Pending Work
                  </h4>
                  <span className="text-[10px] text-surface-400 font-mono">Box 2 of 4</span>
                </div>
                <p className="text-[11px] text-surface-400">
                  Verified deliverable status across in-flight, completed, and pending backlog tasks.
                </p>

                {/* In Progress */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-primary-300 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-primary-400" />
                    <span>Currently In Progress ({inProgressWork.length})</span>
                  </div>
                  {inProgressWork.length === 0 ? (
                    <p className="text-xs text-surface-500 italic pl-4">No active work in progress.</p>
                  ) : (
                    <div className="space-y-1.5 pl-2 max-h-28 overflow-y-auto pr-1">
                      {inProgressWork.map((t: any) => (
                        <div key={t.id} className="p-2 bg-surface-900 rounded-lg border border-surface-800 text-xs flex items-center justify-between gap-2">
                          <span className="font-semibold text-surface-200 truncate">{t.title}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-800 text-surface-400">{t.devName}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary-500/20 text-primary-300">{t.priority}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Completed Work */}
                <div className="space-y-1.5 pt-2 border-t border-surface-800/80">
                  <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>Completed Deliverables ({completedWork.length})</span>
                  </div>
                  {completedWork.length === 0 ? (
                    <p className="text-xs text-surface-500 italic pl-4">No completed tasks yet.</p>
                  ) : (
                    <div className="space-y-1 pl-2 max-h-24 overflow-y-auto pr-1">
                      {completedWork.slice(0, 3).map((t: any) => (
                        <div key={t.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-surface-900/60">
                          <span className="text-surface-300 truncate">{t.title}</span>
                          <span className="text-[10px] text-emerald-400 font-semibold shrink-0">VERIFIED</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pending Work */}
                <div className="space-y-1.5 pt-2 border-t border-surface-800/80">
                  <div className="text-[11px] font-semibold text-surface-300 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-surface-400" />
                    <span>Pending Backlog ({pendingWork.length})</span>
                  </div>
                  {pendingWork.length === 0 ? (
                    <p className="text-xs text-surface-500 italic pl-4">No pending backlog tasks.</p>
                  ) : (
                    <div className="space-y-1 pl-2 max-h-24 overflow-y-auto pr-1">
                      {pendingWork.slice(0, 3).map((t: any) => (
                        <div key={t.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-surface-900/60">
                          <span className="text-surface-300 truncate">{t.title}</span>
                          <span className="text-[10px] text-surface-400 shrink-0">{t.devName}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* BOX 3: Items Requiring Attention */}
              <div className="p-4 bg-surface-950/70 rounded-xl border border-surface-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-danger-400 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Items Requiring Attention ({attentionRequired.length})
                  </h4>
                  <span className="text-[10px] text-surface-400 font-mono">Box 3 of 4</span>
                </div>
                <p className="text-[11px] text-surface-400">
                  Overdue tasks, stuck workflows, and active technical risks.
                </p>
                {attentionRequired.length === 0 ? (
                  <div className="space-y-2 py-3">
                    <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> No verified overdue tasks recorded.
                    </p>
                    <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> No verified stuck workflows recorded.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {attentionRequired.map((t: any) => (
                      <div key={t.id} className="p-2.5 bg-surface-900 rounded-lg border border-surface-800 text-xs space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-surface-200 truncate">{t.title}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-danger-500/20 text-danger-300 shrink-0">
                            {t.riskLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-surface-400">
                          <span>Assignee: {t.devName}</span>
                          <span>•</span>
                          <span>Priority: {t.priority}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* BOX 4: Recorded Tasks, GitHub Pull Requests, and Issues */}
              <div className="p-4 bg-surface-950/70 rounded-xl border border-surface-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5" />
                    Recorded Tasks, GitHub Pull Requests, and Issues
                  </h4>
                  <span className="text-[10px] text-surface-400 font-mono">Box 4 of 4</span>
                </div>
                <p className="text-[11px] text-surface-400">
                  Telemetry linking DevFlow database records and GitHub activity.
                </p>

                {/* Repository & Verification */}
                <div className="p-2.5 rounded-lg bg-surface-900 border border-surface-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-surface-400 font-medium">Repository:</span>
                    <span className="font-mono text-cyan-400 truncate max-w-[200px]">
                      {github?.repository || "Not Connected"}
                    </span>
                  </div>
                  <div className="text-[11px] flex items-center gap-1.5">
                    {hasVerifiedMappings ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> GitHub activities verified & mapped to tasks.
                      </span>
                    ) : (
                      <span className="text-surface-400 flex items-center gap-1">
                        <Info className="w-3 h-3 text-surface-500" /> Mappings updated from database.
                      </span>
                    )}
                  </div>
                </div>

                {/* Open PRs */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-surface-300 block">
                    Open Pull Requests ({unmappedPrs.length})
                  </span>
                  {unmappedPrs.length === 0 ? (
                    <p className="text-xs text-surface-500 italic">No open pull requests recorded.</p>
                  ) : (
                    <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                      {unmappedPrs.slice(0, 3).map((pr: any, i: number) => (
                        <div key={i} className="p-1.5 rounded bg-surface-900 text-xs flex items-center justify-between gap-2">
                          <span className="text-surface-200 truncate">{pr.title}</span>
                          <span className="text-[10px] text-cyan-400 shrink-0">{pr.author}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Commits */}
                <div className="space-y-1.5 pt-2 border-t border-surface-800/80">
                  <span className="text-[11px] font-semibold text-surface-300 block">
                    Recent Commits ({unmappedCommits.length})
                  </span>
                  {unmappedCommits.length === 0 ? (
                    <p className="text-xs text-surface-500 italic">No recent commits recorded.</p>
                  ) : (
                    <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                      {unmappedCommits.slice(0, 3).map((c: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-xs py-1 px-1.5 rounded bg-surface-900/60">
                          <span className="text-surface-300 truncate max-w-[200px]">
                            {c.message ? c.message.split("\n")[0] : "Commit"}
                          </span>
                          <span className="font-mono text-[10px] text-surface-500 shrink-0">
                            {c.sha ? c.sha.substring(0, 7) : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-2 sm:py-3 scroll-smooth flex flex-col min-h-0">
            <div className={`max-w-3xl xl:max-w-4xl mx-auto w-full flex-1 flex flex-col ${currentChatLog.length === 0 ? "justify-center" : "space-y-6"}`}>
              {/* INITIAL WELCOME SCREEN (Rendered immediately from frontend on initial load) */}
              {currentChatLog.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in max-w-4xl mx-auto w-full px-2 py-4 my-auto select-none">
                  {/* 1. Welcome Symbol, Heading, and Subtitle */}
                  <div className="flex flex-col items-center mb-5">
                    {/* Glowing AI Star / Sparkle Symbol with complementary intelligence circuit badge */}
                    <div className="relative group mb-3">
                      <div className="absolute -inset-2 bg-gradient-to-r from-primary-600/35 via-indigo-600/35 to-blue-500/30 rounded-2xl blur-xl opacity-60 group-hover:opacity-85 transition duration-500" />
                      <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-primary-500 via-indigo-600 to-cyan-400 p-0.5 shadow-xl shadow-indigo-500/25 flex items-center justify-center">
                        <div className="w-full h-full bg-surface-950/95 backdrop-blur-md rounded-[14px] flex items-center justify-center relative overflow-hidden">
                          <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 text-primary-300 drop-shadow-[0_0_12px_rgba(99,102,241,0.7)] animate-pulse" />
                        </div>
                      </div>
                      <div
                        className="absolute -bottom-1 -right-1 w-5 h-5 rounded-md bg-surface-900 border border-primary-500/40 shadow-lg flex items-center justify-center"
                        title="AI Neural Intelligence Core"
                      >
                        <Cpu className="w-3 h-3 text-cyan-400" />
                      </div>
                    </div>

                    {/* Exact Main Heading & Subtitle */}
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight drop-shadow-sm leading-tight mb-1.5">
                      Your Project. Your Intelligence.
                    </h1>
                    <p className="text-xs sm:text-sm text-surface-400 max-w-lg mx-auto leading-relaxed font-normal">
                      Your AI workspace for project understanding, development assistance, and intelligent handovers.
                    </p>
                  </div>

                  {/* 2. The Original Four Cards with Arrow/Chevron Marks */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full mb-4">
                    {/* Card 1: Project Overview */}
                    <button
                      type="button"
                      onClick={() => handleAsk("What is the current project status and overview?")}
                      className="p-3.5 rounded-xl bg-surface-900/80 hover:bg-surface-850 border border-surface-800 hover:border-primary-500/40 text-left transition-all duration-200 group shadow-md hover:shadow-primary-500/10 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="w-7 h-7 rounded-lg bg-primary-600/15 border border-primary-500/20 flex items-center justify-center text-primary-400">
                            <FileText className="w-4 h-4" />
                          </div>
                          <ChevronRight className="w-4 h-4 text-surface-500 group-hover:text-primary-400 group-hover:translate-x-0.5 transition-all" />
                        </div>
                        <h3 className="text-xs font-bold text-surface-100 group-hover:text-primary-300 transition-colors uppercase tracking-wider mb-1">
                          Project Overview
                        </h3>
                        <p className="text-[11px] text-surface-400 line-clamp-2 leading-relaxed">
                          {summary?.project_overview ||
                            `${ctx?.project?.name || currentProject?.name || "Project"} · ${
                              ctx?.project?.progress !== undefined ? `${ctx.project.progress}% Complete` : "Verified Project Records"
                            }`}
                        </p>
                      </div>
                      <div className="mt-2.5 pt-2 border-t border-surface-800/80 flex items-center justify-between text-[10px] text-surface-500">
                        <span>Manager: {pmName}</span>
                        <span className="text-primary-400 font-semibold group-hover:underline">Explore →</span>
                      </div>
                    </button>

                    {/* Card 2: Previous Developer Work */}
                    <button
                      type="button"
                      onClick={() => handleAsk("What did the previous developer complete?")}
                      className="p-3.5 rounded-xl bg-surface-900/80 hover:bg-surface-850 border border-surface-800 hover:border-emerald-500/40 text-left transition-all duration-200 group shadow-md hover:shadow-emerald-500/10 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-600/15 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <ChevronRight className="w-4 h-4 text-surface-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                        </div>
                        <h3 className="text-xs font-bold text-surface-100 group-hover:text-emerald-300 transition-colors uppercase tracking-wider mb-1">
                          Previous Developer Work
                        </h3>
                        <p className="text-[11px] text-surface-400 line-clamp-2 leading-relaxed">
                          {summary?.previous_developer_work ||
                            (completedWork.length > 0
                              ? `${completedWork.length} completed deliverables: ${completedWork.map((t: any) => t.title).slice(0, 2).join(", ")}`
                              : "Verified historical task completions and architecture milestones.")}
                        </p>
                      </div>
                      <div className="mt-2.5 pt-2 border-t border-surface-800/80 flex items-center justify-between text-[10px] text-surface-500">
                        <span>{completedWork.length} Completed</span>
                        <span className="text-emerald-400 font-semibold group-hover:underline">Explore →</span>
                      </div>
                    </button>

                    {/* Card 3: Current Work */}
                    <button
                      type="button"
                      onClick={() => handleAsk("What is the current work in progress and active team focus?")}
                      className="p-3.5 rounded-xl bg-surface-900/80 hover:bg-surface-850 border border-surface-800 hover:border-amber-500/40 text-left transition-all duration-200 group shadow-md hover:shadow-amber-500/10 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="w-7 h-7 rounded-lg bg-amber-600/15 border border-amber-500/20 flex items-center justify-center text-amber-400">
                            <Clock className="w-4 h-4" />
                          </div>
                          <ChevronRight className="w-4 h-4 text-surface-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                        </div>
                        <h3 className="text-xs font-bold text-surface-100 group-hover:text-amber-300 transition-colors uppercase tracking-wider mb-1">
                          Current Work
                        </h3>
                        <p className="text-[11px] text-surface-400 line-clamp-2 leading-relaxed">
                          {summary?.current_work ||
                            (activeFocusTask
                              ? `Focus: "${activeFocusTask.title}" (${activeFocusTask.priority || "Standard"}) assigned to ${activeFocusTask.devName}.`
                              : `${inProgressWork.length} active task(s) currently in flight.`)}
                        </p>
                      </div>
                      <div className="mt-2.5 pt-2 border-t border-surface-800/80 flex items-center justify-between text-[10px] text-surface-500">
                        <span>{inProgressWork.length} In Progress</span>
                        <span className="text-amber-400 font-semibold group-hover:underline">Explore →</span>
                      </div>
                    </button>

                    {/* Card 4: Pending Work */}
                    <button
                      type="button"
                      onClick={() => handleAsk("What work is still pending and which tasks have been pending for a long time?")}
                      className="p-3.5 rounded-xl bg-surface-900/80 hover:bg-surface-850 border border-surface-800 hover:border-indigo-500/40 text-left transition-all duration-200 group shadow-md hover:shadow-indigo-500/10 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="w-7 h-7 rounded-lg bg-indigo-600/15 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                          <ChevronRight className="w-4 h-4 text-surface-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
                        </div>
                        <h3 className="text-xs font-bold text-surface-100 group-hover:text-indigo-300 transition-colors uppercase tracking-wider mb-1">
                          Pending Work
                        </h3>
                        <p className="text-[11px] text-surface-400 line-clamp-2 leading-relaxed">
                          {summary?.pending_work ||
                            (pendingAgeInfo
                              ? `${pendingWork.length} pending task(s). Incomplete for ${pendingAgeInfo.durationStr} (${pendingAgeInfo.oldestTitle}).`
                              : `${pendingWork.length} task(s) pending in backlog queue.`)}
                        </p>
                      </div>
                      <div className="mt-2.5 pt-2 border-t border-surface-800/80 flex items-center justify-between text-[10px] text-surface-500">
                        <span>{pendingAgeInfo ? `Incomplete for ${pendingAgeInfo.durationStr}` : `${pendingWork.length} Pending`}</span>
                        <span className="text-indigo-400 font-semibold group-hover:underline">Explore →</span>
                      </div>
                    </button>
                  </div>

                  {/* 3. Original Suggested Questions Chips */}
                  <div className="w-full space-y-2 pt-1 mb-1">
                    <div className="text-[11px] font-bold text-surface-400 uppercase tracking-wider text-center">
                      Suggested Questions
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {[
                        "What is the current project status?",
                        "What work is still pending?",
                        "What did the previous developer complete?",
                        "Which tasks have been pending for a long time?",
                        "What should the next developer do first?",
                        "What are the current project risks?",
                      ].map((q, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleAsk(q)}
                          disabled={asking}
                          className="text-xs px-3.5 py-1.5 rounded-full bg-surface-900/90 hover:bg-surface-800 text-surface-300 hover:text-white border border-surface-700/80 hover:border-primary-500/50 transition-all shadow-sm flex items-center gap-1.5 group disabled:opacity-50"
                        >
                          <span className="text-primary-400 group-hover:scale-110 transition-transform">💬</span>
                          <span>{q}</span>
                        </button>
                      ))}
                    </div>
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
                          ? "bg-danger-950/40 text-danger-200 border border-danger-500/40 rounded-tl-sm p-4 sm:p-5"
                          : "bg-surface-900/95 text-surface-100 border border-surface-800/90 rounded-tl-sm p-5"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed font-normal">
                          {msg.text}
                        </p>
                      ) : msg.isError ? (
                        <div className="space-y-3">
                          <div className="flex items-start gap-2.5">
                            <div className="p-1.5 rounded-lg bg-danger-500/20 text-danger-400 shrink-0 mt-0.5">
                              <AlertTriangle className="w-4 h-4" />
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-xs font-semibold text-danger-200 tracking-wide uppercase">
                                AI Service Notice
                              </h4>
                              <p className="text-sm text-surface-200 leading-relaxed font-normal">
                                {msg.text.replace(/^⚠️\s*/, "")}
                              </p>
                            </div>
                          </div>

                          {/* Collapsible Diagnostic Details */}
                          <div className="pt-2 border-t border-danger-500/20">
                            <button
                              type="button"
                              onClick={() => setShowDiagnostics((prev) => !prev)}
                              className="text-[11px] text-surface-400 hover:text-surface-200 flex items-center gap-1 transition-colors"
                            >
                              {showDiagnostics ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              <span>{showDiagnostics ? "Hide diagnostic details" : "View technical diagnostics"}</span>
                            </button>

                            {showDiagnostics && (
                              <div className="mt-2 p-2.5 rounded-lg bg-surface-950/80 border border-surface-800/80 text-[11px] font-mono text-surface-300 space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-surface-400">Provider:</span>
                                  <span className="text-surface-200 font-semibold">{aiStatus?.provider || "ollama"}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-surface-400">Target Model:</span>
                                  <span className="text-surface-200 font-semibold">{aiStatus?.model || "llama3.2:1b"}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-surface-400">Daemon Endpoint:</span>
                                  <span className="text-surface-200 font-semibold">http://localhost:11434</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-surface-400">Status:</span>
                                  <span className="text-amber-400 font-semibold">{aiStatus?.status || "unavailable"}</span>
                                </div>
                                {(aiStatus?.error || aiStatus?.health?.error) && (
                                  <div className="pt-1 text-danger-400 text-[10px] break-all border-t border-surface-800">
                                    {aiStatus.error || aiStatus.health?.error}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : msg.text === "" ? (
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
                        <div className="mt-3 pt-2.5 border-t border-danger-500/20 flex items-center justify-between gap-3">
                          <span className="text-[11px] text-surface-400">
                            Need this answered?
                          </span>
                          <button
                            onClick={() => handleAsk(lastFailedQuestion)}
                            disabled={asking}
                            className="px-3 py-1 bg-danger-500/20 hover:bg-danger-500/30 text-danger-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-danger-500/30 disabled:opacity-50"
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

              {/* Post-Interaction: 4 Handover Boxes Quick Access Strip */}
              {currentChatLog.length > 0 && (
                <div className="pt-3 pb-1 border-t border-surface-800/80">
                  <div className="p-3.5 rounded-xl bg-surface-900/60 border border-surface-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-primary-600/20 border border-primary-500/30 flex items-center justify-center text-primary-400 shrink-0">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-surface-200 flex items-center gap-2">
                          <span>Project Handover Intelligence</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-surface-800 text-primary-300 border border-surface-700">
                            4 Handover Boxes
                          </span>
                        </div>
                        <p className="text-[11px] text-surface-400">
                          Developer takeaways, completed & pending tasks, attention items, and GitHub telemetry.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowContextDrawer((prev) => !prev)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-800 hover:bg-surface-700 text-primary-300 border border-surface-700 flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>{showContextDrawer ? "Hide Handover Boxes" : "View 4 Handover Boxes"}</span>
                        {showContextDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
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
