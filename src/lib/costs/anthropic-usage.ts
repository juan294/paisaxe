import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { logger } from "@/lib/logger";
import { estimateCostUsd } from "./anthropic-pricing";

/**
 * Anthropic usage persistence (#138).
 *
 * Records per-request token usage from the Messages API into the
 * anthropic_usage table and estimates cost from published per-model pricing.
 * Recording is best-effort and never throws — a failure to log usage must not
 * break the chat path.
 */

/** Shape of the `usage` block on an Anthropic Message response. */
export interface AnthropicResponseUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

/**
 * anthropic_usage `source` label, one per call site. Required and closed so a
 * missing or misspelled label cannot silently split a group in usage reports.
 */
export type UsageSource =
  | "chat"
  | "chat_stream"
  | "translate"
  | "content_discovery"
  | `marketing_${string}`;

export interface RecordUsageOptions {
  model: string;
  usage: AnthropicResponseUsage | null | undefined;
  source: UsageSource;
}

/**
 * Persist a single request's token usage and estimated cost.
 * Best-effort: logs and swallows errors so the caller's response is unaffected.
 */
export async function recordAnthropicUsage(
  options: RecordUsageOptions
): Promise<void> {
  const { model, usage, source } = options;

  if (!usage) {
    return;
  }

  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const cacheCreation = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;

  // Nothing to record (e.g. a refusal with empty usage).
  if (inputTokens === 0 && outputTokens === 0 && cacheCreation === 0 && cacheRead === 0) {
    return;
  }

  const costUsd = estimateCostUsd(model, {
    inputTokens,
    outputTokens,
    cacheCreationInputTokens: cacheCreation,
    cacheReadInputTokens: cacheRead,
  });

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("anthropic_usage").insert({
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_creation_input_tokens: cacheCreation,
      cache_read_input_tokens: cacheRead,
      cost_usd: costUsd,
      source,
    });

    if (error) {
      logger.warn("[ANTHROPIC_USAGE_INSERT_FAILED]", { error: error.message });
    }
  } catch (err) {
    logger.warn("[ANTHROPIC_USAGE_RECORD_ERROR]", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Fire-and-forget variant for request handlers. The insert starts at once and
 * is handed to next/server `after()`, so Vercel keeps the function alive until
 * it finishes instead of freezing it when the (streamed) response ends.
 * Outside a request scope (scripts, tests) `after()` throws; the insert then
 * simply runs unawaited. Never blocks the caller and never throws.
 */
export function recordAnthropicUsageInBackground(options: RecordUsageOptions): void {
  const pending = recordAnthropicUsage(options);
  try {
    after(pending);
  } catch {
    // No request scope to extend; `pending` still runs to completion.
  }
}
