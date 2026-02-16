import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useImageEditor } from "./use-image-editor";
import { searchContentImages } from "@/lib/admin-api";
import type { AdminStory } from "@/types/admin";

vi.mock("@/lib/admin-api", () => ({
  searchContentImages: vi.fn(),
}));

// Mock URL.createObjectURL / URL.revokeObjectURL
const mockObjectUrl = "blob:http://localhost/mock-file-url";
globalThis.URL.createObjectURL = vi.fn(() => mockObjectUrl);
globalThis.URL.revokeObjectURL = vi.fn();

const mockStory: AdminStory = {
  id: "story-1",
  slug: "test-story",
  title: "Test Story",
  subtitle: "A subtitle",
  description: "A description",
  image: "/images/test.jpg",
  imageSource: "Photo by Test",
  category: "nature",
  displayOrder: 1,
  curationStatus: "approved",
  sourcePdf: "guide.pdf",
  metadata: {},
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("useImageEditor", () => {
  const mockSetError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  describe("initialization", () => {
    it("initializes with default state", () => {
      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));

      expect(result.current.imageSourceTab).toBe("content");
      expect(result.current.imageUrl).toBe("");
      expect(result.current.imageSource).toBe("Photo by Test");
      expect(result.current.previewUrl).toBeNull();
      expect(result.current.selectedFile).toBeNull();
      expect(result.current.isDragging).toBe(false);
      expect(result.current.contentImages).toEqual([]);
      expect(result.current.contentImageIndex).toBe(0);
      expect(result.current.isSearchingContent).toBe(false);
      expect(result.current.contentSearched).toBe(false);
      expect(result.current.currentContentImage).toBeNull();
      expect(result.current.isFullscreen).toBe(false);
    });

    it("initializes imageSource from story.imageSource", () => {
      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));
      expect(result.current.imageSource).toBe("Photo by Test");
    });

    it("initializes imageSource as empty when story has no imageSource", () => {
      const storyNoSource: AdminStory = { ...mockStory, imageSource: undefined };
      const { result } = renderHook(() => useImageEditor(storyNoSource, mockSetError));
      expect(result.current.imageSource).toBe("");
    });

    it("initializes with null story", () => {
      const { result } = renderHook(() => useImageEditor(null, mockSetError));

      expect(result.current.imageSource).toBe("");
      expect(result.current.currentPreview).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // currentPreview computed property
  // ---------------------------------------------------------------------------

  describe("currentPreview", () => {
    it("returns story.image when no previewUrl is set", () => {
      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));
      expect(result.current.currentPreview).toBe("/images/test.jpg");
    });

    it("returns null when story is null and no previewUrl", () => {
      const { result } = renderHook(() => useImageEditor(null, mockSetError));
      expect(result.current.currentPreview).toBeNull();
    });

    it("returns previewUrl when URL is set", () => {
      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));

      act(() => {
        result.current.handleUrlChange("https://example.com/new.jpg");
      });

      expect(result.current.currentPreview).toBe("https://example.com/new.jpg");
    });
  });

  // ---------------------------------------------------------------------------
  // Story change effect
  // ---------------------------------------------------------------------------

  describe("story change effect", () => {
    it("resets image state when story changes", () => {
      const { result, rerender } = renderHook(
        ({ story }) => useImageEditor(story, mockSetError),
        { initialProps: { story: mockStory } }
      );

      // Set some state
      act(() => {
        result.current.handleUrlChange("https://example.com/old.jpg");
      });

      // Change story
      const newStory: AdminStory = {
        ...mockStory,
        id: "story-2",
        imageSource: "New Source",
      };
      rerender({ story: newStory });

      expect(result.current.imageSource).toBe("New Source");
      expect(result.current.previewUrl).toBeNull();
      expect(result.current.imageUrl).toBe("");
      expect(result.current.selectedFile).toBeNull();
      expect(result.current.contentImages).toEqual([]);
      expect(result.current.contentSearched).toBe(false);
    });

    it("resets imageSource to empty when new story has no imageSource", () => {
      const { result, rerender } = renderHook(
        ({ story }) => useImageEditor(story, mockSetError),
        { initialProps: { story: mockStory } }
      );

      expect(result.current.imageSource).toBe("Photo by Test");

      const noSourceStory: AdminStory = { ...mockStory, id: "story-2", imageSource: undefined };
      rerender({ story: noSourceStory });

      expect(result.current.imageSource).toBe("");
    });
  });

  // ---------------------------------------------------------------------------
  // handleUrlChange
  // ---------------------------------------------------------------------------

  describe("handleUrlChange", () => {
    it("sets imageUrl and previewUrl from URL", () => {
      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));

      act(() => {
        result.current.handleUrlChange("https://example.com/photo.jpg");
      });

      expect(result.current.imageUrl).toBe("https://example.com/photo.jpg");
      expect(result.current.previewUrl).toBe("https://example.com/photo.jpg");
    });

    it("clears previewUrl when URL is empty", () => {
      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));

      act(() => {
        result.current.handleUrlChange("https://example.com/photo.jpg");
      });
      act(() => {
        result.current.handleUrlChange("");
      });

      expect(result.current.imageUrl).toBe("");
      expect(result.current.previewUrl).toBeNull();
    });

    it("clears error on URL change", () => {
      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));

      act(() => {
        result.current.handleUrlChange("https://example.com/photo.jpg");
      });

      expect(mockSetError).toHaveBeenCalledWith("");
    });
  });

  // ---------------------------------------------------------------------------
  // handleFileChange (file validation)
  // ---------------------------------------------------------------------------

  describe("handleFileChange", () => {
    it("sets selectedFile and previewUrl for valid image", () => {
      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));

      const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
      const event = {
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>;

      act(() => {
        result.current.handleFileChange(event);
      });

      expect(result.current.selectedFile).toBe(file);
      expect(result.current.previewUrl).toBe(mockObjectUrl);
      expect(mockSetError).toHaveBeenCalledWith("");
    });

    it("accepts PNG files", () => {
      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));

      const file = new File(["data"], "photo.png", { type: "image/png" });
      const event = {
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>;

      act(() => {
        result.current.handleFileChange(event);
      });

      expect(result.current.selectedFile).toBe(file);
    });

    it("accepts WebP files", () => {
      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));

      const file = new File(["data"], "photo.webp", { type: "image/webp" });
      const event = {
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>;

      act(() => {
        result.current.handleFileChange(event);
      });

      expect(result.current.selectedFile).toBe(file);
    });

    it("accepts GIF files", () => {
      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));

      const file = new File(["data"], "photo.gif", { type: "image/gif" });
      const event = {
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>;

      act(() => {
        result.current.handleFileChange(event);
      });

      expect(result.current.selectedFile).toBe(file);
    });

    it("rejects invalid file types", () => {
      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));

      const file = new File(["data"], "doc.pdf", { type: "application/pdf" });
      const event = {
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>;

      act(() => {
        result.current.handleFileChange(event);
      });

      expect(result.current.selectedFile).toBeNull();
      expect(mockSetError).toHaveBeenCalledWith("Invalid file type. Allowed: JPEG, PNG, WebP, GIF");
    });

    it("rejects files larger than 5MB", () => {
      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));

      // Create a file > 5MB
      const largeData = new ArrayBuffer(6 * 1024 * 1024);
      const file = new File([largeData], "big.jpg", { type: "image/jpeg" });
      const event = {
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>;

      act(() => {
        result.current.handleFileChange(event);
      });

      expect(result.current.selectedFile).toBeNull();
      expect(mockSetError).toHaveBeenCalledWith("File too large. Maximum size is 5MB");
    });

    it("clears selection when no file provided", () => {
      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));

      // First set a file
      const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
      const event1 = {
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      act(() => {
        result.current.handleFileChange(event1);
      });

      // Then clear it
      const event2 = {
        target: { files: [] },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      act(() => {
        result.current.handleFileChange(event2);
      });

      expect(result.current.selectedFile).toBeNull();
      expect(result.current.previewUrl).toBeNull();
    });

    it("clears selection when files is undefined", () => {
      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));

      const event = {
        target: { files: undefined },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      act(() => {
        result.current.handleFileChange(event);
      });

      expect(result.current.selectedFile).toBeNull();
      expect(result.current.previewUrl).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Drag and drop handlers
  // ---------------------------------------------------------------------------

  describe("drag and drop handlers", () => {
    const makeDragEvent = (files: File[] = []) => ({
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      dataTransfer: { files },
    });

    it("handleDragOver prevents default and stops propagation", () => {
      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));
      const event = makeDragEvent();

      act(() => {
        result.current.handleDragOver(event as unknown as React.DragEvent<HTMLDivElement>);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
    });

    it("handleDragEnter sets isDragging to true", () => {
      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));
      const event = makeDragEvent();

      act(() => {
        result.current.handleDragEnter(event as unknown as React.DragEvent<HTMLDivElement>);
      });

      expect(result.current.isDragging).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
    });

    it("handleDragLeave sets isDragging to false", () => {
      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));
      const event = makeDragEvent();

      // First enter, then leave
      act(() => {
        result.current.handleDragEnter(event as unknown as React.DragEvent<HTMLDivElement>);
      });
      expect(result.current.isDragging).toBe(true);

      act(() => {
        result.current.handleDragLeave(event as unknown as React.DragEvent<HTMLDivElement>);
      });

      expect(result.current.isDragging).toBe(false);
    });

    it("handleDrop sets file from dropped image", () => {
      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));

      const file = new File(["data"], "dropped.jpg", { type: "image/jpeg" });
      const event = makeDragEvent([file]);

      act(() => {
        result.current.handleDrop(event as unknown as React.DragEvent<HTMLDivElement>);
      });

      expect(result.current.isDragging).toBe(false);
      expect(result.current.selectedFile).toBe(file);
      expect(result.current.previewUrl).toBe(mockObjectUrl);
    });

    it("handleDrop ignores non-image files", () => {
      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));

      const file = new File(["data"], "doc.pdf", { type: "application/pdf" });
      const event = makeDragEvent([file]);

      act(() => {
        result.current.handleDrop(event as unknown as React.DragEvent<HTMLDivElement>);
      });

      expect(result.current.selectedFile).toBeNull();
      expect(result.current.isDragging).toBe(false);
    });

    it("handleDrop handles empty files", () => {
      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));

      const event = makeDragEvent([]);

      act(() => {
        result.current.handleDrop(event as unknown as React.DragEvent<HTMLDivElement>);
      });

      expect(result.current.selectedFile).toBeNull();
      expect(result.current.isDragging).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // clearUpload
  // ---------------------------------------------------------------------------

  describe("clearUpload", () => {
    it("clears selectedFile and previewUrl", () => {
      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));

      // Set a file first
      const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
      const event = {
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      act(() => {
        result.current.handleFileChange(event);
      });

      expect(result.current.selectedFile).toBe(file);

      act(() => {
        result.current.clearUpload();
      });

      expect(result.current.selectedFile).toBeNull();
      expect(result.current.previewUrl).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // handleSearchContent
  // ---------------------------------------------------------------------------

  describe("handleSearchContent", () => {
    it("searches content images successfully", async () => {
      const images = [
        {
          filename: "img1.jpg",
          sourcePdf: "guide.pdf",
          pageNumber: 1,
          width: 800,
          height: 600,
          aspectRatio: 1.33,
          type: "jpeg",
          url: "/content/images/img1.jpg",
          score: 0.95,
        },
        {
          filename: "img2.jpg",
          sourcePdf: "guide.pdf",
          pageNumber: 2,
          width: 1200,
          height: 800,
          aspectRatio: 1.5,
          type: "jpeg",
          url: "/content/images/img2.jpg",
          score: 0.85,
        },
      ];

      (searchContentImages as Mock).mockResolvedValue({
        data: { images, total: 2 },
      });

      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));

      await act(async () => {
        await result.current.handleSearchContent();
      });

      expect(searchContentImages).toHaveBeenCalledWith("story-1");
      expect(result.current.contentImages).toEqual(images);
      expect(result.current.contentImageIndex).toBe(0);
      expect(result.current.contentSearched).toBe(true);
      expect(result.current.previewUrl).toBe("/content/images/img1.jpg");
      expect(result.current.imageUrl).toBe("/content/images/img1.jpg");
      expect(result.current.imageSource).toBe("Turismo de Asturias");
    });

    it("handles empty results", async () => {
      (searchContentImages as Mock).mockResolvedValue({
        data: { images: [], total: 0 },
      });

      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));

      await act(async () => {
        await result.current.handleSearchContent();
      });

      expect(result.current.contentImages).toEqual([]);
      expect(result.current.contentSearched).toBe(true);
      expect(result.current.previewUrl).toBeNull();
    });

    it("handles API error response", async () => {
      (searchContentImages as Mock).mockResolvedValue({
        error: "Story not found",
      });

      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));

      await act(async () => {
        await result.current.handleSearchContent();
      });

      expect(mockSetError).toHaveBeenCalledWith("Story not found");
      expect(result.current.contentImages).toEqual([]);
      expect(result.current.contentSearched).toBe(false);
    });

    it("handles exception during search", async () => {
      (searchContentImages as Mock).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));

      await act(async () => {
        await result.current.handleSearchContent();
      });

      expect(mockSetError).toHaveBeenCalledWith("Failed to search content images");
    });

    it("does not search when story is null", async () => {
      const { result } = renderHook(() => useImageEditor(null, mockSetError));

      await act(async () => {
        await result.current.handleSearchContent();
      });

      expect(searchContentImages).not.toHaveBeenCalled();
    });

    it("sets isSearchingContent during search", async () => {
      let resolveSearch: (value: unknown) => void;
      (searchContentImages as Mock).mockReturnValue(
        new Promise((resolve) => {
          resolveSearch = resolve;
        })
      );

      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));

      // Start search (don't await)
      let searchPromise: Promise<void>;
      act(() => {
        searchPromise = result.current.handleSearchContent();
      });

      // isSearchingContent should be true during the search
      expect(result.current.isSearchingContent).toBe(true);

      // Resolve the search
      await act(async () => {
        resolveSearch!({ data: { images: [], total: 0 } });
        await searchPromise!;
      });

      expect(result.current.isSearchingContent).toBe(false);
    });

    it("clears error before searching", async () => {
      (searchContentImages as Mock).mockResolvedValue({
        data: { images: [], total: 0 },
      });

      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));

      await act(async () => {
        await result.current.handleSearchContent();
      });

      expect(mockSetError).toHaveBeenCalledWith("");
    });
  });

  // ---------------------------------------------------------------------------
  // handleContentImageNav
  // ---------------------------------------------------------------------------

  describe("handleContentImageNav", () => {
    const images = [
      {
        filename: "img1.jpg",
        sourcePdf: "guide.pdf",
        pageNumber: 1,
        width: 800,
        height: 600,
        aspectRatio: 1.33,
        type: "jpeg",
        url: "/content/images/img1.jpg",
        score: 0.95,
      },
      {
        filename: "img2.jpg",
        sourcePdf: "guide.pdf",
        pageNumber: 2,
        width: 1200,
        height: 800,
        aspectRatio: 1.5,
        type: "jpeg",
        url: "/content/images/img2.jpg",
        score: 0.85,
      },
      {
        filename: "img3.jpg",
        sourcePdf: "guide.pdf",
        pageNumber: 3,
        width: 600,
        height: 400,
        aspectRatio: 1.5,
        type: "jpeg",
        url: "/content/images/img3.jpg",
        score: 0.75,
      },
    ];

    async function setupWithImages() {
      (searchContentImages as Mock).mockResolvedValue({
        data: { images, total: 3 },
      });

      const hookResult = renderHook(() => useImageEditor(mockStory, mockSetError));

      await act(async () => {
        await hookResult.result.current.handleSearchContent();
      });

      return hookResult;
    }

    it("navigates to next image", async () => {
      const { result } = await setupWithImages();

      expect(result.current.contentImageIndex).toBe(0);

      act(() => {
        result.current.handleContentImageNav("next");
      });

      expect(result.current.contentImageIndex).toBe(1);
      expect(result.current.previewUrl).toBe("/content/images/img2.jpg");
      expect(result.current.imageUrl).toBe("/content/images/img2.jpg");
      expect(result.current.imageSource).toBe("Turismo de Asturias");
    });

    it("navigates to previous image", async () => {
      const { result } = await setupWithImages();

      // Navigate to img2 first
      act(() => {
        result.current.handleContentImageNav("next");
      });

      act(() => {
        result.current.handleContentImageNav("prev");
      });

      expect(result.current.contentImageIndex).toBe(0);
      expect(result.current.previewUrl).toBe("/content/images/img1.jpg");
    });

    it("wraps around to last image when going prev from first", async () => {
      const { result } = await setupWithImages();

      expect(result.current.contentImageIndex).toBe(0);

      act(() => {
        result.current.handleContentImageNav("prev");
      });

      expect(result.current.contentImageIndex).toBe(2);
      expect(result.current.previewUrl).toBe("/content/images/img3.jpg");
    });

    it("wraps around to first image when going next from last", async () => {
      const { result } = await setupWithImages();

      // Navigate to last
      act(() => {
        result.current.handleContentImageNav("next"); // -> 1
      });
      act(() => {
        result.current.handleContentImageNav("next"); // -> 2
      });
      act(() => {
        result.current.handleContentImageNav("next"); // -> 0 (wrap)
      });

      expect(result.current.contentImageIndex).toBe(0);
      expect(result.current.previewUrl).toBe("/content/images/img1.jpg");
    });

    it("does nothing when contentImages is empty", () => {
      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));

      act(() => {
        result.current.handleContentImageNav("next");
      });

      expect(result.current.contentImageIndex).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // currentContentImage
  // ---------------------------------------------------------------------------

  describe("currentContentImage", () => {
    it("returns null when no content images", () => {
      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));
      expect(result.current.currentContentImage).toBeNull();
    });

    it("returns the current content image after search", async () => {
      const images = [
        {
          filename: "img1.jpg",
          sourcePdf: "guide.pdf",
          pageNumber: 1,
          width: 800,
          height: 600,
          aspectRatio: 1.33,
          type: "jpeg",
          url: "/content/images/img1.jpg",
          score: 0.95,
        },
      ];

      (searchContentImages as Mock).mockResolvedValue({
        data: { images, total: 1 },
      });

      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));

      await act(async () => {
        await result.current.handleSearchContent();
      });

      expect(result.current.currentContentImage).toEqual(images[0]);
    });
  });

  // ---------------------------------------------------------------------------
  // setImageSourceTab
  // ---------------------------------------------------------------------------

  describe("setImageSourceTab", () => {
    it("changes the image source tab", () => {
      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));

      act(() => {
        result.current.setImageSourceTab("url");
      });

      expect(result.current.imageSourceTab).toBe("url");
    });

    it("can switch between all tab types", () => {
      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));

      act(() => {
        result.current.setImageSourceTab("url");
      });
      expect(result.current.imageSourceTab).toBe("url");

      act(() => {
        result.current.setImageSourceTab("upload");
      });
      expect(result.current.imageSourceTab).toBe("upload");

      act(() => {
        result.current.setImageSourceTab("content");
      });
      expect(result.current.imageSourceTab).toBe("content");
    });
  });

  // ---------------------------------------------------------------------------
  // setIsFullscreen
  // ---------------------------------------------------------------------------

  describe("setIsFullscreen", () => {
    it("toggles fullscreen state", () => {
      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));

      expect(result.current.isFullscreen).toBe(false);

      act(() => {
        result.current.setIsFullscreen(true);
      });

      expect(result.current.isFullscreen).toBe(true);

      act(() => {
        result.current.setIsFullscreen(false);
      });

      expect(result.current.isFullscreen).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // setImageSource
  // ---------------------------------------------------------------------------

  describe("setImageSource", () => {
    it("updates imageSource", () => {
      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));

      act(() => {
        result.current.setImageSource("New Attribution");
      });

      expect(result.current.imageSource).toBe("New Attribution");
    });
  });

  // ---------------------------------------------------------------------------
  // resetImageState
  // ---------------------------------------------------------------------------

  describe("resetImageState", () => {
    it("resets all image state to defaults", () => {
      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));

      // Modify various states
      act(() => {
        result.current.setImageSourceTab("url");
        result.current.handleUrlChange("https://example.com/test.jpg");
        result.current.setImageSource("Custom source");
        result.current.setIsFullscreen(true);
      });

      // Reset
      act(() => {
        result.current.resetImageState();
      });

      expect(result.current.imageSourceTab).toBe("content");
      expect(result.current.imageUrl).toBe("");
      expect(result.current.imageSource).toBe("");
      expect(result.current.previewUrl).toBeNull();
      expect(result.current.selectedFile).toBeNull();
      expect(result.current.isDragging).toBe(false);
      expect(result.current.contentImages).toEqual([]);
      expect(result.current.contentImageIndex).toBe(0);
      expect(result.current.contentSearched).toBe(false);
      expect(result.current.isFullscreen).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // fileInputRef
  // ---------------------------------------------------------------------------

  describe("fileInputRef", () => {
    it("provides a ref object", () => {
      const { result } = renderHook(() => useImageEditor(mockStory, mockSetError));
      expect(result.current.fileInputRef).toEqual({ current: null });
    });
  });
});
