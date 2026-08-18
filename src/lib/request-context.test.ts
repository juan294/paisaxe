import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("runs the callback without a context when x-request-id header is missing", () => {
    // Exercises request-context.ts:66 (no-header passthrough branch)
    const request = new Request("https://paisaxe.test/");

    const value = withRequestContext(request, () => getRequestId());

    expect(value).toBeUndefined();
  });

  it("treats a blank x-request-id header as missing", () => {
    // Verifies the `.trim()` guard inside withRequestContext
    const request = new Request("https://paisaxe.test/", {
      headers: { "x-request-id": "   " },
    });

    const value = withRequestContext(request, () => getRequestId());

    expect(value).toBeUndefined();
  });
});

describe("request context browser guard (FE-H1 / #759)", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("never reaches Node's require() when window is defined (browser bundle)", async () => {
    // jsdom always defines `window` (as does a real browser bundle); genuine
    // server runtimes (Node, Edge) never do. This is exactly the condition
    // the CSP-violating `Function("return require")()` call must never run
    // under.
    expect(typeof window).not.toBe("undefined");

    const requireSpy = vi.fn(() => {
      throw new Error("require() must never be reached from a browser-bundled module");
    });
    const globalWithRequire = globalThis as { require?: unknown };
    const originalRequire = globalWithRequire.require;
    globalWithRequire.require = requireSpy;

    try {
      vi.resetModules();
      const mod = await import("./request-context");

      // The module must load — and getRequestId/runWithRequestContext must still
      // work via the safe synchronous fallback — without ever invoking require(),
      // which is the CSP `unsafe-eval`-triggering call in a real browser.
      expect(requireSpy).not.toHaveBeenCalled();

      expect(mod.getRequestId()).toBeUndefined();
      const value = mod.runWithRequestContext(
        { requestId: "req-guard-test" },
        () => mod.getRequestId()
      );
      expect(value).toBe("req-guard-test");
    } finally {
      globalWithRequire.require = originalRequire;
    }
  });
});

describe("request context under Edge runtime (no AsyncLocalStorage)", () => {
  afterEach(() => {
    delete (globalThis as { EdgeRuntime?: string }).EdgeRuntime;
    vi.resetModules();
  });

  it("uses a synchronous fallback when AsyncLocalStorage is unavailable", async () => {
    // Simulate the Edge runtime so the module skips the AsyncLocalStorage path
    // and uses its `fallbackRequestContext` branch instead.
    (globalThis as { EdgeRuntime?: string }).EdgeRuntime = "edge-runtime";
    vi.resetModules();

    const mod = await import("./request-context");

    expect(mod.getRequestId()).toBeUndefined();

    const inside = mod.runWithRequestContext(
      { requestId: "req-edge-9999" },
      () => mod.getRequestId()
    );
    expect(inside).toBe("req-edge-9999");

    // After the callback, fallback context is restored to previous value
    expect(mod.getRequestId()).toBeUndefined();
  });
});
