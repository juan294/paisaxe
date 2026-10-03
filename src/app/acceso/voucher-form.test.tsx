import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VoucherForm } from "./voucher-form";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockUseAuth = vi.fn();
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockSignInAnonymously = vi.fn();
vi.mock("@/lib/supabase-browser", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInAnonymously: mockSignInAnonymously } }),
}));

vi.mock("@/lib/csrf-client", () => ({
  csrfHeaders: () => ({ "x-csrf-token": "csrf-1" }),
}));

const clientLogger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }));
vi.mock("@/lib/client-logger", () => ({ clientLogger }));

const mockFetch = vi.fn();
global.fetch = mockFetch;

function submitCode(code = "itcode2026") {
  fireEvent.change(screen.getByLabelText("booking.access.codeLabel"), { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: "booking.access.submit" }));
}

describe("VoucherForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: null, session: null, isLoading: false });
    mockSignInAnonymously.mockResolvedValue({
      data: { session: { access_token: "anon-token" } },
      error: null,
    });
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
  });

  it("signs in anonymously when there is no user, then redeems with that session and opens the booking chat", async () => {
    render(<VoucherForm />);
    submitCode();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/immersive?booking=1"));
    expect(mockSignInAnonymously).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith("/api/booking/voucher/redeem", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer anon-token",
        "x-csrf-token": "csrf-1",
      },
      body: JSON.stringify({ code: "itcode2026" }),
    });
    expect(screen.getByText("booking.access.welcome")).toBeInTheDocument();
  });

  it("reuses an existing session (a Google user) without a guest sign-in", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "google-1", email: "a@b.c" },
      session: { access_token: "google-token" },
      isLoading: false,
    });
    render(<VoucherForm />);
    submitCode();

    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    expect(mockSignInAnonymously).not.toHaveBeenCalled();
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe("Bearer google-token");
  });

  it("shows anonFailed and logs [VOUCHER_ANON_SIGNIN_FAILED] when the guest sign-in fails", async () => {
    mockSignInAnonymously.mockResolvedValue({ data: { session: null }, error: new Error("Anonymous sign-ins are disabled") });
    render(<VoucherForm />);
    submitCode();

    expect(await screen.findByText("booking.access.anonFailed")).toBeInTheDocument();
    expect(clientLogger.error).toHaveBeenCalledWith("[VOUCHER_ANON_SIGNIN_FAILED]", expect.anything());
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it.each([
    [403, { reason: "invalid" }, "booking.access.invalid"],
    [403, { reason: "expired" }, "booking.access.expired"],
    [403, { reason: "exhausted" }, "booking.access.exhausted"],
    [429, {}, "booking.access.rateLimited"],
    [500, {}, "booking.access.failed"],
  ])("maps a %s response to its message", async (status, body, message) => {
    mockFetch.mockResolvedValue({ ok: false, status, json: async () => body });
    render(<VoucherForm />);
    submitCode();

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows the contact hint with a refused code", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403, json: async () => ({ reason: "invalid" }) });
    render(<VoucherForm />);
    submitCode();

    expect(await screen.findByText("booking.access.contactHint")).toBeInTheDocument();
  });

  it("cannot put the code in a URL: the form posts and the input has no name", () => {
    const { container } = render(<VoucherForm />);
    expect(container.querySelector("form")?.getAttribute("method")).toBe("post");
    expect(screen.getByLabelText("booking.access.codeLabel").getAttribute("name")).toBeNull();
  });

  it("waits for auth to load, so a Google session is never replaced by a guest one", () => {
    mockUseAuth.mockReturnValue({ user: null, session: null, isLoading: true });
    render(<VoucherForm />);
    expect(screen.getByRole("button", { name: "booking.access.submit" })).toBeDisabled();
  });

  it("shows failed when the request throws", async () => {
    mockFetch.mockRejectedValue(new Error("offline"));
    render(<VoucherForm />);
    submitCode();

    expect(await screen.findByText("booking.access.failed")).toBeInTheDocument();
  });
});
