# Cost Analyst Report

> **Generated**: 2026-04-15 03:00:00 | **Period**: April 2026 (day 15 of 30) | **Status**: WATCH

---

## Executive Summary

**April mid-month checkpoint — Day 15.** ElevenLabs character count remains frozen at 12,119 (4.48%). Zero new conversations since April 12 07:59 UTC. Fourth consecutive day with no ElevenLabs activity. Character utilization rate continues to decelerate as quiet days accumulate.

**Twilio balance steady at $14.0646** — unchanged for eight consecutive days since the April 7 phone rental. Zero non-zero usage records in April (50 records checked, all $0.00).

**Revenue drought reaches 61 days** (since February 13). **Paisaxe voice silence: 57 days** (since February 17). Zero revenue in April through day 15. Fixed operational costs stable at $84.41/mo. Half the month has passed with zero revenue activity.

**April mid-month checkpoint:** ~$42 burned at the halfway mark with $0 revenue. The Twilio phone number ($1.15–1.39/mo) has been unused for 57 days. Tier downgrades worth evaluating at current dormant scale.

**Financial health: WATCH** — business concern only. No platform cost anomalies. All tier limits well within range.

| Metric | Value | vs. Apr 14 |
|--------|-------|-----------|
| Total Fixed Costs (all) | $284.41/mo | → |
| Total Fixed Costs (operational) | **$84.41/mo** | → |
| Variable Costs (Apr MTD, confirmed) | **$1.15** | → |
| Daily Burn Rate (Apr fixed) | **$2.81/day** | → |
| Revenue (Apr MTD) | **$0.00** | → |
| Twilio Balance | **$14.0646** | → |
| ElevenLabs Characters (cycle) | **12,119 / 270,783 (4.48%)** | → (unchanged) |
| ElevenLabs Voice Min (Paisaxe, Apr) | 0.0 / 100 | → |
| Next Character Reset | **2026-05-07 14:36 UTC** | 22 days |
| Paisaxe Voice Silence | **57 days** | +1 |
| Revenue Drought | **61 days** | +1 |

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

*\*ElevenLabs Creator billed annually. Effective rate $22.18/mo. Next annual invoice: $266.20 on 2027-02-07 (confirmed via subscription API).*

*\*\*Anthropic $10/mo is an estimate from config. No billing API available on personal accounts. Check [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing) manually.*

*\*\*\*Twilio phone number rental charged April 7: balance dropped $15.2146 → $14.0646 (-$1.15). Monthly billing event, expected.*

**Note**: Claude Code Max ($200/mo) is the primary development tool, categorized separately as "Development." Operational cost analysis focuses on running the live service.

### Variable / Usage-Based Costs (April 2026 MTD — Day 15)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Phone rental) | 1 number, April billing | **$1.15** | Balance delta (Apr 7) |
| Twilio (SMS) | 0 messages | $0.00 | API (50 records, 0 non-zero) |
| Twilio (Calls) | 0 minutes | $0.00 | API |
| Stripe (Processing Fees) | 0 charges | $0.00 | — |
| Anthropic (Claude API) | Unknown | Unknown | — |
| Voyage AI (Embeddings) | Unknown | Unknown | — |
| **Total Variable (Apr MTD, confirmed)** | | **$1.15** | |

### April 2026 MTD Total (Day 15)

| Category | Cost |
|----------|------|
| Fixed Operational | $84.41 |
| Variable (confirmed) | $1.15 |
| **Total Operational MTD** | **$85.56** |
| Revenue | $0.00 |
| **Net (loss)** | **-$85.56** |

### March 2026 Final Costs (reference)

| Service | Usage | Cost |
|---------|-------|------|
| Twilio (Phone rental) | 1 number | $1.15 |
| Twilio (SMS) | 0 | $0.00 |
| Stripe (Processing Fees) | 0 | $0.00 |
| **Total Variable (Mar final)** | | **$1.15** |
| **Total Operational (Mar final)** | | **$85.56** |

---

## Usage Metrics

### ElevenLabs Activity — Current Cycle (April 7 14:36 UTC → May 7 14:36 UTC)

**Character count at report time: 12,119 / 270,783 (4.48%).** Unchanged from Apr 13 (3rd consecutive report with no change). Zero new conversations since Apr 12 07:59 UTC. Fourth consecutive day of inactivity (Apr 12 post-08:00, Apr 13, Apr 14, Apr 15).

