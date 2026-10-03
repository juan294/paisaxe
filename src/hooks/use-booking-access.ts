"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import type { VoucherLimits } from "@/lib/booking/vouchers";

interface UseBookingAccessResult {
  /** The user has an active voucher redemption and the booking surface is open. */
  active: boolean;
  limits: VoucherLimits | null;
  isLoading: boolean;
}

/**
 * Whether to show the booking entry. The server is the only authority: any
 * non-OK answer (the gate's 404, a network failure) means inactive.
 *
 * Re-checked when the signed-in user changes, not on every token refresh: the
 * auth provider emits a new user object per auth event, so the effect keys on
 * the user id and reads the current token when it runs.
 */
export function useBookingAccess(): UseBookingAccessResult {
  const { user, session, isLoading: isAuthLoading } = useAuth();
  const [limits, setLimits] = useState<VoucherLimits | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const tokenRef = useRef(session?.access_token);
  tokenRef.current = session?.access_token;
  const userId = user?.id;

  useEffect(() => {
    if (isAuthLoading) return;
    const token = tokenRef.current;
    if (!userId || !token) {
      setLimits(null);
      setIsFetching(false);
      return;
    }

    let cancelled = false;
    setIsFetching(true);
    fetch("/api/booking/access", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then(async (response) =>
        response.ok ? ((await response.json()) as { limits: VoucherLimits }).limits : null
      )
      .catch(() => null)
      .then((next) => {
        if (cancelled) return;
        setLimits(next ?? null);
        setIsFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, userId]);

  return { active: limits !== null, limits, isLoading: isAuthLoading || isFetching };
}
