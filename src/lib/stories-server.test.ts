import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock environment module
vi.mock("@/lib/environment", () => ({
  getEnvironment: vi.fn(() => "production"),
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock stories-data for FALLBACK_STORIES
const MOCK_FALLBACK_STORIES = [
  {
    id: "fallback-1",
    slug: "fallback-1",
    title: "Fallback Story",
    subtitle: "Fallback Sub",
    description: "Fallback Desc",
    image: "/fallback.png",
    category: "nature",
    sourcePdf: "fallback.pdf",
  },
];

vi.mock("@/lib/stories-data", () => ({
  FALLBACK_STORIES: [
    {
      id: "fallback-1",
      slug: "fallback-1",
      title: "Fallback Story",
      subtitle: "Fallback Sub",
      description: "Fallback Desc",
      image: "/fallback.png",
      category: "nature",
      sourcePdf: "fallback.pdf",
    },
  ],
}));

// Mock rowToStory to just pass through for tests
vi.mock("@/types/immersive", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    rowToStory: vi.fn((row: Record<string, unknown>) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      subtitle: row.subtitle || "",
      description: row.description || "",
      image: row.image_path || "",
      category: row.category,
      sourcePdf: row.source_pdf || "",
    })),
  };
});

const mockFetch = vi.fn();

describe("getStoriesServer", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    global.fetch = mockFetch;
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-anon-key",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns stories when API succeeds", async () => {
    const mockRows = [
      {
        id: "story-1",
        slug: "story-1",
        title: "Story One",
        subtitle: "Sub 1",
        description: "Desc 1",
        image_path: "/img1.png",
        category: "nature",
        source_pdf: "story1.pdf",
        display_order: 1,
      },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockRows,
    });

    const { getStoriesServer } = await import("./stories-server");
    const result = await getStoriesServer();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("story-1");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Verify the URL pattern
    const callUrl = mockFetch.mock.calls[0][0];
    expect(callUrl).toContain("/rest/v1/stories");
    expect(callUrl).toContain("is_active=eq.true");
    expect(callUrl).toContain("curation_status=eq.approved");
  });

  it("returns FALLBACK_STORIES when API fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const { getStoriesServer } = await import("./stories-server");
    const result = await getStoriesServer();

    expect(result).toEqual(MOCK_FALLBACK_STORIES);
  });

  it("returns FALLBACK_STORIES when no Supabase config", async () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
    };

    const { getStoriesServer } = await import("./stories-server");
    const result = await getStoriesServer();

    expect(result).toEqual(MOCK_FALLBACK_STORIES);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns FALLBACK_STORIES when response is empty array", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const { getStoriesServer } = await import("./stories-server");
    const result = await getStoriesServer();

    expect(result).toEqual(MOCK_FALLBACK_STORIES);
  });

  it("returns FALLBACK_STORIES on fetch error", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { getStoriesServer } = await import("./stories-server");
    const result = await getStoriesServer();

    expect(result).toEqual(MOCK_FALLBACK_STORIES);
  });

  it("returns FALLBACK_STORIES when a non-Error value is thrown", async () => {
    mockFetch.mockRejectedValue("non-error string");

    const { getStoriesServer } = await import("./stories-server");
    const result = await getStoriesServer();

    expect(result).toEqual(MOCK_FALLBACK_STORIES);
  });

  it("uses next: { revalidate: 60 } in production", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const { getStoriesServer } = await import("./stories-server");
    await getStoriesServer();

    const fetchOptions = mockFetch.mock.calls[0][1];
    expect(fetchOptions.next).toEqual({ revalidate: 60 });
    expect(fetchOptions.cache).toBeUndefined();
  });

  it("uses cache: 'no-store' in development", async () => {
    // Override environment to development
    const { getEnvironment } = await import("@/lib/environment");
    vi.mocked(getEnvironment).mockReturnValue("development");

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const { getStoriesServer } = await import("./stories-server");
    await getStoriesServer();

    const fetchOptions = mockFetch.mock.calls[0][1];
    expect(fetchOptions.cache).toBe("no-store");
    expect(fetchOptions.next).toBeUndefined();
  });

  it("returns FALLBACK_STORIES when anon key is not a real JWT (CI/E2E)", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "dummy_key_for_e2e";

    const { getStoriesServer } = await import("./stories-server");
    const result = await getStoriesServer();

    expect(result).toEqual(MOCK_FALLBACK_STORIES);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("passes correct headers", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const { getStoriesServer } = await import("./stories-server");
    await getStoriesServer();

    const fetchOptions = mockFetch.mock.calls[0][1];
    expect(fetchOptions.headers).toEqual({
      apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-anon-key",
      Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-anon-key",
    });
  });

  it("includes AbortSignal.timeout(8000) on fetch call (#252)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const { getStoriesServer } = await import("./stories-server");
    await getStoriesServer();

    const fetchOptions = mockFetch.mock.calls[0][1];
    expect(fetchOptions.signal).toBeDefined();
    // AbortSignal.timeout returns an AbortSignal instance
    expect(fetchOptions.signal).toBeInstanceOf(AbortSignal);
  });

  it("logs [TABLE_FALLBACK] with logger.error on fetch error (#249)", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const loggerModule = await import("@/lib/logger");
    const errorSpy = vi.spyOn(loggerModule.logger, "error");

    const { getStoriesServer } = await import("./stories-server");
    await getStoriesServer();

    expect(errorSpy).toHaveBeenCalledWith(
      "[TABLE_FALLBACK]",
      expect.objectContaining({ table: "stories", error: "Network error" })
    );
  });
});
