# Cost Analyst Report

> **Generated**: 2026-06-20 03:00 UTC | **Period**: June 2026 (day 20 of 30) | **Status**: WATCH

---

## Executive Summary

Both ElevenLabs and Twilio APIs queried successfully. Day 20 of June. No material change since yesterday: ElevenLabs character count remains at **3,215 / 300,000 (1.072%)** (unchanged — no new conversations since Jun 16 05:54 UTC; day 4 of silence), Twilio balance holds at **$11.2846** for a 13th consecutive flat day, and all June recurring charges ($1.39 total) remain fully posted. The personal Coach-agent failure pattern across the last-15 window is byte-identical to the prior four reports.

No cross-agent developments since yesterday change the cost picture. The two outstanding technical blockers carried into this cycle are unchanged: VOYAGE_API_KEY missing from the QA environment (causing Chat API 503 on 11/12 LLM quality tests, per QA Jun 18) and the manual production verification of the Pelayo voice widget and Day Pass flow. Both are tracked but neither has a cost contribution.

Revenue drought reaches **127 days** (since Feb 13). Paisaxe voice silence: **123 days** (since Feb 17). June day 20 has accrued ~$66.40 in fixed operational costs with $0.00 revenue. Cumulative operational loss since launch: **~$454.**

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

**ElevenLabs Creator billed annually at $266.20/yr (effective $22.18/mo). Next annual invoice: $266.20 on 2027-02-07 (Unix 1802012845, verified via API — amount_due_cents 26620).*

***Twilio config reflects actual recurring charge: $1.15 base + $0.24 regulatory fee = $1.39/mo. Both June components posted (reg fee Jun 4, base rental Jun 7), confirming the $1.39 split is correct in config.*

**Note**: Claude Code Max ($200/mo) is the primary development tool, categorized separately as "Development." Operational cost analysis focuses on the live service ($99.65/mo).

**Total Fixed Operational**: $99.65/mo | **Daily Burn Rate**: $3.32/day (June = 30 days)

### Variable / Usage-Based Costs (June 2026 — Day 20)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Phone rental base) | Posted Jun 7 | **$1.15** | Verified via API |
| Twilio (Regulatory fee) | Posted Jun 4 | **$0.24** | Verified via API |
| Twilio (SMS) | 0 messages | $0.00 | Verified via API (50 records checked, 0 non-zero) |
| Twilio (Calls) | 0 minutes | $0.00 | Verified via API |
| ElevenLabs (overage) | 3,215 chars (within 300K) | $0.00 | Verified via API (current_overage = $0) |
| Stripe (Processing Fees) | 0 charges | $0.00 | — |
| Anthropic (Claude API) | Unknown | Unknown | No API on personal account |
| Voyage AI (Embeddings) | Unknown | Unknown | No dedicated API |
| **Total Variable (June day 20, confirmed)** | | **$1.39** | |

### June 2026 Position (Day 20 of 30)

| Category | Cost |
|----------|------|
| Fixed Operational (accrued, 20 days x $3.32) | ~$66.40 |
| Variable confirmed (Twilio reg fee + base rental, both posted) | $1.39 |
| **Total Operational (June MTD)** | **~$66.40** |
| Revenue | $0.00 |
| **Net (loss)** | **-$66.40** |

*Note: the $1.39/mo Twilio charge is embedded in the $3.32/day fixed burn rate; the "variable confirmed" line tracks the lumpy actual postings for reconciliation.*

### Monthly Cost History

| Month | Operational Fixed | Variable (confirmed) | Total Operational | Revenue (net) | Coverage |
|-------|-------------------|----------------------|-------------------|---------------|----------|
| Feb 2026 | ~$95 (ramping) | ~$2.75 | ~$97.75 | ~$9.98 | ~10.2% |
| Mar 2026 (final) | $99.41 | $1.15 | **$100.56** | **$0.00** | **0%** |
| Apr 2026 (final) | $99.41 | $1.39 | **$100.80** | **$0.00** | **0%** |
| May 2026 (final) | $99.65 | $1.39 | **$101.04** | **$0.00** | **0%** |
| Jun 2026 (day 20) | $99.65 (proj.) | $1.39 (both posted) | **~$101.04 (proj.)** | $0.00 (MTD) | 0% |

**Cumulative operational loss since February launch: ~$454.**

---

## Usage Metrics

### ElevenLabs Activity

