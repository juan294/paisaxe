import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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
      const toggleButton = screen.getByRole("button", { expanded: false });
      expect(toggleButton).toBeInTheDocument();
      expect(within(toggleButton).getByText("ES")).toBeInTheDocument();

      // Dropdown is hidden via CSS (opacity-0, pointer-events-none)
      // The buttons exist in DOM but are not visible/clickable
      const allButtons = screen.getAllByRole("button");
      expect(allButtons).toHaveLength(7); // 1 toggle + 6 language options (hidden)
    });

    it("should show FR when locale is fr", () => {
      mockLocale = "fr";
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { expanded: false });
      expect(within(toggleButton).getByText("FR")).toBeInTheDocument();
    });

    it("should show EN when locale is en", () => {
      mockLocale = "en";
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { expanded: false });
      expect(within(toggleButton).getByText("EN")).toBeInTheDocument();
    });

    it("should show DE when locale is de", () => {
      mockLocale = "de";
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { expanded: false });
      expect(within(toggleButton).getByText("DE")).toBeInTheDocument();
    });

    it("should show PT when locale is pt", () => {
      mockLocale = "pt";
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { expanded: false });
      expect(within(toggleButton).getByText("PT")).toBeInTheDocument();
    });

    it("should show AST when locale is ast", () => {
      mockLocale = "ast";
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { expanded: false });
      expect(within(toggleButton).getByText("AST")).toBeInTheDocument();
    });
  });

  describe("expanded state", () => {
    it("should expand and show all languages when toggle is clicked", () => {
      mockLocale = "es";
      render(<LanguageSwitcher />);

      // Click to expand
      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      // All language options should now be visible
      const allButtons = screen.getAllByRole("button");
      expect(allButtons).toHaveLength(7); // 1 toggle + 6 language options
    });

    it("should highlight the current language in the dropdown", () => {
      mockLocale = "es";
      render(<LanguageSwitcher />);

      // Click to expand
      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      // ES button in dropdown should have selected styling (there are 2 ES buttons, get all)
      const esButtons = screen.getAllByRole("button", { name: /^ES$/i });
      // The dropdown button (one without aria-expanded) should have selected styling
      const dropdownEsButton = esButtons.find(btn => !btn.hasAttribute("aria-expanded"));
      expect(dropdownEsButton?.className).toContain("bg-white");
      expect(dropdownEsButton?.className).toContain("text-black");
    });

    it("should call setLocale when a different language is clicked", () => {
      mockLocale = "es";
      render(<LanguageSwitcher />);

      // Click to expand
      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      // Click EN (the dropdown button, not the toggle)
      const enButton = screen.getByRole("button", { name: "EN" });
      fireEvent.click(enButton);

      expect(mockSetLocale).toHaveBeenCalledWith("en");
    });

    it("should call setLocale with fr when FR is clicked", () => {
      mockLocale = "es";
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);
      fireEvent.click(screen.getByRole("button", { name: "FR" }));

      expect(mockSetLocale).toHaveBeenCalledWith("fr");
    });

    it("should call setLocale with de when DE is clicked", () => {
      mockLocale = "es";
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);
      fireEvent.click(screen.getByRole("button", { name: "DE" }));

      expect(mockSetLocale).toHaveBeenCalledWith("de");
    });

    it("should call setLocale with pt when PT is clicked", () => {
      mockLocale = "es";
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);
      fireEvent.click(screen.getByRole("button", { name: "PT" }));

      expect(mockSetLocale).toHaveBeenCalledWith("pt");
    });

    it("should call setLocale with ast when AST is clicked", () => {
      mockLocale = "es";
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);
      fireEvent.click(screen.getByRole("button", { name: "AST" }));

      expect(mockSetLocale).toHaveBeenCalledWith("ast");
    });

    it("should call setLocale with es when ES is clicked from different locale", () => {
      mockLocale = "en";
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      // Find ES dropdown button (not the toggle)
      const esButtons = screen.getAllByRole("button", { name: /^ES$/i });
      const dropdownEsButton = esButtons.find(btn => !btn.hasAttribute("aria-expanded"));
      fireEvent.click(dropdownEsButton!);

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
      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      // Dropdown should be visible (check for visible class on dropdown panel)
      const groupContainer = screen.getByRole("group");
      const dropdownPanel = groupContainer.querySelector('[class*="opacity-100"]');
      expect(dropdownPanel).not.toBeNull();

      // Click outside
      fireEvent.mouseDown(screen.getByTestId("outside"));

      // Dropdown should be hidden via CSS
      const hiddenDropdown = groupContainer.querySelector('[class*="opacity-0"][class*="pointer-events-none"]');
      expect(hiddenDropdown).not.toBeNull();
    });

    it("should close when pressing Escape", () => {
      mockLocale = "es";
      render(<LanguageSwitcher />);

      // Open the dropdown
      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      // Press Escape
      fireEvent.keyDown(document, { key: "Escape" });

      // Dropdown should be hidden via CSS
      const groupContainer = screen.getByRole("group");
      const hiddenDropdown = groupContainer.querySelector('[class*="opacity-0"][class*="pointer-events-none"]');
      expect(hiddenDropdown).not.toBeNull();
    });

    it("should close when a language is selected", () => {
      mockLocale = "es";
      render(<LanguageSwitcher />);

      // Open the dropdown
      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      // Select a language
      fireEvent.click(screen.getByRole("button", { name: "EN" }));

      // Dropdown should be hidden via CSS
      const groupContainer = screen.getByRole("group");
      const hiddenDropdown = groupContainer.querySelector('[class*="opacity-0"][class*="pointer-events-none"]');
      expect(hiddenDropdown).not.toBeNull();
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

      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      expect(parentHandler).not.toHaveBeenCalled();
    });

    it("should stop event propagation on language selection", () => {
      const parentHandler = vi.fn();
      render(
        <div onClick={parentHandler}>
          <LanguageSwitcher />
        </div>
      );

      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);
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

      const toggleButton = screen.getByRole("button", { expanded: false });

      // Initially collapsed
      expect(toggleButton).toHaveAttribute("aria-expanded", "false");

      // After click, expanded
      fireEvent.click(toggleButton);
      expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    });
  });
});
