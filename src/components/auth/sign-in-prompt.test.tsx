import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SignInPrompt } from "./sign-in-prompt";
import { createMockT } from "@/test/i18n-mock";

// Mock i18n
const mockT = createMockT();
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    locale: "es",
    setLocale: vi.fn(),
    t: (key: string) => mockT(key),
  }),
}));

// Mock the useAuth hook
const mockSignInWithGoogle = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(() => ({
    signInWithGoogle: mockSignInWithGoogle,
  })),
}));

describe("SignInPrompt", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("visibility", () => {
    it("should not render when open is false", () => {
      render(<SignInPrompt open={false} onClose={defaultProps.onClose} />);

      expect(screen.queryByText(mockT("auth.sync_favorites_title"))).not.toBeInTheDocument();
    });

    it("should render when open is true", () => {
      render(<SignInPrompt {...defaultProps} />);

      expect(screen.getByText(mockT("auth.sync_favorites_title"))).toBeInTheDocument();
    });
  });

  describe("content", () => {
    it("should display title", () => {
      render(<SignInPrompt {...defaultProps} />);

      expect(screen.getByText(mockT("auth.sync_favorites_title"))).toBeInTheDocument();
    });

    it("should display description", () => {
      render(<SignInPrompt {...defaultProps} />);

      expect(screen.getByText(new RegExp(mockT("auth.sync_favorites_description").slice(0, 30)))).toBeInTheDocument();
    });

    it("should display Google sign in button", () => {
      render(<SignInPrompt {...defaultProps} />);

      expect(screen.getByText(mockT("auth.continue_with_google"))).toBeInTheDocument();
    });

    it("should display dismiss button", () => {
      render(<SignInPrompt {...defaultProps} />);

      expect(screen.getByText(mockT("auth.maybe_later"))).toBeInTheDocument();
    });
  });

  describe("interactions", () => {
    it("should call signInWithGoogle and onClose when clicking Google button", () => {
      render(<SignInPrompt {...defaultProps} />);

      fireEvent.click(screen.getByText(mockT("auth.continue_with_google")));

      expect(mockSignInWithGoogle).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("should call onClose when clicking dismiss button", () => {
      render(<SignInPrompt {...defaultProps} />);

      fireEvent.click(screen.getByText(mockT("auth.maybe_later")));

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("should call onClose when clicking backdrop", () => {
      render(<SignInPrompt {...defaultProps} />);

      const backdrop = document.querySelector(".fixed.inset-0.z-50");
      expect(backdrop).toBeTruthy();
      fireEvent.click(backdrop!);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("should not close when clicking modal content", () => {
      render(<SignInPrompt {...defaultProps} />);

      const modalContent = screen.getByText(mockT("auth.sync_favorites_title")).closest("div");
      expect(modalContent).toBeTruthy();
      fireEvent.click(modalContent!);

      // onClose should only be called once from the backdrop click setup, not from modal content
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it("should call onClose when clicking close button", () => {
      render(<SignInPrompt {...defaultProps} />);

      const closeButton = screen.getByLabelText(mockT("common.close"));
      fireEvent.click(closeButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe("custom className", () => {
    it("should apply custom className to backdrop", () => {
      render(<SignInPrompt {...defaultProps} className="custom-class" />);

      const backdrop = document.querySelector(".fixed.inset-0.z-50");
      expect(backdrop).toHaveClass("custom-class");
    });
  });

  describe("accessibility (#181)", () => {
    it("has role='dialog' on the modal panel", () => {
      render(<SignInPrompt {...defaultProps} />);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
    });

    it("has aria-modal='true' on the modal panel", () => {
      render(<SignInPrompt {...defaultProps} />);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
    });
  });
});
