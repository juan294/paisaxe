import { describe, it, expect } from "vitest";
import {
  rowToStorySuggestion,
  rowToAdminStorySuggestion,
  type StorySuggestionRow,
} from "./suggestions";

function makeRow(overrides: Partial<StorySuggestionRow> = {}): StorySuggestionRow {
  return {
    id: "sug-1",
    user_id: "user-1",
    place_name: "Covadonga",
    comment: null,
    location: null,
    status: "pending",
    admin_notes: null,
    converted_story_id: null,
    attribution: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("rowToStorySuggestion", () => {
  it("should convert a database row to StorySuggestion", () => {
    const suggestion = rowToStorySuggestion(makeRow());

    expect(suggestion.id).toBe("sug-1");
    expect(suggestion.userId).toBe("user-1");
    expect(suggestion.placeName).toBe("Covadonga");
    expect(suggestion.comment).toBeNull();
    expect(suggestion.location).toBeNull();
    expect(suggestion.status).toBe("pending");
  });

  it("should convert populated optional fields", () => {
    const suggestion = rowToStorySuggestion(
      makeRow({
        comment: "Beautiful place",
        location: "eastern",
        admin_notes: "Approved for story creation",
        converted_story_id: "story-1",
        attribution: "@traveler",
      })
    );

    expect(suggestion.comment).toBe("Beautiful place");
    expect(suggestion.location).toBe("eastern");
    expect(suggestion.adminNotes).toBe("Approved for story creation");
    expect(suggestion.convertedStoryId).toBe("story-1");
    expect(suggestion.attribution).toBe("@traveler");
  });
});

describe("rowToAdminStorySuggestion", () => {
  it("should include userEmail when present", () => {
    const row = { ...makeRow(), user_email: "user@example.com" };
    const suggestion = rowToAdminStorySuggestion(row);

    expect(suggestion.userEmail).toBe("user@example.com");
  });

  it("should set userEmail to null when user_email is undefined", () => {
    const row = { ...makeRow() };
    const suggestion = rowToAdminStorySuggestion(row);

    expect(suggestion.userEmail).toBeNull();
  });
});
