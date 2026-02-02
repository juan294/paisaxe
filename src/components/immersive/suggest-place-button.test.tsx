import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SuggestPlaceButton } from "./suggest-place-button";

// Mock i18n
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "suggestions.sign_in_to_suggest": "Sign in to suggest",
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

// Create controllable mocks
const mockSignInWithGoogle = vi.fn();
let mockUser: { id: string } | null = null;
let mockIsLoading = false;
let mockIsEnabled = true;

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: mockUser,
    isLoading: mockIsLoading,
    signInWithGoogle: mockSignInWithGoogle,
  }),
}));

vi.mock("@/hooks/use-feature-flags", () => ({
  useFeatureFlags: () => ({
    isEnabled: (flag: string) => flag === "user_story_suggestions" && mockIsEnabled,
  }),
}));

describe("SuggestPlaceButton", () => {
  beforeEach(() => {
    mockSignInWithGoogle.mockClear();
    mockUser = null;
    mockIsLoading = false;
    mockIsEnabled = true;
  });

  describe("feature flag disabled", () => {
    it("returns null when feature flag is disabled", () => {
      mockIsEnabled = false;
      const { container } = render(<SuggestPlaceButton />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("loading state", () => {
    it("renders loading skeleton when auth is loading", () => {
      mockIsLoading = true;
      const { container } = render(<SuggestPlaceButton />);
      const skeleton = container.querySelector(".animate-pulse");
      expect(skeleton).toBeInTheDocument();
    });

    it("applies custom className to loading skeleton", () => {
      mockIsLoading = true;
      const { container } = render(<SuggestPlaceButton className="custom-class" />);
      const skeleton = container.querySelector(".animate-pulse");
      expect(skeleton).toHaveClass("custom-class");
    });
  });

  describe("unauthenticated state", () => {
    it("renders button prompting sign in when user is not authenticated", () => {
      mockUser = null;
      render(<SuggestPlaceButton />);
      const button = screen.getByRole("button", { name: "Sign in to suggest" });
      expect(button).toBeInTheDocument();
    });

    it("calls signInWithGoogle when clicking unauthenticated button", () => {
      mockUser = null;
      render(<SuggestPlaceButton />);
      fireEvent.click(screen.getByRole("button", { name: "Sign in to suggest" }));
      expect(mockSignInWithGoogle).toHaveBeenCalled();
    });

    it("stops event propagation on click", () => {
      mockUser = null;
      const parentHandler = vi.fn();
      render(
        <div onClick={parentHandler}>
          <SuggestPlaceButton />
        </div>
      );
      fireEvent.click(screen.getByRole("button", { name: "Sign in to suggest" }));
      expect(parentHandler).not.toHaveBeenCalled();
    });

    it("renders Lightbulb icon with muted color", () => {
      mockUser = null;
      const { container } = render(<SuggestPlaceButton />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveClass("text-white/60");
    });
  });

  describe("authenticated state", () => {
    beforeEach(() => {
      mockUser = { id: "user-123" };
    });

    it("renders button to open dialog when user is authenticated", () => {
      render(<SuggestPlaceButton />);
      const button = screen.getByRole("button", { name: "Suggest a place" });
      expect(button).toBeInTheDocument();
    });

    it("opens dialog when clicking authenticated button", () => {
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

    it("renders Lightbulb icon with full color", () => {
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
