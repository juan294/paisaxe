# Cost Analyst Report

> **Generated**: 2026-04-07 03:00:00 | **Period**: April 2026 (day 7 of 30) | **Status**: WATCH

---

## Executive Summary

**Day 7 of April — phone rental charged, character cycle resets today, no new voice activity.** The $1.15 Twilio phone number rental has been charged, dropping the balance from $15.2146 to $14.0646. This is the expected monthly billing event and resolves the direction of April variable spend: **$1.15 confirmed variable MTD**.

**ElevenLabs: no new conversations since April 5 (17:55 UTC)**. The character count remains at 23,591 / 196,138 (12.03%). The cycle resets **today at 14:15 UTC** — the cycle closes at 12.03% utilization, all from non-Paisaxe agents (Archy + Coach). After reset, a fresh cycle begins with 0 / 196,138.

**Revenue drought reaches 53 days** (since February 13). **Paisaxe voice silence: 49 days** (since February 17). No revenue in April. Fixed operational costs unchanged at $84.41/mo.

**Financial health: WATCH** — business concern only. No platform cost anomalies. All tier limits safe.

| Metric | Value | vs. Apr 6 |
|--------|-------|-----------|
| Total Fixed Costs (all) | $284.41/mo | → |
| Total Fixed Costs (operational) | **$84.41/mo** | → |
| Variable Costs (Apr MTD, confirmed) | **$1.15** | +$1.15 (phone rental charged) |
| Daily Burn Rate (Apr fixed) | **$2.81/day** | → |
| Revenue (Apr MTD) | **$0.00** | → |
| Twilio Balance | **$14.0646** | -$1.15 (phone rental billed) |
| ElevenLabs Characters | **23,591 / 196,138 (12.03%)** | → (no new activity) |
| ElevenLabs Voice Min (Paisaxe, Apr) | 0.0 / 100 | → |
| Character Reset | **April 7, 2026 14:15 UTC** | **TODAY** |
| Paisaxe Voice Silence | **49 days** | +1 |
| Revenue Drought | **53 days** | +1 |

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

*\*\*\*Twilio phone number rental confirmed charged on April 7: balance dropped $15.2146 → $14.0646 (-$1.15). Monthly billing event, expected.*

**Note**: Claude Code Max ($200/mo) is the primary development tool, categorized separately as "Development." Operational cost analysis focuses on running the live service.

### Variable / Usage-Based Costs (April 2026 MTD — Day 7)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Phone rental) | 1 number, April billing | **$1.15** | Balance delta |
| Twilio (SMS) | 0 messages | $0.00 | API |
| Twilio (Calls) | 0 minutes | $0.00 | API |
| Stripe (Processing Fees) | 0 charges | $0.00 | — |
| Anthropic (Claude API) | Unknown | Unknown | — |
| Voyage AI (Embeddings) | Unknown | Unknown | — |
| **Total Variable (Apr MTD, confirmed)** | | **$1.15** | |

### April 2026 MTD Total (Day 7)

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

### ElevenLabs Activity — April 2026 (full cycle view)

**No new conversations since April 5, 17:55 UTC.** The 20-result API window covers all April 5 activity. Full April picture reconstructed from daily reports:

| Date | Agent | Conversations | Outcome | Notes |
|------|-------|--------------|---------|-------|
| Apr 3 | Coach | 5 | All failed (init) | First Coach appearance |
| Apr 4 | Archy | 5 | Mixed | 4 done, 1 failed; ~917 sec total |
| Apr 5 | Archy | 14 | 8 done, 6 failed | 09:45–10:13 UTC; busiest session this cycle |
| Apr 5 | Coach | 6 | All failed (init) | 15:47–17:55 UTC; recurring pattern |
| Apr 6 | — | 0 | — | No activity |
| Apr 7 | — | 0 | — | No activity (as of 03:00 UTC) |
| **Total** | | **~30** | — | **0 Paisaxe conversations** |

**Paisaxe agents (Pelayo Visitor Guide, Pelayo Booking, Penny, Iris, Xander): 0 conversations in April.**

### ElevenLabs Character Usage

