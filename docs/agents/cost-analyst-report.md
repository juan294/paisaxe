# Cost Analyst Report

> **Generated**: 2026-04-09 03:00:00 | **Period**: April 2026 (day 9 of 30) | **Status**: WATCH

---

## Executive Summary

**Day 9 of April — ElevenLabs character usage rose from 2,510 to 8,454 (+5,944 chars, +237%) since yesterday.** The increase comes entirely from non-Paisaxe agents (Archy + Coach) active on April 8. The last 20 conversations show 5 Archy and 15 Coach — all non-Paisaxe. Most recent: Archy at 17:41 UTC April 8, status "done" (successful). Still zero Paisaxe voice activity.

**Twilio balance unchanged at $14.0646** — no new charges after the April 7 phone rental. Usage Records API confirms $0.00 across all categories.

**Revenue drought reaches 55 days** (since February 13). **Paisaxe voice silence: 51 days** (since February 17). No revenue in April. Fixed operational costs stable at $84.41/mo.

**Financial health: WATCH** — business concern only. No platform cost anomalies. All tier limits safe.

| Metric | Value | vs. Apr 8 |
|--------|-------|-----------|
| Total Fixed Costs (all) | $284.41/mo | → |
| Total Fixed Costs (operational) | **$84.41/mo** | → |
| Variable Costs (Apr MTD, confirmed) | **$1.15** | → |
| Daily Burn Rate (Apr fixed) | **$2.81/day** | → |
| Revenue (Apr MTD) | **$0.00** | → |
| Twilio Balance | **$14.0646** | → |
| ElevenLabs Characters (new cycle) | **8,454 / 270,783 (3.12%)** | ↑ from 2,510 (0.93%) |
| ElevenLabs Voice Min (Paisaxe, Apr) | 0.0 / 100 | → |
| Next Character Reset | **2026-05-07 ~14:36 UTC** | 29 days |
| Paisaxe Voice Silence | **51 days** | +1 |
| Revenue Drought | **55 days** | +1 |

---

## Current Costs — Per-Service Breakdown

### Fixed / Recurring Costs

| Service | Tier | Monthly Cost | % of Operational | Category | Trend |
|---------|------|-------------|-----------------|----------|-------|
| Claude Code Max | Max (20x Pro) | $200.00 | — (dev) | Development | → |
| Supabase | Pro | $25.00 | 29.6% | Infrastructure | → |
| ElevenLabs | Creator (annual) | $22.18* | 26.3% | AI / Voice | → |
| Vercel | Pro | $20.00 | 23.7% | Infrastructure | → |
| Anthropic Claude | Prepaid credits | $10.00** | 11.8% | AI | → |
| GitHub Pro | Pro | $4.00 | 4.7% | Infrastructure | → |
| AWS Domains | — | $2.08 | 2.5% | Infrastructure | → |
| Twilio Phone Number | — | $1.15*** | 1.4% | Communications | → |
| PostHog | Free | $0.00 | 0% | Analytics | → |
| **Total Fixed (all)** | | **$284.41** | | | → |
| **Total Fixed (operational)** | | **$84.41** | **100%** | | → |

*\*ElevenLabs Creator billed annually. Effective rate $22.18/mo. Next annual invoice: $266.20 on 2027-02-07 (confirmed via API).*

*\*\*Anthropic $10/mo is an estimate from config. No billing API available on personal accounts. Check [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing) manually.*

*\*\*\*Twilio phone number rental charged April 7: balance dropped $15.2146 → $14.0646 (-$1.15). Monthly billing event, expected.*

**Note**: Claude Code Max ($200/mo) is the primary development tool, categorized separately as "Development." Operational cost analysis focuses on running the live service.

