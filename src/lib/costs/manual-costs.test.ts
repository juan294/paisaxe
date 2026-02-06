import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  fetchManualCosts,
  createManualCost,
  updateManualCost,
  deleteManualCost,
  getManualCost,
} from "./manual-costs";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

describe("manual-costs", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_KEY = "test-service-key";
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  function mockSupabase(methodChain: Record<string, unknown>) {
    vi.mocked(createClient).mockReturnValue({
      from: vi.fn().mockReturnValue(methodChain),
    } as never);
  }

  describe("fetchManualCosts", () => {
    it("returns empty array when Supabase credentials are missing", async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      const result = await fetchManualCosts("2024-01-01", "2024-01-31");
      expect(result).toEqual([]);
    });

    it("returns mapped costs on success", async () => {
      const dbRow = {
        serviceId: "vercel",
        serviceName: "Vercel",
        category: "infrastructure",
        costUsd: 20,
        billingPeriodStart: "2024-01-01",
        billingPeriodEnd: "2024-01-31",
        notes: "Monthly plan",
        createdBy: "user-1",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };

      mockSupabase({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [dbRow], error: null }),
            }),
          }),
        }),
      });

      const result = await fetchManualCosts("2024-01-01", "2024-01-31");

      expect(result).toHaveLength(1);
      expect(result[0].serviceId).toBe("vercel");
      expect(result[0].costUsd).toBe(20);
      expect(result[0].source).toBe("manual");
      expect(result[0].costFormatted).toBe("$20.00");
    });

    it("returns empty array on database error", async () => {
      mockSupabase({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
            }),
          }),
        }),
      });

      const result = await fetchManualCosts("2024-01-01", "2024-01-31");
      expect(result).toEqual([]);
    });

    it("returns empty array when data is null without error", async () => {
      mockSupabase({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      });

      const result = await fetchManualCosts("2024-01-01", "2024-01-31");
      expect(result).toEqual([]);
    });
  });

  describe("createManualCost", () => {
    const request = {
      serviceId: "vercel",
      serviceName: "Vercel",
      category: "infrastructure" as const,
      costUsd: 20,
      billingPeriodStart: "2024-01-01",
      billingPeriodEnd: "2024-01-31",
    };

    it("creates a cost entry and returns mapped result", async () => {
      const dbResult = {
        id: "cost-1",
        service_id: "vercel",
        service_name: "Vercel",
        category: "infrastructure",
        cost_usd: 20,
        billing_period_start: "2024-01-01",
        billing_period_end: "2024-01-31",
        notes: null,
        created_by: "user-1",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      mockSupabase({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: dbResult, error: null }),
          }),
        }),
      });

      const result = await createManualCost(request, "user-1");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("cost-1");
      expect(result!.serviceId).toBe("vercel");
    });

    it("returns null on database error", async () => {
      mockSupabase({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: "Insert failed" } }),
          }),
        }),
      });

      const result = await createManualCost(request);
      expect(result).toBeNull();
    });

    it("returns null when Supabase credentials missing", async () => {
      delete process.env.SUPABASE_SERVICE_KEY;
      const result = await createManualCost(request);
      expect(result).toBeNull();
    });
  });

  describe("updateManualCost", () => {
    it("updates cost and returns mapped result", async () => {
      const dbResult = {
        id: "cost-1",
        service_id: "vercel",
        service_name: "Vercel",
        category: "infrastructure",
        cost_usd: 25,
        billing_period_start: "2024-01-01",
        billing_period_end: "2024-01-31",
        notes: "Updated notes",
        created_by: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z",
      };

      mockSupabase({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: dbResult, error: null }),
            }),
          }),
        }),
      });

      const result = await updateManualCost("cost-1", { costUsd: 25, notes: "Updated notes" });

      expect(result).not.toBeNull();
      expect(result!.costUsd).toBe(25);
      expect(result!.notes).toBe("Updated notes");
    });

    it("returns null on database error", async () => {
      mockSupabase({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: "Update failed" } }),
            }),
          }),
        }),
      });

      const result = await updateManualCost("cost-1", { costUsd: 25 });
      expect(result).toBeNull();
    });
  });

  describe("deleteManualCost", () => {
    it("returns true on successful deletion", async () => {
      mockSupabase({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const result = await deleteManualCost("cost-1");
      expect(result).toBe(true);
    });

    it("returns false on database error", async () => {
      mockSupabase({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: "Delete failed" } }),
        }),
      });

      const result = await deleteManualCost("cost-1");
      expect(result).toBe(false);
    });

    it("returns false when Supabase credentials missing", async () => {
      delete process.env.SUPABASE_SERVICE_KEY;
      const result = await deleteManualCost("cost-1");
      expect(result).toBe(false);
    });
  });

  describe("getManualCost", () => {
    it("returns mapped entry on success", async () => {
      const dbResult = {
        id: "cost-1",
        service_id: "vercel",
        service_name: "Vercel",
        category: "infrastructure",
        cost_usd: 20,
        billing_period_start: "2024-01-01",
        billing_period_end: "2024-01-31",
        notes: null,
        created_by: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      mockSupabase({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: dbResult, error: null }),
          }),
        }),
      });

      const result = await getManualCost("cost-1");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("cost-1");
      expect(result!.serviceId).toBe("vercel");
      expect(result!.notes).toBeNull();
    });

    it("returns null on database error", async () => {
      mockSupabase({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: "Not found" } }),
          }),
        }),
      });

      const result = await getManualCost("non-existent");
      expect(result).toBeNull();
    });
  });
});