**Archy failure pattern (unchanged — stale data):** Three consecutive failures across Apr 11–12 remain the most recent signal:
- Apr 11 06:12 UTC — "Generating the LLM response took too long" (30s, 2 messages)
- Apr 11 16:50 UTC — "Generating the LLM response took too long" (32s, 2 messages)
- Apr 12 07:59 UTC — "custom_llm generation failed" (24s, 2 messages)

No new data to assess whether the failure pattern continues or self-resolved.

Last 20 conversations breakdown (unchanged):

| Agent | Count (in last 20) | Most Recent | Status Pattern | Project |
|-------|-------------------|-------------|----------------|---------|
| Archy | **12** | Apr 12 07:59 UTC (failed) | 9 success, 3 failures (25%) | Non-Paisaxe |
| Coach | **8** | Apr 11 06:38 UTC | 4 success, 4 failures (50%) | Non-Paisaxe |
| Pelayo (Visitor Guide) | 0 | Feb 17 | Dormant | Paisaxe |
| Pelayo (Booking) | 0 | Feb 10 | Dormant | Paisaxe |
| Penny, Iris, Xander | 0 | Never | Dormant | Paisaxe |

**All conversations are non-Paisaxe.** Paisaxe agents: **0 conversations since February 17.**

### ElevenLabs Character Usage

| Metric | Value | vs. Apr 14 |
|--------|-------|-----------|
| Characters used (cycle) | **12,119 / 270,783 (4.48%)** | → (unchanged) |
| Character limit | **270,783** | → |
| Next character reset | **2026-05-07 14:36 UTC** | 22 days |
| Characters used (Apr, Paisaxe) | 0 | → |
| Characters remaining this cycle | **258,664** | — |

At cycle-average pace (12,119 chars in ~7.5 days = ~1,616/day), projected cycle total: ~48,500 chars (~17.9%). Rate continues to decelerate as quiet days accumulate (was ~1,809/day on Apr 14, ~2,126/day on Apr 13). Well within the 270,783 Creator limit.

### ElevenLabs Subscription Details (from API — 2026-04-15)

| Field | Value |
|-------|-------|
| Tier | Creator |
| Billing period | Annual |
| Status | Active |
| Next invoice amount | $266.20 |
| Next invoice date | 2027-02-07 |
| Next character reset | **2026-05-07 14:36 UTC** |
| Character limit | **270,783** |

### Twilio Communications

| Metric | Apr 2026 (days 1-15) | Mar 2026 (final) | Change |
|--------|---------------------|-----------------|--------|
| SMS Sent | 0 | 0 | → |
| Calls | 0 | 0 | → |
| Usage Cost | $0.00 | $0.00 | → |
| Phone Rental | **$1.15** (charged Apr 7) | $1.15 | Monthly expected |
| Balance | **$14.0646** | $15.4546 | -$1.40 MTD |

**Twilio balance reconciliation (April):**
- Apr 1 (start): ~$15.4546
- Apr 3-4: -$0.24 (unexplained — likely regulatory surcharge, unresolved from prior reports)
- Apr 7: -$1.15 (phone number rental, confirmed)
- **Apr 15: $14.0646** — stable for 8 consecutive days. ~12.2 months of runway remaining.

### Stripe Revenue

| Metric | Apr 2026 (days 1-15) | Mar 2026 (final) | Feb 2026 (final) |
|--------|---------------------|-----------------|-----------------|
| Net Sales | 0 | 0 | 6 |
| Gross Revenue | $0.00 | $0.00 | $13.93 |
| Net Revenue | $0.00 | $0.00 | $9.98 |

**61-day revenue drought** — No Day Pass sales since February 13. Over two months without revenue.

---

## Cost Efficiency

