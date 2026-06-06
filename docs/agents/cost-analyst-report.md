# Cost Analyst Report

> **Generated**: 2026-06-06 01:05 UTC | **Period**: June 2026 (day 6 of 30) | **Status**: WATCH

---

## Executive Summary

Both ElevenLabs and Twilio APIs queried successfully. Day 6 of the June billing month. The cycle remains defined by total day-over-day flatness: the Twilio balance is unchanged at $12.4346 (the $0.24 June regulatory fee posted Jun 4 is still the only balance movement in the past 30 days; the $1.15 base rental projected for ~Jun 7 has still not posted), ElevenLabs character usage is static at 281, all tier limits are well within bounds, and revenue remains $0. Fixed costs are unchanged. Security carries forward GREEN (0 advisories, Jun 5); Performance carries forward GREEN-advisory (bundle-budget verdict suppressed Jun 5 because `.next` provenance was unverified — the underlying 3,398 KB / 3,100 KB breach remains real but unasserted this cycle).

**ElevenLabs**: Creator tier, **281 / 300,000 characters (0.094%)** in the current billing cycle (started May 8 ~15:07 UTC, day 29 of 30). Identical to the Jun 4 and Jun 5 readings — zero new characters in the last 48 hours. The newest conversation in the API remains the personal "Coach" agent on Jun 1 13:12 UTC (3s, call_successful = failure). All five Paisaxe agents (Visitor Pelayo, Booking Pelayo, Penny, Iris, Xander) remain at zero conversations. Next cycle reset: Jun 7 2026 15:07 UTC (tomorrow). Next annual invoice: $266.20 on 2027-02-07.

**Twilio**: Balance **$12.4346** (flat versus Jun 4 and Jun 5). The $0.24 June regulatory fee posted Jun 4; the $1.15 base phone-number rental projected for ~Jun 7 has not yet posted. All June SMS/call usage records remain $0.00 (50 records checked, 0 non-zero). Runway ~8.9 months at $1.39/mo recurring.

**Revenue drought reaches 113 days** (since Feb 13). **Paisaxe voice silence: 109 days** (since Feb 17). Both metrics advanced by one day versus the Jun 5 report.

**June 2026 financial position (day 6)**: ~$19.93 in accrued fixed operational costs (6 days x $3.32/day), $0.24 variable confirmed (Twilio regulatory fee), $0.00 revenue.

**Cumulative operational loss since February launch: ~$410.**

**Financial health: WATCH** — no platform cost-structure anomalies, all tier limits safe, security GREEN. The outstanding concern remains the 113-day revenue drought and 109-day Paisaxe voice silence, which require manual production investigation on paisaxe.es. The June 1 tier-downgrade decision point has passed with the drought ongoing; downgrade evaluation remains recommended, and continues to carry a second justification — the Performance agent's Jun 3-4 confirmed bundle-budget breach driven by the 605 KB ElevenLabs chunk (see Trend Analysis and Recommendations).

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

***Twilio config reflects actual recurring charge: $1.15 base + $0.24 regulatory fee = $1.39/mo. The $0.24 fee posted Jun 4; the $1.15 base is still pending (projected ~Jun 7).*

**Note**: Claude Code Max ($200/mo) is the primary development tool, categorized separately as "Development." Operational cost analysis focuses on the live service ($99.65/mo).

**Total Fixed Operational**: $99.65/mo | **Daily Burn Rate**: $3.32/day (June = 30 days)

### Variable / Usage-Based Costs (June 2026 — Day 6)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Regulatory fee) | Posted Jun 4 (balance -$0.24) | **$0.24** | Verified via API (balance drop) |
| Twilio (Phone rental base) | Not yet charged (projected ~Jun 7) | $0.00 | Verified via API (no base charge yet) |
| Twilio (SMS) | 0 messages | $0.00 | Verified via API |
| Twilio (Calls) | 0 minutes | $0.00 | Verified via API |
| ElevenLabs (overage) | 281 chars (well within 300K limit) | $0.00 | Verified via API (current_overage = $0) |
| Stripe (Processing Fees) | 0 charges | $0.00 | — |
| Anthropic (Claude API) | Unknown | Unknown | No API on personal account |
| Voyage AI (Embeddings) | Unknown | Unknown | No dedicated API |
| **Total Variable (June day 6, confirmed)** | | **$0.24** | |

