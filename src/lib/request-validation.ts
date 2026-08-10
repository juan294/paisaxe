/**
 * Shared request-handling helpers for API route handlers.
 *
 * - readJsonBody:    parse a JSON body without throwing, returning a typed result.
 * - uuidParam:       validate a dynamic route param is a UUID.
 * - withRouteContext: bind the X-Request-ID header into the request context
 *                     (AsyncLocalStorage) so handler-level logs carry request_id.
 *
 * These exist to remove ad-hoc `await request.json()` + per-route validation
 * scattered across handlers (BE-M2 / #570) and to make request-id propagation
 * consistent in plain (non-admin) route handlers (DO-M1 / #619).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { withRequestContext } from "./request-context";

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: NextResponse };

export type ParamResult =
  | { ok: true; value: string }
  | { ok: false; error: NextResponse };

const uuidSchema = z.string().uuid();

/**
 * Parse a JSON request body without throwing. Returns a 400 NextResponse in the
 * error branch when the body is missing or malformed.
 */
export async function readJsonBody<T = unknown>(
  request: Pick<Request, "json">
): Promise<Result<T>> {
  try {
    const data = (await request.json()) as T;
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      error: NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      ),
    };
  }
}

/**
 * Validate that a dynamic route parameter is a UUID. Returns a 400 NextResponse
 * in the error branch.
 */
export function uuidParam(
  value: string | null | undefined,
  field = "id"
): ParamResult {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      error: NextResponse.json(
        { error: `Invalid ${field}: expected a UUID` },
        { status: 400 }
      ),
    };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Bind the inbound X-Request-ID into the AsyncLocalStorage request context for
 * the duration of the handler, so logs emitted inside the handler carry
 * request_id. Awaitable wrapper around withRequestContext for async handlers.
 *
 * src/proxy.ts forwards the header; this is the missing handler-side binding
 * (DO-M1 / #619).
 */
export function withRouteContext<T>(
  request: Pick<Request, "headers">,
  handler: () => Promise<T>
): Promise<T> {
  return withRequestContext(request, handler);
}
