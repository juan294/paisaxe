"use client";

import { readRetryAfter } from "@/lib/retry-after";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useVisitorVoiceAccess } from "@/hooks/use-visitor-voice-access";
import { ELEVENLABS_AGENT_IDS } from "@/config/elevenlabs-agents";
import { clientLogger } from "@/lib/client-logger";
import type { VoiceAccessResponse } from "@/types/voice-access";

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
  isSuspended: boolean;
  /** Session issuance denied; the fresh access reason is not yet known. */
  isAccessDenied: boolean;
  accessStatus: VoiceAccessResponse["status"];
  /** Expiry date for paid access (null if whitelisted or no access) */
  expiresAt: Date | null;
  /** Hours until expiry (for showing reminders) */
  hoursUntilExpiry: number | null;
  /** ElevenLabs agent ID */
  agentId: string;
  /** Loading state */
  isLoading: boolean;
  /** Refresh access state (call after purchase) */
  refresh: (options?: {afterIssuanceDenial?: boolean}) => Promise<void>;
  retryAfter: number | null;
}

export function useVoiceAccess(): UseVoiceAccessResult {
  const { user, session, isLoading: isAuthLoading } = useAuth();
  const visitorAccess = useVisitorVoiceAccess();

  const [paidAccess, setPaidAccess] = useState<{ userId: string; accessToken: string; value: VoiceAccessResponse } | null>(
    null
  );
  const [issuanceDenied, setIssuanceDenied] = useState(false);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const [isFetchingAccess, setIsFetchingAccess] = useState(false);
  const [hasCheckedPaidAccess, setHasCheckedPaidAccess] = useState(false);

  const fetchPaidAccess = useCallback(async (options?: {afterIssuanceDenial?: boolean}) => {
    if (options?.afterIssuanceDenial) {
      // A session 403 is authoritative even if the following reason read fails.
      setPaidAccess(null);
      setIssuanceDenied(true);
    }
    if (!user || !session?.access_token) {
      setPaidAccess(null);
      setRetryAfter(null);
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
        setIssuanceDenied(false);
        setPaidAccess({ userId: user.id, accessToken: session.access_token, value: data });
        setRetryAfter(null);
      } else if (response.status === 429) {
        setRetryAfter(readRetryAfter(response));
      } else {
        setRetryAfter(null);
        setPaidAccess(null);
      }
    } catch (error) {
      clientLogger.error("[use-voice-access] Error fetching access", {
        error: error instanceof Error ? error.message : String(error),
      });
      setPaidAccess(null);
    } finally {
      setIsFetchingAccess(false);
      setHasCheckedPaidAccess(true);
    }
  }, [user, session?.access_token]);

  // Reset checked state when user changes (before fetching)
  useEffect(() => {
    setHasCheckedPaidAccess(false);
    setIssuanceDenied(false);
    setPaidAccess(null);
    setRetryAfter(null);
  }, [user?.id, session?.access_token]);

  // Fetch paid access when user changes
  useEffect(() => {
    fetchPaidAccess();
  }, [fetchPaidAccess]);

  return useMemo(() => {
    // Anonymous public routes should not block on visitor-flag hydration.
    const needsPaidAccessCheck = !!user && !hasCheckedPaidAccess;
    const isLoading =
      isAuthLoading ||
      isFetchingAccess ||
      needsPaidAccessCheck ||
      (!!user && visitorAccess.isLoading);

    // Check paid access
    const confirmedAccess = paidAccess?.userId === user?.id && paidAccess?.accessToken === session?.access_token ? paidAccess?.value : null;
    const hasPaidAccess = !issuanceDenied && (confirmedAccess?.hasAccess ?? false) && (!confirmedAccess?.expiresAt || Date.parse(confirmedAccess.expiresAt) > Date.now());

    // Visitor allowlist authorization now lives on the server boundary.
    const isWhitelisted = false;
    const canUseVoice = hasPaidAccess;

    // Parse expiry date for paid access
    const expiresAt = confirmedAccess?.expiresAt
      ? new Date(confirmedAccess.expiresAt)
      : null;

    // Calculate hours until expiry
    const hoursUntilExpiry = expiresAt
      ? Math.max(0, (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60))
      : null;

    // Needs sign in: feature enabled but user not signed in
    const needsSignIn = visitorAccess.needsSignIn;

    // Needs purchase: signed in, not whitelisted, no paid access
    const isSuspended = confirmedAccess?.status === "suspended" && !hasPaidAccess;
    const needsPurchase =
      !!user && visitorAccess.featureEnabled && !hasPaidAccess && !isSuspended && !issuanceDenied && retryAfter === null;

    // Only expose the public visitor agent when access has already been granted.
    const agentId = hasPaidAccess ? ELEVENLABS_AGENT_IDS.pelayo : "";

    return {
      hasAccess: hasPaidAccess,
      isWhitelisted,
      canUseVoice,
      needsSignIn,
      needsPurchase,
      isSuspended,
      isAccessDenied: issuanceDenied,
      accessStatus: confirmedAccess?.status ?? "none",
      expiresAt,
      hoursUntilExpiry,
      agentId,
      isLoading,
      refresh: fetchPaidAccess,
      retryAfter,
    };
  }, [
    isAuthLoading,
    visitorAccess,
    paidAccess,
    issuanceDenied,
    retryAfter,
    isFetchingAccess,
    hasCheckedPaidAccess,
    user,
    session?.access_token,
    fetchPaidAccess,
  ]);
}
