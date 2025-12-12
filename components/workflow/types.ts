export type WorkflowNodeStatus = "pending" | "running" | "done" | "blocked";

export type WorkflowCategory =
  | "collect"
  | "analyze"
  | "execute"
  | "notify"
  | "decision";

export type WorkflowNode = {
  id: string;
  title: string;
  detail: string;
  category: WorkflowCategory;
  status: WorkflowNodeStatus;
  tags: string[];
};

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
};

export type WorkflowGraph = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  summary: string;
  warnings: string[];
};

export type TraceLog = {
  id: string;
  level: "info" | "warn" | "error";
  message: string;
  timestamp: number;
};

export type ParseResult = {
  graph: WorkflowGraph;
  trace: TraceLog[];
};

