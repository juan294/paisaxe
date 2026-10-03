/**
 * LOCAL-ONLY support for the booking Postman collection (PayPal hackathon
 * plan, Phase 5, unit [postman]): docs/hackathon/postman/.
 *
 * Starts the PayPal stand-in (src/test/paypal-mock-server.ts) on a fixed
 * loopback port, seeds the local Docker database (flag on, fixture
 * experience, a voucher), serves two loopback control routes the collection's
 * "Local only" requests call, and writes a filled Postman environment to the
 * temp directory, never into the repository. Stays up until Ctrl-C.
 *
 * Control routes (127.0.0.1 only):
 *   POST /quotes {accessToken}                 a fresh and an expired quote for that
 *                                              anonymous user -> {quoteId, staleQuoteId}
 *   POST /paypal/orders/:orderId/approve       the buyer approves at the mock
 *
 * Refuses any non-loopback Supabase, site or PayPal URL, and any environment
 * that looks like .env.local (a non-loopback NEXT_PUBLIC_SUPABASE_URL).
 *
 * Command sequence (three terminals, from the repository root; see
 * docs/hackathon/postman/README.md):
 *   1. npx tsx scripts/booking/postman-local.ts
 *   2. next dev on port 3006 with only local variables, PAYPAL_API_BASE=http://127.0.0.1:4010
 *   3. npx --yes newman@6 run docs/hackathon/postman/paisaxe-booking.postman_collection.json \
 *        -e "$TMPDIR/paisaxe-postman/paisaxe-booking.local.postman_environment.json"
 */
import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, madridDate } from "../../src/lib/booking/types";
import { LOCAL_ANON_KEY, LOCAL_API_URL, localServiceClient, psql } from "../../src/test/local-supabase";
import { startPaypalMock } from "../../src/test/paypal-mock-server";
import { createVoucher, parseVoucherArgs } from "./create-voucher";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** Every variable of the collection, in the order of the environment template. */
export const ENV_KEYS = [
  "baseUrl",
  "supabaseUrl",
  "supabaseAnonKey",
  "voucherCode",
  "quoteId",
  "staleQuoteId",
  "localControlUrl",
  "csrfToken",
  "accessToken",
  "capability",
  "approveUrl",
  "paypalOrderId",
  "captureId",
  "depositCents",
  "expectedRefundCents",
  "higherRefundCents",
  "cancelStatus",
  "refundId",
  "refundValue",
  "webhookEventId",
  "webhookTransmissionId",
  "webhookTransmissionTime",
  "statusSnapshot",
] as const;

export type EnvKey = (typeof ENV_KEYS)[number];

const FIXTURE_MERCHANT = "demo-rutas-del-sella";
const FIXTURE_EXPERIENCE = "paseo-senda-costera";
const QUOTE_TTL_MS = 15 * 60_000;
const PARTY_SIZE = 2;

export interface RunnerOptions {
  baseUrl: string;
  paypalPort: number;
  controlPort: number;
  out: string;
}

function port(flag: string, value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 65_535) throw new Error(`--${flag} needs a port number`);
  return n;
}

export function parseRunnerArgs(argv: string[]): RunnerOptions {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: {
      "base-url": { type: "string", default: "http://localhost:3006" },
      "paypal-port": { type: "string", default: "4010" },
      "control-port": { type: "string", default: "4011" },
      out: { type: "string", default: resolve(tmpdir(), "paisaxe-postman", "paisaxe-booking.local.postman_environment.json") },
    },
  });
  return {
    baseUrl: values["base-url"].replace(/\/+$/, ""),
    paypalPort: port("paypal-port", values["paypal-port"]),
    controlPort: port("control-port", values["control-port"]),
    out: resolve(values.out),
  };
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function isLoopbackUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return (url.protocol === "http:" || url.protocol === "https:") && LOOPBACK_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

/** Throws unless every URL this run would touch is on this machine. */
export function assertLocalTargets(targets: Record<string, string | undefined>): void {
  for (const [name, raw] of Object.entries(targets)) {
    if (raw === undefined || raw === "") continue;
    if (!isLoopbackUrl(raw)) {
      throw new Error(`Refusing to run: ${name} is not a loopback URL. This runner is local only (never production).`);
    }
  }
}

/** The filled environment holds a voucher code and is written outside the repository only. */
export function assertOutsideRepo(path: string, repoRoot: string = REPO_ROOT): void {
  const rel = relative(repoRoot, resolve(path));
  if (rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))) {
    throw new Error(`Refusing to write the filled environment inside the repository (${rel || "."}); use the temp directory.`);
  }
}

