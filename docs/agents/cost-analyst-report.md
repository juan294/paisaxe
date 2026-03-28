# Cost Analyst Report

> **Generated**: 2026-03-28 | **Period**: March 2026 (MTD, 28 days) + February 2026 (final) | **Status**: WATCH

---

## Executive Summary

**Platform dormancy extends — 39 days without a Paisaxe voice conversation and 43 days without revenue.** No Pelayo conversations since February 17, no Day Pass sales since February 13. All Paisaxe usage metrics remain at zero for March. The revenue drought has now reached the **43-day mark** — exceeding one full calendar month by 15 days.

**Cross-project ElevenLabs usage continues growing.** The shared ElevenLabs account now shows 5,124 / 196,138 characters used (2.61%), up from 3,948 yesterday (+1,176 characters). All consumption is from the "Archy" agent (a separate project), with 10 recent conversations visible on March 26-27. Paisaxe-specific voice activity remains zero.

**Fixed costs accrue regardless.** Twenty-eight days into March, ~$76.24 in operational fixed costs have accrued against $0 revenue. March is now 90% complete with only 3 days remaining. The platform continues operating at 100% loss.

**March will close with $0 revenue.** Only 3 days remain. This will be the first complete calendar month with zero income since launch.

**Financial health: WATCH** — Extended inactivity continues. Costs are stable and predictable. No variable cost anomalies. Revenue drought now at 43 days — exceeding one full calendar month by 15 days.

| Metric | Value | vs. Mar 27 |
|--------|-------|-----------|
| Total Fixed Costs (all) | $284.41/mo | -- |
| Total Fixed Costs (operational) | **$84.41/mo** | -- |
| Variable Costs (Mar MTD) | $1.15 | -- |
| Total Burn (Mar projected, operational) | ~$85.56 | -- |
| Revenue (Mar MTD) | $0.00 | -- |
| Revenue (Feb final) | $13.93 gross / $9.98 net (~$10.78) | -- |
| Twilio Balance | **$15.45** | -- ($15.4546) |
| ElevenLabs Characters | **5,124 / 196,138 (2.61%)** | +1,176 (non-Paisaxe) |
| ElevenLabs Voice Min (Feb final) | 60.0 / 100 | -- |
| ElevenLabs Voice Min (Mar) | **0.0 / 100** | -- |

---

## Current Costs — Per-Service Breakdown

### Fixed / Recurring Costs

| Service | Tier | Monthly Cost | Category | Since | Change vs Mar 27 |
|---------|------|-------------|----------|-------|-----------------|
| Claude Code Max | Max (20x Pro) | $200.00 | Development | 2026-01-27 | -- |
| Supabase | Pro | $25.00 | Infrastructure | 2025-01 | -- |
| ElevenLabs | Creator (annual) | $22.18* | AI / Voice | 2026-02 | -- |
| Vercel | Pro | $20.00 | Infrastructure | 2026-02-13 | -- |
| Anthropic Claude | Prepaid credits | $10.00** | AI | 2025-12 | -- |
| GitHub Pro | Pro | $4.00 | Infrastructure | 2026-02-06 | -- |
| AWS Domains | -- | $2.08 | Infrastructure | 2025-01 | -- |
| Twilio Phone Number | -- | $1.15*** | Communications | 2026-02 | -- |
| PostHog | Free | $0.00 | Analytics | -- | -- |
| **Total Fixed (all)** | | **$284.41** | | | **--** |
| **Total Fixed (operational)** | | **$84.41** | | | **--** |

*\*ElevenLabs Creator billed annually at $220/yr ($266.20 with tax). Effective rate ~$22.18/mo. Next annual invoice: $266.20 (~Feb 7, 2027).*

*\*\*Anthropic $10/mo is an estimate from config. No billing API available on personal accounts. Check [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing) manually.*

*\*\*\*Twilio phone number rental confirmed at $1.15/mo via API (`phonenumbers-local` category: 1 number, $1.15). Balance unchanged at $15.4546 — charge reflected in usage records but not yet deducted from balance.*

