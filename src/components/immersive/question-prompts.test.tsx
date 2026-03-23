import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuestionPrompts } from "./question-prompts";
import { createMockT } from "@/test/i18n-mock";

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
