export const PROBE_TIMEOUTS_MS = {
  supabase: 2_000,
  stories: 2_000,
  database: 2_000,
  // Bounds the live Upstash PING added to /api/health so a Redis hang can't
  // make the health endpoint itself slow or unresponsive (#823).
  rateLimit: 2_000,
  // QA-L3 (#882): bounds the voice_purchases reachability probe the same way
  // as the other admin-client probe (database), so a hung query can't make
  // the health endpoint itself slow or unresponsive.
  voicePurchases: 2_000,
} as const;
