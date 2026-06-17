# Cost Analyst Report

> **Generated**: 2026-06-17 03:00 UTC | **Period**: June 2026 (day 17 of 30) | **Status**: WATCH

---

## Executive Summary

Both ElevenLabs and Twilio APIs queried successfully. Day 17 of the June billing month. Notable change since yesterday: ElevenLabs character count jumped from 247 to **3,215** (+2,968 chars), driven by three new personal "Coach" agent conversations on June 15 at 05:48–05:54 UTC. These are personal agents, not Paisaxe — no Paisaxe voice activity and no cost overage. The Coach failure rate in the last-12 window climbed to 8/12 (66.7%), an elevated personal-agent reliability concern but not a Paisaxe cost issue. Twilio is completely flat at $11.2846 for a 10th consecutive unchanged day; all June recurring charges ($1.39 total) remain posted and reconciled.

Revenue drought reaches **124 days** (since Feb 13). Paisaxe voice silence: **120 days** (since Feb 17). June day 17 has accrued ~$56.44 in fixed operational costs with $0.00 revenue. Cumulative operational loss since launch: **~$445.**

Cross-agent context: Security flipped YELLOW on Jun 16 (9 advisories), and the Jun 16 triage resolved all 9 via `npm audit fix` (GREEN restored). Performance remains GREEN and authoritative at 3,024 KB / 3,500 KB. Coverage GREEN at 98.67% statements. No cost-relevant technical items remain open.

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

### Variable / Usage-Based Costs (June 2026 — Day 17)

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
| **Total Variable (June day 17, confirmed)** | | **$1.39** | |

### June 2026 Position (Day 17 of 30)

| Category | Cost |
|----------|------|
| Fixed Operational (accrued, 17 days x $3.32) | ~$56.44 |
| Variable confirmed (Twilio reg fee + base rental, both posted) | $1.39 |
| **Total Operational (June MTD)** | **~$57.83** |
| Revenue | $0.00 |
| **Net (loss)** | **-$57.83** |

*Note: the $1.39/mo Twilio charge is embedded in the $3.32/day fixed burn rate; the "variable confirmed" line tracks the lumpy actual postings for reconciliation.*

### Monthly Cost History

| Month | Operational Fixed | Variable (confirmed) | Total Operational | Revenue (net) | Coverage |
|-------|-------------------|----------------------|-------------------|---------------|----------|
| Feb 2026 | ~$95 (ramping) | ~$2.75 | ~$97.75 | ~$9.98 | ~10.2% |
| Mar 2026 (final) | $99.41 | $1.15 | **$100.56** | **$0.00** | **0%** |
| Apr 2026 (final) | $99.41 | $1.39 | **$100.80** | **$0.00** | **0%** |
| May 2026 (final) | $99.65 | $1.39 | **$101.04** | **$0.00** | **0%** |
| Jun 2026 (day 17) | $99.65 (proj.) | $1.39 (both posted) | **~$101.04 (proj.)** | $0.00 (MTD) | 0% |

**Cumulative operational loss since February launch: ~$445.**

---

## Usage Metrics

### ElevenLabs Activity

API queried successfully. Live data:

- **Current cycle**: Started Jun 7 ~15:15 UTC. Characters used: **3,215 / 300,000 (1.072%)**. Day 11 of 30.
- **Change since Jun 16 report**: +2,968 characters (+1,200%). Driven by 3 new personal "Coach" conversations on Jun 15 at 05:48–05:54 UTC.
- **Paisaxe agents** (Visitor Pelayo, Booking Pelayo, Penny, Iris, Xander): **0 conversations since Feb 17** (120 days). No Paisaxe agent appears in the last-12 window.
- **Personal Coach reliability**: 8/12 failures (66.7%) in the current window — elevated versus prior reports (was 25–30%). All failures are personal "Coach" agent, not Paisaxe. Pattern is persistent "Client disconnected" terminations with short durations (3–5s).
- Next reset: ~Jul 7 2026 15:15 UTC (Unix 1783437319).

### ElevenLabs Conversation Breakdown (Last 12, via API)

