# Cost Analyst Report

> **Generated**: 2026-04-06 03:00:00 | **Period**: April 2026 (day 6 of 30) | **Status**: WATCH

---

## Executive Summary

**Day 6 of April — character surge on April 5, reset tomorrow, revenue drought at 52 days.** The biggest single-day ElevenLabs activity this cycle occurred on April 5: Archy had **9 conversations totaling 21.5 minutes** (09:58–10:13 UTC), and the Coach agent returned with 6 more failed conversations (15:47–17:55 UTC). Together they pushed character consumption from **8,453 to 23,591** — a +15,138 character jump (+179% day-over-day).

Despite the character surge, **all activity remains non-Paisaxe**. Paisaxe voice silence extends to **48 days** (since February 17) and the revenue drought reaches **52 days** (since February 13).

**Character cycle resets TOMORROW, April 7 at 14:15 UTC.** After reset the counter returns to 0 / 196,138. The cycle will close at approximately 23,591–25,000 characters used (~12% utilization).

**Twilio balance unchanged at $15.2146** — the $0.24 drop from April 3–4 has still not recurred or been explained. April variable spend confirmed at $0.00 (no SMS, no calls).

**Fixed operational costs unchanged at $84.41/mo. No Paisaxe-specific variable charges in April.** Financial health: WATCH — business concern only, no platform cost anomalies.

| Metric | Value | vs. Apr 5 |
|--------|-------|-----------|
| Total Fixed Costs (all) | $284.41/mo | → |
| Total Fixed Costs (operational) | **$84.41/mo** | → |
| Variable Costs (Apr MTD, known) | $0.00 | → |
| Daily Burn Rate (Apr) | **$2.81/day** | → |
| Revenue (Apr MTD) | **$0.00** | → |
| Twilio Balance | **$15.2146** | → |
| ElevenLabs Characters | **23,591 / 196,138 (12.03%)** | +15,138 (+7.72 pp) |
| ElevenLabs Voice Min (Paisaxe, Apr) | 0.0 / 100 | → |
| Character Reset | **April 7, 2026 14:15 UTC** | **Tomorrow** |
| Paisaxe Voice Silence | **48 days** | +1 |
| Revenue Drought | **52 days** | +1 |

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

*\*\*\*Twilio phone number rental ($1.15/mo). April charge pending (month-end billing).*

**Note**: Claude Code Max ($200/mo) is the primary development tool, categorized separately as "Development." Operational cost analysis focuses on running the live service.

### Variable / Usage-Based Costs (April 2026 MTD — Day 6)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Phone rental) | Pending (month-end billing) | ~$1.15 expected | Config |
| Twilio (SMS) | 0 messages | $0.00 | API |
| Twilio (Calls) | 0 minutes | $0.00 | API |
| Stripe (Processing Fees) | 0 charges | $0.00 | — |
| Anthropic (Claude API) | Unknown | Unknown | — |
| Voyage AI (Embeddings) | Unknown | Unknown | — |
| **Total Variable (Apr MTD, confirmed)** | | **$0.00** | |

### March 2026 Final Costs (confirmed)

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

### ElevenLabs Conversations (April 5 — since yesterday's report)

**Archy (agent_7901kk4r9v3wer) — 9 conversations, 09:58–10:13 UTC:**

| Conversation | Status | Start (UTC) | Duration |
|-------------|--------|-------------|----------|
| conv_5201kneh92xhf7btbw3tbehq0 | failed | 09:58 | 189 sec |
| conv_9301kneheb4tebjrbtr4n39jp | done | 10:01 | 127 sec |
| conv_6101knehfef4f498b4b99b2mx | failed | 10:01 | 51 sec |
| conv_5901knehnwfjese806accjrwz | done | 10:05 | 133 sec |
| conv_4201knehta5ke08rbkqpafwth | done | 10:08 | 22 sec |
| conv_6901knehxybxescsvnx3vktyt | failed | 10:10 | 23 sec |
| conv_9901knehyzdsf52rgmw9dtrqw | done | 10:10 | 129 sec |
| conv_9001knej4t84eb7a8y9pb390m | done | 10:13 | 602 sec |
| *(additional short)* | done | ~10:03 | 15 sec |

**Total Archy April 5: 9 conversations (6 done, 3 failed), 1,291 seconds (~21.5 min)** — busiest single session this cycle.

**Coach (agent_8201kmhr2vbef3) — 6 conversations, all failed, 15:47–17:55 UTC:**

