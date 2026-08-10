import { describe, it, expect } from "vitest";
import { CHAT_MODEL } from "./models";

describe("CHAT_MODEL", () => {
  it("is a non-empty string", () => {
    expect(typeof CHAT_MODEL).toBe("string");
    expect(CHAT_MODEL.length).toBeGreaterThan(0);
  });

  it("matches the claude model ID pattern", () => {
    // Claude 4.6+ model IDs are dateless pinned snapshots.
    expect(CHAT_MODEL).toMatch(/^claude-[a-z0-9]+-[a-z0-9-]+(?:-\d{8})?$/);
  });

  it("is the expected model ID", () => {
    expect(CHAT_MODEL).toBe("claude-sonnet-5");
  });
});
