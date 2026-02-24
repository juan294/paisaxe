import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { validateAdminAuth } from "@/lib/admin-auth";

interface HealthCheck {
  status: "healthy" | "degraded";
  checks: {
    envVars: "ok" | "fail";
    priceActive: "ok" | "fail";
    webhookSecret: "ok" | "fail";
  };
  missing?: string[];
  price?: {
    id: string;
    active: boolean;
    amount: number;
    currency: string;
  };
  error?: string;
}

/**
 * GET /api/checkout/health
 *
 * Diagnostic endpoint to verify the Stripe checkout pipeline is properly
 * configured and operational. Requires admin authentication.
 *
 * Checks:
 * 1. Required environment variables are set
 * 2. Day Pass price ID is active in Stripe
 * 3. Webhook secret is configured
 */
export async function GET(): Promise<NextResponse> {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const priceId = process.env.STRIPE_DAY_PASS_PRICE_ID?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  const result: HealthCheck = {
    status: "healthy",
    checks: {
      envVars: "ok",
      priceActive: "ok",
      webhookSecret: "ok",
    },
  };

  // Check 1: Required env vars
  const missing: string[] = [];
  if (!secretKey) missing.push("STRIPE_SECRET_KEY");
  if (!priceId) missing.push("STRIPE_DAY_PASS_PRICE_ID");

  if (missing.length > 0) {
    result.status = "degraded";
    result.checks.envVars = "fail";
    result.missing = missing;
    return NextResponse.json(result, { status: 503 });
  }

  // Check 2: Webhook secret
  if (!webhookSecret) {
    result.checks.webhookSecret = "fail";
  }

  // Check 3: Price is active in Stripe
  try {
    const stripe = getStripeClient();
    const price = await stripe.prices.retrieve(priceId!);

    result.price = {
      id: price.id,
      active: price.active,
      amount: price.unit_amount ?? 0,
      currency: price.currency,
    };

    if (!price.active) {
      result.status = "degraded";
      result.checks.priceActive = "fail";
    }
  } catch (err) {
    result.status = "degraded";
    result.checks.priceActive = "fail";
    result.error = err instanceof Error ? err.message : "Unknown error";
  }

  const httpStatus = result.status === "healthy" ? 200 : 503;
  return NextResponse.json(result, { status: httpStatus });
}
