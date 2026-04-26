import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PROBE_TIMEOUTS_MS } from "./route";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

import { supabase } from "@/lib/supabase";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function createChainMock(resolveValue: unknown) {
  const mock = {
    select: vi.fn(),
    limit: vi.fn(),
  };

  mock.select.mockReturnValue(mock);
  mock.limit.mockReturnValue(Promise.resolve(resolveValue));

  return mock;
}

function mockHealthySupabase() {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === "stories") {
      const lastEq = vi.fn().mockResolvedValue({ count: 1, error: null });
      const firstEq = vi.fn().mockReturnValue({ eq: lastEq });

      return {
        select: vi.fn().mockReturnValue({ eq: firstEq }),
      } as never;
    }

    return createChainMock({ error: null }) as never;
  });
}

function mockSupabaseProbeError(message: string) {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === "stories") {
      const lastEq = vi.fn().mockResolvedValue({ count: 1, error: null });
      const firstEq = vi.fn().mockReturnValue({ eq: lastEq });

      return {
        select: vi.fn().mockReturnValue({ eq: firstEq }),
      } as never;
    }

    return createChainMock({ error: { message } }) as never;
  });
}

function mockStoryCount(count: number | null, error: { message: string } | null) {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === "stories") {
      const lastEq = vi.fn().mockResolvedValue({ count, error });
      const firstEq = vi.fn().mockReturnValue({ eq: lastEq });

      return {
        select: vi.fn().mockReturnValue({ eq: firstEq }),
      } as never;
    }

    return createChainMock({ error: null }) as never;
  });
}

function mockDatabaseSize(sizeBytes: number) {
  vi.mocked(supabase.rpc).mockResolvedValue({
    data: sizeBytes,
    error: null,
  } as never);
}

function mockDatabaseSizeError(message: string) {
  vi.mocked(supabase.rpc).mockResolvedValue({
    data: null,
    error: { message },
  } as never);
}

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("returns HTTP 200 with a minimal public payload when healthy", async () => {
    mockHealthySupabase();
    mockDatabaseSize(129394278);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      status: "healthy",
      timestamp: expect.any(String),
    });
    expect(data).not.toHaveProperty("services");
    expect(data).not.toHaveProperty("uptime");
    expect(data).not.toHaveProperty("version");
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
  });

  it("returns HTTP 503 with the same minimal payload when Supabase is unavailable", async () => {
    mockSupabaseProbeError("Connection refused");
    mockDatabaseSize(129394278);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data).toEqual({
      status: "degraded",
      timestamp: expect.any(String),
    });
  });

  it("returns HTTP 503 when no approved stories are available", async () => {
    mockStoryCount(0, null);
    mockDatabaseSize(129394278);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe("degraded");
  });

  it("returns HTTP 503 when database usage reaches the warning threshold", async () => {
    mockHealthySupabase();
    mockDatabaseSize(6871954637);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe("degraded");
  });

  it("does not degrade when the capacity probe errors but core app checks are healthy", async () => {
    mockHealthySupabase();
    mockDatabaseSizeError("permission denied for function get_database_size");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("healthy");
  });

  it("fails fast when the chunks probe hangs", async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "stories") {
        const lastEq = vi.fn().mockResolvedValue({ count: 1, error: null });
        const firstEq = vi.fn().mockReturnValue({ eq: lastEq });

        return {
          select: vi.fn().mockReturnValue({ eq: firstEq }),
        } as never;
      }

      return {
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue(new Promise(() => {})),
        }),
      } as never;
    });
    mockDatabaseSize(129394278);

    const start = Date.now();
    const response = await GET();
    const elapsed = Date.now() - start;
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe("degraded");
    expect(elapsed).toBeLessThan(PROBE_TIMEOUTS_MS.supabase + 400);
  }, 10000);

  it("does not call external probes for the public health endpoint", async () => {
    mockHealthySupabase();
    mockDatabaseSize(129394278);

    await GET();

    expect(mockFetch).not.toHaveBeenCalled();
  });

  // SE-M1 regression: public endpoint must never leak operational recon data
  it("SE-M1: public response contains only status and timestamp — no recon fields", async () => {
    mockHealthySupabase();
    mockDatabaseSize(129394278);

    const response = await GET();
    const data = await response.json();

    // Only two fields allowed on the public tier
    expect(Object.keys(data)).toEqual(["status", "timestamp"]);

    // Explicit deny-list of fields that must never appear unauthenticated
    const sensitiveFields = [
      "version",
      "uptime",
      "db_size",
      "db_usage_percent",
      "services",
      "checks",
      "env",
      "keys",
      "config",
    ];
    for (const field of sensitiveFields) {
      expect(data).not.toHaveProperty(field);
    }
  });

  it("SE-M1: degraded response also exposes no recon fields", async () => {
    mockSupabaseProbeError("Connection refused");
    mockDatabaseSize(129394278);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(Object.keys(data)).toEqual(["status", "timestamp"]);
  });
});
