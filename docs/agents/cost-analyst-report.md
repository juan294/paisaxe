# Cost Analyst Report

> **Generated**: 2026-05-08 03:00 UTC | **Period**: May 2026 (day 8 of 31) | **Status**: WATCH

---

## Executive Summary

**API access unavailable this run.** `ELEVENLABS_API_KEY`, `TWILIO_ACCOUNT_SID`, and `TWILIO_AUTH_TOKEN` are not exported in the agent's shell, so live ElevenLabs and Twilio queries returned auth errors. The previous report (May 7, 03:00 UTC) confirmed the Twilio May 7 phone rental charge ($1.39) and the ElevenLabs cycle reset event (~14:36 UTC May 7). This report carries forward those confirmed values and increments the dormancy and drought counters by one day.

**Material events expected today**:
- ElevenLabs cycle reset at ~14:36 UTC May 7 should now show a fresh counter at ~0 characters in the new cycle (~12.4 hours into the new cycle at report time). Cannot verify without API access — flagged for next run.
- Twilio balance should be stable at $12.6746 since no SMS/calls have been made in 80+ days. Cannot verify this run.

**Revenue drought reaches 84 days** (since Feb 13). **Paisaxe voice silence: 80 days** (since Feb 17). Full-account ElevenLabs silence: **21 days** (since Apr 16 18:44 UTC, last observed) — unverified this cycle.

**May 8 MTD financial position**: ~$27.04 in operational costs ($25.65 fixed proportional + $1.39 Twilio charge confirmed May 7), $0.00 revenue. Variable costs unchanged from May 7 ($1.39).

**Cumulative operational loss since February launch: ~$316.** Platform continues at full operational cost with zero revenue.

**Financial health: WATCH** — no platform cost-structure anomalies, all tier limits safe by config. Outstanding concerns are unchanged: 84-day revenue drought (business concern) and the Twilio recurring-cost config discrepancy (+$0.24/mo) — fix still pending.

| Metric | Value | vs. May 7 |
|--------|-------|-----------|
| Total Fixed Costs (operational, config) | **$99.41/mo** | flat |
| Total Fixed Costs (operational, actual) | **~$99.65/mo** | flat |
| Twilio Actual Charge (last confirmed) | **$1.39/mo** | flat |
| Variable Costs (May MTD, confirmed) | **$1.39** | flat (Twilio one-off charged May 7) |
| Daily Burn Rate (fixed) | **$3.31/day** | flat |
| Revenue (May MTD) | **$0.00** | flat |
| Twilio Balance (last confirmed May 7) | **$12.6746** | flat (unverified) |
| ElevenLabs Characters (closing cycle, last confirmed) | 13,734 / 270,783 (5.07%) | cycle reset May 7 |
| ElevenLabs Cycle | **New cycle (started May 7 ~14:36 UTC)** | event |
| ElevenLabs Voice Min (Paisaxe, May MTD) | 0.0 / 100 | flat |
| Paisaxe Voice Silence | **80 days** | +1 |
| Revenue Drought | **84 days** | +1 |
| ElevenLabs Account Silence (last confirmed) | **~21 days** | +1 (unverified) |
| Twilio Runway (at $1.39/mo) | **~9.1 months** | flat |
| npm audit advisories (per security agent May 6) | **0** | flat |

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
| Twilio Phone Number | — | $1.15*** | **$1.39 actual** | 1.2% | Communications | WARNING |
| PostHog | Free | $0.00 | $0.00 | 0% | Analytics | flat |
| **Total Fixed (all, config)** | | **$299.41** | | | | |
| **Total Fixed (operational, config)** | | **$99.41** | | **100%** | | |
| **Total Fixed (operational, actual)** | | | **~$99.65** | | | |

*\*Anthropic $25/mo is the current config value (all projects combined). No per-project breakdown available on personal accounts. Manual check required at platform.claude.com/settings/billing.*

*\*\*ElevenLabs Creator billed annually at $266.20/yr (effective $22.18/mo). Next annual invoice: $266.20 on ~2027-02-07 (per May 7 API confirmation).*

*\*\*\*Twilio config says $1.15/mo but May 7 charge confirmed $1.39 (Apr 3-4 also showed $0.24 fee). Config update pending. See Recommendations.*

**Note**: Claude Code Max ($200/mo) is the primary development tool, categorized separately as "Development." Operational cost analysis focuses on running the live service ($99.41/mo config, ~$99.65 actual).

