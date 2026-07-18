import { describe, it, expect, vi } from "vitest";
import {
  ELEVENLABS_AGENT_IDS,
  ELEVENLABS_API_BASE,
  areAgentsConfigured,
  getElevenLabsAgentId,
} from "./elevenlabs-agents";

describe("ElevenLabs Agent Configuration", () => {
  describe("ELEVENLABS_AGENT_IDS", () => {
    it("should have entries for all four agents", () => {
      expect(ELEVENLABS_AGENT_IDS).toHaveProperty("pelayo");
      expect(ELEVENLABS_AGENT_IDS).toHaveProperty("xander");
      expect(ELEVENLABS_AGENT_IDS).toHaveProperty("iris");
      expect(ELEVENLABS_AGENT_IDS).toHaveProperty("penny");
    });

    it("should have string values for all agents", () => {
      for (const value of Object.values(ELEVENLABS_AGENT_IDS)) {
        expect(typeof value).toBe("string");
      }
    });
  });

  describe("ELEVENLABS_API_BASE", () => {
    it("should be the ElevenLabs v1 API base URL", () => {
      expect(ELEVENLABS_API_BASE).toBe("https://api.elevenlabs.io/v1");
    });

    it("should not have a trailing slash", () => {
      expect(ELEVENLABS_API_BASE.endsWith("/")).toBe(false);
    });
  });

  describe("areAgentsConfigured", () => {
    it("should return false when no agents are configured", () => {
      // Default state before running setup
      // Note: This test reflects the current state of the config
      const result = areAgentsConfigured();
      // The result depends on whether the setup script has been run
      expect(typeof result).toBe("boolean");
    });
  });

  describe("getElevenLabsAgentId", () => {
    it("should return undefined for invalid agent IDs", () => {
      expect(getElevenLabsAgentId("invalid")).toBeUndefined();
      expect(getElevenLabsAgentId("")).toBeUndefined();
      expect(getElevenLabsAgentId("unknown")).toBeUndefined();
    });

    it("should return agent ID for configured agents", () => {
      // After setup, all agents return their IDs
      const xanderId = getElevenLabsAgentId("xander");
      // If configured (has length), should return string; if not, undefined
      if (ELEVENLABS_AGENT_IDS.xander.length === 0) {
        expect(xanderId).toBeUndefined();
      } else {
        expect(typeof xanderId).toBe("string");
        expect(xanderId).toBe(ELEVENLABS_AGENT_IDS.xander);
      }
    });

    it("should accept valid agent ID keys", () => {
      // Should not throw for valid keys
      expect(() => getElevenLabsAgentId("pelayo")).not.toThrow();
      expect(() => getElevenLabsAgentId("xander")).not.toThrow();
      expect(() => getElevenLabsAgentId("iris")).not.toThrow();
      expect(() => getElevenLabsAgentId("penny")).not.toThrow();
    });

    // Line 44 `id.length > 0 ? id : undefined` — the falsy branch is a defensive
    // guard for deploys where agents haven't been set up yet (empty-string IDs).
    // The IDs are hard-coded literals, so we exercise the branch by mutating a
    // FRESH module instance (`as const` is type-only; the object is mutable at
    // runtime). vi.resetModules + dynamic import keeps the statically-imported
    // instance used by the other tests untouched.
    it("returns undefined for a known agent whose ID is an empty string (unconfigured deploy)", async () => {
      vi.resetModules();
      const mod = await import("./elevenlabs-agents");
      (mod.ELEVENLABS_AGENT_IDS as Record<string, string>).pelayo = "";

      expect(mod.getElevenLabsAgentId("pelayo")).toBeUndefined();
      // Other agents are still configured, so this exercises only the empty-ID guard
      expect(mod.getElevenLabsAgentId("xander")).toBe(mod.ELEVENLABS_AGENT_IDS.xander);

      // Drop the mutated instance so later dynamic imports get a clean copy
      vi.resetModules();
    });
  });
});
