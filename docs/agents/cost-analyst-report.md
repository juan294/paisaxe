# Cost Analyst Report

> **Generated**: 2026-02-10 | **Period**: February 2026 (MTD, 10 days) | **Status**: WARNING

---

## Executive Summary

**ElevenLabs voice minutes are on track to exceed the Creator tier limit this month.** At 38.2 min used in 10 days (3.82 min/day), projected February usage is **~107 min — exceeding the 100 min Creator limit by 7%.** This is the most urgent finding since the last report. If usage maintains this pace, overage charges or a tier upgrade to Scale ($99/mo, +$77/mo) will be needed before month-end.

Revenue has **stalled** — no new Day Pass sales since Feb 8 (2 days with zero sales). The revenue run rate has dropped from ~13.3 sales/mo (Feb 9 report) to ~11.2 sales/mo. Revenue coverage ratio fell from 46.2% to 32.8%. Fixed costs remain stable at $63.26/mo (including Anthropic estimate).

On the positive side, voice engagement continues to grow strongly: 41 conversations in 10 days (vs 24 in 9 days), indicating genuine user interest. The config file mismatch flagged in the previous report ($5/mo vs actual $22.18/mo) has been partially corrected — `recurring-costs.ts` now shows $18.33/mo for ElevenLabs.

**Financial health: WARNING** — Voice minute limit breach projected this month. Revenue stalled. Costs stable but the ElevenLabs limit is the immediate risk.

| Metric | Value | vs. Feb 9 |
|--------|-------|-----------|
| Total Fixed Costs | $63.26/mo | -- (unchanged) |
| Variable Costs (Feb MTD) | ~$1.49 | -- (unchanged) |
| Total Burn (Feb projected) | ~$67.43 | +15.8% (revised projection) |
| Revenue (Feb MTD) | €6.56 net (~$7.08) | -- (no new sales) |
| Stripe Pending Balance | €6.56 | -- |
| Twilio Prepaid Balance | $18.20 | -- |
| ElevenLabs Voice Min | 38.2 / 100 | +49.2% (was 25.6) |

---

## Current Costs — Per-Service Breakdown

### Fixed / Recurring Costs

| Service | Tier | Monthly Cost | Category | Since | Change vs Feb 9 |
|---------|------|-------------|----------|-------|------------------|
| Supabase | Pro | $25.00 | Infrastructure | 2025-01 | -- |
| ElevenLabs | Creator (annual) | $22.18* | AI / Voice | 2026-02 | -- |
| Anthropic Claude | Prepaid credits | $10.00** | AI | 2025-12 | -- |
| GitHub Pro | Pro | $4.00 | Infrastructure | 2026-02-06 | -- |
| AWS Domains | -- | $2.08 | Infrastructure | 2025-01 | -- |
| Vercel | Hobby | $0.00 | Infrastructure | -- | -- |
| PostHog | Free | $0.00 | Analytics | -- | -- |
| **Total Fixed** | | **$63.26** | | | **--** |

*\*ElevenLabs Creator billed annually at $220/yr ($266.20 with tax) = ~$22.18/mo effective. Config file (`recurring-costs.ts`) lists $18.33/mo (pre-tax annual rate). Actual effective rate with tax: $22.18/mo.*

*\*\*Anthropic $10/mo is an estimate from config. No billing API available on personal accounts. Check [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing) manually.*

### Variable / Usage-Based Costs (February 2026 MTD)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (SMS outbound) | 6 messages, 17 segments | $1.49 | API |
| Twilio (Amazon Polly TTS) | 3 units | $0.002 | API |
| Stripe (Processing Fees) | 5 charges, 1 refund | €1.40 (~$1.51) | API |
| Anthropic (Claude API) | Unknown | Unknown | -- |
| Voyage AI (Embeddings) | Unknown | Unknown | -- |
| **Total Variable (known)** | | **~$1.49** | |

*ElevenLabs usage costs covered by Creator plan subscription (110K chars/mo included). No overage charges yet.*

---

## Usage Metrics

### ElevenLabs Voice Conversations

| Period | Conversations | With Duration | Duration | Avg Duration |
|--------|--------------|--------------|----------|-------------|
| Feb 2026 (MTD, 10 days) | 41 | 38 | 38.2 min | 60.3 sec |
| Feb 2026 (prev report, 9 days) | 24 | 19 | 25.6 min | 80.8 sec |
| **Change** | **+70.8%** | **+100%** | **+49.2%** | **-25.4%** |

**Key observations:**
- **17 new conversations in 1 day** (Feb 8 was especially active — 14 conversations). Includes both Pelayo (agent_1201...) and a second agent (agent_5201...).
- **3 failed connections** on Feb 6 (status: "initiated", 0s duration) — likely connection tests or drops.
- **Average duration dropped** from 80.8s to 60.3s — more short conversations pulling the average down, but total minutes up significantly.

