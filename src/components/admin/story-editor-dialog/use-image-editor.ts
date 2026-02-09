import { useState, useRef, useCallback, useEffect } from "react";
import { searchContentImages } from "@/lib/admin-api";
import type { ContentImage } from "@/types/admin";
import type { AdminStory, ImageSourceType } from "./types";

export interface ImageEditorState {
  // Image source tab
  imageSourceTab: ImageSourceType;
  setImageSourceTab: (tab: ImageSourceType) => void;

  // Image form state
  imageUrl: string;
  imageSource: string;
  setImageSource: (source: string) => void;
  previewUrl: string | null;
  selectedFile: File | null;
  isDragging: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;

  // Content images state
  contentImages: ContentImage[];
  contentImageIndex: number;
  isSearchingContent: boolean;
  contentSearched: boolean;
  currentContentImage: ContentImage | null;

  // UI state
  isFullscreen: boolean;
  setIsFullscreen: (fullscreen: boolean) => void;

  // Computed
  currentPreview: string | null;

  // Handlers
  handleUrlChange: (url: string) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragEnter: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  clearUpload: () => void;
  handleSearchContent: () => Promise<void>;
  handleContentImageNav: (direction: "prev" | "next") => void;

  // Reset
  resetImageState: () => void;
}

/**
 * Custom hook that encapsulates all image-related state and handlers
 * for the image editor (used by both ImageEditorDialog and StoryEditorDialog).
 */
export function useImageEditor(
  story: AdminStory | null,
  setError: (error: string) => void,
): ImageEditorState {
  // Image source tab
  const [imageSourceTab, setImageSourceTab] = useState<ImageSourceType>("content");

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
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Initialize imageSource when story changes
  useEffect(() => {
    if (story?.imageSource) {
      setImageSource(story.imageSource);
    } else {
      setImageSource("");
    }
    // Reset image state when story changes
    setPreviewUrl(null);
    setImageUrl("");
    setSelectedFile(null);
    setContentImages([]);
    setContentSearched(false);
  }, [story]);

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
  }, [setError]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }
    validateAndSetFile(file);
  }, [validateAndSetFile]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

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

  const handleUrlChange = useCallback((url: string) => {
    setImageUrl(url);
    setError("");
    if (url) {
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  }, [setError]);

  const clearUpload = useCallback(() => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleSearchContent = useCallback(async () => {
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
  }, [story, setError]);

  const handleContentImageNav = useCallback((direction: "prev" | "next") => {
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
  }, [contentImages, contentImageIndex]);

  const currentContentImage = contentImages[contentImageIndex] || null;
  const currentPreview = previewUrl || (story?.image ?? null);

  const resetImageState = useCallback(() => {
    setImageSourceTab("content");
    setImageUrl("");
    setImageSource("");
    setPreviewUrl(null);
    setSelectedFile(null);
    setIsDragging(false);
    setContentImages([]);
    setContentImageIndex(0);
    setContentSearched(false);
    setIsFullscreen(false);
  }, []);

  return {
    // Image source tab
    imageSourceTab,
    setImageSourceTab,

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
    isFullscreen,
    setIsFullscreen,

    // Computed
    currentPreview,

    // Handlers
    handleUrlChange,
    handleFileChange,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    clearUpload,
    handleSearchContent,
    handleContentImageNav,

    // Reset
    resetImageState,
  };
}
