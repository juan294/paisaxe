/**
 * Issue a booking-demo voucher (PayPal hackathon plan, Phase 2).
 *
 * Prints the new code ONCE; only its SHA-256 hash is stored.
 *
 * `--replace <label>` is for a LEAKED code: after issuing the new code it
 * revokes every other active code under that label, so everyone who redeemed
 * the old code loses access and must redeem the new one. For a voucher that
 * is merely at its cap, issue a new voucher under a new label WITHOUT
 * --replace: returning users of the capped one keep being served.
 *
 * Targets the local Docker stack by default. `--target production` reads
 * NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY from .env.local and
 * requires `--yes-production`: issuing a production voucher is an
 * owner-authorized action.
 *
 * Usage:
 *   npx tsx scripts/booking/create-voucher.ts --label judges-2026 \
 *     [--max 50] [--expires 2026-12-16] [--no-voice] [--turns 60] [--attempts 10] \
 *     [--replace <label>] [--target local|production --yes-production]
 *
 * The voice pass lasts 24 hours and is renewed by redeeming again.
 */
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateVoucherCode, hashVoucherCode } from "../../src/lib/booking/vouchers";
import { endOfMadridDay, parseTarget, serviceClientFor, type ScriptTarget } from "./target";

interface VoucherOptions {
  label: string;
  max: number;
  /** Last valid day, "YYYY-MM-DD", inclusive in Madrid (CET in December). */
  expires: string;
  voice: boolean;
  turns: number;
  attempts: number;
  replace: string | null;
  target: ScriptTarget;
  confirmProduction: boolean;
}

function positiveInt(flag: string, value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`--${flag} needs a positive integer`);
  return n;
}

export function parseVoucherArgs(argv: string[]): VoucherOptions {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: {
      label: { type: "string" },
      max: { type: "string", default: "50" },
      expires: { type: "string", default: "2026-12-16" },
      "no-voice": { type: "boolean", default: false },
      turns: { type: "string", default: "60" },
      attempts: { type: "string", default: "10" },
      replace: { type: "string" },
      target: { type: "string", default: "local" },
      "yes-production": { type: "boolean", default: false },
    },
  });

  if (!values.label) throw new Error("--label is required");
  endOfMadridDay(values.expires);

  return {
    label: values.label,
    max: positiveInt("max", values.max),
    expires: values.expires,
    voice: !values["no-voice"],
    turns: positiveInt("turns", values.turns),
    attempts: positiveInt("attempts", values.attempts),
    replace: values.replace ?? null,
    target: parseTarget(values.target),
    confirmProduction: values["yes-production"],
  };
}

export async function createVoucher(client: SupabaseClient, options: VoucherOptions): Promise<{ code: string }> {
  const code = generateVoucherCode();
  const codeHash = hashVoucherCode(code);
  const inserted = await client.from("vouchers").insert({
    code_hash: codeHash,
    label: options.label,
    expires_at: endOfMadridDay(options.expires),
    max_redemptions: options.max,
    chat_turns_limit: options.turns,
    booking_attempts_limit: options.attempts,
    grants_voice_pass: options.voice,
  });
  if (inserted.error) throw new Error(`Failed to create voucher: ${inserted.error.message}`);

  // Revoke only after the replacement exists, and never the new code itself.
  if (options.replace) {
    const revoked = await client
      .from("vouchers")
      .update({ revoked_at: new Date().toISOString() })
      .eq("label", options.replace)
      .is("revoked_at", null)
      .neq("code_hash", codeHash);
    if (revoked.error) throw new Error(`Failed to revoke ${options.replace}: ${revoked.error.message}`);
  }
  return { code };
}

async function main(): Promise<void> {
  const options = parseVoucherArgs(process.argv.slice(2));
  const { code } = await createVoucher(serviceClientFor(options.target, options.confirmProduction), options);
  console.log(`Voucher "${options.label}" (${options.target}) created. Code, shown once:\n\n  ${code}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
