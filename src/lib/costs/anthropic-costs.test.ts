// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom, setRows, setError } = vi.hoisted(() => {
  let rows: unknown[] = [];
  let err: { message: string } | null = null;
  const setRows = (r: unknown[]) => {
    rows = r;
    err = null;
  };
  const setError = (e: { message: string } | null) => {
    err = e;
  };
  // Chainable query builder mock: .select().gte().lte() resolves to {data, error}.
  const mockSelect = vi.fn(() => {
    const result = Promise.resolve({ data: rows, error: err });
    const builder: Record<string, unknown> = {
      gte: () => builder,
      lte: () => result,
    };
    return builder;
  });
  const mockFrom = vi.fn(() => ({ select: mockSelect }));
  return { mockFrom, setRows, setError };
});

vi.mock("@/lib/supabase", () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

import { fetchAnthropicCosts, fetchAnthropicCostsByDay } from "./anthropic-costs";

describe("anthropic-costs (#138 — token-usage aggregation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setError(null);
  });

  describe("fetchAnthropicCosts", () => {
    it("returns null when there is no recorded usage", async () => {
      setRows([]);
      const result = await fetchAnthropicCosts("2026-06-01", "2026-06-30");
      expect(result).toBeNull();
    });

    it("aggregates recorded cost into a ServiceCost", async () => {
      setRows([
        { cost_usd: 1.5, created_at: "2026-06-01T10:00:00Z" },
        { cost_usd: "2.25", created_at: "2026-06-02T10:00:00Z" },
      ]);
      const result = await fetchAnthropicCosts("2026-06-01", "2026-06-30");
      expect(result).not.toBeNull();
      expect(result!.serviceId).toBe("anthropic");
      expect(result!.source).toBe("api");
      expect(result!.costUsd).toBeCloseTo(3.75, 6);
      expect(result!.notes).toBeTruthy();
    });

    it("returns null on a query error", async () => {
      setError({ message: "db down" });
      const result = await fetchAnthropicCosts("2026-06-01", "2026-06-30");
      expect(result).toBeNull();
    });
  });

  describe("fetchAnthropicCostsByDay", () => {
    it("returns an empty array when there is no usage", async () => {
      setRows([]);
      const result = await fetchAnthropicCostsByDay("2026-06-01", "2026-06-30");
      expect(result).toEqual([]);
    });

    it("buckets recorded cost by day, sorted ascending", async () => {
      setRows([
        { cost_usd: 1, created_at: "2026-06-02T08:00:00Z" },
        { cost_usd: 2, created_at: "2026-06-01T09:00:00Z" },
        { cost_usd: 3, created_at: "2026-06-02T20:00:00Z" },
      ]);
      const result = await fetchAnthropicCostsByDay("2026-06-01", "2026-06-30");
      expect(result).toEqual([
        { date: "2026-06-01", costUsd: 2 },
        { date: "2026-06-02", costUsd: 4 },
      ]);
    });
  });
});
