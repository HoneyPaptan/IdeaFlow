"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Bug,
  Check,
  Clock3,
  FileJson,
  Link2,
  Mic,
  Play,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FlowCanvas } from "./flow-canvas";
import { parseIdeaToWorkflow } from "./parser";
import type { TraceLog, WorkflowGraph, WorkflowNode, WorkflowNodeStatus } from "./types";

const sampleIdea = `Listen to the user's idea and transcribe it. Break the idea into discrete tasks. Detect dependencies between tasks and order them. Validate the sequence so there are no orphan steps. Render the flow with connections and show an execution console. If something fails, surface a node-level error and suggest a fix. Offer export to Notion or email.`;

const statusStyle: Record<WorkflowNodeStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-zinc-800 text-zinc-200" },
  running: { label: "Running", className: "bg-sky-500/20 text-sky-200 border border-sky-500/30" },
  done: { label: "Done", className: "bg-emerald-500/15 text-emerald-200 border border-emerald-500/40" },
  blocked: { label: "Blocked", className: "bg-rose-500/20 text-rose-100 border border-rose-500/40" },
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const formatTime = (timestamp: number) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);

const statusBadge = (status: WorkflowNodeStatus) => {
  const style = statusStyle[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
        style.className,
      )}
    >
      <span className="size-2 rounded-full bg-current" />
      {style.label}
    </span>
  );
};

