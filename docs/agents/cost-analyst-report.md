# Cost Analyst Report

> **Generated**: 2026-06-10 01:01 UTC | **Period**: June 2026 (day 10 of 30) | **Status**: WATCH

---

## Executive Summary

Both ElevenLabs and Twilio APIs queried successfully. Day 10 of the June billing month. The only movement this cycle is a single, negligible personal-agent event on ElevenLabs: the character count rose from **0 to 38 / 300,000** driven by one new "Coach" conversation on **Jun 8 11:40 UTC** (3 seconds, 1 message, call result unknown). No Paisaxe agent contributed. Everything else is flat: Twilio balance is unchanged at **$11.2846** (both June recurring charges already posted and reconciled), all tier limits are well within bounds, fixed costs are unchanged, and revenue remains $0. There are no pending Twilio charges until ~Jul 7. Security carries forward GREEN (0 advisories, Jun 6-7); Performance carries forward RED (Jun 7 — bundle breach confirmed authoritative at 3,398 KB / 3,100 KB, 298 KB over, with the 605 KB ElevenLabs chunk identified as the single lever that clears it).

**ElevenLabs**: Creator tier, **38 / 300,000 characters (0.013%)** in the current billing cycle (started Jun 7 ~15:15 UTC, day 3 of 30). The +38 characters versus the Jun 8 report trace entirely to one new personal "Coach" conversation on Jun 8 11:40 UTC — an "Initial Greeting" that ran 3 seconds with a single message and disconnected (Client disconnected: 1000). All five Paisaxe agents (Visitor Pelayo, Booking Pelayo, Penny, Iris, Xander) remain at zero conversations. Next cycle reset: ~Jul 7 2026 15:15 UTC (Unix 1783437319). Next annual invoice: $266.20 on 2027-02-07 (Unix 1802012845).

**Twilio**: Balance **$11.2846** (flat versus Jun 8 — zero change). The June recurring charge is fully posted and reconciled: $0.24 regulatory fee (Jun 4) + $1.15 base phone-number rental (Jun 7) = $1.39 total, matching `recurring-costs.ts` config. All June SMS/call usage records remain $0.00 (50 records checked, 0 non-zero; as_of 2026-06-10 01:00 UTC). Runway ~8.1 months at $1.39/mo recurring.

**Revenue drought reaches 117 days** (since Feb 13). **Paisaxe voice silence: 113 days** (since Feb 17). Both metrics advanced by two days versus the Jun 8 report.

**June 2026 financial position (day 10)**: ~$33.20 in accrued fixed operational costs (10 days x $3.32/day), $1.39 in confirmed Twilio variable charges (both June charges posted), $0.00 revenue.

**Cumulative operational loss since February launch: ~$423.**

**Financial health: WATCH** — no platform cost-structure anomalies, all tier limits safe, security GREEN. The single new Coach conversation (38 chars) is a personal-agent event of negligible cost, not an anomaly. The outstanding concern remains the 117-day revenue drought and 113-day Paisaxe voice silence, which require manual production investigation on paisaxe.es. The tier-downgrade decision continues to carry a second justification — the Jun 7-confirmed bundle-budget breach driven by the 605 KB ElevenLabs chunk (see Trend Analysis and Recommendations).

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

### Variable / Usage-Based Costs (June 2026 — Day 10)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Phone rental base) | Posted Jun 7 (balance -$1.15) | **$1.15** | Verified via API (balance drop) |
| Twilio (Regulatory fee) | Posted Jun 4 (balance -$0.24) | **$0.24** | Verified via API (balance drop) |
| Twilio (SMS) | 0 messages | $0.00 | Verified via API |
| Twilio (Calls) | 0 minutes | $0.00 | Verified via API |
| ElevenLabs (overage) | 38 chars (new cycle, well within 300K) | $0.00 | Verified via API (current_overage = $0) |
| Stripe (Processing Fees) | 0 charges | $0.00 | — |
| Anthropic (Claude API) | Unknown | Unknown | No API on personal account |
| Voyage AI (Embeddings) | Unknown | Unknown | No dedicated API |
| **Total Variable (June day 10, confirmed)** | | **$1.39** | |

### June 2026 Position (Day 10 of 30)

| Category | Cost |
|----------|------|
| Fixed Operational (accrued, 10 days x $3.32) | ~$33.20 |
| Variable confirmed (Twilio reg fee + base rental, both posted) | $1.39 |
| **Total Operational (June MTD)** | **~$34.59** |
| Revenue | $0.00 |
| **Net (loss)** | **-$34.59** |

