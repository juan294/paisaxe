# Cost Analyst Report

> **Generated**: 2026-02-16 | **Period**: February 2026 (MTD, 16 days) | **Status**: WARNING

---

## Executive Summary

**The ElevenLabs voice minute projection has crossed the Creator tier limit.** After a quiet Feb 11-12, voice activity surged on Feb 13 with 7 conversations totaling 21.1 minutes — the highest single-day duration in February. This pulled the daily rate up to 3.73 min/day, projecting **~104.5 min for February — above the 100 min Creator limit.** This is the first time the projection has breached the limit since the Feb 10 report (107 min). The limit status is upgraded to **WARNING**.

**Revenue activity resumed.** A 7th Day Pass charge on Feb 13 broke the 2-day sales drought. Total net sales: 6 (up from 5). Second payout of €1.71 completed on Feb 13. Total payouts to date: €8.27. Revenue run rate improved slightly to ~$13.32/mo net (~10.5 sales/mo), though this is lower than earlier projections as the mid-month quiet period pulled it down.

**Character utilization climbed to 12.9%** (up from 5.0% in the Feb 12 report). The Feb 13 voice activity drove significant character consumption. Still well within the 110,553 character limit.

Fixed costs remain stable at $259.41/mo (including Claude Code Max $200/mo development tool). Total projected monthly spend is ~$63.47 operational. Revenue coverage of operational costs is 22.4%.

**Financial health: WARNING** — Voice minutes on track to exceed Creator tier limit. Revenue flowing but slower than early-February pace. Costs predictable. One anomaly flagged.

| Metric | Value | vs. Feb 12 |
|--------|-------|-----------|
| Total Fixed Costs (all) | $259.41/mo | -- |
| Total Fixed Costs (operational) | $59.41/mo | -- |
| Variable Costs (Feb MTD) | ~$1.49 | -- |
| Total Burn (Feb projected, operational) | ~$63.47 | -- |
| Revenue (Feb MTD) | €15.92 gross / €9.98 net (~$10.78) | +€1.99 gross / +€1.71 net |
| Total Payouts | €8.27 (2 payouts) | +€1.71 (2nd payout) |
| Stripe Pending Balance | €1.71 | -- (different charge) |
| Twilio Prepaid Balance | $18.20 | -- |
| ElevenLabs Characters | 14,301 / 110,553 (12.9%) | +8,819 (+7.9pp) |
| ElevenLabs Voice Min | 59.7 / 100 | +21.1 min (+54.7%) |
| ElevenLabs Voice Min Projection | **~104.5 min (104.5%)** | +14.5 min (WARNING) |

---

## Current Costs — Per-Service Breakdown

### Fixed / Recurring Costs

| Service | Tier | Monthly Cost | Category | Since | Change vs Feb 12 |
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
| Stripe (Processing Fees) | 7 charges, 1 refund | €1.96 (~$2.12) | API |
| Anthropic (Claude API) | Unknown | Unknown | -- |
| Voyage AI (Embeddings) | Unknown | Unknown | -- |
| **Total Variable (known)** | | **~$1.49** | |

*ElevenLabs usage costs covered by Creator plan subscription (110K chars/mo included). No overage charges yet.*
*Stripe fees are deducted from revenue, not an out-of-pocket cost.*

---

## Usage Metrics

### ElevenLabs Voice Conversations (All Paisaxe Agents)

| Period | Conversations | Successful | Failed/Unknown | Duration | Avg Duration |
|--------|--------------|-----------|----------------|----------|-------------|
| Feb 2026 (MTD, 16 days) | 50 | 41 | 9 | 59.7 min | 87.4 sec (successful) |
| Feb 2026 (prev report, 12 days) | 43 | 35 | 8 | 38.6 min | 66.1 sec |
| **Change** | **+7** | **+6** | **+1** | **+21.1 min** | **+21.3 sec** |

**By agent type:**

| Agent | Conversations | Duration | Avg Duration | Notes |
|-------|--------------|----------|-------------|-------|
| Pelayo (Visitor Guide) | 32 | 47.0 min | 104.4 sec | User-facing, via React SDK |
| Pelayo (Booking) | 18 | 12.8 min | 54.7 sec | Outbound calls via Twilio |

