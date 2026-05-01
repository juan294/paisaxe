import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    vi.stubEnv("CRON_SECRET", "test-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns HTTP 200 with a minimal public payload when healthy", async () => {
    const savedDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;

    try {
      mockHealthySupabase();
      mockDatabaseSize(129394278);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe("healthy");
      expect(data.timestamp).toEqual(expect.any(String));
      expect(data.sentry).toEqual({ status: "unconfigured" });
      expect(data).not.toHaveProperty("services");
      expect(data).not.toHaveProperty("uptime");
      expect(data).not.toHaveProperty("version");
      expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    } finally {
      if (savedDsn !== undefined) {
        process.env.NEXT_PUBLIC_SENTRY_DSN = savedDsn;
      }
    }
  });

  // DO-H1 regression: HTTP status must be 200 even when degraded
  it("DO-H1: returns HTTP 200 (not 503) with degraded status when Supabase is unavailable", async () => {
    mockSupabaseProbeError("Connection refused");
    mockDatabaseSize(129394278);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      status: "degraded",
      timestamp: expect.any(String),
    });
  });

  it("DO-H1: returns HTTP 200 (not 503) when no approved stories are available", async () => {
    mockStoryCount(0, null);
    mockDatabaseSize(129394278);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("degraded");
  });

  it("DO-H1: returns HTTP 200 (not 503) when database usage reaches the warning threshold", async () => {
    mockHealthySupabase();
    mockDatabaseSize(6871954637);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
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

    // DO-H1: degraded is 200, never 503
    expect(response.status).toBe(200);
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
  it("SE-M1: public response contains only allow-listed top-level fields", async () => {
    mockHealthySupabase();
    mockDatabaseSize(129394278);

    const response = await GET();
    const data = await response.json();

    // Allow-list: status, timestamp, cron_auth (BE-B1), sentry (DO-H2)
    const allowedKeys = new Set(["status", "timestamp", "cron_auth", "sentry"]);
    for (const key of Object.keys(data)) {
      expect(allowedKeys).toContain(key);
    }

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

    // cron_auth must never expose the secret itself, only a status label.
    expect(JSON.stringify(data.cron_auth)).not.toContain("test-secret");
  });

  it("SE-M1: degraded response also exposes no recon fields", async () => {
    mockSupabaseProbeError("Connection refused");
    mockDatabaseSize(129394278);

    const response = await GET();
    const data = await response.json();

    // DO-H1: degraded is 200
    expect(response.status).toBe(200);
    expect(data.status).toBe("degraded");
    const allowedKeys = new Set(["status", "timestamp", "cron_auth", "sentry"]);
    for (const key of Object.keys(data)) {
      expect(allowedKeys).toContain(key);
    }
  });

  // BE-B1: cron_auth observability — silent CRON_SECRET misconfiguration
  it("BE-B1: includes cron_auth.status='ok' when CRON_SECRET is configured", async () => {
    vi.stubEnv("CRON_SECRET", "configured-secret");
    mockHealthySupabase();
    mockDatabaseSize(129394278);

    const response = await GET();
    const data = await response.json();

    expect(data.cron_auth).toEqual({ status: "ok" });
    expect(data.status).toBe("healthy");
  });

  it("BE-B1: includes cron_auth.status='misconfigured' when CRON_SECRET is missing", async () => {
    vi.stubEnv("CRON_SECRET", "");
    mockHealthySupabase();
    mockDatabaseSize(129394278);

    const response = await GET();
    const data = await response.json();

    expect(data.cron_auth).toEqual({
      status: "misconfigured",
      message: "CRON_SECRET not set",
    });
    // Informational only — must NOT change overall health
    expect(data.status).toBe("healthy");
  });

  // PE-H3 regression: preview-smoke.yml requires HTTP 200 + status=healthy
  it("PE-H3: returns HTTP 200 so preview-smoke.yml gate can inspect body status", async () => {
    mockHealthySupabase();
    mockDatabaseSize(129394278);

    const response = await GET();
    const data = await response.json();

    // The smoke test gates on: HTTP 200 AND body.status === "healthy"
    expect(response.status).toBe(200);
    expect(data.status).toBe("healthy");
  });

  // DO-H2 regression: Sentry unconfigured state must be visible in health response
  it("DO-H2: health response includes sentry.status=unconfigured when DSN is not set", async () => {
    const savedDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;

    try {
      mockHealthySupabase();
      mockDatabaseSize(129394278);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sentry).toEqual({ status: "unconfigured" });
    } finally {
      if (savedDsn !== undefined) {
        process.env.NEXT_PUBLIC_SENTRY_DSN = savedDsn;
      }
    }
  });

  it("DO-H2: health response includes sentry.status=configured when DSN is set", async () => {
    const savedDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://test@o123.ingest.sentry.io/456";

    try {
      mockHealthySupabase();
      mockDatabaseSize(129394278);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sentry).toEqual({ status: "configured" });
    } finally {
      if (savedDsn !== undefined) {
        process.env.NEXT_PUBLIC_SENTRY_DSN = savedDsn;
      } else {
        delete process.env.NEXT_PUBLIC_SENTRY_DSN;
      }
    }
  });
});
