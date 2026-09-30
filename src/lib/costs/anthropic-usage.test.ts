// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInsert, mockFrom } = vi.hoisted(() => {
  const mockInsert = vi.fn().mockResolvedValue({ error: null });
  const mockFrom = vi.fn(() => ({ insert: mockInsert }));
  return { mockInsert, mockFrom };
});

const { mockWarn } = vi.hoisted(() => ({ mockWarn: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: mockWarn, error: vi.fn(), info: vi.fn() } }));

const { mockAfter } = vi.hoisted(() => ({ mockAfter: vi.fn() }));
vi.mock("next/server", () => ({ after: mockAfter }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

import {
  recordAnthropicUsage,
  recordAnthropicUsageInBackground,
  type RecordUsageOptions,
  type UsageSource,
} from "./anthropic-usage";

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
    // 1M in @ $2 + 1M out @ $10 = $12 (Sonnet 5 list price, 2026-09-30)
    expect(row.cost_usd).toBeCloseTo(12, 6);
  });

  it("persists all four token fields", async () => {
    await recordAnthropicUsage({
      model: "claude-sonnet-5",
      source: "chat_stream",
      usage: {
        input_tokens: 12,
        output_tokens: 34,
        cache_creation_input_tokens: 1500,
        cache_read_input_tokens: 0,
      },
    });

    const row = mockInsert.mock.calls[0][0];
    expect(row).toMatchObject({
      input_tokens: 12,
      output_tokens: 34,
      cache_creation_input_tokens: 1500,
      cache_read_input_tokens: 0,
    });
  });

  it.each<UsageSource>(["chat", "chat_stream", "translate", "content_discovery", "marketing_xander"])(
    "labels the row with source %s",
    async (source) => {
      await recordAnthropicUsage({
        model: "claude-sonnet-5",
        source,
        usage: { input_tokens: 1, output_tokens: 1 },
      });
      expect(mockInsert.mock.calls[0][0].source).toBe(source);
    }
  );

  // A missing or misspelled label would silently split a group in the usage
  // digest (the old "chat" fallback is what mislabelled translation), so both
  // are compile errors. `npm run typecheck` fails if either directive is unused.
  it("rejects a missing or unknown source label at compile time", () => {
    // @ts-expect-error source is required
    const unlabelled: RecordUsageOptions = { model: "claude-sonnet-5", usage: null };
    // @ts-expect-error "translation" is not a UsageSource
    const misspelled: RecordUsageOptions = { model: "claude-sonnet-5", usage: null, source: "translation" };
    const marketing: RecordUsageOptions = { model: "claude-sonnet-5", usage: null, source: "marketing_penny" };

    expect([unlabelled.source, misspelled.source, marketing.source]).toEqual([
      undefined,
      "translation",
      "marketing_penny",
    ]);
  });

  it("does nothing when usage is null", async () => {
    await recordAnthropicUsage({ model: "claude-sonnet-5", usage: null, source: "chat" });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("does nothing when all token counts are zero", async () => {
    await recordAnthropicUsage({
      model: "claude-sonnet-5",
      source: "chat",
      usage: { input_tokens: 0, output_tokens: 0 },
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("never throws when the insert fails, and logs a structured warning", async () => {
    mockInsert.mockResolvedValueOnce({ error: { message: "boom" } });
    await expect(
      recordAnthropicUsage({
        model: "claude-sonnet-5",
        source: "chat",
        usage: { input_tokens: 10, output_tokens: 5 },
      })
    ).resolves.toBeUndefined();
    expect(mockWarn).toHaveBeenCalledWith("[ANTHROPIC_USAGE_INSERT_FAILED]", { error: "boom" });
  });

  it("defaults missing input_tokens and output_tokens to 0 via ?? operator", async () => {
    // Usage without input/output tokens but with cache tokens — avoids the
    // all-zero early-return guard and exercises the ?? 0 fallback at lines 42-43.
    await recordAnthropicUsage({
      model: "claude-sonnet-5",
      source: "chat",
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
        source: "chat",
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
        source: "chat",
        usage: { input_tokens: 10, output_tokens: 5 },
      })
    ).resolves.toBeUndefined();
  });
});

// Serverless: an unawaited insert can be frozen with the function once the
// response ends, so the background variant hands the insert to after().
describe("recordAnthropicUsageInBackground", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAfter.mockReset();
  });

  it("registers the pending insert with next/server after()", async () => {
    recordAnthropicUsageInBackground({
      model: "claude-sonnet-5",
      source: "chat_stream",
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    expect(mockAfter).toHaveBeenCalledTimes(1);
    await mockAfter.mock.calls[0][0];
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert.mock.calls[0][0].source).toBe("chat_stream");
  });

  it("still records and never throws outside a request scope (after() throws)", async () => {
    mockAfter.mockImplementation(() => {
      throw new Error("`after` was called outside a request scope");
    });

    expect(() =>
      recordAnthropicUsageInBackground({
        model: "claude-sonnet-5",
        source: "chat",
        usage: { input_tokens: 10, output_tokens: 5 },
      })
    ).not.toThrow();
    await vi.waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1));
  });

  it("returns before the insert settles (never blocks the caller)", () => {
    let settle: (value: { error: null }) => void = () => {};
    mockInsert.mockReturnValueOnce(new Promise((resolve) => { settle = resolve; }));

    const result = recordAnthropicUsageInBackground({
      model: "claude-sonnet-5",
      source: "chat",
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    expect(result).toBeUndefined();
    settle({ error: null });
  });
});
