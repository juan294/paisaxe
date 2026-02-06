import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SuggestPlaceButton } from "./suggest-place-button";

// Mock i18n
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "suggestions.suggest_place": "Suggest a place",
      };
      return translations[key] || key;
    },
    language: "en",
  }),
}));

// Mock SuggestPlaceDialog
vi.mock("./suggest-place-dialog", () => ({
  SuggestPlaceDialog: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="suggest-dialog">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

let mockIsEnabled = true;

vi.mock("@/hooks/use-feature-flags", () => ({
  useFeatureFlags: () => ({
    isEnabled: (flag: string) => flag === "user_story_suggestions" && mockIsEnabled,
  }),
}));

describe("SuggestPlaceButton", () => {
  beforeEach(() => {
    mockIsEnabled = true;
  });

  describe("feature flag disabled", () => {
    it("returns null when feature flag is disabled", () => {
      mockIsEnabled = false;
      const { container } = render(<SuggestPlaceButton />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("feature flag enabled", () => {
    it("renders button to open dialog", () => {
      render(<SuggestPlaceButton />);
      const button = screen.getByRole("button", { name: "Suggest a place" });
      expect(button).toBeInTheDocument();
    });

    it("opens dialog when clicking button", () => {
      render(<SuggestPlaceButton />);
      expect(screen.queryByTestId("suggest-dialog")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Suggest a place" }));
      expect(screen.getByTestId("suggest-dialog")).toBeInTheDocument();
    });

    it("closes dialog when close is triggered", () => {
      render(<SuggestPlaceButton />);
      fireEvent.click(screen.getByRole("button", { name: "Suggest a place" }));
      expect(screen.getByTestId("suggest-dialog")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Close"));
      expect(screen.queryByTestId("suggest-dialog")).not.toBeInTheDocument();
    });

    it("stops event propagation on click", () => {
      const parentHandler = vi.fn();
      render(
        <div onClick={parentHandler}>
          <SuggestPlaceButton />
        </div>
      );
      fireEvent.click(screen.getByRole("button", { name: "Suggest a place" }));
      expect(parentHandler).not.toHaveBeenCalled();
    });

    it("renders Lightbulb icon", () => {
      const { container } = render(<SuggestPlaceButton />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveClass("text-white");
    });

    it("applies custom className", () => {
      const { container } = render(<SuggestPlaceButton className="custom-class" />);
      const button = container.querySelector("button");
      expect(button).toHaveClass("custom-class");
    });
  });
});
