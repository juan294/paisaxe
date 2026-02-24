# Cost Analyst Report

> **Generated**: 2026-02-19 | **Period**: February 2026 (MTD, 19 days) | **Status**: WATCH

---

## Executive Summary

**The voice minute projection has dropped back below the Creator tier limit.** Three consecutive quiet days (Feb 14-16 at previous report, extended to Feb 14-18 now) diluted the daily rate from 3.73 to 3.16 min/day, pulling the February projection down to **~88.4 min — safely under the 100 min Creator limit.** Status downgraded from WARNING to WATCH. Only 1 new conversation since the Feb 16 report: a brief 16-second session on Feb 17.

**Revenue drought extended to 6 days.** No new Day Pass sales since Feb 13. Stripe balances have fully cleared: a 3rd automatic payout of €1.71 completed on Feb 18, bringing total payouts to €9.98 — exactly matching total net revenue. Available and pending balances are both €0.00. Revenue run rate declined from ~10.5 to ~8.8 sales/month.

**Character utilization barely moved** — 14,415 of 110,553 (13.0%), up only 114 chars from the previous report's 14,301 (12.9%).

Fixed costs remain stable at $259.41/mo (including Claude Code Max $200/mo development tool). Total projected monthly operational spend is ~$61.70. Revenue coverage of operational costs is ~26.7%.

**Financial health: WATCH** — Voice projection improved but bursty pattern persists. Revenue drought extending. Costs predictable. No critical anomalies.

| Metric | Value | vs. Feb 16 |
|--------|-------|-----------|
| Total Fixed Costs (all) | $259.41/mo | -- |
| Total Fixed Costs (operational) | $59.41/mo | -- |
| Variable Costs (Feb MTD) | ~$1.49 | -- |
| Total Burn (Feb projected, operational) | ~$61.70 | ~$63.47 → $61.70 |
| Revenue (Feb MTD) | €13.93 gross / €9.98 net (~$10.78) | -- |
| Total Payouts | €9.98 (3 payouts) | +€1.71 (3rd payout Feb 18) |
| Stripe Balances | €0.00 available, €0.00 pending | Fully cleared |
| Twilio Prepaid Balance | $18.20 | -- |
| ElevenLabs Characters | 14,415 / 110,553 (13.0%) | +114 (+0.1pp) |
| ElevenLabs Voice Min | 60.0 / 100 | +0.3 min (+0.5%) |
| ElevenLabs Voice Min Projection | **~88.4 min (88.4%)** | -16.1 min (IMPROVED) |

---

## Current Costs — Per-Service Breakdown

### Fixed / Recurring Costs

| Service | Tier | Monthly Cost | Category | Since | Change vs Feb 16 |
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
| Twilio (Amazon Polly TTS) | 1 request, 3 units | $0.002 | API |
| Stripe (Processing Fees) | 7 charges, 1 refund | €1.96 (~$2.12) | API |
| Anthropic (Claude API) | Unknown | Unknown | -- |
| Voyage AI (Embeddings) | Unknown | Unknown | -- |
| **Total Variable (known)** | | **~$1.49** | |

*ElevenLabs usage costs covered by Creator plan subscription (110K chars/mo included). No overage charges.*
*Stripe fees are deducted from revenue, not an out-of-pocket cost.*

---

## Usage Metrics

### ElevenLabs Voice Conversations (All Paisaxe Agents)

| Period | Conversations | Successful | Failed/Initiated | Duration | Avg Duration |
|--------|--------------|-----------|------------------|----------|-------------|
| Feb 2026 (MTD, 19 days) | 51 | 47 | 4 | 60.0 min | 76.6 sec (successful) |
| Feb 2026 (prev report, 16 days) | 50 | 41 | 9 | 59.7 min | 87.4 sec |
| **Change** | **+1** | **+6*** | **-5*** | **+0.3 min** | **-10.8 sec** |

*\*The successful/failed recount reflects reclassification of some conversations between reports — the API returns the final status, and some previously "unknown" conversations may have resolved to "done".*

**By agent type:**

| Agent | Conversations | Duration | Avg Duration | Notes |
|-------|--------------|----------|-------------|-------|
| Pelayo (Visitor Guide) | 33 | 47.2 min | 98.3 sec | User-facing, via React SDK |
| Pelayo (Booking) | 18 | 12.8 min | 52.9 sec | Outbound calls via Twilio |