**Note**: Claude Code Max ($200/mo) is the primary development tool cost, categorized separately as "Development." Operational cost analysis focuses on the cost of running the live service.

### Variable / Usage-Based Costs (March 2026 MTD)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Phone rental) | 1 number | $1.15 | API (confirmed) |
| Twilio (SMS) | 0 messages | $0.00 | API |
| Twilio (Calls) | 0 minutes | $0.00 | API |
| Stripe (Processing Fees) | 0 charges | $0.00 | -- |
| Anthropic (Claude API) | Unknown | Unknown | -- |
| Voyage AI (Embeddings) | Unknown | Unknown | -- |
| **Total Variable** | | **$1.15** | |

*All Twilio categories at $0.00 except phone rental ($1.15). API data as of 2026-03-28T02:01 UTC. Balance remains $15.4546.*

### February 2026 Final Costs (confirmed)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (SMS outbound) | 17 segments | $1.49 | API |
| Twilio (Media stream) | 23 minutes | $0.09 | API |
| Twilio (Amazon Polly TTS) | 3 units | $0.002 | API |
| Twilio (Phone number) | 1 number | $1.15 | API |
| Stripe (Processing Fees) | 7 charges, 1 refund | ~$2.12 | -- |
| **Total Variable (Feb)** | | **~$2.75** | |

---

## Usage Metrics

### ElevenLabs Voice Conversations

| Period | Conversations | Successful | Failed/Init | Duration | Avg Duration |
|--------|--------------|-----------|-------------|----------|-------------|
| Mar 2026 (MTD, 28 days) | **0** | 0 | 0 | 0.0 min | -- |
| Feb 2026 (final, 28 days) | 51 | 47 | 4 | 60.0 min | 76.6 sec |
| **Change** | **-51** | **-47** | **-4** | **-60.0 min** | **--** |

**Zero Paisaxe voice activity since February 17** (39 consecutive days). The last Paisaxe conversation was a 16-second Visitor Guide session at 08:59 UTC on Feb 17, confirmed via ConvAI API (conv_3101khnd78cze9m9j76e8qk2rs3x).

**Account-wide activity increasing**: 10 recent conversations from the "Archy" agent (a separate project) visible on March 26-27. Mix of successful (7) and failed (3, including LLM generation failures). Total duration ~16 minutes. These do NOT represent Paisaxe usage but continue consuming from the shared ElevenLabs character quota.

**February final by agent type:**

| Agent | Conversations | Duration | Avg Duration |
|-------|--------------|----------|-------------|
| Pelayo (Visitor Guide) | 33 | 47.2 min | 98.3 sec |
| Pelayo (Booking) | 18 | 12.8 min | 52.9 sec |

### ElevenLabs Character Usage

| Metric | Value | Note |
|--------|-------|------|
| Characters used (current cycle) | **5,124 / 196,138 (2.61%)** | Up from 3,948 (+1,176 non-Paisaxe) |
| Character limit | 196,138 | Unchanged |
| Character reset (previous) | March 7, 2026 at 14:07 UTC | Completed |
| Next character reset | **~April 5, 2026 at 14:35 UTC** | unix 1775571305 |
| Characters used (March, Paisaxe-only) | 0 | No Paisaxe voice activity |

### ElevenLabs Subscription Details (from API)

| Field | Value |
|-------|-------|
| Tier | Creator |
| Billing period | Annual |
| Status | Active |
| Voice slots | 0 / 30 used |
| Professional voice slots | 0 / 1 used |
| Next invoice amount | $266.20 (incl. tax) |
| Subtotal | $220.00 |

### Twilio Communications

| Metric | March (28 days) | February (final) | Change |
|--------|----------------|-----------------|--------|
| SMS Sent | 0 | 6 (17 segments) | -6 |
| Usage Cost | $0.00 | $1.49 | -$1.49 |
| Phone Rental | $1.15 (API confirmed) | $1.15 | -- |
| Media Stream | 0 min | 23 min ($0.09) | -23 min |
| Calls | 0 | 0 | -- |
| Balance | **$15.45** | $18.20 (start of Feb) | **-$2.75** |

