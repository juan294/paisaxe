import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only so it doesn't throw in test environment
vi.mock("server-only", () => ({}));

// Mock @supabase/supabase-js before importing the module
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(),
    auth: vi.fn(),
  })),
}));

describe("supabase-admin", () => {
  beforeEach(() => {
    vi.resetModules();
    // Restore default env vars that setup.ts provides
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    // Reset service key vars
    delete process.env.SUPABASE_SERVICE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  // ─── Singleton getAdminClient() (#787) ────────────────────────────────────
  describe("getAdminClient", () => {
    it("should return the same instance on subsequent calls (singleton)", async () => {
      process.env.SUPABASE_SERVICE_KEY = "singleton-service-key";

      const { getAdminClient } = await import("./supabase-admin");

      const first = getAdminClient();
      const second = getAdminClient();

      expect(first).toBe(second);
    });
  });

  describe("createAdminClient", () => {
    // AR-L3 (#865): SUPABASE_SERVICE_ROLE_KEY had no live value in any real
    // environment (verified via `vercel env ls` against production/preview
    // and the local .env.local) — SUPABASE_SERVICE_KEY is the sole
    // credential every deployment actually sets. The dual-name `??`
    // fallback is removed so a misconfigured deployment fails loudly.
    it("should throw error if the service key env var is not set", async () => {
      const { createAdminClient } = await import("./supabase-admin");

      expect(() => createAdminClient()).toThrow(/SUPABASE_SERVICE_KEY/);
    });

    it("should throw error if NEXT_PUBLIC_SUPABASE_URL is not set", async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.SUPABASE_SERVICE_KEY = "some-key";

      const { createAdminClient } = await import("./supabase-admin");

      expect(() => createAdminClient()).toThrow("NEXT_PUBLIC_SUPABASE_URL is required");
    });

    it("should create admin client when SUPABASE_SERVICE_KEY is set", async () => {
      process.env.SUPABASE_SERVICE_KEY = "test-service-key";

      const { createAdminClient } = await import("./supabase-admin");
      const { createClient } = await import("@supabase/supabase-js");

      const client = createAdminClient();

      expect(client).toBeDefined();
      expect(createClient).toHaveBeenCalledWith(
        "https://test.supabase.co",
        "test-service-key"
      );
    });

    it("should ignore SUPABASE_SERVICE_ROLE_KEY — it is not read anywhere", async () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = "role-key-should-be-ignored";

      const { createAdminClient } = await import("./supabase-admin");

      expect(() => createAdminClient()).toThrow(/SUPABASE_SERVICE_KEY/);
    });

    it("should trim whitespace from the service key before use", async () => {
      process.env.SUPABASE_SERVICE_KEY = "  trimmed-service-key  ";

      const { createAdminClient } = await import("./supabase-admin");
      const { createClient } = await import("@supabase/supabase-js");

      createAdminClient();

      expect(createClient).toHaveBeenCalledWith(
        "https://test.supabase.co",
        "trimmed-service-key"
      );
    });
  });
});
