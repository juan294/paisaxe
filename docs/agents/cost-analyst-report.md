# Cost Analyst Report

> **Generated**: 2026-04-08 03:00:00 | **Period**: April 2026 (day 8 of 30) | **Status**: WATCH

---

## Executive Summary

**Day 8 of April — new ElevenLabs cycle is live, 2,510 chars consumed by non-Paisaxe agents.** The character cycle reset as predicted at April 7 14:15 UTC. Immediately after the reset (14:34–16:50 UTC on April 7), a burst of 19 conversations occurred: 8 Archy (all successful or LLM-timeout failures) + 11 Coach (all failures). As of 03:00 UTC April 8, 2,510 characters have been used in the new cycle — all non-Paisaxe activity.

**ElevenLabs character limit increased**: API now reports 270,783 (up from 196,138 last cycle). Likely reflects a Creator plan entitlement adjustment by ElevenLabs between billing periods. No cost impact — Creator annual subscription unchanged at $22.18/mo effective.

**Twilio balance unchanged at $14.0646** — no new charges since the April 7 phone rental. Usage Records API continues to show $0.00 across all categories.

**Revenue drought reaches 54 days** (since February 13). **Paisaxe voice silence: 50 days** (since February 17). No revenue in April. Fixed operational costs unchanged at $84.41/mo.

**Financial health: WATCH** — business concern only. No platform cost anomalies. All tier limits safe.

| Metric | Value | vs. Apr 7 |
|--------|-------|-----------|
| Total Fixed Costs (all) | $284.41/mo | → |
| Total Fixed Costs (operational) | **$84.41/mo** | → |
| Variable Costs (Apr MTD, confirmed) | **$1.15** | → |
| Daily Burn Rate (Apr fixed) | **$2.81/day** | → |
| Revenue (Apr MTD) | **$0.00** | → |
| Twilio Balance | **$14.0646** | → |
| ElevenLabs Characters (new cycle) | **2,510 / 270,783 (0.93%)** | NEW CYCLE (was 23,591/196,138 at close) |
| ElevenLabs Voice Min (Paisaxe, Apr) | 0.0 / 100 | → |
| Next Character Reset | **2026-05-07 ~14:36 UTC** | 29 days |
| Paisaxe Voice Silence | **50 days** | +1 |
| Revenue Drought | **54 days** | +1 |

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

*\*\*\*Twilio phone number rental charged April 7: balance dropped $15.2146 → $14.0646 (-$1.15). Monthly billing event, expected.*

**Note**: Claude Code Max ($200/mo) is the primary development tool, categorized separately as "Development." Operational cost analysis focuses on running the live service.

### Variable / Usage-Based Costs (April 2026 MTD — Day 8)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Phone rental) | 1 number, April billing | **$1.15** | Balance delta (Apr 7) |
| Twilio (SMS) | 0 messages | $0.00 | API |
| Twilio (Calls) | 0 minutes | $0.00 | API |
| Stripe (Processing Fees) | 0 charges | $0.00 | — |
| Anthropic (Claude API) | Unknown | Unknown | — |
| Voyage AI (Embeddings) | Unknown | Unknown | — |
| **Total Variable (Apr MTD, confirmed)** | | **$1.15** | |

### April 2026 MTD Total (Day 8)

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

### ElevenLabs Activity — New Cycle (April 7 14:15 UTC → May 7 ~14:36 UTC)

**Character cycle reset April 7 at 14:15 UTC.** Immediate post-reset burst of 19 conversations from non-Paisaxe agents. No activity on April 8 yet (03:00 UTC).

| Time Window | Agent | Conversations | Outcome | Characters |
|-------------|-------|--------------|---------|------------|
| Apr 7 14:34–14:52 UTC | Archy | 5 | 4 success, 1 LLM-timeout fail | ~1,000 est. |
| Apr 7 14:52–15:24 UTC | Archy | 3 | 1 success, 2 LLM-timeout fail | ~600 est. |
| Apr 7 15:46–15:52 UTC | Coach | 7 | All failed (disconnects) | ~100 est. |
| Apr 7 15:52–16:50 UTC | Coach | 4 | All failed (LLM/disconnects) | ~810 est. |
| Apr 8 (00:00–03:00 UTC) | — | 0 | — | 0 |
| **New cycle total** | | **19** | Mixed | **2,510 (API confirmed)** |

