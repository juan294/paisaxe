import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

// Mock dependencies before importing route
vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn().mockResolvedValue({
    valid: false,
    error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
  }),
}));

vi.mock("@/lib/content-discovery", () => ({
  runDiscovery: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: vi.fn() })),
}));

import { POST } from "./route";
import { runDiscovery } from "@/lib/content-discovery";

function makeRequest(headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/cron/content-discovery", {
    method: "POST",
    headers,
  }) as unknown as import("next/server").NextRequest;
}

describe("POST /api/cron/content-discovery", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...ORIGINAL_ENV,
      WEBHOOK_SECRET: "test-secret",
      GOOGLE_PLACES_API_KEY: "test-google-key",
      ANTHROPIC_API_KEY: "test-anthropic-key",
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_SERVICE_KEY: "test-service-key",
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("rejects requests without auth", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("rejects requests with wrong secret", async () => {
    const res = await POST(makeRequest({ "x-webhook-secret": "wrong-secret" }));
    expect(res.status).toBe(401);
  });

  it("returns 500 when GOOGLE_PLACES_API_KEY is missing", async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    const res = await POST(makeRequest({ "x-webhook-secret": "test-secret" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("GOOGLE_PLACES_API_KEY");
  });

  it("returns 500 when ANTHROPIC_API_KEY is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await POST(makeRequest({ "x-webhook-secret": "test-secret" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("ANTHROPIC_API_KEY");
  });

  it("runs discovery pipeline and returns results", async () => {
    (runDiscovery as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      discovered: 3,
      created: 2,
      skippedDuplicates: 1,
      errors: [],
      stories: [
        { id: "uuid-1", title: "Place 1", slug: "place-1", category: "nature" },
        { id: "uuid-2", title: "Place 2", slug: "place-2", category: "food" },
      ],
    });

    const res = await POST(makeRequest({ "x-webhook-secret": "test-secret" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.created).toBe(2);
    expect(body.discovered).toBe(3);
    expect(body.skippedDuplicates).toBe(1);
    expect(body.stories).toHaveLength(2);
  });

  it("returns 200 with empty results when no places found", async () => {
    (runDiscovery as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      discovered: 0,
      created: 0,
      skippedDuplicates: 0,
      errors: [],
      stories: [],
    });

    const res = await POST(makeRequest({ "x-webhook-secret": "test-secret" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.created).toBe(0);
  });
});
