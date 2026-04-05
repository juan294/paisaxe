# Cost Analyst Report

> **Generated**: 2026-04-05 03:00:00 | **Period**: April 2026 (day 5 of 30) | **Status**: WATCH

---

## Executive Summary

**Day 5 of April — zero Paisaxe revenue, 51-day drought, Archy activity surges.** The revenue drought reaches 51 days (since February 13) and Paisaxe voice silence extends to 47 days (since February 17). No Paisaxe Pelayo conversations have occurred since February.

The notable change this cycle: **Archy had a busy April 4**, with 5 conversations (4 successful, 1 failed) totaling 917 seconds (~15.3 minutes). This pushed ElevenLabs character usage from 6,318 to **8,453 / 196,138 (4.31%)** — up +2,135 characters in one day, the largest single-day increase this cycle. The "Coach" agent remains dormant since its April 3 failures (no new activity).

**Twilio balance is unchanged at $15.2146** — the $0.24 unexplained drop from April 3-4 did not continue. No new usage charges in any Twilio category.

**Character cycle resets in 2 days (April 7, 14:15 UTC).** After reset, the counter returns to 0 / 196,138.

**Fixed operational costs remain at $84.41/mo. No Paisaxe-specific variable charges have accrued in April.** Financial health: WATCH — business concern only, no platform cost anomalies.

| Metric | Value | vs. Apr 4 |
|--------|-------|-----------|
| Total Fixed Costs (all) | $284.41/mo | -> |
| Total Fixed Costs (operational) | **$84.41/mo** | -> |
| Variable Costs (Apr MTD, known) | $0.00 | -> |
| Daily Burn Rate (Apr) | **$2.81/day** | -> |
| Revenue (Apr MTD) | **$0.00** | -> |
| Revenue (Mar final) | $0.00 | -> |
| Twilio Balance | **$15.2146** | -> |
| ElevenLabs Characters | **8,453 / 196,138 (4.31%)** | +2,135 (+1.09%) |
| ElevenLabs Voice Min (Paisaxe, Apr so far) | 0.0 / 100 | -> |
| Character Reset | **April 7, 2026 14:15 UTC** | In 2 days |
| Paisaxe Voice Silence | **47 days** | +1 |
| Revenue Drought | **51 days** | +1 |

---

## Current Costs — Per-Service Breakdown

### Fixed / Recurring Costs

| Service | Tier | Monthly Cost | % of Operational | Category | Trend |
|---------|------|-------------|-----------------|----------|-------|
| Claude Code Max | Max (20x Pro) | $200.00 | -- (dev) | Development | -> |
| Supabase | Pro | $25.00 | 29.6% | Infrastructure | -> |
| ElevenLabs | Creator (annual) | $22.18* | 26.3% | AI / Voice | -> |
| Vercel | Pro | $20.00 | 23.7% | Infrastructure | -> |
| Anthropic Claude | Prepaid credits | $10.00** | 11.8% | AI | -> |
| GitHub Pro | Pro | $4.00 | 4.7% | Infrastructure | -> |
| AWS Domains | -- | $2.08 | 2.5% | Infrastructure | -> |
| Twilio Phone Number | -- | $1.15*** | 1.4% | Communications | -> |
| PostHog | Free | $0.00 | 0% | Analytics | -> |
| **Total Fixed (all)** | | **$284.41** | | | -> |
| **Total Fixed (operational)** | | **$84.41** | **100%** | | -> |

*\*ElevenLabs Creator billed annually. Effective rate $22.18/mo. Next annual invoice: $266.20 on 2027-02-07 (confirmed via API: next_payment_attempt_unix = 1802012845).*

*\*\*Anthropic $10/mo is an estimate from config. No billing API available on personal accounts. Check [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing) manually.*

*\*\*\*Twilio phone number rental ($1.15/mo). April charge pending (month-end billing).*

**Note**: Claude Code Max ($200/mo) is the primary development tool, categorized separately as "Development." Operational cost analysis focuses on running the live service.

### Variable / Usage-Based Costs (April 2026 MTD — Day 5)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Phone rental) | Pending (month-end billing) | ~$1.15 expected | Config |
| Twilio (SMS) | 0 messages | $0.00 | API |
| Twilio (Calls) | 0 minutes | $0.00 | API |
| Stripe (Processing Fees) | 0 charges | $0.00 | -- |
| Anthropic (Claude API) | Unknown | Unknown | -- |
| Voyage AI (Embeddings) | Unknown | Unknown | -- |
| **Total Variable (Apr MTD, confirmed)** | | **$0.00** | |