**Key observations:**
- **Near-zero activity since last report.** Only 1 new conversation on Feb 17 (16 seconds, Visitor Guide). Feb 14-16 and Feb 18-19 had zero conversations.
- **6 consecutive low/zero days** (Feb 14-19) continues the bursty pattern: active days are intense, quiet periods are extended.
- **Average successful duration dropped** from 87.4s to 76.6s due to status reclassification (more short conversations now counted as "done").

### Daily Voice Usage Breakdown

| Date | Conversations | Duration (min) | VG | BK | Notes |
|------|--------------|---------------|----|----|-------|
| Feb 4 | 6 | 3.3 | 0 | 6 | Booking agent testing only |
| Feb 5 | 0 | 0 | 0 | 0 | -- |
| Feb 6 | 14 | 12.6 | 7 | 7 | Peak conversations (tied) |
| Feb 7 | 7 | 9.6 | 5 | 2 | Moderate activity |
| Feb 8 | 14 | 12.8 | 12 | 2 | Peak conversations (tied) |
| Feb 9 | 0 | 0 | 0 | 0 | -- |
| Feb 10 | 2 | 0.4 | 2 | 0 | Minimal activity |
| Feb 11 | 0 | 0 | 0 | 0 | -- |
| Feb 12 | 0 | 0 | 0 | 0 | -- |
| Feb 13 | 7 | 21.1 | 6 | 1 | Peak minutes day — 1 session at 10 min |
| Feb 14 | 0 | 0 | 0 | 0 | -- |
| Feb 15 | 0 | 0 | 0 | 0 | -- |
| Feb 16 | 0 | 0 | 0 | 0 | -- |
| **Feb 17** | **1** | **0.3** | **1** | **0** | **Brief session (16s)** |
| Feb 18 | 0 | 0 | 0 | 0 | -- |
| Feb 19 | 0 | 0 | 0 | 0 | No activity yet |
| **Total** | **51** | **60.0** | **33** | **18** | |

Usage pattern: **Bursty — 6 active days out of 19, with 13 zero-activity days.** Feb 13 alone produced 35% of total voice minutes. The long quiet streak since Feb 14 is pulling projections down significantly.

### Twilio Communications

| Metric | Current (19 days) | Previous (16 days) | Change |
|--------|-------------------|-------------------|--------|
| SMS Sent | 6 | 6 | -- |
| Segments | 17 | 17 | -- |
| Cost | $1.49 | $1.49 | -- |
| Balance | $18.20 | $18.20 | -- |

**No new SMS activity since Feb 10.** Balance remains $18.20 — sufficient for ~73 SMS at ~$0.25/SMS effective rate. At current pace (~9 SMS/mo projected), balance lasts ~8 months.

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
| 2026-02-12 00:55 | Payout #1 | -€6.56 | €0.00 | -€6.56 |
| 2026-02-13 00:14 | Payout #2 | -€1.71 | €0.00 | -€1.71 |
| 2026-02-13 09:58 | Day Pass charge | €1.99 | €0.28 | €1.71 |
| **2026-02-18 00:34** | **Payout #3** | **-€1.71** | **€0.00** | **-€1.71** |
| **Totals** | | **€13.93 gross** | **€1.96 fees** | **€9.98 net** |

**Summary**: 7 charges, 1 refund = **6 net Day Pass sales** (unchanged from Feb 16). No new sales since Feb 13 — a **6-day sales drought** (longest this month).

**Third payout**: €1.71 on Feb 18 (Feb 13 charge settled). Total payouts: €9.98 — matching total net revenue exactly. **All balances fully cleared** (€0.00 available + €0.00 pending).

**Revenue run rate**: 6 sales in 19 days = **8.8 sales/month** = ~€15.12/mo net (~$16.33).
*Down from 10.5 sales/mo (Feb 16). The 6-day drought continues to erode the monthly average. Revenue is front-loaded in Feb 5-13; the second half of the month has produced zero sales.*

**Stripe balances**:
- Available: €0.00
- Pending: €0.00
- All revenue has been paid out — Stripe pipeline is fully flushed.

---

## Cost Efficiency

