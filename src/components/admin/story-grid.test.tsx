import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StoryGrid } from "./story-grid";
import type { AdminStory } from "@/types/admin";

// Mock the StoryCard component so we can inspect props without rendering its internals
vi.mock("./story-card", () => ({
  StoryCard: ({
    story,
    onEdit,
    span,
  }: {
    story: AdminStory;
    onEdit: (s: AdminStory) => void;
    span?: 1 | 2;
  }) => (
    <div
      data-testid={`story-card-${story.id}`}
      data-span={span}
      onClick={() => onEdit(story)}
    >
      {story.title}
    </div>
  ),
}));

function makeStory(overrides: Partial<AdminStory> = {}): AdminStory {
  return {
    id: "default-id",
    slug: "default-slug",
    title: "Default Title",
    subtitle: "Subtitle",
    description: "Description",
    image: "https://example.com/image.jpg",
    category: "culture" as AdminStory["category"],
    displayOrder: 0,
    curationStatus: "approved",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("StoryGrid", () => {
  it("renders 'No stories found' when stories array is empty", () => {
    render(<StoryGrid stories={[]} onEdit={vi.fn()} />);
    expect(screen.getByText("No stories found")).toBeInTheDocument();
  });

  it("renders the correct number of StoryCard components", () => {
    const stories = [
      makeStory({ id: "1", title: "Story 1" }),
      makeStory({ id: "2", title: "Story 2" }),
      makeStory({ id: "3", title: "Story 3" }),
    ];

    render(<StoryGrid stories={stories} onEdit={vi.fn()} />);

    expect(screen.getByTestId("story-card-1")).toBeInTheDocument();
    expect(screen.getByTestId("story-card-2")).toBeInTheDocument();
    expect(screen.getByTestId("story-card-3")).toBeInTheDocument();
  });

  it("calls onEdit when a card triggers it", async () => {
    const onEdit = vi.fn();
    const story = makeStory({ id: "1", title: "Clickable" });

    render(<StoryGrid stories={[story]} onEdit={onEdit} />);

    screen.getByTestId("story-card-1").click();
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledWith(story);
  });

  it("assigns span 2 to items at index 0, 5, 10 when they have an image", () => {
    // Create 11 stories, all with images
    const stories = Array.from({ length: 11 }, (_, i) =>
      makeStory({ id: `s${i}`, title: `Story ${i}`, image: "/img.jpg" })
    );

    render(<StoryGrid stories={stories} onEdit={vi.fn()} />);

    // Index 0, 5, 10 should have span 2
    expect(screen.getByTestId("story-card-s0").dataset.span).toBe("2");
    expect(screen.getByTestId("story-card-s5").dataset.span).toBe("2");
    expect(screen.getByTestId("story-card-s10").dataset.span).toBe("2");

    // Other indices should have span 1
    expect(screen.getByTestId("story-card-s1").dataset.span).toBe("1");
    expect(screen.getByTestId("story-card-s2").dataset.span).toBe("1");
    expect(screen.getByTestId("story-card-s3").dataset.span).toBe("1");
    expect(screen.getByTestId("story-card-s4").dataset.span).toBe("1");
    expect(screen.getByTestId("story-card-s6").dataset.span).toBe("1");
  });

  it("assigns span 1 to items at index 0, 5, 10 when they have no image", () => {
    const stories = Array.from({ length: 11 }, (_, i) =>
      makeStory({ id: `s${i}`, title: `Story ${i}`, image: "" })
    );

    render(<StoryGrid stories={stories} onEdit={vi.fn()} />);

    // Even at span-eligible positions, no image means span 1
    expect(screen.getByTestId("story-card-s0").dataset.span).toBe("1");
    expect(screen.getByTestId("story-card-s5").dataset.span).toBe("1");
    expect(screen.getByTestId("story-card-s10").dataset.span).toBe("1");
  });

  it("assigns span 1 to items without images regardless of index", () => {
    const stories = [
      makeStory({ id: "no-img", title: "No Image", image: "" }),
      makeStory({ id: "has-img", title: "Has Image", image: "/img.jpg" }),
    ];

    render(<StoryGrid stories={stories} onEdit={vi.fn()} />);

    // Index 0, no image -> span 1
    expect(screen.getByTestId("story-card-no-img").dataset.span).toBe("1");
    // Index 1, has image but not at span position -> span 1
    expect(screen.getByTestId("story-card-has-img").dataset.span).toBe("1");
  });
});
