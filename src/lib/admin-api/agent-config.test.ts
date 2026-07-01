import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchAgentConfig,
  updateAgentMaster,
  updateAgentEnabled,
  updateAgentConfigValue,
} from "./agent-config";

vi.mock("@/lib/csrf-client", () => ({
  csrfHeaders: vi.fn(() => ({ "x-csrf-token": "test-csrf-token" })),
}));

function mockResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

const mockConfigData = {
  data: {
    master_enabled: true,
    agents: {
      coverage_agent_enabled: { enabled: true, config: {} },
    },
  },
};

describe("admin-api/agent-config", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  // ─── fetchAgentConfig ─────────────────────────────────────────────

  describe("fetchAgentConfig", () => {
    it("sends GET to /api/admin/agent-config with cache bypass", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(mockConfigData));

      const result = await fetchAgentConfig();

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe("/api/admin/agent-config");
      expect(init?.cache).toBe("no-store");
      expect(result).toEqual(mockConfigData);
    });

    it("returns error from response body on non-ok response", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(mockResponse({ error: "Unauthorized" }, false));

      const result = await fetchAgentConfig();

      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await fetchAgentConfig();

      expect(result).toEqual({ error: "Failed to fetch agent config" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValue(new Error("Network failure"));

      const result = await fetchAgentConfig();

      expect(result).toEqual({ error: "Network error" });
    });

    it("returns network error when fetch throws a non-Error value", async () => {
      global.fetch = vi.fn().mockRejectedValue("plain string failure");

      const result = await fetchAgentConfig();

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── updateAgentMaster ────────────────────────────────────────────

  describe("updateAgentMaster", () => {
    it("sends PUT with master_enabled=true", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(mockConfigData));

      const result = await updateAgentMaster(true);

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe("/api/admin/agent-config");
      expect(init.method).toBe("PUT");
      expect(init.headers).toEqual({
        "Content-Type": "application/json",
        "x-csrf-token": "test-csrf-token",
      });
      expect(JSON.parse(init.body)).toEqual({ master_enabled: true });
      expect(result).toEqual(mockConfigData);
    });

    it("sends PUT with master_enabled=false", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(mockConfigData));

      await updateAgentMaster(false);

      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(JSON.parse(init.body)).toEqual({ master_enabled: false });
    });

    it("returns error from response body on non-ok response", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(mockResponse({ error: "Forbidden" }, false));

      const result = await updateAgentMaster(true);

      expect(result).toEqual({ error: "Forbidden" });
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await updateAgentMaster(true);

      expect(result).toEqual({ error: "Failed to update master toggle" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValue(new Error("Connection refused"));

      const result = await updateAgentMaster(true);

      expect(result).toEqual({ error: "Network error" });
    });

    it("returns network error when fetch throws a non-Error value", async () => {
      global.fetch = vi.fn().mockRejectedValue("plain string failure");

      const result = await updateAgentMaster(true);

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── updateAgentEnabled ───────────────────────────────────────────

  describe("updateAgentEnabled", () => {
    it("sends PUT with key and enabled=true", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(mockConfigData));

      const result = await updateAgentEnabled(
        "coverage_agent_enabled",
        true,
      );

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe("/api/admin/agent-config");
      expect(init.method).toBe("PUT");
      expect(init.headers).toEqual({
        "Content-Type": "application/json",
        "x-csrf-token": "test-csrf-token",
      });
      expect(JSON.parse(init.body)).toEqual({
        key: "coverage_agent_enabled",
        enabled: true,
      });
      expect(result).toEqual(mockConfigData);
    });

    it("sends PUT with key and enabled=false", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(mockConfigData));

      await updateAgentEnabled("security_agent_enabled", false);

      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(JSON.parse(init.body)).toEqual({
        key: "security_agent_enabled",
        enabled: false,
      });
    });

    it("returns error from response body on non-ok response", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(
          mockResponse({ error: "Unknown agent key" }, false),
        );

      const result = await updateAgentEnabled("bad_key", true);

      expect(result).toEqual({ error: "Unknown agent key" });
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await updateAgentEnabled(
        "coverage_agent_enabled",
        true,
      );

      expect(result).toEqual({ error: "Failed to update agent" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Timeout"));

      const result = await updateAgentEnabled(
        "coverage_agent_enabled",
        true,
      );

      expect(result).toEqual({ error: "Network error" });
    });

    it("returns network error when fetch throws a non-Error value", async () => {
      global.fetch = vi.fn().mockRejectedValue("plain string failure");

      const result = await updateAgentEnabled(
        "coverage_agent_enabled",
        true,
      );

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── updateAgentConfigValue ───────────────────────────────────────

  describe("updateAgentConfigValue", () => {
    it("sends PUT with key, config_key, and value", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(mockConfigData));

      const result = await updateAgentConfigValue(
        "coverage_agent_enabled",
        "schedule",
        "daily",
      );

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe("/api/admin/agent-config");
      expect(init.method).toBe("PUT");
      expect(init.headers).toEqual({
        "Content-Type": "application/json",
        "x-csrf-token": "test-csrf-token",
      });
      expect(JSON.parse(init.body)).toEqual({
        key: "coverage_agent_enabled",
        config_key: "schedule",
        value: "daily",
      });
      expect(result).toEqual(mockConfigData);
    });

    it("sends numeric values correctly", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(mockConfigData));

      await updateAgentConfigValue(
        "coverage_agent_enabled",
        "max_retries",
        3,
      );

      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(JSON.parse(init.body)).toEqual({
        key: "coverage_agent_enabled",
        config_key: "max_retries",
        value: 3,
      });
    });

    it("sends object values correctly", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(mockConfigData));

      const complexValue = { nested: true, items: [1, 2, 3] };
      await updateAgentConfigValue(
        "coverage_agent_enabled",
        "options",
        complexValue,
      );

      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(JSON.parse(init.body)).toEqual({
        key: "coverage_agent_enabled",
        config_key: "options",
        value: complexValue,
      });
    });

    it("returns error from response body on non-ok response", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(
          mockResponse({ error: "Invalid config key" }, false),
        );

      const result = await updateAgentConfigValue(
        "coverage_agent_enabled",
        "bad_key",
        "value",
      );

      expect(result).toEqual({ error: "Invalid config key" });
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await updateAgentConfigValue(
        "coverage_agent_enabled",
        "schedule",
        "daily",
      );

      expect(result).toEqual({ error: "Failed to update agent config" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValue(new Error("DNS resolution failed"));

      const result = await updateAgentConfigValue(
        "coverage_agent_enabled",
        "schedule",
        "daily",
      );

      expect(result).toEqual({ error: "Network error" });
    });

    it("logs String(error) when fetch throws a non-Error value", async () => {
      global.fetch = vi.fn().mockRejectedValue("non-error string");

      const result = await updateAgentConfigValue(
        "coverage_agent_enabled",
        "schedule",
        "daily",
      );

      expect(result).toEqual({ error: "Network error" });
    });
  });

  describe("non-Error throw coverage for instanceof ternary", () => {
    it("fetchAgentConfig logs String(error) when non-Error thrown", async () => {
      global.fetch = vi.fn().mockRejectedValue(42);
      const result = await fetchAgentConfig();
      expect(result).toEqual({ error: "Network error" });
    });

    it("updateAgentMaster logs String(error) when non-Error thrown", async () => {
      global.fetch = vi.fn().mockRejectedValue({ code: "ETIMEDOUT" });
      const result = await updateAgentMaster(true);
      expect(result).toEqual({ error: "Network error" });
    });

    it("updateAgentEnabled logs String(error) when non-Error thrown", async () => {
      global.fetch = vi.fn().mockRejectedValue(null);
      const result = await updateAgentEnabled("key", true);
      expect(result).toEqual({ error: "Network error" });
    });
  });
});