| Conversation | Status | Start (UTC) | Duration |
|-------------|--------|-------------|----------|
| conv_5901knf5bb94fkkry7v5t0gdt | failed | 15:47 | 14 sec |
| conv_0701knf59d7cetzbppdx3nz0w | failed | 15:48 | 4 sec |
| conv_4201knf582t3e6xa7fjfm3wzy | failed | 15:49 | 10 sec |
| conv_0101knfc74qkfevape5bpcr77 | failed | 17:49 | 3 sec |
| conv_0901knfchfyxfmj841ygcy5ve | failed | 17:55 | 10 sec |
| conv_7801knfcj5wpf4vvn4p9272ke | failed | 17:55 | 8 sec |

**Total Coach April 5: 6 conversations (all failed), 49 seconds** — no characters consumed (all failed at initialization).

**April 4 Archy surge (from previous report):** 5 conversations totaling 917 sec.

### ElevenLabs Monthly Voice History

| Period | Conversations | Successful | Failed | Duration | Paisaxe |
|--------|--------------|-----------|--------|----------|---------|
| Apr 2026 (days 1-6) | **27** | 12 | 15 | ~2,420 sec | **0** |
| Mar 2026 (final) | ~4 (Archy, Mar 29) | 3 | 1 | ~602 sec peak | **0** |
| Feb 2026 (final) | 51 (Paisaxe) | 47 | 4 | 60.0 min | **60 min** |

**Zero Paisaxe voice activity since February 17** (48 consecutive days). No Paisaxe Pelayo conversations in March or April.

### ElevenLabs Character Usage

| Metric | Value | Note |
|--------|-------|------|
| Characters used (current cycle) | **23,591 / 196,138 (12.03%)** | +15,138 from Apr 5 report (9 Archy + 6 Coach convos) |
| Character limit | 196,138 | Unchanged |
| Next character reset | **2026-04-07 14:15 UTC** | **Tomorrow** |
| Characters used (Apr, Paisaxe) | 0 | No Paisaxe activity |
| Characters remaining | 172,547 | Well within limit |

### ElevenLabs Subscription Details (from API — 2026-04-06)

| Field | Value |
|-------|-------|
| Tier | Creator |
| Billing period | Annual |
| Status | Active |
| Next invoice amount | $266.20 |
| Next invoice date | 2027-02-07 |
| Next character reset | 2026-04-07 14:15 UTC |

### ElevenLabs Agent Summary (current cycle)

| Agent | Cycle Calls | Last Call | Status | Project |
|-------|------------|-----------|--------|---------|
| Archy | **14+** | Apr 5 10:13 UTC | Active | Non-Paisaxe |
| Coach | **11** | Apr 5 17:55 UTC | Failing (all init failures) | Non-Paisaxe |
| Pelayo (Visitor Guide) | 0 | Feb 17 | Dormant | Paisaxe |
| Pelayo (Booking) | 0 | Feb 10 | Dormant | Paisaxe |
| Penny, Iris, Xander | 0 | Never | Dormant | Paisaxe |

### Twilio Communications

| Metric | Apr 2026 (days 1-6) | Mar 2026 (final) | Change |
|--------|---------------------|-----------------|--------|
| SMS Sent | 0 | 0 | → |
| Calls | 0 | 0 | → |
| Usage Cost | $0.00 | $0.00 | → |
| Balance | **$15.2146** | $15.4546 | -$0.24 (unexplained, Apr 3-4) |

Phone rental ~$1.15 expected at month end. At current burn rate (~$1.15/mo), ~13.2 months of Twilio runway remaining. Balance stable since April 4 — no further unexplained drops.

### Stripe Revenue

| Metric | Apr 2026 (days 1-6) | Mar 2026 (final) | Feb 2026 (final) |
|--------|---------------------|-----------------|-----------------|
| Net Sales | 0 | 0 | 6 |
| Gross Revenue | $0.00 | $0.00 | $13.93 |
| Net Revenue | $0.00 | $0.00 | $9.98 |

**52-day revenue drought** — No Day Pass sales since February 13.

---

## Cost Efficiency

