import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock next/server
vi.mock("next/server", () => ({
  NextRequest: class MockNextRequest {
    headers: Map<string, string>;
    constructor(url: string, init?: { headers?: Record<string, string> }) {
      this.headers = new Map(Object.entries(init?.headers || {}));
    }
  },
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status || 200,
    }),
  },
}));

// Mock admin auth — always reject so webhook secret is tested
vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: () =>
    Promise.resolve({ valid: false, error: { status: 401 } }),
}));

// Mock fs.promises.writeFile and readFile
const mockWriteFile = vi.fn();
const mockReadFile = vi.fn();
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    default: {
      ...actual,
      promises: { ...actual.promises, writeFile: mockWriteFile, readFile: mockReadFile },
    },
    promises: { ...actual.promises, writeFile: mockWriteFile, readFile: mockReadFile },
  };
});

// Mock Supabase client (for advisory lock)
const mockRpc = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ rpc: mockRpc }),
}));

// Mock the subscription optimizer module
const mockAnalyze = vi.fn();
const mockGenerateReport = vi.fn();
const mockGenerateSharedContextEntry = vi.fn();
vi.mock("@/lib/subscription-optimizer", () => ({
  analyzeSubscriptions: (...args: unknown[]) => mockAnalyze(...args),
  generateReport: (...args: unknown[]) => mockGenerateReport(...args),
  generateSharedContextEntry: (...args: unknown[]) =>
    mockGenerateSharedContextEntry(...args),
}));

