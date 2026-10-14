import { describe, expect, it, vi } from "vitest";
import { readRetryAfter } from "./retry-after";
describe("retry timing", () => {
  it("reads seconds, HTTP dates and a safe fallback", () => {
    const now = Date.now(); const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    expect(readRetryAfter(new Response(null, { headers: { "Retry-After": "17" } }))).toBe(17);
    expect(readRetryAfter(new Response(null, { headers: { "Retry-After": new Date(now + 20_000).toUTCString() } }))).toBe(20);
    expect(readRetryAfter(new Response(null))).toBe(60);
    expect(readRetryAfter(new Response(null, { headers: { "Retry-After": "bad" } }))).toBe(60);
    clock.mockRestore();
  });
});
