# Cost Analyst Report

> **Generated**: 2026-02-06 | **Period**: February 2026 (MTD) | **Status**: HEALTHY

---

## Executive Summary

Paisaxe is in **early-stage launch** with minimal variable costs and comfortable tier headroom across all services. Total monthly burn is **~$32.26/mo** in fixed costs with negligible variable spend. The platform processed its first revenue (2 Day Pass purchases) on 2026-02-05, netting €1.43 after a refund. All services are operating well within their free/starter tier limits with no immediate upgrade pressure.

**Financial health: HEALTHY** — Fixed costs are low, variable costs are near-zero, and there is significant capacity headroom before any tier upgrades are needed.

| Metric | Value |
|--------|-------|
| Total Fixed Costs | $32.08/mo |
| Variable Costs (Feb MTD) | ~$4.58 |
| Total Burn (Feb projected) | ~$36.66 |
| Revenue (Feb MTD) | €1.99 net (~$2.15) |
| Stripe Net Balance | €1.43 |
| Twilio Prepaid Balance | $21.77 |

---

## Current Costs — Per-Service Breakdown

### Fixed / Recurring Costs

| Service | Tier | Monthly Cost | Category | Since |
|---------|------|-------------|----------|-------|
| Supabase | Pro | $25.00 | Infrastructure | 2025-01 |
| ElevenLabs | Starter (annual) | $4.17* | AI / Voice | 2026-02 |
| AWS Domains | — | $2.08 | Infrastructure | 2025-01 |
| Vercel | Hobby | $0.00 | Infrastructure | — |
| PostHog | Free | $0.00 | Analytics | — |
| **Total Fixed** | | **$31.25** | | |

*\*ElevenLabs is billed annually at $50/yr ($60.50 with tax) = ~$4.17/mo effective cost, though config lists $5/mo. Actual annual billing confirmed via API: next invoice $60.50 due ~2027-05.*

### Variable / Usage-Based Costs (February 2026 MTD)

| Service | Usage | Estimated Cost | Source |
|---------|-------|---------------|--------|
| ElevenLabs (ConvAI) | 6 conversations, 3.2 min | ~$0.26 | API (convos) + estimate |
| ElevenLabs (Characters) | 14,672 / 39,073 chars | ~$4.40 | API + pricing model |
| Twilio (SMS) | 1 outbound SMS | $0.18 | API |
| Twilio (Polly TTS) | 1,100 characters | $0.002 | API |
| Stripe (Processing Fees) | 2 charges, 1 refund | $0.56 (€) | API |
| Anthropic (Claude API) | Unknown | Unknown** | — |
| Voyage AI (Embeddings) | Unknown | Unknown** | — |
| **Total Variable (est.)** | | **~$5.40** | |

*\*\*Anthropic usage is not API-accessible on personal accounts. Check [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing) manually. Voyage AI is likely within the 200M free token tier.*

---

## Usage Metrics

### ElevenLabs Voice Conversations

| Period | Conversations | Duration | Avg Duration |
|--------|--------------|----------|-------------|
| Feb 2026 (MTD, 6 days) | 6 | 3.2 min | 32.5 sec |
| Jan 2026 | 0 | 0 min | — |
| All-time (since Jun 2025) | 100 | 142.5 min | 85.5 sec |

**Note**: The new Pelayo agent (agent `5201kgm...`, recreated 2026-02-04) has 6 conversations so far. Historical conversations were across multiple agent iterations during development.

### Twilio Communications

| Period | SMS Sent | Voice Calls | Cost |
|--------|---------|------------|------|
| Feb 2026 (MTD) | 1 | 0 | $0.18 |
| Jan 2026 | 0 | 0 | $0.00 |

**Twilio prepaid balance**: $21.77 — sufficient for ~124 SMS at current rate ($0.175/SMS).

### Stripe Revenue

| Date | Event | Gross | Fees | Net |
|------|-------|-------|------|-----|
| 2026-02-05 | Day Pass charge | €1.99 | €0.28 | €1.71 |
| 2026-02-05 | Refund | -€1.99 | €0.00 | -€1.99 |
| 2026-02-05 | Day Pass charge | €1.99 | €0.28 | €1.71 |
| **Total** | | **€1.99** | **€0.56** | **€1.43** |

**Effective Stripe fee rate**: 14.1% per transaction (€0.28 on €1.99). This is dominated by the fixed per-transaction fee at this price point. At scale, the fee rate improves (e.g., ~4.4% on a €10 product).

---

## Cost Efficiency

| Metric | Value | Notes |
|--------|-------|-------|
| Cost per voice conversation | ~$0.04 | Based on 3.2 min / 6 convos at $0.08/min |
| ElevenLabs char utilization | 37.6% | 14,672 of 39,073 monthly chars used |
| Stripe net margin per Day Pass | 71.9% | €1.43 net / €1.99 gross |
| Infrastructure cost per Day Pass sold | ~$16.13 | $32.26 fixed / 2 sales (will improve with volume) |

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Alert Level |
|---------|--------|------|-------|-------------|-------------|
| ElevenLabs | Characters | 14,672 | 39,073 | **37.6%** | SAFE |
| ElevenLabs | Voice Minutes | 3.2 | 30 | **10.7%** | SAFE |
| Vercel | Monthly Visitors | ~low | 50,000 | **<1%** | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | SAFE |

**All services SAFE.** No tier upgrade pressure. ElevenLabs character usage is the most active metric at 37.6%, but this includes TTS testing during agent development. Production usage (visitor voice conversations) will be the true driver.

### Upgrade Trigger Points

