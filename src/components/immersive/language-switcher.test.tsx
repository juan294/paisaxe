import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { LanguageSwitcher, LOCALE_COVERAGE } from "./language-switcher";

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
      // UX-M3: options are filtered by coverage threshold. 'ast' is gated
      // (coverage 40% < 70% threshold), so 5 options: es, en, fr, de, pt.
      const allOptions = screen.getAllByRole("option");
      expect(allOptions).toHaveLength(5); // 5 language options (ast gated)
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

    it("should show AST in the toggle button when locale is ast (even though ast is gated from dropdown)", () => {
      // UX-M3: ast is below coverage threshold so it's NOT in the dropdown,
      // but if the user already has ast selected (e.g. from localStorage),
      // the toggle button still shows the current locale's label.
      mockLocale = "ast";
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { expanded: false });
      expect(within(toggleButton).getByText("AST")).toBeInTheDocument();
    });
  });

  describe("expanded state", () => {
    it("should expand and show coverage-gated languages when toggle is clicked", () => {
      mockLocale = "es";
      render(<LanguageSwitcher />);

      // Click to expand
      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      // UX-M3: 'ast' is gated (coverage 40% < 70% threshold) — 5 options: es, en, fr, de, pt
      const allOptions = screen.getAllByRole("option");
      expect(allOptions).toHaveLength(5);
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

    it("should NOT show ast option in dropdown (gated by coverage threshold)", () => {
      // UX-M3: 'ast' has 40% coverage which is below the 70% threshold.
      // It must not appear as a selectable option in the dropdown.
      mockLocale = "es";
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      // ast option should not be present in the dropdown
      expect(screen.queryByRole("option", { name: /Asturianu/ })).not.toBeInTheDocument();
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

    it("stops propagation when clicking inside the dropdown", () => {
      const parentHandler = vi.fn();
      render(
        <div onClick={parentHandler}>
          <LanguageSwitcher />
        </div>
      );

      // Expand the dropdown
      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      // Click on the dropdown container itself (the listbox), not a language option
      const listbox = screen.getByRole("listbox");
      fireEvent.click(listbox);

      // The parent handler should NOT have been called because stopPropagation is on the dropdown
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
      // UX-M3: visible list is [es, en, fr, de, pt] — EN is at index 1 (ast gated)
      options[1].focus();

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
      // UX-M3: visible list is [es, en, fr, de, pt] — EN is at index 1 (ast gated)
      expect(options[1]).toHaveAttribute("aria-selected", "true");
      expect(options[0]).toHaveAttribute("aria-selected", "false");
    });

    it("should handle Enter key when no option is focused (currentIndex < 0)", () => {
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      const listbox = screen.getByRole("listbox");

      // Blur all options so activeElement is not in the options list (currentIndex = -1)
      (document.activeElement as HTMLElement)?.blur();

      // Press Enter — should not call setLocale since currentIndex < 0
      fireEvent.keyDown(listbox, { key: "Enter" });
      expect(mockSetLocale).not.toHaveBeenCalled();
    });

    it("should do nothing for unrecognized keys", () => {
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      const listbox = screen.getByRole("listbox");
      const options = screen.getAllByRole("option");
      options[0].focus();

      // Press an unrecognized key — nothing should change
      fireEvent.keyDown(listbox, { key: "x" });
      expect(document.activeElement).toBe(options[0]);
      expect(mockSetLocale).not.toHaveBeenCalled();
    });
  });

  describe("unreachable guards in handleListboxKeyDown", () => {
    // Lines 72 and 75 (approx): `if (!listbox) return;` and `if (options.length === 0) return;`
    // are architecturally unreachable. The listboxRef inner div is always rendered in the DOM
    // (just hidden via CSS when collapsed), so listboxRef.current is never null. Similarly,
    // coverage-gated language buttons are always rendered inside the listbox (at least es + en),
    // so options.length is always >= 2. These guards are defensive programming and cannot
    // be exercised via the component's public API.

    it("listboxRef is always set — guard on line 72 is unreachable", () => {
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      // UX-M3: 'ast' is gated — listbox contains 5 option elements (es, en, fr, de, pt)
      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(5);

      // Arrow key navigation works, proving listboxRef.current is valid
      const listbox = screen.getByRole("listbox");
      options[0].focus();
      fireEvent.keyDown(listbox, { key: "ArrowDown" });
      expect(document.activeElement).toBe(options[1]);
    });
  });

  describe("coverage gate fallback", () => {
    it("should treat a locale missing from LOCALE_COVERAGE as 0% coverage and gate it (line 62 `?? 0`)", () => {
      // Line 62: `const coverage = LOCALE_COVERAGE[lang.code] ?? 0;`
      // LOCALE_COVERAGE is a Partial record by design — a locale absent from the
      // map falls back to 0, which is below MIN_COVERAGE_THRESHOLD, so the
      // language is hidden from the dropdown. Simulate a missing entry by
      // temporarily deleting 'fr' from the exported (mutable) map.
      const originalFr = LOCALE_COVERAGE.fr;
      delete LOCALE_COVERAGE.fr;
      try {
        mockLocale = "es";
        render(<LanguageSwitcher />);

        // fr now has no coverage entry → gated; ast already gated → 4 options
        const options = screen.getAllByRole("option");
        expect(options).toHaveLength(4);
        expect(
          screen.queryByRole("option", { name: /Français/ })
        ).not.toBeInTheDocument();
        // Reference locales are always present regardless of coverage
        expect(screen.getByRole("option", { name: /Español/ })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: /English/ })).toBeInTheDocument();
      } finally {
        if (originalFr !== undefined) {
          LOCALE_COVERAGE.fr = originalFr;
        }
      }
    });
  });

  describe("locale fallback", () => {
    it("should fall back to first language (ES) when locale does not match any language", () => {
      // Set locale to a value not in the languages array
      mockLocale = "ja" as "es";
      render(<LanguageSwitcher />);

      // The toggle button should show the first language's label (ES) as fallback
      const toggleButton = screen.getByRole("button", { expanded: false });
      expect(within(toggleButton).getByText("ES")).toBeInTheDocument();
    });
  });

  describe("click outside behavior", () => {
    it("should close dropdown when clicking outside the container", () => {
      mockLocale = "es";
      render(
        <div>
          <button data-testid="outside-button">Outside</button>
          <LanguageSwitcher />
        </div>
      );

      // Open the dropdown
      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      // Verify it is expanded
      expect(toggleButton).toHaveAttribute("aria-expanded", "true");

      // Click outside the container using mousedown (the handler listens to mousedown)
      fireEvent.mouseDown(screen.getByTestId("outside-button"));

      // Dropdown should now be closed
      expect(toggleButton).toHaveAttribute("aria-expanded", "false");
    });

    it("should not close dropdown when clicking inside the container", () => {
      mockLocale = "es";
      render(<LanguageSwitcher />);

      // Open the dropdown
      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      // Click inside the container (on the listbox)
      const listbox = screen.getByRole("listbox");
      fireEvent.mouseDown(listbox);

      // Dropdown should remain open
      expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    });
  });

  // Defensive guards inside handleListboxKeyDown:
  // - `if (!listbox) return;` — guard for when listboxRef.current is null.
  //   Unreachable because the `onKeyDown` handler is attached to the outer listbox div, which
  //   always renders alongside the inner div that holds the ref. The ref is always set by the
  //   time any keydown event fires.
  // - `if (options.length === 0) return;` — guard for when no [role="option"] elements exist.
  //   Unreachable because coverage-gated languages always include at least es + en (>= 2 options).
  // Both are structurally sound defensive patterns that cannot be exercised via jsdom/vitest.
});
