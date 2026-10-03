import { describe, expect, it } from "vitest";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { sanitizeSentryEvent, sanitizeSentryTransaction } from "./sentry-before-send";
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

  it("handles undefined request.headers gracefully", async () => {
    const event = await sanitizeSentryEvent({
      request: {
        cookies: { session: "abc" },
      },
      type: undefined,
    } satisfies ErrorEvent);

    expect(event.request?.headers).toBeUndefined();
    expect(event.request?.cookies).toBeUndefined();
  });

  it("normalizes request.url to its path, stripping query string and fragment", async () => {
    const event = await sanitizeSentryEvent({
      request: {
        url: "https://paisaxe.es/api/chat?session=abc123&token=secret#section",
      },
      type: undefined,
    } satisfies ErrorEvent);

    expect(event.request?.url).toBe("/api/chat");
  });

  it("normalizes a relative request.url with a query string to its path", async () => {
    const event = await sanitizeSentryEvent({
      request: {
        url: "/api/chat?session=abc123",
      },
      type: undefined,
    } satisfies ErrorEvent);

    expect(event.request?.url).toBe("/api/chat");
  });

  it("leaves a request.url without a query string untouched", async () => {
    const event = await sanitizeSentryEvent({
      request: {
        url: "https://paisaxe.es/api/chat",
      },
      type: undefined,
    } satisfies ErrorEvent);

    expect(event.request?.url).toBe("/api/chat");
  });

  it("leaves request.url undefined when not provided", async () => {
    const event = await sanitizeSentryEvent({
      request: {
        headers: { "content-type": "application/json" },
      },
      type: undefined,
    } satisfies ErrorEvent);

    expect(event.request?.url).toBeUndefined();
  });

  it("removes request.query_string entirely", async () => {
    const event = await sanitizeSentryEvent({
      request: {
        query_string: "session=abc123&token=secret",
      },
      type: undefined,
    } satisfies ErrorEvent);

    expect(event.request?.query_string).toBeUndefined();
  });

  it("redacts user.ip_address instead of passing it through in plaintext", async () => {
    const event = await sanitizeSentryEvent({
      user: {
        id: "user-123",
        ip_address: "203.0.113.42",
      },
      type: undefined,
    } satisfies ErrorEvent);

    expect(event.user?.ip_address).toBeNull();
    expect(event.user?.id).toBe("user-123");
  });

  it("does not choke when user.ip_address is absent", async () => {
    const event = await sanitizeSentryEvent({
      user: {
        id: "user-123",
      },
      type: undefined,
    } satisfies ErrorEvent);

    expect(event.user?.ip_address).toBeUndefined();
  });

  it("keeps the repo package manager and direct sentry dependency aligned", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      dependencies?: Record<string, string>;
      packageManager?: string;
    };

    expect(packageJson.packageManager).toMatch(/^npm@/);
    expect(packageJson.dependencies?.["@sentry/core"]).toBeTruthy();
  });
});

describe("capability redaction (F05)", () => {
  const capability = "11111111-2222-4333-8444-555555555555.AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde";

  it("redacts capabilities from the request URL, transaction and breadcrumbs of an error", async () => {
    const event = await sanitizeSentryEvent({
      request: { url: `https://paisaxe.es/booking/${capability}/return?token=X` },
      transaction: `/booking/${capability}`,
      breadcrumbs: [
        { category: "navigation", data: { from: "/immersive", to: `/booking/${capability}` } },
        { category: "fetch", data: { url: `/api/booking/bookings/${capability}/payment` }, message: `POST /booking/${capability}` },
      ],
    } as unknown as ErrorEvent);

    expect(JSON.stringify(event)).not.toContain(capability);
    expect(event.request?.url).toBe("/booking/[redacted]/return");
    expect(event.breadcrumbs?.[0].data?.from).toBe("/immersive");
  });

  it("redacts capabilities from transaction events", () => {
    const transaction = sanitizeSentryTransaction({
      type: "transaction",
      transaction: `/booking/${capability}`,
      request: { url: `https://paisaxe.es/booking/${capability}` },
      spans: [{ description: `GET /api/booking/bookings/${capability}`, span_id: "s", trace_id: "t", start_timestamp: 0 }],
    } as never);

    expect(JSON.stringify(transaction)).not.toContain(capability);
  });

  it("never walks sdkProcessingMetadata (scopes reach the client and its timers, which are cyclic)", () => {
    const capability = "11111111-2222-4333-8444-555555555555.AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde";
    const timers: Record<string, unknown> = {};
    timers.next = timers;
    const sdkProcessingMetadata = { capturedSpanScope: { client: { timers } } };

    const transaction = sanitizeSentryTransaction({
      type: "transaction",
      transaction: `/booking/${capability}`,
      spans: [{ description: `GET /booking/${capability}`, span_id: "s", trace_id: "t", start_timestamp: 0 }],
      sdkProcessingMetadata,
    } as never);

    expect(transaction.sdkProcessingMetadata).toBe(sdkProcessingMetadata);
    expect(transaction.transaction).toBe("/booking/[redacted]");
    expect(transaction.spans?.[0].description).toBe("GET /booking/[redacted]");
  });

  it("is wired as beforeSendTransaction in every Sentry init", () => {
    for (const file of ["sentry.server.config.ts", "sentry.edge.config.ts", "src/lib/sentry-client-init.ts"]) {
      expect(readFileSync(file, "utf8")).toContain("beforeSendTransaction: sanitizeSentryTransaction");
    }
  });
});

