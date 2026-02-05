import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function GET() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_DAY_PASS_PRICE_ID;

  if (!secretKey) {
    return NextResponse.json({ error: "No STRIPE_SECRET_KEY" }, { status: 500 });
  }

  if (!priceId) {
    return NextResponse.json({ error: "No STRIPE_DAY_PASS_PRICE_ID" }, { status: 500 });
  }

  try {
    const stripe = new Stripe(secretKey, {
      apiVersion: "2026-01-28.clover",
      timeout: 30000,
    });

    // Simple test: retrieve the price
    const price = await stripe.prices.retrieve(priceId);

    return NextResponse.json({
      success: true,
      priceId: price.id,
      unitAmount: price.unit_amount,
      currency: price.currency,
      keyPrefix: secretKey.substring(0, 12) + "...",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const errorType = error instanceof Stripe.errors.StripeError ? error.type : "unknown";
    return NextResponse.json({
      error: message,
      type: errorType,
      keyPrefix: secretKey.substring(0, 12) + "...",
    }, { status: 500 });
  }
}
