"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { clockTime, money } from "@/lib/booking-format";
import { csrfHeaders } from "@/lib/csrf-client";
import { useTranslation } from "@/lib/i18n";
import type { BookingView, PaymentStartResponse } from "@/types/booking-page";

const FAST_POLL_MS = 5_000;
const FAST_WINDOW_MS = 2 * 60_000;
const SLOW_POLL_MS = 30_000;
const SLOW_WINDOW_MS = 15 * 60_000;

/** Delay before the next status poll while confirming, or null to stop (plan: 5 s for 2 min, then 30 s for 15 min). */
export function nextPollDelay(elapsedMs: number): number | null {
  if (elapsedMs < FAST_WINDOW_MS) return FAST_POLL_MS;
  if (elapsedMs < FAST_WINDOW_MS + SLOW_WINDOW_MS) return SLOW_POLL_MS;
  return null;
}

type Phase = "pay" | "confirming" | "confirmed" | "expired" | "attention" | "refunding" | "refunded" | "cancelled";

/** Payment statuses in which the buyer has approved and the server is finishing the capture. */
const CONFIRMING_PAYMENTS = new Set(["approved", "capture_pending", "captured"]);

function phaseOf(view: BookingView): Phase {
  switch (view.status) {
    case "confirmed":
      return "confirmed";
    case "expired":
      return "expired";
    case "needs_attention":
      return "attention";
    case "refund_pending":
      return "refunding";
    case "refunded":
      return "refunded";
    case "cancel_pending":
    case "cancelled":
      return "cancelled";
    default:
      return view.payment && CONFIRMING_PAYMENTS.has(view.payment.status) ? "confirming" : "pay";
  }
}

const PHASE_MESSAGE: Partial<Record<Phase, string>> = {
  attention: "booking.page.attentionBody",
  refunding: "booking.page.refundingBody",
  refunded: "booking.page.refundedBody",
  cancelled: "booking.page.cancelledBody",
};

type Load = { kind: "loading" } | { kind: "notFound" } | { kind: "failed" } | { kind: "ready"; view: BookingView };
type PayError = "holdExpired" | "paymentUnavailable" | "payFailed";

const BACK_TO_CHAT = "/immersive?booking=1";

/**
 * The booking behind a capability link (PayPal hackathon plan, Phase 4). The
 * page is a static shell; everything here loads through the capability API,
 * so an unknown link gets that route's real 404. While the server finishes a
 * capture the status is polled; the webhook and reconciliation complete it
 * whether or not this page stays open.
 */
