"use client";

import { useState, useEffect, useCallback } from "react";
import { createStory } from "@/lib/admin-api";
import type { StoryCategory, StoryLocation, StoryDuration } from "@/types/immersive";
import type { CreateStoryRequest } from "@/types/admin";
import { generateSlug, type CreateStoryDialogProps } from "./model";

export function useCreateStoryForm({ open, onOpenChange, onCreated, suggestion }: CreateStoryDialogProps) {
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

  return {
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
  };
}