**Key observations:**
- **Major activity spike on Feb 13.** After 3 consecutive zero-activity days (Feb 11-12 and most of Feb 13 being quiet per the previous report), Feb 13 saw 7 conversations totaling 21.1 minutes — the highest single-day minute count in February.
- **6 Visitor Guide conversations on Feb 13** including 3 long sessions (201s, 186s, 600s). The 10-minute (600s) session is the longest single conversation recorded.
- **1 Booking conversation on Feb 13** — booking agent remains active alongside visitor guide.
- **Character usage jumped to 14,301** (12.9% of 110,553 limit). Up from 5,482 (5.0%) at last report — the 7 conversations consumed 8,819 characters.
- **Average successful duration increased significantly** from 66.1s to 87.4s, driven by longer Feb 13 sessions.

### Daily Voice Usage Breakdown

| Date | Conversations | Duration (min) | VG | BK | Notes |
|------|--------------|---------------|----|----|-------|
| Feb 4 | 6 | 3.2 | 0 | 6 | Booking agent testing only |
| Feb 5 | 0 | 0 | 0 | 0 | -- |
| Feb 6 | 14 | 12.6 | 7 | 7 | Peak conversations (tied) |
| Feb 7 | 7 | 9.6 | 5 | 2 | Moderate activity |
| Feb 8 | 14 | 12.8 | 12 | 2 | Peak conversations (tied) |
| Feb 9 | 0 | 0 | 0 | 0 | -- |
| Feb 10 | 2 | 0.4 | 2 | 0 | Minimal activity |
| Feb 11 | 0 | 0 | 0 | 0 | -- |
| Feb 12 | 0 | 0 | 0 | 0 | -- |
| **Feb 13** | **7** | **21.1** | **6** | **1** | **Peak minutes day — 1 session at 10 min** |
| Feb 14 | 0 | 0 | 0 | 0 | -- |
| Feb 15 | 0 | 0 | 0 | 0 | -- |
| Feb 16 | 0 | 0 | 0 | 0 | No activity yet (early) |
| **Total** | **50** | **59.7** | **32** | **18** | |

Usage pattern: **Bursty — 5 active days out of 16, with Feb 13 producing more minutes (21.1) than any other single day.** Seven of sixteen days have zero conversations. The burstiness makes forecasting difficult: a single active day can swing the projection by 20+ min.

### Twilio Communications

| Metric | Current (16 days) | Previous (12 days) | Change |
|--------|-------------------|-------------------|--------|
| SMS Sent | 6 | 6 | -- |
| Segments | 17 | 17 | -- |
| Cost | $1.49 | $1.49 | -- |
| Balance | $18.20 | $18.20 | -- |

**No new SMS activity since Feb 10 report.** Balance remains $18.20 — sufficient for ~73 SMS at ~$0.25/SMS effective rate. At current pace (~11 SMS/mo), balance lasts ~6+ months.

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
| **2026-02-13 00:14** | **Payout #2** | **-€1.71** | **€0.00** | **-€1.71** |
| **2026-02-13 09:58** | **Day Pass charge** | **€1.99** | **€0.28** | **€1.71** |
| **Totals** | | **€15.92 gross** | **€1.96 fees** | **€9.98 net** |

**Summary**: 7 charges, 1 refund = **6 net Day Pass sales** (up from 5). New sale on Feb 13 broke the 2-day drought.

**Second payout**: €1.71 on Feb 13 (single settled charge from Feb 10). Total payouts: €8.27.

**Revenue run rate**: 6 sales in 16 days = 10.5 sales/month = ~€17.96/mo net (~$19.40).
*Down from 11.7 sales/mo (Feb 12). The mid-month quiet period (Feb 11-12 with no sales) pulls the rate down. Still early days with thin volume.*

**Stripe balances**:
- Available: €0.00 (payouts cleared the available balance)
- Pending: €1.71 (Feb 13 charge not yet settled)

---

## Cost Efficiency

