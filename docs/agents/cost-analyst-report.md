# Cost Analyst Report

> **Generated**: 2026-05-09 03:00 UTC | **Period**: May 2026 (day 9 of 31) | **Status**: WATCH

---

## Executive Summary

API access is restored this run (env now sourced from `.env.local` per May 8 triage commit). Both ElevenLabs and Twilio APIs returned data successfully.

**ElevenLabs cycle reset confirmed**: previous report estimated May 7 ~14:36 UTC; actual API response shows the cycle reset was **May 8 ~15:07 UTC** (one day later than estimated). The new cycle starts at **0 / 300,000 characters** (note: API now reports a 300,000 char/mo limit on Creator tier — 11% higher than the 270,783 figure carried forward from earlier runs; treat 300,000 as authoritative going forward). Next reset: 2026-06-07 ~15:07 UTC. Next annual invoice: $266.20 on ~2027-02-07.

**No new ElevenLabs activity this cycle**. The most recent conversation across all agents is still **Apr 16 2026 18:44 UTC** (Archy, "Pending Actions" — same record as last reported). **22 days of full-account silence**. Paisaxe agents (Pelayo Visitor, Pelayo Booking, Penny, Iris, Xander) remain at zero conversations since Feb 17 — **81 days dormant**.

**Twilio**: Balance **$12.6746** (unchanged since May 7 charge). All `Usage/Records/ThisMonth` entries show $0.00 (no SMS, no calls, no non-recurring charges). The $1.39 phone-rental + regulatory fee charged May 7 carries through May. Runway: **~9.1 months** at current burn.

**Revenue drought reaches 85 days** (since Feb 13). **Paisaxe voice silence: 81 days** (since Feb 17).

**May 9 MTD financial position**: ~$30.25 in operational costs ($28.86 fixed proportional + $1.39 Twilio May 7 charge), $0.00 revenue.

**Cumulative operational loss since February launch: ~$319.** Platform continues at full operational cost with zero revenue for the third consecutive zero-revenue month.

**Financial health: WATCH** — no platform cost-structure anomalies, all tier limits safe by config. Outstanding concerns are unchanged: 85-day revenue drought (business concern) and the Twilio recurring-cost config discrepancy ($1.15 → $1.39, fix landed in `src/config/recurring-costs.ts` per May 8 triage commit — closure verification pending in next analytics run).

| Metric | Value | vs. May 8 |
|--------|-------|-----------|
| Total Fixed Costs (operational, config) | **$99.65/mo** | +$0.24 (Twilio config updated) |
| Twilio Actual Charge (last confirmed) | **$1.39/mo** | flat |
| Variable Costs (May MTD, confirmed) | **$1.39** | flat |
| Daily Burn Rate (fixed, config) | **$3.32/day** | +$0.01 |
| Revenue (May MTD) | **$0.00** | flat |
| Twilio Balance | **$12.6746** | flat (verified via API) |
| ElevenLabs Characters (new cycle) | **0 / 300,000 (0.00%)** | reset May 8 |
| ElevenLabs Cycle | **New cycle started May 8 ~15:07 UTC** | event |
| ElevenLabs Voice Min (Paisaxe, May MTD) | 0.0 / 100 | flat |
| Paisaxe Voice Silence | **81 days** | +1 |
| Revenue Drought | **85 days** | +1 |
| ElevenLabs Account Silence | **22 days** | +1 |
| Twilio Runway (at $1.39/mo) | **~9.1 months** | flat |
| API auth status | Pass (both APIs) | restored |
| npm audit advisories (security agent May 8) | **0** | flat |

---

## Current Costs — Per-Service Breakdown

### Fixed / Recurring Costs

