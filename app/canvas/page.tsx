"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Box,
  Check,
  FileText,
  ChevronRight,
  Download,
  FileJson,
  GitBranch,
  Keyboard,
  Layers,
  Loader2,
  Mail,
  MessageSquare,
  Mic,
  MicOff,
  Pencil,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Plus,
  RefreshCcw,
  Settings,
  Sparkles,
  Square,
  Terminal,
  Trash2,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { FlowCanvas } from "@/components/workflow/flow-canvas";
import { parseIdeaToWorkflow } from "@/components/workflow/parser";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import jsPDF from "jspdf";
import { VoiceRecorder } from "@/components/voice-recorder";
import AITextLoading from "@/components/kokonutui/ai-text-loading";
import type {
  ExecutionContext,
  TraceLog,
  WorkflowCategory,
  WorkflowGraph,
  WorkflowNodeStatus,
} from "@/components/workflow/types";
import {
  parseIdea,
  executeNode,
  getExecutionOrder,
  createInitialContext,
  updateContext,
} from "@/lib/workflow-api";

// ============================================================================
// Constants & Helpers
// ============================================================================

const fallbackIdea =
  "Listen to the user's idea, transcribe it, break it into tasks, detect dependencies, validate the sequence, and render a connected flow.";

const nodeTemplates: { category: WorkflowCategory; label: string; icon: typeof Box }[] = [
  { category: "personal", label: "Personal", icon: Box },
];

const statusColors: Record<WorkflowNodeStatus, string> = {
  pending: "bg-zinc-600",
  running: "bg-sky-500 animate-pulse",
  done: "bg-emerald-500",
  blocked: "bg-rose-500",
};

// ============================================================================
// Main Component
// ============================================================================

