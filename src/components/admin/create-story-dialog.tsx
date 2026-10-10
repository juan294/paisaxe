"use client";

import { useState, useEffect, useCallback } from "react";
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
import { createStory } from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import type { StoryCategory, StoryLocation, StoryDuration } from "@/types/immersive";
import type { CreateStoryRequest, CreateStoryResponse } from "@/types/admin";
import type { AdminStorySuggestion } from "@/types/suggestions";

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
 * Handles Spanish diacritics and special characters.
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

interface CreateStoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (story: CreateStoryResponse) => void;
  /** Optional suggestion to pre-fill form data from */
  suggestion?: AdminStorySuggestion | null;
}

export function CreateStoryDialog({
  open,
  onOpenChange,
  onCreated,
  suggestion,
}: CreateStoryDialogProps) {
  // Form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [category, setCategory] = useState<StoryCategory | "">("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState<StoryLocation | "">("");
  const [duration, setDuration] = useState<StoryDuration | "">("");
  const [sourcePdf, setSourcePdf] = useState("");

  // UI state
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Reset form when dialog opens/closes or suggestion changes
  const resetForm = useCallback(() => {
    if (suggestion) {
      // Pre-fill from suggestion
      setTitle(suggestion.placeName);
      setSlug(generateSlug(suggestion.placeName));
      setSlugManuallyEdited(false);
      setCategory("");
      setSubtitle("");
      setDescription(suggestion.comment || "");
      setLocation(suggestion.location || "");
      setDuration("");
      setSourcePdf("");
      setShowOptionalFields(!!suggestion.location);
    } else {
      // Clean slate
      setTitle("");
      setSlug("");
      setSlugManuallyEdited(false);
      setCategory("");
      setSubtitle("");
      setDescription("");
      setLocation("");
      setDuration("");
      setSourcePdf("");
      setShowOptionalFields(false);
    }
    setError("");
    setFieldErrors({});
  }, [suggestion]);

  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open, resetForm]);

  // Auto-generate slug from title if not manually edited
  useEffect(() => {
    if (!slugManuallyEdited && title) {
      setSlug(generateSlug(title));
    }
  }, [title, slugManuallyEdited]);

  const handleSlugChange = (value: string) => {
    setSlugManuallyEdited(true);
    setSlug(value);
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!title.trim()) {
      errors.title = "Title is required";
    }

    if (!category) {
      errors.category = "Category is required";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setError("");

    const data: CreateStoryRequest = {
      title: title.trim(),
      slug: slug || generateSlug(title),
      category: category as StoryCategory,
      subtitle: subtitle.trim() || undefined,
      description: description.trim() || undefined,
      location: location || undefined,
      duration: duration || undefined,
      sourcePdf: sourcePdf.trim() || undefined,
    };

    // If creating from a suggestion, add source tracking
    if (suggestion) {
      data.sourceType = "user_submitted";
      data.suggestionId = suggestion.id;
    }

    const result = await createStory(data);

    if (result.error) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }

    if (result.data) {
      onCreated(result.data);
      onOpenChange(false);
    }

    setIsSubmitting(false);
  };

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
