// @vitest-environment node
/**
 * Unit tests for the Zapier sync of booking transitions (PayPal hackathon
 * plan, Phase 8c). The hook is a local HTTP server on loopback (no real
 * network); the booking read goes through the fake Supabase client. A test
 * that needs a non-loopback https URL or the 5 s timeout stubs fetch instead.
 */
import { createServer, type IncomingHttpHeaders, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { bookingRow, createBookingSupabaseFake, type BookingSupabaseFake } from "@/test/booking-supabase-fake";

const logger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger }));

/** next/server's after(): collects the background work so a test can await it; can throw like outside a request. */
const background = vi.hoisted(() => ({ pending: [] as Promise<unknown>[], outsideRequest: false }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn((task: Promise<unknown>) => {
    if (background.outsideRequest) throw new Error("`after` was called outside a request scope");
    background.pending.push(task);
  }),
}));

const { after } = await import("next/server");
const { notifyBookingSync } = await import("./zapier");

const ID = bookingRow().id;
const FAILED = "[ZAPIER_SYNC_FAILED]";

interface Received {
  method: string | undefined;
  url: string | undefined;
  headers: IncomingHttpHeaders;
  body: string;
}

let server: Server;
let base: string;
let received: Received[];
let reply: (res: ServerResponse) => void;
let fake: BookingSupabaseFake;

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      received.push({ method: req.method, url: req.url, headers: req.headers, body });
      reply(res);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  vi.clearAllMocks();
  fake = createBookingSupabaseFake();
  received = [];
  reply = (res) => res.writeHead(200, { "Content-Type": "application/json" }).end('{"status":"success"}');
  background.pending = [];
  background.outsideRequest = false;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Awaits every background task handed to after(); a rejection fails the test. */
const settle = async () => {
  await Promise.all(background.pending.splice(0));
};

/** The payload read: a select("*")-shaped row with sensitive columns, to prove the payload picks its fields. */
function queueBooking(overrides: Record<string, unknown> = {}) {
  return fake.onTable("bookings", {
    data: {
      ...bookingRow({ status: "confirmed", confirmed_at: "2026-10-04T10:00:00.000Z", link_version: 3 }),
      hold_id: "hold-1",
      refund_cents: 3000,
      experience: { title: "Ruta costera" },
      ...overrides,
    },
  });
}

const touched = () => (fake.client.from as unknown as Mock).mock.calls.map((call) => call[0]);
const failures = () => logger.error.mock.calls.filter(([marker]) => marker === FAILED);

const EXPECTED_KEYS = [
  "balanceCents",
  "currency",
  "depositCents",
  "event",
  "experienceTitle",
  "id",
  "partySize",
  "slotDate",
  "slotTime",
  "totalCents",
];

