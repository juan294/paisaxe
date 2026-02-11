# Cost Analyst Report

> **Generated**: 2026-02-11 | **Period**: February 2026 (MTD, 11 days) | **Status**: WATCH

---

## Executive Summary

**The ElevenLabs voice minute limit threat has eased slightly.** At 38.6 min used in 11 days (3.51 min/day), projected February usage is **~98 min — just below the 100 min Creator limit** (vs. ~107 min projected yesterday). The risk remains real but has decreased due to zero voice activity on Feb 9, 10, and 11 so far. If usage stays bursty with quiet days, the limit may not be breached this month.

**Revenue has resumed** — 1 new Day Pass sale on Feb 10 (ending the 2-day drought flagged in the previous report). Net revenue is now €8.27 (5 net sales). The run rate has stabilized at ~12.7 sales/mo (~€21.76/mo net), up from the 11.2/mo projected on Feb 10. Stripe pending balance is €8.27 (confirmed via API).

Fixed costs remain stable at $59.41/mo. Total projected monthly spend is ~$63.47. Revenue coverage ratio has improved to 37.1% (from 32.8%).

**Financial health: WATCH** — Voice minutes are the constraint to monitor but no longer in WARNING territory. Revenue recovering. Costs stable.

| Metric | Value | vs. Feb 10 |
|--------|-------|-----------|
| Total Fixed Costs | $59.41/mo | -- |
| Variable Costs (Feb MTD) | ~$1.49 | -- |
| Total Burn (Feb projected) | ~$63.47 | -5.9% (lower voice projection) |
| Revenue (Feb MTD) | €8.27 net (~$8.93) | +€1.71 (+1 sale) |
| Stripe Pending Balance | €8.27 | +€1.71 |
| Twilio Prepaid Balance | $18.20 | -- |
| ElevenLabs Voice Min | 38.6 / 100 | +0.4 min (+1.0%) |

---

## Current Costs — Per-Service Breakdown

### Fixed / Recurring Costs

| Service | Tier | Monthly Cost | Category | Since | Change vs Feb 10 |
|---------|------|-------------|----------|-------|-------------------|
| Supabase | Pro | $25.00 | Infrastructure | 2025-01 | -- |
| ElevenLabs | Creator (annual) | $18.33* | AI / Voice | 2026-02 | -- |
| Anthropic Claude | Prepaid credits | $10.00** | AI | 2025-12 | -- |
| GitHub Pro | Pro | $4.00 | Infrastructure | 2026-02-06 | -- |
| AWS Domains | -- | $2.08 | Infrastructure | 2025-01 | -- |
| Vercel | Hobby | $0.00 | Infrastructure | -- | -- |
| PostHog | Free | $0.00 | Analytics | -- | -- |
| **Total Fixed** | | **$59.41** | | | **--** |

*\*ElevenLabs Creator billed annually at $220/yr ($266.20 with tax). Config file (`recurring-costs.ts`) lists $18.33/mo (pre-tax annual rate). Actual effective rate with tax: ~$22.18/mo. Using config value for consistency with dashboard.*

*\*\*Anthropic $10/mo is an estimate from config. No billing API available on personal accounts. Check [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing) manually.*

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
| Feb 2026 (MTD, 11 days) | 43 | 35 | 8 | 38.6 min | 66.1 sec (successful) |
| Feb 2026 (prev report, 10 days) | 41 | ~33 | ~8 | 38.2 min | 60.3 sec |
| **Change** | **+2 (+4.9%)** | **+2** | **--** | **+0.4 min (+1.0%)** | **+5.8 sec (+9.6%)** |

**By agent type:**

| Agent | Conversations | Duration | Avg Duration | Notes |
|-------|--------------|----------|-------------|-------|
| Pelayo (Visitor Guide) | 26 | 25.8 min | 73.6 sec | User-facing, via React SDK |
| Pelayo (Booking) | 17 | 12.8 min | 54.9 sec | Outbound calls via Twilio |

**Key observations:**
- **Only 2 new conversations since Feb 10** (both Visitor Guide on Feb 10). Zero activity on Feb 9 and Feb 11 so far.
- **Booking agent drives 33% of voice time** but 40% of conversations — shorter interactions for restaurant reservations.
- **5 failed connections** on Feb 8 (Visitor Guide) and **3 failed connections** on Feb 6 (Booking) — all 0-1s duration, likely connection issues.
- **Character usage**: 5,482 of 110,553 monthly characters (**5.0%** utilization). Not a constraint.