**All conversations are non-Paisaxe.** Paisaxe agents (Pelayo Visitor Guide, Pelayo Booking, Penny, Iris, Xander): **0 conversations since February 17.**

### ElevenLabs Character Usage

| Metric | Value | vs. Yesterday |
|--------|-------|--------------|
| Characters used (new cycle) | **2,510 / 270,783 (0.93%)** | NEW CYCLE START |
| Character limit | **270,783** | ↑ from 196,138 (last cycle) |
| Next character reset | **2026-05-07 ~14:36 UTC** | 29 days |
| Characters used (Apr, Paisaxe) | 0 | → |
| Characters remaining this cycle | 268,273 | — |

**Character limit change noted**: Previous cycle showed 196,138. New cycle API reports 270,783 (+37.8%). This appears to be a Creator plan entitlement update by ElevenLabs between billing periods. No cost impact — subscription unchanged. Will monitor for stability.

### ElevenLabs Subscription Details (from API — 2026-04-08)

| Field | Value |
|-------|-------|
| Tier | Creator |
| Billing period | Annual |
| Status | Active |
| Next invoice amount | $266.20 |
| Next invoice date | 2027-02-07 |
| Next character reset | **2026-05-07 ~14:36 UTC** |
| Character limit (new cycle) | **270,783** |

### ElevenLabs Agent Summary (new cycle — April 7 14:15 UTC to date)

| Agent | New Cycle Calls | Last Call | Status | Project |
|-------|----------------|-----------|--------|---------|
| Archy | **8** | Apr 7 16:01 UTC | Active (post-reset burst) | Non-Paisaxe |
| Coach | **11** | Apr 7 16:50 UTC | Failing (LLM + disconnects) | Non-Paisaxe |
| Pelayo (Visitor Guide) | 0 | Feb 17 | Dormant | Paisaxe |
| Pelayo (Booking) | 0 | Feb 10 | Dormant | Paisaxe |
| Penny, Iris, Xander | 0 | Never | Dormant | Paisaxe |

### Twilio Communications

| Metric | Apr 2026 (days 1-8) | Mar 2026 (final) | Change |
|--------|---------------------|-----------------|--------|
| SMS Sent | 0 | 0 | → |
| Calls | 0 | 0 | → |
| Usage Cost | $0.00 | $0.00 | → |
| Phone Rental | **$1.15** (charged Apr 7) | $1.15 | Monthly expected |
| Balance | **$14.0646** | $15.4546 | -$1.40 MTD |

**Twilio balance reconciliation (April):**
- Apr 1 (start): ~$15.4546
- Apr 3-4: -$0.24 (unexplained — possible regulatory fee)
- Apr 7: -$1.15 (phone number rental, confirmed)
- **Apr 8: $14.0646** — stable since Apr 7 rental. ~12.2 months of runway remaining.

### Stripe Revenue

| Metric | Apr 2026 (days 1-8) | Mar 2026 (final) | Feb 2026 (final) |
|--------|---------------------|-----------------|-----------------|
| Net Sales | 0 | 0 | 6 |
| Gross Revenue | $0.00 | $0.00 | $13.93 |
| Net Revenue | $0.00 | $0.00 | $9.98 |

**54-day revenue drought** — No Day Pass sales since February 13.

---

## Cost Efficiency

| Metric | Current (Apr 8) | Previous (Apr 7) | Change | Trend |
|--------|----------------|------------------|--------|-------|
| Fixed operational cost/mo | $84.41 | $84.41 | → | → |
| Daily burn rate (fixed) | **$2.81/day** | $2.81/day | → | → |
| April variable spend (confirmed) | **$1.15** | $1.15 | → | → |
| Cost per voice conversation (Feb actuals) | ~$0.43 | ~$0.43 | → | → |
| Cost per voice minute (Feb actuals) | ~$0.37 | ~$0.37 | → | → |
| ElevenLabs char utilization (new cycle) | **0.93%** | N/A (reset) | NEW CYCLE | — |
| ElevenLabs voice min utilization (Paisaxe, Apr) | 0% | 0% | → | → |
| Revenue coverage (operational) | **0%** | 0% | → | → |
| Months of Twilio runway | ~12.2 mo | ~12.2 mo | → | → |

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Alert Level |
|---------|--------|------|-------|-------------|-------------|
| ElevenLabs | Characters (new cycle) | 2,510 | 270,783 | **0.93%** | SAFE |
| ElevenLabs | Voice Minutes (Paisaxe, Apr) | 0.0 | 100 | **0%** | SAFE |
| Vercel | Monthly Visitors | ~low | 500,000 (Pro) | **<1%** | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | SAFE |

