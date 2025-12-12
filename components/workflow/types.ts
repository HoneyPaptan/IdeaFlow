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
  // Execution output - populated after node runs
  output?: string;
  error?: string;
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
  nodeId?: string;
};

export type ParseResult = {
  graph: WorkflowGraph;
  trace: TraceLog[];
};

// Execution context passed between nodes
export type ExecutionContext = {
  originalIdea: string;
  executedNodes: {
    nodeId: string;
    title: string;
    output: string;
  }[];
  currentInput: string;
};

// API request/response types
export type ParseIdeaRequest = {
  idea: string;
};

export type ParseIdeaResponse = {
  success: boolean;
  graph?: WorkflowGraph;
  error?: string;
};

export type ExecuteNodeRequest = {
  node: WorkflowNode;
  context: ExecutionContext;
};

export type ExecuteNodeResponse = {
  success: boolean;
  output?: string;
  error?: string;
};