### Daily Voice Usage Breakdown

| Date | Conversations | Duration (min) | VG | BK | Notes |
|------|--------------|---------------|----|----|-------|
| Feb 4 | 6 | 3.2 | 0 | 6 | Booking agent testing only |
| Feb 5 | 0 | 0 | 0 | 0 | -- |
| Feb 6 | 14 | 12.6 | 7 | 7 | Peak day (tied with Feb 8) |
| Feb 7 | 7 | 9.6 | 5 | 2 | Moderate activity |
| Feb 8 | 14 | 12.8 | 12 | 2 | Peak conversations, highest minutes |
| Feb 9 | 0 | 0 | 0 | 0 | -- |
| Feb 10 | 2 | 0.4 | 2 | 0 | Minimal activity |
| Feb 11 | 0 | 0 | 0 | 0 | No activity yet |
| **Total** | **43** | **38.6** | **26** | **17** | |

Usage remains **highly bursty** — heavy on Feb 6 and Feb 8, zero on Feb 5/9/11. Four of 11 days have zero conversations.

### Twilio Communications

| Metric | Current (11 days) | Previous (10 days) | Change |
|--------|-------------------|-------------------|--------|
| SMS Sent | 6 | 6 | -- |
| Segments | 17 | 17 | -- |
| Cost | $1.49 | $1.49 | -- |
| Balance | $18.20 | $18.20 | -- |

**No new SMS activity since the Feb 10 report.** Balance remains $18.20 — sufficient for ~73 SMS at ~$0.25/SMS effective rate. At current pace (~17 SMS/mo), balance lasts ~4.3 months.

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
| **Total** | | **€13.93** | **€1.68** | **€8.27** |

**Summary**: 6 charges, 1 refund = **5 net Day Pass sales**. +1 new sale since Feb 10 report.

**Revenue run rate**: 5 sales in 11 days = 12.7 sales/month = ~€21.76/mo net (~$23.50).
*Up from 11.2 sales/mo (Feb 10) — the 2-day drought has ended.*

**Stripe pending balance**: €8.27 (confirmed via API). No payouts yet.

---

## Cost Efficiency

| Metric | Current (Feb 11) | Previous (Feb 10) | Change | Trend |
|--------|-----------------|-------------------|--------|-------|
| Cost per voice conversation | ~$0.51 | ~$0.54 | -5.6% | DOWN (improving) |
| Cost per voice minute | ~$0.47 | ~$0.58 | -19% | DOWN (improving) |
| ElevenLabs char utilization | 5.0% | 4.8% | +0.2pp | FLAT |
| ElevenLabs voice min utilization | **38.6%** | 38.2% | +0.4pp | FLAT |
| Stripe net margin per Day Pass | 85.9% | 85.9% | -- | FLAT |
| Infrastructure cost per Day Pass sold | ~$11.88 | ~$15.82 | -24.9% | DOWN (improving) |
| Revenue coverage ratio | **37.1%** | 32.8% | +4.3pp | UP (improving) |

**Cost efficiency notes:**
- Cost per voice conversation: ElevenLabs subscription ($22.18 effective) / 43 conversations = $0.51. Improving as volume increases.
- Revenue coverage: €8.27 net (~$8.93) / $59.41 fixed costs = 15.0% MTD. Projected monthly: ~$23.50 / ~$63.47 = 37.1%.
- Infrastructure cost per Day Pass: $59.41 fixed / 5 sales = $11.88/sale. At 12.7 sales/mo projected, this drops to $4.68/sale.

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Projected Month-End | Alert Level |
|---------|--------|------|-------|-------------|---------------------|-------------|
| ElevenLabs | Characters | 5,482 | 110,553 | **5.0%** | ~13,949 (12.6%) | SAFE |
| ElevenLabs | Voice Minutes | 38.6 | 100 | **38.6%** | **~98.2 (98.2%)** | **WATCH** |
| Vercel | Monthly Visitors | ~low | 50,000 | **<1%** | <1% | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | <1% | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | <100% | SAFE |

### ElevenLabs Voice Minute Limit — WATCH (downgraded from WARNING)

