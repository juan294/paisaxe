import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AGENT_FLAG_KEYS,
  AGENT_NAMES,
  relativeTime,
  formatElapsed,
  HEALTH_COLORS,
  HEALTH_TEXT_COLORS,
  HEALTH_BG,
  HEALTH_LABELS,
} from "./constants";

describe("agents-dashboard/constants", () => {
  describe("AGENT_FLAG_KEYS", () => {
    it("includes automated_agents master key", () => {
      expect(AGENT_FLAG_KEYS).toContain("automated_agents");
    });

    it("contains all expected agent flags", () => {
      expect(AGENT_FLAG_KEYS).toContain("coverage_agent_enabled");
      expect(AGENT_FLAG_KEYS).toContain("security_agent_enabled");
      expect(AGENT_FLAG_KEYS).toContain("documentation_agent_enabled");
      expect(AGENT_FLAG_KEYS).toContain("performance_agent_enabled");
      expect(AGENT_FLAG_KEYS).toContain("qa_agent_enabled");
      expect(AGENT_FLAG_KEYS).toContain("localization_agent_enabled");
    });
  });

  describe("AGENT_NAMES", () => {
    it("maps flag keys to display names", () => {
      expect(AGENT_NAMES["coverage_agent_enabled"]).toBe("Coverage Agent");
      expect(AGENT_NAMES["security_agent_enabled"]).toBe("Security Agent");
      expect(AGENT_NAMES["qa_agent_enabled"]).toBe("QA Agent");
    });
  });

  describe("relativeTime", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-16T12:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns 'Never' for null input", () => {
      expect(relativeTime(null)).toBe("Never");
    });

    it("returns minutes ago for recent times", () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60000).toISOString();
      expect(relativeTime(fiveMinutesAgo)).toBe("5m ago");
    });

    it("returns 0m ago for just now", () => {
      const justNow = new Date(Date.now() - 30000).toISOString();
      expect(relativeTime(justNow)).toBe("0m ago");
    });

    it("returns hours ago for older times", () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 3600000).toISOString();
      expect(relativeTime(threeHoursAgo)).toBe("3h ago");
    });

    it("switches to hours at exactly 60 minutes", () => {
      const sixtyMinutesAgo = new Date(Date.now() - 60 * 60000).toISOString();
      expect(relativeTime(sixtyMinutesAgo)).toBe("1h ago");
    });

    it("returns days ago for very old times", () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600000).toISOString();
      expect(relativeTime(twoDaysAgo)).toBe("2d ago");
    });

    it("switches to days at exactly 24 hours", () => {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 3600000).toISOString();
      expect(relativeTime(twentyFourHoursAgo)).toBe("1d ago");
    });
  });

  describe("formatElapsed", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-16T12:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("formats zero elapsed as 0:00", () => {
      const now = new Date().toISOString();
      expect(formatElapsed(now)).toBe("0:00");
    });

    it("formats seconds with zero-padding", () => {
      const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString();
      expect(formatElapsed(fiveSecondsAgo)).toBe("0:05");
    });

    it("formats minutes and seconds", () => {
      const elapsed = new Date(Date.now() - 125000).toISOString(); // 2m 5s
      expect(formatElapsed(elapsed)).toBe("2:05");
    });

    it("handles large values", () => {
      const tenMinutes = new Date(Date.now() - 600000).toISOString();
      expect(formatElapsed(tenMinutes)).toBe("10:00");
    });
  });

  describe("HEALTH_COLORS", () => {
    it("has all four health statuses", () => {
      expect(HEALTH_COLORS).toHaveProperty("green");
      expect(HEALTH_COLORS).toHaveProperty("yellow");
      expect(HEALTH_COLORS).toHaveProperty("red");
      expect(HEALTH_COLORS).toHaveProperty("unknown");
    });
  });

  describe("HEALTH_TEXT_COLORS", () => {
    it("has all four health statuses", () => {
      expect(HEALTH_TEXT_COLORS).toHaveProperty("green");
      expect(HEALTH_TEXT_COLORS).toHaveProperty("yellow");
      expect(HEALTH_TEXT_COLORS).toHaveProperty("red");
      expect(HEALTH_TEXT_COLORS).toHaveProperty("unknown");
    });
  });

  describe("HEALTH_BG", () => {
    it("has all four health statuses", () => {
      expect(HEALTH_BG).toHaveProperty("green");
      expect(HEALTH_BG).toHaveProperty("yellow");
      expect(HEALTH_BG).toHaveProperty("red");
      expect(HEALTH_BG).toHaveProperty("unknown");
    });
  });

  describe("HEALTH_LABELS", () => {
    it("maps statuses to human-readable labels", () => {
      expect(HEALTH_LABELS.green).toBe("All Systems Healthy");
      expect(HEALTH_LABELS.yellow).toBe("Some Warnings Detected");
      expect(HEALTH_LABELS.red).toBe("Critical Issues Found");
      expect(HEALTH_LABELS.unknown).toBe("Status Unknown");
    });
  });
});
