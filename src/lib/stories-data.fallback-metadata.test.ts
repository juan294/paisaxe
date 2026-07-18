import { describe, it, expect, vi } from "vitest";
import { getStoryMetadataBySlug } from "./stories-data";
import { supabase } from "./supabase";

// Mock the fallback stories JSON so fallbackStoryMetadata's field-default arms
// can be exercised: `fallback.slug || fallback.id` (line 232) and
// `fallback.description ?? null` (line 234). With the real content these arms
// never run because every seeded fallback story has a slug and a description.
vi.mock("@content/fallback-stories.json", () => ({
  default: {
    stories: [
      {
        id: "meta-branch-story",
        slug: "", // falsy slug -> line 232 falls back to id
        title: "Meta Branch Story",
        subtitle: "Subtitle",
        // description intentionally omitted -> line 234 `?? null` arm
        image: "/images/meta.png",
        category: "nature",
        sourcePdf: "meta.pdf",
        location: "central",
        duration: "day-trip",
      },
    ],
  },
}));

// Mock supabase (server path)
vi.mock("./supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock supabase-browser (client path in jsdom) — return the same mock client.
vi.mock("./supabase-browser", async () => {
  const { supabase } = await import("./supabase");
  return {
    createSupabaseBrowserClient: vi.fn(() => supabase),
  };
});

// Mock logger — factory must not reference outer variables (vi.mock is hoisted)
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockSupabaseFrom = supabase.from as ReturnType<typeof vi.fn>;

describe("getStoryMetadataBySlug fallback field defaults (lines 232/234)", () => {
  it("uses the id when the fallback slug is empty and null when description is missing", async () => {
    // DB returns no row and no error -> silent fallback to fallbackStoryMetadata
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockEqCuration = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEqActive = vi.fn().mockReturnValue({ eq: mockEqCuration });
    const mockEqSlug = vi.fn().mockReturnValue({ eq: mockEqActive });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSlug });
    mockSupabaseFrom.mockReturnValue({ select: mockSelect });

    const result = await getStoryMetadataBySlug("meta-branch-story");

    expect(result).toEqual({
      slug: "meta-branch-story", // from fallback.id, since fallback.slug is ""
      title: "Meta Branch Story",
      description: null, // from `?? null`, since description is undefined
    });
  });
});
