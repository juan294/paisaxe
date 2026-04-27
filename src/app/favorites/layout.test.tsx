import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import FavoritesLayout, { metadata } from "./layout";

vi.mock("@/lib/stories-data", () => ({
  FALLBACK_STORIES: [],
  getStoriesFromDB: vi.fn().mockResolvedValue([]),
}));

describe("FavoritesLayout", () => {
  it("renders children", () => {
    const { getByText } = render(
      <FavoritesLayout>
        <div>Test content</div>
      </FavoritesLayout>
    );
    expect(getByText("Test content")).toBeInTheDocument();
  });

  it("exports metadata with noindex", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("exports correct title", () => {
    expect(metadata.title).toBe("Guardados | Paisaxe");
  });

  it("exports canonical URL", () => {
    expect(metadata.alternates?.canonical).toBe(
      "https://paisaxe.es/favorites"
    );
  });
});