**Projected to be at ~98% of Creator tier limit (100 min) by month-end.**

- Used: 38.6 min in 11 days (38.6% of limit)
- Daily rate: 3.51 min/day
- Projected February total: ~98 min (98.2% of limit)
- **Previous projection**: ~107 min (Feb 10 report)

**Why downgraded from WARNING to WATCH:**
- Usage is highly bursty: 4 of 11 days have zero conversations
- Only +0.4 min added since last report (2 short conversations on Feb 10)
- The linear projection has dropped from 107 min to 98 min as quiet days accumulate
- However, a single active day (like Feb 6 or Feb 8 with 12-14 convos) could push past 100 min

**Mitigation remains the same:**
1. Monitor daily — the limit is within single-day reach
2. Understand ElevenLabs overage policy for Creator tier
3. If breached, evaluate Scale tier upgrade ($99/mo, 500 min/mo)

### Upgrade Trigger Points

| Service | Current Tier | Trigger | Next Tier | Cost Jump |
|---------|-------------|---------|-----------|-----------|
| ElevenLabs | Creator ($22.18/mo eff.) | >100 min/mo (at 98.2% projected) | Scale ($99/mo) | +$77/mo |
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

| Scenario | Visitors/mo | Voice Convos/mo | Voice Min/mo | SMS/mo | Est. Monthly Cost |
|----------|------------|----------------|-------------|--------|-------------------|
| **Current (1x)** | ~110 | ~110 | ~98 | ~17 | ~$63.47 |
| **3x Growth** | ~330 | ~330 | ~294 | ~51 | ~$161* |
| **10x Growth** | ~1,100 | ~1,100 | ~980 | ~170 | ~$311** |

*\*At 3x: Voice minutes (294) exceed Creator limit (100). Requires Scale tier upgrade ($99/mo). Total: $31.08 infra + $10 AI + $99 voice + $12.75 SMS = ~$153, plus Stripe fees ~$161.*

*\*\*At 10x: Voice at 980 min/mo. Scale tier (500 min) also exceeded. Requires Enterprise pricing. Estimated $200+ for voice alone.*

### Cost Forecast vs. Revenue Potential

| Scenario | Monthly Cost | Day Passes Needed to Break Even* | Revenue at 5% Conversion |
|----------|-------------|----------------------------------|--------------------------|
| Current (~110 visitors) | ~$63 | 39 passes | ~€9.42 (5.5 passes) |
| 500 visitors | ~$161 | 97 passes | ~€42.75 (25 passes) |
| 5,000 visitors | ~$311 | 188 passes | ~€427.50 (250 passes) |

*\*At €1.64 net per Day Pass after Stripe fees.*

**Break-even point**: ~2,400 monthly visitors assuming 5% Day Pass conversion rate.

---

## Anomalies

| Finding | Severity | Details |
|---------|----------|---------|
| ElevenLabs voice minutes near limit | **WATCH** | 38.6 min used in 11 days. Projected 98 min vs 100 min limit. Within margin of error. Downgraded from HIGH (Feb 10). |
| Config file ElevenLabs cost mismatch | **LOW** | `recurring-costs.ts` lists $18.33/mo (pre-tax). Actual with tax is ~$22.18/mo. Affects dashboard accuracy by ~$3.85/mo. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual checks required. Included as $10/mo estimate. |

**Resolved anomalies (from Feb 10):**
- Revenue stalled (2 zero-sale days) → **RESOLVED**: New sale on Feb 10.
- Twilio balance depletion rate → **RESOLVED** (previously resolved in Feb 10 report).

---

## Trend Analysis

### Comparison: Feb 10 → Feb 11

| Metric | Feb 10 (10 days) | Feb 11 (11 days) | Change | Direction |
|--------|-----------------|-----------------|--------|-----------|
| Fixed costs/mo | $63.26* | $59.41 | -$3.85 | DOWN (note below) |
| Variable costs (MTD) | ~$1.49 | ~$1.49 | -- | FLAT |
| Voice conversations (MTD) | 41 | 43 | +2 (+4.9%) | UP (slowing) |
| Voice minutes (MTD) | 38.2 | 38.6 | +0.4 (+1.0%) | FLAT |
| Voice min utilization | 38.2% | 38.6% | +0.4pp | FLAT |
| Voice min projection | ~107 min | ~98 min | -9 min (-8.4%) | DOWN (improving) |
| SMS sent (MTD) | 6 | 6 | -- | FLAT |
| Day Pass net sales | 4 | 5 | +1 (+25%) | UP |
| Stripe net revenue (MTD) | €6.56 | €8.27 | +€1.71 (+26.1%) | UP |
| Revenue run rate | ~$20.68/mo | ~$23.50/mo | +$2.82 (+13.6%) | UP |
| Revenue coverage ratio | 32.8% | 37.1% | +4.3pp | UP |
| Twilio balance | $18.20 | $18.20 | -- | FLAT |

