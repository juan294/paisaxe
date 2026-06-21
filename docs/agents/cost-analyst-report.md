# Cost Analyst Report

> **Generated**: 2026-06-21 03:00 UTC | **Period**: June 2026 (day 21 of 30) | **Status**: WATCH

---

## Executive Summary

Both ElevenLabs and Twilio APIs queried successfully. Day 21 of June. The main change from yesterday: ElevenLabs character count jumped from **3,215 to 5,010 (+1,795 chars, +55.8%)** due to 7 new personal-account conversations on Jun 20. Six were from `agent_7901kk4r9v3wer` (a non-Paisaxe agent, now deleted from the ElevenLabs API — returns 404), and one was a new Coach failure at 16:48 UTC. All conversations show 0s duration and none involve any Paisaxe agent. Twilio balance holds at **$11.2846** for the 14th consecutive flat day. All June recurring charges remain fully reconciled ($1.39 total — $0.24 reg fee Jun 4 + $1.15 base rental Jun 7).

Revenue drought reaches **128 days** (since Feb 13). Paisaxe voice silence: **124 days** (since Feb 17). June day 21 has accrued ~$69.72 in fixed operational costs with $0.00 revenue. Cumulative operational loss since launch: **~$457.**

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

*Anthropic $25/mo is the config estimate (all projects combined). No per-project breakdown available on personal accounts. Manual check required at platform.anthropic.com/settings/billing.*

**ElevenLabs Creator billed annually at $266.20/yr (effective $22.18/mo). Next annual invoice: $266.20 on 2027-02-07 (Unix 1802012845, verified via API — amount_due_cents 26620).*

***Twilio config reflects actual recurring charge: $1.15 base + $0.24 regulatory fee = $1.39/mo. Both June components posted (reg fee Jun 4, base rental Jun 7), confirming the $1.39 split is correct in config.*

**Note**: Claude Code Max ($200/mo) is the primary development tool, categorized separately as "Development." Operational cost analysis focuses on the live service ($99.65/mo).

**Total Fixed Operational**: $99.65/mo | **Daily Burn Rate**: $3.32/day (June = 30 days)

### Variable / Usage-Based Costs (June 2026 — Day 21)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Phone rental base) | Posted Jun 7 | **$1.15** | Verified via API |
| Twilio (Regulatory fee) | Posted Jun 4 | **$0.24** | Verified via API |
| Twilio (SMS) | 0 messages | $0.00 | Verified via API (50 records checked, 0 non-zero) |
| Twilio (Calls) | 0 minutes | $0.00 | Verified via API |
| ElevenLabs (overage) | 5,010 chars (within 300K) | $0.00 | Verified via API (current_overage = $0) |
| Stripe (Processing Fees) | 0 charges | $0.00 | — |
| Anthropic (Claude API) | Unknown | Unknown | No API on personal account |
| Voyage AI (Embeddings) | Unknown | Unknown | No dedicated API |
| **Total Variable (June day 21, confirmed)** | | **$1.39** | |

### June 2026 Position (Day 21 of 30)

| Category | Cost |
|----------|------|
| Fixed Operational (accrued, 21 days x $3.32) | ~$69.72 |
| Variable confirmed (Twilio reg fee + base rental, both posted) | $1.39 |
| **Total Operational (June MTD)** | **~$69.72** |
| Revenue | $0.00 |
| **Net (loss)** | **-$69.72** |

*Note: the $1.39/mo Twilio charge is embedded in the $3.32/day fixed burn rate; the "variable confirmed" line tracks the lumpy actual postings for reconciliation.*

### Monthly Cost History

