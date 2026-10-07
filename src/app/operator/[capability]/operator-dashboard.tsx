"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CalendarCheck, Hourglass, TriangleAlert, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatCard } from "@/components/ui/stat-card";
import { clockTime, money, slotDay } from "@/lib/booking-format";
import { csrfHeaders } from "@/lib/csrf-client";
import { cn } from "@/lib/utils";
import type { OperatorBooking, OperatorCapacity, OperatorHold, OperatorView } from "@/lib/booking/operator";

// Merchant-facing copy is Spanish only: the operator is the Asturian provider.
const BOOKING_STATUS: Record<string, string> = {
  pending_payment: "Pendiente de pago",
  confirmed: "Confirmada",
  cancel_pending: "Cancelación en curso",
  cancelled: "Cancelada",
  expired: "Caducada",
  refund_pending: "Reembolso en curso",
  refunded: "Reembolsada",
  needs_attention: "Requiere atención",
};

const PAYMENT_STATUS: Record<string, string> = {
  created: "Pedido creado",
  approved: "Aprobado",
  capture_pending: "Cobro pendiente",
  captured: "Cobrado",
  capture_failed: "Cobro fallido",
  expired: "Caducado",
  refund_pending: "Reembolso en curso",
  refunded: "Reembolsado",
  refund_failed: "Reembolso fallido",
};

const ACTION_FAILED = "No se pudo completar la acción. Inténtalo de nuevo.";
const HOLD_NOT_LIVE = "Ese bloqueo ya no estaba activo.";

type Load = { kind: "loading" } | { kind: "notFound" } | { kind: "failed" } | { kind: "ready"; view: OperatorView };

const eur = (cents: number, currency = "EUR") => money(cents, currency, "es");
const when = (date: string, time: string) => `${slotDay(date, "es")} · ${time}`;

