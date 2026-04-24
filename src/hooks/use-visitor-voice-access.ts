"use client";

import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useFeatureFlags } from "@/hooks/use-feature-flags";

interface UseVisitorVoiceAccessResult {
  /** Whether the public voice entry point is enabled */
  featureEnabled: boolean;
  /** Feature is enabled but user needs to sign in */
  needsSignIn: boolean;
  /** Loading state while auth or flags are being fetched */
  isLoading: boolean;
}

export function useVisitorVoiceAccess(): UseVisitorVoiceAccessResult {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { isReady: flagsReady, isEnabled } = useFeatureFlags();

  return useMemo(() => {
    const isLoading = isAuthLoading || !flagsReady;
    const featureEnabled = isEnabled("visitor_voice_agent");

    // Determine if user needs to sign in (feature enabled but no user)
    const needsSignIn = featureEnabled && !user;

    return {
      featureEnabled,
      needsSignIn,
      isLoading,
    };
  }, [user, isAuthLoading, flagsReady, isEnabled]);
}
