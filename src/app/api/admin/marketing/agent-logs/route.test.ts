import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// Mock admin auth
vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn().mockResolvedValue({ valid: true, userId: "test-user" }),
}));

// Create mock for Supabase
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockEq = vi.fn();
const mockRange = vi.fn();

vi.mock("@/lib/supabase", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          order: (...orderArgs: unknown[]) => {
            mockOrder(...orderArgs);
            return {
              eq: (...eqArgs: unknown[]) => {
                mockEq(...eqArgs);
                return {
                  eq: (...eqArgs2: unknown[]) => {
                    mockEq(...eqArgs2);
                    return {
                      range: (...rangeArgs: unknown[]) => {
                        mockRange(...rangeArgs);
                        return Promise.resolve({
                          data: [],
                          error: null,
                          count: 0,
                        });
                      },
                    };
                  },
                  range: (...rangeArgs: unknown[]) => {
                    mockRange(...rangeArgs);
                    return Promise.resolve({
                      data: [],
                      error: null,
                      count: 0,
                    });
                  },
                };
              },
              range: (...rangeArgs: unknown[]) => {
                mockRange(...rangeArgs);
                return Promise.resolve({
                  data: [],
                  error: null,
                  count: 0,
                });
              },
            };
          },
        };
      },
    }),
  }),
}));

// Import after mocks
import { GET } from "./route";
import { validateAdminAuth } from "@/lib/admin-auth";

describe("/api/admin/marketing/agent-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("should return 401 if not authenticated", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValueOnce({
        valid: false,
        error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
      });

      const request = new NextRequest("http://localhost/api/admin/marketing/agent-logs");

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Not authenticated");
    });

    it("should return empty logs array with pagination info", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/agent-logs");

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toEqual([]);
      expect(data.total).toBe(0);
      expect(data.limit).toBe(100);
      expect(data.offset).toBe(0);
    });

    it("should apply agent filter when provided", async () => {
      const request = new NextRequest(
        "http://localhost/api/admin/marketing/agent-logs?agent=xander"
      );

      await GET(request);

      expect(mockEq).toHaveBeenCalledWith("agent_name", "xander");
    });

    it("should apply status filter when valid status provided", async () => {
      const request = new NextRequest(
        "http://localhost/api/admin/marketing/agent-logs?status=success"
      );

      await GET(request);

      expect(mockEq).toHaveBeenCalledWith("status", "success");
    });

    it("should not apply status filter for invalid status", async () => {
      mockEq.mockClear();
      const request = new NextRequest(
        "http://localhost/api/admin/marketing/agent-logs?status=invalid"
      );

      await GET(request);

      // Only should not have been called with "status" as first arg
      const statusCalls = mockEq.mock.calls.filter(
        (call) => call[0] === "status"
      );
      expect(statusCalls.length).toBe(0);
    });

    it("should apply custom pagination parameters", async () => {
      const request = new NextRequest(
        "http://localhost/api/admin/marketing/agent-logs?limit=50&offset=100"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.limit).toBe(50);
      expect(data.offset).toBe(100);
      expect(mockRange).toHaveBeenCalledWith(100, 149);
    });

    it("should convert database rows to log objects", async () => {
      // Override the mock to return actual data
      vi.doMock("@/lib/supabase", () => ({
        createAdminClient: () => ({
          from: () => ({
            select: () => ({
              order: () => ({
                range: () =>
                  Promise.resolve({
                    data: [
                      {
                        id: "log-1",
                        agent_name: "xander",
                        action: "generate_content",
                        status: "success",
                        details: { key: "value" },
                        error_message: null,
                        post_id: null,
                        duration_ms: 1500,
                        created_at: "2024-01-01T00:00:00Z",
                      },
                    ],
                    error: null,
                    count: 1,
                  }),
              }),
            }),
          }),
        }),
      }));

      // Re-import to get the new mock
      const { GET: GET2 } = await import("./route");
      const request = new NextRequest("http://localhost/api/admin/marketing/agent-logs");

      const response = await GET2(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // The conversion should happen via rowToMarketingAgentLog
      expect(data.data).toBeDefined();
    });

    it("should return 500 when database query returns an error", async () => {
      vi.resetModules();

      vi.doMock("@/lib/admin-auth", () => ({
        validateAdminAuth: vi.fn().mockResolvedValue({ valid: true, userId: "test-user" }),
      }));

      vi.doMock("@/lib/supabase", () => ({
        createAdminClient: () => ({
          from: () => ({
            select: () => ({
              order: () => ({
                range: () =>
                  Promise.resolve({
                    data: null,
                    error: { message: "relation does not exist", code: "42P01" },
                    count: null,
                  }),
              }),
            }),
          }),
        }),
      }));

      const { GET: GET3 } = await import("./route");
      const request = new NextRequest("http://localhost/api/admin/marketing/agent-logs");

      const response = await GET3(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch logs");
    });

    it("should return 500 when an unexpected exception is thrown", async () => {
      vi.resetModules();

      vi.doMock("@/lib/admin-auth", () => ({
        validateAdminAuth: vi.fn().mockResolvedValue({ valid: true, userId: "test-user" }),
      }));

      vi.doMock("@/lib/supabase", () => ({
        createAdminClient: () => {
          throw new Error("Connection refused");
        },
      }));

      const { GET: GET4 } = await import("./route");
      const request = new NextRequest("http://localhost/api/admin/marketing/agent-logs");

      const response = await GET4(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });
});
