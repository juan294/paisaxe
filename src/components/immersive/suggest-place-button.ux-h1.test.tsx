/**
 * UX-H1 (#392): Mobile suggest-place trigger must directly open the dialog.
 *
 * The mobile overflow menu must NOT delegate to a hidden DOM element
 * (e.g., `[data-suggest-place-trigger]` that is hidden on mobile via CSS classes).
 * Instead, clicking the menu item must open the dialog directly via its own state.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SuggestPlaceButton } from "./suggest-place-button";

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    locale: "es",
  }),
}));

vi.mock("./suggest-place-dialog", () => ({
  SuggestPlaceDialog: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-testid="suggest-place-dialog">
        <button onClick={onClose}>Cerrar</button>
      </div>
    ) : null,
}));

let mockIsEnabled = true;

vi.mock("@/hooks/use-feature-flags", () => ({
  useFeatureFlags: () => ({
    isEnabled: (flag: string) => flag === "user_story_suggestions" && mockIsEnabled,
    isEnabledWithDefault: () => false,
    flags: [],
    isReady: true,
  }),
}));

describe("UX-H1: SuggestPlaceButton mobile menu variant", () => {
  beforeEach(() => {
    mockIsEnabled = true;
  });

  it("renders a menuitem role button in menu variant", () => {
    render(<SuggestPlaceButton variant="menu" />);

    // The menu variant must render a button with role="menuitem"
    const menuButton = screen.getByRole("menuitem");
    expect(menuButton).toBeInTheDocument();
  });

  it("the menu variant button is NOT hidden via CSS (not wrapped in hidden md:block)", () => {
    const { container } = render(<SuggestPlaceButton variant="menu" />);

    const menuButton = container.querySelector("[role='menuitem']");
    expect(menuButton).not.toBeNull();
    // Must not have the "hidden" Tailwind class that desktop-only elements use
    expect(menuButton!.className).not.toContain("hidden");
  });

  it("opens the dialog directly when the menu item is clicked — no delegation to hidden trigger", () => {
    render(<SuggestPlaceButton variant="menu" />);

    // Before click: dialog is not open
    expect(screen.queryByTestId("suggest-place-dialog")).not.toBeInTheDocument();

    // Click the menu item directly
    const menuButton = screen.getByRole("menuitem");
    fireEvent.click(menuButton);

    // After click: dialog is open
    expect(screen.getByTestId("suggest-place-dialog")).toBeInTheDocument();
  });

  it("has exactly one button element in menu variant (no hidden sibling triggers)", () => {
    const { container } = render(<SuggestPlaceButton variant="menu" />);

    // There must be exactly one interactive button (the menu item itself)
    // A hidden desktop trigger would add a second button element
    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAttribute("role", "menuitem");
  });

  it("icon variant also opens dialog directly without hidden delegation", () => {
    render(<SuggestPlaceButton variant="icon" />);

    const iconButton = screen.getByRole("button");
    expect(iconButton).toBeInTheDocument();
    expect(screen.queryByTestId("suggest-place-dialog")).not.toBeInTheDocument();

    fireEvent.click(iconButton);

    expect(screen.getByTestId("suggest-place-dialog")).toBeInTheDocument();
  });
});