export default function WorkflowPage() {
  const initial = useMemo(() => parseIdeaToWorkflow(sampleIdea), []);
  const [idea, setIdea] = useState(sampleIdea);
  const [graph, setGraph] = useState<WorkflowGraph>(initial.graph);
  const [trace, setTrace] = useState<TraceLog[]>(initial.trace);
  const [isRunning, setIsRunning] = useState(false);

  const regenerate = () => {
    const result = parseIdeaToWorkflow(idea);
    setGraph(result.graph);
    setTrace((prev) => {
      const combined = [...prev, ...result.trace];
      return combined.slice(-100); // Keep last 100 entries
    });
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
        message: "Starting dry-run execution over detected dependencies.",
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
      setTrace((prev) => [
        ...prev,
        {
          id: `trace-start-${node.id}`,
          level: "info",
          message: `Executing "${node.title}"`,
          timestamp: Date.now(),
        },
      ]);
      await sleep(320);
      setGraph((prev) => ({
        ...prev,
        nodes: prev.nodes.map((item) =>
          item.id === node.id ? { ...item, status: "done" } : item,
        ),
      }));
      await sleep(200);
    }

    setTrace((prev) => [
      ...prev,
      {
        id: `trace-run-finish-${Date.now()}`,
        level: "info",
        message: "Dry-run finished. Flow is execution-ready.",
        timestamp: Date.now(),
      },
    ]);
    setIsRunning(false);
  };

  const renderedTrace = trace.slice(-8);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 text-zinc-50">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-zinc-400">
          <Badge variant="outline" className="border-zinc-700 bg-zinc-900/60 text-zinc-200">
            Agentic workflow engine
          </Badge>
          <span className="flex items-center gap-2 text-zinc-500">
            <Sparkles className="size-4 text-amber-400" />
            Conversational · Visual · Executable
          </span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Turn plain ideas into connected, executable flows.
            </h1>
            <p className="max-w-3xl text-lg text-zinc-400">
              Paste or speak an idea. We segment it, validate dependencies, and render a
              Vercel-dark flow you can run, debug, and export.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={regenerate} className="gap-2 bg-white text-black hover:bg-zinc-200">
                <Wand2 className="size-4" />
                Generate flow
              </Button>
              <Button
                variant="outline"
                className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                onClick={() => {
                  setIdea(sampleIdea);
                  regenerate();
                }}
              >
                <RefreshCcw className="mr-2 size-4" />
                Use sample
              </Button>
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <ShieldCheck className="size-4 text-emerald-400" />
                Debug trace is captured at every step.
              </div>
            </div>
          </div>
          <div className="hidden rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-black p-4 sm:flex sm:flex-col sm:items-start sm:gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Ready to ship
            </span>
            <div className="flex items-center gap-2 text-emerald-300">
              <Check className="size-4" />
              Vercel dark theme
            </div>
            <div className="flex items-center gap-2 text-emerald-300">
              <Check className="size-4" />
              Shadcn UI
            </div>
            <div className="flex items-center gap-2 text-emerald-300">
              <Check className="size-4" />
              Execution trace
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-950/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-white">
              <Mic className="size-4 text-amber-400" />
              Idea capture
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Text or voice prompt that will be translated into nodes and dependencies.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              rows={8}
              className="w-full border-zinc-800 bg-zinc-950 text-zinc-50 focus-visible:ring-zinc-500"
              placeholder="Describe what you want to build. We handle the structure."
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={regenerate}
                className="gap-2 bg-white text-black hover:bg-zinc-200"
              >
                <ArrowRight className="size-4" />
                Structure this idea
              </Button>
              <Button
                onClick={simulateRun}
                variant="outline"
                disabled={isRunning}
                className="gap-2 border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
              >
                <Play className="size-4" />
                {isRunning ? "Running..." : "Dry-run flow"}
              </Button>
              <Button
                onClick={resetStatuses}
                variant="ghost"
                className="gap-2 text-zinc-400 hover:bg-zinc-900"
              >
                <RefreshCcw className="size-4" />
                Reset statuses
              </Button>
              <div className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
                <BadgeCheck className="size-4 text-emerald-400" />
                Auto-validation on parse
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
              <Badge variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-200">
                Voice-ready
              </Badge>
              <Badge variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-200">
                Dependency graph
              </Badge>
              <Badge variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-200">
                Debug trace
              </Badge>
              <Badge variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-200">
                Export friendly
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-gradient-to-b from-zinc-950 to-black">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-white">
              <Link2 className="size-4 text-sky-300" />
              Visual workflow (React Flow)
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Nodes and connections are laid out automatically in a Vercel-dark canvas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FlowCanvas graph={graph} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-zinc-800 bg-zinc-950/70 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-white">
              <Sparkles className="size-4 text-amber-400" />
              Structured steps
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Parsed actions, categories, and statuses with embedded debug notes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-2">
              {graph.nodes.map((node) => (
                <div
                  key={node.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 shadow-inner"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-white">{node.title}</span>
                        <Badge variant="outline" className="border-zinc-700 text-xs uppercase">
                          {node.category}
                        </Badge>
                        {node.tags.slice(0, 3).map((tag) => (
                          <Badge
                            key={`${node.id}-${tag}`}
                            variant="outline"
                            className="border-zinc-800 bg-zinc-900 text-[10px] uppercase tracking-wide"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <p className="mt-1 text-sm text-zinc-400">{node.detail}</p>
                    </div>
                    {statusBadge(node.status)}
                  </div>
                </div>
              ))}
            </div>
            <Separator className="border-zinc-800" />
            <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
              <Clock3 className="size-4" />
              {graph.summary}
              <span className="text-zinc-600">•</span>
              <span>{graph.edges.length} detected connections</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-950/70">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-white">
              <Bug className="size-4 text-rose-300" />
              Debug & telemetry
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Every parse and run is logged with time stamps.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {renderedTrace.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between rounded-md border border-zinc-800 bg-zinc-950/70 p-3"
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
                  <span className="text-xs text-zinc-500">{formatTime(item.timestamp)}</span>
                </div>
              ))}
            </div>
            <Separator className="border-zinc-800" />
            <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3 text-xs text-zinc-400">
              <div className="mb-2 flex items-center gap-2 font-medium text-zinc-200">
                <FileJson className="size-4 text-sky-300" />
                JSON preview
              </div>
              <pre className="max-h-48 overflow-y-auto text-[11px] leading-relaxed text-zinc-300">
                {JSON.stringify(
                  {
                    nodes: graph.nodes.map((node) => ({
                      id: node.id,
                      title: node.title,
                      category: node.category,
                      status: node.status,
                    })),
                    edges: graph.edges,
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-800 bg-zinc-950/70">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-white">
            <AlertTriangle className="size-4 text-amber-300" />
            Validation & readiness
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Quick sanity checks before handing the flow to execution or export.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Sparkles className="size-4 text-emerald-300" />
              Coverage
            </div>
            <p className="mt-2 text-sm text-zinc-400">
              {graph.nodes.length >= 4
                ? "Enough granularity detected."
                : "Consider adding more specific steps."}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Link2 className="size-4 text-sky-300" />
              Dependencies
            </div>
            <p className="mt-2 text-sm text-zinc-400">
              {graph.edges.length ? "Edges look consistent." : "We need at least one connection."}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Bug className="size-4 text-rose-300" />
              Potential issues
            </div>
            <p className="mt-2 text-sm text-zinc-400">
              {graph.warnings.length
                ? graph.warnings.join(" ")
                : "No blockers found. Safe to hand off to execution."}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

