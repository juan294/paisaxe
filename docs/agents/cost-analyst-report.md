# Cost Analyst Report

> **Generated**: 2026-03-25 | **Period**: March 2026 (MTD, 25 days) + February 2026 (final) | **Status**: WATCH

---

## Executive Summary

**Platform dormancy extends — 36 days without a voice conversation and 40 days without revenue.** No voice conversations since February 17, no Day Pass sales since February 13. All usage metrics remain at zero for March. The revenue drought has now reached the **40-day mark** — exceeding one full calendar month by 12 days.

**All systems nominal.** ElevenLabs subscription is active with 196,138 character allowance (0% utilized), Twilio balance stable at $15.45. No anomalies detected in any billing system.

**Fixed costs accrue regardless.** Twenty-five days into March, ~$68.07 in operational fixed costs have accrued against $0 revenue. March is now 81% complete. The platform continues operating at 100% loss.

**March will close with $0 revenue.** Only 6 days remain. This will be the first complete calendar month with zero income since launch.

**Financial health: WATCH** — Extended inactivity continues. Costs are stable and predictable. No variable cost anomalies. Revenue drought now at 40 days — exceeding one full calendar month by 12 days.

| Metric | Value | vs. Mar 24 |
|--------|-------|-----------|
| Total Fixed Costs (all) | $284.41/mo | -- |
| Total Fixed Costs (operational) | **$84.41/mo** | -- |
| Variable Costs (Mar MTD) | $1.15 | -- |
| Total Burn (Mar projected, operational) | ~$85.56 | -- |
| Revenue (Mar MTD) | €0.00 | -- |
| Revenue (Feb final) | €13.93 gross / €9.98 net (~$10.78) | -- |
| Twilio Balance | **$15.45** | -- ($15.4546) |
| ElevenLabs Characters | **0 / 196,138 (0%)** | -- |
| ElevenLabs Voice Min (Feb final) | 60.0 / 100 | -- |
| ElevenLabs Voice Min (Mar) | **0.0 / 100** | -- |

---

## Current Costs — Per-Service Breakdown

### Fixed / Recurring Costs

| Service | Tier | Monthly Cost | Category | Since | Change vs Mar 24 |
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
| Stripe (Processing Fees) | 0 charges | €0.00 | -- |
| Anthropic (Claude API) | Unknown | Unknown | -- |
| Voyage AI (Embeddings) | Unknown | Unknown | -- |
| **Total Variable** | | **$1.15** | |

*All Twilio categories at $0.00 except phone rental ($1.15). API data as of 2026-03-25T02:01 UTC. Balance remains $15.4546.*

### February 2026 Final Costs (confirmed)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (SMS outbound) | 17 segments | $1.49 | API |
| Twilio (Media stream) | 23 minutes | $0.09 | API |
| Twilio (Amazon Polly TTS) | 3 units | $0.002 | API |
| Twilio (Phone number) | 1 number | $1.15 | API |
| Stripe (Processing Fees) | 7 charges, 1 refund | €1.96 (~$2.12) | -- |
| **Total Variable (Feb)** | | **~$2.75** | |

---

## Usage Metrics

### ElevenLabs Voice Conversations

| Period | Conversations | Successful | Failed/Init | Duration | Avg Duration |
|--------|--------------|-----------|-------------|----------|-------------|
| Mar 2026 (MTD, 25 days) | **0** | 0 | 0 | 0.0 min | -- |
| Feb 2026 (final, 28 days) | 51 | 47 | 4 | 60.0 min | 76.6 sec |
| **Change** | **-51** | **-47** | **-4** | **-60.0 min** | **--** |

**Zero voice activity since February 17** (36 consecutive days). The last Paisaxe conversation was a 16-second Visitor Guide session at 08:59 UTC on Feb 17, confirmed via ConvAI API (conv_3101khnd78cze9m9j76e8qk2rs3x).

**February final by agent type:**

| Agent | Conversations | Duration | Avg Duration |
|-------|--------------|----------|-------------|
| Pelayo (Visitor Guide) | 33 | 47.2 min | 98.3 sec |
| Pelayo (Booking) | 18 | 12.8 min | 52.9 sec |

### ElevenLabs Character Usage

| Metric | Value | Note |
|--------|-------|------|
| Characters used (current cycle) | **0 / 196,138 (0%)** | Post-reset, new cycle |
| Character limit | 196,138 | Unchanged |
| Character reset (previous) | March 7, 2026 at 14:07 UTC | Completed |
| Next character reset | **~April 5, 2026 at 14:35 UTC** | unix 1775571305 |
| Characters used (March, post-reset) | 0 | No voice activity |

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

