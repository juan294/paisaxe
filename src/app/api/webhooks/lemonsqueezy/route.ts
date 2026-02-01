import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import {
  verifyWebhookSignature,
  parseOrderWebhook,
  getPurchaseTypeFromVariant,
  calculateExpiryDate,
} from "@/lib/lemonsqueezy";

/**
 * POST /api/webhooks/lemonsqueezy
 *
 * Handles Lemon Squeezy webhook events:
 * - order_created: Creates voice purchase record
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();

    // Get signature from header
    const signature = request.headers.get("x-signature");

    if (!signature) {
      console.warn("[lemonsqueezy-webhook] Missing signature header");
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 401 }
      );
    }

    // Verify signature
    const isValid = await verifyWebhookSignature(rawBody, signature);

    if (!isValid) {
      console.warn("[lemonsqueezy-webhook] Invalid signature");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Parse payload
    const body = JSON.parse(rawBody);
    const webhook = parseOrderWebhook(body);

    if (!webhook) {
      console.error("[lemonsqueezy-webhook] Invalid webhook payload");
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400 }
      );
    }

    const eventName = webhook.meta.event_name;

    // Only handle order_created events
    if (eventName !== "order_created") {
      console.log(`[lemonsqueezy-webhook] Ignoring event: ${eventName}`);
      return NextResponse.json({ success: true, ignored: true });
    }

    // Extract order data
    const orderId = webhook.data.id;
    const userId = webhook.meta.custom_data?.user_id;
    const variantId = webhook.data.attributes.first_order_item.variant_id;
    const orderStatus = webhook.data.attributes.status;

    // Validate user_id
    if (!userId) {
      console.error("[lemonsqueezy-webhook] Missing user_id in custom_data");
      return NextResponse.json(
        { error: "Missing user_id" },
        { status: 400 }
      );
    }

    // Only process paid orders
    if (orderStatus !== "paid") {
      console.log(
        `[lemonsqueezy-webhook] Ignoring unpaid order ${orderId}: status=${orderStatus}`
      );
      return NextResponse.json({ success: true, ignored: true });
    }

    // Determine purchase type from variant
    const purchaseType = getPurchaseTypeFromVariant(variantId);

    if (!purchaseType) {
      console.error(
        `[lemonsqueezy-webhook] Unknown variant: ${variantId}`
      );
      return NextResponse.json(
        { error: "Unknown product variant" },
        { status: 400 }
      );
    }

    // Calculate expiry
    const expiresAt = calculateExpiryDate(purchaseType);

    // Insert purchase record
    const supabase = createAdminClient();

    const { error: insertError } = await supabase
      .from("voice_purchases")
      .insert({
        user_id: userId,
        purchase_type: purchaseType,
        lemon_squeezy_order_id: orderId,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      // Handle duplicate order (idempotency)
      if (insertError.code === "23505") {
        console.log(
          `[lemonsqueezy-webhook] Duplicate order ${orderId}, ignoring`
        );
        return NextResponse.json({ success: true, duplicate: true });
      }

      console.error(
        "[lemonsqueezy-webhook] Failed to insert purchase:",
        insertError
      );
      return NextResponse.json(
        { error: "Database error" },
        { status: 500 }
      );
    }

    console.log(
      `[lemonsqueezy-webhook] Created ${purchaseType} for user ${userId}, expires ${expiresAt.toISOString()}`
    );

    return NextResponse.json({
      success: true,
      purchaseType,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("[lemonsqueezy-webhook] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