export default function CanvasPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ideaFromUrl = searchParams.get("idea")?.trim();
  const idea = ideaFromUrl?.length ? ideaFromUrl : fallbackIdea;
  const [prompt, setPrompt] = useState(idea);
  // Keep track of original prompt for cache key (so edits persist on reload)
  const [originalPrompt, setOriginalPrompt] = useState(idea);

  // State
  const initial = useMemo(() => parseIdeaToWorkflow(prompt), [prompt]);
  const [graph, setGraph] = useState<WorkflowGraph>(initial.graph);
  const [trace, setTrace] = useState<TraceLog[]>(initial.trace);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [executionContext, setExecutionContext] = useState<ExecutionContext | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [outputModalOpen, setOutputModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [notionModalOpen, setNotionModalOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("Workflow Outputs");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<"json" | "txt" | "pdf">("json");
  const [isDownloading, setIsDownloading] = useState(false);
  const [voiceMode, setVoiceMode] = useState<"edit">("edit");
  const [editDraft, setEditDraft] = useState(prompt);
  const [nodeEditModalOpen, setNodeEditModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<{ id: string; title: string; detail: string; category: WorkflowCategory; tags: string[] } | null>(null);
  const [nodeEditTitle, setNodeEditTitle] = useState("");
  const [nodeEditDetail, setNodeEditDetail] = useState("");
  const [nodeEditCategory, setNodeEditCategory] = useState<WorkflowCategory>("personal");
  const [nodeEditTags, setNodeEditTags] = useState("");

  const [isRunning, setIsRunning] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasPrefetchedData, setHasPrefetchedData] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [groqKey, setGroqKey] = useState("");
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [hasGroqKey, setHasGroqKey] = useState(false);
  const [hasOpenrouterKey, setHasOpenrouterKey] = useState(false);
  const [isSavingKeys, setIsSavingKeys] = useState(false);

  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<"console" | "nodes">("console");

  // Ref for abort controller
  const abortControllerRef = useRef<AbortController | null>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll console to bottom
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [trace]);

  // Add trace log helper
  const addTrace = useCallback((level: TraceLog["level"], message: string, nodeId?: string) => {
    setTrace((prev) => [
      ...prev,
      {
        id: `trace-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        level,
        message,
        timestamp: Date.now(),
        nodeId,
      },
    ]);
  }, []);

  // ============================================================================
  // Parse Idea (AI or Local)
  // ============================================================================

  const parseWorkflow = useCallback(
    async (value?: string, isEdit: boolean = false) => {
      setIsParsing(true);
      setIsEditing(isEdit);
      addTrace("info", isEdit ? "Editing workflow..." : "Parsing idea into workflow...");

      const source = value ?? prompt;
      // Always use original prompt for cache key so edits persist on reload
      const cacheKey = `workflow-cache:${originalPrompt}`;

      // Try cache first (only if not editing, to allow edits to regenerate)
      if (!isEdit) {
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached) as WorkflowGraph;
            setGraph(parsed);
            addTrace("info", `Loaded workflow from cache (${parsed.nodes.length} nodes, ${parsed.edges.length} edges)`);
            setIsParsing(false);
            setIsEditing(false);
            return;
          }
        } catch (err) {
          console.warn("[canvas] failed to load cache", err);
        }
      }

      try {
        const result = await parseIdea(source);
        if (result.success && result.graph) {
          setGraph(result.graph);
          addTrace(
            "info",
            `AI generated ${result.graph.nodes.length} nodes with ${result.graph.edges.length} connections`,
          );
          // Always cache with original prompt key so edits persist
          try {
            localStorage.setItem(cacheKey, JSON.stringify(result.graph));
            if (isEdit) {
              addTrace("info", "Workflow updated and cached");
            }
          } catch (err) {
            console.warn("[canvas] failed to cache workflow", err);
          }
          if (result.graph.warnings.length > 0) {
            result.graph.warnings.forEach((w) => addTrace("warn", w));
          }
        } else {
          addTrace("error", result.error || "Failed to parse with AI");
          // Fallback to local parsing
          const local = parseIdeaToWorkflow(source);
          setGraph(local.graph);
          addTrace("info", "Fell back to local parsing");
          try {
            localStorage.setItem(cacheKey, JSON.stringify(local.graph));
            if (isEdit) {
              addTrace("info", "Workflow updated and cached");
            }
          } catch (err) {
            console.warn("[canvas] failed to cache workflow", err);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        addTrace("error", `Parse error: ${message}`);
        // Fallback to local
        const local = parseIdeaToWorkflow(source);
        setGraph(local.graph);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(local.graph));
          if (isEdit) {
            addTrace("info", "Workflow updated and cached");
          }
        } catch (err) {
          console.warn("[canvas] failed to cache workflow", err);
        }
      } finally {
        setIsParsing(false);
        setIsEditing(false);
      }
    },
    [prompt, originalPrompt, addTrace],
  );

  // Initial load: try to hydrate from prefetched workflow, otherwise parse
  useEffect(() => {
    // Set original prompt on initial load (so edits can be cached with original key)
    setOriginalPrompt(prompt);
    
    // Check if we have prefetched workflow from home page
    try {
      const prefetchComplete = sessionStorage.getItem("workflow-prefetch-complete");
      const cached = sessionStorage.getItem("prefetched-workflow");
      
      if (cached && prefetchComplete === "true") {
        const parsed = JSON.parse(cached) as { idea: string; graph: WorkflowGraph };
        if (parsed.idea === prompt) {
          console.debug("[canvas] using prefetched workflow");
          setGraph(parsed.graph);
          setPrompt(parsed.idea);
          setOriginalPrompt(parsed.idea); // Set original prompt
          setHasPrefetchedData(true); // Mark that we have prefetched data
          addTrace(
            "info",
            `Loaded prefetched workflow (${parsed.graph.nodes.length} nodes, ${parsed.graph.edges.length} edges)`,
          );
          sessionStorage.removeItem("prefetched-workflow");
          sessionStorage.removeItem("workflow-prefetch-complete");
          // Workflow is ready, no need to parse
          return;
        }
      }
    } catch (err) {
      console.error("[canvas] failed to load prefetched workflow", err);
    }

    // No prefetched data - need to parse (this will show loading screen)
    setHasPrefetchedData(false);
    parseWorkflow();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================================
  // Execute Flow
  // ============================================================================

  const executeFlow = useCallback(async () => {
    if (isRunning) return;

    setIsRunning(true);
    abortControllerRef.current = new AbortController();
    
    // Reset all nodes to pending
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) => ({ ...node, status: "pending", output: undefined, error: undefined })),
    }));

    addTrace("info", "🚀 Starting workflow execution...");

    // Get execution order (topologically sorted)
    const orderedNodes = getExecutionOrder(graph);
    addTrace("info", `Execution order: ${orderedNodes.map((n) => n.title).join(" → ")}`);

    // Initialize context
    let context = createInitialContext(prompt);
    setExecutionContext(context);

    for (const node of orderedNodes) {
      // Check if aborted
      if (abortControllerRef.current?.signal.aborted) {
        addTrace("warn", "Execution aborted by user");
        break;
      }

      // Set node to running
      setGraph((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === node.id ? { ...n, status: "running" } : n
        ),
      }));
      addTrace("info", `▶ Executing: ${node.title}`, node.id);

      try {
        // Execute node with AI
        const result = await executeNode(node, context);

        if (result.success && result.output) {
          // Update context with output
          context = updateContext(context, node, result.output);
          setExecutionContext(context);

          // Set node to done with output
          setGraph((prev) => ({
            ...prev,
            nodes: prev.nodes.map((n) =>
              n.id === node.id ? { ...n, status: "done", output: result.output } : n
            ),
          }));
          addTrace("info", `✓ Completed: ${node.title}`, node.id);
          addTrace("info", `   Output: ${result.output.slice(0, 100)}${result.output.length > 100 ? "..." : ""}`, node.id);
        } else {
          throw new Error(result.error || "Execution failed");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        
        // Set node to blocked
        setGraph((prev) => ({
          ...prev,
          nodes: prev.nodes.map((n) =>
            n.id === node.id ? { ...n, status: "blocked", error: message } : n
          ),
        }));
        addTrace("error", `✗ Failed: ${node.title} - ${message}`, node.id);

        // Continue to next node (don't stop entire flow)
      }

      // Small delay between nodes for visibility
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    addTrace("info", "🏁 Workflow execution complete");
    setIsRunning(false);
    abortControllerRef.current = null;
  }, [graph, prompt, isRunning, addTrace]);

  const stopExecution = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsRunning(false);
    addTrace("warn", "Execution stopped by user");
  }, [addTrace]);

  // Delete node and reconnect incoming -> outgoing to preserve sequence
  const deleteNode = useCallback(
    (nodeId: string) => {
      setGraph((prev) => {
        if (!prev.nodes.some((n) => n.id === nodeId)) return prev;

        const incoming = prev.edges.filter((e) => e.target === nodeId);
        const outgoing = prev.edges.filter((e) => e.source === nodeId);

        const remainingNodes = prev.nodes.filter((n) => n.id !== nodeId);
        const remainingEdges = prev.edges.filter(
          (e) => e.source !== nodeId && e.target !== nodeId,
        );

        const bridges: typeof remainingEdges = [];
        for (const inEdge of incoming) {
          for (const outEdge of outgoing) {
            bridges.push({
              id: `edge-bridge-${inEdge.source}-${outEdge.target}-${Date.now()}`,
              source: inEdge.source,
              target: outEdge.target,
              label: outEdge.label || inEdge.label || "follow",
            });
          }
        }

        return {
          ...prev,
          nodes: remainingNodes,
          edges: [...remainingEdges, ...bridges],
        };
      });

      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
      addTrace("info", `Deleted node ${nodeId} and reconnected flow.`);
    },
    [selectedNodeId, addTrace],
  );

  // ============================================================================
  // Other Actions
  // ============================================================================

  const resetStatuses = useCallback(() => {
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) => ({ ...node, status: "pending", output: undefined, error: undefined })),
    }));
    setExecutionContext(null);
    try {
      const cacheKey = `workflow-cache:${originalPrompt}`;
      localStorage.removeItem(cacheKey);
      addTrace("info", "All node statuses reset and cache cleared");
    } catch {
      addTrace("info", "All node statuses reset");
    }
  }, [addTrace, originalPrompt]);

  const getSessionId = useCallback((): string => {
    if (typeof window === "undefined") return "default";
    let sessionId = sessionStorage.getItem("session-id");
    if (!sessionId) {
      sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem("session-id", sessionId);
    }
    return sessionId;
  }, []);

  const clearAllCache = useCallback(async () => {
    try {
      // Clear localStorage cache
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith("workflow-cache:")) {
          localStorage.removeItem(key);
        }
      });
      
      // Delete API keys from Convex database for this session
      try {
        const sessionId = getSessionId();
        await fetch("/api/settings/keys", {
          method: "DELETE",
          headers: {
            "x-session-id": sessionId,
          },
        });
      } catch {
        // Ignore errors for key deletion
      }
      
      addTrace("info", "All workflow cache cleared");
    } catch (error) {
      addTrace("error", "Failed to clear cache");
    }
  }, [addTrace, getSessionId]);

  const loadApiKeysStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/keys", {
        headers: {
          "x-session-id": getSessionId(),
        },
      });
      const data = await res.json();
      if (data.success) {
        setHasGroqKey(data.hasGroq || false);
        setHasOpenrouterKey(data.hasOpenrouter || false);
      }
    } catch {
      // Ignore errors
    }
  }, []);

  const saveApiKeys = useCallback(async () => {
    if (!groqKey.trim() && !openrouterKey.trim()) {
      addTrace("warn", "Please enter at least one API key");
      return;
    }

    setIsSavingKeys(true);
    try {
      const res = await fetch("/api/settings/keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": getSessionId(),
        },
        body: JSON.stringify({
          groqKey: groqKey.trim() || undefined,
          openrouterKey: openrouterKey.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        addTrace("info", "API keys saved successfully");
        setGroqKey("");
        setOpenrouterKey("");
        await loadApiKeysStatus();
      } else {
        addTrace("error", `Failed to save keys: ${data.error || "unknown error"}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      addTrace("error", `Failed to save keys: ${message}`);
    } finally {
      setIsSavingKeys(false);
    }
  }, [groqKey, openrouterKey, addTrace, loadApiKeysStatus, getSessionId]);

  useEffect(() => {
    if (settingsOpen) {
      loadApiKeysStatus();
    }
  }, [settingsOpen, loadApiKeysStatus, getSessionId]);

  const combinedOutput = useMemo(
    () =>
      executionContext?.executedNodes?.map((n) => `### ${n.title}\n${n.output ?? ""}`).join("\n\n") ||
      "No execution output yet.",
    [executionContext],
  );

  const sendEmail = useCallback(async () => {
    if (!emailTo.trim()) {
      addTrace("warn", "Email is required");
      return;
    }

    setIsSendingEmail(true);
    const payload = {
      to: emailTo.trim(),
      subject: emailSubject.trim() || "Workflow Outputs",
      markdown: combinedOutput,
    };

    try {
      const res = await fetch("/api/notify/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        addTrace("info", `Email queued to ${payload.to}`);
        setEmailModalOpen(false);
      } else {
        addTrace("error", `Email failed: ${json.error || "unknown"}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      addTrace("error", `Email failed: ${message}`);
    } finally {
      setIsSendingEmail(false);
    }
  }, [emailTo, emailSubject, combinedOutput, addTrace]);

  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    try {
      const baseName = `workflow-${Date.now()}`;

      if (downloadFormat === "json") {
        const data = JSON.stringify({ graph, executionContext }, null, 2);
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${baseName}.json`;
        a.click();
        URL.revokeObjectURL(url);
        addTrace("info", "Workflow exported as JSON");
      } else if (downloadFormat === "txt") {
        const nodeOutputs =
          executionContext?.executedNodes
            ?.map((n) => `${n.title}\n${n.output ?? ""}`)
            .join("\n\n") || "No execution output yet.";
        const txt = `Workflow Summary\n\n${combinedOutput}\n\n---\n\nNode Outputs:\n\n${nodeOutputs}`;
        const blob = new Blob([txt], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${baseName}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        addTrace("info", "Workflow exported as TXT");
      } else if (downloadFormat === "pdf") {
        const doc = new jsPDF();
        const lines = doc.splitTextToSize(`Workflow Summary\n\n${combinedOutput}`, 180);
        doc.text(lines, 10, 10);
        const nodeOutputs =
          executionContext?.executedNodes
            ?.map((n) => `${n.title}\n${n.output ?? ""}`)
            .join("\n\n") || "No execution output yet.";
        const nodeLines = doc.splitTextToSize(`\n\nNode Outputs:\n\n${nodeOutputs}`, 180);
        doc.text(nodeLines, 10, 20 + lines.length * 6);
        doc.save(`${baseName}.pdf`);
        addTrace("info", "Workflow exported as PDF");
      }

      setDownloadModalOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      addTrace("error", `Download failed: ${message}`);
    } finally {
      setIsDownloading(false);
    }
  }, [downloadFormat, combinedOutput, graph, executionContext, addTrace]);

  const handleVoiceTranscription = useCallback(
    async (transcribedText: string) => {
      const instruction = transcribedText.trim();
      if (!instruction) {
        addTrace("warn", "No transcription received");
        setIsVoiceActive(false);
        return;
      }

      setVoiceModalOpen(false);
      setIsVoiceActive(false);
      addTrace("info", `Voice edit received: "${instruction.slice(0, 80)}${instruction.length > 80 ? "..." : ""}"`);

      const currentContext = graph.nodes
        .map((n) => `- ${n.title}: ${n.detail}`)
        .join("\n");

      const contextualPrompt = `Current workflow:\n${currentContext}\n\nUser voice instruction: ${instruction}\n\nApply minimal changes to satisfy the instruction while keeping the rest of the workflow intact. Preserve the summary node if present.`;

      setPrompt(instruction);
      await parseWorkflow(contextualPrompt, true);
    },
    [addTrace, graph, parseWorkflow],
  );

  const handleExport = useCallback(async (destination: "email" | "notion" | "download") => {
    setIsExporting(true);
    
    if (destination === "download") {
      setDownloadModalOpen(true);
      setIsExporting(false);
      return;
    } else if (destination === "email") {
      setEmailModalOpen(true);
      setIsExporting(false);
      return;
    } else if (destination === "notion") {
      setNotionModalOpen(true);
      setIsExporting(false);
      return;
    } else {
      // Placeholder for email/notion
      addTrace("info", `Export to ${destination} ready - connect API to send`);
    }
    
    setIsExporting(false);
  }, [addTrace]);

  const openVoiceModal = useCallback(() => {
    setVoiceMode("edit");
    setIsVoiceActive(true);
    setVoiceModalOpen(true);
  }, []);

  const addNodeFromTemplate = useCallback((category: WorkflowCategory) => {
    const newId = `node-${Date.now()}`;
    setGraph((prev) => ({
      ...prev,
      nodes: [
        ...prev.nodes,
        {
          id: newId,
          title: category === "personal" ? "Personal Context" : `New ${category} node`,
          detail: category === "personal" ? "Add your own content here for AI context." : "Double-click to edit this node.",
          category,
          status: "pending",
          tags: category === "personal" ? ["personal"] : ["new"],
        },
      ],
    }));
    addTrace("info", `Added new ${category} node`);
  }, [addTrace]);

  const handleNodeClick = useCallback((nodeId: string) => {
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (node) {
      setEditingNode({
        id: node.id,
        title: node.title,
        detail: node.detail,
        category: node.category,
        tags: node.tags,
      });
      setNodeEditTitle(node.title);
      setNodeEditDetail(node.detail);
      setNodeEditCategory(node.category);
      setNodeEditTags(node.tags.join(", "));
      setNodeEditModalOpen(true);
    }
  }, [graph]);

  const handleNodeUpdate = useCallback(() => {
    if (!editingNode) return;

    const tagsArray = nodeEditTags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) =>
        node.id === editingNode.id
          ? {
              ...node,
              title: nodeEditTitle.trim() || "Untitled Node",
              detail: nodeEditDetail.trim() || "",
              category: nodeEditCategory,
              tags: tagsArray,
            }
          : node
      ),
    }));

    addTrace("info", `Updated node: ${nodeEditTitle}`);
    setNodeEditModalOpen(false);
    setEditingNode(null);
  }, [editingNode, nodeEditTitle, nodeEditDetail, nodeEditCategory, nodeEditTags, addTrace]);

  const handleEdgeCreate = useCallback((source: string, target: string) => {
    const edgeId = `edge-${source}-${target}`;
    setGraph((prev) => {
      // Check if edge already exists
      const exists = prev.edges.some((e) => e.source === source && e.target === target);
      if (exists) return prev;

      return {
        ...prev,
        edges: [
          ...prev.edges,
          {
            id: edgeId,
            source,
            target,
          },
        ],
      };
    });
    addTrace("info", `Connected ${source} → ${target}`);
  }, [addTrace]);

  // ============================================================================
  // Render
  // ============================================================================

  const recentTrace = trace.slice(-50);
  const selectedNode = graph.nodes.find((n) => n.id === selectedNodeId);

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      {/* ===== Full Screen Canvas ===== */}
      <FlowCanvas
        graph={graph}
        onNodeClick={handleNodeClick}
        onDeleteNode={deleteNode}
        onEdgeCreate={handleEdgeCreate}
        className="absolute inset-0"
      />

      {/* ===== Top Toolbar ===== */}
      <header className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-center justify-between gap-4 p-4">
        {/* Left side */}
        <div className="pointer-events-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-9 bg-zinc-900/80 text-zinc-400 backdrop-blur hover:bg-zinc-800 hover:text-zinc-100"
            onClick={() => router.push("/")}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 backdrop-blur">
            <Sparkles className="size-4 text-amber-400" />
            <span className="max-w-[300px] truncate text-sm text-zinc-300">
              {prompt.slice(0, 60)}
              {prompt.length > 60 && "..."}
            </span>
          </div>
        </div>

        {/* Right side */}
        <div className="pointer-events-auto flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 bg-zinc-900/80 text-zinc-400 backdrop-blur hover:bg-zinc-800 hover:text-zinc-100"
                onClick={resetStatuses}
              >
                <RefreshCcw className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Reset Status</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="mx-1 h-6 bg-zinc-800" />

          {isRunning ? (
            <Button
              onClick={stopExecution}
              className="gap-2 bg-rose-600 text-white hover:bg-rose-700"
            >
              <Square className="size-4" />
              Stop
            </Button>
          ) : (
            <Button
              onClick={executeFlow}
              disabled={isParsing}
              className="gap-2 bg-white text-black hover:bg-zinc-200"
            >
              <Play className="size-4" />
              Execute
            </Button>
          )}
        </div>
      </header>

      {/* ===== Left Panel - Tools ===== */}
      <aside
        className={`pointer-events-auto absolute bottom-4 left-4 top-20 z-20 flex transition-all duration-300 ${
          leftPanelOpen ? "w-64" : "w-12"
        }`}
      >
        {leftPanelOpen ? (
          <div className="flex size-full flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/95 shadow-2xl shadow-black/50 backdrop-blur">
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-zinc-400" />
                <span className="text-sm font-medium text-zinc-100">Toolkit</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                onClick={() => setLeftPanelOpen(false)}
              >
                <PanelLeftClose className="size-4" />
              </Button>
            </div>

            {/* Scrollable Content */}
            <ScrollArea className="flex-1">
              <div className="p-3">
                {/* Node Templates */}
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Add Node
                </p>
                <div className="space-y-1">
                  {nodeTemplates.map(({ category, label, icon: Icon }) => (
                    <button
                      key={category}
                      onClick={() => addNodeFromTemplate(category)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                    >
                      <Icon className="size-4 text-zinc-500" />
                      {label}
                      <Plus className="ml-auto size-3 text-zinc-600" />
                    </button>
                  ))}
                </div>

                <Separator className="my-3 bg-zinc-800" />

                {/* Settings */}
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Settings
                </p>
                <div className="space-y-1">
                  <Drawer open={settingsOpen} onOpenChange={setSettingsOpen}>
                    <DrawerTrigger asChild>
                      <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100">
                        <Settings className="size-4 text-zinc-500" />
                        Settings
                      </button>
                    </DrawerTrigger>
                    <DrawerContent className="border-zinc-800 bg-zinc-950 text-zinc-100">
                      <DrawerHeader>
                        <DrawerTitle>Settings</DrawerTitle>
                        <DrawerDescription>Manage your API keys and cache settings.</DrawerDescription>
                      </DrawerHeader>
                      <div className="px-4 pb-4 space-y-6">
                        {/* API Keys Section */}
                        <div className="space-y-4">
                          <h3 className="text-sm font-medium text-zinc-300">API Keys</h3>
                          <div className="space-y-3">
                            <div className="space-y-2">
                              <label className="text-xs text-zinc-400">Groq API Key</label>
                              <Input
                                type="password"
                                value={groqKey}
                                onChange={(e) => setGroqKey(e.target.value)}
                                placeholder={hasGroqKey ? "••••••••••••••••" : "Enter Groq API key"}
                                className="border-zinc-800 bg-zinc-900 text-zinc-100"
                              />
                              {hasGroqKey && !groqKey && (
                                <p className="text-xs text-zinc-500">Key is saved. Enter a new key to update.</p>
                              )}
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs text-zinc-400">OpenRouter API Key</label>
                              <Input
                                type="password"
                                value={openrouterKey}
                                onChange={(e) => setOpenrouterKey(e.target.value)}
                                placeholder={hasOpenrouterKey ? "••••••••••••••••" : "Enter OpenRouter API key"}
                                className="border-zinc-800 bg-zinc-900 text-zinc-100"
                              />
                              {hasOpenrouterKey && !openrouterKey && (
                                <p className="text-xs text-zinc-500">Key is saved. Enter a new key to update.</p>
                              )}
                            </div>
                            <Button
                              onClick={saveApiKeys}
                              disabled={isSavingKeys}
                              className="w-full bg-white text-black hover:bg-zinc-200"
                            >
                              {isSavingKeys ? (
                                <>
                                  <Loader2 className="mr-2 size-4 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                "Save API Keys"
                              )}
                            </Button>
                          </div>
                        </div>

                        <Separator className="bg-zinc-800" />

                        {/* Cache Section */}
                        <div className="space-y-4">
                          <h3 className="text-sm font-medium text-zinc-300">Cache</h3>
                          <Button
                            onClick={() => {
                              clearAllCache();
                              setSettingsOpen(false);
                            }}
                            variant="outline"
                            className="w-full border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                          >
                            Clear All Cache
                          </Button>
                        </div>
                      </div>
                      <DrawerFooter>
                        <DrawerClose asChild>
                          <Button variant="ghost" className="w-full">
                            Close
                          </Button>
                        </DrawerClose>
                      </DrawerFooter>
                    </DrawerContent>
                  </Drawer>
                </div>

                <Separator className="my-3 bg-zinc-800" />

                {/* Quick Actions */}
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Export
                </p>
                <div className="space-y-1">
                  <button
                    onClick={() => handleExport("email")}
                    disabled={isExporting}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
                  >
                    <Mail className="size-4 text-zinc-500" />
                    Send to Email
                  </button>
                  <button
                    onClick={() => handleExport("notion")}
                    disabled={isExporting}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
                  >
                    <Download className="size-4 text-zinc-500" />
                    Export to Notion
                  </button>
                  <button
                    onClick={() => handleExport("download")}
                    disabled={isExporting}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
                  >
                    <FileJson className="size-4 text-zinc-500" />
                    Download
                  </button>
                </div>
              </div>
            </ScrollArea>

            {/* Stats */}
            <div className="shrink-0 border-t border-zinc-800 p-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-zinc-900 px-3 py-2">
                  <p className="text-lg font-semibold text-zinc-100">
                    {graph.nodes.length}
                  </p>
                  <p className="text-xs text-zinc-500">Nodes</p>
                </div>
                <div className="rounded-lg bg-zinc-900 px-3 py-2">
                  <p className="text-lg font-semibold text-zinc-100">
                    {graph.edges.length}
                  </p>
                  <p className="text-xs text-zinc-500">Connections</p>
                </div>
              </div>
              {graph.warnings.length > 0 && (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                  <AlertTriangle className="size-3" />
                  {graph.warnings.length} warning(s)
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-950/95 p-2 shadow-2xl shadow-black/50 backdrop-blur">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  onClick={() => setLeftPanelOpen(true)}
                >
                  <PanelLeftOpen className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Open Toolkit</TooltipContent>
            </Tooltip>
            {nodeTemplates.map(({ category, icon: Icon }) => (
              <Tooltip key={category}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                    onClick={() => addNodeFromTemplate(category)}
                  >
                    <Icon className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Add {category}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
      </aside>

      {/* ===== Right Panel - Console ===== */}
      <aside
        className={`pointer-events-auto absolute bottom-4 right-4 top-20 z-20 flex transition-all duration-300 ${
          rightPanelOpen ? "w-80" : "w-12"
        }`}
      >
        {rightPanelOpen ? (
          <div className="flex size-full flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/95 shadow-2xl shadow-black/50 backdrop-blur">
            {/* Header with tabs */}
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-2 py-1">
              <div className="flex">
                <button
                  onClick={() => setActiveRightTab("console")}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                    activeRightTab === "console"
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <Terminal className="size-4" />
                  Console
                </button>
                <button
                  onClick={() => setActiveRightTab("nodes")}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                    activeRightTab === "nodes"
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <Layers className="size-4" />
                  Nodes
                </button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                onClick={() => setRightPanelOpen(false)}
              >
                <PanelRightClose className="size-4" />
              </Button>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 min-h-0">
              {activeRightTab === "console" ? (
                <div className="space-y-1 p-2">
                  {recentTrace.length === 0 ? (
                    <p className="px-2 py-8 text-center text-sm text-zinc-600">
                      No logs yet. Execute to see output.
                    </p>
                  ) : (
                    <>
                      {recentTrace.map((log) => (
                        <div
                          key={log.id}
                          className="group flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-900"
                        >
                          <span
                            className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                              log.level === "warn"
                                ? "bg-amber-400"
                                : log.level === "error"
                                ? "bg-rose-400"
                                : "bg-emerald-400"
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="break-words text-xs text-zinc-300">{log.message}</p>
                            <p className="text-[10px] text-zinc-600">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={consoleEndRef} />
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {graph.nodes.map((node) => (
                    <div
                      key={node.id}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-zinc-800 ${
                        selectedNodeId === node.id ? "bg-zinc-800" : ""
                      }`}
                    >
                      <button
                        onClick={() => setSelectedNodeId(node.id)}
                        className="flex flex-1 items-center gap-3 text-left"
                      >
                        <span
                          className={`size-2 shrink-0 rounded-full ${statusColors[node.status]}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-zinc-200">{node.title}</p>
                          <p className="truncate text-xs text-zinc-500">{node.category}</p>
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-zinc-600" />
                      </button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-300"
                            onClick={() => deleteNode(node.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left">Delete node</TooltipContent>
                      </Tooltip>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Selected node details */}
            {selectedNode && activeRightTab === "nodes" && (
              <div className="shrink-0 border-t border-zinc-800 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-zinc-100">{selectedNode.title}</p>
                  <Badge
                    variant="outline"
                    className="border-zinc-700 bg-zinc-800 text-xs text-zinc-400"
                  >
                    {selectedNode.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-zinc-500">{selectedNode.detail}</p>
                {selectedNode.output && (
                  <div className="mt-2 rounded-lg bg-zinc-900 p-2">
                    <p className="text-[10px] uppercase text-zinc-500">Output</p>
                    <div className="prose prose-invert mt-1 max-h-48 overflow-y-auto rounded-md text-xs leading-6">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedNode.output}</ReactMarkdown>
                    </div>
                  </div>
                )}
                {selectedNode.error && (
                  <div className="mt-2 rounded-lg bg-rose-500/10 p-2">
                    <p className="text-[10px] uppercase text-rose-400">Error</p>
                    <p className="mt-1 text-xs text-rose-300">{selectedNode.error}</p>
                  </div>
                )}
                {selectedNode.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedNode.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-950/95 p-2 shadow-2xl shadow-black/50 backdrop-blur">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  onClick={() => setRightPanelOpen(true)}
                >
                  <PanelRightOpen className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Open Panel</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  onClick={() => {
                    setRightPanelOpen(true);
                    setActiveRightTab("console");
                  }}
                >
                  <Terminal className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Console</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  onClick={() => {
                    setRightPanelOpen(true);
                    setActiveRightTab("nodes");
                  }}
                >
                  <Layers className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Nodes</TooltipContent>
            </Tooltip>
          </div>
        )}
      </aside>

      {/* ===== Bottom Status Bar ===== */}
      <footer className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
        <div className="pointer-events-auto flex items-center gap-4 rounded-full border border-zinc-800 bg-zinc-950/95 px-4 py-2 shadow-2xl shadow-black/50 backdrop-blur">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            {isRunning ? (
              <>
                <Loader2 className="size-3 animate-spin text-sky-400" />
                <span className="text-sky-400">Running</span>
              </>
            ) : (
              <>
                <Check className="size-3 text-emerald-400" />
                <span>Ready</span>
              </>
            )}
          </div>
          <Separator orientation="vertical" className="h-4 bg-zinc-800" />
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Keyboard className="size-3" />
            <span>Scroll to zoom</span>
          </div>
          <Separator orientation="vertical" className="h-4 bg-zinc-800" />
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="text-zinc-400">{graph.nodes.length}</span>
            <span>nodes</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400">{graph.edges.length}</span>
            <span>edges</span>
          </div>
          <Separator orientation="vertical" className="h-4 bg-zinc-800" />
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 rounded-full bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                  onClick={() => {
                    setEditDraft(prompt);
                    setEditModalOpen(true);
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Edit prompt</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 rounded-full bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                  onClick={openVoiceModal}
                >
                  <Mic className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Voice input</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 rounded-full bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                  onClick={() => setOutputModalOpen(true)}
                >
                  <FileText className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Outputs</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </footer>

      {/* Edit Prompt Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-lg border-zinc-800 bg-zinc-950 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Edit prompt</DialogTitle>
            <DialogDescription>Update the idea and regenerate the workflow.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
            rows={5}
            className="mt-2 border-zinc-800 bg-zinc-950 text-zinc-100"
          />
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                const instruction = editDraft.trim();
                if (!instruction) {
                  addTrace("warn", "No edit instruction provided");
                  return;
                }

                // Close modal immediately for better UX
                setEditModalOpen(false);

                addTrace("info", `Text edit received: "${instruction.slice(0, 80)}${instruction.length > 80 ? "..." : ""}"`);

                const currentContext = graph.nodes
                  .map((n) => `- ${n.title}: ${n.detail}`)
                  .join("\n");

                const contextualPrompt = `Current workflow:\n${currentContext}\n\nUser edit instruction: ${instruction}\n\nApply minimal changes to satisfy the instruction while keeping the rest of the workflow intact. Preserve the summary node if present.`;

                setPrompt(instruction);
                try {
                  await parseWorkflow(contextualPrompt, true);
                } catch (error) {
                  const message = error instanceof Error ? error.message : "Unknown error";
                  addTrace("error", `Edit failed: ${message}`);
                }
              }}
              className="bg-white text-black hover:bg-zinc-200"
            >
              Save & regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Node Edit Modal */}
      <Dialog open={nodeEditModalOpen} onOpenChange={setNodeEditModalOpen}>
        <DialogContent className="max-w-lg border-zinc-800 bg-zinc-950 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Edit Node</DialogTitle>
            <DialogDescription>Update the node content and properties.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Title</label>
              <Input
                value={nodeEditTitle}
                onChange={(e) => setNodeEditTitle(e.target.value)}
                className="border-zinc-800 bg-zinc-900 text-zinc-100"
                placeholder="Node title"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Content</label>
              <Textarea
                value={nodeEditDetail}
                onChange={(e) => setNodeEditDetail(e.target.value)}
                rows={6}
                className="border-zinc-800 bg-zinc-900 text-zinc-100"
                placeholder="Node content/description"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Category</label>
              <Select value={nodeEditCategory} onValueChange={(value: WorkflowCategory) => setNodeEditCategory(value)}>
                <SelectTrigger className="border-zinc-800 bg-zinc-900 text-zinc-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="collect">Collect</SelectItem>
                  <SelectItem value="analyze">Analyze</SelectItem>
                  <SelectItem value="execute">Execute</SelectItem>
                  <SelectItem value="notify">Notify</SelectItem>
                  <SelectItem value="decision">Decision</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Tags (comma-separated)</label>
              <Input
                value={nodeEditTags}
                onChange={(e) => setNodeEditTags(e.target.value)}
                className="border-zinc-800 bg-zinc-900 text-zinc-100"
                placeholder="tag1, tag2, tag3"
              />
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={() => setNodeEditModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleNodeUpdate}
              className="bg-white text-black hover:bg-zinc-200"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Voice Modal */}
      <Dialog
        open={voiceModalOpen}
        onOpenChange={(open) => {
          setVoiceModalOpen(open);
          setIsVoiceActive(open);
        }}
      >
        <DialogContent className="max-w-md border-zinc-800 bg-zinc-950 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Voice edit</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Speak the change you want. We will adjust the current workflow with minimal edits.
            </DialogDescription>
          </DialogHeader>
          <VoiceRecorder
            autoStart={true}
            onTranscriptionComplete={handleVoiceTranscription}
            onError={(err) => {
              addTrace("error", `Voice error: ${err}`);
              setIsVoiceActive(false);
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setVoiceModalOpen(false); setIsVoiceActive(false); }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Output Modal */}
      <Dialog open={outputModalOpen} onOpenChange={setOutputModalOpen}>
        <DialogContent className="max-w-3xl border-zinc-800 bg-zinc-950 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Workflow outputs</DialogTitle>
            <DialogDescription>Review the overall summary and per-node outputs.</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="summary" className="mt-2">
            <TabsList className="bg-zinc-900 text-zinc-200">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="nodes">Nodes</TabsTrigger>
            </TabsList>
            <TabsContent value="summary" className="mt-3">
              <div className="prose prose-invert max-w-none max-h-[420px] overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm leading-6">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{combinedOutput}</ReactMarkdown>
              </div>
            </TabsContent>
            <TabsContent value="nodes" className="mt-3">
              <div className="max-h-[420px] overflow-y-auto space-y-2">
                {graph.nodes.map((node) => (
                  <div key={node.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-zinc-100">{node.title}</p>
                        <p className="text-xs uppercase text-zinc-500">{node.category}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-zinc-700 bg-zinc-800 text-xs text-zinc-400"
                      >
                        {node.status}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-zinc-400">{node.detail}</p>
                    {node.output && (
                      <div className="prose prose-invert mt-2 max-h-40 overflow-y-auto rounded-md bg-zinc-950/80 p-3 text-xs leading-6">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{node.output}</ReactMarkdown>
                      </div>
                    )}
                    {node.error && (
                      <div className="mt-2 rounded-md bg-rose-500/10 p-2 text-xs text-rose-200">
                        {node.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOutputModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Modal */}
      <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
        <DialogContent className="max-w-md border-zinc-800 bg-zinc-950 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Send outputs to email</DialogTitle>
            <DialogDescription>We’ll send the full summary and node outputs.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs text-zinc-400">Recipient email</p>
              <Input
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="you@example.com"
                className="border-zinc-800 bg-zinc-950 text-zinc-100"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-zinc-400">Subject</p>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Workflow Outputs"
                className="border-zinc-800 bg-zinc-950 text-zinc-100"
              />
            </div>
            <p className="text-xs text-zinc-500">
              The email will include the combined summary (markdown) and per-node outputs.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEmailModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={sendEmail}
              disabled={isSendingEmail}
              className="gap-2 bg-white text-black hover:bg-zinc-200"
            >
              {isSendingEmail ? <Loader2 className="size-4 animate-spin" /> : null}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

  {/* Notion Modal */}
  <Dialog open={notionModalOpen} onOpenChange={setNotionModalOpen}>
    <DialogContent className="max-w-md border-zinc-800 bg-zinc-950 text-zinc-100">
      <DialogHeader>
        <DialogTitle>Export to Notion</DialogTitle>
        <DialogDescription>Feature coming soon.</DialogDescription>
      </DialogHeader>
      <p className="text-sm text-zinc-400">
        We’ll let you push the full workflow summary and node outputs to a Notion page. Hooking this up next.
      </p>
      <DialogFooter>
        <Button variant="ghost" onClick={() => setNotionModalOpen(false)}>
          Close
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  {/* Download Modal */}
  <Dialog open={downloadModalOpen} onOpenChange={setDownloadModalOpen}>
    <DialogContent className="max-w-md border-zinc-800 bg-zinc-950 text-zinc-100">
      <DialogHeader>
        <DialogTitle>Download workflow</DialogTitle>
        <DialogDescription>Choose a format to export the flow outputs.</DialogDescription>
      </DialogHeader>
      <RadioGroup
        value={downloadFormat}
        onValueChange={(v) => setDownloadFormat(v as "json" | "txt" | "pdf")}
        className="space-y-2"
      >
        <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
          <RadioGroupItem value="json" id="fmt-json" />
          <label htmlFor="fmt-json" className="text-sm text-zinc-100">
            JSON
          </label>
          <p className="text-xs text-zinc-500">Graph + execution context</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
          <RadioGroupItem value="txt" id="fmt-txt" />
          <label htmlFor="fmt-txt" className="text-sm text-zinc-100">
            TXT
          </label>
          <p className="text-xs text-zinc-500">Summary + node outputs (plain text)</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
          <RadioGroupItem value="pdf" id="fmt-pdf" />
          <label htmlFor="fmt-pdf" className="text-sm text-zinc-100">
            PDF
          </label>
          <p className="text-xs text-zinc-500">Formatted summary and node outputs</p>
        </div>
      </RadioGroup>
      <DialogFooter>
        <Button variant="ghost" onClick={() => setDownloadModalOpen(false)}>
          Cancel
        </Button>
        <Button
          onClick={handleDownload}
          disabled={isDownloading}
          className="gap-2 bg-white text-black hover:bg-zinc-200"
        >
          {isDownloading ? <Loader2 className="size-4 animate-spin" /> : null}
          Download
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

      {/* ===== Loading Overlay ===== */}
      {isExporting && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur">
          <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-6 py-4 shadow-2xl">
            <Loader2 className="size-5 animate-spin text-white" />
            <span className="text-sm text-zinc-200">Preparing export...</span>
          </div>
        </div>
      )}
      {/* Full-screen loading overlay when parsing (matches home page style) */}
      {isParsing && !hasPrefetchedData && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black">
          {/* Animated background */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -left-1/4 top-1/4 size-[600px] rounded-full bg-gradient-to-r from-violet-600/20 to-transparent blur-3xl" />
            <div className="absolute -right-1/4 bottom-1/4 size-[600px] rounded-full bg-gradient-to-l from-blue-600/20 to-transparent blur-3xl" />
          </div>

          <div className="relative z-10 flex flex-col items-center justify-center">
            <AITextLoading
              texts={
                isEditing
                  ? [
                      "Editing workflow...",
                      "Applying changes...",
                      "Regenerating nodes...",
                    ]
                  : [
                      "Generating your workflow...",
                      "Analyzing structure...",
                      "Detecting dependencies...",
                      "Building nodes...",
                    ]
              }
              className="text-3xl font-bold"
              interval={1500}
            />
          </div>
        </div>
      )}
    </div>
  );
}