| Service | Tier | Monthly Cost (config) | Actual (last confirmed) | % of Operational | Category | Trend |
|---------|------|----------------------|------------------------|------------------|----------|-------|
| Claude Code Max | Max (20x Pro) | $200.00 | $200.00 | — (dev) | Development | flat |
| Supabase | Pro | $25.00 | $25.00 | 25.1% | Infrastructure | flat |
| Anthropic Claude | Prepaid credits | $25.00* | $25.00* | 25.1% | AI | flat |
| ElevenLabs | Creator (annual) | $22.18** | $22.18** | 22.3% | AI / Voice | flat |
| Vercel | Pro | $20.00 | $20.00 | 20.1% | Infrastructure | flat |
| GitHub Pro | Pro | $4.00 | $4.00 | 4.0% | Infrastructure | flat |
| AWS Domains | — | $2.08 | $2.08 | 2.1% | Infrastructure | flat |
| Twilio Phone Number | — | **$1.39*** | **$1.39 actual** | 1.4% | Communications | resolved |
| PostHog | Free | $0.00 | $0.00 | 0% | Analytics | flat |
| **Total Fixed (all, config)** | | **$299.65** | | | | |
| **Total Fixed (operational, config)** | | **$99.65** | | **100%** | | |

*\*Anthropic $25/mo is the current config value (all projects combined). No per-project breakdown available on personal accounts. Manual check required at platform.claude.com/settings/billing.*

*\*\*ElevenLabs Creator billed annually at $266.20/yr (effective $22.18/mo). Next annual invoice: $266.20 on ~2027-02-07 (per API).*

*\*\*\*Twilio config updated May 8 from $1.15 → $1.39 to reflect recurring $0.24 regulatory fee (confirmed two consecutive cycles: Apr 3-4 and May 7).*

**Note**: Claude Code Max ($200/mo) is the primary development tool, categorized separately as "Development." Operational cost analysis focuses on running the live service ($99.65/mo).

### Variable / Usage-Based Costs (May 2026 — MTD Day 9)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Phone rental + regulatory fee) | 1 charge May 7 | **$1.39** | Confirmed (balance $14.0646 → $12.6746) |
| Twilio (SMS) | 0 messages | $0.00 | Verified via API (`/Usage/Records/ThisMonth`) |
| Twilio (Calls) | 0 minutes | $0.00 | Verified via API |
| Stripe (Processing Fees) | 0 charges | $0.00 | — |
| Anthropic (Claude API) | Unknown | Unknown | No API on personal account |
| Voyage AI (Embeddings) | Unknown | Unknown | — |
| **Total Variable (May MTD, confirmed)** | | **$1.39** | |

### May 2026 MTD (Day 9 of 31)

| Category | Cost |
|----------|------|
| Fixed Operational (proportional, 9/31 days × $99.65) | ~$28.86 |
| Variable confirmed (Twilio May 7 charge) | $1.39 |
| **Total Operational (May MTD est.)** | **~$30.25** |
| Revenue | $0.00 |
| **Net (loss MTD)** | **-$30.25** |

### Monthly Cost History

| Month | Operational Fixed | Variable (confirmed) | Total Operational | Revenue (net) | Coverage |
|-------|-------------------|----------------------|-------------------|---------------|----------|
| Feb 2026 | ~$95 (ramping) | ~$2.75 | ~$97.75 | ~$9.98 | ~10.2% |
| Mar 2026 (final) | $99.41 | $1.15 | **$100.56** | **$0.00** | **0%** |
| Apr 2026 (final) | $99.41 | $1.15 | **$100.56** | **$0.00** | **0%** |
| May 2026 (proj.) | $99.65 | $1.39 (single recurring) | **proj. ~$101.04** | $0.00 (proj.) | 0% |

**Cumulative operational loss since February launch: ~$319.**

---

## Usage Metrics

### ElevenLabs Activity

API queried successfully. Live data:

- **New cycle started May 8 ~15:07 UTC** (~9 hours before report time at 2026-05-09 00:00 UTC; per API `next_character_count_reset_unix`).
- Current characters used in new cycle: **0 / 300,000 (0.00%)**.
- Most recent conversation across all agents: **Apr 16 2026 18:44 UTC** (Archy, agents available: Archy + Coach in last 20 records). **22 days of full-account silence**.
- Paisaxe agents (Visitor Pelayo, Booking Pelayo, Penny, Iris, Xander): **0 conversations since Feb 17** (81 days).
- Closing cycle (Apr 8 → May 8) char usage breakdown from `/v1/usage/character-stats` (last 31 days):
  - Activity bursts: 2,634 chars (~Apr 8), 875 chars, 156 chars, 1,615 chars (~Apr 16). All other days: 0.
  - 23 of 31 days had **zero usage**.

### ElevenLabs Character Usage

