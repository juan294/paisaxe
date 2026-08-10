import { describe, it, expect } from "vitest";
import { chatRequestSchema, favoritesPostSchema, makeBookingRequestSchema } from "./schemas";

/**
 * BE-L3 (#524): the chat schema is now the single validation path. These tests
 * cover the behaviour that previously lived in validateChatRequest:
 * sanitization, post-sanitization length limits, and messageIndex coercion.
 */
describe("chatRequestSchema", () => {
  it("sanitizes the message (trim + collapse whitespace) in one pass", () => {
    const result = chatRequestSchema.safeParse({ message: "  hello   world  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.message).toBe("hello world");
      expect(result.data.messageIndex).toBe(0);
    }
  });

  it("rejects a message that is empty after sanitization", () => {
    const result = chatRequestSchema.safeParse({ message: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects a missing message", () => {
    const result = chatRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects a non-string message", () => {
    const result = chatRequestSchema.safeParse({ message: 123 });
    expect(result.success).toBe(false);
  });

  it("rejects a message over 500 characters", () => {
    const result = chatRequestSchema.safeParse({ message: "a".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("sanitizes and accepts a valid context", () => {
    const result = chatRequestSchema.safeParse({
      message: "hello",
      context: "  some   context  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.context).toBe("some context");
    }
  });

  it("rejects a context over 600 characters", () => {
    const result = chatRequestSchema.safeParse({
      message: "hello",
      context: "b".repeat(601),
    });
    expect(result.success).toBe(false);
  });

  it("preserves a valid messageIndex", () => {
    const result = chatRequestSchema.safeParse({ message: "hi", messageIndex: 3 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.messageIndex).toBe(3);
    }
  });

  it("coerces a negative messageIndex to 0", () => {
    const result = chatRequestSchema.safeParse({ message: "hi", messageIndex: -1 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.messageIndex).toBe(0);
    }
  });

  it("coerces a non-integer messageIndex to 0", () => {
    const result = chatRequestSchema.safeParse({ message: "hi", messageIndex: 2.5 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.messageIndex).toBe(0);
    }
  });

  it("coerces a non-number messageIndex to 0", () => {
    const result = chatRequestSchema.safeParse({ message: "hi", messageIndex: "abc" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.messageIndex).toBe(0);
    }
  });
});

// ─── BE-L1: favoritesPostSchema array bounds ───────────────────────────────
describe("favoritesPostSchema", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts an array of 1 UUID", () => {
    const result = favoritesPostSchema.safeParse({ storyIds: [validUuid] });
    expect(result.success).toBe(true);
  });

  it("accepts an array of 200 UUIDs", () => {
    // Generate 200 unique-enough UUIDs by varying the last segment
    const ids = Array.from({ length: 200 }, (_, i) =>
      `550e8400-e29b-41d4-a716-${String(i).padStart(12, "0")}`
    );
    const result = favoritesPostSchema.safeParse({ storyIds: ids });
    expect(result.success).toBe(true);
  });

  it("rejects an array of 201 UUIDs (BE-L1: missing .max(200))", () => {
    const ids = Array.from({ length: 201 }, (_, i) =>
      `550e8400-e29b-41d4-a716-${String(i).padStart(12, "0")}`
    );
    const result = favoritesPostSchema.safeParse({ storyIds: ids });
    expect(result.success).toBe(false);
  });

  it("rejects an empty array", () => {
    const result = favoritesPostSchema.safeParse({ storyIds: [] });
    expect(result.success).toBe(false);
  });
});

// ─── normalizeMakeBookingKeys early-return branch (line 83) ───────────────────
describe("makeBookingRequestSchema", () => {
  const validPayload = {
    venue_name: "Restaurante El Gaitero",
    phone_number: "+34 985 11 22 33",
    party_size: 2,
    date: "2026-07-15",
    time: "20:00",
    customer_name: "María García",
    customer_phone: "+34 611 22 33 44",
  };

  it("accepts a valid snake_case booking payload", () => {
    const result = makeBookingRequestSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("accepts camelCase keys (ElevenLabs push normalisation)", () => {
    const result = makeBookingRequestSchema.safeParse({
      venueName: "Restaurante El Gaitero",
      phoneNumber: "+34 985 11 22 33",
      partySize: 2,
      date: "2026-07-15",
      time: "20:00",
      customerName: "María García",
      customerPhone: "+34 611 22 33 44",
    });
    expect(result.success).toBe(true);
  });

  it("unwraps an MCP-style arguments envelope", () => {
    const result = makeBookingRequestSchema.safeParse({
      arguments: validPayload,
    });
    expect(result.success).toBe(true);
  });

  it("hits normalizeMakeBookingKeys early-return when input is null (line 83)", () => {
    // null passes through normalizeMakeBookingKeys unchanged (line 83),
    // then fails makeBookingSchema validation (missing required fields).
    const result = makeBookingRequestSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it("hits normalizeMakeBookingKeys early-return when input is a string", () => {
    const result = makeBookingRequestSchema.safeParse("booking");
    expect(result.success).toBe(false);
  });

  it("hits normalizeMakeBookingKeys early-return when input is an array", () => {
    const result = makeBookingRequestSchema.safeParse([validPayload]);
    expect(result.success).toBe(false);
  });

  it("unwraps arguments envelope where arguments is null (normalizeMakeBookingKeys receives null)", () => {
    const result = makeBookingRequestSchema.safeParse({ arguments: null });
    expect(result.success).toBe(false);
  });
});
