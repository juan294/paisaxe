import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuestionPrompts, getLocalizedQuestionPrompts } from "./question-prompts";
import { createMockT } from "@/test/i18n-mock";
import type { Story } from "@/types/immersive";

// Use a sentinel value for the aria-label key to prove the component calls t()
// instead of using a hardcoded Spanish string
const SENTINEL = "__I18N_SUGGESTED_QUESTIONS__";
const mockT = (key: string) => {
  if (key === "accessibility.suggested_questions") return SENTINEL;
  return createMockT()(key);
};

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    locale: "es",
    setLocale: vi.fn(),
    t: (key: string) => mockT(key),
  }),
}));

describe("QuestionPrompts", () => {
  const mockOnSelectPrompt = vi.fn();
  const defaultPrompts = ["What is this place?", "Tell me more", "How do I get there?"];

  beforeEach(() => {
    mockOnSelectPrompt.mockClear();
  });

  it("renders null when prompts array is empty", () => {
    const { container } = render(
      <QuestionPrompts prompts={[]} storyId="test-1" onSelectPrompt={mockOnSelectPrompt} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders null when prompts is undefined", () => {
    const { container } = render(
      <QuestionPrompts prompts={undefined as unknown as string[]} storyId="test-1" onSelectPrompt={mockOnSelectPrompt} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders up to 3 prompts", () => {
    render(
      <QuestionPrompts prompts={defaultPrompts} storyId="test-1" onSelectPrompt={mockOnSelectPrompt} />
    );
    expect(screen.getByText("What is this place?")).toBeInTheDocument();
    expect(screen.getByText("Tell me more")).toBeInTheDocument();
    expect(screen.getByText("How do I get there?")).toBeInTheDocument();
  });

  it("limits prompts to 3 even when more are provided", () => {
    const manyPrompts = ["One", "Two", "Three", "Four", "Five"];
    render(
      <QuestionPrompts prompts={manyPrompts} storyId="test-1" onSelectPrompt={mockOnSelectPrompt} />
    );
    expect(screen.getByText("One")).toBeInTheDocument();
    expect(screen.getByText("Two")).toBeInTheDocument();
    expect(screen.getByText("Three")).toBeInTheDocument();
    expect(screen.queryByText("Four")).not.toBeInTheDocument();
    expect(screen.queryByText("Five")).not.toBeInTheDocument();
  });

  it("calls onSelectPrompt when a prompt is clicked", () => {
    render(
      <QuestionPrompts prompts={defaultPrompts} storyId="test-1" onSelectPrompt={mockOnSelectPrompt} />
    );
    fireEvent.click(screen.getByText("Tell me more"));
    expect(mockOnSelectPrompt).toHaveBeenCalledWith("Tell me more");
  });

  it("stops event propagation when clicking a prompt", () => {
    const parentHandler = vi.fn();
    render(
      <div onClick={parentHandler}>
        <QuestionPrompts prompts={defaultPrompts} storyId="test-1" onSelectPrompt={mockOnSelectPrompt} />
      </div>
    );
    fireEvent.click(screen.getByText("Tell me more"));
    expect(parentHandler).not.toHaveBeenCalled();
    expect(mockOnSelectPrompt).toHaveBeenCalled();
  });

  it("renders prompts as buttons with correct styling", () => {
    render(
      <QuestionPrompts prompts={defaultPrompts} storyId="test-1" onSelectPrompt={mockOnSelectPrompt} />
    );
    const button = screen.getByText("What is this place?");
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveClass("rounded-full");
    expect(button).toHaveClass("px-3");
    expect(button).toHaveClass("py-1.5");
  });

  it("renders a single prompt correctly", () => {
    render(
      <QuestionPrompts prompts={["Single prompt"]} storyId="test-1" onSelectPrompt={mockOnSelectPrompt} />
    );
    expect(screen.getByText("Single prompt")).toBeInTheDocument();
  });

  it("uses translated aria-label from t('accessibility.suggested_questions')", () => {
    render(
      <QuestionPrompts prompts={defaultPrompts} storyId="test-1" onSelectPrompt={mockOnSelectPrompt} />
    );
    const group = screen.getByRole("group");
    // If the component uses t(), the aria-label will be the sentinel value
    // If it uses a hardcoded string, it will be "Preguntas sugeridas" and this fails
    expect(group).toHaveAttribute("aria-label", SENTINEL);
  });
});

// UX-H6 (#892): question_prompts had no translated form at all — chips always
// rendered raw Spanish to every locale. getLocalizedQuestionPrompts resolves
// the translated prompts for the active locale, falling back gracefully to
// the Spanish prompts (never empty/undefined) when no translation exists.
describe("getLocalizedQuestionPrompts", () => {
  const baseStory: Story = {
    id: "story-1",
    title: "Título en Español",
    subtitle: "Subtítulo",
    description: "Descripción",
    image: "/test.jpg",
    category: "nature",
    sourcePdf: "test.pdf",
    metadata: {
      question_prompts: ["¿Qué ver?", "¿Cómo llegar?"],
      translations: {
        fr: {
          title: "Titre en Français",
          subtitle: "Sous-titre",
          description: "Description",
          question_prompts: ["Que voir ?", "Comment y arriver ?"],
        },
        de: {
          // No question_prompts on this translation — should fall back to Spanish
          title: "Deutscher Titel",
          subtitle: "Untertitel",
          description: "Beschreibung",
        },
      },
    },
  };

  it("returns the Spanish prompts when locale is es", () => {
    expect(getLocalizedQuestionPrompts(baseStory, "es")).toEqual([
      "¿Qué ver?",
      "¿Cómo llegar?",
    ]);
  });

  it("returns the translated prompts when the locale has them", () => {
    expect(getLocalizedQuestionPrompts(baseStory, "fr")).toEqual([
      "Que voir ?",
      "Comment y arriver ?",
    ]);
  });

  it("falls back to Spanish prompts when the translation has no question_prompts", () => {
    expect(getLocalizedQuestionPrompts(baseStory, "de")).toEqual([
      "¿Qué ver?",
      "¿Cómo llegar?",
    ]);
  });

  it("falls back to Spanish prompts when the locale has no translation at all", () => {
    expect(getLocalizedQuestionPrompts(baseStory, "pt")).toEqual([
      "¿Qué ver?",
      "¿Cómo llegar?",
    ]);
  });

  it("returns an empty array (not undefined) when the story has no question_prompts anywhere", () => {
    const storyWithoutPrompts: Story = { ...baseStory, metadata: {} };
    expect(getLocalizedQuestionPrompts(storyWithoutPrompts, "fr")).toEqual([]);
    expect(getLocalizedQuestionPrompts(storyWithoutPrompts, "es")).toEqual([]);
  });

  it("falls back to Spanish when the translated question_prompts array is empty", () => {
    const storyWithEmptyTranslatedPrompts: Story = {
      ...baseStory,
      metadata: {
        ...baseStory.metadata,
        translations: {
          ...baseStory.metadata?.translations,
          fr: {
            title: "Titre en Français",
            subtitle: "Sous-titre",
            description: "Description",
            question_prompts: [],
          },
        },
      },
    };
    expect(getLocalizedQuestionPrompts(storyWithEmptyTranslatedPrompts, "fr")).toEqual([
      "¿Qué ver?",
      "¿Cómo llegar?",
    ]);
  });
});
