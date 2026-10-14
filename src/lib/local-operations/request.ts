import { NextRequest, NextResponse } from "next/server";
import { validateCsrfToken, validateOrigin } from "@/lib/csrf";

/** Proxy protection is also checked here before a local process mutation. */
export function rejectUnsafeMutation(request: NextRequest) {
  if (!validateOrigin(request, [request.nextUrl.origin]) || !validateCsrfToken(request)) {
    return NextResponse.json({ error: "Invalid CSRF token or origin" }, { status: 403 });
  }
  return null;
}