| Metric | Current (Apr 15) | Previous (Apr 14) | Change | Trend |
|--------|----------------|------------------|--------|-------|
| Fixed operational cost/mo | $84.41 | $84.41 | → | → |
| Daily burn rate (fixed) | **$2.81/day** | $2.81/day | → | → |
| April variable spend (confirmed) | **$1.15** | $1.15 | → | → |
| Cost per voice conversation (Feb actuals) | ~$0.43 | ~$0.43 | → | → |
| Cost per voice minute (Feb actuals) | ~$0.37 | ~$0.37 | → | → |
| ElevenLabs char utilization (cycle) | **4.48%** | 4.48% | → | → |
| ElevenLabs voice min utilization (Paisaxe, Apr) | 0% | 0% | → | → |
| Revenue coverage (operational) | **0%** | 0% | → | → |
| Months of Twilio runway | ~12.2 mo | ~12.2 mo | → | → |

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Alert Level |
|---------|--------|------|-------|-------------|-------------|
| ElevenLabs | Characters (cycle) | 12,119 | 270,783 | **4.48%** | SAFE |
| ElevenLabs | Voice Minutes (Paisaxe, Apr) | 0.0 | 100 | **0%** | SAFE |
| Vercel | Monthly Visitors | ~low | 500,000 (Pro) | **<1%** | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | SAFE |

**All tier alerts cleared.** At current pace (~1,616 chars/day cycle average, decelerating), cycle would end at ~48,500 chars — 17.9% utilization, well within limit.

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
| 61-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. Over two months. Third consecutive zero-revenue billing cycle now past midpoint. |
| 57-day Paisaxe voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Platform dormant to visitors for over 8 weeks. |
| Archy failure pattern (Apr 11–12, stale) | **INFO** | Three consecutive Archy failures with two error types, now followed by 3+ days of silence. Pattern may have self-resolved or Archy usage simply stopped. No new data to evaluate. |
| Twilio $0.24 drop (Apr 3-4, unresolved) | **WATCH** | Balance anomaly not captured in Usage Records API. Likely recurring regulatory surcharge. Stable since Apr 7 rental ($14.0646). Now 12 days unresolved. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Sustained agent activity (triage, coverage, security, docs, performance, localization all running daily) makes $10/mo estimate potentially low. |

**No platform cost-structure anomalies.** All tier limits safe.

---

## Trend Analysis

### Comparison: Apr 14 → Apr 15

| Metric | Apr 14 (03:00 UTC) | Apr 15 (03:00 UTC) | Change | Direction |
|--------|------|------|--------|-----------|
| Fixed costs/mo (operational) | $84.41 | $84.41 | → | → |
| Variable costs (confirmed MTD) | $1.15 | $1.15 | → | → |
| Daily burn rate (fixed) | $2.81/day | $2.81/day | → | → |
| ElevenLabs characters | 12,119 (4.48%) | **12,119 (4.48%)** | → (unchanged, day 3) | → |
| Most recent ElevenLabs convo | Apr 12 07:59 UTC | Apr 12 07:59 UTC (unchanged) | No new activity | — |
| Archy failure rate (last 20) | 3/12 (25%) | 3/12 (25%) | → (no new data) | — |
| Paisaxe voice conversations (MTD) | 0 | 0 | → | → |
| Twilio balance | $14.0646 | $14.0646 | → (8th day) | → |
| SMS sent (MTD) | 0 | 0 | → | → |
| Day Pass net sales (MTD) | 0 | 0 | → | → |
| Paisaxe voice dormancy streak | 56 days | **57 days** | +1 | down |
| Revenue drought streak | 60 days | **61 days** | +1 | down |
| Next ElevenLabs reset | 23 days | **22 days** | -1 | approaching |
| Char utilization daily rate | ~1,809/day | **~1,616/day** | -10.7% | ↓ (decelerating) |
| Projected cycle-end chars | ~54,300 (20.0%) | **~48,500 (17.9%)** | -2.1pp | ↓ |

**Key observations:**

1. **April mid-month checkpoint.** Half the month has passed with $0 revenue and ~$42 burned (prorated). At $2.81/day fixed burn, April will close at ~$85.56 operational — identical to March. Third consecutive zero-revenue month virtually certain.

2. **Revenue drought passes 61 days.** Over two full months since the last Day Pass sale (Feb 13). February's $9.98 net revenue remains the only revenue in the project's operational history. Cumulative operational loss since Feb 2026: ~$300+.

3. **ElevenLabs utilization continues to decelerate.** With 4 consecutive quiet days, the daily average has dropped from ~2,126/day (Apr 13) → ~1,809/day (Apr 14) → ~1,616/day (Apr 15). Projected cycle-end: ~17.9% (down from ~20.0% yesterday). The Apr 9 burst is now 6 days old and fading rapidly from the average.

4. **Twilio balance stability streak extends to 8 days.** No activity since the Apr 7 phone rental. The $0.24 anomaly from Apr 3-4 remains the only unexplained cost event this month, now 12 days without resolution.

