import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clockTime, dateTime, slotDay } from "@/lib/booking-format";
import type { OperatorBooking, OperatorView } from "@/lib/booking/operator";
import type { OperatorLedgerResponse } from "@/types/operator-ledger";

const CAPABILITY = "11111111-2222-4333-8444-555555555555.AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde";

vi.mock("next/navigation", () => ({ useParams: () => ({ capability: CAPABILITY }) }));
vi.mock("@/lib/csrf-client", () => ({ csrfHeaders: () => ({ "x-csrf-token": "csrf-1" }) }));

const { OperatorDashboard } = await import("./operator-dashboard");

const mockFetch = vi.fn();
/** The PayPal check's own fetch, so the view and action sequences above stay as they were. */
const ledgerFetch = vi.fn();
const confirm = vi.fn(() => true);
const LEDGER_URL = `/api/operator/${CAPABILITY}/paypal-ledger`;

function json(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body };
}

function booking(overrides: Partial<OperatorBooking> = {}): OperatorBooking {
  return {
    id: "b1111111-2222-4333-8444-555555555555",
    reference: "RS-CONF01",
    experienceTitle: "Paseo por la senda costera",
    slotDate: "2026-11-21",
    slotTime: "10:00",
    partySize: 4,
    status: "confirmed",
    depositCents: 3000,
    balanceCents: 9000,
    currency: "EUR",
    payment: { status: "captured", orderId: "ORDER-1", captureId: "CAP-1", refundId: null, capturedAt: "2026-11-20T08:00:00Z" },
    exception: false,
    ...overrides,
  };
}

function view(overrides: Partial<OperatorView> = {}): OperatorView {
  return {
    merchant: { name: "Rutas del Sella (demo, ficticio)", isFixture: true },
    today: "2026-11-20",
    summary: { upcoming: 1, depositsCollectedCents: 6000, balanceDueCents: 9000, exceptions: 1 },
    bookings: [
      booking(),
      booking({
        id: "b2222222-2222-4333-8444-555555555555",
        reference: "RS-ATTN02",
        status: "needs_attention",
        exception: true,
        payment: { status: "refund_failed", orderId: "ORDER-2", captureId: "CAP-2", refundId: "REF-2", capturedAt: "2026-11-19T08:00:00Z" },
      }),
      booking({ id: "b3333333-2222-4333-8444-555555555555", reference: "RS-PAST03", slotDate: "2026-11-15" }),
    ],
    holds: [
      {
        id: "h1111111-2222-4333-8444-555555555555",
        reference: "RS-HOLD04",
        experienceTitle: "Descenso en canoa",
        slotDate: "2026-11-22",
        slotTime: "16:00",
        partySize: 2,
        expiresAt: "2026-11-20T10:15:00Z",
      },
    ],
    capacity: [
      {
        id: "e1",
        title: "Paseo por la senda costera",
        capacity: 12,
        slots: [
          { date: "2026-11-20", startTime: "10:00", available: 0 },
          { date: "2026-11-20", startTime: "16:00", available: 12 },
          { date: "2026-11-21", startTime: "10:00", available: 8 },
          { date: "2026-11-21", startTime: "16:00", available: 12 },
        ],
      },
    ],
    ...overrides,
  };
}

