import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageSwitcher } from "./language-switcher";

// Mock the useTranslation hook
const mockSetLocale = vi.fn();
let mockLocale = "es";

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    locale: mockLocale,
    setLocale: mockSetLocale,
    t: (key: string) => key,
  }),
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    button: ({ children, ...props }: React.HTMLAttributes<HTMLButtonElement>) => (
      <button {...props}>{children}</button>
    ),
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocale = "es";
  });

  describe("collapsed state", () => {
    it("should show only the active language when collapsed", () => {
      mockLocale = "es";
      render(<LanguageSwitcher />);

      // Toggle button should show active language
      expect(screen.getByRole("button", { name: /ES/i })).toBeInTheDocument();

      // Other languages should not be visible initially
      expect(screen.queryByRole("button", { name: "EN" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "FR" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "DE" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "PT" })).not.toBeInTheDocument();
    });

    it("should show FR when locale is fr", () => {
      mockLocale = "fr";
      render(<LanguageSwitcher />);

      expect(screen.getByRole("button", { name: /FR/i })).toBeInTheDocument();
    });

    it("should show EN when locale is en", () => {
      mockLocale = "en";
      render(<LanguageSwitcher />);

      expect(screen.getByRole("button", { name: /EN/i })).toBeInTheDocument();
    });

    it("should show DE when locale is de", () => {
      mockLocale = "de";
      render(<LanguageSwitcher />);

      expect(screen.getByRole("button", { name: /DE/i })).toBeInTheDocument();
    });

    it("should show PT when locale is pt", () => {
      mockLocale = "pt";
      render(<LanguageSwitcher />);

      expect(screen.getByRole("button", { name: /PT/i })).toBeInTheDocument();
    });
  });

  describe("expanded state", () => {
    it("should expand and show all languages when toggle is clicked", () => {
      mockLocale = "es";
      render(<LanguageSwitcher />);

      // Click to expand
      fireEvent.click(screen.getByRole("button", { name: /ES/i }));

      // All language options should now be visible (ES has 2 buttons: toggle + dropdown)
      const allButtons = screen.getAllByRole("button");
      expect(allButtons).toHaveLength(6); // 1 toggle + 5 language options
      expect(screen.getByRole("button", { name: "EN" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "FR" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "DE" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "PT" })).toBeInTheDocument();
    });

    it("should highlight the current language in the dropdown", () => {
      mockLocale = "es";
      render(<LanguageSwitcher />);

      // Click to expand
      fireEvent.click(screen.getByRole("button", { name: /ES/i }));

      // ES button in dropdown should have selected styling (there are 2 ES buttons, get all)
      const esButtons = screen.getAllByRole("button", { name: /ES/i });
      // The dropdown button (second one) should have selected styling
      const dropdownEsButton = esButtons[1];
      expect(dropdownEsButton.className).toContain("bg-white");
      expect(dropdownEsButton.className).toContain("text-black");
    });

    it("should call setLocale when a different language is clicked", () => {
      mockLocale = "es";
      render(<LanguageSwitcher />);

      // Click to expand
      fireEvent.click(screen.getByRole("button", { name: /ES/i }));

      // Click EN
      fireEvent.click(screen.getByRole("button", { name: "EN" }));

      expect(mockSetLocale).toHaveBeenCalledWith("en");
    });

    it("should call setLocale with fr when FR is clicked", () => {
      mockLocale = "es";
      render(<LanguageSwitcher />);

      fireEvent.click(screen.getByRole("button", { name: /ES/i }));
      fireEvent.click(screen.getByRole("button", { name: "FR" }));

      expect(mockSetLocale).toHaveBeenCalledWith("fr");
    });

    it("should call setLocale with de when DE is clicked", () => {
      mockLocale = "es";
      render(<LanguageSwitcher />);

      fireEvent.click(screen.getByRole("button", { name: /ES/i }));
      fireEvent.click(screen.getByRole("button", { name: "DE" }));

      expect(mockSetLocale).toHaveBeenCalledWith("de");
    });

    it("should call setLocale with pt when PT is clicked", () => {
      mockLocale = "es";
      render(<LanguageSwitcher />);

      fireEvent.click(screen.getByRole("button", { name: /ES/i }));
      fireEvent.click(screen.getByRole("button", { name: "PT" }));

      expect(mockSetLocale).toHaveBeenCalledWith("pt");
    });

    it("should call setLocale with es when ES is clicked from different locale", () => {
      mockLocale = "en";
      render(<LanguageSwitcher />);

      fireEvent.click(screen.getByRole("button", { name: /EN/i }));
      fireEvent.click(screen.getByRole("button", { name: "ES" }));

      expect(mockSetLocale).toHaveBeenCalledWith("es");
    });
  });

  describe("closing behavior", () => {
    it("should close when clicking outside", () => {
      mockLocale = "es";
      render(
        <div data-testid="outside">
          <LanguageSwitcher />
        </div>
      );

      // Open the dropdown
      fireEvent.click(screen.getByRole("button", { name: /ES/i }));
      expect(screen.getByRole("button", { name: "EN" })).toBeInTheDocument();

      // Click outside
      fireEvent.mouseDown(screen.getByTestId("outside"));

      // Dropdown should close
      expect(screen.queryByRole("button", { name: "EN" })).not.toBeInTheDocument();
    });

    it("should close when pressing Escape", () => {
      mockLocale = "es";
      render(<LanguageSwitcher />);

      // Open the dropdown
      fireEvent.click(screen.getByRole("button", { name: /ES/i }));
      expect(screen.getByRole("button", { name: "EN" })).toBeInTheDocument();

      // Press Escape
      fireEvent.keyDown(document, { key: "Escape" });

      // Dropdown should close
      expect(screen.queryByRole("button", { name: "EN" })).not.toBeInTheDocument();
    });

    it("should close when a language is selected", () => {
      mockLocale = "es";
      render(<LanguageSwitcher />);

      // Open the dropdown
      fireEvent.click(screen.getByRole("button", { name: /ES/i }));
      expect(screen.getByRole("button", { name: "EN" })).toBeInTheDocument();

      // Select a language
      fireEvent.click(screen.getByRole("button", { name: "EN" }));

      // Dropdown should close
      expect(screen.queryByRole("button", { name: "FR" })).not.toBeInTheDocument();
    });
  });

  describe("event handling", () => {
    it("should stop event propagation on toggle click", () => {
      const parentHandler = vi.fn();
      render(
        <div onClick={parentHandler}>
          <LanguageSwitcher />
        </div>
      );

      fireEvent.click(screen.getByRole("button", { name: /ES/i }));

      expect(parentHandler).not.toHaveBeenCalled();
    });

    it("should stop event propagation on language selection", () => {
      const parentHandler = vi.fn();
      render(
        <div onClick={parentHandler}>
          <LanguageSwitcher />
        </div>
      );

      fireEvent.click(screen.getByRole("button", { name: /ES/i }));
      fireEvent.click(screen.getByRole("button", { name: "EN" }));

      expect(parentHandler).not.toHaveBeenCalled();
    });
  });

  describe("accessibility", () => {
    it("should have accessible label", () => {
      render(<LanguageSwitcher />);

      expect(screen.getByRole("group")).toHaveAttribute(
        "aria-label",
        "accessibility.language_switcher"
      );
    });

    it("should indicate expanded state", () => {
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { name: /ES/i });

      // Initially collapsed
      expect(toggleButton).toHaveAttribute("aria-expanded", "false");

      // After click, expanded
      fireEvent.click(toggleButton);
      expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    });
  });
});
