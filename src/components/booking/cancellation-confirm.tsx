"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { dateTime, money } from "@/lib/booking-format";
import { csrfHeaders } from "@/lib/csrf-client";
import { useTranslation } from "@/lib/i18n";
import type { CancelResponse, CancellationTerms } from "@/types/booking-page";

type State = "idle" | "confirming" | "termsChanged" | "retryLater" | "unavailable" | "failed" | "done";

interface CancellationConfirmProps {
  /** `<id>.<token>` of the booking. */
  capability: string;
  terms: CancellationTerms;
  /** The cancellation was recorded (refund requested, pending or not due). */
  onCancelled?: (response: CancelResponse) => void;
}

/**
 * The cancellation terms and the one button that authorizes them (PayPal
 * hackathon plan, Phase 5). Used by the chat's cancellation card and the
 * booking page. The request carries the refund shown here; if the server's
 * terms changed meanwhile (R2-05) the new terms replace these and the visitor
 * must confirm again.
 */
export function CancellationConfirm({ capability, terms: initialTerms, onCancelled }: CancellationConfirmProps) {
  const { t, locale } = useTranslation();
  const [terms, setTerms] = useState(initialTerms);
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<CancelResponse | null>(null);
  const amount = money(terms.refundCents, terms.currency, locale);

  const finish = (response: CancelResponse) => {
    setResult(response);
    onCancelled?.(response);
  };

  const confirm = async () => {
    setState("confirming");
    try {
      const response = await fetch(`/api/booking/bookings/${capability}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ expectedRefundCents: terms.refundCents }),
      });
      const body = (await response.json().catch(() => null)) as (CancelResponse & { error?: string; terms?: CancellationTerms }) | null;
      if (response.ok && body) {
        setState("done");
        return finish({ status: body.status, refundCents: body.refundCents });
      }
      if (body?.error === "terms_changed" && body.terms) {
        setTerms(body.terms);
        return setState("termsChanged");
      }
      if (body?.error === "refund_unavailable") {
        // Recorded as cancel_pending; reconciliation requests the refund.
        setState("retryLater");
        return finish({ status: "cancel_pending", refundCents: terms.refundCents });
      }
      setState(response.status === 409 || response.status === 404 ? "unavailable" : "failed");
    } catch {
      setState("failed");
    }
  };

  if (state === "done" || state === "retryLater") {
    const message =
      state === "retryLater"
        ? "retryLater"
        : result?.status === "needs_attention"
          ? "refundFailed"
          : result?.status === "refund_pending" || result?.status === "cancel_pending"
            ? "refundPending"
            : "done";
    return <p aria-live="polite">{t(`booking.cancel.${message}`)}</p>;
  }

  return (
    <div className="space-y-2" aria-live="polite">
      {state === "termsChanged" && <p className="text-amber-200">{t("booking.cancel.termsChanged").replace("{amount}", amount)}</p>}
      {terms.refundCents > 0 ? (
        <>
          <p>{t("booking.cancel.refund").replace("{amount}", amount)}</p>
          {terms.termsValidUntil && (
            <p className="text-white/60">{t("booking.cancel.refundUntil").replace("{when}", dateTime(terms.termsValidUntil, locale))}</p>
          )}
        </>
      ) : (
        <p>{t("booking.cancel.noRefund").replace("{hours}", String(terms.cancellationWindowHours))}</p>
      )}
      {state !== "unavailable" && (
        <Button type="button" variant="glassDestructive" className="w-full" disabled={state === "confirming"} onClick={() => void confirm()}>
          {state === "confirming"
            ? t("booking.cancel.confirming")
            : terms.refundCents > 0
              ? t("booking.cancel.confirmRefund").replace("{amount}", amount)
              : t("booking.cancel.confirmNoRefund")}
        </Button>
      )}
      {(state === "unavailable" || state === "failed") && <p className="text-amber-200">{t(`booking.cancel.${state}`)}</p>}
    </div>
  );
}
