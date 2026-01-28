import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ImageEditorDialog } from "./image-editor-dialog";
import type { AdminStory } from "@/types/admin";
import { PLACEHOLDER_PREFIX } from "@/lib/unsplash-placeholders";

// Mock next/image
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { fill, ...rest } = props;
    return <div data-testid="next-image" data-src={props.src} data-fill={fill ? "true" : undefined} {...rest} />;
  },
}));

// Mock admin-api
const mockUpdateStoryImageUrl = vi.fn();
const mockUploadStoryImage = vi.fn();
const mockUpdateStoryStatus = vi.fn();
const mockSearchContentImages = vi.fn();

vi.mock("@/lib/admin-api", () => ({
  updateStoryImageUrl: (...args: unknown[]) => mockUpdateStoryImageUrl(...args),
  uploadStoryImage: (...args: unknown[]) => mockUploadStoryImage(...args),
  updateStoryStatus: (...args: unknown[]) => mockUpdateStoryStatus(...args),
  searchContentImages: (...args: unknown[]) => mockSearchContentImages(...args),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Link: (props: Record<string, unknown>) => <span data-testid="icon-link" {...props} />,
  Upload: (props: Record<string, unknown>) => <span data-testid="icon-upload" {...props} />,
  ImagePlus: (props: Record<string, unknown>) => <span data-testid="icon-image-plus" {...props} />,
  Maximize2: (props: Record<string, unknown>) => <span data-testid="icon-maximize" {...props} />,
  X: (props: Record<string, unknown>) => <span data-testid="icon-x" {...props} />,
  Loader2: (props: Record<string, unknown>) => <span data-testid="icon-loader" {...props} />,
  AlertCircle: (props: Record<string, unknown>) => <span data-testid="icon-alert" {...props} />,
  FolderSearch: (props: Record<string, unknown>) => <span data-testid="icon-folder-search" {...props} />,
  ChevronLeft: (props: Record<string, unknown>) => <span data-testid="icon-chevron-left" {...props} />,
  ChevronRight: (props: Record<string, unknown>) => <span data-testid="icon-chevron-right" {...props} />,
}));

// Mock the Dialog components to render children directly (avoid Radix portal issues)
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) => {
    if (open === false) return null;
    return <div data-testid="dialog">{children}</div>;
  },
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
}));

// Mock CurationBadge
vi.mock("./curation-badge", () => ({
  CurationBadge: ({ status }: { status: string }) => (
    <span data-testid="curation-badge">{status}</span>
  ),
}));

const mockStory: AdminStory = {
  id: "story-1",
  slug: "test-story",
  title: "Test Story",
  subtitle: "A subtitle",
  description: "A description",
  image: "https://example.com/current.jpg",
  category: "nature" as AdminStory["category"],
  displayOrder: 1,
  curationStatus: "needs_curation",
  createdAt: "2024-01-01",
  updatedAt: "2024-01-01",
};

const defaultProps = {
  story: mockStory,
  onClose: vi.fn(),
  onUpdate: vi.fn(),
};