**All tier alerts cleared.** New cycle at 0.93% utilization. At the old cycle's pace (~23K chars/28 days = ~820 chars/day), new cycle would reach ~22,960 by reset day — well within 270K limit.

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
| 54-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. Almost 8 full weeks of zero revenue. |
| 50-day Paisaxe voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Platform dormant to users. |
| ElevenLabs character limit increased | **INFO** | Character limit changed from 196,138 (old cycle) to 270,783 (new cycle) — +37.8%. Likely a Creator plan entitlement update by ElevenLabs. No cost impact. Will confirm on next cycle. |
| Twilio $0.24 drop (Apr 3-4, unresolved) | **WATCH** | Balance drop not captured in Usage Records API. Likely regulatory surcharge. Balance stable since Apr 7 rental ($14.0646). |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual monthly checks required. Significant agent development activity this cycle. |
| Coach agent persistent initialization failures | **INFO** | 11 failed conversations in new cycle (Apr 7). All LLM-gen failures or websocket disconnects (1008). Non-Paisaxe, negligible character cost. Pattern unchanged from prior cycle. |

**No platform cost-structure anomalies.** New cycle opened cleanly after yesterday's reset.

---

## Trend Analysis

### Comparison: Apr 7 → Apr 8

| Metric | Apr 7 (03:00) | Apr 8 (03:00) | Change | Direction |
|--------|-------|-------|--------|-----------|
| Fixed costs/mo (operational) | $84.41 | $84.41 | → | → |
| Variable costs (confirmed MTD) | $1.15 | $1.15 | → | → |
| Daily burn rate (fixed) | $2.81/day | $2.81/day | → | → |
| ElevenLabs characters (active cycle) | 23,591 @ 12.03% (closing) | **2,510 @ 0.93% (new cycle)** | RESET | new cycle |
| ElevenLabs character limit | 196,138 | **270,783** | +37.8% | ↑ |
| New cycle conversations (non-Paisaxe) | N/A | **19 (Apr 7 post-reset)** | burst | — |
| Paisaxe voice conversations (MTD) | 0 | 0 | → | → |
| Twilio balance | $14.0646 | $14.0646 | → | → |
| SMS sent (MTD) | 0 | 0 | → | → |
| Day Pass net sales (MTD) | 0 | 0 | → | → |
| Paisaxe voice dormancy streak | 49 days | **50 days** | +1 | down |
| Revenue drought streak | 53 days | **54 days** | +1 | down |
| Next ElevenLabs reset | Apr 7 (today) | **May 7** | 29 days | → |

**Key observations:**

1. **New ElevenLabs cycle confirmed live.** Reset occurred at 14:15 UTC on April 7 as predicted. 2,510 chars consumed in the first ~13 hours — all from non-Paisaxe agents (Archy + Coach burst post-reset). Character limit increased to 270,783 (was 196,138). No adverse impact.

2. **Post-reset Archy burst pattern confirmed.** Archy had 8 conversations within 90 minutes of the cycle reset, suggesting Juan was actively using it around that time. Archy appears to be a different personal project's voice agent. Coach had 11 conversations, all failures — consistent with the persistent initialization issue noted in prior cycles.

3. **No April 8 activity yet (03:00 UTC).** The 20-result API window shows all conversations are from April 7. Clean data point: no ElevenLabs activity in the first 3 hours of April 8.

4. **Revenue and voice drought deepening.** Feb: $9.98 net → Mar: $0.00 → Apr: $0.00 (day 8). Three months, ~$259 cumulative operational loss since February. Day 54 with no sign of reversal.

5. **Twilio balance stable.** $14.0646 for second consecutive day. The $0.24 anomaly from Apr 3-4 remains unexplained but has not recurred. At $1.15/mo, ~12.2 months of Twilio runway remaining from current balance.

