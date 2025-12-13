import { NextResponse } from "next/server";
import { createCompletion } from "@/lib/ai";
import { getDecryptedKeys } from "@/app/api/settings/keys/route";
import type {
  ExecuteNodeRequest,
  ExecuteNodeResponse,
  WorkflowCategory,
} from "@/components/workflow/types";

const CATEGORY_PROMPTS: Record<WorkflowCategory, string> = {
  collect: `You are executing a data collection step. Your job is to:
- Identify what data needs to be collected
- Describe how it would be collected
- Summarize the expected inputs
Respond with a clear, actionable summary of the collection process.`,

  analyze: `You are executing an analysis step. Your job is to:
- Process the input data or context provided
- Identify patterns, validate, or classify information
- Provide insights or analysis results
Respond with the analysis results and any important findings.`,

  execute: `You are executing an action step. Your job is to:
- Describe the action being taken
- Process any transformations needed
- Explain the expected outcome
Respond with a summary of the execution and its results.`,

  notify: `You are executing a notification step. Your job is to:
- Compose the notification content based on context
- Identify recipients or channels
- Format the message appropriately
Respond with the notification content that would be sent.`,

  decision: `You are executing a decision/branching step. Your job is to:
- Evaluate the conditions based on context
- Determine which path should be taken
- Explain the reasoning
Respond with the decision made and the reasoning behind it.`,
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

    // Build context summary for the AI
    const previousSteps = context.executedNodes
      .map((n, i) => `Step ${i + 1} (${n.title}):\n${n.output}`)
      .join("\n\n");

    const systemPrompt = CATEGORY_PROMPTS[node.category];
    
    const userPrompt = `Original Idea: ${context.originalIdea}

Current Step: ${node.title}
Description: ${node.detail}
Category: ${node.category}
Tags: ${node.tags.join(", ") || "none"}

${previousSteps ? `Previous Steps Output:\n${previousSteps}\n\n` : ""}${context.currentInput ? `Current Input:\n${context.currentInput}\n\n` : ""}

Execute this step and provide the output. Be concise but thorough.`;

    // Check for user-provided API keys
    const sessionId = request.headers.get("x-session-id") || "default";
    const userKeys = await getDecryptedKeys(sessionId);
    
    // Use user-provided key if available and not empty, otherwise fall back to env
    const openrouterKey = (userKeys.openrouter && userKeys.openrouter.trim() !== "") 
      ? userKeys.openrouter.trim() 
      : undefined;

    const completion = await createCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { model: "meta-llama/llama-4-maverick", temperature: 0.6, maxTokens: 900 },
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

