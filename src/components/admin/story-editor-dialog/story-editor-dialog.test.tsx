import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StoryEditorDialog } from "./index";
import type { AdminStory } from "@/types/admin";

// Mock child components
vi.mock("../story-translations-tab", () => ({
  StoryTranslationsTab: () => <div data-testid="translations-tab">Translations</div>,
}));
vi.mock("./details-tab", () => ({
  DetailsTab: (props: { title: string }) => (
    <div data-testid="details-tab">Details: {props.title}</div>
  ),
}));
vi.mock("./image-tab", () => ({
  ImageTab: () => <div data-testid="image-tab">Image Tab</div>,
}));
vi.mock("./image-editor-context", () => ({
  ImageEditorProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="image-editor-provider">{children}</div>
  ),
}));

const mockStory: AdminStory = {
  id: "story1",
  title: "Covadonga Lakes",
  slug: "covadonga-lakes",
  subtitle: "High mountain glacial lakes",
  description: "The famous Lagos de Covadonga",
  category: "nature",
  location: "eastern",
  duration: "day-trip",
  image: "https://example.com/covadonga.jpg",
  imageSource: "url",
  displayOrder: 1,
  curationStatus: "needs_curation",
  metadata: {},
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-15T00:00:00Z",
};

describe("StoryEditorDialog", () => {
  const onClose = vi.fn();
  const onUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when story is null", () => {
    const { container } = render(
      <StoryEditorDialog story={null} onClose={onClose} onUpdate={onUpdate} />
    );

    expect(container.innerHTML).toBe("");
  });

  it("renders dialog with title when story provided", () => {
    render(
      <StoryEditorDialog story={mockStory} onClose={onClose} onUpdate={onUpdate} />
    );

    expect(screen.getByText("Edit Story")).toBeInTheDocument();
    expect(screen.getByText("Update story details and image")).toBeInTheDocument();
  });

  it("shows curation status badge", () => {
    render(
      <StoryEditorDialog story={mockStory} onClose={onClose} onUpdate={onUpdate} />
    );

    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("shows Approved badge for approved stories", () => {
    render(
      <StoryEditorDialog
        story={{ ...mockStory, curationStatus: "approved" }}
        onClose={onClose}
        onUpdate={onUpdate}
      />
    );

    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("renders tab buttons", () => {
    render(
      <StoryEditorDialog story={mockStory} onClose={onClose} onUpdate={onUpdate} />
    );

    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByText("Image")).toBeInTheDocument();
    expect(screen.getByText("Translations")).toBeInTheDocument();
  });

  it("shows details tab by default", () => {
    render(
      <StoryEditorDialog story={mockStory} onClose={onClose} onUpdate={onUpdate} />
    );

    expect(screen.getByTestId("details-tab")).toBeInTheDocument();
  });

  it("switches to image tab", async () => {
    const user = userEvent.setup();
    render(
      <StoryEditorDialog story={mockStory} onClose={onClose} onUpdate={onUpdate} />
    );

    await user.click(screen.getByText("Image"));

    expect(screen.getByTestId("image-tab")).toBeInTheDocument();
  });

  it("switches to translations tab", async () => {
    const user = userEvent.setup();
    render(
      <StoryEditorDialog story={mockStory} onClose={onClose} onUpdate={onUpdate} />
    );

    await user.click(screen.getByText("Translations"));

    expect(screen.getByTestId("translations-tab")).toBeInTheDocument();
  });

  it("renders cancel and save buttons", () => {
    render(
      <StoryEditorDialog story={mockStory} onClose={onClose} onUpdate={onUpdate} />
    );

    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Save Changes")).toBeInTheDocument();
  });

  it("shows Mark as approved button for needs_curation stories", () => {
    render(
      <StoryEditorDialog story={mockStory} onClose={onClose} onUpdate={onUpdate} />
    );

    expect(screen.getByText("Mark as approved")).toBeInTheDocument();
  });

  it("shows Mark as pending button for approved stories", () => {
    render(
      <StoryEditorDialog
        story={{ ...mockStory, curationStatus: "approved" }}
        onClose={onClose}
        onUpdate={onUpdate}
      />
    );

    expect(screen.getByText("Mark as pending")).toBeInTheDocument();
  });
});
