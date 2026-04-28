import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseAnonKey,
  getSupabaseServiceKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "@/lib/env";
// AR-H1: Database types defined in @/types/database.types.
// The typed factory (createClient<Database>) is available via createTypedSupabaseClient()
// below. The singleton `supabase` and `createAdminClient()` stay untyped until the
// Database skeleton is regenerated from the live schema with `supabase gen types`.
import type { Database } from "@/types/database.types";

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

/**
 * AR-H1: Typed Supabase client factory.
 * Use this when you need full type-safety against the Database schema.
 * Once `supabase gen types` is run against the live project, replace the
 * singleton `supabase` and `createAdminClient` exports to use this type.
 */
export function createTypedSupabaseClient(): SupabaseClient<Database> {
  const { supabaseUrl, supabaseAnonKey } = getPublicSupabaseConfig();
  return createClient<Database>(supabaseUrl, supabaseAnonKey);
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