Balance unchanged at $15.4546 since March 8. Phone rental charge visible in usage records ($1.15) but balance not yet decremented. At the current rate (zero SMS, $1.15/mo phone rental only), the $15.45 balance lasts ~13.4 months.

### Stripe Revenue

| Metric | March (28 days) | February (final) | Change |
|--------|----------------|-----------------|--------|
| Net Sales | 0 | 6 | -6 |
| Gross Revenue | $0.00 | $13.93 | -$13.93 |
| Net Revenue | $0.00 | $9.98 | -$9.98 |

**43-day revenue drought** — No Day Pass sales since February 13. Well past one full calendar month without income (exceeds by 15 days). Longest dry spell since launch.

---

## Cost Efficiency

| Metric | Current (Mar 28) | Previous (Mar 27) | Change | Trend |
|--------|-----------------|-------------------|--------|-------|
| Fixed operational cost/mo | $84.41 | $84.41 | -- | FLAT |
| Total monthly burn (operational) | ~$85.56 | ~$85.56 | -- | FLAT |
| Cost per voice conversation (Feb) | ~$0.43 | ~$0.43 | -- | FLAT |
| Cost per voice minute (Feb) | ~$0.37 | ~$0.37 | -- | FLAT |
| ElevenLabs char utilization (current cycle) | **2.61%** | 2.01% | +0.60% | UP (non-Paisaxe) |
| ElevenLabs char headroom | **191,014** | 192,190 | -1,176 | DOWN (non-Paisaxe) |
| ElevenLabs voice min utilization (Feb final) | 60.0% | 60.0% | -- | FLAT |
| Stripe net margin per Day Pass | 85.9% | 85.9% | -- | FLAT |
| Infra cost per Day Pass sold (Feb) | $14.07 | $14.07 | -- | FLAT |
| Revenue coverage (operational) | ~13.4% | ~13.4% | -- | FLAT |

**Character headroom continues declining** due to non-Paisaxe usage (Archy agent: +1,176 chars since yesterday). Remaining 191,014 characters still provides ample margin. All other efficiency metrics unchanged.

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Projected Month-End | Alert Level |
|---------|--------|------|-------|-------------|---------------------|-------------|
| ElevenLabs | Characters (cycle) | 5,124 | 196,138 | **2.61%** | ~3-4% | SAFE |
| ElevenLabs | Voice Minutes (Mar) | 0.0 | 100 | **0%** | ~0% | SAFE |
| Vercel | Monthly Visitors | ~low | 500,000 (Pro) | **<1%** | <1% | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | <1% | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | <100% | SAFE |

**All tier alerts cleared.** Archy agent is accelerating character consumption (~1,176 chars/day on active days), but at this rate would take ~162 active days to exhaust the 191K remaining characters. No risk of approaching limits before the April 5 cycle reset.

### Upgrade Trigger Points

| Service | Current Tier | Trigger | Next Tier | Cost Jump |
|---------|-------------|---------|-----------|-----------|
| ElevenLabs | Creator ($22.18/mo eff.) | >100 min/mo | Scale ($99/mo) | +$77/mo |
| Supabase | Pro ($25/mo) | >8 GB storage | Team ($599/mo) | +$574/mo |
| PostHog | Free ($0) | >1M events/mo | Pay-as-you-go | Variable |

---

## Scaling Forecast

Based on the forecast model in `src/lib/costs/forecast.ts`, with corrected operational costs:

**Per-unit costs (from February actuals):**
- Cost per voice minute: $0.37 (ElevenLabs $22.18 / 60.0 min)
- Cost per SMS: $0.25 ($1.49 / 6 messages)
- Cost per chat: $0.01 (estimated fallback — no Anthropic data)