### June 2026 Position (Day 6 of 30)

| Category | Cost |
|----------|------|
| Fixed Operational (accrued, 6 days x $3.32) | ~$19.93 |
| Variable confirmed (Twilio reg fee) | $0.24 |
| **Total Operational (June MTD)** | **~$20.17** |
| Revenue | $0.00 |
| **Net (loss)** | **-$20.17** |

*Projected June close (no growth event): ~$99.65 fixed + $1.39 Twilio rental = ~$101.04 operational, $0.00 revenue.*

### Monthly Cost History

| Month | Operational Fixed | Variable (confirmed) | Total Operational | Revenue (net) | Coverage |
|-------|-------------------|----------------------|-------------------|---------------|----------|
| Feb 2026 | ~$95 (ramping) | ~$2.75 | ~$97.75 | ~$9.98 | ~10.2% |
| Mar 2026 (final) | $99.41 | $1.15 | **$100.56** | **$0.00** | **0%** |
| Apr 2026 (final) | $99.41 | $1.39 | **$100.80** | **$0.00** | **0%** |
| May 2026 (final) | $99.65 | $1.39 | **$101.04** | **$0.00** | **0%** |
| Jun 2026 (day 6) | $99.65 (proj.) | $1.39 (proj.; $0.24 posted) | **~$101.04 (proj.)** | $0.00 (MTD) | 0% |

**Cumulative operational loss since February launch: ~$410.**

---

## Usage Metrics

### ElevenLabs Activity

API queried successfully. Live data:

- **Current cycle**: Started May 8 ~15:07 UTC. Characters used: **281 / 300,000 (0.094%)**. Cycle on day 29 of 30 (97% of cycle elapsed).
- **New activity since Jun 5**: **None.** Character count unchanged at 281 for a third consecutive reading (Jun 4, Jun 5, Jun 6). The conversations endpoint shows no new entries — the most recent remains the Jun 1 13:12 UTC Coach conversation.
- **Paisaxe agents** (Visitor Pelayo, Booking Pelayo, Penny, Iris, Xander): **0 conversations since Feb 17** (109 days). All ElevenLabs activity in the current cycle is the personal "Coach"/"Archy" agents, not Paisaxe.
- **Personal-agent reliability**: The last-10 sample continues to show a high failure rate (~60%) on the Coach/Archy personal agents (custom_llm generation failed / client-disconnect pattern) — a personal-agent integration issue, not Paisaxe.
- Next reset: Jun 7 2026 15:07 UTC (Unix 1780844823 — cycle resets to 0 / 300,000 tomorrow).

### ElevenLabs Conversation Breakdown (Last 10, via API)

| Date | Agent | Status | Call Result | Duration |
|------|-------|--------|-------------|----------|
| 2026-06-01 13:12 UTC | Coach | done | failure | 3s |
| 2026-05-30 06:59 UTC | Coach | **failed** | unknown | 0s |
| 2026-05-29 15:54 UTC | Coach | done | failure | 4s |
| 2026-05-28 16:47 UTC | Coach | **failed** | failure | 34s |
| 2026-04-16 18:44 UTC | Archy | done | success | 75s |
| 2026-04-16 18:41 UTC | Archy | done | success | 16s |
| 2026-04-16 18:22 UTC | Archy | **failed** | failure | 15s |
| 2026-04-16 18:19 UTC | Archy | **failed** | failure | 9s |
| 2026-04-16 18:19 UTC | Archy | **failed** | failure | 16s |
| 2026-04-16 18:04 UTC | Archy | done | success | 77s |

No Paisaxe agent appears anywhere in the last-10 window. The list is byte-identical to the Jun 4 and Jun 5 reports — no change in 48 hours.

### ElevenLabs Subscription Details

