import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  fetchManualCosts,
  createManualCost,
  updateManualCost,
  deleteManualCost,
  getManualCost,
} from "./manual-costs";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: vi.fn(),
}));

describe("manual-costs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockSupabase(methodChain: Record<string, unknown>) {
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue(methodChain),
    } as never);
  }

  describe("fetchManualCosts", () => {
    it("returns empty array when createAdminClient throws", async () => {
      vi.mocked(createAdminClient).mockImplementation(() => {
        throw new Error("SUPABASE_SERVICE_KEY is required for admin operations");
      });
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

    it("maps notes to undefined when notes is null", async () => {
      const dbRow = {
        serviceId: "vercel",
        serviceName: "Vercel",
        category: "infrastructure",
        costUsd: 20,
        billingPeriodStart: "2024-01-01",
        billingPeriodEnd: "2024-01-31",
        notes: null,
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
      expect(result[0].notes).toBeUndefined();
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

    it("returns empty array when database error is an Error instance", async () => {
      mockSupabase({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: null,
                error: new Error("connection refused"),
              }),
            }),
          }),
        }),
      });

      const result = await fetchManualCosts("2024-01-01", "2024-01-31");
      expect(result).toEqual([]);
    });

    it("returns empty array when createAdminClient throws a non-Error value", async () => {
      vi.mocked(createAdminClient).mockImplementation(() => {
        throw "non-error string";
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

    it("returns null when createAdminClient throws", async () => {
      vi.mocked(createAdminClient).mockImplementation(() => {
        throw new Error("SUPABASE_SERVICE_KEY is required for admin operations");
      });
      const result = await createManualCost(request);
      expect(result).toBeNull();
    });

    it("returns null when database error is an Error instance", async () => {
      mockSupabase({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: new Error("unique violation") }),
          }),
        }),
      });
      const result = await createManualCost(request);
      expect(result).toBeNull();
    });

    it("returns null when createAdminClient throws a non-Error value", async () => {
      vi.mocked(createAdminClient).mockImplementation(() => {
        throw "non-error string";
      });
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

    it("returns null when createAdminClient throws", async () => {
      vi.mocked(createAdminClient).mockImplementation(() => {
        throw new Error("SUPABASE_SERVICE_KEY is required for admin operations");
      });
      const result = await updateManualCost("cost-1", { costUsd: 25 });
      expect(result).toBeNull();
    });

    it("returns null when database error is an Error instance", async () => {
      mockSupabase({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: new Error("deadlock") }),
            }),
          }),
        }),
      });
      const result = await updateManualCost("cost-1", { costUsd: 25 });
      expect(result).toBeNull();
    });

    it("returns null when createAdminClient throws a non-Error value", async () => {
      vi.mocked(createAdminClient).mockImplementation(() => {
        throw "non-error string";
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

    it("returns false when createAdminClient throws", async () => {
      vi.mocked(createAdminClient).mockImplementation(() => {
        throw new Error("SUPABASE_SERVICE_KEY is required for admin operations");
      });
      const result = await deleteManualCost("cost-1");
      expect(result).toBe(false);
    });

    it("returns false when database error is an Error instance", async () => {
      mockSupabase({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: new Error("permission denied") }),
        }),
      });
      const result = await deleteManualCost("cost-1");
      expect(result).toBe(false);
    });

    it("returns false when createAdminClient throws a non-Error value", async () => {
      vi.mocked(createAdminClient).mockImplementation(() => {
        throw "non-error string";
      });
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

    it("returns null when createAdminClient throws", async () => {
      vi.mocked(createAdminClient).mockImplementation(() => {
        throw new Error("SUPABASE_SERVICE_KEY is required for admin operations");
      });
      const result = await getManualCost("cost-1");
      expect(result).toBeNull();
    });

    it("returns null when database error is an Error instance", async () => {
      mockSupabase({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: new Error("not found") }),
          }),
        }),
      });
      const result = await getManualCost("cost-1");
      expect(result).toBeNull();
    });

    it("returns null when createAdminClient throws a non-Error value", async () => {
      vi.mocked(createAdminClient).mockImplementation(() => {
        throw "non-error string";
      });
      const result = await getManualCost("cost-1");
      expect(result).toBeNull();
    });
  });
});
