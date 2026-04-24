import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @supabase/supabase-js before importing the module
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(),
    auth: vi.fn(),
  })),
}));

describe("supabase", () => {
  beforeEach(() => {
    vi.resetModules();
    // Restore default env vars that setup.ts provides
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    // Reset service key vars
    delete process.env.SUPABASE_SERVICE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  describe("supabase client", () => {
    it("should export a supabase client", async () => {
      const { supabase } = await import("./supabase");
      expect(supabase).toBeDefined();
      expect(typeof supabase.from).toBe("function");
    });

    it("should create client with correct config", async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const { supabase } = await import("./supabase");
      void supabase.from;

      expect(createClient).toHaveBeenCalledWith(
        "https://test.supabase.co",
        "test-anon-key"
      );
    });

    it("should throw if NEXT_PUBLIC_SUPABASE_URL is missing when the client is accessed", async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      const { supabase } = await import("./supabase");

      expect(() => supabase.from).toThrow(
        "NEXT_PUBLIC_SUPABASE_URL is required"
      );
    });

    it("should throw if NEXT_PUBLIC_SUPABASE_URL is empty string when the client is accessed", async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "   ";

      const { supabase } = await import("./supabase");

      expect(() => supabase.from).toThrow(
        "NEXT_PUBLIC_SUPABASE_URL is required"
      );
    });

    it("should throw if NEXT_PUBLIC_SUPABASE_ANON_KEY is missing when the client is accessed", async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const { supabase } = await import("./supabase");

      expect(() => supabase.from).toThrow(
        "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"
      );
    });

    it("should throw if NEXT_PUBLIC_SUPABASE_ANON_KEY is empty string when the client is accessed", async () => {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "  ";

      const { supabase } = await import("./supabase");

      expect(() => supabase.from).toThrow(
        "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"
      );
    });

    it("should trim whitespace from NEXT_PUBLIC_SUPABASE_URL before use", async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "  https://test.supabase.co  ";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "  test-anon-key  ";

      const { createClient } = await import("@supabase/supabase-js");
      const { supabase } = await import("./supabase");
      void supabase.from;

      expect(createClient).toHaveBeenCalledWith(
        "https://test.supabase.co",
        "test-anon-key"
      );
    });
  });

  describe("createAdminClient", () => {
    it("should throw error if neither service key env var is set", async () => {
      const { createAdminClient } = await import("./supabase");

      expect(() => createAdminClient()).toThrow(
        /SUPABASE_SERVICE_ROLE_KEY.*SUPABASE_SERVICE_KEY/
      );
    });

    it("should create admin client when SUPABASE_SERVICE_KEY is set", async () => {
      process.env.SUPABASE_SERVICE_KEY = "test-service-key";

      const { createAdminClient } = await import("./supabase");
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

      const { createAdminClient } = await import("./supabase");
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

      const { createAdminClient } = await import("./supabase");
      const { createClient } = await import("@supabase/supabase-js");

      createAdminClient();

      expect(createClient).toHaveBeenCalledWith(
        "https://test.supabase.co",
        "role-key-wins"
      );
    });

    it("should trim whitespace from service key before use", async () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = "  trimmed-role-key  ";

      const { createAdminClient } = await import("./supabase");
      const { createClient } = await import("@supabase/supabase-js");

      createAdminClient();

      expect(createClient).toHaveBeenCalledWith(
        "https://test.supabase.co",
        "trimmed-role-key"
      );
    });

    it("should trim whitespace from legacy service key before use", async () => {
      process.env.SUPABASE_SERVICE_KEY = "  trimmed-legacy-key  ";

      const { createAdminClient } = await import("./supabase");
      const { createClient } = await import("@supabase/supabase-js");

      createAdminClient();

      expect(createClient).toHaveBeenCalledWith(
        "https://test.supabase.co",
        "trimmed-legacy-key"
      );
    });
  });
});
