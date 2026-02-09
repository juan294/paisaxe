import {
  updateStory,
  updateStoryImageUrl,
  uploadStoryImage,
  updateStoryStatus,
  updateStoryImageSource,
  updateStoryTranslation,
} from "@/lib/admin-api";
import type { CurationStatus, ContentImage } from "@/types/admin";
import type { StoryCategory, StoryLocation, StoryDuration } from "@/types/immersive";
import type { AdminStory, ImageSourceType, PendingTranslationChange } from "./types";

interface SaveParams {
  story: AdminStory;
  hasDetailsChanges: boolean;
  hasImageChanges: boolean;
  hasTranslationChanges: boolean;
  pendingTranslations: PendingTranslationChange[];

  // Details
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  category: StoryCategory | "";
  location: StoryLocation | "";
  duration: StoryDuration | "";
  sourcePdf: string;
  questionPrompts: string[];

  // Image
  imageSourceTab: ImageSourceType;
  imageUrl: string;
  imageSource: string;
  selectedFile: File | null;
  currentContentImage: ContentImage | null;

  // Callbacks
  onUpdate: (storyId: string, updates: Partial<AdminStory>) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string) => void;
  resetAndClose: () => void;
}

export async function handleSave(params: SaveParams): Promise<void> {
  const {
    story,
    hasDetailsChanges,
    hasImageChanges,
    hasTranslationChanges,
    pendingTranslations,
    title,
    slug,
    subtitle,
    description,
    category,
    location,
    duration,
    sourcePdf,
    questionPrompts,
    imageSourceTab,
    imageUrl,
    imageSource,
    selectedFile,
    currentContentImage,
    onUpdate,
    setIsLoading,
    setError,
    resetAndClose,
  } = params;

  setIsLoading(true);
  setError("");

  try {
    // Save details if changed
    if (hasDetailsChanges) {
      const filteredPrompts = questionPrompts.filter(p => p.trim());
      const updatedMetadata = {
        ...(story.metadata || {}),
        question_prompts: filteredPrompts.length > 0 ? filteredPrompts : undefined,
      };

      const detailsResult = await updateStory(story.id, {
        title: title.trim(),
        slug: slug.trim(),
        subtitle: subtitle.trim() || undefined,
        description: description.trim() || undefined,
        category: category as StoryCategory,
        location: location ? (location as StoryLocation) : null,
        duration: duration ? (duration as StoryDuration) : null,
        sourcePdf: sourcePdf.trim() || null,
        metadata: updatedMetadata,
      });

      if (detailsResult.error) {
        setError(detailsResult.error);
        setIsLoading(false);
        return;
      }

      if (detailsResult.data) {
        onUpdate(story.id, {
          title: detailsResult.data.title,
          slug: detailsResult.data.slug,
          subtitle: detailsResult.data.subtitle || "",
          description: detailsResult.data.description || "",
          category: detailsResult.data.category,
          location: detailsResult.data.location || undefined,
          duration: detailsResult.data.duration || undefined,
          sourcePdf: detailsResult.data.sourcePdf || undefined,
          metadata: detailsResult.data.metadata || undefined,
        });
      }
    }

    // Save image if changed
    if (hasImageChanges) {
      let imageResult;

      if (imageSourceTab === "url" && imageUrl) {
        imageResult = await updateStoryImageUrl(story.id, imageUrl, imageSource || undefined);
      } else if (imageSourceTab === "upload" && selectedFile) {
        imageResult = await uploadStoryImage(story.id, selectedFile, imageSource || undefined);
      } else if (imageSourceTab === "content" && currentContentImage) {
        imageResult = await updateStoryImageUrl(story.id, currentContentImage.url, imageSource || undefined);
      } else if (imageSource !== (story.imageSource || "")) {
        // Only source changed
        const sourceResult = await updateStoryImageSource(story.id, imageSource);
        if (sourceResult.error) {
          setError(sourceResult.error);
          setIsLoading(false);
          return;
        }
        if (sourceResult.data) {
          onUpdate(story.id, { imageSource: sourceResult.data.imageSource });
        }
      }

      if (imageResult) {
        if (imageResult.error) {
          setError(imageResult.error);
          setIsLoading(false);
          return;
        }
        if (imageResult.data) {
          onUpdate(story.id, { image: imageResult.data.image, imageSource: imageResult.data.imageSource });
        }
      }
    }

    // Save translations if changed
    if (hasTranslationChanges && pendingTranslations.length > 0) {
      for (const { locale, translation } of pendingTranslations) {
        const translationResult = await updateStoryTranslation(story.id, locale, translation);
        if (translationResult.error) {
          setError(translationResult.error);
          setIsLoading(false);
          return;
        }
      }
    }

    resetAndClose();
  } catch {
    setError("Failed to save changes");
  } finally {
    setIsLoading(false);
  }
}

export async function handleApprove(
  story: AdminStory,
  onUpdate: (storyId: string, updates: Partial<AdminStory>) => void,
  setIsLoading: (loading: boolean) => void,
  setError: (error: string) => void,
): Promise<void> {
  setIsLoading(true);
  setError("");

  try {
    const result = await updateStoryStatus(story.id, "approved");

    if (result.error) {
      setError(result.error);
    } else {
      onUpdate(story.id, { curationStatus: "approved" as CurationStatus });
    }
  } catch {
    setError("Failed to approve story");
  } finally {
    setIsLoading(false);
  }
}

export async function handleMarkNeedsCuration(
  story: AdminStory,
  onUpdate: (storyId: string, updates: Partial<AdminStory>) => void,
  setIsLoading: (loading: boolean) => void,
  setError: (error: string) => void,
): Promise<void> {
  setIsLoading(true);
  setError("");

  try {
    const result = await updateStoryStatus(story.id, "needs_curation");

    if (result.error) {
      setError(result.error);
    } else {
      onUpdate(story.id, { curationStatus: "needs_curation" as CurationStatus });
    }
  } catch {
    setError("Failed to update status");
  } finally {
    setIsLoading(false);
  }
}