describe("payload", () => {
  it.each(["booking.confirmed", "booking.refunded"] as const)("POSTs %s as JSON with exactly the documented keys", async (event) => {
    vi.stubEnv("ZAPIER_BOOKING_HOOK_URL", `${base}/hooks/catch/1/abc/`);
    const read = queueBooking();

    notifyBookingSync(fake.client, ID, event);
    await settle();

    expect(received).toHaveLength(1);
    const [request] = received;
    expect(request.method).toBe("POST");
    expect(request.url).toBe("/hooks/catch/1/abc/");
    expect(request.headers["content-type"]).toBe("application/json");
    const body = JSON.parse(request.body);
    expect(Object.keys(body).sort()).toEqual(EXPECTED_KEYS);
    expect(body).toEqual({
      id: "RS-ABC123",
      event,
      slotDate: "2026-11-21",
      slotTime: "10:00",
      partySize: 4,
      totalCents: 12000,
      depositCents: 3000,
      balanceCents: 9000,
      currency: "EUR",
      experienceTitle: "Ruta costera",
    });
    expect(read.eq).toHaveBeenCalledWith("id", ID);
    expect(read.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(read.update).not.toHaveBeenCalled();
    expect(failures()).toEqual([]);
  });

  it("reads only the payload's columns: no user, booking id, link version or payment columns", async () => {
    vi.stubEnv("ZAPIER_BOOKING_HOOK_URL", `${base}/hook`);
    const read = queueBooking();

    notifyBookingSync(fake.client, ID, "booking.confirmed");
    await settle();

    const [columns] = read.select.mock.calls[0] as [string];
    expect(columns).toBe("reference, slot_date, slot_time, party_size, total_cents, deposit_cents, currency, experience:experiences(title)");
  });

  it("never sends a capability link, the booking id, the user or PayPal ids, even when the row carries them", async () => {
    vi.stubEnv("ZAPIER_BOOKING_HOOK_URL", `${base}/hook`);
    queueBooking({ user_id: "user-secret-1", email: "guest@example.com", capture_id: "CAP-1", order_id: "ORDER-1", refund_id: "REF-1" });

    notifyBookingSync(fake.client, ID, "booking.refunded");
    await settle();

    const { body } = received[0];
    for (const forbidden of [ID, "user-secret-1", "guest@example.com", "CAP-1", "ORDER-1", "REF-1", "/booking/", "hold-1", "link"]) {
      expect(body).not.toContain(forbidden);
    }
  });

  it("an experience that cannot be read is an empty title, not a failure", async () => {
    vi.stubEnv("ZAPIER_BOOKING_HOOK_URL", `${base}/hook`);
    queueBooking({ experience: null });

    notifyBookingSync(fake.client, ID, "booking.confirmed");
    await settle();

    expect(JSON.parse(received[0].body).experienceTitle).toBe("");
    expect(failures()).toEqual([]);
  });
});

describe("configuration", () => {
  it("no URL: no booking read, no request, no background task, one debug line", async () => {
    notifyBookingSync(fake.client, ID, "booking.confirmed");
    await settle();

    expect(touched()).toEqual([]);
    expect(received).toEqual([]);
    expect(after).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith("[ZAPIER_SYNC_SKIPPED]", { bookingId: ID, event: "booking.confirmed" });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it.each([
    ["not a URL", "hooks.zapier.com/hooks/catch/1/a"],
    ["another scheme", "ftp://hooks.zapier.com/hooks/catch/1/b"],
    ["plain http off loopback", "http://hooks.zapier.com/hooks/catch/1/c"],
    ["credentials in the URL", "https://user:pass@hooks.zapier.com/hooks/catch/1/d"],
  ])("%s: no read, no request, one log for two notifications, the URL never logged", async (_label, url) => {
    vi.stubEnv("ZAPIER_BOOKING_HOOK_URL", url);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    notifyBookingSync(fake.client, ID, "booking.confirmed");
    notifyBookingSync(fake.client, ID, "booking.refunded");
    await settle();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(touched()).toEqual([]);
    expect(failures()).toEqual([[FAILED, { reason: "invalid_url" }]]);
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain("hooks.zapier.com");
  });

  it("loopback http is refused in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ZAPIER_BOOKING_HOOK_URL", `${base}/production-loopback`);

    notifyBookingSync(fake.client, ID, "booking.confirmed");
    await settle();

    expect(received).toEqual([]);
    expect(failures()).toEqual([[FAILED, { reason: "invalid_url" }]]);
  });

  it("an https hook is posted to as configured", async () => {
    const url = "https://hooks.zapier.com/hooks/catch/123/xyz/";
    vi.stubEnv("ZAPIER_BOOKING_HOOK_URL", `  ${url}\n`);
    const fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    queueBooking();

    notifyBookingSync(fake.client, ID, "booking.confirmed");
    await settle();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      url,
      expect.objectContaining({ method: "POST", redirect: "error", signal: expect.any(AbortSignal) })
    );
    expect(failures()).toEqual([]);
  });
});