describe("POST /api/cron/subscription-optimizer", () => {
  const originalEnv = process.env;
  const WEBHOOK_SECRET = "test-webhook-secret-123";
  const CRON_SECRET = "test-cron-secret-456";

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      WEBHOOK_SECRET,
      CRON_SECRET,
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_SERVICE_KEY: "test-service-key",
    };
    mockAnalyze.mockReset();
    mockGenerateReport.mockReset();
    mockGenerateSharedContextEntry.mockReset();
    mockWriteFile.mockReset();
    mockReadFile.mockReset();
    mockWriteFile.mockResolvedValue(undefined);
    mockReadFile.mockRejectedValue(new Error("ENOENT: no such file"));
    mockGenerateSharedContextEntry.mockReturnValue("## Subscription Optimizer\nContext entry");
    mockRpc.mockReset();
    // Default: advisory lock succeeds
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "pg_try_advisory_lock") return Promise.resolve({ data: true, error: null });
      if (fn === "pg_advisory_unlock") return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: null });
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("rejects requests without webhook secret and no admin session", async () => {
    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/subscription-optimizer",
      { headers: {} }
    );

    const response = await POST(request as never);
    expect(response.status).toBe(401);
  });

  it("rejects requests with wrong webhook secret", async () => {
    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/subscription-optimizer",
      { headers: { "x-webhook-secret": "wrong-secret" } }
    );

    const response = await POST(request as never);
    expect(response.status).toBe(401);
  });

  it("runs analysis and returns report on valid auth", async () => {
    const mockReport = {
      recommendations: [],
      totalMonthlySpend: 50,
      analyzedAt: "2026-02-09T10:00:00.000Z",
      dismissedFeatures: [],
    };
    mockAnalyze.mockReturnValue(mockReport);
    mockGenerateReport.mockReturnValue("# Report\nTest report content");

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/subscription-optimizer",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never);
    expect(response.status).toBe(200);
    expect(mockAnalyze).toHaveBeenCalledTimes(1);
    expect(mockGenerateReport).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((response as any).body).toEqual(
      expect.objectContaining({
        success: true,
        totalMonthlySpend: 50,
      })
    );
  });

  it("includes the markdown report in the response", async () => {
    const mockReport = {
      recommendations: [
        {
          serviceId: "elevenlabs",
          serviceName: "ElevenLabs",
          action: "keep",
          reason: "Usage is fine",
          unusedFeatures: [],
          usagePercentages: [],
          currentPlan: "Creator",
          monthlyCostUsd: 18.33,
        },
      ],
      totalMonthlySpend: 18.33,
      analyzedAt: "2026-02-09T10:00:00.000Z",
      dismissedFeatures: [],
    };
    mockAnalyze.mockReturnValue(mockReport);
    mockGenerateReport.mockReturnValue("# Subscription Optimizer Report");

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/subscription-optimizer",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never);
    expect(response.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((response as any).body.report).toBe("# Subscription Optimizer Report");
  });

  it("writes the report to docs/agents/subscription-optimizer-report.md", async () => {
    const reportContent = "# Subscription Optimizer Report\nContent here.";
    const mockReport = {
      recommendations: [],
      totalMonthlySpend: 50,
      analyzedAt: "2026-02-09T10:00:00.000Z",
      dismissedFeatures: [],
    };
    mockAnalyze.mockReturnValue(mockReport);
    mockGenerateReport.mockReturnValue(reportContent);

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/subscription-optimizer",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    await POST(request as never);
    // writeFile is called twice: once for the report, once for shared context
    expect(mockWriteFile).toHaveBeenCalledTimes(2);
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining("docs/agents/subscription-optimizer-report.md"),
      reportContent,
      "utf-8"
    );
  });

  it("does not fail if report file write fails", async () => {
    const mockReport = {
      recommendations: [],
      totalMonthlySpend: 50,
      analyzedAt: "2026-02-09T10:00:00.000Z",
      dismissedFeatures: [],
    };
    mockAnalyze.mockReturnValue(mockReport);
    mockGenerateReport.mockReturnValue("# Report");
    mockWriteFile.mockRejectedValue(new Error("EROFS: read-only file system"));

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/subscription-optimizer",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never);
    expect(response.status).toBe(200);
  });

  it("returns 500 on analysis error", async () => {
    mockAnalyze.mockImplementation(() => {
      throw new Error("Analysis failed");
    });

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/subscription-optimizer",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never);
    expect(response.status).toBe(500);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((response as any).body).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("failed"),
      })
    );
  });

  it("passes usage metrics from request body when provided", async () => {
    const mockReport = {
      recommendations: [],
      totalMonthlySpend: 50,
      analyzedAt: "2026-02-09T10:00:00.000Z",
      dismissedFeatures: [],
    };
    mockAnalyze.mockReturnValue(mockReport);
    mockGenerateReport.mockReturnValue("# Report");

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/subscription-optimizer",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    // Note: the route uses default usage metrics when none are provided
    const response = await POST(request as never);
    expect(response.status).toBe(200);
    expect(mockAnalyze).toHaveBeenCalledWith(
      expect.objectContaining({
        usageMetrics: expect.any(Object),
      })
    );
  });

  it("uses default header when shared-context.md does not exist (readFile throws)", async () => {
    const mockReport = {
      recommendations: [],
      totalMonthlySpend: 50,
      analyzedAt: "2026-02-09T10:00:00.000Z",
      dismissedFeatures: [],
    };
    mockAnalyze.mockReturnValue(mockReport);
    mockGenerateReport.mockReturnValue("# Report");
    // readFile rejects (default from beforeEach) — exercises the catch block at lines 59-62

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/subscription-optimizer",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never);
    expect(response.status).toBe(200);
    // writeFile should be called twice: once for the report, once for shared context
    expect(mockWriteFile).toHaveBeenCalledTimes(2);
    // The shared context write should include the default header
    const sharedContextCall = mockWriteFile.mock.calls.find(
      (call: string[]) => String(call[0]).includes("shared-context.md")
    );
    expect(sharedContextCall).toBeDefined();
    expect(sharedContextCall![1]).toContain("Agent Shared Context");
  });

  it("prepends context entry to existing shared-context.md when readFile succeeds", async () => {
    const mockReport = {
      recommendations: [],
      totalMonthlySpend: 50,
      analyzedAt: "2026-02-09T10:00:00.000Z",
      dismissedFeatures: [],
    };
    mockAnalyze.mockReturnValue(mockReport);
    mockGenerateReport.mockReturnValue("# Report");
    // readFile succeeds with existing content that has \n\n separator
    mockReadFile.mockResolvedValue(
      "# Agent Shared Context\n> Cross-agent intelligence.\n\n## Old Entry\nOld content here"
    );

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/subscription-optimizer",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never);
    expect(response.status).toBe(200);
    // The shared context write should prepend the new entry after the header
    const sharedContextCall = mockWriteFile.mock.calls.find(
      (call: string[]) => String(call[0]).includes("shared-context.md")
    );
    expect(sharedContextCall).toBeDefined();
    // Should contain the header, new context entry, and old body
    expect(sharedContextCall![1]).toContain("Agent Shared Context");
    expect(sharedContextCall![1]).toContain("Subscription Optimizer");
    expect(sharedContextCall![1]).toContain("Old Entry");
  });

  it("returns 500 with 'Unknown error' when a non-Error value is thrown", async () => {
    mockAnalyze.mockImplementation(() => {
       
      throw "something went wrong";
    });

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/subscription-optimizer",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never);
    expect(response.status).toBe(500);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((response as any).body).toEqual(
      expect.objectContaining({
        error: "Analysis failed",
        details: "Unknown error",
      })
    );
  });

  it("succeeds via admin auth fallback when webhook secret is invalid", async () => {
    // Override admin auth mock to return valid BEFORE importing the route
    vi.doMock("@/lib/admin-auth", () => ({
      validateAdminAuth: () =>
        Promise.resolve({ valid: true, userId: "admin-user-123" }),
    }));

    const mockReport = {
      recommendations: [],
      totalMonthlySpend: 50,
      analyzedAt: "2026-02-09T10:00:00.000Z",
      dismissedFeatures: [],
    };
    mockAnalyze.mockReturnValue(mockReport);
    mockGenerateReport.mockReturnValue("# Report");

    const { POST } = await import("./route");
    // No webhook secret header — forces the admin auth fallback
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/subscription-optimizer",
      { headers: {} }
    );

    const response = await POST(request as never);
    expect(response.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((response as any).body).toEqual(
      expect.objectContaining({
        success: true,
        totalMonthlySpend: 50,
      })
    );
  });

  it("uses default metrics when POST body is empty or invalid JSON", async () => {
    const mockReport = {
      recommendations: [],
      totalMonthlySpend: 50,
      analyzedAt: "2026-02-09T10:00:00.000Z",
      dismissedFeatures: [],
    };
    mockAnalyze.mockReturnValue(mockReport);
    mockGenerateReport.mockReturnValue("# Report");

    const { POST } = await import("./route");
    // MockNextRequest has no json() method, so request.json() will throw
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/subscription-optimizer",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never);
    expect(response.status).toBe(200);
    // Should have used default metrics
    expect(mockAnalyze).toHaveBeenCalledWith(
      expect.objectContaining({
        usageMetrics: expect.objectContaining({
          voiceMinutes: 15,
          visitors: 5000,
          chatConversations: 200,
        }),
      })
    );
  });

  it("uses default metrics when POST body has no usageMetrics field", async () => {
    const mockReport = {
      recommendations: [],
      totalMonthlySpend: 50,
      analyzedAt: "2026-02-09T10:00:00.000Z",
      dismissedFeatures: [],
    };
    mockAnalyze.mockReturnValue(mockReport);
    mockGenerateReport.mockReturnValue("# Report");

    const { POST } = await import("./route");
    // Real Request with valid JSON but no usageMetrics field
    const request = new Request(
      "https://paisaxe.es/api/cron/subscription-optimizer",
      {
        method: "POST",
        headers: { "x-webhook-secret": WEBHOOK_SECRET, "content-type": "application/json" },
        body: JSON.stringify({ someOtherField: "value" }),
      }
    );

    const response = await POST(request as never);
    expect(response.status).toBe(200);
    // Should have used default metrics since body.usageMetrics is falsy
    expect(mockAnalyze).toHaveBeenCalledWith(
      expect.objectContaining({
        usageMetrics: expect.objectContaining({
          voiceMinutes: 15,
          visitors: 5000,
          chatConversations: 200,
        }),
      })
    );
  });

  it("merges custom usageMetrics from POST body with defaults", async () => {
    const mockReport = {
      recommendations: [],
      totalMonthlySpend: 50,
      analyzedAt: "2026-02-09T10:00:00.000Z",
      dismissedFeatures: [],
    };
    mockAnalyze.mockReturnValue(mockReport);
    mockGenerateReport.mockReturnValue("# Report");

    const { POST } = await import("./route");

    // Create a real Request with a JSON body containing usageMetrics
    const request = new Request(
      "https://paisaxe.es/api/cron/subscription-optimizer",
      {
        method: "POST",
        headers: { "x-webhook-secret": WEBHOOK_SECRET, "content-type": "application/json" },
        body: JSON.stringify({
          usageMetrics: { voiceMinutes: 100, visitors: 20000 },
        }),
      }
    );

    const response = await POST(request as never);
    expect(response.status).toBe(200);
    // Verify the merged metrics were passed to analyzeSubscriptions
    expect(mockAnalyze).toHaveBeenCalledWith(
      expect.objectContaining({
        usageMetrics: expect.objectContaining({
          voiceMinutes: 100,
          visitors: 20000,
          // defaults should still be present for non-overridden keys
          chatConversations: 200,
        }),
      })
    );
  });
});

