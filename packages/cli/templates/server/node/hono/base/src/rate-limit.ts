import type { MiddlewareHandler } from "hono";
import { env } from "./env.js";

/**
 * In-memory fixed-window rate limiter for /api routes, keyed by client IP.
 *
 * Deliberately dependency-free: hono has no built-in rate limiter, and the
 * generated API is a single-process dev server, so a per-process Map is
 * honest about its guarantees. A multi-worker or multi-instance deployment
 * would need a shared store (Redis, etc.) instead of this middleware.
 */

const windowMs = env.RATE_LIMIT_WINDOW_MINUTES * 60_000;
const max = env.RATE_LIMIT_MAX;

interface Bucket {
  count: number;
  resetAt: number;
}

export function apiRateLimit(): MiddlewareHandler {
  const buckets = new Map<string, Bucket>();

  return async (c, next) => {
    // @hono/node-server exposes the raw socket on c.env.
    const key =
      (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming
        ?.socket?.remoteAddress ?? "unknown";
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
    } else if (bucket.count >= max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      return c.json({ error: "Too many requests" }, 429, {
        "Retry-After": retryAfter.toString(),
      });
    } else {
      bucket.count += 1;
    }

    // Drop expired buckets so abandoned client IPs do not accumulate forever.
    if (buckets.size > 10_000) {
      for (const [ip, entry] of buckets) {
        if (entry.resetAt <= now) buckets.delete(ip);
      }
    }

    await next();
  };
}