### Variable / Usage-Based Costs (May 2026 — MTD Day 8)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Phone rental + regulatory fee) | 1 charge on May 7 | **$1.39** | Confirmed May 7 (balance drop $14.0646 → $12.6746) |
| Twilio (SMS) | 0 messages | $0.00 | Last confirmed May 7 (Usage API records all $0.00) |
| Twilio (Calls) | 0 minutes | $0.00 | Last confirmed May 7 |
| Stripe (Processing Fees) | 0 charges | $0.00 | — |
| Anthropic (Claude API) | Unknown | Unknown | No API on personal account |
| Voyage AI (Embeddings) | Unknown | Unknown | — |
| **Total Variable (May MTD, confirmed)** | | **$1.39** | |

### May 2026 MTD (Day 8 of 31)

| Category | Cost |
|----------|------|
| Fixed Operational (proportional, 8/31 days × $99.41) | ~$25.65 |
| Variable confirmed (Twilio May 7 charge) | $1.39 |
| **Total Operational (May MTD est.)** | **~$27.04** |
| Revenue | $0.00 |
| **Net (loss MTD)** | **-$27.04** |

### Monthly Cost History

| Month | Operational Fixed | Variable (confirmed) | Total Operational | Revenue (net) | Coverage |
|-------|-------------------|----------------------|-------------------|---------------|----------|
| Feb 2026 | ~$95 (ramping) | ~$2.75 | ~$97.75 | ~$9.98 | ~10.2% |
| Mar 2026 (final) | $99.41 | $1.15 | **$100.56** | **$0.00** | **0%** |
| Apr 2026 (final) | $99.41 | $1.15 | **$100.56** | **$0.00** | **0%** |
| May 2026 (MTD day 8) | $99.41 (proj.) | **$1.39 (confirmed)** | **proj. ~$100.80** | $0.00 | 0% |

**May variable cost confirmed at $1.39 (vs $1.15 in Mar and Apr).** If the regulatory fee persists, monthly operational cost is now ~$100.80.

**Cumulative operational loss since February launch: ~$316.**

---

## Usage Metrics

### ElevenLabs Activity

**API not queried this run (env var unavailable).** Carrying forward May 7 confirmed data:

- New cycle started **May 7 ~14:36 UTC**. Fresh counter — should be at or near 0 characters at report time (~12.4h into new cycle).
- Closing cycle (Apr 7 → May 7) ended at **13,734 / 270,783 characters (5.07%)**.
- Most recent conversation across all agents (last confirmed): **Apr 16 18:44 UTC** (Archy, "Pending Actions"). 21 days of full-account silence at report time, unverified this cycle.
- Paisaxe agents (Visitor Pelayo, Booking Pelayo, Penny, Iris, Xander): **0 conversations since Feb 17** (80 days).
- Archy failure rate (last 20 conversations): 6/20 (30%) — last refreshed May 6.

### ElevenLabs Character Usage

| Metric | Value | vs. May 7 |
|--------|-------|-----------|
| Characters used (new cycle, est.) | **~0 / 270,783 (~0%)** | reset May 7 |
| Character limit | **270,783** | flat |
| Cycle reset | **May 7 ~14:36 UTC (started)** | event |
| Characters used (May MTD, Paisaxe) | 0 | flat |

### ElevenLabs Subscription Details (last confirmed May 7)

| Field | Value |
|-------|-------|
| Tier | Creator |
| Billing period | Annual |
| Status | Active |
| Cycle reset (most recent) | May 7 ~14:36 UTC |
| Character limit | 270,783 |
| Voice limit | 30 |
| Current overage | $0.00 |
| Next annual invoice | $266.20 on ~2027-02-07 |

### Twilio Communications

| Metric | May MTD (day 8, est.) | Apr 2026 (final) | Change |
|--------|-----------------------|------------------|--------|
| SMS Sent | 0 (last confirmed May 7) | 0 | flat |
| Calls | 0 (last confirmed May 7) | 0 | flat |
| Usage Cost (API records) | $0.00 (last confirmed May 7) | $0.00 | flat |
| Phone Rental + Fee | **$1.39** (charged May 7) | $1.15 (Apr 7) | +$0.24 |
| Balance | **$12.6746** (last confirmed May 7) | $14.0646 (Apr 30) | -$1.39 |

**Twilio balance reconciliation:**
- May 1 (start): $14.0646 (carried from April 30)
- May 7 (charged): $12.6746 — phone rental + $0.24 regulatory fee
- May 8 (today, est.): $12.6746 (no usage activity expected)
- Runway: $12.6746 / $1.39 = **~9.1 months** (~9 charges remaining)

### Stripe Revenue

