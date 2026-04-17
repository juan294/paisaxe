# Cost Analyst Report

> **Generated**: 2026-04-17 03:00:00 | **Period**: April 2026 (day 17 of 30) | **Status**: WATCH

---

## Executive Summary

**Day 17 of April.** ElevenLabs silence ended briefly: 8 Archy conversations occurred on April 16 (17:35–18:44 UTC) — the first activity since April 12. Characters rose from 12,119 to 13,734 (+1,615). However, 3 of those 8 conversations failed with "custom_llm generation failed" errors, pushing the Archy failure rate in the last 20 conversations to 6/20 (30%), up from 25% at the last report. All activity continues to be non-Paisaxe.

**Twilio balance holds at $14.0646** for the tenth consecutive day. Zero non-zero usage records in April.

**Revenue drought reaches 63 days** (since February 13). **Paisaxe voice silence: 59 days** (since February 17). Zero revenue in April through day 17. Fixed operational costs unchanged at $84.41/mo. With 13 days left in April, $0 revenue remains virtually certain.

**Financial health: WATCH** — business concern only. No platform cost anomalies. All tier limits well within range. Archy failure rate escalating (30%, up from 25%) is a non-Paisaxe operational concern worth monitoring.

| Metric | Value | vs. Apr 15 |
|--------|-------|-----------|
| Total Fixed Costs (all) | $284.41/mo | → |
| Total Fixed Costs (operational) | **$84.41/mo** | → |
| Variable Costs (Apr MTD, confirmed) | **$1.15** | → |
| Daily Burn Rate (Apr fixed) | **$2.81/day** | → |
| Revenue (Apr MTD) | **$0.00** | → |
| Twilio Balance | **$14.0646** | → (10th stable day) |
| ElevenLabs Characters (cycle) | **13,734 / 270,783 (5.07%)** | ↑ +1,615 (+0.59pp) |
| ElevenLabs Voice Min (Paisaxe, Apr) | 0.0 / 100 | → |
| Next Character Reset | **~2026-05-07 14:36 UTC** | 20 days |
| Paisaxe Voice Silence | **59 days** | +2 |
| Revenue Drought | **63 days** | +2 |

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

*\*\*\*Twilio phone number rental charged April 7: balance dropped $15.2146 → $14.0646 (-$1.15). Monthly billing event, expected. Balance stable for 10 consecutive days.*

**Note**: Claude Code Max ($200/mo) is the primary development tool, categorized separately as "Development." Operational cost analysis focuses on running the live service.

### Variable / Usage-Based Costs (April 2026 MTD — Day 17)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Phone rental) | 1 number, April billing | **$1.15** | Balance delta (Apr 7) |
| Twilio (SMS) | 0 messages | $0.00 | API (50 records, 0 non-zero) |
| Twilio (Calls) | 0 minutes | $0.00 | API |
| Stripe (Processing Fees) | 0 charges | $0.00 | — |
| Anthropic (Claude API) | Unknown | Unknown | — |
| Voyage AI (Embeddings) | Unknown | Unknown | — |
| **Total Variable (Apr MTD, confirmed)** | | **$1.15** | |

### April 2026 MTD Total (Day 17)

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

**Character count at report time: 13,734 / 270,783 (5.07%).** Up from 12,119 (+1,615) since Apr 15. New activity: 8 Archy conversations on April 16 (17:35–18:44 UTC) after a 4-day gap (Apr 12–16). The Apr 16 burst was mixed: 5 successes, 3 "custom_llm generation failed" errors.

**Archy failure pattern — escalating:**
- Apr 16 18:22 UTC — "custom_llm generation failed" (15s, 2 messages)
- Apr 16 18:19 UTC — "custom_llm generation failed" (9s, 2 messages)
- Apr 16 18:19 UTC — "custom_llm generation failed" (16s, 2 messages)
- Apr 12 07:59 UTC — "custom_llm generation failed" (24s, 2 messages)
- Apr 11 06:12 UTC — "Generating the LLM response took too long" (30s, 2 messages)
- Apr 11 16:49 UTC — "Generating the LLM response took too long" (32s, 2 messages)

Three new failures in the Apr 16 burst (all "custom_llm generation failed"). Failure rate in last 20: **6/20 (30%)**, up from 3/12 (25%) at Apr 15 report.