| Metric | Value | vs. May 8 |
|--------|-------|-----------|
| Characters used (new cycle) | **0 / 300,000 (0.00%)** | reset May 8 |
| Character limit | **300,000** | +11% (API now reports 300K vs prior 270,783) |
| Cycle reset (most recent) | **May 8 ~15:07 UTC** | event |
| Cycle reset (next) | **Jun 7 ~15:07 UTC** | — |
| Characters used (May MTD, Paisaxe) | 0 | flat |

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
| Current overage | $0.00 |
| Next annual invoice | $266.20 on ~2027-02-07 |
| Voice slots used | 0 / 30 |

### Twilio Communications

| Metric | May MTD (day 9) | Apr 2026 (final) | Change |
|--------|-----------------|------------------|--------|
| SMS Sent | 0 (verified) | 0 | flat |
| Calls | 0 (verified) | 0 | flat |
| Usage Cost (API records) | $0.00 (verified) | $0.00 | flat |
| Phone Rental + Fee | **$1.39** (charged May 7) | $1.15 (Apr 7) | +$0.24 (config-aligned) |
| Balance | **$12.6746** (verified) | $14.0646 (Apr 30) | -$1.39 |

**Twilio balance reconciliation:**
- May 1 (start): $14.0646 (carried from April 30)
- May 7 (charged): $12.6746 — phone rental + $0.24 regulatory fee
- May 9 (today, verified): $12.6746 (no further activity)
- Runway: $12.6746 / $1.39 = **~9.1 months** (~9 charges remaining)

### Stripe Revenue

| Metric | May MTD (day 9) | Apr 2026 (final) | Mar 2026 (final) | Feb 2026 (final) |
|--------|----------------|------------------|------------------|------------------|
| Net Sales | 0 | 0 | 0 | 6 |
| Gross Revenue | $0.00 | $0.00 | $0.00 | $13.93 |
| Net Revenue | $0.00 | $0.00 | $0.00 | $9.98 |

**85-day revenue drought** — No Day Pass sales since Feb 13.

---

## Cost Efficiency

| Metric | Current (May 9) | Previous (May 8) | Change | Trend |
|--------|-----------------|------------------|--------|-------|
| Fixed operational cost/mo (config) | **$99.65** | $99.41 | +$0.24 | up |
| Daily burn rate (fixed) | **$3.32/day** | $3.31/day | +$0.01 | up |
| Monthly variable spend (MTD, confirmed) | **$1.39** | $1.39 | flat | flat |
| Cost per voice conversation (Feb actuals) | ~$0.43 | ~$0.43 | flat | flat |
| Cost per voice minute (Feb actuals) | ~$0.37 | ~$0.37 | flat | flat |
| ElevenLabs char utilization (new cycle) | **0.00%** | reset (~0% est.) | confirmed | flat |
| ElevenLabs voice min utilization (Paisaxe, MTD) | 0% | 0% | flat | flat |
| Revenue coverage (operational) | **0%** | 0% | flat | flat |
| Twilio runway | **~9.1 months** | ~9.1 months | flat | flat |

The +$0.24/mo increase is a **config-side correction**, not new spend — the underlying recurring cost has been $1.39 since at least Apr 3. Now reflected accurately in `src/config/recurring-costs.ts`.

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Alert Level |
|---------|--------|------|-------|-------------|-------------|
| ElevenLabs | Characters (new cycle) | 0 | 300,000 | **0.00%** | SAFE |
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

Based on `src/lib/costs/forecast.ts` logic. No May Paisaxe variable data; using February 2026 actuals as baseline with fallback per-unit costs.

**Per-unit costs (fallback — no current production data):**
- Cost per voice minute: ~$0.08 (ElevenLabs overage fallback rate)
- Cost per chat: ~$0.01 (Claude API estimate fallback)

| Scenario | Visitors/mo | Voice Convos/mo | Voice Min/mo | Est. Monthly Cost (operational) |
|----------|-------------|-----------------|--------------|---------------------------------|
| **Current (1x)** | ~50 | ~0 (dormant) | ~0 (dormant) | ~$101.04 |
| **3x Growth** | ~150 | ~150 | ~180 | ~$185* |
| **10x Growth** | ~500 | ~500 | ~600 | ~$385** |

