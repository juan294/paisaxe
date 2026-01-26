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
} from "@/lib/admin-api";
import {
  Link,
  Upload,
  ImagePlus,
  Maximize2,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";
import type { AdminStory, CurationStatus } from "@/types/admin";
import { cn } from "@/lib/utils";
import { isPlaceholderImage } from "@/lib/unsplash-placeholders";

interface ImageEditorDialogProps {
  story: AdminStory | null;
  adminKey: string;
  onClose: () => void;
  onUpdate: (storyId: string, updates: Partial<AdminStory>) => void;
}

type TabType = "url" | "upload";

export function ImageEditorDialog({
  story,
  adminKey,
  onClose,
  onUpdate,
}: ImageEditorDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>("url");
  const [imageUrl, setImageUrl] = useState("");
  const [imageSource, setImageSource] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        result = await updateStoryImageUrl(adminKey, story.id, imageUrl, imageSource || undefined);
      } else if (activeTab === "upload" && selectedFile) {
        result = await uploadStoryImage(adminKey, story.id, selectedFile, imageSource || undefined);
      } else {
        setError("Please provide an image URL or upload a file");
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
      const result = await updateStoryStatus(adminKey, story.id, "approved");

      if (result.error) {
        setError(result.error);
      } else {
        onUpdate(story.id, { curationStatus: "approved" as CurationStatus });
        resetAndClose();
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
      const result = await updateStoryStatus(adminKey, story.id, "needs_curation");

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
    setActiveTab("url");
    setIsDragging(false);
    onClose();
  };

  const clearUpload = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (!story) return null;

  const currentPreview = previewUrl || story.image;

  return (
    <>
      <Dialog open={!!story} onOpenChange={resetAndClose}>
        <DialogContent className="max-w-xl gap-0 overflow-hidden rounded-lg border-neutral-200 p-0 dark:border-neutral-800">
          {/* Header */}
          <DialogHeader className="border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <DialogTitle className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {story.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-neutral-500">
                  Update hero image
                </DialogDescription>
              </div>
              <CurationBadge status={story.curationStatus} />
            </div>
          </DialogHeader>

          <div className="p-5">
            {/* Placeholder info note */}
            {isPlaceholderImage(story) && (
              <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-800 dark:bg-blue-900/20">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  This is a <strong>placeholder image</strong> from Unsplash. Replace it with a real photo of this location.
                </p>
              </div>
            )}

            {/* Current/Preview Image */}
            <div className="relative mb-5 aspect-video overflow-hidden rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-800">
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
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded bg-black/60 text-white/90 transition-colors hover:bg-black/80"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1.5 text-neutral-400">
                  <ImagePlus className="h-6 w-6" />
                  <span className="text-xs">No image</span>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="mb-4 flex gap-1 rounded-md bg-neutral-100 p-1 dark:bg-neutral-800">
              <button
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
                  activeTab === "url"
                    ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-neutral-100"
                    : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
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
                  "flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
                  activeTab === "upload"
                    ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-neutral-100"
                    : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
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
                  className="h-9 border-neutral-200 text-sm placeholder:text-neutral-400 dark:border-neutral-800"
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
                    <div className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2.5 dark:border-neutral-800">
                      <div className="flex items-center gap-2.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        <div>
                          <p className="text-xs font-medium text-neutral-900 dark:text-neutral-100">{selectedFile.name}</p>
                          <p className="text-[10px] text-neutral-500">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={clearUpload}
                        className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
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
                        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed py-6 transition-colors",
                        isDragging
                          ? "border-neutral-400 bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800"
                          : "border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/50"
                      )}
                    >
                      <ImagePlus className="h-5 w-5 text-neutral-400" />
                      <div className="text-center">
                        <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                          {isDragging ? "Drop here" : "Click or drag"}
                        </p>
                        <p className="mt-0.5 text-[10px] text-neutral-400">
                          JPEG, PNG, WebP, GIF · Max 5MB
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Image Source / Attribution */}
              <div className="pt-2">
                <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Image Source / Attribution
                </label>
                <Input
                  type="text"
                  placeholder="e.g., Photo by Juan on Unsplash"
                  value={imageSource}
                  onChange={(e) => setImageSource(e.target.value)}
                  className="h-9 border-neutral-200 text-sm placeholder:text-neutral-400 dark:border-neutral-800"
                />
                <p className="mt-1 text-[10px] text-neutral-400">
                  Will be displayed below the image in stories
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3 dark:border-neutral-800">
            <div>
              {story.curationStatus === "needs_curation" ? (
                <button
                  onClick={handleApprove}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50 dark:text-emerald-500"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Mark as approved
                </button>
              ) : (
                <button
                  onClick={handleMarkNeedsCuration}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-700 disabled:opacity-50 dark:text-amber-500"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
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
                className="h-8 px-3 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isLoading}
                className="h-8 bg-neutral-900 px-3 text-xs hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
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
