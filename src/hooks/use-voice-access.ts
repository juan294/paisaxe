"use client";
import { useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { readRetryAfter } from "@/lib/retry-after";
import {
  privateQueryKey,
  useClientQueryClient,
  usePrivateQueryIdentity,
} from "@/lib/client-query";
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
  refresh: (options?: { afterIssuanceDenial?: boolean }) => Promise<void>;
  retryAfter: number | null;
}

interface AccessState {
  value: VoiceAccessResponse | null;
  issuanceDenied: boolean;
  retryAfter: number | null;
}
const emptyState = (): AccessState => ({
  value: null,
  issuanceDenied: false,
  retryAfter: null,
});
export function useVoiceAccess(): UseVoiceAccessResult {
  const { user, session, isLoading: authLoading } = useAuth();
  const visitorAccess = useVisitorVoiceAccess();
  const identity = usePrivateQueryIdentity(
    user?.id,
    session?.access_token,
    authLoading,
  );
  const client = useClientQueryClient();
  const key = useMemo(
    () => privateQueryKey("voice-access", identity),
    [identity],
  );
  const query = useQuery(
    {
      queryKey: key,
      enabled: !!identity,
      staleTime: Infinity,
      queryFn: async ({ signal }): Promise<AccessState> => {
        try {
          const response = await fetch("/api/voice-access", {
            headers: { Authorization: `Bearer ${session!.access_token}` },
            signal,
          });
          signal.throwIfAborted();
          const current = client.getQueryData<AccessState>(key) ?? emptyState();
          if (response.ok) {
            const value: VoiceAccessResponse = await response.json();
            signal.throwIfAborted();
            return { value, issuanceDenied: false, retryAfter: null };
          }
          if (response.status === 429)
            return { ...current, retryAfter: readRetryAfter(response) };
          return { ...current, value: null, retryAfter: null };
        } catch (error) {
          if (signal.aborted) throw error;
          clientLogger.error("[use-voice-access] Error fetching access", {
            error: error instanceof Error ? error.message : String(error),
          });
          return {
            ...(client.getQueryData<AccessState>(key) ?? emptyState()),
            value: null,
          };
        }
      },
    },
    client,
  );
  const refetch = query.refetch;
  const refresh = useCallback(
    async (options?: { afterIssuanceDenial?: boolean }) => {
      if (!identity) return;
      if (options?.afterIssuanceDenial) {
        // Cancel first: an older grant must never undo authoritative issuance denial.
        await client.cancelQueries({ queryKey: key, exact: true });
        if (!client.getQueryState(key)) return;
        client.setQueryData<AccessState>(key, {
          value: null,
          issuanceDenied: true,
          retryAfter: null,
        });
      }
      await refetch();
    },
    [identity, client, key, refetch],
  );
  const state = identity ? query.data : undefined;
  const value = state?.value;
  const deadline =
    value?.hasAccess && value.expiresAt ? Date.parse(value.expiresAt) : null;
  useEffect(() => {
    if (
      !identity ||
      deadline === null ||
      !Number.isFinite(deadline) ||
      deadline <= Date.now()
    )
      return;
    let timer: ReturnType<typeof setTimeout>;
    const checkDeadline = () => {
      if (!client.getQueryState(key)) return;
      const remaining = deadline - Date.now();
      if (remaining > 0) {
        timer = setTimeout(checkDeadline, Math.min(remaining, 2_147_483_647));
        return;
      }
      const current = client.getQueryData<AccessState>(key);
      if (!current?.value?.hasAccess) return;
      client.setQueryData<AccessState>(key, {
        ...current,
        value: { ...current.value, hasAccess: false, status: "expired" },
      });
      void client.refetchQueries(
        { queryKey: key, exact: true },
        { cancelRefetch: false },
      );
    };
    timer = setTimeout(
      checkDeadline,
      Math.min(deadline - Date.now(), 2_147_483_647),
    );
    return () => clearTimeout(timer);
  }, [client, identity, key, deadline]);
  const denied = state?.issuanceDenied ?? false;
  const hasAccess =
    !denied &&
    (value?.hasAccess ?? false) &&
    (!value?.expiresAt || Date.parse(value.expiresAt) > Date.now());
  const expiresAt = value?.expiresAt ? new Date(value.expiresAt) : null;
  const isSuspended = value?.status === "suspended" && !hasAccess;
  return {
    hasAccess,
    isWhitelisted: false,
    canUseVoice: hasAccess,
    needsSignIn: visitorAccess.needsSignIn,
    needsPurchase:
      !!identity &&
      visitorAccess.featureEnabled &&
      !hasAccess &&
      !isSuspended &&
      !denied &&
      state?.retryAfter == null,
    isSuspended,
    isAccessDenied: denied,
    accessStatus: value?.status ?? "none",
    expiresAt,
    hoursUntilExpiry: expiresAt
      ? Math.max(0, (expiresAt.getTime() - Date.now()) / 3_600_000)
      : null,
    agentId: hasAccess ? ELEVENLABS_AGENT_IDS.pelayo : "",
    isLoading:
      authLoading ||
      (!!identity &&
        (query.isPending || query.isFetching || visitorAccess.isLoading)),
    refresh,
    retryAfter: state?.retryAfter ?? null,
  };
}
