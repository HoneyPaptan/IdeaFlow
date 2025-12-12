import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import crypto from "crypto";

// Encryption key - should be in env, but user handles envs
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "default-encryption-key-change-in-production-32chars!!";
const ALGORITHM = "aes-256-cbc";

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

// Initialize Convex client for server-side use
const convexClient = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Save API keys to Convex database (encrypted)
 */
export async function saveApiKeys(
  sessionId: string,
  groqKey?: string,
  openrouterKey?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const encryptedGroq = groqKey && groqKey.trim() !== "" ? encrypt(groqKey.trim()) : undefined;
    const encryptedOpenrouter =
      openrouterKey && openrouterKey.trim() !== "" ? encrypt(openrouterKey.trim()) : undefined;

    await convexClient.mutation(api.apiKeys.saveKeys, {
      sessionId,
      groqKey: encryptedGroq,
      openrouterKey: encryptedOpenrouter,
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * Get API keys from Convex database (decrypted)
 */
export async function getApiKeys(sessionId: string): Promise<{
  groq?: string;
  openrouter?: string;
}> {
  try {
    const encryptedKeys = await convexClient.mutation(api.apiKeys.getKeys, { sessionId });

    if (!encryptedKeys) {
      return {};
    }

    const result: { groq?: string; openrouter?: string } = {};

    if (encryptedKeys.groqKey && encryptedKeys.groqKey.trim() !== "") {
      try {
        result.groq = decrypt(encryptedKeys.groqKey);
      } catch {
        // Invalid encryption, skip
      }
    }

    if (encryptedKeys.openrouterKey && encryptedKeys.openrouterKey.trim() !== "") {
      try {
        result.openrouter = decrypt(encryptedKeys.openrouterKey);
      } catch {
        // Invalid encryption, skip
      }
    }

    return result;
  } catch (error) {
    return {};
  }
}

/**
 * Check if keys exist (without returning them)
 */
export async function hasApiKeys(sessionId: string): Promise<{
  hasKeys: boolean;
  hasGroq: boolean;
  hasOpenrouter: boolean;
}> {
  try {
    const result = await convexClient.mutation(api.apiKeys.hasKeys, { sessionId });
    return result || { hasKeys: false, hasGroq: false, hasOpenrouter: false };
  } catch (error) {
    return { hasKeys: false, hasGroq: false, hasOpenrouter: false };
  }
}

/**
 * Delete API keys for a session
 */
export async function deleteApiKeys(sessionId: string): Promise<{ success: boolean }> {
  try {
    await convexClient.mutation(api.apiKeys.deleteKeys, { sessionId });
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

