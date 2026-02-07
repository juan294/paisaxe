# Social Marketing Implementation

> Technical documentation for the Paisaxe social media marketing automation system.
> Last updated: January 31, 2026

## Overview

The marketing automation system enables AI-assisted content creation and posting to social media platforms (X, Instagram, Pinterest). Due to API cost considerations, the system supports both:

1. **Manual Workflow** (current) - AI generates drafts, user posts manually
2. **Automated Workflow** (future) - System posts automatically via API

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Admin Panel                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   Accounts   │  │    Drafts    │  │   Agent Chat         │   │
│  │   Manager    │  │    Panel     │  │   (Xander/Iris/Penny)│   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API Layer                                │
│  /api/admin/marketing/accounts    - Manage platform connections  │
│  /api/admin/marketing/posts       - CRUD for drafts/posts        │
│  /api/admin/marketing/dashboard   - Dashboard summary data       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Service Layer                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ Posting Service  │  │ Platform Clients │  │  Encryption   │  │
│  │ (posting-service)│  │ (X, IG, Pinterest)│  │  (AES-256)   │  │
│  └──────────────────┘  └──────────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Database                                  │
│  marketing_accounts  - Platform credentials (encrypted)          │
│  marketing_posts     - Drafts, scheduled, posted content         │
│  marketing_schedule  - Posting schedules                         │
│  marketing_agent_logs - Agent activity audit trail               │
└─────────────────────────────────────────────────────────────────┘
```

## Implemented Components

### 1. Credential Encryption (`src/lib/encryption.ts`)

All OAuth credentials are encrypted before storing in the database using AES-256-GCM:

- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key**: 32-byte key stored in `CREDENTIALS_ENCRYPTION_KEY` environment variable
- **Format**: Base64 encoded (IV + AuthTag + Ciphertext)

```typescript
// Encrypt credentials before storing
import { encryptJson } from "@/lib/encryption";
const encrypted = encryptJson(credentials);

// Decrypt when needed for API calls
import { getDecryptedCredentials } from "@/lib/credentials";
const credentials = getDecryptedCredentials(accountRow);
```

**Security guarantees:**
- Even with database access, credentials cannot be read without the encryption key
- Encryption key only exists in environment variables (Vercel, local .env)
- Tamper detection via GCM authentication tag

### 2. Credential Helpers (`src/lib/credentials.ts`)

Type-safe utilities for handling encrypted credentials:

- `isEncryptedCredentials()` - Type guard for encrypted format
- `isPlainCredentials()` - Type guard for legacy plain format
- `getDecryptedCredentials()` - Decrypt credentials from account row
- `hasValidCredentials()` - Check if credentials exist (without decrypting)

### 3. X (Twitter) Client (`src/lib/platforms/x-client.ts`)

Full implementation of X API v2 client using `twitter-api-v2` package:

```typescript
import { XClient } from "@/lib/platforms";

const client = new XClient(credentials);

// Verify credentials
const user = await client.verifyCredentials();

// Post a tweet
const result = await client.postTweet("Hello from Paisaxe!");

// Post a thread
const results = await client.postThread([
  "Thread part 1...",
  "Thread part 2...",
]);

// Delete a tweet
await client.deleteTweet(tweetId);

// Get engagement metrics
const engagement = await client.getEngagement(tweetId);
```

**Note:** Free tier supports posting (1,500/month). Read operations (engagement, user info) require Basic tier ($200/month).

### 4. Platform Abstraction (`src/lib/platforms/types.ts`)

Common interfaces for all platform clients:

```typescript
interface PlatformClient {
  platform: MarketingPlatform;
  verifyCredentials(): Promise<PlatformUserInfo>;
  post(content: string, options?: PostOptions): Promise<PostResult>;
  delete(postId: string): Promise<DeleteResult>;
  getEngagement(postId: string): Promise<PostEngagement | null>;
}
```

Platform content limits:

| Platform | Max Length | Max Media | Max Hashtags | Threads | Links |
|----------|------------|-----------|--------------|---------|-------|
| X        | 280        | 4         | 5            | Yes     | Yes   |
| Instagram| 2,200      | 10        | 30           | No      | No*   |
| Pinterest| 500        | 1         | 20           | No      | Yes   |

*Instagram only allows links in bio or for accounts with 10k+ followers

### 5. Posting Service (`src/lib/posting-service.ts`)

High-level service for draft management and posting workflow:

```typescript
import { createDraft, getDrafts, markAsPosted, postNow } from "@/lib/posting-service";

