"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { BalanceInvoiceStatusView } from "@/components/booking/balance-invoice";
import { CancellationConfirm } from "@/components/booking/cancellation-confirm";
import { PaymentReceipt } from "@/components/booking/payment-receipt";
import { PayPalLabel } from "@/components/booking/paypal-label";
import { TicketCard, TravellerShell } from "@/components/booking/traveller-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { useCountdown } from "@/hooks/use-countdown";
import { experiencePhoto } from "@/lib/booking/experience-photos";
import { clockTime, money, slotDay } from "@/lib/booking-format";
import { csrfHeaders } from "@/lib/csrf-client";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { BookingView, CancellationTerms, PaymentStartResponse } from "@/types/booking-page";
import { journeySteps, type Phase, type StepState } from "./journey";

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

/**
 * Payment statuses in which the buyer has approved and the server is finishing the capture,
 * or (Phase 8b) holds the authorized deposit while the merchant confirms by phone.
 */
const CONFIRMING_PAYMENTS = new Set(["approved", "capture_pending", "captured", "authorized", "void_pending"]);

function phaseOf(view: BookingView): Phase {
  // A refused refund is the truth whatever the booking row still says.
  if (view.payment?.status === "refund_failed") return "refundFailed";
  switch (view.status) {
    case "confirmed":
      return "confirmed";
    case "expired":
      return "expired";
    case "needs_attention":
      return "attention";
    case "cancel_pending":
    case "refund_pending":
      return "refunding";
    case "refunded":
      return "refunded";
    case "cancelled":
      return "cancelled";
    default:
      return view.payment && CONFIRMING_PAYMENTS.has(view.payment.status) ? "confirming" : "pay";
  }
}

const PHASE_MESSAGE: Partial<Record<Phase, string>> = {
  attention: "booking.page.attentionBody",
  refundFailed: "booking.cancel.refundFailed",
  refunding: "booking.page.refundingBody",
  refunded: "booking.page.refundedBody",
  cancelled: "booking.page.cancelledBody",
};

type Load = { kind: "loading" } | { kind: "notFound" } | { kind: "failed" } | { kind: "ready"; view: BookingView };
type PayError = "holdExpired" | "paymentUnavailable" | "payFailed";

const BACK_TO_CHAT = "/immersive?booking=1";

/** Moves focus to the status region when the phase changes after the first load (U16), so the change is announced in place. */
function useFocusOnPhaseChange(phase: Phase | null) {
  const region = useRef<HTMLDivElement>(null);
  const first = useRef<Phase | null>(null);
  useEffect(() => {
    if (phase === null) return;
    if (first.current === null) {
      first.current = phase;
      return;
    }
    region.current?.focus();
  }, [phase]);
  return region;
}

/**
 * The booking behind a capability link (PayPal hackathon plan, Phase 4), drawn as
 * a ticket over the experience photo (docs/plans/2026-10-07-booking-ui-polish.md).
 * The page is a static shell; everything here loads through the capability API,
 * so an unknown link gets that route's real 404. While the server finishes a
 * capture or a refund the status is polled; the webhook and reconciliation
 * complete it whether or not this page stays open. Phase 5 adds the
 * cancellation section of a confirmed booking; Phase 8a the balance invoice,
 * shown whenever one exists (money may have moved even if the booking did not
 * stay confirmed).
 */