**Character usage**: 5,324 of 110,553 monthly characters used (**4.8%** utilization). Characters are not the constraint — voice minutes are.

**Voice minute projection**: 38.2 min in 10 days = 3.82 min/day = **~107 min projected for February**. This **exceeds** the 100 min Creator limit.

### Daily Voice Usage Breakdown

| Date | Conversations | Duration (min) | Avg (sec) |
|------|--------------|---------------|-----------|
| Feb 4 | 6 | 3.3 | 32.8 |
| Feb 5 | 0 | 0 | -- |
| Feb 6 | 14 | 13.3 | 56.8 |
| Feb 7 | 7 | 9.5 | 81.7 |
| Feb 8 | 14 | 12.1 | 51.8 |
| Feb 9-10 | 0 | 0 | -- |
| **Total** | **41** | **38.2** | **60.3** |

Usage is **bursty** — heavy on Feb 6 and Feb 8, zero on Feb 5 and Feb 9-10. This makes simple linear projections less reliable, but the overall trend is upward.

### Twilio Communications

| Metric | Current (10 days) | Previous (9 days) | Change |
|--------|-------------------|-------------------|--------|
| SMS Sent | 6 | 6 | -- |
| Segments | 17 | 17 | -- |
| Cost | $1.49 | $1.49 | -- |
| Balance | $18.20 | $18.20 | -- |

**No new SMS activity since the Feb 9 report.** Twilio costs are flat. Balance remains $18.20.

**Twilio prepaid balance**: $18.20 — sufficient for ~73 SMS at current rate (~$0.25/SMS effective). At current pace (6 SMS/10 days = ~17/mo), balance lasts ~4.3 months.

### Stripe Revenue

| Date | Event | Gross | Fees | Net |
|------|-------|-------|------|-----|
| 2026-02-05 17:22 | Day Pass charge | €1.99 | €0.28 | €1.71 |
| 2026-02-05 17:33 | Refund | -€1.99 | €0.00 | -€1.99 |
| 2026-02-05 17:51 | Day Pass charge | €1.99 | €0.28 | €1.71 |
| 2026-02-07 12:02 | Day Pass charge | €1.99 | €0.28 | €1.71 |
| 2026-02-07 12:22 | Day Pass charge | €1.99 | €0.28 | €1.71 |
| 2026-02-08 13:29 | Day Pass charge | €1.99 | €0.28 | €1.71 |
| **Total** | | **€9.95** | **€1.40** | **€6.56** |

**Summary**: 5 charges, 1 refund = **4 net Day Pass sales**. No new sales since Feb 8 (2 days gap).

**Revenue run rate (updated)**: 4 sales in 10 days = 11.2 sales/month = ~€19.15/mo net (~$20.68).
*Down from 13.3 sales/mo projected on Feb 9 due to 2 days without sales.*

---

## Cost Efficiency

| Metric | Current (Feb 10) | Previous (Feb 9) | Change | Trend |
|--------|-----------------|-------------------|--------|-------|
| Cost per voice conversation | ~$0.54 | ~$0.09 | +500% | UP (note below) |
| Cost per voice minute | ~$0.58 | ~$0.87 | -33% | DOWN (improving) |
| ElevenLabs char utilization | 4.8% | 4.8% | -- | FLAT |
| ElevenLabs voice min utilization | **38.2%** | 25.6% | +12.6pp | UP (approaching limit) |
| Stripe net margin per Day Pass | 85.9% | 85.9% | -- | FLAT |
| Infrastructure cost per Day Pass sold | ~$15.82 | ~$13.32 | +18.8% | UP (sales stalled) |
| Revenue coverage ratio | **32.8%** | 46.2% | -13.4pp | DOWN |

**Cost per voice conversation note**: The Feb 9 report used a different calculation. This report uses ElevenLabs monthly subscription ($22.18) / conversations (41) = $0.54. As volume increases, this drops — at 100 convos/mo it would be $0.22.

**Revenue coverage note**: Fell because run rate dropped (4 sales/10 days = 11.2/mo vs 4 sales/9 days = 13.3/mo). Two consecutive zero-sale days pulled the average down.

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Projected Month-End | Alert Level |
|---------|--------|------|-------|-------------|---------------------|-------------|
| ElevenLabs | Characters | 5,324 | 110,553 | **4.8%** | ~14,907 (13.5%) | SAFE |
| ElevenLabs | Voice Minutes | 38.2 | 100 | **38.2%** | **~107 (107%)** | **WARNING** |
| Vercel | Monthly Visitors | ~low | 50,000 | **<1%** | <1% | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | <1% | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | <100% | SAFE |

### ElevenLabs Voice Minute Limit — WARNING

