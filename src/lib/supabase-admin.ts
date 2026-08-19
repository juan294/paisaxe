/**
 * Supabase admin (service-role) client — SERVER ONLY.
 *
 * This module is guarded by `server-only` so that any client-side bundle that
 * accidentally imports it fails at build time with a clear error, rather than
 * silently leaking the SUPABASE_SERVICE_KEY into the browser.
 *
 * All server-side code that needs service-role access should import from here,
 * NOT from `@/lib/supabase`.
 */
import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceKey, getSupabaseUrl } from "@/lib/env";

function getRequiredSupabaseUrl() {
  const supabaseUrl = getSupabaseUrl();

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
  }

  return supabaseUrl;
}

/** Create a fresh Supabase admin (service-role) client. */
export function createAdminClient(): SupabaseClient {
  const supabaseUrl = getRequiredSupabaseUrl();
  const serviceKey = getSupabaseServiceKey();
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_KEY is required for admin operations");
  }
  return createClient(supabaseUrl, serviceKey);
}

/** Singleton admin client — lazy-initialised, reused across requests (#787). */
let _adminClient: ReturnType<typeof createAdminClient> | null = null;

/**
 * Returns a singleton Supabase admin (service-role) client.
 * Constructs the client on first call and reuses it on subsequent calls,
 * avoiding repeated construction overhead on hot paths.
 */
export function getAdminClient(): ReturnType<typeof createAdminClient> {
  if (!_adminClient) {
    _adminClient = createAdminClient();
  }
  return _adminClient;
}
