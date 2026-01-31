"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateStory,
  updateStoryImageUrl,
  uploadStoryImage,
  updateStoryStatus,
  searchContentImages,
  updateStoryImageSource,
} from "@/lib/admin-api";
import {
  Link,
  Upload,
  Loader2,
  AlertCircle,
  FolderSearch,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Maximize2,
  X,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import type { AdminStory, CurationStatus, ContentImage } from "@/types/admin";
import type { StoryCategory, StoryLocation, StoryDuration } from "@/types/immersive";
import { cn } from "@/lib/utils";
import { isPlaceholderImage } from "@/lib/unsplash-placeholders";

const CATEGORIES: { value: StoryCategory; label: string }[] = [
  { value: "nature", label: "Nature" },
  { value: "cities", label: "Cities" },
  { value: "food", label: "Food" },
  { value: "culture", label: "Culture" },
  { value: "activities", label: "Activities" },
];

const LOCATIONS: { value: StoryLocation; label: string }[] = [
  { value: "eastern", label: "Eastern Asturias" },
  { value: "central", label: "Central Asturias" },
  { value: "western", label: "Western Asturias" },
];

const DURATIONS: { value: StoryDuration; label: string }[] = [
  { value: "day-trip", label: "Day Trip" },
  { value: "weekend", label: "Weekend" },
  { value: "week", label: "Week" },
];

/**
 * Generate a URL-safe slug from a title.
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n")
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

type TabType = "details" | "image";
type ImageSourceType = "content" | "url" | "upload";

interface StoryEditorDialogProps {
  story: AdminStory | null;
  onClose: () => void;
  onUpdate: (storyId: string, updates: Partial<AdminStory>) => void;
}

export function StoryEditorDialog({
  story,
  onClose,
  onUpdate,
}: StoryEditorDialogProps) {
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
      setImageSource(story.imageSource || "");
      setShowOptionalFields(!!(story.location || story.duration || story.sourcePdf));
      setHasDetailsChanges(false);
      setHasImageChanges(false);
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
    const changed =
      title !== story.title ||
      slug !== story.slug ||
      subtitle !== (story.subtitle || "") ||
      description !== (story.description || "") ||
      category !== story.category ||
      location !== (story.location || "") ||
      duration !== (story.duration || "") ||
      sourcePdf !== (story.sourcePdf || "");
    setHasDetailsChanges(changed);
  }, [story, title, slug, subtitle, description, category, location, duration, sourcePdf]);

  // Track image changes
  useEffect(() => {
    if (!story) return;
    const changed =
      !!previewUrl ||
      !!selectedFile ||
      imageSource !== (story.imageSource || "");
    setHasImageChanges(changed);
  }, [story, previewUrl, selectedFile, imageSource]);

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

  // Save handlers
  const handleSave = async () => {
    if (!story) return;
    setIsLoading(true);
    setError("");

    try {
      // Save details if changed
      if (hasDetailsChanges) {
        const detailsResult = await updateStory(story.id, {
          title: title.trim(),
          slug: slug.trim(),
          subtitle: subtitle.trim() || undefined,
          description: description.trim() || undefined,
          category: category as StoryCategory,
          location: location ? (location as StoryLocation) : null,
          duration: duration ? (duration as StoryDuration) : null,
          sourcePdf: sourcePdf.trim() || null,
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

      resetAndClose();
    } catch {
      setError("Failed to save changes");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!story) return;
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
  };

  const handleMarkNeedsCuration = async () => {
    if (!story) return;
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
  };

  const resetAndClose = () => {
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

  if (!story) return null;

  const currentPreview = previewUrl || story.image;
  const hasChanges = hasDetailsChanges || hasImageChanges;

  return (
    <>
      <Dialog open={!!story} onOpenChange={resetAndClose}>
        <DialogContent className="max-h-[90vh] overflow-y-auto bg-white dark:bg-[#252320] sm:max-w-xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-[#2d2a26] dark:text-[#f5f3ee]">
                  Edit Story
                </DialogTitle>
                <DialogDescription className="text-[#6b6560] dark:text-[#a39e98]">
                  Update story details and image
                </DialogDescription>
              </div>
              {/* Curation Badge */}
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                  story.curationStatus === "approved"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                    : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    story.curationStatus === "approved" ? "bg-emerald-500" : "bg-amber-500"
                  )}
                />
                {story.curationStatus === "approved" ? "Approved" : "Pending"}
              </div>
            </div>
          </DialogHeader>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Main Tabs */}
          <div className="flex gap-1 rounded-xl bg-[#f5f3ee] p-1 dark:bg-[#2d2a26]">
            <button
              onClick={() => setActiveTab("details")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
                activeTab === "details"
                  ? "bg-white text-[#2d2a26] shadow-sm dark:bg-[#3d3a36] dark:text-[#f5f3ee]"
                  : "text-[#6b6560] hover:text-[#2d2a26] dark:text-[#a39e98] dark:hover:text-[#f5f3ee]"
              )}
            >
              <FileText className="h-4 w-4" />
              Details
            </button>
            <button
              onClick={() => setActiveTab("image")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
                activeTab === "image"
                  ? "bg-white text-[#2d2a26] shadow-sm dark:bg-[#3d3a36] dark:text-[#f5f3ee]"
                  : "text-[#6b6560] hover:text-[#2d2a26] dark:text-[#a39e98] dark:hover:text-[#f5f3ee]"
              )}
            >
              <ImageIcon className="h-4 w-4" />
              Image
            </button>
          </div>

          {/* Tab Content */}
          <div className="space-y-4">
            {activeTab === "details" ? (
              <>
                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
                    Title
                  </Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="bg-[#f5f3ee] dark:bg-[#2d2a26]"
                  />
                </div>

                {/* Slug */}
                <div className="space-y-2">
                  <Label htmlFor="slug" className="text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
                    URL Slug
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#a39e98]">/story/</span>
                    <Input
                      id="slug"
                      value={slug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      className="flex-1 bg-[#f5f3ee] dark:bg-[#2d2a26]"
                    />
                  </div>
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
                    Category
                  </Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as StoryCategory)}>
                    <SelectTrigger id="category" className="bg-[#f5f3ee] dark:bg-[#2d2a26]">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Subtitle */}
                <div className="space-y-2">
                  <Label htmlFor="subtitle" className="text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
                    Subtitle
                  </Label>
                  <Input
                    id="subtitle"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="Optional subtitle"
                    className="bg-[#f5f3ee] dark:bg-[#2d2a26]"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
                    Description
                  </Label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description"
                    rows={3}
                    className="w-full rounded-md border border-input bg-[#f5f3ee] px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:bg-[#2d2a26]"
                  />
                </div>

                {/* Optional Fields Toggle */}
                <button
                  type="button"
                  onClick={() => setShowOptionalFields(!showOptionalFields)}
                  className="flex w-full items-center justify-between rounded-lg bg-[#f5f3ee] px-3 py-2 text-sm font-medium text-[#6b6560] transition-colors hover:bg-[#e5e3de] dark:bg-[#2d2a26] dark:text-[#a39e98] dark:hover:bg-[#3d3a36]"
                >
                  <span>Optional Fields</span>
                  {showOptionalFields ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showOptionalFields && (
                  <div className="space-y-4 rounded-lg bg-[#f5f3ee]/50 p-4 dark:bg-[#2d2a26]/50">
                    {/* Location */}
                    <div className="space-y-2">
                      <Label htmlFor="location" className="text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
                        Location
                      </Label>
                      <Select value={location} onValueChange={(v) => setLocation(v as StoryLocation)}>
                        <SelectTrigger id="location" className="bg-white dark:bg-[#252320]">
                          <SelectValue placeholder="Select a region" />
                        </SelectTrigger>
                        <SelectContent>
                          {LOCATIONS.map((loc) => (
                            <SelectItem key={loc.value} value={loc.value}>
                              {loc.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Duration */}
                    <div className="space-y-2">
                      <Label htmlFor="duration" className="text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
                        Duration
                      </Label>
                      <Select value={duration} onValueChange={(v) => setDuration(v as StoryDuration)}>
                        <SelectTrigger id="duration" className="bg-white dark:bg-[#252320]">
                          <SelectValue placeholder="Select visit duration" />
                        </SelectTrigger>
                        <SelectContent>
                          {DURATIONS.map((dur) => (
                            <SelectItem key={dur.value} value={dur.value}>
                              {dur.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Source PDF */}
                    <div className="space-y-2">
                      <Label htmlFor="sourcePdf" className="text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
                        Source PDF
                      </Label>
                      <Input
                        id="sourcePdf"
                        value={sourcePdf}
                        onChange={(e) => setSourcePdf(e.target.value)}
                        placeholder="guide.pdf"
                        className="bg-white dark:bg-[#252320]"
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Placeholder warning */}
                {isPlaceholderImage(story) && (
                  <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>This is a placeholder image. Replace it with a real photo.</span>
                  </div>
                )}

                {/* Image Preview */}
                <div className="relative aspect-video overflow-hidden rounded-xl bg-[#f5f3ee] dark:bg-[#2d2a26]">
                  {currentPreview ? (
                    <>
                      <Image
                        src={currentPreview}
                        alt={story.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 600px"
                      />
                      <button
                        onClick={() => setIsFullscreen(true)}
                        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-black/40 text-white/90 backdrop-blur-sm transition-all hover:bg-black/60"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </button>
                      {imageSourceTab === "content" && currentContentImage && (
                        <div className="absolute bottom-2 left-2 rounded-md bg-black/50 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
                          {currentContentImage.width} × {currentContentImage.height}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-[#a39e98]">
                      <ImagePlus className="h-8 w-8" />
                      <span className="text-sm">No image</span>
                    </div>
                  )}
                </div>

                {/* Image Source Tabs */}
                <div className="flex gap-1 rounded-xl bg-[#f5f3ee] p-1 dark:bg-[#2d2a26]">
                  <button
                    onClick={() => {
                      setImageSourceTab("content");
                      clearUpload();
                      setImageUrl("");
                    }}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                      imageSourceTab === "content"
                        ? "bg-white text-[#2d2a26] shadow-sm dark:bg-[#3d3a36] dark:text-[#f5f3ee]"
                        : "text-[#6b6560] hover:text-[#2d2a26] dark:text-[#a39e98] dark:hover:text-[#f5f3ee]"
                    )}
                  >
                    <FolderSearch className="h-3.5 w-3.5" />
                    Content
                  </button>
                  <button
                    onClick={() => {
                      setImageSourceTab("url");
                      clearUpload();
                    }}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                      imageSourceTab === "url"
                        ? "bg-white text-[#2d2a26] shadow-sm dark:bg-[#3d3a36] dark:text-[#f5f3ee]"
                        : "text-[#6b6560] hover:text-[#2d2a26] dark:text-[#a39e98] dark:hover:text-[#f5f3ee]"
                    )}
                  >
                    <Link className="h-3.5 w-3.5" />
                    URL
                  </button>
                  <button
                    onClick={() => {
                      setImageSourceTab("upload");
                      setImageUrl("");
                      setPreviewUrl(null);
                    }}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                      imageSourceTab === "upload"
                        ? "bg-white text-[#2d2a26] shadow-sm dark:bg-[#3d3a36] dark:text-[#f5f3ee]"
                        : "text-[#6b6560] hover:text-[#2d2a26] dark:text-[#a39e98] dark:hover:text-[#f5f3ee]"
                    )}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Upload
                  </button>
                </div>

                {/* Image Source Content */}
                <div className="space-y-3">
                  {imageSourceTab === "content" ? (
                    <>
                      <button
                        onClick={handleSearchContent}
                        disabled={isSearchingContent || !story.sourcePdf}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#e5e3de] bg-white px-4 py-3 text-sm font-medium text-[#6b6560] transition-all hover:bg-[#f5f3ee] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#3d3a36] dark:bg-[#2d2a26] dark:text-[#a39e98] dark:hover:bg-[#3d3a36]"
                      >
                        {isSearchingContent ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Searching...
                          </>
                        ) : (
                          <>
                            <FolderSearch className="h-4 w-4" />
                            Search PDF Images
                          </>
                        )}
                      </button>

                      {!story.sourcePdf && (
                        <p className="text-center text-xs text-[#a39e98]">
                          This story has no source PDF linked.
                        </p>
                      )}

                      {contentSearched && (
                        <div className="rounded-xl border border-[#e5e3de] bg-white p-3 dark:border-[#3d3a36] dark:bg-[#2d2a26]">
                          {contentImages.length === 0 ? (
                            <p className="text-center text-xs text-[#a39e98]">
                              No images found in the PDF content.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-[#6b6560] dark:text-[#a39e98]">
                                  {contentImageIndex + 1} of {contentImages.length} images
                                </span>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleContentImageNav("prev")}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[#a39e98] transition-colors hover:bg-[#f5f3ee] hover:text-[#6b6560] dark:hover:bg-[#3d3a36]"
                                  >
                                    <ChevronLeft className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleContentImageNav("next")}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[#a39e98] transition-colors hover:bg-[#f5f3ee] hover:text-[#6b6560] dark:hover:bg-[#3d3a36]"
                                  >
                                    <ChevronRight className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                              {currentContentImage && (
                                <div className="flex items-center justify-between text-[10px] text-[#a39e98]">
                                  <span>{currentContentImage.width} × {currentContentImage.height}px</span>
                                  <span>Page {currentContentImage.pageNumber} · {currentContentImage.type}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : imageSourceTab === "url" ? (
                    <Input
                      type="url"
                      placeholder="https://example.com/image.jpg"
                      value={imageUrl}
                      onChange={(e) => handleUrlChange(e.target.value)}
                      className="bg-[#f5f3ee] dark:bg-[#2d2a26]"
                    />
                  ) : (
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleFileChange}
                        className="hidden"
                      />

                      {selectedFile ? (
                        <div className="flex items-center justify-between rounded-xl border border-[#e5e3de] bg-white px-4 py-3 dark:border-[#3d3a36] dark:bg-[#2d2a26]">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2d2a26] dark:bg-[#f5f3ee]">
                              <ImagePlus className="h-4 w-4 text-[#f5f3ee] dark:text-[#2d2a26]" />
                            </div>
                            <div>
                              <p className="text-xs font-medium text-[#2d2a26] dark:text-[#f5f3ee]">{selectedFile.name}</p>
                              <p className="text-[10px] text-[#a39e98]">
                                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={clearUpload}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#a39e98] transition-colors hover:bg-[#f5f3ee] hover:text-[#6b6560] dark:hover:bg-[#3d3a36]"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          onDragOver={handleDragOver}
                          onDragEnter={handleDragEnter}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          className={cn(
                            "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-8 transition-all",
                            isDragging
                              ? "border-[#c9a55c] bg-[#c9a55c]/10"
                              : "border-[#e5e3de] hover:border-[#c9a55c] hover:bg-[#f5f3ee]/50 dark:border-[#3d3a36] dark:hover:border-[#c9a55c] dark:hover:bg-[#2d2a26]/50"
                          )}
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5f3ee] dark:bg-[#2d2a26]">
                            <ImagePlus className="h-5 w-5 text-[#a39e98]" />
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-medium text-[#6b6560] dark:text-[#a39e98]">
                              {isDragging ? "Drop here" : "Click or drag"}
                            </p>
                            <p className="mt-0.5 text-[10px] text-[#a39e98]">
                              JPEG, PNG, WebP, GIF · Max 5MB
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Image Attribution */}
                  <div className="space-y-2 pt-2">
                    <Label htmlFor="imageSource" className="text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
                      Image Attribution
                    </Label>
                    <Input
                      id="imageSource"
                      type="text"
                      placeholder="e.g., Photo by Juan on Unsplash"
                      value={imageSource}
                      onChange={(e) => setImageSource(e.target.value)}
                      className="bg-[#f5f3ee] dark:bg-[#2d2a26]"
                    />
                    <p className="text-[10px] text-[#a39e98]">
                      Will be displayed below the image in stories
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="flex-col gap-3 sm:flex-row sm:justify-between">
            {/* Curation Status Toggle */}
            <div>
              {story.curationStatus === "needs_curation" ? (
                <button
                  onClick={handleApprove}
                  disabled={isLoading}
                  className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Mark as approved
                </button>
              ) : (
                <button
                  onClick={handleMarkNeedsCuration}
                  disabled={isLoading}
                  className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-50 disabled:opacity-50 dark:text-amber-400 dark:hover:bg-amber-900/20"
                >
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Mark as pending
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={resetAndClose}
                disabled={isLoading}
                className="border-[#e5e3de] dark:border-[#3d3a36]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isLoading || !hasChanges}
                className="bg-[#2d2a26] text-[#f5f3ee] hover:bg-[#3d3a36] dark:bg-[#f5f3ee] dark:text-[#2d2a26] dark:hover:bg-[#e5e3de]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Preview */}
      {isFullscreen && currentPreview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95"
          onClick={() => setIsFullscreen(false)}
        >
          <Image
            src={currentPreview}
            alt={story.title}
            fill
            className="object-contain"
            sizes="100vw"
          />
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-black/50 px-4 py-2 text-sm text-white backdrop-blur-sm">
            {story.title}
          </div>
        </div>
      )}
    </>
  );
}