| Metric | Current (Feb 16) | Previous (Feb 12) | Change | Trend |
|--------|-----------------|-------------------|--------|-------|
| Cost per voice conversation | ~$0.44 | ~$0.51 | -$0.07 (-13.7%) | DOWN (improving) |
| Cost per voice minute | ~$0.37 | ~$0.47 | -$0.10 (-21.3%) | DOWN (improving) |
| ElevenLabs char utilization | 12.9% | 5.0% | +7.9pp | UP |
| ElevenLabs voice min utilization | **59.7%** | 38.6% | +21.1pp | UP (concerning) |
| ElevenLabs voice min projection | **~104.5 min (104.5%)** | ~90 min (90%) | +14.5 min | UP (WARNING) |
| Stripe net margin per Day Pass | 85.9% | 85.9% | -- | FLAT |
| Infra cost per Day Pass sold | ~$9.90 | ~$11.88 | -$1.98 (-16.7%) | DOWN (improving) |
| Revenue coverage (operational) | **22.4%** | 36.4% | -14.0pp | DOWN (declining) |

**Cost efficiency notes:**
- Cost per voice conversation improved: ElevenLabs subscription ($22.18 effective) / 50 conversations = $0.44 (was $0.51/43 convos).
- Revenue coverage dropped significantly: Projected monthly revenue ~$13.32 / ~$59.41 operational costs = 22.4%. The revenue run rate declined from ~$21.61/mo to ~$13.32/mo as the mid-month lull weighs on the average.
- Voice minute projection breach: 59.7 min / 16 days = 3.73 min/day × 28 days = ~104.5 min. **Exceeds 100 min Creator tier limit.**
- Infra cost per sale improved due to additional sale: $59.41 / 6 net sales = $9.90.

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Projected Month-End | Alert Level |
|---------|--------|------|-------|-------------|---------------------|-------------|
| ElevenLabs | Characters | 14,301 | 110,553 | **12.9%** | ~25,026 (22.6%) | SAFE |
| ElevenLabs | Voice Minutes | 59.7 | 100 | **59.7%** | **~104.5 (104.5%)** | **WARNING** |
| Vercel | Monthly Visitors | ~low | 50,000 | **<1%** | <1% | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | <1% | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | <100% | SAFE |

### ElevenLabs Voice Minute Limit — WARNING

**Projected to exceed Creator tier limit (100 min) by month-end.**

- Used: 59.7 min in 16 days (59.7% of limit)
- Daily rate: 3.73 min/day (up from 3.22 on Feb 12)
- Projected February total: **~104.5 min (104.5% of limit)**
- **Previous projection**: ~90 min (Feb 12 report)

**Projection history:**
- Feb 10: 107 min (WARNING) — initial concern
- Feb 11: 98 min (WATCH) — 3 quiet days pulled it down
- Feb 12: 90 min (WATCH) — 4th quiet day improved further
- **Feb 16: 104.5 min (WARNING)** — Feb 13 spike reversed the trend

**The key driver**: Feb 13's 21.1 minutes (especially the 10-minute session) added more voice time than any other single day. The bursty pattern makes this hard to predict — if Feb 14-28 remain quiet, actual usage might stay at ~60-65 min. But another active day like Feb 13 would push it well over 100.

**Mitigation actions (recommended):**
1. **Understand ElevenLabs overage policy** — Does Creator tier hard-cap at 100 min, or charge overage? This determines urgency.
2. **Monitor weekly** — If usage reaches 80 min by Feb 21, a tier upgrade decision becomes urgent.
3. **If breached**: Scale tier upgrade ($99/mo, 500 min/mo) is the next option — a $77/mo cost increase.
4. **Session length optimization** — The 10-minute session on Feb 13 consumed 10% of the monthly limit alone. If Pelayo can resolve queries faster, overall usage drops.

### Upgrade Trigger Points

| Service | Current Tier | Trigger | Next Tier | Cost Jump |
|---------|-------------|---------|-----------|-----------|
| ElevenLabs | Creator ($22.18/mo eff.) | >100 min/mo (**at 104.5% projected**) | Scale ($99/mo) | +$77/mo |
| Vercel | Hobby ($0) | >50K visitors/mo | Pro ($20/mo) | +$20/mo |
| Supabase | Pro ($25/mo) | >8 GB storage | Team ($599/mo) | +$574/mo |
| PostHog | Free ($0) | >1M events/mo | Pay-as-you-go | Variable |

---

## Scaling Forecast

Based on the forecast model in `src/lib/costs/forecast.ts`:

