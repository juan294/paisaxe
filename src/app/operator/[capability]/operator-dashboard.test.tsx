import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { slotDay } from "@/lib/booking-format";
import type { OperatorBooking, OperatorView } from "@/lib/booking/operator";

const CAPABILITY = "11111111-2222-4333-8444-555555555555.AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde";

vi.mock("next/navigation", () => ({ useParams: () => ({ capability: CAPABILITY }) }));
vi.mock("@/lib/csrf-client", () => ({ csrfHeaders: () => ({ "x-csrf-token": "csrf-1" }) }));

const { OperatorDashboard } = await import("./operator-dashboard");

const mockFetch = vi.fn();
const confirm = vi.fn(() => true);

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
    payment: { status: "captured", orderId: "ORDER-1", captureId: "CAP-1", refundId: null },
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
        payment: { status: "refund_failed", orderId: "ORDER-2", captureId: "CAP-2", refundId: "REF-2" },
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

beforeEach(() => {
  vi.clearAllMocks();
  confirm.mockReturnValue(true);
  vi.stubGlobal("fetch", mockFetch);
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
