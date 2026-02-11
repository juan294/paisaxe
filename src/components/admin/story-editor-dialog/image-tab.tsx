"use client";

import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Link,
  Upload,
  Loader2,
  AlertCircle,
  FolderSearch,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Maximize2,
  X,
} from "lucide-react";
import type { AdminStory } from "./types";
import { cn } from "@/lib/utils";
import { isPlaceholderImage } from "@/lib/unsplash-placeholders";
import { useImageEditorContext } from "./image-editor-context";

interface ImageTabProps {
  story: AdminStory;
}

export function ImageTab({ story }: ImageTabProps) {
  const {
    imageSourceTab,
    setImageSourceTab,
    currentPreview,
    imageUrl,
    imageSource,
    setImageSource,
    selectedFile,
    isDragging,
    fileInputRef,
    contentImages,
    contentImageIndex,
    isSearchingContent,
    contentSearched,
    currentContentImage,
    setIsFullscreen,
    handleUrlChange,
    handleFileChange,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    clearUpload,
    handleSearchContent,
    handleContentImageNav,
  } = useImageEditorContext();

  return (
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
              aria-label="View image fullscreen"
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
            handleUrlChange("");
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
            handleUrlChange("");
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
                          aria-label="Previous image"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#a39e98] transition-colors hover:bg-[#f5f3ee] hover:text-[#6b6560] dark:hover:bg-[#3d3a36]"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleContentImageNav("next")}
                          aria-label="Next image"
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
                  aria-label="Remove uploaded file"
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
  );
}