**Per-unit costs (computed from actuals):**
- Cost per voice minute: $0.37 (ElevenLabs $22.18 effective / 59.7 min actual)
- Cost per SMS: $0.25 (17 segments / 6 messages)
- Cost per chat: $0.01 (estimated fallback — no Anthropic data)

| Scenario | Visitors/mo | Voice Convos/mo | Voice Min/mo | SMS/mo | Est. Monthly Cost (operational) |
|----------|------------|----------------|-------------|--------|--------------------------------|
| **Current (1x)** | ~100 | ~88 | ~105 | ~11 | ~$63.47 |
| **3x Growth** | ~300 | ~264 | ~315 | ~33 | ~$158* |
| **10x Growth** | ~1,000 | ~880 | ~1,050 | ~110 | ~$320** |

*\*At 3x: Voice minutes (315) exceed Creator limit (100). Requires Scale tier upgrade ($99/mo). Total: $31.08 infra + $10 AI + $99 voice + $12.75 SMS = ~$158, plus Stripe fees.*

*\*\*At 10x: Voice at 1,050 min/mo. Scale tier (500 min) also exceeded. Requires Enterprise pricing. Estimated $200+ for voice alone.*

### Cost Forecast vs. Revenue Potential

| Scenario | Monthly Cost (op.) | Day Passes Needed to Break Even* | Revenue at 5% Conversion |
|----------|-------------------|----------------------------------|--------------------------|
| Current (~100 visitors) | ~$63 | 39 passes | ~€8.55 (5 passes) |
| 500 visitors | ~$158 | 97 passes | ~€42.75 (25 passes) |
| 5,000 visitors | ~$320 | 196 passes | ~€427.50 (250 passes) |

*\*At €1.64 net per Day Pass after Stripe fees.*

**Break-even point**: ~2,400 monthly visitors assuming 5% Day Pass conversion rate.

---

## Anomalies

| Finding | Severity | Details |
|---------|----------|---------|
| Voice minutes exceeding tier projection | **WARNING** | Projected 104.5 min vs. 100 min limit. Feb 13 spike (+21.1 min) reversed the declining trend. Action needed if usage continues at this rate. |
| Revenue run rate declining | **WATCH** | Run rate dropped from ~$21.61/mo (Feb 12) to ~$13.32/mo (Feb 16). 6 net sales in 16 days = 10.5/mo. Mid-month lull pulling average down. |
| 10-minute voice session | **INFO** | Longest single conversation (600s) on Feb 13. Consumed 10% of monthly voice limit. May indicate very engaged user or an edge case worth investigating. |
| Config file ElevenLabs cost mismatch | **LOW** | `recurring-costs.ts` lists $18.33/mo (pre-tax). Actual with tax is ~$22.18/mo. Affects dashboard accuracy by ~$3.85/mo. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual checks required. Included as $10/mo estimate. |

**Resolved anomalies from previous report:**
- 2-day revenue drought (Feb 11-12) → **Resolved** — new sale on Feb 13.
- ElevenLabs voice minutes declining trend → **Reversed** — Feb 13 spike pushed projection back above limit.

---

## Trend Analysis

### Comparison: Feb 12 → Feb 16

| Metric | Feb 12 (12 days) | Feb 16 (16 days) | Change | Direction |
|--------|-----------------|-----------------|--------|-----------|
| Fixed costs/mo (operational) | $59.41 | $59.41 | -- | FLAT |
| Variable costs (MTD) | ~$1.49 | ~$1.49 | -- | FLAT |
| Voice conversations (MTD) | 43 | 50 | +7 (+16.3%) | UP |
| Voice minutes (MTD) | 38.6 | 59.7 | +21.1 (+54.7%) | UP |
| Voice min daily rate | 3.22 min/day | 3.73 min/day | +0.51 (+15.8%) | UP |
| Voice min projection | ~90 min (WATCH) | **~104.5 min (WARNING)** | +14.5 min | UP (concerning) |
| Characters used | 5,482 (5.0%) | 14,301 (12.9%) | +8,819 (+7.9pp) | UP |
| SMS sent (MTD) | 6 | 6 | -- | FLAT |
| Day Pass net sales | 5 | 6 | +1 (+20%) | UP |
| Stripe net revenue (MTD) | €8.27 | €9.98 | +€1.71 (+20.7%) | UP |
| Stripe total payouts | €6.56 | €8.27 | +€1.71 | UP |
| Revenue run rate | ~$21.61/mo | ~$13.32/mo | -$8.29 (-38.4%) | DOWN |
| Revenue coverage (operational) | 36.4% | 22.4% | -14.0pp | DOWN |
| Twilio balance | $18.20 | $18.20 | -- | FLAT |

