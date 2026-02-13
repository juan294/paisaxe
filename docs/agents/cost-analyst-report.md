# Cost Analyst Report

> **Generated**: 2026-02-12 | **Period**: February 2026 (MTD, 12 days) | **Status**: STABLE

---

## Executive Summary

**The ElevenLabs voice minute limit risk continues to recede.** At 38.6 min used in 12 days (3.22 min/day), projected February usage is **~90 min — well below the 100 min Creator limit** (down from ~98 min yesterday). Zero voice activity on Feb 11 and Feb 12 so far has pulled the daily rate down further. The voice limit is no longer a near-term concern at current usage patterns.

**First Stripe payout completed** — €6.56 was paid out on Feb 12, representing the first 4 net sales (Feb 5–8). Pending balance is now €1.71 (1 unpaid charge from Feb 10). This is a milestone: the platform is generating real, liquidated revenue.

**Revenue growth has stalled** — No new Day Pass sales since Feb 10 (2 consecutive zero-sale days). The run rate has dropped slightly to ~11.7 sales/mo (~€20/mo net). Still early days with thin volume, so daily fluctuations are expected.

Fixed costs remain stable at $259.41/mo (including Claude Code Max $200/mo development tool). Total projected monthly spend is ~$263.47. Revenue coverage of operational costs (excluding development) is 39.7%.

**Financial health: STABLE** — Voice limits comfortable. Revenue flowing (first payout received). Costs predictable. No anomalies.

| Metric | Value | vs. Feb 11 |
|--------|-------|-----------|
| Total Fixed Costs (all) | $259.41/mo | -- |
| Total Fixed Costs (operational) | $59.41/mo | -- |
| Variable Costs (Feb MTD) | ~$1.49 | -- |
| Total Burn (Feb projected, operational) | ~$63.47 | -- |
| Revenue (Feb MTD) | €9.98 gross / €8.27 net (~$8.93) | -- |
| First Payout | **€6.56 (Feb 12)** | NEW |
| Stripe Pending Balance | €1.71 | -€6.56 (payout) |
| Twilio Prepaid Balance | $18.20 | -- |
| ElevenLabs Voice Min | 38.6 / 100 | -- (no new activity) |
| ElevenLabs Voice Min Projection | **~90 min (90%)** | -8 min (-8.2%) |

---

## Current Costs — Per-Service Breakdown

### Fixed / Recurring Costs

| Service | Tier | Monthly Cost | Category | Since | Change vs Feb 11 |
|---------|------|-------------|----------|-------|-------------------|
| Claude Code Max | Max (20x Pro) | $200.00 | Development | 2026-01-27 | -- |
| Supabase | Pro | $25.00 | Infrastructure | 2025-01 | -- |
| ElevenLabs | Creator (annual) | $18.33* | AI / Voice | 2026-02 | -- |
| Anthropic Claude | Prepaid credits | $10.00** | AI | 2025-12 | -- |
| GitHub Pro | Pro | $4.00 | Infrastructure | 2026-02-06 | -- |
| AWS Domains | -- | $2.08 | Infrastructure | 2025-01 | -- |
| Vercel | Hobby | $0.00 | Infrastructure | -- | -- |
| PostHog | Free | $0.00 | Analytics | -- | -- |
| **Total Fixed (all)** | | **$259.41** | | | **--** |
| **Total Fixed (operational)** | | **$59.41** | | | **--** |

*\*ElevenLabs Creator billed annually at $220/yr ($266.20 with tax). Config file (`recurring-costs.ts`) lists $18.33/mo (pre-tax annual rate). Actual effective rate with tax: ~$22.18/mo. Using config value for consistency with dashboard.*

*\*\*Anthropic $10/mo is an estimate from config. No billing API available on personal accounts. Check [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing) manually.*

**Note**: Claude Code Max ($200/mo) is the primary development tool cost. It is categorized separately as "Development" since it supports building the platform, not serving visitors. Operational cost analysis below excludes it to focus on the cost of running the live service.