*Note: the $1.39/mo Twilio charge is already embedded in the $3.32/day fixed burn rate; the "variable confirmed" line tracks the lumpy actual postings for reconciliation and slightly overlaps the smoothed daily accrual. Projected June close (no growth event): ~$99.65 fixed operational, $0.00 revenue.*

### Monthly Cost History

| Month | Operational Fixed | Variable (confirmed) | Total Operational | Revenue (net) | Coverage |
|-------|-------------------|----------------------|-------------------|---------------|----------|
| Feb 2026 | ~$95 (ramping) | ~$2.75 | ~$97.75 | ~$9.98 | ~10.2% |
| Mar 2026 (final) | $99.41 | $1.15 | **$100.56** | **$0.00** | **0%** |
| Apr 2026 (final) | $99.41 | $1.39 | **$100.80** | **$0.00** | **0%** |
| May 2026 (final) | $99.65 | $1.39 | **$101.04** | **$0.00** | **0%** |
| Jun 2026 (day 10) | $99.65 (proj.) | $1.39 (both posted) | **~$101.04 (proj.)** | $0.00 (MTD) | 0% |

**Cumulative operational loss since February launch: ~$423.**

---

## Usage Metrics

### ElevenLabs Activity

API queried successfully. Live data:

- **Current cycle**: Started Jun 7 ~15:15 UTC. Characters used: **38 / 300,000 (0.013%)**. New cycle, day 3 of 30.
- **New activity since Jun 8**: One new personal "Coach" conversation on Jun 8 11:40 UTC (3s, 1 message, "Initial Greeting", Client disconnected: 1000, call_successful = unknown). This accounts for the entire +38-character delta. No Paisaxe agent involved.
- **Paisaxe agents** (Visitor Pelayo, Booking Pelayo, Penny, Iris, Xander): **0 conversations since Feb 17** (113 days). All ElevenLabs activity remains personal "Coach"/"Archy" agents, not Paisaxe.
- **Personal-agent reliability**: The last-10 sample continues to show a high failure rate (~60%) on the Coach/Archy personal agents (custom_llm generation failed / client-disconnect pattern) — a personal-agent integration issue, not Paisaxe.
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

No Paisaxe agent appears anywhere in the last-10 window. Two new Coach entries (Jun 8 06:03 and 11:40 UTC) appeared since the Jun 8 01:01 report, pushing the oldest Archy entries off the bottom of the window.

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

| Metric | June (day 10) | May 2026 (final) | Change |
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
- Jun 8-10 (verified): **$11.2846** (flat — no new charge)
- June recurring fully reconciled: $0.24 + $1.15 = $1.39 (matches config)
- Runway: $11.2846 / $1.39 = **~8.1 months**

### Stripe Revenue

| Metric | June (day 10) | May 2026 | Apr 2026 | Mar 2026 | Feb 2026 |
|--------|--------------|---------|---------|---------|---------|
| Net Sales | 0 | 0 | 0 | 0 | 6 |
| Net Revenue | $0.00 | $0.00 | $0.00 | $0.00 | $9.98 |

**117-day revenue drought** — No Day Pass sales since Feb 13.

---

## Cost Efficiency

| Metric | Current (Jun 10) | Previous (Jun 8) | Change | Trend |
|--------|------------------|-------------------|--------|-------|
| Fixed operational cost/mo (config) | **$99.65** | $99.65 | flat | flat |
| Daily burn rate (fixed) | **$3.32/day** (June=30d) | $3.32/day | flat | flat |
| Monthly variable spend (confirmed) | **$1.39** | $1.39 | flat | flat |
| Cost per voice conversation (Feb actuals) | ~$0.43 | ~$0.43 | flat | flat |
| Cost per voice minute (Feb actuals) | ~$0.37 | ~$0.37 | flat | flat |
| ElevenLabs char utilization (current cycle) | **0.013%** | 0.00% | +38 chars | up (1 Coach conv) |
| ElevenLabs voice min utilization (Paisaxe MTD) | 0% | 0% | flat | flat |
| Revenue coverage (operational) | **0%** | 0% | flat | flat |
| Twilio runway | **~8.1 months** | ~8.1 months | flat | flat |

