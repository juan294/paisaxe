# Cost Analyst Report

> **Generated**: 2026-06-11 01:07 UTC | **Period**: June 2026 (day 11 of 30) | **Status**: WATCH

---

## Executive Summary

Both ElevenLabs and Twilio APIs queried successfully. Day 11 of the June billing month, and this is a fully quiescent cycle: zero movement on every cost metric versus the Jun 10 report. ElevenLabs holds at **38 / 300,000 characters (0.013%)** with no new conversations since the single Jun 8 personal "Coach" event; Twilio balance is flat at **$11.2846** with both June recurring components already posted and reconciled; all tier limits are far within bounds; fixed costs are unchanged; revenue remains $0. The only changes are the deterministic ones: the drought counters advance to **118 days revenue / 114 days Paisaxe voice**, and the fixed-cost accrual ticks up one day. One material carry-forward update: the Performance agent's bundle RED was resolved on Jun 10 by a budget decision (total budget raised 3,100 to 3,500 KB to honestly cover the ElevenLabs SDK chunk), so voice-shelving no longer carries a performance justification — it now stands purely on the cost/revenue case.

**ElevenLabs**: Creator tier, **38 / 300,000 characters (0.013%)** in the current billing cycle (started Jun 7 ~15:15 UTC, day 4 of 30). No new conversations of any kind since Jun 8 11:40 UTC. All five Paisaxe agents (Visitor Pelayo, Booking Pelayo, Penny, Iris, Xander) remain at zero conversations. Next cycle reset: ~Jul 7 2026 15:15 UTC (Unix 1783437319). Next annual invoice: $266.20 on 2027-02-07 (Unix 1802012845).

**Twilio**: Balance **$11.2846** (flat versus Jun 10 — zero change, 4th consecutive flat day since the Jun 7 base-rental posting). June recurring fully posted and reconciled: $0.24 regulatory fee (Jun 4) + $1.15 base rental (Jun 7) = $1.39, matching `recurring-costs.ts`. All June usage records are $0.00 (60 records checked, 0 non-zero). Runway ~8.1 months. No further Twilio charge expected until ~Jul 7.

**Revenue drought reaches 118 days** (since Feb 13). **Paisaxe voice silence: 114 days** (since Feb 17).

**June 2026 financial position (day 11)**: ~$36.52 in accrued fixed operational costs (11 days x $3.32/day), $1.39 in confirmed Twilio variable charges (both June charges posted), $0.00 revenue.

**Cumulative operational loss since February launch: ~$426.**

**Financial health: WATCH** — no platform cost-structure anomalies, all tier limits safe, security GREEN (0 advisories, Jun 10). The outstanding concern remains the 118-day revenue drought and 114-day Paisaxe voice silence, which require manual production investigation on paisaxe.es. The tier-downgrade / voice-shelving decision is now a pure cost-and-product lever after the Jun 10 bundle-budget raise removed the performance justification (see Trend Analysis).

---

## Current Costs (This Month)

### Fixed / Recurring Costs

| Service | Tier | Monthly Cost | % of Operational | Category | Trend |
|---------|------|-------------|-----------------|----------|-------|
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
| **Total Fixed (operational)** | | **$99.65** | **100%** | | |

*Anthropic $25/mo is the config estimate (all projects combined). No per-project breakdown available on personal accounts. Observed credit grant patterns suggest actual spend may be $40-60/mo. Manual check required at platform.claude.com/settings/billing.*

**ElevenLabs Creator billed annually at $266.20/yr (effective $22.18/mo). Next annual invoice: $266.20 on 2027-02-07 (verified via API: amount_due_cents 26620, next_payment_attempt_unix 1802012845).*

***Twilio config reflects actual recurring charge: $1.15 base + $0.24 regulatory fee = $1.39/mo. Both June components posted (reg fee Jun 4, base rental Jun 7), confirming the $1.39 split is correct in config.*

**Note**: Claude Code Max ($200/mo) is the primary development tool, categorized separately as "Development." Operational cost analysis focuses on the live service ($99.65/mo).

**Total Fixed Operational**: $99.65/mo | **Daily Burn Rate**: $3.32/day (June = 30 days)

