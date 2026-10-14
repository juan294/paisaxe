// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { GET, POST, DELETE } from "./unavailable";

afterEach(() => vi.unstubAllEnvs());
it.each(["production", "development", "test"])("production-selected handler is inert with NODE_ENV=%s", async (nodeEnv) => {
  vi.stubEnv("NODE_ENV", nodeEnv);
  for (const vercelEnv of [undefined, "preview", "production", "development", ""]) {
    vi.stubEnv("VERCEL_ENV", vercelEnv);
    for (const handler of [GET, POST, DELETE]) {
      const response = handler();
      expect(response.status).toBe(403);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.json()).toEqual({ localOnly: true, error: expect.stringContaining("desarrollo local") });
    }
  }
});
