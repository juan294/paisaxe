import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StoryEditorDialog } from "./index";
import type { AdminStory } from "@/types/admin";

// Mock admin-api for save/approve/mark-pending actions
const mockUpdateStoryStatus = vi.fn();
const mockUpdateStory = vi.fn();
const mockUpdateStoryImageUrl = vi.fn();
const mockUploadStoryImage = vi.fn();
const mockUpdateStoryImageSource = vi.fn();
const mockUpdateStoryTranslation = vi.fn();

vi.mock("@/lib/admin-api", () => ({
  updateStoryStatus: (...args: unknown[]) => mockUpdateStoryStatus(...args),
  updateStory: (...args: unknown[]) => mockUpdateStory(...args),
  updateStoryImageUrl: (...args: unknown[]) => mockUpdateStoryImageUrl(...args),
  uploadStoryImage: (...args: unknown[]) => mockUploadStoryImage(...args),
  updateStoryImageSource: (...args: unknown[]) => mockUpdateStoryImageSource(...args),
  updateStoryTranslation: (...args: unknown[]) => mockUpdateStoryTranslation(...args),
}));

// Mock Dialog to bypass portals for coverage
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean; onOpenChange?: (open: boolean) => void }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
}));

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

  describe("approve/pending actions", () => {
    it("calls updateStoryStatus with 'approved' when clicking Mark as approved", async () => {
      mockUpdateStoryStatus.mockResolvedValue({ data: { id: "story1", curationStatus: "approved" } });
      const user = userEvent.setup();

      render(
        <StoryEditorDialog story={mockStory} onClose={onClose} onUpdate={onUpdate} />
      );

      await user.click(screen.getByText("Mark as approved"));

      await waitFor(() => {
        expect(mockUpdateStoryStatus).toHaveBeenCalledWith("story1", "approved");
      });

      // onUpdate should be called to reflect the status change
      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalledWith("story1", { curationStatus: "approved" });
      });
    });

    it("calls updateStoryStatus with 'needs_curation' when clicking Mark as pending", async () => {
      mockUpdateStoryStatus.mockResolvedValue({ data: { id: "story1", curationStatus: "needs_curation" } });
      const user = userEvent.setup();

      render(
        <StoryEditorDialog
          story={{ ...mockStory, curationStatus: "approved" }}
          onClose={onClose}
          onUpdate={onUpdate}
        />
      );

      await user.click(screen.getByText("Mark as pending"));

      await waitFor(() => {
        expect(mockUpdateStoryStatus).toHaveBeenCalledWith("story1", "needs_curation");
      });

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalledWith("story1", { curationStatus: "needs_curation" });
      });
    });

    it("shows error when approve fails", async () => {
      mockUpdateStoryStatus.mockResolvedValue({ error: "Approve failed" });
      const user = userEvent.setup();

      render(
        <StoryEditorDialog story={mockStory} onClose={onClose} onUpdate={onUpdate} />
      );

      await user.click(screen.getByText("Mark as approved"));

      await waitFor(() => {
        expect(screen.getByText("Approve failed")).toBeInTheDocument();
      });
    });

    it("shows error when mark pending fails", async () => {
      mockUpdateStoryStatus.mockResolvedValue({ error: "Pending failed" });
      const user = userEvent.setup();

      render(
        <StoryEditorDialog
          story={{ ...mockStory, curationStatus: "approved" }}
          onClose={onClose}
          onUpdate={onUpdate}
        />
      );

      await user.click(screen.getByText("Mark as pending"));

      await waitFor(() => {
        expect(screen.getByText("Pending failed")).toBeInTheDocument();
      });
    });
  });

  describe("cancel button", () => {
    it("calls onClose when clicking Cancel", async () => {
      const user = userEvent.setup();

      render(
        <StoryEditorDialog story={mockStory} onClose={onClose} onUpdate={onUpdate} />
      );

      await user.click(screen.getByText("Cancel"));

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("save button", () => {
    it("save button is disabled when no changes have been made", () => {
      render(
        <StoryEditorDialog story={mockStory} onClose={onClose} onUpdate={onUpdate} />
      );

      const saveBtn = screen.getByText("Save Changes").closest("button")!;
      expect(saveBtn).toBeDisabled();
    });
  });

  describe("switching back to details tab from image", () => {
    it("shows details tab content when switching back from image tab", async () => {
      const user = userEvent.setup();

      render(
        <StoryEditorDialog story={mockStory} onClose={onClose} onUpdate={onUpdate} />
      );

      // Switch to image tab
      await user.click(screen.getByText("Image"));
      expect(screen.getByTestId("image-tab")).toBeInTheDocument();
      expect(screen.queryByTestId("details-tab")).not.toBeInTheDocument();

      // Switch back to details
      await user.click(screen.getByText("Details"));
      expect(screen.getByTestId("details-tab")).toBeInTheDocument();
      expect(screen.queryByTestId("image-tab")).not.toBeInTheDocument();
    });
  });

  describe("dialog footer rendering", () => {
    it("renders footer with approve button and action buttons for needs_curation story", () => {
      render(
        <StoryEditorDialog story={mockStory} onClose={onClose} onUpdate={onUpdate} />
      );

      const footer = screen.getByTestId("dialog-footer");
      expect(footer).toBeInTheDocument();
      expect(screen.getByText("Mark as approved")).toBeInTheDocument();
      expect(screen.getByText("Cancel")).toBeInTheDocument();
      expect(screen.getByText("Save Changes")).toBeInTheDocument();
    });

    it("renders footer with mark pending button for approved story", () => {
      render(
        <StoryEditorDialog
          story={{ ...mockStory, curationStatus: "approved" }}
          onClose={onClose}
          onUpdate={onUpdate}
        />
      );

      const footer = screen.getByTestId("dialog-footer");
      expect(footer).toBeInTheDocument();
      expect(screen.getByText("Mark as pending")).toBeInTheDocument();
    });
  });
});