### March 2026 Final Costs (confirmed)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Phone rental) | 1 number | $1.15 | API |
| Twilio (SMS) | 0 messages | $0.00 | API |
| Twilio (Calls) | 0 minutes | $0.00 | API |
| Stripe (Processing Fees) | 0 charges | $0.00 | -- |
| **Total Variable (Mar final)** | | **$1.15** | |
| **Total Operational (Mar final)** | | **$85.56** | |

---

## Usage Metrics

### ElevenLabs Conversations (April 4, after yesterday's report)

| Conversation | Agent | Status | Start (UTC) | Duration |
|-------------|-------|--------|-------------|----------|
| conv_5301knc4pgypfekaf5xfgfdfaxxp | Archy | done | 2026-04-04 11:40 | 84 sec |
| conv_3101knbweh5sfrsar7p4tk3de5ac | Archy | done | 2026-04-04 09:16 | 57 sec |
| conv_7701knbw5b9vea49t5asv7a1wfmy | Archy | done | 2026-04-04 09:11 | 143 sec |
| conv_9901knbt6wz1fy6vcz8p4adxqndy | Archy | failed | 2026-04-04 08:37 | 31 sec |
| conv_5001knbss17mf8bbgcfwtr1ckmce | Archy | done | 2026-04-04 08:29 | 602 sec |

**Archy surged on April 4**: 5 conversations (4 done, 1 failed) totaling **917 seconds (~15.3 min)**. The failed conversation (conv_9901) lasted 31 sec — "Generating the LLM response took too long." The longest (conv_5001) hit the 602-second maximum duration limit. All were widget-initiated.

**Coach agent**: No new activity since April 3 (5 failures). Remains dormant.

**Paisaxe agents**: Zero activity. Pelayo Visitor Guide, Pelayo Booking, Penny, Iris, Xander — all 0 calls in the last 7 days.

### ElevenLabs Monthly Voice History

| Period | Conversations | Successful | Failed | Duration | Paisaxe |
|--------|--------------|-----------|--------|----------|---------|
| Apr 2026 (days 1-5) | **12** | 6 (Archy) | 6 (5 Coach + 1 Archy) | 1,080 sec | **0** |
| Mar 2026 (final) | ~4 (Archy, Mar 29) | 3 | 1 | ~602 sec peak | **0** |
| Feb 2026 (final) | 51 (Paisaxe) | 47 | 4 | 60.0 min | **60 min** |

**Zero Paisaxe voice activity since February 17** (47 consecutive days). No Paisaxe Pelayo conversations in March or April.

### ElevenLabs Character Usage

| Metric | Value | Note |
|--------|-------|------|
| Characters used (current cycle) | **8,453 / 196,138 (4.31%)** | +2,135 from Apr 4 03:00 (Archy activity) |
| Character limit | 196,138 | Unchanged |
| Next character reset | **2026-04-07 14:15 UTC** | In 2 days |
| Characters used (Apr, Paisaxe) | 0 | No Paisaxe activity |
| Characters remaining | 187,685 | Well within limit |

### ElevenLabs Subscription Details (from API — 2026-04-05)

| Field | Value |
|-------|-------|
| Tier | Creator |
| Billing period | Annual |
| Status | Active |
| Next invoice amount | $266.20 |
| Next invoice date | 2027-02-07 |

### ElevenLabs Agent Summary (7-day window)

| Agent | 7-Day Calls | Last Call | Project |
|-------|------------|-----------|---------|
| Archy | **11** | Apr 4 11:40 UTC | Non-Paisaxe |
| Coach | **5** | Apr 3 14:16 UTC | Non-Paisaxe |
| Pelayo (Visitor Guide) | 0 | Feb 17 | Paisaxe |
| Pelayo (Booking) | 0 | Feb 10 | Paisaxe |
| Penny (Pinterest) | 0 | Never | Paisaxe |
| Iris (Instagram) | 0 | Never | Paisaxe |
| Xander (X) | 0 | Never | Paisaxe |

### Twilio Communications

| Metric | Apr 2026 (days 1-5) | Mar 2026 (final) | Change |
|--------|---------------------|-----------------|--------|
| SMS Sent | 0 | 0 | -> |
| Calls | 0 | 0 | -> |
| Usage Cost | $0.00 | $0.00 | -> |
| Balance | **$15.2146** | $15.4546 | -$0.24 (from Apr 3-4) |