describe("failures are logged and swallowed", () => {
  it("a non-2xx reply is [ZAPIER_SYNC_FAILED] with the status", async () => {
    vi.stubEnv("ZAPIER_BOOKING_HOOK_URL", `${base}/hook`);
    reply = (res) => res.writeHead(500).end("nope");
    queueBooking();

    expect(notifyBookingSync(fake.client, ID, "booking.confirmed")).toBeUndefined();
    await settle();

    expect(received).toHaveLength(1);
    expect(failures()).toEqual([[FAILED, { bookingId: ID, event: "booking.confirmed", reason: "http_status", status: 500 }]]);
  });

  it("a redirect is not followed: one request, logged as a failure", async () => {
    vi.stubEnv("ZAPIER_BOOKING_HOOK_URL", `${base}/hook`);
    reply = (res) => res.writeHead(307, { Location: `${base}/elsewhere` }).end();
    queueBooking();

    notifyBookingSync(fake.client, ID, "booking.confirmed");
    await settle();

    expect(received.map((request) => request.url)).toEqual(["/hook"]);
    expect(failures()).toEqual([[FAILED, expect.objectContaining({ bookingId: ID, reason: "network" })]]);
  });

  it("an unreachable hook is a network failure", async () => {
    const closed = createServer();
    await new Promise<void>((resolve) => closed.listen(0, "127.0.0.1", resolve));
    const port = (closed.address() as AddressInfo).port;
    await new Promise((resolve) => closed.close(resolve));
    vi.stubEnv("ZAPIER_BOOKING_HOOK_URL", `http://127.0.0.1:${port}/hook`);
    queueBooking();

    notifyBookingSync(fake.client, ID, "booking.refunded");
    await settle();

    expect(failures()).toEqual([[FAILED, { bookingId: ID, event: "booking.refunded", reason: "network", error: expect.any(String) }]]);
  });

  it("a non-Error rejection is still a logged network failure", async () => {
    vi.stubEnv("ZAPIER_BOOKING_HOOK_URL", `${base}/hook`);
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject("socket hang up")));
    queueBooking();

    notifyBookingSync(fake.client, ID, "booking.confirmed");
    await settle();

    expect(failures()).toEqual([[FAILED, { bookingId: ID, event: "booking.confirmed", reason: "network", error: "socket hang up" }]]);
  });

  it("gives up after 5 s: the request is aborted and logged as a timeout", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.stubEnv("ZAPIER_BOOKING_HOOK_URL", `${base}/hook`);
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            signal = init.signal as AbortSignal;
            signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
          })
      )
    );
    queueBooking();

    notifyBookingSync(fake.client, ID, "booking.confirmed");
    await vi.advanceTimersByTimeAsync(4_999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await settle();

    expect(signal?.aborted).toBe(true);
    expect(failures()).toEqual([[FAILED, { bookingId: ID, event: "booking.confirmed", reason: "timeout" }]]);
  });

  it("a booking read still running after 5 s is a timeout, with no request", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.stubEnv("ZAPIER_BOOKING_HOOK_URL", `${base}/hook`);
    const read = fake.onTable("bookings", {});
    // supabase-js resolves an aborted request with an error object; it does not throw.
    read.abortSignal.mockImplementation((signal: AbortSignal) => {
      (read as unknown as { then: PromiseLike<unknown>["then"] }).then = (onFulfilled, onRejected) =>
        new Promise((resolve) =>
          signal.addEventListener("abort", () => resolve({ data: null, error: { message: "AbortError: This operation was aborted" } }))
        ).then(onFulfilled, onRejected);
      return read;
    });

    notifyBookingSync(fake.client, ID, "booking.confirmed");
    await vi.advanceTimersByTimeAsync(5_000);
    await settle();

    expect(received).toEqual([]);
    expect(failures()).toEqual([[FAILED, { bookingId: ID, event: "booking.confirmed", reason: "timeout" }]]);
  });

  it.each([
    ["a read error", { error: { message: "db-boom" } }, "db-boom"],
    ["a missing booking", { data: null }, "not found"],
  ])("%s is logged with no request", async (_label, result, message) => {
    vi.stubEnv("ZAPIER_BOOKING_HOOK_URL", `${base}/hook`);
    fake.onTable("bookings", result);

    notifyBookingSync(fake.client, ID, "booking.refunded");
    await settle();

    expect(received).toEqual([]);
    expect(failures()).toEqual([[FAILED, { bookingId: ID, event: "booking.refunded", reason: "booking_read", error: message }]]);
  });
});

describe("background work", () => {
  it("is handed to after() so the platform keeps the function alive until it ends", async () => {
    vi.stubEnv("ZAPIER_BOOKING_HOOK_URL", `${base}/hook`);
    queueBooking();

    notifyBookingSync(fake.client, ID, "booking.confirmed");

    expect(after).toHaveBeenCalledTimes(1);
    expect(background.pending).toHaveLength(1);
    await settle();
    expect(received).toHaveLength(1);
  });

  it("outside a request scope (after() throws) the POST still runs and nothing throws", async () => {
    background.outsideRequest = true;
    vi.stubEnv("ZAPIER_BOOKING_HOOK_URL", `${base}/hook`);
    queueBooking();

    expect(() => notifyBookingSync(fake.client, ID, "booking.confirmed")).not.toThrow();
    await vi.waitFor(() => expect(received).toHaveLength(1));
  });
});