### Variable / Usage-Based Costs (February 2026 MTD)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (SMS outbound) | 6 messages, 17 segments | $1.49 | API |
| Twilio (Amazon Polly TTS) | 3 units | $0.002 | API |
| Stripe (Processing Fees) | 6 charges, 1 refund | €1.68 (~$1.81) | API |
| Anthropic (Claude API) | Unknown | Unknown | -- |
| Voyage AI (Embeddings) | Unknown | Unknown | -- |
| **Total Variable (known)** | | **~$1.49** | |

*ElevenLabs usage costs covered by Creator plan subscription (110K chars/mo included). No overage charges.*
*Stripe fees are deducted from revenue, not an out-of-pocket cost.*

---

## Usage Metrics

### ElevenLabs Voice Conversations (All Agents)

| Period | Conversations | Successful | Failed | Duration | Avg Duration |
|--------|--------------|-----------|--------|----------|-------------|
| Feb 2026 (MTD, 12 days) | 43 | 35 | 8 | 38.6 min | 66.1 sec (successful) |
| Feb 2026 (prev report, 11 days) | 43 | 35 | 8 | 38.6 min | 66.1 sec |
| **Change** | **--** | **--** | **--** | **--** | **--** |

**By agent type:**

| Agent | Conversations | Duration | Avg Duration | Notes |
|-------|--------------|----------|-------------|-------|
| Pelayo (Visitor Guide) | 26 | 25.8 min | 73.6 sec | User-facing, via React SDK |
| Pelayo (Booking) | 17 | 12.8 min | 54.9 sec | Outbound calls via Twilio |

**Key observations:**
- **Zero new conversations since Feb 10.** No voice activity on Feb 11 or Feb 12 (so far). This is the third consecutive quiet day.
- Usage remains concentrated in a few active days (Feb 6, 8) with many zero-activity days (5 of 12 days have zero conversations).
- **Character usage**: 5,482 of 110,553 monthly characters (**5.0%** utilization). Not a constraint.

### Daily Voice Usage Breakdown

| Date | Conversations | Duration (min) | VG | BK | Notes |
|------|--------------|---------------|----|----|-------|
| Feb 4 | 6 | 3.3 | 0 | 6 | Booking agent testing only |
| Feb 5 | 0 | 0 | 0 | 0 | -- |
| Feb 6 | 14 | 12.6 | 7 | 7 | Peak day (tied with Feb 8) |
| Feb 7 | 7 | 9.6 | 5 | 2 | Moderate activity |
| Feb 8 | 14 | 12.8 | 12 | 2 | Peak conversations, highest minutes |
| Feb 9 | 0 | 0 | 0 | 0 | -- |
| Feb 10 | 2 | 0.4 | 2 | 0 | Minimal activity |
| Feb 11 | 0 | 0 | 0 | 0 | -- |
| Feb 12 | 0 | 0 | 0 | 0 | No activity yet (early) |
| **Total** | **43** | **38.6** | **26** | **17** | |

Usage pattern: **Active Feb 4-8 (testing + real use), then near-silent since Feb 9.** Five of twelve days have zero conversations.

### Twilio Communications

| Metric | Current (12 days) | Previous (11 days) | Change |
|--------|-------------------|-------------------|--------|
| SMS Sent | 6 | 6 | -- |
| Segments | 17 | 17 | -- |
| Cost | $1.49 | $1.49 | -- |
| Balance | $18.20 | $18.20 | -- |

**No new SMS activity since Feb 10 report.** Balance remains $18.20 — sufficient for ~73 SMS at ~$0.25/SMS effective rate. At current pace (~17 SMS/mo), balance lasts ~4.3 months.

### Stripe Revenue

| Date | Event | Gross | Fees | Net |
|------|-------|-------|------|-----|
| 2026-02-05 16:22 | Day Pass charge | €1.99 | €0.28 | €1.71 |
| 2026-02-05 16:33 | Refund | -€1.99 | €0.00 | -€1.99 |
| 2026-02-05 16:51 | Day Pass charge | €1.99 | €0.28 | €1.71 |
| 2026-02-07 11:02 | Day Pass charge | €1.99 | €0.28 | €1.71 |
| 2026-02-07 11:22 | Day Pass charge | €1.99 | €0.28 | €1.71 |
| 2026-02-08 12:29 | Day Pass charge | €1.99 | €0.28 | €1.71 |
| 2026-02-10 05:37 | Day Pass charge | €1.99 | €0.28 | €1.71 |
| **2026-02-12 00:55** | **Payout** | **-€6.56** | **€0.00** | **-€6.56** |
| **Totals** | | **€13.93 gross** | **€1.68 fees** | **€8.27 net** |

