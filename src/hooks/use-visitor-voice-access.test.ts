import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useVisitorVoiceAccess } from "./use-visitor-voice-access";
import type { FeatureFlag } from "@/types/feature-flags";

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock useFeatureFlags
const mockUseFeatureFlags = vi.fn();
vi.mock("@/hooks/use-feature-flags", () => ({
  useFeatureFlags: () => mockUseFeatureFlags(),
}));

function makeVisitorVoiceFlag(
  enabled: boolean,
  config: { whitelisted_emails: string[]; agent_id: string }
): FeatureFlag {
  return {
    id: "id-visitor-voice",
    flagKey: "visitor_voice_agent",
    enabled,
    label: "Visitor Voice Agent",
    description: "Enable voice for whitelisted visitors",
    config,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  };
}

describe("useVisitorVoiceAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when feature flag is disabled", () => {
    it("returns canUseVoice false and needsSignIn false", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
      });
      mockUseFeatureFlags.mockReturnValue({
        flags: [makeVisitorVoiceFlag(false, { whitelisted_emails: [], agent_id: "agent-123" })],
        isReady: true,
        isEnabled: () => false,
      });

      const { result } = renderHook(() => useVisitorVoiceAccess());

      expect(result.current.canUseVoice).toBe(false);
      expect(result.current.needsSignIn).toBe(false);
      // Agent ID is still returned from config even when disabled (for debugging)
      expect(result.current.agentId).toBe("agent-123");
    });
  });

  describe("when feature flag is enabled", () => {
    it("returns needsSignIn true when user is not authenticated", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
      });
      mockUseFeatureFlags.mockReturnValue({
        flags: [makeVisitorVoiceFlag(true, { whitelisted_emails: ["test@example.com"], agent_id: "agent-123" })],
        isReady: true,
        isEnabled: () => true,
      });

      const { result } = renderHook(() => useVisitorVoiceAccess());

      expect(result.current.canUseVoice).toBe(false);
      expect(result.current.needsSignIn).toBe(true);
      expect(result.current.agentId).toBe("agent-123");
      expect(result.current.userEmail).toBeNull();
    });

    it("returns canUseVoice false when user email is not whitelisted", () => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-1", email: "notwhitelisted@example.com" },
        isLoading: false,
      });
      mockUseFeatureFlags.mockReturnValue({
        flags: [makeVisitorVoiceFlag(true, { whitelisted_emails: ["whitelisted@example.com"], agent_id: "agent-123" })],
        isReady: true,
        isEnabled: () => true,
      });

      const { result } = renderHook(() => useVisitorVoiceAccess());

      expect(result.current.canUseVoice).toBe(false);
      expect(result.current.needsSignIn).toBe(false);
      expect(result.current.userEmail).toBe("notwhitelisted@example.com");
    });

    it("returns canUseVoice true when user email is whitelisted", () => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-1", email: "whitelisted@example.com" },
        isLoading: false,
      });
      mockUseFeatureFlags.mockReturnValue({
        flags: [makeVisitorVoiceFlag(true, { whitelisted_emails: ["whitelisted@example.com"], agent_id: "agent-123" })],
        isReady: true,
        isEnabled: () => true,
      });

      const { result } = renderHook(() => useVisitorVoiceAccess());

      expect(result.current.canUseVoice).toBe(true);
      expect(result.current.needsSignIn).toBe(false);
      expect(result.current.agentId).toBe("agent-123");
      expect(result.current.userEmail).toBe("whitelisted@example.com");
    });

    it("returns canUseVoice false when agent_id is not set", () => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-1", email: "whitelisted@example.com" },
        isLoading: false,
      });
      mockUseFeatureFlags.mockReturnValue({
        flags: [makeVisitorVoiceFlag(true, { whitelisted_emails: ["whitelisted@example.com"], agent_id: "" })],
        isReady: true,
        isEnabled: () => true,
      });

      const { result } = renderHook(() => useVisitorVoiceAccess());

      expect(result.current.canUseVoice).toBe(false);
      expect(result.current.agentId).toBe("");
    });

    it("handles case-insensitive email matching", () => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-1", email: "WhiteListed@Example.COM" },
        isLoading: false,
      });
      mockUseFeatureFlags.mockReturnValue({
        flags: [makeVisitorVoiceFlag(true, { whitelisted_emails: ["whitelisted@example.com"], agent_id: "agent-123" })],
        isReady: true,
        isEnabled: () => true,
      });

      const { result } = renderHook(() => useVisitorVoiceAccess());

      expect(result.current.canUseVoice).toBe(true);
    });

    it("handles multiple whitelisted emails", () => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-1", email: "user2@example.com" },
        isLoading: false,
      });
      mockUseFeatureFlags.mockReturnValue({
        flags: [makeVisitorVoiceFlag(true, {
          whitelisted_emails: ["user1@example.com", "user2@example.com", "user3@example.com"],
          agent_id: "agent-123"
        })],
        isReady: true,
        isEnabled: () => true,
      });

      const { result } = renderHook(() => useVisitorVoiceAccess());

      expect(result.current.canUseVoice).toBe(true);
    });
  });

  describe("loading states", () => {
    it("returns isLoading true when auth is loading", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
      });
      mockUseFeatureFlags.mockReturnValue({
        flags: [],
        isReady: true,
        isEnabled: () => false,
      });

      const { result } = renderHook(() => useVisitorVoiceAccess());

      expect(result.current.isLoading).toBe(true);
    });

    it("returns isLoading true when flags are not ready", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
      });
      mockUseFeatureFlags.mockReturnValue({
        flags: [],
        isReady: false,
        isEnabled: () => false,
      });

      const { result } = renderHook(() => useVisitorVoiceAccess());

      expect(result.current.isLoading).toBe(true);
    });

    it("returns isLoading false when both are loaded", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
      });
      mockUseFeatureFlags.mockReturnValue({
        flags: [],
        isReady: true,
        isEnabled: () => false,
      });

      const { result } = renderHook(() => useVisitorVoiceAccess());

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("handles missing feature flag gracefully", () => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-1", email: "test@example.com" },
        isLoading: false,
      });
      mockUseFeatureFlags.mockReturnValue({
        flags: [], // No flags
        isReady: true,
        isEnabled: () => false,
      });

      const { result } = renderHook(() => useVisitorVoiceAccess());

      expect(result.current.canUseVoice).toBe(false);
      expect(result.current.needsSignIn).toBe(false);
      expect(result.current.agentId).toBe("");
    });

    it("handles empty whitelist gracefully", () => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-1", email: "test@example.com" },
        isLoading: false,
      });
      mockUseFeatureFlags.mockReturnValue({
        flags: [makeVisitorVoiceFlag(true, { whitelisted_emails: [], agent_id: "agent-123" })],
        isReady: true,
        isEnabled: () => true,
      });

      const { result } = renderHook(() => useVisitorVoiceAccess());

      expect(result.current.canUseVoice).toBe(false);
      expect(result.current.needsSignIn).toBe(false);
    });

    it("handles null user email gracefully", () => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-1", email: null },
        isLoading: false,
      });
      mockUseFeatureFlags.mockReturnValue({
        flags: [makeVisitorVoiceFlag(true, { whitelisted_emails: ["test@example.com"], agent_id: "agent-123" })],
        isReady: true,
        isEnabled: () => true,
      });

      const { result } = renderHook(() => useVisitorVoiceAccess());

      expect(result.current.canUseVoice).toBe(false);
      expect(result.current.needsSignIn).toBe(false);
      expect(result.current.userEmail).toBeNull();
    });

    it("handles malformed config gracefully", () => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-1", email: "test@example.com" },
        isLoading: false,
      });

      const badFlag: FeatureFlag = {
        id: "id-visitor-voice",
        flagKey: "visitor_voice_agent",
        enabled: true,
        label: "Visitor Voice Agent",
        description: null,
        config: {}, // Missing required fields
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      mockUseFeatureFlags.mockReturnValue({
        flags: [badFlag],
        isReady: true,
        isEnabled: () => true,
      });

      const { result } = renderHook(() => useVisitorVoiceAccess());

      expect(result.current.canUseVoice).toBe(false);
      expect(result.current.agentId).toBe("");
    });
  });
});