export function buildEnvironment(name: string, values: Partial<Record<EnvKey, string>>) {
  return {
    name,
    values: ENV_KEYS.map((key) => ({ key, value: values[key] ?? "", type: "default", enabled: true })),
    _postman_variable_scope: "environment",
  };
}

/** YYYY-MM-DD, `days` after `now` (UTC calendar; the slot is weeks away, so the zone never matters). */
/** A slot date `days` after today in Madrid, the calendar bookings use. */
export function slotDateAfter(now: Date, days: number): string {
  return addDays(madridDate(now), days);
}

interface FixtureExperience {
  id: string;
  priceCents: number;
  depositCents: number;
  cancellationWindowHours: number;
}

async function loadFixtureExperience(client: SupabaseClient): Promise<FixtureExperience | null> {
  const { data, error } = await client
    .from("experiences")
    .select("id, price_cents, deposit_cents, merchant:merchants(cancellation_window_hours)")
    .eq("slug", FIXTURE_EXPERIENCE)
    .maybeSingle();
  if (error) throw new Error(`Failed to load the fixture experience: ${error.message}`);
  if (!data) return null;
  const merchant = data.merchant as unknown as { cancellation_window_hours: number } | null;
  return {
    id: data.id as string,
    priceCents: data.price_cents as number,
    depositCents: data.deposit_cents as number,
    cancellationWindowHours: merchant?.cancellation_window_hours ?? 24,
  };
}

/** The fixture of migration 116, re-created only when a local reset lost it. */
async function ensureFixture(client: SupabaseClient): Promise<FixtureExperience> {
  const existing = await loadFixtureExperience(client);
  if (existing) return existing;

  const merchant = await client
    .from("merchants")
    .upsert(
      { slug: FIXTURE_MERCHANT, name: "Rutas del Sella (demo, ficticio)", timezone: "Europe/Madrid", cancellation_window_hours: 24, is_fixture: true },
      { onConflict: "slug" }
    )
    .select("id")
    .single();
  if (merchant.error) throw new Error(`Failed to seed the fixture merchant: ${merchant.error.message}`);
  const experience = await client.from("experiences").upsert(
    {
      merchant_id: merchant.data.id,
      slug: FIXTURE_EXPERIENCE,
      title: "Paseo por la senda costera",
      description: "Paseo guiado y llano por la senda costera, con paradas en los miradores. Experiencia de demostración (ficticia).",
      price_cents: 12_000,
      deposit_cents: 3_000,
      max_party: 6,
      capacity_per_slot: 12,
      slot_rule: { weekdays: [1, 2, 3, 4, 5, 6, 7], start_times: ["10:00", "16:00"] },
      duration_minutes: 150,
    },
    { onConflict: "slug" }
  );
  if (experience.error) throw new Error(`Failed to seed the fixture experience: ${experience.error.message}`);
  const seeded = await loadFixtureExperience(client);
  if (!seeded) throw new Error("The fixture experience is still missing after seeding");
  return seeded;
}

/** experience_booking on for the development environment of the LOCAL database (migration 117 already does). */
function ensureFlagOn(): void {
  psql(
    "INSERT INTO public.feature_flags (flag_key, enabled, label, description, config, environment) " +
      "VALUES ('experience_booking', true, 'Experience Booking', 'Local Postman run', '{}'::jsonb, 'development') " +
      "ON CONFLICT (flag_key, environment) DO UPDATE SET enabled = true"
  );
}

export interface SeededQuotes {
  quoteId: string;
  staleQuoteId: string;
}

/** A fresh quote and an already expired one for this user, three to six weeks out. */
export async function seedQuotes(client: SupabaseClient, experience: FixtureExperience, userId: string, now = new Date()): Promise<SeededQuotes> {
  const base = {
    user_id: userId,
    experience_id: experience.id,
    version: 1,
    slot_date: slotDateAfter(now, 21 + Math.floor(Math.random() * 21)),
    slot_time: "10:00",
    party_size: PARTY_SIZE,
    total_cents: experience.priceCents,
    deposit_cents: experience.depositCents,
    currency: "EUR",
    cancellation_window_hours: experience.cancellationWindowHours,
  };
  const { data, error } = await client
    .from("quotes")
    .insert([
      { ...base, expires_at: new Date(now.getTime() + QUOTE_TTL_MS).toISOString() },
      { ...base, expires_at: new Date(now.getTime() - 60_000).toISOString() },
    ])
    .select("id, expires_at");
  if (error || !data || data.length !== 2) throw new Error(`Failed to seed quotes: ${error?.message ?? "unexpected rows"}`);
  const [fresh, stale] = [...data].sort((a, b) => Date.parse(b.expires_at as string) - Date.parse(a.expires_at as string));
  return { quoteId: fresh.id as string, staleQuoteId: stale.id as string };
}

