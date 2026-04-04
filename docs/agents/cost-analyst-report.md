# Cost Analyst Report

> **Generated**: 2026-04-04 03:00:00 | **Period**: April 2026 (day 4 of 30) | **Status**: WATCH

---

## Executive Summary

**Day 4 of April — zero Paisaxe revenue, 50-day drought, two new developments.** The revenue drought reaches 50 days (since February 13) and Paisaxe voice silence extends to 46 days (since February 17). However, two changes occurred on April 3 **after** yesterday's report:

1. **"Coach" agent activity detected**: A new ElevenLabs agent (agent_8201kmhr2vbef328b4dcey3wddhk, named "Coach") had 5 failed conversations between 11:07–14:16 UTC on April 3. This agent is not part of the Paisaxe project and was not present in previous reports. All 5 Coach conversations failed (0–7 sec duration). Worth monitoring.

2. **Archy active on April 3 afternoon**: Two successful Archy conversations on April 3 (19 sec + 144 sec = 163 sec total), accounting for the +1,138 character increase since yesterday's 03:00 report.

3. **Twilio balance unexpectedly dropped $0.24**: Balance is now $15.2146 (was $15.4546). No corresponding charges appear in the Usage Records API. Cause unknown — flagged as minor anomaly.

**ElevenLabs characters now at 6,318 / 196,138 (3.22%)**, up from 5,180 (2.64%) on April 3. Character cycle resets in **3 days (April 7)**.

**Fixed operational costs remain at $84.41/mo. No Paisaxe-specific variable charges have accrued in April.** Financial health: WATCH — business concern only, no platform cost anomalies.

| Metric | Value | vs. Apr 3 |
|--------|-------|-----------|
| Total Fixed Costs (all) | $284.41/mo | → |
| Total Fixed Costs (operational) | **$84.41/mo** | → |
| Variable Costs (Apr MTD, known) | $0.00 | → |
| Daily Burn Rate (Apr) | **$2.81/day** | → |
| Revenue (Apr MTD) | **$0.00** | → |
| Revenue (Mar final) | $0.00 | → |
| Twilio Balance | **$15.2146** | ↓ -$0.24 |
| ElevenLabs Characters | **6,318 / 196,138 (3.22%)** | ↑ +1,138 (+0.58%) |
| ElevenLabs Voice Min (Paisaxe, Apr so far) | 0.0 / 100 | → |
| Character Reset | **April 7, 2026 14:15 UTC** | In 3 days |
| Paisaxe Voice Silence | **46 days** | +1 |
| Revenue Drought | **50 days** | +1 |

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

*\*ElevenLabs Creator billed annually. Effective rate $22.18/mo. Next annual invoice: $266.20 on 2027-02-07 (confirmed via API: next_payment_attempt_unix = 1802012845).*

*\*\*Anthropic $10/mo is an estimate from config. No billing API available on personal accounts. Check [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing) manually.*

*\*\*\*Twilio phone number rental ($1.15/mo). April charge pending (month-end billing).*

**Note**: Claude Code Max ($200/mo) is the primary development tool, categorized separately as "Development." Operational cost analysis focuses on running the live service.

### Variable / Usage-Based Costs (April 2026 MTD — Day 4)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Phone rental) | Pending (month-end billing) | ~$1.15 expected | Config |
| Twilio (SMS) | 0 messages | $0.00 | API |
| Twilio (Calls) | 0 minutes | $0.00 | API |
| Stripe (Processing Fees) | 0 charges | $0.00 | — |
| Anthropic (Claude API) | Unknown | Unknown | — |
| Voyage AI (Embeddings) | Unknown | Unknown | — |
| **Total Variable (Apr MTD, confirmed)** | | **$0.00** | |

*Note: Twilio balance dropped $0.24 (from $15.4546 to $15.2146) with no usage records to explain it. See Anomalies.*

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

### ElevenLabs Conversations (April 3–4, post yesterday's report)

