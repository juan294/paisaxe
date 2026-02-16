import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { ImageEditorProvider, useImageEditorContext } from "./image-editor-context";
import type { ImageEditorState } from "./use-image-editor";

function makeMockImageEditorState(overrides?: Partial<ImageEditorState>): ImageEditorState {
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

describe("image-editor-context", () => {
  describe("useImageEditorContext", () => {
    it("throws when used outside ImageEditorProvider", () => {
      // Suppress console.error from React for the expected error
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() => {
        renderHook(() => useImageEditorContext());
      }).toThrow("useImageEditorContext must be used within an ImageEditorProvider");

      consoleSpy.mockRestore();
    });

    it("returns the context value when used within ImageEditorProvider", () => {
      const mockState = makeMockImageEditorState({ imageUrl: "https://example.com/img.jpg" });

      const { result } = renderHook(() => useImageEditorContext(), {
        wrapper: ({ children }) => (
          <ImageEditorProvider value={mockState}>{children}</ImageEditorProvider>
        ),
      });

      expect(result.current).toBe(mockState);
      expect(result.current.imageUrl).toBe("https://example.com/img.jpg");
    });

    it("provides all ImageEditorState properties", () => {
      const mockState = makeMockImageEditorState();

      const { result } = renderHook(() => useImageEditorContext(), {
        wrapper: ({ children }) => (
          <ImageEditorProvider value={mockState}>{children}</ImageEditorProvider>
        ),
      });

      // Verify all expected keys are present
      expect(result.current.imageSourceTab).toBe("content");
      expect(result.current.setImageSourceTab).toBeDefined();
      expect(result.current.imageUrl).toBe("");
      expect(result.current.imageSource).toBe("");
      expect(result.current.setImageSource).toBeDefined();
      expect(result.current.previewUrl).toBeNull();
      expect(result.current.selectedFile).toBeNull();
      expect(result.current.isDragging).toBe(false);
      expect(result.current.fileInputRef).toEqual({ current: null });
      expect(result.current.contentImages).toEqual([]);
      expect(result.current.contentImageIndex).toBe(0);
      expect(result.current.isSearchingContent).toBe(false);
      expect(result.current.contentSearched).toBe(false);
      expect(result.current.currentContentImage).toBeNull();
      expect(result.current.isFullscreen).toBe(false);
      expect(result.current.setIsFullscreen).toBeDefined();
      expect(result.current.currentPreview).toBeNull();
      expect(result.current.handleUrlChange).toBeDefined();
      expect(result.current.handleFileChange).toBeDefined();
      expect(result.current.handleDragOver).toBeDefined();
      expect(result.current.handleDragEnter).toBeDefined();
      expect(result.current.handleDragLeave).toBeDefined();
      expect(result.current.handleDrop).toBeDefined();
      expect(result.current.clearUpload).toBeDefined();
      expect(result.current.handleSearchContent).toBeDefined();
      expect(result.current.handleContentImageNav).toBeDefined();
      expect(result.current.resetImageState).toBeDefined();
    });

    it("reflects updated context values on re-render", () => {
      const mockState = makeMockImageEditorState({ isFullscreen: false });

      const { result, rerender } = renderHook(() => useImageEditorContext(), {
        wrapper: ({ children }) => (
          <ImageEditorProvider value={mockState}>{children}</ImageEditorProvider>
        ),
      });

      expect(result.current.isFullscreen).toBe(false);

      // Update the mock state and re-render
      mockState.isFullscreen = true;
      rerender();

      expect(result.current.isFullscreen).toBe(true);
    });
  });

  describe("ImageEditorProvider", () => {
    it("renders children", () => {
      const mockState = makeMockImageEditorState();

      const { result } = renderHook(() => useImageEditorContext(), {
        wrapper: ({ children }) => (
          <ImageEditorProvider value={mockState}>
            <div data-testid="child">{children}</div>
          </ImageEditorProvider>
        ),
      });

      // If we reach here without error, the provider rendered children
      expect(result.current).toBeDefined();
    });
  });
});
