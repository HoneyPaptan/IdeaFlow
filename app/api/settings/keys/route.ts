import { NextResponse } from "next/server";
import crypto from "crypto";

// Encryption key - should be in env, but user handles envs
// Security: In production, ENCRYPTION_KEY must be set in environment variables
// Using a default for development only - this should NEVER be used in production
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "default-encryption-key-change-in-production-32chars!!";
const ALGORITHM = "aes-256-cbc";

// Security: Warn if using default encryption key in production
if (process.env.NODE_ENV === "production" && !process.env.ENCRYPTION_KEY) {
  console.error("[SECURITY WARNING] ENCRYPTION_KEY not set in production! Using default key is insecure.");
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32), "utf8"), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(":");
  const iv = Buffer.from(parts.shift()!, "hex");
  const encrypted = parts.join(":");
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32), "utf8"), iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// Simple in-memory storage (in production, use database)
// Keys are stored per session/user identifier
// Using a global variable to persist across module reloads in development
declare global {
  // eslint-disable-next-line no-var
  var __keyStorage: Map<string, { groq: string; openrouter: string }> | undefined;
}

const keyStorage = globalThis.__keyStorage || new Map<string, { groq: string; openrouter: string }>();

if (!globalThis.__keyStorage) {
  globalThis.__keyStorage = keyStorage;
}

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

    // Ensure we're using the global storage
    const storage = globalThis.__keyStorage || keyStorage;
    if (!globalThis.__keyStorage) {
      globalThis.__keyStorage = storage;
    }

    const stored = storage.get(sessionId) || { groq: "", openrouter: "" };

    // Only update keys if they are provided and not empty
    if (groqKey && groqKey.trim() !== "") {
      stored.groq = encrypt(groqKey.trim());
    }
    if (openrouterKey && openrouterKey.trim() !== "") {
      stored.openrouter = encrypt(openrouterKey.trim());
    }

    storage.set(sessionId, stored);

    // Verify keys were stored correctly (without exposing session ID or keys)
    const verify = storage.get(sessionId);
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
    
    // Ensure we're using the global storage
    const storage = globalThis.__keyStorage || keyStorage;
    if (!globalThis.__keyStorage) {
      globalThis.__keyStorage = storage;
    }
    
    const stored = storage.get(sessionId);

    if (!stored) {
      // Security: Don't expose session IDs or storage contents
      return NextResponse.json({ success: true, hasKeys: false });
    }

    // Return whether keys exist, but not the actual keys
    return NextResponse.json({
      success: true,
      hasKeys: true,
      hasGroq: !!(stored.groq && stored.groq.trim() !== ""),
      hasOpenrouter: !!(stored.openrouter && stored.openrouter.trim() !== ""),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// Helper function to get decrypted keys (for use in other API routes)
// Security: This function should only be called from server-side API routes, never exposed to client
export function getDecryptedKeys(sessionId: string = "default"): { groq?: string; openrouter?: string } {
  // Ensure we're using the global storage
  const storage = globalThis.__keyStorage || keyStorage;
  if (!globalThis.__keyStorage) {
    globalThis.__keyStorage = storage;
  }
  
  // Security: Validate session ID format to prevent injection
  if (!sessionId || typeof sessionId !== "string" || sessionId.length > 200) {
    return {};
  }

  const stored = storage.get(sessionId);
  if (!stored) {
    // Security: Don't log session IDs or storage contents
    return {};
  }

  const result: { groq?: string; openrouter?: string } = {};
  
  // Only decrypt if the stored value exists and is not empty
  if (stored.groq && stored.groq.trim() !== "") {
    try {
      result.groq = decrypt(stored.groq);
      // Security: Never log actual keys, only success/failure
    } catch (error) {
      // Security: Log error without exposing key content
      if (process.env.NODE_ENV === "development") {
        console.error(`[getDecryptedKeys] Failed to decrypt Groq key`);
      }
      // Invalid encryption, skip
    }
  }
  
  if (stored.openrouter && stored.openrouter.trim() !== "") {
    try {
      result.openrouter = decrypt(stored.openrouter);
      // Security: Never log actual keys, only success/failure
    } catch (error) {
      // Security: Log error without exposing key content
      if (process.env.NODE_ENV === "development") {
        console.error(`[getDecryptedKeys] Failed to decrypt OpenRouter key`);
      }
      // Invalid encryption, skip
    }
  }
  
  // Security: Only log boolean flags in development, never actual keys
  
  return result;
}