Last 20 conversations breakdown (updated):

| Agent | Count (in last 20) | Most Recent | Success/Fail | Project |
|-------|-------------------|-------------|------------|---------|
| Archy | **19** | Apr 16 18:44 UTC (success) | 13 success, 6 failures (32%) | Non-Paisaxe |
| Coach | **1** | Apr 15 06:39 UTC | 1 success (100%) | Non-Paisaxe |
| Pelayo (Visitor Guide) | 0 | Feb 17 | Dormant | Paisaxe |
| Pelayo (Booking) | 0 | Feb 10 | Dormant | Paisaxe |
| Penny, Iris, Xander | 0 | Never | Dormant | Paisaxe |

**All conversations are non-Paisaxe.** Paisaxe agents: **0 conversations since February 17.**

### ElevenLabs Character Usage

| Metric | Value | vs. Apr 15 |
|--------|-------|-----------|
| Characters used (cycle) | **13,734 / 270,783 (5.07%)** | ↑ +1,615 (+0.59pp) |
| Character limit | **270,783** | → |
| Next character reset | **~2026-05-07 14:36 UTC** | ~20 days |
| Characters used (Apr, Paisaxe) | 0 | → |
| Characters remaining this cycle | **257,049** | — |

Cycle started Apr 7 (~9.5 days elapsed at report time). Daily average: 13,734 / 9.5 = ~1,446/day. Projected cycle-end (~20.5 days remaining): 13,734 + (20.5 × 1,446) = ~43,400 chars (~16.0%). Deceleration continues from prior peak: ~2,126/day (Apr 13) → ~1,809/day (Apr 14) → ~1,616/day (Apr 15) → ~1,446/day (Apr 17). Well within Creator limit.

### ElevenLabs Subscription Details (from API — 2026-04-17)

| Field | Value |
|-------|-------|
| Tier | Creator |
| Billing period | Annual |
| Status | Active |
| Next invoice amount | $266.20 |
| Next invoice date | ~2027-02-07 |
| Next character reset | **~2026-05-07 14:36 UTC** |
| Character limit | **270,783** |

### Twilio Communications

| Metric | Apr 2026 (days 1-17) | Mar 2026 (final) | Change |
|--------|---------------------|-----------------|--------|
| SMS Sent | 0 | 0 | → |
| Calls | 0 | 0 | → |
| Usage Cost | $0.00 | $0.00 | → |
| Phone Rental | **$1.15** (charged Apr 7) | $1.15 | Monthly expected |
| Balance | **$14.0646** | $15.4546 | -$1.40 MTD |

**Twilio balance reconciliation (April):**
- Apr 1 (start): ~$15.4546
- Apr 3-4: -$0.24 (unexplained — likely regulatory surcharge, unresolved 14 days)
- Apr 7: -$1.15 (phone number rental, confirmed)
- **Apr 17: $14.0646** — stable for 10 consecutive days. ~12.2 months of runway remaining.

### Stripe Revenue

| Metric | Apr 2026 (days 1-17) | Mar 2026 (final) | Feb 2026 (final) |
|--------|---------------------|-----------------|-----------------|
| Net Sales | 0 | 0 | 6 |
| Gross Revenue | $0.00 | $0.00 | $13.93 |
| Net Revenue | $0.00 | $0.00 | $9.98 |

**63-day revenue drought** — No Day Pass sales since February 13. Over two months without revenue.

---

## Cost Efficiency

| Metric | Current (Apr 17) | Previous (Apr 15) | Change | Trend |
|--------|----------------|------------------|--------|-------|
| Fixed operational cost/mo | $84.41 | $84.41 | → | → |
| Daily burn rate (fixed) | **$2.81/day** | $2.81/day | → | → |
| April variable spend (confirmed) | **$1.15** | $1.15 | → | → |
| Cost per voice conversation (Feb actuals) | ~$0.43 | ~$0.43 | → | → |
| Cost per voice minute (Feb actuals) | ~$0.37 | ~$0.37 | → | → |
| ElevenLabs char utilization (cycle) | **5.07%** | 4.48% | +0.59pp | ↑ |
| ElevenLabs char utilization daily rate | ~1,446/day | ~1,616/day | -10.5% | ↓ |
| ElevenLabs voice min utilization (Paisaxe, Apr) | 0% | 0% | → | → |
| Revenue coverage (operational) | **0%** | 0% | → | → |
| Months of Twilio runway | ~12.2 mo | ~12.2 mo | → | → |

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Alert Level |
|---------|--------|------|-------|-------------|-------------|
| ElevenLabs | Characters (cycle) | 13,734 | 270,783 | **5.07%** | SAFE |
| ElevenLabs | Voice Minutes (Paisaxe, Apr) | 0.0 | 100 | **0%** | SAFE |
| Vercel | Monthly Visitors | ~low | 500,000 (Pro) | **<1%** | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | SAFE |

