import { NextResponse } from "next/server";
import { createCompletion } from "@/lib/ai";
import { parseIdeaToWorkflow } from "@/components/workflow/parser";
import { getDecryptedKeys } from "@/app/api/settings/keys/route";
import { checkRateLimit, isUsingCloudKeys } from "@/lib/rate-limit";
import type {
  ParseIdeaRequest,
  ParseIdeaResponse,
  WorkflowGraph,
  WorkflowCategory,
} from "@/components/workflow/types";

const SYSTEM_PROMPT = `You are a research workflow planning assistant. Your job is to take a user's idea and break it down into a structured research workflow that investigates different aspects of the idea.

IMPORTANT: This workflow is RESEARCH-BASED. Each node will use web research (Tavily API) to gather information. No nodes should require user input - they all research different aspects automatically.

For each workflow, you should:
1. Identify 3-6 distinct research aspects of the user's idea (e.g., market research, technical feasibility, best practices, tools/technologies, case studies, implementation strategies)
2. Each node will perform ONE targeted web search on its specific aspect
3. Use clear, simple language in titles (max 4-5 words)
4. Write brief descriptions that explain what aspect is being researched
5. All nodes should be category "analyze" (research/analysis)
6. Create a final summary node that synthesizes all research into actionable steps

Node Title Guidelines:
- Use research-focused verbs: "Research", "Explore", "Investigate", "Analyze", "Study"
- Be specific about the aspect: "Research Market Trends" not "Research"
- Examples: "Research Technical Feasibility", "Explore Best Practices", "Investigate Tools & Technologies"

Node Description Guidelines:
- One clear sentence explaining what aspect of the idea is being researched
- Should indicate what kind of information will be gathered
- Example: "Researches current market trends and demand for similar solutions" not "Gathers market data"

Search Query Guidelines (for each node):
- Each node needs a focused search query that will be used with Tavily API
- The query should be specific to that node's research aspect
- Should combine the user's idea with the specific research angle

Categories:
- analyze: All nodes should be "analyze" since they're all research-based

Respond ONLY with valid JSON in this exact format:
{
  "nodes": [
    {
      "id": "node-1",
      "title": "Research aspect title (3-5 words max)",
      "detail": "One clear sentence describing what aspect is being researched",
      "category": "analyze",
      "tags": ["research", "relevant-topic"],
      "searchQuery": "Specific search query for Tavily API related to this research aspect"
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "node-1",
      "target": "node-2",
      "label": "next"
    }
  ],
  "summary": "Brief summary of the research workflow"
}

Rules:
- Create 3-6 research nodes (one for each major aspect of the idea)
- All nodes should be category "analyze"
- Every node MUST include a "searchQuery" field with a specific search query
- Every node after the first should have an incoming edge
- Use "next" label for all edges (sequential research flow)
- Tags should be lowercase, single words
- Node IDs should be "node-1", "node-2", etc.
- Edge IDs should be "edge-1", "edge-2", etc.
- ALWAYS add a final node called "Research Summary" (id: "node-summary", category: "notify") that synthesizes all research into actionable steps. Connect it from all previous research nodes.`;

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

    // Check for user-provided API keys
    const sessionId = request.headers.get("x-session-id") || "default";
    const userKeys = await getDecryptedKeys(sessionId);
    
    // Use user-provided key if available and not empty, otherwise fall back to env
    const openrouterKey = (userKeys.openrouter && userKeys.openrouter.trim() !== "") 
      ? userKeys.openrouter.trim() 
      : undefined;

    // Check rate limit only if using cloud keys
    const usingCloudKeys = isUsingCloudKeys(!!openrouterKey);
    if (usingCloudKeys) {
      const rateLimit = checkRateLimit(sessionId, 2, 60 * 1000); // 2 requests per minute
      if (!rateLimit.allowed) {
        const resetIn = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
        return NextResponse.json(
          { 
            success: false, 
            error: "Rate limit exceeded",
            rateLimit: {
              remaining: rateLimit.remaining,
              resetIn,
            }
          },
          { 
            status: 429,
            headers: {
              "X-RateLimit-Limit": "2",
              "X-RateLimit-Remaining": String(rateLimit.remaining),
              "X-RateLimit-Reset": String(rateLimit.resetAt),
              "Retry-After": String(resetIn),
            }
          }
        );
      }
    }

    // Security: Don't log session IDs or key presence in production
    if (process.env.NODE_ENV === "development") {
      console.debug(`[parse] Has user OpenRouter key: ${!!openrouterKey}, Has env key: ${!!process.env.OPENROUTER_API_KEY}`);
    }

    const model = request.headers.get("x-openrouter-model") || "meta-llama/llama-3.3-70b-instruct";
    const completion = await createCompletion(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Create a workflow for this idea:\n\n${idea}` },
      ],
      { model, temperature: 0.35, maxTokens: 1800 },
      openrouterKey
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

    let graph: WorkflowGraph;
    let warnings: string[] = [];

    if (validateGraph(parsed)) {
      // Build validated graph
      graph = {
        nodes: (parsed.nodes as Array<Record<string, unknown>>).map((node, idx) => ({
          id: String(node.id || `node-${idx + 1}`),
          title: String(node.title || "Untitled"),
          detail: String(node.detail || ""),
          category: validateCategory(String(node.category || "analyze")),
          status: "pending" as const,
          tags: Array.isArray(node.tags) ? node.tags.map(String) : [],
          searchQuery: node.searchQuery ? String(node.searchQuery) : undefined,
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
    } else {
      // Fallback: use local parser to avoid 500s
      const local = parseIdeaToWorkflow(idea);
      graph = local.graph;
      warnings = [
        "AI response was invalid JSON. Used fallback local parser instead.",
        ...local.graph.warnings,
      ];
    }

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

    if (warnings.length) {
      graph.warnings.push(...warnings);
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

