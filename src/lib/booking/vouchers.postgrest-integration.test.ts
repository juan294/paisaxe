// @vitest-environment node
/**
 * Voucher redemption and metering against the REAL local Supabase stack
 * (migration 118, PayPal hackathon plan Phase 2).
 *
 * Uses a real anonymous sign-in (local config.toml enables it, as production
 * must) so the voice pass is checked through GET /api/voice-access with the
 * guest's own RLS-bound client, exactly as the browser reaches it.
 *
 * Requires `supabase start` (local Docker) and self-skips when the stack is
 * not reachable.
 */
import { NextRequest } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  LOCAL_ANON_KEY,
  LOCAL_API_URL,
  isLocalSupabaseReachable,
  localServiceClient,
  psql,
  sqlList,
  warnLocalSupabaseUnreachable,
} from "@/test/local-supabase";
import { lockRow, releaseRowLock, waitForBackendCount } from "@/test/local-supabase-locks";
import { consume } from "./metering";
import { findActiveRedemption, hashVoucherCode, redeemVoucher } from "./vouchers";

const session = vi.hoisted(() => ({
  user: null as User | null,
  client: null as SupabaseClient | null,
}));

vi.mock("@/lib/supabase-auth", () => ({
  getUserFromRequest: vi.fn(async () => session.user),
  getSupabaseClient: vi.fn(async () => session.client),
}));

const { GET: getVoiceAccess } = await import("@/app/api/voice-access/route");

const dbReachable = await isLocalSupabaseReachable();

if (!dbReachable) {
  warnLocalSupabaseUnreachable("vouchers.postgrest-integration.test.ts");
}

const USER_A = "b0020000-0000-4000-8000-0000000000a1";
const USER_B = "b0020000-0000-4000-8000-0000000000b1";
const USER_NO_PROFILE = "b0020000-0000-4000-8000-0000000000c1";
const SEEDED_USERS = [USER_A, USER_B, USER_NO_PROFILE];
const LABEL_PREFIX = "it-voucher-";
const anonUserIds: string[] = [];


function deleteFixtureRows(): void {
  const users = sqlList([...SEEDED_USERS, ...anonUserIds]);
  psql(
    `DELETE FROM public.voice_purchases WHERE user_id IN (${users});` +
      `DELETE FROM public.voucher_redemptions WHERE voucher_id IN (SELECT id FROM public.vouchers WHERE label LIKE '${LABEL_PREFIX}%');` +
      `DELETE FROM public.vouchers WHERE label LIKE '${LABEL_PREFIX}%';` +
      `DELETE FROM public.user_profiles WHERE user_id IN (${users});` +
      `DELETE FROM auth.users WHERE id IN (${users});`
  );
}

/** Creates a voucher whose code is `code`; returns its id. */
function createVoucher(code: string, options: { max?: number; expires?: string; turns?: number; voice?: boolean } = {}): string {
  return psql(
    `INSERT INTO public.vouchers (code_hash, label, expires_at, max_redemptions, chat_turns_limit, grants_voice_pass) VALUES (` +
      `'${hashVoucherCode(code)}', '${LABEL_PREFIX}${code}', '${options.expires ?? "2026-12-16T23:59:59Z"}', ` +
      `${options.max ?? 50}, ${options.turns ?? 60}, ${options.voice ?? true}) RETURNING id;`
  ).split("\n")[0];
}

const VOUCHER_LOCKER = "it_voucher_locker";

function redemptionCount(voucherId: string): number {
  return Number(psql(`SELECT count(*) FROM public.voucher_redemptions WHERE voucher_id = '${voucherId}';`));
}