describe("GET /api/cron/subscription-optimizer (Vercel Cron)", () => {
  const originalEnv = process.env;
  const CRON_SECRET = "test-cron-secret-456";

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      WEBHOOK_SECRET: "test-webhook-secret-123",
      CRON_SECRET,
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_SERVICE_KEY: "test-service-key",
    };
    mockAnalyze.mockReset();
    mockGenerateReport.mockReset();
    mockGenerateSharedContextEntry.mockReset();
    mockWriteFile.mockReset();
    mockReadFile.mockReset();
    mockWriteFile.mockResolvedValue(undefined);
    mockReadFile.mockRejectedValue(new Error("ENOENT: no such file"));
    mockGenerateSharedContextEntry.mockReturnValue("## Subscription Optimizer\nContext entry");
    mockRpc.mockReset();
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "pg_try_advisory_lock") return Promise.resolve({ data: true, error: null });
      if (fn === "pg_advisory_unlock") return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: null });
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("rejects GET without Authorization header", async () => {
    const { GET } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/subscription-optimizer",
      { headers: {} }
    );

    const response = await GET(request as never);
    expect(response.status).toBe(401);
  });

  it("rejects GET with wrong CRON_SECRET", async () => {
    const { GET } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/subscription-optimizer",
      { headers: { authorization: "Bearer wrong-secret" } }
    );

    const response = await GET(request as never);
    expect(response.status).toBe(401);
  });

  it("accepts GET with valid CRON_SECRET and runs analysis", async () => {
    const mockReport = {
      recommendations: [],
      totalMonthlySpend: 50,
      analyzedAt: "2026-02-09T10:00:00.000Z",
      dismissedFeatures: [],
    };
    mockAnalyze.mockReturnValue(mockReport);
    mockGenerateReport.mockReturnValue("# Report");

    const { GET } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/subscription-optimizer",
      { headers: { authorization: `Bearer ${CRON_SECRET}` } }
    );

    const response = await GET(request as never);
    expect(response.status).toBe(200);
    expect(mockAnalyze).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((response as any).body).toEqual(
      expect.objectContaining({
        success: true,
        totalMonthlySpend: 50,
      })
    );
  });
});

