# Cost Analyst Report

> **Generated**: 2026-06-18 03:00 UTC | **Period**: June 2026 (day 18 of 30) | **Status**: WATCH

---

## Executive Summary

Both ElevenLabs and Twilio APIs queried successfully. Day 18 of June. No material change from yesterday: ElevenLabs character count remains at **3,215** (unchanged — no new conversations since Jun 16), Twilio balance holds at **$11.2846** for an 11th consecutive flat day, and all June recurring charges ($1.39 total) remain fully posted. The Coach personal-agent failure rate in the last-12 window holds at 8/12 (66.7%), unchanged from yesterday. No Paisaxe voice activity.

The single notable cross-agent development is that the Jun 17 triage closed issue #635 (QA harness port 3006 fix) and merged 3 Dependabot PRs. The LLM quality test suite was blind for 4 consecutive cycles due to the port mismatch; the next QA cycle should restore the automated safety signal.

Revenue drought reaches **125 days** (since Feb 13). Paisaxe voice silence: **121 days** (since Feb 17). June day 18 has accrued ~$59.76 in fixed operational costs with $0.00 revenue. Cumulative operational loss since launch: **~$448.**

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

*Anthropic $25/mo is the config estimate (all projects combined). No per-project breakdown available on personal accounts. Manual check required at platform.claude.com/settings/billing.*

**ElevenLabs Creator billed annually at $266.20/yr (effective $22.18/mo). Next annual invoice: $266.20 on 2027-02-07 (Unix 1802012845, verified via API).*

***Twilio config reflects actual recurring charge: $1.15 base + $0.24 regulatory fee = $1.39/mo. Both June components posted (reg fee Jun 4, base rental Jun 7), confirming the $1.39 split is correct in config.*

**Note**: Claude Code Max ($200/mo) is the primary development tool, categorized separately as "Development." Operational cost analysis focuses on the live service ($99.65/mo).

**Total Fixed Operational**: $99.65/mo | **Daily Burn Rate**: $3.32/day (June = 30 days)

### Variable / Usage-Based Costs (June 2026 — Day 18)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Phone rental base) | Posted Jun 7 | **$1.15** | Verified via API |
| Twilio (Regulatory fee) | Posted Jun 4 | **$0.24** | Verified via API |
| Twilio (SMS) | 0 messages | $0.00 | Verified via API (100 records, 0 non-zero) |
| Twilio (Calls) | 0 minutes | $0.00 | Verified via API |
| ElevenLabs (overage) | 3,215 chars (within 300K) | $0.00 | Verified via API (current_overage = $0) |
| Stripe (Processing Fees) | 0 charges | $0.00 | — |
| Anthropic (Claude API) | Unknown | Unknown | No API on personal account |
| Voyage AI (Embeddings) | Unknown | Unknown | No dedicated API |
| **Total Variable (June day 18, confirmed)** | | **$1.39** | |

### June 2026 Position (Day 18 of 30)

| Category | Cost |
|----------|------|
| Fixed Operational (accrued, 18 days x $3.32) | ~$59.76 |
| Variable confirmed (Twilio reg fee + base rental, both posted) | $1.39 |
| **Total Operational (June MTD)** | **~$59.76** |
| Revenue | $0.00 |
| **Net (loss)** | **-$59.76** |

*Note: the $1.39/mo Twilio charge is embedded in the $3.32/day fixed burn rate; the "variable confirmed" line tracks the lumpy actual postings for reconciliation.*

### Monthly Cost History

| Month | Operational Fixed | Variable (confirmed) | Total Operational | Revenue (net) | Coverage |
|-------|-------------------|----------------------|-------------------|---------------|----------|
| Feb 2026 | ~$95 (ramping) | ~$2.75 | ~$97.75 | ~$9.98 | ~10.2% |
| Mar 2026 (final) | $99.41 | $1.15 | **$100.56** | **$0.00** | **0%** |
| Apr 2026 (final) | $99.41 | $1.39 | **$100.80** | **$0.00** | **0%** |
| May 2026 (final) | $99.65 | $1.39 | **$101.04** | **$0.00** | **0%** |
| Jun 2026 (day 18) | $99.65 (proj.) | $1.39 (both posted) | **~$101.04 (proj.)** | $0.00 (MTD) | 0% |

**Cumulative operational loss since February launch: ~$448.**

---

## Usage Metrics

### ElevenLabs Activity

API queried successfully. Live data:

- **Current cycle**: Started Jun 7 ~15:15 UTC. Characters used: **3,215 / 300,000 (1.072%)**. Day 12 of 30.
- **Change since Jun 17 report**: No change (+0 characters). No new conversations since Jun 16 05:54 UTC.
- **Paisaxe agents** (Visitor Pelayo, Booking Pelayo, Penny, Iris, Xander): **0 conversations since Feb 17** (121 days). No Paisaxe agent appears in the last-15 window.
- **Personal Coach reliability**: 8/12 failures (66.7%) in the current window — unchanged from yesterday. Pattern: instant client-disconnect terminations (3–5s durations). Not a Paisaxe or cost issue.
- Next reset: ~Jul 7 2026 15:15 UTC (Unix 1783437319).

### ElevenLabs Conversation Breakdown (Last 15, via API)

| Date (UTC) | Agent | Status | Call Result | Duration |
|------------|-------|--------|-------------|----------|
| 2026-06-16 05:54 | Coach | done | success | 186s |
| 2026-06-16 05:52 | Coach | done | success | 50s |
| 2026-06-16 05:48 | Coach | done | failure | 223s |
| 2026-06-14 07:36 | Coach | done | success | 19s |
| 2026-06-14 05:24 | Coach | done | failure | 4s |
| 2026-06-14 05:14 | Coach | done | failure | 5s |
| 2026-06-14 05:10 | Coach | done | failure | 3s |
| 2026-06-08 11:40 | Coach | done | unknown | 3s |
| 2026-06-08 06:03 | Coach | done | failure | 16s |
| 2026-06-01 13:12 | Coach | done | failure | 3s |
| 2026-05-30 06:59 | Coach | failed | unknown | 0s |
| 2026-05-29 15:54 | Coach | done | failure | 4s |
| 2026-05-28 16:47 | Coach | failed | failure | 34s |
| 2026-04-16 18:44 | Archy | done | success | 75s |
| 2026-04-16 18:41 | Archy | done | success | 16s |

**Note on date discrepancy**: The Jun 17 report referenced the Jun 16 Coach conversations as "Jun 15 UTC". The raw Unix timestamps from the API resolve to Jun 16 UTC; this report uses the API-authoritative dates. Character count is consistent at 3,215 in both reports — no discrepancy in the billing data.

No new entries since the previous report (Jun 17). No Paisaxe agent appears anywhere in the window.

### ElevenLabs Subscription Details

| Field | Value |
|-------|-------|
| Tier | Creator |
| Billing period | Annual |
| Status | Active |
| Current cycle start | Jun 7 ~15:15 UTC |
| Next cycle reset | ~Jul 7 2026 15:15 UTC (Unix 1783437319) |
| Character limit | 300,000 |
| Characters used (current cycle) | 3,215 (unchanged from Jun 17) |
| Voice limit | 30 |
| Voice slots used | 0 / 30 |
| Current overage | $0.00 |
| Next annual invoice | $266.20 on 2027-02-07 (Unix 1802012845) |

### Twilio Communications

| Metric | June (day 18) | May 2026 (final) | Change |
|--------|--------------|------------------|--------|
| SMS Sent | 0 (verified) | 0 | flat |
| Calls | 0 (verified) | 0 | flat |
| Regulatory fee | $0.24 (posted Jun 4) | $0.24 | posted |
| Phone Rental base | $1.15 (posted Jun 7) | $1.15 | posted |
| Balance | **$11.2846** (verified) | $12.6746 (May 31) | -$1.39 (since May) |

**Twilio balance reconciliation:**
- Jun 7: Balance fell to $11.2846 (down $1.15 — June base phone-rental posted)
- Jun 8–18 (verified): **$11.2846** (flat — no new charge; 11th consecutive flat day)
- June recurring fully reconciled: $0.24 + $1.15 = $1.39 (matches config)
- Runway: $11.2846 / $1.39 = **~8.1 months**
- 100 usage records checked, 0 non-zero.

### Stripe Revenue

| Metric | June (day 18) | May 2026 | Apr 2026 | Mar 2026 | Feb 2026 |
|--------|--------------|---------|---------|---------|---------|
| Net Sales | 0 | 0 | 0 | 0 | 6 |
| Net Revenue | $0.00 | $0.00 | $0.00 | $0.00 | $9.98 |

**125-day revenue drought** — No Day Pass sales since Feb 13.

---

## Cost Efficiency

| Metric | Current (Jun 18) | Previous (Jun 17) | Change | Trend |
|--------|------------------|-------------------|--------|-------|
| Fixed operational cost/mo (config) | **$99.65** | $99.65 | flat | flat |
| Daily burn rate (fixed) | **$3.32/day** | $3.32/day | flat | flat |
| Monthly variable spend (confirmed) | **$1.39** | $1.39 | flat | flat |
| ElevenLabs char utilization (current cycle) | **1.072%** | 1.072% | flat | flat |
| ElevenLabs voice min utilization (Paisaxe MTD) | 0% | 0% | flat | flat |
| Revenue coverage (operational) | **0%** | 0% | flat | flat |
| Twilio runway | **~8.1 months** | ~8.1 months | flat | flat |

