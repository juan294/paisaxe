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
      // The options exist in DOM but are not visible/clickable
      const allOptions = screen.getAllByRole("option");
      expect(allOptions).toHaveLength(6); // 6 language options (hidden)
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

      // All language options should be present
      const allOptions = screen.getAllByRole("option");
      expect(allOptions).toHaveLength(6); // 6 language options
    });

    it("should highlight the current language in the dropdown", () => {
      mockLocale = "es";
      render(<LanguageSwitcher />);

      // Click to expand
      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      // ES option in dropdown should have selected styling and aria-selected
      const esOption = screen.getByRole("option", { name: /Espa\u00f1ol/ });
      expect(esOption).toHaveAttribute("aria-selected", "true");
      expect(esOption.className).toContain("bg-white");
      expect(esOption.className).toContain("text-black");
    });

    it("should call setLocale when a different language is clicked", () => {
      mockLocale = "es";
      render(<LanguageSwitcher />);

      // Click to expand
      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      // Click EN option
      const enOption = screen.getByRole("option", { name: /English/ });
      fireEvent.click(enOption);

      expect(mockSetLocale).toHaveBeenCalledWith("en");
    });

    it("should call setLocale with fr when FR is clicked", () => {
      mockLocale = "es";
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);
      fireEvent.click(screen.getByRole("option", { name: /Fran\u00e7ais/ }));

      expect(mockSetLocale).toHaveBeenCalledWith("fr");
    });

    it("should call setLocale with de when DE is clicked", () => {
      mockLocale = "es";
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);
      fireEvent.click(screen.getByRole("option", { name: /Deutsch/ }));

      expect(mockSetLocale).toHaveBeenCalledWith("de");
    });

    it("should call setLocale with pt when PT is clicked", () => {
      mockLocale = "es";
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);
      fireEvent.click(screen.getByRole("option", { name: /Portugu\u00eas/ }));

      expect(mockSetLocale).toHaveBeenCalledWith("pt");
    });

    it("should call setLocale with ast when AST is clicked", () => {
      mockLocale = "es";
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);
      fireEvent.click(screen.getByRole("option", { name: /Asturianu/ }));

      expect(mockSetLocale).toHaveBeenCalledWith("ast");
    });

    it("should call setLocale with es when ES is clicked from different locale", () => {
      mockLocale = "en";
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      // Find ES option
      const esOption = screen.getByRole("option", { name: /Espa\u00f1ol/ });
      fireEvent.click(esOption);

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
      fireEvent.click(screen.getByRole("option", { name: /English/ }));

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
      fireEvent.click(screen.getByRole("option", { name: /English/ }));

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

  describe("keyboard navigation", () => {
    it("should move focus down with ArrowDown", () => {
      render(<LanguageSwitcher />);

      // Open the dropdown
      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      // Get the listbox
      const listbox = screen.getByRole("listbox");

      // First option should be focused after open
      const options = screen.getAllByRole("option");
      options[0].focus();

      // Press ArrowDown
      fireEvent.keyDown(listbox, { key: "ArrowDown" });
      expect(document.activeElement).toBe(options[1]);
    });

    it("should move focus up with ArrowUp", () => {
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      const listbox = screen.getByRole("listbox");
      const options = screen.getAllByRole("option");
      options[1].focus();

      fireEvent.keyDown(listbox, { key: "ArrowUp" });
      expect(document.activeElement).toBe(options[0]);
    });

    it("should wrap from last to first with ArrowDown", () => {
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      const listbox = screen.getByRole("listbox");
      const options = screen.getAllByRole("option");
      const lastOption = options[options.length - 1];
      lastOption.focus();

      fireEvent.keyDown(listbox, { key: "ArrowDown" });
      expect(document.activeElement).toBe(options[0]);
    });

    it("should wrap from first to last with ArrowUp", () => {
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      const listbox = screen.getByRole("listbox");
      const options = screen.getAllByRole("option");
      options[0].focus();

      fireEvent.keyDown(listbox, { key: "ArrowUp" });
      expect(document.activeElement).toBe(options[options.length - 1]);
    });

    it("should jump to first item with Home key", () => {
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      const listbox = screen.getByRole("listbox");
      const options = screen.getAllByRole("option");
      options[3].focus();

      fireEvent.keyDown(listbox, { key: "Home" });
      expect(document.activeElement).toBe(options[0]);
    });

    it("should jump to last item with End key", () => {
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      const listbox = screen.getByRole("listbox");
      const options = screen.getAllByRole("option");
      options[0].focus();

      fireEvent.keyDown(listbox, { key: "End" });
      expect(document.activeElement).toBe(options[options.length - 1]);
    });

    it("should select language and close on Enter", () => {
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      const listbox = screen.getByRole("listbox");
      const options = screen.getAllByRole("option");
      // Focus on EN (index 2)
      options[2].focus();

      fireEvent.keyDown(listbox, { key: "Enter" });
      expect(mockSetLocale).toHaveBeenCalledWith("en");
    });

    it("should close dropdown and return focus to trigger on Escape", () => {
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      // Press Escape
      fireEvent.keyDown(document, { key: "Escape" });

      // Dropdown should close
      expect(toggleButton).toHaveAttribute("aria-expanded", "false");
      // Focus should return to the toggle button
      expect(document.activeElement).toBe(toggleButton);
    });

    it("should focus first option when dropdown opens", () => {
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      const options = screen.getAllByRole("option");
      expect(document.activeElement).toBe(options[0]);
    });

    it("should have aria-selected on the current language option", () => {
      mockLocale = "en";
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      const options = screen.getAllByRole("option");
      // EN is index 2 in the languages array
      expect(options[2]).toHaveAttribute("aria-selected", "true");
      expect(options[0]).toHaveAttribute("aria-selected", "false");
    });
  });
});
