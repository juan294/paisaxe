/**
 * Shared mock responses for E2E tests.
 *
 * The app uses fallback stories when Supabase is unreachable,
 * so most page-level tests work without mocking. These fixtures
 * are for API route interception (chat, admin, feature flags).
 */

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

export const MOCK_FEATURE_FLAGS = {
  data: [
    { flagKey: "randomized_order", enabled: false },
    { flagKey: "seasonal_surfacing", enabled: false },
    { flagKey: "related_stories", enabled: false },
    { flagKey: "ambient_discovery", enabled: false },
    { flagKey: "mood_discovery", enabled: false },
    { flagKey: "surprise_me", enabled: false },
    { flagKey: "story_freshness", enabled: false },
    { flagKey: "contextual_prompts", enabled: false },
    { flagKey: "story_sharing", enabled: false },
    { flagKey: "asturianu_touches", enabled: false },
    { flagKey: "user_story_suggestions", enabled: false },
    { flagKey: "fullscreen_button", enabled: false },
    { flagKey: "visitor_voice_agent", enabled: false },
    { flagKey: "booking_system", enabled: false },
    { flagKey: "autoplay_button", enabled: false },
    { flagKey: "sms_booking_confirmation", enabled: false },
  ],
};

/**
 * Create a feature flags mock with specific overrides.
 * All flags default to `false` unless overridden.
 *
 * @example
 * withFeatureFlags({ user_story_suggestions: true, fullscreen_button: true })
 */
export function withFeatureFlags(
  overrides: Record<string, boolean>
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
