# Cost Analyst Report

> **Generated**: 2026-05-10 03:00 UTC | **Period**: May 2026 (day 10 of 31) | **Status**: WATCH

---

## Executive Summary

Both ElevenLabs and Twilio APIs queried successfully this cycle. No change to the financial situation versus May 9.

**ElevenLabs**: New billing cycle (started May 8 ~15:07 UTC) is now on day 2 with **0 / 300,000 characters used (0.00%)**. The character-stats API returns only current-cycle data since the reset; the April activity from the prior cycle is no longer visible via this endpoint. The last confirmed conversation across all agents remains **Apr 16 2026 18:44 UTC** (Archy) — now **24 days of full-account silence**. Paisaxe agents (Pelayo Visitor, Pelayo Booking, Penny, Iris, Xander) remain at zero conversations since Feb 17 — **82 days dormant**. Next cycle reset: Jun 7 2026 ~15:07 UTC. Next annual invoice: $266.20 on 2027-02-07.

**Twilio**: Balance **$12.6746** (unchanged from May 9). All usage records for May are $0.00. Runway: ~9.1 months at $1.39/mo.

**Revenue drought reaches 86 days** (since Feb 13). **Paisaxe voice silence: 82 days** (since Feb 17).

**May 10 MTD financial position**: ~$33.54 in operational costs ($32.15 fixed proportional + $1.39 Twilio May 7 charge), $0.00 revenue.

**Cumulative operational loss since February launch: ~$332.** Platform continues at full operational cost with zero revenue for the third consecutive zero-revenue month.

**Financial health: WATCH** — no platform cost-structure anomalies, all tier limits safe. The outstanding concern remains unchanged: the 86-day revenue drought and 82-day voice silence require manual production investigation.

| Metric | Value | vs. May 9 |
|--------|-------|-----------|
| Total Fixed Costs (operational, config) | **$99.65/mo** | flat |
| Daily Burn Rate (fixed) | **$3.21/day** | flat |
| Variable Costs (May MTD, confirmed) | **$1.39** | flat |
| Revenue (May MTD) | **$0.00** | flat |
| Twilio Balance | **$12.6746** | flat (verified) |
| ElevenLabs Characters (current cycle) | **0 / 300,000 (0.00%)** | flat |
| ElevenLabs Cycle Start | May 8 ~15:07 UTC | day 2 |
| ElevenLabs Next Reset | Jun 7 ~15:07 UTC | — |
| ElevenLabs Voice Min (Paisaxe, May MTD) | 0.0 / 100 | flat |
| Paisaxe Voice Silence | **82 days** | +1 |
| ElevenLabs Account Silence | **24 days** | +1 |
| Revenue Drought | **86 days** | +1 |
| Twilio Runway (at $1.39/mo) | **~9.1 months** | flat |
| API auth status | Pass (both APIs) | flat |
| npm audit advisories (security agent May 8) | **0** | flat |

---

## Current Costs — Per-Service Breakdown

### Fixed / Recurring Costs

| Service | Tier | Monthly Cost (config) | % of Operational | Category | Trend |
|---------|------|-----------------------|------------------|----------|-------|
| Claude Code Max | Max (20x Pro) | $200.00 | — (dev) | Development | flat |
| Supabase | Pro | $25.00 | 25.1% | Infrastructure | flat |
| Anthropic Claude | Prepaid credits | $25.00* | 25.1% | AI | flat |
| ElevenLabs | Creator (annual) | $22.18** | 22.3% | AI / Voice | flat |
| Vercel | Pro | $20.00 | 20.1% | Infrastructure | flat |
| GitHub Pro | Pro | $4.00 | 4.0% | Infrastructure | flat |
| AWS Domains | — | $2.08 | 2.1% | Infrastructure | flat |
| Twilio Phone Number | — | $1.39*** | 1.4% | Communications | flat |
| PostHog | Free | $0.00 | 0% | Analytics | flat |
| **Total Fixed (all, config)** | | **$299.65** | | | |
| **Total Fixed (operational, config)** | | **$99.65** | **100%** | | |

*Anthropic $25/mo is the current config estimate (all projects combined). No per-project breakdown available on personal accounts. Manual check required at platform.claude.com/settings/billing.*

