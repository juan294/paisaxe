import { execFileSync } from "node:child_process";
import { test, expect } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BOOKING_PAYPAL_CONTROL_PORT,
  E2E_BOOKING_LINK_SECRET,
  FIXTURE_MERCHANT,
  NOTHING_LEFT,
  cleanupBookingRows,
  ensureBookingSurfaceOn,
  issueVoucher,
  localServiceClient,
  randomSlotDate,
  requireLocalBookingEnv,
  runTag,
  type CreatedRows,
  type LocalBookingEnv,
} from "./fixtures/booking-local";

/**
 * Release-required probe — LOCAL DOCKER ONLY, mutating (PayPal hackathon plan,
 * Phase 6): the whole booking journey in the browser, as a judge takes it.
 *
 * voucher (/acceso, anonymous guest) → chat (scripted replay model, real
 * tools) → accept on the quote card → "Pagar con PayPal" → the PayPal
 * stand-in approves (the sandbox approval page is answered by this test and
 * never requested) → return page captures → confirmed (UI and datastore) →
 * operator view (link from scripts/booking/create-operator-link.ts) → cancel
 * from the chat's cancellation card → refunded (UI and datastore). The cleanup
 * oracle deletes every row it created and verifies they are gone.
 *
 * Needs the release-required-local project (playwright.config.ts): next dev
 * with PAYPAL_API_BASE at the stand-in, BOOKING_AGENT_REPLAY and bypassCSP.
 */

test.use({ locale: "es-ES" });

const tag = runTag("roundtrip");
const created: CreatedRows = { userIds: [], voucherLabels: [tag], operatorLabels: [tag] };
let env: LocalBookingEnv;
let admin: SupabaseClient;
let voucherCode: string;

test.beforeAll(async () => {
  // Fail closed, never skip: refuses anything but the local stack.
  env = requireLocalBookingEnv();
  admin = localServiceClient(env);
  await ensureBookingSurfaceOn(admin);
  voucherCode = await issueVoucher(admin, tag, 1);
});

test.afterAll(async () => {
  if (!admin) return;
  // The guest is known only once redeemed; find it through this run's voucher.
  const { data } = await admin.from("voucher_redemptions").select("user_id, vouchers!inner(label)").eq("vouchers.label", tag);
  for (const row of data ?? []) created.userIds.push(row.user_id as string);

  const remaining = await cleanupBookingRows(admin, created);
  expect(remaining, "cleanup oracle: every row this probe created is gone").toEqual(NOTHING_LEFT);
});

async function bookingRow(userId: string) {
  const { data, error } = await admin
    .from("bookings")
    .select("id, reference, status, payments(status, order_id, capture_id, refund_id)")
    .eq("user_id", userId);
  if (error) throw new Error(`Datastore read-back failed: ${error.message}`);
  expect(data, "exactly one booking for the guest").toHaveLength(1);
  return data![0] as { id: string; reference: string; status: string; payments: Record<string, string | null>[] };
}

function issueOperatorLink(): string {
  const output = execFileSync(
    "npx",
    ["tsx", "--conditions=react-server", "scripts/booking/create-operator-link.ts", "--merchant", FIXTURE_MERCHANT, "--label", tag],
    {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        TMPDIR: process.env.TMPDIR,
        BOOKING_LINK_SECRET: E2E_BOOKING_LINK_SECRET,
        SUPABASE_LOCAL_API_URL: env.supabaseUrl,
        SUPABASE_LOCAL_SERVICE_ROLE_KEY: env.serviceKey,
      },
    }
  );
  const link = output.match(/\/operator\/\S+/)?.[0];
  if (!link) throw new Error("create-operator-link printed no link");
  return link;
}

