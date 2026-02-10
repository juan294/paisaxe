import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchAgentsSummary,
  triggerAgentRun,
  fetchRunningAgents,
  stopAgent,
  fetchAgentLogs,
} from "./agents";

const ORIGIN = "https://paisaxe.es";

function mockResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("admin-api/agents", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    Object.defineProperty(window, "location", {
      value: { origin: ORIGIN },
      writable: true,
    });
  });

  // ─── fetchAgentsSummary ──────────────────────────────────────────

  describe("fetchAgentsSummary", () => {
    it("sends GET to /api/admin/agents-summary", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ data: { agents: [] } })
      );

      const result = await fetchAgentsSummary();

      expect(fetch).toHaveBeenCalledOnce();
      const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe("/api/admin/agents-summary");
      expect(result).toEqual({ data: { agents: [] } });
    });

    it("returns error from response body on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ error: "Unauthorized" }, false)
      );

      const result = await fetchAgentsSummary();

      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await fetchAgentsSummary();

      expect(result).toEqual({ error: "Failed to fetch agents summary" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network failure"));

      const result = await fetchAgentsSummary();

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── triggerAgentRun ─────────────────────────────────────────────

  describe("triggerAgentRun", () => {
    it("sends POST with agentKey in JSON body", async () => {
      const responseData = { started: true, agentKey: "xander", startedAt: "2026-01-01T00:00:00Z" };
      global.fetch = vi.fn().mockResolvedValue(mockResponse(responseData));

      const result = await triggerAgentRun("xander");

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe("/api/admin/agents/run");
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({ "Content-Type": "application/json" });
      expect(JSON.parse(init.body)).toEqual({ agentKey: "xander" });
      expect(result).toEqual({ data: responseData });
    });

    it("returns error from response body on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ error: "Agent already running" }, false)
      );

      const result = await triggerAgentRun("iris");

      expect(result).toEqual({ error: "Agent already running" });
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await triggerAgentRun("xander");

      expect(result).toEqual({ error: "Failed to start agent" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

      const result = await triggerAgentRun("xander");

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── fetchRunningAgents ──────────────────────────────────────────

  describe("fetchRunningAgents", () => {
    it("sends GET to /api/admin/agents/run", async () => {
      const responseData = { running: ["xander"] };
      global.fetch = vi.fn().mockResolvedValue(mockResponse(responseData));

      const result = await fetchRunningAgents();

      expect(fetch).toHaveBeenCalledOnce();
      const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe("/api/admin/agents/run");
      expect(result).toEqual({ data: responseData });
    });

    it("returns error from response body on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ error: "Forbidden" }, false)
      );

      const result = await fetchRunningAgents();

      expect(result).toEqual({ error: "Forbidden" });
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await fetchRunningAgents();

      expect(result).toEqual({ error: "Failed to fetch running agents" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Timeout"));

      const result = await fetchRunningAgents();

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── stopAgent ───────────────────────────────────────────────────

  describe("stopAgent", () => {
    it("sends DELETE with agentKey in JSON body", async () => {
      const responseData = { stopped: true, agentKey: "xander" };
      global.fetch = vi.fn().mockResolvedValue(mockResponse(responseData));

      const result = await stopAgent("xander");

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe("/api/admin/agents/run");
      expect(init.method).toBe("DELETE");
      expect(init.headers).toEqual({ "Content-Type": "application/json" });
      expect(JSON.parse(init.body)).toEqual({ agentKey: "xander" });
      expect(result).toEqual({ data: responseData });
    });

    it("returns error from response body on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ error: "Agent not running" }, false)
      );

      const result = await stopAgent("iris");

      expect(result).toEqual({ error: "Agent not running" });
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await stopAgent("xander");

      expect(result).toEqual({ error: "Failed to stop agent" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Timeout"));

      const result = await stopAgent("xander");

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── fetchAgentLogs ──────────────────────────────────────────────

  describe("fetchAgentLogs", () => {
    it("sends GET with agentKey query param", async () => {
      const responseData = { logs: [], finished: false };
      global.fetch = vi.fn().mockResolvedValue(mockResponse(responseData));

      const result = await fetchAgentLogs("xander");

      expect(fetch).toHaveBeenCalledOnce();
      const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const parsedUrl = new URL(String(url));
      expect(parsedUrl.searchParams.get("agentKey")).toBe("xander");
      expect(result).toEqual({ data: responseData });
    });

    it("appends since query param when provided", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ logs: [], finished: false })
      );

      await fetchAgentLogs("xander", 12345);

      const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const parsedUrl = new URL(String(url));
      expect(parsedUrl.searchParams.get("agentKey")).toBe("xander");
      expect(parsedUrl.searchParams.get("since")).toBe("12345");
    });

    it("omits since query param when not provided", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({ logs: [] }));

      await fetchAgentLogs("xander");

      const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const parsedUrl = new URL(String(url));
      expect(parsedUrl.searchParams.has("since")).toBe(false);
    });

    it("returns error from response body on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ error: "Not found" }, false)
      );

      const result = await fetchAgentLogs("unknown");

      expect(result).toEqual({ error: "Not found" });
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await fetchAgentLogs("xander");

      expect(result).toEqual({ error: "Failed to fetch agent logs" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("DNS failure"));

      const result = await fetchAgentLogs("xander");

      expect(result).toEqual({ error: "Network error" });
    });
  });
});
