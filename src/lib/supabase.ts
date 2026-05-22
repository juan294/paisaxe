import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseAnonKey,
  getSupabaseServiceKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "@/lib/env";

function getRequiredSupabaseUrl() {
  const supabaseUrl = getSupabaseUrl();

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
  }

  return supabaseUrl;
}

function getPublicSupabaseConfig() {
  const supabaseUrl = getRequiredSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

  if (!supabaseAnonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is required");
  }

  return { supabaseUrl, supabaseAnonKey };
}

type PublicSupabaseClient = SupabaseClient;

let publicClient: PublicSupabaseClient | null = null;

function getPublicClient() {
  if (!publicClient) {
    const { supabaseUrl, supabaseAnonKey } = getPublicSupabaseConfig();
    publicClient = createClient(supabaseUrl, supabaseAnonKey);
  }

  return publicClient;
}

export const supabase = new Proxy({} as PublicSupabaseClient, {
  get(_target, prop) {
    const client = getPublicClient();
    const value = client[prop as keyof typeof client];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

// Admin client for server-side operations (seeding, etc.)
export function createAdminClient() {
  const supabaseUrl = getRequiredSupabaseUrl();
  const serviceKey = getSupabaseServiceRoleKey() ?? getSupabaseServiceKey();
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) is required for admin operations"
    );
  }
  return createClient(supabaseUrl, serviceKey);
}

/** BE-M3: Singleton admin client — lazy-initialised, reused across requests. */
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
