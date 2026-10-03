// @vitest-environment node
import { describe, expect, it } from "vitest";
import { normalizePaypalEvent } from "./webhook-events";

const BOOKING = "b0050000-0000-4000-8000-0000000000c1";

describe("normalizePaypalEvent", () => {
  it("takes the order id and custom_id from a CHECKOUT.ORDER event", () => {
    const payload = {
      id: "WH-1",
      event_type: "CHECKOUT.ORDER.APPROVED",
      resource: { id: "ORDER-1", purchase_units: [{ custom_id: BOOKING }] },
    };

    expect(normalizePaypalEvent(payload)).toEqual({
      event_id: "WH-1",
      event_type: "CHECKOUT.ORDER.APPROVED",
      payload,
      order_id: "ORDER-1",
      capture_id: null,
      refund_id: null,
      custom_id: BOOKING,
    });
  });

  it("takes the capture id, related order id and custom_id from a capture event", () => {
    const event = normalizePaypalEvent({
      id: "WH-2",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: { id: "CAP-1", custom_id: BOOKING, supplementary_data: { related_ids: { order_id: "ORDER-1" } } },
    });

    expect(event).toMatchObject({ order_id: "ORDER-1", capture_id: "CAP-1", refund_id: null, custom_id: BOOKING });
  });

  it("takes the refund id, and the capture id from the refund's up link, from a refund event", () => {
    const event = normalizePaypalEvent({
      id: "WH-3",
      event_type: "PAYMENT.CAPTURE.REFUNDED",
      resource: {
        id: "REFUND-1",
        custom_id: BOOKING,
        links: [
          { rel: "self", href: "https://api.sandbox.paypal.com/v2/payments/refunds/REFUND-1" },
          { rel: "up", href: "https://api.sandbox.paypal.com/v2/payments/captures/CAP-1" },
        ],
      },
    });

    expect(event).toMatchObject({ order_id: null, capture_id: "CAP-1", refund_id: "REFUND-1", custom_id: BOOKING });
  });

  it("keeps other event types without ids it does not know how to read", () => {
    expect(normalizePaypalEvent({ id: "WH-4", event_type: "PAYMENT.SALE.COMPLETED", resource: { id: "SALE-1" } })).toMatchObject({
      order_id: null,
      capture_id: null,
      refund_id: null,
      custom_id: null,
    });
  });

  it.each([
    ["no id", { event_type: "CHECKOUT.ORDER.APPROVED", resource: {} }],
    ["no event_type", { id: "WH-5", resource: {} }],
    ["an array", []],
    ["null", null],
  ])("returns null for %s", (_label, payload) => {
    expect(normalizePaypalEvent(payload)).toBeNull();
  });
});