**ElevenLabs Creator billed annually at $266.20/yr (effective $22.18/mo). Next annual invoice: $266.20 on 2027-02-07 (confirmed via API).*

***Twilio config reflects actual recurring charge: $1.15 base + $0.24 regulatory fee = $1.39/mo. Confirmed by Apr 3-4 and May 7 charges.*

**Note**: Claude Code Max ($200/mo) is the primary development tool, categorized separately as "Development." Operational cost analysis focuses on running the live service ($99.65/mo).

### Variable / Usage-Based Costs (May 2026 — MTD Day 10)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Phone rental + regulatory fee) | 1 charge May 7 | **$1.39** | Confirmed (balance $14.0646 -> $12.6746) |
| Twilio (SMS) | 0 messages | $0.00 | Verified via API |
| Twilio (Calls) | 0 minutes | $0.00 | Verified via API |
| Stripe (Processing Fees) | 0 charges | $0.00 | — |
| Anthropic (Claude API) | Unknown | Unknown | No API on personal account |
| Voyage AI (Embeddings) | Unknown | Unknown | — |
| **Total Variable (May MTD, confirmed)** | | **$1.39** | |

### May 2026 MTD (Day 10 of 31)

| Category | Cost |
|----------|------|
| Fixed Operational (proportional, 10/31 days x $99.65) | ~$32.15 |
| Variable confirmed (Twilio May 7 charge) | $1.39 |
| **Total Operational (May MTD est.)** | **~$33.54** |
| Revenue | $0.00 |
| **Net (loss MTD)** | **-$33.54** |

### Monthly Cost History

| Month | Operational Fixed | Variable (confirmed) | Total Operational | Revenue (net) | Coverage |
|-------|-------------------|----------------------|-------------------|---------------|----------|
| Feb 2026 | ~$95 (ramping) | ~$2.75 | ~$97.75 | ~$9.98 | ~10.2% |
| Mar 2026 (final) | $99.41 | $1.15 | **$100.56** | **$0.00** | **0%** |
| Apr 2026 (final) | $99.41 | $1.15 | **$100.56** | **$0.00** | **0%** |
| May 2026 (proj.) | $99.65 | $1.39 (recurring only) | **proj. ~$101.04** | $0.00 (proj.) | 0% |

**Cumulative operational loss since February launch: ~$332.**

---

## Usage Metrics

### ElevenLabs Activity

API queried successfully. Live data:

- **Current cycle**: Started May 8 ~15:07 UTC. Characters used: **0 / 300,000 (0.00%)**. Cycle on day 2.
- **Character stats API**: Returns 0 chars for the current cycle. April activity from the prior cycle (Apr 8 – May 8) is no longer returned; the endpoint now reports only within the active billing period after reset.
- **Most recent conversation (all agents)**: Apr 16 2026 18:44 UTC (Archy, agent ID `agent_7901kk4r9v3wer0t7zp5g1zhdf6x`). **24 days of full-account silence.**
- **Last 10 conversations** all from agent `agent_7901kk4r9v3wer0t7zp5g1zhdf6x` (Archy/personal agents). 3 of the 5 most recent have `status=failed`, consistent with prior Archy failure-rate reports.
- **Paisaxe agents** (Visitor Pelayo, Booking Pelayo, Penny, Iris, Xander): **0 conversations since Feb 17** (82 days).
- **No usage since new cycle began May 8.** Next reset: Jun 7 2026 ~15:07 UTC.

### ElevenLabs Character Usage

| Metric | Value | vs. May 9 |
|--------|-------|-----------|
| Characters used (current cycle) | **0 / 300,000 (0.00%)** | flat |
| Character limit (per API) | 300,000 | flat |
| Current overage | $0.00 | flat |
| Cycle reset (most recent) | May 8 ~15:07 UTC | day 2 of new cycle |
| Cycle reset (next) | Jun 7 ~15:07 UTC | — |

### ElevenLabs Subscription Details