| Conversation | Agent | Status | Start (UTC) | Duration |
|-------------|-------|--------|-------------|----------|
| conv_3201kn9jtkqdes6vegk41v0t22kq | Archy | done | 2026-04-03 11:49 | 144 sec |
| conv_7801kn9gzwwtfv5tz6qaymgyfhby | Archy | done | 2026-04-03 11:17 | 19 sec |
| conv_9801kn9v714febyvkd6hhem46xkv | **Coach** | failed | 2026-04-03 14:16 | 7 sec |
| conv_3701kn9hr747ej7vd2kd36sqp20a | **Coach** | failed | 2026-04-03 11:30 | 0 sec |
| conv_3801kn9h137zevwsqbaqq42e8f0x | **Coach** | failed | 2026-04-03 11:18 | 0 sec |
| conv_3901kn9gpr2ge71b97hfgbh5pw4d | **Coach** | failed | 2026-04-03 11:12 | 0 sec |
| conv_7901kn9gdqfffrr8aez7471vtrvf | **Coach** | failed | 2026-04-03 11:07 | 0 sec |

**"Coach" agent (agent_8201kmhr2vbef328b4dcey3wddhk)**: New agent, not part of Paisaxe project. 5 consecutive failures on April 3 morning. All failed at 0 seconds (initialization failure) except one at 7 seconds. No characters consumed (failed before TTS). Likely a separate project Juan is building or testing.

**Archy**: 2 successful conversations totaling 163 seconds ≈ 2.7 minutes. Accounts for +1,138 character increase.

### ElevenLabs Monthly Voice History

| Period | Conversations | Successful | Failed | Duration | Paisaxe |
|--------|--------------|-----------|--------|----------|---------|
| Apr 2026 (days 1–4) | **7** (post-report) | 2 (Archy) | 5 (Coach) | 163 sec | **0** |
| Mar 2026 (final) | ~4 (Archy, Mar 29) | 3 | 1 | ~602 sec peak | **0** |
| Feb 2026 (final) | 51 (Paisaxe) | 47 | 4 | 60.0 min | **60 min** |

**Zero Paisaxe voice activity since February 17** (46 consecutive days). No Paisaxe Pelayo conversations in March or April.

### ElevenLabs Character Usage

| Metric | Value | Note |
|--------|-------|------|
| Characters used (current cycle) | **6,318 / 196,138 (3.22%)** | +1,138 from Apr 3 03:00 (Archy activity) |
| Character limit | 196,138 | Unchanged |
| Next character reset | **2026-04-07 14:15 UTC** | In 3 days |
| Characters used (Apr, Paisaxe) | 0 | No Paisaxe activity |
| Characters remaining | 189,820 | Well within limit |

### ElevenLabs Subscription Details (from API — 2026-04-04)

| Field | Value |
|-------|-------|
| Tier | Creator |
| Billing period | Annual |
| Status | Active |
| Next invoice amount | $266.20 |
| Next invoice date | 2027-02-07 |

### Twilio Communications

| Metric | Apr 2026 (days 1–4) | Mar 2026 (final) | Change |
|--------|---------------------|-----------------|--------|
| SMS Sent | 0 | 0 | → |
| Calls | 0 | 0 | → |
| Usage Cost | $0.00 | $0.00 | → |
| Balance | **$15.2146** | $15.4546 | **↓ -$0.24 (unexplained)** |

Phone rental ~$1.15 expected at month end. At current burn rate (~$1.15/mo), ~13.2 months of Twilio runway remaining.

### Stripe Revenue

| Metric | Apr 2026 (days 1–4) | Mar 2026 (final) | Feb 2026 (final) |
|--------|---------------------|-----------------|-----------------|
| Net Sales | 0 | 0 | 6 |
| Gross Revenue | $0.00 | $0.00 | $13.93 |
| Net Revenue | $0.00 | $0.00 | $9.98 |

**50-day revenue drought** — No Day Pass sales since February 13.

---

## Cost Efficiency