| Month | Operational Fixed | Variable (confirmed) | Total Operational | Revenue (net) | Coverage |
|-------|-------------------|----------------------|-------------------|---------------|----------|
| Feb 2026 | ~$95 (ramping) | ~$2.75 | ~$97.75 | ~$9.98 | ~10.2% |
| Mar 2026 (final) | $99.41 | $1.15 | **$100.56** | **$0.00** | **0%** |
| Apr 2026 (final) | $99.41 | $1.39 | **$100.80** | **$0.00** | **0%** |
| May 2026 (final) | $99.65 | $1.39 | **$101.04** | **$0.00** | **0%** |
| Jun 2026 (day 21) | $99.65 (proj.) | $1.39 (both posted) | **~$101.04 (proj.)** | $0.00 (MTD) | 0% |

**Cumulative operational loss since February launch: ~$457.**

---

## Usage Metrics

### ElevenLabs Activity

API queried successfully. Live data:

- **Current cycle**: Started Jun 7 ~15:15 UTC. Characters used: **5,010 / 300,000 (1.670%)**. Day 14 of ~30.
- **Change since Jun 20 report**: **+1,795 characters (+55.8%)**. New conversations on Jun 20 from personal account agents (see table below).
- **Paisaxe agents** (Visitor Pelayo, Booking Pelayo, Penny, Iris, Xander): **0 conversations since Feb 17** (124 days). No Paisaxe agent appears in the last-15 window.
- **Personal Coach reliability**: 10 failures in extended window — Coach at Jun 20 16:48 UTC added another 0s failure. Pattern unchanged (instant client-disconnect terminations).
- **New agent activity**: `agent_7901kk4r9v3wer` (non-Paisaxe, deleted from API — returns 404) generated 6 conversations on Jun 20 07:16-07:37 UTC. All 0s duration. Not a cost or security concern.
- Next reset: ~Jul 7 2026 15:15 UTC (Unix 1783437319).

### ElevenLabs Conversation Breakdown (Last 15, via API)

| Date (UTC) | Agent ID | Status | Call Result | Duration |
|------------|----------|--------|-------------|----------|
| 2026-06-20 16:48 | agent_8201kmhr2vbef3 (Coach) | done | failure | 0s |
| 2026-06-20 07:37 | agent_7901kk4r9v3wer (deleted) | done | success | 0s |
| 2026-06-20 07:36 | agent_7901kk4r9v3wer (deleted) | done | success | 0s |
| 2026-06-20 07:34 | agent_7901kk4r9v3wer (deleted) | done | success | 0s |
| 2026-06-20 07:27 | agent_7901kk4r9v3wer (deleted) | failed | failure | 0s |
| 2026-06-20 07:17 | agent_7901kk4r9v3wer (deleted) | failed | failure | 0s |
| 2026-06-20 07:16 | agent_7901kk4r9v3wer (deleted) | failed | failure | 0s |
| 2026-06-16 05:54 | agent_8201kmhr2vbef3 (Coach) | done | success | 186s |
| 2026-06-16 05:52 | agent_8201kmhr2vbef3 (Coach) | done | success | 50s |
| 2026-06-16 05:48 | agent_8201kmhr2vbef3 (Coach) | done | failure | 223s |
| 2026-06-14 07:36 | agent_8201kmhr2vbef3 (Coach) | done | success | 19s |
| 2026-06-14 05:24 | agent_8201kmhr2vbef3 (Coach) | done | failure | 4s |
| 2026-06-14 05:14 | agent_8201kmhr2vbef3 (Coach) | done | failure | 5s |
| 2026-06-14 05:10 | agent_8201kmhr2vbef3 (Coach) | done | failure | 3s |
| 2026-06-08 11:40 | agent_8201kmhr2vbef3 (Coach) | done | unknown | 3s |

`agent_7901kk4r9v3wer` is not a Paisaxe agent — absent from the Paisaxe codebase and returning 404 from the ElevenLabs agent API (deleted agent). Activity was entirely on Jun 20.

### ElevenLabs Subscription Details

