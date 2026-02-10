/**
 * Extract the client IP address from a Request object.
 *
 * Priority:
 * 1. First IP in `x-forwarded-for` header (set by reverse proxies / Vercel)
 * 2. `x-real-ip` header (set by some proxies like nginx)
 * 3. "unknown" as a safe fallback
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return request.headers.get("x-real-ip") || "unknown";
}