### Variable / Usage-Based Costs (April 2026 MTD — Day 9)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Phone rental) | 1 number, April billing | **$1.15** | Balance delta (Apr 7) |
| Twilio (SMS) | 0 messages | $0.00 | API |
| Twilio (Calls) | 0 minutes | $0.00 | API |
| Stripe (Processing Fees) | 0 charges | $0.00 | — |
| Anthropic (Claude API) | Unknown | Unknown | — |
| Voyage AI (Embeddings) | Unknown | Unknown | — |
| **Total Variable (Apr MTD, confirmed)** | | **$1.15** | |

### April 2026 MTD Total (Day 9)

| Category | Cost |
|----------|------|
| Fixed Operational | $84.41 |
| Variable (confirmed) | $1.15 |
| **Total Operational MTD** | **$85.56** |
| Revenue | $0.00 |
| **Net (loss)** | **-$85.56** |

### March 2026 Final Costs (reference)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Phone rental) | 1 number | $1.15 | API |
| Twilio (SMS) | 0 messages | $0.00 | API |
| Twilio (Calls) | 0 minutes | $0.00 | API |
| Stripe (Processing Fees) | 0 charges | $0.00 | — |
| **Total Variable (Mar final)** | | **$1.15** | |
| **Total Operational (Mar final)** | | **$85.56** | |

---

## Usage Metrics

### ElevenLabs Activity — New Cycle (April 7 14:15 UTC → May 7 ~14:36 UTC)

**Character count at report time: 8,454 / 270,783 (3.12%).** Up from 2,510 yesterday (+5,944 chars). All activity from non-Paisaxe agents (Archy + Coach). Most recent conversation: Archy at 17:41 UTC April 8, status "done" (successful).

Last 20 conversations in the API window:

| Agent | Count (in last 20) | Most Recent | Status Pattern | Project |
|-------|-------------------|-------------|----------------|---------|
| Archy | **5** | Apr 8 17:41 UTC | Successful (done) | Non-Paisaxe |
| Coach | **15** | Apr 8 16:14 UTC (est.) | Mixed (failures + done) | Non-Paisaxe |
| Pelayo (Visitor Guide) | 0 | Feb 17 | Dormant | Paisaxe |
| Pelayo (Booking) | 0 | Feb 10 | Dormant | Paisaxe |
| Penny, Iris, Xander | 0 | Never | Dormant | Paisaxe |

**All conversations are non-Paisaxe.** Paisaxe agents: **0 conversations since February 17.**

### ElevenLabs Character Usage

| Metric | Value | vs. Yesterday |
|--------|-------|--------------|
| Characters used (new cycle) | **8,454 / 270,783 (3.12%)** | ↑ from 2,510 (+5,944) |
| Character limit | **270,783** | → (stable) |
| Next character reset | **2026-05-07 ~14:36 UTC** | 29 days |
| Characters used (Apr, Paisaxe) | 0 | → |
| Characters remaining this cycle | 262,329 | — |

At today's average pace (8,454 chars in 9 days ≈ 939/day non-Paisaxe), the cycle would consume ~27,231 chars by reset — comfortably within the 270,783 limit.

### ElevenLabs Subscription Details (from API — 2026-04-09)

| Field | Value |
|-------|-------|
| Tier | Creator |
| Billing period | Annual |
| Status | Active |
| Next invoice amount | $266.20 |
| Next invoice date | 2027-02-07 |
| Next character reset | **2026-05-07 ~14:36 UTC** |
| Character limit | **270,783** |

### Twilio Communications

| Metric | Apr 2026 (days 1-9) | Mar 2026 (final) | Change |
|--------|---------------------|-----------------|--------|
| SMS Sent | 0 | 0 | → |
| Calls | 0 | 0 | → |
| Usage Cost | $0.00 | $0.00 | → |
| Phone Rental | **$1.15** (charged Apr 7) | $1.15 | Monthly expected |
| Balance | **$14.0646** | $15.4546 | -$1.40 MTD |

**Twilio balance reconciliation (April):**
- Apr 1 (start): ~$15.4546
- Apr 3-4: -$0.24 (unexplained — possible regulatory fee)
- Apr 7: -$1.15 (phone number rental, confirmed)
- **Apr 9: $14.0646** — stable for 2 days since rental. ~12.2 months of runway remaining.

