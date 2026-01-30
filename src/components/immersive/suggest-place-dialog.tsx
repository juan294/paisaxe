"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle, AlertCircle, Lightbulb, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

interface SuggestPlaceDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type SubmitState = "idle" | "loading" | "success" | "error";

export function SuggestPlaceDialog({ isOpen, onClose }: SuggestPlaceDialogProps) {
  const { session } = useAuth();
  const { t } = useTranslation();

  const [placeName, setPlaceName] = useState("");
  const [comment, setComment] = useState("");
  const [location, setLocation] = useState<string>("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!session?.access_token) {
      setSubmitState("error");
      setErrorMessage(t("suggestions.error_not_signed_in"));
      return;
    }

    const trimmedPlaceName = placeName.trim();
    if (trimmedPlaceName.length < 3 || trimmedPlaceName.length > 100) {
      setSubmitState("error");
      setErrorMessage(t("suggestions.error_place_name_length"));
      return;
    }

    setSubmitState("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          placeName: trimmedPlaceName,
          comment: comment.trim() || undefined,
          location: location || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 429) {
          setSubmitState("error");
          setErrorMessage(t("suggestions.error_rate_limit"));
          return;
        }
        throw new Error(data.error || "Failed to submit suggestion");
      }

      setSubmitState("success");

      // Reset form after success
      setTimeout(() => {
        setPlaceName("");
        setComment("");
        setLocation("");
        setSubmitState("idle");
        onClose();
      }, 2000);
    } catch (error) {
      setSubmitState("error");
      setErrorMessage(
        error instanceof Error ? error.message : t("suggestions.error_generic")
      );
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Only close if not in loading state
      if (submitState !== "loading") {
        onClose();
        // Reset state when dialog closes
        setSubmitState("idle");
        setErrorMessage("");
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md bg-black/90 border-white/10 text-white backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Lightbulb className="h-5 w-5 text-amber-400" />
            {t("suggestions.dialog_title")}
          </DialogTitle>
          <DialogDescription className="text-white/60">
            {t("suggestions.dialog_description")}
          </DialogDescription>
        </DialogHeader>

        {submitState === "success" ? (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle className="h-12 w-12 text-emerald-400 mb-4" />
            <p className="text-white text-lg font-medium">
              {t("suggestions.success_title")}
            </p>
            <p className="text-white/60 text-sm mt-1">
              {t("suggestions.success_message")}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Place Name */}
            <div className="space-y-2">
              <Label htmlFor="place-name" className="text-white/80">
                {t("suggestions.place_name_label")} *
              </Label>
              <Input
                id="place-name"
                value={placeName}
                onChange={(e) => setPlaceName(e.target.value)}
                placeholder={t("suggestions.place_name_placeholder")}
                maxLength={100}
                required
                disabled={submitState === "loading"}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/40"
              />
              <p className="text-xs text-white/40">
                {placeName.length}/100 {t("suggestions.characters")}
              </p>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location" className="text-white/80 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {t("suggestions.location_label")}
              </Label>
              <Select
                value={location}
                onValueChange={setLocation}
                disabled={submitState === "loading"}
              >
                <SelectTrigger
                  id="location"
                  className="bg-white/10 border-white/20 text-white focus:border-white/40"
                >
                  <SelectValue placeholder={t("suggestions.location_placeholder")} />
                </SelectTrigger>
                <SelectContent className="bg-black/90 border-white/20 text-white">
                  <SelectItem value="eastern">{t("suggestions.location_eastern")}</SelectItem>
                  <SelectItem value="central">{t("suggestions.location_central")}</SelectItem>
                  <SelectItem value="western">{t("suggestions.location_western")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Comment */}
            <div className="space-y-2">
              <Label htmlFor="comment" className="text-white/80">
                {t("suggestions.comment_label")}
              </Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value)}
                placeholder={t("suggestions.comment_placeholder")}
                maxLength={500}
                rows={3}
                disabled={submitState === "loading"}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/40 resize-none"
              />
              <p className="text-xs text-white/40">
                {comment.length}/500 {t("suggestions.characters")}
              </p>
            </div>

            {/* Error Message */}
            {submitState === "error" && errorMessage && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-300">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {errorMessage}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={submitState === "loading"}
                className="text-white/60 hover:text-white hover:bg-white/10"
              >
                {t("suggestions.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={submitState === "loading" || placeName.trim().length < 3}
                className={cn(
                  "bg-white text-black hover:bg-white/90",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {submitState === "loading" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("suggestions.submitting")}
                  </>
                ) : (
                  t("suggestions.submit")
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
