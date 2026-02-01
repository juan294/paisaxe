# Lemon Squeezy Setup Guide

Payment processing for Voice Pass (24h voice access) via Lemon Squeezy.

## Overview

Lemon Squeezy has two separate environments:
- **Test Mode**: For development and testing (before account verification)
- **Live Mode**: For production (after account verification)

**CRITICAL**: Test mode and Live mode use **different variant IDs** with **different formats**.

## Variant ID Formats

| Mode | Format | Example |
|------|--------|---------|
| **Test Mode** | UUID | `bf128a3b-c4a4-4f19-a0eb-5ad346492538` |
| **Live Mode** | Numeric | `1267701` |

### How to Get the Correct Variant ID

1. Go to [Lemon Squeezy Dashboard](https://app.lemonsqueezy.com)
2. Make sure you're in the correct mode (Test/Live toggle at bottom left)
3. Go to **Store → Products**
4. Click on your product (Voice Pass · 24h)
5. Click **Share** button
6. Copy the URL from the "Checkout Link" section
7. Extract the variant ID from the URL:
   ```
   https://paisaxe.lemonsqueezy.com/checkout/buy/[VARIANT_ID]
   ```

**DO NOT** use the "Copy variant ID" menu option - it gives a different ID that doesn't work for checkout URLs.

## Environment Variables

### Test Mode (Development)

```bash
# .env.local
NEXT_PUBLIC_LEMONSQUEEZY_STORE_ID=paisaxe
NEXT_PUBLIC_LEMONSQUEEZY_DAY_PASS_VARIANT_ID=bf128a3b-c4a4-4f19-a0eb-5ad346492538
NEXT_PUBLIC_LEMONSQUEEZY_TEST_MODE=true
LEMONSQUEEZY_WEBHOOK_SECRET=<your-test-webhook-secret>
```

### Live Mode (Production)

```bash
# Vercel environment variables
NEXT_PUBLIC_LEMONSQUEEZY_STORE_ID=paisaxe
NEXT_PUBLIC_LEMONSQUEEZY_DAY_PASS_VARIANT_ID=<live-uuid-from-share-button>
# No TEST_MODE variable (or set to false)
LEMONSQUEEZY_WEBHOOK_SECRET=<your-live-webhook-secret>
```

## Test Card Numbers

Use these for testing (Test Mode only):

| Card Number | Description |
|-------------|-------------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 0002` | Declined payment |

- Expiry: Any future date (e.g., `12/35`)
- CVC: Any 3 digits (e.g., `123`)

## Webhook Setup

### Test Mode Webhook
1. In Lemon Squeezy Dashboard (Test Mode), go to **Settings → Webhooks**
2. Create webhook with URL: `https://your-tunnel.ngrok.io/api/webhooks/lemonsqueezy`
3. Select event: `order_created`
4. Copy the signing secret to `LEMONSQUEEZY_WEBHOOK_SECRET`

### Live Mode Webhook
1. Switch to Live Mode in dashboard
2. Go to **Settings → Webhooks**
3. Create webhook with URL: `https://paisaxe.com/api/webhooks/lemonsqueezy`
4. Select event: `order_created`
5. Copy the signing secret to Vercel environment variables

## Checkout Flow

1. User clicks "Get Day Pass" on `/pricing`
2. Code generates checkout URL using variant ID from env
3. User completes payment on Lemon Squeezy hosted checkout
4. Lemon Squeezy sends webhook to `/api/webhooks/lemonsqueezy`
5. Webhook handler creates `voice_purchases` record in Supabase
6. User redirected to `/pricing/success`
7. `useVoiceAccess` hook detects active purchase, enables voice features

## Troubleshooting

### 404 on Checkout Page
- **Cause**: Wrong variant ID format
- **Fix**: Get the UUID from the Share button, not "Copy variant ID"

### Webhook Not Received
- **Cause**: Wrong webhook URL or tunnel not running
- **Fix**: Check ngrok is running, URL matches webhook config

### Payment Succeeds but Voice Not Enabled
- **Cause**: Webhook secret mismatch or database error
- **Fix**: Check webhook secret matches, check Supabase logs

## Going Live Checklist

- [ ] Account verified by Lemon Squeezy
- [ ] Product copied to Live Mode (use "Copy to Live Mode" in product menu)
- [ ] Get new variant ID from Share button in Live Mode
- [ ] Update Vercel env vars with live variant ID
- [ ] Create live webhook in Lemon Squeezy
- [ ] Update Vercel env vars with live webhook secret
- [ ] Remove `NEXT_PUBLIC_LEMONSQUEEZY_TEST_MODE` from production
- [ ] Test a real purchase (can refund after)
