import { NextResponse } from "next/server";
import { createCompletion } from "@/lib/ai";
import { getDecryptedKeys } from "@/app/api/settings/keys/route";

const VALIDATION_PROMPT = `You are an input validator. Your job is to determine if a user's input is a meaningful idea or project description, or if it's just gibberish, random text, or nonsense.

A valid idea should:
- Be at least 10 characters long
- Contain meaningful words (not just random characters)
- Describe a project, idea, goal, or task
- Make logical sense as a concept

Invalid inputs include:
- Random character strings (e.g., "asdfghjkl", "123456789")
- Single repeated words (e.g., "test test test test")
- Nonsensical text (e.g., "jibrish text here")
- Too short or empty

Respond with ONLY a JSON object in this exact format:
{
  "isValid": true or false,
  "reason": "brief explanation"
}`;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { idea } = body;

    if (!idea || typeof idea !== "string" || idea.trim().length === 0) {
      return NextResponse.json(
        { isValid: false, reason: "Input is empty" },
        { status: 400 }
      );
    }

    // Basic checks first
    const trimmed = idea.trim();
    if (trimmed.length < 10) {
      return NextResponse.json({
        isValid: false,
        reason: "Input is too short",
      });
    }

    // Check for meaningful words
    const words = trimmed.split(/\s+/).filter(w => w.length > 2);
    if (words.length < 2) {
      return NextResponse.json({
        isValid: false,
        reason: "Not enough meaningful words",
      });
    }

    // Check for excessive repetition
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    if (uniqueWords.size < 2 && words.length > 3) {
      return NextResponse.json({
        isValid: false,
        reason: "Too much repetition",
      });
    }

    // Use AI for semantic validation
    const sessionId = request.headers.get("x-session-id") || "default";
    const userKeys = await getDecryptedKeys(sessionId);
    
    const openrouterKey = (userKeys.openrouter && userKeys.openrouter.trim() !== "") 
      ? userKeys.openrouter.trim() 
      : undefined;

    const model = request.headers.get("x-openrouter-model") || "meta-llama/llama-3.3-70b-instruct";

    try {
      const completion = await createCompletion(
        [
          { role: "system", content: VALIDATION_PROMPT },
          { role: "user", content: `Validate this input: "${trimmed}"` },
        ],
        { model, temperature: 0.3, maxTokens: 200 },
        openrouterKey
      );

      // Parse AI response
      const jsonMatch = completion.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return NextResponse.json({
          isValid: parsed.isValid === true,
          reason: parsed.reason || "AI validation",
        });
      }
    } catch (error) {
      console.error("AI validation error:", error);
      // Fall back to basic validation
    }

    // Fallback: if it passed basic checks, allow it
    return NextResponse.json({
      isValid: true,
      reason: "Passed basic validation",
    });
  } catch (error) {
    console.error("Validate input error:", error);
    // Fail open - allow the input through
    return NextResponse.json({
      isValid: true,
      reason: "Validation service unavailable",
    });
  }
}

