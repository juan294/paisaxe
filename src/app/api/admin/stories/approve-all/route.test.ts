import { requiredValue } from "@/test/required-value";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

const logger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger }));

// Mock admin auth
vi.mock("@/lib/admin-auth", async () => {
  const { mockAdminBoundary } = await import("@/test/mock-admin-boundary");
  return mockAdminBoundary(vi.fn());
});

// Mock supabase
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: vi.fn(),
}));

// Mock fetch for webhook fan-out
const mockFetch = vi.fn();
const storyId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const approvalRequest = (storyIds = [storyId(1), storyId(2), storyId(3)]) => new NextRequest("http://localhost/api/admin/stories/approve-all", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storyIds }),
});
vi.stubGlobal("fetch", mockFetch);

import { validateAdminAuth } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";

const mockValidateAdminAuth = validateAdminAuth as ReturnType<typeof vi.fn>;
const mockCreateAdminClient = createAdminClient as ReturnType<typeof vi.fn>;

describe("POST /api/admin/stories/approve-all", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateAdminAuth.mockResolvedValue({ valid: true });
  });

  it("should return 401 if not authenticated", async () => {
    mockValidateAdminAuth.mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });

    const request = approvalRequest();

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("approves only the explicit snapshot while rows remain pending", async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: [{ id: storyId(1) }, { id: storyId(2) }, { id: storyId(3) }],
      error: null,
    });
    const mockIn = vi.fn().mockReturnValue({ select: mockSelect });
    const mockEq = vi.fn().mockReturnValue({ in: mockIn });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
    mockCreateAdminClient.mockReturnValue({ from: mockFrom });

    const request = approvalRequest();

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.approvedCount).toBe(3);
    expect(data.data.approvedIds).toEqual([storyId(1), storyId(2), storyId(3)]);

    expect(mockUpdate).toHaveBeenCalledWith({ curation_status: "approved" });
    expect(mockEq).toHaveBeenCalledWith("curation_status", "needs_curation");
    expect(mockIn).toHaveBeenCalledWith("id", [storyId(1), storyId(2), storyId(3)]);
  });

  it.each([{}, { storyIds: [] }, { storyIds: ["not-a-uuid"] }, { storyIds: [storyId(1), storyId(1)] }])("rejects a missing or ambiguous approval snapshot: %j", async (body) => {
    const response = await POST(new NextRequest("http://localhost/api/admin/stories/approve-all", {
      method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
    }));
    expect(response.status).toBe(400);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it("reports the exact completed batch if a later batch fails, without retrying or approving later arrivals", async () => {
    const ids = Array.from({ length: 129 }, (_, i) => storyId(i + 1));
    const select = vi.fn().mockResolvedValueOnce({ data: ids.slice(0, 100).map(id => ({ id })), error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "Batch failed" } });
    const inIds = vi.fn().mockReturnValue({ select });
    const eq = vi.fn().mockReturnValue({ in: inIds });
    mockCreateAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue({ update: vi.fn().mockReturnValue({ eq }) }) });
    const response = await POST(approvalRequest(ids));
    expect(response.status).toBe(500);
    expect((await response.json()).data).toEqual({ approvedCount: 100, approvedIds: ids.slice(0, 100) });
    expect(inIds.mock.calls).toEqual([["id", ids.slice(0, 100)], ["id", ids.slice(100)]]);
    expect(eq).toHaveBeenCalledWith("curation_status", "needs_curation");
    expect(select).toHaveBeenCalledTimes(2);
  });

  it("should handle null data response gracefully", async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const mockIn = vi.fn().mockReturnValue({ select: mockSelect });
    const mockEq = vi.fn().mockReturnValue({ in: mockIn });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
    mockCreateAdminClient.mockReturnValue({ from: mockFrom });

    const request = approvalRequest();

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.approvedCount).toBe(0);
    expect(data.data.approvedIds).toEqual([]);
  });

  it("should return success with 0 count when no pending stories", async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const mockIn = vi.fn().mockReturnValue({ select: mockSelect });
    const mockEq = vi.fn().mockReturnValue({ in: mockIn });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
    mockCreateAdminClient.mockReturnValue({ from: mockFrom });

    const request = approvalRequest();

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.approvedCount).toBe(0);
    expect(data.data.approvedIds).toEqual([]);
  });

  it("should return 500 on unexpected error (catch block)", async () => {
    mockCreateAdminClient.mockImplementation(() => {
      throw new Error("Unexpected error");
    });

    const request = approvalRequest();

    const response = await POST(request);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe("Internal server error");
  });

  it("should stringify a non-Error thrown value on unexpected error", async () => {
    mockCreateAdminClient.mockImplementation(() => {
       
      throw "raw string failure";
    });

    const request = approvalRequest();

    const response = await POST(request);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe("Internal server error");
    expect(logger.error).toHaveBeenCalledWith(
      "Admin approve-all API error:",
      { error: "raw string failure" }
    );
  });

  describe("BE-H3: bulk approval concurrency cap", () => {
    it("fires at most 5 concurrent webhook notifications when approving stories", async () => {
      // Arrange: 10 stories approved — fan-out must be capped at 5 concurrent
      const storyIds = Array.from({ length: 10 }, (_, i) => storyId(i + 1));
      const inflightCounts: number[] = [];
      let inflight = 0;

      const mockSelect = vi.fn().mockResolvedValue({
        data: storyIds.map((id) => ({ id })),
        error: null,
      });
      const mockIn = vi.fn().mockReturnValue({ select: mockSelect });
    const mockEq = vi.fn().mockReturnValue({ in: mockIn });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
      mockCreateAdminClient.mockReturnValue({ from: mockFrom });

      mockFetch.mockImplementation(async () => {
        inflight += 1;
        inflightCounts.push(inflight);
        // Small async pause so concurrent calls can accumulate
        await new Promise((resolve) => setTimeout(resolve, 0));
        inflight -= 1;
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      });

      vi.stubEnv("WEBHOOK_SECRET", "test-secret");
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");

      const request = approvalRequest(storyIds);

      await POST(request);

      // At no point should more than 5 concurrent webhook calls have been in-flight
      const maxConcurrent = Math.max(...inflightCounts);
      expect(maxConcurrent).toBeLessThanOrEqual(5);
      // All 10 stories should have been notified
      expect(mockFetch).toHaveBeenCalledTimes(10);
    });

    it("skips the webhook ping entirely when no base URL is configured", async () => {
      // Neither NEXT_PUBLIC_APP_URL nor VERCEL_URL set -> pingTranslateWebhook
      // should hit its early-return branch and never call fetch.
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
      vi.stubEnv("VERCEL_URL", "");
      vi.stubEnv("WEBHOOK_SECRET", "test-secret");

      const mockSelect = vi.fn().mockResolvedValue({
        data: [{ id: storyId(1) }],
        error: null,
      });
      const mockIn = vi.fn().mockReturnValue({ select: mockSelect });
    const mockEq = vi.fn().mockReturnValue({ in: mockIn });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
      mockCreateAdminClient.mockReturnValue({ from: mockFrom });

      const request = approvalRequest();

      const response = await POST(request);
      const data = await response.json();

      vi.unstubAllEnvs();

      expect(response.status).toBe(200);
      expect(data.data.approvedCount).toBe(1);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("does not call webhook when no stories are approved", async () => {
      const mockSelect = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });
      const mockIn = vi.fn().mockReturnValue({ select: mockSelect });
    const mockEq = vi.fn().mockReturnValue({ in: mockIn });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
      mockCreateAdminClient.mockReturnValue({ from: mockFrom });

      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      vi.stubEnv("WEBHOOK_SECRET", "test-secret");

      const request = approvalRequest();

      await POST(request);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("still returns success even when some webhook pings fail", async () => {
      // Webhook failures should not block the approve-all response
      const storyIds = [storyId(1), storyId(2)];
      const mockSelect = vi.fn().mockResolvedValue({
        data: storyIds.map((id) => ({ id })),
        error: null,
      });
      const mockIn = vi.fn().mockReturnValue({ select: mockSelect });
    const mockEq = vi.fn().mockReturnValue({ in: mockIn });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
      mockCreateAdminClient.mockReturnValue({ from: mockFrom });

      mockFetch.mockRejectedValue(new Error("Network error"));

      vi.stubEnv("WEBHOOK_SECRET", "test-secret");
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");

      const request = approvalRequest();

      const response = await POST(request);
      const data = await response.json();

      // Webhook failures are non-fatal — stories are still approved
      expect(response.status).toBe(200);
      expect(data.data.approvedCount).toBe(2);
    });

    it("stringifies a non-Error rejection from a failed webhook ping", async () => {
      // Exercises the `err instanceof Error ? err.message : String(err)` false
      // branch when fetch rejects with a non-Error value (e.g. a plain string).
      const mockSelect = vi.fn().mockResolvedValue({
        data: [{ id: storyId(1) }],
        error: null,
      });
      const mockIn = vi.fn().mockReturnValue({ select: mockSelect });
    const mockEq = vi.fn().mockReturnValue({ in: mockIn });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
      mockCreateAdminClient.mockReturnValue({ from: mockFrom });

       
      mockFetch.mockRejectedValue("raw string rejection");

      vi.stubEnv("WEBHOOK_SECRET", "test-secret");
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");

      const request = approvalRequest();

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.approvedCount).toBe(1);
      expect(logger.error).toHaveBeenCalledWith(
        "[APPROVE_ALL_WEBHOOK_PING_FAILED]",
        { story_id: storyId(1), error: "raw string rejection" }
      );
    });
  });

  describe("BE-L2: VERCEL_URL fallback (#795)", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("constructs an absolute https URL from VERCEL_URL when NEXT_PUBLIC_APP_URL is unset and VERCEL_ENV is production", async () => {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
      vi.stubEnv("VERCEL_URL", "my-app-abc123.vercel.app");
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("WEBHOOK_SECRET", "test-secret");

      const mockSelect = vi.fn().mockResolvedValue({
        data: [{ id: storyId(1) }],
        error: null,
      });
      const mockIn = vi.fn().mockReturnValue({ select: mockSelect });
    const mockEq = vi.fn().mockReturnValue({ in: mockIn });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
      mockCreateAdminClient.mockReturnValue({ from: mockFrom });

      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      const request = approvalRequest();
      await POST(request);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://my-app-abc123.vercel.app/api/webhooks/translate",
        expect.any(Object)
      );
    });

    it("does not use the VERCEL_URL fallback outside production (e.g. preview shares production Supabase)", async () => {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
      vi.stubEnv("VERCEL_URL", "my-app-preview-xyz.vercel.app");
      vi.stubEnv("VERCEL_ENV", "preview");
      vi.stubEnv("WEBHOOK_SECRET", "test-secret");

      const mockSelect = vi.fn().mockResolvedValue({
        data: [{ id: storyId(1) }],
        error: null,
      });
      const mockIn = vi.fn().mockReturnValue({ select: mockSelect });
    const mockEq = vi.fn().mockReturnValue({ in: mockIn });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
      mockCreateAdminClient.mockReturnValue({ from: mockFrom });

      const request = approvalRequest();
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.approvedCount).toBe(1);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("logs the missing base URL once for the whole batch, not once per approved story", async () => {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
      vi.stubEnv("VERCEL_URL", "");
      vi.stubEnv("VERCEL_ENV", "");
      vi.stubEnv("WEBHOOK_SECRET", "test-secret");

      const storyIds = [storyId(1), storyId(2), storyId(3)];
      const mockSelect = vi.fn().mockResolvedValue({
        data: storyIds.map((id) => ({ id })),
        error: null,
      });
      const mockIn = vi.fn().mockReturnValue({ select: mockSelect });
    const mockEq = vi.fn().mockReturnValue({ in: mockIn });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
      mockCreateAdminClient.mockReturnValue({ from: mockFrom });

      const request = approvalRequest();
      await POST(request);

      expect(mockFetch).not.toHaveBeenCalled();
      const skipLogCalls = logger.warn.mock.calls.filter(
        ([msg]) => msg === "[APPROVE_ALL_WEBHOOK_BASE_URL_MISSING]"
      );
      expect(skipLogCalls).toHaveLength(1);
      expect(requiredValue(skipLogCalls[0], "src/app/api/admin/stories/approve-all/route.test.ts:404 skipLogCalls[0]")[1]).toEqual({ approved_count: 3 });
    });
  });

  describe("PE-L2: webhook ping fetch timeout (#816)", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("includes an AbortSignal timeout on the translate-webhook ping fetch", async () => {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
      vi.stubEnv("WEBHOOK_SECRET", "test-secret");

      const mockSelect = vi.fn().mockResolvedValue({
        data: [{ id: storyId(1) }],
        error: null,
      });
      const mockIn = vi.fn().mockReturnValue({ select: mockSelect });
    const mockEq = vi.fn().mockReturnValue({ in: mockIn });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
      mockCreateAdminClient.mockReturnValue({ from: mockFrom });

      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      const request = approvalRequest();
      await POST(request);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, init] = requiredValue(mockFetch.mock.calls[0], "src/app/api/admin/stories/approve-all/route.test.ts:436 mockFetch.mock.calls[0]");
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });
  });

  it("should return 500 on database error", async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Database error" },
    });
    const mockIn = vi.fn().mockReturnValue({ select: mockSelect });
    const mockEq = vi.fn().mockReturnValue({ in: mockIn });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
    mockCreateAdminClient.mockReturnValue({ from: mockFrom });

    const request = approvalRequest();

    const response = await POST(request);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain("Approval stopped after 0 stories");
    expect(data.data).toEqual({ approvedCount: 0, approvedIds: [] });
  });

  it("should use logger.error (not console.error) on database error", async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Database error" },
    });
    const mockIn = vi.fn().mockReturnValue({ select: mockSelect });
    const mockEq = vi.fn().mockReturnValue({ in: mockIn });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
    mockCreateAdminClient.mockReturnValue({ from: mockFrom });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const request = approvalRequest();

    await POST(request);
    consoleSpy.mockRestore();

    expect(consoleSpy).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });
});