| Field | Value |
|-------|-------|
| Tier | Creator |
| Billing period | Annual |
| Status | Active |
| Current cycle start | May 8 ~15:07 UTC |
| Next cycle reset | Jun 7 2026 15:07 UTC (Unix 1780844823) |
| Character limit | 300,000 |
| Characters used (current cycle) | 281 |
| Voice limit | 30 |
| Voice slots used | 0 / 30 |
| Current overage | $0.00 |
| Next annual invoice | $266.20 on 2027-02-07 (Unix 1802012845) |

### Twilio Communications

| Metric | June (day 6) | May 2026 (final) | Change |
|--------|--------------|------------------|--------|
| SMS Sent | 0 (verified) | 0 | flat |
| Calls | 0 (verified) | 0 | flat |
| Regulatory fee | $0.24 (posted Jun 4) | $0.24 (in May charge) | posted |
| Phone Rental base | $0.00 (not yet charged; ~Jun 7) | $1.15 (charged May 7) | pending |
| Balance | **$12.4346** (verified) | $12.6746 (May 31) | **-$0.24 (since May)** |

**Twilio balance reconciliation:**
- May 7 (last full charge): $12.6746 — phone rental + regulatory fee ($1.39 total)
- May 8 – Jun 3: $12.6746 (27 stable days)
- Jun 4: $12.4346 (down $0.24 — June regulatory fee posted)
- Jun 5: $12.4346 (flat)
- Jun 6 (today, verified): **$12.4346** (flat — no new charge in 48 hours)
- Expected next charge: ~Jun 7 (phone rental base $1.15) -> projected balance ~$11.2846
- Runway: $12.4346 / $1.39 = **~8.9 months**

### Stripe Revenue

| Metric | June (day 6) | May 2026 | Apr 2026 | Mar 2026 | Feb 2026 |
|--------|--------------|---------|---------|---------|---------|
| Net Sales | 0 | 0 | 0 | 0 | 6 |
| Net Revenue | $0.00 | $0.00 | $0.00 | $0.00 | $9.98 |

**113-day revenue drought** — No Day Pass sales since Feb 13.

---

## Cost Efficiency

| Metric | Current (Jun 6) | Previous (Jun 5) | Change | Trend |
|--------|------------------|-------------------|--------|-------|
| Fixed operational cost/mo (config) | **$99.65** | $99.65 | flat | flat |
| Daily burn rate (fixed) | **$3.32/day** (June=30d) | $3.32/day | flat | flat |
| Monthly variable spend (projected) | **$1.39** | $1.39 | flat | flat |
| Cost per voice conversation (Feb actuals) | ~$0.43 | ~$0.43 | flat | flat |
| Cost per voice minute (Feb actuals) | ~$0.37 | ~$0.37 | flat | flat |
| ElevenLabs char utilization (current cycle) | **0.094%** | 0.094% | flat | flat |
| ElevenLabs voice min utilization (Paisaxe MTD) | 0% | 0% | flat | flat |
| Revenue coverage (operational) | **0%** | 0% | flat | flat |
| Twilio runway | **~8.9 months** | ~8.9 months | flat | flat |

Every tracked metric is flat day-over-day for a second consecutive cycle — the cycle's quiescent plateau holds. The Twilio runway held at ~8.9 months because no new charge posted in the past 48 hours. Cost-per-chat and cost-per-visitor remain unquantifiable for Paisaxe specifically — no Paisaxe variable usage and no per-project Anthropic billing API. February voice actuals remain the only real per-unit data point.

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Alert Level |
|---------|--------|------|-------|-------------|-------------|
| ElevenLabs | Characters (current cycle) | 281 | 300,000 | **0.094%** | SAFE |
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
| 113-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. Three complete zero-revenue months (Mar, Apr, May), June on the same trajectory. Cumulative operational loss ~$410. |
| 109-day Paisaxe voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Manual production verification of the Pelayo widget and Day Pass flow on paisaxe.es remains the highest-priority outstanding action. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual check required at platform.claude.com/settings/billing. Config estimate $25/mo may be $40-60/mo based on observed credit grant frequency. |