| Metric | May MTD (day 8) | Apr 2026 (final) | Mar 2026 (final) | Feb 2026 (final) |
|--------|----------------|------------------|------------------|------------------|
| Net Sales | 0 | 0 | 0 | 6 |
| Gross Revenue | $0.00 | $0.00 | $0.00 | $13.93 |
| Net Revenue | $0.00 | $0.00 | $0.00 | $9.98 |

**84-day revenue drought** — No Day Pass sales since Feb 13. May continues the March/April trajectory.

---

## Cost Efficiency

| Metric | Current (May 8) | Previous (May 7) | Change | Trend |
|--------|-----------------|------------------|--------|-------|
| Fixed operational cost/mo (config) | **$99.41** | $99.41 | flat | flat |
| Fixed operational cost/mo (actual) | **~$99.65** | ~$99.65 | flat | flat |
| Daily burn rate (fixed) | **$3.31/day** | $3.31/day | flat | flat |
| Monthly variable spend (MTD, confirmed) | **$1.39** | $1.39 | flat | flat |
| Cost per voice conversation (Feb actuals) | ~$0.43 | ~$0.43 | flat | flat |
| Cost per voice minute (Feb actuals) | ~$0.37 | ~$0.37 | flat | flat |
| ElevenLabs char utilization (new cycle, est.) | **~0%** | 5.07% (closing) | reset | reset |
| ElevenLabs voice min utilization (Paisaxe, MTD) | 0% | 0% | flat | flat |
| Revenue coverage (operational) | **0%** | 0% | flat | flat |
| Twilio runway | **~9.1 months** | ~9.1 months | flat | flat |

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Alert Level |
|---------|--------|------|-------|-------------|-------------|
| ElevenLabs | Characters (new cycle, est.) | ~0 | 270,783 | **~0%** | SAFE |
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
| **Current (1x)** | ~50 | ~0 (dormant) | ~0 (dormant) | ~$100.80 |
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
| 84-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. Three consecutive zero-revenue months (Mar, Apr, May trajectory). Platform operating at full cost with zero income. Cumulative operational loss ~$316. |
| 80-day Paisaxe voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Platform dormant to visitors for over 2.5 months. Manual production verification of Pelayo widget and Day Pass flow remains the highest-priority outstanding action. |
| Twilio recurring regulatory fee (+$0.24/mo) | **WATCH** | May 7 charge was $1.39 vs $1.15 config. Pattern recurring (Apr 3-4 and May 7). Config update from $1.15 to $1.39 still pending. |
| ElevenLabs full-account silence (~21 days) | **WATCH** | Last activity Apr 16 18:44 UTC (last confirmed). New cycle reset May 7 — fresh counter. Cannot verify post-reset activity this run (API auth unavailable). |
| API auth missing this run | **WATCH** | `ELEVENLABS_API_KEY` and Twilio creds not exported in agent shell. Live API queries returned auth errors. Carry-forward report. Investigate launchd plist `EnvironmentVariables` so agents can read these on next run. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual check required at platform.claude.com/settings/billing. |

---

## Trend Analysis

### Comparison: May 7 vs May 8

| Metric | May 7 | May 8 | Change | Direction |
|--------|-------|-------|--------|-----------|
| Variable costs (MTD confirmed) | $1.39 | $1.39 | flat | flat |
| Twilio balance (last confirmed) | $12.6746 | $12.6746 | flat | flat |
| Twilio runway | ~9.1 months | ~9.1 months | flat | flat |
| ElevenLabs cycle status | Resetting today ~14:36 UTC | New cycle (~12.4h elapsed) | event | reset |
| ElevenLabs characters (cycle, est.) | 13,734 (5.07% closing) | ~0 (new cycle, unverified) | -13,734 | reset |
| Most recent ElevenLabs convo (last confirmed) | Apr 16 18:44 UTC | Apr 16 18:44 UTC | +1 day | flat |
| Full-account silence duration (est.) | 20 days | 21 days | +1 day | down |
| Paisaxe voice conversations (MTD) | 0 | 0 | flat | flat |
| Paisaxe voice dormancy streak | 79 days | **80 days** | +1 | down |
| Revenue drought streak | 83 days | **84 days** | +1 | down |
| Cumulative operational loss | ~$313 | **~$316** | +$3 | down |
| API auth available | Both APIs Pass | **Both APIs Fail** | regression | down |

**Key observations:**

1. **API auth regression this cycle.** Both ElevenLabs and Twilio creds are not exported in the agent shell. This is a tooling/environment issue, not a billing or service issue. Investigate the launchd plist `EnvironmentVariables` for the cost-analyst agent so it can read these on next run.

2. **ElevenLabs new cycle started May 7 ~14:36 UTC.** Fresh counter. No way to verify current usage without API access. Next run should report initial new-cycle usage.

