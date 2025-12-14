import { NextResponse } from "next/server";
import { createCompletion } from "@/lib/ai";
import { getDecryptedKeys } from "@/app/api/settings/keys/route";
import { searchTavily } from "@/lib/tavily";
import type {
  ExecuteNodeRequest,
  ExecuteNodeResponse,
  WorkflowCategory,
} from "@/components/workflow/types";

const CATEGORY_PROMPTS: Record<WorkflowCategory, string> = {
  collect: `You are executing a data collection step. 

CRITICAL: Write in clear, human-readable language. Avoid technical jargon and verbose explanations.

Your response should:
- Briefly describe what data is being collected (2-3 sentences max)
- Mention the key sources or methods in simple terms
- State what will be available after collection

Format: Write as a concise paragraph that a non-technical person can understand. Focus on the "what" and "why", not detailed technical implementation.`,

  analyze: `You are executing a research/analysis step that uses web research results.

CRITICAL: Write in clear, human-readable language. Avoid technical jargon and verbose explanations.

You will receive web research results from Tavily API. Your job is to:
- Synthesize the research findings into a clear, concise summary (2-3 paragraphs)
- Highlight the most relevant and useful information
- Focus on insights, trends, and actionable information
- Remove redundant or less relevant details
- Present findings in a way that helps understand this aspect of the project/idea

Format: Write as a clear, readable summary that synthesizes the research findings. Focus on what was learned, not technical details about the research process.`,

  execute: `You are executing an action step.

CRITICAL: Write in clear, human-readable language. Avoid technical jargon and verbose explanations.

Your response should:
- Briefly describe what action was taken (1-2 sentences)
- Explain the outcome or result in simple terms
- State what was produced or changed

Format: Write as a concise paragraph. Focus on what happened and what was achieved, not technical implementation details.`,

  notify: `You are executing a summary/notification step.

CRITICAL: If this is a "Research Summary" or "Workflow Summary" node, you MUST create a concise, actionable summary that:
- Synthesizes all research findings from previous nodes into 3-5 clear paragraphs
- Highlights the most important insights and discoveries
- Provides actionable steps and recommendations the user can take
- Uses simple, non-technical language
- Focuses on practical next steps based on the research
- Removes redundant information and technical details

Format: Write as a clear, readable summary with actionable recommendations that anyone can understand and act upon.`,

  decision: `You are executing a decision/branching step.

CRITICAL: Write in clear, human-readable language. Avoid technical jargon and verbose explanations.

Your response should:
- State the decision that was made (1 sentence)
- Briefly explain the reasoning in simple terms (1-2 sentences)
- Indicate which path will be taken

Format: Write as a concise paragraph. Focus on the decision and why, not technical evaluation details.`,
};

export async function POST(request: Request): Promise<NextResponse<ExecuteNodeResponse>> {
  try {
    const body = (await request.json()) as ExecuteNodeRequest;
    const { node, context } = body;

    if (!node || !context) {
      return NextResponse.json(
        { success: false, error: "Node and context are required" },
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

    // Special handling for Workflow Summary node
    const isSummaryNode = node.title.toLowerCase().includes("summary") || node.id === "node-summary";
    
    let researchResults: string = "";
    
    // If node has a searchQuery, perform Tavily research first
    if (node.searchQuery && !isSummaryNode) {
      try {
        const tavilyKey = process.env.TAVILY_API_KEY; // User will add this later
        if (tavilyKey) {
          const tavilyResponse = await searchTavily(
            {
              query: node.searchQuery,
              searchDepth: "basic",
              maxResults: 5,
              includeAnswer: true,
            },
            tavilyKey
          );
          
          // Format research results for AI synthesis
          const resultsText = tavilyResponse.results
            .map((r, idx) => `${idx + 1}. ${r.title}\n   ${r.content.substring(0, 300)}...`)
            .join("\n\n");
          
          researchResults = `Research Query: ${node.searchQuery}\n\nResearch Results:\n${resultsText}\n\n${tavilyResponse.answer ? `AI-Generated Answer:\n${tavilyResponse.answer}\n\n` : ""}`;
        } else {
          researchResults = `Research Query: ${node.searchQuery}\n\nNote: Tavily API key not configured. Research will be simulated based on the query.`;
        }
      } catch (error) {
        console.error("Tavily search error:", error);
        researchResults = `Research Query: ${node.searchQuery}\n\nNote: Research search failed. Proceeding with analysis based on the query topic.`;
      }
    }

    // Build context summary for the AI - more structured and concise
    const previousSteps = context.executedNodes
      .map((n, i) => `${i + 1}. ${n.title}: ${n.output}`)
      .join("\n");

    const systemPrompt = CATEGORY_PROMPTS[node.category];
    
    let userPrompt: string;
    
    if (isSummaryNode) {
      // For summary node, synthesize all research into actionable steps
      userPrompt = `Original Goal: ${context.originalIdea}

Research Completed:
${previousSteps || "No research completed."}

Based on all the research above, create a concise, actionable summary (3-5 paragraphs) that:
- Synthesizes all research findings into a clear narrative
- Highlights the most important insights and discoveries
- Provides actionable steps the user can take based on the research
- Uses simple, non-technical language
- Focuses on practical next steps and recommendations

Format as a clear, readable summary with actionable recommendations.`;
    } else if (researchResults) {
      // For research nodes with Tavily results
      userPrompt = `Original Goal: ${context.originalIdea}

Current Research Aspect: ${node.title}
${node.detail ? `Description: ${node.detail}` : ""}

${researchResults}

Synthesize the research findings above into a clear, concise summary (2-3 paragraphs) that:
- Highlights the most relevant and useful information
- Focuses on insights, trends, and actionable information
- Removes redundant or less relevant details
- Presents findings in a way that helps understand this aspect of the project/idea

Write as a clear, readable summary that synthesizes the research findings.`;
    } else {
      // Fallback for nodes without research (shouldn't happen in new workflow)
      userPrompt = `Original Goal: ${context.originalIdea}

Current Step: ${node.title}
${node.detail ? `Description: ${node.detail}` : ""}
Category: ${node.category}

${previousSteps ? `Previous Steps Completed:\n${previousSteps}\n\n` : ""}${context.currentInput ? `Current Input:\n${context.currentInput}\n\n` : ""}

Execute this step. Provide a clear, concise output (2-4 sentences) in plain language that anyone can understand.`;
    }

    const model = request.headers.get("x-openrouter-model") || "meta-llama/llama-3.3-70b-instruct";
    
    // Adjust temperature and maxTokens based on node type
    const temperature = isSummaryNode ? 0.5 : 0.6;
    const maxTokens = isSummaryNode ? 1500 : 800; // More tokens for research synthesis
    
    const completion = await createCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { model, temperature, maxTokens },
      openrouterKey
    );

    return NextResponse.json({
      success: true,
      output: completion.trim(),
    });
  } catch (error) {
    console.error("Execute node error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

