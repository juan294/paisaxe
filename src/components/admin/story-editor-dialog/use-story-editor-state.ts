import { useState, useCallback, useEffect } from "react";
import type { StoryCategory, StoryLocation, StoryDuration } from "@/types/immersive";
import type { AdminStory, TabType, PendingTranslationChange } from "./types";
import { generateSlug } from "./types";
import { useImageEditor } from "./use-image-editor";

export function useStoryEditorState(story: AdminStory | null) {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>("details");

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

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasDetailsChanges, setHasDetailsChanges] = useState(false);
  const [hasTranslationChanges, setHasTranslationChanges] = useState(false);
  const [pendingTranslations, setPendingTranslations] = useState<PendingTranslationChange[]>([]);

  // Image state via shared hook
  const setErrorStable = useCallback((e: string) => setError(e), []);
  const imageEditor = useImageEditor(story, setErrorStable);

  // Track image changes
  const [hasImageChanges, setHasImageChanges] = useState(false);

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
      !!imageEditor.previewUrl ||
      !!imageEditor.selectedFile ||
      imageEditor.imageSource !== (story.imageSource || "");
    setHasImageChanges(changed);
  }, [story, imageEditor.previewUrl, imageEditor.selectedFile, imageEditor.imageSource]);

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

  const resetAndClose = (onClose: () => void) => {
    setActiveTab("details");
    setTitle("");
    setSlug("");
    setSubtitle("");
    setDescription("");
    setCategory("");
    setLocation("");
    setDuration("");
    setSourcePdf("");
    setQuestionPrompts([]);
    setError("");
    setShowOptionalFields(false);
    imageEditor.resetImageState();
    onClose();
  };

  const currentPreview = imageEditor.currentPreview;
  const hasChanges = hasDetailsChanges || hasImageChanges;

  return {
    // Tab state
    activeTab,
    setActiveTab,

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

    // Image state (delegated to useImageEditor)
    imageEditor,

    // UI state
    isLoading,
    setIsLoading,
    error,
    setError,
    hasDetailsChanges,
    hasImageChanges,
    hasTranslationChanges,
    pendingTranslations,

    // Handlers
    handleTitleChange,
    handleSlugChange,
    handleTranslationChange,

    // Computed
    currentPreview,
    hasChanges,
    resetAndClose,
  };
}
