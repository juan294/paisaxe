import { describe, expect, it } from "vitest";
import { getOrCreateRequestId } from "./request-id";

describe("getOrCreateRequestId", () => {
  it("uses a well-formed upstream request ID", () => {
    const request = new Request("https://paisaxe.test/", {
      headers: {
        "x-request-id": "abc-123_456",
      },
    });

    expect(getOrCreateRequestId(request)).toBe("abc-123_456");
  });

  it("generates a UUID when the upstream ID is missing", () => {
    const request = new Request("https://paisaxe.test/");

    expect(getOrCreateRequestId(request)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it("rejects malformed upstream IDs", () => {
    const request = new Request("https://paisaxe.test/", {
      headers: {
        "x-request-id": "bad/request/id",
      },
    });

    expect(getOrCreateRequestId(request)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });
});
