import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DetailsTab } from "./details-tab";
import type { StoryCategory, StoryLocation, StoryDuration } from "@/types/immersive";

// Default props factory
function makeProps(overrides?: Partial<React.ComponentProps<typeof DetailsTab>>) {
  return {
    title: "Test Story",
    slug: "test-story",
    subtitle: "A subtitle",
    description: "A description",
    category: "nature" as StoryCategory | "",
    location: "eastern" as StoryLocation | "",
    duration: "day-trip" as StoryDuration | "",
    sourcePdf: "guide.pdf",
    questionPrompts: [] as string[],
    showOptionalFields: false,
    onTitleChange: vi.fn(),
    onSlugChange: vi.fn(),
    onSubtitleChange: vi.fn(),
    onDescriptionChange: vi.fn(),
    onCategoryChange: vi.fn(),
    onLocationChange: vi.fn(),
    onDurationChange: vi.fn(),
    onSourcePdfChange: vi.fn(),
    onQuestionPromptsChange: vi.fn(),
    onToggleOptionalFields: vi.fn(),
    ...overrides,
  };
}

describe("DetailsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Rendering core fields
  // ---------------------------------------------------------------------------

  describe("core fields rendering", () => {
    it("renders title input with value", () => {
      render(<DetailsTab {...makeProps()} />);

      const titleInput = screen.getByLabelText("Title");
      expect(titleInput).toBeInTheDocument();
      expect(titleInput).toHaveValue("Test Story");
    });

    it("renders slug input with value and prefix", () => {
      render(<DetailsTab {...makeProps()} />);

      const slugInput = screen.getByLabelText("URL Slug");
      expect(slugInput).toBeInTheDocument();
      expect(slugInput).toHaveValue("test-story");
      expect(screen.getByText("/story/")).toBeInTheDocument();
    });

    it("renders subtitle input with value", () => {
      render(<DetailsTab {...makeProps()} />);

      const subtitleInput = screen.getByLabelText("Subtitle");
      expect(subtitleInput).toBeInTheDocument();
      expect(subtitleInput).toHaveValue("A subtitle");
    });

    it("renders subtitle input with placeholder", () => {
      render(<DetailsTab {...makeProps({ subtitle: "" })} />);

      const subtitleInput = screen.getByLabelText("Subtitle");
      expect(subtitleInput).toHaveAttribute("placeholder", "Optional subtitle");
    });

    it("renders description textarea with value", () => {
      render(<DetailsTab {...makeProps()} />);

      const descriptionInput = screen.getByLabelText("Description");
      expect(descriptionInput).toBeInTheDocument();
      expect(descriptionInput).toHaveValue("A description");
    });

    it("renders description textarea with placeholder", () => {
      render(<DetailsTab {...makeProps({ description: "" })} />);

      const descriptionInput = screen.getByLabelText("Description");
      expect(descriptionInput).toHaveAttribute("placeholder", "Optional description");
    });

    it("renders category select", () => {
      render(<DetailsTab {...makeProps()} />);

      expect(screen.getByText("Category")).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // User interactions - core fields
  // ---------------------------------------------------------------------------

  describe("user interactions", () => {
    it("calls onTitleChange when title is edited", async () => {
      const user = userEvent.setup();
      const props = makeProps();
      render(<DetailsTab {...props} />);

      const titleInput = screen.getByLabelText("Title");
      await user.clear(titleInput);
      await user.type(titleInput, "New Title");

      expect(props.onTitleChange).toHaveBeenCalled();
    });

    it("calls onSlugChange when slug is edited", async () => {
      const user = userEvent.setup();
      const props = makeProps();
      render(<DetailsTab {...props} />);

      const slugInput = screen.getByLabelText("URL Slug");
      await user.clear(slugInput);
      await user.type(slugInput, "new-slug");

      expect(props.onSlugChange).toHaveBeenCalled();
    });

    it("calls onSubtitleChange when subtitle is edited", async () => {
      const user = userEvent.setup();
      const props = makeProps();
      render(<DetailsTab {...props} />);

      const subtitleInput = screen.getByLabelText("Subtitle");
      await user.clear(subtitleInput);
      await user.type(subtitleInput, "New Subtitle");

      expect(props.onSubtitleChange).toHaveBeenCalled();
    });

    it("calls onDescriptionChange when description is edited", async () => {
      const user = userEvent.setup();
      const props = makeProps();
      render(<DetailsTab {...props} />);

      const descriptionInput = screen.getByLabelText("Description");
      await user.clear(descriptionInput);
      await user.type(descriptionInput, "New description");

      expect(props.onDescriptionChange).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Optional Fields Toggle
  // ---------------------------------------------------------------------------

  describe("optional fields toggle", () => {
    it("renders optional fields toggle button", () => {
      render(<DetailsTab {...makeProps()} />);

      expect(screen.getByText("Optional Fields")).toBeInTheDocument();
    });

    it("calls onToggleOptionalFields when toggle is clicked", async () => {
      const user = userEvent.setup();
      const props = makeProps();
      render(<DetailsTab {...props} />);

      await user.click(screen.getByText("Optional Fields"));

      expect(props.onToggleOptionalFields).toHaveBeenCalledTimes(1);
    });

    it("hides optional fields when showOptionalFields is false", () => {
      render(<DetailsTab {...makeProps({ showOptionalFields: false })} />);

      expect(screen.queryByLabelText("Location")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Duration")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Source PDF")).not.toBeInTheDocument();
      expect(screen.queryByText("Question Prompts")).not.toBeInTheDocument();
    });

    it("shows optional fields when showOptionalFields is true", () => {
      render(<DetailsTab {...makeProps({ showOptionalFields: true })} />);

      expect(screen.getByText("Location")).toBeInTheDocument();
      expect(screen.getByText("Duration")).toBeInTheDocument();
      expect(screen.getByLabelText("Source PDF")).toBeInTheDocument();
      expect(screen.getByText("Question Prompts")).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Optional fields: Source PDF
  // ---------------------------------------------------------------------------

  describe("source PDF field", () => {
    it("renders source PDF input with value", () => {
      render(<DetailsTab {...makeProps({ showOptionalFields: true })} />);

      const pdfInput = screen.getByLabelText("Source PDF");
      expect(pdfInput).toHaveValue("guide.pdf");
    });

    it("renders source PDF input with placeholder", () => {
      render(<DetailsTab {...makeProps({ showOptionalFields: true, sourcePdf: "" })} />);

      const pdfInput = screen.getByLabelText("Source PDF");
      expect(pdfInput).toHaveAttribute("placeholder", "guide.pdf");
    });

    it("calls onSourcePdfChange when edited", async () => {
      const user = userEvent.setup();
      const props = makeProps({ showOptionalFields: true });
      render(<DetailsTab {...props} />);

      const pdfInput = screen.getByLabelText("Source PDF");
      await user.clear(pdfInput);
      await user.type(pdfInput, "new-guide.pdf");

      expect(props.onSourcePdfChange).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Question Prompts
  // ---------------------------------------------------------------------------

  describe("question prompts", () => {
    it("shows empty state when no prompts", () => {
      render(
        <DetailsTab {...makeProps({ showOptionalFields: true, questionPrompts: [] })} />
      );

      expect(screen.getByText("No prompts added")).toBeInTheDocument();
    });

    it("shows helper text about feature flag", () => {
      render(
        <DetailsTab {...makeProps({ showOptionalFields: true })} />
      );

      expect(
        screen.getByText("Clickable suggestions shown below stories (requires feature flag)")
      ).toBeInTheDocument();
    });

    it("renders existing prompts as inputs", () => {
      render(
        <DetailsTab
          {...makeProps({
            showOptionalFields: true,
            questionPrompts: ["Question 1", "Question 2"],
          })}
        />
      );

      const promptInputs = screen.getAllByPlaceholderText(/e\.g\., ¿Cuándo se construyó\?/);
      expect(promptInputs).toHaveLength(2);
      expect(promptInputs[0]).toHaveValue("Question 1");
      expect(promptInputs[1]).toHaveValue("Question 2");
    });

    it("calls onQuestionPromptsChange when Add is clicked", async () => {
      const user = userEvent.setup();
      const props = makeProps({ showOptionalFields: true, questionPrompts: ["Q1"] });
      render(<DetailsTab {...props} />);

      await user.click(screen.getByText("Add"));

      expect(props.onQuestionPromptsChange).toHaveBeenCalledWith(["Q1", ""]);
    });

    it("disables Add button when 5 prompts exist", () => {
      render(
        <DetailsTab
          {...makeProps({
            showOptionalFields: true,
            questionPrompts: ["Q1", "Q2", "Q3", "Q4", "Q5"],
          })}
        />
      );

      const addButton = screen.getByText("Add").closest("button");
      expect(addButton).toBeDisabled();
    });

    it("does not disable Add button when fewer than 5 prompts", () => {
      render(
        <DetailsTab
          {...makeProps({
            showOptionalFields: true,
            questionPrompts: ["Q1", "Q2"],
          })}
        />
      );

      const addButton = screen.getByText("Add").closest("button");
      expect(addButton).not.toBeDisabled();
    });

    it("calls onQuestionPromptsChange with updated prompt when edited", async () => {
      const user = userEvent.setup();
      const props = makeProps({
        showOptionalFields: true,
        questionPrompts: ["Original question"],
      });
      render(<DetailsTab {...props} />);

      const promptInput = screen.getByDisplayValue("Original question");
      await user.type(promptInput, "!");

      expect(props.onQuestionPromptsChange).toHaveBeenCalledWith(["Original question!"]);
    });

    it("calls onQuestionPromptsChange to remove a prompt", async () => {
      const user = userEvent.setup();
      const props = makeProps({
        showOptionalFields: true,
        questionPrompts: ["Q1", "Q2", "Q3"],
      });
      render(<DetailsTab {...props} />);

      const removeButtons = screen.getAllByLabelText("Remove question prompt");
      expect(removeButtons).toHaveLength(3);

      await user.click(removeButtons[1]); // Remove Q2

      expect(props.onQuestionPromptsChange).toHaveBeenCalledWith(["Q1", "Q3"]);
    });

    it("removes the first prompt correctly", async () => {
      const user = userEvent.setup();
      const props = makeProps({
        showOptionalFields: true,
        questionPrompts: ["Q1", "Q2"],
      });
      render(<DetailsTab {...props} />);

      const removeButtons = screen.getAllByLabelText("Remove question prompt");
      await user.click(removeButtons[0]);

      expect(props.onQuestionPromptsChange).toHaveBeenCalledWith(["Q2"]);
    });

    it("removes the last prompt correctly", async () => {
      const user = userEvent.setup();
      const props = makeProps({
        showOptionalFields: true,
        questionPrompts: ["Q1", "Q2"],
      });
      render(<DetailsTab {...props} />);

      const removeButtons = screen.getAllByLabelText("Remove question prompt");
      await user.click(removeButtons[1]);

      expect(props.onQuestionPromptsChange).toHaveBeenCalledWith(["Q1"]);
    });
  });

  // ---------------------------------------------------------------------------
  // Empty/default values
  // ---------------------------------------------------------------------------

  describe("empty values", () => {
    it("renders with all empty values", () => {
      render(
        <DetailsTab
          {...makeProps({
            title: "",
            slug: "",
            subtitle: "",
            description: "",
            category: "",
            location: "",
            duration: "",
            sourcePdf: "",
            questionPrompts: [],
            showOptionalFields: false,
          })}
        />
      );

      expect(screen.getByLabelText("Title")).toHaveValue("");
      expect(screen.getByLabelText("URL Slug")).toHaveValue("");
      expect(screen.getByLabelText("Subtitle")).toHaveValue("");
      expect(screen.getByLabelText("Description")).toHaveValue("");
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe("edge cases", () => {
    it("renders with maximum question prompts (5)", () => {
      render(
        <DetailsTab
          {...makeProps({
            showOptionalFields: true,
            questionPrompts: ["Q1", "Q2", "Q3", "Q4", "Q5"],
          })}
        />
      );

      const promptInputs = screen.getAllByPlaceholderText(/e\.g\., ¿Cuándo se construyó\?/);
      expect(promptInputs).toHaveLength(5);
    });

    it("renders with single empty prompt", () => {
      render(
        <DetailsTab
          {...makeProps({
            showOptionalFields: true,
            questionPrompts: [""],
          })}
        />
      );

      const promptInputs = screen.getAllByPlaceholderText(/e\.g\., ¿Cuándo se construyó\?/);
      expect(promptInputs).toHaveLength(1);
      expect(promptInputs[0]).toHaveValue("");
    });
  });
});