export interface ControlDeps {
  /** The user id behind an access token, or null. */
  userFor(accessToken: string): Promise<string | null>;
  seed(userId: string): Promise<SeededQuotes>;
  approve(orderId: string): void;
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function reply(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
}

export async function handleControl(deps: ControlDeps, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
  const approval = path.match(/^\/paypal\/orders\/([A-Za-z0-9-]+)\/approve$/);

  if (request.method === "POST" && path === "/quotes") {
    const token = (await readJson(request)).accessToken;
    const userId = typeof token === "string" && token ? await deps.userFor(token) : null;
    if (!userId) return reply(response, 401, { error: "unknown session" });
    return reply(response, 200, await deps.seed(userId));
  }
  if (request.method === "POST" && approval) {
    try {
      deps.approve(approval[1]);
    } catch (error) {
      return reply(response, 409, { error: error instanceof Error ? error.message : String(error) });
    }
    return reply(response, 200, { orderId: approval[1], status: "APPROVED" });
  }
  reply(response, 404, { error: "not found" });
}

export async function startControlServer(deps: ControlDeps, listenPort: number): Promise<Server> {
  const server = createServer((request, response) => {
    handleControl(deps, request, response).catch((error: unknown) => {
      if (!response.headersSent) reply(response, 500, { error: error instanceof Error ? error.message : String(error) });
    });
  });
  await new Promise<void>((done, fail) => {
    server.once("error", fail);
    server.listen(listenPort, "127.0.0.1", () => {
      server.off("error", fail);
      done();
    });
  });
  return server;
}

async function main(): Promise<void> {
  const options = parseRunnerArgs(process.argv.slice(2));
  assertLocalTargets({
    "the local Supabase URL (SUPABASE_LOCAL_API_URL)": LOCAL_API_URL,
    "--base-url": options.baseUrl,
    "NEXT_PUBLIC_SUPABASE_URL in this shell": process.env.NEXT_PUBLIC_SUPABASE_URL,
    "PAYPAL_API_BASE in this shell": process.env.PAYPAL_API_BASE,
  });
  assertOutsideRepo(options.out);

  const client = localServiceClient();
  ensureFlagOn();
  const experience = await ensureFixture(client);
  const { code } = await createVoucher(
    client,
    // Each newman run redeems it once with a new anonymous session; ten runs per runner start.
    parseVoucherArgs(["--label", `postman-local-${new Date().toISOString().slice(0, 10)}`, "--max", "10", "--no-voice"])
  );

  // The local database keeps earlier runs' payments (order_id is unique): ids must not repeat.
  const mock = await startPaypalMock({ port: options.paypalPort, idSalt: randomBytes(4).toString("hex").toUpperCase() });
  // Like a sandbox refund that completes later: the refund webhook moves it
  // refund_pending -> refunded, and the redelivery then changes nothing.
  mock.setRefundStatus("PENDING");
  const control = await startControlServer(
    {
      async userFor(accessToken) {
        const { data, error } = await client.auth.getUser(accessToken);
        return error ? null : (data.user?.id ?? null);
      },
      seed: (userId) => seedQuotes(client, experience, userId),
      approve: (orderId) => mock.approve(orderId),
    },
    options.controlPort
  );
  const controlUrl = `http://127.0.0.1:${(control.address() as AddressInfo).port}`;

  mkdirSync(dirname(options.out), { recursive: true });
  writeFileSync(
    options.out,
    `${JSON.stringify(
      buildEnvironment("Paisaxe booking (local Docker)", {
        baseUrl: options.baseUrl,
        supabaseUrl: LOCAL_API_URL,
        supabaseAnonKey: LOCAL_ANON_KEY,
        voucherCode: code,
        localControlUrl: controlUrl,
      }),
      null,
      2
    )}\n`,
    { mode: 0o600 }
  );

  console.log(
    [
      "Local Postman runner ready (Ctrl-C to stop).",
      `  PayPal mock:    ${mock.baseUrl}   (start next dev with PAYPAL_API_BASE=${mock.baseUrl})`,
      `  Control routes: ${controlUrl}`,
      `  Environment:    ${options.out}`,
      "Then: npx --yes newman@6 run docs/hackathon/postman/paisaxe-booking.postman_collection.json -e <environment>",
    ].join("\n")
  );

  const stop = () => {
    control.close();
    void mock.close().then(() => process.exit(0));
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
