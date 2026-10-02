import { randomBytes } from "node:crypto";
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

  it("requests the slim public story projection instead of select=*", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "story-1",
          slug: "story-1",
          title: "Story One",
          subtitle: "Sub 1",
          description: "Desc 1",
          image_path: "/img1.png",
          image_source: "Photo credit",
          blur_data_url: "data:image/webp;base64,abc",
          category: "nature",
          location: "central",
          duration: "day-trip",
          display_order: 1,
          related_stories: ["story-2"],
          metadata: {
            question_prompts: ["What should I ask?"],
            translation_status: { en: { status: "failed" } },
          },
          best_months: [6],
          created_at: "2025-01-01T00:00:00Z",
          source_type: "curated",
          source_pdf: "private-guide.pdf",
          suggestion_id: "suggestion-1",
          updated_at: "2025-01-02T00:00:00Z",
          curation_status: "approved",
          is_active: true,
        },
      ],
    });

    const { getStoriesServer } = await import("./stories-server");
    const result = await getStoriesServer();

    const callUrl = new URL(mockFetch.mock.calls[0][0]);
    const selectedFields = callUrl.searchParams.get("select")?.split(",") ?? [];

    expect(callUrl.searchParams.get("select")).not.toBe("*");
    expect(selectedFields).toEqual([
      "id",
      "slug",
      "title",
      "subtitle",
      "description",
      "image_path",
      "image_source",
      "blur_data_url",
      "category",
      "location",
      "duration",
      "display_order",
      "related_stories",
      "metadata",
      "best_months",
      "created_at",
      "source_type",
    ]);
    expect(selectedFields).not.toEqual(
      expect.arrayContaining([
        "source_pdf",
        "suggestion_id",
        "updated_at",
        "curation_status",
        "is_active",
      ])
    );
    expect(result[0]).not.toHaveProperty("suggestionId");
    expect(result[0]).not.toHaveProperty("sourcePdf", "private-guide.pdf");
    expect(result[0].metadata).not.toHaveProperty("translation_status");
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

  it("logs [STORIES_CACHE_MISS] when it performs a real Supabase fetch (#541)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const loggerModule = await import("@/lib/logger");
    const infoSpy = vi.spyOn(loggerModule.logger, "info");

    const { getStoriesServer } = await import("./stories-server");
    await getStoriesServer();

    expect(infoSpy).toHaveBeenCalledWith(
      "[STORIES_CACHE_MISS]",
      expect.objectContaining({ table: "stories", count: 1 })
    );
  });

  it("does NOT log a cache MISS when Supabase credentials are absent (#541)", async () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
    };

    const loggerModule = await import("@/lib/logger");
    const infoSpy = vi.spyOn(loggerModule.logger, "info");
    infoSpy.mockClear();

    const { getStoriesServer } = await import("./stories-server");
    await getStoriesServer();

    expect(infoSpy).not.toHaveBeenCalledWith(
      "[STORIES_CACHE_MISS]",
      expect.anything()
    );
    expect(mockFetch).not.toHaveBeenCalled();
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

  // PE-M5 (#813): the full catalogue is serialized into the LCP-critical
  // initial /immersive payload and grows linearly with the content catalogue.
  // The recommendation is to instrument payload size/growth first rather than
  // restructure data loading (windowing would break the client-side Fisher-Yates
  // shuffle and deep-link slug resolution, which both require the full array).
  describe("payload size instrumentation (#813)", () => {
    it("logs [STORIES_PAYLOAD_SIZE] with story_count, raw_bytes, and gzip_bytes on a successful fetch", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: "story-1",
            slug: "story-1",
            title: "Story One",
            subtitle: "Sub 1",
            description: "Desc 1",
            image_path: "/img1.png",
            category: "nature",
            display_order: 1,
          },
        ],
      });

      const loggerModule = await import("@/lib/logger");
      const infoSpy = vi.spyOn(loggerModule.logger, "info");

      const { getStoriesServer } = await import("./stories-server");
      await getStoriesServer();

      expect(infoSpy).toHaveBeenCalledWith(
        "[STORIES_PAYLOAD_SIZE]",
        expect.objectContaining({
          story_count: 1,
          raw_bytes: expect.any(Number),
          gzip_bytes: expect.any(Number),
          threshold_gzip_bytes: expect.any(Number),
        })
      );
    });

    it("logs [STORIES_PAYLOAD_SIZE] at warn level when the gzip size exceeds the threshold", async () => {
      // A large, high-entropy description pushes the serialized+gzipped
      // payload past the documented 50KB threshold from issue #813. Random
      // bytes (base64) are used instead of a repeated character so gzip
      // can't compress it down to nothing.
      const bigDescription = randomBytes(90_000).toString("base64");
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: "story-1",
            slug: "story-1",
            title: "Story One",
            subtitle: "Sub 1",
            description: bigDescription,
            image_path: "/img1.png",
            category: "nature",
            display_order: 1,
          },
        ],
      });

      const loggerModule = await import("@/lib/logger");
      const warnSpy = vi.spyOn(loggerModule.logger, "warn");

      const { getStoriesServer } = await import("./stories-server");
      await getStoriesServer();

      expect(warnSpy).toHaveBeenCalledWith(
        "[STORIES_PAYLOAD_SIZE]",
        expect.objectContaining({ story_count: 1 })
      );
    });

    it("does NOT log [STORIES_PAYLOAD_SIZE] when falling back to FALLBACK_STORIES", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const loggerModule = await import("@/lib/logger");
      const infoSpy = vi.spyOn(loggerModule.logger, "info");
      infoSpy.mockClear();

      const { getStoriesServer } = await import("./stories-server");
      await getStoriesServer();

      expect(infoSpy).not.toHaveBeenCalledWith(
        "[STORIES_PAYLOAD_SIZE]",
        expect.anything()
      );
    });
  });
});
