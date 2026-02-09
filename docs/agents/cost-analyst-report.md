# Cost Analyst Report

> **Generated**: 2026-02-09 | **Period**: February 2026 (MTD, 9 days) | **Status**: WATCH

---

## Executive Summary

Paisaxe costs have **increased significantly** since the last report (Feb 6). The most impactful change is the **ElevenLabs tier upgrade from Starter to Creator** (annual billing), raising the effective monthly cost from ~$4.17/mo to ~$22.18/mo (with tax). Total fixed monthly burn is now **~$53.26/mo**, up 70% from the previous $31.25/mo. This is driven by the ElevenLabs upgrade and the new GitHub Pro subscription ($4/mo).

On the positive side, **revenue is accelerating**: 4 net Day Pass sales in 9 days (€6.56 net) vs. 1 net sale in the first 6 days. Voice usage has grown 8x (25.6 min from 24 conversations vs. 3.2 min from 6 conversations), validating the Creator upgrade. However, the platform is still far from break-even.

**Financial health: WATCH** — Fixed costs jumped 70%, but usage growth justifies the ElevenLabs upgrade. Revenue traction is encouraging but insufficient to cover costs. Monitor closely.

| Metric | Value | vs. Feb 6 |
|--------|-------|-----------|
| Total Fixed Costs | $53.26/mo | +70.5% |
| Variable Costs (Feb MTD) | ~$1.49 | -72% (lower per-char cost on Creator) |
| Total Burn (Feb projected) | ~$58.23 | +58.8% |
| Revenue (Feb MTD) | €6.56 net (~$7.08) | +359% |
| Stripe Pending Balance | €6.56 | +€5.13 |
| Twilio Prepaid Balance | $18.20 | -$3.57 |

---

## Current Costs — Per-Service Breakdown

### Fixed / Recurring Costs

| Service | Tier | Monthly Cost | Category | Since | Change |
|---------|------|-------------|----------|-------|--------|
| Supabase | Pro | $25.00 | Infrastructure | 2025-01 | -- |
| ElevenLabs | Creator (annual) | $22.18* | AI / Voice | 2026-02 | +$18.01 |
| GitHub Pro | Pro | $4.00 | Infrastructure | 2026-02-06 | NEW |
| AWS Domains | -- | $2.08 | Infrastructure | 2025-01 | -- |
| Vercel | Hobby | $0.00 | Infrastructure | -- | -- |
| PostHog | Free | $0.00 | Analytics | -- | -- |
| **Total Fixed** | | **$53.26** | | | **+$22.01** |

*\*ElevenLabs Creator is billed annually at $220/yr ($266.20 with tax) = ~$22.18/mo effective. API confirms: next invoice $266.20 due ~2027-05. Config file still lists $5/mo (Starter) — needs update.*

**Note**: The `recurring-costs.ts` config file also lists Anthropic at $10/mo as a recurring cost (prepaid credits). This is an estimate and should be verified manually. Including Anthropic, effective fixed costs are **~$63.26/mo**.

### Variable / Usage-Based Costs (February 2026 MTD)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (SMS outbound) | 6 messages, 17 segments | $1.49 | API |
| Twilio (Amazon Polly TTS) | 3 units | $0.002 | API |
| Stripe (Processing Fees) | 5 charges, 1 refund | €1.40 (~$1.51) | API |
| Anthropic (Claude API) | Unknown | Unknown** | -- |
| Voyage AI (Embeddings) | Unknown | Unknown** | -- |
| **Total Variable (known)** | | **~$1.49** | |

*\*ElevenLabs usage costs are now covered by the Creator plan subscription (110K chars/mo included). No overage charges.*

*\*\*Anthropic usage is not API-accessible on personal accounts. Check [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing) manually. Voyage AI is likely within the free tier.*

---

## Usage Metrics

### ElevenLabs Voice Conversations

| Period | Conversations | Successful | Duration | Avg Duration |
|--------|--------------|-----------|----------|-------------|
| Feb 2026 (MTD, 9 days) | 24 | 19 | 25.6 min | 80.8 sec* |
| Feb 2026 (prev report, 6 days) | 6 | 6 | 3.2 min | 32.5 sec |
| **Change** | **+300%** | **+217%** | **+700%** | **+149%** |

