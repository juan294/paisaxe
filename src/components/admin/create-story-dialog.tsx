"use client";

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
import { Loader2, ChevronDown, ChevronUp, AtSign, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StoryCategory, StoryLocation, StoryDuration } from "@/types/immersive";

import { CATEGORIES, LOCATIONS, DURATIONS, type CreateStoryDialogProps } from "./create-story-dialog/model";
import { useCreateStoryForm } from "./create-story-dialog/use-create-story-form";

export function CreateStoryDialog({
  open,
  onOpenChange,
  onCreated,
  suggestion,
}: CreateStoryDialogProps) {
  const {
    title,
    setTitle,
    slug,
    category,
    setCategory,
    subtitle,
    setSubtitle,
    description,
    setDescription,
    location,
    setLocation,
    duration,
    setDuration,
    sourcePdf,
    setSourcePdf,
    showOptionalFields,
    setShowOptionalFields,
    isSubmitting,
    error,
    fieldErrors,
    handleSlugChange,
    handleSubmit,
  } = useCreateStoryForm({ open, onOpenChange, onCreated, suggestion });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-white dark:bg-admin-panel sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-admin-ink dark:text-admin-paper">
            {suggestion ? "Convert Suggestion to Story" : "Create New Story"}
          </DialogTitle>
          <DialogDescription className="text-admin-muted dark:text-admin-subtle">
            {suggestion
              ? "Create a new story from this user suggestion."
              : "Fill in the details to create a new story."}
          </DialogDescription>
        </DialogHeader>

        {/* Attribution notice when converting */}
        {suggestion?.attribution && (
          <div className="flex items-center gap-2 rounded-lg bg-admin-paper px-3 py-2 text-sm text-admin-muted dark:bg-admin-ink dark:text-admin-subtle">
            <AtSign className="h-4 w-4 flex-shrink-0" />
            <span>
              Credit: <strong>{suggestion.attribution}</strong>
            </span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          {/* Title (required) */}
          <div className="space-y-2">
            <Label
              htmlFor="title"
              className="text-sm font-medium text-admin-ink dark:text-admin-paper"
            >
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter story title"
              className={cn(
                "bg-admin-paper dark:bg-admin-ink",
                fieldErrors.title && "border-red-500"
              )}
            />
            {fieldErrors.title && (
              <p className="text-xs text-red-500">{fieldErrors.title}</p>
            )}
          </div>

          {/* Slug (auto-generated) */}
          <div className="space-y-2">
            <Label
              htmlFor="slug"
              className="text-sm font-medium text-admin-ink dark:text-admin-paper"
            >
              URL Slug
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-admin-subtle">/story/</span>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="auto-generated-from-title"
                className="flex-1 bg-admin-paper dark:bg-admin-ink"
              />
            </div>
          </div>

          {/* Category (required) */}
          <div className="space-y-2">
            <Label
              htmlFor="category"
              className="text-sm font-medium text-admin-ink dark:text-admin-paper"
            >
              Category <span className="text-red-500">*</span>
            </Label>
            <Select
              value={category}
              onValueChange={(value) => setCategory(value as StoryCategory)}
            >
              <SelectTrigger
                id="category"
                className={cn(
                  "bg-admin-paper dark:bg-admin-ink",
                  fieldErrors.category && "border-red-500"
                )}
              >
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
            {fieldErrors.category && (
              <p className="text-xs text-red-500">{fieldErrors.category}</p>
            )}
          </div>

          {/* Subtitle */}
          <div className="space-y-2">
            <Label
              htmlFor="subtitle"
              className="text-sm font-medium text-admin-ink dark:text-admin-paper"
            >
              Subtitle
            </Label>
            <Input
              id="subtitle"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Optional subtitle"
              className="bg-admin-paper dark:bg-admin-ink"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label
              htmlFor="description"
              className="text-sm font-medium text-admin-ink dark:text-admin-paper"
            >
              Description
            </Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              className="w-full rounded-md border border-input bg-admin-paper px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-admin-ink"
            />
          </div>

          {/* Optional Fields Toggle */}
          <button
            type="button"
            onClick={() => setShowOptionalFields(!showOptionalFields)}
            className="flex w-full items-center justify-between rounded-lg bg-admin-paper px-3 py-2 text-sm font-medium text-admin-muted transition-colors hover:bg-admin-line dark:bg-admin-ink dark:text-admin-subtle dark:hover:bg-admin-depth"
          >
            <span>Optional Fields</span>
            {showOptionalFields ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {/* Optional Fields Section */}
          {showOptionalFields && (
            <div className="space-y-4 rounded-lg bg-admin-paper/50 p-4 dark:bg-admin-ink/50">
              {/* Location */}
              <div className="space-y-2">
                <Label
                  htmlFor="location"
                  className="text-sm font-medium text-admin-ink dark:text-admin-paper"
                >
                  Location
                </Label>
                <Select
                  value={location}
                  onValueChange={(value) => setLocation(value as StoryLocation)}
                >
                  <SelectTrigger
                    id="location"
                    className="bg-white dark:bg-admin-panel"
                  >
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
                <Label
                  htmlFor="duration"
                  className="text-sm font-medium text-admin-ink dark:text-admin-paper"
                >
                  Duration
                </Label>
                <Select
                  value={duration}
                  onValueChange={(value) => setDuration(value as StoryDuration)}
                >
                  <SelectTrigger
                    id="duration"
                    className="bg-white dark:bg-admin-panel"
                  >
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
                <Label
                  htmlFor="sourcePdf"
                  className="text-sm font-medium text-admin-ink dark:text-admin-paper"
                >
                  Source PDF
                </Label>
                <Input
                  id="sourcePdf"
                  value={sourcePdf}
                  onChange={(e) => setSourcePdf(e.target.value)}
                  placeholder="guide.pdf"
                  className="bg-white dark:bg-admin-panel"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="border-admin-line dark:border-admin-depth"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-admin-ink text-admin-paper hover:bg-admin-depth dark:bg-admin-paper dark:text-admin-ink dark:hover:bg-admin-line"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Story"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
