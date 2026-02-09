import { useState, useRef, useCallback, useEffect } from "react";
import { searchContentImages } from "@/lib/admin-api";
import type { ContentImage } from "@/types/admin";
import type { StoryCategory, StoryLocation, StoryDuration } from "@/types/immersive";
import type { AdminStory, TabType, ImageSourceType, PendingTranslationChange } from "./types";
import { generateSlug } from "./types";

export function useStoryEditorState(story: AdminStory | null) {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>("details");
  const [imageSourceTab, setImageSourceTab] = useState<ImageSourceType>("content");

  // Details form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(true); // Default to true for editing
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<StoryCategory | "">("");
  const [location, setLocation] = useState<StoryLocation | "">("");
  const [duration, setDuration] = useState<StoryDuration | "">("");
  const [sourcePdf, setSourcePdf] = useState("");
  const [questionPrompts, setQuestionPrompts] = useState<string[]>([]);
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  // Image form state
  const [imageUrl, setImageUrl] = useState("");
  const [imageSource, setImageSource] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Content images state
  const [contentImages, setContentImages] = useState<ContentImage[]>([]);
  const [contentImageIndex, setContentImageIndex] = useState(0);
  const [isSearchingContent, setIsSearchingContent] = useState(false);
  const [contentSearched, setContentSearched] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasDetailsChanges, setHasDetailsChanges] = useState(false);
  const [hasImageChanges, setHasImageChanges] = useState(false);
  const [hasTranslationChanges, setHasTranslationChanges] = useState(false);
  const [pendingTranslations, setPendingTranslations] = useState<PendingTranslationChange[]>([]);

  // Initialize form when story changes
  useEffect(() => {
    if (story) {
      setTitle(story.title);
      setSlug(story.slug);
      setSlugManuallyEdited(true);
      setSubtitle(story.subtitle || "");
      setDescription(story.description || "");
      setCategory(story.category);
      setLocation(story.location || "");
      setDuration(story.duration || "");
      setSourcePdf(story.sourcePdf || "");
      setQuestionPrompts((story.metadata?.question_prompts as string[]) || []);
      setShowOptionalFields(false);
      setHasDetailsChanges(false);
      setHasImageChanges(false);
      setHasTranslationChanges(false);
      setPendingTranslations([]);
      setPreviewUrl(null);
      setImageUrl("");
      setSelectedFile(null);
      setContentImages([]);
      setContentSearched(false);
    }
  }, [story]);

  // Track details changes
  useEffect(() => {
    if (!story) return;
    const originalPrompts = (story.metadata?.question_prompts as string[]) || [];
    const promptsChanged =
      questionPrompts.length !== originalPrompts.length ||
      questionPrompts.some((p, i) => p !== originalPrompts[i]);
    const changed =
      title !== story.title ||
      slug !== story.slug ||
      subtitle !== (story.subtitle || "") ||
      description !== (story.description || "") ||
      category !== story.category ||
      location !== (story.location || "") ||
      duration !== (story.duration || "") ||
      sourcePdf !== (story.sourcePdf || "") ||
      promptsChanged;
    setHasDetailsChanges(changed);
  }, [story, title, slug, subtitle, description, category, location, duration, sourcePdf, questionPrompts]);

  // Track image changes
  useEffect(() => {
    if (!story) return;
    const changed =
      !!previewUrl ||
      !!selectedFile ||
      imageSource !== (story.imageSource || "");
    setHasImageChanges(changed);
  }, [story, previewUrl, selectedFile, imageSource]);

  // Memoized callback for translation changes to prevent infinite loops
  const handleTranslationChange = useCallback((hasChanges: boolean, changes: PendingTranslationChange[]) => {
    setHasTranslationChanges(hasChanges);
    setPendingTranslations(changes);
  }, []);

  const handleSlugChange = (value: string) => {
    setSlugManuallyEdited(true);
    setSlug(value);
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slugManuallyEdited) {
      setSlug(generateSlug(value));
    }
  };

  // Image handling
  const validateAndSetFile = useCallback((file: File) => {
    setError("");

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      setError("Invalid file type. Allowed: JPEG, PNG, WebP, GIF");
      return false;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("File too large. Maximum size is 5MB");
      return false;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    return true;
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }
    validateAndSetFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith("image/")) {
        validateAndSetFile(file);
      }
    },
    [validateAndSetFile]
  );

  const handleUrlChange = (url: string) => {
    setImageUrl(url);
    setError("");
    if (url) {
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const clearUpload = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSearchContent = async () => {
    if (!story) return;
    setIsSearchingContent(true);
    setError("");

    try {
      const result = await searchContentImages(story.id);

      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setContentImages(result.data.images);
        setContentImageIndex(0);
        setContentSearched(true);

        if (result.data.images.length > 0) {
          const firstImage = result.data.images[0];
          setPreviewUrl(firstImage.url);
          setImageUrl(firstImage.url);
          setImageSource("Turismo de Asturias");
        }
      }
    } catch {
      setError("Failed to search content images");
    } finally {
      setIsSearchingContent(false);
    }
  };

  const handleContentImageNav = (direction: "prev" | "next") => {
    if (contentImages.length === 0) return;

    let newIndex: number;
    if (direction === "prev") {
      newIndex = contentImageIndex === 0 ? contentImages.length - 1 : contentImageIndex - 1;
    } else {
      newIndex = contentImageIndex === contentImages.length - 1 ? 0 : contentImageIndex + 1;
    }

    setContentImageIndex(newIndex);
    const image = contentImages[newIndex];
    setPreviewUrl(image.url);
    setImageUrl(image.url);
    setImageSource("Turismo de Asturias");
  };

  const currentContentImage = contentImages[contentImageIndex] || null;

  const resetAndClose = (onClose: () => void) => {
    setActiveTab("details");
    setImageSourceTab("content");
    setTitle("");
    setSlug("");
    setSubtitle("");
    setDescription("");
    setCategory("");
    setLocation("");
    setDuration("");
    setSourcePdf("");
    setQuestionPrompts([]);
    setImageUrl("");
    setImageSource("");
    setPreviewUrl(null);
    setSelectedFile(null);
    setError("");
    setIsDragging(false);
    setContentImages([]);
    setContentImageIndex(0);
    setContentSearched(false);
    setShowOptionalFields(false);
    onClose();
  };

  const currentPreview = previewUrl || (story?.image ?? null);
  const hasChanges = hasDetailsChanges || hasImageChanges;

  return {
    // Tab state
    activeTab,
    setActiveTab,
    imageSourceTab,
    setImageSourceTab,

    // Details form state
    title,
    slug,
    subtitle,
    setSubtitle,
    description,
    setDescription,
    category,
    setCategory,
    location,
    setLocation,
    duration,
    setDuration,
    sourcePdf,
    setSourcePdf,
    questionPrompts,
    setQuestionPrompts,
    showOptionalFields,
    setShowOptionalFields,

    // Image form state
    imageUrl,
    imageSource,
    setImageSource,
    previewUrl,
    selectedFile,
    isDragging,
    fileInputRef,

    // Content images state
    contentImages,
    contentImageIndex,
    isSearchingContent,
    contentSearched,
    currentContentImage,

    // UI state
    isLoading,
    setIsLoading,
    error,
    setError,
    isFullscreen,
    setIsFullscreen,
    hasDetailsChanges,
    hasImageChanges,
    hasTranslationChanges,
    pendingTranslations,

    // Handlers
    handleTitleChange,
    handleSlugChange,
    handleFileChange,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    handleUrlChange,
    clearUpload,
    handleSearchContent,
    handleContentImageNav,
    handleTranslationChange,

    // Computed
    currentPreview,
    hasChanges,
    resetAndClose,
  };
}