| Metric | Value | Change from Apr 6 |
|--------|-------|-------------------|
| Characters used (cycle) | **23,591 / 196,138 (12.03%)** | → (no new activity) |
| Character limit | 196,138 | → |
| **Next character reset** | **2026-04-07 14:15 UTC** | **TODAY — ~11 hrs** |
| Characters used (Apr, Paisaxe) | 0 | → |
| Characters remaining this cycle | 172,547 | → |

**Cycle summary**: Closing at ~23,591 chars (12.03%). After today's 14:15 UTC reset, fresh cycle begins at 0/196,138.

### ElevenLabs Subscription Details (from API — 2026-04-07)

| Field | Value |
|-------|-------|
| Tier | Creator |
| Billing period | Annual |
| Status | Active |
| Next invoice amount | $266.20 |
| Next invoice date | 2027-02-07 |
| Next character reset | **2026-04-07 14:15 UTC (today)** |

### ElevenLabs Agent Summary (current cycle — closing)

| Agent | Cycle Calls | Last Call | Status | Project |
|-------|------------|-----------|--------|---------|
| Archy | **~19** | Apr 5 10:13 UTC | Active (quiet) | Non-Paisaxe |
| Coach | **11** | Apr 5 17:55 UTC | Failing (all init failures) | Non-Paisaxe |
| Pelayo (Visitor Guide) | 0 | Feb 17 | Dormant | Paisaxe |
| Pelayo (Booking) | 0 | Feb 10 | Dormant | Paisaxe |
| Penny, Iris, Xander | 0 | Never | Dormant | Paisaxe |

### Twilio Communications

| Metric | Apr 2026 (days 1-7) | Mar 2026 (final) | Change |
|--------|---------------------|-----------------|--------|
| SMS Sent | 0 | 0 | → |
| Calls | 0 | 0 | → |
| Usage Cost | $0.00 | $0.00 | → |
| Phone Rental | **$1.15** (charged Apr 7) | $1.15 | Monthly expected |
| Balance | **$14.0646** | $15.4546 | -$1.40 MTD |

**Twilio balance reconciliation:**
- Apr 1 (start): ~$15.4546
- Apr 3-4: -$0.24 (unexplained — possible regulatory fee not captured in usage records)
- Apr 7: -$1.15 (phone number rental, confirmed by exact match)
- **Current: $14.0646** — at $1.15/mo, ~12.2 months of runway remaining (from current balance)

**Note**: The $0.24 drop from Apr 3-4 remains unexplained. Twilio Usage Records API shows $0.00 across all 50 categories. Most likely explanation: a regulatory surcharge, local number porting fee, or billing lag not yet reflected in the Usage Records API. Balance has been stable at $14.0646 since the phone rental was charged.

### Stripe Revenue

| Metric | Apr 2026 (days 1-7) | Mar 2026 (final) | Feb 2026 (final) |
|--------|---------------------|-----------------|-----------------|
| Net Sales | 0 | 0 | 6 |
| Gross Revenue | $0.00 | $0.00 | $13.93 |
| Net Revenue | $0.00 | $0.00 | $9.98 |

**53-day revenue drought** — No Day Pass sales since February 13.

---

## Cost Efficiency

| Metric | Current (Apr 7) | Previous (Apr 6) | Change | Trend |
|--------|----------------|------------------|--------|-------|
| Fixed operational cost/mo | $84.41 | $84.41 | → | → |
| Daily burn rate (fixed) | **$2.81/day** | $2.81/day | → | → |
| April variable spend (confirmed) | **$1.15** | $0.00 | +$1.15 | (expected billing event) |
| Cost per voice conversation (Feb actuals) | ~$0.43 | ~$0.43 | → | → |
| Cost per voice minute (Feb actuals) | ~$0.37 | ~$0.37 | → | → |
| ElevenLabs char utilization (closing cycle) | **12.03%** | 12.03% | → | → |
| ElevenLabs voice min utilization (Paisaxe, Apr) | 0% | 0% | → | → |
| Revenue coverage (operational) | **0%** | 0% | → | → |
| Months of Twilio runway | ~12.2 mo | ~13.2 mo | -1.0 | (rental charged) |

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Alert Level |
|---------|--------|------|-------|-------------|-------------|
| ElevenLabs | Characters (cycle — resets today) | 23,591 | 196,138 | **12.03%** | SAFE |
| ElevenLabs | Voice Minutes (Paisaxe, Apr) | 0.0 | 100 | **0%** | SAFE |
| Vercel | Monthly Visitors | ~low | 500,000 (Pro) | **<1%** | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | SAFE |