test("@release-required @local-docker booking-roundtrip: voucher, chat, accept, PayPal approval, return, confirmed, operator view, cancel, refunded", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(300_000);
  const composer = page.getByRole("textbox", { name: "Escribe tu pregunta..." });
  const send = async (text: string) => {
    await composer.fill(text);
    await composer.press("Enter");
  };

  // The approval page PayPal would show the buyer. Answered here, never fetched:
  // the stand-in's control route approves the order, then PayPal's redirect to
  // the order's return URL (`<booking link>/return?token=<order id>`).
  let bookingPath = "";
  await page.route("https://www.sandbox.paypal.com/**", async (route) => {
    const orderId = new URL(route.request().url()).searchParams.get("token") ?? "";
    const approved = await fetch(`http://127.0.0.1:${BOOKING_PAYPAL_CONTROL_PORT}/paypal/orders/${orderId}/approve`, { method: "POST" });
    expect(approved.status, "the stand-in approved the order").toBe(200);
    await route.fulfill({ status: 302, headers: { location: `${baseURL}${bookingPath}/return?token=${orderId}&PayerID=E2EBUYER` } });
  });

  // 1. Voucher: the judge's entry, with an anonymous guest session.
  expect((await page.goto("/acceso"))?.status()).toBe(200);
  await page.locator("#voucher-code").fill(voucherCode);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/immersive\?booking=1/, { timeout: 60_000 });

  const { data: redemption } = await admin.from("voucher_redemptions").select("user_id, vouchers!inner(label)").eq("vouchers.label", tag).single();
  const guestId = redemption!.user_id as string;

  // 2. Chat: the replayed model searches and quotes through the real tools.
  const slotDate = randomSlotDate();
  await expect(composer).toBeVisible({ timeout: 60_000 });
  await send(`Somos 2 personas el ${slotDate} a las 10:00`);

  // 3. Accept on the quote card; the post-accept turn prepares the PayPal order.
  await page.getByRole("button", { name: "Aceptar oferta" }).click({ timeout: 90_000 });
  const viewBooking = page.getByRole("link", { name: "Ver la reserva" });
  await expect(viewBooking).toBeVisible({ timeout: 30_000 });
  bookingPath = (await viewBooking.getAttribute("href")) ?? "";
  expect(bookingPath).toMatch(/^\/booking\/[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);
  expect((await bookingRow(guestId)).status).toBe("pending_payment");

  // 4. Pay: the stand-in approves, PayPal returns to the booking's return page, which captures.
  await page.getByRole("link", { name: "Pagar con PayPal" }).click({ timeout: 60_000 });
  await page.waitForURL(/\/return\?token=/, { timeout: 60_000 });
  await expect(page.getByText("¡Pago recibido! Tu reserva está confirmada.")).toBeVisible({ timeout: 60_000 });

  const confirmed = await bookingRow(guestId);
  expect(confirmed.status, "datastore: booking confirmed").toBe("confirmed");
  expect(confirmed.payments).toEqual([expect.objectContaining({ status: "captured", capture_id: expect.any(String) })]);

  // 5. Operator view: the merchant sees the confirmed booking.
  await page.goto(issueOperatorLink());
  const operatorRow = page.getByRole("row").filter({ hasText: confirmed.reference });
  await expect(operatorRow).toBeVisible({ timeout: 60_000 });
  await expect(operatorRow).toContainText("Confirmada");

  // 6. Cancel from the chat: preview through the replayed tool, confirm on the card.
  await page.goto("/immersive?booking=1");
  await expect(composer).toBeVisible({ timeout: 60_000 });
  await send("Quiero cancelar mi reserva");
  await page.getByRole("button", { name: /^Cancelar y recibir/ }).click({ timeout: 60_000 });
  await expect(page.getByText("Reserva cancelada.")).toBeVisible({ timeout: 30_000 });

  // 7. Refunded: datastore and the booking page.
  const refunded = await bookingRow(guestId);
  expect(refunded.status, "datastore: booking refunded").toBe("refunded");
  expect(refunded.payments).toEqual([expect.objectContaining({ status: "refunded", refund_id: expect.any(String) })]);
  await page.goto(bookingPath);
  await expect(page.getByText("Hemos devuelto la señal en PayPal.")).toBeVisible({ timeout: 60_000 });
});
