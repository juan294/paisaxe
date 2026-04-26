import { describe, it, expect } from "vitest";
import { getClientIp } from "./request-utils";

describe("getClientIp", () => {
  it("returns first IP from x-forwarded-for header", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.50" },
    });
    expect(getClientIp(request)).toBe("203.0.113.50");
  });

  it("handles comma-separated x-forwarded-for values — uses LAST (Vercel LB-appended) IP", () => {
    // Vercel's LB appends the real client IP as the last entry; we trust the last.
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.50, 70.41.3.18, 150.172.238.178" },
    });
    expect(getClientIp(request)).toBe("150.172.238.178");
  });

  it("trims whitespace from x-forwarded-for last entry", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.50,   70.41.3.18  " },
    });
    expect(getClientIp(request)).toBe("70.41.3.18");
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

  it("falls back to x-real-ip when all x-forwarded-for entries are whitespace-only", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": " ,  ,  ",
        "x-real-ip": "198.51.100.23",
      },
    });
    expect(getClientIp(request)).toBe("198.51.100.23");
  });
});

describe("getClientIp — Vercel IP hardening", () => {
  it("prefers x-vercel-forwarded-for over x-forwarded-for (non-spoofable)", () => {
    // x-vercel-forwarded-for is set by Vercel infrastructure and cannot be
    // spoofed by the client, so it should take priority over x-forwarded-for
    const request = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "1.1.1.1",          // client-supplied — could be spoofed
        "x-vercel-forwarded-for": "203.0.113.50", // Vercel-set — trusted
      },
    });
    expect(getClientIp(request)).toBe("203.0.113.50");
  });

  it("uses x-vercel-forwarded-for even when x-forwarded-for has multiple entries", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "10.0.0.1, 10.0.0.2, 10.0.0.3", // spoofed chain
        "x-vercel-forwarded-for": "198.51.100.7",             // Vercel's real client IP
      },
    });
    expect(getClientIp(request)).toBe("198.51.100.7");
  });

  it("falls back to last entry of x-forwarded-for when x-vercel-forwarded-for is absent", () => {
    // Without Vercel's trusted header, the LAST entry added by the outermost
    // proxy (Vercel's LB) is the most trustworthy — not the first (client-supplied)
    const request = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "1.2.3.4, 5.6.7.8, 203.0.113.50",
      },
    });
    expect(getClientIp(request)).toBe("203.0.113.50");
  });

  it("spoofed first x-forwarded-for entry is NOT used as the IP", () => {
    const request = new Request("http://localhost", {
      headers: {
        // Attacker appends a fake IP as the first entry to bypass rate limits
        "x-forwarded-for": "127.0.0.1, 203.0.113.50",
      },
    });
    // Must NOT return the spoofed "127.0.0.1"
    expect(getClientIp(request)).not.toBe("127.0.0.1");
    // Should return the last (Vercel-appended) entry
    expect(getClientIp(request)).toBe("203.0.113.50");
  });
});