### Variable / Usage-Based Costs (June 2026 — Day 11)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Phone rental base) | Posted Jun 7 (balance -$1.15) | **$1.15** | Verified via API (balance drop) |
| Twilio (Regulatory fee) | Posted Jun 4 (balance -$0.24) | **$0.24** | Verified via API (balance drop) |
| Twilio (SMS) | 0 messages | $0.00 | Verified via API |
| Twilio (Calls) | 0 minutes | $0.00 | Verified via API |
| ElevenLabs (overage) | 38 chars (well within 300K) | $0.00 | Verified via API (current_overage = $0) |
| Stripe (Processing Fees) | 0 charges | $0.00 | — |
| Anthropic (Claude API) | Unknown | Unknown | No API on personal account |
| Voyage AI (Embeddings) | Unknown | Unknown | No dedicated API |
| **Total Variable (June day 11, confirmed)** | | **$1.39** | |

### June 2026 Position (Day 11 of 30)

| Category | Cost |
|----------|------|
| Fixed Operational (accrued, 11 days x $3.32) | ~$36.52 |
| Variable confirmed (Twilio reg fee + base rental, both posted) | $1.39 |
| **Total Operational (June MTD)** | **~$37.91** |
| Revenue | $0.00 |
| **Net (loss)** | **-$37.91** |

*Note: the $1.39/mo Twilio charge is already embedded in the $3.32/day fixed burn rate; the "variable confirmed" line tracks the lumpy actual postings for reconciliation and slightly overlaps the smoothed daily accrual. Projected June close (no growth event): ~$99.65 fixed operational, $0.00 revenue.*

### Monthly Cost History

| Month | Operational Fixed | Variable (confirmed) | Total Operational | Revenue (net) | Coverage |
|-------|-------------------|----------------------|-------------------|---------------|----------|
| Feb 2026 | ~$95 (ramping) | ~$2.75 | ~$97.75 | ~$9.98 | ~10.2% |
| Mar 2026 (final) | $99.41 | $1.15 | **$100.56** | **$0.00** | **0%** |
| Apr 2026 (final) | $99.41 | $1.39 | **$100.80** | **$0.00** | **0%** |
| May 2026 (final) | $99.65 | $1.39 | **$101.04** | **$0.00** | **0%** |
| Jun 2026 (day 11) | $99.65 (proj.) | $1.39 (both posted) | **~$101.04 (proj.)** | $0.00 (MTD) | 0% |

**Cumulative operational loss since February launch: ~$426.**

---

## Usage Metrics

### ElevenLabs Activity

API queried successfully. Live data:

- **Current cycle**: Started Jun 7 ~15:15 UTC. Characters used: **38 / 300,000 (0.013%)**. Day 4 of 30. Unchanged from Jun 10.
- **New activity since Jun 10**: None. The last conversation of any kind remains the personal "Coach" event on Jun 8 11:40 UTC (3s, 1 message). Character count is byte-identical to the prior report.
- **Paisaxe agents** (Visitor Pelayo, Booking Pelayo, Penny, Iris, Xander): **0 conversations since Feb 17** (114 days). All ElevenLabs activity in the window remains personal "Coach"/"Archy" agents, not Paisaxe.
- **Personal-agent reliability**: Unchanged — the last-10 sample still shows a high failure rate (~60%) on the Coach/Archy personal agents (custom_llm generation failed / client-disconnect pattern). A personal-agent integration issue, not Paisaxe, with no new data points to evaluate.
- Next reset: ~Jul 7 2026 15:15 UTC (Unix 1783437319 — cycle resets to 0 / 300,000).

### ElevenLabs Conversation Breakdown (Last 10, via API)

| Date | Agent | Status | Call Result | Duration |
|------|-------|--------|-------------|----------|
| 2026-06-08 11:40 UTC | Coach | done | unknown | 3s |
| 2026-06-08 06:03 UTC | Coach | done | failure | 16s |
| 2026-06-01 13:12 UTC | Coach | done | failure | 3s |
| 2026-05-30 06:59 UTC | Coach | **failed** | unknown | 0s |
| 2026-05-29 15:54 UTC | Coach | done | failure | 4s |
| 2026-05-28 16:47 UTC | Coach | **failed** | failure | 34s |
| 2026-04-16 18:44 UTC | Archy | done | success | 75s |
| 2026-04-16 18:41 UTC | Archy | done | success | 16s |
| 2026-04-16 18:22 UTC | Archy | **failed** | failure | 15s |
| 2026-04-16 18:19 UTC | Archy | **failed** | failure | 9s |

