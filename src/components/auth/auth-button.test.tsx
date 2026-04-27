import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AuthButton } from "./auth-button";
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
const mockSignOut = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(() => ({
    user: null,
    isLoading: false,
    signInWithGoogle: mockSignInWithGoogle,
    signOut: mockSignOut,
  })),
}));

import { useAuth } from "@/hooks/use-auth";
const mockUseAuth = vi.mocked(useAuth);

describe("AuthButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      isLoading: false,
      signInWithGoogle: mockSignInWithGoogle,
      signOut: mockSignOut,
    });
  });

  describe("loading state", () => {
    it("should show loading skeleton when isLoading is true", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        session: null,
        isLoading: true,
        signInWithGoogle: mockSignInWithGoogle,
        signOut: mockSignOut,
      });

      render(<AuthButton />);

      const skeleton = document.querySelector(".animate-pulse");
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe("signed out state", () => {
    it("should show sign in button when user is null", () => {
      render(<AuthButton />);

      expect(screen.getByRole("button", { name: mockT("auth.sign_in") })).toBeInTheDocument();
    });

    it("should call signInWithGoogle when clicking sign in button", () => {
      render(<AuthButton />);

      fireEvent.click(screen.getByRole("button", { name: mockT("auth.sign_in") }));

      expect(mockSignInWithGoogle).toHaveBeenCalled();
    });

    it("should stop event propagation on click", () => {
      const parentHandler = vi.fn();
      render(
        <div onClick={parentHandler}>
          <AuthButton />
        </div>
      );

      fireEvent.click(screen.getByRole("button", { name: mockT("auth.sign_in") }));

      expect(parentHandler).not.toHaveBeenCalled();
    });
  });

  describe("signed in state", () => {
    const mockUser = {
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
      avatarUrl: "https://example.com/avatar.jpg",
    };

    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        session: { access_token: "token" } as never,
        isLoading: false,
        signInWithGoogle: mockSignInWithGoogle,
        signOut: mockSignOut,
      });
    });

    it("should show user avatar when user has avatarUrl", () => {
      render(<AuthButton />);

      const avatar = screen.getByAltText("Test User");
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute("src", "https://example.com/avatar.jpg");
    });

    it("should show first letter of name when no avatar", () => {
      mockUseAuth.mockReturnValue({
        user: { ...mockUser, avatarUrl: null },
        session: { access_token: "token" } as never,
        isLoading: false,
        signInWithGoogle: mockSignInWithGoogle,
        signOut: mockSignOut,
      });

      render(<AuthButton />);

      expect(screen.getByText("T")).toBeInTheDocument();
    });

    it("should show first letter of email when no name or avatar", () => {
      mockUseAuth.mockReturnValue({
        user: { ...mockUser, name: null, avatarUrl: null },
        session: { access_token: "token" } as never,
        isLoading: false,
        signInWithGoogle: mockSignInWithGoogle,
        signOut: mockSignOut,
      });

      render(<AuthButton />);

      expect(screen.getByText("T")).toBeInTheDocument(); // First letter of test@example.com
    });

    it("should show 'U' fallback when no name, email, or avatar", () => {
      mockUseAuth.mockReturnValue({
        user: { ...mockUser, name: null, email: null, avatarUrl: null },
        session: { access_token: "token" } as never,
        isLoading: false,
        signInWithGoogle: mockSignInWithGoogle,
        signOut: mockSignOut,
      });

      render(<AuthButton />);

      expect(screen.getByText("U")).toBeInTheDocument();
    });

    it("should toggle dropdown when clicking avatar", () => {
      render(<AuthButton />);

      // Initially dropdown is closed
      expect(screen.queryByText(mockT("auth.sign_out"))).not.toBeInTheDocument();

      // Click avatar to open dropdown
      fireEvent.click(screen.getByAltText("Test User"));

      // Dropdown should be open
      expect(screen.getByText("Test User")).toBeInTheDocument();
      expect(screen.getByText("test@example.com")).toBeInTheDocument();
      expect(screen.getByText(mockT("auth.sign_out"))).toBeInTheDocument();
    });

    it("should close dropdown when clicking outside", () => {
      render(<AuthButton />);

      // Open dropdown
      fireEvent.click(screen.getByAltText("Test User"));
      expect(screen.getByText(mockT("auth.sign_out"))).toBeInTheDocument();

      // Click backdrop to close
      const backdrop = document.querySelector(".fixed.inset-0.z-40");
      expect(backdrop).toBeTruthy();
      fireEvent.click(backdrop!);

      expect(screen.queryByText(mockT("auth.sign_out"))).not.toBeInTheDocument();
    });

    it("should call signOut when clicking sign out button", () => {
      render(<AuthButton />);

      // Open dropdown
      fireEvent.click(screen.getByAltText("Test User"));

      // Click sign out
      fireEvent.click(screen.getByText(mockT("auth.sign_out")));

      expect(mockSignOut).toHaveBeenCalled();
    });

    it("should stop propagation when clicking dropdown content area", () => {
      const parentHandler = vi.fn();
      render(
        <div onClick={parentHandler}>
          <AuthButton />
        </div>
      );

      // Open dropdown
      fireEvent.click(screen.getByAltText("Test User"));

      // Click on the dropdown content area (not a button)
      const dropdownContent = screen.getByText("test@example.com").closest(
        ".absolute.right-0"
      );
      expect(dropdownContent).toBeTruthy();
      fireEvent.click(dropdownContent!);

      // Parent should not receive the click (stopPropagation)
      expect(parentHandler).not.toHaveBeenCalled();
    });

    it("should show Usuario when user has no name", () => {
      mockUseAuth.mockReturnValue({
        user: { ...mockUser, name: null },
        session: { access_token: "token" } as never,
        isLoading: false,
        signInWithGoogle: mockSignInWithGoogle,
        signOut: mockSignOut,
      });

      render(<AuthButton />);

      // Open dropdown
      const avatar = screen.getByAltText("Avatar del usuario");
      fireEvent.click(avatar);

      expect(screen.getByText(mockT("auth.user"))).toBeInTheDocument();
    });
  });

  describe("custom className", () => {
    it("should apply custom className", () => {
      const { container } = render(<AuthButton className="custom-class" />);

      expect(container.firstChild).toHaveClass("custom-class");
    });
  });
});
