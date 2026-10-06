import { randomBytes } from "node:crypto";
import { startControlServer } from "../scripts/booking/postman-local";
import { startPaypalMock } from "../src/test/paypal-mock-server";
import {
  BOOKING_PAYPAL_CONTROL_PORT,
  BOOKING_PAYPAL_MOCK_PORT,
  E2E_PAYPAL_CREDENTIAL,
  isReleaseLocalRun,
} from "./fixtures/booking-env";

/**
 * Global setup for the local booking probes (PayPal hackathon plan, Phase 6):
 * the PayPal stand-in on 127.0.0.1, which the local web server reaches through
 * PAYPAL_API_BASE (playwright.config.ts), and the loopback control route the
 * booking-roundtrip probe calls in place of the sandbox buyer's approval
 * (POST /paypal/orders/:id/approve, from scripts/booking/postman-local.ts).
 *
 * Runs only when the release-required-local project is selected; every other
 * run starts nothing. Never reaches PayPal: nothing here leaves the machine.
 */
export default async function globalSetup(): Promise<(() => Promise<void>) | undefined> {
  if (!isReleaseLocalRun()) return undefined;

  const mock = await startPaypalMock({
    port: BOOKING_PAYPAL_MOCK_PORT,
    clientId: E2E_PAYPAL_CREDENTIAL,
    clientSecret: E2E_PAYPAL_CREDENTIAL,
    // The local database keeps earlier runs' payments and order_id is unique.
    idSalt: randomBytes(4).toString("hex").toUpperCase(),
  });
  const control = await startControlServer(
    {
      // Only the approval route is used; the Postman quote-seeding route stays unavailable.
      userFor: async () => null,
      seed: () => Promise.reject(new Error("not available in the Playwright run")),
      approve: (orderId) => mock.approve(orderId),
    },
    BOOKING_PAYPAL_CONTROL_PORT
  );

  return async () => {
    await new Promise<void>((done) => control.close(() => done()));
    await mock.close();
  };
}
