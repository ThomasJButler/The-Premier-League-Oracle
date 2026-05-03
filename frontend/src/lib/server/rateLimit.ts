// In-memory sliding-window rate limiter. Per-IP buckets reset every 60s.
// Per-instance only — fine for MVP (Vercel cold start clears state). Swap to
// Upstash/Redis when traffic justifies cross-instance coordination.

const WINDOW_MS = 60_000;
const LIMIT = 10;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

export function checkRateLimit(key: string, now: number = Date.now()): RateLimitResult {
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const fresh: Bucket = { count: 1, resetAt: now + WINDOW_MS };
    buckets.set(key, fresh);
    return { ok: true, remaining: LIMIT - 1, resetAt: fresh.resetAt, limit: LIMIT };
  }
  if (existing.count >= LIMIT) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt, limit: LIMIT };
  }
  existing.count += 1;
  return { ok: true, remaining: LIMIT - existing.count, resetAt: existing.resetAt, limit: LIMIT };
}

// Test helpers — not part of the public contract.
export function _resetRateLimit(): void {
  buckets.clear();
}

export const _RATE_LIMIT = LIMIT;
export const _RATE_WINDOW_MS = WINDOW_MS;
