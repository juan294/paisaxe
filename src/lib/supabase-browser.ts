import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/env";
// AR-H1: Database type imported for use in createTypedBrowserClient() below.
// The singleton browserClient stays untyped until `supabase gen types` is run
// against the live schema to produce an accurate Database definition.
import type { Database } from "@/types/database.types";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url || !anonKey) return null;

  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}

/**
 * AR-H1: Typed browser client factory.
 * Returns a fully-typed SupabaseClient<Database> for new code that needs
 * type-safe queries. Migrate existing callers once the Database skeleton
 * is regenerated from the live schema.
 */
export function createTypedBrowserClient() {
  return createBrowserClient<Database>(
    getSupabaseUrl() ?? "",
    getSupabaseAnonKey() ?? ""
  );
}
