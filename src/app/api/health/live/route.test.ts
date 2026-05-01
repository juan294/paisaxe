import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/health/live", () => {
  it("always returns HTTP 200 regardless of backend state", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
  });

  it("returns a minimal payload with status=live and a timestamp", async () => {
    const response = await GET();
    const data = await response.json();

    expect(data).toEqual({
      status: "live",
      timestamp: expect.any(String),
    });
  });

  it("returns exactly two fields — no diagnostic data leaked", async () => {
    const response = await GET();
    const data = await response.json();

    expect(Object.keys(data)).toEqual(["status", "timestamp"]);
  });

  it("timestamp is a valid ISO-8601 string", async () => {
    const response = await GET();
    const data = await response.json();

    expect(() => new Date(data.timestamp).toISOString()).not.toThrow();
    expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
  });

  it("sets Cache-Control: no-store", async () => {
    const response = await GET();
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
  });

  // DO-B1 regression: Upptime must never get a non-200 from this endpoint
  it("DO-B1: never returns 503 — liveness contract for Upptime", async () => {
    const response = await GET();
    expect(response.status).not.toBe(503);
    expect(response.status).toBe(200);
  });
});