| Metric | Current (Apr 4) | Previous (Apr 3) | Change | Trend |
|--------|----------------|------------------|--------|-------|
| Fixed operational cost/mo | $84.41 | $84.41 | → | → |
| Daily burn rate | **$2.81/day** | $2.81/day | → | → |
| Cost per voice conversation (Feb actuals) | ~$0.43 | ~$0.43 | → | → |
| Cost per voice minute (Feb actuals) | ~$0.37 | ~$0.37 | → | → |
| ElevenLabs char utilization (current cycle) | **3.22%** | 2.64% | ↑ +0.58% | ↑ |
| ElevenLabs char headroom | **189,820** | 190,958 | ↓ -1,138 | ↓ |
| ElevenLabs voice min utilization (Paisaxe, Apr) | 0% | 0% | → | → |
| Revenue coverage (operational) | **0%** | 0% | → | → |
| Months of Twilio runway | ~13.2 mo | ~13.4 mo | ↓ | ↓ |

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Alert Level |
|---------|--------|------|-------|-------------|-------------|
| ElevenLabs | Characters (cycle, resets Apr 7) | 6,318 | 196,138 | **3.22%** | SAFE |
| ElevenLabs | Voice Minutes (Paisaxe, Apr) | 0.0 | 100 | **0%** | SAFE |
| Vercel | Monthly Visitors | ~low | 500,000 (Pro) | **<1%** | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | SAFE |

**All tier alerts cleared.** No service approaching its limit. Character cycle resets in 3 days (April 7) — after reset, a fresh cycle begins at 0 / 196,138.

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

*\*At 3x: Voice minutes (180) exceed Creator limit (100 min). Requires Scale tier ($99/mo). Total: ~$52 infra + $10 AI + $99 voice + ~$5 SMS ≈ $170.*

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
| 50-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. Third consecutive month with zero revenue. |
| 46-day Paisaxe voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Platform appears dormant to users. |
| **Twilio balance drop $0.24** | **WATCH** | Balance: $15.4546 → $15.2146. No corresponding usage records (SMS: 0, Calls: 0, all categories at $0). Cause unknown. Could be phone number billing, regulatory fee, or Twilio data lag. |
| **"Coach" agent — 5 failed convos** | **INFO** | New agent (agent_8201kmhr2vbef328b4dcey3wddhk, "Coach") had 5 consecutive failures on Apr 3. Not a Paisaxe project agent. All failed at initialization (0–7 sec). No characters consumed. Separate project or test. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual checks required monthly at [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing). |

**No platform cost-structure anomalies.** All cost anomalies are either informational or minor.

---

## Trend Analysis

### Comparison: Apr 3 → Apr 4

| Metric | Apr 3 (03:00) | Apr 4 (03:00) | Change | Direction |
|--------|-------|-------|--------|-----------|
| Fixed costs/mo (operational) | $84.41 | $84.41 | → | → |
| Variable costs (MTD) | $0.00 | $0.00 | → | → |
| Daily burn rate | $2.81/day | $2.81/day | → | → |
| Paisaxe voice conversations (MTD) | 0 | 0 | → | → |
| All ElevenLabs conversations (MTD) | 0 | **7** (post-report) | +7 | ↑ |
| Characters used (cycle) | 5,180 (2.64%) | **6,318 (3.22%)** | +1,138 | ↑ |
| SMS sent (MTD) | 0 | 0 | → | → |
| Day Pass net sales (MTD) | 0 | 0 | → | → |
| Twilio balance | $15.4546 | **$15.2146** | -$0.24 | ↓ |
| Paisaxe voice dormancy streak | 45 days | **46 days** | +1 | ↓ |
| Revenue drought streak | 49 days | **50 days** | +1 | ↓ |
| Character reset countdown | 4 days | **3 days** | -1 | → |

**Key observations:**