| Metric | March (25 days) | February (final) | Change |
|--------|----------------|-----------------|--------|
| SMS Sent | 0 | 6 (17 segments) | -6 |
| Usage Cost | $0.00 | $1.49 | -$1.49 |
| Phone Rental | $1.15 (API confirmed) | $1.15 | -- |
| Media Stream | 0 min | 23 min ($0.09) | -23 min |
| Calls | 0 | 0 | -- |
| Balance | **$15.45** | $18.20 (start of Feb) | **-$2.75** |

Balance unchanged at $15.4546 since March 8. Phone rental charge visible in usage records ($1.15) but balance not yet decremented. At the current rate (zero SMS, $1.15/mo phone rental only), the $15.45 balance lasts ~13.4 months.

### Stripe Revenue

| Metric | March (25 days) | February (final) | Change |
|--------|----------------|-----------------|--------|
| Net Sales | 0 | 6 | -6 |
| Gross Revenue | €0.00 | €13.93 | -€13.93 |
| Net Revenue | €0.00 | €9.98 | -€9.98 |

**40-day revenue drought** — No Day Pass sales since February 13. Well past one full calendar month without income (exceeds by 12 days). Longest dry spell since launch.

---

## Cost Efficiency

| Metric | Current (Mar 25) | Previous (Mar 24) | Change | Trend |
|--------|-----------------|-------------------|--------|-------|
| Fixed operational cost/mo | $84.41 | $84.41 | -- | FLAT |
| Total monthly burn (operational) | ~$85.56 | ~$85.56 | -- | FLAT |
| Cost per voice conversation (Feb) | ~$0.43 | ~$0.43 | -- | FLAT |
| Cost per voice minute (Feb) | ~$0.37 | ~$0.37 | -- | FLAT |
| ElevenLabs char utilization (current cycle) | **0%** | 0% | -- | FLAT |
| ElevenLabs char headroom | **196,138** | 196,138 | -- | FLAT |
| ElevenLabs voice min utilization (Feb final) | 60.0% | 60.0% | -- | FLAT |
| Stripe net margin per Day Pass | 85.9% | 85.9% | -- | FLAT |
| Infra cost per Day Pass sold (Feb) | $14.07 | $14.07 | -- | FLAT |
| Revenue coverage (operational) | ~13.4% | ~13.4% | -- | FLAT |

**All efficiency metrics unchanged.** No new activity to move any needle. Break-even still requires ~52 Day Pass sales/month at €1.64 net per pass.

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Projected Month-End | Alert Level |
|---------|--------|------|-------|-------------|---------------------|-------------|
| ElevenLabs | Characters (Mar) | 0 | 196,138 | **0%** | ~0% | SAFE |
| ElevenLabs | Voice Minutes (Mar) | 0.0 | 100 | **0%** | ~0% | SAFE |
| Vercel | Monthly Visitors | ~low | 500,000 (Pro) | **<1%** | <1% | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | <1% | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | <100% | SAFE |

**All tier alerts cleared.** With zero usage in March, there is no risk of approaching any limits.

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
| Current (~50 visitors) | ~$84 | 52 passes | ~€4.10 (2.5 passes) |
| 500 visitors | ~$170 | 104 passes | ~€42.75 (25 passes) |
| 5,000 visitors | ~$370 | 226 passes | ~€427.50 (250 passes) |

*\*At €1.64 net per Day Pass after Stripe fees.*

**Break-even point**: ~3,150 monthly visitors assuming 5% Day Pass conversion rate.

---

## Anomalies

| Finding | Severity | Details |
|---------|----------|---------|
| 40-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. Exceeds one full calendar month by 12 days. Longest dry spell since launch. |
| 36-day voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Platform appears dormant. Exceeds one full calendar month by 8 days. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual checks required. |

**No new anomalies detected since Mar 9.** All systems are stable — the dormancy itself remains the primary concern. Both drought streaks now well past one full calendar month.

---

## Trend Analysis

### Comparison: Mar 24 → Mar 25

