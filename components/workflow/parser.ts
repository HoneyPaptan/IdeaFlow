import type {
  ParseResult,
  TraceLog,
  WorkflowCategory,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
} from "./types";

const CATEGORY_KEYWORDS: Record<WorkflowCategory, string[]> = {
  collect: ["gather", "collect", "capture", "record", "listen", "transcribe"],
  analyze: ["analyze", "inspect", "validate", "classify", "score", "check"],
  execute: ["send", "trigger", "run", "execute", "sync", "call"],
  notify: ["notify", "email", "alert", "message", "post", "share", "notion"],
  decision: ["if", "when", "branch", "decide", "choose", "route"],
};

const TAG_KEYWORDS: Record<string, string[]> = {
  notion: ["notion"],
  email: ["email", "inbox"],
  voice: ["voice", "speech", "microphone"],
  timeline: ["timeline", "schedule", "deadline"],
  api: ["api", "endpoint", "webhook"],
  debug: ["debug", "error", "failure", "retry"],
};

const FALLBACK_IDEA =
  "Capture a user's idea, break it into ordered steps, validate dependencies, and surface a clear flow with execution notes.";

const toTitle = (text: string) => {
  const cleaned = text.replace(/[^\w\s-]/g, " ").trim();
  const words = cleaned.split(/\s+/).slice(0, 6).join(" ");
  if (!words) return "Untitled step";
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const inferCategory = (text: string): WorkflowCategory => {
  const lowered = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => lowered.includes(keyword))) {
      return category as WorkflowCategory;
    }
  }
  return "collect";
};

const inferTags = (text: string): string[] => {
  const lowered = text.toLowerCase();
  return Object.entries(TAG_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => lowered.includes(keyword)))
    .map(([tag]) => tag);
};

const buildWarnings = (nodes: WorkflowNode[], edges: WorkflowEdge[]): string[] => {
  const warnings: string[] = [];
  if (nodes.length < 3) {
    warnings.push("Add more detail so the flow has at least 3 distinct steps.");
  }
  const danglingTargets = edges.filter(
    (edge) => !nodes.some((node) => node.id === edge.target),
  );
  if (danglingTargets.length > 0) {
    warnings.push("Some edges point to missing nodes. Check detected dependencies.");
  }
  return warnings;
};

const tokenizeIdea = (idea: string) =>
  idea
    .replace(/\r/g, "\n")
    .split(/[\n\.!?;]/)
    .map((segment) => segment.trim())
    .filter(Boolean);

const createEdgeLabel = (sourceDetail: string, targetDetail: string) => {
  if (/if|when/.test(sourceDetail.toLowerCase())) return "branch";
  if (/then|after|once/.test(targetDetail.toLowerCase())) return "follow";
  return "next";
};

export const parseIdeaToWorkflow = (ideaInput: string): ParseResult => {
  const idea = ideaInput.trim() || FALLBACK_IDEA;
  const segments = tokenizeIdea(idea);

  const nodes: WorkflowNode[] = segments.map((segment, idx) => ({
    id: `node-${idx + 1}`,
    title: toTitle(segment),
    detail: segment,
    category: inferCategory(segment),
    status: "pending",
    tags: inferTags(segment),
  }));

  const edges: WorkflowEdge[] = nodes.slice(1).map((node, idx) => ({
    id: `edge-${idx + 1}`,
    source: nodes[idx].id,
    target: node.id,
    label: createEdgeLabel(nodes[idx].detail, node.detail),
  }));

  const trace: TraceLog[] = [
    {
      id: "trace-parse",
      level: "info",
      message: `Parsed ${nodes.length} steps with ${edges.length} connections.`,
      timestamp: Date.now(),
    },
    ...nodes.map((node) => ({
      id: `trace-${node.id}`,
      level: "info",
      message: `Step "${node.title}" tagged as ${node.category}.`,
      timestamp: Date.now(),
    })),
  ];

  const warnings = buildWarnings(nodes, edges);
  if (warnings.length) {
    warnings.forEach((warning, warningIndex) =>
      trace.push({
        id: `trace-warning-${warningIndex}`,
        level: "warn",
        message: warning,
        timestamp: Date.now(),
      }),
    );
  }

  const graph: WorkflowGraph = {
    nodes,
    edges,
    summary: `Detected ${nodes.length} steps`,
    warnings,
  };

  return { graph, trace };
};

