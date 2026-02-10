import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { handleSave, handleApprove, handleMarkNeedsCuration } from "./use-story-editor-save";
import {
  updateStory,
  updateStoryImageUrl,
  uploadStoryImage,
  updateStoryStatus,
  updateStoryImageSource,
  updateStoryTranslation,
} from "@/lib/admin-api";
import type { AdminStory, ContentImage } from "@/types/admin";
import type { StoryTranslation } from "@/types/immersive";
import type { ImageSourceType, PendingTranslationChange } from "./types";

type SaveParams = Parameters<typeof handleSave>[0];

vi.mock("@/lib/admin-api", () => ({
  updateStory: vi.fn(),
  updateStoryImageUrl: vi.fn(),
  uploadStoryImage: vi.fn(),
  updateStoryStatus: vi.fn(),
  updateStoryImageSource: vi.fn(),
  updateStoryTranslation: vi.fn(),
}));

const mockStory = {
  id: "story-1",
  slug: "test-story",
  title: "Test Story",
  subtitle: "A subtitle",
  description: "A description",
  image: "/images/test.jpg",
  imageSource: "Photo by Test",
  category: "nature",
  displayOrder: 1,
  curationStatus: "needs_curation",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
} as AdminStory;

function makeParams(overrides?: Partial<SaveParams>): SaveParams {
  return {
    story: mockStory,
    hasDetailsChanges: false,
    hasImageChanges: false,
    hasTranslationChanges: false,
    pendingTranslations: [],
    title: "Test Story",
    slug: "test-story",
    subtitle: "A subtitle",
    description: "A description",
    category: "nature",
    location: "",
    duration: "",
    sourcePdf: "",
    questionPrompts: [],
    imageSourceTab: "url" as ImageSourceType,
    imageUrl: "",
    imageSource: "",
    selectedFile: null,
    currentContentImage: null,
    onUpdate: vi.fn(),
    setIsLoading: vi.fn(),
    setError: vi.fn(),
    resetAndClose: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// handleSave
// =============================================================================

describe("handleSave", () => {
  describe("details saving", () => {
    it("saves details when hasDetailsChanges is true", async () => {
      const detailsData = {
        title: "Updated Title",
        slug: "updated-title",
        subtitle: "Updated subtitle",
        description: "Updated desc",
        category: "cities",
        location: null,
        duration: null,
        sourcePdf: null,
        metadata: {},
        updatedAt: "2026-01-02T00:00:00Z",
      };
      (updateStory as Mock).mockResolvedValue({ data: detailsData });

      const params = makeParams({
        hasDetailsChanges: true,
        title: "  Updated Title  ",
        slug: "  updated-title  ",
        subtitle: "  Updated subtitle  ",
        description: "  Updated desc  ",
        category: "cities",
        location: "eastern",
        duration: "weekend",
        sourcePdf: "  guide.pdf  ",
        questionPrompts: ["What is this?", "", "How to get there?"],
      });

      await handleSave(params);

      expect(updateStory).toHaveBeenCalledWith("story-1", {
        title: "Updated Title",
        slug: "updated-title",
        subtitle: "Updated subtitle",
        description: "Updated desc",
        category: "cities",
        location: "eastern",
        duration: "weekend",
        sourcePdf: "guide.pdf",
        metadata: {
          question_prompts: ["What is this?", "How to get there?"],
        },
      });
    });

    it("calls onUpdate with result data after successful save", async () => {
      const detailsData = {
        title: "Updated",
        slug: "updated",
        subtitle: "Sub",
        description: "Desc",
        category: "nature",
        location: "central",
        duration: "day-trip",
        sourcePdf: "file.pdf",
        metadata: { question_prompts: ["Q1"] },
        updatedAt: "2026-01-02T00:00:00Z",
      };
      (updateStory as Mock).mockResolvedValue({ data: detailsData });

      const params = makeParams({ hasDetailsChanges: true, title: "Updated" });
      await handleSave(params);

      expect(params.onUpdate).toHaveBeenCalledWith("story-1", {
        title: "Updated",
        slug: "updated",
        subtitle: "Sub",
        description: "Desc",
        category: "nature",
        location: "central",
        duration: "day-trip",
        sourcePdf: "file.pdf",
        metadata: { question_prompts: ["Q1"] },
      });
    });

    it("shows error when updateStory returns error", async () => {
      (updateStory as Mock).mockResolvedValue({ error: "Slug already exists" });

      const params = makeParams({ hasDetailsChanges: true });
      await handleSave(params);

      expect(params.setError).toHaveBeenCalledWith("Slug already exists");
      expect(params.setIsLoading).toHaveBeenCalledWith(false);
      expect(params.resetAndClose).not.toHaveBeenCalled();
    });

    it("filters empty question prompts", async () => {
      const detailsData = {
        title: "T",
        slug: "t",
        subtitle: null,
        description: null,
        category: "nature",
        location: null,
        duration: null,
        sourcePdf: null,
        metadata: { question_prompts: ["Valid prompt"] },
        updatedAt: "2026-01-02T00:00:00Z",
      };
      (updateStory as Mock).mockResolvedValue({ data: detailsData });

      const params = makeParams({
        hasDetailsChanges: true,
        questionPrompts: ["Valid prompt", "", "  ", ""],
      });
      await handleSave(params);

      const callArgs = (updateStory as Mock).mock.calls[0][1];
      expect(callArgs.metadata.question_prompts).toEqual(["Valid prompt"]);
    });

    it("sets question_prompts to undefined when all prompts are empty", async () => {
      (updateStory as Mock).mockResolvedValue({
        data: {
          title: "T",
          slug: "t",
          subtitle: null,
          description: null,
          category: "nature",
          location: null,
          duration: null,
          sourcePdf: null,
          metadata: {},
          updatedAt: "2026-01-02T00:00:00Z",
        },
      });

      const params = makeParams({
        hasDetailsChanges: true,
        questionPrompts: ["", "  ", ""],
      });
      await handleSave(params);

      const callArgs = (updateStory as Mock).mock.calls[0][1];
      expect(callArgs.metadata.question_prompts).toBeUndefined();
    });

    it("handles onUpdate when detailsResult.data fields are null/falsy", async () => {
      const detailsData = {
        title: "T",
        slug: "t",
        subtitle: null,
        description: null,
        category: "nature",
        location: null,
        duration: null,
        sourcePdf: null,
        metadata: null,
        updatedAt: "2026-01-02T00:00:00Z",
      };
      (updateStory as Mock).mockResolvedValue({ data: detailsData });

      const params = makeParams({ hasDetailsChanges: true });
      await handleSave(params);

      expect(params.onUpdate).toHaveBeenCalledWith("story-1", {
        title: "T",
        slug: "t",
        subtitle: "",
        description: "",
        category: "nature",
        location: undefined,
        duration: undefined,
        sourcePdf: undefined,
        metadata: undefined,
      });
    });
  });

  describe("image saving", () => {
    it("saves image via URL when imageSourceTab is 'url'", async () => {
      (updateStoryImageUrl as Mock).mockResolvedValue({
        data: { id: "story-1", image: "/images/new.jpg", imageSource: "Photo by URL" },
      });

      const params = makeParams({
        hasImageChanges: true,
        imageSourceTab: "url",
        imageUrl: "https://example.com/photo.jpg",
        imageSource: "Photo by URL",
      });
      await handleSave(params);

      expect(updateStoryImageUrl).toHaveBeenCalledWith(
        "story-1",
        "https://example.com/photo.jpg",
        "Photo by URL"
      );
      expect(params.onUpdate).toHaveBeenCalledWith("story-1", {
        image: "/images/new.jpg",
        imageSource: "Photo by URL",
      });
      expect(params.resetAndClose).toHaveBeenCalled();
    });

    it("saves image via upload when imageSourceTab is 'upload'", async () => {
      const mockFile = new File(["data"], "photo.jpg", { type: "image/jpeg" });
      (uploadStoryImage as Mock).mockResolvedValue({
        data: { id: "story-1", image: "/images/uploaded.jpg", imageSource: "My photo" },
      });

      const params = makeParams({
        hasImageChanges: true,
        imageSourceTab: "upload",
        selectedFile: mockFile,
        imageSource: "My photo",
      });
      await handleSave(params);

      expect(uploadStoryImage).toHaveBeenCalledWith("story-1", mockFile, "My photo");
      expect(params.onUpdate).toHaveBeenCalledWith("story-1", {
        image: "/images/uploaded.jpg",
        imageSource: "My photo",
      });
    });

    it("saves image from content when imageSourceTab is 'content'", async () => {
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
      (updateStoryImageUrl as Mock).mockResolvedValue({
        data: { id: "story-1", image: "/content/images/img.jpg", imageSource: "Content" },
      });

      const params = makeParams({
        hasImageChanges: true,
        imageSourceTab: "content",
        currentContentImage: contentImage,
        imageSource: "Content",
      });
      await handleSave(params);

      expect(updateStoryImageUrl).toHaveBeenCalledWith(
        "story-1",
        "/content/images/img.jpg",
        "Content"
      );
    });

    it("updates only image source when only imageSource changed", async () => {
      const storyWithSource = {
        ...mockStory,
        imageSource: "Old Source",
      } as AdminStory;

      (updateStoryImageSource as Mock).mockResolvedValue({
        data: { id: "story-1", imageSource: "New Source" },
      });

      const params = makeParams({
        story: storyWithSource,
        hasImageChanges: true,
        imageSourceTab: "url",
        imageUrl: "", // no URL provided, so url branch doesn't fire
        imageSource: "New Source",
      });
      await handleSave(params);

      expect(updateStoryImageSource).toHaveBeenCalledWith("story-1", "New Source");
      expect(params.onUpdate).toHaveBeenCalledWith("story-1", {
        imageSource: "New Source",
      });
      expect(params.resetAndClose).toHaveBeenCalled();
    });

    it("shows error when image update fails", async () => {
      (updateStoryImageUrl as Mock).mockResolvedValue({
        error: "Image too large",
      });

      const params = makeParams({
        hasImageChanges: true,
        imageSourceTab: "url",
        imageUrl: "https://example.com/big.jpg",
      });
      await handleSave(params);

      expect(params.setError).toHaveBeenCalledWith("Image too large");
      expect(params.setIsLoading).toHaveBeenCalledWith(false);
      expect(params.resetAndClose).not.toHaveBeenCalled();
    });

    it("shows error when updateStoryImageSource fails", async () => {
      const storyWithSource = {
        ...mockStory,
        imageSource: "Old Source",
      } as AdminStory;

      (updateStoryImageSource as Mock).mockResolvedValue({
        error: "Source update failed",
      });

      const params = makeParams({
        story: storyWithSource,
        hasImageChanges: true,
        imageSourceTab: "url",
        imageUrl: "",
        imageSource: "New Source",
      });
      await handleSave(params);

      expect(params.setError).toHaveBeenCalledWith("Source update failed");
      expect(params.setIsLoading).toHaveBeenCalledWith(false);
      expect(params.resetAndClose).not.toHaveBeenCalled();
    });
  });

  describe("translation saving", () => {
    it("saves translations when hasTranslationChanges is true", async () => {
      (updateStoryTranslation as Mock).mockResolvedValue({
        data: { success: true, locale: "en", storyId: "story-1" },
      });

      const translation: StoryTranslation = {
        title: "English Title",
        subtitle: "English Subtitle",
        description: "English Description",
      };
      const pendingTranslations: PendingTranslationChange[] = [
        { locale: "en", translation },
      ];

      const params = makeParams({
        hasTranslationChanges: true,
        pendingTranslations,
      });
      await handleSave(params);

      expect(updateStoryTranslation).toHaveBeenCalledWith(
        "story-1",
        "en",
        translation
      );
      expect(params.resetAndClose).toHaveBeenCalled();
    });

    it("saves multiple translations sequentially", async () => {
      (updateStoryTranslation as Mock).mockResolvedValue({
        data: { success: true },
      });

      const pendingTranslations: PendingTranslationChange[] = [
        {
          locale: "en",
          translation: { title: "EN", subtitle: "EN sub", description: "EN desc" },
        },
        {
          locale: "fr",
          translation: { title: "FR", subtitle: "FR sub", description: "FR desc" },
        },
        {
          locale: "de",
          translation: { title: "DE", subtitle: "DE sub", description: "DE desc" },
        },
      ];

      const params = makeParams({
        hasTranslationChanges: true,
        pendingTranslations,
      });
      await handleSave(params);

      expect(updateStoryTranslation).toHaveBeenCalledTimes(3);
      expect((updateStoryTranslation as Mock).mock.calls[0][1]).toBe("en");
      expect((updateStoryTranslation as Mock).mock.calls[1][1]).toBe("fr");
      expect((updateStoryTranslation as Mock).mock.calls[2][1]).toBe("de");
    });

    it("shows error when translation save fails and stops further translations", async () => {
      (updateStoryTranslation as Mock)
        .mockResolvedValueOnce({ data: { success: true } })
        .mockResolvedValueOnce({ error: "Translation failed" });

      const pendingTranslations: PendingTranslationChange[] = [
        {
          locale: "en",
          translation: { title: "EN", subtitle: "", description: "" },
        },
        {
          locale: "fr",
          translation: { title: "FR", subtitle: "", description: "" },
        },
        {
          locale: "de",
          translation: { title: "DE", subtitle: "", description: "" },
        },
      ];

      const params = makeParams({
        hasTranslationChanges: true,
        pendingTranslations,
      });
      await handleSave(params);

      expect(updateStoryTranslation).toHaveBeenCalledTimes(2);
      expect(params.setError).toHaveBeenCalledWith("Translation failed");
      expect(params.setIsLoading).toHaveBeenCalledWith(false);
      expect(params.resetAndClose).not.toHaveBeenCalled();
    });

    it("does not save translations when pendingTranslations is empty", async () => {
      const params = makeParams({
        hasTranslationChanges: true,
        pendingTranslations: [],
      });
      await handleSave(params);

      expect(updateStoryTranslation).not.toHaveBeenCalled();
      expect(params.resetAndClose).toHaveBeenCalled();
    });
  });

  describe("general behavior", () => {
    it("calls resetAndClose on success", async () => {
      const params = makeParams();
      await handleSave(params);

      expect(params.resetAndClose).toHaveBeenCalled();
    });

    it("shows generic error on exception", async () => {
      (updateStory as Mock).mockRejectedValue(new Error("Network error"));

      const params = makeParams({ hasDetailsChanges: true });
      await handleSave(params);

      expect(params.setError).toHaveBeenCalledWith("Failed to save changes");
    });

    it("sets isLoading to false in finally block", async () => {
      const params = makeParams();
      await handleSave(params);

      expect(params.setIsLoading).toHaveBeenCalledWith(true);
      expect(params.setIsLoading).toHaveBeenCalledWith(false);
    });

    it("sets isLoading to false even on exception", async () => {
      (updateStory as Mock).mockRejectedValue(new Error("crash"));

      const params = makeParams({ hasDetailsChanges: true });
      await handleSave(params);

      // setIsLoading(true) at start, setIsLoading(false) in finally
      const calls = (params.setIsLoading as unknown as Mock).mock.calls;
      expect(calls[0][0]).toBe(true);
      expect(calls[calls.length - 1][0]).toBe(false);
    });

    it("clears error at the start", async () => {
      const params = makeParams();
      await handleSave(params);

      expect(params.setError).toHaveBeenCalledWith("");
    });

    it("does nothing when no changes are flagged", async () => {
      const params = makeParams({
        hasDetailsChanges: false,
        hasImageChanges: false,
        hasTranslationChanges: false,
      });
      await handleSave(params);

      expect(updateStory).not.toHaveBeenCalled();
      expect(updateStoryImageUrl).not.toHaveBeenCalled();
      expect(uploadStoryImage).not.toHaveBeenCalled();
      expect(updateStoryImageSource).not.toHaveBeenCalled();
      expect(updateStoryTranslation).not.toHaveBeenCalled();
      expect(params.resetAndClose).toHaveBeenCalled();
    });

    it("merges existing metadata with question_prompts", async () => {
      const storyWithMetadata = {
        ...mockStory,
        metadata: { mood_tags: ["relaxing"], asturianu_title: "Hola" },
      } as AdminStory;

      (updateStory as Mock).mockResolvedValue({
        data: {
          title: "T",
          slug: "t",
          subtitle: null,
          description: null,
          category: "nature",
          location: null,
          duration: null,
          sourcePdf: null,
          metadata: { mood_tags: ["relaxing"], asturianu_title: "Hola", question_prompts: ["Q?"] },
          updatedAt: "2026-01-02T00:00:00Z",
        },
      });

      const params = makeParams({
        story: storyWithMetadata,
        hasDetailsChanges: true,
        questionPrompts: ["Q?"],
      });
      await handleSave(params);

      const callArgs = (updateStory as Mock).mock.calls[0][1];
      expect(callArgs.metadata).toEqual({
        mood_tags: ["relaxing"],
        asturianu_title: "Hola",
        question_prompts: ["Q?"],
      });
    });

    it("passes undefined for subtitle/description when empty after trim", async () => {
      (updateStory as Mock).mockResolvedValue({
        data: {
          title: "T",
          slug: "t",
          subtitle: null,
          description: null,
          category: "nature",
          location: null,
          duration: null,
          sourcePdf: null,
          metadata: {},
          updatedAt: "2026-01-02T00:00:00Z",
        },
      });

      const params = makeParams({
        hasDetailsChanges: true,
        subtitle: "  ",
        description: "",
      });
      await handleSave(params);

      const callArgs = (updateStory as Mock).mock.calls[0][1];
      expect(callArgs.subtitle).toBeUndefined();
      expect(callArgs.description).toBeUndefined();
    });

    it("passes null for location/duration when empty", async () => {
      (updateStory as Mock).mockResolvedValue({
        data: {
          title: "T",
          slug: "t",
          subtitle: null,
          description: null,
          category: "nature",
          location: null,
          duration: null,
          sourcePdf: null,
          metadata: {},
          updatedAt: "2026-01-02T00:00:00Z",
        },
      });

      const params = makeParams({
        hasDetailsChanges: true,
        location: "",
        duration: "",
      });
      await handleSave(params);

      const callArgs = (updateStory as Mock).mock.calls[0][1];
      expect(callArgs.location).toBeNull();
      expect(callArgs.duration).toBeNull();
    });
  });
});

// =============================================================================
// handleApprove
// =============================================================================

describe("handleApprove", () => {
  it("calls updateStoryStatus with 'approved'", async () => {
    (updateStoryStatus as Mock).mockResolvedValue({
      data: { id: "story-1", curationStatus: "approved" },
    });

    const onUpdate = vi.fn();
    const setIsLoading = vi.fn();
    const setError = vi.fn();

    await handleApprove(mockStory, onUpdate, setIsLoading, setError);

    expect(updateStoryStatus).toHaveBeenCalledWith("story-1", "approved");
  });

  it("calls onUpdate on success", async () => {
    (updateStoryStatus as Mock).mockResolvedValue({
      data: { id: "story-1", curationStatus: "approved" },
    });

    const onUpdate = vi.fn();
    const setIsLoading = vi.fn();
    const setError = vi.fn();

    await handleApprove(mockStory, onUpdate, setIsLoading, setError);

    expect(onUpdate).toHaveBeenCalledWith("story-1", {
      curationStatus: "approved",
    });
  });

  it("shows error on failure", async () => {
    (updateStoryStatus as Mock).mockResolvedValue({
      error: "Unauthorized",
    });

    const onUpdate = vi.fn();
    const setIsLoading = vi.fn();
    const setError = vi.fn();

    await handleApprove(mockStory, onUpdate, setIsLoading, setError);

    expect(setError).toHaveBeenCalledWith("Unauthorized");
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("shows generic error on exception", async () => {
    (updateStoryStatus as Mock).mockRejectedValue(new Error("Network down"));

    const onUpdate = vi.fn();
    const setIsLoading = vi.fn();
    const setError = vi.fn();

    await handleApprove(mockStory, onUpdate, setIsLoading, setError);

    expect(setError).toHaveBeenCalledWith("Failed to approve story");
  });

  it("sets isLoading correctly", async () => {
    (updateStoryStatus as Mock).mockResolvedValue({
      data: { id: "story-1", curationStatus: "approved" },
    });

    const onUpdate = vi.fn();
    const setIsLoading = vi.fn();
    const setError = vi.fn();

    await handleApprove(mockStory, onUpdate, setIsLoading, setError);

    const calls = setIsLoading.mock.calls;
    expect(calls[0][0]).toBe(true);
    expect(calls[calls.length - 1][0]).toBe(false);
  });

  it("clears error at the start", async () => {
    (updateStoryStatus as Mock).mockResolvedValue({
      data: { id: "story-1", curationStatus: "approved" },
    });

    const onUpdate = vi.fn();
    const setIsLoading = vi.fn();
    const setError = vi.fn();

    await handleApprove(mockStory, onUpdate, setIsLoading, setError);

    expect(setError).toHaveBeenCalledWith("");
  });
});

// =============================================================================
// handleMarkNeedsCuration
// =============================================================================

describe("handleMarkNeedsCuration", () => {
  it("calls updateStoryStatus with 'needs_curation'", async () => {
    (updateStoryStatus as Mock).mockResolvedValue({
      data: { id: "story-1", curationStatus: "needs_curation" },
    });

    const onUpdate = vi.fn();
    const setIsLoading = vi.fn();
    const setError = vi.fn();

    await handleMarkNeedsCuration(mockStory, onUpdate, setIsLoading, setError);

    expect(updateStoryStatus).toHaveBeenCalledWith("story-1", "needs_curation");
  });

  it("calls onUpdate on success", async () => {
    (updateStoryStatus as Mock).mockResolvedValue({
      data: { id: "story-1", curationStatus: "needs_curation" },
    });

    const onUpdate = vi.fn();
    const setIsLoading = vi.fn();
    const setError = vi.fn();

    await handleMarkNeedsCuration(mockStory, onUpdate, setIsLoading, setError);

    expect(onUpdate).toHaveBeenCalledWith("story-1", {
      curationStatus: "needs_curation",
    });
  });

  it("shows error on failure", async () => {
    (updateStoryStatus as Mock).mockResolvedValue({
      error: "Server error",
    });

    const onUpdate = vi.fn();
    const setIsLoading = vi.fn();
    const setError = vi.fn();

    await handleMarkNeedsCuration(mockStory, onUpdate, setIsLoading, setError);

    expect(setError).toHaveBeenCalledWith("Server error");
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("shows generic error on exception", async () => {
    (updateStoryStatus as Mock).mockRejectedValue(new Error("Timeout"));

    const onUpdate = vi.fn();
    const setIsLoading = vi.fn();
    const setError = vi.fn();

    await handleMarkNeedsCuration(mockStory, onUpdate, setIsLoading, setError);

    expect(setError).toHaveBeenCalledWith("Failed to update status");
  });

  it("sets isLoading correctly", async () => {
    (updateStoryStatus as Mock).mockResolvedValue({
      data: { id: "story-1", curationStatus: "needs_curation" },
    });

    const onUpdate = vi.fn();
    const setIsLoading = vi.fn();
    const setError = vi.fn();

    await handleMarkNeedsCuration(mockStory, onUpdate, setIsLoading, setError);

    const calls = setIsLoading.mock.calls;
    expect(calls[0][0]).toBe(true);
    expect(calls[calls.length - 1][0]).toBe(false);
  });
});
