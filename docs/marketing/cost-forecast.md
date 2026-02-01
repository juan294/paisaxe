# Paisaxe Cost Forecast

**Created**: 2026-01-31
**Updated**: 2026-02-01
**Purpose**: Estimate monthly operational costs across three traffic scenarios

> **Current Status**: ElevenLabs upgraded to Starter tier ($5/mo) on 2026-02-01 for commercial license compliance.

---

## Current Service Stack

| Service | Purpose | Current Tier |
|---------|---------|--------------|
| **Supabase** | Database (PostgreSQL + pgvector), Auth, Storage, Realtime | Pro ($25/mo) |
| **Vercel** | Hosting, Edge Functions, CDN | Pro ($20/mo) |
| **Claude API (Anthropic)** | Chat responses | Pay-as-you-go |
| **Voyage AI** | Embeddings + Reranking | Pay-as-you-go |
| **ElevenLabs** | Voice agents | Starter ($5/mo) |
| **PostHog** | Analytics | Free/Pay-as-you-go |

---

## Pricing Details by Service

### Supabase (Pro Tier)
- **Base**: $25/month
- **Includes**: 8 GB database storage, 100K MAUs, 100 GB file storage
- **Overages**:
  - Storage: $0.125/GB after 8 GB
  - Compute: Starts at Micro (1 vCPU, 1 GB RAM); upgrades available
  - Realtime: Free up to 200 concurrent connections, 2M messages/month
  - Edge Functions: 500K invocations/month included

### Vercel (Pro Tier)
- **Base**: $20/month per team member
- **Includes**: Unlimited bandwidth, 100 GB-hours serverless, 1TB edge bandwidth
- **Overages**: $0.15/GB bandwidth, $0.18/GB-hour serverless

### Claude API (Anthropic)
Using Claude 4.5 Sonnet (balanced cost/performance):
- **Input**: $3.00 per million tokens
- **Output**: $15.00 per million tokens
- **Prompt Caching**: 90% savings on repeated context (10% of base cost for cache reads)

### Voyage AI
- **Free Tier**: 200M tokens for embeddings, 200M tokens for reranking
- **After Free Tier**:
  - Embeddings (voyage-3): ~$0.12 per million tokens
  - Reranking (rerank-2.5): ~$0.15 per million tokens

### ElevenLabs (Conversational AI)
- **Free**: ~15 minutes/month (non-commercial use only)
- **Starter ($5/mo)**: 30,000 credits (~30-45 min agents), 3 concurrent, commercial license ✓
- **Creator ($22/mo)**: 100,000 credits (~100-150 min), 5 concurrent, $0.10/min overage
- **Pro ($99/mo)**: 500,000 credits (~500 min), 10 concurrent, $0.08/min overage
- **Scale ($330/mo)**: 2M credits (~2,000 min), 15 concurrent
- **Burst pricing**: Available to handle 3x concurrency at 2x per-minute cost
- **Note**: LLM costs currently absorbed by ElevenLabs (may change)

### PostHog (Analytics)
- **Free Tier**: 1M events/month, 5K session recordings, 1M feature flag requests
- **After Free Tier**:
  - Events: $0.00005/event (~$50 per million)
  - Session replay: $0.005/recording

---

## Traffic Scenarios

### Assumptions

**Per Chat Conversation** (average):
- User input: ~100 tokens
- Retrieved context: ~2,000 tokens (3 chunks × ~700 tokens)
- Claude response: ~400 tokens
- **Total per chat**: ~2,500 tokens (input+output weighted)

**Per Voice Conversation** (average):
- Duration: 2-3 minutes
- Uses ElevenLabs Conversational AI minutes

**Per Page Visit** (average):
- 1 PostHog pageview event
- 0.5 feature flag checks (cached locally)

---

## Scenario 1: Low Traffic (Soft Launch)

**Profile**: Early adopters, friends & family, initial organic discovery

| Metric | Monthly Volume |
|--------|----------------|
| Unique visitors | 500 |
| Total pageviews | 2,000 |
| Chat conversations | 100 |
| Voice conversations | 20 |

### Cost Breakdown

| Service | Calculation | Monthly Cost |
|---------|-------------|--------------|
| Supabase Pro | Base plan | $25.00 |
| Vercel Pro | Base plan (1 member) | $20.00 |
| Claude API | 100 chats × 2.5K tokens = 250K tokens ≈ $1 | $1.00 |
| Voyage AI | Within free tier (200M tokens) | $0.00 |
| ElevenLabs | 20 × 3 min = 60 min (Starter ~45 min included, may need upgrade) | $5.00 |
| PostHog | 2K events (within 1M free) | $0.00 |
| **TOTAL** | | **$51.00/mo** |

### Recommended Budget Limits
- ElevenLabs: Start with Starter ($5/mo), upgrade to Creator ($22/mo) if exceeding ~40 min
- Voyage AI: No limit needed (free tier sufficient)
- Claude API: Set alert at $10/mo

> **Note**: If voice agent usage consistently exceeds 40 minutes/month, upgrade to Creator tier.

---

## Scenario 2: Medium Traffic (Growing Traction)

**Profile**: Featured in a blog, social media mentions, steady organic growth

| Metric | Monthly Volume |
|--------|----------------|
| Unique visitors | 5,000 |
| Total pageviews | 20,000 |
| Chat conversations | 1,500 |
| Voice conversations | 300 |

### Cost Breakdown

| Service | Calculation | Monthly Cost |
|---------|-------------|--------------|
| Supabase Pro | Base plan (storage still under 8GB) | $25.00 |
| Vercel Pro | Base plan (bandwidth under limits) | $20.00 |
| Claude API | 1,500 × 2.5K = 3.75M tokens | $15.00 |
| Voyage AI | Still within free tier | $0.00 |
| ElevenLabs | 300 × 3 min = 900 min (Pro ~500 min + overage ~$32) | $131.00 |
| PostHog | 20K events (within 1M free) | $0.00 |
| **TOTAL** | | **$191.00/mo** |