| Field | Value |
|-------|-------|
| Tier | Creator |
| Billing period | Annual |
| Status | Active |
| Current cycle start | Jun 7 ~15:15 UTC |
| Next cycle reset | ~Jul 7 2026 15:15 UTC (Unix 1783437319) |
| Character limit | 300,000 |
| Characters used (current cycle) | 5,010 (up from 3,215 on Jun 20) |
| Voice limit | 30 |
| Voice slots used | 0 / 30 |
| Current overage | $0.00 |
| Next annual invoice | $266.20 on 2027-02-07 (Unix 1802012845) |

### Twilio Communications

| Metric | June (day 21) | May 2026 (final) | Change |
|--------|--------------|------------------|--------|
| SMS Sent | 0 (verified) | 0 | flat |
| Calls | 0 (verified) | 0 | flat |
| Regulatory fee | $0.24 (posted Jun 4) | $0.24 | posted |
| Phone Rental base | $1.15 (posted Jun 7) | $1.15 | posted |
| Balance | **$11.2846** (verified) | $12.6746 (May 31) | -$1.39 (since May) |

**Twilio balance reconciliation:**
- Jun 7: Balance fell to $11.2846 (down $1.15 — June base phone-rental posted)
- Jun 8-21 (verified): **$11.2846** (flat — no new charge; 14th consecutive flat day)
- June recurring fully reconciled: $0.24 + $1.15 = $1.39 (matches config)
- Runway: $11.2846 / $1.39 = **~8.1 months**
- 50 usage records checked, 0 non-zero — consistent with all prior full scans.

### Stripe Revenue

| Metric | June (day 21) | May 2026 | Apr 2026 | Mar 2026 | Feb 2026 |
|--------|--------------|---------|---------|---------|---------|
| Net Sales | 0 | 0 | 0 | 0 | 6 |
| Net Revenue | $0.00 | $0.00 | $0.00 | $0.00 | $9.98 |

**128-day revenue drought** — No Day Pass sales since Feb 13.

---

## Cost Efficiency

| Metric | Current (Jun 21) | Previous (Jun 20) | Change | Trend |
|--------|------------------|-------------------|--------|-------|
| Fixed operational cost/mo (config) | **$99.65** | $99.65 | flat | flat |
| Daily burn rate (fixed) | **$3.32/day** | $3.32/day | flat | flat |
| Monthly variable spend (confirmed) | **$1.39** | $1.39 | flat | flat |
| ElevenLabs char utilization (current cycle) | **1.670%** | 1.072% | +0.598% | up |
| ElevenLabs voice min utilization (Paisaxe MTD) | 0% | 0% | flat | flat |
| Revenue coverage (operational) | **0%** | 0% | flat | flat |
| Twilio runway | **~8.1 months** | ~8.1 months | flat | flat |

ElevenLabs char utilization rose due to personal-account activity (deleted agent + Coach). Paisaxe voice efficiency remains unquantifiable — 124 consecutive days with zero Paisaxe voice conversations. Cost-per-chat and cost-per-visitor remain unquantifiable with no Paisaxe variable usage and no per-project Anthropic billing API.

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Alert Level |
|---------|--------|------|-------|-------------|-------------|
| ElevenLabs | Characters (current cycle) | 5,010 | 300,000 | **1.670%** | SAFE |
| ElevenLabs | Voice Minutes (Paisaxe, June) | 0.0 | 100 | **0%** | SAFE |
| Vercel | Monthly Visitors | ~low | 500,000 (Pro) | **<1%** | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | SAFE |

