import { NextRequest, NextResponse } from "next/server";

type AuthResult =
  | { valid: true }
  | { valid: false; error: NextResponse };

/**
 * Validates the admin secret key from the Authorization header.
 * Expects: Authorization: Bearer {ADMIN_SECRET_KEY}
 */
export function validateAdminAuth(request: NextRequest): AuthResult {
  const adminKey = process.env.ADMIN_SECRET_KEY;

  if (!adminKey) {
    console.error("ADMIN_SECRET_KEY not configured");
    return {
      valid: false,
      error: NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      ),
    };
  }

  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: "Authorization header required" },
        { status: 401 }
      ),
    };
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: "Invalid authorization format. Expected: Bearer {token}" },
        { status: 401 }
      ),
    };
  }

  // Use timing-safe comparison to prevent timing attacks
  if (!timingSafeEqual(token, adminKey)) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: "Invalid admin key" },
        { status: 403 }
      ),
    };
  }

  return { valid: true };
}

/**
 * Timing-safe string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  // Use the longer string's length to maintain more constant time
  const len = Math.max(a.length, b.length);
  let result = a.length ^ b.length; // Will be non-zero if lengths differ

  for (let i = 0; i < len; i++) {
    result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }

  return result === 0;
}
