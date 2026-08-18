export const PROBE_TIMEOUTS_MS = {
  supabase: 2_000,
  stories: 2_000,
  database: 2_000,
  // DO-H2 (#823): bounds the live Upstash PING added to /api/health so a
  // Redis hang can't make the health endpoint itself slow or unresponsive.
  rateLimit: 2_000,
} as const;