export function BookingStatus() {
  const { t, locale } = useTranslation();
  const { capability } = useParams<{ capability: string }>();
  const search = useSearchParams();
  const cancelledAtPaypal = search.get("cancelled") === "1";
  const arrivedFromPaypal = search.get("paid") === "1";
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<PayError | null>(null);
  const [pollingStopped, setPollingStopped] = useState(false);

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
  const countdown = useCountdown(phase === "pay" && load.kind === "ready" ? load.view.holdExpiresAt : null);
  const statusRegion = useFocusOnPhaseChange(phase);

  useEffect(() => {
    // The server is finishing something the visitor started: a capture, or a refund.
    setPollingStopped(false);
    if (phase !== "confirming" && phase !== "refunding") return;
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      const delay = nextPollDelay(Date.now() - startedAt);
      if (delay === null) return setPollingStopped(true);
      timer = setTimeout(() => void refresh().then(schedule), delay);
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
      <TravellerShell>
        <TicketCard>
          <p className="text-white/80" aria-live="polite">
            {t(load.kind === "loading" ? "booking.page.loading" : `booking.page.${load.kind === "notFound" ? "notFound" : "loadFailed"}`)}
          </p>
          {load.kind === "failed" && (
            <Button type="button" variant="glass" className="w-full rounded-md" onClick={() => void refresh()}>
              {t("booking.page.refresh")}
            </Button>
          )}
        </TicketCard>
      </TravellerShell>
    );
  }

  const { view } = load;
  const holdLapsed =
    phase === "pay" && view.holdExpiresAt !== null && (countdown.expired || new Date(view.holdExpiresAt).getTime() <= Date.now());
  const steps = journeySteps(view, phase as Phase);
  const depositDone = steps[1].state === "done";
  const balanceDone = steps[2].state === "done";
  const statusLabel = phase === "confirming" ? t("booking.page.statusConfirming") : t(`booking.cards.status.${view.status}`);
  const busy = (phase === "confirming" || phase === "refunding") && !pollingStopped;
  const refreshButton = (
    <Button type="button" variant="glass" className="w-full rounded-md" onClick={() => void refresh()}>
      {t("booking.page.refresh")}
    </Button>
  );

  return (
    <TravellerShell photo={experiencePhoto(view.experienceSlug)}>
      <TicketCard>
        <header className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-white/70">{t("booking.page.title")}</p>
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/80">{statusLabel}</span>
          </div>
          <h1 className="text-2xl font-semibold leading-tight">{view.experienceTitle}</h1>
          <p className="text-white/80">
            {t("booking.page.when")
              .replace("{day}", slotDay(view.slotDate, locale))
              .replace("{time}", view.slotTime)
              .replace("{people}", String(view.partySize))}
          </p>
          <p className="text-xs text-white/70">
            {t("booking.page.reference")} <span className="font-mono">{view.reference}</span>
          </p>
        </header>

        <JourneySteps steps={steps} />

        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm tabular-nums">
          <dt className="text-white/70">{t("booking.cards.total")}</dt>
          <dd className="text-right">{money(view.totalCents, view.currency, locale)}</dd>
          <dt className="text-white/70">{t(depositDone ? "booking.cards.depositPaid" : "booking.cards.depositNow")}</dt>
          <dd className="text-right font-semibold">{money(view.depositCents, view.currency, locale)}</dd>
          <dt className="text-white/70">{t(balanceDone ? "booking.cards.balancePaid" : "booking.cards.balanceLater")}</dt>
          <dd className="text-right">{money(view.balanceCents, view.currency, locale)}</dd>
        </dl>
        {(phase === "pay" || phase === "confirming" || phase === "confirmed") && (
          <p className="text-sm text-white/70">
            {t("booking.cards.cancellation").replace("{hours}", String(view.cancellationWindowHours))}
          </p>
        )}

        <div ref={statusRegion} tabIndex={-1} className="space-y-3 rounded-md focus:outline-none" aria-live="polite">
          {phase === "pay" &&
            (holdLapsed ? (
              <BackToChat message={t("booking.page.holdExpired")} label={t("booking.page.backToChat")} />
            ) : (
              <>
                {cancelledAtPaypal && <p className="text-amber-200">{t("booking.page.cancelled")}</p>}
                <p>{t("booking.page.payIntro")}</p>
                {countdown.label && (
                  <p role="timer" aria-live="off" className="text-sm tabular-nums text-white/80">
                    {t("booking.page.holdCountdown").replace("{time}", countdown.label)}
                  </p>
                )}
                {view.holdExpiresAt && (
                  <p className="sr-only">{t("booking.cards.payBefore").replace("{time}", clockTime(view.holdExpiresAt, locale))}</p>
                )}
                <Button
                  type="button"
                  variant="paypal"
                  size="lg"
                  className="w-full"
                  disabled={paying}
                  aria-label={paying ? undefined : t("booking.cards.pay")}
                  onClick={() => void pay()}
                >
                  {paying ? t("booking.page.paying") : <PayPalLabel prefix={t("booking.cards.payWith")} />}
                </Button>
                <p className="text-sm text-white/70">{t("booking.cards.sandbox")}</p>
                {payError && <p className="text-amber-200">{t(`booking.page.${payError}`)}</p>}
              </>
            ))}

          {phase === "confirming" && (
            <>
              <p className="flex items-center gap-2 font-semibold">
                {busy && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />}
                {t("booking.page.confirming")}
              </p>
              <p className="text-sm text-white/70">{t("booking.page.confirmingHint")}</p>
              {refreshButton}
            </>
          )}

          {phase === "confirmed" && (
            <p className="flex items-center gap-2 text-lg font-semibold text-emerald-300">
              <Check className="size-5 shrink-0" aria-hidden="true" />
              {/* Straight back from PayPal the headline says the payment arrived (D7). */}
              {t(arrivedFromPaypal ? "booking.page.returnConfirmed" : "booking.page.confirmedTitle")}
            </p>
          )}

          {phase === "refunding" && (
            <>
              <p className="flex items-center gap-2 font-semibold">
                {busy && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />}
                {t("booking.cancel.refundPending")}
              </p>
              {refreshButton}
            </>
          )}

          {phase === "expired" && <BackToChat message={t("booking.page.expiredBody")} label={t("booking.page.backToChat")} />}
          {phase && PHASE_MESSAGE[phase] && <p>{t(PHASE_MESSAGE[phase])}</p>}
        </div>

        {phase !== "pay" && view.payment && <PaymentReceipt payment={view.payment} />}

        {view.invoice && (
          <section className="space-y-1 border-t border-white/10 pt-4 text-sm" aria-live="polite">
            <h2 className="text-base font-semibold">{t("booking.invoice.title")}</h2>
            <p className="text-white/70">{t("booking.invoice.dueOn").replace("{date}", slotDay(view.slotDate, locale))}</p>
            <BalanceInvoiceStatusView status={view.invoice.status} url={view.invoice.url} />
          </section>
        )}

        {phase === "confirmed" && <CancelSection capability={capability} onCancelled={() => void refresh()} />}
      </TicketCard>
    </TravellerShell>
  );
}