// Create a draft
const result = await createDraft({
  platform: "x",
  content: "Beautiful morning in Asturias!",
  hashtags: ["#Asturias", "#Spain"],
});

// Get all drafts
const drafts = await getDrafts("x"); // or getDrafts() for all platforms

// Mark as manually posted
await markAsPosted({
  postId: "...",
  postUrl: "https://x.com/elpaisaxe/status/123",
});

// Automated posting (requires paid API)
const postResult = await postNow(postId);
```

### 6. Posts API (`src/app/api/admin/marketing/posts/route.ts`)

REST endpoints for draft management:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/admin/marketing/posts?status=draft` | List drafts |
| POST   | `/api/admin/marketing/posts` | Create draft |
| PATCH  | `/api/admin/marketing/posts?id=X&action=mark-posted` | Mark as posted |
| PATCH  | `/api/admin/marketing/posts?id=X` | Update draft |
| DELETE | `/api/admin/marketing/posts?id=X` | Delete draft |

### 7. Admin Dashboard (`src/components/admin/marketing-dashboard.tsx`)

Marketing section in admin panel includes:

- **Connected Accounts** - Status, pause/resume, configure, disconnect
- **Performance Overview** - Post counts with color-coded stats
- **Upcoming Posts** - Scheduled content queue
- **Recent Posts** - Posted content with external links
- **Posting Schedule** - Configured posting times
- **Marketing Agents** - Chat with Xander (X), Iris (Instagram), Penny (Pinterest)
- **Content Drafts** - View, copy, mark as posted, delete drafts

### 8. Marketing Agents (`src/agents/`)

AI agent personas for content generation:

| Agent | Platform | Specialization |
|-------|----------|----------------|
| Xander | X | Short-form, conversational, hooks, threads |
| Iris | Instagram | Visual storytelling, captions, reels |
| Penny | Pinterest | SEO-optimized, evergreen, keywords |

Agent configurations in `src/agents/index.ts`, personas in `src/agents/personas/`.

## Current Workflow (Manual Posting)

Since X API posting requires a paid tier ($100/month), the current workflow is:

1. **Chat with agent** (e.g., Xander) to draft content
2. **Create draft** via admin panel or directly in the drafts section
3. **Copy content** using the copy button
4. **Paste into X** website/app and post manually
5. **Click "Posted"** in admin panel to track it

This provides all the AI content generation benefits without API costs.

## Connected Accounts

### X (@elpaisaxe)
- **Status**: Connected, credentials encrypted
- **Posting**: Available on free tier (1,500 posts/month)
- **Read access**: Requires Basic tier ($200/month) for engagement metrics

### Pinterest
- **Status**: Connected, credentials encrypted (Trial access)
- **Posting**: Requires Standard access (needs demo video submission)
- **Limitation**: Trial access only allows sandbox testing

### Instagram
- **Status**: Not connected
- **Blocker**: Requires Facebook Page linked to Business account
- **Pending**: Create Facebook Page, convert to Business, complete Graph API setup

## Environment Variables

```bash
# Required for credential encryption
CREDENTIALS_ENCRYPTION_KEY=<base64-encoded-32-byte-key>

# Generate with:
openssl rand -base64 32
```

This key is configured in:
- `.env.local` (local development)
- Vercel environment variables (production + preview)

## Database Schema

See migration `supabase/migrations/021_marketing_automation.sql`:

- `marketing_accounts` - Platform connections with encrypted credentials
- `marketing_posts` - Content with status (draft/scheduled/posting/posted/failed)
- `marketing_schedule` - Cron-like posting schedules
- `marketing_content_bank` - Pre-generated content pool
- `marketing_agent_logs` - Audit trail for agent actions

