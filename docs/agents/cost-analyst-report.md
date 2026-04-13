# Cost Analyst Report

> **Generated**: 2026-04-13 03:00:00 | **Period**: April 2026 (day 13 of 30) | **Status**: WATCH

---

## Executive Summary

**Day 13 of April — ElevenLabs character count rose to 12,119 (4.48%), up from 11,963 (4.42%) on Apr 12 (+156 chars).** One new conversation on April 12: an Archy failure at 08:00 UTC with "custom_llm generation failed" — a different error mode from the Apr 11 LLM timeout failures. No activity on April 12 after 08:00 UTC or on April 13.

**Twilio balance steady at $14.0646** — unchanged for six consecutive days since the April 7 phone rental. Zero non-zero usage records in April (50 records checked, all $0.00).

**Revenue drought reaches 59 days** (since February 13). **Paisaxe voice silence: 55 days** (since February 17). Zero revenue in April through day 13. Fixed operational costs stable at $84.41/mo.

**Archy failure pattern worsening:** Three consecutive Archy failures across Apr 11–12 with two different error types: "Generating the LLM response took too long" (×2 on Apr 11) and "custom_llm generation failed" (×1 on Apr 12). Archy failure rate in the last 20 conversations: 3/12 (25%), up from 2/12 (17%) yesterday. Not a Paisaxe cost concern, but indicates broader ElevenLabs/LLM reliability issues.

**Financial health: WATCH** — business concern only. No platform cost anomalies. All tier limits well within range.

| Metric | Value | vs. Apr 12 |
|--------|-------|-----------|
| Total Fixed Costs (all) | $284.41/mo | → |
| Total Fixed Costs (operational) | **$84.41/mo** | → |
| Variable Costs (Apr MTD, confirmed) | **$1.15** | → |
| Daily Burn Rate (Apr fixed) | **$2.81/day** | → |
| Revenue (Apr MTD) | **$0.00** | → |
| Twilio Balance | **$14.0646** | → |
| ElevenLabs Characters (cycle) | **12,119 / 270,783 (4.48%)** | ↑ from 11,963 (4.42%) |
| ElevenLabs Voice Min (Paisaxe, Apr) | 0.0 / 100 | → |
| Next Character Reset | **2026-05-07 14:36 UTC** | 24 days |
| Paisaxe Voice Silence | **55 days** | +1 |
| Revenue Drought | **59 days** | +1 |

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

### Variable / Usage-Based Costs (April 2026 MTD — Day 13)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Phone rental) | 1 number, April billing | **$1.15** | Balance delta (Apr 7) |
| Twilio (SMS) | 0 messages | $0.00 | API (50 records, 0 non-zero) |
| Twilio (Calls) | 0 minutes | $0.00 | API |
| Stripe (Processing Fees) | 0 charges | $0.00 | — |
| Anthropic (Claude API) | Unknown | Unknown | — |
| Voyage AI (Embeddings) | Unknown | Unknown | — |
| **Total Variable (Apr MTD, confirmed)** | | **$1.15** | |

### April 2026 MTD Total (Day 13)

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

**Character count at report time: 12,119 / 270,783 (4.48%).** Up from 11,963 on Apr 12 (+156 chars). All activity from non-Paisaxe agents. New since last report: 1 conversation on April 12 (Archy, failed). No activity on April 12 after 08:00 UTC or on April 13.

**Archy failure pattern escalating:** Three consecutive Archy failures across two days with two distinct error types:
- Apr 11 06:12 UTC — "Generating the LLM response took too long" (30s, 2 messages)
- Apr 11 16:50 UTC — "Generating the LLM response took too long" (32s, 2 messages)
- Apr 12 07:59 UTC — "custom_llm generation failed" (24s, 2 messages) ← **NEW**

The Apr 12 failure uses a different error message ("custom_llm generation failed") compared to the Apr 11 timeouts. Both error types indicate LLM backend issues, but the different termination reason suggests distinct failure mechanisms. All three failures had only 2 messages (essentially the initial exchange failed). Prior to Apr 11, the Apr 9 burst had 6 successful Archy conversations.