| Metric | Current (Feb 19) | Previous (Feb 16) | Change | Trend |
|--------|-----------------|-------------------|--------|-------|
| Cost per voice conversation | ~$0.43 | ~$0.44 | -$0.01 (-2.3%) | FLAT |
| Cost per voice minute | ~$0.37 | ~$0.37 | -- | FLAT |
| ElevenLabs char utilization | 13.0% | 12.9% | +0.1pp | FLAT |
| ElevenLabs voice min utilization | **60.0%** | 59.7% | +0.3pp | FLAT |
| ElevenLabs voice min projection | **~88.4 min (88.4%)** | ~104.5 min (104.5%) | -16.1 min | DOWN (improving) |
| Stripe net margin per Day Pass | 85.9% | 85.9% | -- | FLAT |
| Infra cost per Day Pass sold | ~$9.90 | ~$9.90 | -- | FLAT |
| Revenue coverage (operational) | ~27.5% | ~22.4% | +5.1pp | UP (methodology note) |

**Cost efficiency notes:**
- Voice metrics essentially flat — only 0.3 min added in 3 days.
- **Voice projection dramatically improved** by the quiet period. Three more zero-activity days reduced the daily rate from 3.73 to 3.16 min/day.
- Revenue coverage calculation uses projected monthly revenue (~$16.33) / operational costs ($59.41) = 27.5%. Note: the Feb 16 report's 22.4% may have used a different calculation basis.
- **Break-even remains distant** — would need ~37 Day Pass sales/month to cover operational costs ($59.41 / €1.71 × ~$1.08/€).

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Projected Month-End | Alert Level |
|---------|--------|------|-------|-------------|---------------------|-------------|
| ElevenLabs | Characters | 14,415 | 110,553 | **13.0%** | ~21,257 (19.2%) | SAFE |
| ElevenLabs | Voice Minutes | 60.0 | 100 | **60.0%** | **~88.4 (88.4%)** | **WATCH** |
| Vercel | Monthly Visitors | ~low | 50,000 | **<1%** | <1% | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | <1% | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | <100% | SAFE |

### ElevenLabs Voice Minute Limit — WATCH (downgraded from WARNING)

**Projection improved — now under the 100 min Creator tier limit.**

- Used: 60.0 min in 19 days (60.0% of limit)
- Daily rate: 3.16 min/day (down from 3.73 on Feb 16)
- Projected February total: **~88.4 min (88.4% of limit)**
- Remaining budget: 40.0 min in 9 days = 4.44 min/day safe budget

**Projection history:**
- Feb 10: 107 min (WARNING) — initial concern
- Feb 11: 98 min (WATCH) — quiet days pulled it down
- Feb 12: 90 min (WATCH) — continued improvement
- Feb 16: 104.5 min (WARNING) — Feb 13 spike reversed trend
- **Feb 19: 88.4 min (WATCH)** — 3 more quiet days restored safety margin

**Risk assessment**: The pattern remains bursty. The Feb 13 spike showed that a single active day can add 21+ minutes. With 40 min headroom and 9 days remaining, a repeat of Feb 13 would push to ~81 min used (leaving only 19 min for 8 more days). Two such days would breach the limit. Probability assessed as low given the usage pattern, but not negligible.

**Mitigation**: Continue monitoring. If usage reaches 80 min by Feb 24, re-assess urgently.

### Upgrade Trigger Points

| Service | Current Tier | Trigger | Next Tier | Cost Jump |
|---------|-------------|---------|-----------|-----------|
| ElevenLabs | Creator ($22.18/mo eff.) | >100 min/mo (**at 88.4% projected**) | Scale ($99/mo) | +$77/mo |
| Vercel | Hobby ($0) | >50K visitors/mo | Pro ($20/mo) | +$20/mo |
| Supabase | Pro ($25/mo) | >8 GB storage | Team ($599/mo) | +$574/mo |
| PostHog | Free ($0) | >1M events/mo | Pay-as-you-go | Variable |

---

## Scaling Forecast

Based on the forecast model in `src/lib/costs/forecast.ts`:

**Per-unit costs (computed from actuals):**
- Cost per voice minute: $0.37 (ElevenLabs $22.18 effective / 60.0 min actual)
- Cost per SMS: $0.25 (17 segments / 6 messages)
- Cost per chat: $0.01 (estimated fallback — no Anthropic data)

