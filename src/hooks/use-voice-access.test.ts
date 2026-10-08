import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useVoiceAccess } from "./use-voice-access";

const mockUseAuth = vi.fn();
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseVisitorVoiceAccess = vi.fn();
vi.mock("@/hooks/use-visitor-voice-access", () => ({
  useVisitorVoiceAccess: () => mockUseVisitorVoiceAccess(),
}));

vi.mock("@/config/elevenlabs-agents", () => ({
  ELEVENLABS_AGENT_IDS: {
    pelayo: "agent_mock_pelayo_id",
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("useVoiceAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      isLoading: false,
    });

    mockUseVisitorVoiceAccess.mockReturnValue({
      featureEnabled: false,
      needsSignIn: false,
      isLoading: false,
    });

    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Unauthorized" }),
    });
  });

  it("budget fixture: initial paid check plus six explicit refreshes emits seven reads, without polling", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "fixture-user" }, session: { access_token: "fixture-token" }, isLoading: false });
    mockUseVisitorVoiceAccess.mockReturnValue({ featureEnabled: true, needsSignIn: false, isLoading: false });
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ hasAccess: true, expiresAt: null, purchaseType: "day_pass" }) });
    const { result } = renderHook(() => useVoiceAccess());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    for (let i = 0; i < 6; i++) await act(async () => { await result.current.refresh(); });
    expect(mockFetch.mock.calls.filter(([url]) => url === "/api/voice-access")).toHaveLength(7);
  });

  it("429 preserves confirmed paid access, exposes retry seconds and recovers without a purchase prompt", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "paid" }, session: { access_token: "paid-token" }, isLoading: false });
    mockUseVisitorVoiceAccess.mockReturnValue({ featureEnabled: true, needsSignIn: false, isLoading: false });
    mockFetch.mockResolvedValueOnce(Response.json({ hasAccess: true, expiresAt: "2099-01-01T00:00:00Z", purchaseType: "day_pass" }));
    const { result } = renderHook(() => useVoiceAccess());
    await waitFor(() => expect(result.current.hasAccess).toBe(true));
    mockFetch.mockResolvedValueOnce(Response.json({}, { status: 429, headers: { "Retry-After": "17" } }));
    await act(async () => { await result.current.refresh(); });
    expect(result.current.hasAccess).toBe(true);
    expect(result.current.needsPurchase).toBe(false);
    expect(result.current.retryAfter).toBe(17);
    mockFetch.mockResolvedValueOnce(Response.json({ hasAccess: true, expiresAt: "2099-01-01T00:00:00Z", purchaseType: "day_pass" }));
    await act(async () => { await result.current.refresh(); });
    expect(result.current.retryAfter).toBeNull();
    expect(result.current.hasAccess).toBe(true);
  });

  it("confirmed grant never carries across token changes or past expiry", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "paid" }, session: { access_token: "paid-token" }, isLoading: false });
    mockUseVisitorVoiceAccess.mockReturnValue({ featureEnabled: true, needsSignIn: false, isLoading: false });
    mockFetch.mockResolvedValueOnce(Response.json({ hasAccess: true, expiresAt: "2099-01-01T00:00:00Z", purchaseType: "day_pass" }));
    const { result, rerender } = renderHook(() => useVoiceAccess());
    await waitFor(() => expect(result.current.hasAccess).toBe(true));
    mockUseAuth.mockReturnValue({ user: { id: "paid" }, session: { access_token: "changed-token" }, isLoading: false });
    mockFetch.mockResolvedValueOnce(Response.json({}, { status: 429, headers: { "Retry-After": "5" } }));
    rerender();
    await waitFor(() => expect(result.current.retryAfter).toBe(5));
    expect(result.current.hasAccess).toBe(false);
    mockFetch.mockResolvedValueOnce(Response.json({ hasAccess: true, expiresAt: new Date(Date.now() - 1000).toISOString(), purchaseType: "day_pass" }));
    await act(async () => { await result.current.refresh(); });
    expect(result.current.hasAccess).toBe(false);
  });

  it("an initially rate-limited access check does not classify unknown access as needing purchase", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "paid" }, session: { access_token: "paid-token" }, isLoading: false });
    mockUseVisitorVoiceAccess.mockReturnValue({ featureEnabled: true, needsSignIn: false, isLoading: false });
    mockFetch.mockResolvedValue(Response.json({}, { status: 429, headers: { "Retry-After": "9" } }));
    const { result } = renderHook(() => useVoiceAccess());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.needsPurchase).toBe(false);
    expect(result.current.hasAccess).toBe(false);
    expect(result.current.retryAfter).toBe(9);
  });

  it("treats anonymous users as resolved even if visitor state is still loading", () => {
    mockUseVisitorVoiceAccess.mockReturnValue({
      featureEnabled: true,
      needsSignIn: false,
      isLoading: true,
    });

    const { result } = renderHook(() => useVoiceAccess());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.canUseVoice).toBe(false);
  });

  it("returns isLoading true while a signed-in user is still checking paid access", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", email: "test@example.com" },
      session: { access_token: "token-123" },
      isLoading: false,
    });
    mockUseVisitorVoiceAccess.mockReturnValue({
      featureEnabled: true,
      needsSignIn: false,
      isLoading: false,
    });
    mockFetch.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useVoiceAccess());

    expect(result.current.isLoading).toBe(true);
  });

  it("returns needsSignIn when the feature is enabled for anonymous users", () => {
    mockUseVisitorVoiceAccess.mockReturnValue({
      featureEnabled: true,
      needsSignIn: true,
      isLoading: false,
    });

    const { result } = renderHook(() => useVoiceAccess());

    expect(result.current.needsSignIn).toBe(true);
    expect(result.current.canUseVoice).toBe(false);
  });

  it("returns paid access with the public Pelayo agent only", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", email: "paid@example.com" },
      session: { access_token: "token-123" },
      isLoading: false,
    });
    mockUseVisitorVoiceAccess.mockReturnValue({
      featureEnabled: true,
      needsSignIn: false,
      isLoading: false,
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        hasAccess: true,
        expiresAt: "2099-03-01T00:00:00Z",
        purchaseType: "day_pass",
      }),
    });

    const { result } = renderHook(() => useVoiceAccess());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.canUseVoice).toBe(true);
    expect(result.current.hasAccess).toBe(true);
    expect(result.current.isWhitelisted).toBe(false);
    expect(result.current.agentId).toBe("agent_mock_pelayo_id");
  });

  it("returns needsPurchase when a signed-in user has no paid access", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", email: "noaccess@example.com" },
      session: { access_token: "token-123" },
      isLoading: false,
    });
    mockUseVisitorVoiceAccess.mockReturnValue({
      featureEnabled: true,
      needsSignIn: false,
      isLoading: false,
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        hasAccess: false,
        expiresAt: null,
        purchaseType: null,
      }),
    });

    const { result } = renderHook(() => useVoiceAccess());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.needsPurchase).toBe(true);
    expect(result.current.canUseVoice).toBe(false);
    expect(result.current.agentId).toBe("");
  });

  it("sets no paid access when the API returns a non-ok status (line 62)", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", email: "test@example.com" },
      session: { access_token: "token-123" },
      isLoading: false,
    });
    mockUseVisitorVoiceAccess.mockReturnValue({
      featureEnabled: true,
      needsSignIn: false,
      isLoading: false,
    });
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Unauthorized" }),
    });

    const { result } = renderHook(() => useVoiceAccess());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasAccess).toBe(false);
    expect(result.current.canUseVoice).toBe(false);
    expect(result.current.needsPurchase).toBe(true);
  });

  it("handles fetch errors gracefully", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", email: "test@example.com" },
      session: { access_token: "token-123" },
      isLoading: false,
    });
    mockUseVisitorVoiceAccess.mockReturnValue({
      featureEnabled: true,
      needsSignIn: false,
      isLoading: false,
    });
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useVoiceAccess());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasAccess).toBe(false);
    expect(result.current.canUseVoice).toBe(false);
    expect(result.current.agentId).toBe("");
  });
});
