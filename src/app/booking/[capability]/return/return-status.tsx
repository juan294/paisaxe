"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { TicketCard, TravellerShell } from "@/components/booking/traveller-shell";
import { buttonVariants } from "@/components/ui/button";
import { csrfHeaders } from "@/lib/csrf-client";
import { useTranslation } from "@/lib/i18n";
import type { CaptureOutcome, CaptureRequest, CaptureResponse } from "@/types/booking-page";

type Message = "returnConfirming" | "returnSlotGone" | "returnProblem" | "returnFailed" | "returnError";

/** Outcomes the return page explains itself; the others hand over to the booking page (D7). */
const OUTCOME_MESSAGE: Partial<Record<CaptureOutcome, Message>> = {
  slot_gone: "returnSlotGone",
  mismatch: "returnProblem",
  compensating: "returnProblem",
  failed: "returnFailed",
};

/** The booking page shows a confirmed or still-confirming payment better than this page can. */
const HAND_OVER: Partial<Record<CaptureOutcome, string>> = {
  confirmed: "?paid=1",
  pending: "",
  awaiting_approval: "",
};

/** After this long without an answer the visitor is offered the booking, which shows the truth. */
const SLOW_MS = 20_000;

/**
 * Where PayPal sends the buyer after approving (PayPal hackathon plan, Phase
 * 4): asks the server to capture the order in `token`, then hands a confirmed or
 * pending payment over to the booking page and explains any other outcome here
 * (docs/plans/2026-10-07-booking-ui-polish.md, U06, D7). Closing this page
 * changes nothing; the webhook and reconciliation reach the same outcome on the
 * server.
 */
export function ReturnStatus() {
  const { t } = useTranslation();
  const router = useRouter();
  const { capability } = useParams<{ capability: string }>();
  const orderId = useSearchParams().get("token");
  const [message, setMessage] = useState<Message>(orderId ? "returnConfirming" : "returnError");
  const [slow, setSlow] = useState(false);
  const started = useRef(false);
  const bookingPath = `/booking/${capability}`;

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
        if (outcome && HAND_OVER[outcome] !== undefined) return router.replace(`${bookingPath}${HAND_OVER[outcome]}`);
        setMessage((outcome && OUTCOME_MESSAGE[outcome]) || "returnError");
      })
      .catch(() => setMessage("returnError"));
  }, [bookingPath, capability, orderId, router]);

  useEffect(() => {
    if (message !== "returnConfirming") return;
    const timer = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(timer);
  }, [message]);

  const capturing = message === "returnConfirming";

  return (
    <TravellerShell>
      <TicketCard>
        <div className="space-y-4" aria-live="polite">
          <p className="flex items-center gap-2 font-semibold">
            {capturing && <Loader2 className="size-5 shrink-0 motion-safe:animate-spin" aria-hidden="true" />}
            {t(`booking.page.${message}`)}
          </p>
          {capturing && slow && <p className="text-sm text-white/80">{t("booking.page.returnSlow")}</p>}
          {(!capturing || slow) && (
            <a href={bookingPath} className={buttonVariants({ variant: "brand", className: "w-full" })}>
              {t("booking.cards.viewBooking")}
            </a>
          )}
        </div>
      </TicketCard>
    </TravellerShell>
  );
}
