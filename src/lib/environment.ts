/**
 * Environment detection utilities for feature flags and other context-aware features.
 *
 * The environment is determined by the NEXT_PUBLIC_SITE_URL or NODE_ENV:
 * - "development" for localhost or when NODE_ENV === "development"
 * - "production" for production domains (paisaxe.es, paisaxe.com)
 */

type Environment = "development" | "production";

/**
 * Detect the current environment based on configuration.
 *
 * Priority:
 * 1. Check NEXT_PUBLIC_SITE_URL - if localhost, it's development
 * 2. Check NODE_ENV - if "development", it's development
 * 3. Default to "production"
 */
export function getEnvironment(): Environment {
  // Check site URL first (most reliable for distinguishing environments)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) {
    try {
      const url = new URL(siteUrl);
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        return "development";
      }
    } catch {
      // Invalid URL, continue to other checks
    }
  }

  // Check NODE_ENV
  if (process.env.NODE_ENV === "development") {
    return "development";
  }

  // Default to production
  return "production";
}

/**
 * Check if the current environment is development (localhost).
 */
export function isDevelopment(): boolean {
  return getEnvironment() === "development";
}

/**
 * Check if the current environment is production (live site).
 */
export function isProduction(): boolean {
  return getEnvironment() === "production";
}