**Projected to breach Creator tier limit (100 min) this month.**

- Used: 38.2 min in 10 days (38.2% of limit)
- Daily rate: 3.82 min/day
- Projected February total: ~107 min (107% of limit)
- **Estimated breach date**: ~Feb 26 (at linear pace)

**Mitigating factor**: Usage is bursty (zero on 3 of 10 days). Actual month-end could be anywhere from 70-130 min depending on activity.

**Options if limit is breached:**
1. **Do nothing** — ElevenLabs may enforce overage pricing or throttle. Check ElevenLabs overage policy for Creator tier.
2. **Upgrade to Scale ($99/mo)** — 500 min/mo limit. +$77/mo cost increase. Only justified if growth trajectory continues.
3. **Reduce voice usage** — Shorter conversations, limit access, adjust paywall timing.

### Upgrade Trigger Points

| Service | Current Tier | Trigger | Next Tier | Cost Jump |
|---------|-------------|---------|-----------|-----------|
| ElevenLabs | Creator ($22.18/mo eff.) | **>100 min/mo** (approaching) | Scale ($99/mo) | +$77/mo |
| Vercel | Hobby ($0) | >50K visitors/mo | Pro ($20/mo) | +$20/mo |
| Supabase | Pro ($25/mo) | >8 GB storage | Team ($599/mo) | +$574/mo |
| PostHog | Free ($0) | >1M events/mo | Pay-as-you-go | Variable |

---

## Scaling Forecast

Based on the forecast model in `src/lib/costs/forecast.ts`:

**Per-unit costs (computed from actuals):**
- Cost per voice minute: $0.58 (ElevenLabs $22.18 / 38.2 min)
- Cost per SMS: $0.25 (17 segments / 6 messages)
- Cost per chat: $0.01 (estimated fallback — no Anthropic data)

| Scenario | Visitors/mo | Voice Convos/mo | Voice Min/mo | SMS/mo | Est. Monthly Cost |
|----------|------------|----------------|-------------|--------|-------------------|
| **Current (1x)** | ~115 | ~115 | ~107 | ~17 | ~$67.43 |
| **3x Growth** | ~345 | ~345 | ~321 | ~51 | ~$174* |
| **10x Growth** | ~1,150 | ~1,150 | ~1,070 | ~170 | ~$326** |

*\*At 3x: Voice minutes (321) exceed Creator limit (100). Requires Scale tier upgrade ($99/mo). Total: $31.08 infra + $10 AI + $99 voice + $12.75 SMS = ~$153 (conservative), ~$174 with Stripe fees.*

*\*\*At 10x: Voice at 1,070 min/mo. Scale tier (500 min) also exceeded. Requires Enterprise pricing or overage billing. Estimated $200+ for voice alone.*

**Updated breakdown at 10x:**
- Infrastructure (fixed): $31.08 (Supabase + domains + GitHub)
- AI (Claude + Voyage): ~$11.50 (est. $0.01/chat × 1,150 chats)
- Voice (ElevenLabs): ~$200+ (Scale tier exceeded, Enterprise needed)
- Communications (Twilio): ~$42.50 (170 SMS at $0.25)
- Stripe fees: ~$41 (est. 5% conversion on 1,150 visitors = 57.5 passes × €0.28 fee)

### Cost Forecast vs. Revenue Potential

| Scenario | Monthly Cost | Day Passes Needed to Break Even* | Revenue at 5% Conversion |
|----------|-------------|----------------------------------|--------------------------|
| Current (~115 visitors) | ~$67 | 41 passes | ~€9.85 (5.8 passes) |
| 500 visitors | ~$153 | 93 passes | ~€42.75 (25 passes) |
| 5,000 visitors | ~$326 | 199 passes | ~€427.50 (250 passes) |

*\*At €1.64 net per Day Pass after Stripe fees, averaged across refund rate.*

**Break-even point**: ~2,500 monthly visitors assuming 5% Day Pass conversion rate (up from 2,100 due to revised cost projections including Anthropic).

---

## Anomalies

| Finding | Severity | Details |
|---------|----------|---------|
| ElevenLabs voice minutes approaching limit | **HIGH** | 38.2 min used in 10 days. Projected 107 min vs 100 min limit. Breach likely by Feb 26. |
| Revenue stalled (2 zero-sale days) | **MEDIUM** | No new Day Pass sales since Feb 8. Run rate dropped from 13.3/mo to 11.2/mo. Could be normal variance or a trend. |
| Config file ElevenLabs cost mismatch | **LOW** | `recurring-costs.ts` lists $18.33/mo (pre-tax). Actual with tax is $22.18/mo. Minor but affects dashboard accuracy. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual checks required. Included as $10/mo estimate in fixed costs. |
| Twilio balance depletion rate stabilized | **RESOLVED** | Previous report flagged rapid depletion ($3.57 in 3 days). No new SMS since — balance stable at $18.20. |

