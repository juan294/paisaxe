import { describe, it, expect } from "vitest";
import {
  readJsonBody,
  uuidParam,
  withRouteContext,
} from "./request-validation";
import { getRequestId } from "./request-context";

function jsonRequest(body: string): Request {
  return new Request("https://paisaxe.test/api/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("readJsonBody", () => {
  it("returns parsed data for valid JSON", async () => {
    const result = await readJsonBody(jsonRequest('{"a":1}'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ a: 1 });
    }
  });

  it("returns an error result for malformed JSON instead of throwing", async () => {
    const result = await readJsonBody(jsonRequest("{not json"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(400);
    }
  });
});

describe("uuidParam", () => {
  it("accepts a valid UUID", () => {
    const result = uuidParam("123e4567-e89b-42d3-a456-426614174000");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("123e4567-e89b-42d3-a456-426614174000");
    }
  });

  it("rejects a non-UUID string", () => {
    const result = uuidParam("not-a-uuid");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(400);
    }
  });

  it("rejects null/undefined", () => {
    expect(uuidParam(null).ok).toBe(false);
    expect(uuidParam(undefined).ok).toBe(false);
  });
});

describe("withRouteContext", () => {
  it("binds the request id from x-request-id into the request context", async () => {
    const request = new Request("https://paisaxe.test/", {
      headers: { "x-request-id": "req-route-1234" },
    });

    // Read the request id synchronously at handler entry so the binding is
    // observed regardless of whether the runtime backs the context with
    // AsyncLocalStorage or the synchronous fallback (the fallback restores on
    // the first awaited boundary).
    let captured: string | undefined;
    await withRouteContext(request, async () => {
      captured = getRequestId();
      return null;
    });

    expect(captured).toBe("req-route-1234");
  });

  it("runs the handler without a context when no header is present", async () => {
    const request = new Request("https://paisaxe.test/");
    let captured: string | undefined = "sentinel";
    await withRouteContext(request, async () => {
      captured = getRequestId();
      return null;
    });
    expect(captured).toBeUndefined();
  });
});