All cost efficiency metrics are flat. Cost-per-chat and cost-per-visitor for Paisaxe remain unquantifiable — no Paisaxe variable usage and no per-project Anthropic billing API.

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Alert Level |
|---------|--------|------|-------|-------------|-------------|
| ElevenLabs | Characters (current cycle) | 3,215 | 300,000 | **1.072%** | SAFE |
| ElevenLabs | Voice Minutes (Paisaxe, June) | 0.0 | 100 | **0%** | SAFE |
| Vercel | Monthly Visitors | ~low | 500,000 (Pro) | **<1%** | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | SAFE |

All tier alerts clear. At the observed personal-only ElevenLabs rate (~3,215 chars in 12 cycle-days = ~268 chars/day), the cycle will reach ~8,305 chars by Jul 7 — 2.8% of the 300K limit. No upgrade pressure.

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
| 125-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. Three complete zero-revenue months (Mar, Apr, May), June day 18 on the same trajectory. Cumulative operational loss ~$448. |
| 121-day Paisaxe voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Manual production verification of the Pelayo widget and Day Pass flow on paisaxe.es remains the highest-priority outstanding action. |
| ElevenLabs Coach failure rate elevated | **WATCH** | 8/12 (66.7%) failures in last-12 window, unchanged from Jun 17. All personal "Coach" agent. Pattern: instant client-disconnect terminations (3–5s durations). Not a Paisaxe or cost issue. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual check required at platform.claude.com/settings/billing. Config estimate $25/mo may be $40-60/mo based on observed credit grant frequency. |

No new platform cost-structure anomalies. No >20% operational cost increase, no daily spend spike >2x average, no tier-limit proximity, no unexpected new service.