| Date (UTC) | Agent | Status | Call Result | Duration |
|------------|-------|--------|-------------|----------|
| 2026-06-15 05:54 | Coach | done | success | 186s |
| 2026-06-15 05:53 | Coach | done | success | 50s |
| 2026-06-15 05:48 | Coach | done | failure | 223s |
| 2026-06-14 07:36 | Coach | done | success | 19s |
| 2026-06-14 05:24 | Coach | done | failure | 4s |
| 2026-06-14 05:14 | Coach | done | failure | 5s |
| 2026-06-14 05:10 | Coach | done | failure | 3s |
| 2026-06-08 11:40 | Coach | done | unknown | 3s |
| 2026-06-08 06:03 | Coach | done | failure | 16s |
| 2026-06-01 13:12 | Coach | done | failure | 3s |
| 2026-05-30 06:59 | Coach | failed | unknown | 0s |
| 2026-05-29 15:54 | Coach | done | failure | 4s |

3 new entries since the previous report (Jun 16). No Paisaxe agent appears anywhere in the window.

### ElevenLabs Subscription Details

| Field | Value |
|-------|-------|
| Tier | Creator |
| Billing period | Annual |
| Status | Active |
| Current cycle start | Jun 7 ~15:15 UTC |
| Next cycle reset | ~Jul 7 2026 15:15 UTC (Unix 1783437319) |
| Character limit | 300,000 |
| Characters used (current cycle) | 3,215 |
| Voice limit | 30 |
| Voice slots used | 0 / 30 |
| Current overage | $0.00 |
| Next annual invoice | $266.20 on 2027-02-07 (Unix 1802012845) |

### Twilio Communications

| Metric | June (day 17) | May 2026 (final) | Change |
|--------|--------------|------------------|--------|
| SMS Sent | 0 (verified) | 0 | flat |
| Calls | 0 (verified) | 0 | flat |
| Regulatory fee | $0.24 (posted Jun 4) | $0.24 | posted |
| Phone Rental base | $1.15 (posted Jun 7) | $1.15 | posted |
| Balance | **$11.2846** (verified) | $12.6746 (May 31) | -$1.39 (since May) |

**Twilio balance reconciliation:**
- Jun 7: $11.2846 (down $1.15 — June base phone-rental posted)
- Jun 8–17 (verified): **$11.2846** (flat — no new charge; 10th consecutive flat day)
- June recurring fully reconciled: $0.24 + $1.15 = $1.39 (matches config)
- Runway: $11.2846 / $1.39 = **~8.1 months**
- 100 usage records checked, 0 non-zero.

### Stripe Revenue

| Metric | June (day 17) | May 2026 | Apr 2026 | Mar 2026 | Feb 2026 |
|--------|--------------|---------|---------|---------|---------|
| Net Sales | 0 | 0 | 0 | 0 | 6 |
| Net Revenue | $0.00 | $0.00 | $0.00 | $0.00 | $9.98 |

**124-day revenue drought** — No Day Pass sales since Feb 13.

---

## Cost Efficiency

| Metric | Current (Jun 17) | Previous (Jun 16) | Change | Trend |
|--------|------------------|-------------------|--------|-------|
| Fixed operational cost/mo (config) | **$99.65** | $99.65 | flat | flat |
| Daily burn rate (fixed) | **$3.32/day** | $3.32/day | flat | flat |
| Monthly variable spend (confirmed) | **$1.39** | $1.39 | flat | flat |
| ElevenLabs char utilization (current cycle) | **1.072%** | 0.082% | +0.990pp | up (personal activity) |
| ElevenLabs voice min utilization (Paisaxe MTD) | 0% | 0% | flat | flat |
| Revenue coverage (operational) | **0%** | 0% | flat | flat |
| Twilio runway | **~8.1 months** | ~8.1 months | flat | flat |

The character utilization uptick (+0.990pp) reflects personal Coach agent activity only; there is no Paisaxe usage and no cost overage. Cost-per-chat and cost-per-visitor for Paisaxe remain unquantifiable — no Paisaxe variable usage and no per-project Anthropic billing API.

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Alert Level |
|---------|--------|------|-------|-------------|-------------|
| ElevenLabs | Characters (current cycle) | 3,215 | 300,000 | **1.072%** | SAFE |
| ElevenLabs | Voice Minutes (Paisaxe, June) | 0.0 | 100 | **0%** | SAFE |
| Vercel | Monthly Visitors | ~low | 500,000 (Pro) | **<1%** | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | SAFE |