describe("ImageEditorDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock URL.createObjectURL
    global.URL.createObjectURL = vi.fn(() => "blob:http://localhost/fake-blob");
  });

  describe("Rendering", () => {
    it("returns null when story is null", () => {
      const { container } = render(
        <ImageEditorDialog
          story={null}
          onClose={vi.fn()}
          onUpdate={vi.fn()}
        />
      );
      expect(container.innerHTML).toBe("");
    });

    it("renders dialog with story title", () => {
      render(<ImageEditorDialog {...defaultProps} />);
      expect(screen.getByText("Test Story")).toBeInTheDocument();
    });

    it("renders update hero image description", () => {
      render(<ImageEditorDialog {...defaultProps} />);
      expect(screen.getByText("Update hero image")).toBeInTheDocument();
    });

    it("renders curation badge with current status", () => {
      render(<ImageEditorDialog {...defaultProps} />);
      expect(screen.getByTestId("curation-badge")).toHaveTextContent("needs_curation");
    });

    it("renders current story image preview", () => {
      render(<ImageEditorDialog {...defaultProps} />);
      const images = screen.getAllByTestId("next-image");
      const previewImage = images.find(
        (img) => img.getAttribute("data-src") === "https://example.com/current.jpg"
      );
      expect(previewImage).toBeTruthy();
    });
  });

  describe("Tabs", () => {
    it("shows Content tab by default", () => {
      render(<ImageEditorDialog {...defaultProps} />);
      expect(screen.getByText("Content")).toBeInTheDocument();
      expect(screen.getByText("URL")).toBeInTheDocument();
      expect(screen.getByText("Upload")).toBeInTheDocument();
      // Content tab should be visible with Search PDF button
      expect(screen.getByText(/Search PDF/i)).toBeInTheDocument();
    });

    it("can switch to URL tab", () => {
      render(<ImageEditorDialog {...defaultProps} />);

      fireEvent.click(screen.getByText("URL"));

      // URL input should be visible
      expect(screen.getByPlaceholderText("https://example.com/image.jpg")).toBeInTheDocument();
    });

    it("can switch to Upload tab", () => {
      render(<ImageEditorDialog {...defaultProps} />);

      fireEvent.click(screen.getByText("Upload"));

      // Upload area should appear (with "Click or drag" text)
      expect(screen.getByText("Click or drag")).toBeInTheDocument();
      expect(screen.getByText("JPEG, PNG, WebP, GIF · Max 5MB")).toBeInTheDocument();
    });

    it("can switch back to URL tab from Upload tab", () => {
      render(<ImageEditorDialog {...defaultProps} />);

      // Go to upload
      fireEvent.click(screen.getByText("Upload"));
      expect(screen.getByText("Click or drag")).toBeInTheDocument();

      // Go back to URL
      fireEvent.click(screen.getByText("URL"));
      expect(screen.getByPlaceholderText("https://example.com/image.jpg")).toBeInTheDocument();
    });
  });

  describe("URL input", () => {
    it("URL input updates preview", () => {
      render(<ImageEditorDialog {...defaultProps} />);

      // Switch to URL tab first (Content is default)
      fireEvent.click(screen.getByText("URL"));

      const urlInput = screen.getByPlaceholderText("https://example.com/image.jpg");
      fireEvent.change(urlInput, { target: { value: "https://example.com/new.jpg" } });

      const images = screen.getAllByTestId("next-image");
      const previewImage = images.find(
        (img) => img.getAttribute("data-src") === "https://example.com/new.jpg"
      );
      expect(previewImage).toBeTruthy();
    });
  });

  describe("Image source input", () => {
    it("renders image source / attribution input", () => {
      render(<ImageEditorDialog {...defaultProps} />);
      expect(screen.getByText("Image Source / Attribution")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("e.g., Photo by Juan on Unsplash")).toBeInTheDocument();
    });

    it("image source input works", () => {
      render(<ImageEditorDialog {...defaultProps} />);
      const sourceInput = screen.getByPlaceholderText("e.g., Photo by Juan on Unsplash");
      fireEvent.change(sourceInput, { target: { value: "Photo by Test" } });
      expect(sourceInput).toHaveValue("Photo by Test");
    });

    it("initializes imageSource from story", () => {
      const storyWithSource = { ...mockStory, imageSource: "Original source" };
      render(<ImageEditorDialog {...defaultProps} story={storyWithSource} />);
      const sourceInput = screen.getByPlaceholderText("e.g., Photo by Juan on Unsplash");
      expect(sourceInput).toHaveValue("Original source");
    });
  });

  describe("Save with URL", () => {
    it("calls updateStoryImageUrl on save with URL", async () => {
      mockUpdateStoryImageUrl.mockResolvedValue({
        data: { id: "story-1", image: "https://example.com/new.jpg", imageSource: undefined },
      });

      render(<ImageEditorDialog {...defaultProps} />);

      // Switch to URL tab first (Content is default)
      fireEvent.click(screen.getByText("URL"));

      const urlInput = screen.getByPlaceholderText("https://example.com/image.jpg");
      fireEvent.change(urlInput, { target: { value: "https://example.com/new.jpg" } });

      const saveButton = screen.getByRole("button", { name: "Save" });
      await act(async () => {
        fireEvent.click(saveButton);
      });

      expect(mockUpdateStoryImageUrl).toHaveBeenCalledWith(
        "story-1",
        "https://example.com/new.jpg",
        undefined
      );
    });

    it("passes imageSource to updateStoryImageUrl when provided", async () => {
      mockUpdateStoryImageUrl.mockResolvedValue({
        data: { id: "story-1", image: "https://example.com/new.jpg", imageSource: "Test source" },
      });

      render(<ImageEditorDialog {...defaultProps} />);

      // Switch to URL tab first (Content is default)
      fireEvent.click(screen.getByText("URL"));

      const urlInput = screen.getByPlaceholderText("https://example.com/image.jpg");
      fireEvent.change(urlInput, { target: { value: "https://example.com/new.jpg" } });

      const sourceInput = screen.getByPlaceholderText("e.g., Photo by Juan on Unsplash");
      fireEvent.change(sourceInput, { target: { value: "Test source" } });

      const saveButton = screen.getByRole("button", { name: "Save" });
      await act(async () => {
        fireEvent.click(saveButton);
      });

      expect(mockUpdateStoryImageUrl).toHaveBeenCalledWith(
        "story-1",
        "https://example.com/new.jpg",
        "Test source"
      );
    });

    it("calls onUpdate and onClose on successful URL save", async () => {
      mockUpdateStoryImageUrl.mockResolvedValue({
        data: { id: "story-1", image: "https://example.com/new.jpg", imageSource: "src" },
      });

      render(<ImageEditorDialog {...defaultProps} />);

      // Switch to URL tab first (Content is default)
      fireEvent.click(screen.getByText("URL"));

      const urlInput = screen.getByPlaceholderText("https://example.com/image.jpg");
      fireEvent.change(urlInput, { target: { value: "https://example.com/new.jpg" } });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
      });

      expect(defaultProps.onUpdate).toHaveBeenCalledWith("story-1", {
        image: "https://example.com/new.jpg",
        imageSource: "src",
      });
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe("Save with file upload", () => {
    it("calls uploadStoryImage on save with file", async () => {
      mockUploadStoryImage.mockResolvedValue({
        data: { id: "story-1", image: "https://cdn.example.com/uploaded.jpg", imageSource: undefined },
      });

      render(<ImageEditorDialog {...defaultProps} />);

      // Switch to upload tab
      fireEvent.click(screen.getByText("Upload"));

      // Simulate file input change
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeTruthy();

      const file = new File(["image data"], "test.jpg", { type: "image/jpeg" });
      Object.defineProperty(file, "size", { value: 1024 * 1024 }); // 1MB

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      // The file name should appear
      expect(screen.getByText("test.jpg")).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
      });

      expect(mockUploadStoryImage).toHaveBeenCalledWith(
        "story-1",
        file,
        undefined
      );
    });
  });

  describe("Error handling", () => {
    it("shows error when no image provided on save", async () => {
      render(<ImageEditorDialog {...defaultProps} />);

      // URL input is empty, no file selected - just click save
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
      });

      expect(screen.getByText("Please provide an image URL, upload a file, or select a content image")).toBeInTheDocument();
    });

    it("shows error from API response on URL save", async () => {
      mockUpdateStoryImageUrl.mockResolvedValue({
        error: "Image URL is not accessible",
      });

      render(<ImageEditorDialog {...defaultProps} />);

      // Switch to URL tab first (Content is default)
      fireEvent.click(screen.getByText("URL"));

      const urlInput = screen.getByPlaceholderText("https://example.com/image.jpg");
      fireEvent.change(urlInput, { target: { value: "https://example.com/bad.jpg" } });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
      });

      expect(screen.getByText("Image URL is not accessible")).toBeInTheDocument();
    });

    it("shows error from API response on file upload", async () => {
      mockUploadStoryImage.mockResolvedValue({
        error: "Upload failed: file too large",
      });

      render(<ImageEditorDialog {...defaultProps} />);

      fireEvent.click(screen.getByText("Upload"));

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["image data"], "test.jpg", { type: "image/jpeg" });
      Object.defineProperty(file, "size", { value: 1024 * 1024 });

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
      });

      expect(screen.getByText("Upload failed: file too large")).toBeInTheDocument();
    });

    it("shows generic error on exception during save", async () => {
      mockUpdateStoryImageUrl.mockRejectedValue(new Error("Network error"));

      render(<ImageEditorDialog {...defaultProps} />);

      // Switch to URL tab first (Content is default)
      fireEvent.click(screen.getByText("URL"));

      const urlInput = screen.getByPlaceholderText("https://example.com/image.jpg");
      fireEvent.change(urlInput, { target: { value: "https://example.com/new.jpg" } });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
      });

      expect(screen.getByText("Failed to update image")).toBeInTheDocument();
    });
  });

  describe("Status actions", () => {
    it("approve button calls updateStoryStatus with 'approved'", async () => {
      mockUpdateStoryStatus.mockResolvedValue({
        data: { id: "story-1", curationStatus: "approved" },
      });

      render(<ImageEditorDialog {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText("Mark as approved"));
      });

      expect(mockUpdateStoryStatus).toHaveBeenCalledWith("story-1", "approved");
    });

    it("calls onUpdate but keeps modal open after successful approve", async () => {
      mockUpdateStoryStatus.mockResolvedValue({
        data: { id: "story-1", curationStatus: "approved" },
      });

      render(<ImageEditorDialog {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText("Mark as approved"));
      });

      expect(defaultProps.onUpdate).toHaveBeenCalledWith("story-1", {
        curationStatus: "approved",
      });
      // Modal stays open so user can continue editing
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it("shows 'Mark as pending' button when status is approved", () => {
      const approvedStory = { ...mockStory, curationStatus: "approved" as const };
      render(<ImageEditorDialog {...defaultProps} story={approvedStory} />);

      expect(screen.getByText("Mark as pending")).toBeInTheDocument();
      expect(screen.queryByText("Mark as approved")).not.toBeInTheDocument();
    });

    it("mark as pending calls updateStoryStatus with 'needs_curation'", async () => {
      mockUpdateStoryStatus.mockResolvedValue({
        data: { id: "story-1", curationStatus: "needs_curation" },
      });

      const approvedStory = { ...mockStory, curationStatus: "approved" as const };
      render(<ImageEditorDialog {...defaultProps} story={approvedStory} />);

      await act(async () => {
        fireEvent.click(screen.getByText("Mark as pending"));
      });

      expect(mockUpdateStoryStatus).toHaveBeenCalledWith(
        "story-1",
        "needs_curation"
      );
    });

    it("shows error when approve fails via API", async () => {
      mockUpdateStoryStatus.mockResolvedValue({
        error: "Failed to update status",
      });

      render(<ImageEditorDialog {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText("Mark as approved"));
      });

      expect(screen.getByText("Failed to update status")).toBeInTheDocument();
    });

    it("shows error when approve throws an exception", async () => {
      mockUpdateStoryStatus.mockRejectedValue(new Error("Network error"));

      render(<ImageEditorDialog {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText("Mark as approved"));
      });

      expect(screen.getByText("Failed to approve story")).toBeInTheDocument();
    });

    it("shows error when mark as pending fails via API", async () => {
      mockUpdateStoryStatus.mockResolvedValue({
        error: "Cannot change status",
      });

      const approvedStory = { ...mockStory, curationStatus: "approved" as const };
      render(<ImageEditorDialog {...defaultProps} story={approvedStory} />);

      await act(async () => {
        fireEvent.click(screen.getByText("Mark as pending"));
      });

      expect(screen.getByText("Cannot change status")).toBeInTheDocument();
    });

    it("shows error when mark as pending throws an exception", async () => {
      mockUpdateStoryStatus.mockRejectedValue(new Error("Network error"));

      const approvedStory = { ...mockStory, curationStatus: "approved" as const };
      render(<ImageEditorDialog {...defaultProps} story={approvedStory} />);

      await act(async () => {
        fireEvent.click(screen.getByText("Mark as pending"));
      });

      expect(screen.getByText("Failed to update status")).toBeInTheDocument();
    });
  });

  describe("Loading state", () => {
    it("shows loading state during save", async () => {
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockUpdateStoryImageUrl.mockReturnValue(promise);

      render(<ImageEditorDialog {...defaultProps} />);

      // Switch to URL tab first (Content is default)
      fireEvent.click(screen.getByText("URL"));

      const urlInput = screen.getByPlaceholderText("https://example.com/image.jpg");
      fireEvent.change(urlInput, { target: { value: "https://example.com/new.jpg" } });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
      });

      // Should show "Saving" text during loading
      expect(screen.getByText("Saving")).toBeInTheDocument();

      // Resolve and finish
      await act(async () => {
        resolvePromise!({ data: { id: "story-1", image: "https://example.com/new.jpg" } });
      });
    });
  });

  describe("Cancel button", () => {
    it("cancel button calls onClose", () => {
      render(<ImageEditorDialog {...defaultProps} />);

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe("File validation", () => {
    it("rejects invalid file types", async () => {
      render(<ImageEditorDialog {...defaultProps} />);

      fireEvent.click(screen.getByText("Upload"));

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["data"], "test.pdf", { type: "application/pdf" });

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      expect(
        screen.getByText("Invalid file type. Allowed: JPEG, PNG, WebP, GIF")
      ).toBeInTheDocument();
    });

    it("rejects oversized files (>5MB)", async () => {
      render(<ImageEditorDialog {...defaultProps} />);

      fireEvent.click(screen.getByText("Upload"));

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["data"], "large.jpg", { type: "image/jpeg" });
      Object.defineProperty(file, "size", { value: 6 * 1024 * 1024 }); // 6MB

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      expect(screen.getByText("File too large. Maximum size is 5MB")).toBeInTheDocument();
    });

    it("accepts valid file types (JPEG)", async () => {
      render(<ImageEditorDialog {...defaultProps} />);

      fireEvent.click(screen.getByText("Upload"));

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["data"], "test.jpg", { type: "image/jpeg" });
      Object.defineProperty(file, "size", { value: 1024 * 1024 });

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      expect(screen.getByText("test.jpg")).toBeInTheDocument();
      expect(
        screen.queryByText("Invalid file type. Allowed: JPEG, PNG, WebP, GIF")
      ).not.toBeInTheDocument();
    });

    it("accepts valid file types (PNG)", async () => {
      render(<ImageEditorDialog {...defaultProps} />);

      fireEvent.click(screen.getByText("Upload"));

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["data"], "test.png", { type: "image/png" });
      Object.defineProperty(file, "size", { value: 2 * 1024 * 1024 });

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      expect(screen.getByText("test.png")).toBeInTheDocument();
    });
  });

  describe("Drag and drop", () => {
    it("handles drag enter and drag leave", () => {
      render(<ImageEditorDialog {...defaultProps} />);

      fireEvent.click(screen.getByText("Upload"));

      const dropZone = screen.getByText("Click or drag").closest("div[class*='cursor-pointer']")!;

      fireEvent.dragEnter(dropZone, { dataTransfer: { files: [] } });
      expect(screen.getByText("Drop here")).toBeInTheDocument();

      fireEvent.dragLeave(dropZone, { dataTransfer: { files: [] } });
      expect(screen.getByText("Click or drag")).toBeInTheDocument();
    });

    it("handles file drop", async () => {
      render(<ImageEditorDialog {...defaultProps} />);

      fireEvent.click(screen.getByText("Upload"));

      const dropZone = screen.getByText("Click or drag").closest("div[class*='cursor-pointer']")!;

      const file = new File(["image data"], "dropped.png", { type: "image/png" });
      Object.defineProperty(file, "size", { value: 1024 * 1024 });

      await act(async () => {
        fireEvent.drop(dropZone, {
          dataTransfer: { files: [file] },
        });
      });

      expect(screen.getByText("dropped.png")).toBeInTheDocument();
    });
  });

  describe("Fullscreen preview", () => {
    it("shows fullscreen overlay when maximize is clicked", () => {
      render(<ImageEditorDialog {...defaultProps} />);

      // Find the maximize button (the one containing the maximize icon)
      const maximizeIcons = screen.getAllByTestId("icon-maximize");
      const maximizeButton = maximizeIcons[0].closest("button")!;
      fireEvent.click(maximizeButton);

      // Should show the story title in the fullscreen overlay at the bottom
      const titleTexts = screen.getAllByText("Test Story");
      // Should have at least two: one in dialog header, one in fullscreen overlay
      expect(titleTexts.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Clear upload", () => {
    it("clears selected file when X is clicked", async () => {
      render(<ImageEditorDialog {...defaultProps} />);

      fireEvent.click(screen.getByText("Upload"));

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["data"], "test.jpg", { type: "image/jpeg" });
      Object.defineProperty(file, "size", { value: 1024 * 1024 });

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      expect(screen.getByText("test.jpg")).toBeInTheDocument();

      // Find the X button to clear (it's the button containing the X icon near the file name)
      const xIcons = screen.getAllByTestId("icon-x");
      // The clear button is the one within the upload area, near the file name
      const clearButton = xIcons
        .map((icon) => icon.closest("button"))
        .find((btn) => btn && btn.closest("div[class*='flex items-center justify-between']"));
      expect(clearButton).toBeTruthy();
      fireEvent.click(clearButton!);

      // Should show the drop zone again
      expect(screen.getByText("Click or drag")).toBeInTheDocument();
    });
  });

  describe("Placeholder image info", () => {
    const placeholderStory: AdminStory = {
      ...mockStory,
      image: "https://images.unsplash.com/photo-123?w=1920",
      imageSource: `${PLACEHOLDER_PREFIX}Photo by Test Author on Unsplash`,
    };

    it("shows placeholder info note when editing a placeholder image", () => {
      render(<ImageEditorDialog {...defaultProps} story={placeholderStory} />);
      expect(screen.getByText(/placeholder image/i)).toBeInTheDocument();
    });

    it("suggests replacing with a real photo", () => {
      render(<ImageEditorDialog {...defaultProps} story={placeholderStory} />);
      expect(screen.getByText(/replace.*real/i)).toBeInTheDocument();
    });

    it("does not show placeholder info for regular images", () => {
      render(<ImageEditorDialog {...defaultProps} />);
      expect(screen.queryByText(/placeholder image/i)).not.toBeInTheDocument();
    });

    it("does not show placeholder info when story has normal imageSource", () => {
      const normalStory = { ...mockStory, imageSource: "Turismo de Asturias" };
      render(<ImageEditorDialog {...defaultProps} story={normalStory} />);
      expect(screen.queryByText(/placeholder image/i)).not.toBeInTheDocument();
    });
  });

  describe("Content images tab", () => {
    const mockContentImages = [
      {
        filename: "test_page1_img.png",
        sourcePdf: "test.pdf",
        pageNumber: 1,
        width: 1200,
        height: 800,
        aspectRatio: 1.5,
        type: "extracted",
        url: "/content/images/test/test_page1_img.png",
        score: 170,
      },
      {
        filename: "test_page2_img.png",
        sourcePdf: "test.pdf",
        pageNumber: 2,
        width: 900,
        height: 600,
        aspectRatio: 1.5,
        type: "extracted",
        url: "/content/images/test/test_page2_img.png",
        score: 150,
      },
    ];

    const storyWithSourcePdf = { ...mockStory, sourcePdf: "test.pdf" };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("renders Content tab button", () => {
      render(<ImageEditorDialog {...defaultProps} />);
      expect(screen.getByText("Content")).toBeInTheDocument();
    });

    it("can switch to Content tab from URL tab", () => {
      render(<ImageEditorDialog {...defaultProps} story={storyWithSourcePdf} />);

      // Switch to URL tab first
      fireEvent.click(screen.getByText("URL"));
      expect(screen.getByPlaceholderText("https://example.com/image.jpg")).toBeInTheDocument();

      // Then switch back to Content
      fireEvent.click(screen.getByText("Content"));

      // Content tab should show search button
      expect(screen.getByText(/Search PDF/i)).toBeInTheDocument();
    });

    it("shows no source PDF message when story has no sourcePdf", () => {
      render(<ImageEditorDialog {...defaultProps} />);

      fireEvent.click(screen.getByText("Content"));

      expect(screen.getByText(/no source PDF/i)).toBeInTheDocument();
    });

    it("search button calls searchContentImages API", async () => {
      mockSearchContentImages.mockResolvedValue({
        data: { images: mockContentImages, total: 2 },
      });

      render(<ImageEditorDialog {...defaultProps} story={storyWithSourcePdf} />);

      fireEvent.click(screen.getByText("Content"));

      await act(async () => {
        fireEvent.click(screen.getByText(/Search PDF/i));
      });

      expect(mockSearchContentImages).toHaveBeenCalledWith("story-1");
    });

    it("shows image count after successful search", async () => {
      mockSearchContentImages.mockResolvedValue({
        data: { images: mockContentImages, total: 2 },
      });

      render(<ImageEditorDialog {...defaultProps} story={storyWithSourcePdf} />);

      fireEvent.click(screen.getByText("Content"));

      await act(async () => {
        fireEvent.click(screen.getByText(/Search PDF/i));
      });

      expect(screen.getByText(/1 of 2/i)).toBeInTheDocument();
    });

    it("shows no images found message when search returns empty", async () => {
      mockSearchContentImages.mockResolvedValue({
        data: { images: [], total: 0 },
      });

      render(<ImageEditorDialog {...defaultProps} story={storyWithSourcePdf} />);

      fireEvent.click(screen.getByText("Content"));

      await act(async () => {
        fireEvent.click(screen.getByText(/Search PDF/i));
      });

      expect(screen.getByText(/No images found/i)).toBeInTheDocument();
    });

    it("can navigate to next image with chevron buttons", async () => {
      mockSearchContentImages.mockResolvedValue({
        data: { images: mockContentImages, total: 2 },
      });

      render(<ImageEditorDialog {...defaultProps} story={storyWithSourcePdf} />);

      fireEvent.click(screen.getByText("Content"));

      await act(async () => {
        fireEvent.click(screen.getByText(/Search PDF/i));
      });

      // Should show 1 of 2
      expect(screen.getByText(/1 of 2/i)).toBeInTheDocument();

      // Click next button
      const nextButton = screen.getByTestId("icon-chevron-right").closest("button")!;
      fireEvent.click(nextButton);

      // Should now show 2 of 2
      expect(screen.getByText(/2 of 2/i)).toBeInTheDocument();
    });

    it("shows resolution info for selected content image", async () => {
      mockSearchContentImages.mockResolvedValue({
        data: { images: mockContentImages, total: 2 },
      });

      render(<ImageEditorDialog {...defaultProps} story={storyWithSourcePdf} />);

      fireEvent.click(screen.getByText("Content"));

      await act(async () => {
        fireEvent.click(screen.getByText(/Search PDF/i));
      });

      // Should show resolution info (appears in multiple places, so use getAllByText)
      const resolutionElements = screen.getAllByText(/1200 × 800/);
      expect(resolutionElements.length).toBeGreaterThan(0);
    });

    it("auto-populates imageSource when searching content images", async () => {
      mockSearchContentImages.mockResolvedValue({
        data: { images: mockContentImages, total: 2 },
      });

      render(<ImageEditorDialog {...defaultProps} story={storyWithSourcePdf} />);

      fireEvent.click(screen.getByText("Content"));

      await act(async () => {
        fireEvent.click(screen.getByText(/Search PDF/i));
      });

      // Should auto-populate the imageSource field
      const sourceInput = screen.getByPlaceholderText("e.g., Photo by Juan on Unsplash");
      expect(sourceInput).toHaveValue("Turismo de Asturias");
    });

    it("updates imageSource when navigating between content images", async () => {
      mockSearchContentImages.mockResolvedValue({
        data: { images: mockContentImages, total: 2 },
      });

      render(<ImageEditorDialog {...defaultProps} story={storyWithSourcePdf} />);

      fireEvent.click(screen.getByText("Content"));

      await act(async () => {
        fireEvent.click(screen.getByText(/Search PDF/i));
      });

      // Clear the imageSource to verify it gets set again on navigation
      const sourceInput = screen.getByPlaceholderText("e.g., Photo by Juan on Unsplash");
      fireEvent.change(sourceInput, { target: { value: "" } });
      expect(sourceInput).toHaveValue("");

      // Navigate to next image
      const nextButton = screen.getByTestId("icon-chevron-right").closest("button")!;
      fireEvent.click(nextButton);

      // Should have set imageSource again
      expect(sourceInput).toHaveValue("Turismo de Asturias");
    });

    it("saves content image with auto-populated imageSource", async () => {
      mockSearchContentImages.mockResolvedValue({
        data: { images: mockContentImages, total: 2 },
      });
      mockUpdateStoryImageUrl.mockResolvedValue({
        data: { id: "story-1", image: mockContentImages[0].url, imageSource: "Turismo de Asturias" },
      });

      render(<ImageEditorDialog {...defaultProps} story={storyWithSourcePdf} />);

      await act(async () => {
        fireEvent.click(screen.getByText(/Search PDF/i));
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
      });

      expect(mockUpdateStoryImageUrl).toHaveBeenCalledWith(
        "story-1",
        mockContentImages[0].url,
        "Turismo de Asturias"
      );
    });
  });
});
