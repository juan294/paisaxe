import { logger } from "@/lib/logger";
import { CHAT_MODEL } from "@/lib/models";

/**
 * Published Anthropic per-model pricing (USD per token), used to estimate spend
 * from token usage recorded in the anthropic_usage table (#138).
 *
 * Rates are USD per 1M tokens divided by 1_000_000. Cache writes bill at 1.25x
 * the base input rate (5-minute ephemeral cache); cache reads bill at 0.1x,
 * except Opus 5.5 at 0.05x and Fable 5.1 / Mythos 5.1 at 0.025x.
 * Source: https://platform.claude.com/docs/en/about-claude/pricing
 * (retrieved 2026-09-30: Sonnet 5 is $2/$10 standard; the scheduled
 * September 2026 rise to $3/$15 was cancelled). Update when models or rates change.
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

function pricing(inputPerM: number, outputPerM: number, cacheReadMultiplier = 0.1): ModelPricing {
  const input = inputPerM / PER_MILLION;
  const output = outputPerM / PER_MILLION;
  return {
    input,
    output,
    cacheWrite: input * 1.25,
    cacheRead: input * cacheReadMultiplier,
  };
}

/**
 * Per-model pricing table. Keys are matched as prefixes against the model id
 * returned by the API (which may carry a dated or dateless suffix, e.g.
 * "claude-sonnet-5"), so list more specific keys first.
 */
const MODEL_PRICING: Array<{ prefix: string; pricing: ModelPricing }> = [
  { prefix: "claude-fable-5-1", pricing: pricing(10, 50, 0.025) },
  { prefix: "claude-fable-5", pricing: pricing(10, 50) },
  { prefix: "claude-mythos-5-1", pricing: pricing(10, 50, 0.025) },
  { prefix: "claude-mythos-5", pricing: pricing(10, 50) },
  { prefix: "claude-opus-5-5", pricing: pricing(4, 20, 0.05) },
  { prefix: "claude-opus-5", pricing: pricing(5, 25) },
  // Retired Opus 4.1 and Opus 4 ("claude-opus-4-0" alias, "claude-opus-4-2025…"
  // dated id) keep their launch price; Opus 4.5-4.8 fall through to $5/$25.
  { prefix: "claude-opus-4-1", pricing: pricing(15, 75) },
  { prefix: "claude-opus-4-0", pricing: pricing(15, 75) },
  { prefix: "claude-opus-4-2025", pricing: pricing(15, 75) },
  { prefix: "claude-opus-4", pricing: pricing(5, 25) },
  { prefix: "claude-sonnet-5", pricing: pricing(2, 10) },
  { prefix: "claude-sonnet-4", pricing: pricing(3, 15) },
  { prefix: "claude-haiku-4", pricing: pricing(1, 5) },
  { prefix: "claude-3-5-haiku", pricing: pricing(0.8, 4) },
  { prefix: "claude-3-haiku", pricing: pricing(0.25, 1.25) },
];

/** Plain prefix scan of MODEL_PRICING (first match wins). */
function findPricing(normalizedModel: string): ModelPricing | undefined {
  return MODEL_PRICING.find((entry) => normalizedModel.startsWith(entry.prefix))?.pricing;
}

/**
 * Default pricing when the model is unknown: the chat model's own row, so the
 * two cannot drift. Fails at import if the chat model is not priced.
 */
const chatModelPricing = findPricing(CHAT_MODEL);
if (!chatModelPricing) {
  throw new Error(`No pricing row for CHAT_MODEL ${CHAT_MODEL}`);
}
const DEFAULT_PRICING: ModelPricing = chatModelPricing;

/** Unknown models already warned about, so each is logged once per process. */
const warnedUnknownModels = new Set<string>();

/** Resolve the pricing for a model id, falling back to a sensible default. */
export function getModelPricing(model: string): ModelPricing {
  const normalized = model.trim().toLowerCase();
  const found = findPricing(normalized);
  if (found) {
    return found;
  }
  if (!warnedUnknownModels.has(normalized)) {
    warnedUnknownModels.add(normalized);
    logger.warn("[ANTHROPIC_PRICING_UNKNOWN_MODEL]", { model });
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
