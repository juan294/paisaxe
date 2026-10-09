import { z } from "zod";
import { TRANSLATION_LOCALES } from "./translation-locales";

export const sourceQuestionMetadataSchema = z.object({
  question_prompts: z.array(z.string().refine(value => value.trim().length > 0)).optional(),
}).passthrough();

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

/** Preserve metadata replacement semantics; only invalidate dependent questions. */
export function invalidateStoryPrompts(
  previous: Record<string, unknown> | null,
  next: Record<string, unknown>,
  updatedAt: string,
): Record<string, unknown> {
  const before = Array.isArray(previous?.question_prompts) ? previous.question_prompts : [];
  const after = Array.isArray(next.question_prompts) ? next.question_prompts : [];
  const changed = before.length !== after.length || before.some((prompt, index) => prompt !== after[index]);
  const translations = record(next.translations);
  const statuses = record(next.translation_status);
  const invalidTranslations = { ...translations };
  const invalidStatuses = { ...statuses };
  let invalidated = false;

  for (const locale of TRANSLATION_LOCALES) {
    const translation = record(translations?.[locale]);
    const status = record(statuses?.[locale]);
    const prompts = translation?.question_prompts;
    const ghost = after.length === 0 && prompts !== undefined &&
      (!Array.isArray(prompts) || prompts.length > 0);
    if ((!changed && !ghost) || (!translation && !status)) continue;

    if (translation) {
      const text = { ...translation };
      delete text.question_prompts;
      invalidTranslations[locale] = text;
    }
    invalidStatuses[locale] = {
      ...status,
      status: "pending",
      error: "Source questions changed; regenerate translation",
      updatedAt,
    };
    invalidated = true;
  }

  if (!invalidated) return next;
  return {
    ...next,
    ...(translations ? { translations: invalidTranslations } : {}),
    translation_status: invalidStatuses,
  };
}
