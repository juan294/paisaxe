import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { requireBookingAccess } from "./gate";
import { consume } from "./metering";
import { createAbortableAdminClient } from "../supabase-admin";
import { isJevTaskEnabled } from "../jev/config";
import { checkRequestBudget } from "../request-rate-limit";
import {
  matchExperiences,
  parseMatchRequest,
  waitForMatchStage,
  MATCH_STAGE_LIMIT_MS,
} from "./match-experiences";
import type { MatchResponse } from "../../types/experience-match";
export interface MatchHandlerDependencies {
  fetch?: typeof globalThis.fetch;
  now?: () => Date;
}
const json = (
  body: MatchResponse | { available: boolean },
  status = 200,
  headers: Record<string, string> = {},
) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", ...headers },
  });
const notFound = () => json({ error: "Not found" }, 404);
/** Only Jev transport/clock are injectable. Gate, metering and catalog always execute. */
export function createMatchHandlers(
  dependencies: MatchHandlerDependencies = {},
) {
  const now = dependencies.now ?? (() => new Date());
  async function gate(request: NextRequest) {
    try {
      return await requireBookingAccess(request, now());
    } catch {
      return null;
    }
  }
  return {
    async GET(request: NextRequest): Promise<Response> {
      const access = await gate(request);
      if (!access || access instanceof NextResponse) return notFound();
      return json({
        available:
          ["es", "en"].includes(request.nextUrl.searchParams.get("locale") ?? "") &&
          isJevTaskEnabled("experience_match"),
      });
    },
    async POST(request: NextRequest): Promise<Response> {
      const access = await gate(request);
      if (!access || access instanceof NextResponse) return notFound();
      let consumeStarted = false;
      const unavailable = (
        reason: "deadline" | "cancelled" | "metering_unknown",
      ) =>
        json(
          {
            status: "unavailable",
            reason,
            guidance: "retry_or_chat",
            turnMayBeConsumed: consumeStarted,
          },
          503,
        );
      if (request.signal.aborted) return unavailable("cancelled");
      if (!isJevTaskEnabled("experience_match")) return notFound();
      const controller = new AbortController(),
        abort = () => controller.abort(request.signal.reason);
      request.signal.addEventListener("abort", abort, { once: true });
      const deadlineAt = Date.now() + MATCH_STAGE_LIMIT_MS,
        timer = setTimeout(
          () =>
            controller.abort(
              new DOMException("Matching stage deadline", "TimeoutError"),
            ),
          MATCH_STAGE_LIMIT_MS,
        );
      try {
        let raw: unknown;
        try {
          raw = await waitForMatchStage(
            () => request.json(),
            controller.signal,
          );
        } catch {
          if (controller.signal.aborted)
            return unavailable(
              request.signal.aborted ? "cancelled" : "deadline",
            );
          return json(
            {
              status: "invalid_input",
              fields: { request: "Supply a JSON request body." },
            },
            400,
          );
        }
        if (
          raw &&
          typeof raw === "object" &&
          "locale" in raw &&
          raw.locale !== "es" && raw.locale !== "en"
        )
          return notFound();
        const parsed = parseMatchRequest(raw, now());
        if (parsed.status === "invalid_input") return json(parsed, 400);
        const rate = await waitForMatchStage(
          () =>
            checkRequestBudget("POST /api/booking/chat/stream", access.userId),
          controller.signal,
        );
        if (!rate.allowed)
          return json(
            { status: "rate_limited", retryAfter: rate.retryAfter ?? 60 },
            429,
            { "Retry-After": String(rate.retryAfter ?? 60) },
          );
        controller.signal.throwIfAborted();
        const client = createAbortableAdminClient(controller.signal);
        let allowance: Awaited<ReturnType<typeof consume>>;
        try {
          allowance = await waitForMatchStage(() => {
            consumeStarted = true;
            return consume(client, access.redemption.id, "chat_turns");
          }, controller.signal);
        } catch {
          return unavailable(
            request.signal.aborted
              ? "cancelled"
              : controller.signal.aborted
                ? "deadline"
                : "metering_unknown",
          );
        }
        if (request.signal.aborted) return unavailable("cancelled");
        if (!allowance.allowed)
          return json({ status: "allowance_exhausted" }, 429);
        const result = await matchExperiences(client, parsed.input, {
          fetch: dependencies.fetch,
          signal: controller.signal,
          callerSignal: request.signal,
          deadlineAt,
          now: now(),
          remaining: allowance.remaining,
        });
        if (request.signal.aborted) return unavailable("cancelled");
        return json(result, result.status === "unavailable" ? 503 : 200);
      } catch {
        return unavailable(
          request.signal.aborted
            ? "cancelled"
            : controller.signal.aborted
              ? "deadline"
              : "metering_unknown",
        );
      } finally {
        clearTimeout(timer);
        request.signal.removeEventListener("abort", abort);
      }
    },
  };
}
