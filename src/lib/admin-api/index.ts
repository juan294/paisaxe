/**
 * Client-side API helpers for admin panel.
 * Auth is handled via session cookies automatically.
 *
 * Split by domain — re-exported here for backward compatibility.
 */

export {
  createStory,
  updateStory,
  fetchStories,
  updateStoryImageUrl,
  uploadStoryImage,
  updateStoryImageSource,
  updateStoryStatus,
  bulkUpdateStoryStatus,
  bulkDeleteStories,
  approveAllPendingStories,
  searchContentImages,
  fetchStoryTranslations,
  updateStoryTranslation,
  generateStoryTranslations,
} from "./stories";

export {
  fetchAnalytics,
  fetchElevenLabsAnalytics,
  fetchStripeAnalytics,
  fetchGithubAnalytics,
  syncGithubTraffic,
} from "./analytics";

export {
  fetchFeatureFlags,
  updateFeatureFlag,
  updateFeatureFlagConfig,
} from "./feature-flags";

export {
  fetchSuggestions,
  updateSuggestion,
  deleteSuggestion,
} from "./suggestions";

export {
  fetchCostsAnalytics,
  createManualCostEntry,
  updateManualCostEntry,
  deleteManualCostEntry,
} from "./costs";

export {
  fetchAgentsSummary,
  triggerAgentRun,
  fetchRunningAgents,
  stopAgent,
  fetchAgentLogs,
} from "./agents";
