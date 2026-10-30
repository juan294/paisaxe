"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CalendarCheck, Hourglass, TriangleAlert, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatCard } from "@/components/ui/stat-card";
import { clockTime, dateTime, money, slotDay } from "@/lib/booking-format";
import { csrfHeaders } from "@/lib/csrf-client";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n/interpolate";
import { bookingDisplayText } from "@/lib/booking/display";
import type { OperatorBooking, OperatorCapacity, OperatorHold, OperatorView } from "@/lib/booking/operator";
import type { LedgerMatch, OperatorLedgerResponse } from "@/types/operator-ledger";

/** Existing operator locales retain Spanish copy; the English demo uses its own dictionary. */
function useOperatorCopy() {
  const { t, locale } = useTranslation();
  return { t: (key: string) => t(`operator.${key}`), locale: locale === "en" ? "en" as const : "es" as const };
}

/** Unknown provider states keep the previous raw-state fallback rather than a translation key. */
function operatorStatus(t: (key: string) => string, kind: "bookingStatus" | "paymentStatus", status: string): string {
  const key = `${kind}.${status}`;
  const value = t(key);
  return value === `operator.${key}` ? status : value;
}

/**
 * The Madrid calendar day of an instant, "YYYY-MM-DD" like the view's `today`. Same as madridDate in
 * src/lib/booking/types.ts, which this client page does not import: that module brings zod with it.
 */
const madridDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date(iso));

/** The matches the summary counts as confirmed by PayPal's records. */
const CONFIRMED = new Set<LedgerMatch>(["matches", "refunded"]);

/** The small rounded labels in the booking rows; ATTENTION is the "needs a look" tone. */
const PILL = "inline-flex rounded-full px-2 py-0.5 text-xs font-medium";
const ATTENTION = "bg-admin-warning/30";

type Load = { kind: "loading" } | { kind: "notFound" } | { kind: "failed" } | { kind: "ready"; view: OperatorView };
type Ledger = { checking: boolean; result: OperatorLedgerResponse | null };

const eur = (cents: number, currency = "EUR", locale: "es" | "en" = "es") => money(cents, currency, locale);
const when = (date: string, time: string, locale: "es" | "en") => `${slotDay(date, locale)} · ${time}`;