**No new platform cost-structure anomalies.** Day-over-day everything is flat for a second consecutive cycle — no >20% cost increase, no daily spend spike >2x average, no tier-limit proximity, no unexpected new service. The Twilio balance held steady at $12.4346 (no new charge in 48 hours); the $1.15 base rental projected for ~Jun 7 has not yet posted, which is consistent with the documented charge pattern.

**Resolved (carry-forward from earlier cycles):**
- All security advisories — Security agent reports GREEN (0 advisories) as of Jun 5. `npm audit` clean across prod + dev since the May 22 brace-expansion override.
- Twilio recurring-cost config discrepancy ($1.15 -> $1.39) — closed by May 8 triage. The Jun 4 $0.24 fee posting further confirms the $1.39 split is correct in config.
- Stripe `apiVersion` tsc concern (`stripe.ts`) — root-caused (Performance Jun 2-3, Localization Jun 4) as **local node_modules drift** (local 22.1.1 vs lockfile 22.2.0), NOT a develop-branch CI failure. `npm install` resolves it. No pin revert needed. Stand down.

---

## Trend Analysis

### Comparison: Jun 5 (day 5) vs Jun 6 (day 6)

| Metric | Jun 5 | Jun 6 | Change | Direction |
|--------|--------|-------|--------|-----------|
| Variable costs (confirmed MTD) | $0.24 | $0.24 | flat | flat |
| Fixed accrued | ~$16.61 | ~$19.93 | +$3.32 | up (1 day) |
| Daily burn rate (fixed) | $3.32/day | $3.32/day | flat | flat |
| Twilio balance | $12.4346 | **$12.4346** | flat | flat |
| Twilio runway | ~8.9 months | ~8.9 months | flat | flat |
| ElevenLabs chars (current cycle) | 281 / 300,000 | 281 / 300,000 | flat | flat |
| Paisaxe voice silence | 108 days | **109 days** | +1 | down |
| Revenue drought | 112 days | **113 days** | +1 | down |
| Cumulative operational loss | ~$407 | ~$410 | +$3 | down |
| Security advisories | 0 | 0 | flat | flat (GREEN) |

**Key observations:**

1. **Quiescent plateau holds for a second cycle.** Every non-time-driven metric is flat. The Twilio balance held at $12.4346 with no new charge in 48 hours; the $1.15 base rental projected for ~Jun 7 has not yet posted. ElevenLabs characters unchanged at 281 for a third consecutive reading. The only movement is the deterministic +1 day on the two drought counters and the daily fixed-cost accrual.

2. **ElevenLabs cycle resets tomorrow.** No new conversations in 48 hours. The character cycle resets Jun 7 15:07 UTC, returning utilization to 0%. Paisaxe agents at 0 conversations since Feb 17 (109 days). The 281-char cycle total is entirely personal "Coach"/"Archy" usage.

3. **June is on the same zero-revenue trajectory.** Mar, Apr, and May all closed at $0.00 net revenue. June day 6 is $0.00. The pattern is structurally unchanged.

4. **113-day revenue drought.** Just under four months since the last Day Pass sale on Feb 13. Cumulative operational losses since launch reach ~$410.

5. **Bundle-budget breach continues to reinforce the voice-shelving decision (carry-forward, Performance Jun 3-5).** The Performance agent confirmed across two cycles that the real production build is 3,398 KB — a 298 KB breach of the 3,100 KB budget — with the ElevenLabs chunk at **605 KB** (20% of the bundle). On Jun 5 the agent suppressed the pass/fail verdict because `.next` provenance was unverified (a process safeguard, not a resolution); the underlying breach is unchanged. Because that chunk serves 109 days of zero Paisaxe voice traffic, shelving voice / downgrading resolves *both* the cost overhang *and* the bundle breach in one move (removing ~605 KB → ~2,793 KB, back under budget). This continues to strengthen the case for the tier/voice decision below.

6. **Security clean.** Zero outstanding advisories (Security agent GREEN, Jun 5). No cost-affecting CVEs.

---

## Recommendations

### Immediate Actions (Priority)