3. **Twilio May 7 charge stands.** No further activity expected (no SMS, no calls). Balance ~$12.6746 carries forward.

4. **Revenue and voice drought both incremented by 1 day.** No signals of reversal. May 8 is day 1 of week 13 of the revenue drought.

5. **No code action items resolved this cycle from the cost-analyst side.** Twilio config update from $1.15 to $1.39 remains pending (security and triage agents flagged).

---

## Recommendations

### Immediate Actions (Priority)

1. **Restore API auth for the cost-analyst agent (P1, NEW).** The launchd plist for the cost-analyst agent must export `ELEVENLABS_API_KEY`, `TWILIO_ACCOUNT_SID`, and `TWILIO_AUTH_TOKEN`. Without these, automated reports degrade to carry-forward only. Check `~/Library/LaunchAgents/com.paisaxe.cost-analyst-agent.plist` (or equivalent) and ensure `EnvironmentVariables` includes these keys.

2. **Investigate the revenue and voice drought — 84 days (P1).** Four months in with zero revenue. Manual checks required:
   - Is the Pelayo voice widget rendering and accessible on production (paisaxe.es)?
   - Is the Day Pass purchase flow functional end-to-end?
   - Are Vercel deployment logs showing errors on production?
   - Has organic traffic dropped? (PostHog / Vercel Analytics dashboard)
   - QA journey tests pass in E2E, but production flows remain unverified.

3. **Update Twilio config from $1.15 to $1.39 (P2, RECURRING).** Pattern confirmed (Apr 3-4 and May 7). Update `src/config/recurring-costs.ts` Twilio entry from $1.15 to $1.39. Also adjusts break-even calculation. Actual monthly operational cost: ~$99.65 (not $99.41).

4. **Check Anthropic billing manually (P2)** — Visit platform.claude.com/settings/billing. Config estimate is $25/mo; observed credit grant patterns suggest possible underestimate.

5. **Verify ElevenLabs new-cycle counter on next run (P2)** — Once API auth is restored, the May 7 reset means a fresh 270,783-character pool. Track the first 7 days of the new cycle for initial activity.

### Cost Reduction Evaluation

6. **Evaluate Twilio phone number (P3)** — 80 days without a booking call. $1.39/mo actual. Consider releasing the number unless bookings are expected to resume. ~$16-17/yr savings.

7. **Review Vercel Pro and Supabase Pro if drought continues into June (P3)** — At ~50 visitors/mo, both Pro tiers may be overprovisioned:
   - Vercel Pro ($20/mo): Hobby tier is free with reduced limits.
   - Supabase Pro ($25/mo): Free tier includes 500MB storage and 50K MAU.
   - Combined potential savings: up to $45/mo (~45% of operational costs).

### Long-Term Planning

8. **Revenue trajectory remains structurally unsustainable (P1 escalation).** Four consecutive zero-revenue months. Daily burn: $3.31/day. Break-even requires ~3,750 monthly visitors (75x current). The platform requires a growth event, aggressive cost reduction, or both before June.

9. **ElevenLabs Creator tier correctly sized.** No upgrade pressure. Scale tier ($99/mo) only warranted if sustained Paisaxe voice traffic exceeds 100 min/mo — currently 80 days dormant.

10. **May variable cost baseline shifted to $1.39/mo.** Annual operational cost projection: ~$1,209.12/yr (vs $1,206.72 at $100.56/mo).

---

## Data Sources

| Source | Method | Last Queried | Status |
|--------|--------|--------------|--------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-05-08 03:00 UTC | **Fail — auth (env var missing)**. Last successful: 2026-05-07 |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=20` | 2026-05-08 03:00 UTC | **Fail — auth (env var missing)**. Last successful: 2026-05-07 |
| Twilio Balance API | `/Balance.json` | 2026-05-08 | **Skipped — auth (env var missing)**. Last successful: 2026-05-07 ($12.6746) |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json` | 2026-05-08 | **Skipped — auth (env var missing)**. Last successful: 2026-05-07 (all $0.00) |
| Config: `service-tiers.ts` | File read | 2026-05-08 | Pass |
| Config: `recurring-costs.ts` | File read | 2026-05-08 | Pass — Twilio $1.15/mo (config; actual confirmed $1.39 on May 7) |
| Config: `forecast.ts` | File read | 2026-05-08 | Pass |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | — | Manual check required at platform.claude.com/settings/billing |
| Cross-agent context | Agent shared context | 2026-05-08 | Pass — coverage (May 8), security/performance (May 6/7), localization/documentation (May 6/7) incorporated |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-05-09.*

---
