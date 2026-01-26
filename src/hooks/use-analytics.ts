"use client";

import { useCallback } from "react";
import type { FeatureFlagKey } from "@/types/feature-flags";

function getSessionId(): string {
  if (typeof window === "undefined") return "";

  let sessionId = sessionStorage.getItem("paisaxe-session-id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem("paisaxe-session-id", sessionId);
  }
  return sessionId;
}

export function useAnalytics() {
  const trackEvent = useCallback(
    (
      eventName: string,
      featureFlag?: FeatureFlagKey,
      metadata?: Record<string, unknown>
    ) => {
      const sessionId = getSessionId();

      // Fire-and-forget
      fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventName,
          featureFlag: featureFlag || null,
          sessionId,
          metadata: metadata || {},
        }),
      }).catch(() => {
        // Silently ignore analytics failures
      });
    },
    []
  );

  return { trackEvent };
}