**All tier alerts cleared.** Character cycle resets today — new cycle begins at 0/196,138. If Archy continues at ~23K chars/cycle, utilization stays well within the 196K limit.

### Upgrade Trigger Points

| Service | Current Tier | Trigger | Next Tier | Cost Jump |
|---------|-------------|---------|-----------|-----------|
| ElevenLabs | Creator ($22.18/mo eff.) | >100 min/mo | Scale ($99/mo) | +$77/mo |
| Supabase | Pro ($25/mo) | >8 GB storage | Team ($599/mo) | +$574/mo |
| PostHog | Free ($0) | >1M events/mo | Pay-as-you-go | Variable |

---

## Scaling Forecast

Based on `src/lib/costs/forecast.ts` logic, using February 2026 actuals as baseline (no April variable data to use):

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
| 53-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. Seven full weeks of zero revenue. |
| 49-day Paisaxe voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Platform dormant to users. |
| Twilio $0.24 drop (Apr 3-4, still unexplained) | **WATCH** | $0.24 balance drop not reflected in Usage Records API across all 50 categories. Possible regulatory surcharge or billing lag. Balance otherwise stable after April phone rental. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual checks required monthly. Significant agent dev activity ongoing — actual Claude API spend may exceed $10/mo estimate. |
| Coach agent persistent initialization failures | **INFO** | 11 total failed conversations this cycle (Apr 3: 5 + Apr 5: 6). All fail within 0–14 sec, 0 characters consumed. Non-Paisaxe, no cost impact. Two usage clusters suggest recurring test sessions in a separate project. |

**No platform cost-structure anomalies.** The $1.15 Twilio charge is the expected monthly billing event. ElevenLabs cycle closes cleanly today at 12.03% utilization.

---

## Trend Analysis

### Comparison: Apr 6 → Apr 7

| Metric | Apr 6 (03:00) | Apr 7 (03:00) | Change | Direction |
|--------|-------|-------|--------|-----------|
| Fixed costs/mo (operational) | $84.41 | $84.41 | → | → |
| Variable costs (confirmed MTD) | $0.00 | **$1.15** | +$1.15 | (billing event) |
| Daily burn rate (fixed) | $2.81/day | $2.81/day | → | → |
| Paisaxe voice conversations (MTD) | 0 | 0 | → | → |
| New ElevenLabs conversations (since Apr 6) | 0 | **0** | → | → |
| Characters used (cycle) | 23,591 (12.03%) | **23,591 (12.03%)** | → | → |
| Twilio balance | $15.2146 | **$14.0646** | -$1.15 | (expected billing) |
| SMS sent (MTD) | 0 | 0 | → | → |
| Day Pass net sales (MTD) | 0 | 0 | → | → |
| Paisaxe voice dormancy streak | 48 days | **49 days** | +1 | down |
| Revenue drought streak | 52 days | **53 days** | +1 | down |
| ElevenLabs cycle reset | Today | **Today 14:15 UTC** | — | → |

**Key observations:**

1. **April phone rental confirmed: $1.15 charged.** Twilio balance moved from $15.2146 to $14.0646 — a drop of exactly $1.15, matching the monthly phone number rental. This confirms April variable spend at $1.15. The Twilio Usage Records API continues to show $0.00 across all 50 categories; phone number rental billing does not surface there.

2. **No ElevenLabs activity since April 5.** The 20-result conversation API window shows all activity stopping at April 5 17:55 UTC (Coach agent failures). Character count held at 23,591 for two consecutive days. Archy and Coach are both quiet. Cycle closes today at 12.03%.

3. **Character reset is today (April 7, 14:15 UTC).** After reset, the new cycle begins. If Archy resumes at ~23K chars/28-day cycle (~820 chars/day), the new cycle would reach ~22,960 chars by end of April — still well within 196K. No tier risk.

4. **Revenue drought at 53 days — deepening pattern.** Feb: $9.98 net → Mar: $0.00 → Apr: $0.00 (day 7). Three months, ~$256 cumulative operational loss since February. The trajectory is negative with no reversal signal.