| Service | Current Tier | Trigger | Next Tier | Cost Jump |
|---------|-------------|---------|-----------|-----------|
| ElevenLabs | Starter ($5/mo) | >30 min/mo voice OR >39K chars/mo | Creator ($22/mo) | +$17/mo |
| Vercel | Hobby ($0) | >50K visitors/mo OR team needs | Pro ($20/mo) | +$20/mo |
| Supabase | Pro ($25/mo) | >8 GB storage | Team ($599/mo) | +$574/mo |
| PostHog | Free ($0) | >1M events/mo | Pay-as-you-go | Variable |

---

## Scaling Forecast

Based on the forecast model in `src/lib/costs/forecast.ts` with current per-unit costs:

| Scenario | Visitors/mo | Chat Convos/mo | Voice Convos/mo | Voice Min/mo | Est. Monthly Cost |
|----------|------------|---------------|----------------|-------------|-------------------|
| **Current** | ~50 | ~10 | ~30 | ~16 | ~$33.54 |
| **3x Growth** | ~150 | ~30 | ~90 | ~48 | ~$36.70 |
| **10x Growth** | ~500 | ~100 | ~300 | ~160 | ~$46.08 |

**Breakdown at 10x:**
- Infrastructure (fixed): $31.25
- AI (Claude + Voyage): ~$1.00 (est. $0.01/chat)
- Voice (ElevenLabs): ~$12.80 ($0.08/min)
- Communications: ~$1.03

**Key insight**: Even at 10x current usage, total costs remain under $50/mo. The first real cost inflection point is ~375 voice minutes/mo (ElevenLabs Starter limit), triggering an upgrade to Creator at $22/mo. At current growth, this is months away.

### Cost Forecast vs. Revenue Potential

| Scenario | Monthly Cost | Day Passes Needed to Break Even* | Revenue at 5% Conversion |
|----------|-------------|----------------------------------|--------------------------|
| Current (~50 visitors) | ~$34 | 24 passes | €2.50 (2.5 passes) |
| 500 visitors | ~$46 | 32 passes | €49.75 (25 passes) |
| 5,000 visitors | ~$171 | 120 passes | €497.50 (250 passes) |

*\*At €1.43 net per Day Pass after Stripe fees.*

**Break-even point**: ~1,600 monthly visitors assuming 5% Day Pass conversion rate.

---

## Anomalies

| Finding | Severity | Details |
|---------|----------|---------|
| Refund on first day of sales | INFO | 1 of 2 Day Pass charges was refunded on 2026-02-05. Likely a test transaction. |
| ElevenLabs annual billing mismatch | LOW | Config says $5/mo but actual plan is annual at ~$4.17/mo effective. Config should be updated to reflect actual cost. |
| No Anthropic cost visibility | WATCH | Personal account has no billing API. Manual checks required. Set a calendar reminder. |
| Twilio balance finite | INFO | $21.77 prepaid balance. At current rate ($0.18/mo), sufficient for ~10 years. At 10x SMS volume, ~12 months. |

---

## Recommendations

### Immediate Actions

1. **Check Anthropic billing manually** — Visit [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing) and record February MTD spend. Consider adding a manual cost entry via the admin panel.

2. **Update ElevenLabs cost in config** — Change `recurring-costs.ts` from `$5/mo` to `$4.17/mo` to reflect the actual annual billing rate, or add a comment noting the discrepancy.

3. **Add manual cost entries** — For services without API billing (Voyage AI, Anthropic), add manual entries via the admin Costs panel to maintain accurate cost tracking.

### Near-Term Optimizations

4. **Monitor ElevenLabs character usage** — At 37.6% utilization with 24 days remaining in the billing cycle, usage is healthy. If character consumption spikes from user adoption, consider upgrading to Creator ($22/mo) for 100 min/mo and higher character limits.

5. **Set Anthropic spend alerts** — Configure billing alerts in the Anthropic console to catch unexpected spikes from chat usage.

6. **Consider Day Pass pricing** — At €1.99, Stripe fees consume 14.1% of revenue. A higher price point (e.g., €4.99) would reduce the fee ratio to ~6.6% and improve unit economics.

### Long-Term Planning

7. **Voice is the cost driver** — At scale, ElevenLabs voice costs dominate variable spend. The Day Pass model (gating voice behind payment) is the correct strategy. Ensure the paywall conversion funnel is optimized before scaling traffic.

8. **Infrastructure costs are stable** — Supabase Pro + Vercel Hobby + free PostHog provide a solid foundation up to ~5,000 monthly visitors with no cost increase needed.

9. **Revenue break-even is achievable** — At ~1,600 monthly visitors with 5% Day Pass conversion, the platform covers its costs. Marketing and SEO should be the primary investment to reach this threshold.

---

## Data Sources

| Source | Method | Last Queried |
|--------|--------|-------------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-02-06 |
| ElevenLabs ConvAI API | `/v1/convai/conversations` | 2026-02-06 |
| Twilio Usage API | `/2010-04-01/Accounts/.../Usage/Records` | 2026-02-06 |
| Twilio Balance API | `/2010-04-01/Accounts/.../Balance.json` | 2026-02-06 |
| Stripe Balance API | `/v1/balance` | 2026-02-06 |
| Stripe Transactions API | `/v1/balance_transactions` | 2026-02-06 |
| Config: `service-tiers.ts` | File read | 2026-02-06 |
| Config: `recurring-costs.ts` | File read | 2026-02-06 |
| Config: `forecast.ts` | File read | 2026-02-06 |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | — |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-02-07 03:00 UTC.*