All tier alerts clear. Days-until-breach is effectively infinite at current usage trajectory. At the observed personal-only ElevenLabs rate (~3,215 chars in 11 days = ~292 chars/day), the cycle would reach ~8,760 chars by Jul 7 — 2.9% of the 300K limit. No upgrade pressure.

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
| 124-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. Three complete zero-revenue months (Mar, Apr, May), June day 17 on the same trajectory. Cumulative operational loss ~$445. |
| 120-day Paisaxe voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Manual production verification of the Pelayo widget and Day Pass flow on paisaxe.es remains the highest-priority outstanding action. |
| ElevenLabs Coach failure rate elevated | **WATCH** | 8/12 (66.7%) failures in last-12 window, up from 25-30% in Apr/early May. All personal "Coach" agent. Pattern: instant client-disconnect terminations (3–5s durations). Not a Paisaxe or cost issue, but indicates a personal-agent configuration problem worth investigating separately. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual check required at platform.claude.com/settings/billing. Config estimate $25/mo may be $40-60/mo based on observed credit grant frequency. |

**ElevenLabs character jump (+2,968 chars, +1,200%) noted but not anomalous** — driven by 3 personal Coach conversations; still at 1.072% of the 300K limit; no overage cost. Not a tier or spend concern.

**No new platform cost-structure anomalies.** No >20% operational cost increase, no daily spend spike >2x average, no tier-limit proximity, no unexpected new service.