API queried successfully. Live data:

- **Current cycle**: Started Jun 7 ~15:15 UTC. Characters used: **3,215 / 300,000 (1.072%)**. Day 14 of 30.
- **Change since Jun 19 report**: No change (+0 characters). No new conversations since Jun 16 05:54 UTC (day 4 of silence).
- **Paisaxe agents** (Visitor Pelayo, Booking Pelayo, Penny, Iris, Xander): **0 conversations since Feb 17** (123 days). No Paisaxe agent appears in the last-15 window.
- **Personal Coach reliability**: 9 clear failures + 1 unknown short-disconnect across the 15-entry window — data byte-identical to the Jun 16-19 reports. Pattern: short client-disconnect terminations (3-5s). Not a Paisaxe or cost issue.
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

No new entries since the Jun 16 conversation. No Paisaxe agent appears anywhere in the window.

### ElevenLabs Subscription Details

| Field | Value |
|-------|-------|
| Tier | Creator |
| Billing period | Annual |
| Status | Active |
| Current cycle start | Jun 7 ~15:15 UTC |
| Next cycle reset | ~Jul 7 2026 15:15 UTC (Unix 1783437319) |
| Character limit | 300,000 |
| Characters used (current cycle) | 3,215 (unchanged since Jun 16) |
| Voice limit | 30 |
| Voice slots used | 0 / 30 |
| Current overage | $0.00 |
| Next annual invoice | $266.20 on 2027-02-07 (Unix 1802012845) |

### Twilio Communications

| Metric | June (day 20) | May 2026 (final) | Change |
|--------|--------------|------------------|--------|
| SMS Sent | 0 (verified) | 0 | flat |
| Calls | 0 (verified) | 0 | flat |
| Regulatory fee | $0.24 (posted Jun 4) | $0.24 | posted |
| Phone Rental base | $1.15 (posted Jun 7) | $1.15 | posted |
| Balance | **$11.2846** (verified) | $12.6746 (May 31) | -$1.39 (since May) |

**Twilio balance reconciliation:**
- Jun 7: Balance fell to $11.2846 (down $1.15 — June base phone-rental posted)
- Jun 8-20 (verified): **$11.2846** (flat — no new charge; 13th consecutive flat day)
- June recurring fully reconciled: $0.24 + $1.15 = $1.39 (matches config)
- Runway: $11.2846 / $1.39 = **~8.1 months**
- 50 usage records checked, 0 non-zero — consistent with prior full scans.

### Stripe Revenue

| Metric | June (day 20) | May 2026 | Apr 2026 | Mar 2026 | Feb 2026 |
|--------|--------------|---------|---------|---------|---------|
| Net Sales | 0 | 0 | 0 | 0 | 6 |
| Net Revenue | $0.00 | $0.00 | $0.00 | $0.00 | $9.98 |

**127-day revenue drought** — No Day Pass sales since Feb 13.

---

## Cost Efficiency

| Metric | Current (Jun 20) | Previous (Jun 19) | Change | Trend |
|--------|------------------|-------------------|--------|-------|
| Fixed operational cost/mo (config) | **$99.65** | $99.65 | flat | flat |
| Daily burn rate (fixed) | **$3.32/day** | $3.32/day | flat | flat |
| Monthly variable spend (confirmed) | **$1.39** | $1.39 | flat | flat |
| ElevenLabs char utilization (current cycle) | **1.072%** | 1.072% | flat | flat |
| ElevenLabs voice min utilization (Paisaxe MTD) | 0% | 0% | flat | flat |
| Revenue coverage (operational) | **0%** | 0% | flat | flat |
| Twilio runway | **~8.1 months** | ~8.1 months | flat | flat |

All cost efficiency metrics are flat for a 13th consecutive day. Cost-per-chat and cost-per-visitor for Paisaxe remain unquantifiable — no Paisaxe variable usage and no per-project Anthropic billing API.

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Alert Level |
|---------|--------|------|-------|-------------|-------------|
| ElevenLabs | Characters (current cycle) | 3,215 | 300,000 | **1.072%** | SAFE |
| ElevenLabs | Voice Minutes (Paisaxe, June) | 0.0 | 100 | **0%** | SAFE |
| Vercel | Monthly Visitors | ~low | 500,000 (Pro) | **<1%** | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | SAFE |