| Scenario | Visitors/mo | Voice Convos/mo | Voice Min/mo | SMS/mo | Est. Monthly Cost (operational) |
|----------|------------|----------------|-------------|--------|--------------------------------|
| **Current (1x)** | ~50 | ~50 | ~60 | ~6 | ~$84.41 |
| **3x Growth** | ~150 | ~150 | ~180 | ~18 | ~$170* |
| **10x Growth** | ~500 | ~500 | ~600 | ~60 | ~$370** |

*\*At 3x: Voice minutes (180) exceed Creator limit (100). Requires Scale tier upgrade ($99/mo). Total: ~$52 infra + $10 AI + $99 voice + ~$5 SMS = ~$170.*

*\*\*At 10x: Voice at 600 min/mo. Scale tier (500 min) also exceeded. Requires Enterprise pricing or higher tier. Estimated $200+ for voice alone.*

### Cost Forecast vs. Revenue Potential

| Scenario | Monthly Cost (op.) | Day Passes Needed to Break Even* | Revenue at 5% Conversion |
|----------|-------------------|----------------------------------|--------------------------|
| Current (~50 visitors) | ~$84 | 52 passes | ~$4.10 (2.5 passes) |
| 500 visitors | ~$170 | 104 passes | ~$42.75 (25 passes) |
| 5,000 visitors | ~$370 | 226 passes | ~$427.50 (250 passes) |

*\*At ~$1.64 net per Day Pass after Stripe fees.*

**Break-even point**: ~3,150 monthly visitors assuming 5% Day Pass conversion rate.

---

## Anomalies

| Finding | Severity | Details |
|---------|----------|---------|
| 43-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. Exceeds one full calendar month by 15 days. Longest dry spell since launch. |
| 39-day Paisaxe voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Platform appears dormant. Exceeds one full calendar month by 11 days. |
| Accelerating non-Paisaxe ElevenLabs usage | **INFO** | 5,124 characters consumed by Archy agent (+1,176 since yesterday). 10 conversations visible on March 26-27. Still low (2.61%) but accelerating — Archy is being actively developed/tested. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual checks required. |

**Archy activity update**: The non-Paisaxe agent now shows 10 recent conversations (up from 5 visible yesterday), including 3 failures (LLM generation errors). Character consumption rate increasing as the agent is being actively tested. At ~1,176 chars/active day, monthly consumption could reach ~15-20K characters if daily testing continues — still well within the 196K limit but worth monitoring.

---

## Trend Analysis

### Comparison: Mar 27 -> Mar 28

| Metric | Mar 27 | Mar 28 | Change | Direction |
|--------|--------|--------|--------|-----------|
| Fixed costs/mo (operational) | $84.41 | $84.41 | -- | FLAT |
| Variable costs (Mar MTD) | $1.15 | $1.15 | -- | FLAT |
| Voice conversations (Mar MTD) | 0 | 0 | -- | FLAT |
| Voice minutes (Mar MTD) | 0.0 | 0.0 | -- | FLAT |
| Characters used (cycle) | 3,948 (2.01%) | 5,124 (2.61%) | +1,176 | UP (non-Paisaxe) |
| Characters limit | 196,138 | 196,138 | -- | FLAT |
| SMS sent (Mar MTD) | 0 | 0 | -- | FLAT |
| Day Pass net sales (Mar MTD) | 0 | 0 | -- | FLAT |
| Twilio balance | $15.4546 | $15.4546 | -- | FLAT |
| Paisaxe voice dormancy streak | 38 days | **39 days** | +1 day | WORSENING |
| Revenue drought streak | 42 days | **43 days** | +1 day | WORSENING |

**Key observations:**

1. **Day 39 of Paisaxe voice dormancy, day 43 of revenue drought.** Both streaks well past one full calendar month. Voice silence: Feb 17 -> Mar 28 (39 days). Revenue drought: Feb 13 -> Mar 28 (43 days, exceeding one full month by 15 days).

2. **March will close with $0 revenue.** Only 3 days remain in March, and with no activity trend reversal, March is now virtually certain to be the first complete calendar month with zero revenue.

