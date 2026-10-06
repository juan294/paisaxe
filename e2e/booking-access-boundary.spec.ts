import { randomInt } from "node:crypto";
import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BOOKING_PREVIEW_ORIGIN,
  CANONICAL_ORIGIN,
  cleanupBookingRows,
  createSignedInUser,
  csrfHeaders,
  NOTHING_LEFT,
  ensureBookingSurfaceOn,
  issueVoucher,
  localServiceClient,
  randomSlotDate,
  parseSse,
  requireLocalBookingEnv,
  runTag,
  type CreatedRows,
  type LocalBookingEnv,
  type LocalUser,
  type SseEvent,
} from "./fixtures/booking-local";

/**
 * Release-required probe — LOCAL DOCKER ONLY, mutating (PayPal hackathon plan,
 * Phase 6, F10): the booking access boundary with valid fixtures.
 *
 * The owner redeems a voucher and books through the real chat route (the model
 * is the scripted replay, the tools are real) and the quote-accept route. Then:
 *   1. the owner's capability, with no cookies and no session, opens the
 *      booking, and the same capability with a wrong token does not;
 *   2. another redeemed user asking the chat about the owner's booking id gets
 *      the tool's not_found, and no booking card;
 *   3. a signed-in user without a redemption is 404 on the chat and access routes;
 *   4. the same requests against a local server with VERCEL_ENV=preview are 404
 *      (and /acceso), although the flag is on and the fixtures are valid.
 * Each assertion fails when its gate is removed (mutation evidence in the
 * Phase 6 handoff). Every row created here is deleted and the deletion verified.
 */

test.describe.configure({ mode: "serial" });

