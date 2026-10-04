"use client";

import { BalanceInvoiceStatusView } from "@/components/booking/balance-invoice";
import { CancellationConfirm } from "@/components/booking/cancellation-confirm";
import { Button } from "@/components/ui/button";
import type { QuoteState } from "@/hooks/use-booking-chat";
import { clockTime, money } from "@/lib/booking-format";
import { useTranslation } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/types";
import type {
  BookingCard,
  BookingSummaryCard,
  CancellationCard,
  InvoiceCard,
  OfferCard,
  PaymentCard,
  QuoteCard,
} from "@/types/booking-cards";

interface BookingCardsProps {
  cards: BookingCard[];
  quoteStates: Record<string, QuoteState>;
  onAccept: (quoteId: string) => void;
  onRequote: () => void;
  /** A turn is streaming: accepting or re-quoting now would start a second one. */
  busy?: boolean;
}

type T = (key: string) => string;

function CardShell({ title, children, t }: { title: string; children: React.ReactNode; t: T }) {
  return (
    <section className="mt-3 rounded-xl border border-white/20 bg-white/10 p-3 text-sm text-white">
      <header className="mb-2 flex items-start justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-200">
          {t("booking.cards.demo")}
        </span>
      </header>
      {children}
    </section>
  );
}

function OfferCardView({ card, t, locale }: { card: OfferCard; t: T; locale: Locale }) {
  return (
    <CardShell title={t("booking.cards.offerTitle")} t={t}>
      <ul className="space-y-2">
        {card.options.map((option) => (
          <li key={option.experienceId} className="rounded-lg bg-white/5 p-2">
            <div className="flex justify-between gap-2">
              <span className="font-medium">{option.title}</span>
              <span>{money(option.priceCents, option.currency, locale)}</span>
            </div>
            <p className="text-white/70">{t(`booking.cards.suitability.${option.suitability}`)}</p>
            {option.reasons.map((reason) => (
              <p key={reason} className="text-white/60">
                {t(`booking.cards.reason.${reason}`)}
              </p>
            ))}
            {option.verdicts
              .filter((verdict) => verdict.verdict !== "supported")
              .map((verdict) => (
                <p key={verdict.key} className="text-white/60">
                  {t(`booking.cards.verdict.${verdict.verdict}`)}
                  {verdict.detail ? `: ${verdict.detail}` : ""}
                </p>
              ))}
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

function QuoteCardView({
  card,
  state,
  onAccept,
  onRequote,
  busy,
  t,
  locale,
}: {
  card: QuoteCard;
  state: QuoteState | undefined;
  onAccept: (quoteId: string) => void;
  onRequote: () => void;
  busy: boolean;
  t: T;
  locale: Locale;
}) {
  const expiresAt = clockTime(card.expiresAt, locale);
  const lapsed = state === "expired" || state === "noCapacity";

  return (
    <CardShell title={card.experienceTitle} t={t}>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
        <dt className="text-white/70">{t("booking.cards.when")}</dt>
        <dd>
          {card.slotDate} · {card.slotTime}
        </dd>
        <dt className="text-white/70">{t("booking.cards.people")}</dt>
        <dd>{card.partySize}</dd>
        <dt className="text-white/70">{t("booking.cards.total")}</dt>
        <dd>{money(card.totalCents, card.currency, locale)}</dd>
        <dt className="text-white/70">{t("booking.cards.depositNow")}</dt>
        <dd className="font-semibold">{money(card.depositCents, card.currency, locale)}</dd>
        <dt className="text-white/70">{t("booking.cards.balanceLater")}</dt>
        <dd>{money(card.balanceCents, card.currency, locale)}</dd>
      </dl>
      <p className="mt-2 text-white/70">
        {t("booking.cards.cancellation").replace("{hours}", String(card.cancellationWindowHours))}
      </p>
      <p className="text-white/60">{t("booking.cards.validUntil").replace("{time}", expiresAt)}</p>

      {lapsed ? (
        <div className="mt-3 space-y-2" aria-live="polite">
          <p className="text-amber-200">{t(`booking.cards.${state}`)}</p>
          <Button type="button" variant="secondary" className="w-full" disabled={busy} onClick={onRequote}>
            {t("booking.cards.requote")}
          </Button>
        </div>
      ) : (
        <div className="mt-3 space-y-1">
          <Button
            type="button"
            className="w-full"
            disabled={busy || state === "accepting"}
            onClick={() => onAccept(card.quoteId)}
          >
            {state === "accepting" ? t("booking.cards.accepting") : t("booking.cards.accept")}
          </Button>
          {state === "failed" && <p className="text-amber-200">{t("booking.cards.failed")}</p>}
        </div>
      )}
    </CardShell>
  );
}

function BookingCardView({ card, t }: { card: BookingSummaryCard; t: T }) {
  return (
    <CardShell title={`${t("booking.cards.bookingTitle")} ${card.reference}`} t={t}>
      <p>{t(`booking.cards.status.${card.status}`)}</p>
      {card.link && (
        <a href={card.link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block underline">
          {t("booking.cards.viewBooking")}
        </a>
      )}
    </CardShell>
  );
}

function PaymentCardView({ card, t, locale }: { card: PaymentCard; t: T; locale: Locale }) {
  return (
    <CardShell title={t("booking.cards.paymentTitle")} t={t}>
      <p className="font-semibold">{money(card.amountCents, card.currency, locale)}</p>
      <p className="text-white/60">{t("booking.cards.payBefore").replace("{time}", clockTime(card.expiresAt, locale))}</p>
      <p className="text-white/60">{t("booking.cards.sandbox")}</p>
      <a href={card.approvalUrl} className="mt-2 inline-block underline">
        {t("booking.cards.pay")}
      </a>
    </CardShell>
  );
}

function CancellationCardView({ card, t }: { card: CancellationCard; t: T }) {
  return (
    <CardShell title={t("booking.cards.cancellationTitle")} t={t}>
      <CancellationConfirm capability={card.capability} terms={card} />
    </CardShell>
  );
}

function InvoiceCardView({ card, t, locale }: { card: InvoiceCard; t: T; locale: Locale }) {
  return (
    <CardShell title={`${t("booking.invoice.title")} ${card.reference}`} t={t}>
      <p className="font-semibold">{money(card.amountCents, card.currency, locale)}</p>
      <p className="text-white/60">{t("booking.invoice.dueOn").replace("{date}", card.dueDate)}</p>
      <BalanceInvoiceStatusView status={card.status} url={card.invoiceUrl} />
      <p className="text-white/60">{t("booking.cards.sandbox")}</p>
    </CardShell>
  );
}

/**
 * Booking chat cards under an assistant bubble (PayPal hackathon plan, Phase
 * 3). The quote card's button is the only way to accept an offer; capability
 * and approval links appear here and never in the model's text.
 */
export function BookingCards({ cards, quoteStates, onAccept, onRequote, busy = false }: BookingCardsProps) {
  const { t, locale } = useTranslation();

  return (
    <>
      {cards.map((card, index) => {
        switch (card.kind) {
          case "offer":
            return <OfferCardView key={index} card={card} t={t} locale={locale} />;
          case "quote":
            return (
              <QuoteCardView
                key={card.quoteId}
                card={card}
                state={quoteStates[card.quoteId]}
                onAccept={onAccept}
                onRequote={onRequote}
                busy={busy}
                t={t}
                locale={locale}
              />
            );
          case "booking":
            return <BookingCardView key={card.bookingId} card={card} t={t} />;
          case "payment":
            return <PaymentCardView key={`pay-${card.bookingId}`} card={card} t={t} locale={locale} />;
          case "cancellation":
            return <CancellationCardView key={`cancel-${card.bookingId}`} card={card} t={t} />;
          case "invoice":
            return <InvoiceCardView key={`invoice-${card.bookingId}`} card={card} t={t} locale={locale} />;
        }
      })}
    </>
  );
}
