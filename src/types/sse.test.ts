import { describe, expect, it } from "vitest";
import type { ImageResult, Source } from "@/types";
import { encodeSseEvent, parseSseEvent } from "./sse";

describe("types/sse", () => {
  it("encodes and parses text events", () => {
    const event = { type: "text" as const, content: "Hola" };

    expect(encodeSseEvent(event)).toBe(`data: ${JSON.stringify(event)}\n\n`);
    expect(parseSseEvent(`data: ${JSON.stringify(event)}`)).toEqual(event);
  });

  it("parses done events with images and sources", () => {
    const images: ImageResult[] = [
      { id: "img-1", path: "/test.jpg", sourcePdf: "guide.pdf" },
    ];
    const sources: Source[] = [
      { id: "src-1", title: "Guide", sourcePdf: "guide.pdf", snippet: "Snippet" },
    ];
    const event = { type: "done" as const, images, sources };

    expect(parseSseEvent(`data: ${JSON.stringify(event)}`)).toEqual(event);
  });

  it("parses error events", () => {
    const event = {
      type: "error",
      message: "stream_failed",
    } as const;

    expect(parseSseEvent(`data: ${JSON.stringify(event)}`)).toEqual(event);
  });

  it("ignores unknown fields on error events", () => {
    expect(
      parseSseEvent(
        `data: ${JSON.stringify({ type: "error", message: "legacy", extra: 1 })}`
      )
    ).toEqual({
      type: "error",
      message: "legacy",
    });
  });

  it("returns null for invalid SSE lines", () => {
    expect(parseSseEvent("event: ping")).toBeNull();
    expect(parseSseEvent("data: {invalid json}")).toBeNull();
    expect(parseSseEvent(`data: ${JSON.stringify({ type: "unknown" })}`)).toBeNull();
  });

  it("encodes and parses tool status events (booking chat)", () => {
    for (const status of ["start", "done", "error"] as const) {
      const event = { type: "tool" as const, name: "search_experiences", status };
      expect(parseSseEvent(encodeSseEvent(event).trim())).toEqual(event);
    }
  });

  it("rejects tool events with an unknown status or no name", () => {
    expect(parseSseEvent(`data: ${JSON.stringify({ type: "tool", name: "x", status: "later" })}`)).toBeNull();
    expect(parseSseEvent(`data: ${JSON.stringify({ type: "tool", status: "start" })}`)).toBeNull();
  });

  it("encodes and parses card events for each card kind", () => {
    const quote = {
      kind: "quote" as const,
      quoteId: "q1",
      version: 2,
      experienceTitle: "Paseo por la senda costera",
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
    const event = { type: "card" as const, card: quote };
    expect(parseSseEvent(encodeSseEvent(event).trim())).toEqual(event);

    for (const card of [
      { kind: "offer", options: [] },
      { kind: "booking", bookingId: "b1", reference: "RS-ABC123", status: "pending_payment", link: "/booking/x.y" },
      { kind: "payment", bookingId: "b1", approvalUrl: "https://www.sandbox.paypal.com/x", amountCents: 3000, currency: "EUR" },
      { kind: "cancellation", bookingId: "b1", refundCents: 3000, currency: "EUR", policy: "full" },
      { kind: "invoice", bookingId: "b1", reference: "RS-ABC123", amountCents: 9000, currency: "EUR", dueDate: "2026-11-21", status: "sent", invoiceUrl: "https://www.sandbox.paypal.com/invoice/p/#INV2-1" },
    ]) {
      expect(parseSseEvent(`data: ${JSON.stringify({ type: "card", card })}`)?.type).toBe("card");
    }
  });

  it("rejects card events without a known kind", () => {
    expect(parseSseEvent(`data: ${JSON.stringify({ type: "card", card: { kind: "receipt" } })}`)).toBeNull();
    expect(parseSseEvent(`data: ${JSON.stringify({ type: "card" })}`)).toBeNull();
  });
});
