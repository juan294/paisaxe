import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { getCsrfToken, csrfHeaders, fetchWithCsrf } from "./csrf-client";

describe("getCsrfToken", () => {
  beforeEach(() => {
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "",
    });
  });

  it("returns null when no __csrf cookie exists", () => {
    document.cookie = "";
    expect(getCsrfToken()).toBeNull();
  });

  it("returns the token value from __csrf cookie", () => {
    document.cookie = "__csrf=abc123";
    expect(getCsrfToken()).toBe("abc123");
  });

  it("finds __csrf among multiple cookies", () => {
    document.cookie = "session=xyz; __csrf=my-token; theme=dark";
    expect(getCsrfToken()).toBe("my-token");
  });

  it("returns null when cookie value is empty", () => {
    document.cookie = "__csrf=";
    expect(getCsrfToken()).toBeNull();
  });
});

describe("csrfHeaders", () => {
  beforeEach(() => {
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "",
    });
  });

  it("returns empty object when no token is available", () => {
    document.cookie = "";
    expect(csrfHeaders()).toEqual({});
  });

  it("returns object with x-csrf-token header when token exists", () => {
    document.cookie = "__csrf=my-token";
    expect(csrfHeaders()).toEqual({ "x-csrf-token": "my-token" });
  });
});

describe("getCsrfToken (server-side)", () => {
  it("returns null when document is undefined (server-side)", () => {
    const originalDocument = globalThis.document;
    // Temporarily make document undefined to simulate server environment
    Object.defineProperty(globalThis, "document", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    expect(getCsrfToken()).toBeNull();

    // Restore document
    Object.defineProperty(globalThis, "document", {
      value: originalDocument,
      writable: true,
      configurable: true,
    });
  });
});

describe("fetchWithCsrf", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "__csrf=test-token",
    });
    global.fetch = vi.fn().mockResolvedValue(new Response("ok"));
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("adds CSRF header for POST requests", async () => {
    await fetchWithCsrf("/api/test", { method: "POST" });

    expect(global.fetch).toHaveBeenCalledWith("/api/test", {
      method: "POST",
      headers: { "x-csrf-token": "test-token" },
    });
  });

  it("adds CSRF header for DELETE requests", async () => {
    await fetchWithCsrf("/api/test", { method: "DELETE" });

    expect(global.fetch).toHaveBeenCalledWith("/api/test", {
      method: "DELETE",
      headers: { "x-csrf-token": "test-token" },
    });
  });

  it("does not add CSRF header for GET requests", async () => {
    await fetchWithCsrf("/api/test");

    expect(global.fetch).toHaveBeenCalledWith("/api/test", undefined);
  });

  it("preserves existing headers when adding CSRF", async () => {
    await fetchWithCsrf("/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": "test-token",
      },
    });
  });

  it("does not add CSRF header for POST when no token is available", async () => {
    // Clear the __csrf cookie so getCsrfToken returns null
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "session=abc",
    });

    await fetchWithCsrf("/api/test", { method: "POST" });

    expect(global.fetch).toHaveBeenCalledWith("/api/test", {
      method: "POST",
      headers: {},
    });
  });
});
