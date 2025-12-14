// Simple in-memory rate limiter for cloud API keys
// Tracks requests per session ID

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

// In-memory store (persists across requests in serverless functions)
// Note: In serverless environments, this will reset on cold starts
// For production, consider using Redis or a persistent store
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries periodically (only in Node.js environment)
if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  };
  
  // Run cleanup every 5 minutes (only in development)
  if (typeof setInterval !== "undefined") {
    setInterval(cleanup, 5 * 60 * 1000);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check if a request is within rate limit
 * @param sessionId - Session identifier
 * @param limit - Maximum requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns Rate limit result
 */
export function checkRateLimit(
  sessionId: string,
  limit: number = 2,
  windowMs: number = 60 * 1000 // 1 minute
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(sessionId);

  // If no entry or window expired, create new entry
  if (!entry || entry.resetAt < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(sessionId, newEntry);
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: newEntry.resetAt,
    };
  }

  // Check if limit exceeded
  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  // Increment count
  entry.count += 1;
  rateLimitStore.set(sessionId, entry);

  return {
    allowed: true,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Check if user is using cloud keys (no user-provided keys)
 */
export function isUsingCloudKeys(hasUserKeys: boolean): boolean {
  return !hasUserKeys;
}

