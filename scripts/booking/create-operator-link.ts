/**
 * Issue an operator link for a merchant (PayPal hackathon plan, Phase 5).
 *
 * Inserts one operator_access row for the merchant slug and prints the
 * derived link `/operator/<id>.<token>` ONCE. The token is never stored: it
 * is the HMAC of the row id and link_version under BOOKING_LINK_SECRET, so
 * the link only opens on a site that has the same secret. The link stops
 * working when the expiry day ends (Madrid). Issuing a new link does NOT
 * revoke an older one: each row stays valid until its own expiry, so a
 * leaked link is revoked by expiring its row in the database.
 *
 * Targets the local Docker stack by default. `--target production` reads
 * NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY from .env.local and
 * requires `--yes-production`: issuing a production operator link is an
 * owner-authorized action; only that target reads .env.local (it holds the
 * production credentials and link secret). A local run takes
 * BOOKING_LINK_SECRET from its own environment: the secret of the local server
 * that will serve the link.
 *
 * Usage (links.ts is server-only, hence the react-server condition):
 *   npx tsx --conditions=react-server scripts/booking/create-operator-link.ts \
 *     --merchant demo-rutas-del-sella [--label "Operador demo"] [--expires 2026-12-16] \
 *     [--target local|production --yes-production]
 */
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import type { SupabaseClient } from "@supabase/supabase-js";
import { operatorLink } from "../../src/lib/booking/links";
import { endOfMadridDay, parseTarget, serviceClientFor, type ScriptTarget } from "./target";

interface OperatorLinkOptions {
  merchant: string;
  label: string;
  /** Last valid day, "YYYY-MM-DD", inclusive in Madrid (CET in December). */
  expires: string;
  target: ScriptTarget;
  confirmProduction: boolean;
}

export function parseOperatorLinkArgs(argv: string[]): OperatorLinkOptions {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: {
      merchant: { type: "string" },
      label: { type: "string" },
      expires: { type: "string", default: "2026-12-16" },
      target: { type: "string", default: "local" },
      "yes-production": { type: "boolean", default: false },
    },
  });

  if (!values.merchant) throw new Error("--merchant <slug> is required");
  endOfMadridDay(values.expires);

  return {
    merchant: values.merchant,
    label: values.label ?? `Operador ${values.merchant}`,
    expires: values.expires,
    target: parseTarget(values.target),
    confirmProduction: values["yes-production"],
  };
}

export async function createOperatorAccess(client: SupabaseClient, options: OperatorLinkOptions): Promise<{ link: string }> {
  const merchant = await client.from("merchants").select("id").eq("slug", options.merchant).maybeSingle();
  if (merchant.error) throw new Error(`Failed to look up merchant: ${merchant.error.message}`);
  if (!merchant.data) throw new Error(`No merchant with slug ${options.merchant}`);

  // Derive a throwaway link first: a missing or short secret fails before any row exists.
  operatorLink({ id: "00000000-0000-4000-8000-000000000000", linkVersion: 1 });

  const inserted = await client
    .from("operator_access")
    .insert({ merchant_id: merchant.data.id, label: options.label, expires_at: endOfMadridDay(options.expires) })
    .select("id, link_version")
    .single();
  if (inserted.error) throw new Error(`Failed to create operator access: ${inserted.error.message}`);

  return { link: operatorLink({ id: inserted.data.id as string, linkVersion: inserted.data.link_version as number }) };
}

async function main(): Promise<void> {
  const options = parseOperatorLinkArgs(process.argv.slice(2));
  const { link } = await createOperatorAccess(serviceClientFor(options.target, options.confirmProduction), options);
  console.log(
    `Operator link for "${options.merchant}" (${options.target}), valid through ${options.expires}. Shown once:\n\n  ${link}\n\n` +
      "Prefix it with the site origin. Never paste it into an issue, a log or a chat."
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
