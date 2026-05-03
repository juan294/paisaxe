import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

describe("GET /api/health/db", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns 500 when SUPABASE_URL is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Database diagnostic unavailable");
    expect(body).not.toHaveProperty("hasUrl");
    expect(body).not.toHaveProperty("hasKey");
  });

  it("returns 500 when SUPABASE_ANON_KEY is missing", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Database diagnostic unavailable");
    expect(body).not.toHaveProperty("hasUrl");
    expect(body).not.toHaveProperty("hasKey");
  });

  it("returns 500 when both env vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
  });

  it("returns success when database query succeeds", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";

    const { createClient } = await import("@supabase/supabase-js");
    vi.mocked(createClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [{ flag_key: "test_flag" }],
            error: null,
          }),
        }),
      }),
    } as never);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.tablesAccessible).toBe(true);
    expect(body.rowsReturned).toBe(1);
    expect(body.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("returns redacted 500 when database query returns error", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";

    const { createClient } = await import("@supabase/supabase-js");
    vi.mocked(createClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "permission denied", code: "42501" },
          }),
        }),
      }),
    } as never);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Database diagnostic check failed");
    expect(body).not.toHaveProperty("code");
    expect(JSON.stringify(body)).not.toContain("permission denied");
    expect(JSON.stringify(body)).not.toContain("42501");
    expect(body.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("returns redacted 500 when createClient throws", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";

    const { createClient } = await import("@supabase/supabase-js");
    vi.mocked(createClient).mockImplementation(() => {
      throw new Error("Connection failed");
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Database diagnostic check failed");
    expect(JSON.stringify(body)).not.toContain("Connection failed");
    expect(body.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("returns redacted 500 for non-Error throws", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";

    const { createClient } = await import("@supabase/supabase-js");
    vi.mocked(createClient).mockImplementation(() => {
      throw "string error";
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Database diagnostic check failed");
    expect(JSON.stringify(body)).not.toContain("string error");
  });

  it("returns rowsReturned 0 when data is null", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";

    const { createClient } = await import("@supabase/supabase-js");
    vi.mocked(createClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      }),
    } as never);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.rowsReturned).toBe(0);
  });
});