Phone rental ~$1.15 expected at month end. At current burn rate (~$1.15/mo), ~13.2 months of Twilio runway remaining.

Balance unchanged since yesterday ($15.2146). The $0.24 drop between Apr 3 and Apr 4 remains unexplained but has not continued.

### Stripe Revenue

| Metric | Apr 2026 (days 1-5) | Mar 2026 (final) | Feb 2026 (final) |
|--------|---------------------|-----------------|-----------------|
| Net Sales | 0 | 0 | 6 |
| Gross Revenue | $0.00 | $0.00 | $13.93 |
| Net Revenue | $0.00 | $0.00 | $9.98 |

**51-day revenue drought** — No Day Pass sales since February 13.

---

## Cost Efficiency

| Metric | Current (Apr 5) | Previous (Apr 4) | Change | Trend |
|--------|----------------|------------------|--------|-------|
| Fixed operational cost/mo | $84.41 | $84.41 | -> | -> |
| Daily burn rate | **$2.81/day** | $2.81/day | -> | -> |
| Cost per voice conversation (Feb actuals) | ~$0.43 | ~$0.43 | -> | -> |
| Cost per voice minute (Feb actuals) | ~$0.37 | ~$0.37 | -> | -> |
| ElevenLabs char utilization (current cycle) | **4.31%** | 3.22% | +1.09% | up |
| ElevenLabs char headroom | **187,685** | 189,820 | -2,135 | down |
| ElevenLabs voice min utilization (Paisaxe, Apr) | 0% | 0% | -> | -> |
| Revenue coverage (operational) | **0%** | 0% | -> | -> |
| Months of Twilio runway | ~13.2 mo | ~13.2 mo | -> | -> |

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Alert Level |
|---------|--------|------|-------|-------------|-------------|
| ElevenLabs | Characters (cycle, resets Apr 7) | 8,453 | 196,138 | **4.31%** | SAFE |
| ElevenLabs | Voice Minutes (Paisaxe, Apr) | 0.0 | 100 | **0%** | SAFE |
| Vercel | Monthly Visitors | ~low | 500,000 (Pro) | **<1%** | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | SAFE |

**All tier alerts cleared.** No service approaching its limit. Character cycle resets in 2 days (April 7) — after reset, a fresh cycle begins at 0 / 196,138.

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
| 51-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. Third consecutive month approaching zero revenue. |
| 47-day Paisaxe voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Platform appears dormant to users. |
| Archy surge — 5 convos on Apr 4 | **INFO** | Largest single-day Archy activity this cycle. 917 sec total, +2,135 chars consumed. Non-Paisaxe, no direct cost impact beyond shared character pool. |
| Twilio $0.24 balance drop (Apr 3-4) | **WATCH** | Balance went from $15.4546 to $15.2146 with no usage records. Did not continue on Apr 4-5. Likely a delayed phone number charge or regulatory fee. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual checks required monthly at [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing). |

**No platform cost-structure anomalies.** All cost anomalies are either informational or minor.

---

## Trend Analysis

### Comparison: Apr 4 -> Apr 5

| Metric | Apr 4 (03:00) | Apr 5 (03:00) | Change | Direction |
|--------|-------|-------|--------|-----------|
| Fixed costs/mo (operational) | $84.41 | $84.41 | -> | -> |
| Variable costs (MTD) | $0.00 | $0.00 | -> | -> |
| Daily burn rate | $2.81/day | $2.81/day | -> | -> |
| Paisaxe voice conversations (MTD) | 0 | 0 | -> | -> |
| All ElevenLabs conversations (MTD) | 7 | **12** | +5 | up |
| Characters used (cycle) | 6,318 (3.22%) | **8,453 (4.31%)** | +2,135 | up |
| SMS sent (MTD) | 0 | 0 | -> | -> |
| Day Pass net sales (MTD) | 0 | 0 | -> | -> |
| Twilio balance | $15.2146 | $15.2146 | -> | -> |
| Paisaxe voice dormancy streak | 46 days | **47 days** | +1 | down |
| Revenue drought streak | 50 days | **51 days** | +1 | down |
| Character reset countdown | 3 days | **2 days** | -1 | -> |

**Key observations:**

