import { describe, expect, it } from "vitest";
import { createHash } from "crypto";
import { sanitizeSentryEvent } from "./sentry-before-send";
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
    expect(event.user?.email).toBe(`sha256:${expectedHash}`);
    expect(event.user?.id).toBe("user-123");
  });
});