*\*At 3x: Voice minutes (180/mo) exceed Creator limit (100 min/mo). Requires Scale tier ($99/mo vs $22.18/mo). Total: ~$67 infra + $10 AI + $99 voice + ~$5 SMS = ~$185.*

*\*\*At 10x: Voice at 600 min/mo exceeds Scale tier (500 min). Likely requires Enterprise pricing. Estimated $200+ for voice alone.*

### Cost Forecast vs. Revenue Potential

| Scenario | Monthly Cost (op.) | Day Passes Needed to Break Even | Revenue at 5% Conversion |
|----------|--------------------|--------------------------------|--------------------------|
| Current (~50 visitors) | ~$101 | ~62 passes | ~$4.10 (2.5 passes) |
| 500 visitors | ~$185 | ~113 passes | ~$42.75 (25 passes) |
| 5,000 visitors | ~$385 | ~235 passes | ~$427.50 (250 passes) |

*Break-even: ~3,750 monthly visitors at 5% Day Pass conversion rate (~$1.64 net/pass after Stripe fees).*

---

## Anomalies

| Finding | Severity | Details |
|---------|----------|---------|
| 85-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. Three consecutive zero-revenue months (Mar, Apr; May trajectory). Platform operating at full cost with zero income. Cumulative operational loss ~$319. |
| 81-day Paisaxe voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Platform dormant to visitors for over 2.6 months. Manual production verification of Pelayo widget and Day Pass flow remains the highest-priority outstanding action. |
| ElevenLabs character_limit reported as 300,000 (vs. prior 270,783) | **WATCH** | API now reports 300K char/mo limit on Creator tier. May reflect a tier metadata update by ElevenLabs. Not a concern for utilization (still 0%) but tier-config docs should be reconciled if persistent. |
| ElevenLabs full-account silence (22 days) | **WATCH** | Last activity Apr 16 18:44 UTC. New cycle started May 8 ~15:07 UTC with no usage so far (~9h elapsed). Personal Archy/Coach agents inactive — Paisaxe agents remain at 0 since Feb 17. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual check required at platform.claude.com/settings/billing. |

**Resolved this cycle:**
- Twilio recurring-cost config discrepancy ($1.15 → $1.39) closed by May 8 triage commit. No anomaly to flag going forward.
- API auth regression resolved (May 8 triage patched `scripts/cost-analyst-agent.sh` to source `.env.local`).

---

## Trend Analysis

### Comparison: May 8 vs May 9

| Metric | May 8 | May 9 | Change | Direction |
|--------|-------|-------|--------|-----------|
| Variable costs (MTD confirmed) | $1.39 | $1.39 | flat | flat |
| Twilio balance | $12.6746 (last confirmed) | **$12.6746 (verified)** | flat | flat |
| Twilio runway | ~9.1 months | ~9.1 months | flat | flat |
| ElevenLabs cycle status | Estimated reset May 7 | **Confirmed reset May 8 15:07 UTC** | corrected | event |
| ElevenLabs characters (new cycle) | ~0 (estimated) | **0 (verified)** | confirmed | flat |
| ElevenLabs char limit (per API) | 270,783 (config) | **300,000 (API)** | +11% | up |
| Most recent ElevenLabs convo | Apr 16 18:44 UTC | Apr 16 18:44 UTC | +1 day silence | flat |
| Full-account silence duration | 21 days (est.) | **22 days (verified)** | +1 day | down |
| Paisaxe voice conversations (MTD) | 0 | 0 | flat | flat |
| Paisaxe voice dormancy streak | 80 days | **81 days** | +1 | down |
| Revenue drought streak | 84 days | **85 days** | +1 | down |
| Cumulative operational loss | ~$316 | **~$319** | +$3 | down |
| Twilio recurring-cost config | $1.15 (mismatch) | **$1.39 (resolved)** | resolved | up (accuracy) |
| API auth available | Both APIs Fail | **Both APIs Pass** | restored | up |
| Fixed operational cost/mo | $99.41 (config) | **$99.65 (config)** | +$0.24 | up (corrected) |

**Key observations:**

1. **API auth restored** — ElevenLabs and Twilio APIs both queried successfully this cycle. Carry-forward window closed; live verification resumes.