const STEP_LABEL = { offer: "booking.page.steps.offer", deposit: "booking.page.steps.deposit", balance: "booking.page.steps.balance" };

const STEP_DOT: Record<StepState, string> = {
  done: "border-paisaxe-green-400 bg-paisaxe-green-400 text-black",
  current: "border-paisaxe-green-400 bg-transparent",
  upcoming: "border-white/40 bg-transparent",
  stopped: "border-white/30 bg-transparent",
};

/** The ticket's signature: offer → deposit (PayPal Orders) → balance (PayPal invoice). */
function JourneySteps({ steps }: { steps: ReturnType<typeof journeySteps> }) {
  const { t } = useTranslation();
  return (
    <ol aria-label={t("booking.page.steps.label")} className="flex items-start">
      {steps.map((step, index) => (
        <li key={step.key} data-state={step.state} className="flex flex-1 flex-col items-center gap-1.5 text-center">
          <div className="flex w-full items-center">
            <span className={cn("h-px flex-1", index === 0 ? "bg-transparent" : "bg-white/20")} />
            <span className={cn("flex size-5 items-center justify-center rounded-full border-2", STEP_DOT[step.state])} aria-hidden="true">
              {step.state === "done" && <Check className="size-3" strokeWidth={3} />}
              {step.state === "current" && <span className="size-1.5 rounded-full bg-paisaxe-green-400 motion-safe:animate-pulse" />}
            </span>
            <span className={cn("h-px flex-1", index === steps.length - 1 ? "bg-transparent" : "bg-white/20")} />
          </div>
          <span
            className={cn(
              "text-xs",
              step.state === "done" || step.state === "current" ? "text-white" : "text-white/70",
              step.state === "stopped" && "line-through"
            )}
          >
            {t(STEP_LABEL[step.key])}
            <span className="sr-only"> ({step.state})</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

type Preview = { kind: "closed" } | { kind: "loading" } | { kind: "unavailable" } | { kind: "ready"; terms: CancellationTerms };

/** The read-only preview, loaded on demand, then the one confirm button (F01, R2-05). Last on the ticket and quiet (U04). */
function CancelSection({ capability, onCancelled }: { capability: string; onCancelled: () => void }) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<Preview>({ kind: "closed" });

  const open = async () => {
    setPreview({ kind: "loading" });
    try {
      const response = await fetch(`/api/booking/bookings/${capability}/cancellation-preview`, { cache: "no-store" });
      setPreview(response.ok ? { kind: "ready", terms: (await response.json()) as CancellationTerms } : { kind: "unavailable" });
    } catch {
      setPreview({ kind: "unavailable" });
    }
  };

  return (
    <section className="space-y-2 border-t border-white/10 pt-4 text-sm">
      <h2 className="sr-only">{t("booking.cancel.title")}</h2>
      {preview.kind === "closed" && (
        <button
          type="button"
          onClick={() => void open()}
          className="rounded text-white/70 underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
        >
          {t("booking.cancel.open")}
        </button>
      )}
      {preview.kind !== "closed" && <h3 className="font-semibold">{t("booking.cancel.title")}</h3>}
      {preview.kind === "loading" && <p className="text-white/70">{t("booking.cancel.loading")}</p>}
      {preview.kind === "unavailable" && <p className="text-amber-200">{t("booking.cancel.unavailable")}</p>}
      {preview.kind === "ready" && <CancellationConfirm capability={capability} terms={preview.terms} onCancelled={onCancelled} />}
    </section>
  );
}

function BackToChat({ message, label }: { message: string; label: string }) {
  return (
    <>
      <p>{message}</p>
      <a href={BACK_TO_CHAT} className={buttonVariants({ variant: "glass", className: "w-full rounded-md" })}>
        {label}
      </a>
    </>
  );
}
