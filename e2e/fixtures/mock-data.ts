/**
 * Shared mock responses for E2E tests.
 *
 * The app uses fallback stories when Supabase is unreachable,
 * so most page-level tests work without mocking. These fixtures
 * are for API route interception (chat, admin, feature flags).
 */

import type { FeatureFlagKey } from "../../src/types/feature-flags";

export const MOCK_CHAT_RESPONSE = {
  message:
    "Los Lagos de Covadonga son dos lagos de origen glaciar situados en los Picos de Europa. Se puede visitar en cualquier época del año.",
  sources: [
    {
      title: "Guía de los Picos de Europa",
      section: "Lagos de Covadonga",
    },
  ],
  images: [
    {
      id: "img-1",
      path: "/images/stories/lagos-covadonga.webp",
      caption: "Lagos de Covadonga",
      sourcePdf: "picos-europa.pdf",
    },
  ],
};

export const MOCK_CHAT_RESPONSE_FOLLOWUP = {
  message:
    "La Senda del Cares es una ruta de senderismo espectacular que recorre el desfiladero del río Cares entre Caín y Poncebos.",
  sources: [
    {
      title: "Rutas de Senderismo en Asturias",
      section: "Senda del Cares",
    },
  ],
  images: [],
};

// Every mock flag starts off. Order follows the original fixture.
const MOCK_FLAG_KEYS = [
  "randomized_order",
  "seasonal_surfacing",
  "related_stories",
  "ambient_discovery",
  "mood_discovery",
  "surprise_me",
  "story_freshness",
  "contextual_prompts",
  "story_sharing",
  "asturianu_touches",
  "user_story_suggestions",
  "fullscreen_button",
  "visitor_voice_agent",
  "booking_system",
  "experience_booking",
  "autoplay_button",
  "sms_booking_confirmation",
  "maintenance_mode",
  "automated_agents",
  "coverage_agent_enabled",
  "security_agent_enabled",
  "documentation_agent_enabled",
  "performance_agent_enabled",
  "qa_agent_enabled",
  "localization_agent_enabled",
  "cost_analyst_agent_enabled",
  "subscription_optimizer_enabled",
  "content_discovery_agent_enabled",
] as const;

type MockFlagKey = (typeof MOCK_FLAG_KEYS)[number];

// Compile-time check: every runtime FeatureFlagKey needs a mock entry, because
// withFeatureFlags can only turn on a flag that is listed here (#1015).
function assertEveryFlagMocked<Unmocked extends never>(): void {
  // Type-level assertion only.
}
assertEveryFlagMocked<Exclude<FeatureFlagKey, MockFlagKey>>();

export const MOCK_FEATURE_FLAGS: { data: { flagKey: MockFlagKey; enabled: boolean }[] } = {
  data: MOCK_FLAG_KEYS.map((flagKey) => ({ flagKey, enabled: false })),
};

/**
 * Create a feature flags mock with specific overrides.
 * All flags default to `false` unless overridden. Only listed flags are
 * accepted, so a misspelled or unmocked flag fails the typecheck.
 *
 * @example
 * withFeatureFlags({ user_story_suggestions: true, fullscreen_button: true })
 */
export function withFeatureFlags(
  overrides: Partial<Record<MockFlagKey, boolean>>
): typeof MOCK_FEATURE_FLAGS {
  return {
    data: MOCK_FEATURE_FLAGS.data.map((flag) => ({
      ...flag,
      enabled: overrides[flag.flagKey] ?? flag.enabled,
    })),
  };
}

export const MOCK_SUGGESTION_RESPONSE = {
  data: {
    id: "suggestion-1",
    userId: null,
    placeName: "Playa del Silencio",
    comment: "A hidden gem on the western coast",
    location: "western",
    attribution: "A visitor",
    status: "pending",
    adminNotes: null,
    convertedStoryId: null,
    createdAt: "2026-01-15T10:00:00Z",
    updatedAt: "2026-01-15T10:00:00Z",
  },
};
