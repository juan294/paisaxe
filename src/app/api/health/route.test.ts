import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { PROBE_TIMEOUTS_MS } from "@/lib/health-timeouts";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  probeRateLimitBackend: vi.fn(() =>
    Promise.resolve({
      backend: "memory",
      configured: false,
      degraded: false,
    })
  ),
}));

import { supabase } from "@/lib/supabase";
import { probeRateLimitBackend } from "@/lib/rate-limit";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);


/**
 * #528 (DO-L2): probes now terminate their Supabase query chains in
 * `.abortSignal(signal)`. These helpers wrap a terminal value so the chain ends
 * in an `.abortSignal()` that yields the original Promise (resolve/reject/hang).
 */
function abortable(promise: unknown) {
  return { abortSignal: vi.fn().mockReturnValue(promise) };
}
function resolved(value: unknown) {
  return abortable(Promise.resolve(value));
}

function createChainMock(resolveValue: unknown) {
  const mock = {
    select: vi.fn(),
    limit: vi.fn(),
  };

  mock.select.mockReturnValue(mock);
  mock.limit.mockReturnValue(resolved(resolveValue));

  return mock;
}

function mockHealthySupabase() {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === "stories") {
      const lastEq = vi.fn().mockReturnValue(resolved({ count: 1, error: null }));
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
      const lastEq = vi.fn().mockReturnValue(resolved({ count: 1, error: null }));
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
      const lastEq = vi.fn().mockReturnValue(resolved({ count, error }));
      const firstEq = vi.fn().mockReturnValue({ eq: lastEq });

      return {
        select: vi.fn().mockReturnValue({ eq: firstEq }),
      } as never;
    }

    return createChainMock({ error: null }) as never;
  });
}

function mockDatabaseSize(sizeBytes: number) {
  vi.mocked(supabase.rpc).mockReturnValue(
    resolved({ data: sizeBytes, error: null }) as never
  );
}