The window is identical to the Jun 10 report — no new entries. No Paisaxe agent appears anywhere in the last-10 window.

### ElevenLabs Subscription Details

| Field | Value |
|-------|-------|
| Tier | Creator |
| Billing period | Annual |
| Status | Active |
| Current cycle start | Jun 7 ~15:15 UTC |
| Next cycle reset | ~Jul 7 2026 15:15 UTC (Unix 1783437319) |
| Character limit | 300,000 |
| Characters used (current cycle) | 38 |
| Voice limit | 30 |
| Voice slots used | 0 / 30 |
| Current overage | $0.00 |
| Next annual invoice | $266.20 on 2027-02-07 (Unix 1802012845) |

### Twilio Communications

| Metric | June (day 11) | May 2026 (final) | Change |
|--------|--------------|------------------|--------|
| SMS Sent | 0 (verified) | 0 | flat |
| Calls | 0 (verified) | 0 | flat |
| Regulatory fee | $0.24 (posted Jun 4) | $0.24 (in May charge) | posted |
| Phone Rental base | $1.15 (posted Jun 7) | $1.15 (charged May 7) | posted |
| Balance | **$11.2846** (verified) | $12.6746 (May 31) | **-$1.39 (since May)** |

**Twilio balance reconciliation:**
- May 7 (last full charge): $12.6746 — phone rental + regulatory fee ($1.39 total)
- May 8 – Jun 3: $12.6746 (27 stable days)
- Jun 4: $12.4346 (down $0.24 — June regulatory fee posted)
- Jun 5-6: $12.4346 (flat)
- Jun 7: $11.2846 (down $1.15 — June base phone-rental posted)
- Jun 8-11 (verified): **$11.2846** (flat — no new charge; 4th consecutive flat day)
- June recurring fully reconciled: $0.24 + $1.15 = $1.39 (matches config)
- Runway: $11.2846 / $1.39 = **~8.1 months**

### Stripe Revenue

| Metric | June (day 11) | May 2026 | Apr 2026 | Mar 2026 | Feb 2026 |
|--------|--------------|---------|---------|---------|---------|
| Net Sales | 0 | 0 | 0 | 0 | 6 |
| Net Revenue | $0.00 | $0.00 | $0.00 | $0.00 | $9.98 |

**118-day revenue drought** — No Day Pass sales since Feb 13.

---

## Cost Efficiency

| Metric | Current (Jun 11) | Previous (Jun 10) | Change | Trend |
|--------|------------------|-------------------|--------|-------|
| Fixed operational cost/mo (config) | **$99.65** | $99.65 | flat | flat |
| Daily burn rate (fixed) | **$3.32/day** (June=30d) | $3.32/day | flat | flat |
| Monthly variable spend (confirmed) | **$1.39** | $1.39 | flat | flat |
| Cost per voice conversation (Feb actuals) | ~$0.43 | ~$0.43 | flat | flat |
| Cost per voice minute (Feb actuals) | ~$0.37 | ~$0.37 | flat | flat |
| ElevenLabs char utilization (current cycle) | **0.013%** | 0.013% | flat | flat |
| ElevenLabs voice min utilization (Paisaxe MTD) | 0% | 0% | flat | flat |
| Revenue coverage (operational) | **0%** | 0% | flat | flat |
| Twilio runway | **~8.1 months** | ~8.1 months | flat | flat |

Every tracked metric is flat versus Jun 10 — a fully quiescent day. Cost-per-chat and cost-per-visitor remain unquantifiable for Paisaxe specifically — no Paisaxe variable usage and no per-project Anthropic billing API. February voice actuals remain the only real per-unit data point.

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Alert Level |
|---------|--------|------|-------|-------------|-------------|
| ElevenLabs | Characters (current cycle) | 38 | 300,000 | **0.013%** | SAFE |
| ElevenLabs | Voice Minutes (Paisaxe, June) | 0.0 | 100 | **0%** | SAFE |
| Vercel | Monthly Visitors | ~low | 500,000 (Pro) | **<1%** | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | SAFE |

All tier alerts clear. No service is approaching any limit at current usage trajectory. Days-until-breach is effectively infinite for every metric at current usage.

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