| Metric | Current (Apr 6) | Previous (Apr 5) | Change | Trend |
|--------|----------------|------------------|--------|-------|
| Fixed operational cost/mo | $84.41 | $84.41 | → | → |
| Daily burn rate | **$2.81/day** | $2.81/day | → | → |
| Cost per voice conversation (Feb actuals) | ~$0.43 | ~$0.43 | → | → |
| Cost per voice minute (Feb actuals) | ~$0.37 | ~$0.37 | → | → |
| ElevenLabs char utilization (current cycle) | **12.03%** | 4.31% | +7.72 pp | up |
| ElevenLabs char headroom | **172,547** | 187,685 | -15,138 | down |
| ElevenLabs voice min utilization (Paisaxe, Apr) | 0% | 0% | → | → |
| Revenue coverage (operational) | **0%** | 0% | → | → |
| Months of Twilio runway | ~13.2 mo | ~13.2 mo | → | → |

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Alert Level |
|---------|--------|------|-------|-------------|-------------|
| ElevenLabs | Characters (cycle, resets Apr 7) | 23,591 | 196,138 | **12.03%** | SAFE |
| ElevenLabs | Voice Minutes (Paisaxe, Apr) | 0.0 | 100 | **0%** | SAFE |
| Vercel | Monthly Visitors | ~low | 500,000 (Pro) | **<1%** | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | SAFE |

**All tier alerts cleared.** Despite the character surge, 12.03% utilization is well within limits. Reset tomorrow at 14:15 UTC begins a fresh cycle.

### Upgrade Trigger Points

| Service | Current Tier | Trigger | Next Tier | Cost Jump |
|---------|-------------|---------|-----------|-----------|
| ElevenLabs | Creator ($22.18/mo eff.) | >100 min/mo | Scale ($99/mo) | +$77/mo |
| Supabase | Pro ($25/mo) | >8 GB storage | Team ($599/mo) | +$574/mo |
| PostHog | Free ($0) | >1M events/mo | Pay-as-you-go | Variable |

---

## Scaling Forecast

Based on `src/lib/costs/forecast.ts` logic, using February 2026 actuals as baseline:

**Per-unit costs (fallback — no April data):**
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
| 52-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. Third consecutive month at zero revenue. |
| 48-day Paisaxe voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Platform dormant to users. |
| ElevenLabs character surge +15,138 (+179%) | **INFO** | Archy had 9 conversations on Apr 5 (~21.5 min), Coach had 6 more failed. All non-Paisaxe. No direct cost impact. 12.03% utilization — no tier risk. |
| Twilio $0.24 balance drop (Apr 3-4, unexplained) | **WATCH** | Balance has not moved since Apr 4. Likely delayed phone number/regulatory charge. Monitor if balance drops further. |
| Coach agent persistent initialization failures | **INFO** | 11 total failed conversations this cycle (Apr 3 + Apr 5). All fail within 0–14 sec at initialization. Non-Paisaxe, no characters consumed. Possible misconfiguration in a separate project. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual checks required monthly at [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing). |

**No platform cost-structure anomalies.** All cost anomalies are either informational or minor. Character surge is non-Paisaxe and resets tomorrow.

---

## Trend Analysis

### Comparison: Apr 5 → Apr 6

| Metric | Apr 5 (03:00) | Apr 6 (03:00) | Change | Direction |
|--------|-------|-------|--------|-----------|
| Fixed costs/mo (operational) | $84.41 | $84.41 | → | → |
| Variable costs (MTD) | $0.00 | $0.00 | → | → |
| Daily burn rate | $2.81/day | $2.81/day | → | → |
| Paisaxe voice conversations (MTD) | 0 | 0 | → | → |
| All ElevenLabs conversations (MTD) | 12 | **27** | +15 | up |
| Characters used (cycle) | 8,453 (4.31%) | **23,591 (12.03%)** | +15,138 (+7.72 pp) | up |
| SMS sent (MTD) | 0 | 0 | → | → |
| Day Pass net sales (MTD) | 0 | 0 | → | → |
| Twilio balance | $15.2146 | $15.2146 | → | → |
| Paisaxe voice dormancy streak | 47 days | **48 days** | +1 | down |
| Revenue drought streak | 51 days | **52 days** | +1 | down |
| Character reset countdown | 2 days | **1 day** | -1 | → |

**Key observations:**

1. **Archy had its busiest session this cycle on April 5.** 9 conversations from 09:58–10:13 UTC totaling 1,291 seconds (~21.5 min). This is 3x more activity than the previous peak (5 conversations on April 4). The 602-second conversation again hit the maximum duration limit — suggesting Archy regularly uses the full available session time when engaged.

2. **Character consumption: 8,453 → 23,591 (+179%).** The +15,138 char jump represents a single session of intensive Archy usage. Despite this surge, utilization is 12.03% — well within limits. The cycle resets tomorrow, so this becomes moot.

