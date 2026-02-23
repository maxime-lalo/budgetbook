// In-memory rate limiter. Resets on server restart.
// Not suitable for multi-instance deployments without shared state.

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 60;
const MAX_MAP_SIZE = 10_000;

function evictOldestEntries() {
  if (rateLimitMap.size <= MAX_MAP_SIZE) return;

  const entries = [...rateLimitMap.entries()].sort((a, b) => a[1].resetTime - b[1].resetTime);
  const toRemove = entries.slice(0, rateLimitMap.size - MAX_MAP_SIZE);
  for (const [key] of toRemove) {
    rateLimitMap.delete(key);
  }
}

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();

  // Cleanup expired entries
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }

  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    evictOldestEntries();
    return { allowed: true, remaining: MAX_REQUESTS - 1 };
  }

  entry.count++;

  if (entry.count > MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: MAX_REQUESTS - entry.count };
}