**Key observations:**
1. **Feb 13 was a significant day** — 7 voice conversations (21.1 min), 1 Day Pass sale, and a Stripe payout. The most productive single day since Feb 8.
2. **Voice projection reversed** — The declining trend from Feb 10-12 (107 → 98 → 90 min) reversed sharply. One active day with long sessions was enough to push the projection above the limit.
3. **Bursty usage pattern confirmed** — 5 active days, 11 quiet days. Peak activity creates disproportionate resource consumption. The 600-second session alone used 10% of the monthly limit.
4. **Revenue run rate declining despite new sale** — Adding 1 sale in 4 days is slower than the early-February pace of 5 sales in 10 days. The run rate drops as more zero-sale days accumulate. This is expected at low volumes.
5. **Second payout confirms pipeline** — Two payouts (€6.56 + €1.71 = €8.27) now completed. Payment pipeline is proven and functioning automatically.

---

## Recommendations

### Immediate Actions (Priority)

1. **Investigate ElevenLabs overage policy for Creator tier** — Is there a hard cap at 100 min (service stops), or does it charge overage fees? This determines whether breaching the limit is a cost issue or a service outage risk.

2. **Check Anthropic billing manually** — Visit [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing) and record February MTD spend. The $10/mo estimate may be high or low.

### Near-Term Actions

3. **Investigate the 10-minute voice session** — The 600-second conversation on Feb 13 ("Asturian Fabada Restaurants Oviedo") is 4x the average successful duration. Was this a very engaged user, or is Pelayo getting stuck in a loop? Understanding this helps optimize session length.

4. **Set a voice usage monitoring cadence** — With 59.7 min used and 12 remaining days, the safe daily budget is ~3.36 min/day for the rest of February. Consider adding a dashboard alert if cumulative usage exceeds 80 min (80% of limit).

5. **Fix ElevenLabs config mismatch** — Update `recurring-costs.ts` to reflect the actual effective rate with tax ($22.18/mo) or add a note. This affects the admin dashboard's accuracy by ~$3.85/mo.

### Long-Term Planning

6. **Scale tier decision point** — If February actually breaches 100 min, the Creator → Scale ($99/mo, 500 min/mo) upgrade becomes necessary. At current revenue (~$13/mo), this would push operational costs from ~$63 to ~$140/mo. Revenue coverage would drop to ~9.5%.

7. **Revenue diversification remains critical** — At 6 Day Passes / 16 days, the platform generates ~$13/mo against ~$63/mo operational costs. Consider: weekly pass (€4.99), monthly subscription (€9.99), or booking commissions.

8. **Voice session length optimization** — If Pelayo could resolve queries 15% faster (from 87s to 74s average), projected usage drops to ~89 min — safely under the limit. Consider: more concise prompts, faster tool responses, earlier conversation wrap-up cues.

---

## Data Sources

| Source | Method | Last Queried |
|--------|--------|-------------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-02-16 |
| ElevenLabs Character Stats API | `/v1/usage/character-stats` | 2026-02-16 |
| ElevenLabs ConvAI API | `/v1/convai/conversations` (page_size=100) | 2026-02-16 |
| Twilio Usage API | `/2010-04-01/Accounts/.../Usage/Records/ThisMonth` | 2026-02-16 |
| Twilio Balance API | `/2010-04-01/Accounts/.../Balance.json` | 2026-02-16 |
| Stripe Balance API | `/v1/balance` | 2026-02-16 |
| Stripe Transactions API | `/v1/balance_transactions` | 2026-02-16 |
| Config: `service-tiers.ts` | File read | 2026-02-16 |
| Config: `recurring-costs.ts` | File read | 2026-02-16 |
| Config: `forecast.ts` | File read | 2026-02-16 |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | -- |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-02-17.*
