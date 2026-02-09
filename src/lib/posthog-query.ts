export interface HogQLResult {
  results: unknown[][];
}

/**
 * Format an ISO date string for HogQL queries: 'YYYY-MM-DD HH:MM:SS'
 * Strips milliseconds and timezone — PostHog EU uses DateTime64 with Europe/Madrid timezone.
 */
export function formatForHogQL(isoString: string): string {
  const date = new Date(isoString);
  return date.toISOString().slice(0, 19).replace("T", " ");
}

const POSTHOG_TIMEOUT_MS = 15000;
const POSTHOG_MAX_RETRIES = 2;
const POSTHOG_RETRY_DELAY_MS = 1000;

/**
 * Execute a HogQL query against the PostHog API.
 * Includes timeout and retry logic for resilience.
 */
export async function queryPostHog(
  hogql: string,
  projectId: string,
  apiKey: string,
  retryCount = 0
): Promise<HogQLResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), POSTHOG_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://eu.posthog.com/api/projects/${projectId}/query`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query: {
            kind: "HogQLQuery",
            query: hogql,
          },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PostHog API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);

    const isRetryable =
      error instanceof Error &&
      (error.name === "AbortError" ||
        error.message.includes("fetch failed") ||
        error.message.includes("ETIMEDOUT") ||
        error.message.includes("ECONNRESET"));

    if (isRetryable && retryCount < POSTHOG_MAX_RETRIES) {
      console.warn(
        `PostHog query retry ${retryCount + 1}/${POSTHOG_MAX_RETRIES} after ${error instanceof Error ? error.message : "unknown error"}`
      );
      await new Promise((resolve) =>
        setTimeout(resolve, POSTHOG_RETRY_DELAY_MS * (retryCount + 1))
      );
      return queryPostHog(hogql, projectId, apiKey, retryCount + 1);
    }

    throw error;
  }
}