function dayLabel(date: string, locale: "es" | "en"): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "es-ES", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`)
  );
}

/**
 * The operator view (PayPal hackathon plan, Phase 5). Everything loads through
 * the capability API, so a bad or expired link gets that route's real 404 and
 * this page shows no data. Actions are CSRF-protected POSTs; a re-issued
 * visitor link is shown once and kept only in this component's state.
 */
export function OperatorDashboard() {
  const { t, locale } = useOperatorCopy();
  const { capability } = useParams<{ capability: string }>();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [onlyExceptions, setOnlyExceptions] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ reference: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // The booking stays set while the dialog closes, so its title does not blank out mid-animation.
  const [reissueTarget, setReissueTarget] = useState<OperatorBooking | null>(null);
  const [reissueOpen, setReissueOpen] = useState(false);
  const [ledger, setLedger] = useState<Ledger>({ checking: false, result: null });

  // Read-only check of the deposits against PayPal's records; the last answer stays shown while a new one loads.
  const checkLedger = useCallback(async () => {
    setLedger((current) => ({ ...current, checking: true }));
    let result: OperatorLedgerResponse = { state: "unavailable", reason: "error" };
    try {
      const response = await fetch(`/api/operator/${capability}/paypal-ledger`, { cache: "no-store" });
      if (response.ok) result = (await response.json()) as OperatorLedgerResponse;
    } catch {
      // Unavailable, as above.
    }
    setLedger({ checking: false, result });
  }, [capability]);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/operator/${capability}`, { cache: "no-store" });
      if (response.status === 404) return setLoad({ kind: "notFound" });
      if (!response.ok) return setLoad((current) => (current.kind === "ready" ? current : { kind: "failed" }));
      setLoad({ kind: "ready", view: (await response.json()) as OperatorView });
    } catch {
      setLoad((current) => (current.kind === "ready" ? current : { kind: "failed" }));
    }
  }, [capability]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Once, after the view first loads (decision D8); later checks come from the button.
  const ready = load.kind === "ready";
  useEffect(() => {
    if (ready) void checkLedger();
  }, [ready, checkLedger]);

  const post = async (path: string) => {
    setBusy(true);
    setNotice(null);
    try {
      return await fetch(`/api/operator/${capability}${path}`, { method: "POST", headers: csrfHeaders() });
    } catch {
      return null;
    } finally {
      setBusy(false);
    }
  };

  const release = async (hold: OperatorHold) => {
    const response = await post(`/holds/${hold.id}/release`);
    if (!response?.ok) setNotice(response?.status === 409 ? t("holdNotLive") : t("actionFailed"));
    await refresh();
  };

  const askReissue = (booking: OperatorBooking) => {
    setReissueTarget(booking);
    setReissueOpen(true);
  };

  const reissue = async (booking: OperatorBooking) => {
    const response = await post(`/bookings/${booking.id}/reissue-link`);
    setReissueOpen(false);
    const body = response?.ok ? ((await response.json().catch(() => null)) as { link?: string } | null) : null;
    if (!body?.link) {
      setNotice(t("actionFailed"));
      if (response?.status === 404) await refresh();
      return;
    }
    setIssued({ reference: booking.reference, url: `${window.location.origin}${body.link}` });
  };

  if (load.kind !== "ready") {
    return (
      <Shell>
        <p aria-live="polite">
          {load.kind === "loading"
            ? t("loading")
            : load.kind === "notFound"
              ? t("invalidLink")
              : t("loadFailed")}
        </p>
        {load.kind === "failed" && (
          <Button type="button" variant="outline" onClick={() => void refresh()}>
            {t("retry")}
          </Button>
        )}
      </Shell>
    );
  }

  const { view } = load;
  const shown = onlyExceptions ? view.bookings.filter((booking) => booking.exception) : view.bookings;
  const upcoming = shown.filter((booking) => booking.slotDate >= view.today);
  const recent = shown.filter((booking) => booking.slotDate < view.today).reverse();
  // Null while the first check loads; empty when PayPal could not answer.
  const matches = ledger.result === null ? null : ledger.result.state === "ok" ? ledger.result.bookings : {};
  const table = (bookings: OperatorBooking[]) => (
    <BookingTable bookings={bookings} disabled={busy} matches={matches} onReissue={askReissue} />
  );

  return (
    <Shell>
      <header className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-widest text-admin-muted">{t("title")}</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{bookingDisplayText(view.merchant.name, locale)}</h1>
          {view.merchant.isFixture && (
            <span className="rounded-full bg-admin-warning/20 px-2 py-0.5 font-mono text-xs uppercase text-[#8b7355]">demo</span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={<CalendarCheck className="size-5" />}
          value={view.summary.upcoming}
          label={t("upcoming")}
          variant="default"
          isActive={false}
          onClick={() => setOnlyExceptions(false)}
          ariaLabel={`${t("upcoming")}: ${view.summary.upcoming}`}
        />
        <MoneyTile
          testId="tile-deposits"
          icon={<Wallet className="size-5" />}
          label={t("depositsCollected")}
          cents={view.summary.depositsCollectedCents}
        />
        <MoneyTile
          testId="tile-balance"
          icon={<Hourglass className="size-5" />}
          label={t("balanceDue")}
          cents={view.summary.balanceDueCents}
        />
        <StatCard
          icon={<TriangleAlert className="size-5" />}
          value={view.summary.exceptions}
          label={t("exceptions")}
          variant="warning"
          isActive={onlyExceptions}
          onClick={() => setOnlyExceptions((current) => !current)}
          ariaLabel={`${t("exceptions")}: ${view.summary.exceptions}`}
        />
      </div>

      <LedgerSummary view={view} ledger={ledger} onCheck={() => void checkLedger()} />

      <div aria-live="polite" className="space-y-3">
        {notice && <p className="text-[#8b7355]">{notice}</p>}
        {issued && (
          <Card className="border-admin-warning">
            <CardContent className="space-y-2 pt-6">
              <p>
                {interpolate(t("newLink"), { reference: issued.reference })}
              </p>
              <code className="block break-all rounded bg-black/5 p-2 text-sm">{issued.url}</code>
              <Button type="button" size="sm" onClick={() => setIssued(null)}>
                {t("done")}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Section title={t("upcomingBookings")}>{upcoming.length > 0 ? table(upcoming) : <Empty>{t("noUpcoming")}</Empty>}</Section>
      <Section title={t("recentBookings")}>{recent.length > 0 ? table(recent) : <Empty>{t("noRecent")}</Empty>}</Section>

      <Section title={t("activeHolds")}>
        {view.holds.length === 0 ? (
          <Empty>{t("noHolds")}</Empty>
        ) : (
          <ul className="divide-y rounded-xl border">
            {view.holds.map((hold) => (
              <li key={hold.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                <span>
                  <span className="font-mono">{hold.reference ?? hold.id}</span> · {bookingDisplayText(hold.experienceTitle, locale)} ·{" "}
                  {when(hold.slotDate, hold.slotTime, locale)} · {hold.partySize} {t("peopleShort")} · {interpolate(t("expiresAt"), { time: clockTime(hold.expiresAt, locale) })}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  aria-label={interpolate(t("releaseHoldLabel"), { reference: hold.reference ?? hold.id })}
                  onClick={() => void release(hold)}
                >
                  {t("release")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("places14")}>
        {view.capacity.map((experience) => (
          <CapacityTable key={experience.id} experience={experience} />
        ))}
      </Section>

      <Dialog open={reissueOpen} onOpenChange={(open) => !open && !busy && setReissueOpen(false)}>
        <DialogContent hideCloseButton className="w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white text-admin-ink">
          <DialogHeader>
            <DialogTitle>{interpolate(t("reissueTitle"), { reference: reissueTarget?.reference ?? "" })}</DialogTitle>
            <DialogDescription className="text-admin-muted">{t("previousLinkWarning")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setReissueOpen(false)}>{t("cancel")}</Button>
            <Button type="button" disabled={busy} onClick={() => reissueTarget && void reissue(reissueTarget)}>
              {busy ? t("reissuing") : t("reissue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}

const COLUMNS = ["reference", "activity", "date", "people", "status", "deposit", "balance", "payment", "actions"] as const;

// Below md each row stacks into a card and each cell into a captioned line (one DOM, D8).
// The explicit roles keep the table semantics once `display` changes.
const CELL =
  "p-2 max-md:flex max-md:items-baseline max-md:justify-between max-md:gap-3 max-md:px-0 max-md:py-1 max-md:text-right max-md:before:shrink-0 max-md:before:text-left max-md:before:font-mono max-md:before:text-[10px] max-md:before:uppercase max-md:before:tracking-widest max-md:before:text-admin-muted max-md:before:content-[attr(data-label)]";

function Cell({ label, className, children }: { label: (typeof COLUMNS)[number]; className?: string; children: React.ReactNode }) {
  const { t } = useOperatorCopy();
  return (
    <td role="cell" data-label={t(`columns.${label}`)} className={cn(CELL, className)}>
      <div className="min-w-0">{children}</div>
    </td>
  );
}

function BookingTable({
  bookings,
  disabled,
  matches,
  onReissue,
}: {
  bookings: OperatorBooking[];
  disabled: boolean;
  /** Null while the first PayPal check loads: each captured deposit keeps its chip's space so the rows do not grow. */
  matches: Record<string, LedgerMatch> | null;
  onReissue: (booking: OperatorBooking) => void;
}) {
  const { t, locale } = useOperatorCopy();
  return (
    <div className="md:overflow-x-auto md:rounded-xl md:border">
      <table role="table" className="w-full text-left text-sm max-md:block">
        <thead role="rowgroup" className="font-mono text-[10px] uppercase tracking-widest text-admin-muted max-md:sr-only">
          <tr role="row">
            {COLUMNS.map((label) => (
              <th key={label} role="columnheader" scope="col" className="p-2">
                {label === "actions" ? <span className="sr-only">{t(`columns.${label}`)}</span> : t(`columns.${label}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup" className="divide-y max-md:block max-md:space-y-3 max-md:divide-y-0">
          {bookings.map((booking) => (
            <tr
              key={booking.id}
              role="row"
              data-exception={String(booking.exception)}
              className={cn(
                "max-md:block max-md:rounded-xl max-md:border max-md:p-3",
                booking.exception ? "bg-admin-warning/15" : "max-md:bg-white"
              )}
            >
              <Cell label="reference" className="font-mono">
                {booking.reference}
              </Cell>
              <Cell label="activity">{bookingDisplayText(booking.experienceTitle, locale)}</Cell>
              <Cell label="date" className="whitespace-nowrap">
                {when(booking.slotDate, booking.slotTime, locale)}
              </Cell>
              <Cell label="people">{booking.partySize}</Cell>
              <Cell label="status">
                <span>{operatorStatus(t, "bookingStatus", booking.status)}</span>
                {booking.exception && (
                  <span className={cn(PILL, ATTENTION, "ml-2 items-center gap-1")}>
                    {t("exception")}
                  </span>
                )}
              </Cell>
              <Cell label="deposit" className="tabular-nums">
                {eur(booking.depositCents, booking.currency, locale)}
              </Cell>
              <Cell label="balance" className="tabular-nums">
                {eur(booking.balanceCents, booking.currency, locale)}
              </Cell>
              <Cell label="payment" className="space-y-0.5 font-mono text-xs">
                {booking.payment ? (
                  <>
                    <span className="block font-sans">{operatorStatus(t, "paymentStatus", booking.payment.status)}</span>
                    {booking.payment.orderId && <span className="block whitespace-nowrap max-md:whitespace-normal max-md:break-all">{t("orderId")} {booking.payment.orderId}</span>}
                    {booking.payment.captureId && <span className="block whitespace-nowrap max-md:whitespace-normal max-md:break-all">{t("captureId")} {booking.payment.captureId}</span>}
                    {booking.payment.refundId && <span className="block whitespace-nowrap max-md:whitespace-normal max-md:break-all">{t("refundId")} {booking.payment.refundId}</span>}
                    <LedgerChip match={matches?.[booking.id]} reserve={matches === null && booking.payment.captureId !== null} />
                  </>
                ) : (
                  "—"
                )}
              </Cell>
              <Cell label="actions" className="max-md:items-center">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={disabled}
                  aria-label={interpolate(t("reissueLinkLabel"), { reference: booking.reference })}
                  onClick={() => onReissue(booking)}
                >
                  {t("reissueLink")}
                </Button>
              </Cell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CHIP = cn(PILL, "mt-1 font-sans text-admin-ink");

function LedgerChip({ match, reserve }: { match: LedgerMatch | undefined; reserve: boolean }) {
  const { t } = useOperatorCopy();
  if (reserve) {
    return (
      <span data-testid="ledger-chip-placeholder" aria-hidden="true" className={cn(CHIP, "invisible")}>
        {t("ledger.matches")}
      </span>
    );
  }
  if (!match || match === "not_applicable") return null;
  return (
    <span data-testid="ledger-chip" className={cn(CHIP, match === "mismatch" ? ATTENTION : "bg-black/5")}>
      {t(`ledger.${match}`)}
    </span>
  );
}


/**
 * One line above the bookings: how many deposits PayPal's own records confirm,
 * as of PayPal's last refresh (it lists movements up to about three hours late).
 */
function LedgerSummary({ view, ledger, onCheck }: { view: OperatorView; ledger: Ledger; onCheck: () => void }) {
  const { result, checking } = ledger;
  const { t, locale } = useOperatorCopy();
  let text = t("ledgerChecking");
  let action = t("ledgerAgain");
  if (result?.state === "unavailable") {
    text = t("ledgerUnavailable");
    action = t("retry");
  } else if (result?.state === "ok") {
    const matched = view.bookings.map((booking) => result.bookings[booking.id]).filter((match): match is LedgerMatch => Boolean(match) && match !== "not_applicable");
    const confirmed = matched.filter((match) => CONFIRMED.has(match));
    text = interpolate(t("ledgerSummary"), { confirmed: String(confirmed.length), total: String(matched.length) });
    if (result.refreshedAt) {
      text +=
        madridDay(result.refreshedAt) === view.today
          ? interpolate(t("ledgerTime"), { time: clockTime(result.refreshedAt, locale) })
          : interpolate(t("ledgerDate"), { date: dateTime(result.refreshedAt, locale) });
    }
  }
  // The minimum heights hold the longest answer ("PayPal confirma N de M depósitos · datos de PayPal del <date>")
  // wrapped on a phone, so the bookings below do not move when it arrives. Re-measure if that copy changes.
  return (
    <section
      aria-label={t("ledgerRegion")}
      className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1 text-sm max-md:min-h-[4.75rem]"
    >
      <p aria-live="polite" className="text-admin-ink">
        {text}
        {result?.state === "ok" && result.truncated && (
          <span className="block text-xs text-admin-muted">{t("ledgerTruncated")}</span>
        )}
      </p>
      {/* aria-disabled, not disabled: a keyboard user keeps focus on the button while it checks. */}
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-disabled={checking}
        className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        onClick={() => !checking && onCheck()}
      >
        {action}
      </Button>
    </section>
  );
}

function CapacityTable({ experience }: { experience: OperatorCapacity }) {
  const { t, locale } = useOperatorCopy();
  const dates = [...new Set(experience.slots.map((slot) => slot.date))];
  const times = [...new Set(experience.slots.map((slot) => slot.startTime))].sort();
  const placesAt = new Map(experience.slots.map((slot) => [`${slot.date} ${slot.startTime}`, slot.available]));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{bookingDisplayText(experience.title, locale)}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="text-center text-xs tabular-nums">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 bg-card p-1 text-left">
                {t("time")}
              </th>
              {dates.map((date) => (
                <th key={date} scope="col" className="p-1 font-normal">
                  {dayLabel(date, locale)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {times.map((time) => (
              <tr key={time}>
                <th scope="row" className="sticky left-0 bg-card p-1 text-left font-mono">
                  {time}
                </th>
                {dates.map((date) => {
                  const places = placesAt.get(`${date} ${time}`);
                  return (
                    <td key={date} className={places === 0 ? "p-1 text-admin-muted" : "p-1"}>
                      {places === undefined ? "—" : `${places}/${experience.capacity}`}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

/** StatCard's look without the button: same container, icon slot and type, so the four tiles line up. */
function MoneyTile({ testId, icon, label, cents }: { testId: string; icon: React.ReactNode; label: string; cents: number }) {
  const { locale } = useOperatorCopy();
  return (
    <div data-testid={testId} className="min-w-0 rounded-2xl bg-white p-5 text-left">
      <div className="mb-4 text-admin-muted">{icon}</div>
      {/* leading-10 keeps text-4xl's line box at the smaller phone size, so the tile height matches StatCard. */}
      <p className="text-2xl leading-10 font-extralight tabular-nums tracking-tighter text-admin-ink lg:text-4xl">{eur(cents, "EUR", locale)}</p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-admin-muted">{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-admin-muted">{children}</p>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-admin-paper px-4 py-10 text-admin-ink">
      <div className="mx-auto w-full max-w-6xl space-y-8">{children}</div>
    </main>
  );
}