All tier alerts clear. At the current personal-only ElevenLabs rate (~247 chars/day based on 3,215 chars over the first ~13 active days), the cycle will reach approximately 7,400 chars by Jul 7 — 2.47% of the 300K limit. No upgrade pressure.

### Upgrade Trigger Points

| Service | Current Tier | Trigger | Next Tier | Cost Jump |
|---------|--------------|---------|-----------|-----------|
| ElevenLabs | Creator ($22.18/mo eff.) | >100 min/mo | Scale ($99/mo) | +$77/mo |
| Supabase | Pro ($25/mo) | >8 GB storage | Team ($599/mo) | +$574/mo |
| PostHog | Free ($0) | >1M events/mo | Pay-as-you-go | Variable |

---

## Scaling Forecast

Based on `src/lib/costs/forecast.ts` logic. No current Paisaxe variable usage data; using February 2026 actuals as baseline with fallback per-unit costs (fixed costs constant, AI/voice variable costs scale linearly with the multiplier).

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
| 127-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. Four complete zero-revenue months (Mar, Apr, May), plus June day 20 on the same trajectory. Cumulative operational loss ~$454. |
| 123-day Paisaxe voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Manual production verification of the Pelayo widget and Day Pass flow on paisaxe.es remains the highest-priority outstanding action. |
| LLM safety guardrails blind — 6th cycle | **WARNING** | QA Jun 18: VOYAGE_API_KEY missing from QA environment causes Chat API 503 on 11/12 LLM quality tests. Jun 19 triage applied a preflight/export fix; next QA cycle should confirm Voyage reachability. Until then, authority-impersonation/PII/boundary tests remain unverified. |
| ElevenLabs Coach failure pattern | **WATCH** | 9 clear failures + 1 unknown short-disconnect in the last-15 window, byte-identical to the prior four reports. All personal "Coach" agent. Pattern: instant client-disconnect terminations (3-5s). Not a Paisaxe or cost issue. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual check required at platform.claude.com/settings/billing. Config estimate $25/mo may be $40-60/mo based on observed credit grant frequency. |

No new platform cost-structure anomalies. No >20% operational cost increase, no daily spend spike >2x average, no tier-limit proximity, no unexpected new service.

---

## Trend Analysis

### Comparison: Jun 19 (day 19) vs Jun 20 (day 20)

| Metric | Jun 19 | Jun 20 | Change | Direction |
|--------|--------|--------|--------|-----------|
| Variable costs (confirmed MTD) | $1.39 | $1.39 | flat | flat |
| Fixed accrued | ~$63.08 | ~$66.40 | +$3.32 | up (1 day) |
| Daily burn rate (fixed) | $3.32/day | $3.32/day | flat | flat |
| Twilio balance | $11.2846 | **$11.2846** | flat | flat |
| Twilio runway | ~8.1 months | ~8.1 months | flat | flat |
| ElevenLabs chars (current cycle) | 3,215 / 300,000 | **3,215 / 300,000** | flat | flat |
| ElevenLabs char utilization | 1.072% | **1.072%** | flat | flat |
| Paisaxe voice silence | 122 days | **123 days** | +1 | down |
| Revenue drought | 126 days | **127 days** | +1 | down |
| Cumulative operational loss | ~$451 | **~$454** | +$3 | down |
| Security advisories | 0 | 0 | flat | GREEN |
| LLM quality blind cycles | 5 | **6** | +1 | down |

**Key observations:**

1. **Fully flat billing cycle** — no new ElevenLabs conversations, no new Twilio charges, no new variable spend since Jun 16. June is on track to close at ~$101.04 operational with $0 revenue, identical to the Mar-May pattern.

2. **QA safety signal still blocked** — Issue #635 (port mismatch) was fixed; the remaining blocker is VOYAGE_API_KEY availability in the QA environment. Jun 19 triage applied a preflight/export fix, so the next QA cycle should either pass cleanly or surface a clearer 503 reason. This is a QA environment configuration issue, not a production regression.

3. **Revenue drought past the 4-month mark** — Feb, Mar, Apr, May all closed at $0. June day 20 at $0. The structural break-even (~1,200 monthly visitors) remains roughly 24x the current traffic level (~50 visitors/mo).

4. **ElevenLabs Creator annual sunk cost accumulating** — With 123 days of Paisaxe voice dormancy since Feb 17, roughly one-third of the annual term has elapsed without any production voice usage. Renewal decision is still ~8 months out (2027-02-07).

