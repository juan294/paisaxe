import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStoryEditorState } from "./use-story-editor-state";
import type { AdminStory } from "@/types/admin";
import type { ImageEditorState } from "./use-image-editor";
import { generateSlug } from "./types";

// Mock useImageEditor — capture the setError callback passed to it (line 33-34 of source)
const mockResetImageState = vi.fn();
let capturedSetError: ((e: string) => void) | undefined;
const mockImageEditor: ImageEditorState = {
  imageSourceTab: "content" as const,
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
  resetImageState: mockResetImageState,
};

vi.mock("./use-image-editor", () => ({
  useImageEditor: (_story: unknown, setError: (e: string) => void) => {
    capturedSetError = setError;
    return mockImageEditor;
  },
}));

const mockStory: AdminStory = {
  id: "story-1",
  slug: "test-story",
  title: "Test Story",
  subtitle: "A subtitle",
  description: "A description",
  image: "/images/test.jpg",
  imageSource: "content",
  category: "nature",
  sourcePdf: "nature.pdf",
  location: "eastern",
  duration: "day-trip",
  displayOrder: 1,
  curationStatus: "approved",
  metadata: { question_prompts: ["What is nature?", "Where to hike?"] },
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("useStoryEditorState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockImageEditor.previewUrl = null;
    mockImageEditor.selectedFile = null;
    mockImageEditor.imageSource = "";
    mockImageEditor.currentPreview = null;
  });

  it("initializes with null story", () => {
    const { result } = renderHook(() => useStoryEditorState(null));

    expect(result.current.title).toBe("");
    expect(result.current.slug).toBe("");
    expect(result.current.activeTab).toBe("details");
    expect(result.current.hasChanges).toBe(false);
  });

  it("populates form from story", () => {
    const { result } = renderHook(() => useStoryEditorState(mockStory));

    expect(result.current.title).toBe("Test Story");
    expect(result.current.slug).toBe("test-story");
    expect(result.current.subtitle).toBe("A subtitle");
    expect(result.current.description).toBe("A description");
    expect(result.current.category).toBe("nature");
    expect(result.current.location).toBe("eastern");
    expect(result.current.duration).toBe("day-trip");
    expect(result.current.sourcePdf).toBe("nature.pdf");
    expect(result.current.questionPrompts).toEqual(["What is nature?", "Where to hike?"]);
  });

  it("handles story with optional fields missing", () => {
    const minimalStory: AdminStory = {
      ...mockStory,
      subtitle: "",
      description: "",
      location: undefined,
      duration: undefined,
      sourcePdf: undefined,
      imageSource: undefined,
      metadata: undefined,
    };

    const { result } = renderHook(() => useStoryEditorState(minimalStory));

    expect(result.current.subtitle).toBe("");
    expect(result.current.description).toBe("");
    expect(result.current.location).toBe("");
    expect(result.current.duration).toBe("");
    expect(result.current.sourcePdf).toBe("");
    expect(result.current.questionPrompts).toEqual([]);
  });

  describe("handleTitleChange", () => {
    it("updates title", () => {
      const { result } = renderHook(() => useStoryEditorState(mockStory));

      act(() => {
        result.current.handleTitleChange("New Title");
      });

      expect(result.current.title).toBe("New Title");
    });

    it("does not auto-generate slug when slugManuallyEdited is true (default for editing)", () => {
      const { result } = renderHook(() => useStoryEditorState(mockStory));

      act(() => {
        result.current.handleTitleChange("New Title");
      });

      // Slug should remain the original since slugManuallyEdited defaults to true
      expect(result.current.slug).toBe("test-story");
    });

    it("auto-generates slug from title when slug not manually edited", async () => {
      // The slugManuallyEdited state defaults to true in use-story-editor-state.
      // To test the auto-slug path (line 104), we reset module registry and
      // mock React's useState so that useState(true) → useState(false).
      // This is the only useState(true) call in the hook.
      vi.resetModules();

      vi.doMock("react", async () => {
        const actual = await vi.importActual<typeof import("react")>("react");
        const origUseState = actual.useState;
        return {
          ...actual,
          useState: ((initial: unknown) => {
            if (initial === true) {
              return origUseState(false);
            }
            return origUseState(initial);
          }) as typeof actual.useState,
        };
      });

      // Must also re-mock use-image-editor since we reset modules
      vi.doMock("./use-image-editor", () => ({
        useImageEditor: () => mockImageEditor,
      }));

      // Re-import the hook so it picks up the mocked useState
      const { useStoryEditorState: patchedHook } = await import("./use-story-editor-state");

      // Use null story so the useEffect doesn't reset slugManuallyEdited to true
      const { result } = renderHook(() => patchedHook(null));

      act(() => {
        result.current.handleTitleChange("My New Story");
      });

      expect(result.current.title).toBe("My New Story");
      expect(result.current.slug).toBe(generateSlug("My New Story"));

      // Clean up
      vi.doUnmock("react");
      vi.doUnmock("./use-image-editor");
    });
  });

  describe("handleSlugChange", () => {
    it("updates slug and marks as manually edited", () => {
      const { result } = renderHook(() => useStoryEditorState(mockStory));

      act(() => {
        result.current.handleSlugChange("custom-slug");
      });

      expect(result.current.slug).toBe("custom-slug");
    });
  });

  describe("handleTranslationChange", () => {
    it("updates translation change state", () => {
      const { result } = renderHook(() => useStoryEditorState(mockStory));

      act(() => {
        result.current.handleTranslationChange(true, [
          { locale: "en" as const, translation: { title: "English Title", subtitle: "", description: "" } },
        ]);
      });

      expect(result.current.hasTranslationChanges).toBe(true);
      expect(result.current.pendingTranslations).toHaveLength(1);
    });

    it("clears translation changes", () => {
      const { result } = renderHook(() => useStoryEditorState(mockStory));

      act(() => {
        result.current.handleTranslationChange(true, [
          { locale: "en" as const, translation: { title: "T", subtitle: "", description: "" } },
        ]);
      });
      act(() => {
        result.current.handleTranslationChange(false, []);
      });

      expect(result.current.hasTranslationChanges).toBe(false);
      expect(result.current.pendingTranslations).toEqual([]);
    });
  });

  describe("details change tracking", () => {
    it("detects title change", () => {
      const { result } = renderHook(() => useStoryEditorState(mockStory));

      act(() => {
        result.current.handleTitleChange("Different Title");
      });

      expect(result.current.hasDetailsChanges).toBe(true);
      expect(result.current.hasChanges).toBe(true);
    });

    it("detects slug change", () => {
      const { result } = renderHook(() => useStoryEditorState(mockStory));

      act(() => {
        result.current.handleSlugChange("different-slug");
      });

      expect(result.current.hasDetailsChanges).toBe(true);
    });

    it("detects no changes when values match story", () => {
      // Set mock imageSource to match story so image change tracking doesn't flag
      mockImageEditor.imageSource = "content";
      const { result } = renderHook(() => useStoryEditorState(mockStory));

      // No changes made, everything should match
      expect(result.current.hasDetailsChanges).toBe(false);
      expect(result.current.hasChanges).toBe(false);
    });

    it("detects category change", () => {
      const { result } = renderHook(() => useStoryEditorState(mockStory));

      act(() => {
        result.current.setCategory("cities");
      });

      expect(result.current.hasDetailsChanges).toBe(true);
    });

    it("detects question prompts change", () => {
      const { result } = renderHook(() => useStoryEditorState(mockStory));

      act(() => {
        result.current.setQuestionPrompts(["New question"]);
      });

      expect(result.current.hasDetailsChanges).toBe(true);
    });
  });

  describe("resetAndClose", () => {
    it("resets all form state and calls onClose", () => {
      const { result } = renderHook(() => useStoryEditorState(mockStory));
      const onClose = vi.fn();

      // Make some changes first
      act(() => {
        result.current.handleTitleChange("Changed");
        result.current.setCategory("cities");
      });

      // Reset
      act(() => {
        result.current.resetAndClose(onClose);
      });

      expect(result.current.title).toBe("");
      expect(result.current.slug).toBe("");
      expect(result.current.subtitle).toBe("");
      expect(result.current.description).toBe("");
      expect(result.current.category).toBe("");
      expect(result.current.location).toBe("");
      expect(result.current.duration).toBe("");
      expect(result.current.sourcePdf).toBe("");
      expect(result.current.questionPrompts).toEqual([]);
      expect(result.current.error).toBe("");
      expect(result.current.showOptionalFields).toBe(false);
      expect(result.current.activeTab).toBe("details");
      expect(mockResetImageState).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("setErrorStable callback (line 33)", () => {
    it("sets error state when invoked by useImageEditor", () => {
      const { result } = renderHook(() => useStoryEditorState(mockStory));

      // The mock captures the setErrorStable callback passed to useImageEditor
      expect(capturedSetError).toBeDefined();

      // Invoke the captured callback (line 33: useCallback((e: string) => setError(e), []))
      act(() => {
        capturedSetError!("Image upload failed");
      });

      expect(result.current.error).toBe("Image upload failed");
    });
  });

  describe("tab state", () => {
    it("starts on details tab", () => {
      const { result } = renderHook(() => useStoryEditorState(mockStory));
      expect(result.current.activeTab).toBe("details");
    });

    it("can switch tabs", () => {
      const { result } = renderHook(() => useStoryEditorState(mockStory));

      act(() => {
        result.current.setActiveTab("image");
      });

      expect(result.current.activeTab).toBe("image");
    });
  });

  describe("UI state", () => {
    it("manages loading state", () => {
      const { result } = renderHook(() => useStoryEditorState(mockStory));

      expect(result.current.isLoading).toBe(false);

      act(() => {
        result.current.setIsLoading(true);
      });

      expect(result.current.isLoading).toBe(true);
    });

    it("manages error state", () => {
      const { result } = renderHook(() => useStoryEditorState(mockStory));

      expect(result.current.error).toBe("");

      act(() => {
        result.current.setError("Something went wrong");
      });

      expect(result.current.error).toBe("Something went wrong");
    });

    it("manages fullscreen state", () => {
      const { result } = renderHook(() => useStoryEditorState(mockStory));

      expect(result.current.isFullscreen).toBe(false);

      act(() => {
        result.current.setIsFullscreen(true);
      });

      expect(result.current.isFullscreen).toBe(true);
    });

    it("manages optional fields visibility", () => {
      const { result } = renderHook(() => useStoryEditorState(mockStory));

      expect(result.current.showOptionalFields).toBe(false);

      act(() => {
        result.current.setShowOptionalFields(true);
      });

      expect(result.current.showOptionalFields).toBe(true);
    });
  });
});
