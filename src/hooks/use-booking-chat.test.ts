import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBookingChat } from "./use-booking-chat";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "anon-1" }, session: { access_token: "token-1" }, isLoading: false }),
}));
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: "es" }),
}));
vi.mock("@/lib/csrf-client", () => ({ csrfHeaders: () => ({ "x-csrf-token": "csrf-1" }) }));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const QUOTE_ID = "99999999-2222-4333-8444-555555555555";
const BOOKING_ID = "11111111-2222-4333-8444-555555555555";
const quoteCard = {
  kind: "quote",
  quoteId: QUOTE_ID,
  version: 1,
  experienceTitle: "Paseo",
  slotDate: "2026-11-21",
  slotTime: "10:00",
  partySize: 4,
  totalCents: 12000,
  depositCents: 3000,
  balanceCents: 9000,
  currency: "EUR",
  cancellationWindowHours: 24,
  expiresAt: "2026-11-20T09:20:00.000Z",
  accepted: false,
};
const bookingCard = { kind: "booking", bookingId: BOOKING_ID, reference: "RS-ABC123", status: "pending_payment", link: "/booking/x.y" };
const paymentCard = {
  kind: "payment",
  bookingId: BOOKING_ID,
  approvalUrl: "https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T",
  amountCents: 3000,
  currency: "EUR",
  expiresAt: "2026-11-20T09:20:00.000Z",
};

function sse(events: unknown[]) {
  const body = new TextEncoder().encode(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(""));
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "text/event-stream" }),
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(body);
        controller.close();
      },
    }),
  };
}