export function BookingStatus() {
  const { t, locale } = useTranslation();
  const { capability } = useParams<{ capability: string }>();
  const cancelledAtPaypal = useSearchParams().get("cancelled") === "1";
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<PayError | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/booking/bookings/${capability}`, { cache: "no-store" });
      if (response.status === 404) return setLoad({ kind: "notFound" });
      if (!response.ok) return setLoad((current) => (current.kind === "ready" ? current : { kind: "failed" }));
      setLoad({ kind: "ready", view: (await response.json()) as BookingView });
    } catch {
      setLoad((current) => (current.kind === "ready" ? current : { kind: "failed" }));
    }
  }, [capability]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const phase = load.kind === "ready" ? phaseOf(load.view) : null;

  useEffect(() => {
    if (phase !== "confirming") return;
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      const delay = nextPollDelay(Date.now() - startedAt);
      if (delay !== null) timer = setTimeout(() => void refresh().then(schedule), delay);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [phase, refresh]);

  const pay = async () => {
    setPaying(true);
    setPayError(null);
    try {
      const response = await fetch(`/api/booking/bookings/${capability}/payment`, { method: "POST", headers: csrfHeaders() });
      const body = (await response.json().catch(() => null)) as (PaymentStartResponse & { error?: string }) | null;
      if (response.ok && body?.approveUrl) {
        window.location.assign(body.approveUrl);
        return;
      }
      // The booking moved on (paid in another tab, or no longer payable): show its real state.
      if (body?.error === "payment_in_progress" || body?.error === "invalid_state") {
        await refresh();
        if (body.error === "payment_in_progress") return setPaying(false);
      }
      setPayError(body?.error === "hold_expired" ? "holdExpired" : response.status === 503 ? "paymentUnavailable" : "payFailed");
    } catch {
      setPayError("payFailed");
    }
    setPaying(false);
  };

  if (load.kind !== "ready") {
    return (
      <Shell>
        <p className="text-white/70" aria-live="polite">
          {t(load.kind === "loading" ? "booking.page.loading" : `booking.page.${load.kind === "notFound" ? "notFound" : "loadFailed"}`)}
        </p>
        {load.kind === "failed" && (
          <Button type="button" variant="secondary" onClick={() => void refresh()}>
            {t("booking.page.refresh")}
          </Button>
        )}
      </Shell>
    );
  }

  const { view } = load;
  const holdLapsed = phase === "pay" && view.holdExpiresAt !== null && new Date(view.holdExpiresAt).getTime() <= Date.now();

  return (
    <Shell>
      <div className="space-y-1">
        <p className="text-sm text-white/60">{t("booking.page.title")}</p>
        <h1 className="text-2xl font-semibold">{view.experienceTitle}</h1>
        <p className="text-white/70">
          {t("booking.page.reference")} <span className="font-mono">{view.reference}</span> · {t(`booking.cards.status.${view.status}`)}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <dt className="text-white/70">{t("booking.cards.when")}</dt>
        <dd>
          {view.slotDate} · {view.slotTime}
        </dd>
        <dt className="text-white/70">{t("booking.cards.people")}</dt>
        <dd>{view.partySize}</dd>
        <dt className="text-white/70">{t("booking.cards.total")}</dt>
        <dd>{money(view.totalCents, view.currency, locale)}</dd>
        <dt className="text-white/70">{t("booking.cards.depositNow")}</dt>
        <dd className="font-semibold">{money(view.depositCents, view.currency, locale)}</dd>
        <dt className="text-white/70">{t("booking.cards.balanceLater")}</dt>
        <dd>{money(view.balanceCents, view.currency, locale)}</dd>
      </dl>
      <p className="text-sm text-white/70">
        {t("booking.cards.cancellation").replace("{hours}", String(view.cancellationWindowHours))}
      </p>

      <div className="space-y-3" aria-live="polite">
        {phase === "pay" &&
          (holdLapsed ? (
            <BackToChat message={t("booking.page.holdExpired")} label={t("booking.page.backToChat")} />
          ) : (
            <>
              {cancelledAtPaypal && <p className="text-amber-200">{t("booking.page.cancelled")}</p>}
              <p>{t("booking.page.payIntro")}</p>
              {view.holdExpiresAt && (
                <p className="text-sm text-white/60">
                  {t("booking.cards.payBefore").replace("{time}", clockTime(view.holdExpiresAt, locale))}
                </p>
              )}
              <Button type="button" className="w-full" disabled={paying} onClick={() => void pay()}>
                {paying ? t("booking.page.paying") : t("booking.cards.pay")}
              </Button>
              <p className="text-sm text-white/60">{t("booking.cards.sandbox")}</p>
              {payError && <p className="text-amber-200">{t(`booking.page.${payError}`)}</p>}
            </>
          ))}

        {phase === "confirming" && (
          <>
            <p className="font-semibold">{t("booking.page.confirming")}</p>
            <p className="text-sm text-white/70">{t("booking.page.confirmingHint")}</p>
            <Button type="button" variant="secondary" onClick={() => void refresh()}>
              {t("booking.page.refresh")}
            </Button>
          </>
        )}

        {phase === "confirmed" && (
          <>
            <p className="text-lg font-semibold text-emerald-300">{t("booking.page.confirmedTitle")}</p>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <dt className="text-white/70">{t("booking.page.orderId")}</dt>
              <dd className="font-mono">{view.payment?.orderId}</dd>
              <dt className="text-white/70">{t("booking.page.captureId")}</dt>
              <dd className="font-mono">{view.payment?.captureId}</dd>
            </dl>
          </>
        )}

        {phase === "expired" && <BackToChat message={t("booking.page.expiredBody")} label={t("booking.page.backToChat")} />}
        {phase && PHASE_MESSAGE[phase] && <p>{t(PHASE_MESSAGE[phase])}</p>}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-12 text-white">
      <div className="w-full max-w-md space-y-6">{children}</div>
    </main>
  );
}

function BackToChat({ message, label }: { message: string; label: string }) {
  return (
    <>
      <p>{message}</p>
      <a href={BACK_TO_CHAT} className="inline-block underline">
        {label}
      </a>
    </>
  );
}