function mockDatabaseSizeError(message: string) {
  vi.mocked(supabase.rpc).mockReturnValue(
    resolved({ data: null, error: { message } }) as never
  );
}

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    vi.stubEnv("CRON_SECRET", "test-secret");
    vi.mocked(probeRateLimitBackend).mockResolvedValue({
      backend: "memory",
      configured: false,
      degraded: false,
    });
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

  it("degrades when the chunks probe throws unexpectedly (inner catch, line 81)", async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "stories") {
        const lastEq = vi.fn().mockReturnValue(resolved({ count: 1, error: null }));
        const firstEq = vi.fn().mockReturnValue({ eq: lastEq });
        return { select: vi.fn().mockReturnValue({ eq: firstEq }) } as never;
      }
      return {
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue(abortable(Promise.reject(new Error("Connection refused")))),
        }),
      } as never;
    });
    mockDatabaseSize(129394278);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("degraded");
  });

  it("degrades when the stories probe returns an error response (line 100)", async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "stories") {
        const lastEq = vi.fn().mockReturnValue(
          resolved({ count: null, error: { message: "Stories DB error" } })
        );
        const firstEq = vi.fn().mockReturnValue({ eq: lastEq });
        return { select: vi.fn().mockReturnValue({ eq: firstEq }) } as never;
      }
      return createChainMock({ error: null }) as never;
    });
    mockDatabaseSize(129394278);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("degraded");
  });

  it("degrades when the stories probe throws unexpectedly (inner catch, line 105)", async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "stories") {
        const lastEq = vi.fn().mockReturnValue(abortable(Promise.reject(new Error("Stories DB crash"))));
        const firstEq = vi.fn().mockReturnValue({ eq: lastEq });
        return { select: vi.fn().mockReturnValue({ eq: firstEq }) } as never;
      }
      return createChainMock({ error: null }) as never;
    });
    mockDatabaseSize(129394278);

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
        const lastEq = vi.fn().mockReturnValue(resolved({ count: 1, error: null }));
        const firstEq = vi.fn().mockReturnValue({ eq: lastEq });

        return {
          select: vi.fn().mockReturnValue({ eq: firstEq }),
        } as never;
      }

      return {
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue(abortable(new Promise(() => {}))),
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

  // #528 (DO-L2): the timeout must CANCEL the underlying request, not just race
  // a fallback. We capture the AbortSignal handed to .abortSignal() and assert
  // it is aborted once the probe times out.
  it("aborts the underlying chunks request when the probe times out", async () => {
    let capturedSignal: AbortSignal | undefined;
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "stories") {
        const lastEq = vi.fn().mockReturnValue(resolved({ count: 1, error: null }));
        const firstEq = vi.fn().mockReturnValue({ eq: lastEq });
        return { select: vi.fn().mockReturnValue({ eq: firstEq }) } as never;
      }
      return {
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            // Never resolves on its own; only settles when the signal aborts.
            abortSignal: vi.fn().mockImplementation((signal: AbortSignal) => {
              capturedSignal = signal;
              return new Promise((_resolve, reject) => {
                signal.addEventListener("abort", () => reject(new Error("aborted")), {
                  once: true,
                });
              });
            }),
          }),
        }),
      } as never;
    });
    mockDatabaseSize(129394278);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(capturedSignal).toBeInstanceOf(AbortSignal);
    expect(capturedSignal?.aborted).toBe(true);
  }, 10000);

  it("degrades when the stories probe hangs past its timeout", async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "stories") {
        const lastEq = vi.fn().mockReturnValue(abortable(new Promise(() => {})));
        const firstEq = vi.fn().mockReturnValue({ eq: lastEq });
        return {
          select: vi.fn().mockReturnValue({ eq: firstEq }),
        } as never;
      }
      return createChainMock({ error: null }) as never;
    });
    mockDatabaseSize(129394278);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("degraded");
  }, 10000);

  it("stays healthy when the database size probe hangs past its timeout", async () => {
    mockHealthySupabase();
    vi.mocked(supabase.rpc).mockReturnValue(abortable(new Promise(() => {})) as never);

    const response = await GET();
    const data = await response.json();

    // Database timeout returns null usage_percent → not over threshold → healthy
    expect(response.status).toBe(200);
    expect(data.status).toBe("healthy");
  }, 10000);

  it("does not degrade when the database size probe throws unexpectedly", async () => {
    mockHealthySupabase();
    vi.mocked(supabase.rpc).mockReturnValue(abortable(Promise.reject(new Error("Unexpected DB error"))) as never);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("healthy");
  });

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
    vi.mocked(probeRateLimitBackend).mockResolvedValue({
      backend: "blocked",
      configured: false,
      degraded: true,
      reason: "upstash_missing",
    });

    const response = await GET();
    const data = await response.json();

    // Allow-list: status, timestamp, cron_auth (BE-B1), sentry (DO-H2)
    const allowedKeys = new Set(["status", "timestamp", "cron_auth", "sentry", "rate_limit"]);
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
    expect(data.rate_limit).toEqual({
      status: "degraded",
      backend: "blocked",
      reason: "upstash_missing",
    });
    expect(data.rate_limit).not.toHaveProperty("configured");
  });

  it("SE-M1: degraded response also exposes no recon fields", async () => {
    mockSupabaseProbeError("Connection refused");
    mockDatabaseSize(129394278);

    const response = await GET();
    const data = await response.json();

    // DO-H1: degraded is 200
    expect(response.status).toBe(200);
    expect(data.status).toBe("degraded");
    const allowedKeys = new Set(["status", "timestamp", "cron_auth", "sentry", "rate_limit"]);
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

  it("DO-H2: keeps deployed preview health healthy when only Sentry DSN is missing", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    mockHealthySupabase();
    mockDatabaseSize(129394278);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("healthy");
    expect(data.sentry).toEqual({ status: "unconfigured" });
  });

  it("DO-H2: keeps deployed preview health healthy when only Upstash is missing", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.mocked(probeRateLimitBackend).mockResolvedValue({
      backend: "blocked",
      configured: false,
      degraded: true,
      reason: "upstash_missing",
    });
    mockHealthySupabase();
    mockDatabaseSize(129394278);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("healthy");
    expect(data.rate_limit).toEqual({
      status: "degraded",
      backend: "blocked",
      reason: "upstash_missing",
    });
  });

  it("DO-H2: marks deployed production health degraded when Sentry DSN is missing", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    mockHealthySupabase();
    mockDatabaseSize(129394278);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("degraded");
    expect(data.sentry).toEqual({ status: "unconfigured" });
  });

  it("DO-H2: marks deployed production health degraded when Upstash is missing", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.mocked(probeRateLimitBackend).mockResolvedValue({
      backend: "blocked",
      configured: false,
      degraded: true,
      reason: "upstash_missing",
    });
    mockHealthySupabase();
    mockDatabaseSize(129394278);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("degraded");
    expect(data.rate_limit).toEqual({
      status: "degraded",
      backend: "blocked",
      reason: "upstash_missing",
    });
  });

  // DO-H2 (#823): the health probe must reflect a LIVE Upstash outage, not
  // cross-process state. This is the regression test for the actual bug:
  // previously /api/health only ever read a same-process flag and could never
  // observe a failure from a different serverless isolate, so it always
  // reported "ok" no matter what was happening to real chat traffic.
  it("DO-H2: reports rate_limit degraded when the live Upstash probe fails, and stays HTTP 200", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.mocked(probeRateLimitBackend).mockResolvedValue({
      backend: "upstash",
      configured: true,
      degraded: true,
      reason: "upstash_unavailable",
    });
    mockHealthySupabase();
    mockDatabaseSize(129394278);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("degraded");
    expect(data.rate_limit).toEqual({
      status: "degraded",
      backend: "upstash",
      reason: "upstash_unavailable",
    });
  });

  // DO-H2: a hung Redis PING must not hang the health endpoint. The probe is
  // raced against PROBE_TIMEOUTS_MS.rateLimit and degrades on timeout, the same
  // way the Supabase/stories/database probes already do.
  it("DO-H2: degrades rate_limit and stays fast when the live Upstash probe hangs past its timeout", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.mocked(probeRateLimitBackend).mockReturnValue(new Promise(() => {}));
    mockHealthySupabase();
    mockDatabaseSize(129394278);

    const start = Date.now();
    const response = await GET();
    const elapsed = Date.now() - start;
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("degraded");
    expect(data.rate_limit).toEqual({
      status: "degraded",
      backend: "upstash",
      reason: "upstash_unavailable",
    });
    expect(elapsed).toBeLessThan(PROBE_TIMEOUTS_MS.rateLimit + 400);
  }, 10000);

  it("DO-H2: health stays healthy when the live Upstash probe succeeds", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://test@o123.ingest.sentry.io/456");
    vi.mocked(probeRateLimitBackend).mockResolvedValue({
      backend: "upstash",
      configured: true,
      degraded: false,
    });
    mockHealthySupabase();
    mockDatabaseSize(129394278);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("healthy");
    expect(data.rate_limit).toEqual({ status: "ok", backend: "upstash" });
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

  it("returns degraded status when supabase probe throws unexpectedly", async () => {
    // Covers health/route.ts:228 — the catch block that returns degraded
    // when Promise.all rejects due to an unexpected throw inside a probe
    vi.mocked(supabase.from).mockImplementation(() => {
      throw new Error("Unexpected probe crash");
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("degraded");
  });

  // DO-L1: SUPABASE_STORAGE_LIMIT_MB env override
  it("DO-L1: uses default STORAGE_LIMIT_MB=8192 when env var is unset", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("CRON_SECRET", "test-secret");
    delete process.env.SUPABASE_STORAGE_LIMIT_MB;
    mockHealthySupabase();
    // 8192 MB * 0.8 threshold = 6553.6 MB → 6871954637 bytes is ~6553 MB which should degrade
    mockDatabaseSize(6871954637);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("degraded");
  });

  it("DO-L1: uses SUPABASE_STORAGE_LIMIT_MB env var to override storage limit", async () => {
    vi.stubEnv("SUPABASE_STORAGE_LIMIT_MB", "16384"); // 16 GB
    mockHealthySupabase();
    // 6871954637 bytes = ~6553 MB — below 80% of 16384 MB (13107 MB) → healthy
    mockDatabaseSize(6871954637);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("healthy");
  });

  // DO-L2: cron_auth:misconfigured degrades overall status in production only
  it("DO-L2: does NOT degrade overall status when cron_auth is misconfigured in development", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("VERCEL_ENV", "development");
    mockHealthySupabase();
    mockDatabaseSize(129394278);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.cron_auth.status).toBe("misconfigured");
    expect(data.status).toBe("healthy");
  });

  it("DO-L2: does NOT degrade overall status when cron_auth is misconfigured in preview", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("VERCEL_ENV", "preview");
    mockHealthySupabase();
    mockDatabaseSize(129394278);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.cron_auth.status).toBe("misconfigured");
    expect(data.status).toBe("healthy");
  });

  it("DO-L2: degrades overall status in production when cron_auth is misconfigured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("VERCEL_ENV", "production");
    mockHealthySupabase();
    mockDatabaseSize(129394278);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200); // always HTTP 200
    expect(data.cron_auth.status).toBe("misconfigured");
    expect(data.status).toBe("degraded");
  });

  it("DO-L2: HTTP status remains 200 even when cron_auth degrades production status", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("VERCEL_ENV", "production");
    mockHealthySupabase();
    mockDatabaseSize(129394278);

    const response = await GET();
    expect(response.status).toBe(200);
  });

  // Release verification (Wave A, Phase 2): the deployment reports what it was
  // built from, but only to an authorized caller — SE-M1 keeps the public shape.
  describe("build identity", () => {
    const COMMIT = "9411eada1c2b3d4e5f60718293a4b5c6d7e8f901";

    function authorizedRequest(secret = "test-secret"): Request {
      return new Request("https://paisaxe.es/api/health", {
        headers: { authorization: `Bearer ${secret}` },
      });
    }

    beforeEach(() => {
      mockHealthySupabase();
      mockDatabaseSize(129394278);
      vi.stubEnv("VERCEL_GIT_COMMIT_SHA", COMMIT);
    });

    it("reports the commit the build came from to an authorized caller", async () => {
      const data = await (await GET(authorizedRequest())).json();

      expect(data.build.commit).toBe(COMMIT);
    });

    it("shortens a full tree hash and passes other values through", async () => {
      vi.stubEnv("BUILD_TREE_HASH", "95a62c4be18d9b222187b88a450ba02bcc664365");
      expect((await (await GET(authorizedRequest())).json()).build.tree).toBe(
        "95a62c4be18d"
      );

      vi.stubEnv("BUILD_TREE_HASH", "95a62c4be18d");
      expect((await (await GET(authorizedRequest())).json()).build.tree).toBe(
        "95a62c4be18d"
      );
    });

    it("degrades to 'unknown' off Vercel instead of throwing", async () => {
      vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");
      vi.stubEnv("BUILD_TREE_HASH", "");

      const response = await GET(authorizedRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.build).toEqual({ commit: "unknown", tree: "unknown" });
    });

    it("never affects overall status — an unknown identity stays healthy", async () => {
      vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");

      const data = await (await GET(authorizedRequest())).json();

      expect(data.status).toBe("healthy");
    });

    it("SE-M1: withholds the identity from an unauthenticated caller", async () => {
      const monitorRequest = new Request("https://paisaxe.es/api/health");

      for (const response of [await GET(), await GET(monitorRequest)]) {
        const data = await response.json();
        expect(data).not.toHaveProperty("build");
        expect(data.status).toBe("healthy");
      }
    });

    it("SE-M1: withholds the identity when the bearer token is wrong", async () => {
      const data = await (await GET(authorizedRequest("wrong-secret"))).json();

      expect(data).not.toHaveProperty("build");
    });

    it("SE-M1: withholds the identity when CRON_SECRET is unset", async () => {
      vi.stubEnv("CRON_SECRET", "");

      const data = await (await GET(authorizedRequest(""))).json();

      expect(data).not.toHaveProperty("build");
    });

    it("keeps the monitored response shape intact for authorized callers", async () => {
      const data = await (await GET(authorizedRequest())).json();

      // Upptime and scripts/check-health-readiness.mjs assert on these.
      expect(Object.keys(data).sort()).toEqual([
        "build",
        "cron_auth",
        "rate_limit",
        "sentry",
        "status",
        "timestamp",
      ]);
      expect(data.status).toBe("healthy");
    });
  });
});
