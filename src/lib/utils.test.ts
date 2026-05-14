import { describe, it, expect } from "vitest";
import { cn, formatTimestamp } from "./utils";

describe("utils", () => {
  describe("cn", () => {
    it("should merge class names", () => {
      expect(cn("foo", "bar")).toBe("foo bar");
    });

    it("should handle conditional classes", () => {
      expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
    });

    it("should merge tailwind classes correctly", () => {
      expect(cn("p-4", "p-2")).toBe("p-2");
    });
  });

  describe("formatTimestamp", () => {
    it("should format date to HH:MM", () => {
      const date = new Date("2024-01-15T14:30:00");
      const result = formatTimestamp(date);
      expect(result).toMatch(/^\d{1,2}:\d{2}$/);
    });
  });
});