The only metric movement is ElevenLabs character utilization, which rose from 0.00% to 0.013% on one new personal Coach conversation (38 chars). This is a negligible, non-Paisaxe event well within the Creator limit. Twilio runway held flat at ~8.1 months because no new charge posted. Every other tracked metric is flat. Cost-per-chat and cost-per-visitor remain unquantifiable for Paisaxe specifically — no Paisaxe variable usage and no per-project Anthropic billing API. February voice actuals remain the only real per-unit data point.

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
| 117-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. Three complete zero-revenue months (Mar, Apr, May), June on the same trajectory. Cumulative operational loss ~$423. |
| 113-day Paisaxe voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Manual production verification of the Pelayo widget and Day Pass flow on paisaxe.es remains the highest-priority outstanding action. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual check required at platform.claude.com/settings/billing. Config estimate $25/mo may be $40-60/mo based on observed credit grant frequency. |

**No new platform cost-structure anomalies.** The one new personal "Coach" conversation (38 chars) is a negligible personal-agent event — not an anomaly. No >20% cost increase, no daily spend spike >2x average, no tier-limit proximity, no unexpected new service. The June Twilio recurring charge ($1.39 total) is fully posted and reconciled against config.

**Resolved (carry-forward from earlier cycles):**
- All security advisories — Security agent reports GREEN (0 advisories) as of Jun 6-7. `npm audit` clean across prod + dev.
- Twilio recurring-cost config discrepancy ($1.15 -> $1.39) — closed by May 8 triage. The Jun 4 $0.24 fee + Jun 7 $1.15 base postings together confirm the $1.39 split is correct in config.
- Stripe `apiVersion` tsc concern (`stripe.ts`) — root-caused as **local node_modules drift**, NOT a develop-branch CI failure. `npm install` resolves it. No pin revert needed. Stand down.

---

## Trend Analysis

### Comparison: Jun 8 (day 8) vs Jun 10 (day 10)

| Metric | Jun 8 | Jun 10 | Change | Direction |
|--------|--------|-------|--------|-----------|
| Variable costs (confirmed MTD) | $1.39 | $1.39 | flat | flat |
| Fixed accrued | ~$26.57 | ~$33.20 | +$6.64 | up (2 days) |
| Daily burn rate (fixed) | $3.32/day | $3.32/day | flat | flat |
| Twilio balance | $11.2846 | **$11.2846** | flat | flat |
| Twilio runway | ~8.1 months | ~8.1 months | flat | flat |
| ElevenLabs chars (current cycle) | 0 / 300,000 | **38 / 300,000** | +38 | up (1 Coach conv) |
| Paisaxe voice silence | 111 days | **113 days** | +2 | down |
| Revenue drought | 115 days | **117 days** | +2 | down |
| Cumulative operational loss | ~$416 | ~$423 | +$7 | down |
| Security advisories | 0 | 0 | flat | flat (GREEN) |

**Key observations:**

1. **One new personal Coach conversation, otherwise quiescent.** The character count rose from 0 to 38 / 300,000 on a single Jun 8 11:40 UTC "Coach" conversation (3s, 1 message). This is personal usage with negligible cost — no Paisaxe contribution. Two new Coach entries (Jun 8 06:03 and 11:40 UTC) entered the last-10 window since the prior report.

2. **Everything else holds the quiescent plateau.** Twilio balance is flat at $11.2846 (no new charge — both June recurring components posted Jun 4 and Jun 7). Runway steady at ~8.1 months. The only other movement is the deterministic +2 days on the two drought counters and the daily fixed-cost accrual.

3. **No Paisaxe activity in 113 days.** Paisaxe agents at 0 conversations since Feb 17. The ElevenLabs activity remains entirely personal Coach/Archy agents.

4. **June is on the same zero-revenue trajectory.** Mar, Apr, and May all closed at $0.00 net revenue. June day 10 is $0.00. The pattern is structurally unchanged.

5. **117-day revenue drought.** Four months past the last Day Pass sale on Feb 13. Cumulative operational losses since launch reach ~$423.