All tier alerts clear. At the current personal-only ElevenLabs rate (~358 chars/day based on 5,010 chars over ~14 days of the cycle), the cycle will reach approximately 10,740 chars by Jul 7 — 3.58% of the 300K limit. No upgrade pressure.

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
| 128-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. Four complete zero-revenue months (Mar, Apr, May), plus June day 21 on the same trajectory. Cumulative operational loss ~$457. |
| 124-day Paisaxe voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Manual production verification of the Pelayo widget and Day Pass flow on paisaxe.es remains the highest-priority outstanding action. |
| New unknown agent_7901kk4r9v3wer activity (Jun 20) | **WATCH** | 6 conversations from a deleted personal-account agent on Jun 20 07:16-07:37 UTC. All 0s duration. Agent returns 404 from ElevenLabs API — no longer exists. Not a Paisaxe agent, not a cost issue ($0 overage). Note for pattern awareness: personal agent was tested/created and deleted between last cycle and today. |
| LLM safety guardrails blind — Jun 18 last data | **WARNING** | QA Jun 18: VOYAGE_API_KEY missing from QA environment causes Chat API 503 on 11/12 LLM quality tests. Jun 19 triage applied a preflight/export fix. Next QA run will confirm Voyage reachability. Authority-impersonation/PII/boundary tests unverified until QA clears. |
| ElevenLabs Coach failure pattern | **WATCH** | New failure at Jun 20 16:48 UTC (0s). Pattern continues: instant client-disconnect terminations. All personal "Coach" agent. Not a Paisaxe or cost issue. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual check required at platform.anthropic.com/settings/billing. Config estimate $25/mo may be $40-60/mo based on observed credit grant frequency. |

No new platform cost-structure anomalies. No >20% operational cost increase, no daily spend spike >2x average, no tier-limit proximity, no unexpected new service charges.

---

## Trend Analysis

### Comparison: Jun 20 (day 20) vs Jun 21 (day 21)

| Metric | Jun 20 | Jun 21 | Change | Direction |
|--------|--------|--------|--------|-----------|
| Variable costs (confirmed MTD) | $1.39 | $1.39 | flat | flat |
| Fixed accrued | ~$66.40 | ~$69.72 | +$3.32 | up (1 day) |
| Daily burn rate (fixed) | $3.32/day | $3.32/day | flat | flat |
| Twilio balance | $11.2846 | **$11.2846** | flat | flat |
| Twilio runway | ~8.1 months | ~8.1 months | flat | flat |
| ElevenLabs chars (current cycle) | 3,215 / 300,000 | **5,010 / 300,000** | +1,795 | up |
| ElevenLabs char utilization | 1.072% | **1.670%** | +0.598% | up |
| Paisaxe voice silence | 123 days | **124 days** | +1 | down |
| Revenue drought | 127 days | **128 days** | +1 | down |
| Cumulative operational loss | ~$454 | **~$457** | +$3 | down |
| Security advisories | 0 | 0 | flat | GREEN |
| LLM quality last good data | Jun 18 partial (1/12) | Jun 18 partial (1/12) | flat | — |

**Key observations:**

1. **Personal ElevenLabs activity on Jun 20** — A deleted agent (`agent_7901kk4r9v3wer`) generated +1,795 chars in 6 short conversations. Char utilization rose from 1.072% to 1.670%. This is not Paisaxe activity, does not affect overage ($0 current overage), and the agent no longer exists in ElevenLabs. The +1,795 chars represents approximately 5 days of prior personal-account baseline.

2. **June on track to close at ~$101.04 operational / $0 revenue** — Identical to the Mar-May pattern. With 9 days remaining, no variable spending beyond the $1.39 Twilio recurring is expected unless Paisaxe voice or chat traffic resumes.

3. **Revenue drought at 128 days / 4.3 months** — Feb, Mar, Apr, May all closed at $0. June day 21 at $0. The structural break-even (~1,200 monthly visitors) remains roughly 24x the current traffic level (~50 visitors/mo).

4. **QA Voyage AI blocker and manual safety check outstanding** — The Jun 19 triage fix for VOYAGE_API_KEY has not yet been confirmed green by a QA run. LLM safety guardrails (authority impersonation, PII, boundary tests) remain unverified. The next QA run will confirm or surface the next blocker.

5. **Twilio evaluation window approaching ~Jul 7** — The next base rental charge is due ~Jul 7. With 124 days of zero booking calls, evaluating whether to release the number before the next charge is worth a decision. Saving: $1.39/mo (1.4% of operational costs, minor but symbolic of overall voice dormancy).

