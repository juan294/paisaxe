import { describe, it, expect } from "vitest";
import { isNewStory } from "./freshness";

describe("isNewStory", () => {
  // Fixed reference date: 2025-01-15T12:00:00.000Z
  const now = new Date("2025-01-15T12:00:00.000Z");

  it("should consider a story created today as new", () => {
    const createdAt = "2025-01-15T08:00:00.000Z";
    expect(isNewStory(createdAt, now)).toBe(true);
  });

  it("should consider a story created 13 days ago as new", () => {
    const createdAt = "2025-01-02T12:00:00.000Z";
    expect(isNewStory(createdAt, now)).toBe(true);
  });

  it("should consider a story created exactly 14 days ago as new (boundary)", () => {
    const createdAt = "2025-01-01T12:00:00.000Z";
    expect(isNewStory(createdAt, now)).toBe(true);
  });

  it("should NOT consider a story created 15 days ago as new", () => {
    const createdAt = "2024-12-31T12:00:00.000Z";
    expect(isNewStory(createdAt, now)).toBe(false);
  });

  it("should NOT consider a story created 30 days ago as new", () => {
    const createdAt = "2024-12-16T12:00:00.000Z";
    expect(isNewStory(createdAt, now)).toBe(false);
  });

  it("should accept an optional now parameter for deterministic testing", () => {
    const createdAt = "2025-06-01T00:00:00.000Z";
    const customNow = new Date("2025-06-10T00:00:00.000Z");
    expect(isNewStory(createdAt, customNow)).toBe(true);

    const farFutureNow = new Date("2025-07-01T00:00:00.000Z");
    expect(isNewStory(createdAt, farFutureNow)).toBe(false);
  });

  it("should use current date when now parameter is omitted", () => {
    // A story created right now should always be new
    const createdAt = new Date().toISOString();
    expect(isNewStory(createdAt)).toBe(true);
  });
});