## Test Script

Verify X credentials:

```bash
# Verify credentials (read-only, always works)
npx tsx scripts/test-x-credentials.ts --verify

# Test posting (requires paid tier)
npx tsx scripts/test-x-credentials.ts

# Delete a test tweet
npx tsx scripts/test-x-credentials.ts --delete <tweet_id>
```

---

## Remaining Future Work

### High Priority

1. **Pinterest Client Implementation**
   - Create `src/lib/platforms/pinterest-client.ts`
   - Implement Pin creation, board management
   - Handle image upload requirements
   - Blocked by: Need Standard access (requires demo video for X)

2. **Instagram Client Implementation**
   - Create `src/lib/platforms/instagram-client.ts`
   - Implement Instagram Graph API integration
   - Handle media container creation flow
   - Blocked by: Need Facebook Page + Business account conversion

3. **Agent → Draft Integration**
   - Allow agents to save drafts directly from chat
   - "Save as draft" button in agent chat responses
   - Auto-populate hashtags based on content theme

### Medium Priority

4. **Scheduled Posting Automation**
   - Create cron job (Supabase pg_cron or Vercel Cron)
   - Check `marketing_posts` for scheduled items due
   - Call `postNow()` for each (when API access available)
   - Log results to `marketing_agent_logs`

5. **Token Refresh Logic**
   - Pinterest tokens expire (need refresh flow)
   - Instagram long-lived tokens expire after 60 days
   - Implement automatic refresh before expiration

6. **Engagement Tracking**
   - Periodic job to fetch engagement metrics
   - Update `marketing_posts.engagement` JSONB field
   - Display in dashboard with trends

7. **Content Bank Population**
   - Use agents to pre-generate content
   - Store in `marketing_content_bank` table
   - Draw from bank for scheduled posts

### Low Priority

8. **Media Upload Support**
   - Upload images to platforms before posting
   - Link media IDs to posts
   - Handle platform-specific requirements (sizes, formats)

9. **Analytics Dashboard Enhancement**
   - Engagement graphs over time
   - Best performing content analysis
   - Optimal posting time suggestions

10. **Multi-account Support**
    - Support multiple accounts per platform
    - Account switching in dashboard
    - Separate credentials per account

### Deferred

11. **X API Basic Tier (for read access)**
    - Subscribe to Basic ($200/month) when engagement analytics are needed
    - Free tier already supports posting via `postNow()` (1,500/month)
    - Basic adds read access for engagement metrics and user lookups

12. **Privacy Policy & Terms Pages**
    - Create `https://paisaxe.es/privacy`
    - Create `https://paisaxe.es/terms`
    - Required by Pinterest Standard access
    - Required by X app configuration

---

## File Reference

| File | Purpose |
|------|---------|
| `src/lib/encryption.ts` | AES-256-GCM encryption utilities |
| `src/lib/credentials.ts` | Credential decryption helpers |
| `src/lib/posting-service.ts` | Draft/posting workflow service |
| `src/lib/platforms/index.ts` | Platform client factory |
| `src/lib/platforms/types.ts` | Shared platform interfaces |
| `src/lib/platforms/x-client.ts` | X (Twitter) API client |
| `src/app/api/admin/marketing/accounts/route.ts` | Accounts CRUD API |
| `src/app/api/admin/marketing/posts/route.ts` | Posts/drafts CRUD API |
| `src/app/api/admin/marketing/dashboard/route.ts` | Dashboard summary API |
| `src/components/admin/marketing-dashboard.tsx` | Admin UI component |
| `src/agents/index.ts` | Agent configurations |
| `src/types/marketing.ts` | TypeScript types |
| `scripts/test-x-credentials.ts` | Credential verification script |
| `supabase/migrations/021_marketing_automation.sql` | Database schema |

---

## Related Documentation

- `docs/marketing-automation-setup.md` - Platform setup instructions
- `docs/marketing-seo-implementation.md` - SEO integration details
- `CLAUDE.md` - Brand voice guidelines for content generation
