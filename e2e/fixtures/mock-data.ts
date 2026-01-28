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
      path: "/images/stories/lagos-covadonga.png",
      caption: "Lagos de Covadonga",
      sourcePdf: "picos-europa.pdf",
    },
  ],
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
  ],
};

