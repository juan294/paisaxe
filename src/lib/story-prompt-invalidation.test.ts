import { describe, expect, it } from "vitest";
import { invalidateStoryPrompts } from "./story-prompt-invalidation";

const now = "2026-10-09T12:00:00Z";
const text = { title: "Manual title", subtitle: "", description: "Manual description" };

describe("source question dependency invalidation", () => {
  it("invalidates reordered questions even when count and text set are unchanged, without mutating input", () => {
    const previous = { question_prompts: ["One?", "Two?"] };
    const next = {
      question_prompts: ["Two?", "One?"],
      translations: { en: { ...text, question_prompts: ["Uno?", "Dos?"] } },
      translation_status: { en: { status: "complete", updatedAt: "old" } },
      custom: { retained: true },
    };
    const original = structuredClone(next);
    const result = invalidateStoryPrompts(previous, next, now);
    expect(result.translations).toEqual({ en: text });
    expect(result.translation_status).toEqual({ en: {
      status: "pending", updatedAt: now, error: "Source questions changed; regenerate translation",
    } });
    expect(result.custom).toBe(next.custom);
    expect(next).toEqual(original);
  });

  it("removes existing ghost questions even if both old and new source arrays are empty", () => {
    const next = { translations: { fr: { ...text, question_prompts: ["Ghost?"] } } };
    const result = invalidateStoryPrompts({ question_prompts: [] }, next, now);
    expect(result.translations).toEqual({ fr: text });
    expect(result.translation_status).toMatchObject({ fr: { status: "pending" } });
  });

  it("preserves valid empty-source translations and status without inventing invalidation", () => {
    const next = {
      question_prompts: [], translations: { en: { ...text, question_prompts: [] }, fr: text },
      translation_status: { en: { status: "complete" }, fr: { status: "complete" } },
    };
    expect(invalidateStoryPrompts(null, next, now)).toBe(next);
  });

  it("marks status-only entries pending without resurrecting deleted translations or touching unrelated locale metadata", () => {
    const next = {
      question_prompts: ["New?"],
      translation_status: { de: { status: "complete", operator_note: "keep" }, custom: { status: "unrelated" } },
    };
    const result = invalidateStoryPrompts({ question_prompts: ["Old?"] }, next, now);
    expect(result.translations).toBeUndefined();
    expect(result.translation_status).toMatchObject({ de: { status: "pending", operator_note: "keep" }, custom: { status: "unrelated" } });
  });

  it("retains newly supplied manual text when source questions change", () => {
    const next = { question_prompts: ["New?"], translations: { pt: { ...text, title: "New manual title", question_prompts: ["Stale?"] } } };
    expect(invalidateStoryPrompts({ question_prompts: ["Old?"] }, next, now).translations)
      .toEqual({ pt: { ...text, title: "New manual title" } });
  });
});