Last 20 conversations breakdown:

| Agent | Count (in last 20) | Most Recent | Status Pattern | Project |
|-------|-------------------|-------------|----------------|---------|
| Archy | **12** | Apr 12 07:59 UTC (1 new failure) | Mixed: 9 success, 3 failures (25%) | Non-Paisaxe |
| Coach | **8** | Apr 11 06:38 UTC (unchanged) | Mixed: 3 success, 5 failures (62.5%) | Non-Paisaxe |
| Pelayo (Visitor Guide) | 0 | Feb 17 | Dormant | Paisaxe |
| Pelayo (Booking) | 0 | Feb 10 | Dormant | Paisaxe |
| Penny, Iris, Xander | 0 | Never | Dormant | Paisaxe |

**All conversations are non-Paisaxe.** Paisaxe agents: **0 conversations since February 17.**

**New conversations since April 12 03:00 UTC:**
1. 2026-04-12 07:59 UTC — Archy (failed, 24s): "Project Information Request" — custom_llm generation failed

### ElevenLabs Character Usage

| Metric | Value | vs. Apr 12 |
|--------|-------|-----------|
| Characters used (cycle) | **12,119 / 270,783 (4.48%)** | ↑ from 11,963 (+156) |
| Character limit | **270,783** | → |
| Next character reset | **2026-05-07 14:36 UTC** | 24 days |
| Characters used (Apr, Paisaxe) | 0 | → |
| Characters remaining this cycle | **258,664** | — |

At cycle-average pace (12,119 chars in 5.7 days = ~2,126/day), projected cycle total: ~63,800 chars (~23.6%). Activity is decelerating from the Apr 9 burst — daily rate dropping from ~2,640/day (Apr 12 report) to ~2,126/day now. Either scenario well within the 270,783 Creator limit.

### ElevenLabs Subscription Details (from API — 2026-04-13)

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

| Metric | Apr 2026 (days 1-13) | Mar 2026 (final) | Change |
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
- **Apr 13: $14.0646** — stable for 6 consecutive days. ~12.2 months of runway remaining.

### Stripe Revenue

| Metric | Apr 2026 (days 1-13) | Mar 2026 (final) | Feb 2026 (final) |
|--------|---------------------|-----------------|-----------------|
| Net Sales | 0 | 0 | 6 |
| Gross Revenue | $0.00 | $0.00 | $13.93 |
| Net Revenue | $0.00 | $0.00 | $9.98 |

**59-day revenue drought** — No Day Pass sales since February 13.

---

## Cost Efficiency

| Metric | Current (Apr 13) | Previous (Apr 12) | Change | Trend |
|--------|----------------|------------------|--------|-------|
| Fixed operational cost/mo | $84.41 | $84.41 | → | → |
| Daily burn rate (fixed) | **$2.81/day** | $2.81/day | → | → |
| April variable spend (confirmed) | **$1.15** | $1.15 | → | → |
| Cost per voice conversation (Feb actuals) | ~$0.43 | ~$0.43 | → | → |
| Cost per voice minute (Feb actuals) | ~$0.37 | ~$0.37 | → | → |
| ElevenLabs char utilization (cycle) | **4.48%** | 4.42% | +0.06% | ↑ (non-Paisaxe) |
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

**All tier alerts cleared.** At current pace (~2,126 chars/day cycle average), cycle would end at ~63,800 chars — 23.6% utilization, well within limit. Rate decelerating as the Apr 9 burst effect fades.

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
| 59-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. Over 8 full weeks of zero revenue. Third consecutive zero-revenue billing cycle approaching completion. |
| 55-day Paisaxe voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Platform dormant to visitors. |
| Archy failure escalation (Apr 11–12) | **INFO** | Three consecutive Archy failures with two different error types: "LLM response took too long" (×2, Apr 11) and "custom_llm generation failed" (×1, Apr 12). Failure rate: 3/12 (25%), up from 0% on Apr 9. No Paisaxe cost impact, but indicates LLM backend instability. |
| Twilio $0.24 drop (Apr 3-4, unresolved) | **WATCH** | Balance anomaly not captured in Usage Records API. Likely recurring regulatory surcharge. Stable since Apr 7 rental ($14.0646). Now 10 days unresolved. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Sustained agent activity (triage, coverage, security, docs, performance, localization all running daily) makes $10/mo estimate potentially low. |