### Recommended Budget Limits
- ElevenLabs: Pro tier ($99/mo) with overage cap at $150/mo total
- Claude API: Set alert at $50/mo, hard cap at $100/mo
- Voyage AI: No limit needed yet

---

## Scenario 3: High Traffic (Viral Success)

**Profile**: Press coverage, viral social post, tourism season peak

| Metric | Monthly Volume |
|--------|----------------|
| Unique visitors | 50,000 |
| Total pageviews | 200,000 |
| Chat conversations | 15,000 |
| Voice conversations | 3,000 |

### Cost Breakdown

| Service | Calculation | Monthly Cost |
|---------|-------------|--------------|
| Supabase Pro | Base + potential compute upgrade | $35.00 |
| Vercel Pro | Base + potential bandwidth overage | $30.00 |
| Claude API | 15K × 2.5K = 37.5M tokens | $150.00 |
| Voyage AI | Reranking may exceed free tier (~$5) | $5.00 |
| ElevenLabs | 3K × 3 min = 9,000 min (Scale ~2,000 min + 7,000 min overage @ $0.08) | $890.00 |
| PostHog | 200K events (within 1M free) | $0.00 |
| **TOTAL** | | **$1,110.00/mo** |

### Recommended Budget Limits
- ElevenLabs: Scale tier ($330/mo) + overage buffer = $1,000 cap; consider Enterprise
- Claude API: Hard cap at $200/mo
- Voyage AI: Alert at $20/mo
- Supabase: Enable spend cap, alert at $50/mo

---

## Budget Limit Recommendations

### Service-by-Service Limits

| Service | How to Set Limit | Recommended Limit |
|---------|------------------|-------------------|
| **ElevenLabs** | Dashboard → Billing → Usage Limits | $25/mo (start on Starter), $150/mo (Pro), $500/mo (Scale) |
| **Voyage AI** | Dashboard → Settings → Spending Limits | $50/mo |
| **Claude API (Anthropic)** | Console → Usage Limits → Set monthly limit | $100/mo (start), $250/mo (max) |
| **Supabase** | Dashboard → Billing → Enable Spend Cap | Default ON (Pro tier) |
| **Vercel** | Dashboard → Settings → Spend Management | $50/mo overage limit |
| **PostHog** | Automatic (pauses at free tier limit) | None needed initially |

### Setting Limits in Each Platform

**Anthropic (Claude API)**:
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Navigate to Settings → Usage Limits
3. Set "Monthly spend limit" to your desired cap
4. Enable email alerts at 50%, 75%, 90% thresholds

**ElevenLabs**:
1. Go to [elevenlabs.io](https://elevenlabs.io) → Billing
2. Navigate to Usage Limits
3. Set maximum monthly spend
4. Consider tiered alerts

**Voyage AI**:
1. Go to [voyageai.com](https://dash.voyageai.com) dashboard
2. Navigate to Settings → Billing
3. Set spending limit / alerts

---

## Cost Optimization Strategies

### Claude API
1. **Enable prompt caching** for system prompts and repeated context (90% savings)
2. **Use Claude Haiku** for simple queries, Sonnet for complex ones
3. **Batch API** for non-real-time processing (50% discount)
4. **Reduce context window**: Only send most relevant chunks (3 instead of 5)

### ElevenLabs
1. **Limit voice agent availability** to peak hours or specific stories
2. **Use feature flag** to gate voice access (already implemented)
3. **Monitor conversation length** - encourage concise interactions
4. **Consider text fallback** when approaching limits

**Upgrade triggers**:
- Starter → Creator: Using >30 min/month OR seeing concurrent errors (3 concurrent limit)
- Creator → Pro: Using >100 min/month OR need 10+ concurrent connections
- Pro → Scale: Using >500 min/month OR sustained high traffic

### Voyage AI
1. **Cache embeddings** for frequently accessed content (already done in DB)
2. **Batch embedding requests** (already implemented)
3. **Reduce rerank candidates** from 10 to 5 if needed

### General
1. **Cache aggressively** at CDN and browser level
2. **Lazy-load expensive features** (voice, chat)
3. **Progressive disclosure** - don't show chat until needed
4. **Rate limiting** already in place for abuse prevention

---

## Monitoring Dashboard Checklist

Set up alerts for:

- [ ] Claude API approaching 75% of monthly limit
- [ ] ElevenLabs minutes at 80% of included quota
- [ ] Supabase database approaching 6 GB (75% of 8 GB)
- [ ] Vercel bandwidth approaching limits
- [ ] PostHog events approaching 750K (75% of 1M)
- [ ] Unexpected traffic spikes (Upptime + Vercel analytics)

---

## Summary Table

| Scenario | Monthly Visitors | Monthly Cost | Key Driver |
|----------|------------------|--------------|------------|
| **Low** (Soft Launch) | 500 | ~$51 | Base infrastructure |
| **Medium** (Growing) | 5,000 | ~$191 | Voice agents |
| **High** (Viral) | 50,000 | ~$1,110 | Voice agents (overage) |

**The voice agent (ElevenLabs) is the most expensive variable cost.** Consider gating it behind authentication or limiting availability if costs need to be controlled.

---

## Sources

- [Supabase Pricing](https://supabase.com/pricing)
- [Anthropic Claude API Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Voyage AI Pricing](https://docs.voyageai.com/docs/pricing)
- [ElevenLabs Pricing](https://elevenlabs.io/pricing)
- [PostHog Pricing](https://posthog.com/pricing)
- [Vercel Pricing](https://vercel.com/pricing)