5. **Dependabot maintenance current** — Per Jun 17 triage, 3 PRs merged (#639, #641, #643). Security GREEN with 0 advisories (3rd consecutive GREEN per Jun 19). Production dep count at 34/40 (6 headroom slots). Performance last authoritative total 3,027 KB / 3,500 KB budget.

---

## Recommendations

### Immediate Actions (Priority)

1. **Investigate the revenue and voice drought — 127 days (P1, CRITICAL).** Four-plus consecutive months without revenue. Manual checks required on paisaxe.es:
   - Is the Pelayo voice widget rendering and accessible on production?
   - Is the Day Pass purchase flow functional end-to-end?
   - Are Vercel deployment logs showing errors on production?
   - Has organic traffic dropped? (PostHog / Vercel Analytics dashboard)

2. **Confirm VOYAGE_API_KEY in QA environment (P1).** Jun 19 triage applied a preflight/export fix for the missing key that blocked 11/12 LLM quality tests. The next QA cycle should verify it restores the full 12/12 safety signal and closes the gap after 6 blind cycles.

3. **Verify Anthropic billing manually (P2)** — Visit platform.claude.com/settings/billing. Config estimate is $25/mo; observed credit grant patterns suggest $40-60/mo across all projects. If actual spend is $40+/mo, cumulative loss would be ~$469+.

4. **Tier-downgrade / voice-shelving decision (P2).** A pure cost/product decision. If no growth event is expected:
   - Vercel Pro ($20/mo) -> Hobby (free). Caveat: Hobby disallows commercial use and removes per-minute cron precision the agents rely on — weigh against the cron schedule before downgrading.
   - Supabase Pro ($25/mo) -> Free (500MB storage, 50K MAU).
   - Shelving the ElevenLabs voice integration saves ~$22/mo effective (at the next renewal decision — annual plan sunk until 2027-02-07) and removes the deferred ElevenLabs client chunk (~56 KB async in webpack mode per Performance Jun 19; ~605 KB single chunk in Turbopack).
   - Combined potential savings: up to ~$45/mo (~45% of operational cost).

### Cost Reduction Evaluation

5. **Twilio: next decision window is ~Jul 7 (P3).** The June charges are sunk; no in-month saving available. 123 days without a booking call. If no bookings are expected to resume, releasing the number before the next ~Jul 7 base charge avoids the July rental ($1.39/mo). Re-evaluate in early July.

6. **ElevenLabs Creator tier correctly sized.** No upgrade pressure. Current cycle at 1.072% utilization (3,215 chars, all personal). Scale tier ($99/mo) only warranted if sustained Paisaxe voice traffic exceeds 100 min/mo — currently 123 days dormant.

### Long-Term Planning

7. **Revenue trajectory remains structurally unsustainable (P1 escalation).** Four complete zero-revenue months. Daily burn: $3.32/day. Break-even requires ~1,200 monthly visitors at 5% Day Pass conversion (currently ~50 visitors). The platform requires a growth event, aggressive cost reduction, or both.

---

## Data Sources

| Source | Method | Last Queried | Status |
|--------|--------|--------------|--------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-06-20 03:00 UTC | Pass (3,215 chars / 300,000, unchanged since Jun 16; cycle day 14; next reset ~Jul 7 15:15 UTC) |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=15` | 2026-06-20 03:00 UTC | Pass (no new conversations since Jun 16 05:54 UTC; last-15 window unchanged) |
| Twilio Balance API | `/Balance.json` | 2026-06-20 03:00 UTC | Pass ($11.2846, flat — 13th consecutive flat day) |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json?PageSize=50` | 2026-06-20 03:00 UTC | Pass (50 records checked, 0 non-zero) |
| Config: `service-tiers.ts` | File read | 2026-06-20 | Pass |
| Config: `recurring-costs.ts` | File read | 2026-06-20 | Pass ($1.39 Twilio, both June charges posted) |
| Config: `forecast.ts` | File read | 2026-06-20 | Pass |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | — | Manual check required at platform.claude.com/settings/billing |
| Cross-agent context | Agent shared context | 2026-06-20 | Pass — Security GREEN (0 advisories, Jun 19); Performance build:analyze run Jun 19 (3,027 KB last authoritative); Coverage 98.74% (Jun 20); Localization 100% (Jun 19); QA VOYAGE_API_KEY blocker, triage fix applied Jun 19 |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-06-21.*

---
