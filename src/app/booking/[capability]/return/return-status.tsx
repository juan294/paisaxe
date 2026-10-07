"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { csrfHeaders } from "@/lib/csrf-client";
import { useTranslation } from "@/lib/i18n";
import type { CaptureOutcome, CaptureRequest, CaptureResponse } from "@/types/booking-page";

type Message =
  | "returnConfirming"
  | "returnConfirmed"
  | "returnPending"
  | "returnSlotGone"
  | "returnProblem"
  | "returnFailed"
  | "returnError";

const OUTCOME_MESSAGE: Record<CaptureOutcome, Message> = {
  confirmed: "returnConfirmed",
  pending: "returnPending",
  awaiting_approval: "returnPending",
  slot_gone: "returnSlotGone",
  mismatch: "returnProblem",
  compensating: "returnProblem",
  failed: "returnFailed",
};

/**
 * Where PayPal sends the buyer after approving (PayPal hackathon plan, Phase
 * 4): asks the server to capture the order in `token` and shows the outcome.
 * Closing this page changes nothing; the webhook and reconciliation reach the
 * same outcome on the server.
 */
export function ReturnStatus() {
  const { t } = useTranslation();
  const { capability } = useParams<{ capability: string }>();
  const orderId = useSearchParams().get("token");
  const [message, setMessage] = useState<Message>(orderId ? "returnConfirming" : "returnError");
  const started = useRef(false);

  useEffect(() => {
    // StrictMode runs effects twice; one capture request is enough (it is idempotent anyway).
    if (!orderId || started.current) return;
    started.current = true;
    fetch("/api/booking/payments/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify({ capability, orderId } satisfies CaptureRequest),
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as Partial<CaptureResponse> | null;
        const outcome = body?.outcome;
        setMessage(outcome && outcome in OUTCOME_MESSAGE ? OUTCOME_MESSAGE[outcome] : "returnError");
      })
      .catch(() => setMessage("returnError"));
  }, [capability, orderId]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-12 text-white">
      <div className="w-full max-w-md space-y-4" aria-live="polite">
        <p className={message === "returnConfirmed" ? "text-lg font-semibold text-emerald-300" : undefined}>
          {t(`booking.page.${message}`)}
        </p>
        {message !== "returnConfirming" && (
          <a href={`/booking/${capability}`} className="inline-block underline">
            {t("booking.cards.viewBooking")}
          </a>
        )}
      </div>
    </main>
  );
}
