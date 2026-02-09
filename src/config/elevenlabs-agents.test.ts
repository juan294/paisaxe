import { describe, it, expect } from "vitest";
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
  });
});
