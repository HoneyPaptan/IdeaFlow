import { NextResponse } from "next/server";
import { createCompletion } from "@/lib/ai";
import type {
  ParseIdeaRequest,
  ParseIdeaResponse,
  WorkflowGraph,
  WorkflowCategory,
} from "@/components/workflow/types";

const SYSTEM_PROMPT = `You are a workflow planning assistant. Your job is to take a user's idea and break it down into a structured workflow with nodes and connections.

For each workflow, you should:
1. Identify distinct steps/tasks
2. Categorize each step (collect, analyze, execute, notify, decision)
3. Determine dependencies between steps
4. Add relevant tags

Categories explained:
- collect: Gathering input, data collection, listening, recording
- analyze: Processing, validation, classification, scoring
- execute: Taking action, running processes, API calls, transformations
- notify: Sending messages, emails, alerts, notifications
- decision: Conditional branches, routing, choices

Respond ONLY with valid JSON in this exact format:
{
  "nodes": [
    {
      "id": "node-1",
      "title": "Short title (max 6 words)",
      "detail": "Detailed description of what this step does",
      "category": "collect|analyze|execute|notify|decision",
      "tags": ["relevant", "tags"]
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "node-1",
      "target": "node-2",
      "label": "next|branch|follow"
    }
  ],
  "summary": "Brief summary of the workflow"
}

Rules:
- Create at least 3 nodes, up to 10 for complex ideas
- Every node after the first should have an incoming edge
- Use "branch" label for decision outcomes, "follow" for sequential dependent steps, "next" for simple progression
- Tags should be lowercase, single words
- Node IDs should be "node-1", "node-2", etc.
- Edge IDs should be "edge-1", "edge-2", etc.`;

function validateGraph(data: unknown): data is { nodes: unknown[]; edges: unknown[]; summary: string } {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return Array.isArray(obj.nodes) && Array.isArray(obj.edges) && typeof obj.summary === "string";
}

function validateCategory(cat: string): WorkflowCategory {
  const valid: WorkflowCategory[] = ["collect", "analyze", "execute", "notify", "decision"];
  return valid.includes(cat as WorkflowCategory) ? (cat as WorkflowCategory) : "execute";
}

export async function POST(request: Request): Promise<NextResponse<ParseIdeaResponse>> {
  try {
    const body = (await request.json()) as ParseIdeaRequest;
    const { idea } = body;

    if (!idea || typeof idea !== "string" || idea.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Idea is required" },
        { status: 400 }
      );
    }

    const completion = await createCompletion(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Create a workflow for this idea:\n\n${idea}` },
      ],
      { model: "meta-llama/llama-4-maverick", temperature: 0.35, maxTokens: 1800 }
    );

    // Parse the JSON response
    let parsed: unknown;
    try {
      // Try to extract JSON from the response (handle markdown code blocks)
      const jsonMatch = completion.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, completion];
      const jsonStr = jsonMatch[1]?.trim() || completion.trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { success: false, error: "Failed to parse AI response as JSON" },
        { status: 500 }
      );
    }

    if (!validateGraph(parsed)) {
      return NextResponse.json(
        { success: false, error: "Invalid workflow structure from AI" },
        { status: 500 }
      );
    }

    // Build validated graph
    const graph: WorkflowGraph = {
      nodes: (parsed.nodes as Array<Record<string, unknown>>).map((node, idx) => ({
        id: String(node.id || `node-${idx + 1}`),
        title: String(node.title || "Untitled"),
        detail: String(node.detail || ""),
        category: validateCategory(String(node.category || "execute")),
        status: "pending" as const,
        tags: Array.isArray(node.tags) ? node.tags.map(String) : [],
      })),
      edges: (parsed.edges as Array<Record<string, unknown>>).map((edge, idx) => ({
        id: String(edge.id || `edge-${idx + 1}`),
        source: String(edge.source || ""),
        target: String(edge.target || ""),
        label: String(edge.label || "next"),
      })),
      summary: parsed.summary,
      warnings: [],
    };

    // Validate edges point to existing nodes
    const nodeIds = new Set(graph.nodes.map((n) => n.id));
    const invalidEdges = graph.edges.filter(
      (e) => !nodeIds.has(e.source) || !nodeIds.has(e.target)
    );
    if (invalidEdges.length > 0) {
      graph.warnings.push(`${invalidEdges.length} edge(s) reference missing nodes`);
    }

    // Check for orphan nodes (no incoming edges except first)
    const targetNodes = new Set(graph.edges.map((e) => e.target));
    const orphans = graph.nodes.slice(1).filter((n) => !targetNodes.has(n.id));
    if (orphans.length > 0) {
      graph.warnings.push(`${orphans.length} node(s) have no incoming connections`);
    }

    return NextResponse.json({ success: true, graph });
  } catch (error) {
    console.error("Parse workflow error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

