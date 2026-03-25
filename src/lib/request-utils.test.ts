import { describe, it, expect } from "vitest";
import { getClientIp } from "./request-utils";

describe("getClientIp", () => {
  it("returns first IP from x-forwarded-for header", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.50" },
    });
    expect(getClientIp(request)).toBe("203.0.113.50");
  });

  it("handles comma-separated x-forwarded-for values", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.50, 70.41.3.18, 150.172.238.178" },
    });
    expect(getClientIp(request)).toBe("203.0.113.50");
  });

  it("trims whitespace from x-forwarded-for values", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "  203.0.113.50  , 70.41.3.18" },
    });
    expect(getClientIp(request)).toBe("203.0.113.50");
  });

  it("falls back to x-real-ip header", () => {
    const request = new Request("http://localhost", {
      headers: { "x-real-ip": "198.51.100.23" },
    });
    expect(getClientIp(request)).toBe("198.51.100.23");
  });

  it("prefers x-forwarded-for over x-real-ip", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "203.0.113.50",
        "x-real-ip": "198.51.100.23",
      },
    });
    expect(getClientIp(request)).toBe("203.0.113.50");
  });

  it('returns "unknown" when no IP headers are present', () => {
    const request = new Request("http://localhost");
    expect(getClientIp(request)).toBe("unknown");
  });

  it('returns "unknown" when x-forwarded-for is empty string', () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "" },
    });
    expect(getClientIp(request)).toBe("unknown");
  });

  it("falls back to x-real-ip when x-forwarded-for first entry is whitespace-only", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": " , 70.41.3.18",
        "x-real-ip": "198.51.100.23",
      },
    });
    expect(getClientIp(request)).toBe("198.51.100.23");
  });
});
