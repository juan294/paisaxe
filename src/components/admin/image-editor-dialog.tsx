"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import type { AdminStory, CurationStatus } from "@/types/admin";

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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!story) return null;

  const handleUrlChange = (url: string) => {
    setImageUrl(url);
    setError("");
    if (url) {
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError("");

    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      setError("Invalid file type. Allowed: JPEG, PNG, WebP, GIF");
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("File too large. Maximum size is 5MB");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setIsLoading(true);
    setError("");

    try {
      let result;

      if (activeTab === "url" && imageUrl) {
        result = await updateStoryImageUrl(adminKey, story.id, imageUrl);
      } else if (activeTab === "upload" && selectedFile) {
        result = await uploadStoryImage(adminKey, story.id, selectedFile);
      } else {
        setError("Please provide an image URL or upload a file");
        setIsLoading(false);
        return;
      }

      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        onUpdate(story.id, { image: result.data.image });
        resetAndClose();
      }
    } catch {
      setError("Failed to update image");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
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
    setPreviewUrl(null);
    setSelectedFile(null);
    setError("");
    setActiveTab("url");
    onClose();
  };

  const currentPreview = previewUrl || story.image;

  return (
    <>
      <Dialog open={!!story} onOpenChange={resetAndClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {story.title}
              <CurationBadge status={story.curationStatus} />
            </DialogTitle>
            <DialogDescription>
              Update the hero image for this story
            </DialogDescription>
          </DialogHeader>

          {/* Current/Preview Image */}
          <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
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
                  className="absolute right-2 top-2 rounded bg-black/50 px-2 py-1 text-xs text-white hover:bg-black/70"
                >
                  Fullscreen
                </button>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No image
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b">
            <button
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === "url"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => {
                setActiveTab("url");
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            >
              Image URL
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === "upload"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => {
                setActiveTab("upload");
                setImageUrl("");
                setPreviewUrl(null);
              }}
            >
              Upload File
            </button>
          </div>

          {/* Tab Content */}
          <div className="space-y-4">
            {activeTab === "url" ? (
              <Input
                type="url"
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
              />
            ) : (
              <div className="space-y-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleFileChange}
                />
                <p className="text-xs text-muted-foreground">
                  Max 5MB. Formats: JPEG, PNG, WebP, GIF
                </p>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <div className="flex flex-1 gap-2">
              {story.curationStatus === "needs_curation" ? (
                <Button
                  variant="secondary"
                  onClick={handleApprove}
                  disabled={isLoading}
                >
                  Approve
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleMarkNeedsCuration}
                  disabled={isLoading}
                >
                  Mark Needs Curation
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetAndClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Image"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Preview */}
      {isFullscreen && currentPreview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
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
            className="absolute right-4 top-4 rounded bg-white/20 px-4 py-2 text-white hover:bg-white/30"
          >
            Close
          </button>
        </div>
      )}
    </>
  );
}