// Its own rate-limit bucket per run (src/lib/request-utils.ts getClientIp).
const clientIp = `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
const tag = runTag("boundary");
const created: CreatedRows = { userIds: [], voucherLabels: [tag], operatorLabels: [] };

let env: LocalBookingEnv;
let admin: SupabaseClient;
let owner: LocalUser;
let intruder: LocalUser;
let stranger: LocalUser;
let ownerBooking: { bookingId: string; capability: string };

function authed(user: LocalUser, origin: string): Record<string, string> {
  return csrfHeaders(origin, { authorization: `Bearer ${user.accessToken}`, "x-forwarded-for": clientIp });
}

async function chat(api: APIRequestContext, origin: string, user: LocalUser, message: string) {
  const response = await api.post("/api/booking/chat/stream", {
    headers: authed(user, origin),
    data: { message, history: [], locale: "es" },
  });
  return { status: response.status(), events: response.ok() ? parseSse(await response.text()) : [] };
}

function cards(events: SseEvent[], kind: string): Record<string, unknown>[] {
  return events.filter((event) => event.type === "card").map((event) => event.card as Record<string, unknown>).filter((card) => card.kind === kind);
}

test.beforeAll(async ({ request, baseURL }) => {
  // Fail closed, never skip: refuses anything but the local stack.
  env = requireLocalBookingEnv();
  admin = localServiceClient(env);
  await ensureBookingSurfaceOn(admin);
  const code = await issueVoucher(admin, tag, 5);

  // Record each user as soon as it exists, so a later failure still cleans it up.
  owner = await createSignedInUser(env, admin, tag);
  created.userIds.push(owner.userId);
  intruder = await createSignedInUser(env, admin, tag);
  created.userIds.push(intruder.userId);
  stranger = await createSignedInUser(env, admin, tag);
  created.userIds.push(stranger.userId);

  for (const user of [owner, intruder]) {
    const redeemed = await request.post("/api/booking/voucher/redeem", { headers: authed(user, baseURL!), data: { code } });
    expect(redeemed.status(), "voucher redemption").toBe(200);
  }

  // The owner's booking, made the way a visitor makes one: chat, quote card, accept.
  const turn = await chat(request, baseURL!, owner, `Somos 2 personas el ${randomSlotDate()} a las 10:00`);
  expect(turn.status).toBe(200);
  const [quote] = cards(turn.events, "quote");
  expect(quote?.quoteId, "the replayed get_quote must return a quote card").toEqual(expect.any(String));

  const accepted = await request.post(`/api/booking/quotes/${quote.quoteId as string}/accept`, { headers: authed(owner, baseURL!) });
  expect(accepted.status()).toBe(200);
  const card = (await accepted.json()).card as { bookingId: string; link: string };
  ownerBooking = { bookingId: card.bookingId, capability: card.link.replace("/booking/", "") };
});

test.afterAll(async () => {
  if (!admin) return;
  const remaining = await cleanupBookingRows(admin, created);
  expect(remaining, "cleanup oracle: every row this probe created is gone").toEqual(NOTHING_LEFT);
});

test("@release-required @local-docker booking-access-boundary: capability without cookies, foreign booking id, no redemption, Preview", async ({
  baseURL,
}) => {
  // 1. The capability alone opens the booking: a fresh context with no cookies and no session.
  const anonymous = await playwrightRequest.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": clientIp } });
  try {
    const opened = await anonymous.get(`/api/booking/bookings/${ownerBooking.capability}`);
    expect(opened.status(), "a valid capability with no cookies opens its booking").toBe(200);
    expect(await opened.json()).toMatchObject({ status: "pending_payment", reference: expect.any(String) });

    const [id, token] = ownerBooking.capability.split(".");
    const forged = `${id}.${token.startsWith("A") ? "B" : "A"}${token.slice(1)}`;
    expect((await anonymous.get(`/api/booking/bookings/${forged}`)).status(), "a wrong token for the same booking").toBe(404);
  } finally {
    await anonymous.dispose();
  }

  const local = await playwrightRequest.newContext({ baseURL });
  try {
    // 2. Another redeemed user asks the chat tools about the owner's booking id.
    const foreign = await chat(local, baseURL!, intruder, `Estado de la reserva ${ownerBooking.bookingId}`);
    expect(foreign.status).toBe(200);
    expect(foreign.events).toContainEqual({ type: "tool", name: "get_booking_status", status: "error" });
    expect(foreign.events).toContainEqual({ type: "text", content: "Resultado: not_found" });
    expect(cards(foreign.events, "booking"), "no booking card for another user's booking").toEqual([]);

    // 3. Signed in, no redemption: the voucher-gated routes do not exist for this user.
    expect((await chat(local, baseURL!, stranger, "Somos 2 personas el 2026-12-01 a las 10:00")).status, "chat without a redemption").toBe(404);
    expect(
      (await local.get("/api/booking/access", { headers: { authorization: `Bearer ${stranger.accessToken}` } })).status(),
      "access check without a redemption"
    ).toBe(404);
  } finally {
    await local.dispose();
  }

  // 4. The same requests on a Preview (VERCEL_ENV=preview, flag on, valid fixtures).
  const preview = await playwrightRequest.newContext({ baseURL: BOOKING_PREVIEW_ORIGIN });
  try {
    expect((await preview.get("/api/health/live")).status(), "the Preview server is up").toBe(200);
    expect.soft((await preview.get(`/api/booking/bookings/${ownerBooking.capability}`)).status(), "Preview: capability").toBe(404);
    expect.soft(
      (await preview.get("/api/booking/access", { headers: { authorization: `Bearer ${owner.accessToken}` } })).status(),
      "Preview: access check of a redeemed user"
    ).toBe(404);
    expect.soft((await chat(preview, CANONICAL_ORIGIN, owner, `Estado de la reserva ${ownerBooking.bookingId}`)).status, "Preview: chat of a redeemed user").toBe(404);
    expect.soft((await preview.get("/acceso")).status(), "Preview: /acceso").toBe(404);
  } finally {
    await preview.dispose();
  }
});