function dayLabel(date: string): string {
  return new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(
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
  const { capability } = useParams<{ capability: string }>();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [onlyExceptions, setOnlyExceptions] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ reference: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // The booking stays set while the dialog closes, so its title does not blank out mid-animation.
  const [reissueTarget, setReissueTarget] = useState<OperatorBooking | null>(null);
  const [reissueOpen, setReissueOpen] = useState(false);

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
    if (!response?.ok) setNotice(response?.status === 409 ? HOLD_NOT_LIVE : ACTION_FAILED);
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
      setNotice(ACTION_FAILED);
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
            ? "Cargando…"
            : load.kind === "notFound"
              ? "Este enlace de operador no es válido o ha caducado."
              : "No se pudo cargar el panel."}
        </p>
        {load.kind === "failed" && (
          <Button type="button" variant="outline" onClick={() => void refresh()}>
            Reintentar
          </Button>
        )}
      </Shell>
    );
  }

  const { view } = load;
  const shown = onlyExceptions ? view.bookings.filter((booking) => booking.exception) : view.bookings;
  const upcoming = shown.filter((booking) => booking.slotDate >= view.today);
  const recent = shown.filter((booking) => booking.slotDate < view.today).reverse();
  const table = (bookings: OperatorBooking[]) => (
    <BookingTable bookings={bookings} disabled={busy} onReissue={askReissue} />
  );

  return (
    <Shell>
      <header className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[#6b6560]">Panel de operador</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{view.merchant.name}</h1>
          {view.merchant.isFixture && (
            <span className="rounded-full bg-[#c9a55c]/20 px-2 py-0.5 font-mono text-xs uppercase text-[#8b7355]">demo</span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={<CalendarCheck className="size-5" />}
          value={view.summary.upcoming}
          label="Próximas"
          variant="default"
          isActive={false}
          onClick={() => setOnlyExceptions(false)}
          ariaLabel={`Próximas: ${view.summary.upcoming}`}
        />
        <MoneyTile
          testId="tile-deposits"
          icon={<Wallet className="size-5" />}
          label="Depósitos cobrados"
          cents={view.summary.depositsCollectedCents}
        />
        <MoneyTile
          testId="tile-balance"
          icon={<Hourglass className="size-5" />}
          label="Pendiente de cobro"
          cents={view.summary.balanceDueCents}
        />
        <StatCard
          icon={<TriangleAlert className="size-5" />}
          value={view.summary.exceptions}
          label="Incidencias"
          variant="warning"
          isActive={onlyExceptions}
          onClick={() => setOnlyExceptions((current) => !current)}
          ariaLabel={`Incidencias: ${view.summary.exceptions}`}
        />
      </div>

      <div aria-live="polite" className="space-y-3">
        {notice && <p className="text-[#8b7355]">{notice}</p>}
        {issued && (
          <Card className="border-[#c9a55c]">
            <CardContent className="space-y-2 pt-6">
              <p>
                Nuevo enlace para {issued.reference}. Cópialo ahora: no se volverá a mostrar. El anterior ya no funciona.
              </p>
              <code className="block break-all rounded bg-black/5 p-2 text-sm">{issued.url}</code>
              <Button type="button" size="sm" onClick={() => setIssued(null)}>
                Hecho
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Section title="Próximas reservas">{upcoming.length > 0 ? table(upcoming) : <Empty>No hay reservas próximas.</Empty>}</Section>
      <Section title="Últimos 7 días">{recent.length > 0 ? table(recent) : <Empty>No hay reservas recientes.</Empty>}</Section>

      <Section title="Bloqueos activos">
        {view.holds.length === 0 ? (
          <Empty>No hay bloqueos activos.</Empty>
        ) : (
          <ul className="divide-y rounded-xl border">
            {view.holds.map((hold) => (
              <li key={hold.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                <span>
                  <span className="font-mono">{hold.reference ?? hold.id}</span> · {hold.experienceTitle} ·{" "}
                  {when(hold.slotDate, hold.slotTime)} · {hold.partySize} pers. · caduca a las {clockTime(hold.expiresAt, "es")}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  aria-label={`Liberar bloqueo ${hold.reference ?? hold.id}`}
                  onClick={() => void release(hold)}
                >
                  Liberar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Plazas libres (14 días)">
        {view.capacity.map((experience) => (
          <CapacityTable key={experience.id} experience={experience} />
        ))}
      </Section>

      <Dialog open={reissueOpen} onOpenChange={(open) => !open && !busy && setReissueOpen(false)}>
        <DialogContent hideCloseButton className="w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white text-[#2d2a26]">
          <DialogHeader>
            <DialogTitle>Reemitir enlace de {reissueTarget?.reference}</DialogTitle>
            <DialogDescription className="text-[#6b6560]">El enlace anterior dejará de funcionar.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setReissueOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={busy} onClick={() => reissueTarget && void reissue(reissueTarget)}>
              {busy ? "Reemitiendo…" : "Reemitir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}

const COLUMNS = ["Referencia", "Actividad", "Fecha", "Personas", "Estado", "Depósito", "Pendiente", "Pago", "Acciones"] as const;

// Below md each row stacks into a card and each cell into a captioned line (one DOM, D8).
// The explicit roles keep the table semantics once `display` changes.
const CELL =
  "p-2 max-md:flex max-md:items-baseline max-md:justify-between max-md:gap-3 max-md:px-0 max-md:py-1 max-md:text-right max-md:before:shrink-0 max-md:before:text-left max-md:before:font-mono max-md:before:text-[10px] max-md:before:uppercase max-md:before:tracking-widest max-md:before:text-[#6b6560] max-md:before:content-[attr(data-label)]";

function Cell({ label, className, children }: { label: (typeof COLUMNS)[number]; className?: string; children: React.ReactNode }) {
  return (
    <td role="cell" data-label={label} className={cn(CELL, className)}>
      <div className="min-w-0">{children}</div>
    </td>
  );
}

function BookingTable({
  bookings,
  disabled,
  onReissue,
}: {
  bookings: OperatorBooking[];
  disabled: boolean;
  onReissue: (booking: OperatorBooking) => void;
}) {
  return (
    <div className="md:overflow-x-auto md:rounded-xl md:border">
      <table role="table" className="w-full text-left text-sm max-md:block">
        <thead role="rowgroup" className="font-mono text-[10px] uppercase tracking-widest text-[#6b6560] max-md:sr-only">
          <tr role="row">
            {COLUMNS.map((label) => (
              <th key={label} role="columnheader" scope="col" className="p-2">
                {label === "Acciones" ? <span className="sr-only">{label}</span> : label}
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
                booking.exception ? "bg-[#c9a55c]/15" : "max-md:bg-white"
              )}
            >
              <Cell label="Referencia" className="font-mono">
                {booking.reference}
              </Cell>
              <Cell label="Actividad">{booking.experienceTitle}</Cell>
              <Cell label="Fecha" className="whitespace-nowrap">
                {when(booking.slotDate, booking.slotTime)}
              </Cell>
              <Cell label="Personas">{booking.partySize}</Cell>
              <Cell label="Estado">
                <span>{BOOKING_STATUS[booking.status] ?? booking.status}</span>
                {booking.exception && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[#c9a55c]/30 px-2 py-0.5 text-xs font-medium">
                    Incidencia
                  </span>
                )}
              </Cell>
              <Cell label="Depósito" className="tabular-nums">
                {eur(booking.depositCents, booking.currency)}
              </Cell>
              <Cell label="Pendiente" className="tabular-nums">
                {eur(booking.balanceCents, booking.currency)}
              </Cell>
              <Cell label="Pago" className="space-y-0.5 font-mono text-xs">
                {booking.payment ? (
                  <>
                    <span className="block font-sans">{PAYMENT_STATUS[booking.payment.status] ?? booking.payment.status}</span>
                    {booking.payment.orderId && <span className="block whitespace-nowrap max-md:whitespace-normal max-md:break-all">Pedido {booking.payment.orderId}</span>}
                    {booking.payment.captureId && <span className="block whitespace-nowrap max-md:whitespace-normal max-md:break-all">Cobro {booking.payment.captureId}</span>}
                    {booking.payment.refundId && <span className="block whitespace-nowrap max-md:whitespace-normal max-md:break-all">Reembolso {booking.payment.refundId}</span>}
                  </>
                ) : (
                  "—"
                )}
              </Cell>
              <Cell label="Acciones" className="max-md:items-center">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={disabled}
                  aria-label={`Reemitir enlace ${booking.reference}`}
                  onClick={() => onReissue(booking)}
                >
                  Reemitir enlace
                </Button>
              </Cell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CapacityTable({ experience }: { experience: OperatorCapacity }) {
  const dates = [...new Set(experience.slots.map((slot) => slot.date))];
  const times = [...new Set(experience.slots.map((slot) => slot.startTime))].sort();
  const placesAt = new Map(experience.slots.map((slot) => [`${slot.date} ${slot.startTime}`, slot.available]));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{experience.title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="text-center text-xs tabular-nums">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 bg-card p-1 text-left">
                Hora
              </th>
              {dates.map((date) => (
                <th key={date} scope="col" className="p-1 font-normal">
                  {dayLabel(date)}
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
                    <td key={date} className={places === 0 ? "p-1 text-[#6b6560]" : "p-1"}>
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
  return (
    <div data-testid={testId} className="min-w-0 rounded-2xl bg-white p-5 text-left">
      <div className="mb-4 text-[#6b6560]">{icon}</div>
      {/* leading-10 keeps text-4xl's line box at the smaller phone size, so the tile height matches StatCard. */}
      <p className="text-2xl leading-10 font-extralight tabular-nums tracking-tighter text-[#2d2a26] lg:text-4xl">{eur(cents)}</p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-[#6b6560]">{label}</p>
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
  return <p className="text-sm text-[#6b6560]">{children}</p>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f5f3ee] px-4 py-10 text-[#2d2a26]">
      <div className="mx-auto w-full max-w-6xl space-y-8">{children}</div>
    </main>
  );
}
