import { createClient } from "@supabase/supabase-js";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const rawAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!rawUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
}

if (!rawAnonKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is required");
}

// After the guards above, TypeScript knows these are non-empty strings.
const supabaseUrl: string = rawUrl;
const supabaseAnonKey: string = rawAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for server-side operations (seeding, etc.)
export function createAdminClient() {
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) is required for admin operations"
    );
  }
  return createClient(supabaseUrl, serviceKey);
}