---

## Recommendations

### Immediate Actions (Priority)

1. **Investigate the revenue and voice drought — 128 days (P1, CRITICAL).** Four-plus consecutive months without revenue. Manual checks required on paisaxe.es:
   - Is the Pelayo voice widget rendering and accessible on production?
   - Is the Day Pass purchase flow functional end-to-end?
   - Are Vercel deployment logs showing errors on production?
   - Has organic traffic dropped? (PostHog / Vercel Analytics dashboard)

2. **Confirm VOYAGE_API_KEY in QA environment (P1).** Jun 19 triage applied a preflight/export fix for the missing key that blocked 11/12 LLM quality tests. The next QA cycle should verify it restores the full 12/12 safety signal. The Jun 18 partial result (1/12 — injection path only) is the last data point on safety guardrails.

3. **Verify Anthropic billing manually (P2)** — Visit platform.anthropic.com/settings/billing. Config estimate is $25/mo; observed credit grant patterns suggest $40-60/mo across all projects. If actual spend is $40+/mo, cumulative loss would be ~$472+.

4. **Twilio number release decision — decision window ~Jul 7 (P2).** The June charges are sunk; no in-month saving available. With 124 days without a booking call, evaluate before the next ~Jul 7 base charge. Releasing saves $1.39/mo. Re-evaluate in early July.

5. **Tier-downgrade / voice-shelving decision (P3).** A pure cost/product decision. If no growth event is expected:
   - Vercel Pro ($20/mo) -> Hobby (free). Caveat: Hobby disallows commercial use and removes per-minute cron precision the agents rely on — weigh against the cron schedule before downgrading.
   - Supabase Pro ($25/mo) -> Free (500MB storage, 50K MAU).
   - Shelving the ElevenLabs voice integration saves ~$22/mo effective (at the next renewal decision — annual plan sunk until 2027-02-07) and removes the deferred ElevenLabs client chunk (~56 KB async in webpack mode per Performance Jun 19; click-to-mount confirmed working).
   - Combined potential savings: up to ~$45/mo (~45% of operational cost).

### Long-Term Planning

6. **Revenue trajectory remains structurally unsustainable (P1 escalation).** Four complete zero-revenue months. Daily burn: $3.32/day. Break-even requires ~1,200 monthly visitors at 5% Day Pass conversion (currently ~50 visitors). The platform requires a growth event, aggressive cost reduction, or both.

---

## Data Sources

| Source | Method | Last Queried | Status |
|--------|--------|--------------|--------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-06-21 03:00 UTC | Pass (5,010 chars / 300,000, up +1,795 from Jun 20; cycle day 14; next reset ~Jul 7 15:15 UTC) |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=15` | 2026-06-21 03:00 UTC | Pass (7 new conversations since Jun 20 report; 6 from deleted agent_7901kk4r9v3wer; no Paisaxe agent activity) |
| Twilio Balance API | `/Balance.json` | 2026-06-21 03:00 UTC | Pass ($11.2846, flat — 14th consecutive flat day) |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json?PageSize=50` | 2026-06-21 03:00 UTC | Pass (50 records checked, 0 non-zero) |
| Config: `service-tiers.ts` | File read | 2026-06-21 | Pass |
| Config: `recurring-costs.ts` | File read | 2026-06-21 | Pass ($1.39 Twilio, both June charges posted) |
| Config: `forecast.ts` | File read | 2026-06-21 | Pass |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | — | Manual check required at platform.anthropic.com/settings/billing |
| Cross-agent context | Agent shared context | 2026-06-21 | Pass — Security GREEN (0 advisories, Jun 20); Performance build:analyze complete Jun 19 (3,027 KB last authoritative); Coverage 98.74% (Jun 20); Localization 100% (Jun 20); QA VOYAGE_API_KEY blocker with triage fix applied Jun 19; Triage Jun 20 resolved LiveKit 412 KB chunk identity |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-06-22.*

---