5. **All metrics completely static.** Every data point is a carry-forward from yesterday. No new ElevenLabs conversations, no Twilio activity, no revenue. Quietest period in the project's history.

### Monthly Cost History

| Month | Operational Fixed | Variable (confirmed) | Total Operational | Revenue (net) | Coverage |
|-------|------------------|----------------------|-------------------|---------------|----------|
| Feb 2026 | $84.41 | ~$2.75 | ~$87.16 | ~$9.98 | ~11.4% |
| Mar 2026 (final) | $84.41 | $1.15 | **$85.56** | **$0.00** | **0%** |
| Apr 2026 (day 15) | $84.41 | $1.15 | **$85.56** | $0.00 | 0% |

---

## Recommendations

### Immediate Actions (Priority)

1. **Check Anthropic billing manually** — Visit [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing). Daily automated agents (security, coverage, performance, cost-analyst, localization, docs, QA, triage) plus Claude Code Max development activity may push actual usage well above the $10/mo config estimate. The Max plan Claude Code usage is separate ($200/mo), but API-based agent runs accrue to the Anthropic account.

2. **Investigate the revenue and voice drought — 61 days is critical** — Over two full months with no revenue. Priority unchanged:
   - Is the Pelayo voice widget rendering and accessible on production?
   - Is the Day Pass purchase flow functional end-to-end?
   - Are Vercel deployment logs showing errors on production requests?
   - Has organic traffic dropped? (PostHog / Vercel Analytics)
   - QA Agent confirms browser journeys pass E2E (as of Mar 23) — production behavior for paying flows remains unverified.

3. **Resolve the Twilio $0.24 anomaly** — Check Twilio billing history at https://console.twilio.com for April 3-4. Likely a US local number regulatory surcharge (~$0.24/mo). If confirmed recurring, update `recurring-costs.ts` to reflect ~$1.39/mo Twilio cost instead of $1.15/mo. Anomaly is now 12 days old without resolution.

### Mid-Month Cost Reduction Evaluation

4. **Evaluate Twilio phone number** — 57 days without a booking call. $1.15–1.39/mo unused. Consider releasing the number unless bookings are expected to resume. ~$14/yr savings.

5. **Review Vercel Pro and Supabase Pro** — At current dormant scale (~50 visitors/mo), both Pro tiers may be overprovisioned:
   - Vercel Pro ($20/mo) — Hobby tier is free for personal projects with limited bandwidth. Evaluate if Pro features (analytics, serverless concurrency) are needed.
   - Supabase Pro ($25/mo) — Free tier includes 500MB storage and 50K monthly active users. Evaluate if Pro features (8GB, daily backups, email support) are needed at current scale.
   - Combined potential savings: up to $45/mo (~53% of operational costs).

### Long-Term Planning

6. **Revenue trajectory is critical** — Three consecutive near-zero or zero-revenue months. At $84.41/mo operational with $0 revenue: ~$2.81/day in losses. Break-even requires ~3,150 monthly visitors at 5% Day Pass conversion — 63x current traffic. Cumulative operational loss since Feb 2026: ~$300. The platform requires a growth event or cost reduction to achieve sustainability.

7. **ElevenLabs remains well-sized** — Creator tier at $22.18/mo effective (annual). Projected cycle utilization now ~17.9%, down from ~20.0% yesterday. Well within the 270,783 char limit. Scale tier ($99/mo) only needed if sustained Paisaxe voice traffic exceeds 100 min/mo — currently at 0 min.

---

## Data Sources

| Source | Method | Last Queried | Status |
|--------|--------|-------------|--------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-04-15 03:00 UTC | ✅ OK |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=20` | 2026-04-15 03:00 UTC | ✅ OK (0 new since Apr 12) |
| Twilio Balance API | `/Balance.json` | 2026-04-15 03:00 UTC | ✅ OK |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json` | 2026-04-15 03:00 UTC | ✅ OK (0 non-zero of 50 records) |
| Config: `service-tiers.ts` | File read | 2026-04-15 | ✅ OK |
| Config: `recurring-costs.ts` | File read | 2026-04-15 | ✅ OK |
| Config: `forecast.ts` | File read | 2026-04-15 | ✅ OK |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | — | ⚠️ Manual check required |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-04-16.*