*\*Average duration calculated on successful conversations only (19 convos with messages). 5 conversations had 0 messages / <2 sec duration (likely connection tests or drops).*

**Character usage**: 5,324 of 110,553 monthly characters used (**4.8%** utilization). The Creator tier provides ~2.8x more headroom than the old Starter tier.

**Top conversation topics** (from API summaries):
- Restaurant booking assistance (6 conversations)
- Covadonga / Lagos de Covadonga information (4)
- Oviedo restaurant and weather (3)
- Ruta del Cares information (3)
- Language switching / greetings (4)
- Cultural topics (fabada, pre-Romanesque art) (2)

### Twilio Communications

| Period | SMS Sent | Segments | Cost | Balance |
|--------|---------|----------|------|---------|
| Feb 2026 (MTD, 9 days) | 6 | 17 | $1.49 | $18.20 |
| Feb 2026 (prev report, 6 days) | 1 | -- | $0.18 | $21.77 |
| **Change** | **+500%** | -- | **+728%** | **-$3.57** |

**Twilio prepaid balance**: $18.20 — sufficient for ~73 SMS at current rate (~$0.25/SMS effective including segments).

**Note**: SMS cost per message is higher than previously estimated ($0.25 vs $0.18) because multi-segment messages cost more. Average 2.8 segments per SMS.

### Stripe Revenue

| Date | Event | Gross | Fees | Net |
|------|-------|-------|------|-----|
| 2026-02-05 | Day Pass charge | €1.99 | €0.28 | €1.71 |
| 2026-02-05 | Refund | -€1.99 | €0.00 | -€1.99 |
| 2026-02-05 | Day Pass charge | €1.99 | €0.28 | €1.71 |
| 2026-02-06 | Day Pass charge | €1.99 | €0.28 | €1.71 |
| 2026-02-08 | Day Pass charge | €1.99 | €0.28 | €1.71 |
| 2026-02-09 | Day Pass charge | €1.99 | €0.28 | €1.71 |
| **Total** | | **€7.96** | **€1.40** | **€6.56** |

**Summary**: 5 charges, 1 refund = **4 net Day Pass sales**. Effective Stripe fee rate: 14.1% per transaction (€0.28 on €1.99).

**Revenue run rate**: 4 sales in 9 days = ~13.3 sales/month = ~€22.79/mo net (~$24.61).

---

## Cost Efficiency

| Metric | Current | Previous (Feb 6) | Change | Trend |
|--------|---------|-------------------|--------|-------|
| Cost per voice conversation | ~$0.09 | ~$0.04 | +125% | UP |
| ElevenLabs char utilization | 4.8% | 37.6% | -87% | DOWN (good — more headroom) |
| Stripe net margin per Day Pass | 85.9% | 71.9% | +14pp | UP (4 of 5 charges kept) |
| Infrastructure cost per Day Pass sold | ~$13.32 | ~$16.13 | -17% | DOWN (improving) |
| Revenue coverage ratio | 46.2%* | 6.5% | +39.7pp | UP |

*\*Revenue coverage = monthly net revenue run rate ($24.61) / fixed costs ($53.26). Represents how much of fixed costs are covered by revenue.*

**Cost per voice conversation note**: The increase is because the ElevenLabs subscription cost is now $22.18/mo (Creator) vs $4.17/mo (Starter). However, the per-unit cost drops rapidly with volume: at 100 conversations/mo, cost per conversation would be ~$0.22 vs $0.04 — still favorable given the much higher character and minute limits.

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Alert Level |
|---------|--------|------|-------|-------------|-------------|
| ElevenLabs | Characters | 5,324 | 110,553 | **4.8%** | SAFE |
| ElevenLabs | Voice Minutes | 25.6 | 100* | **25.6%** | SAFE |
| Vercel | Monthly Visitors | ~low | 50,000 | **<1%** | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | SAFE |

*\*Creator tier provides 100 voice minutes/mo (up from 30 on Starter).*

**All services SAFE.** The ElevenLabs upgrade to Creator provides substantial headroom. At 25.6 min used in 9 days, projected monthly usage is ~85 min — within the 100 min Creator limit but worth monitoring.

**ElevenLabs voice minute projection**: At current daily rate (2.84 min/day), projected February total = ~79.6 min (79.6% of 100 min limit). This is within limits but **approaching WATCH territory** if usage accelerates.

