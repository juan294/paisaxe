"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useVisitorVoiceAccess } from "@/hooks/use-visitor-voice-access";
import { ELEVENLABS_AGENT_IDS } from "@/config/elevenlabs-agents";
import type { VoiceAccessResponse } from "@/app/api/voice-access/route";

interface UseVoiceAccessResult {
  /** User has active paid voice access */
  hasAccess: boolean;
  /** User is whitelisted (free access) */
  isWhitelisted: boolean;
  /** User can use voice (either paid or whitelisted) */
  canUseVoice: boolean;
  /** Feature is enabled but user needs to sign in */
  needsSignIn: boolean;
  /** User needs to purchase to use voice */
  needsPurchase: boolean;
  /** Expiry date for paid access (null if whitelisted or no access) */
  expiresAt: Date | null;
  /** Hours until expiry (for showing reminders) */
  hoursUntilExpiry: number | null;
  /** ElevenLabs agent ID */
  agentId: string;
  /** Loading state */
  isLoading: boolean;
  /** Refresh access state (call after purchase) */
  refresh: () => Promise<void>;
}

export function useVoiceAccess(): UseVoiceAccessResult {
  const { user, session, isLoading: isAuthLoading } = useAuth();
  const visitorAccess = useVisitorVoiceAccess();

  const [paidAccess, setPaidAccess] = useState<VoiceAccessResponse | null>(
    null
  );
  const [isFetchingAccess, setIsFetchingAccess] = useState(false);
  const [hasCheckedPaidAccess, setHasCheckedPaidAccess] = useState(false);

  const fetchPaidAccess = useCallback(async () => {
    if (!user || !session?.access_token) {
      setPaidAccess(null);
      setHasCheckedPaidAccess(true); // Mark as checked even when no user
      return;
    }

    setIsFetchingAccess(true);

    try {
      const response = await fetch("/api/voice-access", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data: VoiceAccessResponse = await response.json();
        setPaidAccess(data);
      } else {
        setPaidAccess(null);
      }
    } catch (error) {
      console.error("[use-voice-access] Error fetching access:", error);
      setPaidAccess(null);
    } finally {
      setIsFetchingAccess(false);
      setHasCheckedPaidAccess(true);
    }
  }, [user, session?.access_token]);

  // Reset checked state when user changes (before fetching)
  useEffect(() => {
    setHasCheckedPaidAccess(false);
  }, [user?.id]);

  // Fetch paid access when user changes
  useEffect(() => {
    fetchPaidAccess();
  }, [fetchPaidAccess]);

  return useMemo(() => {
    // Loading if: auth loading, visitor check loading, fetching, OR
    // user exists but we haven't checked their paid access yet
    const needsPaidAccessCheck = !!user && !hasCheckedPaidAccess;
    const isLoading = isAuthLoading || visitorAccess.isLoading || isFetchingAccess || needsPaidAccessCheck;

    // Check whitelist access from visitor voice access hook
    const isWhitelisted = visitorAccess.canUseVoice;

    // Check paid access
    const hasPaidAccess = paidAccess?.hasAccess ?? false;

    // User can use voice if whitelisted OR has paid access
    const canUseVoice = isWhitelisted || hasPaidAccess;

    // Parse expiry date for paid access
    const expiresAt = paidAccess?.expiresAt
      ? new Date(paidAccess.expiresAt)
      : null;

    // Calculate hours until expiry
    const hoursUntilExpiry = expiresAt
      ? Math.max(0, (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60))
      : null;

    // Needs sign in: feature enabled but user not signed in
    const needsSignIn = visitorAccess.needsSignIn;

    // Needs purchase: signed in, not whitelisted, no paid access
    const needsPurchase = !!user && !isWhitelisted && !hasPaidAccess;

    // Get agentId - use feature flag config first, fallback to Pelayo for paid users
    const agentId = visitorAccess.agentId || (hasPaidAccess ? ELEVENLABS_AGENT_IDS.pelayo : "");

    return {
      hasAccess: hasPaidAccess,
      isWhitelisted,
      canUseVoice,
      needsSignIn,
      needsPurchase,
      expiresAt,
      hoursUntilExpiry,
      agentId,
      isLoading,
      refresh: fetchPaidAccess,
    };
  }, [
    isAuthLoading,
    visitorAccess,
    paidAccess,
    isFetchingAccess,
    hasCheckedPaidAccess,
    user,
    fetchPaidAccess,
  ]);
}
