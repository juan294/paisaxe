/**
 * Build a HogQL WHERE clause to filter analytics events by environment.
 *
 * When `includeDev` is false (production view), only events from production
 * domains (paisaxe.es, paisaxe.com) are included. This excludes localhost,
 * tunnel domains, and any other non-production origins.
 *
 * When `includeDev` is true, all events are included (no filtering).
 */

const PRODUCTION_DOMAINS = ["paisaxe.es", "paisaxe.com"];

export function buildDomainFilter(includeDev: boolean): string {
  if (includeDev) return "";

  const conditions = PRODUCTION_DOMAINS.map(
    (domain) => `properties.$current_url LIKE '%${domain}%'`
  );

  return `AND (${conditions.join(" OR ")})`;
}
