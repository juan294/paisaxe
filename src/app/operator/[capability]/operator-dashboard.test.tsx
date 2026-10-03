import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("re-issues a visitor link after confirmation and shows it once", async () => {
    const link = "/booking/b1111111-2222-4333-8444-555555555555.ZyXwVuTsRqPoNmLkJiHgFeDcBa9876543210_-zyxwv";
    mockFetch.mockResolvedValueOnce(json(200, view())).mockResolvedValueOnce(json(200, { link }));
    render(<OperatorDashboard />);

    fireEvent.click(await screen.findByRole("button", { name: "Reemitir enlace RS-CONF01" }));

    expect(confirm).toHaveBeenCalled();
    expect(await screen.findByText(`${window.location.origin}${link}`)).toBeInTheDocument();
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      `/api/operator/${CAPABILITY}/bookings/b1111111-2222-4333-8444-555555555555/reissue-link`,
      { method: "POST", headers: { "x-csrf-token": "csrf-1" } }
    );

    fireEvent.click(screen.getByRole("button", { name: "Hecho" }));
    expect(screen.queryByText(`${window.location.origin}${link}`)).not.toBeInTheDocument();
  });

  it("does nothing when the re-issue is not confirmed", async () => {
    confirm.mockReturnValue(false);
    mockFetch.mockResolvedValueOnce(json(200, view()));
    render(<OperatorDashboard />);

    fireEvent.click(await screen.findByRole("button", { name: "Reemitir enlace RS-CONF01" }));

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("reports a failed action without losing the view", async () => {
    mockFetch.mockResolvedValueOnce(json(200, view())).mockResolvedValueOnce(json(500, {}));
    render(<OperatorDashboard />);

    fireEvent.click(await screen.findByRole("button", { name: "Reemitir enlace RS-CONF01" }));

    expect(await screen.findByText("No se pudo completar la acción. Inténtalo de nuevo.")).toBeInTheDocument();
    expect(screen.getByText("RS-CONF01")).toBeInTheDocument();
  });

  it("shows places left out of capacity per start time and day", async () => {
    mockFetch.mockResolvedValueOnce(json(200, view()));
    render(<OperatorDashboard />);

    const capacity = within(await screen.findByRole("region", { name: "Plazas libres (14 días)" }));
    const ten = capacity.getByRole("row", { name: /^10:00/ });
    expect(within(ten).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["0/12", "8/12"]);
  });
});
