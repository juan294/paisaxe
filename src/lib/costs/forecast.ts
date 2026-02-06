import type {
  ServiceCost,
  UsageMetrics,
  ForecastScenario,
} from "@/types/costs-analytics";

// Fallback per-unit rates from cost-forecast.md when usage is 0
const FALLBACK_COST_PER_CHAT = 0.01; // ~$10 per 1000 chats (Claude API estimate)
const FALLBACK_COST_PER_VOICE_MINUTE = 0.08; // ElevenLabs overage rate

const DEFAULT_MULTIPLIERS = [1, 3, 10];
const DAYS_PER_MONTH = 30;

/**
 * Compute scaling forecast scenarios based on actual service costs and usage metrics.
 *
 * Fixed costs (recurring subscriptions) stay constant across multipliers.
 * Variable costs (AI, voice) scale linearly with the multiplier.
 */
export function computeForecasts(
  services: ServiceCost[],
  usage: UsageMetrics,
  multipliers: number[] = DEFAULT_MULTIPLIERS
): ForecastScenario[] {
  // Separate fixed vs variable costs
  const fixedCosts = services
    .filter((s) => s.source === "recurring")
    .reduce((sum, s) => sum + s.costUsd, 0);

  // AI costs (anthropic, voyage)
  const aiCost = services
    .filter(
      (s) =>
        s.source !== "recurring" &&
        (s.serviceId === "anthropic" || s.serviceId === "voyage")
    )
    .reduce((sum, s) => sum + s.costUsd, 0);

  // Voice costs (elevenlabs, but NOT the recurring base)
  const voiceCost = services
    .filter(
      (s) =>
        s.source !== "recurring" &&
        s.serviceId === "elevenlabs"
    )
    .reduce((sum, s) => sum + s.costUsd, 0);

  // Normalize to monthly rate
  const periodDays = Math.max(usage.periodDays, 1);
  const monthlyFactor = DAYS_PER_MONTH / periodDays;

  // Compute per-unit rates from actual data, with fallbacks
  const costPerChat =
    usage.chatConversations > 0
      ? aiCost / usage.chatConversations
      : FALLBACK_COST_PER_CHAT;

  const costPerVoiceMinute =
    usage.voiceMinutes > 0
      ? voiceCost / usage.voiceMinutes
      : FALLBACK_COST_PER_VOICE_MINUTE;

  // Monthly baseline usage
  const monthlyVisitors = Math.round(usage.visitors * monthlyFactor);
  const monthlyChats = Math.round(usage.chatConversations * monthlyFactor);
  const monthlyVoiceConversations = Math.round(
    usage.voiceConversations * monthlyFactor
  );
  const monthlyVoiceMinutes = Math.round(usage.voiceMinutes * monthlyFactor);

  // Monthly baseline variable costs
  const monthlyAiCost = monthlyChats * costPerChat;
  const monthlyVoiceCost = monthlyVoiceMinutes * costPerVoiceMinute;

  const labels = ["Current", "3x Growth", "10x Growth"];

  return multipliers.map((multiplier, i) => {
    const scaledAi = monthlyAiCost * multiplier;
    const scaledVoice = monthlyVoiceCost * multiplier;

    return {
      label: labels[i] ?? `${multiplier}x`,
      multiplier,
      visitors: Math.round(monthlyVisitors * multiplier),
      chats: Math.round(monthlyChats * multiplier),
      voiceConversations: Math.round(monthlyVoiceConversations * multiplier),
      voiceMinutes: Math.round(monthlyVoiceMinutes * multiplier),
      estimatedMonthlyCost:
        Math.round((fixedCosts + scaledAi + scaledVoice) * 100) / 100,
      breakdown: {
        infrastructure: Math.round(fixedCosts * 100) / 100,
        ai: Math.round(scaledAi * 100) / 100,
        voice: Math.round(scaledVoice * 100) / 100,
      },
    };
  });
}