5. **The unexplained $0.24 Twilio drop (Apr 3-4) remains unresolved.** Today's $1.15 drop is a separate, expected billing event. The $0.24 is likely a regulatory fee or number administration charge not captured in the Usage Records endpoint.

### Monthly Cost History

| Month | Operational Fixed | Variable (confirmed) | Total Operational | Revenue (net) | Coverage |
|-------|------------------|----------------------|-------------------|---------------|----------|
| Feb 2026 | $84.41 | ~$2.75 | ~$87.16 | ~$9.98 | ~11.4% |
| Mar 2026 (final) | $84.41 | $1.15 | **$85.56** | **$0.00** | **0%** |
| Apr 2026 (day 7) | $84.41 | $1.15 | **$85.56** | $0.00 | 0% |

---

## Recommendations

### Immediate Actions (Priority)

1. **Check Anthropic billing manually** — Visit [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing). With significant agent development activity this cycle (Stripe v22 upgrade, ElevenLabs v1.0.2, SDK upgrades, coverage tests), Claude API usage may materially exceed the $10/mo estimate.

2. **Investigate the revenue and voice drought — 53 days is critical** — This is the most urgent concern:
   - Is the Pelayo voice widget rendering and accessible on production?
   - Is the Day Pass purchase flow functional end-to-end?
   - Are Vercel deployment logs showing errors on production requests?
   - Has organic traffic dropped? (PostHog / Vercel Analytics)
   - The QA Agent has confirmed browser journeys pass in E2E testing — but production behavior remains unverified.

3. **Monitor new ElevenLabs cycle post-reset** — Cycle resets today at 14:15 UTC. Track whether Archy activity resumes in the new cycle and at what rate. First data point will be available in tomorrow's report.

### Near-Term Actions (April Planning)

4. **April mid-month break-even check (April 15)** — At $2.81/day fixed burn and $0 revenue, the decision point approaches. If no revenue by April 15 (~$42.15 burned in April), evaluate:
   - Pause Vercel Pro ($20/mo) — downgrade to Hobby if Pro features (per-minute cron, preview deployments) are not critical during dormancy
   - Pause Supabase Pro ($25/mo) — evaluate if Pro features are needed at current scale

5. **Resolve the Twilio $0.24 anomaly** — Check Twilio billing history/invoices directly at https://console.twilio.com for the April 3-4 period. The $0.24 is likely a regulatory fee (Telecom Regulatory Fee ~$0.24/mo for US local numbers). If confirmed, this is expected and recurring — update the recurring-costs.ts config accordingly.

6. **Consider releasing the Twilio phone number** — 49 days without a booking call. At $1.15/mo + any regulatory fees, the number costs ~$16/yr unused. If outbound booking is not generating revenue, releasing the number saves ~$1.15–$1.39/mo.

### Long-Term Planning

7. **Revenue trajectory is critical** — Three consecutive near-zero or zero-revenue months. At $84.41/mo operational with $0 revenue: ~$2.81/day in losses. Break-even requires ~3,150 monthly visitors at 5% Day Pass conversion — 63x current traffic (~50 visitors/mo). Total cumulative operational loss since launch (Feb–Apr 7): ~$256. The platform requires a growth event or cost reduction to achieve sustainability.

8. **ElevenLabs remains appropriately sized** — February used 60/100 voice minutes (60%) at peak. Creator tier annual at $22.18/mo effective is efficient. No change warranted. Scale tier ($99/mo) only needed if sustained voice traffic exceeds 100 min/mo.

---

## Data Sources

| Source | Method | Last Queried | Status |
|--------|--------|-------------|--------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-04-07 03:00 UTC | ✅ OK |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=20` | 2026-04-07 03:00 UTC | ✅ OK |
| Twilio Balance API | `/Balance.json` | 2026-04-07 03:00 UTC | ✅ OK |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json` | 2026-04-07 03:00 UTC | ✅ OK |
| ElevenLabs Character Stats API | `/v1/usage/character-stats` | 2026-04-07 03:00 UTC | ❌ 422 (requires start_unix + end_unix params) |
| Config: `service-tiers.ts` | File read | 2026-04-07 | ✅ OK |
| Config: `recurring-costs.ts` | File read | 2026-04-07 | ✅ OK |
| Config: `forecast.ts` | File read | 2026-04-07 | ✅ OK |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | — | ⚠️ Manual check required |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-04-08.*
