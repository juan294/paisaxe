# Marketing Automation Setup Guide

This guide explains how to set up the marketing automation system for Paisaxe. The system uses AI agents to automatically create and post content to social media platforms.

## Overview

The marketing automation system consists of:
- **Database tables** for storing accounts, posts, schedules, and logs
- **API routes** for managing accounts and viewing dashboard
- **Admin dashboard** at `/admin` (Marketing tab) for visibility
- **AI agents** (to be scheduled) that generate and post content

## Platform Setup

### Prerequisites

Before connecting any platform, you need:
1. Social media accounts created for Paisaxe on each platform
2. Developer accounts/apps registered on each platform
3. API credentials (tokens, keys, etc.)

---

## X (Twitter) Setup

### 1. Create Developer Account

1. Go to [developer.twitter.com](https://developer.twitter.com)
2. Sign in with your X/Twitter account
3. Apply for developer access (if not already approved)
4. Create a new Project and App

### 2. App Settings

1. In your App settings, set:
   - **App permissions**: Read and Write
   - **Type of App**: Web App, Automated App or Bot
   - **Callback URL**: `https://paisaxe.es/api/auth/callback/x`

2. Note down:
   - API Key
   - API Key Secret
   - Access Token
   - Access Token Secret

### 3. API Tier

- **Free tier**: Read access only (v2.me verified) — **posting returns `CreditsDepleted` (402)**. We have zero write credits on the free tier despite "Read and Write" app permissions being set correctly. This is a billing issue, not a permissions issue.
- **Basic tier ($200/month)**: 50,000 posts + 15,000 reads/month — required for automated posting
- **Pro tier ($5,000/month)**: 300,000 posts + 1,000,000 reads/month

> ⚠️ **Current status (as of April 2026):** Posting to X (@elpaisaxe) from the API is not available on the free tier. Attempts return HTTP 402 with `CreditsDepleted`. A pay-per-use model exists but is in closed beta. Until Basic tier is purchased ($200/month) or pay-per-use opens, **Xander drafts content that must be copy-pasted manually** into X. Do not attempt to automate posting — it will fail.

**App permissions**: Correctly set to "Read and Write" in the X Developer Portal. Regenerate tokens after any permission change.

### 4. Save Credentials

Use the API to save credentials:
```bash
curl -X POST https://paisaxe.es/api/admin/marketing/accounts \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-admin-session-cookie>" \
  -d '{
    "platform": "x",
    "accountName": "Paisaxe",
    "accountHandle": "@paisaxe",
    "credentials": {
      "apiKey": "your-api-key",
      "apiSecret": "your-api-secret",
      "accessToken": "your-access-token",
      "refreshToken": "your-access-token-secret"
    }
  }'
```

---

## Instagram Setup

Instagram requires a Facebook Business account and uses the Instagram Graph API.

### 1. Create Business Account

1. Convert your Instagram account to a Professional/Business account
2. Link it to a Facebook Page

### 2. Facebook Developer Setup

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create a new App (Business type)
3. Add the **Instagram Graph API** product
4. Add the **Instagram Basic Display API** if needed

### 3. Required Permissions

Request these permissions:
- `instagram_basic`
- `instagram_content_publish`
- `instagram_manage_insights`
- `pages_show_list`
- `pages_read_engagement`

### 4. Get Long-Lived Token

1. Generate a short-lived token in Graph API Explorer
2. Exchange it for a long-lived token (60 days):
```bash
curl -X GET "https://graph.facebook.com/v19.0/oauth/access_token?\
grant_type=fb_exchange_token&\
client_id=YOUR_APP_ID&\
client_secret=YOUR_APP_SECRET&\
fb_exchange_token=SHORT_LIVED_TOKEN"
```

### 5. Get Instagram Business Account ID

```bash
curl -X GET "https://graph.facebook.com/v19.0/me/accounts?access_token=YOUR_TOKEN"
# Find the page, then:
curl -X GET "https://graph.facebook.com/v19.0/PAGE_ID?fields=instagram_business_account&access_token=YOUR_TOKEN"
```

### 6. Save Credentials

```bash
curl -X POST https://paisaxe.es/api/admin/marketing/accounts \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-admin-session-cookie>" \
  -d '{
    "platform": "instagram",
    "accountName": "Paisaxe",
    "accountHandle": "@paisaxe",
    "credentials": {
      "accessToken": "your-long-lived-token",
      "clientId": "your-app-id",
      "clientSecret": "your-app-secret"
    }
  }'
```

### API Limits

- 25 posts per 24 hours per Instagram account
- Rate limits apply to API calls

---

## Pinterest Setup

### 1. Create Business Account

1. Go to [business.pinterest.com](https://business.pinterest.com)
2. Create or convert to a Business account

### 2. Create Pinterest App

1. Go to [developers.pinterest.com](https://developers.pinterest.com)
2. Create a new App
3. Set Redirect URI: `https://paisaxe.es/api/auth/callback/pinterest`

### 3. Request Access

Pinterest API requires app review for most features:
- `boards:read`
- `boards:write`
- `pins:read`
- `pins:write`

### 4. OAuth Flow

Generate access token via OAuth:
```bash
# 1. Redirect user to:
https://api.pinterest.com/oauth/?client_id=YOUR_APP_ID&redirect_uri=YOUR_REDIRECT_URI&response_type=code&scope=boards:read,boards:write,pins:read,pins:write

# 2. Exchange code for token:
curl -X POST https://api.pinterest.com/v5/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=AUTH_CODE&redirect_uri=YOUR_REDIRECT_URI" \
  -u "YOUR_APP_ID:YOUR_APP_SECRET"
```

### 5. Save Credentials

```bash
curl -X POST https://paisaxe.es/api/admin/marketing/accounts \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-admin-session-cookie>" \
  -d '{
    "platform": "pinterest",
    "accountName": "Paisaxe",
    "credentials": {
      "accessToken": "your-access-token",
      "refreshToken": "your-refresh-token",
      "clientId": "your-app-id",
      "clientSecret": "your-app-secret"
    }
  }'
```

---

## Database Migration

Run the marketing automation migration:

```bash
# Using Supabase CLI
supabase db push

# Or apply directly in Supabase SQL Editor
# Copy contents of: supabase/migrations/021_marketing_automation.sql
```

This creates:
- `marketing_accounts` - Platform credentials
- `marketing_posts` - Post queue and history
- `marketing_schedule` - Posting schedules
- `marketing_content_bank` - Pre-generated content
- `marketing_agent_logs` - Agent activity logs

---

## Posting Schedule

Default schedules created by the migration:

| Platform | Schedule | Content Type |
|----------|----------|--------------|
| X | Daily 2 PM UTC | Photo caption |
| X | Monday 10 AM UTC | Thread |
| X | Thursday 10 AM UTC | Thread |
| Instagram | Monday 5 PM UTC | Reel |
| Instagram | Wednesday 5 PM UTC | Photo |
| Pinterest | Mon/Wed/Fri 3 PM UTC | Pin |

Modify schedules via the API:
```bash
# Add new schedule
curl -X POST https://paisaxe.es/api/admin/marketing/schedule \
  -H "Content-Type: application/json" \
  -H "Cookie: <session>" \
  -d '{"platform": "x", "dayOfWeek": 2, "timeUtc": "14:00", "contentType": "photo_caption"}'

# Update schedule
curl -X PUT "https://paisaxe.es/api/admin/marketing/schedule?id=SCHEDULE_ID" \
  -H "Content-Type: application/json" \
  -H "Cookie: <session>" \
  -d '{"isActive": false}'
```

---

## Content Guidelines

The AI agents follow the Paisaxe voice guidelines from CLAUDE.md:

### Voice
- First person ("I discovered this...")
- Warm and curious, never salesy
- Show don't tell - let images do the heavy lifting
- Knowledgeable guide but never stuffy

### Topics to Focus On
- Stunning visuals that inspire
- Secrets and lesser-known places
- The human element and local stories
- Practical tips (how to get there, best times)

### Avoid
- Tourism clichés ("hidden gem", "off the beaten path", "bucket list")
- Corporate or formal language
- Salesy or promotional tone
- Information overload

### Hashtags

| Platform | Always Include | Location Tags |
|----------|---------------|---------------|
| X | #Asturias, #Spain | #Oviedo, #Gijón, #PicosDeEuropa |
| Instagram | #Asturias, #NorthernSpain, #ParaisoNatural, #VisitAsturias | + regional tags |
| Pinterest | #Asturias, #SpainTravel, #TravelSpain, #NorthernSpain | + topic tags |

---

## Admin Dashboard

Access the marketing dashboard at `/admin` and click the "Marketing" tab to see:

- **Connected Accounts**: Status of each platform connection
- **Performance Overview**: Post counts and stats
- **Upcoming Posts**: Scheduled content
- **Recent Posts**: Recently published content with links
- **Posting Schedule**: Configured posting times

---

## Troubleshooting

### Token Expiration

- **X**: Access tokens don't expire, but can be revoked
- **Instagram**: Long-lived tokens expire after 60 days (auto-refresh needed)
- **Pinterest**: Tokens expire, use refresh token to renew

### Common Issues

1. **401 Unauthorized**: Token expired or revoked. Re-authenticate.
2. **403 Forbidden**: Missing permissions. Check app scopes.
3. **429 Rate Limited**: Too many requests. Reduce posting frequency.
4. **Media upload failed**: Check file format and size limits.

### Platform Limits

| Platform | Max Post Length | Max Images | Max Videos |
|----------|----------------|------------|------------|
| X | 280 chars | 4 | 1 |
| Instagram | 2,200 chars | 10 (carousel) | 1 (Reel) |
| Pinterest | 500 chars | 1 | 1 |

---

## Security Notes

1. **Credentials are encrypted** in the database
2. **Never expose tokens** in API responses (use Public types)
3. **Use service role** for agent operations
4. **Admin access required** to manage accounts
5. **Audit logs** track all agent activity

---

## Next Steps

After platform setup:

1. Run the database migration
2. Connect at least one platform (start with X - simplest API)
3. Verify connection in admin dashboard
4. Content bank will be populated by AI agents
5. Scheduled posts will start appearing

For agent implementation details, see the `scripts/marketing-agents/` directory (to be created).