1. **First non-zero ElevenLabs activity in April.** 7 conversations appeared on April 3 afternoon (all after yesterday's 03:00 report): 2 successful Archy, 5 failed "Coach". Archy consumed +1,138 characters (~2.7 min at typical TTS speed). Coach consumed 0 (all failed at init).

2. **"Coach" agent is new** — not observed in any previous reports. agent_8201kmhr2vbef328b4dcey3wddhk first appeared in the ConvAI conversation list today. Appears to be a separate project being tested. No cost impact (all failed), but worth monitoring.

3. **Twilio balance declined $0.24 with no usage explanation.** The Usage Records API shows $0.00 across all 50 categories for April. The $0.24 drop cannot be attributed to SMS, calls, or visible fees. Possible explanations: phone number billing date occurred (but $0.24 ≠ $1.15), regulatory fee, or API reporting lag for phone number rental. Monitoring.

4. **Day 50 of revenue drought, day 46 of Paisaxe voice silence.** No sign of reversal.

5. **No cost-impacting changes from the development cycle.** Security agent confirmed next@16.2.2 upgrade applied (commit `70765d7` shows next 16.2.2 already installed). posthog-js updated to 1.364.6. Neither has cost implications.

### Monthly Cost History

| Month | Operational Fixed | Variable (known) | Total Operational | Revenue (net) | Coverage |
|-------|------------------|------------------|-------------------|---------------|----------|
| Feb 2026 | $84.41 | ~$2.75 | ~$87.16 | ~$11.34 | ~13.0% |
| Mar 2026 (final) | $84.41 | $1.15 | **$85.56** | **$0.00** | **0%** |
| Apr 2026 (day 4) | $84.41 | $0.00 so far | — | $0.00 | 0% |

---

## Recommendations

### Immediate Actions (Priority)

1. **Check Anthropic billing manually** — Visit [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing). With development activity ongoing (security fixes, dep upgrades), Claude API usage may be non-trivial. Confirm actual vs. estimated $10/mo.

2. **Investigate the Twilio $0.24 balance drop** — No matching usage records found. Check the Twilio console directly for any charges, regulatory fees, or phone number billing events that don't appear in the standard Usage Records API response.

3. **Investigate the revenue and voice drought urgently** — 50 days with no sales and 46 days without a Paisaxe voice conversation:
   - Is the Pelayo voice widget rendering and accessible on production?
   - Is the Day Pass purchase flow functional?
   - Are there Vercel deployment logs showing errors?
   - Has organic traffic dropped? (PostHog / Vercel Analytics)

4. **Note: Character cycle resets April 7 (in 3 days)** — Informational. After reset, counter returns to 0/196,138. Fresh monitoring begins April 7.

### Near-Term Actions (April Planning)

5. **Monitor "Coach" agent** — New agent appeared in ElevenLabs account. All April 3 conversations failed. Not a Paisaxe agent. No cost impact yet — but if "Coach" becomes active with successful conversations, it will consume characters from the shared Creator plan limit (196,138/cycle). Track in future reports.

6. **Evaluate Vercel Pro necessity** — With ~50 visitors/month, the Hobby tier (50K visitors free) would suffice. Downgrading saves $20/mo (23.7% of operational costs). Evaluate whether Pro features justify the cost at this traffic level.

7. **Consider releasing the Twilio phone number** — Zero booking calls in 46 days. At $1.15/mo, the number costs $13.80/yr unused. If outbound booking is not actively generating revenue, consider releasing.

8. **April break-even check-in** — If no revenue by mid-April, evaluate whether to pause Vercel + Supabase Pro ($45/mo combined, 53.3% of operational costs).

### Long-Term Planning

9. **Revenue trajectory is critical** — Three consecutive zero-or-near-zero months (Jan, Feb, Mar). At $84.41/mo operational with $0 revenue, losing ~$2.81/day. Break-even requires ~3,150 monthly visitors at 5% Day Pass conversion — 63x current traffic. The platform is in an existential financial position if the trend continues through May.

10. **ElevenLabs remains appropriately sized** — February used 60/100 voice minutes (60%) at peak. Creator tier annual billing at $22.18/mo effective is efficient. No change warranted.

---

## Data Sources

| Source | Method | Last Queried |
|--------|--------|-------------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-04-04 03:00 UTC |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=10` | 2026-04-04 03:00 UTC |
| ElevenLabs Agents API | `/v1/convai/agents?page_size=50` | 2026-04-04 03:00 UTC |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json` | 2026-04-04 03:00 UTC |
| Twilio Balance API | `/Balance.json` | 2026-04-04 03:00 UTC |
| Config: `service-tiers.ts` | File read | 2026-04-04 |
| Config: `recurring-costs.ts` | File read | 2026-04-04 |
| Config: `forecast.ts` | File read | 2026-04-04 |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | — |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-04-05.*
