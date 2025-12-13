import { NextResponse } from "next/server";
import { saveApiKeys, hasApiKeys, getApiKeys, deleteApiKeys } from "@/lib/convex-api-keys";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { groqKey, openrouterKey } = body;

    if ((!groqKey || groqKey.trim() === "") && (!openrouterKey || openrouterKey.trim() === "")) {
      return NextResponse.json({ success: false, error: "At least one API key is required" }, { status: 400 });
    }

    // Use a session identifier (in production, use actual user session)
    // Security: Validate session ID to prevent injection attacks
    const rawSessionId = request.headers.get("x-session-id") || "default";
    const sessionId = typeof rawSessionId === "string" && rawSessionId.length <= 200 
      ? rawSessionId 
      : "default";

    // Save keys to Convex database
    const result = await saveApiKeys(
      sessionId,
      groqKey?.trim() || undefined,
      openrouterKey?.trim() || undefined
    );

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || "Failed to save keys" }, { status: 500 });
    }

    // Security: Only log boolean flags, never actual keys or session IDs
    if (process.env.NODE_ENV === "development") {
      console.debug(`[POST /api/settings/keys] Keys saved successfully`);
    }

    return NextResponse.json({ success: true, message: "API keys saved successfully" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    // Security: Validate session ID to prevent injection attacks
    const rawSessionId = request.headers.get("x-session-id") || "default";
    const sessionId = typeof rawSessionId === "string" && rawSessionId.length <= 200 
      ? rawSessionId 
      : "default";
    
    // Get keys status from Convex database
    const result = await hasApiKeys(sessionId);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    // Security: Validate session ID to prevent injection attacks
    const rawSessionId = request.headers.get("x-session-id") || "default";
    const sessionId = typeof rawSessionId === "string" && rawSessionId.length <= 200 
      ? rawSessionId 
      : "default";
    
    // Delete keys from Convex database
    await deleteApiKeys(sessionId);

    return NextResponse.json({ success: true, message: "API keys deleted successfully" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// Helper function to get decrypted keys (for use in other API routes)
// Security: This function should only be called from server-side API routes, never exposed to client
export async function getDecryptedKeys(sessionId: string = "default"): Promise<{ groq?: string; openrouter?: string }> {
  // Security: Validate session ID format to prevent injection
  if (!sessionId || typeof sessionId !== "string" || sessionId.length > 200) {
    return {};
  }

  // Get keys from Convex database
  return await getApiKeys(sessionId);
}