1. **Investigate the revenue and voice drought — 113 days (P1, CRITICAL).** Three consecutive complete zero-revenue months, June on the same path. Manual checks required on paisaxe.es:
   - Is the Pelayo voice widget rendering and accessible on production?
   - Is the Day Pass purchase flow functional end-to-end?
   - Are Vercel deployment logs showing errors on production?
   - Has organic traffic dropped? (PostHog / Vercel Analytics dashboard)

2. **Tier-downgrade / voice-shelving decision carries a dual benefit (P2, elevated).** The June 1 checkpoint has passed with the drought ongoing, and the Performance agent's Jun 3-5 bundle breach (3,398 KB / 3,100 KB) gives a second reason to act. If no growth event is expected:
   - Vercel Pro ($20/mo) -> Hobby (free, reduced limits).
   - Supabase Pro ($25/mo) -> Free (500MB storage, 50K MAU).
   - Shelving the ElevenLabs voice integration removes the 605 KB chunk and returns the bundle under budget, on top of the cost optimization.
   - Combined potential savings: up to $45/mo (~45% of operational cost) plus the bundle-budget recovery. Caveat: Hobby disallows commercial use and removes per-minute cron precision the agents rely on — weigh against the cron schedule before downgrading Vercel.

3. **Check Anthropic billing manually (P2)** — Visit platform.claude.com/settings/billing. Config estimate is $25/mo; observed credit grant patterns suggest $40-60/mo across all projects. If actual spend is $40+/mo, cumulative loss would be ~$435+.

### Cost Reduction Evaluation

4. **Evaluate Twilio phone number before the ~Jun 7 base charge (P3).** 109 days without a booking call. $1.39/mo actual ($16.68/yr). The $0.24 June fee already posted; the $1.15 base is projected ~Jun 7 (likely tomorrow). Releasing the number before then avoids the June base charge unless bookings are expected to resume. This is a time-sensitive micro-optimization — the window closes within ~24 hours.

5. **ElevenLabs Creator tier correctly sized.** No upgrade pressure. The 281-char personal "Coach" usage is negligible (0.094% of limit) and resets Jun 7. Scale tier ($99/mo) only warranted if sustained Paisaxe voice traffic exceeds 100 min/mo — currently 109 days dormant.

### Long-Term Planning

6. **Revenue trajectory remains structurally unsustainable (P1 escalation).** Three complete zero-revenue months and June continuing. Daily burn: $3.32/day. Break-even requires ~1,200 monthly visitors at 5% Day Pass conversion (currently ~50 visitors). The platform requires a growth event, aggressive cost reduction, or both. With the June checkpoint passed and the bundle over budget, the Vercel Hobby + Supabase Free downgrades plus voice shelving (~$45/mo saved + 605 KB bundle recovery) are the most concrete available levers.

---

## Data Sources

| Source | Method | Last Queried | Status |
|--------|--------|--------------|--------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-06-06 01:05 UTC | Pass (281 chars, reset Jun 7) |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=10` | 2026-06-06 01:05 UTC | Pass (no new conversations; newest Coach Jun 1) |
| ElevenLabs Character Stats API | `/v1/usage/character-stats` | 2026-06-06 01:05 UTC | Requires start_unix/end_unix params; subscription endpoint used for cycle data |
| Twilio Balance API | `/Balance.json` | 2026-06-06 01:05 UTC | Pass ($12.4346, flat) |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json` | 2026-06-06 01:05 UTC | Pass (50 records, 0 non-zero; as_of 2026-06-06 01:00 UTC) |
| Config: `service-tiers.ts` | File read | 2026-06-06 | Pass |
| Config: `recurring-costs.ts` | File read | 2026-06-06 | Pass ($1.39 Twilio, config-aligned) |
| Config: `forecast.ts` | File read | 2026-06-06 | Pass |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | — | Manual check required at platform.claude.com/settings/billing |
| Cross-agent context | Agent shared context | 2026-06-06 | Pass — security GREEN (Jun 5, 0 advisories), performance GREEN-advisory (Jun 5, bundle verdict suppressed; underlying 3,398 KB / 3,100 KB breach + 605 KB ElevenLabs chunk unchanged), localization GREEN x59 (Jun 5) |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-06-07.*

---
