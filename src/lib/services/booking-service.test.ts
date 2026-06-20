import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase before importing the service
vi.mock("@/lib/supabase", () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase";
import {
  ACTIVE_BOOKING_STATUSES,
  claimPendingBooking,
  formatDateNatural,
  formatTimeNatural,
  getPriorBookingByIdempotencyKey,
  isValidSpanishPhone,
  markPendingBookingFailed,
  normalizePhoneNumber,
  persistBookingConversationId,
} from "./booking-service";

describe("booking-service", () => {
  describe("isValidSpanishPhone", () => {
    it("accepts international format with +34", () => {
      expect(isValidSpanishPhone("+34 985 88 77 97")).toBe(true);
      expect(isValidSpanishPhone("+34612345678")).toBe(true);
    });

    it("accepts international format without +", () => {
      expect(isValidSpanishPhone("34985887797")).toBe(true);
    });

    it("accepts national 9-digit format starting with 6/7/8/9", () => {
      expect(isValidSpanishPhone("985 88 77 97")).toBe(true);
      expect(isValidSpanishPhone("612345678")).toBe(true);
    });

    it("rejects non-Spanish formats", () => {
      expect(isValidSpanishPhone("123-456-7890")).toBe(false);
      expect(isValidSpanishPhone("12345")).toBe(false);
      expect(isValidSpanishPhone("512345678")).toBe(false); // starts with 5
    });
  });

  describe("normalizePhoneNumber", () => {
    it("preserves +34 prefix", () => {
      expect(normalizePhoneNumber("+34 985 88 77 97")).toBe("+34985887797");
    });

    it("adds + to numbers starting with 34", () => {
      expect(normalizePhoneNumber("34985887797")).toBe("+34985887797");
    });

    it("prefixes +34 to bare national numbers", () => {
      expect(normalizePhoneNumber("612345678")).toBe("+34612345678");
    });
  });

  describe("formatDateNatural", () => {
    it("leaves hoy/mañana/pasado mañana without article", () => {
      expect(formatDateNatural("hoy")).toBe("hoy");
      expect(formatDateNatural("mañana")).toBe("mañana");
      expect(formatDateNatural("pasado mañana")).toBe("pasado mañana");
    });

    it("does not double-prefix dates that already start with 'el'", () => {
      expect(formatDateNatural("el viernes")).toBe("el viernes");
    });

    it("adds 'el' to days of week and specific dates", () => {
      expect(formatDateNatural("viernes")).toBe("el viernes");
      expect(formatDateNatural("15 de febrero")).toBe("el 15 de febrero");
    });
  });

  describe("formatTimeNatural", () => {
    it("converts on-the-hour clock times", () => {
      expect(formatTimeNatural("21:00")).toBe("nueve de la noche");
      expect(formatTimeNatural("9:00")).toBe("nueve de la mañana");
    });

    it("handles half/quarter past and quarter-to", () => {
      expect(formatTimeNatural("14:30")).toBe("dos y media de la tarde");
      expect(formatTimeNatural("9:15")).toBe("nueve y cuarto de la mañana");
      expect(formatTimeNatural("12:45")).toBe("una menos cuarto de la mañana");
      expect(formatTimeNatural("13:45")).toBe("dos menos cuarto de la tarde");
    });

    it("handles midnight (0:00 → doce de la noche)", () => {
      expect(formatTimeNatural("0:00")).toBe("doce de la noche");
    });

    it("handles odd minutes", () => {
      expect(formatTimeNatural("14:20")).toBe("dos y 20 de la tarde");
    });

    it("passes through non-clock strings unchanged", () => {
      expect(formatTimeNatural("esta noche")).toBe("esta noche");
    });
  });

  describe("persistence helpers", () => {
    let mockInsert: ReturnType<typeof vi.fn>;
    let mockSelect: ReturnType<typeof vi.fn>;
    let mockUpdate: ReturnType<typeof vi.fn>;
    let mockDbSelect: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      vi.clearAllMocks();
      mockSelect = vi
        .fn()
        .mockResolvedValue({ data: [{ id: "pending-row-id" }], error: null });
      mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      mockUpdate = vi
        .fn()
        .mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      mockDbSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      vi.mocked(createAdminClient).mockReturnValue({
        from: vi.fn(() => ({
          insert: mockInsert,
          update: mockUpdate,
          select: mockDbSelect,
        })),
      } as unknown as ReturnType<typeof createAdminClient>);
    });

    describe("getPriorBookingByIdempotencyKey", () => {
      it("returns the snapshot when found", async () => {
        mockDbSelect.mockReturnValueOnce({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                conversation_id: "conv_x",
                status: "pending",
                venue_name: "Casa Gerardo",
                outcome_message: null,
              },
              error: null,
            }),
          }),
        });

        const result = await getPriorBookingByIdempotencyKey("key-1");
        expect(result).toEqual({
          conversation_id: "conv_x",
          status: "pending",
          venue_name: "Casa Gerardo",
          outcome_message: null,
        });
      });

      it("returns null when the lookup errors", async () => {
        mockDbSelect.mockReturnValueOnce({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi
              .fn()
              .mockResolvedValue({ data: null, error: { message: "boom" } }),
          }),
        });

        const result = await getPriorBookingByIdempotencyKey("key-2");
        expect(result).toBeNull();
      });
    });

    describe("claimPendingBooking", () => {
      const baseInput = {
        idempotencyKey: "claim-key",
        venueName: "Casa Gerardo",
        venuePhone: "+34985887797",
        customerName: "Juan",
        customerPhone: "+34612345678",
        partySize: 4,
        bookingDate: "hoy",
        bookingTime: "21:00",
        specialRequests: "Trona",
      };

      it("inserts with status='initiating' and null conversation_id, returns claimed id", async () => {
        const result = await claimPendingBooking(baseInput);

        expect(result).toEqual({ kind: "claimed", pendingRowId: "pending-row-id" });
        expect(mockInsert).toHaveBeenCalledWith(
          expect.objectContaining({
            idempotency_key: "claim-key",
            conversation_id: null,
            status: "initiating",
            party_size: 4,
            special_requests: "Trona",
          })
        );
      });

      it("returns duplicate + prior snapshot on a 23505 unique violation", async () => {
        mockInsert.mockReturnValueOnce({
          select: vi.fn().mockResolvedValueOnce({
            data: null,
            error: { code: "23505", message: "dup" },
          }),
        });
        mockDbSelect.mockReturnValueOnce({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                conversation_id: "conv_dup",
                status: "pending",
                venue_name: "Casa Gerardo",
                outcome_message: null,
              },
              error: null,
            }),
          }),
        });

        const result = await claimPendingBooking(baseInput);
        expect(result.kind).toBe("duplicate");
        if (result.kind === "duplicate") {
          expect(result.priorBooking?.conversation_id).toBe("conv_dup");
        }
      });

      it("returns duplicate with null prior when the lookup also errors", async () => {
        mockInsert.mockReturnValueOnce({
          select: vi.fn().mockResolvedValueOnce({
            data: null,
            error: { code: "23505", message: "dup" },
          }),
        });
        mockDbSelect.mockReturnValueOnce({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi
              .fn()
              .mockResolvedValue({ data: null, error: { message: "lookup failed" } }),
          }),
        });

        const result = await claimPendingBooking(baseInput);
        expect(result).toEqual({ kind: "duplicate", priorBooking: null });
      });

      it("returns persistence_failed on a non-unique DB error", async () => {
        mockInsert.mockReturnValueOnce({
          select: vi
            .fn()
            .mockResolvedValueOnce({ data: null, error: { message: "db down" } }),
        });

        const result = await claimPendingBooking(baseInput);
        expect(result).toEqual({ kind: "persistence_failed" });
      });

      it("returns persistence_failed when no row id comes back", async () => {
        mockInsert.mockReturnValueOnce({
          select: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
        });

        const result = await claimPendingBooking(baseInput);
        expect(result).toEqual({ kind: "persistence_failed" });
      });

      it("returns persistence_failed when the insert throws", async () => {
        mockInsert.mockReturnValueOnce({
          select: vi.fn().mockRejectedValueOnce(new Error("timeout")),
        });

        const result = await claimPendingBooking(baseInput);
        expect(result).toEqual({ kind: "persistence_failed" });
      });
    });

    describe("persistBookingConversationId", () => {
      it("returns true and updates with conversation_id + status=pending", async () => {
        const eq = vi.fn().mockResolvedValue({ error: null });
        mockUpdate.mockReturnValue({ eq });

        const ok = await persistBookingConversationId("row-1", "conv_1", "key");
        expect(ok).toBe(true);
        expect(mockUpdate).toHaveBeenCalledWith({
          conversation_id: "conv_1",
          status: "pending",
        });
        expect(eq).toHaveBeenCalledWith("id", "row-1");
      });

      it("returns false when the update errors", async () => {
        mockUpdate.mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: "conflict" } }),
        });

        const ok = await persistBookingConversationId("row-1", "conv_1", "key");
        expect(ok).toBe(false);
      });

      it("returns false when the update throws", async () => {
        mockUpdate.mockReturnValue({
          eq: vi.fn().mockRejectedValue(new Error("connection lost")),
        });

        const ok = await persistBookingConversationId("row-1", "conv_1", "key");
        expect(ok).toBe(false);
      });
    });

    describe("markPendingBookingFailed", () => {
      it("updates the row to status=failed with the outcome message", async () => {
        const eq = vi.fn().mockResolvedValue({ error: null });
        mockUpdate.mockReturnValue({ eq });

        await markPendingBookingFailed("row-9", "key", "Network error");
        expect(mockUpdate).toHaveBeenCalledWith({
          status: "failed",
          outcome_message: "Network error",
        });
        expect(eq).toHaveBeenCalledWith("id", "row-9");
      });

      it("swallows update errors (logs only, does not throw)", async () => {
        mockUpdate.mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: "mark failed" } }),
        });
        await expect(
          markPendingBookingFailed("row-9", "key", "msg")
        ).resolves.toBeUndefined();
      });

      it("swallows thrown DB exceptions", async () => {
        mockUpdate.mockReturnValue({
          eq: vi.fn().mockRejectedValue(new Error("db threw")),
        });
        await expect(
          markPendingBookingFailed("row-9", "key", "msg")
        ).resolves.toBeUndefined();
      });
    });
  });

  it("ACTIVE_BOOKING_STATUSES holds the in-progress states", () => {
    expect(ACTIVE_BOOKING_STATUSES.has("initiating")).toBe(true);
    expect(ACTIVE_BOOKING_STATUSES.has("pending")).toBe(true);
    expect(ACTIVE_BOOKING_STATUSES.has("confirmed")).toBe(true);
    expect(ACTIVE_BOOKING_STATUSES.has("failed")).toBe(false);
  });
});
