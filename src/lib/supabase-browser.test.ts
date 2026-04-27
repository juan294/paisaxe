import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @supabase/ssr before importing the module
vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn(() => ({
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  })),
}));

describe("supabase-browser", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  // ─── DO-M1: must trim env vars before passing to createBrowserClient ────────

  it("DO-M1: strips trailing newline from SUPABASE_URL (Vercel CLI artifact)", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co\n";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

    const { createBrowserClient } = await import("@supabase/ssr");
    const { createSupabaseBrowserClient } = await import("./supabase-browser");

    createSupabaseBrowserClient();

    const [url] = vi.mocked(createBrowserClient).mock.calls[0];
    expect(url).toBe("https://test.supabase.co");
    expect(url).not.toMatch(/\n/);
  });

  it("DO-M1: strips surrounding whitespace from SUPABASE_ANON_KEY (Vercel CLI artifact)", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "  test-anon-key  ";

    const { createBrowserClient } = await import("@supabase/ssr");
    const { createSupabaseBrowserClient } = await import("./supabase-browser");

    createSupabaseBrowserClient();

    const [, anonKey] = vi.mocked(createBrowserClient).mock.calls[0];
    expect(anonKey).toBe("test-anon-key");
  });

  it("creates browser client with correct env var values", async () => {
    const { createBrowserClient } = await import("@supabase/ssr");
    const { createSupabaseBrowserClient } = await import("./supabase-browser");

    const client = createSupabaseBrowserClient();

    expect(createBrowserClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "test-anon-key"
    );
    expect(client).toBeDefined();
  });

  it("returns same singleton instance on repeated calls", async () => {
    const { createBrowserClient } = await import("@supabase/ssr");
    vi.clearAllMocks();

    const { createSupabaseBrowserClient } = await import("./supabase-browser");

    const first = createSupabaseBrowserClient();
    const second = createSupabaseBrowserClient();

    expect(first).toBe(second);
    // createBrowserClient should only be invoked once — singleton guard
    expect(vi.mocked(createBrowserClient)).toHaveBeenCalledTimes(1);
  });
});
