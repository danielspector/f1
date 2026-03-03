/**
 * In-memory sliding-window rate limiter.
 *
 * For a single-instance deployment (e.g. Vercel serverless) this provides
 * per-invocation protection. For persistent rate limiting across cold starts,
 * swap the Map with a Redis-backed store (e.g. @upstash/ratelimit).
 */

interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

// Clean up stale entries periodically to prevent memory leaks
const CLEANUP_INTERVAL = 60_000 // 1 minute
let lastCleanup = Date.now()

function cleanup(windowMs: number) {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now

  const cutoff = now - windowMs
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff)
    if (entry.timestamps.length === 0) {
      store.delete(key)
    }
  }
}

/**
 * Check if a request should be rate limited.
 *
 * @param key    Unique identifier (e.g. IP address, user ID)
 * @param limit  Max number of requests allowed in the window
 * @param windowMs  Time window in milliseconds
 * @returns { limited, remaining, retryAfterMs }
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { limited: boolean; remaining: number; retryAfterMs: number } {
  cleanup(windowMs)

  const now = Date.now()
  const cutoff = now - windowMs

  let entry = store.get(key)
  if (!entry) {
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff)

  if (entry.timestamps.length >= limit) {
    const oldestInWindow = entry.timestamps[0]
    const retryAfterMs = oldestInWindow + windowMs - now
    return {
      limited: true,
      remaining: 0,
      retryAfterMs: Math.max(retryAfterMs, 0),
    }
  }

  entry.timestamps.push(now)
  return {
    limited: false,
    remaining: limit - entry.timestamps.length,
    retryAfterMs: 0,
  }
}

/**
 * Extract client IP from request headers (works behind reverse proxies).
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return request.headers.get('x-real-ip') || '127.0.0.1'
}