**No platform cost-structure anomalies.** All tier limits safe.

---

## Trend Analysis

### Comparison: Apr 12 → Apr 13

| Metric | Apr 12 (03:00 UTC) | Apr 13 (03:00 UTC) | Change | Direction |
|--------|------|------|--------|-----------|
| Fixed costs/mo (operational) | $84.41 | $84.41 | → | → |
| Variable costs (confirmed MTD) | $1.15 | $1.15 | → | → |
| Daily burn rate (fixed) | $2.81/day | $2.81/day | → | → |
| ElevenLabs characters | 11,963 (4.42%) | **12,119 (4.48%)** | +156 (+1.3%) | ↑ (1 new convo) |
| Most recent ElevenLabs convo | Apr 11 16:50 UTC (Archy failed) | **Apr 12 07:59 UTC (Archy failed)** | +1 convo | — |
| Archy failure rate (last 20) | 2/12 (17%) | **3/12 (25%)** | +1 failure (+8pp) | ↑ concern |
| Archy failure types | 1 type (LLM timeout) | **2 types** (timeout + custom_llm) | +1 error type | ↑ concern |
| Paisaxe voice conversations (MTD) | 0 | 0 | → | → |
| Twilio balance | $14.0646 | $14.0646 | → | → (6th day) |
| SMS sent (MTD) | 0 | 0 | → | → |
| Day Pass net sales (MTD) | 0 | 0 | → | → |
| Paisaxe voice dormancy streak | 54 days | **55 days** | +1 | down |
| Revenue drought streak | 58 days | **59 days** | +1 | down |
| Next ElevenLabs reset | 25 days | **24 days** | -1 | approaching |

**Key observations:**

1. **Archy failure pattern worsening.** Third consecutive failure on Apr 12, now with a different error type ("custom_llm generation failed" vs prior "LLM response took too long"). Failure rate climbed from 0% (Apr 9 burst) to 25% (3/12 in last 20). The two distinct error messages suggest the issue isn't a single transient backend problem. Coach agent shows even worse reliability (5/8 = 62.5% failure rate in last 20) — mostly older "custom_llm" failures. Overall ElevenLabs ConvAI reliability appears degraded.

2. **Character utilization rate decelerating.** Daily average dropped from ~2,640/day (Apr 12 report) to ~2,126/day (Apr 13). The Apr 9 burst effect is fading as more zero/low-activity days enter the average. Projected cycle-end: ~63,800 chars (23.6%), down from ~79,200 (29.3%) estimate yesterday. Well within Creator limit.

3. **April 10, 12 (post-08:00), and 13 were quiet.** Three of the last four days had zero or near-zero ElevenLabs activity. The Apr 9 burst appears to have been an outlier rather than a trend.

4. **Revenue and voice drought deepening.** Feb $9.98 net → Mar $0.00 → Apr $0.00 (day 13). Three months, ~$270 cumulative operational loss. Day 59 with no sign of reversal.

5. **Twilio $0.24 anomaly persists.** Ten days since the Apr 3-4 balance drop and still no resolution. Balance has been stable at $14.0646 for 6 consecutive days. If this was a one-time regulatory surcharge it may not recur; if monthly, it will appear again in early May.

### Monthly Cost History

| Month | Operational Fixed | Variable (confirmed) | Total Operational | Revenue (net) | Coverage |
|-------|------------------|----------------------|-------------------|---------------|----------|
| Feb 2026 | $84.41 | ~$2.75 | ~$87.16 | ~$9.98 | ~11.4% |
| Mar 2026 (final) | $84.41 | $1.15 | **$85.56** | **$0.00** | **0%** |
| Apr 2026 (day 13) | $84.41 | $1.15 | **$85.56** | $0.00 | 0% |

