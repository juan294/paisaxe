/**
 * Extract the client IP address from a Request object.
 *
 * Priority (most trusted → least trusted):
 * 1. `x-vercel-forwarded-for` — set exclusively by Vercel's infrastructure;
 *    the client cannot spoof or override this header.
 * 2. Last IP in `x-forwarded-for` — the outermost proxy (Vercel's load balancer)
 *    appends the real client IP as the final entry. Trusting the LAST entry rather
 *    than the first prevents a client from prepending a fake IP to bypass rate limits.
 * 3. `x-real-ip` header (set by some upstream proxies like nginx)
 * 4. "unknown" as a safe fallback
 */
export function getClientIp(request: Request): string {
  // 1. Vercel's non-spoofable header — prefer this when present
  const vercelIp = request.headers.get("x-vercel-forwarded-for")?.trim();
  if (vercelIp) return vercelIp;

  // 2. Fall back to the LAST entry in x-forwarded-for (added by Vercel's LB)
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const entries = forwarded.split(",");
    // Walk from the end to find the last non-empty entry
    for (let i = entries.length - 1; i >= 0; i--) {
      const ip = entries[i]?.trim();
      if (ip) return ip;
    }
  }

  return request.headers.get("x-real-ip") || "unknown";
}
