import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useVoiceAccess } from "./use-voice-access";

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock useVisitorVoiceAccess
const mockUseVisitorVoiceAccess = vi.fn();
vi.mock("@/hooks/use-visitor-voice-access", () => ({
  useVisitorVoiceAccess: () => mockUseVisitorVoiceAccess(),
}));

// Mock elevenlabs agent IDs
vi.mock("@/config/elevenlabs-agents", () => ({
  ELEVENLABS_AGENT_IDS: {
    pelayo: "agent_mock_pelayo_id",
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("useVoiceAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: not authenticated, visitor access denied, flags ready
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      isLoading: false,
    });

    mockUseVisitorVoiceAccess.mockReturnValue({
      canUseVoice: false,
      needsSignIn: false,
      agentId: "",
      userEmail: null,
      isLoading: false,
    });

    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Unauthorized" }),
    });
  });

  describe("loading states", () => {
    it("returns isLoading true when auth is loading", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        session: null,
        isLoading: true,
      });

      const { result } = renderHook(() => useVoiceAccess());
      expect(result.current.isLoading).toBe(true);
    });

    it("returns isLoading true when visitor access is loading", () => {
      mockUseVisitorVoiceAccess.mockReturnValue({
        canUseVoice: false,
        needsSignIn: false,
        agentId: "",
        userEmail: null,
        isLoading: true,
      });

      const { result } = renderHook(() => useVoiceAccess());
      expect(result.current.isLoading).toBe(true);
    });

    it("returns isLoading true while user exists but paid access not yet checked", () => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-1", email: "test@example.com" },
        session: { access_token: "token-123" },
        isLoading: false,
      });

      // fetch never resolves during this check
      mockFetch.mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useVoiceAccess());
      expect(result.current.isLoading).toBe(true);
    });

    it("returns isLoading false when all checks complete and no user", () => {
      const { result } = renderHook(() => useVoiceAccess());

      // No user, so paid access check is skipped, and everything resolves immediately
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("access granted scenarios", () => {
    it("returns canUseVoice true when visitor is whitelisted", () => {
      mockUseVisitorVoiceAccess.mockReturnValue({
        canUseVoice: true,
        needsSignIn: false,
        agentId: "agent-whitelist-123",
        userEmail: "whitelisted@example.com",
        isLoading: false,
      });

      const { result } = renderHook(() => useVoiceAccess());

      expect(result.current.canUseVoice).toBe(true);
      expect(result.current.isWhitelisted).toBe(true);
      expect(result.current.agentId).toBe("agent-whitelist-123");
    });

    it("returns canUseVoice true when user has paid access", async () => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-1", email: "paid@example.com" },
        session: { access_token: "token-123" },
        isLoading: false,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          hasAccess: true,
          expiresAt: "2026-03-01T00:00:00Z",
          purchaseType: "day_pass",
        }),
      });

      const { result } = renderHook(() => useVoiceAccess());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canUseVoice).toBe(true);
      expect(result.current.hasAccess).toBe(true);
      expect(result.current.expiresAt).toBeInstanceOf(Date);
      expect(result.current.agentId).toBe("agent_mock_pelayo_id");
    });
  });

  describe("access denied scenarios", () => {
    it("returns canUseVoice false when not signed in and no whitelist", () => {
      const { result } = renderHook(() => useVoiceAccess());

      expect(result.current.canUseVoice).toBe(false);
      expect(result.current.hasAccess).toBe(false);
      expect(result.current.isWhitelisted).toBe(false);
    });

    it("returns needsPurchase true when signed in but no access", async () => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-1", email: "noaccess@example.com" },
        session: { access_token: "token-123" },
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
    });

    it("returns needsSignIn true when feature enabled but user not signed in", () => {
      mockUseVisitorVoiceAccess.mockReturnValue({
        canUseVoice: false,
        needsSignIn: true,
        agentId: "agent-123",
        userEmail: null,
        isLoading: false,
      });

      const { result } = renderHook(() => useVoiceAccess());
      expect(result.current.needsSignIn).toBe(true);
    });
  });

  describe("error handling", () => {
    it("handles fetch errors gracefully", async () => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-1", email: "test@example.com" },
        session: { access_token: "token-123" },
        isLoading: false,
      });

      mockFetch.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useVoiceAccess());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasAccess).toBe(false);
      expect(result.current.canUseVoice).toBe(false);
    });

    it("handles non-ok response gracefully", async () => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-1", email: "test@example.com" },
        session: { access_token: "token-123" },
        isLoading: false,
      });

      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Server error" }),
      });

      const { result } = renderHook(() => useVoiceAccess());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasAccess).toBe(false);
    });
  });

  describe("expiry calculations", () => {
    it("returns null expiresAt and hoursUntilExpiry when no paid access", () => {
      const { result } = renderHook(() => useVoiceAccess());

      expect(result.current.expiresAt).toBeNull();
      expect(result.current.hoursUntilExpiry).toBeNull();
    });

    it("calculates hoursUntilExpiry correctly", async () => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-1", email: "paid@example.com" },
        session: { access_token: "token-123" },
        isLoading: false,
      });

      // Set expiry 12 hours from now
      const futureDate = new Date(Date.now() + 12 * 60 * 60 * 1000);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          hasAccess: true,
          expiresAt: futureDate.toISOString(),
          purchaseType: "day_pass",
        }),
      });

      const { result } = renderHook(() => useVoiceAccess());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hoursUntilExpiry).not.toBeNull();
      // Should be approximately 12 hours (allow some tolerance for test execution time)
      expect(result.current.hoursUntilExpiry!).toBeGreaterThan(11.9);
      expect(result.current.hoursUntilExpiry!).toBeLessThanOrEqual(12);
    });
  });

  describe("agentId resolution", () => {
    it("uses visitor access agentId when available", () => {
      mockUseVisitorVoiceAccess.mockReturnValue({
        canUseVoice: true,
        needsSignIn: false,
        agentId: "agent-visitor-custom",
        userEmail: "test@example.com",
        isLoading: false,
      });

      const { result } = renderHook(() => useVoiceAccess());
      expect(result.current.agentId).toBe("agent-visitor-custom");
    });

    it("uses Pelayo agent ID for paid users without visitor agentId", async () => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-1", email: "paid@example.com" },
        session: { access_token: "token-123" },
        isLoading: false,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          hasAccess: true,
          expiresAt: "2026-03-01T00:00:00Z",
          purchaseType: "day_pass",
        }),
      });

      const { result } = renderHook(() => useVoiceAccess());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.agentId).toBe("agent_mock_pelayo_id");
    });

    it("returns empty agentId when no access at all", () => {
      const { result } = renderHook(() => useVoiceAccess());
      expect(result.current.agentId).toBe("");
    });
  });

  describe("refresh", () => {
    it("provides a refresh function", () => {
      const { result } = renderHook(() => useVoiceAccess());
      expect(typeof result.current.refresh).toBe("function");
    });
  });
});