**All tier alerts cleared.** At current cycle pace (~1,446 chars/day, decelerating), projected end: ~43,400 chars — 16.0% utilization, well within limit.

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
| 63-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. Third consecutive zero-revenue month nearly complete. |
| 59-day Paisaxe voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Platform dormant to visitors for nearly 2 months. |
| Archy failure rate escalating | **WATCH** | 6/20 (30%) failures in last 20. Apr 16 burst: 3/8 (37.5%) — all "custom_llm generation failed". Up from 25% at last report. Non-Paisaxe, but pattern worth noting. |
| Twilio $0.24 drop (Apr 3-4, unresolved) | **WATCH** | Balance anomaly not captured in Usage Records API. Likely recurring regulatory surcharge. Now 14 days unresolved. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Daily agents + Claude Code Max development may push actual Anthropic API usage above $10/mo estimate. |

**No platform cost-structure anomalies.** All tier limits safe.

---

## Trend Analysis

### Comparison: Apr 15 → Apr 17

| Metric | Apr 15 (03:00 UTC) | Apr 17 (03:00 UTC) | Change | Direction |
|--------|------|------|--------|-----------|
| Fixed costs/mo (operational) | $84.41 | $84.41 | → | → |
| Variable costs (confirmed MTD) | $1.15 | $1.15 | → | → |
| Daily burn rate (fixed) | $2.81/day | $2.81/day | → | → |
| ElevenLabs characters | 12,119 (4.48%) | **13,734 (5.07%)** | +1,615 (+0.59pp) | ↑ |
| ElevenLabs char daily rate | ~1,616/day | **~1,446/day** | -10.5% | ↓ |
| Most recent ElevenLabs convo | Apr 12 07:59 UTC | **Apr 16 18:44 UTC** | +4 days (burst) | ↑ |
| Archy failure rate (last 20) | 3/12 (25%) | **6/20 (30%)** | +5pp | ↑ worsen |
| Paisaxe voice conversations (MTD) | 0 | 0 | → | → |
| Twilio balance | $14.0646 | $14.0646 | → (10th day) | → |
| SMS sent (MTD) | 0 | 0 | → | → |
| Day Pass net sales (MTD) | 0 | 0 | → | → |
| Paisaxe voice dormancy streak | 57 days | **59 days** | +2 | ↓ |
| Revenue drought streak | 61 days | **63 days** | +2 | ↓ |
| Next ElevenLabs reset | 22 days | **~20 days** | -2 | approaching |
| Projected cycle-end chars | ~48,500 (17.9%) | **~43,400 (16.0%)** | -1.9pp | ↓ decelerating |

**Key observations:**

1. **Archy returned Apr 16, but with elevated failure rate.** Eight conversations in a 69-minute window (17:35–18:44 UTC). Three failed ("custom_llm generation failed") = 37.5% in-burst failure rate. Failure rate in last 20 rose to 30% (from 25%). All custom_llm failures involve exactly 2 messages and short durations (9–24s) — consistent with the LLM backend rejecting the first response. The pattern (alternating failures/successes) may indicate intermittent backend instability in Archy's LLM configuration.

2. **Character utilization deceleration continues.** Despite the Apr 16 burst adding 1,615 chars, the daily cycle average has been falling: ~2,126/day (Apr 13) → ~1,809/day (Apr 14) → ~1,616/day (Apr 15) → ~1,446/day (Apr 17). As quiet days accumulate, the burst's contribution fades. Projected cycle-end: ~16.0% (down from ~17.9% at Apr 15).

3. **Revenue drought at 63 days.** Day 63 with zero revenue. April will close at ~$85.56 operational — identical to March. Cumulative operational loss since Feb 2026: ~$300+.

