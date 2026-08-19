import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const logger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger }));

// AR-M2 (#859): this route now uses the RLS-scoped withAdminRead wrapper
// instead of validateAdminAuth() + createAdminClient() directly.
const mockWithAdminRead = vi.fn();
vi.mock("@/lib/admin-auth", () => ({
  withAdminRead: (...args: unknown[]) => mockWithAdminRead(...args),
}));

// Create mock for Supabase
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockEq = vi.fn();
const mockRange = vi.fn();

function buildMockClient(
  resolver: () => Promise<{ data: unknown; error: unknown; count: number | null }> = () =>
    Promise.resolve({ data: [], error: null, count: 0 })
) {
  return {
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
                        return resolver();
                      },
                    };
                  },
                  range: (...rangeArgs: unknown[]) => {
                    mockRange(...rangeArgs);
                    return resolver();
                  },
                };
              },
              range: (...rangeArgs: unknown[]) => {
                mockRange(...rangeArgs);
                return resolver();
              },
            };
          },
        };
      },
    }),
  };
}

// Import after mocks
import { GET } from "./route";

describe("/api/admin/marketing/agent-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authorized — call handler with a mock RLS-scoped client.
    mockWithAdminRead.mockImplementation(
      async (handler: (client: unknown) => Promise<unknown>) => handler(buildMockClient())
    );
  });

  describe("GET", () => {
    it("should return 401 if not authenticated", async () => {
      mockWithAdminRead.mockResolvedValueOnce(
        NextResponse.json({ error: "Not authenticated" }, { status: 401 })
      );

      const request = new NextRequest("http://localhost/api/admin/marketing/agent-logs");

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Not authenticated");
    });

    it("should pass the request through to withAdminRead (for request-context wiring)", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/agent-logs");

      await GET(request);

      expect(mockWithAdminRead).toHaveBeenCalledWith(expect.any(Function), request);
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
      mockWithAdminRead.mockImplementation(
        async (handler: (client: unknown) => Promise<unknown>) =>
          handler(
            buildMockClient(() =>
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
              })
            )
          )
      );

      const request = new NextRequest("http://localhost/api/admin/marketing/agent-logs");

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // The conversion should happen via rowToMarketingAgentLog
      expect(data.data).toBeDefined();
      expect(data.data).toHaveLength(1);
    });

    it("should return 500 when database query returns an error", async () => {
      mockWithAdminRead.mockImplementation(
        async (handler: (client: unknown) => Promise<unknown>) =>
          handler(
            buildMockClient(() =>
              Promise.resolve({
                data: null,
                error: { message: "relation does not exist", code: "42P01" },
                count: null,
              })
            )
          )
      );

      const request = new NextRequest("http://localhost/api/admin/marketing/agent-logs");

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch logs");
    });

    it("should return 500 when an unexpected exception is thrown", async () => {
      mockWithAdminRead.mockImplementation(async (handler: (client: unknown) => Promise<unknown>) => {
        try {
          return await handler({
            from: () => {
              throw new Error("Connection refused");
            },
          });
        } catch {
          throw new Error("should not reach here — route catches internally");
        }
      });

      const request = new NextRequest("http://localhost/api/admin/marketing/agent-logs");

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("should return 500 when a non-Error value is thrown", async () => {
      mockWithAdminRead.mockImplementation(async (handler: (client: unknown) => Promise<unknown>) =>
        handler({
          from: () => {

            throw "string error without Error class";
          },
        })
      );

      const request = new NextRequest("http://localhost/api/admin/marketing/agent-logs");

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });

  it("should use logger.error (not console.error) on unhandled GET error", async () => {
    mockWithAdminRead.mockImplementation(async (handler: (client: unknown) => Promise<unknown>) =>
      handler({
        from: () => {
          throw new Error("Connection refused");
        },
      })
    );

    const request = new NextRequest("http://localhost/api/admin/marketing/agent-logs");

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await GET(request);
    consoleSpy.mockRestore();

    expect(response.status).toBe(500);
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });
});
