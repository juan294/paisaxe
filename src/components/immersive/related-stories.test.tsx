import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RelatedStories } from "./related-stories";
import type { Story } from "@/types/immersive";
import { createMockT } from "@/test/i18n-mock";

// Mock next/image
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

// Mock i18n
const mockT = createMockT();
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    locale: "es",
    setLocale: vi.fn(),
    t: (key: string) => mockT(key),
  }),
}));

const mockRelatedStories: Story[] = [
  {
    id: "1",
    slug: "related-1",
    title: "Related Story 1",
    subtitle: "Subtitle 1",
    description: "Description",
    image: "/img1.png",
    category: "nature",
    sourcePdf: "test.pdf",
    location: "eastern",
    duration: "day-trip",
  },
  {
    id: "2",
    slug: "related-2",
    title: "Related Story 2",
    subtitle: "Subtitle 2",
    description: "Description",
    image: "/img2.png",
    category: "cities",
    sourcePdf: "test.pdf",
    location: "central",
    duration: "weekend",
  },
];

describe("RelatedStories", () => {
  const defaultProps = {
    stories: mockRelatedStories,
    onSelectStory: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render related stories section title", () => {
    render(<RelatedStories {...defaultProps} />);

    expect(screen.getByText(new RegExp(mockT("stories.related"), "i"))).toBeInTheDocument();
  });

  it("should render all provided stories", () => {
    render(<RelatedStories {...defaultProps} />);

    expect(screen.getByText("Related Story 1")).toBeInTheDocument();
    expect(screen.getByText("Related Story 2")).toBeInTheDocument();
  });

  it("should render story category labels", () => {
    render(<RelatedStories {...defaultProps} />);

    expect(screen.getByText("Naturaleza")).toBeInTheDocument();
    expect(screen.getByText("Ciudades")).toBeInTheDocument();
  });

  it("should call onSelectStory when a story is clicked", () => {
    render(<RelatedStories {...defaultProps} />);

    fireEvent.click(screen.getByText("Related Story 1"));

    expect(defaultProps.onSelectStory).toHaveBeenCalledWith(mockRelatedStories[0]);
  });

  it("should not render when stories array is empty", () => {
    const { container } = render(<RelatedStories stories={[]} onSelectStory={vi.fn()} />);

    expect(container.firstChild).toBeNull();
  });

  it("should be collapsible", () => {
    render(<RelatedStories {...defaultProps} />);

    // Initially expanded (stories visible)
    expect(screen.getByText("Related Story 1")).toBeInTheDocument();

    // Click to collapse
    const toggleButton = screen.getByRole("button", { name: new RegExp(mockT("stories.related"), "i") });
    fireEvent.click(toggleButton);

    // Stories should not be in the document
    expect(screen.queryByText("Related Story 1")).not.toBeInTheDocument();
  });

  it("should have accessible labels", () => {
    render(<RelatedStories {...defaultProps} />);

    expect(screen.getByRole("region", { name: new RegExp(mockT("accessibility.related_stories"), "i") })).toBeInTheDocument();
  });
});