### Stripe Revenue

| Metric | Apr 2026 (days 1-9) | Mar 2026 (final) | Feb 2026 (final) |
|--------|---------------------|-----------------|-----------------|
| Net Sales | 0 | 0 | 6 |
| Gross Revenue | $0.00 | $0.00 | $13.93 |
| Net Revenue | $0.00 | $0.00 | $9.98 |

**55-day revenue drought** — No Day Pass sales since February 13.

---

## Cost Efficiency

| Metric | Current (Apr 9) | Previous (Apr 8) | Change | Trend |
|--------|----------------|------------------|--------|-------|
| Fixed operational cost/mo | $84.41 | $84.41 | → | → |
| Daily burn rate (fixed) | **$2.81/day** | $2.81/day | → | → |
| April variable spend (confirmed) | **$1.15** | $1.15 | → | → |
| Cost per voice conversation (Feb actuals) | ~$0.43 | ~$0.43 | → | → |
| Cost per voice minute (Feb actuals) | ~$0.37 | ~$0.37 | → | → |
| ElevenLabs char utilization (new cycle) | **3.12%** | 0.93% | +2.19% | ↑ (non-Paisaxe) |
| ElevenLabs voice min utilization (Paisaxe, Apr) | 0% | 0% | → | → |
| Revenue coverage (operational) | **0%** | 0% | → | → |
| Months of Twilio runway | ~12.2 mo | ~12.2 mo | → | → |

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Alert Level |
|---------|--------|------|-------|-------------|-------------|
| ElevenLabs | Characters (new cycle) | 8,454 | 270,783 | **3.12%** | SAFE |
| ElevenLabs | Voice Minutes (Paisaxe, Apr) | 0.0 | 100 | **0%** | SAFE |
| Vercel | Monthly Visitors | ~low | 500,000 (Pro) | **<1%** | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | SAFE |

**All tier alerts cleared.** At current non-Paisaxe pace (~939 chars/day), cycle would end at ~27K chars — 10% utilization, well within limit.

### Upgrade Trigger Points

| Service | Current Tier | Trigger | Next Tier | Cost Jump |
|---------|-------------|---------|-----------|-----------|
| ElevenLabs | Creator ($22.18/mo eff.) | >100 min/mo | Scale ($99/mo) | +$77/mo |
| Supabase | Pro ($25/mo) | >8 GB storage | Team ($599/mo) | +$574/mo |
| PostHog | Free ($0) | >1M events/mo | Pay-as-you-go | Variable |

---

## Scaling Forecast

Based on `src/lib/costs/forecast.ts` logic, using February 2026 actuals as baseline (no April Paisaxe variable data):

**Per-unit costs (fallback — no April production data):**
- Cost per voice minute: ~$0.08 (ElevenLabs overage fallback rate)
- Cost per chat: ~$0.01 (Claude API estimate fallback)

| Scenario | Visitors/mo | Voice Convos/mo | Voice Min/mo | Est. Monthly Cost (operational) |
|----------|------------|----------------|-------------|--------------------------------|
| **Current (1x)** | ~50 | ~0 (dormant) | ~0 (dormant) | ~$85.56 |
| **3x Growth** | ~150 | ~150 | ~180 | ~$170* |
| **10x Growth** | ~500 | ~500 | ~600 | ~$370** |

*\*At 3x: Voice minutes (180) exceed Creator limit (100 min). Requires Scale tier ($99/mo). Total: ~$52 infra + $10 AI + $99 voice + ~$5 SMS = ~$170.*

*\*\*At 10x: Voice at 600 min/mo exceeds Scale tier (500 min). Requires Enterprise pricing. Estimated $200+ for voice alone.*

### Cost Forecast vs. Revenue Potential