1. **Archy had its busiest day this cycle on April 4.** 5 conversations (4 done, 1 failed) totaling 917 seconds. This is the first day with more than 2 Archy conversations since March 29. Topics included "Summon Project Details" and "Security Alerts Explained." The 602-second conversation hit the max duration limit.

2. **Character consumption accelerating.** +2,135 chars on Apr 4 vs +1,138 on Apr 3. If Archy activity continues at this rate, the cycle will end at ~10,000-12,000 / 196,138 (still well under limit). Resets April 7 regardless.

3. **Coach agent dormant since Apr 3.** No new conversations. The 5 failures appear to have been a one-time testing session. No cost impact.

4. **Twilio balance stabilized at $15.2146.** The $0.24 drop from Apr 3 did not continue. Most likely explanation: delayed phone number billing or regulatory fee that hit the balance but hasn't appeared in Usage Records API yet.

5. **Day 51 of revenue drought, day 47 of Paisaxe voice silence.** No sign of reversal. Approaching 2 full calendar months without revenue.

### Monthly Cost History

| Month | Operational Fixed | Variable (known) | Total Operational | Revenue (net) | Coverage |
|-------|------------------|------------------|-------------------|---------------|----------|
| Feb 2026 | $84.41 | ~$2.75 | ~$87.16 | ~$11.34 | ~13.0% |
| Mar 2026 (final) | $84.41 | $1.15 | **$85.56** | **$0.00** | **0%** |
| Apr 2026 (day 5) | $84.41 | $0.00 so far | -- | $0.00 | 0% |

---

## Recommendations

### Immediate Actions (Priority)

1. **Check Anthropic billing manually** — Visit [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing). With development activity ongoing (Stripe v22 upgrade, ElevenLabs v1 upgrade, dep maintenance), Claude API usage may be non-trivial. Confirm actual vs. estimated $10/mo.

2. **Investigate the revenue and voice drought urgently** — 51 days with no sales and 47 days without a Paisaxe voice conversation:
   - Is the Pelayo voice widget rendering and accessible on production?
   - Is the Day Pass purchase flow functional?
   - Are there Vercel deployment logs showing errors?
   - Has organic traffic dropped? (PostHog / Vercel Analytics)

3. **Note: Character cycle resets April 7 (in 2 days)** — Informational. After reset, counter returns to 0/196,138. Fresh monitoring begins April 7.

### Near-Term Actions (April Planning)

4. **Monitor Archy activity post-reset** — Archy consumed 8,453 chars this cycle (most of it non-Paisaxe). After the April 7 reset, track whether the acceleration continues. At current rates (~2,000 chars/day when active), no risk of hitting the 196K limit, but worth watching if Archy becomes a daily tool.

5. **Evaluate Vercel Pro necessity** — With ~50 visitors/month, the Hobby tier (50K visitors free) would suffice. Downgrading saves $20/mo (23.7% of operational costs). Evaluate whether Pro features (per-minute cron, preview deployments, team features) justify the cost at this traffic level.

6. **Consider releasing the Twilio phone number** — Zero booking calls in 47 days. At $1.15/mo, the number costs $13.80/yr unused. If outbound booking is not actively generating revenue, consider releasing.

7. **April break-even check-in** — If no revenue by mid-April, evaluate whether to pause Vercel + Supabase Pro ($45/mo combined, 53.3% of operational costs).

### Long-Term Planning

8. **Revenue trajectory is critical** — Three consecutive zero-or-near-zero months (Jan, Feb, Mar). At $84.41/mo operational with $0 revenue, losing ~$2.81/day. Break-even requires ~3,150 monthly visitors at 5% Day Pass conversion — 63x current traffic. The platform is in an existential financial position if the trend continues through May.

9. **ElevenLabs remains appropriately sized** — February used 60/100 voice minutes (60%) at peak. Creator tier annual billing at $22.18/mo effective is efficient. No change warranted.

---

## Data Sources

| Source | Method | Last Queried |
|--------|--------|-------------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-04-05 03:00 UTC |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=15` | 2026-04-05 03:00 UTC |
| ElevenLabs Agents API | `/v1/convai/agents?page_size=50` | 2026-04-05 03:00 UTC |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json` | 2026-04-05 03:00 UTC |
| Twilio Balance API | `/Balance.json` | 2026-04-05 03:00 UTC |
| Config: `service-tiers.ts` | File read | 2026-04-05 |
| Config: `recurring-costs.ts` | File read | 2026-04-05 |
| Config: `forecast.ts` | File read | 2026-04-05 |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | -- |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-04-06.*