**Resolved (carry-forward from Jun 16 triage):**
- Security YELLOW resolved — triage Jun 16 completed `npm audit fix` (9 advisories cleared, 0 remaining). Security returned to GREEN.
- esbuild + protobufjs moved from `dependencies` to `overrides` — production dep count 36/40 → 34/40. Performance confirmed bundle-neutral.
- QA harness preflight added — next LLM test run will emit a clear harness error instead of 12 opaque ECONNREFUSED stacks (issue #635 still open for permanent webServer fix).
- Coverage tests committed — basic-markdown.tsx XSS link-safety branches at 100%.

---

## Trend Analysis

### Comparison: Jun 16 (day 16) vs Jun 17 (day 17)

| Metric | Jun 16 | Jun 17 | Change | Direction |
|--------|--------|--------|--------|-----------|
| Variable costs (confirmed MTD) | $1.39 | $1.39 | flat | flat |
| Fixed accrued | ~$53.12 | ~$56.44 | +$3.32 | up (1 day) |
| Daily burn rate (fixed) | $3.32/day | $3.32/day | flat | flat |
| Twilio balance | $11.2846 | **$11.2846** | flat | flat |
| Twilio runway | ~8.1 months | ~8.1 months | flat | flat |
| ElevenLabs chars (current cycle) | 247 / 300,000 | **3,215 / 300,000** | **+2,968** | up (personal) |
| ElevenLabs char utilization | 0.082% | **1.072%** | +0.990pp | up (personal) |
| Coach failure rate (last-12) | ~75% (Jun 14 burst) | **66.7% (8/12)** | improving slightly | WATCH |
| Paisaxe voice silence | 119 days | **120 days** | +1 | down |
| Revenue drought | 123 days | **124 days** | +1 | down |
| Cumulative operational loss | ~$442 | **~$445** | +$3 | down |
| Security advisories | 0 (post-triage) | 0 | flat | GREEN |

**Key observations:**

1. **ElevenLabs character count jumped significantly** — from 247 to 3,215 (+2,968 chars, +1,200%). This is not a cost concern (still at 1.072% of the 300K limit, no overage), but it marks the first meaningful ElevenLabs character consumption since the Jun 8 cycle began. The 3 new Coach conversations on Jun 15 are the sole driver. The Jun 16 report missed these conversations in its query results, suggesting they may have appeared in the API after that report was generated.

2. **Paisaxe agents remain completely silent** — 120 consecutive days without a single Paisaxe voice conversation. All ElevenLabs account activity continues to be personal "Coach" agent traffic only.

3. **Coach personal agent reliability declining** — 8/12 (66.7%) failures in the current window, up from ~25–30% in April. The successful Jun 15 conversations (186s, 50s) suggest the agent is partially functional but experiencing frequent quick-disconnect failures. This is a personal-agent maintenance item, not a Paisaxe issue.

4. **Twilio settled for another month** — 10th consecutive flat day at $11.2846. No June usage; next charge expected ~Jul 7 for the July base rental.

5. **Security GREEN restored** — Jun 16 triage confirmed `npm audit fix` cleared all 9 advisories. Performance authoritative bundle (3,024 KB / 3,500 KB, 476 KB headroom) is unchanged and healthy.

6. **June past the mid-month mark with zero revenue** — Mar, Apr, and May all closed at $0.00 net revenue. June day 17 is $0.00 with ~$57.83 burned. Four months since the last Day Pass sale (Feb 13). Cumulative operational loss now at ~$445.

7. **ElevenLabs annual spend profile** — The Creator annual plan ($266.20/yr) continues to accumulate dormancy spend. As of today, approximately $89 of the annual prepayment has been consumed by dormancy since Feb 17 (120 days / 365 days x $266.20). The renewal decision point (2027-02-07) is 8 months out, but the voice-shelving evaluation should be resolved well before then.

---

## Recommendations

### Immediate Actions (Priority)

1. **Investigate the revenue and voice drought — 124 days (P1, CRITICAL).** Four consecutive months without revenue, June continuing. Manual checks required on paisaxe.es:
   - Is the Pelayo voice widget rendering and accessible on production?
   - Is the Day Pass purchase flow functional end-to-end?
   - Are Vercel deployment logs showing errors on production?
   - Has organic traffic dropped? (PostHog / Vercel Analytics dashboard)

2. **Tier-downgrade / voice-shelving decision (P2).** A pure cost/product decision. If no growth event is expected:
   - Vercel Pro ($20/mo) -> Hobby (free). Caveat: Hobby disallows commercial use and removes per-minute cron precision the agents rely on — weigh against the cron schedule before downgrading.
   - Supabase Pro ($25/mo) -> Free (500MB storage, 50K MAU).
   - Shelving the ElevenLabs voice integration saves ~$22/mo effective (at the next renewal decision — annual plan sunk until 2027-02-07) and would let Performance re-lower the bundle budget (total would drop to ~2,420 KB).
   - Combined potential savings: up to ~$45/mo (~45% of operational cost).

3. **Check Anthropic billing manually (P2)** — Visit platform.claude.com/settings/billing. Config estimate is $25/mo; observed credit grant patterns suggest $40-60/mo across all projects. If actual spend is $40+/mo, cumulative loss would be ~$467+.

4. **Investigate personal Coach agent reliability (P3)** — 66.7% failure rate in last-12 conversations. The successful Jun 15 conversations (186s, 50s) suggest the integration is functional but unreliable. Not a Paisaxe cost concern, but worth reviewing the Coach agent configuration in the ElevenLabs dashboard.

### Cost Reduction Evaluation

5. **Twilio: next decision window is ~Jul 7 (P3).** The June charges are sunk; no in-month saving available. 120 days without a booking call. If no bookings are expected to resume, releasing the number before the next ~Jul 7 base charge avoids the July rental ($1.39/mo). No urgency this week — re-evaluate in early July.

6. **ElevenLabs Creator tier correctly sized.** No upgrade pressure. Current cycle at 1.072% utilization (3,215 chars, all personal). Scale tier ($99/mo) only warranted if sustained Paisaxe voice traffic exceeds 100 min/mo — currently 120 days dormant.

### Long-Term Planning

7. **Revenue trajectory remains structurally unsustainable (P1 escalation).** Four complete zero-revenue months. Daily burn: $3.32/day. Break-even requires ~1,200 monthly visitors at 5% Day Pass conversion (currently ~50 visitors). The platform requires a growth event, aggressive cost reduction, or both. The Vercel Hobby + Supabase Free downgrades plus voice shelving (~$45/mo saved) remain the most concrete available levers.

---

## Data Sources

| Source | Method | Last Queried | Status |
|--------|--------|--------------|--------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-06-17 03:00 UTC | Pass (3,215 chars / 300,000, cycle day 11, next reset ~Jul 7 15:15 UTC) |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=12` | 2026-06-17 03:00 UTC | Pass (3 new Coach conversations Jun 15; no Paisaxe activity) |
| Twilio Balance API | `/Balance.json` | 2026-06-17 03:00 UTC | Pass ($11.2846, flat — 10th consecutive flat day) |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json?PageSize=100` | 2026-06-17 03:00 UTC | Pass (100 records, 0 non-zero) |
| Config: `service-tiers.ts` | File read | 2026-06-17 | Pass |
| Config: `recurring-costs.ts` | File read | 2026-06-17 | Pass ($1.39 Twilio, config-aligned; both June charges posted) |
| Config: `forecast.ts` | File read | 2026-06-17 | Pass |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | — | Manual check required at platform.claude.com/settings/billing |
| Cross-agent context | Agent shared context | 2026-06-17 | Pass — security GREEN (post Jun 16 triage, 0 advisories after npm audit fix), performance GREEN authoritative (Jun 16, total JS 3,024 KB / 3,500 KB, 476 KB headroom), coverage GREEN (Jun 16, 98.67% statements) |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-06-18.*

---
