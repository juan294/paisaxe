import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

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
    // JSON.parse("null") returns null — exercises the `body === null` branch in isValidPayload
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
});
