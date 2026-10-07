import { describe, expect, it } from "vitest";
import { redactCapabilityPath, redactCapabilityPathsDeep } from "./redact-capability-path";

const CAP = "11111111-2222-4333-8444-555555555555.AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde";

describe("redactCapabilityPath (F05)", () => {
  it.each([
    [`/booking/${CAP}`, "/booking/[redacted]"],
    [`/booking/${CAP}/return`, "/booking/[redacted]/return"],
    [`/operator/${CAP}`, "/operator/[redacted]"],
    [`https://paisaxe.es/booking/${CAP}?cancelled=1`, "https://paisaxe.es/booking/[redacted]"],
    [`https://paisaxe.es/booking/${CAP}/return?token=5O190127TN364715T&PayerID=QYR5Z8XDVJNXQ`, "https://paisaxe.es/booking/[redacted]/return"],
    [`/booking/${CAP}#receipt`, "/booking/[redacted]#receipt"],
    [`/api/booking/bookings/${CAP}/payment`, "/api/booking/bookings/[redacted]/payment"],
  ])("redacts %s", (input, expected) => {
    expect(redactCapabilityPath(input)).toBe(expected);
  });

  it("redacts every occurrence inside free text (breadcrumb messages, referrers)", () => {
    expect(redactCapabilityPath(`navigated from /booking/${CAP} to /operator/${CAP}/x`)).toBe(
      "navigated from /booking/[redacted] to /operator/[redacted]/x"
    );
  });

  it.each(["/immersive?story=lagos", "/acceso", "/api/booking/chat/stream", "https://paisaxe.es/pricing?tier=day", "/bookings", ""])(
    "leaves %j untouched",
    (input) => {
      expect(redactCapabilityPath(input)).toBe(input);
    }
  );
});

describe("redactCapabilityPathsDeep", () => {
  it("redacts strings in plain objects and arrays", () => {
    expect(redactCapabilityPathsDeep({ a: [`/booking/${CAP}`], b: { c: `/operator/${CAP}` }, n: 1 })).toEqual({
      a: ["/booking/[redacted]"],
      b: { c: "/operator/[redacted]" },
      n: 1,
    });
  });

  it("returns Dates and class instances untouched (PostHog timestamps, Sentry scopes)", () => {
    class Scope {
      constructor(public url = `/booking/${CAP}`) {}
    }
    const timestamp = new Date("2026-10-03T10:00:00Z");
    const scope = new Scope();

    const result = redactCapabilityPathsDeep({ timestamp, scope, url: `/booking/${CAP}` });

    expect(result.timestamp).toBe(timestamp);
    expect(result.scope).toBe(scope);
    expect(result.url).toBe("/booking/[redacted]");
  });

  it("survives a cycle", () => {
    const node: Record<string, unknown> = { url: `/booking/${CAP}` };
    node.self = node;
    const result = redactCapabilityPathsDeep(node);
    expect(result.url).toBe("/booking/[redacted]");
  });
});
