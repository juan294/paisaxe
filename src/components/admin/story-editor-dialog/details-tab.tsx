"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown,
  ChevronUp,
  MessageCircleQuestion,
  Plus,
  Trash2,
} from "lucide-react";
import type { StoryCategory, StoryLocation, StoryDuration } from "@/types/immersive";
import { CATEGORIES, LOCATIONS, DURATIONS } from "./types";

interface DetailsTabProps {
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  category: StoryCategory | "";
  location: StoryLocation | "";
  duration: StoryDuration | "";
  sourcePdf: string;
  questionPrompts: string[];
  showOptionalFields: boolean;
  onTitleChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onSubtitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCategoryChange: (value: StoryCategory) => void;
  onLocationChange: (value: StoryLocation) => void;
  onDurationChange: (value: StoryDuration) => void;
  onSourcePdfChange: (value: string) => void;
  onQuestionPromptsChange: (prompts: string[]) => void;
  onToggleOptionalFields: () => void;
}

export function DetailsTab({
  title,
  slug,
  subtitle,
  description,
  category,
  location,
  duration,
  sourcePdf,
  questionPrompts,
  showOptionalFields,
  onTitleChange,
  onSlugChange,
  onSubtitleChange,
  onDescriptionChange,
  onCategoryChange,
  onLocationChange,
  onDurationChange,
  onSourcePdfChange,
  onQuestionPromptsChange,
  onToggleOptionalFields,
}: DetailsTabProps) {
  return (
    <>
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title" className="text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
          Title
        </Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="bg-[#f5f3ee] dark:bg-[#2d2a26]"
        />
      </div>

      {/* Slug */}
      <div className="space-y-2">
        <Label htmlFor="slug" className="text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
          URL Slug
        </Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#a39e98]">/story/</span>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => onSlugChange(e.target.value)}
            className="flex-1 bg-[#f5f3ee] dark:bg-[#2d2a26]"
          />
        </div>
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label htmlFor="category" className="text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
          Category
        </Label>
        <Select value={category} onValueChange={(v) => onCategoryChange(v as StoryCategory)}>
          <SelectTrigger id="category" className="bg-[#f5f3ee] dark:bg-[#2d2a26]">
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
      </div>

      {/* Subtitle */}
      <div className="space-y-2">
        <Label htmlFor="subtitle" className="text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
          Subtitle
        </Label>
        <Input
          id="subtitle"
          value={subtitle}
          onChange={(e) => onSubtitleChange(e.target.value)}
          placeholder="Optional subtitle"
          className="bg-[#f5f3ee] dark:bg-[#2d2a26]"
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description" className="text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
          Description
        </Label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Optional description"
          rows={3}
          className="w-full rounded-md border border-input bg-[#f5f3ee] px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:bg-[#2d2a26]"
        />
      </div>

      {/* Optional Fields Toggle */}
      <button
        type="button"
        onClick={onToggleOptionalFields}
        className="flex w-full items-center justify-between rounded-lg bg-[#f5f3ee] px-3 py-2 text-sm font-medium text-[#6b6560] transition-colors hover:bg-[#e5e3de] dark:bg-[#2d2a26] dark:text-[#a39e98] dark:hover:bg-[#3d3a36]"
      >
        <span>Optional Fields</span>
        {showOptionalFields ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {showOptionalFields && (
        <div className="space-y-4 rounded-lg bg-[#f5f3ee]/50 p-4 dark:bg-[#2d2a26]/50">
          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location" className="text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
              Location
            </Label>
            <Select value={location} onValueChange={(v) => onLocationChange(v as StoryLocation)}>
              <SelectTrigger id="location" className="bg-white dark:bg-[#252320]">
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
            <Label htmlFor="duration" className="text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
              Duration
            </Label>
            <Select value={duration} onValueChange={(v) => onDurationChange(v as StoryDuration)}>
              <SelectTrigger id="duration" className="bg-white dark:bg-[#252320]">
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
            <Label htmlFor="sourcePdf" className="text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
              Source PDF
            </Label>
            <Input
              id="sourcePdf"
              value={sourcePdf}
              onChange={(e) => onSourcePdfChange(e.target.value)}
              placeholder="guide.pdf"
              className="bg-white dark:bg-[#252320]"
            />
          </div>

          {/* Question Prompts */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
                <MessageCircleQuestion className="h-4 w-4" />
                Question Prompts
              </Label>
              <button
                type="button"
                onClick={() => onQuestionPromptsChange([...questionPrompts, ""])}
                disabled={questionPrompts.length >= 5}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#6b6560] transition-colors hover:bg-[#e5e3de] disabled:opacity-50 dark:text-[#a39e98] dark:hover:bg-[#3d3a36]"
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
            </div>
            <p className="text-[10px] text-[#a39e98]">
              Clickable suggestions shown below stories (requires feature flag)
            </p>
            {questionPrompts.length === 0 ? (
              <div className="flex items-center justify-center rounded-lg border border-dashed border-[#e5e3de] py-4 dark:border-[#3d3a36]">
                <p className="text-xs text-[#a39e98]">No prompts added</p>
              </div>
            ) : (
              <div className="space-y-2">
                {questionPrompts.map((prompt, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={prompt}
                      onChange={(e) => {
                        const updated = [...questionPrompts];
                        updated[index] = e.target.value;
                        onQuestionPromptsChange(updated);
                      }}
                      placeholder={`e.g., ¿Cuándo se construyó?`}
                      className="flex-1 bg-white text-sm dark:bg-[#252320]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const updated = questionPrompts.filter((_, i) => i !== index);
                        onQuestionPromptsChange(updated);
                      }}
                      aria-label="Remove question prompt"
                      className="flex h-9 w-9 items-center justify-center rounded-md text-[#a39e98] transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
