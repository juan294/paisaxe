"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CalendarCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { clockTime, money } from "@/lib/booking-format";
import { csrfHeaders } from "@/lib/csrf-client";
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

  const reissue = async (booking: OperatorBooking) => {
    if (!window.confirm(`¿Reemitir el enlace de ${booking.reference}? El enlace anterior dejará de funcionar.`)) return;
    const response = await post(`/bookings/${booking.id}/reissue-link`);
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
    <BookingTable bookings={bookings} disabled={busy} onReissue={(booking) => void reissue(booking)} />
  );

  return (
    <Shell>
      <header className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">Panel de operador</p>
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
        <MoneyTile testId="tile-deposits" label="Depósitos cobrados" cents={view.summary.depositsCollectedCents} />
        <MoneyTile testId="tile-balance" label="Pendiente de cobro" cents={view.summary.balanceDueCents} />
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
              <code className="block break-all rounded bg-black/5 p-2 text-sm dark:bg-white/10">{issued.url}</code>
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
                  <span className="font-mono">{hold.reference ?? hold.id}</span> · {hold.experienceTitle} · {hold.slotDate}{" "}
                  {hold.slotTime} · {hold.partySize} pers. · caduca a las {clockTime(hold.expiresAt, "es")}
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
    </Shell>
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
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-left text-sm">
        <thead className="font-mono text-[10px] uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
          <tr>
            {["Referencia", "Actividad", "Fecha", "Personas", "Estado", "Depósito", "Pendiente", "Pago", ""].map((label) => (
              <th key={label} scope="col" className="p-2">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {bookings.map((booking) => (
            <tr
              key={booking.id}
              data-exception={String(booking.exception)}
              className={booking.exception ? "bg-[#c9a55c]/15" : undefined}
            >
              <td className="p-2 font-mono">{booking.reference}</td>
              <td className="p-2">{booking.experienceTitle}</td>
              <td className="whitespace-nowrap p-2">
                {booking.slotDate} {booking.slotTime}
              </td>
              <td className="p-2">{booking.partySize}</td>
              <td className="p-2">
                <span>{BOOKING_STATUS[booking.status] ?? booking.status}</span>
                {booking.exception && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[#c9a55c]/30 px-2 py-0.5 text-xs font-medium">
                    Incidencia
                  </span>
                )}
              </td>
              <td className="p-2">{eur(booking.depositCents, booking.currency)}</td>
              <td className="p-2">{eur(booking.balanceCents, booking.currency)}</td>
              <td className="space-y-0.5 p-2 font-mono text-xs">
                {booking.payment ? (
                  <>
                    <span className="block font-sans">{PAYMENT_STATUS[booking.payment.status] ?? booking.payment.status}</span>
                    {booking.payment.orderId && <span className="block">Pedido {booking.payment.orderId}</span>}
                    {booking.payment.captureId && <span className="block">Cobro {booking.payment.captureId}</span>}
                    {booking.payment.refundId && <span className="block">Reembolso {booking.payment.refundId}</span>}
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td className="p-2">
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
              </td>
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
              <th scope="col" className="p-1 text-left">
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
                <th scope="row" className="p-1 text-left font-mono">
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

function MoneyTile({ testId, label, cents }: { testId: string; label: string; cents: number }) {
  return (
    <Card data-testid={testId} className="rounded-2xl p-5">
      <p className="text-2xl font-extralight tabular-nums tracking-tight">{eur(cents)}</p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">{label}</p>
    </Card>
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
  return <p className="text-sm text-[#6b6560] dark:text-[#a39e98]">{children}</p>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f5f3ee] px-4 py-10 text-[#2d2a26] dark:bg-[#1c1a17] dark:text-[#f5f3ee]">
      <div className="mx-auto w-full max-w-6xl space-y-8">{children}</div>
    </main>
  );
}