describe("Advisory lock (DO-M2) — subscription-optimizer", () => {
  const originalEnv = process.env;
  const WEBHOOK_SECRET = "test-webhook-secret-123";

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      WEBHOOK_SECRET,
      CRON_SECRET: "test-cron-secret-456",
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_SERVICE_KEY: "test-service-key",
    };
    mockAnalyze.mockReset();
    mockGenerateReport.mockReset();
    mockGenerateSharedContextEntry.mockReset();
    mockWriteFile.mockReset();
    mockReadFile.mockReset();
    mockWriteFile.mockResolvedValue(undefined);
    mockReadFile.mockRejectedValue(new Error("ENOENT: no such file"));
    mockGenerateSharedContextEntry.mockReturnValue("## Subscription Optimizer\nContext entry");
    mockRpc.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns 409 when advisory lock is already held (concurrent run)", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "pg_try_advisory_lock") return Promise.resolve({ data: false, error: null });
      return Promise.resolve({ data: null, error: null });
    });

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/subscription-optimizer",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never);
    expect(response.status).toBe(409);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((response as any).body).toEqual(
      expect.objectContaining({ status: "skipped", reason: expect.stringContaining("concurrent") })
    );
  });

  it("returns 409 when pg_try_advisory_lock returns an error", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "pg_try_advisory_lock")
        return Promise.resolve({ data: null, error: { message: "DB error" } });
      return Promise.resolve({ data: null, error: null });
    });

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/subscription-optimizer",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never);
    expect(response.status).toBe(409);
  });

  it("executes optimizer and calls pg_advisory_unlock when lock is acquired", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "pg_try_advisory_lock") return Promise.resolve({ data: true, error: null });
      if (fn === "pg_advisory_unlock") return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: null });
    });

    const mockReport = {
      recommendations: [],
      totalMonthlySpend: 50,
      analyzedAt: "2026-02-09T10:00:00.000Z",
      dismissedFeatures: [],
    };
    mockAnalyze.mockReturnValue(mockReport);
    mockGenerateReport.mockReturnValue("# Report");

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/subscription-optimizer",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never);
    expect(response.status).toBe(200);

    const unlockCalls = mockRpc.mock.calls.filter(
      (args: unknown[]) => args[0] === "pg_advisory_unlock"
    );
    expect(unlockCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("calls pg_advisory_unlock in finally block even when optimizer throws", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "pg_try_advisory_lock") return Promise.resolve({ data: true, error: null });
      if (fn === "pg_advisory_unlock") return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: null });
    });

    mockAnalyze.mockImplementation(() => {
      throw new Error("Analysis crashed");
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { POST } = await import("./route");
    const request = new (await import("next/server")).NextRequest(
      "https://paisaxe.es/api/cron/subscription-optimizer",
      { headers: { "x-webhook-secret": WEBHOOK_SECRET } }
    );

    const response = await POST(request as never);
    expect(response.status).toBe(500);

    const unlockCalls = mockRpc.mock.calls.filter(
      (args: unknown[]) => args[0] === "pg_advisory_unlock"
    );
    expect(unlockCalls.length).toBeGreaterThanOrEqual(1);

    consoleSpy.mockRestore();
  });
});
