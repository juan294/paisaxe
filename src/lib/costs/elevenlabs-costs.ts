import type { ServiceCost } from "@/types/costs-analytics";
import { PLATFORM_SERVICES } from "@/types/costs-analytics";
import { logger } from "@/lib/logger";

// ElevenLabs pricing tiers (as of 2026)
// These are estimates based on public pricing
const ELEVENLABS_PRICING = {
  // Cost per 1000 characters for voice generation
  voiceGenerationPer1kChars: 0.30,
  // Cost per minute for conversational AI
  conversationalAiPerMinute: 0.08,
};

interface ElevenLabsUsageResponse {
  character_count: number;
  character_limit: number;
  can_extend_character_limit: boolean;
  allowed_to_extend_character_limit: boolean;
  next_character_count_reset_unix: number;
  voice_limit: number;
  max_voice_add_edits: number;
  voice_add_edit_counter: number;
  professional_voice_limit: number;
  can_extend_voice_limit: boolean;
  can_use_instant_voice_cloning: boolean;
  can_use_professional_voice_cloning: boolean;
  currency: string;
  status: string;
  billing_period: {
    start_unix: number;
    end_unix: number;
  };
}

/**
 * Estimates ElevenLabs costs based on usage data.
 * Note: ElevenLabs API provides character usage, not direct cost data.
 * We estimate based on their public pricing.
 * @param _startDate - unused, ElevenLabs returns current billing period only
 * @param _endDate - unused, ElevenLabs returns current billing period only
 */
export async function fetchElevenLabsCosts(
  _startDate: string,
  _endDate: string
): Promise<ServiceCost | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch(
      "https://api.elevenlabs.io/v1/user/subscription",
      {
        headers: {
          "xi-api-key": apiKey,
        },
        signal: AbortSignal.timeout(8_000),
      }
    );

    if (!response.ok) {
      logger.error("ElevenLabs subscription API error", {
        status: response.status,
        body: await response.text(),
      });
      return null;
    }

    const data: ElevenLabsUsageResponse = await response.json();

    // Get character usage stats
    const charactersUsed = data.character_count || 0;
    const charactersLimit = data.character_limit || 0;
    const charactersRemaining = Math.max(0, charactersLimit - charactersUsed);
    const usagePercent = charactersLimit > 0
      ? Math.round((charactersUsed / charactersLimit) * 100)
      : 0;

    // Estimate cost based on character usage
    const estimatedCost =
      (charactersUsed / 1000) * ELEVENLABS_PRICING.voiceGenerationPer1kChars;

    // Get the billing period from the API (with fallback to current month)
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const startUnix = data.billing_period?.start_unix;
    const endUnix = data.billing_period?.end_unix;

    const billingStart = startUnix && startUnix > 0
      ? new Date(startUnix * 1000).toISOString().split("T")[0]
      : defaultStart.toISOString().split("T")[0];
    const billingEnd = endUnix && endUnix > 0
      ? new Date(endUnix * 1000).toISOString().split("T")[0]
      : defaultEnd.toISOString().split("T")[0];

    return {
      serviceId: PLATFORM_SERVICES.elevenlabs.id,
      serviceName: PLATFORM_SERVICES.elevenlabs.name,
      category: PLATFORM_SERVICES.elevenlabs.category,
      costUsd: estimatedCost,
      costFormatted: formatUsd(estimatedCost),
      source: "estimate",
      billingPeriodStart: billingStart,
      billingPeriodEnd: billingEnd,
      dashboardUrl: PLATFORM_SERVICES.elevenlabs.dashboardUrl,
      notes: `${charactersRemaining.toLocaleString()} / ${charactersLimit.toLocaleString()} credits remaining (${usagePercent}% used)`,
    };
  } catch (error) {
    logger.error("Error fetching ElevenLabs usage", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Returns empty array since ElevenLabs doesn't provide daily breakdown.
 * Cost estimation is done at the billing period level only.
 */
export function fetchElevenLabsCostsByDay(
  _startDate: string,
  _endDate: string
): Promise<Array<{ date: string; costUsd: number }>> {
  // ElevenLabs doesn't provide daily breakdown
  return Promise.resolve([]);
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