*\*Feb 10 report listed $63.26 (included ElevenLabs effective with-tax rate of $22.18 instead of config rate of $18.33). This report uses config file values consistently ($59.41) for alignment with the admin dashboard.*

**Key observations:**
1. **Voice growth has flatlined** — Only 2 conversations in the last 2 days (Feb 10) after peaks of 14/day on Feb 6 and Feb 8. This could be weekend/weekday patterns or natural variance.
2. **Revenue recovering** — After a 2-day drought, a new sale on Feb 10 brings the run rate back above the Feb 9 projection. Still thin margin but trending positive.
3. **Voice minute projection improving** — Quiet days (Feb 9-11) pulled the daily rate down from 3.82 to 3.51 min/day. The 100-min limit breach is no longer the baseline scenario but remains within one active day.
4. **Cost stability maintained** — No new charges, subscriptions, or unexpected costs. The only variable element remains voice minutes.

---

## Recommendations

### Immediate Actions

1. **Continue monitoring ElevenLabs voice minutes** — At 38.6 min (38.6%), the limit is not in immediate danger but one high-activity day could change that. Check `https://elevenlabs.io/subscription` weekly.

2. **Check Anthropic billing manually** — Visit [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing) and record February MTD spend. The $10/mo estimate may be high or low.

3. **Fix ElevenLabs config mismatch** — Update `recurring-costs.ts` to reflect the actual effective rate with tax ($22.18/mo) or add a note. This affects the admin dashboard's accuracy by ~$3.85/mo.

### Near-Term Optimizations

4. **Investigate booking agent efficiency** — 17 booking conversations used 12.8 min, but 3 failed. Are the failures costing voice minutes? The 3 failed booking calls had 0s duration, so no waste — good.

5. **Analyze Day Pass conversion funnel** — 43 voice conversations → 5 Day Pass sales in the same period. What's the overlap? Are voice users converting to paid, or are they separate populations?

6. **Consider voice conversation length optimization** — Successful conversations average 66.1s. If Pelayo could resolve queries 10% faster, projected usage drops to ~88 min — comfortably under the limit.

### Long-Term Planning

7. **Scale tier decision point** — If March usage exceeds 100 min, the Creator → Scale ($99/mo) upgrade becomes necessary. At $99/mo voice, total costs jump to ~$140/mo, requiring ~5,200 monthly visitors to break even at 5% conversion.

8. **Revenue diversification** — The Day Pass at €1.99 (net €1.71) is thin margin. Weekly pass (€4.99), monthly subscription (€9.99), or commission on bookings would improve unit economics.

9. **Booking agent as revenue driver** — 17 booking conversations show genuine demand. If each successful booking generated a commission (even €0.50), that's additional revenue tied directly to voice agent value.

---

## Data Sources

| Source | Method | Last Queried |
|--------|--------|-------------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-02-11 |
| ElevenLabs Character Stats API | `/v1/usage/character-stats` | 2026-02-11 |
| ElevenLabs ConvAI API | `/v1/convai/conversations` (2 pages) | 2026-02-11 |
| Twilio Usage API | `/2010-04-01/Accounts/.../Usage/Records/ThisMonth` | 2026-02-11 |
| Twilio Balance API | `/2010-04-01/Accounts/.../Balance.json` | 2026-02-11 |
| Stripe Balance API | `/v1/balance` | 2026-02-11 |
| Stripe Transactions API | `/v1/balance_transactions` | 2026-02-11 |
| Config: `service-tiers.ts` | File read | 2026-02-11 |
| Config: `recurring-costs.ts` | File read | 2026-02-11 |
| Config: `forecast.ts` | File read | 2026-02-11 |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | -- |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-02-12.*
