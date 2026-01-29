import { describe, it, expect } from "vitest";
import {
  MARKETING_AGENTS,
  BRAND_VOICE_FILE,
  getAgentByPlatform,
  getAgentById,
  isValidAgentId,
  getAllAgents,
} from "./index";
import type { MarketingPlatform } from "@/types/marketing";

describe("Marketing Agents Configuration", () => {
  describe("MARKETING_AGENTS", () => {
    it("should have agents for all four platforms", () => {
      const platforms: MarketingPlatform[] = ["x", "instagram", "pinterest", "tiktok"];
      for (const platform of platforms) {
        expect(MARKETING_AGENTS[platform]).toBeDefined();
      }
    });

    it("should have correct agent IDs", () => {
      expect(MARKETING_AGENTS.x.id).toBe("xander");
      expect(MARKETING_AGENTS.instagram.id).toBe("iris");
      expect(MARKETING_AGENTS.pinterest.id).toBe("penny");
      expect(MARKETING_AGENTS.tiktok.id).toBe("tiko");
    });

    it("should have correct agent names", () => {
      expect(MARKETING_AGENTS.x.name).toBe("Xander");
      expect(MARKETING_AGENTS.instagram.name).toBe("Iris");
      expect(MARKETING_AGENTS.pinterest.name).toBe("Penny");
      expect(MARKETING_AGENTS.tiktok.name).toBe("Tiko");
    });

    it("should have persona files for each agent", () => {
      for (const agent of Object.values(MARKETING_AGENTS)) {
        expect(agent.personaFile).toMatch(/^src\/agents\/personas\/.+-agent\.md$/);
      }
    });

    it("should have descriptions for each agent", () => {
      for (const agent of Object.values(MARKETING_AGENTS)) {
        expect(agent.description).toBeTruthy();
        expect(typeof agent.description).toBe("string");
      }
    });

    it("should have capabilities array for each agent", () => {
      for (const agent of Object.values(MARKETING_AGENTS)) {
        expect(Array.isArray(agent.capabilities)).toBe(true);
        expect(agent.capabilities.length).toBeGreaterThan(0);
      }
    });

    it("should have limitations array for each agent", () => {
      for (const agent of Object.values(MARKETING_AGENTS)) {
        expect(Array.isArray(agent.limitations)).toBe(true);
        expect(agent.limitations.length).toBeGreaterThan(0);
      }
    });

    it("should have voice configuration for each agent", () => {
      for (const agent of Object.values(MARKETING_AGENTS)) {
        expect(agent.voice).toBeDefined();
        expect(agent.voice?.style).toBeTruthy();
        expect(agent.voice?.tone).toBeTruthy();
      }
    });

    it("should not have ElevenLabs voice IDs configured yet", () => {
      for (const agent of Object.values(MARKETING_AGENTS)) {
        expect(agent.voice?.elevenLabsVoiceId).toBeUndefined();
      }
    });
  });

  describe("BRAND_VOICE_FILE", () => {
    it("should point to the brand voice markdown file", () => {
      expect(BRAND_VOICE_FILE).toBe("src/agents/shared/brand-voice.md");
    });
  });

  describe("getAgentByPlatform", () => {
    it("should return correct agent for each platform", () => {
      expect(getAgentByPlatform("x").id).toBe("xander");
      expect(getAgentByPlatform("instagram").id).toBe("iris");
      expect(getAgentByPlatform("pinterest").id).toBe("penny");
      expect(getAgentByPlatform("tiktok").id).toBe("tiko");
    });
  });

  describe("getAgentById", () => {
    it("should return correct agent for valid IDs", () => {
      expect(getAgentById("xander")?.platform).toBe("x");
      expect(getAgentById("iris")?.platform).toBe("instagram");
      expect(getAgentById("penny")?.platform).toBe("pinterest");
      expect(getAgentById("tiko")?.platform).toBe("tiktok");
    });

    it("should return undefined for invalid IDs", () => {
      expect(getAgentById("invalid")).toBeUndefined();
      expect(getAgentById("")).toBeUndefined();
      expect(getAgentById("Xander")).toBeUndefined(); // case sensitive
    });
  });

  describe("isValidAgentId", () => {
    it("should return true for valid agent IDs", () => {
      expect(isValidAgentId("xander")).toBe(true);
      expect(isValidAgentId("iris")).toBe(true);
      expect(isValidAgentId("penny")).toBe(true);
      expect(isValidAgentId("tiko")).toBe(true);
    });

    it("should return false for invalid agent IDs", () => {
      expect(isValidAgentId("invalid")).toBe(false);
      expect(isValidAgentId("")).toBe(false);
      expect(isValidAgentId("Xander")).toBe(false);
      expect(isValidAgentId("x")).toBe(false); // platform, not agent ID
    });
  });

  describe("getAllAgents", () => {
    it("should return array of all four agents", () => {
      const agents = getAllAgents();
      expect(agents).toHaveLength(4);
    });

    it("should include all agent IDs", () => {
      const agents = getAllAgents();
      const ids = agents.map((a) => a.id);
      expect(ids).toContain("xander");
      expect(ids).toContain("iris");
      expect(ids).toContain("penny");
      expect(ids).toContain("tiko");
    });
  });
});