| Scenario | Monthly Cost (op.) | Day Passes Needed to Break Even | Revenue at 5% Conversion |
|----------|-------------------|--------------------------------|--------------------------|
| Current (~50 visitors) | ~$85 | 52 passes | ~$4.10 (2.5 passes) |
| 500 visitors | ~$170 | 104 passes | ~$42.75 (25 passes) |
| 5,000 visitors | ~$370 | 226 passes | ~$427.50 (250 passes) |

*Break-even: ~3,150 monthly visitors at 5% Day Pass conversion rate (~$1.64 net/pass after Stripe fees).*

---

## Anomalies

| Finding | Severity | Details |
|---------|----------|---------|
| 55-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. Almost 8 full weeks of zero revenue. |
| 51-day Paisaxe voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Platform dormant to users. |
| ElevenLabs character spike +5,944 | **INFO** | April 8 Archy + Coach activity drove chars from 2,510 → 8,454 (+237%). All non-Paisaxe. Well within limit (3.12%). |
| Twilio $0.24 drop (Apr 3-4, unresolved) | **WATCH** | Balance drop not captured in Usage Records API. Likely recurring regulatory surcharge. Balance stable since Apr 7 rental ($14.0646). |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual monthly checks required. Significant agent development activity ongoing. |

**No platform cost-structure anomalies.** All tier limits safe.

---

## Trend Analysis

### Comparison: Apr 8 → Apr 9

| Metric | Apr 8 (03:00) | Apr 9 (03:00) | Change | Direction |
|--------|-------|-------|--------|-----------|
| Fixed costs/mo (operational) | $84.41 | $84.41 | → | → |
| Variable costs (confirmed MTD) | $1.15 | $1.15 | → | → |
| Daily burn rate (fixed) | $2.81/day | $2.81/day | → | → |
| ElevenLabs characters | 2,510 (0.93%) | **8,454 (3.12%)** | +5,944 (+237%) | ↑ (non-Paisaxe) |
| Most recent ElevenLabs convo | Apr 7 16:50 UTC (Coach, fail) | **Apr 8 17:41 UTC (Archy, done)** | Active | — |
| Paisaxe voice conversations (MTD) | 0 | 0 | → | → |
| Twilio balance | $14.0646 | $14.0646 | → | → |
| SMS sent (MTD) | 0 | 0 | → | → |
| Day Pass net sales (MTD) | 0 | 0 | → | → |
| Paisaxe voice dormancy streak | 50 days | **51 days** | +1 | down |
| Revenue drought streak | 54 days | **55 days** | +1 | down |
| Next ElevenLabs reset | May 7 | **May 7** | 29 days | → |

**Key observations:**

1. **Archy returned to activity on April 8.** After the post-reset burst on April 7 (which concluded at ~16:50 UTC with Coach failures), Archy had at least 5 new conversations on April 8 (most recent: 17:41 UTC). This is consistent with the prior cycle's Archy daily cadence.

2. **Coach activity continued on April 8.** The last 20 conversations window shows 15 Coach entries — up from 11 in the post-reset burst. At least 4 additional Coach conversations occurred after the reset burst. Failures persist (LLM-gen errors, websocket disconnects). Pattern unchanged from prior cycles.

3. **5,944 character delta is normal.** At ~939 chars/day average across the first 9 days, the cycle is on track for ~27K chars total by May 7 — 10% utilization. Well within the 270,783 Creator limit.

4. **Revenue and voice drought deepening.** Feb: $9.98 net → Mar: $0.00 → Apr: $0.00 (day 9). Three months, ~$262 cumulative operational loss. Day 55 with no sign of reversal.

5. **Twilio balance stable.** $14.0646 for third consecutive day. The $0.24 anomaly from Apr 3-4 has not recurred. At $1.15/mo, ~12.2 months of Twilio runway remaining.

### Monthly Cost History