---

## Recommendations

### Immediate Actions (Priority)

1. **Check Anthropic billing manually** — Visit [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing). Daily automated agents (security, coverage, performance, cost-analyst, localization, docs, QA, triage) plus Claude Code Max development activity may push actual usage well above the $10/mo config estimate. The Max plan Claude Code usage is separate ($200/mo), but API-based agent runs accrue to the Anthropic account.

2. **Investigate the revenue and voice drought — 59 days is critical** — Priority unchanged from prior reports:
   - Is the Pelayo voice widget rendering and accessible on production?
   - Is the Day Pass purchase flow functional end-to-end?
   - Are Vercel deployment logs showing errors on production requests?
   - Has organic traffic dropped? (PostHog / Vercel Analytics)
   - QA Agent confirms browser journeys pass E2E (as of Mar 23) — production behavior for paying flows remains unverified.

3. **Resolve the Twilio $0.24 anomaly** — Check Twilio billing history at https://console.twilio.com for April 3-4. Likely a US local number regulatory surcharge (~$0.24/mo). If confirmed recurring, update `recurring-costs.ts` to reflect ~$1.39/mo Twilio cost instead of $1.15/mo. Anomaly is now 10 days old without resolution.

4. **Monitor Archy failure escalation** — Three consecutive failures across Apr 11–12 with two different error types. Archy failure rate now 25% (3/12 in last 20), up from 0% on Apr 9. Not a Paisaxe cost concern, but the trend suggests LLM backend instability or configuration drift. If failures continue on Apr 13, consider investigating the Archy agent's custom LLM configuration.

### Near-Term Actions (April Planning)

5. **April mid-month checkpoint (April 15)** — At $2.81/day fixed burn and $0 revenue, ~$42 burned by April 15. If no revenue appears, evaluate:
   - Consider releasing the Twilio phone number — 55 days without a booking call, $1.15–1.39/mo unused
   - Review whether Vercel Pro ($20/mo) or Supabase Pro ($25/mo) features are actively needed at current dormant scale

6. **ElevenLabs utilization on track** — Character consumption decelerating (2,126/day vs 2,640/day yesterday). Projected cycle-end: ~24% utilization. No action needed. Creator tier remains well-sized.

### Long-Term Planning

7. **Revenue trajectory is critical** — Three consecutive near-zero or zero-revenue months. At $84.41/mo operational with $0 revenue: ~$2.81/day in losses. Break-even requires ~3,150 monthly visitors at 5% Day Pass conversion — 63x current traffic. Cumulative operational loss since Feb 2026: ~$270. The platform requires a growth event or cost reduction to achieve sustainability.

8. **ElevenLabs remains well-sized** — Creator tier at $22.18/mo effective (annual). Even at highest projected utilization (~24% cycle-end), well within the 270,783 char limit. Scale tier ($99/mo) only needed if sustained Paisaxe voice traffic exceeds 100 min/mo — currently at 0 min.

---

## Data Sources

| Source | Method | Last Queried | Status |
|--------|--------|-------------|--------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-04-13 03:00 UTC | ✅ OK |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=20` | 2026-04-13 03:00 UTC | ✅ OK |
| Twilio Balance API | `/Balance.json` | 2026-04-13 03:00 UTC | ✅ OK |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json` | 2026-04-13 03:00 UTC | ✅ OK (0 non-zero of 50 records) |
| ElevenLabs Character Stats API | `/v1/usage/character-stats` | — | ⚠️ Not queried (empty in prior runs) — using subscription API character_count |
| Config: `service-tiers.ts` | File read | 2026-04-13 | ✅ OK |
| Config: `recurring-costs.ts` | File read | 2026-04-13 | ✅ OK |
| Config: `forecast.ts` | File read | 2026-04-13 | ✅ OK |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | — | ⚠️ Manual check required |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-04-14.*