**Summary**: 6 charges, 1 refund = **5 net Day Pass sales**. Unchanged from Feb 11.

**First payout**: €6.56 paid out on Feb 12 (covers first 4 net sales from Feb 5-8). This is a milestone — first real money transferred from the platform.

**Revenue run rate**: 5 sales in 12 days = 11.7 sales/month = ~€20.01/mo net (~$21.61).
*Down slightly from 12.7 sales/mo (Feb 11) as the 2-day sales drought continues.*

**Stripe balances**:
- Available: €0.00 (payout cleared the available balance)
- Pending: €1.71 (Feb 10 charge not yet settled)

---

## Cost Efficiency

| Metric | Current (Feb 12) | Previous (Feb 11) | Change | Trend |
|--------|-----------------|-------------------|--------|-------|
| Cost per voice conversation | ~$0.51 | ~$0.51 | -- | FLAT |
| Cost per voice minute | ~$0.47 | ~$0.47 | -- | FLAT |
| ElevenLabs char utilization | 5.0% | 5.0% | -- | FLAT |
| ElevenLabs voice min utilization | **38.6%** | 38.6% | -- | FLAT |
| ElevenLabs voice min projection | **~90 min (90%)** | ~98 min (98%) | -8 min | DOWN (improving) |
| Stripe net margin per Day Pass | 85.9% | 85.9% | -- | FLAT |
| Infra cost per Day Pass sold | ~$11.88 | ~$11.88 | -- | FLAT |
| Revenue coverage (operational) | **36.4%** | 37.1% | -0.7pp | DOWN (slightly) |

**Cost efficiency notes:**
- Cost per voice conversation: ElevenLabs subscription ($22.18 effective) / 43 conversations = $0.51.
- Revenue coverage: Projected monthly revenue ~$21.61 / ~$59.41 operational costs = 36.4%. Slight dip as the revenue run rate decreased.
- Voice minute projection improvement: 38.6 min / 12 days = 3.22 min/day × 28 days = ~90 min (vs. 3.51 min/day × 28 = 98 min yesterday).
- **First payout milestone**: €6.56 of earned revenue has been liquidated. The payment pipeline is proven end-to-end.

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Projected Month-End | Alert Level |
|---------|--------|------|-------|-------------|---------------------|-------------|
| ElevenLabs | Characters | 5,482 | 110,553 | **5.0%** | ~12,795 (11.6%) | SAFE |
| ElevenLabs | Voice Minutes | 38.6 | 100 | **38.6%** | **~90 (90%)** | **WATCH** |
| Vercel | Monthly Visitors | ~low | 50,000 | **<1%** | <1% | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | <1% | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | <100% | SAFE |

### ElevenLabs Voice Minute Limit — WATCH

**Projected to be at ~90% of Creator tier limit (100 min) by month-end.**

- Used: 38.6 min in 12 days (38.6% of limit)
- Daily rate: 3.22 min/day (down from 3.51 on Feb 11)
- Projected February total: ~90 min (90% of limit)
- **Previous projection**: ~98 min (Feb 11 report)

**Downward trend continues:**
- Feb 10: projected 107 min (WARNING)
- Feb 11: projected 98 min (WATCH)
- Feb 12: projected 90 min (WATCH)

Three consecutive days of zero voice activity have pulled the daily rate down significantly. However, a single active day (like Feb 6 or Feb 8 with ~13 min each) could still push the projection back above 100 min.

**Mitigation unchanged:**
1. Monitor weekly — comfortable for now but bursty usage means this can change quickly
2. Understand ElevenLabs overage policy for Creator tier
3. If breached, evaluate Scale tier upgrade ($99/mo, 500 min/mo)

### Upgrade Trigger Points