function json(status: number, body: unknown) {
  return { ok: status < 400, status, headers: new Headers({ "content-type": "application/json" }), json: async () => body };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useBookingChat", () => {
  it("posts the turn with Bearer and CSRF headers and assembles text, cards and the tool status line", async () => {
    mockFetch.mockResolvedValueOnce(
      sse([
        { type: "text", content: "Busco. " },
        { type: "tool", name: "search_experiences", status: "start" },
        { type: "tool", name: "search_experiences", status: "done" },
        { type: "card", card: { kind: "offer", options: [] } },
        { type: "text", content: "Aquí tienes." },
        { type: "done", images: [], sources: [] },
      ])
    );
    const { result } = renderHook(() => useBookingChat());

    await act(() => result.current.sendMessage("Somos cuatro", { locale: "es" }));

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/booking/chat/stream");
    expect(init.headers).toMatchObject({ Authorization: "Bearer token-1", "x-csrf-token": "csrf-1" });
    expect(JSON.parse(init.body)).toEqual({ message: "Somos cuatro", history: [], locale: "es" });
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1]).toMatchObject({
      role: "assistant",
      content: "Busco. Aquí tienes.",
      cards: [{ kind: "offer", options: [] }],
    });
    expect(result.current.statusLine).toBeNull();
    expect(result.current.isStreaming).toBe(false);
  });

  it("shows a status line while a tool runs", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const encoder = new TextEncoder();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/event-stream" }),
      body: new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "tool", name: "search_experiences", status: "start" })}\n\n`));
          await gate;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "tool", name: "search_experiences", status: "done" })}\n\n`));
          controller.close();
        },
      }),
    });
    const { result } = renderHook(() => useBookingChat());

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.sendMessage("Hola");
    });
    await waitFor(() => expect(result.current.statusLine).toBe("booking.chat.checking"));
    release();
    await act(() => pending);
    expect(result.current.statusLine).toBeNull();
  });

  it("sends the last 10 messages as history, each truncated to 2,000 characters", async () => {
    mockFetch.mockImplementation(async () => sse([{ type: "text", content: "x".repeat(2500) }, { type: "done", images: [], sources: [] }]));
    const { result } = renderHook(() => useBookingChat());

    // 12 earlier messages before the 7th turn: the oldest two are dropped.
    for (let i = 0; i < 7; i++) {
      await act(() => result.current.sendMessage(`m${i}`));
    }

    const history = JSON.parse(mockFetch.mock.calls[6][1].body).history as { role: string; content: string }[];
    expect(history).toHaveLength(10);
    expect(history[0]).toEqual({ role: "user", content: "m1" });
    expect(Math.max(...history.map((h) => h.content.length))).toBe(2000);
  });

  it.each([
    ["limit_reached", "booking.access.limitReached"],
    ["ai_unavailable", "booking.chat.aiUnavailable"],
    ["response_timeout", "chat.error_timeout"],
    ["output_filtered", "chat.error_generic"],
  ])("maps the %s error event to a visible message", async (code, message) => {
    mockFetch.mockResolvedValueOnce(sse([{ type: "error", message: code }]));
    const { result } = renderHook(() => useBookingChat());

    await act(() => result.current.sendMessage("Hola"));

    expect(result.current.error).toBe(message);
  });

  it("accepting a quote swaps its card for the booking card, then sends the quote_accepted turn, whose answer carries the payment card", async () => {
    mockFetch
      .mockResolvedValueOnce(sse([{ type: "card", card: quoteCard }, { type: "done", images: [], sources: [] }]))
      .mockResolvedValueOnce(json(200, { card: bookingCard }))
      .mockResolvedValueOnce(
        sse([
          { type: "text", content: "Reserva retenida." },
          { type: "tool", name: "create_payment_order", status: "start" },
          { type: "tool", name: "create_payment_order", status: "done" },
          { type: "card", card: paymentCard },
          { type: "done", images: [], sources: [] },
        ])
      );
    const { result } = renderHook(() => useBookingChat());

    await act(() => result.current.sendMessage("Quiero el paseo"));
    await act(() => result.current.acceptQuote(QUOTE_ID));

    const [acceptUrl, acceptInit] = mockFetch.mock.calls[1];
    expect(acceptUrl).toBe(`/api/booking/quotes/${QUOTE_ID}/accept`);
    expect(acceptInit).toMatchObject({ method: "POST", headers: { Authorization: "Bearer token-1", "x-csrf-token": "csrf-1" } });
    expect(result.current.messages[1].cards).toEqual([bookingCard]);

    const turn = JSON.parse(mockFetch.mock.calls[2][1].body);
    expect(turn).toMatchObject({ message: "", event: { type: "quote_accepted", bookingId: BOOKING_ID } });
    // No visible user bubble for the event turn; the assistant answers.
    expect(result.current.messages.map((m) => m.role)).toEqual(["user", "assistant", "assistant"]);
    expect(result.current.messages[2].content).toBe("Reserva retenida.");
    expect(result.current.messages[2].cards).toEqual([paymentCard]);
  });

  it.each([
    ["quote_expired", "expired"],
    ["no_capacity", "noCapacity"],
  ])("marks the quote %s on a 409 and sends no event turn", async (code, state) => {
    mockFetch
      .mockResolvedValueOnce(sse([{ type: "card", card: quoteCard }, { type: "done", images: [], sources: [] }]))
      .mockResolvedValueOnce(json(409, { error: code }));
    const { result } = renderHook(() => useBookingChat());

    await act(() => result.current.sendMessage("Quiero el paseo"));
    await act(() => result.current.acceptQuote(QUOTE_ID));

    expect(result.current.quoteStates[QUOTE_ID]).toBe(state);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("aborts a turn after 120 seconds", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      let signal!: AbortSignal;
      mockFetch.mockImplementationOnce((_url, init: { signal: AbortSignal }) => {
        signal = init.signal;
        return new Promise(() => {});
      });
      const { result } = renderHook(() => useBookingChat());
      act(() => {
        void result.current.sendMessage("Hola");
      });
      await vi.advanceTimersByTimeAsync(119_000);
      expect(signal.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(signal.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores a new turn or an accept while a turn is streaming", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    mockFetch.mockImplementationOnce(async () => {
      await gate;
      return sse([{ type: "done", images: [], sources: [] }]);
    });
    const { result } = renderHook(() => useBookingChat());

    let first!: Promise<void>;
    act(() => {
      first = result.current.sendMessage("Hola");
    });
    await act(() => result.current.sendMessage("Otra"));
    await act(() => result.current.acceptQuote(QUOTE_ID));
    release();
    await act(() => first);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("batches text tokens into one message update per animation frame", async () => {
    const frames: FrameRequestCallback[] = [];
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    mockFetch.mockResolvedValueOnce(
      sse([
        { type: "text", content: "Uno " },
        { type: "text", content: "dos " },
        { type: "text", content: "tres" },
        { type: "done", images: [], sources: [] },
      ])
    );
    const { result } = renderHook(() => useBookingChat());

    await act(() => result.current.sendMessage("Hola"));

    // Three tokens, one scheduled frame; the end of the turn flushes the rest.
    expect(frames).toHaveLength(1);
    expect(result.current.messages[1].content).toBe("Uno dos tres");
    raf.mockRestore();
  });
});

