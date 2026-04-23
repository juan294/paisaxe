/**
 * Proxy submodule re-exports for convenience.
 * Import directly from the submodule files for tree-shaking.
 */
export { handleCanonicalDomain } from "./canonical-domain";
export { handleStoryRewrite } from "./story-rewrite";
export { handleRootRedirect } from "./root-redirect";
export {
  shouldBypassMaintenanceMode,
  isMaintenanceModeEnabled,
  handleMaintenanceMode,
  resetMaintenanceModeCache,
} from "./maintenance";
export {
  ALLOWED_ORIGINS,
  isAllowedOrigin,
  handleCORS,
  addCORSHeaders,
} from "./cors";
export { handleCsrfValidation, setCsrfCookie } from "./csrf-proxy";
export { buildCspHeader } from "./csp";
export {
  AUTH_REFRESH_TIMEOUT_MS,
  hasSupabaseAuthCookies,
  refreshAuthSession,
} from "./auth-refresh";
