/**
 * Published Anthropic per-model pricing (USD per token), used to estimate spend
 * from token usage recorded in the anthropic_usage table (#138).
 *
 * Rates are USD per 1M tokens divided by 1_000_000. Cache writes bill at 1.25x
 * the base input rate (5-minute ephemeral cache); cache reads bill at ~0.1x.
 * Source: platform.claude.com pricing. Update when models or rates change.
 */

export interface ModelPricing {
  /** USD per input token. */
  input: number;
  /** USD per output token. */
  output: number;
  /** USD per cache-write (creation) input token. */
  cacheWrite: number;
  /** USD per cache-read input token. */
  cacheRead: number;
}

const PER_MILLION = 1_000_000;

function pricing(inputPerM: number, outputPerM: number): ModelPricing {
  const input = inputPerM / PER_MILLION;
  const output = outputPerM / PER_MILLION;
  return {
    input,
    output,
    cacheWrite: input * 1.25,
    cacheRead: input * 0.1,
  };
}

/**
 * Per-model pricing table. Keys are matched as prefixes against the model id
 * returned by the API (which may carry a date suffix, e.g.
 * "claude-sonnet-4-20250514"), so list more specific keys first.
 */
const MODEL_PRICING: Array<{ prefix: string; pricing: ModelPricing }> = [
  { prefix: "claude-opus-4", pricing: pricing(5, 25) },
  { prefix: "claude-sonnet-4", pricing: pricing(3, 15) },
  { prefix: "claude-haiku-4", pricing: pricing(1, 5) },
  { prefix: "claude-3-5-haiku", pricing: pricing(0.8, 4) },
  { prefix: "claude-3-haiku", pricing: pricing(0.25, 1.25) },
];

/** Default pricing when the model is unknown — use the chat model's tier (Sonnet). */
const DEFAULT_PRICING = pricing(3, 15);

/** Resolve the pricing for a model id, falling back to a sensible default. */
export function getModelPricing(model: string): ModelPricing {
  const normalized = model.trim().toLowerCase();
  for (const entry of MODEL_PRICING) {
    if (normalized.startsWith(entry.prefix)) {
      return entry.pricing;
    }
  }
  return DEFAULT_PRICING;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
}

/** Estimate the USD cost of a single request from its token usage. */
export function estimateCostUsd(model: string, usage: TokenUsage): number {
  const p = getModelPricing(model);
  const input = Math.max(0, usage.inputTokens || 0);
  const output = Math.max(0, usage.outputTokens || 0);
  const cacheWrite = Math.max(0, usage.cacheCreationInputTokens || 0);
  const cacheRead = Math.max(0, usage.cacheReadInputTokens || 0);

  return (
    input * p.input +
    output * p.output +
    cacheWrite * p.cacheWrite +
    cacheRead * p.cacheRead
  );
}
