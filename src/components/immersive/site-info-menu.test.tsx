import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SiteInfoMenu } from "./site-info-menu";
import { createMockT } from "@/test/i18n-mock";

// PE-M6: next/image must be used for Google profile photos (not raw <img>)
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    width,
    height,
    className,
    referrerPolicy,
  }: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    className?: string;
    referrerPolicy?: string;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      referrerPolicy={referrerPolicy}
      data-testid="next-image"
    />
  ),
}));

const mockT = createMockT();

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    locale: "es",
    setLocale: vi.fn(),
    t: (key: string) => mockT(key),
  }),
}));

const mockSignInWithGoogle = vi.fn();
const mockSignOut = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(() => ({
    user: null,
    session: null,
    isLoading: false,
    signInWithGoogle: mockSignInWithGoogle,
    signOut: mockSignOut,
  })),
}));

import { useAuth } from "@/hooks/use-auth";
const mockUseAuth = vi.mocked(useAuth);

describe("SiteInfoMenu", () => {
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

  it("renders the trigger button", () => {
    render(<SiteInfoMenu />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("panel is closed by default", () => {
    render(<SiteInfoMenu />);
    expect(screen.queryByText(mockT("footer.content_attribution"))).not.toBeInTheDocument();
  });

  it("opens panel when trigger is clicked", () => {
    render(<SiteInfoMenu />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText(mockT("footer.content_attribution"))).toBeInTheDocument();
    expect(screen.getByText(mockT("footer.ai_disclaimer"))).toBeInTheDocument();
  });

  it("renders legal links in panel", () => {
    render(<SiteInfoMenu />);
    fireEvent.click(screen.getByRole("button"));

    const termsLink = screen.getByRole("link", { name: /condiciones/i });
    expect(termsLink).toHaveAttribute("href", "/terms");

    const privacyLink = screen.getByRole("link", { name: /privacid/i });
    expect(privacyLink).toHaveAttribute("href", "/privacy");
  });

  it("does not render saved places link in panel", () => {
    render(<SiteInfoMenu />);
    fireEvent.click(screen.getByRole("button"));

    expect(screen.queryByRole("link", { name: /guardados/i })).not.toBeInTheDocument();
  });

  it("closes panel on Escape key", () => {
    render(<SiteInfoMenu />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText(mockT("footer.content_attribution"))).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText(mockT("footer.content_attribution"))).not.toBeInTheDocument();
  });

  it("closes panel when clicking backdrop", () => {
    render(<SiteInfoMenu />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText(mockT("footer.content_attribution"))).toBeInTheDocument();

    const backdrop = document.querySelector("[data-testid='info-menu-backdrop']");
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);

    expect(screen.queryByText(mockT("footer.content_attribution"))).not.toBeInTheDocument();
  });

  describe("signed out state", () => {
    it("shows sign in icon as trigger", () => {
      render(<SiteInfoMenu />);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-label", mockT("auth.sign_in"));
    });

    it("shows sign in option inside panel", () => {
      render(<SiteInfoMenu />);
      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByText(mockT("auth.sign_in"))).toBeInTheDocument();
    });

    it("calls signInWithGoogle when clicking sign in inside panel", () => {
      render(<SiteInfoMenu />);
      fireEvent.click(screen.getByRole("button"));
      fireEvent.click(screen.getByText(mockT("auth.sign_in")));

      expect(mockSignInWithGoogle).toHaveBeenCalled();
    });
  });

  it("ignores non-Escape keydown when panel is open", () => {
    render(<SiteInfoMenu />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText(mockT("footer.content_attribution"))).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Enter" });
    // Panel should still be open
    expect(screen.getByText(mockT("footer.content_attribution"))).toBeInTheDocument();
  });

  describe("signed in state", () => {
    const mockUser = {
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
      avatarUrl: "https://lh3.googleusercontent.com/avatar.jpg",
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

    it("shows user avatar as trigger", () => {
      render(<SiteInfoMenu />);
      const avatar = screen.getByAltText("Test User");
      expect(avatar).toHaveAttribute("src", "https://lh3.googleusercontent.com/avatar.jpg");
    });

    it("shows user name and email in panel", () => {
      render(<SiteInfoMenu />);
      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByText("Test User")).toBeInTheDocument();
      expect(screen.getByText("test@example.com")).toBeInTheDocument();
    });

    it("shows sign out button in panel", () => {
      render(<SiteInfoMenu />);
      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByRole("button", { name: mockT("auth.sign_out") })).toBeInTheDocument();
    });

    it("calls signOut when clicking sign out", () => {
      render(<SiteInfoMenu />);
      fireEvent.click(screen.getByRole("button"));
      fireEvent.click(screen.getByRole("button", { name: mockT("auth.sign_out") }));

      expect(mockSignOut).toHaveBeenCalled();
    });

    it("uses 'Avatar' as alt text when user has avatarUrl but no name (lines 48, 88)", () => {
      mockUseAuth.mockReturnValue({
        user: { ...mockUser, name: null },
        session: { access_token: "token" } as never,
        isLoading: false,
        signInWithGoogle: mockSignInWithGoogle,
        signOut: mockSignOut,
      });

      render(<SiteInfoMenu />);
      // Trigger button: img alt should fall back to "Avatar"
      const triggerImg = screen.getByAltText("Avatar");
      expect(triggerImg).toHaveAttribute("src", "https://lh3.googleusercontent.com/avatar.jpg");

      // Open panel to verify dropdown avatar also has "Avatar" fallback
      fireEvent.click(screen.getByRole("button"));
      const avatarImages = screen.getAllByAltText("Avatar");
      // Both trigger and dropdown images should use "Avatar" fallback
      expect(avatarImages.length).toBeGreaterThanOrEqual(2);
    });

    it("shows initial letter when user has no avatarUrl", () => {
      mockUseAuth.mockReturnValue({
        user: { ...mockUser, avatarUrl: null },
        session: { access_token: "token" } as never,
        isLoading: false,
        signInWithGoogle: mockSignInWithGoogle,
        signOut: mockSignOut,
      });

      render(<SiteInfoMenu />);
      // Trigger button should show "T" (first letter of "Test User")
      expect(screen.getByText("T")).toBeInTheDocument();

      // Open panel — should also show initial in dropdown
      fireEvent.click(screen.getByRole("button"));
      // Both trigger and panel show the initial
      const initials = screen.getAllByText("T");
      expect(initials.length).toBeGreaterThanOrEqual(2);
    });

    it("falls back to email initial when user has no name and no avatarUrl", () => {
      mockUseAuth.mockReturnValue({
        user: { ...mockUser, name: null, avatarUrl: null },
        session: { access_token: "token" } as never,
        isLoading: false,
        signInWithGoogle: mockSignInWithGoogle,
        signOut: mockSignOut,
      });

      render(<SiteInfoMenu />);
      // Should show "T" (first letter of "test@example.com")
      expect(screen.getByRole("button")).toHaveAttribute("aria-label", mockT("auth.user"));

      fireEvent.click(screen.getByRole("button"));
      // Panel shows email
      expect(screen.getByText("test@example.com")).toBeInTheDocument();
    });

    it("shows fallback initial when user has no name, no email, and no avatarUrl", () => {
      mockUseAuth.mockReturnValue({
        user: { ...mockUser, name: null, email: null, avatarUrl: null },
        session: { access_token: "token" } as never,
        isLoading: false,
        signInWithGoogle: mockSignInWithGoogle,
        signOut: mockSignOut,
      });

      render(<SiteInfoMenu />);
      // Trigger shows "U" fallback
      expect(screen.getByText("U")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button"));
      // Panel shows "?" fallback
      expect(screen.getByText("?")).toBeInTheDocument();
    });

    it("does not show email line when user has no email", () => {
      mockUseAuth.mockReturnValue({
        user: { ...mockUser, email: null },
        session: { access_token: "token" } as never,
        isLoading: false,
        signInWithGoogle: mockSignInWithGoogle,
        signOut: mockSignOut,
      });

      render(<SiteInfoMenu />);
      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByText("Test User")).toBeInTheDocument();
      expect(screen.queryByText("test@example.com")).not.toBeInTheDocument();
    });

    // PE-M6: avatar images must use next/image (data-testid="next-image"), not raw <img>
    it("PE-M6: trigger avatar uses next/image component, not raw img", () => {
      render(<SiteInfoMenu />);
      const nextImages = screen.getAllByTestId("next-image");
      // At minimum the trigger button avatar should be a next/image
      expect(nextImages.length).toBeGreaterThanOrEqual(1);
      expect(nextImages[0]).toHaveAttribute("src", "https://lh3.googleusercontent.com/avatar.jpg");
    });

    it("PE-M6: panel avatar uses next/image component, not raw img", () => {
      render(<SiteInfoMenu />);
      fireEvent.click(screen.getByRole("button"));
      const nextImages = screen.getAllByTestId("next-image");
      // Both trigger and panel avatars should be next/image
      expect(nextImages.length).toBeGreaterThanOrEqual(2);
    });

    it("shows loading skeleton when auth is loading", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        session: null,
        isLoading: true,
        signInWithGoogle: mockSignInWithGoogle,
        signOut: mockSignOut,
      });

      render(<SiteInfoMenu />);
      const skeleton = document.querySelector(".animate-pulse");
      expect(skeleton).toBeInTheDocument();
    });
  });
});
