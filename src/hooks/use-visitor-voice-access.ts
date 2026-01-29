"use client";

import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import type { VisitorVoiceConfig } from "@/types/feature-flags";

interface UseVisitorVoiceAccessResult {
  /** User can use voice (feature enabled, signed in, whitelisted, agent configured) */
  canUseVoice: boolean;
  /** Feature is enabled but user needs to sign in */
  needsSignIn: boolean;
  /** ElevenLabs agent ID from config */
  agentId: string;
  /** Current user's email (null if not signed in) */
  userEmail: string | null;
  /** Loading state while auth or flags are being fetched */
  isLoading: boolean;
}

export function useVisitorVoiceAccess(): UseVisitorVoiceAccessResult {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { flags, isLoading: isFlagsLoading, isEnabled } = useFeatureFlags();

  return useMemo(() => {
    const isLoading = isAuthLoading || isFlagsLoading;
    const featureEnabled = isEnabled("visitor_voice_agent");

    // Find the visitor_voice_agent flag to get its config
    const voiceFlag = flags.find((f) => f.flagKey === "visitor_voice_agent");
    const config = voiceFlag?.config as VisitorVoiceConfig | undefined;

    // Extract config values with safe defaults
    const whitelistedEmails = config?.whitelisted_emails ?? [];
    const agentId = config?.agent_id ?? "";

    // Get user email
    const userEmail = user?.email ?? null;

    // Determine if user needs to sign in (feature enabled but no user)
    const needsSignIn = featureEnabled && !user;

    // Check if user's email is whitelisted (case-insensitive)
    const isWhitelisted = userEmail
      ? whitelistedEmails.some(
          (email) => email.toLowerCase() === userEmail.toLowerCase()
        )
      : false;

    // User can use voice if:
    // 1. Feature is enabled
    // 2. User is signed in
    // 3. User's email is whitelisted
    // 4. Agent ID is configured
    const canUseVoice =
      featureEnabled && !!user && isWhitelisted && !!agentId;

    return {
      canUseVoice,
      needsSignIn,
      agentId,
      userEmail,
      isLoading,
    };
  }, [user, isAuthLoading, flags, isFlagsLoading, isEnabled]);
}
