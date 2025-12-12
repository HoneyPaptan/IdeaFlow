"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bug,
  Check,
  Download,
  FileJson,
  Link2,
  Loader2,
  Mail,
  Mic,
  Play,
  RefreshCcw,
  Share,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FlowCanvas } from "@/components/workflow/flow-canvas";
import { parseIdeaToWorkflow } from "@/components/workflow/parser";
import type { TraceLog, WorkflowGraph, WorkflowNodeStatus } from "@/components/workflow/types";

const fallbackIdea =
  "Listen to the user's idea, transcribe it, break it into tasks, detect dependencies, validate the sequence, and render a connected flow with execution notes and a debug console.";

const statusStyle: Record<WorkflowNodeStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-zinc-800 text-zinc-200" },
  running: {
    label: "Running",
    className: "bg-sky-500/20 text-sky-200 border border-sky-500/30",
  },
  done: {
    label: "Done",
    className: "bg-emerald-500/15 text-emerald-200 border border-emerald-500/40",
  },
  blocked: {
    label: "Blocked",
    className: "bg-rose-500/20 text-rose-100 border border-rose-500/40",
  },
};

const statusBadge = (status: WorkflowNodeStatus) => {
  const style = statusStyle[status];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${style.className}`}
    >
      <span className="size-2 rounded-full bg-current" />
      {style.label}
    </span>
  );
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function CanvasPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ideaFromUrl = searchParams.get("idea")?.trim();
  const idea = ideaFromUrl?.length ? ideaFromUrl : fallbackIdea;

  const initial = useMemo(() => parseIdeaToWorkflow(idea), [idea]);
  const [graph, setGraph] = useState<WorkflowGraph>(initial.graph);
  const [trace, setTrace] = useState<TraceLog[]>(initial.trace);
  const [isRunning, setIsRunning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const result = parseIdeaToWorkflow(idea);
    setGraph(result.graph);
    setTrace(result.trace);
  }, [idea]);

  const regenerate = () => {
    const result = parseIdeaToWorkflow(idea);
    setGraph(result.graph);
    setTrace((prev) => [...prev, ...result.trace]);
  };

  const resetStatuses = () => {
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) => ({ ...node, status: "pending" })),
    }));
  };

  const simulateRun = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setTrace((prev) => [
      ...prev,
      {
        id: `trace-run-${Date.now()}`,
        level: "info",
        message: "Starting dry-run execution across dependencies.",
        timestamp: Date.now(),
      },
    ]);

    for (const node of graph.nodes) {
      setGraph((prev) => ({
        ...prev,
        nodes: prev.nodes.map((item) =>
          item.id === node.id ? { ...item, status: "running" } : item,
        ),
      }));
      await sleep(320);
      setGraph((prev) => ({
        ...prev,
        nodes: prev.nodes.map((item) =>
          item.id === node.id ? { ...item, status: "done" } : item,
        ),
      }));
      setTrace((prev) => [
        ...prev,
        {
          id: `trace-node-${node.id}`,
          level: "info",
          message: `Executed "${node.title}"`,
          timestamp: Date.now(),
        },
      ]);
      await sleep(180);
    }

    setTrace((prev) => [
      ...prev,
      {
        id: `trace-finish-${Date.now()}`,
        level: "info",
        message: "Dry-run finished. Flow ready for export or live execution.",
        timestamp: Date.now(),
      },
    ]);
    setIsRunning(false);
  };

  const handleExport = async (destination: "email" | "notion") => {
    setIsExporting(true);
    await sleep(500);
    setTrace((prev) => [
      ...prev,
      {
        id: `trace-export-${destination}`,
        level: "info",
        message: `Prepared payload for ${destination}. Connect API to send.`,
        timestamp: Date.now(),
      },
    ]);
    setIsExporting(false);
  };

  const renderedTrace = trace.slice(-12);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black text-white">
      <div className="absolute inset-0">
        <FlowCanvas graph={graph} className="rounded-none border-none" height="100%" />
      </div>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-black/80" />

      <header className="pointer-events-none relative z-10 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3 pointer-events-auto">
          <Badge
            variant="outline"
            className="border-zinc-800 bg-zinc-950/70 px-3 py-1 text-xs uppercase tracking-[0.2em] text-zinc-300"
          >
            IdeaFlow
          </Badge>
          <span className="text-sm text-zinc-400 line-clamp-1 max-w-[480px]">
            {idea.slice(0, 120)}
          </span>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <Button
            variant="ghost"
            className="gap-2 text-zinc-300 hover:bg-zinc-900"
            onClick={() => router.push("/")}
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <Button
            variant="outline"
            className="gap-2 border-zinc-800 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
            onClick={regenerate}
          >
            <RefreshCcw className="size-4" />
            Re-structure
          </Button>
          <Button
            onClick={simulateRun}
            disabled={isRunning}
            className="gap-2 bg-white text-black hover:bg-zinc-200"
          >
            <Play className="size-4" />
            {isRunning ? "Running…" : "Dry-run"}
          </Button>
        </div>
      </header>

      <div className="pointer-events-none relative z-10 mx-auto flex max-w-6xl flex-col gap-4 px-6">
        <div className="pointer-events-auto grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-4 shadow-lg shadow-black/40">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-amber-300" />
              Validation
            </div>
            <p className="mt-2 text-sm text-zinc-400">
              {graph.nodes.length >= 4
                ? "Enough coverage across steps."
                : "Consider adding more detail for richer flow."}
            </p>
            <Separator className="my-3 border-zinc-800" />
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Link2 className="size-3.5 text-sky-300" />
              {graph.edges.length} connections detected
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-4 shadow-lg shadow-black/40">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Bug className="size-4 text-rose-300" />
              Debug
            </div>
            <p className="mt-2 text-sm text-zinc-400">
              {graph.warnings.length ? graph.warnings.join(" ") : "No blockers detected."}
            </p>
            <Separator className="my-3 border-zinc-800" />
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <BadgeCheck className="size-3.5 text-emerald-300" />
              Execution trace recording enabled
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-4 shadow-lg shadow-black/40">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Share className="size-4 text-emerald-300" />
              Hand-off
            </div>
            <p className="mt-2 text-sm text-zinc-400">
              Export ready for email or Notion. Connect your API keys to send.
            </p>
            <Separator className="my-3 border-zinc-800" />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-2 border-zinc-800 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                disabled={isExporting}
                onClick={() => handleExport("email")}
              >
                <Mail className="size-4" />
                Email
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-2 border-zinc-800 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                disabled={isExporting}
                onClick={() => handleExport("notion")}
              >
                <Download className="size-4" />
                Notion
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none relative z-10 mx-auto mt-4 flex max-w-6xl flex-wrap gap-3 px-6">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-full border border-zinc-800/80 bg-zinc-950/70 px-4 py-2 text-xs text-zinc-400">
          <Sparkles className="size-4 text-amber-300" />
          Voice edit ready
          <Badge variant="outline" className="border-zinc-800 bg-zinc-900 text-[10px] uppercase">
            soon
          </Badge>
          <Mic className="size-4 text-zinc-500" />
        </div>
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-full border border-zinc-800/80 bg-zinc-950/70 px-4 py-2 text-xs text-zinc-400">
          <FileJson className="size-4 text-sky-300" />
          Normalized JSON ready
        </div>
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-full border border-zinc-800/80 bg-zinc-950/70 px-4 py-2 text-xs text-zinc-400">
          <Check className="size-4 text-emerald-300" />
          Execution console wired for dry-run
        </div>
      </div>

      <div className="pointer-events-none relative z-10 mx-auto mt-5 flex max-w-6xl gap-4 px-6 pb-6">
        <div className="pointer-events-auto w-full rounded-xl border border-zinc-800/80 bg-zinc-950/85 p-4 shadow-lg shadow-black/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Bug className="size-4 text-rose-300" />
              Trace
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="gap-2 text-zinc-300 hover:bg-zinc-900"
              onClick={resetStatuses}
            >
              <RefreshCcw className="size-4" />
              Reset statuses
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {renderedTrace.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2"
              >
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
                    {item.level === "warn" ? (
                      <AlertTriangle className="size-3 text-amber-400" />
                    ) : (
                      <Sparkles className="size-3 text-emerald-300" />
                    )}
                    {item.level}
                  </div>
                  <p className="text-sm text-zinc-100">{item.message}</p>
                </div>
                <span className="text-xs text-zinc-500">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="pointer-events-auto hidden min-w-[260px] rounded-xl border border-zinc-800/80 bg-zinc-950/85 p-4 shadow-lg shadow-black/40 lg:block">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <ArrowRight className="size-4 text-sky-300" />
            Steps
          </div>
          <div className="mt-3 space-y-2 text-sm text-zinc-300">
            {graph.nodes.slice(0, 6).map((node) => (
              <div key={node.id} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zinc-100">{node.title}</span>
                  {statusBadge(node.status)}
                </div>
                <p className="mt-1 text-xs text-zinc-500 line-clamp-2">{node.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isExporting && (
        <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur">
          <div className="flex items-center gap-3 rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm text-zinc-200">
            <Loader2 className="size-4 animate-spin text-white" />
            Preparing export payload…
          </div>
        </div>
      )}
    </div>
  );
}

