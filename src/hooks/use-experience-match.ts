"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { csrfHeaders } from "@/lib/csrf-client";
import type {
  MatchRequest,
  MatchResponse,
  MatchResult,
} from "@/types/experience-match";

export type MatchCriteria = Omit<MatchRequest, "locale" | "preference">;
export type MatchCapability =
  | "idle"
  | "checking"
  | "available"
  | "unavailable"
  | "access_expired"
  | "error";
export interface MatchClientError {
  kind:
    "invalid_input" | "rate_limited" | "allowance_exhausted" | "unavailable";
  fields?: Record<string, string>;
  retryAfter?: number;
}

/** Only explicit actions start HTTP. A cancelled POST may already have spent its turn. */
export function useExperienceMatch({
  accessToken,
  locale,
}: {
  accessToken?: string;
  locale: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [capability, setCapability] = useState<MatchCapability>("idle");
  const capabilityRef = useRef<MatchCapability>("idle");
  const openRef = useRef(false);
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState<MatchClientError | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [submittedCriteria, setSubmittedCriteria] =
    useState<MatchCriteria | null>(null);
  const generation = useRef(0);
  const active = useRef<{
    controller: AbortController;
    kind: "GET" | "POST";
  } | null>(null);
  const identity = useRef({ accessToken, locale });
  const markCapability = useCallback((value: MatchCapability) => {
    capabilityRef.current = value;
    setCapability(value);
  }, []);
  const invalidate = useCallback(() => {
    generation.current++;
    active.current?.controller.abort();
    active.current = null;
  }, []);
  const close = useCallback(() => {
    invalidate();
    openRef.current = false;
    setIsOpen(false);
    markCapability("idle");
    setIsSearching(false);
    setResult(null);
    setError(null);
    setCancelled(false);
    setSubmittedCriteria(null);
  }, [invalidate, markCapability]);
  useEffect(() => {
    if (
      identity.current.accessToken !== accessToken ||
      identity.current.locale !== locale
    ) {
      identity.current = { accessToken, locale };
      close();
    }
  }, [accessToken, locale, close]);
  useEffect(() => invalidate, [invalidate]);

  const begin = useCallback(
    (kind: "GET" | "POST") => {
      invalidate();
      const controller = new AbortController();
      active.current = { controller, kind };
      return { controller, id: generation.current };
    },
    [invalidate],
  );
  const headers = useCallback(
    () => ({
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...csrfHeaders(),
    }),
    [accessToken],
  );
  const check = useCallback(
    async (id: number, controller: AbortController): Promise<boolean> => {
      markCapability("checking");
      try {
        const response = await fetch(
          `/api/booking/match?locale=${encodeURIComponent(locale)}`,
          {
            method: "GET",
            cache: "no-store",
            headers: headers(),
            signal: controller.signal,
          },
        );
        const body = await response.json().catch(() => null);
        if (generation.current !== id || controller.signal.aborted)
          return false;
        if (response.status === 404) {
          markCapability("access_expired");
          return false;
        }
        if (!response.ok || typeof body?.available !== "boolean") {
          markCapability("error");
          return false;
        }
        markCapability(body.available ? "available" : "unavailable");
        return body.available;
      } catch {
        if (generation.current === id && !controller.signal.aborted)
          markCapability("error");
        return false;
      }
    },
    [headers, locale, markCapability],
  );
  const open = useCallback(async () => {
    const { id, controller } = begin("GET");
    openRef.current = true;
    setIsOpen(true);
    setResult(null);
    setError(null);
    setCancelled(false);
    setIsSearching(false);
    await check(id, controller);
    if (generation.current === id) active.current = null;
  }, [begin, check]);
  const post = useCallback(
    async (request: MatchRequest, id: number, controller: AbortController) => {
      if (
        generation.current !== id ||
        controller.signal.aborted ||
        !openRef.current
      )
        return;
      active.current = { controller, kind: "POST" };
      setIsSearching(true);
      setResult(null);
      setError(null);
      setCancelled(false);
      const criteria: MatchCriteria = {};
      if (request.date !== undefined) criteria.date = request.date;
      if (request.partySize !== undefined)
        criteria.partySize = request.partySize;
      if (request.budgetCents !== undefined)
        criteria.budgetCents = request.budgetCents;
      if (request.constraints !== undefined)
        criteria.constraints = request.constraints;
      setSubmittedCriteria(criteria);
      try {
        const response = await fetch("/api/booking/match", {
          method: "POST",
          headers: headers(),
          body: JSON.stringify(request),
          signal: controller.signal,
        });
        const body = (await response
          .json()
          .catch(() => null)) as MatchResponse | null;
        if (generation.current !== id || controller.signal.aborted) return;
        if (response.status === 404) {
          markCapability("access_expired");
          return;
        }
        if (body && "status" in body) {
          if (body.status === "invalid_input") {
            setError({ kind: "invalid_input", fields: body.fields });
            return;
          }
          if (
            body.status === "rate_limited" ||
            body.status === "allowance_exhausted"
          ) {
            const retryHeader = response.headers.get("retry-after");
            const headerSeconds =
              retryHeader === null ? NaN : Number(retryHeader);
            setError({
              kind: body.status,
              ...((body.retryAfter ??
                (Number.isFinite(headerSeconds)
                  ? headerSeconds
                  : undefined)) === undefined
                ? {}
                : { retryAfter: body.retryAfter ?? headerSeconds }),
            });
            return;
          }
          if (
            response.ok &&
            ["matched", "degraded", "no_results", "unavailable"].includes(
              body.status,
            )
          ) {
            setResult(body as MatchResult);
            return;
          }
        }
        setError({ kind: "unavailable" });
      } catch {
        if (generation.current === id && !controller.signal.aborted)
          setError({ kind: "unavailable" });
      } finally {
        if (generation.current === id) {
          setIsSearching(false);
          active.current = null;
        }
      }
    },
    [headers, markCapability],
  );
  const submit = useCallback(
    async (request: MatchRequest) => {
      if (
        !openRef.current ||
        capabilityRef.current !== "available" ||
        locale !== "es"
      )
        return;
      const { id, controller } = begin("POST");
      await post(request, id, controller);
    },
    [begin, locale, post],
  );
  const retry = useCallback(
    async (request: MatchRequest) => {
      if (!openRef.current) return;
      const { id, controller } = begin("GET");
      setIsSearching(false);
      setError(null);
      setResult(null);
      setCancelled(false);
      if ((await check(id, controller)) && locale === "es")
        await post(request, id, controller);
      else if (generation.current === id) active.current = null;
    },
    [begin, check, locale, post],
  );
  const cancel = useCallback(() => {
    const submitted = active.current?.kind === "POST";
    invalidate();
    setIsSearching(false);
    setResult(null);
    if (submitted) setCancelled(true);
  }, [invalidate]);
  return {
    isOpen,
    capability,
    isSearching,
    result,
    error,
    cancelled,
    submittedCriteria,
    open,
    close,
    submit,
    retry,
    cancel,
  };
}