| Service | Current Tier | Trigger | Next Tier | Cost Jump |
|---------|-------------|---------|-----------|-----------|
| ElevenLabs | Creator ($22.18/mo eff.) | >100 min/mo (at 90% projected) | Scale ($99/mo) | +$77/mo |
| Vercel | Hobby ($0) | >50K visitors/mo | Pro ($20/mo) | +$20/mo |
| Supabase | Pro ($25/mo) | >8 GB storage | Team ($599/mo) | +$574/mo |
| PostHog | Free ($0) | >1M events/mo | Pay-as-you-go | Variable |

---

## Scaling Forecast

Based on the forecast model in `src/lib/costs/forecast.ts`:

**Per-unit costs (computed from actuals):**
- Cost per voice minute: $0.47 (ElevenLabs $18.33 config / 38.6 min actual)
- Cost per SMS: $0.25 (17 segments / 6 messages)
- Cost per chat: $0.01 (estimated fallback — no Anthropic data)

| Scenario | Visitors/mo | Voice Convos/mo | Voice Min/mo | SMS/mo | Est. Monthly Cost (operational) |
|----------|------------|----------------|-------------|--------|--------------------------------|
| **Current (1x)** | ~100 | ~100 | ~90 | ~17 | ~$63.47 |
| **3x Growth** | ~300 | ~300 | ~270 | ~51 | ~$148* |
| **10x Growth** | ~1,000 | ~1,000 | ~900 | ~170 | ~$286** |

*\*At 3x: Voice minutes (270) exceed Creator limit (100). Requires Scale tier upgrade ($99/mo). Total: $31.08 infra + $10 AI + $99 voice + $12.75 SMS = ~$148, plus Stripe fees.*

*\*\*At 10x: Voice at 900 min/mo. Scale tier (500 min) also exceeded. Requires Enterprise pricing. Estimated $200+ for voice alone.*

### Cost Forecast vs. Revenue Potential

| Scenario | Monthly Cost (op.) | Day Passes Needed to Break Even* | Revenue at 5% Conversion |
|----------|-------------------|----------------------------------|--------------------------|
| Current (~100 visitors) | ~$63 | 39 passes | ~€8.55 (5 passes) |
| 500 visitors | ~$148 | 91 passes | ~€42.75 (25 passes) |
| 5,000 visitors | ~$286 | 175 passes | ~€427.50 (250 passes) |

*\*At €1.64 net per Day Pass after Stripe fees.*

**Break-even point**: ~2,400 monthly visitors assuming 5% Day Pass conversion rate.

---

## Anomalies

| Finding | Severity | Details |
|---------|----------|---------|
| First Stripe payout | **INFO** | €6.56 payout on Feb 12 — payment pipeline proven. No action needed. |
| Config file ElevenLabs cost mismatch | **LOW** | `recurring-costs.ts` lists $18.33/mo (pre-tax). Actual with tax is ~$22.18/mo. Affects dashboard accuracy by ~$3.85/mo. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual checks required. Included as $10/mo estimate. |
| 2-day revenue drought | **LOW** | No new Day Pass sales on Feb 11-12. Normal variance at low volumes. Monitor if it extends to 4+ days. |

**Resolved anomalies:**
- ElevenLabs voice minutes near limit → **Downgraded** from WATCH concern (projected 90 min, comfortably under 100 min limit).
- Revenue stalled (Feb 10) → **Partially resolved** (sale on Feb 10 broke the drought, but another 2-day gap has emerged).

---

## Trend Analysis

### Comparison: Feb 11 → Feb 12

