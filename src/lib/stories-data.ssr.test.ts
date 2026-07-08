// @vitest-environment node

/**
 * SSR-specific test for stories-data.
 *
 * Runs in Node.js environment (no window/DOM) to cover the SSR guard in
 * getClient() at line 15: `return supabase;`
 *
 * This branch is unreachable in the default jsdom test environment because
 * `typeof window !== "undefined"` there always takes the browser-client path
 * (line 13). By running in Node, `typeof window === "undefined"` is true, so
 * getClient() falls through to the server `supabase` client, which the DB
 * fetch helpers then use.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getStoriesFromDB } from "./stories-data";
import { supabase } from "./supabase";

// Mock the server supabase client (the SSR path returns this instance).
vi.mock("./supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock the browser client factory so an accidental browser-path call would be
// obvious (it must NOT be used in the node environment).
vi.mock("./supabase-browser", () => ({
  createSupabaseBrowserClient: vi.fn(() => {
    throw new Error("browser client must not be used in SSR");
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockSupabaseFrom = supabase.from as ReturnType<typeof vi.fn>;

const mockStoryRow = {
  id: "ssr-uuid",
  slug: "ssr-story",
  title: "SSR Story",
  subtitle: "SSR Subtitle",
  description: "SSR description",
  image_path: "/images/ssr.png",
  category: "nature",
  source_pdf: "ssr.pdf",
  location: "central",
  duration: "day-trip",
  display_order: 1,
  is_active: true,
  related_stories: null,
  metadata: {},
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
};

describe("stories-data SSR (node environment)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the server supabase client when window is undefined (getClient line 15)", async () => {
    // Confirm we are in a server-like environment (no window).
    expect(typeof window).toBe("undefined");

    const mockOrder = vi.fn().mockResolvedValue({ data: [mockStoryRow], error: null });
    const mockEqCuration = vi.fn().mockReturnValue({ order: mockOrder });
    const mockEqActive = vi.fn().mockReturnValue({ eq: mockEqCuration });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqActive });
    mockSupabaseFrom.mockReturnValue({ select: mockSelect });

    const result = await getStoriesFromDB();

    // The server client's `from` was invoked, proving getClient() returned the
    // SSR `supabase` instance rather than the browser client.
    expect(mockSupabaseFrom).toHaveBeenCalledWith("stories");
    expect(result.length).toBe(1);
    expect(result[0].slug).toBe("ssr-story");
  });
});
