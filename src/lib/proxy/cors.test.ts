import { describe, it, expect, vi, afterEach } from "vitest";

describe("cors — ALLOWED_ORIGINS", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("includes production paisaxe.es domains", async () => {
    const { ALLOWED_ORIGINS } = await import("./cors");
    expect(ALLOWED_ORIGINS).toContain("https://paisaxe.es");
    expect(ALLOWED_ORIGINS).toContain("https://www.paisaxe.es");
  });

  it("includes PLAYWRIGHT_TEST_ORIGIN when env var is set", async () => {
    vi.stubEnv("PLAYWRIGHT_TEST_ORIGIN", "http://localhost:3100");
    vi.resetModules();
    const { ALLOWED_ORIGINS } = await import("./cors");
    expect(ALLOWED_ORIGINS).toContain("http://localhost:3100");
  });

  it("does not include test origin when PLAYWRIGHT_TEST_ORIGIN is absent", async () => {
    vi.resetModules();
    const { ALLOWED_ORIGINS } = await import("./cors");
    expect(ALLOWED_ORIGINS).not.toContain("http://localhost:3100");
  });
});