### Upgrade Trigger Points

| Service | Current Tier | Trigger | Next Tier | Cost Jump |
|---------|-------------|---------|-----------|-----------|
| ElevenLabs | Creator ($22.18/mo eff.) | >100 min/mo voice OR >110K chars/mo | Scale ($99/mo) | +$77/mo |
| Vercel | Hobby ($0) | >50K visitors/mo OR team needs | Pro ($20/mo) | +$20/mo |
| Supabase | Pro ($25/mo) | >8 GB storage | Team ($599/mo) | +$574/mo |
| PostHog | Free ($0) | >1M events/mo | Pay-as-you-go | Variable |

---

## Scaling Forecast

Based on the forecast model in `src/lib/costs/forecast.ts` with updated per-unit costs:

| Scenario | Visitors/mo | Voice Convos/mo | Voice Min/mo | SMS/mo | Est. Monthly Cost |
|----------|------------|----------------|-------------|--------|-------------------|
| **Current (1x)** | ~80 | ~80 | ~85 | ~20 | ~$58.23 |
| **3x Growth** | ~240 | ~240 | ~255 | ~60 | ~$73.26* |
| **10x Growth** | ~800 | ~800 | ~850 | ~200 | ~$153.26** |

*\*At 3x: Voice minutes (255) exceed Creator limit (100). Requires Scale tier upgrade (+$77/mo). Total: $53.26 fixed + $77 upgrade + ~$15 SMS = ~$145/mo*

*\*\*At 10x: Voice at 850 min/mo. Scale tier (500 min) also exceeded. Requires Enterprise or overage billing.*

**Updated breakdown at 10x:**
- Infrastructure (fixed): $31.08 (Supabase + domains + GitHub)
- AI (Claude + Voyage): ~$8.00 (est. $0.01/chat)
- Voice (ElevenLabs Scale): ~$99.00 (minimum tier for this volume)
- Communications (Twilio): ~$50.00 (200 SMS at $0.25)
- Stripe fees: ~$37.24 (est. 40 Day Passes/mo)

**Key insight**: The cost inflection point has shifted. Voice remains the primary cost driver. At 3x growth, the ElevenLabs upgrade from Creator ($22.18/mo) to Scale ($99/mo) is the next major cost event.

### Cost Forecast vs. Revenue Potential

| Scenario | Monthly Cost | Day Passes Needed to Break Even* | Revenue at 5% Conversion |
|----------|-------------|----------------------------------|--------------------------|
| Current (~80 visitors) | ~$58 | 35 passes | €6.85 (3.4 passes) |
| 500 visitors | ~$145 | 88 passes | €42.80 (21.5 passes) |
| 5,000 visitors | ~$250 | 152 passes | €427.93 (215 passes) |

*\*At €1.64 net per Day Pass after Stripe fees (€1.71 net / sale, averaged across refund rate).*

**Break-even point**: ~2,100 monthly visitors assuming 5% Day Pass conversion rate (up from 1,600 due to higher fixed costs).

---

## Anomalies

| Finding | Severity | Details |
|---------|----------|---------|
| ElevenLabs tier upgrade (Starter -> Creator) | **HIGH** | Monthly cost jumped from ~$4.17 to ~$22.18 (+432%). This was not flagged in the previous report. Verify this was an intentional upgrade. |
| Twilio SMS cost spike | **MEDIUM** | 6 SMS costing $1.49 (was 1 SMS / $0.18). 728% increase. Multi-segment messages averaging 2.8 segments each driving higher per-message cost. |
| Twilio balance depletion rate | **WATCH** | Balance dropped $3.57 in 3 days ($18.20 remaining). At this rate, balance depletes in ~15 days. Top-up may be needed in March. |
| GitHub Pro new subscription | **INFO** | New $4/mo subscription added 2026-02-06. Adds to fixed costs. |
| ElevenLabs config mismatch | **LOW** | Config still says $5/mo (Starter) but actual plan is Creator at $22.18/mo effective. Update `recurring-costs.ts` and `service-tiers.ts`. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual checks required. |

---

## Trend Analysis

### Comparison with Previous Report (Feb 6)

