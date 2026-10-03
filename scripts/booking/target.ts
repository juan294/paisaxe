/**
 * The target of the booking seed scripts (create-voucher, create-operator-link):
 * the local Docker stack by default. Production needs --yes-production (an
 * owner-authorized action) and is the only target that reads .env.local,
 * which holds the production credentials and link secret.
 */
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { localServiceClient } from "../../src/test/local-supabase";

export type ScriptTarget = "local" | "production";

export function parseTarget(value: string): ScriptTarget {
  if (value !== "local" && value !== "production") throw new Error("--target is local or production");
  return value;
}

/** "YYYY-MM-DD", the last valid day, inclusive in Madrid (CET: the judging period is in December). */
export function endOfMadridDay(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("--expires needs YYYY-MM-DD");
  return `${date}T23:59:59+01:00`;
}

export function serviceClientFor(target: ScriptTarget, confirmProduction: boolean): SupabaseClient {
  if (target === "local") return localServiceClient();
  if (!confirmProduction) throw new Error("--target production also needs --yes-production (owner-authorized action)");
  config({ path: ".env.local" });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env.local");
  return createClient(url, key, { auth: { persistSession: false } });
}