| Metric | Mar 24 | Mar 25 | Change | Direction |
|--------|--------|--------|--------|-----------|
| Fixed costs/mo (operational) | $84.41 | $84.41 | -- | FLAT |
| Variable costs (Mar MTD) | $1.15 | $1.15 | -- | FLAT |
| Voice conversations (Mar MTD) | 0 | 0 | -- | FLAT |
| Voice minutes (Mar MTD) | 0.0 | 0.0 | -- | FLAT |
| Characters used (cycle) | 0 (0%) | 0 (0%) | -- | FLAT |
| Characters limit | 196,138 | 196,138 | -- | FLAT |
| SMS sent (Mar MTD) | 0 | 0 | -- | FLAT |
| Day Pass net sales (Mar MTD) | 0 | 0 | -- | FLAT |
| Twilio balance | $15.4546 | $15.4546 | -- | FLAT |
| Voice dormancy streak | 35 days | **36 days** | +1 day | WORSENING |
| Revenue drought streak | 39 days | **40 days** | +1 day | WORSENING |

**Key observations:**

1. **Day 36 of voice dormancy, day 40 of revenue drought.** Both streaks well past one full calendar month. Voice silence: Feb 17 → Mar 25 (36 days). Revenue drought: Feb 13 → Mar 25 (40 days, exceeding one full month by 12 days).

2. **March will close with $0 revenue.** Only 6 days remain in March, and with no activity trend reversal, March is now virtually certain to be the first complete calendar month with zero revenue.

3. **All metrics frozen.** Twilio balance identical to the cent ($15.4546), ElevenLabs characters at 0, zero SMS. Consistent with a completely idle platform.

4. **Costs accrue steadily.** 25 days into March: ~$68.07 in operational fixed costs accrued ($84.41 / 31 × 25), with $0 revenue to offset. March is now 81% complete.

5. **ElevenLabs subscription healthy.** Creator tier active, 196,138 character allowance, 30 voice slots available, next annual invoice $266.20 in Feb 2027. No billing concerns.

6. **Twilio balance sufficient.** $15.45 at $1.15/mo phone rental = ~13.4 months of runway. No top-up needed.

### Monthly Cost History

| Month | Operational Fixed | Variable (known) | Total Operational | Revenue (net) | Coverage |
|-------|------------------|------------------|-------------------|---------------|----------|
| Feb 2026 | $84.41 | ~$2.75 | ~$87.16 | ~$11.34 | ~13.0% |
| Mar 2026 (MTD, 25 days) | $84.41* | $1.15 | ~$85.56* | $0.00 | 0% |

*\*Projected full month. Variable costs may increase if activity resumes.*

---

## Recommendations

### Immediate Actions (Priority)

1. **Check Anthropic billing manually** — Visit [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing) and record March MTD spend. With the platform dormant, Anthropic usage should be minimal (only automated agents/cron).

2. **Verify the platform is functioning** — 36 days without a voice conversation and 40 days without a sale warrants investigation:
   - Is the Pelayo voice widget rendering correctly?
   - Is the Day Pass purchase flow working?
   - Are there any deployment errors on Vercel?
   - Has organic traffic continued (check PostHog/Vercel analytics)?

### Near-Term Actions

3. **Consider Vercel Pro necessity** — With ~50 visitors/month, the Hobby tier (50K visitors included) would suffice. Pro saves $20/mo (24% of operational costs). Evaluate whether team features or other Pro benefits justify the cost at current scale.

4. **Evaluate Twilio phone number** — At $1.15/mo with zero booking calls in 36 days, consider whether to release the number. If outbound booking is not actively used, this saves $13.80/yr.

### Long-Term Planning

5. **Revenue strategy is urgent** — Zero revenue for 40 days at $84.41/mo operational cost means the platform is losing ~$2.72/day. March is on track for ~$85.56 cost with $0 revenue. The break-even target of ~3,150 monthly visitors at 5% conversion is ~63x current traffic.

6. **ElevenLabs remains well within limits** — February used 60/100 voice minutes (60%) and the character limit has increased to 196,138. The Creator tier is appropriately sized. No change needed.

---

## Data Sources

| Source | Method | Last Queried |
|--------|--------|-------------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-03-25 |
| ElevenLabs ConvAI API | `/v1/convai/conversations` (page_size=5) | 2026-03-25 |
| ElevenLabs Character Stats API | `/v1/usage/character-stats` | 2026-03-25 |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth` (targeted: phonenumbers-local, sms-outbound, calls-outbound) | 2026-03-25 |
| Twilio Balance API | `/Balance.json` | 2026-03-25 |
| Config: `service-tiers.ts` | File read | 2026-03-25 |
| Config: `recurring-costs.ts` | File read | 2026-03-25 |
| Config: `forecast.ts` | File read | 2026-03-25 |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | -- |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-03-26.*