| Metric | Feb 11 (11 days) | Feb 12 (12 days) | Change | Direction |
|--------|-----------------|-----------------|--------|-----------|
| Fixed costs/mo (operational) | $59.41 | $59.41 | -- | FLAT |
| Variable costs (MTD) | ~$1.49 | ~$1.49 | -- | FLAT |
| Voice conversations (MTD) | 43 | 43 | -- | FLAT |
| Voice minutes (MTD) | 38.6 | 38.6 | -- | FLAT |
| Voice min daily rate | 3.51 min/day | 3.22 min/day | -0.29 (-8.3%) | DOWN |
| Voice min projection | ~98 min | ~90 min | -8 min (-8.2%) | DOWN (improving) |
| SMS sent (MTD) | 6 | 6 | -- | FLAT |
| Day Pass net sales | 5 | 5 | -- | FLAT |
| Stripe net revenue (MTD) | €8.27 | €8.27 | -- | FLAT |
| Stripe payout | €0 | **€6.56** | +€6.56 | NEW |
| Revenue run rate | ~$23.50/mo | ~$21.61/mo | -$1.89 (-8.0%) | DOWN (slowing) |
| Revenue coverage (operational) | 37.1% | 36.4% | -0.7pp | DOWN (slightly) |
| Twilio balance | $18.20 | $18.20 | -- | FLAT |

**Key observations:**
1. **Complete quiet day** — Zero voice conversations, zero sales, zero SMS on Feb 11. Feb 12 is also quiet so far. The platform had a lull after the initial Feb 4-10 activity burst.
2. **First payout is a milestone** — Even at small amounts, the end-to-end payment flow (visitor → Day Pass → Stripe charge → bank payout) is now proven.
3. **Voice projection continues improving** — Each quiet day pulls the daily rate lower. Three days ago the projection was 107 min (WARNING), now it's 90 min (comfortable WATCH).
4. **Revenue run rate declining** — With no new sales, the run rate dropped from $23.50/mo to $21.61/mo. This is expected variance at low volumes (5 sales in 12 days). One sale tomorrow would push it back to $22+.

---

## Recommendations

### Immediate Actions

1. **Check Anthropic billing manually** — Visit [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing) and record February MTD spend. The $10/mo estimate may be high or low.

2. **Fix ElevenLabs config mismatch** — Update `recurring-costs.ts` to reflect the actual effective rate with tax ($22.18/mo) or add a note. This affects the admin dashboard's accuracy by ~$3.85/mo.

### Near-Term Optimizations

3. **Analyze visitor-to-sale conversion** — 5 Day Pass sales in 12 days from what appears to be low visitor volume. What's the actual conversion rate? If it's higher than 5%, the product-market fit signal is strong despite low absolute numbers.

4. **Investigate voice usage patterns** — 14 conversations on Feb 8, then zero on Feb 11-12. Is this a testing artifact winding down, or genuine user interest that has paused? Understanding the source (team testing vs. real visitors) is critical for forecasting.

5. **Consider voice conversation length optimization** — Successful conversations average 66.1s. If Pelayo could resolve queries 10% faster, projected usage drops to ~81 min — firmly safe.

### Long-Term Planning

6. **Scale tier decision point deferred** — With projected 90 min vs. 100 min limit, the Creator → Scale ($99/mo) upgrade is not needed for February. Reassess in March as real visitor patterns emerge.

7. **Revenue diversification** — The Day Pass at €1.99 (net €1.71) is thin margin. Weekly pass (€4.99), monthly subscription (€9.99), or commission on bookings would improve unit economics.

8. **Booking agent as revenue driver** — 17 booking conversations show genuine demand. If each successful booking generated a commission (even €0.50), that's additional revenue tied directly to voice agent value.

---

## Data Sources

| Source | Method | Last Queried |
|--------|--------|-------------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-02-12 |
| ElevenLabs Character Stats API | `/v1/usage/character-stats` | 2026-02-12 |
| ElevenLabs ConvAI API | `/v1/convai/conversations` (page_size=100) | 2026-02-12 |
| Twilio Usage API | `/2010-04-01/Accounts/.../Usage/Records/ThisMonth` | 2026-02-12 |
| Twilio Balance API | `/2010-04-01/Accounts/.../Balance.json` | 2026-02-12 |
| Stripe Balance API | `/v1/balance` | 2026-02-12 |
| Stripe Transactions API | `/v1/balance_transactions` | 2026-02-12 |
| Config: `service-tiers.ts` | File read | 2026-02-12 |
| Config: `recurring-costs.ts` | File read | 2026-02-12 |
| Config: `forecast.ts` | File read | 2026-02-12 |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | -- |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-02-13.*
