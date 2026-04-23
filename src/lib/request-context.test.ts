import { describe, expect, it } from "vitest";
import {
  getRequestId,
  runWithRequestContext,
  withRequestContext,
} from "./request-context";

describe("request context", () => {
  it("returns undefined outside a request context", () => {
    expect(getRequestId()).toBeUndefined();
  });

  it("exposes the request ID inside an explicit async context", () => {
    const value = runWithRequestContext(
      { requestId: "req-12345678" },
      () => getRequestId()
    );

    expect(value).toBe("req-12345678");
  });

  it("hydrates context from the request header helper", () => {
    const request = new Request("https://paisaxe.test/", {
      headers: {
        "x-request-id": "req-header-1234",
      },
    });

    const value = withRequestContext(request, () => getRequestId());

    expect(value).toBe("req-header-1234");
  });
});
