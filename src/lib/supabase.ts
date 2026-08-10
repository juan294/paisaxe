/**
 * Public Supabase client (browser + server safe).
 *
 * This module only exposes the anon-key public client. It is intentionally
 * browser-capable so that SSR pages and client components can share it.
 *
 * For server-only service-role (admin) operations, import from:
 *   @/lib/supabase-admin
 *
 * Do NOT add server-only secrets or the admin client back to this file.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseAnonKey,
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
