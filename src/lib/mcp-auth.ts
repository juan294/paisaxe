import "server-only";
import { safeEqual } from "@/lib/safe-equal";

const MCP_IDEMPOTENCY_HEADER_NAMES = [
  "idempotency-key",
  "x-idempotency-key",
  "x-mcp-idempotency-key",
];

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
  // DO-H6: safeEqual compares byte length (not JS string `.length`, which
  // counts UTF-16 code units and can crash timingSafeEqual with a RangeError
  // on multibyte input of the "right" code-unit count).
  return safeEqual(provided, secret);
}

export function getMcpIdempotencyKey(request: Request): string | null {
  for (const headerName of MCP_IDEMPOTENCY_HEADER_NAMES) {
    const value = request.headers.get(headerName)?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}
