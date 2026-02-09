"use client";

import { useCallback } from "react";
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
import {
  Loader2,
  AlertCircle,
  FileText,
  Image as ImageIcon,
  X,
  Languages,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StoryTranslationsTab } from "../story-translations-tab";
import { DetailsTab } from "./details-tab";
import { ImageTab } from "./image-tab";
import { useStoryEditorState } from "./use-story-editor-state";
import { handleSave, handleApprove, handleMarkNeedsCuration } from "./use-story-editor-save";
import type { StoryEditorDialogProps } from "./types";

export function StoryEditorDialog({
  story,
  onClose,
  onUpdate,
}: StoryEditorDialogProps) {
  const state = useStoryEditorState(story);

  // Callback when translations are auto-generated - update parent's story data
  const handleMetadataUpdated = useCallback((metadata: Record<string, unknown>) => {
    if (story) {
      onUpdate(story.id, { metadata });
    }
  }, [story, onUpdate]);

  const doResetAndClose = useCallback(() => {
    state.resetAndClose(onClose);
  }, [state, onClose]);

  const onSave = async () => {
    if (!story) return;
    await handleSave({
      story,
      hasDetailsChanges: state.hasDetailsChanges,
      hasImageChanges: state.hasImageChanges,
      hasTranslationChanges: state.hasTranslationChanges,
      pendingTranslations: state.pendingTranslations,
      title: state.title,
      slug: state.slug,
      subtitle: state.subtitle,
      description: state.description,
      category: state.category,
      location: state.location,
      duration: state.duration,
      sourcePdf: state.sourcePdf,
      questionPrompts: state.questionPrompts,
      imageSourceTab: state.imageSourceTab,
      imageUrl: state.imageUrl,
      imageSource: state.imageSource,
      selectedFile: state.selectedFile,
      currentContentImage: state.currentContentImage,
      onUpdate,
      setIsLoading: state.setIsLoading,
      setError: state.setError,
      resetAndClose: doResetAndClose,
    });
  };

  const onApprove = async () => {
    if (!story) return;
    await handleApprove(story, onUpdate, state.setIsLoading, state.setError);
  };

  const onMarkNeedsCuration = async () => {
    if (!story) return;
    await handleMarkNeedsCuration(story, onUpdate, state.setIsLoading, state.setError);
  };

  if (!story) return null;

  return (
    <>
      <Dialog open={!!story} onOpenChange={doResetAndClose}>
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
          {state.error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          {/* Main Tabs */}
          <div className="flex gap-1 rounded-xl bg-[#f5f3ee] p-1 dark:bg-[#2d2a26]">
            <button
              onClick={() => state.setActiveTab("details")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
                state.activeTab === "details"
                  ? "bg-white text-[#2d2a26] shadow-sm dark:bg-[#3d3a36] dark:text-[#f5f3ee]"
                  : "text-[#6b6560] hover:text-[#2d2a26] dark:text-[#a39e98] dark:hover:text-[#f5f3ee]"
              )}
            >
              <FileText className="h-4 w-4" />
              Details
            </button>
            <button
              onClick={() => state.setActiveTab("image")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
                state.activeTab === "image"
                  ? "bg-white text-[#2d2a26] shadow-sm dark:bg-[#3d3a36] dark:text-[#f5f3ee]"
                  : "text-[#6b6560] hover:text-[#2d2a26] dark:text-[#a39e98] dark:hover:text-[#f5f3ee]"
              )}
            >
              <ImageIcon className="h-4 w-4" />
              Image
            </button>
            <button
              onClick={() => state.setActiveTab("translations")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
                state.activeTab === "translations"
                  ? "bg-white text-[#2d2a26] shadow-sm dark:bg-[#3d3a36] dark:text-[#f5f3ee]"
                  : "text-[#6b6560] hover:text-[#2d2a26] dark:text-[#a39e98] dark:hover:text-[#f5f3ee]"
              )}
            >
              <Languages className="h-4 w-4" />
              Translations
              {state.hasTranslationChanges && (
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              )}
            </button>
          </div>

          {/* Tab Content */}
          <div className="space-y-4">
            {state.activeTab === "translations" ? (
              <StoryTranslationsTab
                story={story}
                onTranslationChange={state.handleTranslationChange}
                onMetadataUpdated={handleMetadataUpdated}
              />
            ) : state.activeTab === "details" ? (
              <DetailsTab
                title={state.title}
                slug={state.slug}
                subtitle={state.subtitle}
                description={state.description}
                category={state.category}
                location={state.location}
                duration={state.duration}
                sourcePdf={state.sourcePdf}
                questionPrompts={state.questionPrompts}
                showOptionalFields={state.showOptionalFields}
                onTitleChange={state.handleTitleChange}
                onSlugChange={state.handleSlugChange}
                onSubtitleChange={state.setSubtitle}
                onDescriptionChange={state.setDescription}
                onCategoryChange={state.setCategory}
                onLocationChange={state.setLocation}
                onDurationChange={state.setDuration}
                onSourcePdfChange={state.setSourcePdf}
                onQuestionPromptsChange={state.setQuestionPrompts}
                onToggleOptionalFields={() => state.setShowOptionalFields(!state.showOptionalFields)}
              />
            ) : (
              <ImageTab
                story={story}
                imageSourceTab={state.imageSourceTab}
                currentPreview={state.currentPreview}
                imageUrl={state.imageUrl}
                imageSource={state.imageSource}
                selectedFile={state.selectedFile}
                isDragging={state.isDragging}
                fileInputRef={state.fileInputRef}
                contentImages={state.contentImages}
                contentImageIndex={state.contentImageIndex}
                isSearchingContent={state.isSearchingContent}
                contentSearched={state.contentSearched}
                currentContentImage={state.currentContentImage}
                onImageSourceTabChange={state.setImageSourceTab}
                onUrlChange={state.handleUrlChange}
                onImageSourceChange={state.setImageSource}
                onFileChange={state.handleFileChange}
                onDragOver={state.handleDragOver}
                onDragEnter={state.handleDragEnter}
                onDragLeave={state.handleDragLeave}
                onDrop={state.handleDrop}
                onClearUpload={state.clearUpload}
                onSearchContent={state.handleSearchContent}
                onContentImageNav={state.handleContentImageNav}
                onFullscreen={() => state.setIsFullscreen(true)}
              />
            )}
          </div>

          <DialogFooter className="flex-col gap-3 sm:flex-row sm:justify-between">
            {/* Curation Status Toggle */}
            <div>
              {story.curationStatus === "needs_curation" ? (
                <button
                  onClick={onApprove}
                  disabled={state.isLoading}
                  className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Mark as approved
                </button>
              ) : (
                <button
                  onClick={onMarkNeedsCuration}
                  disabled={state.isLoading}
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
                onClick={doResetAndClose}
                disabled={state.isLoading}
                className="border-[#e5e3de] dark:border-[#3d3a36]"
              >
                Cancel
              </Button>
              <Button
                onClick={onSave}
                disabled={state.isLoading || !state.hasChanges}
                className="bg-[#2d2a26] text-[#f5f3ee] hover:bg-[#3d3a36] dark:bg-[#f5f3ee] dark:text-[#2d2a26] dark:hover:bg-[#e5e3de]"
              >
                {state.isLoading ? (
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
      {state.isFullscreen && state.currentPreview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95"
          onClick={() => state.setIsFullscreen(false)}
        >
          <Image
            src={state.currentPreview}
            alt={story.title}
            fill
            className="object-contain"
            sizes="100vw"
          />
          <button
            onClick={() => state.setIsFullscreen(false)}
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
