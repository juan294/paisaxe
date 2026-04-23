import { describe, expect, it } from "vitest";
import { createHash } from "crypto";
import { sanitizeSentryEvent } from "./sentry-before-send";
import { runWithRequestContext } from "./request-context";
import type { ErrorEvent } from "@sentry/core";

describe("sanitizeSentryEvent", () => {
  it("removes request cookies and data, redacts sensitive headers, and hashes user email", async () => {
    const event = await sanitizeSentryEvent({
      request: {
        cookies: {
          session: "sb-access=secret-cookie",
        },
        data: {
          phone: "+34 611 22 33 44",
        },
        headers: {
          "x-request-id": "req-header-1234",
          cookie: "sb-access=secret-cookie",
          authorization: "Bearer super-secret",
          "x-api-key": "api-key-value",
          "content-type": "application/json",
        },
      },
      user: {
        email: "traveler@example.com",
        id: "user-123",
      },
      type: undefined,
    } satisfies ErrorEvent);

    const expectedHash = createHash("sha256")
      .update("traveler@example.com")
      .digest("hex");

    expect(event.request?.cookies).toBeUndefined();
    expect(event.request?.data).toBeUndefined();
    expect(event.request?.headers?.cookie).toBe("[REDACTED]");
    expect(event.request?.headers?.authorization).toBe("[REDACTED]");
    expect(event.request?.headers?.["x-api-key"]).toBe("[REDACTED]");
    expect(event.request?.headers?.["content-type"]).toBe("application/json");
    expect(event.tags?.request_id).toBe("req-header-1234");
    expect(event.user?.email).toBe(`sha256:${expectedHash}`);
    expect(event.user?.id).toBe("user-123");
  });

  it("prefers the async request context when available", async () => {
    const event = await runWithRequestContext(
      { requestId: "req-context-5678" },
      () =>
        sanitizeSentryEvent({
          request: {
            headers: {
              "x-request-id": "req-header-1234",
            },
          },
          type: undefined,
        } satisfies ErrorEvent)
    );

    expect(event.tags?.request_id).toBe("req-context-5678");
  });
});
