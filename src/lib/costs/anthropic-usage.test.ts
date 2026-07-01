// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInsert, mockFrom } = vi.hoisted(() => {
  const mockInsert = vi.fn().mockResolvedValue({ error: null });
  const mockFrom = vi.fn(() => ({ insert: mockInsert }));
  return { mockInsert, mockFrom };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

import { recordAnthropicUsage } from "./anthropic-usage";

describe("recordAnthropicUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists a usage row with an estimated cost", async () => {
    await recordAnthropicUsage({
      model: "claude-sonnet-5",
      source: "chat",
      usage: {
        input_tokens: 1_000_000,
        output_tokens: 1_000_000,
      },
    });

    expect(mockFrom).toHaveBeenCalledWith("anthropic_usage");
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const row = mockInsert.mock.calls[0][0];
    expect(row.model).toBe("claude-sonnet-5");
    expect(row.input_tokens).toBe(1_000_000);
    expect(row.output_tokens).toBe(1_000_000);
    expect(row.source).toBe("chat");
    // 1M in @ $3 + 1M out @ $15 = $18
    expect(row.cost_usd).toBeCloseTo(18, 6);
  });

  it("does nothing when usage is null", async () => {
    await recordAnthropicUsage({ model: "claude-sonnet-5", usage: null });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("does nothing when all token counts are zero", async () => {
    await recordAnthropicUsage({
      model: "claude-sonnet-5",
      usage: { input_tokens: 0, output_tokens: 0 },
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("never throws when the insert fails", async () => {
    mockInsert.mockResolvedValueOnce({ error: { message: "boom" } });
    await expect(
      recordAnthropicUsage({
        model: "claude-sonnet-5",
        usage: { input_tokens: 10, output_tokens: 5 },
      })
    ).resolves.toBeUndefined();
  });

  it("defaults missing input_tokens and output_tokens to 0 via ?? operator", async () => {
    // Usage without input/output tokens but with cache tokens — avoids the
    // all-zero early-return guard and exercises the ?? 0 fallback at lines 42-43.
    await recordAnthropicUsage({
      model: "claude-sonnet-5",
      usage: { cache_creation_input_tokens: 1000 },
    });
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const row = mockInsert.mock.calls[0][0];
    expect(row.input_tokens).toBe(0);
    expect(row.output_tokens).toBe(0);
    expect(row.cache_creation_input_tokens).toBe(1000);
  });

  it("never throws when createAdminClient throws an Error instance", async () => {
    mockFrom.mockImplementationOnce(() => {
      throw new Error("connection refused");
    });
    await expect(
      recordAnthropicUsage({
        model: "claude-sonnet-5",
        usage: { input_tokens: 10, output_tokens: 5 },
      })
    ).resolves.toBeUndefined();
  });

  it("never throws when createAdminClient throws a non-Error value", async () => {
    mockFrom.mockImplementationOnce(() => {
      throw "string error";
    });
    await expect(
      recordAnthropicUsage({
        model: "claude-sonnet-5",
        usage: { input_tokens: 10, output_tokens: 5 },
      })
    ).resolves.toBeUndefined();
  });
});