4. **Twilio 10-day stability streak.** Balance unchanged for 10 consecutive days since the Apr 7 rental. The $0.24 anomaly from Apr 3-4 remains the only unexplained event this month.

### Monthly Cost History

| Month | Operational Fixed | Variable (confirmed) | Total Operational | Revenue (net) | Coverage |
|-------|------------------|----------------------|-------------------|---------------|----------|
| Feb 2026 | $84.41 | ~$2.75 | ~$87.16 | ~$9.98 | ~11.4% |
| Mar 2026 (final) | $84.41 | $1.15 | **$85.56** | **$0.00** | **0%** |
| Apr 2026 (day 17) | $84.41 | $1.15 | **$85.56** | $0.00 | 0% |

---

## Recommendations

### Immediate Actions (Priority)

1. **Check Anthropic billing manually** — Visit [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing). Daily automated agents (security, coverage, performance, cost-analyst, localization, docs, QA, triage) plus Claude Code Max development activity may push actual usage well above the $10/mo config estimate.

2. **Investigate the revenue and voice drought — 63 days is critical** — Over two full months with no revenue. Priority unchanged:
   - Is the Pelayo voice widget rendering and accessible on production?
   - Is the Day Pass purchase flow functional end-to-end?
   - Are Vercel deployment logs showing errors on production requests?
   - Has organic traffic dropped? (PostHog / Vercel Analytics)
   - QA Agent confirms browser journeys pass E2E (as of Mar 23) — production behavior for paying flows remains unverified.

3. **Resolve the Twilio $0.24 anomaly** — Check Twilio billing history at https://console.twilio.com for April 3-4. Likely a US local number regulatory surcharge (~$0.24/mo). If confirmed recurring, update `recurring-costs.ts` to reflect ~$1.39/mo Twilio cost instead of $1.15/mo. Anomaly is now 14 days old without resolution.

4. **Investigate Archy failure escalation** — Non-Paisaxe concern, but 30% failure rate is elevated. All failures are "custom_llm generation failed" at exactly 2 messages. If Archy uses a custom LLM endpoint, it may have a misconfigured model or rate limit. Alerting the Archy team is appropriate.

### Cost Reduction Evaluation

5. **Evaluate Twilio phone number** — 59 days without a booking call. $1.15–1.39/mo unused. Consider releasing the number unless bookings are expected to resume. ~$14/yr savings.

6. **Review Vercel Pro and Supabase Pro** — At current dormant scale (~50 visitors/mo), both Pro tiers may be overprovisioned:
   - Vercel Pro ($20/mo) — Hobby tier is free for personal projects with limited bandwidth.
   - Supabase Pro ($25/mo) — Free tier includes 500MB storage and 50K monthly active users.
   - Combined potential savings: up to $45/mo (~53% of operational costs).

### Long-Term Planning

7. **Revenue trajectory is critical** — Three consecutive near-zero or zero-revenue months. At $84.41/mo operational with $0 revenue: $2.81/day in losses. Break-even requires ~3,150 monthly visitors at 5% Day Pass conversion — 63x current traffic. Cumulative operational loss since Feb 2026: ~$300. The platform requires a growth event or cost reduction to achieve sustainability.

8. **ElevenLabs remains well-sized** — Creator tier at $22.18/mo effective (annual). Projected cycle utilization now ~16.0%, continuing to decelerate. Well within the 270,783 char limit. Scale tier ($99/mo) only needed if sustained Paisaxe voice traffic exceeds 100 min/mo — currently at 0 min.

---

## Data Sources

| Source | Method | Last Queried | Status |
|--------|--------|-------------|--------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-04-17 03:00 UTC | ✅ OK |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=20` | 2026-04-17 03:00 UTC | ✅ OK (8 new convos Apr 16) |
| Twilio Balance API | `/Balance.json` | 2026-04-17 03:00 UTC | ✅ OK |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json` | 2026-04-17 03:00 UTC | ✅ OK (0 non-zero of 50 records) |
| Config: `service-tiers.ts` | File read | 2026-04-17 | ✅ OK |
| Config: `recurring-costs.ts` | File read | 2026-04-17 | ✅ OK |
| Config: `forecast.ts` | File read | 2026-04-17 | ✅ OK |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | — | ⚠️ Manual check required |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-04-18.*
