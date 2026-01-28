"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurationBadge } from "./curation-badge";
import {
  updateStoryImageUrl,
  uploadStoryImage,
  updateStoryStatus,
  searchContentImages,
} from "@/lib/admin-api";
import {
  Link,
  Upload,
  ImagePlus,
  Maximize2,
  X,
  Loader2,
  AlertCircle,
  FolderSearch,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { AdminStory, CurationStatus, ContentImage } from "@/types/admin";
import { cn } from "@/lib/utils";
import { isPlaceholderImage } from "@/lib/unsplash-placeholders";

interface ImageEditorDialogProps {
  story: AdminStory | null;
  onClose: () => void;
  onUpdate: (storyId: string, updates: Partial<AdminStory>) => void;
}

type TabType = "url" | "upload" | "content";

export function ImageEditorDialog({
  story,
  onClose,
  onUpdate,
}: ImageEditorDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>("content");
  const [imageUrl, setImageUrl] = useState("");
  const [imageSource, setImageSource] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Content images state
  const [contentImages, setContentImages] = useState<ContentImage[]>([]);
  const [contentImageIndex, setContentImageIndex] = useState(0);
  const [isSearchingContent, setIsSearchingContent] = useState(false);
  const [contentSearched, setContentSearched] = useState(false);

  // Initialize imageSource when story changes
  useEffect(() => {
    if (story?.imageSource) {
      setImageSource(story.imageSource);
    } else {
      setImageSource("");
    }
  }, [story]);

  const handleUrlChange = (url: string) => {
    setImageUrl(url);
    setError("");
    if (url) {
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

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

  const handleSave = async () => {
    if (!story) return;
    setIsLoading(true);
    setError("");

    try {
      let result;

      if (activeTab === "url" && imageUrl) {
        result = await updateStoryImageUrl(story.id, imageUrl, imageSource || undefined);
      } else if (activeTab === "upload" && selectedFile) {
        result = await uploadStoryImage(story.id, selectedFile, imageSource || undefined);
      } else if (activeTab === "content" && currentContentImage) {
        // For content images, use the URL (it's a local path that needs to be served)
        result = await updateStoryImageUrl(story.id, currentContentImage.url, imageSource || undefined);
      } else {
        setError("Please provide an image URL, upload a file, or select a content image");
        setIsLoading(false);
        return;
      }

      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        onUpdate(story.id, { image: result.data.image, imageSource: result.data.imageSource });
        resetAndClose();
      }
    } catch {
      setError("Failed to update image");
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
        // Modal stays open so user can continue editing
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
    setImageUrl("");
    setImageSource("");
    setPreviewUrl(null);
    setSelectedFile(null);
    setError("");
    setActiveTab("content");
    setIsDragging(false);
    setContentImages([]);
    setContentImageIndex(0);
    setContentSearched(false);
    onClose();
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

  if (!story) return null;

  const currentPreview = previewUrl || story.image;

  return (
    <>
      <Dialog open={!!story} onOpenChange={resetAndClose}>
        <DialogContent className="max-w-xl gap-0 overflow-hidden rounded-2xl border-white/50 bg-white/80 p-0 shadow-xl shadow-black/10 backdrop-blur-xl">
          {/* Header */}
          <DialogHeader className="border-b border-slate-100/80 px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <DialogTitle className="text-sm font-semibold text-slate-900">
                  {story.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Update hero image
                </DialogDescription>
              </div>
              <CurationBadge status={story.curationStatus} />
            </div>
          </DialogHeader>

          <div className="p-5">
            {/* Placeholder info note */}
            {isPlaceholderImage(story) && (
              <div className="mb-4 rounded-xl border border-blue-200/50 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3">
                <p className="text-xs text-blue-700">
                  This is a <strong>placeholder image</strong> from Unsplash. Replace it with a real photo of this location.
                </p>
              </div>
            )}

            {/* Current/Preview Image */}
            <div className="relative mb-5 aspect-video overflow-hidden rounded-xl bg-slate-100 shadow-sm">
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
                  {/* Resolution info badge for content images */}
                  {activeTab === "content" && currentContentImage && (
                    <div className="absolute bottom-2 left-2 rounded-md bg-black/50 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
                      {currentContentImage.width} × {currentContentImage.height}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm">
                    <ImagePlus className="h-6 w-6" />
                  </div>
                  <span className="text-xs">No image</span>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="mb-4 flex gap-1 rounded-xl bg-slate-100/80 p-1 backdrop-blur-sm">
              <button
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                  activeTab === "content"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                )}
                onClick={() => {
                  setActiveTab("content");
                  clearUpload();
                  setImageUrl("");
                }}
              >
                <FolderSearch className="h-3.5 w-3.5" />
                Content
              </button>
              <button
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                  activeTab === "url"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                )}
                onClick={() => {
                  setActiveTab("url");
                  clearUpload();
                }}
              >
                <Link className="h-3.5 w-3.5" />
                URL
              </button>
              <button
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                  activeTab === "upload"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                )}
                onClick={() => {
                  setActiveTab("upload");
                  setImageUrl("");
                  setPreviewUrl(null);
                }}
              >
                <Upload className="h-3.5 w-3.5" />
                Upload
              </button>
            </div>

            {/* Tab Content */}
            <div className="space-y-3">
              {activeTab === "url" ? (
                <Input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  className="h-10 rounded-xl border-slate-200/80 bg-white/80 text-sm shadow-sm backdrop-blur-sm placeholder:text-slate-400 focus:border-blue-300 focus:ring-blue-200"
                />
              ) : activeTab === "content" ? (
                <div className="space-y-3">
                  {/* Search button */}
                  <button
                    onClick={handleSearchContent}
                    disabled={isSearchingContent || !story?.sourcePdf}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-sm transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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

                  {/* No source PDF warning */}
                  {!story?.sourcePdf && (
                    <p className="text-center text-xs text-slate-500">
                      This story has no source PDF linked.
                    </p>
                  )}

                  {/* Content search results */}
                  {contentSearched && (
                    <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3 shadow-sm backdrop-blur-sm">
                      {contentImages.length === 0 ? (
                        <p className="text-center text-xs text-slate-500">
                          No images found in the PDF content.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-600">
                              {contentImageIndex + 1} of {contentImages.length} images
                            </span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleContentImageNav("prev")}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleContentImageNav("next")}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          {currentContentImage && (
                            <div className="flex items-center justify-between text-[10px] text-slate-500">
                              <span>
                                {currentContentImage.width} × {currentContentImage.height}px
                              </span>
                              <span>
                                Page {currentContentImage.pageNumber} · {currentContentImage.type}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
                    <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 shadow-sm">
                          <ImagePlus className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-900">{selectedFile.name}</p>
                          <p className="text-[10px] text-slate-500">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={clearUpload}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
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
                          ? "border-blue-400 bg-blue-50/50"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                      )}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                        <ImagePlus className="h-5 w-5 text-slate-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-medium text-slate-600">
                          {isDragging ? "Drop here" : "Click or drag"}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          JPEG, PNG, WebP, GIF · Max 5MB
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Image Source / Attribution */}
              <div className="pt-2">
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Image Source / Attribution
                </label>
                <Input
                  type="text"
                  placeholder="e.g., Photo by Juan on Unsplash"
                  value={imageSource}
                  onChange={(e) => setImageSource(e.target.value)}
                  className="h-10 rounded-xl border-slate-200/80 bg-white/80 text-sm shadow-sm backdrop-blur-sm placeholder:text-slate-400 focus:border-blue-300 focus:ring-blue-200"
                />
                <p className="mt-1.5 text-[10px] text-slate-400">
                  Will be displayed below the image in stories
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50/80 px-3 py-2 text-xs text-red-600">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-slate-100/80 px-5 py-4">
            <div>
              {story.curationStatus === "needs_curation" ? (
                <button
                  onClick={handleApprove}
                  disabled={isLoading}
                  className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-50"
                >
                  <span className="h-2 w-2 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500" />
                  Mark as approved
                </button>
              ) : (
                <button
                  onClick={handleMarkNeedsCuration}
                  disabled={isLoading}
                  className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-50 disabled:opacity-50"
                >
                  <span className="h-2 w-2 rounded-full bg-gradient-to-br from-amber-400 to-orange-500" />
                  Mark as pending
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={resetAndClose}
                disabled={isLoading}
                className="h-9 rounded-xl px-4 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isLoading}
                className="h-9 rounded-xl bg-slate-900 px-4 text-xs font-medium text-white shadow-lg shadow-slate-900/25 transition-all hover:bg-slate-800 hover:shadow-xl"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    Saving
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
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