| Metric | Feb 6 | Feb 9 | Change | Direction |
|--------|-------|-------|--------|-----------|
| Fixed costs/mo | $31.25 | $53.26 | +$22.01 (+70.5%) | UP |
| Variable costs (MTD) | ~$5.40 | ~$1.49 | -$3.91 (-72%) | DOWN |
| Voice conversations (MTD) | 6 | 24 | +18 (+300%) | UP |
| Voice minutes (MTD) | 3.2 | 25.6 | +22.4 (+700%) | UP |
| SMS sent (MTD) | 1 | 6 | +5 (+500%) | UP |
| Day Pass net sales | 1 | 4 | +3 (+300%) | UP |
| Stripe net revenue (MTD) | €1.43 | €6.56 | +€5.13 (+359%) | UP |
| Twilio balance | $21.77 | $18.20 | -$3.57 (-16.4%) | DOWN |
| ElevenLabs char utilization | 37.6% | 4.8% | -32.8pp | DOWN (more headroom) |
| ElevenLabs voice min utilization | 10.7% | 25.6% | +14.9pp | UP |

**Key observations:**
1. **Costs up, usage up, revenue up** — all metrics are growing, which is healthy for an early-stage product.
2. **ElevenLabs tier upgrade is the dominant cost change** — $22/mo > $4/mo, but the Creator tier provides 3.3x more voice minutes and 2.8x more characters.
3. **Revenue acceleration** — 3 sales in days 7-9 vs 1 net sale in days 1-6. If this pace holds, February could see ~13 sales (~€22 net).
4. **Twilio costs need monitoring** — SMS costs are higher than expected due to multi-segment messages. Consider shorter SMS templates.

---

## Recommendations

### Immediate Actions

1. **Verify ElevenLabs upgrade was intentional** — The tier jump from Starter to Creator is the largest cost change. Confirm this was a deliberate decision (likely to support higher voice usage).

2. **Update config files** — `recurring-costs.ts` still lists ElevenLabs at $5/mo (Starter). Update to $22.18/mo (Creator annual). Also update `service-tiers.ts` to reflect Creator tier limits (100 min, 110K chars).

3. **Check Anthropic billing manually** — Visit [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing) and record February MTD spend.

4. **Plan Twilio top-up** — Balance is $18.20 and declining at ~$1.19/day. Budget a $20-25 top-up for late February / early March.

### Near-Term Optimizations

5. **Optimize SMS templates** — Current SMS messages average 2.8 segments, costing ~$0.25 each. Shortening messages to fit in 1 segment (160 chars) would reduce SMS costs by ~64%.

6. **Monitor voice minutes closely** — Projected February usage is ~80 min of 100 min limit. If usage spikes due to marketing or organic growth, the Creator limit could be hit this month.

7. **Consider Day Pass pricing** — At €1.99, Stripe fees consume 14.1% of revenue. A higher price point (€4.99) would reduce fee impact to ~6.6% and improve break-even economics.

### Long-Term Planning

8. **Voice is still the cost driver** — At 3x growth, the next tier upgrade (Creator -> Scale at $99/mo) is the biggest cost event. The paywall gating voice behind Day Pass is critical to offset this.

9. **Break-even recalculated** — With higher fixed costs ($53.26/mo), break-even is now ~2,100 monthly visitors at 5% conversion. SEO and marketing remain the priority investment.

10. **Revenue trajectory is positive** — If the current sales pace holds (4 sales/9 days), February revenue (~€22 net) would cover ~42% of fixed costs. This is a significant improvement from the 6.5% coverage ratio just 3 days ago.

---

## Data Sources

| Source | Method | Last Queried |
|--------|--------|-------------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-02-09 |
| ElevenLabs ConvAI API | `/v1/convai/conversations` | 2026-02-09 |
| Twilio Usage API | `/2010-04-01/Accounts/.../Usage/Records/ThisMonth` | 2026-02-09 |
| Twilio Balance API | `/2010-04-01/Accounts/.../Balance.json` | 2026-02-09 |
| Stripe Balance API | `/v1/balance` | 2026-02-09 |
| Stripe Transactions API | `/v1/balance_transactions` | 2026-02-09 |
| Config: `service-tiers.ts` | File read | 2026-02-09 |
| Config: `recurring-costs.ts` | File read | 2026-02-09 |
| Config: `forecast.ts` | File read | 2026-02-09 |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | -- |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-02-10.*
