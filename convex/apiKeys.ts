import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Session expiration time: 24 hours
const SESSION_EXPIRATION_MS = 24 * 60 * 60 * 1000;

/**
 * Save API keys for a session
 */
export const saveKeys = mutation({
  args: {
    sessionId: v.string(),
    groqKey: v.optional(v.string()),
    openrouterKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const expiresAt = now + SESSION_EXPIRATION_MS;

    // Check if keys already exist for this session
    const existing = await ctx.db
      .query("apiKeys")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (existing) {
      // Update existing keys
      const updateData: {
        lastAccessedAt: number;
        expiresAt: number;
        groqKey?: string;
        openrouterKey?: string;
      } = {
        lastAccessedAt: now,
        expiresAt,
      };

      // Only update keys that are provided
      if (args.groqKey !== undefined) {
        updateData.groqKey = args.groqKey;
      }
      if (args.openrouterKey !== undefined) {
        updateData.openrouterKey = args.openrouterKey;
      }

      await ctx.db.patch(existing._id, updateData);
      return { success: true };
    } else {
      // Create new entry
      await ctx.db.insert("apiKeys", {
        sessionId: args.sessionId,
        groqKey: args.groqKey || "",
        openrouterKey: args.openrouterKey || "",
        createdAt: now,
        lastAccessedAt: now,
        expiresAt,
      });
      return { success: true };
    }
  },
});

/**
 * Get API keys for a session (returns encrypted keys)
 * Note: Uses mutation because we need to update lastAccessedAt and delete expired sessions
 */
export const getKeys = mutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!keys) {
      return null;
    }

    // Check if session has expired
    if (keys.expiresAt < now) {
      // Delete expired session
      await ctx.db.delete(keys._id);
      return null;
    }

    // Update last accessed time
    await ctx.db.patch(keys._id, {
      lastAccessedAt: now,
    });

    return {
      groqKey: keys.groqKey || undefined,
      openrouterKey: keys.openrouterKey || undefined,
    };
  },
});

/**
 * Check if keys exist for a session (without returning the keys)
 */
export const hasKeys = mutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!keys) {
      return { hasKeys: false, hasGroq: false, hasOpenrouter: false };
    }

    // Check if session has expired
    if (keys.expiresAt < now) {
      await ctx.db.delete(keys._id);
      return { hasKeys: false, hasGroq: false, hasOpenrouter: false };
    }

    return {
      hasKeys: true,
      hasGroq: !!(keys.groqKey && keys.groqKey.trim() !== ""),
      hasOpenrouter: !!(keys.openrouterKey && keys.openrouterKey.trim() !== ""),
    };
  },
});

/**
 * Delete keys for a session
 */
export const deleteKeys = mutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (keys) {
      await ctx.db.delete(keys._id);
    }

    return { success: true };
  },
});

/**
 * Cleanup expired sessions (should be called periodically)
 */
export const cleanupExpiredSessions = mutation({
  handler: async (ctx) => {
    const now = Date.now();

    const expiredSessions = await ctx.db
      .query("apiKeys")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .collect();

    for (const session of expiredSessions) {
      await ctx.db.delete(session._id);
    }

    return { deleted: expiredSessions.length };
  },
});