function ledgerOk(overrides: Partial<Extract<OperatorLedgerResponse, { state: "ok" }>> = {}) {
  return json(200, {
    state: "ok",
    refreshedAt: "2026-11-20T09:00:00.000Z",
    truncated: false,
    windowStart: "2026-10-20T09:30:00.000Z",
    bookings: {},
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  ledgerFetch.mockReset();
  ledgerFetch.mockResolvedValue(ledgerOk());
  confirm.mockReturnValue(true);
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) => (url === LEDGER_URL ? ledgerFetch(url, init) : mockFetch(url, init)));
  vi.stubGlobal("confirm", confirm);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OperatorDashboard", () => {
  it("shows only a not-valid message for a link the API 404s", async () => {
    mockFetch.mockResolvedValueOnce(json(404, { error: "Not found" }));

    render(<OperatorDashboard />);

    expect(await screen.findByText("Este enlace de operador no es válido o ha caducado.")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith(`/api/operator/${CAPABILITY}`, { cache: "no-store" });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText(/Rutas del Sella/)).not.toBeInTheDocument();
  });

  it("offers a retry when the view fails to load", async () => {
    mockFetch.mockResolvedValueOnce(json(500, {})).mockResolvedValueOnce(json(200, view()));

    render(<OperatorDashboard />);
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("Rutas del Sella (demo, ficticio)")).toBeInTheDocument();
  });

  it("shows the merchant with the demo label, the summary tiles and the bookings split by date", async () => {
    mockFetch.mockResolvedValueOnce(json(200, view()));

    render(<OperatorDashboard />);

    expect(await screen.findByRole("heading", { name: /Rutas del Sella \(demo, ficticio\)/ })).toBeInTheDocument();
    expect(screen.getByText("demo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Próximas: 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Incidencias: 1" })).toBeInTheDocument();
    expect(screen.getByTestId("tile-deposits")).toHaveTextContent(/60,00\s€/);
    expect(screen.getByTestId("tile-balance")).toHaveTextContent(/90,00\s€/);

    const upcoming = within(screen.getByRole("region", { name: "Próximas reservas" }));
    expect(upcoming.getByText("RS-CONF01")).toBeInTheDocument();
    expect(upcoming.getByText("RS-ATTN02")).toBeInTheDocument();
    expect(upcoming.queryByText("RS-PAST03")).not.toBeInTheDocument();
    const recent = within(screen.getByRole("region", { name: "Últimos 7 días" }));
    expect(recent.getByText("RS-PAST03")).toBeInTheDocument();
  });

  it("highlights exception rows with the payment ids", async () => {
    mockFetch.mockResolvedValueOnce(json(200, view()));

    render(<OperatorDashboard />);

    const attention = (await screen.findByText("RS-ATTN02")).closest("tr") as HTMLElement;
    expect(attention).toHaveAttribute("data-exception", "true");
    expect(within(attention).getByText("Incidencia")).toBeInTheDocument();
    expect(within(attention).getByText("Requiere atención")).toBeInTheDocument();
    expect(within(attention).getByText(/REF-2/)).toBeInTheDocument();
    const normal = screen.getByText("RS-CONF01").closest("tr") as HTMLElement;
    expect(normal).toHaveAttribute("data-exception", "false");
    expect(within(normal).queryByText("Incidencia")).not.toBeInTheDocument();
  });

  it("filters to the exceptions from their tile and back", async () => {
    mockFetch.mockResolvedValueOnce(json(200, view()));
    render(<OperatorDashboard />);
    const tile = await screen.findByRole("button", { name: "Incidencias: 1" });

    fireEvent.click(tile);
    expect(screen.queryByText("RS-CONF01")).not.toBeInTheDocument();
    expect(screen.getByText("RS-ATTN02")).toBeInTheDocument();

    fireEvent.click(tile);
    expect(screen.getByText("RS-CONF01")).toBeInTheDocument();
  });

  it("releases a hold through the CSRF-protected action, then reloads", async () => {
    mockFetch
      .mockResolvedValueOnce(json(200, view()))
      .mockResolvedValueOnce(json(200, { released: true }))
      .mockResolvedValueOnce(json(200, view({ holds: [] })));
    render(<OperatorDashboard />);

    fireEvent.click(await screen.findByRole("button", { name: "Liberar bloqueo RS-HOLD04" }));

    await waitFor(() => expect(screen.queryByText("RS-HOLD04")).not.toBeInTheDocument());
    expect(mockFetch).toHaveBeenNthCalledWith(2, `/api/operator/${CAPABILITY}/holds/h1111111-2222-4333-8444-555555555555/release`, {
      method: "POST",
      headers: { "x-csrf-token": "csrf-1" },
    });
    expect(screen.getByText("No hay bloqueos activos.")).toBeInTheDocument();
  });

  it("says so when the hold is no longer live", async () => {
    mockFetch
      .mockResolvedValueOnce(json(200, view()))
      .mockResolvedValueOnce(json(409, { error: "hold_not_live" }))
      .mockResolvedValueOnce(json(200, view({ holds: [] })));
    render(<OperatorDashboard />);

    fireEvent.click(await screen.findByRole("button", { name: "Liberar bloqueo RS-HOLD04" }));

    expect(await screen.findByText("Ese bloqueo ya no estaba activo.")).toBeInTheDocument();
  });

  it("re-issues a visitor link after confirming in the dialog and shows it once", async () => {
    const link = "/booking/b1111111-2222-4333-8444-555555555555.ZyXwVuTsRqPoNmLkJiHgFeDcBa9876543210_-zyxwv";
    mockFetch.mockResolvedValueOnce(json(200, view())).mockResolvedValueOnce(json(200, { link }));
    render(<OperatorDashboard />);

    fireEvent.click(await screen.findByRole("button", { name: "Reemitir enlace RS-CONF01" }));

    const dialog = await screen.findByRole("dialog", { name: "Reemitir enlace de RS-CONF01" });
    expect(within(dialog).getByText("El enlace anterior dejará de funcionar.")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    fireEvent.click(within(dialog).getByRole("button", { name: "Reemitir" }));

    expect(await screen.findByText(`${window.location.origin}${link}`)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(confirm).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      `/api/operator/${CAPABILITY}/bookings/b1111111-2222-4333-8444-555555555555/reissue-link`,
      { method: "POST", headers: { "x-csrf-token": "csrf-1" } }
    );

    fireEvent.click(screen.getByRole("button", { name: "Hecho" }));
    expect(screen.queryByText(`${window.location.origin}${link}`)).not.toBeInTheDocument();
  });

  it("closes the dialog without a request when the re-issue is cancelled", async () => {
    mockFetch.mockResolvedValueOnce(json(200, view()));
    render(<OperatorDashboard />);

    fireEvent.click(await screen.findByRole("button", { name: "Reemitir enlace RS-CONF01" }));
    const dialog = await screen.findByRole("dialog", { name: "Reemitir enlace de RS-CONF01" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("disables the confirm button while the re-issue is in flight", async () => {
    let settle: (value: unknown) => void = () => {};
    mockFetch
      .mockResolvedValueOnce(json(200, view()))
      .mockReturnValueOnce(new Promise((resolve) => (settle = resolve)));
    render(<OperatorDashboard />);

    fireEvent.click(await screen.findByRole("button", { name: "Reemitir enlace RS-CONF01" }));
    const dialog = await screen.findByRole("dialog", { name: "Reemitir enlace de RS-CONF01" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reemitir" }));

    const pending = await within(dialog).findByRole("button", { name: "Reemitiendo…" });
    expect(pending).toBeDisabled();
    fireEvent.click(pending);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    settle(json(200, { link: "/booking/x.y" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes the dialog and reports a failed re-issue without losing the view", async () => {
    mockFetch.mockResolvedValueOnce(json(200, view())).mockResolvedValueOnce(json(500, {}));
    render(<OperatorDashboard />);

    fireEvent.click(await screen.findByRole("button", { name: "Reemitir enlace RS-CONF01" }));
    const dialog = await screen.findByRole("dialog", { name: "Reemitir enlace de RS-CONF01" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reemitir" }));

    expect(await screen.findByText("No se pudo completar la acción. Inténtalo de nuevo.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("RS-CONF01")).toBeInTheDocument();
  });

  it("shows booking and hold dates as a day, not a raw ISO date", async () => {
    mockFetch.mockResolvedValueOnce(json(200, view()));
    render(<OperatorDashboard />);

    const row = (await screen.findByText("RS-CONF01")).closest("tr") as HTMLElement;
    expect(row).toHaveTextContent(`${slotDay("2026-11-21", "es")} · 10:00`);
    for (const table of screen.getAllByRole("table").slice(0, 2)) {
      expect(table.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    }
    const holds = within(screen.getByRole("region", { name: "Bloqueos activos" }));
    expect(holds.getByText(new RegExp(`${slotDay("2026-11-22", "es")} · 16:00`))).toBeInTheDocument();
    expect(holds.queryByText(/2026-11-22/)).not.toBeInTheDocument();
  });

  it("captions every booking cell for the stacked phone layout", async () => {
    mockFetch.mockResolvedValueOnce(json(200, view()));
    render(<OperatorDashboard />);

    const table = within((await screen.findAllByRole("table"))[0]);
    expect(table.getAllByRole("columnheader")).toHaveLength(9);
    const rows = within(screen.getByRole("region", { name: "Próximas reservas" })).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      const cells = within(row).getAllByRole("cell");
      expect(cells).toHaveLength(9);
      for (const cell of cells) expect(cell.getAttribute("data-label")).toMatch(/\S/);
    }
    expect(within(rows[0]).getByRole("cell", { name: /Confirmada/ })).toHaveAttribute("data-label", "Estado");
  });

  it("shows an icon on the money tiles and sets no dead dark: classes", async () => {
    mockFetch.mockResolvedValueOnce(json(200, view()));
    const { container } = render(<OperatorDashboard />);

    expect((await screen.findByTestId("tile-deposits")).querySelector("svg.lucide-wallet")).not.toBeNull();
    expect(screen.getByTestId("tile-balance").querySelector("svg.lucide-hourglass")).not.toBeNull();
    // StatCard (src/components/ui/stat-card.tsx) ships its own dark: variants; everything else here must not.
    const statCards = screen.getAllByRole("button", { name: /^(Próximas|Incidencias): / });
    const darkOutsideStatCards = [...container.querySelectorAll("[class*='dark:']")].filter(
      (element) => !statCards.some((card) => card.contains(element))
    );
    expect(darkOutsideStatCards).toEqual([]);
  });

  it("shows places left out of capacity per start time and day", async () => {
    mockFetch.mockResolvedValueOnce(json(200, view()));
    render(<OperatorDashboard />);

    const capacity = within(await screen.findByRole("region", { name: "Plazas libres (14 días)" }));
    const ten = capacity.getByRole("row", { name: /^10:00/ });
    expect(within(ten).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["0/12", "8/12"]);
  });
});

describe("OperatorDashboard PayPal check", () => {
  const ids = { conf: "b1111111-2222-4333-8444-555555555555", attn: "b2222222-2222-4333-8444-555555555555", past: "b3333333-2222-4333-8444-555555555555" };

  it("checks once after the view loads and shows a chip per deposit and the summary", async () => {
    mockFetch.mockResolvedValueOnce(json(200, view()));
    ledgerFetch.mockResolvedValueOnce(ledgerOk({ bookings: { [ids.conf]: "matches", [ids.attn]: "mismatch", [ids.past]: "refunded" } }));

    render(<OperatorDashboard />);

    const summary = within(await screen.findByRole("region", { name: "Comprobación con PayPal" }));
    expect(
      await summary.findByText(`PayPal confirma 2 de 3 depósitos · datos de PayPal de las ${clockTime("2026-11-20T09:00:00.000Z", "es")}`)
    ).toBeInTheDocument();
    expect(ledgerFetch).toHaveBeenCalledTimes(1);
    expect(ledgerFetch).toHaveBeenCalledWith(LEDGER_URL, { cache: "no-store" });
    expect(within(screen.getByText("RS-CONF01").closest("tr") as HTMLElement).getByTestId("ledger-chip")).toHaveTextContent("PayPal confirma");
    const mismatch = within(screen.getByText("RS-ATTN02").closest("tr") as HTMLElement).getByTestId("ledger-chip");
    expect(mismatch).toHaveTextContent("No coincide con PayPal");
    expect(mismatch.className).toContain("bg-[#c9a55c]/30");
    expect(within(screen.getByText("RS-PAST03").closest("tr") as HTMLElement).getByTestId("ledger-chip")).toHaveTextContent(
      "Reembolso en PayPal"
    );
  });

  it("shows a pending deposit, nothing for a booking without one, and PayPal's refresh time", async () => {
    mockFetch.mockResolvedValueOnce(json(200, view()));
    ledgerFetch.mockResolvedValueOnce(
      ledgerOk({ refreshedAt: "2026-11-20T07:15:00.000Z", bookings: { [ids.conf]: "pending", [ids.attn]: "not_applicable", [ids.past]: "outside_window" } })
    );

    render(<OperatorDashboard />);

    expect(await screen.findByText(new RegExp(`PayPal confirma 0 de 2 depósitos · datos de PayPal de las ${clockTime("2026-11-20T07:15:00.000Z", "es")}`))).toBeInTheDocument();
    expect(within(screen.getByText("RS-CONF01").closest("tr") as HTMLElement).getByTestId("ledger-chip")).toHaveTextContent("Pendiente en PayPal");
    expect(within(screen.getByText("RS-ATTN02").closest("tr") as HTMLElement).queryByTestId("ledger-chip")).not.toBeInTheDocument();
    expect(within(screen.getByText("RS-PAST03").closest("tr") as HTMLElement).getByTestId("ledger-chip")).toHaveTextContent(
      "Fuera del periodo consultado"
    );
  });

  it("says when PayPal had more than one page", async () => {
    mockFetch.mockResolvedValueOnce(json(200, view()));
    ledgerFetch.mockResolvedValueOnce(ledgerOk({ truncated: true }));

    render(<OperatorDashboard />);

    expect(await screen.findByText(/solo se comprobaron los primeros 500/)).toBeInTheDocument();
  });

  it("keeps the panel when PayPal cannot answer and retries on request", async () => {
    mockFetch.mockResolvedValueOnce(json(200, view()));
    ledgerFetch
      .mockResolvedValueOnce(json(200, { state: "unavailable", reason: "not_authorized" }))
      .mockResolvedValueOnce(ledgerOk({ bookings: { [ids.conf]: "matches" } }));

    render(<OperatorDashboard />);

    expect(await screen.findByText("La comprobación con PayPal no está disponible ahora.")).toBeInTheDocument();
    expect(screen.getByText("RS-CONF01")).toBeInTheDocument();
    expect(screen.queryByTestId("ledger-chip")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText(/PayPal confirma 1 de 1 depósitos/)).toBeInTheDocument();
    expect(ledgerFetch).toHaveBeenCalledTimes(2);
  });

  it("treats a failed or refused check as unavailable", async () => {
    mockFetch.mockResolvedValueOnce(json(200, view()));
    ledgerFetch.mockRejectedValueOnce(new TypeError("offline"));

    render(<OperatorDashboard />);

    expect(await screen.findByText("La comprobación con PayPal no está disponible ahora.")).toBeInTheDocument();
  });

  it("checks again from the keyboard, keeping focus and the last answer while it loads", async () => {
    const user = userEvent.setup();
    let settle: (value: unknown) => void = () => {};
    mockFetch.mockResolvedValueOnce(json(200, view()));
    ledgerFetch
      .mockResolvedValueOnce(ledgerOk({ bookings: { [ids.conf]: "pending" } }))
      .mockReturnValueOnce(new Promise((resolve) => (settle = resolve)));

    render(<OperatorDashboard />);
    const again = await screen.findByRole("button", { name: "Comprobar de nuevo" });
    await waitFor(() => expect(again).not.toHaveAttribute("aria-disabled", "true"));
    for (let step = 0; step < 30 && document.activeElement !== again; step++) await user.tab();
    expect(again).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(again).toHaveAttribute("aria-disabled", "true");
    expect(again).toHaveFocus();
    expect(screen.getByTestId("ledger-chip")).toHaveTextContent("Pendiente en PayPal");
    await user.keyboard("{Enter}");
    expect(ledgerFetch).toHaveBeenCalledTimes(2);

    settle(ledgerOk({ bookings: { [ids.conf]: "matches" } }));
    await waitFor(() => expect(screen.getByTestId("ledger-chip")).toHaveTextContent("PayPal confirma"));
    expect(again).not.toHaveAttribute("aria-disabled", "true");
  });

  it("reserves the chips' space and shows the button while the first check loads", async () => {
    mockFetch.mockResolvedValueOnce(json(200, view()));
    ledgerFetch.mockReturnValueOnce(new Promise(() => {}));

    render(<OperatorDashboard />);

    expect(await screen.findByText("Comprobando los depósitos con PayPal…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Comprobar de nuevo" })).toHaveAttribute("aria-disabled", "true");
    // Every booking with a capture keeps a hidden placeholder the chip's size; none for a booking without one.
    const placeholders = screen.getAllByTestId("ledger-chip-placeholder");
    expect(placeholders).toHaveLength(3);
    for (const placeholder of placeholders) {
      expect(placeholder).toHaveAttribute("aria-hidden", "true");
      expect(placeholder.className).toContain("invisible");
    }
    expect(screen.queryByTestId("ledger-chip")).not.toBeInTheDocument();
  });

  it("reaches Reintentar from the keyboard", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce(json(200, view()));
    ledgerFetch.mockResolvedValueOnce(json(200, { state: "unavailable", reason: "error" })).mockResolvedValueOnce(ledgerOk());

    render(<OperatorDashboard />);
    const retry = await screen.findByRole("button", { name: "Reintentar" });
    for (let step = 0; step < 30 && document.activeElement !== retry; step++) await user.tab();
    expect(retry).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(await screen.findByText(/PayPal confirma 0 de 0 depósitos/)).toBeInTheDocument();
  });

  it("dates PayPal's refresh when it is not from today", async () => {
    mockFetch.mockResolvedValueOnce(json(200, view()));
    ledgerFetch.mockResolvedValueOnce(ledgerOk({ refreshedAt: "2026-11-19T22:30:00.000Z" }));

    render(<OperatorDashboard />);

    expect(await screen.findByText(`PayPal confirma 0 de 0 depósitos · datos de PayPal del ${dateTime("2026-11-19T22:30:00.000Z", "es")}`)).toBeInTheDocument();
  });

  it("does not check PayPal for a link the API 404s", async () => {
    mockFetch.mockResolvedValueOnce(json(404, { error: "Not found" }));

    render(<OperatorDashboard />);

    expect(await screen.findByText("Este enlace de operador no es válido o ha caducado.")).toBeInTheDocument();
    expect(ledgerFetch).not.toHaveBeenCalled();
  });
});
