// @vitest-environment node
/**
 * Transaction Search against the local PayPal stand-in (APIMatic plan, Phase 2).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startPaypalMock, type PaypalMock } from "@/test/paypal-mock-server";
import { resetPaypalClientForTests } from "./client";
import { captureOrder, createOrder } from "./orders";
import { refundCapture } from "./payments";
import { searchTransactions } from "./transactions";
import { PaypalError } from "./types";

const BOOKING_ID = "11111111-2222-4333-8444-555555555555";
const OPERATION_KEY = "6f1c2d3e-4b5a-4c6d-8e7f-001122334455";
const SEARCH_PATH = "/v1/reporting/transactions";
const DAY_MS = 24 * 3_600_000;

let mock: PaypalMock;

beforeEach(async () => {
  mock = await startPaypalMock();
  vi.stubEnv("PAYPAL_CLIENT_ID", "client-id");
  vi.stubEnv("PAYPAL_CLIENT_SECRET", "client-secret");
  vi.stubEnv("PAYPAL_API_BASE", mock.baseUrl);
  resetPaypalClientForTests({ retryInterval: 0.01 });
});

afterEach(async () => {
  vi.unstubAllEnvs();
  resetPaypalClientForTests();
  await mock.close();
});

/** A captured 30.00 EUR deposit; returns its capture id. */
async function capturedDeposit(): Promise<string> {
  const { orderId } = await createOrder({
    bookingId: BOOKING_ID,
    amountCents: 3000,
    currency: "EUR",
    description: "Paseo (demo)",
    returnUrl: "https://paisaxe.es/booking/c/return",
    cancelUrl: "https://paisaxe.es/booking/c?cancelled=1",
    operationKey: OPERATION_KEY,
  });
  mock.approve(orderId);
  return (await captureOrder(orderId, OPERATION_KEY)).capture?.id ?? "";
}

/** The last 31 days, in whole seconds. */
function lastWindow(): { start: Date; end: Date } {
  const end = new Date(Math.ceil(Date.now() / 1000) * 1000);
  return { start: new Date(end.getTime() - 31 * DAY_MS), end };
}

describe("searchTransactions", () => {
  it("asks for one page of transaction info in the window, dates with seconds", async () => {
    const start = new Date("2026-09-10T08:30:15.250Z");
    const end = new Date("2026-10-08T08:30:15.250Z");

    await searchTransactions(start, end);

    const [request] = mock.requestsTo("GET", SEARCH_PATH);
    expect(Object.fromEntries(request.query)).toEqual({
      start_date: "2026-09-10T08:30:15Z",
      end_date: "2026-10-08T08:30:16Z",
      fields: "transaction_info",
      page_size: "500",
      page: "1",
    });
  });

  it("lists a capture and its refund as signed entries with PayPal's refresh time", async () => {
    const captureId = await capturedDeposit();
    const refund = await refundCapture(captureId, 3000, OPERATION_KEY);
    const { start, end } = lastWindow();

    const ledger = await searchTransactions(start, end);

    expect(ledger.truncated).toBe(false);
    expect(Date.parse(ledger.refreshedAt ?? "")).not.toBeNaN();
    expect(ledger.refreshedAt).toMatch(/Z$/);
    expect(ledger.entries).toEqual([
      {
        // A fully refunded capture is listed as V (fully reversed), as the SDK documents.
        transactionId: captureId,
        referenceId: null,
        eventCode: "T0006",
        status: "V",
        amountCents: 3000,
        currency: "EUR",
        customId: BOOKING_ID,
      },
      {
        transactionId: refund.id,
        referenceId: captureId,
        eventCode: "T1107",
        status: "S",
        amountCents: -3000,
        currency: "EUR",
        customId: BOOKING_ID,
      },
    ]);
  });

  it("does not list what PayPal has not refreshed yet", async () => {
    const refreshedAt = new Date(Date.now() - 3_600_000);
    mock.setLedgerRefreshedAt(refreshedAt);
    await capturedDeposit();
    const { start, end } = lastWindow();

    const ledger = await searchTransactions(start, end);

    expect(ledger.entries).toEqual([]);
    expect(ledger.refreshedAt).toBe(`${refreshedAt.toISOString().slice(0, 19)}.000Z`);
  });

  it("reports more than one page as truncated", async () => {
    mock.injectNext({
      method: "GET",
      path: SEARCH_PATH,
      status: 200,
      body: { transaction_details: [], page: 1, total_items: 900, total_pages: 2, last_refreshed_datetime: "2026-10-08T09:00:00+0000" },
    });
    const { start, end } = lastWindow();

    const ledger = await searchTransactions(start, end);

    expect(ledger).toEqual({ entries: [], refreshedAt: "2026-10-08T09:00:00.000Z", truncated: true });
  });

  it("skips an entry without a transaction id and keeps unreadable fields null", async () => {
    mock.injectNext({
      method: "GET",
      path: SEARCH_PATH,
      status: 200,
      body: {
        transaction_details: [
          { transaction_info: { transaction_event_code: "T0006" } },
          { transaction_info: { transaction_id: "TX1", transaction_amount: { currency_code: "EUR", value: "abc" } } },
          {},
        ],
        total_pages: 1,
      },
    });
    const { start, end } = lastWindow();

    const ledger = await searchTransactions(start, end);

    expect(ledger).toEqual({
      entries: [{ transactionId: "TX1", referenceId: null, eventCode: null, status: null, amountCents: null, currency: "EUR", customId: null }],
      refreshedAt: null,
      truncated: false,
    });
  });

  it("reports a missing Transaction Search permission as PayPal's 403", async () => {
    mock.setTransactionSearchDenied(true);
    const { start, end } = lastWindow();

    const error = await searchTransactions(start, end).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(PaypalError);
    expect(error).toMatchObject({ status: 403, issue: "NOT_AUTHORIZED" });
  });

  it("retries a 503 (a GET) and returns the later answer", async () => {
    mock.injectNext({ method: "GET", path: SEARCH_PATH, status: 503, body: { name: "SERVICE_UNAVAILABLE", message: "down", debug_id: "d" } });
    const { start, end } = lastWindow();

    const ledger = await searchTransactions(start, end);

    expect(ledger.entries).toEqual([]);
    expect(mock.requestsTo("GET", SEARCH_PATH)).toHaveLength(2);
  });

  it("refuses a window longer than PayPal's 31 days before calling PayPal", async () => {
    const end = new Date();
    await expect(searchTransactions(new Date(end.getTime() - 31 * DAY_MS - 1000), end)).rejects.toThrow(RangeError);
    await expect(searchTransactions(end, new Date(end.getTime() - 1000))).rejects.toThrow(RangeError);
    expect(mock.requestsTo("GET", SEARCH_PATH)).toHaveLength(0);
  });
});
