/**
 * PayPal configuration with the sandbox-only host guard (PayPal hackathon plan,
 * Phase 4, "Env registration").
 *
 * PAYPAL_API_BASE must be exactly https://api-m.sandbox.paypal.com until a
 * reviewed production decision changes it. Outside production a loopback
 * http base (127.0.0.1 or localhost, any port) is also accepted, for the
 * mock server in src/test/paypal-mock-server.ts.
 */
import "server-only";

import { getEnv } from "@/lib/env";
import { PaypalNotConfigured } from "./types";

const SANDBOX_HOST = "api-m.sandbox.paypal.com";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost"]);

export interface PaypalConfig {
  clientId: string;
  clientSecret: string;
  /** Origin only, no trailing slash. */
  baseUrl: string;
  webhookId: string | null;
}

function allowedBase(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new PaypalNotConfigured("PAYPAL_API_BASE is not a valid URL");
  }
  const bare = !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash;
  const sandbox = url.protocol === "https:" && url.hostname === SANDBOX_HOST && url.port === "";
  const loopback =
    process.env.NODE_ENV !== "production" && url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
  if (!bare || !(sandbox || loopback)) {
    throw new PaypalNotConfigured(`PAYPAL_API_BASE must be https://${SANDBOX_HOST}`);
  }
  return url.origin;
}

/** Server-only: carries the client secret. Throws PaypalNotConfigured when incomplete or not allowed. */
export function getPaypalConfig(): PaypalConfig {
  const clientId = getEnv("PAYPAL_CLIENT_ID");
  const clientSecret = getEnv("PAYPAL_CLIENT_SECRET");
  const base = getEnv("PAYPAL_API_BASE");
  if (!clientId || !clientSecret || !base) {
    throw new PaypalNotConfigured("PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET and PAYPAL_API_BASE must be set");
  }
  return {
    clientId,
    clientSecret,
    baseUrl: allowedBase(base),
    webhookId: getEnv("PAYPAL_WEBHOOK_ID") ?? null,
  };
}