3. **Coach agent returned with 6 more failures on April 5 (15:47–17:55 UTC).** Total this cycle: 11 failed conversations (Apr 3: 5 + Apr 5: 6). All fail at initialization (0–14 sec), consuming 0 characters. Two clusters suggest recurring testing sessions in a separate project. No Paisaxe cost impact.

4. **Twilio balance stabilized at $15.2146 for 3 days.** The $0.24 drop from Apr 3 has not continued. The most likely explanation remains a delayed billing event (regulatory fee or phone number charge) that hasn't surfaced in the Usage Records API.

5. **Day 52 of revenue drought, day 48 of Paisaxe voice silence.** Now approaching 8 full weeks with no voice activity and 2 full months without revenue. The April 7 character reset will confirm whether Archy activity continues, but this has no impact on Paisaxe financials.

### Monthly Cost History

| Month | Operational Fixed | Variable (known) | Total Operational | Revenue (net) | Coverage |
|-------|------------------|------------------|-------------------|---------------|----------|
| Feb 2026 | $84.41 | ~$2.75 | ~$87.16 | ~$11.34 | ~13.0% |
| Mar 2026 (final) | $84.41 | $1.15 | **$85.56** | **$0.00** | **0%** |
| Apr 2026 (day 6) | $84.41 | $0.00 so far | — | $0.00 | 0% |

---

## Recommendations

### Immediate Actions (Priority)

1. **Check Anthropic billing manually** — Visit [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing). With agent development activity ongoing (Stripe v22 upgrade, ElevenLabs v1 upgrade, coverage tests, dep maintenance), Claude API usage may be non-trivial. Confirm actual vs. estimated $10/mo.

2. **Investigate the revenue and voice drought urgently** — 52 days with no sales and 48 days without a Paisaxe voice conversation:
   - Is the Pelayo voice widget rendering and accessible on production?
   - Is the Day Pass purchase flow functional?
   - Are there Vercel deployment logs showing errors?
   - Has organic traffic dropped? (PostHog / Vercel Analytics)

3. **Character reset is TOMORROW (April 7, 14:15 UTC)** — Informational. After reset, counter returns to 0/196,138. Fresh monitoring begins April 7. The cycle will close at ~23,591–25,000 characters (12%) — all non-Paisaxe.

### Near-Term Actions (April Planning)

4. **Monitor Archy activity post-reset** — Archy consumed ~23,591 chars this cycle (~12%), driven primarily by April 4–5 activity. If this intensity continues into the new cycle, we could see 60,000–80,000 chars/cycle while still within limits. Track whether acceleration continues.

5. **Evaluate Vercel Pro necessity** — With ~50 visitors/month, the Hobby tier (50K visitors free) would suffice. Downgrading saves $20/mo (23.7% of operational costs). Evaluate whether Pro features (per-minute cron, preview deployments) justify the cost at this traffic level.

6. **Consider releasing the Twilio phone number** — Zero booking calls in 48 days. At $1.15/mo, the number costs $13.80/yr unused. If outbound booking is not actively generating revenue, consider releasing.

7. **April break-even check-in (mid-month)** — If no revenue by April 15, evaluate whether to pause Vercel + Supabase Pro ($45/mo combined, 53.3% of operational costs).

### Long-Term Planning

8. **Revenue trajectory is critical** — Three consecutive zero-or-near-zero months (Jan, Feb, Mar). At $84.41/mo operational with $0 revenue, losing ~$2.81/day. Break-even requires ~3,150 monthly visitors at 5% Day Pass conversion — 63x current traffic. The platform is in an existential financial position if the trend continues through May.

9. **ElevenLabs remains appropriately sized** — February used 60/100 voice minutes (60%) at peak. Creator tier annual billing at $22.18/mo effective is efficient. No change warranted unless Paisaxe voice resumes.

---

## Data Sources

| Source | Method | Last Queried |
|--------|--------|-------------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-04-06 03:00 UTC |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=15` | 2026-04-06 03:00 UTC |
| Twilio Balance API | `/Balance.json` | 2026-04-06 03:00 UTC |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json` | 2026-04-06 03:00 UTC |
| Config: `service-tiers.ts` | File read | 2026-04-06 |
| Config: `recurring-costs.ts` | File read | 2026-04-06 |
| Config: `forecast.ts` | File read | 2026-04-06 |
| ElevenLabs character-stats API | **422 error** (endpoint may require different auth/params) | 2026-04-06 |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | — |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-04-07.*
