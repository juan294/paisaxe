import { describe, it, expect } from "vitest";
import { rowToAdminStory, type AdminStoryRow } from "./admin";

function makeRow(overrides: Partial<AdminStoryRow> = {}): AdminStoryRow {
  return {
    id: "test-id",
    slug: "test-slug",
    title: "Test Title",
    subtitle: null,
    description: null,
    image_path: null,
    image_source: null,
    blur_data_url: null,
    category: "nature",
    source_pdf: null,
    location: null,
    duration: null,
    display_order: 0,
    is_active: true,
    related_stories: null,
    metadata: null as unknown as Record<string, unknown>,
    best_months: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    source_type: null,
    suggestion_id: null,
    curation_status: "needs_curation",
    ...overrides,
  };
}

describe("rowToAdminStory", () => {
  it("should convert a row with all null optional fields", () => {
    const story = rowToAdminStory(makeRow());

    expect(story.subtitle).toBe("");
    expect(story.description).toBe("");
    expect(story.image).toBe("");
    expect(story.imageSource).toBeUndefined();
    expect(story.sourcePdf).toBeUndefined();
    expect(story.location).toBeUndefined();
    expect(story.duration).toBeUndefined();
    expect(story.metadata).toBeUndefined();
  });

  it("should convert a row with all optional fields populated", () => {
    const story = rowToAdminStory(
      makeRow({
        subtitle: "Has subtitle",
        description: "Has description",
        image_path: "/img.jpg",
        image_source: "Unsplash",
        source_pdf: "story.pdf",
        location: "eastern",
        duration: "day-trip",
        metadata: { key: "value" },
      })
    );

    expect(story.subtitle).toBe("Has subtitle");
    expect(story.description).toBe("Has description");
    expect(story.image).toBe("/img.jpg");
    expect(story.imageSource).toBe("Unsplash");
    expect(story.sourcePdf).toBe("story.pdf");
    expect(story.location).toBe("eastern");
    expect(story.duration).toBe("day-trip");
    expect(story.metadata).toEqual({ key: "value" });
  });

  it("should preserve id, slug, and curation status", () => {
    const story = rowToAdminStory(
      makeRow({
        id: "abc-123",
        slug: "my-story",
        curation_status: "approved",
        display_order: 5,
      })
    );

    expect(story.id).toBe("abc-123");
    expect(story.slug).toBe("my-story");
    expect(story.curationStatus).toBe("approved");
    expect(story.displayOrder).toBe(5);
  });
});
