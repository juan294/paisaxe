"use client";

import { useState, useCallback } from "react";
import { updateStoryImageUrl, uploadStoryImage, updateStoryStatus, updateStoryImageSource } from "@/lib/admin-api";
import type { AdminStory, CurationStatus } from "@/types/admin";
import { isPlaceholderImage } from "@/lib/unsplash-placeholders";
import { useImageEditor } from "../story-editor-dialog/use-image-editor";

export interface ImageEditorDialogProps {
  story: AdminStory | null;
  onClose: () => void;
  onUpdate: (storyId: string, updates: Partial<AdminStory>) => void;
}

export function useImageEditorDialog({ story, onClose, onUpdate }: ImageEditorDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const setErrorStable = useCallback((e: string) => setError(e), []);
  const img = useImageEditor(story, setErrorStable);

  const handleSave = async () => {
    if (!story) return;
    setIsLoading(true);
    setError("");

    try {
      let result;

      if (img.imageSourceTab === "url" && img.imageUrl) {
        result = await updateStoryImageUrl(story.id, img.imageUrl, img.imageSource || undefined);
      } else if (img.imageSourceTab === "upload" && img.selectedFile) {
        result = await uploadStoryImage(story.id, img.selectedFile, img.imageSource || undefined);
      } else if (img.imageSourceTab === "content" && img.currentContentImage) {
        result = await updateStoryImageUrl(story.id, img.currentContentImage.url, img.imageSource || undefined);
      } else {
        const hasRealImage = story.image && !isPlaceholderImage(story);
        const sourceChanged = img.imageSource !== (story.imageSource || "");

        if (hasRealImage) {
          if (sourceChanged && img.imageSource) {
            const sourceResult = await updateStoryImageSource(story.id, img.imageSource);
            if (sourceResult.error) {
              setError(sourceResult.error);
            } else if (sourceResult.data) {
              onUpdate(story.id, { imageSource: sourceResult.data.imageSource });
              resetAndClose();
            }
            setIsLoading(false);
            return;
          } else {
            resetAndClose();
            return;
          }
        }

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
    setError("");
    img.resetImageState();
    onClose();
  };

  return { isLoading, error, img, handleSave, handleApprove, handleMarkNeedsCuration, resetAndClose };
}