*At 3x: Voice minutes (180/mo) exceed Creator limit (100 min/mo). Requires Scale tier ($99/mo vs $22.18/mo effective).

**At 10x: Voice at 600 min/mo exceeds Scale tier (500 min). Estimated $200+ for voice alone.

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
| 118-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. Three complete zero-revenue months (Mar, Apr, May), June on the same trajectory. Cumulative operational loss ~$426. |
| 114-day Paisaxe voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Manual production verification of the Pelayo widget and Day Pass flow on paisaxe.es remains the highest-priority outstanding action. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual check required at platform.claude.com/settings/billing. Config estimate $25/mo may be $40-60/mo based on observed credit grant frequency. |

**No new platform cost-structure anomalies.** Zero metric movement of any kind this cycle. No >20% cost increase, no daily spend spike >2x average, no tier-limit proximity, no unexpected new service. The June Twilio recurring charge ($1.39 total) is fully posted and reconciled against config.

**Resolved (carry-forward from earlier cycles):**
- All security advisories — Security agent reports GREEN (0 advisories) as of Jun 10. `npm audit` clean across prod + dev.
- Bundle-budget breach (Performance RED, Jun 7) — resolved Jun 10 by budget decision: commit `93e7546e` raised the total budget to 3,500 KB and per-chunk to 650 KB to honestly account for the ElevenLabs SDK chunk (605 KB, click-to-mount). Bundle 3,398 KB now has 102 KB headroom. Voice-shelving consequently lost its performance justification (see Trend Analysis).
- Twilio recurring-cost config discrepancy ($1.15 -> $1.39) — closed by May 8 triage; June postings re-confirm.
- posthog-js lockfile drift — synced by Jun 10 triage (package.json + lockfile at ^1.384.0); a local `npm install` is still pending to materialize it in node_modules (Security, Jun 10).

---

## Trend Analysis

### Comparison: Jun 10 (day 10) vs Jun 11 (day 11)

| Metric | Jun 10 | Jun 11 | Change | Direction |
|--------|--------|--------|--------|-----------|
| Variable costs (confirmed MTD) | $1.39 | $1.39 | flat | flat |
| Fixed accrued | ~$33.20 | ~$36.52 | +$3.32 | up (1 day) |
| Daily burn rate (fixed) | $3.32/day | $3.32/day | flat | flat |
| Twilio balance | $11.2846 | **$11.2846** | flat | flat |
| Twilio runway | ~8.1 months | ~8.1 months | flat | flat |
| ElevenLabs chars (current cycle) | 38 / 300,000 | **38 / 300,000** | flat | flat |
| Paisaxe voice silence | 113 days | **114 days** | +1 | down |
| Revenue drought | 117 days | **118 days** | +1 | down |
| Cumulative operational loss | ~$423 | ~$426 | +$3.32 | down |
| Security advisories | 0 | 0 | flat | flat (GREEN) |

**Key observations:**

1. **Fully quiescent cycle — zero platform movement.** ElevenLabs character count, conversation window, Twilio balance, and all usage records are byte-identical to the Jun 10 report. The only changes are the deterministic daily accrual and drought counters.

2. **No ElevenLabs activity of any kind for 3 days.** The last conversation (personal Coach, Jun 8 11:40 UTC) remains the only event of the current cycle. Paisaxe agents at 0 conversations since Feb 17 (114 days).

3. **Twilio is settled until ~Jul 7.** Both June recurring components posted and reconciled; the balance has been flat for 4 consecutive days. The next decision window for releasing the number is early July, before the next base charge.

4. **Performance justification for voice-shelving removed (carry-forward, Performance Jun 10).** The bundle RED was resolved by raising the budget to 3,500 KB (93e7546e) rather than removing the 605 KB ElevenLabs chunk. Performance now reports GREEN with 102 KB headroom and explicitly states voice-shelving "stands purely on the revenue/tier-downgrade case now." From this agent's perspective the cost case is unchanged and sufficient on its own: $22.18/mo effective for a voice feature with 114 days of zero usage, plus the Vercel/Supabase downgrade option (~$45/mo combined). If voice is shelved, Performance recommends re-lowering the budget to ~3,100 KB.

