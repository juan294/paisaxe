import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SiteInfoMenu } from "./site-info-menu";
import { createMockT } from "@/test/i18n-mock";

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

    it("shows user avatar as trigger", () => {
      render(<SiteInfoMenu />);
      const avatar = screen.getByAltText("Test User");
      expect(avatar).toHaveAttribute("src", "https://example.com/avatar.jpg");
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
