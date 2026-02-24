import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MoodOverlay } from "./mood-overlay";

// Mock i18n
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "mood.title": "How are you feeling?",
        "mood.subtitle": "We'll tailor your experience",
        "mood.relaxing": "Relaxing",
        "mood.adventurous": "Adventurous",
        "mood.cultural": "Cultural",
        "mood.delicious": "Delicious",
        "mood.show_all": "Show all",
        "common.close": "Close",
      };
      return translations[key] || key;
    },
    language: "en",
  }),
}));

describe("MoodOverlay", () => {
  const mockOnSelectMood = vi.fn();
  const mockOnDismiss = vi.fn();

  beforeEach(() => {
    mockOnSelectMood.mockClear();
    mockOnDismiss.mockClear();
  });

  it("renders the mood selection dialog", () => {
    render(<MoodOverlay onSelectMood={mockOnSelectMood} onDismiss={mockOnDismiss} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders title and subtitle", () => {
    render(<MoodOverlay onSelectMood={mockOnSelectMood} onDismiss={mockOnDismiss} />);
    expect(screen.getByText("How are you feeling?")).toBeInTheDocument();
    expect(screen.getByText("We'll tailor your experience")).toBeInTheDocument();
  });

  it("renders all four mood options", () => {
    render(<MoodOverlay onSelectMood={mockOnSelectMood} onDismiss={mockOnDismiss} />);
    expect(screen.getByText("Relaxing")).toBeInTheDocument();
    expect(screen.getByText("Adventurous")).toBeInTheDocument();
    expect(screen.getByText("Cultural")).toBeInTheDocument();
    expect(screen.getByText("Delicious")).toBeInTheDocument();
  });

  it("renders dismiss button with aria-label", () => {
    render(<MoodOverlay onSelectMood={mockOnSelectMood} onDismiss={mockOnDismiss} />);
    const closeButton = screen.getByRole("button", { name: "Close" });
    expect(closeButton).toBeInTheDocument();
  });

  it("calls onSelectMood when a mood is clicked", () => {
    render(<MoodOverlay onSelectMood={mockOnSelectMood} onDismiss={mockOnDismiss} />);
    fireEvent.click(screen.getByText("Relaxing"));
    expect(mockOnSelectMood).toHaveBeenCalledWith("relajante");
  });

  it("calls onSelectMood with correct mood for adventurous", () => {
    render(<MoodOverlay onSelectMood={mockOnSelectMood} onDismiss={mockOnDismiss} />);
    fireEvent.click(screen.getByText("Adventurous"));
    expect(mockOnSelectMood).toHaveBeenCalledWith("aventurero");
  });

  it("calls onSelectMood with correct mood for cultural", () => {
    render(<MoodOverlay onSelectMood={mockOnSelectMood} onDismiss={mockOnDismiss} />);
    fireEvent.click(screen.getByText("Cultural"));
    expect(mockOnSelectMood).toHaveBeenCalledWith("cultural");
  });

  it("calls onSelectMood with correct mood for delicious", () => {
    render(<MoodOverlay onSelectMood={mockOnSelectMood} onDismiss={mockOnDismiss} />);
    fireEvent.click(screen.getByText("Delicious"));
    expect(mockOnSelectMood).toHaveBeenCalledWith("delicioso");
  });

  it("calls onDismiss when X button is clicked", () => {
    render(<MoodOverlay onSelectMood={mockOnSelectMood} onDismiss={mockOnDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(mockOnDismiss).toHaveBeenCalled();
  });

  it("calls onDismiss when 'Show all' is clicked", () => {
    render(<MoodOverlay onSelectMood={mockOnSelectMood} onDismiss={mockOnDismiss} />);
    fireEvent.click(screen.getByText("Show all"));
    expect(mockOnDismiss).toHaveBeenCalled();
  });

  it("renders backdrop with blur effect", () => {
    const { container } = render(
      <MoodOverlay onSelectMood={mockOnSelectMood} onDismiss={mockOnDismiss} />
    );
    const backdrop = container.querySelector(".bg-black\\/70.backdrop-blur-xl");
    expect(backdrop).toBeInTheDocument();
  });

  it("renders mood buttons in a 2-column grid", () => {
    const { container } = render(
      <MoodOverlay onSelectMood={mockOnSelectMood} onDismiss={mockOnDismiss} />
    );
    const grid = container.querySelector(".grid.grid-cols-2");
    expect(grid).toBeInTheDocument();
  });

  describe("accessibility", () => {
    beforeEach(() => {
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
        cb(0);
        return 1;
      });
      vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    });

    afterEach(() => {
      cleanup();
      vi.restoreAllMocks();
    });

    it("traps focus within the dialog (Tab wraps from last to first)", () => {
      render(<MoodOverlay onSelectMood={mockOnSelectMood} onDismiss={mockOnDismiss} />);
      const dialog = screen.getByRole("dialog");

      // Get all focusable buttons inside the dialog
      const buttons = dialog.querySelectorAll<HTMLElement>("button");
      const lastButton = buttons[buttons.length - 1];
      const firstButton = buttons[0];

      // Focus the last button
      lastButton.focus();
      expect(document.activeElement).toBe(lastButton);

      // Press Tab — should wrap to first
      fireEvent.keyDown(dialog, { key: "Tab", shiftKey: false });
      expect(document.activeElement).toBe(firstButton);
    });

    it("traps focus within the dialog (Shift+Tab wraps from first to last)", () => {
      render(<MoodOverlay onSelectMood={mockOnSelectMood} onDismiss={mockOnDismiss} />);
      const dialog = screen.getByRole("dialog");

      const buttons = dialog.querySelectorAll<HTMLElement>("button");
      const firstButton = buttons[0];
      const lastButton = buttons[buttons.length - 1];

      // Focus the first button
      firstButton.focus();
      expect(document.activeElement).toBe(firstButton);

      // Press Shift+Tab — should wrap to last
      fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(lastButton);
    });

    it("calls onDismiss when Escape key is pressed", () => {
      render(<MoodOverlay onSelectMood={mockOnSelectMood} onDismiss={mockOnDismiss} />);
      const dialog = screen.getByRole("dialog");

      fireEvent.keyDown(dialog, { key: "Escape" });
      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });

    it("'Show all' dismiss button has focus-visible ring styles", () => {
      render(<MoodOverlay onSelectMood={mockOnSelectMood} onDismiss={mockOnDismiss} />);
      const showAllButton = screen.getByText("Show all");

      expect(showAllButton.className).toContain("focus-visible:ring-2");
      expect(showAllButton.className).toContain("focus-visible:ring-white/70");
    });

    it("sets aria-modal on the dialog", () => {
      render(<MoodOverlay onSelectMood={mockOnSelectMood} onDismiss={mockOnDismiss} />);
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
    });
  });
});