6. **Bundle-budget breach reinforces the voice-shelving decision (carry-forward, Performance Jun 7).** The Performance agent confirmed RED on Jun 7: the bundle breach is now authoritative at 3,398 KB against the 3,100 KB budget (298 KB over, 1.10x), with the Jun 4 dep batch (#592) having zero bundle impact. The ElevenLabs SDK chunk is **605 KB** (~18% of the bundle) and is the single lever that clears the breach (removal -> ~2,793 KB, back under budget). Because that chunk serves 113 days of zero Paisaxe voice traffic, shelving voice / downgrading resolves *both* the cost overhang *and* the bundle breach in one move. This continues to strengthen the case for the tier/voice decision below.

7. **Security clean.** Zero outstanding advisories (Security agent GREEN, Jun 6-7). One hygiene item flagged by Security: posthog-js lockfile drift (1.376.4 vs ^1.378.1; 1.382.0 available) — no CVE, batch with the standing dep update. No cost-affecting issue.

---

## Recommendations

### Immediate Actions (Priority)

1. **Investigate the revenue and voice drought — 117 days (P1, CRITICAL).** Three consecutive complete zero-revenue months, June on the same path. Manual checks required on paisaxe.es:
   - Is the Pelayo voice widget rendering and accessible on production?
   - Is the Day Pass purchase flow functional end-to-end?
   - Are Vercel deployment logs showing errors on production?
   - Has organic traffic dropped? (PostHog / Vercel Analytics dashboard)

2. **Tier-downgrade / voice-shelving decision carries a dual benefit (P2, elevated).** The June checkpoint has passed with the drought ongoing, and the Jun 7-confirmed bundle breach (3,398 KB / 3,100 KB, authoritative RED) gives a second reason to act. If no growth event is expected:
   - Vercel Pro ($20/mo) -> Hobby (free, reduced limits).
   - Supabase Pro ($25/mo) -> Free (500MB storage, 50K MAU).
   - Shelving the ElevenLabs voice integration removes the 605 KB chunk and returns the bundle under budget, on top of the cost optimization.
   - Combined potential savings: up to $45/mo (~45% of operational cost) plus the bundle-budget recovery. Caveat: Hobby disallows commercial use and removes per-minute cron precision the agents rely on — weigh against the cron schedule before downgrading Vercel.

3. **Check Anthropic billing manually (P2)** — Visit platform.claude.com/settings/billing. Config estimate is $25/mo; observed credit grant patterns suggest $40-60/mo across all projects. If actual spend is $40+/mo, cumulative loss would be ~$448+.

### Cost Reduction Evaluation

4. **Twilio June base charge is sunk — next decision window is ~Jul 7 (P3).** The $1.15 June base rental posted Jun 7; there is no in-month saving available for June. 113 days without a booking call. If no bookings are expected to resume, releasing the number before the next ~Jul 7 base charge avoids the July rental ($1.39/mo, $16.68/yr). No urgency this week — re-evaluate in early July.

5. **ElevenLabs Creator tier correctly sized.** No upgrade pressure. The current cycle is at 0.013% utilization (38 chars, all personal). Scale tier ($99/mo) only warranted if sustained Paisaxe voice traffic exceeds 100 min/mo — currently 113 days dormant.

### Long-Term Planning

6. **Revenue trajectory remains structurally unsustainable (P1 escalation).** Three complete zero-revenue months and June continuing. Daily burn: $3.32/day. Break-even requires ~1,200 monthly visitors at 5% Day Pass conversion (currently ~50 visitors). The platform requires a growth event, aggressive cost reduction, or both. With the June checkpoint passed and the bundle over budget, the Vercel Hobby + Supabase Free downgrades plus voice shelving (~$45/mo saved + 605 KB bundle recovery) are the most concrete available levers.

---

## Data Sources

| Source | Method | Last Queried | Status |
|--------|--------|--------------|--------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-06-10 01:01 UTC | Pass (38 chars, current cycle day 3, next reset ~Jul 7 15:15 UTC) |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=10` | 2026-06-10 01:01 UTC | Pass (1 new Coach conv Jun 8 11:40 UTC; no Paisaxe activity) |
| Twilio Balance API | `/Balance.json` | 2026-06-10 01:01 UTC | Pass ($11.2846, flat — no new charge) |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json` | 2026-06-10 01:01 UTC | Pass (50 records, 0 non-zero; as_of 2026-06-10 01:00 UTC) |
| Config: `service-tiers.ts` | File read | 2026-06-10 | Pass |
| Config: `recurring-costs.ts` | File read | 2026-06-10 | Pass ($1.39 Twilio, config-aligned; both June charges posted) |
| Config: `forecast.ts` | File read | 2026-06-10 | Pass |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | — | Manual check required at platform.claude.com/settings/billing |
| Cross-agent context | Agent shared context | 2026-06-10 | Pass — security GREEN (Jun 6-7, 0 advisories), performance RED (Jun 7, bundle breach confirmed authoritative 3,398 KB / 3,100 KB + 605 KB ElevenLabs chunk), localization GREEN (Jun 8, fixed 8 generated story translations -> 113/113) |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-06-11.*

---
