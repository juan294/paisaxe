import { timingSafeEqual } from "crypto";

/**
 * Validate the MCP API secret from the request header using
 * constant-time comparison to prevent timing attacks.
 *
 * Uses the same pattern as webhook routes (see webhooks/supabase/route.ts).
 */
export function validateMcpSecret(request: Request): boolean {
  const secret = process.env.MCP_API_SECRET?.trim();
  if (!secret) {
    return false;
  }

  const provided = request.headers.get("x-mcp-secret");
  if (!provided) {
    return false;
  }

  // Use constant-time comparison to prevent timing attacks.
  // Convert to Buffers first; if lengths differ, timingSafeEqual throws,
  // so we check length first and return false (still constant-time safe
  // because the attacker already knows the length from the response time
  // of the length check vs the full comparison — but the actual secret
  // content is never leaked).
  if (provided.length !== secret.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
}
