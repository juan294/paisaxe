"use client";

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
import { PhotoReviewForm } from "./photo-review-form";
import { CurationBadge } from "./curation-badge";
import {
  Link,
  Upload,
  ImagePlus,
  Maximize2,
  X,
  Loader2,
  AlertCircle,
  FolderSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isPlaceholderImage } from "@/lib/unsplash-placeholders";
import { useImageEditorDialog, type ImageEditorDialogProps } from "./image-editor-dialog/use-image-editor-dialog";

export function ImageEditorDialog({
  story,
  onClose,
  onUpdate,
}: ImageEditorDialogProps) {
  const {
    isLoading,
    error,
    img,
    handleSave,
    handleApprove,
    handleMarkNeedsCuration,
    resetAndClose,
  } = useImageEditorDialog({ story, onClose, onUpdate });

  if (!story) return null;

  return (
    <>
      <Dialog open={!!story} onOpenChange={resetAndClose}>
        <DialogContent hideCloseButton className="max-h-[90vh] max-w-xl gap-0 overflow-y-auto rounded-2xl border-admin-line bg-white p-0 shadow-xl dark:border-admin-depth dark:bg-admin-panel">
          {/* Header */}
          <DialogHeader className="border-b border-admin-line px-5 py-4 dark:border-admin-depth">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <DialogTitle className="text-sm font-semibold text-admin-ink">
                  {story.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-admin-muted">
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
            <div className="relative mb-5 aspect-video overflow-hidden rounded-xl bg-admin-paper shadow-sm">
              {img.currentPreview ? (
                <>
                  <Image
                    src={img.currentPreview}
                    alt={story.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 600px"
                  />
                  <button
                    onClick={() => img.setIsFullscreen(true)}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-black/40 text-white/90 backdrop-blur-sm transition-all hover:bg-black/60"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                  {/* Resolution info badge for content images */}
                  {img.imageSourceTab === "content" && img.currentContentImage && (
                    <div className="absolute bottom-2 left-2 rounded-md bg-black/50 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
                      {img.currentContentImage.width} × {img.currentContentImage.height}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-admin-subtle">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm">
                    <ImagePlus className="h-6 w-6" />
                  </div>
                  <span className="text-xs">No image</span>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="mb-4 flex gap-1 rounded-xl bg-admin-paper/80 p-1 backdrop-blur-sm">
              <button
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                  img.imageSourceTab === "content"
                    ? "bg-white text-admin-ink shadow-sm"
                    : "text-admin-muted hover:text-admin-ink"
                )}
                onClick={() => {
                  img.setImageSourceTab("content");
                  img.clearUpload();
                  img.handleUrlChange("");
                  img.setImageSource(story.imageSource || "");
                }}
              >
                <FolderSearch className="h-3.5 w-3.5" />
                Actual
              </button>
              <button
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                  img.imageSourceTab === "url"
                    ? "bg-white text-admin-ink shadow-sm"
                    : "text-admin-muted hover:text-admin-ink"
                )}
                onClick={() => {
                  img.setImageSourceTab("url");
                  img.clearUpload();
                }}
              >
                <Link className="h-3.5 w-3.5" />
                URL
              </button>
              <button
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                  img.imageSourceTab === "upload"
                    ? "bg-white text-admin-ink shadow-sm"
                    : "text-admin-muted hover:text-admin-ink"
                )}
                onClick={() => {
                  img.setImageSourceTab("upload");
                  img.handleUrlChange("");
                }}
              >
                <Upload className="h-3.5 w-3.5" />
                Upload
              </button>
            </div>

            {/* Tab Content */}
            <div className="space-y-3">
              {img.imageSourceTab === "url" ? (
                <Input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={img.imageUrl}
                  onChange={(e) => img.handleUrlChange(e.target.value)}
                  className="h-11 rounded-xl border-none bg-admin-paper text-sm text-admin-ink placeholder:text-admin-subtle focus-visible:ring-1 focus-visible:ring-admin-warning dark:bg-admin-ink dark:text-admin-paper"
                />
              ) : img.imageSourceTab === "content" ? (
                <p className="text-xs text-admin-muted">Revisa abajo la foto subida actualmente. Las fotos extraídas de guías no están disponibles sin una revisión individual de permisos.</p>
              ) : (
                <div>
                  <input
                    ref={img.fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                    onChange={img.handleFileChange}
                    className="hidden"
                  />

                  {img.selectedFile ? (
                    <div className="flex items-center justify-between rounded-xl border border-admin-line/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 shadow-sm">
                          <ImagePlus className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-admin-ink">{img.selectedFile.name}</p>
                          <p className="text-[10px] text-admin-muted">
                            {(img.selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={img.clearUpload}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-admin-subtle transition-colors hover:bg-admin-paper hover:text-admin-muted"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => img.fileInputRef.current?.click()}
                      onDragOver={img.handleDragOver}
                      onDragEnter={img.handleDragEnter}
                      onDragLeave={img.handleDragLeave}
                      onDrop={img.handleDrop}
                      className={cn(
                        "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-8 transition-all",
                        img.isDragging
                          ? "border-blue-400 bg-blue-50/50"
                          : "border-admin-line hover:border-admin-subtle hover:bg-admin-paper/50"
                      )}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-admin-paper">
                        <ImagePlus className="h-5 w-5 text-admin-subtle" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-medium text-admin-muted">
                          {img.isDragging ? "Drop here" : "Click or drag"}
                        </p>
                        <p className="mt-0.5 text-[10px] text-admin-subtle">
                          JPEG, PNG, WebP, GIF, AVIF · Max 10MB
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <PhotoReviewForm title={story.title} description={story.description} storyId={story.id} asset={img.imageSourceTab === "upload" ? img.selectedFile : img.imageSourceTab === "url" ? img.imageUrl || null : story.image || null} source={img.imageSource} onChange={img.setImageSource} />

              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50/80 px-3 py-2 text-xs text-red-600">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-admin-line px-5 py-4 dark:border-admin-depth">
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
                className="h-9 rounded-xl px-4 text-xs text-admin-muted hover:bg-admin-paper hover:text-admin-ink dark:text-admin-subtle dark:hover:bg-admin-ink dark:hover:text-admin-paper"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isLoading}
                className="h-9 rounded-xl bg-admin-ink px-4 text-xs font-medium text-admin-paper shadow-lg transition-all hover:bg-admin-depth dark:bg-admin-paper dark:text-admin-ink dark:hover:bg-admin-line"
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
      {img.isFullscreen && img.currentPreview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95"
          onClick={() => img.setIsFullscreen(false)}
        >
          <Image
            src={img.currentPreview}
            alt={story.title}
            fill
            className="object-contain"
            sizes="100vw"
          />
          <button
            onClick={() => img.setIsFullscreen(false)}
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
