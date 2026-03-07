# Cost Analyst Report

> **Generated**: 2026-03-07 | **Period**: March 2026 (MTD, 7 days) + February 2026 (final) | **Status**: WATCH

---

## Executive Summary

**The platform remains in an extended dormancy — 18 days without a voice conversation and 22 days without revenue.** No Paisaxe voice conversations have occurred since February 17, and no Day Pass sales since February 13. All usage metrics are frozen.

**ElevenLabs character count resets today** (March 7 at 14:07 UTC). The 14,415 characters used were entirely from February. After reset, utilization returns to 0%. Zero characters consumed in March.

**Twilio balance is stable** at $15.45. The only March charge so far is the phone number rental ($1.15). Zero SMS activity.

**Config file discrepancies remain unfixed** — now flagged for the 3rd consecutive report. Vercel is still listed as Hobby ($0) in `service-tiers.ts` despite being Pro ($20/mo) since Feb 13. `recurring-costs.ts` is missing the Vercel Pro entry. The admin dashboard continues to under-report costs by $20/mo.

**Financial health: WATCH** — Extended platform inactivity. Fixed costs are stable but under-reported in config. Revenue drought at 22 days. No variable cost anomalies (because there's no variable usage).

| Metric | Value | vs. Mar 6 |
|--------|-------|-----------|
| Total Fixed Costs (all) | $284.41/mo | -- |
| Total Fixed Costs (operational) | **$84.41/mo** | -- |
| Variable Costs (Mar MTD) | $0.00 | -- |
| Total Burn (Mar projected, operational) | ~$84.41 | -- |
| Revenue (Mar MTD) | €0.00 | -- |
| Revenue (Feb final) | €13.93 gross / €9.98 net (~$10.78) | -- |
| Twilio Balance | **$15.45** | -- ($15.4546) |
| ElevenLabs Characters | 14,415 / 110,553 (13.0%) | **Resets today 14:07 UTC** |
| ElevenLabs Voice Min (Feb final) | 60.0 / 100 | -- |
| ElevenLabs Voice Min (Mar) | **0.0 / 100** | -- |

---

## Current Costs — Per-Service Breakdown

### Fixed / Recurring Costs

| Service | Tier | Monthly Cost | Category | Since | Change vs Mar 6 |
|---------|------|-------------|----------|-------|-----------------|
| Claude Code Max | Max (20x Pro) | $200.00 | Development | 2026-01-27 | -- |
| Supabase | Pro | $25.00 | Infrastructure | 2025-01 | -- |
| ElevenLabs | Creator (annual) | $22.18* | AI / Voice | 2026-02 | -- |
| **Vercel** | **Pro** | **$20.00** | **Infrastructure** | **2026-02-13** | **-- (still missing from config)** |
| Anthropic Claude | Prepaid credits | $10.00** | AI | 2025-12 | -- |
| GitHub Pro | Pro | $4.00 | Infrastructure | 2026-02-06 | -- |
| AWS Domains | -- | $2.08 | Infrastructure | 2025-01 | -- |
| Twilio Phone Number | -- | $1.15*** | Communications | 2026-02 | -- (confirmed by API) |
| PostHog | Free | $0.00 | Analytics | -- | -- |
| **Total Fixed (all)** | | **$284.41** | | | **--** |
| **Total Fixed (operational)** | | **$84.41** | | | **--** |

*\*ElevenLabs Creator billed annually at $220/yr ($266.20 with tax). Effective rate ~$22.18/mo. Next annual invoice: $266.20.*

*\*\*Anthropic $10/mo is an estimate from config. No billing API available on personal accounts. Check [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing) manually.*

*\*\*\*Twilio phone number rental confirmed at $1.15/mo via API (`phonenumbers-local` category).*

**Note**: Claude Code Max ($200/mo) is the primary development tool cost, categorized separately as "Development." Operational cost analysis focuses on the cost of running the live service.

**IMPORTANT — Config File Discrepancies (3rd consecutive report):**
- `service-tiers.ts` line 48: lists Vercel as **Hobby ($0)**. Actual tier is **Pro ($20/mo)** since Feb 13.
- `recurring-costs.ts`: **Missing Vercel Pro subscription entirely**. Should include a $20/mo entry.
- `recurring-costs.ts` line 30: lists ElevenLabs as $22.18/mo (correct after previous update), but `service-tiers.ts` line 30 lists $18.33/mo (stale).
- These cause the admin dashboard to under-report costs by ~$21/mo.

### Variable / Usage-Based Costs (March 2026 MTD)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Phone rental) | 1 number | $1.15 | API |
| Twilio (SMS) | 0 messages | $0.00 | API |
| Stripe (Processing Fees) | 0 charges | €0.00 | -- |
| Anthropic (Claude API) | Unknown | Unknown | -- |
| Voyage AI (Embeddings) | Unknown | Unknown | -- |
| **Total Variable** | | **$1.15** | |

*Phone rental is the only charge in March. Zero voice, zero SMS, zero revenue transactions.*

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
| Mar 2026 (MTD, 7 days) | **0** | 0 | 0 | 0.0 min | -- |
| Feb 2026 (final, 28 days) | 51 | 47 | 4 | 60.0 min | 76.6 sec |
| **Change** | **-51** | **-47** | **-4** | **-60.0 min** | **--** |

**Zero voice activity since February 17** (18 consecutive days). The last Paisaxe conversation was a 16-second Visitor Guide session at 08:59 UTC on Feb 17.

**February final by agent type:**

| Agent | Conversations | Duration | Avg Duration |
|-------|--------------|----------|-------------|
| Pelayo (Visitor Guide) | 33 | 47.2 min | 98.3 sec |
| Pelayo (Booking) | 18 | 12.8 min | 52.9 sec |

**Note:** The ElevenLabs ConvAI API also returned non-Paisaxe conversations (Storytelling, Chess Coaching, Language Lessons, etc.) from the shared account. These are excluded from Paisaxe metrics.

### ElevenLabs Character Usage

| Metric | Value | Note |
|--------|-------|------|
| Characters used (pre-reset) | 14,415 / 110,553 (13.0%) | All from February |
| Character reset | **March 7, 2026 at 14:07 UTC** | **Today** |
| Characters used (March, post-reset) | 0 | No voice activity |

The character count resets to 0 today. February's utilization was only 13% — well within the Creator tier's 110K character limit.

### Twilio Communications

| Metric | March (7 days) | February (final) | Change |
|--------|---------------|-----------------|--------|
| SMS Sent | 0 | 6 (17 segments) | -6 |
| Usage Cost | $0.00 | $1.49 | -$1.49 |
| Phone Rental | $1.15 | $1.15 | -- |
| Media Stream | 0 min | 23 min ($0.09) | -23 min |
| Balance | **$15.45** | $18.20 (start of Feb) | **-$2.75** |

Balance stable since yesterday ($15.4546 today vs $15.45 yesterday). At the current rate (zero SMS, $1.15/mo phone rental only), the $15.45 balance lasts ~13.4 months.

### Stripe Revenue

| Metric | March (7 days) | February (final) | Change |
|--------|---------------|-----------------|--------|
| Net Sales | 0 | 6 | -6 |
| Gross Revenue | €0.00 | €13.93 | -€13.93 |
| Net Revenue | €0.00 | €9.98 | -€9.98 |

**22-day revenue drought** — No Day Pass sales since February 13. All February revenue fully paid out. Stripe pipeline completely flushed with zero balances.

---

## Cost Efficiency

| Metric | Current (Mar 7) | Previous (Mar 6) | Change | Trend |
|--------|----------------|-------------------|--------|-------|
| Fixed operational cost/mo | $84.41 | $84.41 | -- | FLAT |
| Total monthly burn (operational) | ~$84.41 | ~$84.41 | -- | FLAT |
| Cost per voice conversation (Feb) | ~$0.43 | ~$0.43 | -- | FLAT |
| Cost per voice minute (Feb) | ~$0.37 | ~$0.37 | -- | FLAT |
| ElevenLabs char utilization (Feb final) | 13.0% | 13.0% | -- | FLAT |
| ElevenLabs voice min utilization (Feb final) | 60.0% | 60.0% | -- | FLAT |
| Stripe net margin per Day Pass | 85.9% | 85.9% | -- | FLAT |
| Infra cost per Day Pass sold (Feb) | $14.07 | $14.07 | -- | FLAT |
| Revenue coverage (operational) | ~13.4% | ~13.4% | -- | FLAT |

**All efficiency metrics unchanged.** No new activity to move any needle. Break-even still requires ~52 Day Pass sales/month at €1.64 net per pass.

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Projected Month-End | Alert Level |
|---------|--------|------|-------|-------------|---------------------|-------------|
| ElevenLabs | Characters (Mar) | 0 | 110,553 | **0%** | ~0% | SAFE |
| ElevenLabs | Voice Minutes (Mar) | 0.0 | 100 | **0%** | ~0% | SAFE |
| Vercel | Monthly Visitors | ~low | unlimited (Pro) | -- | -- | SAFE |
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
| 22-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. Longest dry spell since launch. Now 22 days. |
| 18-day voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Platform appears dormant. |
| Vercel cost under-reporting (3rd report) | **HIGH** | Config files still report Vercel as Hobby ($0). Actual: Pro ($20/mo) since Feb 13. Unfixed for 3 consecutive reports. |
| Config mismatch: service-tiers.ts ElevenLabs | **LOW** | `service-tiers.ts` line 30 lists $18.33/mo. Actual effective rate: $22.18/mo (annual with tax). |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual checks required. |

**Resolved since last report:** Twilio phone number rental ($1.15/mo) confirmed via API — matches the previous estimate of ~$1.26/mo closely (actual: $1.15 exactly).

---

## Trend Analysis

### Comparison: Mar 6 → Mar 7

| Metric | Mar 6 | Mar 7 | Change | Direction |
|--------|-------|-------|--------|-----------|
| Fixed costs/mo (operational) | $84.41 | $84.41 | -- | FLAT |
| Variable costs (Mar MTD) | $0.00 | $1.15 | +$1.15 | UP (phone rental) |
| Voice conversations (Mar MTD) | 0 | 0 | -- | FLAT |
| Voice minutes (Mar MTD) | 0.0 | 0.0 | -- | FLAT |
| Characters used (cycle) | 14,415 (13.0%) | 14,415 → 0 (reset today) | Reset | RESET |
| SMS sent (Mar MTD) | 0 | 0 | -- | FLAT |
| Day Pass net sales (Mar MTD) | 0 | 0 | -- | FLAT |
| Twilio balance | $15.45 | $15.45 | -- | FLAT |

**Key observations:**

1. **Day 18 of dormancy.** Zero voice, zero revenue, zero SMS since Feb 17. All February activity was concentrated in Feb 4-17 (14 days). The platform has been silent for longer than it was active.

2. **Character reset today at 14:07 UTC.** After reset, ElevenLabs will show 0/110,553 characters used. This is cosmetic — no characters were consumed in March anyway.

3. **Twilio phone rental now API-confirmed.** Previous reports estimated ~$1.26/mo from balance discrepancy. The API confirms exactly $1.15/mo for a local phone number. This is a recurring cost even with zero activity.

4. **Costs continue regardless.** Fixed costs of $84.41/mo accrue whether or not the platform is used. With zero revenue in March, the platform is operating at 100% loss. 7 days into March: ~$19.69 in fixed costs accrued, $0 revenue.

5. **Config discrepancies at 3 reports unfixed.** The Vercel Pro cost ($20/mo) has now been flagged in 3 consecutive reports (Mar 5, Mar 6, Mar 7). This remains the largest source of dashboard inaccuracy.

### Monthly Cost History

| Month | Operational Fixed | Variable (known) | Total Operational | Revenue (net) | Coverage |
|-------|------------------|------------------|-------------------|---------------|----------|
| Feb 2026 | $84.41 | ~$2.75 | ~$87.16 | ~$11.34 | ~13.0% |
| Mar 2026 (MTD, 7 days) | $84.41* | $1.15 | ~$85.56* | $0.00 | 0% |

*\*Projected full month. Variable costs may increase if activity resumes.*

---

## Recommendations

### Immediate Actions (Priority)

1. **Fix config file discrepancies (3rd request)** — This has been flagged in 3 consecutive reports. Update:
   - `service-tiers.ts` line 48: change `currentTierName` to "Pro" and `currentMonthlyCostUsd` to 20
   - Add Vercel Pro ($20/mo) entry to `recurring-costs.ts`
   - `service-tiers.ts` line 30: change `currentMonthlyCostUsd` from 18.33 to 22.18
   - Add Twilio phone number ($1.15/mo) to `recurring-costs.ts`
   - The admin dashboard will remain inaccurate until these are fixed.

2. **Check Anthropic billing manually** — Visit [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing) and record March MTD spend. With the platform dormant, Anthropic usage should be minimal.

3. **Verify the platform is functioning** — 18 days without a voice conversation and 22 days without a sale is unusual. Check:
   - Is the Pelayo voice widget rendering correctly?
   - Is the Day Pass purchase flow working?
   - Are there any deployment errors on Vercel?
   - Has organic traffic continued (check PostHog/Vercel analytics)?

### Near-Term Actions

4. **Consider Vercel Pro necessity** — With ~50 visitors/month, the Hobby tier (50K visitors included) would suffice. Pro saves $20/mo (24% of operational costs). Evaluate whether team features or other Pro benefits justify the cost at current scale.

5. **Evaluate Twilio phone number** — At $1.15/mo with zero booking calls in 18 days, consider whether to release the number. If outbound booking is not actively used, this saves $13.80/yr.

### Long-Term Planning

6. **Revenue strategy is urgent** — Zero revenue for 22 days at $84.41/mo operational cost means the platform is losing ~$2.81/day. March is on track for ~$84.41 cost with $0 revenue. The break-even target of ~3,150 monthly visitors at 5% conversion is ~63x current traffic.

7. **ElevenLabs remains well within limits** — February used 60/100 voice minutes (60%) and 13% of characters. The Creator tier is appropriately sized. No change needed.

---

## Data Sources

| Source | Method | Last Queried |
|--------|--------|-------------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-03-07 |
| ElevenLabs ConvAI API | `/v1/convai/conversations` (page_size=100) | 2026-03-07 |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth` (all pages) | 2026-03-07 |
| Twilio Usage API (Last Month) | `/Usage/Records/LastMonth` (all pages) | 2026-03-07 |
| Twilio Balance API | `/Balance.json` | 2026-03-07 |
| Config: `service-tiers.ts` | File read | 2026-03-07 |
| Config: `recurring-costs.ts` | File read | 2026-03-07 |
| Config: `forecast.ts` | File read | 2026-03-07 |
| MEMORY.md (Vercel Pro tier) | Memory file | 2026-03-07 |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | -- |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-03-08.*