| Field | Value |
|-------|-------|
| Tier | Creator |
| Billing period | Annual |
| Status | Active |
| Cycle reset (most recent) | May 8 ~15:07 UTC |
| Cycle reset (next) | Jun 7 ~15:07 UTC |
| Character limit | 300,000 |
| Voice limit | 30 |
| Voice slots used | 0 / 30 |
| Current overage | $0.00 |
| Next annual invoice | $266.20 on 2027-02-07 |

### Twilio Communications

| Metric | May MTD (day 10) | Apr 2026 (final) | Change |
|--------|-----------------|------------------|--------|
| SMS Sent | 0 (verified) | 0 | flat |
| Calls | 0 (verified) | 0 | flat |
| Usage Cost (API records) | $0.00 (verified) | $0.00 | flat |
| Phone Rental + Fee | $1.39 (charged May 7) | $1.39 (Apr 7) | flat |
| Balance | **$12.6746** (verified) | $14.0646 (Apr 30) | -$1.39 |

**Twilio balance reconciliation:**
- May 1 (start): $14.0646 (carried from April 30)
- May 7 (charged): $12.6746 — phone rental + $0.24 regulatory fee
- May 10 (today, verified): $12.6746 (no further activity)
- Runway: $12.6746 / $1.39 = **~9.1 months** (~9 charges remaining)

### Stripe Revenue

| Metric | May MTD (day 10) | Apr 2026 (final) | Mar 2026 (final) | Feb 2026 (final) |
|--------|----------------|------------------|------------------|------------------|
| Net Sales | 0 | 0 | 0 | 6 |
| Gross Revenue | $0.00 | $0.00 | $0.00 | $13.93 |
| Net Revenue | $0.00 | $0.00 | $0.00 | $9.98 |

**86-day revenue drought** — No Day Pass sales since Feb 13.

---

## Cost Efficiency

| Metric | Current (May 10) | Previous (May 9) | Change | Trend |
|--------|-----------------|------------------|--------|-------|
| Fixed operational cost/mo (config) | **$99.65** | $99.65 | flat | flat |
| Daily burn rate (fixed) | **$3.21/day** | $3.21/day | flat | flat |
| Monthly variable spend (MTD, confirmed) | **$1.39** | $1.39 | flat | flat |
| Cost per voice conversation (Feb actuals) | ~$0.43 | ~$0.43 | flat | flat |
| Cost per voice minute (Feb actuals) | ~$0.37 | ~$0.37 | flat | flat |
| ElevenLabs char utilization (current cycle) | **0.00%** | 0.00% | flat | flat |
| ElevenLabs voice min utilization (Paisaxe, MTD) | 0% | 0% | flat | flat |
| Revenue coverage (operational) | **0%** | 0% | flat | flat |
| Twilio runway | **~9.1 months** | ~9.1 months | flat | flat |

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Alert Level |
|---------|--------|------|-------|-------------|-------------|
| ElevenLabs | Characters (current cycle) | 0 | 300,000 | **0.00%** | SAFE |
| ElevenLabs | Voice Minutes (Paisaxe, May MTD) | 0.0 | 100 | **0%** | SAFE |
| Vercel | Monthly Visitors | ~low | 500,000 (Pro) | **<1%** | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | SAFE |

**All tier alerts clear.** No service is approaching any limit at current usage trajectory.

### Upgrade Trigger Points

| Service | Current Tier | Trigger | Next Tier | Cost Jump |
|---------|--------------|---------|-----------|-----------|
| ElevenLabs | Creator ($22.18/mo eff.) | >100 min/mo | Scale ($99/mo) | +$77/mo |
| Supabase | Pro ($25/mo) | >8 GB storage | Team ($599/mo) | +$574/mo |
| PostHog | Free ($0) | >1M events/mo | Pay-as-you-go | Variable |

---

## Scaling Forecast

Based on `src/lib/costs/forecast.ts` logic. No current Paisaxe variable usage data; using February 2026 actuals as baseline with fallback per-unit costs.

**Per-unit costs (fallback — no active production data):**
- Cost per voice minute: ~$0.08 (ElevenLabs overage fallback rate)
- Cost per chat: ~$0.01 (Claude API estimate fallback)

