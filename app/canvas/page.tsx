"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Box,
  Bug,
  Check,
  ChevronDown,
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
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Plus,
  RefreshCcw,
  Save,
  Settings,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FlowCanvas } from "@/components/workflow/flow-canvas";
import { parseIdeaToWorkflow } from "@/components/workflow/parser";
import type {
  TraceLog,
  WorkflowCategory,
  WorkflowGraph,
  WorkflowNodeStatus,
} from "@/components/workflow/types";

// ============================================================================
// Constants & Helpers
// ============================================================================

const fallbackIdea =
  "Listen to the user's idea, transcribe it, break it into tasks, detect dependencies, validate the sequence, and render a connected flow.";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

  // State
  const initial = useMemo(() => parseIdeaToWorkflow(idea), [idea]);
  const [graph, setGraph] = useState<WorkflowGraph>(initial.graph);
  const [trace, setTrace] = useState<TraceLog[]>(initial.trace);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);

  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [activeRightTab, setActiveRightTab] = useState<"console" | "nodes">("console");

  // Re-parse on idea change
  useEffect(() => {
    const result = parseIdeaToWorkflow(idea);
    setGraph(result.graph);
    setTrace(result.trace);
  }, [idea]);

  // ============================================================================
  // Actions
  // ============================================================================

  const regenerate = useCallback(() => {
    const result = parseIdeaToWorkflow(idea);
    setGraph(result.graph);
    setTrace((prev) => [
      ...prev,
      {
        id: `trace-regen-${Date.now()}`,
        level: "info",
        message: "Workflow regenerated from original idea.",
        timestamp: Date.now(),
      },
    ]);
  }, [idea]);

  const resetStatuses = useCallback(() => {
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) => ({ ...node, status: "pending" })),
    }));
    setTrace((prev) => [
      ...prev,
      {
        id: `trace-reset-${Date.now()}`,
        level: "info",
        message: "All node statuses reset to pending.",
        timestamp: Date.now(),
      },
    ]);
  }, []);

  const simulateRun = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setTrace((prev) => [
      ...prev,
      {
        id: `trace-run-${Date.now()}`,
        level: "info",
        message: "Starting dry-run execution...",
        timestamp: Date.now(),
      },
    ]);

    for (const node of graph.nodes) {
      setGraph((prev) => ({
        ...prev,
        nodes: prev.nodes.map((item) =>
          item.id === node.id ? { ...item, status: "running" } : item
        ),
      }));
      await sleep(400);
      setGraph((prev) => ({
        ...prev,
        nodes: prev.nodes.map((item) =>
          item.id === node.id ? { ...item, status: "done" } : item
        ),
      }));
      setTrace((prev) => [
        ...prev,
        {
          id: `trace-node-${node.id}-${Date.now()}`,
          level: "info",
          message: `✓ Executed: ${node.title}`,
          timestamp: Date.now(),
        },
      ]);
      await sleep(200);
    }

    setTrace((prev) => [
      ...prev,
      {
        id: `trace-finish-${Date.now()}`,
        level: "info",
        message: "Dry-run complete. All nodes executed successfully.",
        timestamp: Date.now(),
      },
    ]);
    setIsRunning(false);
  }, [graph.nodes, isRunning]);

  const handleExport = useCallback(async (destination: "email" | "notion" | "json") => {
    setIsExporting(true);
    await sleep(600);
    setTrace((prev) => [
      ...prev,
      {
        id: `trace-export-${destination}-${Date.now()}`,
        level: "info",
        message: `Export prepared for ${destination}. Connect API to send.`,
        timestamp: Date.now(),
      },
    ]);
    setIsExporting(false);
  }, []);

  const toggleVoice = useCallback(() => {
    setIsVoiceActive((prev) => {
      const newState = !prev;
      setTrace((t) => [
        ...t,
        {
          id: `trace-voice-${Date.now()}`,
          level: "info",
          message: newState
            ? "Voice input activated. Speak to modify your workflow."
            : "Voice input deactivated.",
          timestamp: Date.now(),
        },
      ]);
      return newState;
    });
  }, []);

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
    setTrace((prev) => [
      ...prev,
      {
        id: `trace-add-${newId}`,
        level: "info",
        message: `Added new ${category} node to canvas.`,
        timestamp: Date.now(),
      },
    ]);
  }, []);

  // ============================================================================
  // Render
  // ============================================================================

  const recentTrace = trace.slice(-20);
  const selectedNode = graph.nodes.find((n) => n.id === selectedNodeId);

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
              {idea.slice(0, 60)}
              {idea.length > 60 && "..."}
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
                onClick={regenerate}
              >
                <RefreshCcw className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Regenerate</TooltipContent>
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

          <Button
            onClick={simulateRun}
            disabled={isRunning}
            className="gap-2 bg-white text-black hover:bg-zinc-200"
          >
            {isRunning ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            {isRunning ? "Running..." : "Execute"}
          </Button>
        </div>
      </header>

      {/* ===== Left Panel - Tools ===== */}
      <aside
        className={`pointer-events-auto absolute bottom-4 left-4 top-20 z-20 flex transition-all duration-300 ${
          leftPanelOpen ? "w-64" : "w-12"
        }`}
      >
        {leftPanelOpen ? (
          <div className="flex size-full flex-col rounded-xl border border-zinc-800 bg-zinc-950/95 shadow-2xl shadow-black/50 backdrop-blur">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
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

            {/* Node Templates */}
            <div className="p-3">
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
            </div>

            <Separator className="bg-zinc-800" />

            {/* Quick Actions */}
            <div className="p-3">
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

            <Separator className="bg-zinc-800" />

            {/* Stats */}
            <div className="mt-auto border-t border-zinc-800 p-3">
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
          <div className="flex size-full flex-col rounded-xl border border-zinc-800 bg-zinc-950/95 shadow-2xl shadow-black/50 backdrop-blur">
            {/* Header with tabs */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-2 py-1">
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
            <ScrollArea className="flex-1">
              {activeRightTab === "console" ? (
                <div className="space-y-1 p-2">
                  {recentTrace.length === 0 ? (
                    <p className="px-2 py-8 text-center text-sm text-zinc-600">
                      No logs yet. Execute to see output.
                    </p>
                  ) : (
                    recentTrace.map((log) => (
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
                          <p className="text-xs text-zinc-300">{log.message}</p>
                          <p className="text-[10px] text-zinc-600">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))
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
                      <ChevronRight className="size-4 text-zinc-600" />
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Selected node details */}
            {selectedNode && activeRightTab === "nodes" && (
              <div className="border-t border-zinc-800 p-3">
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
            <Check className="size-3 text-emerald-400" />
            <span>Ready</span>
          </div>
          <Separator orientation="vertical" className="h-4 bg-zinc-800" />
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Keyboard className="size-3" />
            <span>Space to pan</span>
          </div>
          <Separator orientation="vertical" className="h-4 bg-zinc-800" />
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="text-zinc-400">{graph.nodes.length}</span>
            <span>nodes</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400">{graph.edges.length}</span>
            <span>edges</span>
          </div>
        </div>
      </footer>

      {/* ===== Loading Overlay ===== */}
      {isExporting && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur">
          <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-6 py-4 shadow-2xl">
            <Loader2 className="size-5 animate-spin text-white" />
            <span className="text-sm text-zinc-200">Preparing export...</span>
          </div>
        </div>
      )}
    </div>
  );
}