| Scenario | Visitors/mo | Voice Convos/mo | Voice Min/mo | SMS/mo | Est. Monthly Cost (operational) |
|----------|------------|----------------|-------------|--------|--------------------------------|
| **Current (1x)** | ~100 | ~75 | ~88 | ~9 | ~$61.70 |
| **3x Growth** | ~300 | ~225 | ~264 | ~27 | ~$148* |
| **10x Growth** | ~1,000 | ~750 | ~880 | ~90 | ~$290** |

*\*At 3x: Voice minutes (264) exceed Creator limit (100). Requires Scale tier upgrade ($99/mo). Total: $31.08 infra + $10 AI + $99 voice + ~$7 SMS = ~$148, plus Stripe fees.*

*\*\*At 10x: Voice at 880 min/mo. Scale tier (500 min) also exceeded. Requires Enterprise pricing or higher tier. Estimated $200+ for voice alone.*

### Cost Forecast vs. Revenue Potential

| Scenario | Monthly Cost (op.) | Day Passes Needed to Break Even* | Revenue at 5% Conversion |
|----------|-------------------|----------------------------------|--------------------------|
| Current (~100 visitors) | ~$62 | 37 passes | ~€8.55 (5 passes) |
| 500 visitors | ~$148 | 90 passes | ~€42.75 (25 passes) |
| 5,000 visitors | ~$290 | 177 passes | ~€427.50 (250 passes) |

*\*At €1.64 net per Day Pass after Stripe fees.*

**Break-even point**: ~2,250 monthly visitors assuming 5% Day Pass conversion rate.

---

## Anomalies

| Finding | Severity | Details |
|---------|----------|---------|
| 6-day revenue drought | **WATCH** | No Day Pass sales since Feb 13. Longest dry spell this month. All Stripe balances at €0.00. |
| Revenue run rate declining | **WATCH** | Run rate dropped from ~10.5 sales/mo (Feb 16) to ~8.8 sales/mo (Feb 19). Second half of February has zero sales so far. |
| Config file ElevenLabs cost mismatch | **LOW** | `recurring-costs.ts` lists $18.33/mo (pre-tax). Actual with tax is ~$22.18/mo. Affects dashboard accuracy by ~$3.85/mo. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual checks required. Included as $10/mo estimate. |

**Resolved anomalies from previous report:**
- Voice minutes exceeding tier projection (WARNING) → **Improved** — projection dropped from 104.5 to 88.4 min. Downgraded to WATCH.
- 10-minute voice session (INFO) → **No recurrence** — longest session since Feb 13 was 16 seconds.

---

## Trend Analysis

### Comparison: Feb 16 → Feb 19

| Metric | Feb 16 (16 days) | Feb 19 (19 days) | Change | Direction |
|--------|-----------------|-----------------|--------|-----------|
| Fixed costs/mo (operational) | $59.41 | $59.41 | -- | FLAT |
| Variable costs (MTD) | ~$1.49 | ~$1.49 | -- | FLAT |
| Voice conversations (MTD) | 50 | 51 | +1 (+2.0%) | FLAT |
| Voice minutes (MTD) | 59.7 | 60.0 | +0.3 (+0.5%) | FLAT |
| Voice min daily rate | 3.73 min/day | 3.16 min/day | -0.57 (-15.3%) | DOWN (improving) |
| Voice min projection | ~104.5 min (WARNING) | **~88.4 min (WATCH)** | -16.1 min | DOWN (improving) |
| Characters used | 14,301 (12.9%) | 14,415 (13.0%) | +114 (+0.1pp) | FLAT |
| SMS sent (MTD) | 6 | 6 | -- | FLAT |
| Day Pass net sales | 6 | 6 | -- | FLAT |
| Stripe net revenue (MTD) | €9.98 | €9.98 | -- | FLAT |
| Stripe total payouts | €8.27 | €9.98 | +€1.71 | UP |
| Stripe pending balance | €1.71 | €0.00 | -€1.71 | Cleared |
| Revenue run rate | ~10.5 sales/mo | ~8.8 sales/mo | -1.7 (-16.2%) | DOWN |
| Revenue coverage (operational) | ~22.4% | ~27.5% | +5.1pp | UP* |
| Twilio balance | $18.20 | $18.20 | -- | FLAT |