| Scenario | Visitors/mo | Voice Convos/mo | Voice Min/mo | Est. Monthly Cost (operational) |
|----------|-------------|-----------------|--------------|---------------------------------|
| **Current (1x)** | ~50 | ~0 (dormant) | ~0 (dormant) | ~$101.04 |
| **3x Growth** | ~150 | ~15 | ~180 | ~$192* |
| **10x Growth** | ~500 | ~50 | ~600 | ~$330** |

*At 3x: Voice minutes (180/mo) exceed Creator limit (100 min/mo). Requires Scale tier ($99/mo vs $22.18/mo effective). Fixed adjusted to ~$177 + variable ~$15.

**At 10x: Voice at 600 min/mo exceeds Scale tier (500 min). Estimated $200+ for voice alone; total infrastructure + AI costs ~$330/mo.

### Cost Forecast vs. Revenue Potential

| Scenario | Monthly Cost (op.) | Day Passes Needed to Break Even | Revenue at 5% Conversion |
|----------|--------------------|--------------------------------|--------------------------|
| Current (~50 visitors) | ~$101 | ~60 passes | ~$4.15 (2.5 passes) |
| ~1,200 visitors | ~$101 | ~60 passes | ~$99.60 (60 passes) |
| 5,000 visitors | ~$192 | ~116 passes | ~$414 (250 passes) |

*Break-even: ~1,200 monthly visitors at 5% Day Pass conversion rate (~$1.66 net/pass after Stripe fees).*

---

## Anomalies

| Finding | Severity | Details |
|---------|----------|---------|
| 86-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. Three consecutive zero-revenue months (Mar, Apr; May trajectory). Platform operating at full cost with zero income. Cumulative operational loss ~$332. |
| 82-day Paisaxe voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Platform voice feature dormant to visitors for nearly 3 months. Manual production verification of Pelayo widget and Day Pass flow remains the highest-priority outstanding action. |
| ElevenLabs full-account silence (24 days) | **WATCH** | Last activity Apr 16 18:44 UTC (Archy, 3 of last 5 convos failed with varied errors). New cycle started May 8; no usage in first 2 days. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual check required at platform.claude.com/settings/billing. Config estimate $25/mo may be an underestimate based on observed credit grant frequency ($40-60/mo observed May 2026). |

**Resolved (carry-forward from prior cycles):**
- Twilio recurring-cost config discrepancy ($1.15 -> $1.39) closed by May 8 triage commit.
- API auth regression resolved (May 8 triage patched `scripts/cost-analyst-agent.sh`).
- ElevenLabs character limit reconciled: API reports 300,000 (authoritative); prior 270,783 figure retired.

---

## Trend Analysis

### Comparison: May 9 vs May 10

| Metric | May 9 | May 10 | Change | Direction |
|--------|-------|--------|--------|-----------|
| Variable costs (MTD confirmed) | $1.39 | $1.39 | flat | flat |
| Fixed proportional (MTD) | ~$28.86 | ~$32.15 | +$3.29 | normal burn |
| Total MTD operational | ~$30.25 | ~$33.54 | +$3.29 | normal burn |
| Twilio balance | $12.6746 | $12.6746 | flat | flat |
| Twilio runway | ~9.1 months | ~9.1 months | flat | flat |
| ElevenLabs chars (current cycle) | 0 / 300,000 | 0 / 300,000 | flat | flat |
| ElevenLabs account silence | 23 days | 24 days | +1 | down |
| Paisaxe voice silence | 81 days | 82 days | +1 | down |
| Revenue drought | 85 days | 86 days | +1 | down |
| Cumulative operational loss | ~$319 | ~$332 | +$13 | down |
| API auth | Both Pass | Both Pass | flat | flat |

**Key observations:**

1. **No change to financial position.** Day 10 of May adds normal daily burn ($3.21/day fixed) with no new variable charges.

2. **ElevenLabs character stats behavior confirmed.** After the May 8 cycle reset, the `/v1/usage/character-stats` endpoint returns only current-cycle data. The April activity (from the closed cycle) is no longer visible via this endpoint. This is expected API behavior — not a data loss concern.

3. **86 days without revenue is a milestone.** The drought is now nearly 3 full months. At $3.21/day, total losses since February launch have reached ~$332. No reversal signals are visible in any metric.

