import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useVisitorVoiceAccess } from "./use-visitor-voice-access";
import type { FeatureFlag } from "@/types/feature-flags";

const mockUseAuth = vi.fn();
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

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
    description: "Enable voice for visitors",
    config,
    environment: "development",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  };
}

describe("useVisitorVoiceAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns featureEnabled false when the flag is off", () => {
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

    expect(result.current.featureEnabled).toBe(false);
    expect(result.current.needsSignIn).toBe(false);
    expect(result.current).not.toHaveProperty("agentId");
    expect(result.current).not.toHaveProperty("canUseVoice");
  });

  it("returns needsSignIn when the feature is enabled for anonymous users", () => {
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

    expect(result.current.featureEnabled).toBe(true);
    expect(result.current.needsSignIn).toBe(true);
  });

  it("does not expose allowlist or agent details for signed-in users", () => {
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

    expect(result.current.featureEnabled).toBe(true);
    expect(result.current.needsSignIn).toBe(false);
    expect(result.current).not.toHaveProperty("agentId");
    expect(result.current).not.toHaveProperty("userEmail");
    expect(result.current).not.toHaveProperty("canUseVoice");
  });

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

  it("handles malformed config without leaking extra fields", () => {
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
      config: {},
      environment: "development",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    };

    mockUseFeatureFlags.mockReturnValue({
      flags: [badFlag],
      isReady: true,
      isEnabled: () => true,
    });

    const { result } = renderHook(() => useVisitorVoiceAccess());

    expect(result.current.featureEnabled).toBe(true);
    expect(result.current.needsSignIn).toBe(false);
    expect(result.current).not.toHaveProperty("agentId");
  });
});