**Resolved (from Jun 17 triage):**
- QA harness port 3006 fix (issue #635 CLOSED) — LLM quality tests will now target localhost:3006. Next QA cycle should report 12/12 green LLM quality tests, restoring the automated safety signal after a 4-cycle blind spot.
- CORS origin fix merged.
- Test isolation bug fixed (agents/run/route.ts — runningAgents Map state leak).
- Dependabot PRs #639 (dev-and-types patches), #641 (security patches), #643 (production group 13 updates) — all merged.

---

## Trend Analysis

### Comparison: Jun 17 (day 17) vs Jun 18 (day 18)

| Metric | Jun 17 | Jun 18 | Change | Direction |
|--------|--------|--------|--------|-----------|
| Variable costs (confirmed MTD) | $1.39 | $1.39 | flat | flat |
| Fixed accrued | ~$56.44 | ~$59.76 | +$3.32 | up (1 day) |
| Daily burn rate (fixed) | $3.32/day | $3.32/day | flat | flat |
| Twilio balance | $11.2846 | **$11.2846** | flat | flat |
| Twilio runway | ~8.1 months | ~8.1 months | flat | flat |
| ElevenLabs chars (current cycle) | 3,215 / 300,000 | **3,215 / 300,000** | flat | flat |
| ElevenLabs char utilization | 1.072% | **1.072%** | flat | flat |
| Coach failure rate (last-12) | 8/12 (66.7%) | **8/12 (66.7%)** | flat | flat |
| Paisaxe voice silence | 120 days | **121 days** | +1 | down |
| Revenue drought | 124 days | **125 days** | +1 | down |
| Cumulative operational loss | ~$445 | **~$448** | +$3 | down |
| Security advisories | 0 | 0 | flat | GREEN |

**Key observations:**

1. **Fully flat billing cycle** — no new ElevenLabs conversations, no new Twilio charges, no new variable spend. June is on track to close at ~$101.04 operational with $0 revenue, identical to the Mar–May pattern.

2. **QA safety signal restored (cross-agent)** — Jun 17 triage closed issue #635 (port 3006 fix). The automated LLM quality net has been blind for 4 cycles. The next QA run should produce 12/12 results, restoring confirmation of injection/PII/safety guardrails. This is a positive operational development though cost-neutral.

3. **Dependabot maintenance current** — 3 PRs merged (Jun 17 triage). Security remains GREEN with 0 advisories. Production dep count at 34/40 (headroom: 6 slots). No cost or service-tier implications.

4. **ElevenLabs Coach failure rate stable at elevated level** — 66.7% for second consecutive report. No new failures added since Jun 16 (no new conversations). At ~268 chars/day cycle average, the Creator plan is deeply underutilized. Renewal decision (2027-02-07) is 8 months out but dormancy is accumulating: ~$91 of the annual prepayment consumed by dormancy as of today (123 days / 365 days × $266.20).

5. **Revenue drought crossing the 4-month mark** — Feb, Mar, Apr, May all closed at $0. June day 18 at $0. The structural break-even (1,200 monthly visitors) is 24x the current traffic level (~50 visitors/mo).

---

## Recommendations

### Immediate Actions (Priority)

1. **Investigate the revenue and voice drought — 125 days (P1, CRITICAL).** Four-plus consecutive months without revenue. Manual checks required on paisaxe.es:
   - Is the Pelayo voice widget rendering and accessible on production?
   - Is the Day Pass purchase flow functional end-to-end?
   - Are Vercel deployment logs showing errors on production?
   - Has organic traffic dropped? (PostHog / Vercel Analytics dashboard)

2. **Verify Anthropic billing manually (P2)** — Visit platform.claude.com/settings/billing. Config estimate is $25/mo; observed credit grant patterns suggest $40-60/mo across all projects. If actual spend is $40+/mo, cumulative loss would be ~$471+.

3. **Tier-downgrade / voice-shelving decision (P2).** A pure cost/product decision. If no growth event is expected:
   - Vercel Pro ($20/mo) -> Hobby (free). Caveat: Hobby disallows commercial use and removes per-minute cron precision the agents rely on — weigh against the cron schedule before downgrading.
   - Supabase Pro ($25/mo) -> Free (500MB storage, 50K MAU).
   - Shelving the ElevenLabs voice integration saves ~$22/mo effective (at the next renewal decision — annual plan sunk until 2027-02-07) and would drop total JS from 3,027 KB to ~2,422 KB (605 KB ElevenLabs chunk removed).
   - Combined potential savings: up to ~$45/mo (~45% of operational cost).

4. **Investigate personal Coach agent reliability (P3)** — 66.7% failure rate held steady for 2 reports. The successful Jun 16 conversations (186s, 50s) suggest the integration is functional but unreliable. Not a Paisaxe cost concern, but worth reviewing the Coach agent configuration in the ElevenLabs dashboard.

### Cost Reduction Evaluation

5. **Twilio: next decision window is ~Jul 7 (P3).** The June charges are sunk; no in-month saving available. 121 days without a booking call. If no bookings are expected to resume, releasing the number before the next ~Jul 7 base charge avoids the July rental ($1.39/mo). Re-evaluate in early July.

6. **ElevenLabs Creator tier correctly sized.** No upgrade pressure. Current cycle at 1.072% utilization (3,215 chars, all personal). Scale tier ($99/mo) only warranted if sustained Paisaxe voice traffic exceeds 100 min/mo — currently 121 days dormant.

### Long-Term Planning

7. **Revenue trajectory remains structurally unsustainable (P1 escalation).** Four complete zero-revenue months. Daily burn: $3.32/day. Break-even requires ~1,200 monthly visitors at 5% Day Pass conversion (currently ~50 visitors). The platform requires a growth event, aggressive cost reduction, or both.

---

## Data Sources

| Source | Method | Last Queried | Status |
|--------|--------|--------------|--------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-06-18 03:00 UTC | Pass (3,215 chars / 300,000, unchanged; cycle day 12; next reset ~Jul 7 15:15 UTC) |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=15` | 2026-06-18 03:00 UTC | Pass (no new conversations since Jun 16; last entry Jun 16 05:54 UTC) |
| Twilio Balance API | `/Balance.json` | 2026-06-18 03:00 UTC | Pass ($11.2846, flat — 11th consecutive flat day) |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json?PageSize=100` | 2026-06-18 03:00 UTC | Pass (100 records, 0 non-zero) |
| ElevenLabs Character Stats API | `/v1/usage/character-stats` | 2026-06-18 03:00 UTC | Unavailable (requires start_unix + end_unix params; not needed — subscription API has current_cycle data) |
| Config: `service-tiers.ts` | File read | 2026-06-18 | Pass |
| Config: `recurring-costs.ts` | File read | 2026-06-18 | Pass ($1.39 Twilio, both June charges posted) |
| Config: `forecast.ts` | File read | 2026-06-18 | Pass |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | — | Manual check required at platform.claude.com/settings/billing |
| Cross-agent context | Agent shared context | 2026-06-18 | Pass — Jun 17 triage: QA port fix #635 closed, CORS fix, 3 Dependabot PRs merged; Security GREEN (0 advisories); Performance GREEN (3,027 KB / 3,500 KB); Coverage GREEN (98.67% statements) |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-06-19.*

---