*\*Revenue coverage methodology adjusted — see Cost Efficiency section.*

**Key observations:**
1. **Platform is in a quiet period.** Minimal voice and zero revenue activity for 6 days. This is the longest quiet streak in February.
2. **Voice projection reversed favorably** — The WARNING from Feb 16 has resolved. Three more quiet days dropped the projection by 16 minutes, from 104.5 to 88.4.
3. **Stripe pipeline fully flushed.** All 6 net sales have been paid out (3 payouts totaling €9.98). Zero balances across the board — nothing is stuck in the pipeline.
4. **Revenue front-loaded.** All 6 sales occurred in Feb 5-13 (9 days). The second half of February (Feb 14-19, 6 days) has zero sales. This mirrors the voice pattern — activity is bursty and concentrated.
5. **No cost surprises.** Variable costs frozen at $1.49 since Feb 10 (no new SMS). Fixed costs unchanged. Total operational spend remains predictable.

### Month-End Projections (as of Feb 19)

| Metric | Projected Feb Total | Confidence |
|--------|-------------------|------------|
| Voice minutes | ~88 min (under 100 limit) | Medium (bursty pattern adds uncertainty) |
| Day Pass sales | ~8-9 net sales | Low (6-day drought could extend or break) |
| Net revenue | ~€13-15 | Low |
| Operational spend | ~$61-62 | High (mostly fixed costs) |
| Revenue coverage | ~22-27% | Low |

---

## Recommendations

### Immediate Actions (Priority)

1. **Check Anthropic billing manually** — Visit [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing) and record February MTD spend. The $10/mo estimate may diverge from actual usage, especially with Claude Code Max driving development.

2. **Monitor the sales drought** — 6 days without a Day Pass sale. If this extends past Feb 21 (8+ days), consider whether any recent site changes may have affected the purchase flow. Verify the Stripe checkout flow works correctly.

### Near-Term Actions

3. **Fix ElevenLabs config mismatch** — Update `recurring-costs.ts` to reflect the actual effective rate with tax ($22.18/mo) or add a note. This affects the admin dashboard's accuracy by ~$3.85/mo.

4. **Voice budget for remaining February** — 40.0 min remaining for 9 days = 4.44 min/day safe budget. If any single day exceeds 20 min (like Feb 13), re-assess the tier alert immediately.

5. **Understand ElevenLabs overage policy** — Still unknown from previous report: does Creator tier hard-cap at 100 min (service stops), or charge overage fees? Not urgent at 88.4% projection, but important to know before it becomes urgent.

### Long-Term Planning

6. **Revenue concentration risk** — All revenue comes from Day Pass (€1.99). With 6 net sales in 19 days and a declining run rate, the single-product model is vulnerable to quiet periods. Consider: weekly pass (€4.99), monthly subscription (€9.99), or booking commissions.

7. **Cost stability is a strength** — Operational costs are 96% fixed ($59.41 of ~$61.70). This means costs are highly predictable, but also means you can't "cut costs" during quiet periods. Focus on revenue growth rather than cost reduction.

8. **Break-even target** — At current conversion rates, ~2,250 monthly visitors (with 5% Day Pass conversion) would cover operational costs. Current visitor count is ~100/mo — a 22.5x gap. Marketing investment may be needed before organic growth closes this.

---

## Data Sources

| Source | Method | Last Queried |
|--------|--------|-------------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-02-19 |
| ElevenLabs Character Stats API | `/v1/usage/character-stats` | 2026-02-19 |
| ElevenLabs ConvAI API | `/v1/convai/conversations` (page_size=100) | 2026-02-19 |
| Twilio Usage API | `/2010-04-01/Accounts/.../Usage/Records/ThisMonth` | 2026-02-19 |
| Twilio Balance API | `/2010-04-01/Accounts/.../Balance.json` | 2026-02-19 |
| Stripe Balance API | `/v1/balance` | 2026-02-19 |
| Stripe Transactions API | `/v1/balance_transactions` | 2026-02-19 |
| Config: `service-tiers.ts` | File read | 2026-02-19 |
| Config: `recurring-costs.ts` | File read | 2026-02-19 |
| Config: `forecast.ts` | File read | 2026-02-19 |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | -- |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-02-22.*
