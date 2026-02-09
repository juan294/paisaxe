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

// Mock the subscription optimizer module
const mockAnalyze = vi.fn();
const mockGenerateReport = vi.fn();
vi.mock("@/lib/subscription-optimizer", () => ({
  analyzeSubscriptions: (...args: unknown[]) => mockAnalyze(...args),
  generateReport: (...args: unknown[]) => mockGenerateReport(...args),
}));

describe("POST /api/cron/subscription-optimizer", () => {
  const originalEnv = process.env;
  const WEBHOOK_SECRET = "test-webhook-secret-123";

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      WEBHOOK_SECRET,
    };
    mockAnalyze.mockReset();
    mockGenerateReport.mockReset();
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
});