2. **ElevenLabs cycle reset corrected** — Actual reset was May 8 ~15:07 UTC (one day later than the May 7 estimate carried forward). New cycle is currently 0/300,000 chars used (~9h in). 23 of last 31 days saw zero usage; remaining bursts attributable to personal Archy testing on Apr 8 and Apr 16.

3. **ElevenLabs character limit now reads 300,000** in the subscription API (vs. 270,783 carried forward in earlier reports). Treating 300K as authoritative going forward. Either ElevenLabs adjusted Creator tier metadata or earlier reports inferred the limit incorrectly. Worth verifying once next cycle to confirm persistence.

4. **Twilio config discrepancy closed** — `src/config/recurring-costs.ts` now reflects the actual $1.39/mo (+$0.24 regulatory fee). Operational fixed cost rises $99.41 → $99.65 in calculations but reflects no new spend.

5. **Revenue and voice drought both incremented by 1 day.** No reversal signals. May 9 is day 2 of week 13 of the revenue drought.

---

## Recommendations

### Immediate Actions (Priority)

1. **Investigate the revenue and voice drought — 85 days (P1).** Three full months in with zero revenue. Manual checks required:
   - Is the Pelayo voice widget rendering and accessible on production (paisaxe.es)?
   - Is the Day Pass purchase flow functional end-to-end?
   - Are Vercel deployment logs showing errors on production?
   - Has organic traffic dropped? (PostHog / Vercel Analytics dashboard)
   - QA journey tests pass in E2E (10/10 since Apr 30), but production flows remain unverified.

2. **Verify ElevenLabs tier metadata change (P3, NEW).** API now reports 300,000 char/mo limit (vs. 270,783 historically). Cross-check the subscription dashboard at https://elevenlabs.io/subscription. If persistent, update any documentation that referenced the 270K figure.

3. **Check Anthropic billing manually (P2)** — Visit platform.claude.com/settings/billing. Config estimate is $25/mo; observed credit grant patterns suggest possible underestimate.

### Cost Reduction Evaluation

4. **Evaluate Twilio phone number (P3)** — 81 days without a booking call. $1.39/mo actual ($16.68/yr). Consider releasing the number unless bookings are expected to resume.

5. **Review Vercel Pro and Supabase Pro if drought continues into June (P3)** — At ~50 visitors/mo, both Pro tiers may be overprovisioned:
   - Vercel Pro ($20/mo): Hobby tier is free with reduced limits.
   - Supabase Pro ($25/mo): Free tier includes 500MB storage and 50K MAU.
   - Combined potential savings: up to $45/mo (~45% of operational costs).

### Long-Term Planning

6. **Revenue trajectory remains structurally unsustainable (P1 escalation).** Three consecutive zero-revenue months. Daily burn: $3.32/day. Break-even requires ~3,750 monthly visitors (75x current). The platform requires a growth event, aggressive cost reduction, or both before June.

7. **ElevenLabs Creator tier correctly sized.** No upgrade pressure. Scale tier ($99/mo) only warranted if sustained Paisaxe voice traffic exceeds 100 min/mo — currently 81 days dormant.

8. **May variable cost baseline confirmed at $1.39/mo recurring.** Annual operational cost projection: ~$1,212.48/yr (vs $1,206.72 at $100.56/mo).

---

## Data Sources

| Source | Method | Last Queried | Status |
|--------|--------|--------------|--------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-05-09 00:00 UTC | Pass |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=20` | 2026-05-09 00:00 UTC | Pass |
| ElevenLabs Char Stats API | `/v1/usage/character-stats?start_unix&end_unix` | 2026-05-09 00:00 UTC | Pass |
| Twilio Balance API | `/Balance.json` | 2026-05-09 00:00 UTC | Pass ($12.6746) |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json` | 2026-05-09 00:00 UTC | Pass (all $0.00) |
| Config: `service-tiers.ts` | File read | 2026-05-09 | Pass |
| Config: `recurring-costs.ts` | File read | 2026-05-09 | Pass — Twilio $1.39/mo (config-aligned with actual) |
| Config: `forecast.ts` | File read | 2026-05-09 | Pass |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | — | Manual check required at platform.claude.com/settings/billing |
| Cross-agent context | Agent shared context | 2026-05-09 | Pass — coverage (May 9), security/performance (May 7-8), localization/documentation (May 6-7) incorporated |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-05-10.*

---
