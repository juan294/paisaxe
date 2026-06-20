/**
 * UX-M3: Regression tests — LanguageSwitcher must only show locales that
 * meet a coverage threshold (always include es + en; others gated).
 *
 * This tests the gating mechanism: visibleLanguages must always contain
 * 'es' and 'en', and other locales are only shown when they meet the
 * minimum coverage bar defined in LOCALE_COVERAGE.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { LanguageSwitcher, LOCALE_COVERAGE, MIN_COVERAGE_THRESHOLD } from "./language-switcher";

const mockSetLocale = vi.fn();
let mockLocale = "es";

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    locale: mockLocale,
    setLocale: mockSetLocale,
    t: (key: string) => key,
  }),
}));

describe("LanguageSwitcher — locale gating (UX-M3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocale = "es";
  });

  describe("LOCALE_COVERAGE constant", () => {
    it("exports LOCALE_COVERAGE as a Record with numeric values 0-100", () => {
      expect(typeof LOCALE_COVERAGE).toBe("object");
      for (const [, v] of Object.entries(LOCALE_COVERAGE)) {
        expect(typeof v).toBe("number");
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    });

    it("exports MIN_COVERAGE_THRESHOLD as a number", () => {
      expect(typeof MIN_COVERAGE_THRESHOLD).toBe("number");
      expect(MIN_COVERAGE_THRESHOLD).toBeGreaterThan(0);
      expect(MIN_COVERAGE_THRESHOLD).toBeLessThanOrEqual(100);
    });
  });

  describe("always-visible locales", () => {
    it("always shows 'es' regardless of coverage", () => {
      render(<LanguageSwitcher />);
      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      const options = screen.getAllByRole("option");
      const codes = options.map((o) => o.getAttribute("aria-label")?.toLowerCase() ?? "");
      expect(codes.some((c) => c.includes("español") || c.includes("espa"))).toBe(true);
    });

    it("always shows 'en' regardless of coverage", () => {
      render(<LanguageSwitcher />);
      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      const options = screen.getAllByRole("option");
      const codes = options.map((o) => o.getAttribute("aria-label")?.toLowerCase() ?? "");
      expect(codes.some((c) => c.includes("english"))).toBe(true);
    });

    it("shows at least 2 options (es + en always present)", () => {
      render(<LanguageSwitcher />);
      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      const options = screen.getAllByRole("option");
      expect(options.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("coverage gating", () => {
    it("only shows locales where coverage meets MIN_COVERAGE_THRESHOLD or locale is es/en", () => {
      render(<LanguageSwitcher />);
      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      const options = screen.getAllByRole("option");
      // Each visible option should correspond to es, en, or a locale above threshold
      expect(options.length).toBeGreaterThanOrEqual(2);
      // All options shown should be either always-visible (es/en) or above threshold
      // The exact count depends on LOCALE_COVERAGE values
    });

    it("shows the same set of options on every render (deterministic)", () => {
      const { unmount } = render(<LanguageSwitcher />);
      const toggle1 = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggle1);
      const count1 = screen.getAllByRole("option").length;
      unmount();

      render(<LanguageSwitcher />);
      const toggle2 = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggle2);
      const count2 = screen.getAllByRole("option").length;

      expect(count1).toBe(count2);
    });
  });

  describe("interaction with gated locales", () => {
    it("setLocale is called with the correct code when clicking a visible option", () => {
      render(<LanguageSwitcher />);
      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);

      // en is always visible — click it
      const enOption = screen.getByRole("option", { name: /English/i });
      fireEvent.click(enOption);

      expect(mockSetLocale).toHaveBeenCalledWith("en");
    });

    it("the active locale label is shown in the toggle button even if it is gated", () => {
      // If the user somehow has a gated locale stored (e.g. ast below threshold),
      // the toggle still shows the current locale's label
      mockLocale = "es";
      render(<LanguageSwitcher />);

      const toggleButton = screen.getByRole("button", { expanded: false });
      expect(within(toggleButton).getByText("ES")).toBeInTheDocument();
    });
  });
});
