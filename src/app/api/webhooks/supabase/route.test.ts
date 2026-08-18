import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

const logger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger }));

// Mock next/cache before importing the route handler
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { POST } from "./route";

function createRequest(
  body: unknown,
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest("http://localhost:3000/api/webhooks/supabase", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    table_name: "stories",
    operation: "UPDATE",
    record: { id: "story-1", title: "Updated Story" },
    old_record: { id: "story-1", title: "Old Story" },
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe("POST /api/webhooks/supabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("WEBHOOK_SECRET", "test-webhook-secret");
  });

  it("should return 401 when webhook secret header is missing", async () => {
    const request = createRequest(validPayload());

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 401 when webhook secret is invalid", async () => {
    const request = createRequest(validPayload(), {
      "x-webhook-secret": "wrong-secret",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 400 when payload is missing required fields", async () => {
    const request = createRequest(
      { table_name: "stories" },
      { "x-webhook-secret": "test-webhook-secret" }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Bad request: missing required fields");
  });

  it("should return 400 when payload is missing table_name", async () => {
    const request = createRequest(
      { operation: "UPDATE", timestamp: new Date().toISOString() },
      { "x-webhook-secret": "test-webhook-secret" }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Bad request: missing required fields");
  });

  it("should return 200 and revalidate paths for stories table update", async () => {
    const request = createRequest(validPayload({ table_name: "stories" }), {
      "x-webhook-secret": "test-webhook-secret",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.revalidated).toContain("/immersive");
    expect(data.revalidated).toContain("/sitemap.xml");
    expect(revalidatePath).toHaveBeenCalledWith("/immersive");
    expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
  });

  it("should return 200 and revalidate paths for feature_flags table update", async () => {
    const request = createRequest(
      validPayload({ table_name: "feature_flags" }),
      { "x-webhook-secret": "test-webhook-secret" }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.revalidated).toContain("/api/feature-flags");
    expect(revalidatePath).toHaveBeenCalledWith("/api/feature-flags");
  });

  it("should handle unknown table names gracefully with 200 but no revalidation", async () => {
    const request = createRequest(
      validPayload({ table_name: "unknown_table" }),
      { "x-webhook-secret": "test-webhook-secret" }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.revalidated).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("should return 400 when payload body is null", async () => {
    // JSON.parse("null") returns null — exercises the "not an object" branch
    // of the enforced SupabaseWebhookSchema (BE-H3 replaced the old manual
    // `isValidPayload` type guard with schema enforcement).
    const request = new NextRequest(
      "http://localhost:3000/api/webhooks/supabase",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": "test-webhook-secret",
        },
        body: "null",
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Bad request: missing required fields");
  });

  it("should return 500 when an unexpected error occurs", async () => {
    // Create a request that will cause JSON parsing to fail
    const request = new NextRequest(
      "http://localhost:3000/api/webhooks/supabase",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": "test-webhook-secret",
        },
        body: "invalid-json",
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });

  describe("Zod schema validation", () => {
    // BE-H3 (#778): the passthrough invariant — provider payload evolution
    // (a new, unknown top-level field) must not silently break the webhook.
    // The observability-only StrictSupabaseWebhookSchema still logs a
    // warning, but the enforced schema accepts the payload and the request
    // succeeds using `parseResult.data`.
    it("should warn on unexpected payload shape but still succeed (passthrough)", async () => {
      const request = createRequest(
        {
          table_name: "stories",
          operation: "UPDATE",
          timestamp: new Date().toISOString(),
          unexpected_field: "surprise",
        },
        { "x-webhook-secret": "test-webhook-secret" }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith("[WEBHOOK_UNKNOWN_SHAPE]", {
        webhook: "supabase",
        fields: ["unexpected_field"],
      });
    });

    it("should emit WEBHOOK_UNKNOWN_SHAPE warn when payload is missing operation field", async () => {
      // The enforced SupabaseWebhookSchema requires table_name + operation +
      // timestamp (BE-H3), so a missing `operation` field is a genuine
      // validation failure, not just an informational warning.
      const rawPayload = { table_name: "stories", timestamp: new Date().toISOString() };
      const request = createRequest(rawPayload, {
        "x-webhook-secret": "test-webhook-secret",
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    // BE-H3 (#778): before this fix, a wrong-typed `record` sailed past the
    // legacy `isValidPayload` guard, was only warned about by a `.strict()`
    // Zod schema whose result was then discarded, and the handler proceeded
    // to read the raw (unvalidated) body regardless. Now the enforced schema
    // actually rejects a malformed known field with a 400.
    it("should return 400 when a known field (record) has the wrong type", async () => {
      const request = createRequest(
        {
          table_name: "stories",
          operation: "UPDATE",
          timestamp: new Date().toISOString(),
          record: "not-an-object",
        },
        { "x-webhook-secret": "test-webhook-secret" }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Bad request: missing required fields");
    });

  });

  // -----------------------------------------------------------------------
  // SE-M3 / DO-H3: logger migration — uses structured logger, not console
  // -----------------------------------------------------------------------

  it("should use logger.error (not console.error) on unexpected error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Force an unexpected error by providing invalid JSON that bypasses our null check
    const request = new NextRequest(
      "http://localhost:3000/api/webhooks/supabase",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": "test-webhook-secret",
        },
        body: "invalid-json",
      }
    );

    const response = await POST(request);
    expect(response.status).toBe(500);
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("should stringify a non-Error thrown value in the logged error message", async () => {
    // Force revalidatePath to throw a non-Error (a plain string) so the
    // `error instanceof Error ? error.message : String(error)` branch takes
    // the String(error) path instead of error.message.
    vi.mocked(revalidatePath).mockImplementationOnce(() => {
       
      throw "boom: not-an-error-object";
    });

    const request = createRequest(validPayload({ table_name: "stories" }), {
      "x-webhook-secret": "test-webhook-secret",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
    expect(logger.error).toHaveBeenCalledWith("[webhook] Error processing webhook:", {
      error: "boom: not-an-error-object",
    });
  });
});
