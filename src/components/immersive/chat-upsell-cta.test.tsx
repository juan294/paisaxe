import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatUpsellCTA } from "./chat-upsell-cta";
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

// Mock useAuth
const mockSignInWithGoogle = vi.fn();
const mockAuthValues = {
  user: null as { id: string; email: string } | null,
  session: null as { access_token: string } | null,
  isLoading: false,
  signInWithGoogle: mockSignInWithGoogle,
  signOut: vi.fn(),
};

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockAuthValues,
}));

describe("ChatUpsellCTA", () => {
  const defaultProps = {
    reason: "weather" as const,
    onDismiss: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthValues.user = null;
    mockAuthValues.session = null;
    global.fetch = vi.fn();
  });

  it("renders the upsell CTA with reason-specific messaging", () => {
    render(<ChatUpsellCTA {...defaultProps} />);

    expect(screen.getByText("upsell.weather_title")).toBeInTheDocument();
    expect(screen.getByText("upsell.weather_subtitle")).toBeInTheDocument();
  });

  it("renders the purchase button with price", () => {
    render(<ChatUpsellCTA {...defaultProps} />);

    expect(screen.getByRole("button", { name: /1\.99/ })).toBeInTheDocument();
  });

  it("calls onDismiss when dismiss button is clicked", async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();

    render(<ChatUpsellCTA {...defaultProps} onDismiss={onDismiss} />);

    await user.click(screen.getByLabelText("Cerrar"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("triggers sign in when user is not logged in", async () => {
    const user = userEvent.setup();
    render(<ChatUpsellCTA {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /1\.99/ }));

    expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it("initiates checkout when user is logged in", async () => {
    mockAuthValues.user = { id: "user-1", email: "test@example.com" };
    mockAuthValues.session = { access_token: "token-123" };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: "https://checkout.stripe.com/session" }),
    });
    global.fetch = mockFetch;

    const user = userEvent.setup();
    render(<ChatUpsellCTA {...defaultProps} />);

    // Mock window.location
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, href: "" },
      writable: true,
      configurable: true,
    });

    await user.click(screen.getByRole("button", { name: /1\.99/ }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/checkout/day-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    });

    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it("handles checkout error gracefully", async () => {
    mockAuthValues.user = { id: "user-1", email: "test@example.com" };
    mockAuthValues.session = { access_token: "token-123" };

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<ChatUpsellCTA {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /1\.99/ }));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });

  it("renders with different upsell reasons", () => {
    const { rerender } = render(<ChatUpsellCTA reason="booking" onDismiss={vi.fn()} />);
    expect(screen.getByText("upsell.booking_title")).toBeInTheDocument();

    rerender(<ChatUpsellCTA reason="realtime" onDismiss={vi.fn()} />);
    expect(screen.getByText("upsell.realtime_title")).toBeInTheDocument();

    rerender(<ChatUpsellCTA reason="slow_typing" onDismiss={vi.fn()} />);
    expect(screen.getByText("upsell.slow_typing_title")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <ChatUpsellCTA {...defaultProps} className="custom-class" />
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });
});
