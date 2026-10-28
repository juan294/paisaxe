import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
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

  describe("createAbortableAdminClient", () => {
    async function transport(signal: AbortSignal) {
      process.env.SUPABASE_SERVICE_KEY = "abortable-service-key";
      const { createAbortableAdminClient } = await import("./supabase-admin");
      const { createClient } = await import("@supabase/supabase-js");
      createAbortableAdminClient(signal);
      const call = vi.mocked(createClient).mock.calls.at(-1);
      const fetcher = call?.[2]?.global?.fetch;
      expect(fetcher).toBeTypeOf("function");
      return fetcher!;
    }

    it("validates existing credentials without changing either original factory", async () => {
      const { createAbortableAdminClient } = await import("./supabase-admin");
      const signal = new AbortController().signal;
      expect(() => createAbortableAdminClient(signal)).toThrow("SUPABASE_SERVICE_KEY");
      process.env.SUPABASE_SERVICE_KEY = "service";
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      expect(() => createAbortableAdminClient(signal)).toThrow("NEXT_PUBLIC_SUPABASE_URL");
    });

    it("creates fresh clients while preserving the existing singleton", async () => {
      process.env.SUPABASE_SERVICE_KEY = "service";
      const { createAbortableAdminClient, getAdminClient } = await import("./supabase-admin");
      const singleton = getAdminClient();
      const first = createAbortableAdminClient(new AbortController().signal);
      const second = createAbortableAdminClient(new AbortController().signal);
      expect(first).not.toBe(second);
      expect(getAdminClient()).toBe(singleton);
      expect(first).not.toBe(singleton);
    });

    it.each(["caller", "init", "request"])("aborts in-flight HTTP when the %s signal aborts", async (source) => {
      const caller = new AbortController();
      const init = new AbortController();
      const request = new AbortController();
      let observed: AbortSignal | undefined;
      const fetch = vi.fn<typeof globalThis.fetch>((_input, options) => {
        observed = options?.signal ?? undefined;
        return new Promise((_resolve, reject) => {
          observed?.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")), { once: true });
        });
      });
      vi.stubGlobal("fetch", fetch);
      const fetcher = await transport(caller.signal);
      const pending = fetcher(new Request("https://test.supabase.co/rest/v1/experiences", { signal: request.signal }), { signal: init.signal });
      const result = expect(pending).rejects.toMatchObject({ name: "AbortError" });
      ({ caller, init, request }[source]!).abort();
      await result;
      expect(observed?.aborted).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("starts no HTTP for an already cancelled request", async () => {
      const controller = new AbortController();
      controller.abort();
      const fetch = vi.fn<typeof globalThis.fetch>();
      vi.stubGlobal("fetch", fetch);
      const fetcher = await transport(controller.signal);
      await expect(fetcher("https://test.supabase.co/rest/v1/experiences")).rejects.toMatchObject({ name: "AbortError" });
      expect(fetch).not.toHaveBeenCalled();
    });

    it("keeps distinct requests isolated and preserves ordinary fetch options", async () => {
      const first = new AbortController();
      const second = new AbortController();
      const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ allowed: true }));
      vi.stubGlobal("fetch", fetch);
      const firstFetch = await transport(first.signal);
      const secondFetch = await transport(second.signal);
      first.abort();
      await expect(firstFetch("https://test.supabase.co/rest/v1/rpc/consume_voucher_counter")).rejects.toMatchObject({ name: "AbortError" });
      const response = await secondFetch("https://test.supabase.co/rest/v1/rpc/consume_voucher_counter", { method: "POST", body: "synthetic-body", headers: { "x-test": "unchanged" } });
      expect(await response.json()).toEqual({ allowed: true });
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0]?.[1]).toMatchObject({ method: "POST", body: "synthetic-body", headers: { "x-test": "unchanged" } });
      expect(fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
    });

    it("does not retry a transient catalog response with the actual PostgREST transport", async () => {
      vi.useFakeTimers();
      process.env.SUPABASE_SERVICE_KEY = "abortable-service-key";
      const actual = await vi.importActual<typeof import("@supabase/supabase-js")>("@supabase/supabase-js");
      const { createClient } = await import("@supabase/supabase-js");
      vi.mocked(createClient).mockImplementationOnce(actual.createClient);
      const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ message: "synthetic unavailable" }, { status: 503 }));
      vi.stubGlobal("fetch", fetch);
      const { createAbortableAdminClient } = await import("./supabase-admin");
      const client = createAbortableAdminClient(new AbortController().signal);
      const pending = client.from("experiences").select("id").then(result => result);
      await vi.advanceTimersByTimeAsync(15_000);
      expect((await pending).error).not.toBeNull();
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });
});