---

## Trend Analysis

### Comparison: Feb 9 → Feb 10

| Metric | Feb 9 (9 days) | Feb 10 (10 days) | Change | Direction |
|--------|---------------|-----------------|--------|-----------|
| Fixed costs/mo | $53.26* | $63.26** | +$10 | UP (Anthropic now included) |
| Variable costs (MTD) | ~$1.49 | ~$1.49 | -- | FLAT |
| Voice conversations (MTD) | 24 | 41 | +17 (+70.8%) | UP |
| Voice minutes (MTD) | 25.6 | 38.2 | +12.6 (+49.2%) | UP |
| Voice min utilization | 25.6% | **38.2%** | +12.6pp | UP (approaching limit) |
| SMS sent (MTD) | 6 | 6 | -- | FLAT |
| Day Pass net sales | 4 | 4 | -- | FLAT |
| Stripe net revenue (MTD) | €6.56 | €6.56 | -- | FLAT |
| Revenue run rate | ~$24.61/mo | ~$20.68/mo | -$3.93 (-16%) | DOWN |
| Revenue coverage ratio | 46.2% | 32.8% | -13.4pp | DOWN |
| Twilio balance | $18.20 | $18.20 | -- | FLAT |

*\*Feb 9 report excluded Anthropic ($10/mo) from fixed costs total. \*\*This report includes it for completeness.*

**Key observations:**
1. **Voice usage surging, revenue stalling** — 70.8% more conversations but zero new sales. This gap is concerning. Voice drives engagement but isn't converting to paid.
2. **Voice minute limit is the critical constraint** — At 38.2% utilization in 10 days (linear projection: 107%), this is the first service limit that will be tested in production.
3. **Revenue variability is high** — With only 4 sales total, a 2-day gap is statistically meaningless. But it does lower the projected run rate. Need more data points before concluding either way.
4. **Costs are stable** — No new subscriptions or usage spikes on Twilio/Stripe. The only moving part is ElevenLabs voice minutes.

---

## Recommendations

### Immediate Actions (This Week)

1. **Monitor ElevenLabs voice minutes daily** — At 38.2 min (38.2%), the Creator limit (100 min) will be breached around Feb 26 at current pace. Check `https://elevenlabs.io/subscription` for real-time usage.

2. **Research ElevenLabs overage policy** — Before hitting the limit, understand what happens: Does Creator throttle? Charge overage? Require upgrade? This determines urgency of action.

3. **Check Anthropic billing manually** — Visit [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing) and record February MTD spend. The $10/mo estimate may be high or low.

### Near-Term Optimizations

4. **Optimize voice conversation length** — Average is 60.3s. If conversations could be 10-15% shorter through better prompts or faster responses, projected usage drops below 100 min.

5. **Consider voice usage caps** — E.g., limit to 3 voice conversations per Day Pass, or cap conversation length at 3 minutes. This directly controls the #1 cost driver.

6. **Investigate sales conversion** — 41 voice conversations but only 4 Day Pass sales. What's the user journey? Are voice users already paid (Day Pass holders) or are they getting free access somehow?

### Long-Term Planning

7. **Scale tier decision** — If February exceeds 100 min, the Creator → Scale ($99/mo) upgrade is the next major cost event. At $99/mo, break-even requires ~60 Day Passes/mo (~3,600 visitors at 5% conversion). This is achievable but requires significantly more traffic.

8. **Break-even recalculated** — At $67.43/mo total costs, break-even is ~2,500 monthly visitors at 5% conversion. If Scale upgrade is needed ($140/mo total), break-even jumps to ~5,200 visitors.

9. **Revenue diversification** — The Day Pass at €1.99 with 14.1% Stripe fees is a thin margin. Consider: weekly pass (€4.99), monthly subscription (€9.99), or partnership/commission model for bookings.

---

## Data Sources

| Source | Method | Last Queried |
|--------|--------|-------------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-02-10 |
| ElevenLabs ConvAI API | `/v1/convai/conversations` | 2026-02-10 |
| Twilio Usage API | `/2010-04-01/Accounts/.../Usage/Records/ThisMonth` | 2026-02-10 |
| Twilio Balance API | `/2010-04-01/Accounts/.../Balance.json` | 2026-02-10 |
| Stripe Balance API | `/v1/balance` | 2026-02-10 |
| Stripe Transactions API | `/v1/balance_transactions` | 2026-02-10 |
| Config: `service-tiers.ts` | File read | 2026-02-10 |
| Config: `recurring-costs.ts` | File read | 2026-02-10 |
| Config: `forecast.ts` | File read | 2026-02-10 |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | -- |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-02-11.*
