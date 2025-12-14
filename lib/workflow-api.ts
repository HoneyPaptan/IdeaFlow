import type {
  ExecutionContext,
  ParseIdeaResponse,
  ExecuteNodeResponse,
  WorkflowNode,
  WorkflowGraph,
} from "@/components/workflow/types";

// Get or create session ID
function getSessionId(): string {
  if (typeof window === "undefined") return "default";
  let sessionId = sessionStorage.getItem("session-id");
  if (!sessionId) {
    sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem("session-id", sessionId);
  }
  return sessionId;
}

/**
 * Parse an idea into a workflow graph using AI
 */
export async function parseIdea(idea: string): Promise<ParseIdeaResponse> {
  const model = typeof window !== "undefined" ? localStorage.getItem("openrouter-model") || "meta-llama/llama-3.3-70b-instruct" : "meta-llama/llama-3.3-70b-instruct";
  const response = await fetch("/api/workflow/parse", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-session-id": getSessionId(),
      "x-openrouter-model": model,
    },
    body: JSON.stringify({ idea }),
  });

  if (!response.ok) {
    // Handle rate limit errors specifically
    if (response.status === 429) {
      try {
        const errorData = await response.json();
        return { 
          success: false, 
          error: "Rate limit exceeded",
          rateLimit: errorData.rateLimit,
        };
      } catch {
        return { success: false, error: "Rate limit exceeded" };
      }
    }
    const error = await response.text();
    return { success: false, error: `API error: ${response.status} - ${error}` };
  }

  return response.json();
}

/**
 * Execute a single node with context
 */
export async function executeNode(
  node: WorkflowNode,
  context: ExecutionContext
): Promise<ExecuteNodeResponse> {
  const model = typeof window !== "undefined" ? localStorage.getItem("openrouter-model") || "meta-llama/llama-3.3-70b-instruct" : "meta-llama/llama-3.3-70b-instruct";
  const response = await fetch("/api/workflow/execute", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-session-id": getSessionId(),
      "x-openrouter-model": model,
    },
    body: JSON.stringify({ node, context }),
  });

  if (!response.ok) {
    // Handle rate limit errors specifically
    if (response.status === 429) {
      try {
        const errorData = await response.json();
        return { 
          success: false, 
          error: "Rate limit exceeded",
          rateLimit: errorData.rateLimit,
        };
      } catch {
        return { success: false, error: "Rate limit exceeded" };
      }
    }
    const error = await response.text();
    return { success: false, error: `API error: ${response.status} - ${error}` };
  }

  return response.json();
}

/**
 * Get topologically sorted nodes (respecting dependencies)
 */
export function getExecutionOrder(graph: WorkflowGraph): WorkflowNode[] {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // Initialize
  for (const node of graph.nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  // Build graph
  for (const edge of graph.edges) {
    const targets = adjacency.get(edge.source) || [];
    targets.push(edge.target);
    adjacency.set(edge.source, targets);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  // Kahn's algorithm for topological sort
  const queue: string[] = [];
  const result: WorkflowNode[] = [];

  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const node = nodeMap.get(current);
    if (node) {
      result.push(node);
    }

    for (const neighbor of adjacency.get(current) || []) {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // If not all nodes were added (cycle detected), add remaining
  if (result.length < graph.nodes.length) {
    for (const node of graph.nodes) {
      if (!result.some((n) => n.id === node.id)) {
        result.push(node);
      }
    }
  }

  return result;
}

/**
 * Build initial execution context
 */
export function createInitialContext(idea: string): ExecutionContext {
  return {
    originalIdea: idea,
    executedNodes: [],
    currentInput: idea,
  };
}

/**
 * Update context after node execution
 */
export function updateContext(
  context: ExecutionContext,
  node: WorkflowNode,
  output: string
): ExecutionContext {
  return {
    ...context,
    executedNodes: [
      ...context.executedNodes,
      { nodeId: node.id, title: node.title, output },
    ],
    currentInput: output,
  };
}