describe.skipIf(!dbReachable)("vouchers against live local Supabase", () => {
  beforeAll(() => {
    deleteFixtureRows();
    for (const id of SEEDED_USERS) {
      psql(`INSERT INTO auth.users (id, email) VALUES ('${id}', '${id}@voucher-it.test') ON CONFLICT (id) DO NOTHING;`);
    }
    // A user whose profile row is missing: the voice pass insert (FK to
    // user_profiles) fails, which must roll the redemption back too.
    psql(`DELETE FROM public.user_profiles WHERE user_id = '${USER_NO_PROFILE}';`);
  });

  afterAll(() => {
    deleteFixtureRows();
  });

  it("posture: anon and authenticated cannot execute redeem_voucher", () => {
    expect(
      psql(
        `SELECT has_function_privilege('anon', 'public.redeem_voucher(text, uuid, timestamptz, timestamptz)', 'EXECUTE') ` +
          `OR has_function_privilege('authenticated', 'public.redeem_voucher(text, uuid, timestamptz, timestamptz)', 'EXECUTE');`
      )
    ).toBe("f");
  });

  it("an anonymous guest redeems a voucher and GET /api/voice-access reports a voucher_pass", async () => {
    const code = "ITANONGUEST2026";
    createVoucher(code);

    const anon = createClient(LOCAL_API_URL, LOCAL_ANON_KEY, { auth: { persistSession: false } });
    const { data, error } = await anon.auth.signInAnonymously();
    expect(error).toBeNull();
    const user = data.user as User;
    anonUserIds.push(user.id);
    expect(user.is_anonymous).toBe(true);

    const result = await redeemVoucher(localServiceClient(), user.id, code, new Date());
    expect(result.status).toBe("ok");

    session.user = user;
    session.client = createClient(LOCAL_API_URL, LOCAL_ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${data.session?.access_token}` } },
    });
    const response = await getVoiceAccess(new NextRequest("http://localhost/api/voice-access"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ hasAccess: true, purchaseType: "voucher_pass" });
  });

  it("a returning user is served at the cap while a new user gets exhausted (F13)", async () => {
    const code = "ITCAPONE2026";
    const voucherId = createVoucher(code, { max: 1 });
    const now = new Date();

    const first = await redeemVoucher(localServiceClient(), USER_A, code, now);
    expect(first.status).toBe("ok");
    expect((await redeemVoucher(localServiceClient(), USER_B, code, now)).status).toBe("exhausted");

    const again = await redeemVoucher(localServiceClient(), USER_A, code, now);
    expect(again.status).toBe("ok");
    expect(again.status === "ok" && first.status === "ok" && again.redemptionId).toBe(
      first.status === "ok" && first.redemptionId
    );
    expect(redemptionCount(voucherId)).toBe(1);
  });

  it("two new users racing for the last place, both queued on the voucher lock: exactly one redemption", { timeout: 20_000 }, async () => {
    const code = "ITRACEONE2026";
    const voucherId = createVoucher(code, { max: 1 });
    const now = new Date();

    const locker = await lockRow("vouchers", voucherId, VOUCHER_LOCKER);
    try {
      const both = Promise.all([
        redeemVoucher(localServiceClient(), USER_A, code, now),
        redeemVoucher(localServiceClient(), USER_B, code, now),
      ]);
      // Both callers have looked the voucher up and wait for its row lock.
      await waitForBackendCount(`wait_event_type = 'Lock' AND query LIKE '%redeem_voucher%'`, 2);
      releaseRowLock(locker, VOUCHER_LOCKER);

      const results = await both;
      expect(results.map((r) => r.status).sort()).toEqual(["exhausted", "ok"]);
      expect(redemptionCount(voucherId)).toBe(1);
    } finally {
      releaseRowLock(locker, VOUCHER_LOCKER);
    }
  });

  it("date-advanced: redeems on Dec 1 and Dec 14, and is expired on Dec 17", async () => {
    const code = "ITJUDGING2026";
    createVoucher(code, { expires: "2026-12-16T23:59:59Z" });

    const dec1 = await redeemVoucher(localServiceClient(), USER_B, code, new Date("2026-12-01T10:00:00Z"));
    expect(dec1).toMatchObject({ status: "ok", voicePassUntil: "2026-12-02T10:00:00.000Z" });
    // The Dec 1 pass has lapsed by Dec 14 on the same clock, so it is renewed.
    const dec14 = await redeemVoucher(localServiceClient(), USER_B, code, new Date("2026-12-14T10:00:00Z"));
    expect(dec14).toMatchObject({ status: "ok", voicePassUntil: "2026-12-15T10:00:00.000Z" });
    expect(await redeemVoucher(localServiceClient(), USER_B, code, new Date("2026-12-17T10:00:00Z"))).toEqual({
      status: "expired",
    });

    expect(await findActiveRedemption(localServiceClient(), USER_B, new Date("2026-12-14T10:00:00Z"))).not.toBeNull();
    expect(await findActiveRedemption(localServiceClient(), USER_B, new Date("2026-12-17T10:00:00Z"))).toBeNull();
  });

  it("an unknown or revoked code is invalid", async () => {
    const code = "ITREVOKED2026";
    const voucherId = createVoucher(code);
    expect((await redeemVoucher(localServiceClient(), USER_A, "ITNOSUCHCODE2026", new Date())).status).toBe("invalid");

    expect((await redeemVoucher(localServiceClient(), USER_A, code, new Date())).status).toBe("ok");
    const redeemedAt = new Date();

    psql(`UPDATE public.vouchers SET revoked_at = now() WHERE id = '${voucherId}';`);
    expect((await redeemVoucher(localServiceClient(), USER_A, code, new Date())).status).toBe("invalid");
    // The gate's lookup must not serve a redemption of a revoked voucher either.
    const active = await findActiveRedemption(localServiceClient(), USER_A, redeemedAt);
    expect(active?.voucherId).not.toBe(voucherId);
  });

  it("a failed voice pass grant rolls the redemption back (no counter change)", async () => {
    const code = "ITROLLBACK2026";
    const voucherId = createVoucher(code);

    await expect(redeemVoucher(localServiceClient(), USER_NO_PROFILE, code, new Date())).rejects.toThrow();
    expect(redemptionCount(voucherId)).toBe(0);
  });

  it("a voucher without the voice pass redeems and grants none", async () => {
    const code = "ITNOVOICE2026";
    createVoucher(code, { voice: false });

    const result = await redeemVoucher(localServiceClient(), USER_A, code, new Date());
    expect(result).toMatchObject({ status: "ok", voicePassUntil: null });
  });

  it("metering: concurrent consumes never exceed the limit", async () => {
    const code = "ITMETER2026";
    createVoucher(code, { turns: 5 });
    const redeemed = await redeemVoucher(localServiceClient(), USER_B, code, new Date());
    if (redeemed.status !== "ok") throw new Error("redeem failed");

    const results = await Promise.all(
      Array.from({ length: 10 }, () => consume(localServiceClient(), redeemed.redemptionId, "chat_turns"))
    );

    expect(results.filter((r) => r.allowed)).toHaveLength(5);
    expect(results.filter((r) => r.allowed).map((r) => r.remaining).sort()).toEqual([0, 1, 2, 3, 4]);
    expect(results.filter((r) => !r.allowed).every((r) => r.remaining === 0)).toBe(true);
    expect(
      psql(`SELECT chat_turns_used FROM public.voucher_redemptions WHERE id = '${redeemed.redemptionId}';`)
    ).toBe("5");
  });
});
