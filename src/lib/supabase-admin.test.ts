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

  // ─── BE-M3: singleton getAdminClient() ───────────────────────────────────
  describe("getAdminClient", () => {
    it("should return the same instance on subsequent calls (singleton)", async () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = "singleton-role-key";

      const { getAdminClient } = await import("./supabase-admin");

      const first = getAdminClient();
      const second = getAdminClient();

      expect(first).toBe(second);
    });
  });

  describe("createAdminClient", () => {
    it("should throw error if neither service key env var is set", async () => {
      const { createAdminClient } = await import("./supabase-admin");

      expect(() => createAdminClient()).toThrow(
        /SUPABASE_SERVICE_ROLE_KEY.*SUPABASE_SERVICE_KEY/
      );
    });

    it("should throw error if NEXT_PUBLIC_SUPABASE_URL is not set", async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.SUPABASE_SERVICE_ROLE_KEY = "some-key";

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

    it("should create admin client when SUPABASE_SERVICE_ROLE_KEY is set", async () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

      const { createAdminClient } = await import("./supabase-admin");
      const { createClient } = await import("@supabase/supabase-js");

      const client = createAdminClient();

      expect(client).toBeDefined();
      expect(createClient).toHaveBeenCalledWith(
        "https://test.supabase.co",
        "test-service-role-key"
      );
    });

    it("should prefer SUPABASE_SERVICE_ROLE_KEY over SUPABASE_SERVICE_KEY", async () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = "role-key-wins";
      process.env.SUPABASE_SERVICE_KEY = "legacy-key-loses";

      const { createAdminClient } = await import("./supabase-admin");
      const { createClient } = await import("@supabase/supabase-js");

      createAdminClient();

      expect(createClient).toHaveBeenCalledWith(
        "https://test.supabase.co",
        "role-key-wins"
      );
    });

    it("should trim whitespace from service key before use", async () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = "  trimmed-role-key  ";

      const { createAdminClient } = await import("./supabase-admin");
      const { createClient } = await import("@supabase/supabase-js");

      createAdminClient();

      expect(createClient).toHaveBeenCalledWith(
        "https://test.supabase.co",
        "trimmed-role-key"
      );
    });

    it("should trim whitespace from legacy service key before use", async () => {
      process.env.SUPABASE_SERVICE_KEY = "  trimmed-legacy-key  ";

      const { createAdminClient } = await import("./supabase-admin");
      const { createClient } = await import("@supabase/supabase-js");

      createAdminClient();

      expect(createClient).toHaveBeenCalledWith(
        "https://test.supabase.co",
        "trimmed-legacy-key"
      );
    });
  });
});