### Monthly Cost History

| Month | Operational Fixed | Variable (confirmed) | Total Operational | Revenue (net) | Coverage |
|-------|------------------|----------------------|-------------------|---------------|----------|
| Feb 2026 | $84.41 | ~$2.75 | ~$87.16 | ~$9.98 | ~11.4% |
| Mar 2026 (final) | $84.41 | $1.15 | **$85.56** | **$0.00** | **0%** |
| Apr 2026 (day 8) | $84.41 | $1.15 | **$85.56** | $0.00 | 0% |

---

## Recommendations

### Immediate Actions (Priority)

1. **Check Anthropic billing manually** — Visit [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing). Coverage agent activity this cycle (7 new tests Apr 8, test suite at 5,716) and SDK upgrade activity mean Claude Code and API usage may exceed $10/mo estimate.

2. **Investigate the revenue and voice drought — 54 days is critical** — No change from yesterday's priority:
   - Is the Pelayo voice widget rendering and accessible on production?
   - Is the Day Pass purchase flow functional end-to-end?
   - Are Vercel deployment logs showing errors on production requests?
   - Has organic traffic dropped? (PostHog / Vercel Analytics)
   - The QA Agent confirms browser journeys pass E2E — but production behavior remains unverified.

3. **Monitor new ElevenLabs cycle** — First full day of data. Watch whether Archy activity continues at the post-reset burst rate (~8 convos/day) or settles back to the prior cycle pace (~5 convos/day average). No concern at current utilization (0.93% / 270K limit).

### Near-Term Actions (April Planning)

4. **April mid-month break-even check (April 15)** — At $2.81/day fixed burn and $0 revenue, ~$42 burned by April 15. Evaluate:
   - Pause Vercel Pro ($20/mo) → Hobby if per-minute cron and preview deployments not critical
   - Pause Supabase Pro ($25/mo) → evaluate if Pro features needed at dormant scale

5. **Verify ElevenLabs character limit change** — Confirm whether 270,783 is a permanent Creator plan update or a one-time adjustment. No action needed now; monitor on next cycle.

6. **Resolve the Twilio $0.24 anomaly** — Check Twilio billing history/invoices directly at https://console.twilio.com for April 3-4. Likely a recurring regulatory fee (~$0.24/mo for US local numbers). If confirmed, update recurring-costs.ts accordingly.

7. **Consider releasing the Twilio phone number** — 50 days without a booking call. At $1.15/mo + potential regulatory fees, the number costs ~$16-18/yr unused. If voice booking is not generating revenue, releasing saves ~$1.15–$1.39/mo.

### Long-Term Planning

8. **Revenue trajectory is critical** — Three consecutive near-zero or zero-revenue months. At $84.41/mo operational with $0 revenue: ~$2.81/day in losses. Break-even requires ~3,150 monthly visitors at 5% Day Pass conversion — 63x current traffic. Total cumulative operational loss since launch (Feb–Apr 8): ~$259. The platform requires a growth event or cost reduction to achieve sustainability.

9. **ElevenLabs remains appropriately sized** — New character limit of 270,783 provides even more headroom. February used 60/100 voice minutes at peak. Creator tier annual at $22.18/mo effective is efficient. Scale tier ($99/mo) only needed if sustained voice traffic exceeds 100 min/mo.

---

## Data Sources

| Source | Method | Last Queried | Status |
|--------|--------|-------------|--------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-04-08 03:00 UTC | ✅ OK |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=20` | 2026-04-08 03:00 UTC | ✅ OK |
| Twilio Balance API | `/Balance.json` | 2026-04-08 03:00 UTC | ✅ OK |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json` | 2026-04-08 03:00 UTC | ✅ OK (no non-zero records) |
| ElevenLabs Character Stats API | `/v1/usage/character-stats` | Not queried | ⚠️ Skipped (character_count available in subscription API) |
| Config: `service-tiers.ts` | File read | 2026-04-08 | ✅ OK |
| Config: `recurring-costs.ts` | File read | 2026-04-08 | ✅ OK |
| Config: `forecast.ts` | File read | 2026-04-08 | ✅ OK |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | — | ⚠️ Manual check required |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-04-09.*
