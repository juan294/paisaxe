import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RelatedStories } from "./related-stories";
import type { Story } from "@/types/immersive";
import { createMockT } from "@/test/i18n-mock";
import { imageProvenanceFixture } from "@/test/image-provenance-fixture";
import { NEUTRAL_CREDIT, NEUTRAL_IMAGE } from "@/lib/image-provenance";
import { requiredValue } from "@/test/required-value";

const imageRequests = vi.hoisted((): unknown[] => []);

// Mock next/image
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    imageRequests.push(props.src);
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} />;
  },
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
    imageSource: imageProvenanceFixture("/img1.png", undefined, undefined, { alt: "Related Story 1" }),
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
    imageSource: imageProvenanceFixture("/img2.png", undefined, undefined, { alt: "Related Story 2" }),
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
    imageRequests.length = 0;
  });

  it("should render related stories section title", () => {
    render(<RelatedStories {...defaultProps} />);

    expect(screen.getByText(new RegExp(mockT("stories.related"), "i"))).toBeInTheDocument();
  });

  it("renders a story without an image as a card with no <img> (#1001)", () => {
    const [first, second] = mockRelatedStories;
    render(<RelatedStories stories={[{ ...first!, image: "" }, second!]} onSelectStory={vi.fn()} />);

    expect(screen.getByText(first!.title)).toBeInTheDocument();
    expect(document.querySelector('img[src=""]')).toBeNull();
    expect(document.querySelectorAll("img")).toHaveLength(1);
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

  // UX-M5: approved fixtures retain meaningful reviewed alt text.
  it("UX-M5: related story images have non-empty reviewed alt text", () => {
    const { container } = render(<RelatedStories {...defaultProps} />);

    const img1 = container.querySelector('img[src="/img1.png"]');
    const img2 = container.querySelector('img[src="/img2.png"]');

    expect(img1).not.toBeNull();
    expect(img2).not.toBeNull();
    expect(img1).toHaveAttribute("alt", "Related Story 1");
    expect(img2).toHaveAttribute("alt", "Related Story 2");
  });

  it.each([
    ["legacy credit", "Unreviewed legacy credit"],
    ["proof for another asset", imageProvenanceFixture("/other.png")],
  ])("uses neutral imagery and credit for %s while preserving selection", (_label, imageSource) => {
    const story: Story = { ...requiredValue(mockRelatedStories[0], "Related image fixture"), imageSource };
    const onSelectStory = vi.fn();
    const { container } = render(<RelatedStories stories={[story]} onSelectStory={onSelectStory} />);

    expect(screen.getByRole("img", { name: NEUTRAL_CREDIT })).toHaveAttribute("src", NEUTRAL_IMAGE);
    expect(container.querySelector('img[src="/img1.png"]')).toBeNull();
    expect(imageRequests.length).toBeGreaterThan(0);
    expect(imageRequests.every(src => src === NEUTRAL_IMAGE)).toBe(true);
    expect(screen.getByText(NEUTRAL_CREDIT)).toBeInTheDocument();
    expect(screen.queryByText("Synthetic fixture credit")).not.toBeInTheDocument();
    expect(screen.queryByText("Unreviewed legacy credit")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(story.title));
    expect(onSelectStory).toHaveBeenCalledWith(story);
  });

  it("UX-M5: related story images do not have empty alt text", () => {
    const { container } = render(<RelatedStories {...defaultProps} />);

    const imgs = container.querySelectorAll("img");
    imgs.forEach((img) => {
      expect(img.getAttribute("alt")).not.toBe("");
    });
  });
});
