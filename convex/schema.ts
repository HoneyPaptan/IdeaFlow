import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  apiKeys: defineTable({
    sessionId: v.string(),
    groqKey: v.string(), // Encrypted
    openrouterKey: v.string(), // Encrypted
    createdAt: v.number(),
    lastAccessedAt: v.number(),
    expiresAt: v.number(), // Session expiration timestamp
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_expiresAt", ["expiresAt"]), // For cleanup queries
});

