import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SignInPrompt } from "./sign-in-prompt";

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

      expect(screen.queryByText("Sincroniza tus favoritos")).not.toBeInTheDocument();
    });

    it("should render when open is true", () => {
      render(<SignInPrompt {...defaultProps} />);

      expect(screen.getByText("Sincroniza tus favoritos")).toBeInTheDocument();
    });
  });

  describe("content", () => {
    it("should display title", () => {
      render(<SignInPrompt {...defaultProps} />);

      expect(screen.getByText("Sincroniza tus favoritos")).toBeInTheDocument();
    });

    it("should display description", () => {
      render(<SignInPrompt {...defaultProps} />);

      expect(screen.getByText(/Inicia sesion para guardar tus favoritos/)).toBeInTheDocument();
    });

    it("should display Google sign in button", () => {
      render(<SignInPrompt {...defaultProps} />);

      expect(screen.getByText("Continuar con Google")).toBeInTheDocument();
    });

    it("should display dismiss button", () => {
      render(<SignInPrompt {...defaultProps} />);

      expect(screen.getByText("Quiza mas tarde")).toBeInTheDocument();
    });
  });

  describe("interactions", () => {
    it("should call signInWithGoogle and onClose when clicking Google button", () => {
      render(<SignInPrompt {...defaultProps} />);

      fireEvent.click(screen.getByText("Continuar con Google"));

      expect(mockSignInWithGoogle).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("should call onClose when clicking dismiss button", () => {
      render(<SignInPrompt {...defaultProps} />);

      fireEvent.click(screen.getByText("Quiza mas tarde"));

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("should call onClose when clicking backdrop", () => {
      render(<SignInPrompt {...defaultProps} />);

      const backdrop = document.querySelector(".fixed.inset-0.z-50");
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("should not close when clicking modal content", () => {
      render(<SignInPrompt {...defaultProps} />);

      const modalContent = screen.getByText("Sincroniza tus favoritos").closest("div");
      if (modalContent) {
        fireEvent.click(modalContent);
      }

      // onClose should only be called once from the backdrop click setup, not from modal content
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it("should call onClose when clicking close button", () => {
      render(<SignInPrompt {...defaultProps} />);

      const closeButton = screen.getByLabelText("Cerrar");
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
});