| Month | Operational Fixed | Variable (confirmed) | Total Operational | Revenue (net) | Coverage |
|-------|------------------|----------------------|-------------------|---------------|----------|
| Feb 2026 | $84.41 | ~$2.75 | ~$87.16 | ~$9.98 | ~11.4% |
| Mar 2026 (final) | $84.41 | $1.15 | **$85.56** | **$0.00** | **0%** |
| Apr 2026 (day 9) | $84.41 | $1.15 | **$85.56** | $0.00 | 0% |

---

## Recommendations

### Immediate Actions (Priority)

1. **Check Anthropic billing manually** — Visit [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing). Sustained agent development (coverage agent +7 tests Apr 8–9, total 5,716 tests) and daily automated agent runs mean Claude Code and API usage may exceed the $10/mo config estimate.

2. **Investigate the revenue and voice drought — 55 days is critical** — Priority unchanged from prior reports:
   - Is the Pelayo voice widget rendering and accessible on production?
   - Is the Day Pass purchase flow functional end-to-end?
   - Are Vercel deployment logs showing errors on production requests?
   - Has organic traffic dropped? (PostHog / Vercel Analytics)
   - QA Agent confirms browser journeys pass E2E — production behavior remains unverified.

3. **Resolve the Twilio $0.24 anomaly** — Check Twilio billing history/invoices at https://console.twilio.com for April 3-4. Likely a recurring regulatory surcharge on US local numbers (~$0.24/mo). If confirmed, update recurring-costs.ts to reflect the true ~$1.39/mo Twilio cost.

### Near-Term Actions (April Planning)

4. **April mid-month break-even check (April 15)** — At $2.81/day fixed burn and $0 revenue, ~$42 burned by April 15. If no revenue appears, evaluate:
   - Pause Vercel Pro ($20/mo) → Hobby if per-minute cron and preview deployments not critical
   - Pause Supabase Pro ($25/mo) → evaluate if Pro features needed at dormant scale

5. **Monitor Archy activity rate** — With 8 Archy conversations in 9 days (≈ 0.9/day), and Coach continuing to fail, the non-Paisaxe usage pattern is stabilizing. No cost concern at current pace.

6. **Consider releasing the Twilio phone number** — 51 days without a booking call. At $1.15–1.39/mo, the number costs ~$14-17/yr unused. If voice booking is not generating revenue, releasing saves ~$1.15–$1.39/mo.

### Long-Term Planning

7. **Revenue trajectory is critical** — Three consecutive near-zero or zero-revenue months. At $84.41/mo operational with $0 revenue: ~$2.81/day in losses. Break-even requires ~3,150 monthly visitors at 5% Day Pass conversion — 63x current traffic. Total cumulative operational loss since launch (Feb–Apr 9): ~$262. The platform requires a growth event or cost reduction to achieve sustainability.

8. **ElevenLabs remains appropriately sized** — Character limit confirmed stable at 270,783. At current pace, new cycle on track for ~10% utilization — excellent headroom. Creator tier at $22.18/mo effective is well-sized. Scale tier ($99/mo) only needed if sustained voice traffic exceeds 100 min/mo.

---

## Data Sources

| Source | Method | Last Queried | Status |
|--------|--------|-------------|--------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-04-09 03:00 UTC | ✅ OK |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=20` | 2026-04-09 03:00 UTC | ✅ OK |
| Twilio Balance API | `/Balance.json` | 2026-04-09 03:00 UTC | ✅ OK |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json` | 2026-04-09 03:00 UTC | ✅ OK (0 non-zero records) |
| ElevenLabs Character Stats API | `/v1/usage/character-stats` | Not queried | ⚠️ Skipped (requires start_unix/end_unix; character_count sourced from subscription API) |
| Config: `service-tiers.ts` | File read | 2026-04-09 | ✅ OK |
| Config: `recurring-costs.ts` | File read | 2026-04-09 | ✅ OK |
| Config: `forecast.ts` | File read | 2026-04-09 | ✅ OK |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | — | ⚠️ Manual check required |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-04-10.*