3. **ElevenLabs character consumption accelerating.** From 0 on March 7 (cycle reset) to 5,124 on March 28 — all from Archy agent. 10 conversations visible on March 26-27 (up from 5 on March 23-24). Rate increasing as the agent is actively tested. Paisaxe-specific usage remains zero.

4. **Costs accrue steadily.** 28 days into March: ~$76.24 in operational fixed costs accrued ($84.41 / 31 x 28), with $0 revenue to offset. March is now 90% complete.

5. **ElevenLabs subscription healthy.** Creator tier active, 191,014 characters remaining (after Archy usage), 30 voice slots available, next annual invoice $266.20 in Feb 2027. Archy's accelerating usage is the only new variable — still negligible.

6. **Twilio balance sufficient.** $15.45 at $1.15/mo phone rental = ~13.4 months of runway. No top-up needed.

### Monthly Cost History

| Month | Operational Fixed | Variable (known) | Total Operational | Revenue (net) | Coverage |
|-------|------------------|------------------|-------------------|---------------|----------|
| Feb 2026 | $84.41 | ~$2.75 | ~$87.16 | ~$11.34 | ~13.0% |
| Mar 2026 (MTD, 28 days) | $84.41* | $1.15 | ~$85.56* | $0.00 | 0% |

*\*Projected full month. Variable costs may increase if activity resumes.*

---

## Recommendations

### Immediate Actions (Priority)

1. **Check Anthropic billing manually** — Visit [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing) and record March MTD spend. With the platform dormant, Anthropic usage should be minimal (only automated agents/cron).

2. **Verify the platform is functioning** — 39 days without a Paisaxe voice conversation and 43 days without a sale warrants investigation:
   - Is the Pelayo voice widget rendering correctly?
   - Is the Day Pass purchase flow working?
   - Are there any deployment errors on Vercel?
   - Has organic traffic continued (check PostHog/Vercel analytics)?

### Near-Term Actions

3. **Monitor shared ElevenLabs quota** — The Archy agent is now consuming characters at an accelerating rate (10 conversations in 2 days, +1,176 chars/day). While current usage is low (2.61%), if both projects become active simultaneously, combined consumption could become significant. Track usage ahead of the April 5 cycle reset.

4. **Consider Vercel Pro necessity** — With ~50 visitors/month, the Hobby tier (50K visitors included) would suffice. Pro saves $20/mo (24% of operational costs). Evaluate whether team features or other Pro benefits justify the cost at current scale.

5. **Evaluate Twilio phone number** — At $1.15/mo with zero booking calls in 39 days, consider whether to release the number. If outbound booking is not actively used, this saves $13.80/yr.

### Long-Term Planning

6. **Revenue strategy is urgent** — Zero revenue for 43 days at $84.41/mo operational cost means the platform is losing ~$2.72/day. March is on track for ~$85.56 cost with $0 revenue. The break-even target of ~3,150 monthly visitors at 5% conversion is ~63x current traffic.

7. **ElevenLabs remains well within limits** — February used 60/100 voice minutes (60%) and the character limit is 196,138 with only 2.61% consumed (all non-Paisaxe). The Creator tier is appropriately sized. No change needed.

---

## Data Sources

| Source | Method | Last Queried |
|--------|--------|-------------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-03-28 |
| ElevenLabs ConvAI API | `/v1/convai/conversations` (all agents, page_size=10) | 2026-03-28 |
| ElevenLabs ConvAI API | `/v1/convai/conversations` (Pelayo agent_id, page_size=5) | 2026-03-28 |
| ElevenLabs Character Stats API | `/v1/usage/character-stats` | 2026-03-28 |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth` (targeted: phonenumbers-local, sms-outbound, calls-outbound) | 2026-03-28 |
| Twilio Balance API | `/Balance.json` | 2026-03-28 |
| Config: `service-tiers.ts` | File read | 2026-03-28 |
| Config: `recurring-costs.ts` | File read | 2026-03-28 |
| Config: `forecast.ts` | File read | 2026-03-28 |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | -- |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-03-29.*