5. **June is on the same zero-revenue trajectory.** Mar, Apr, and May all closed at $0.00 net revenue. June day 11 is $0.00. Four months past the last Day Pass sale (Feb 13). Cumulative operational losses since launch reach ~$426.

6. **Security clean.** Zero outstanding advisories (Security agent GREEN, Jun 10). Remaining hygiene: local `npm install` to materialize posthog-js 1.384.0; Supabase pair (supabase-js + ssr) flagged as the priority production bump next batch (auth surface). Neither is cost-affecting.

---

## Recommendations

### Immediate Actions (Priority)

1. **Investigate the revenue and voice drought — 118 days (P1, CRITICAL).** Three consecutive complete zero-revenue months, June on the same path. Manual checks required on paisaxe.es:
   - Is the Pelayo voice widget rendering and accessible on production?
   - Is the Day Pass purchase flow functional end-to-end?
   - Are Vercel deployment logs showing errors on production?
   - Has organic traffic dropped? (PostHog / Vercel Analytics dashboard)

2. **Tier-downgrade / voice-shelving decision (P2).** Now a pure cost/product decision after the Jun 10 budget raise removed the performance angle. If no growth event is expected:
   - Vercel Pro ($20/mo) -> Hobby (free, reduced limits). Caveat: Hobby disallows commercial use and removes per-minute cron precision the agents rely on — weigh against the cron schedule before downgrading.
   - Supabase Pro ($25/mo) -> Free (500MB storage, 50K MAU).
   - Shelving the ElevenLabs voice integration ends the $22.18/mo effective spend at the next renewal decision point (annual, next invoice 2027-02-07) and would let Performance re-lower the bundle budget to ~3,100 KB.
   - Combined potential savings: up to $45/mo (~45% of operational cost).

3. **Check Anthropic billing manually (P2)** — Visit platform.claude.com/settings/billing. Config estimate is $25/mo; observed credit grant patterns suggest $40-60/mo across all projects. If actual spend is $40+/mo, cumulative loss would be ~$451+.

### Cost Reduction Evaluation

4. **Twilio: next decision window is ~Jul 7 (P3).** The June charges are sunk; no in-month saving available. 114 days without a booking call. If no bookings are expected to resume, releasing the number before the next ~Jul 7 base charge avoids the July rental ($1.39/mo, $16.68/yr). No urgency this week — re-evaluate in early July.

5. **ElevenLabs Creator tier correctly sized.** No upgrade pressure. Current cycle at 0.013% utilization (38 chars, all personal). Scale tier ($99/mo) only warranted if sustained Paisaxe voice traffic exceeds 100 min/mo — currently 114 days dormant.

### Long-Term Planning

6. **Revenue trajectory remains structurally unsustainable (P1 escalation).** Three complete zero-revenue months and June continuing. Daily burn: $3.32/day. Break-even requires ~1,200 monthly visitors at 5% Day Pass conversion (currently ~50 visitors). The platform requires a growth event, aggressive cost reduction, or both. The Vercel Hobby + Supabase Free downgrades plus voice shelving (~$45/mo saved) remain the most concrete available levers.

---

## Data Sources

| Source | Method | Last Queried | Status |
|--------|--------|--------------|--------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-06-11 01:07 UTC | Pass (38 chars, current cycle day 4, next reset ~Jul 7 15:15 UTC) |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=10` | 2026-06-11 01:07 UTC | Pass (window identical to Jun 10; no new activity; no Paisaxe activity) |
| Twilio Balance API | `/Balance.json` | 2026-06-11 01:07 UTC | Pass ($11.2846, flat — no new charge) |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json` | 2026-06-11 01:07 UTC | Pass (60 records, 0 non-zero) |
| Config: `service-tiers.ts` | File read | 2026-06-11 | Pass |
| Config: `recurring-costs.ts` | File read | 2026-06-11 | Pass ($1.39 Twilio, config-aligned; both June charges posted) |
| Config: `forecast.ts` | File read | 2026-06-11 | Pass |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | — | Manual check required at platform.claude.com/settings/billing |
| Cross-agent context | Agent shared context | 2026-06-11 | Pass — security GREEN (Jun 10, 0 advisories), performance GREEN-advisory (Jun 10, bundle RED resolved by budget raise to 3,500 KB), triage Jun 10 (translations committed, posthog-js lockfile synced, provenance gate hardened) |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-06-12.*

---