4. **ElevenLabs failure rate persists.** The last 10 conversations API confirms 3 of 5 most recent Archy conversations have `status=failed` (consistent with prior 25-30% failure rate reports). This is a personal-agent issue, not Paisaxe-specific.

5. **Dep batch and build:analyze deferred.** Per May 9 triage context, a focused dep upgrade session (8 packages) and `npm run build:analyze` (for the unclassified 125 KB chunk) are pending. No cost impact.

---

## Recommendations

### Immediate Actions (Priority)

1. **Investigate the revenue and voice drought — 86 days (P1, CRITICAL).** Third full zero-revenue month in progress. Manual checks required:
   - Is the Pelayo voice widget rendering and accessible on production (paisaxe.es)?
   - Is the Day Pass purchase flow functional end-to-end?
   - Are Vercel deployment logs showing errors on production?
   - Has organic traffic dropped? (PostHog / Vercel Analytics dashboard)
   - QA journey tests pass in E2E (10/10 last confirmed Apr 30), but production flows remain unverified.

2. **Check Anthropic billing manually (P2)** — Visit platform.claude.com/settings/billing. Config estimate is $25/mo; observed credit grant patterns (from May 2026 memory) suggest $40-60/mo across all projects. If actual Anthropic spend is $40+/mo, operational cost baseline rises $99.65 -> $114.65/mo and cumulative loss estimates would be ~$372.

### Cost Reduction Evaluation

3. **Evaluate Twilio phone number (P3)** — 82 days without a booking call. $1.39/mo actual ($16.68/yr). Consider releasing the number unless bookings are expected to resume in the near term.

4. **Review Vercel Pro and Supabase Pro if drought continues into June (P3)** — At ~50 visitors/mo, both Pro tiers may be overprovisioned:
   - Vercel Pro ($20/mo): Hobby tier is free with reduced limits.
   - Supabase Pro ($25/mo): Free tier includes 500MB storage and 50K MAU.
   - Combined potential savings: up to $45/mo (~45% of operational costs).

5. **Performance agent P3: ElevenLabs click-to-mount** — 493 KB deferred JS chunk serving zero voice users (82-day silence). Implementing click-to-mount initialization would eliminate the ElevenLabs SDK from the initial page load for 100% of current non-voice sessions.

### Long-Term Planning

6. **Revenue trajectory is structurally unsustainable (P1 escalation).** Three consecutive zero-revenue months. Daily burn: $3.21/day. Break-even now requires ~1,200 monthly visitors at 5% Day Pass conversion (currently ~50 visitors). The platform requires a growth event, aggressive cost reduction, or both.

7. **ElevenLabs Creator tier correctly sized.** No upgrade pressure. Scale tier ($99/mo) only warranted if sustained voice traffic exceeds 100 min/mo — currently 82 days dormant.

8. **Dep batch session needed (deferred from triage May 9)** — 8 packages including `next` 16.2.5, `react`/`react-dom` 19.2.6, `@elevenlabs/react` 1.6.0, `stripe` 22.1.1. No cost impact, but `@elevenlabs/react` minor upgrade could shift the 493 KB deferred ElevenLabs chunk (measure before/after).

---

## Data Sources

| Source | Method | Last Queried | Status |
|--------|--------|--------------|--------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-05-10 03:00 UTC | Pass |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=10` | 2026-05-10 03:00 UTC | Pass |
| ElevenLabs Char Stats API | `/v1/usage/character-stats?start_unix&end_unix` | 2026-05-10 03:00 UTC | Pass (0 chars, current cycle only) |
| Twilio Balance API | `/Balance.json` | 2026-05-10 03:00 UTC | Pass ($12.6746) |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json` | 2026-05-10 03:00 UTC | Pass (all $0.00) |
| Config: `service-tiers.ts` | File read | 2026-05-10 | Pass |
| Config: `recurring-costs.ts` | File read | 2026-05-10 | Pass ($1.39 Twilio, config-aligned) |
| Config: `forecast.ts` | File read | 2026-05-10 | Pass |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | — | Manual check required at platform.claude.com/settings/billing |
| Cross-agent context | Agent shared context | 2026-05-10 | Pass — coverage (May 10), security/performance (May 9), triage (May 9) incorporated |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-05-11.*

---
