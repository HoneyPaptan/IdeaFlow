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
  Sparkles,
  Square,
  Terminal,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FlowCanvas } from "@/components/workflow/flow-canvas";
import { parseIdeaToWorkflow } from "@/components/workflow/parser";
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
  { category: "collect", label: "Input", icon: Box },
  { category: "analyze", label: "Analyze", icon: BarChart3 },
  { category: "execute", label: "Action", icon: Zap },
  { category: "notify", label: "Notify", icon: MessageSquare },
  { category: "decision", label: "Branch", icon: GitBranch },
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

  // State
  const initial = useMemo(() => parseIdeaToWorkflow(prompt), [prompt]);
  const [graph, setGraph] = useState<WorkflowGraph>(initial.graph);
  const [trace, setTrace] = useState<TraceLog[]>(initial.trace);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [executionContext, setExecutionContext] = useState<ExecutionContext | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [outputModalOpen, setOutputModalOpen] = useState(false);
  const [editDraft, setEditDraft] = useState(prompt);

  const [isRunning, setIsRunning] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [useAI, setUseAI] = useState(true); // Toggle for AI vs local parsing

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
    async (value?: string) => {
      setIsParsing(true);
      addTrace("info", "Parsing idea into workflow...");

      const source = value ?? prompt;

      try {
        if (useAI) {
          // Use AI API
          const result = await parseIdea(source);
          if (result.success && result.graph) {
            setGraph(result.graph);
            addTrace(
              "info",
              `AI generated ${result.graph.nodes.length} nodes with ${result.graph.edges.length} connections`,
            );
            if (result.graph.warnings.length > 0) {
              result.graph.warnings.forEach((w) => addTrace("warn", w));
            }
          } else {
            addTrace("error", result.error || "Failed to parse with AI");
            // Fallback to local parsing
            const local = parseIdeaToWorkflow(source);
            setGraph(local.graph);
            addTrace("info", "Fell back to local parsing");
          }
        } else {
          // Use local parsing
          const result = parseIdeaToWorkflow(source);
          setGraph(result.graph);
          addTrace("info", `Locally parsed ${result.graph.nodes.length} nodes`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        addTrace("error", `Parse error: ${message}`);
        // Fallback to local
        const local = parseIdeaToWorkflow(source);
        setGraph(local.graph);
      } finally {
        setIsParsing(false);
      }
    },
    [prompt, useAI, addTrace],
  );

  // Initial load: try to hydrate from prefetched workflow, otherwise parse
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem("prefetched-workflow");
      if (cached) {
        const parsed = JSON.parse(cached) as { idea: string; graph: WorkflowGraph };
        if (parsed.idea === prompt) {
          console.debug("[canvas] using prefetched workflow");
          setGraph(parsed.graph);
          setPrompt(parsed.idea);
          addTrace(
            "info",
            `Loaded prefetched workflow (${parsed.graph.nodes.length} nodes, ${parsed.graph.edges.length} edges)`,
          );
          sessionStorage.removeItem("prefetched-workflow");
          return;
        }
      }
    } catch (err) {
      console.error("[canvas] failed to load prefetched workflow", err);
    }

    // Fallback to parse on mount
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
  }, [graph, idea, isRunning, addTrace]);

  const stopExecution = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsRunning(false);
    addTrace("warn", "Execution stopped by user");
  }, [addTrace]);

  // ============================================================================
  // Other Actions
  // ============================================================================

  const resetStatuses = useCallback(() => {
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) => ({ ...node, status: "pending", output: undefined, error: undefined })),
    }));
    setExecutionContext(null);
    addTrace("info", "All node statuses reset");
  }, [addTrace]);

  const handleExport = useCallback(async (destination: "email" | "notion" | "json") => {
    setIsExporting(true);
    
    if (destination === "json") {
      // Download JSON
      const data = JSON.stringify({ graph, executionContext }, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `workflow-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addTrace("info", "Workflow exported as JSON");
    } else {
      // Placeholder for email/notion
      addTrace("info", `Export to ${destination} ready - connect API to send`);
    }
    
    setIsExporting(false);
  }, [graph, executionContext, addTrace]);

  const toggleVoice = useCallback(() => {
    setIsVoiceActive((prev) => {
      const newState = !prev;
      addTrace("info", newState ? "Voice input activated" : "Voice input deactivated");
      return newState;
    });
  }, [addTrace]);

  const addNodeFromTemplate = useCallback((category: WorkflowCategory) => {
    const newId = `node-${Date.now()}`;
    setGraph((prev) => ({
      ...prev,
      nodes: [
        ...prev.nodes,
        {
          id: newId,
          title: `New ${category} node`,
          detail: "Double-click to edit this node.",
          category,
          status: "pending",
          tags: ["new"],
        },
      ],
    }));
    addTrace("info", `Added new ${category} node`);
  }, [addTrace]);

  // ============================================================================
  // Render
  // ============================================================================

  const recentTrace = trace.slice(-50);
  const selectedNode = graph.nodes.find((n) => n.id === selectedNodeId);
  const combinedOutput =
    executionContext?.executedNodes?.map((n) => `• ${n.title}\n${n.output}`).join("\n\n") ||
    "No execution output yet.";

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      {/* ===== Full Screen Canvas ===== */}
      <FlowCanvas
        graph={graph}
        onNodeClick={setSelectedNodeId}
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
          {/* AI Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`gap-2 backdrop-blur ${
                  useAI
                    ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                    : "bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800"
                }`}
                onClick={() => setUseAI(!useAI)}
              >
                <Sparkles className="size-4" />
                {useAI ? "AI" : "Local"}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {useAI ? "Using AI for parsing & execution" : "Using local parsing only"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`size-9 backdrop-blur ${
                  isVoiceActive
                    ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
                    : "bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                }`}
                onClick={toggleVoice}
              >
                {isVoiceActive ? <Mic className="size-4" /> : <MicOff className="size-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Voice Edit</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 bg-zinc-900/80 text-zinc-400 backdrop-blur hover:bg-zinc-800 hover:text-zinc-100"
                onClick={parseWorkflow}
                disabled={isParsing}
              >
                {isParsing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCcw className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Regenerate Workflow</TooltipContent>
          </Tooltip>

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
                    onClick={() => handleExport("json")}
                    disabled={isExporting}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
                  >
                    <FileJson className="size-4 text-zinc-500" />
                    Download JSON
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
                    <button
                      key={node.id}
                      onClick={() => setSelectedNodeId(node.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-zinc-800 ${
                        selectedNodeId === node.id ? "bg-zinc-800" : ""
                      }`}
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
                    <div className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-xs text-zinc-300">
                      {selectedNode.output}
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
                  onClick={() => setVoiceModalOpen(true)}
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
              onClick={() => {
                setPrompt(editDraft);
                parseWorkflow(editDraft);
                setEditModalOpen(false);
              }}
              className="bg-white text-black hover:bg-zinc-200"
            >
              Save & regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Voice Modal placeholder */}
      <Dialog open={voiceModalOpen} onOpenChange={setVoiceModalOpen}>
        <DialogContent className="max-w-md border-zinc-800 bg-zinc-950 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Voice input</DialogTitle>
            <DialogDescription>Groq Whisper integration coming next.</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-zinc-400">
            We will capture audio, transcribe with whisper-large-v3-turbo, and send it to the parser.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setVoiceModalOpen(false)}>
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
              <div className="max-h-[420px] overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-200 whitespace-pre-wrap">
                {combinedOutput}
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
                      <div className="mt-2 rounded-md bg-zinc-950/80 p-2 text-xs text-zinc-200 whitespace-pre-wrap break-words">
                        {node.output}
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

      {/* ===== Loading Overlay ===== */}
      {(isExporting || isParsing) && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur">
          <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-6 py-4 shadow-2xl">
            <Loader2 className="size-5 animate-spin text-white" />
            <span className="text-sm text-zinc-200">
              {isParsing ? "Generating workflow..." : "Preparing export..."}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
