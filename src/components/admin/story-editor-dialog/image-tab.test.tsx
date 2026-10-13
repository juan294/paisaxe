import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImageTab } from "./image-tab";
import { ImageEditorProvider } from "./image-editor-context";
import type { ImageEditorState } from "./use-image-editor";
import type { AdminStory, ContentImage } from "@/types/admin";

// Mock next/image
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} />
  ),
}));

// Mock the isPlaceholderImage utility
vi.mock("@/lib/unsplash-placeholders", () => ({
  isPlaceholderImage: vi.fn(() => false),
}));

import { isPlaceholderImage } from "@/lib/unsplash-placeholders";

const mockStory: AdminStory = {
  id: "story-1",
  slug: "test-story",
  title: "Test Story",
  subtitle: "A subtitle",
  description: "A description",
  image: "/images/test.jpg",
  imageSource: "Photo by Test",
  category: "nature",
  sourcePdf: "guide.pdf",
  displayOrder: 1,
  curationStatus: "approved",
  metadata: {},
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function makeMockEditorState(overrides?: Partial<ImageEditorState>): ImageEditorState {
  return {
    imageSourceTab: "content",
    setImageSourceTab: vi.fn(),
    imageUrl: "",
    imageSource: "",
    setImageSource: vi.fn(),
    previewUrl: null,
    selectedFile: null,
    isDragging: false,
    fileInputRef: { current: null },
    contentImages: [],
    contentImageIndex: 0,
    isSearchingContent: false,
    contentSearched: false,
    currentContentImage: null,
    isFullscreen: false,
    setIsFullscreen: vi.fn(),
    currentPreview: null,
    handleUrlChange: vi.fn(),
    handleFileChange: vi.fn(),
    handleDragOver: vi.fn(),
    handleDragEnter: vi.fn(),
    handleDragLeave: vi.fn(),
    handleDrop: vi.fn(),
    clearUpload: vi.fn(),
    handleSearchContent: vi.fn().mockResolvedValue(undefined),
    handleContentImageNav: vi.fn(),
    resetImageState: vi.fn(),
    ...overrides,
  };
}

function renderImageTab(
  story: AdminStory = mockStory,
  editorState?: Partial<ImageEditorState>
) {
  const state = makeMockEditorState(editorState);
  return {
    ...render(
      <ImageEditorProvider value={state}>
        <ImageTab story={story} />
      </ImageEditorProvider>
    ),
    state,
  };
}

describe("ImageTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isPlaceholderImage as ReturnType<typeof vi.fn>).mockReturnValue(false);
  });

  // ---------------------------------------------------------------------------
  // Placeholder warning
  // ---------------------------------------------------------------------------

  describe("placeholder warning", () => {
    it("shows placeholder warning when story has placeholder image", () => {
      (isPlaceholderImage as ReturnType<typeof vi.fn>).mockReturnValue(true);
      renderImageTab();

      expect(
        screen.getByText("This is a placeholder image. Replace it with a real photo.")
      ).toBeInTheDocument();
    });

    it("hides placeholder warning when image is not a placeholder", () => {
      (isPlaceholderImage as ReturnType<typeof vi.fn>).mockReturnValue(false);
      renderImageTab();

      expect(
        screen.queryByText("This is a placeholder image. Replace it with a real photo.")
      ).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Image preview
  // ---------------------------------------------------------------------------

  describe("image preview", () => {
    it("shows image when currentPreview is set", () => {
      renderImageTab(mockStory, { currentPreview: "/images/test.jpg" });

      const img = screen.getByAltText("Test Story");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "/images/test.jpg");
    });

    it("shows no image placeholder when currentPreview is null", () => {
      renderImageTab(mockStory, { currentPreview: null });

      expect(screen.getByText("No image")).toBeInTheDocument();
    });

    it("shows fullscreen button when image is displayed", () => {
      renderImageTab(mockStory, { currentPreview: "/images/test.jpg" });

      expect(screen.getByLabelText("View image fullscreen")).toBeInTheDocument();
    });

    it("calls setIsFullscreen when fullscreen button is clicked", async () => {
      const user = userEvent.setup();
      const { state } = renderImageTab(mockStory, {
        currentPreview: "/images/test.jpg",
      });

      await user.click(screen.getByLabelText("View image fullscreen"));

      expect(state.setIsFullscreen).toHaveBeenCalledWith(true);
    });

    it("shows image dimensions overlay for content tab", () => {
      const contentImage: ContentImage = {
        filename: "img.jpg",
        sourcePdf: "guide.pdf",
        pageNumber: 1,
        width: 800,
        height: 600,
        aspectRatio: 1.33,
        type: "jpeg",
        url: "/content/images/img.jpg",
        score: 0.95,
      };

      renderImageTab(mockStory, {
        imageSourceTab: "content",
        currentPreview: "/content/images/img.jpg",
        currentContentImage: contentImage,
      });

      expect(screen.getByText("800 × 600")).toBeInTheDocument();
    });

    it("does not show dimensions overlay for non-content tabs", () => {
      renderImageTab(mockStory, {
        imageSourceTab: "url",
        currentPreview: "/images/test.jpg",
      });

      expect(screen.queryByText(/×/)).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Image source tabs
  // ---------------------------------------------------------------------------

  describe("image source tabs", () => {
    it("renders all three source tab buttons", () => {
      renderImageTab();

      expect(screen.getByText("Actual")).toBeInTheDocument();
      expect(screen.getByText("URL")).toBeInTheDocument();
      expect(screen.getByText("Upload")).toBeInTheDocument();
    });

    it("switches to content tab", async () => {
      const user = userEvent.setup();
      const { state } = renderImageTab(mockStory, { imageSourceTab: "url" });

      await user.click(screen.getByText("Actual"));

      expect(state.setImageSourceTab).toHaveBeenCalledWith("content");
      expect(state.clearUpload).toHaveBeenCalled();
      expect(state.handleUrlChange).toHaveBeenCalledWith("");
    });

    it("switches to URL tab", async () => {
      const user = userEvent.setup();
      const { state } = renderImageTab(mockStory, { imageSourceTab: "content" });

      await user.click(screen.getByText("URL"));

      expect(state.setImageSourceTab).toHaveBeenCalledWith("url");
      expect(state.clearUpload).toHaveBeenCalled();
    });

    it("switches to upload tab", async () => {
      const user = userEvent.setup();
      const { state } = renderImageTab(mockStory, { imageSourceTab: "content" });

      await user.click(screen.getByText("Upload"));

      expect(state.setImageSourceTab).toHaveBeenCalledWith("upload");
      expect(state.handleUrlChange).toHaveBeenCalledWith("");
    });
  });

  // ---------------------------------------------------------------------------
  // Content tab
  // ---------------------------------------------------------------------------

  describe("current image review", () => {
    it("explains the retired guide-photo selector without offering search", () => {
      const { state } = renderImageTab(mockStory);
      expect(screen.queryByText("Search PDF Images")).not.toBeInTheDocument();
      expect(screen.getByText(/Las fotos extraídas de guías/)).toBeInTheDocument();
      expect(state.handleSearchContent).not.toHaveBeenCalled();
    });
  });

  describe("URL tab", () => {
    it("renders URL input", () => {
      renderImageTab(mockStory, { imageSourceTab: "url" });

      expect(
        screen.getByPlaceholderText("https://example.com/image.jpg")
      ).toBeInTheDocument();
    });

    it("shows current URL value", () => {
      renderImageTab(mockStory, {
        imageSourceTab: "url",
        imageUrl: "https://example.com/photo.jpg",
      });

      const input = screen.getByPlaceholderText("https://example.com/image.jpg");
      expect(input).toHaveValue("https://example.com/photo.jpg");
    });

    it("calls handleUrlChange when URL is edited", async () => {
      const user = userEvent.setup();
      const { state } = renderImageTab(mockStory, { imageSourceTab: "url" });

      const input = screen.getByPlaceholderText("https://example.com/image.jpg");
      await user.type(input, "https://example.com/new.jpg");

      expect(state.handleUrlChange).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Upload tab
  // ---------------------------------------------------------------------------

  describe("upload tab", () => {
    it("renders drag and drop zone when no file selected", () => {
      renderImageTab(mockStory, { imageSourceTab: "upload" });

      expect(screen.getByText("Click or drag")).toBeInTheDocument();
      expect(screen.getByText(/JPEG, PNG, WebP, GIF/)).toBeInTheDocument();
    });

    it("shows 'Drop here' text when dragging", () => {
      renderImageTab(mockStory, { imageSourceTab: "upload", isDragging: true });

      expect(screen.getByText("Drop here")).toBeInTheDocument();
    });

    it("shows file info when file is selected", () => {
      const mockFile = new File(["data"], "photo.jpg", { type: "image/jpeg" });
      Object.defineProperty(mockFile, "size", { value: 2.5 * 1024 * 1024 });

      renderImageTab(mockStory, {
        imageSourceTab: "upload",
        selectedFile: mockFile,
      });

      expect(screen.getByText("photo.jpg")).toBeInTheDocument();
      expect(screen.getByText("2.50 MB")).toBeInTheDocument();
    });

    it("calls clearUpload when remove button is clicked", async () => {
      const user = userEvent.setup();
      const mockFile = new File(["data"], "photo.jpg", { type: "image/jpeg" });

      const { state } = renderImageTab(mockStory, {
        imageSourceTab: "upload",
        selectedFile: mockFile,
      });

      await user.click(screen.getByLabelText("Remove uploaded file"));

      expect(state.clearUpload).toHaveBeenCalled();
    });

    it("renders hidden file input with correct accept attribute", () => {
      renderImageTab(mockStory, { imageSourceTab: "upload" });

      // The file input is hidden but should be in the DOM
      const fileInputs = document.querySelectorAll('input[type="file"]');
      expect(fileInputs.length).toBe(1);
      expect(fileInputs[0]).toHaveAttribute(
        "accept",
        "image/jpeg,image/png,image/webp,image/gif,image/avif"
      );
    });

    it("triggers file input click when drag-drop zone is clicked", async () => {
      const user = userEvent.setup();

      renderImageTab(mockStory, { imageSourceTab: "upload" });

      // The component renders a hidden <input type="file"> and the onClick
      // on the drop zone calls fileInputRef.current?.click()
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).not.toBeNull();
      const clickSpy = vi.spyOn(fileInput, "click");

      // Click on the drop zone
      const dropZone = screen.getByText("Click or drag").closest("div[class*='cursor-pointer']");
      expect(dropZone).not.toBeNull();
      await user.click(dropZone!);

      expect(clickSpy).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Image Attribution
  // ---------------------------------------------------------------------------

  describe("manual photo review", () => {
    it.each(["content", "url", "upload"] as const)("renders explicit review on %s tab", tab => {
      renderImageTab(mockStory, { imageSourceTab: tab });
      expect(screen.getByLabelText("Prueba de permiso / registro conservado")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Confirmar revisión de la foto" })).toBeDisabled();
    });
    it("keeps previous free credit visible without asserting permission", () => {
      renderImageTab(mockStory, { imageSource: "Photo by Juan" });
      expect(screen.getByLabelText("Crédito mostrado")).toHaveValue("Photo by Juan");
      expect(screen.getByLabelText("Licencia")).toHaveValue("");
      expect(screen.getByLabelText("Nombre de quien revisa")).toHaveValue("");
    });
    it("invalidates proof when an operator edits review fields", async () => {
      const user = userEvent.setup(); const { state } = renderImageTab(mockStory);
      await user.type(screen.getByLabelText("Crédito mostrado"), "Fotógrafo/a");
      expect(state.setImageSource).toHaveBeenCalledWith("");
    });
  });
});
