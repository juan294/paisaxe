# Cost Analyst Report

> **Generated**: 2026-05-03 01:02:29 UTC | **Period**: May 2026 (day 3 of 31) | **Status**: WATCH

---

## Executive Summary

**May continues with a zero-revenue baseline.** ElevenLabs character count holds at **13,734 / 270,783 (5.07%)** — unchanged for 17 consecutive days, confirmed via subscription API this run. Most recent conversation across all agents remains Archy on **Apr 16 18:44 UTC — now 16.5 days of full-account silence.** Character reset due **2026-05-07 ~14:36 UTC** (~4.5 days). Cycle utilization will close at 5–6% — well within Creator limits.

**Twilio balance: $14.0646** (unchanged for 26 consecutive days, API confirmed). All May usage records confirmed $0.00 (50 records, 0 non-zero). ~12.2 months of phone runway. Next rental charge expected ~May 7 (-$1.15).

**Revenue drought reaches 79 days** (since Feb 13). **Paisaxe voice silence: 75 days** (since Feb 17). May MTD revenue: $0.00. Cumulative operational loss since Feb 2026: ~**$380**.

**Cross-agent findings incorporated this cycle:**
- Triage (May 2): Performance budgets raised to 2,100 KB initial / 3,100 KB total in `a7fcb23f`. QA harness Origin header fix committed (resolves 3-cycle LLM safety blocker). P4 reclassified — `eventsPerSecond: 0` does NOT tree-shake `@supabase/realtime-js`; tracked in #558.
- Performance GREEN (May 2): Total JS 3,008 KB / 3,100 KB (+92 KB headroom under new budget). Bundle byte-stable since `3163f478`. Production build skipped 8 cycles running — Apr 25 prod baseline (~2,067 KB initial) is the only authoritative initial-load number.
- Security GREEN (May 2): 0 advisories, 0 exploitable. `@anthropic-ai/sdk` GHSA-p7fg-763f-g4gf already patched in `52b8f484` + `3163f478`. License compliance passing. voyageai pinned at 0.1.0 (do not auto-bump).
- Coverage GREEN (May 3): 6394 tests (+490 since Apr 20), 97.07% statements / 93.44% branch. +29 new tests on `stories-tab-panel.test.tsx` lifting it from 47.61% to 96.59% statements.
- Localization GREEN (May 2): 405 leaf keys per locale, 100 stories × 5 target locales = 500 entries complete. 45th consecutive clean run.
- Documentation GREEN (May 2): 20th consecutive clean run. No new gaps.

**Financial health: WATCH** — business concern only. No platform cost-structure anomalies. All tier limits safe.

| Metric | Value | vs. May 2 |
|--------|-------|-----------|
| Total Fixed Costs (all) | $284.41/mo | flat |
| Total Fixed Costs (operational) | **$84.41/mo** | flat |
| Variable Costs (May MTD, confirmed) | **$0.00** | flat |
| Daily Burn Rate (fixed) | **$2.81/day** | flat |
| Revenue (May MTD) | **$0.00** | flat |
| Twilio Balance | **$14.0646** | flat (API confirmed) |
| ElevenLabs Characters | **13,734 / 270,783 (5.07%)** | flat (API confirmed) |
| ElevenLabs Voice Min (Paisaxe, May MTD) | 0.0 / 100 | flat |
| Next Character Reset | **~2026-05-07 14:36 UTC** | ~4.5 days |
| Paisaxe Voice Silence | **75 days** | +1 |
| Revenue Drought | **79 days** | +1 |
| Last ElevenLabs Conversation | Apr 16 18:44 UTC | +16.5 days silence |
| npm audit advisories | **0** | -1 (resolved) |
| Cumulative Operational Loss (est.) | **~$380** | +$3 |

---

## Current Costs — Per-Service Breakdown

### Fixed / Recurring Costs

| Service | Tier | Monthly Cost | % of Operational | Category | Trend |
|---------|------|-------------|-----------------|----------|-------|
| Claude Code Max | Max (20x Pro) | $200.00 | — (dev) | Development | flat |
| Supabase | Pro | $25.00 | 29.6% | Infrastructure | flat |
| ElevenLabs | Creator (annual) | $22.18* | 26.3% | AI / Voice | flat |
| Vercel | Pro | $20.00 | 23.7% | Infrastructure | flat |
| Anthropic Claude | Prepaid credits | $10.00** | 11.8% | AI | flat |
| GitHub Pro | Pro | $4.00 | 4.7% | Infrastructure | flat |
| AWS Domains | — | $2.08 | 2.5% | Infrastructure | flat |
| Twilio Phone Number | — | $1.15*** | 1.4% | Communications | flat |
| PostHog | Free | $0.00 | 0% | Analytics | flat |
| **Total Fixed (all)** | | **$284.41** | | | flat |
| **Total Fixed (operational)** | | **$84.41** | **100%** | | flat |

*\*ElevenLabs Creator billed annually. Effective rate $22.18/mo. Next annual invoice: $266.20 on ~2027-02-07.*

*\*\*Anthropic $10/mo is a config estimate. No billing API on personal account. Manual check required at console.anthropic.com/settings/billing. Daily automated agents plus Claude Code Max development activity likely push actual usage above estimate.*

*\*\*\*Twilio phone rental charged Apr 7: balance dropped $15.2146 → $14.0646 (-$1.15). Next rental due ~May 7.*

**Note**: Claude Code Max ($200/mo) is the primary development tool, categorized separately as "Development." Operational cost analysis focuses on running the live service.

### Variable / Usage-Based Costs (May 2026 — MTD Day 3)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Phone rental) | Pending May 7 charge | $0.00 (MTD) | Balance unchanged |
| Twilio (SMS) | 0 messages | $0.00 | Twilio API (today — 50 records, all $0.00) |
| Twilio (Calls) | 0 minutes | $0.00 | Twilio API (today, confirmed) |
| Stripe (Processing Fees) | 0 charges | $0.00 | — |
| Anthropic (Claude API) | Unknown | Unknown | No API on personal account |
| Voyage AI (Embeddings) | Unknown | Unknown | — |
| **Total Variable (May MTD, confirmed)** | | **$0.00** | |

### May 2026 MTD (Day 3 of 31)

| Category | Cost |
|----------|------|
| Fixed Operational (proportional, 3/31 days) | ~$8.17 |
| Variable (confirmed MTD) | $0.00 |
| **Total Operational (May MTD est.)** | **~$8.17** |
| Revenue | $0.00 |
| **Net (loss MTD)** | **-$8.17** |

### Monthly Cost History (reference)

| Month | Operational Fixed | Variable (confirmed) | Total Operational | Revenue (net) | Coverage |
|-------|------------------|----------------------|-------------------|---------------|----------|
| Feb 2026 | $84.41 | ~$2.75 | ~$87.16 | ~$9.98 | ~11.4% |
| Mar 2026 (final) | $84.41 | $1.15 | **$85.56** | **$0.00** | **0%** |
| Apr 2026 (final) | $84.41 | $1.15 | **$85.56** | **$0.00** | **0%** |
| May 2026 (MTD day 3) | $84.41 (proj) | $0.00 (confirmed) | proj. ~$85.56 | $0.00 | 0% |

---

## Usage Metrics

### ElevenLabs Activity — Current Cycle (Apr 7 14:36 UTC → May 7 ~14:36 UTC)

**Last 12 conversations across the account (API confirmed — no new activity since Apr 16 18:44 UTC):**

| Time (UTC) | Agent | Status | Notes |
|------------|-------|--------|-------|
| Apr 16 18:44 | Archy | success | Most recent on entire account |
| Apr 16 18:41 | Archy | success | |
| Apr 16 18:22 | Archy | **failed** | custom_llm generation failed |
| Apr 16 18:19 | Archy | **failed** | custom_llm generation failed |
| Apr 16 18:19 | Archy | **failed** | custom_llm generation failed |
| Apr 16 18:04 | Archy | success | |
| Apr 16 18:02 | Archy | success | |
| Apr 16 17:35 | Archy | success | |
| Apr 12 07:59 | Archy | **failed** | custom_llm generation failed |
| Apr 11 16:50 | Archy | **failed** | LLM response took too long |
| Apr 11 06:38 | Coach | success | |
| Apr 11 06:12 | Archy | **failed** | LLM response took too long |

**Summary (last 12 observed):**
- Archy: 11 (6 success, 5 failed — 45% failure rate, unchanged from May 2)
- Coach: 1 (success)
- Pelayo (Visitor Guide): 0 — dormant since Feb 17
- Pelayo (Booking): 0 — dormant since Feb 10
- Penny, Iris, Xander: 0 — never used

**All conversations are non-Paisaxe.** Paisaxe agents: **0 conversations since Feb 17 (75 days).**

Full-account silence: **16.5 days** (no activity from any agent since Apr 16 18:44 UTC).

### ElevenLabs Character Usage

| Metric | Value | vs. May 2 |
|--------|-------|-----------|
| Characters used (cycle) | **13,734 / 270,783 (5.07%)** | flat (API confirmed) |
| Character limit | **270,783** | flat |
| Next character reset | **~2026-05-07 14:36 UTC** | ~4.5 days |
| Characters used (May MTD, Paisaxe) | 0 | flat |
| Characters remaining this cycle | **257,049** | flat |

**Cycle utilization projection (May 3):**
- Cycle start: Apr 7 14:36 UTC. Days elapsed: ~25.5 days.
- Cycle-average rate: ~539/day (declining; 17 consecutive zero days Apr 17 → May 3).
- If zero activity continues through reset: cycle ends at **5.07%**.
- Conservative estimate (~539/day × 4.5 days remaining): +2,425 = ~16,159 = **~5.97%**.
- Likely outcome: 5–6% — well within Creator limit (270,783 chars).

### ElevenLabs Subscription Details (API confirmed this run)

| Field | Value |
|-------|-------|
| Tier | Creator |
| Billing period | Annual |
| Status | Active |
| Next character reset | **~2026-05-07 14:36 UTC** |
| Character limit | **270,783** |
| Voice limit | 30 |
| Current overage | $0.00 |

### Twilio Communications

| Metric | May MTD (day 3) | Apr 2026 (final) | Change |
|--------|------------------|-----------------|--------|
| SMS Sent | 0 | 0 | flat |
| Calls | 0 | 0 | flat |
| Usage Cost | $0.00 | $0.00 | flat |
| Phone Rental | Pending ~May 7 | $1.15 (Apr 7) | -- |
| Balance | **$14.0646** | $14.0646 | flat |

**Twilio balance reconciliation (May, MTD day 3):**
- May 1 (start): $14.0646 (carried from April 30)
- May 1-3: $0.00 usage confirmed (50 records, all zero)
- **May 3 (today): $14.0646** — stable for 26 consecutive days. Next phone rental charge expected ~May 7.

### Stripe Revenue

| Metric | May MTD (day 3) | Apr 2026 (final) | Mar 2026 (final) | Feb 2026 (final) |
|--------|------------------|-----------------|-----------------|-----------------|
| Net Sales | 0 | 0 | 0 | 6 |
| Gross Revenue | $0.00 | $0.00 | $0.00 | $13.93 |
| Net Revenue | $0.00 | $0.00 | $0.00 | $9.98 |

**79-day revenue drought** — No Day Pass sales since Feb 13. May continues on the same trajectory as the closed April month.

---

## Cost Efficiency

| Metric | Current (May 3) | Previous (May 2) | Change | Trend |
|--------|----------------|------------------|--------|-------|
| Fixed operational cost/mo | $84.41 | $84.41 | flat | flat |
| Daily burn rate (fixed) | **$2.81/day** | $2.81/day | flat | flat |
| Monthly variable spend (MTD confirmed) | **$0.00** | $0.00 | flat | flat |
| Cost per voice conversation (Feb actuals) | ~$0.43 | ~$0.43 | flat | flat |
| Cost per voice minute (Feb actuals) | ~$0.37 | ~$0.37 | flat | flat |
| ElevenLabs char utilization (cycle) | **5.07%** | 5.07% | flat (17-day freeze) | flat |
| ElevenLabs voice min utilization (Paisaxe, MTD) | 0% | 0% | flat | flat |
| Revenue coverage (operational) | **0%** | 0% | flat | flat |
| Months of Twilio runway | ~12.2 mo | ~12.2 mo | flat | flat |
| Cumulative operational loss (Feb–May 3) | **~$380** | ~$377 | +$3 | down |

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Alert Level |
|---------|--------|------|-------|-------------|-------------|
| ElevenLabs | Characters (cycle) | 13,734 | 270,783 | **5.07%** | SAFE |
| ElevenLabs | Voice Minutes (Paisaxe, May MTD) | 0.0 | 100 | **0%** | SAFE |
| Vercel | Monthly Visitors | ~low | 500,000 (Pro) | **<1%** | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | SAFE |

**All tier alerts cleared.** Current cycle on track for 5–6% utilization. Character reset in ~4.5 days (May 7) begins the new cycle.

### Upgrade Trigger Points

| Service | Current Tier | Trigger | Next Tier | Cost Jump |
|---------|-------------|---------|-----------|-----------|
| ElevenLabs | Creator ($22.18/mo eff.) | >100 min/mo | Scale ($99/mo) | +$77/mo |
| Supabase | Pro ($25/mo) | >8 GB storage | Team ($599/mo) | +$574/mo |
| PostHog | Free ($0) | >1M events/mo | Pay-as-you-go | Variable |

---

## Scaling Forecast

Based on `src/lib/costs/forecast.ts` logic. No May Paisaxe variable data; using February 2026 actuals as baseline with fallback per-unit costs.

**Per-unit costs (fallback — no May production data):**
- Cost per voice minute: ~$0.08 (ElevenLabs overage fallback rate)
- Cost per chat: ~$0.01 (Claude API estimate fallback)

| Scenario | Visitors/mo | Voice Convos/mo | Voice Min/mo | Est. Monthly Cost (operational) |
|----------|------------|----------------|-------------|--------------------------------|
| **Current (1x)** | ~50 | ~0 (dormant) | ~0 (dormant) | ~$85.56 |
| **3x Growth** | ~150 | ~150 | ~180 | ~$170* |
| **10x Growth** | ~500 | ~500 | ~600 | ~$370** |

*\*At 3x: Voice minutes (180) exceed Creator limit (100 min). Requires Scale tier ($99/mo). Total: ~$52 infra + $10 AI + $99 voice + ~$5 SMS = ~$170.*

*\*\*At 10x: Voice at 600 min/mo exceeds Scale tier (500 min). Requires Enterprise pricing. Estimated $200+ for voice alone.*

### Cost Forecast vs. Revenue Potential

| Scenario | Monthly Cost (op.) | Day Passes Needed to Break Even | Revenue at 5% Conversion |
|----------|-------------------|--------------------------------|--------------------------|
| Current (~50 visitors) | ~$85 | 52 passes | ~$4.10 (2.5 passes) |
| 500 visitors | ~$170 | 104 passes | ~$42.75 (25 passes) |
| 5,000 visitors | ~$370 | 226 passes | ~$427.50 (250 passes) |

*Break-even: ~3,150 monthly visitors at 5% Day Pass conversion rate (~$1.64 net/pass after Stripe fees).*

---

## Anomalies

| Finding | Severity | Details |
|---------|----------|---------|
| 79-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. Three consecutive zero-revenue months locked in (Mar, Apr, May trajectory). Cumulative operational loss ~$380. |
| 75-day Paisaxe voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Platform dormant to visitors for over 2.5 months. |
| ElevenLabs full-account silence (16.5 days) | **WATCH** | No conversations on any agent since Apr 16 18:44 UTC. Character count frozen at 13,734 for 17 consecutive days (Apr 17 → May 3). Reset in ~4.5 days. |
| Archy failure rate elevated | **WATCH** | 5/12 (45%) failures in last 12 observed conversations. All failures: "custom_llm generation failed" or "LLM response took too long". Non-Paisaxe; no new data since Apr 16 (16.5-day silence). |
| Twilio $0.24 drop (Apr 3-4, unresolved) | **WATCH** | Balance anomaly not captured in Usage Records API. Likely recurring regulatory surcharge. Now 30 days unresolved. Watch May 3-4 today/tomorrow for repeat — confirms pattern. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Daily automated agents (security, coverage, performance, cost-analyst, localization, docs, QA, triage) plus Claude Code Max development likely push actual usage above $10/mo estimate. |

**No platform cost-structure anomalies.** All tier limits safe.

**Resolved since May 2 report:**
- Performance budget breach: triage `a7fcb23f` raised budgets to 2,100 KB initial / 3,100 KB total — current 3,008 KB total now within budget (+92 KB headroom).
- QA harness Origin header gap: triage `a7fcb23f` committed the one-line fix in `src/tests/qa/llm-quality.test.ts`. Next QA run should recover to 12/12 LLM safety tests.
- `@anthropic-ai/sdk` GHSA-p7fg-763f-g4gf advisory: patched in `52b8f484` + `3163f478`. Security agent reports 0 advisories.

---

## Trend Analysis

### Comparison: May 2 → May 3

| Metric | May 2 | May 3 | Change | Direction |
|--------|-------|-------|--------|-----------|
| Fixed costs/mo (operational) | $84.41 | $84.41 | flat | flat |
| Variable costs (MTD confirmed) | $0.00 | $0.00 | flat | flat |
| Daily burn rate (fixed) | $2.81/day | $2.81/day | flat | flat |
| ElevenLabs characters (cycle) | 13,734 (5.07%) | **13,734 (5.07%)** | 0 | flat |
| Most recent ElevenLabs convo | Apr 16 18:44 UTC | **Apr 16 18:44 UTC** | +1 day silence | flat |
| Full-account silence duration | 15.5 days | **16.5 days** | +1.0 day | worsening |
| Days to ElevenLabs reset | ~5.5 days | **~4.5 days** | -1.0 day | approaching |
| Archy failure rate (last 12) | 5/12 (45%) | **5/12 (45%)** | flat | flat |
| Paisaxe voice conversations (MTD) | 0 (May) | 0 (May) | flat | flat |
| Twilio balance | $14.0646 | $14.0646 | flat (API confirmed) | flat |
| SMS sent (MTD) | 0 | 0 | flat | flat |
| Day Pass net sales (MTD) | 0 | 0 | flat | flat |
| Paisaxe voice dormancy streak | 74 days | **75 days** | +1 | down |
| Revenue drought streak | 78 days | **79 days** | +1 | down |
| Cumulative operational loss | ~$377 | **~$380** | +$3 | down |
| npm audit advisories | 1 moderate (0 exploitable) | **0** | -1 | resolved |
| Performance status | RED (May 1) | **GREEN (May 2 under raised budget)** | recovered | up |
| Total JS budget headroom | -8 KB | **+92 KB** (under new 3,100 KB budget) | +100 KB | up |

**Key observations:**

1. **May continues on the same trajectory.** Day 3 of the new cycle: $0 revenue, $0.00 confirmed variable spend, fixed-cost burn proceeding at $2.81/day. No structural change to the cost picture.

2. **ElevenLabs full-account silence now at 16.5 days.** Character count locked at 13,734 for 17 consecutive days. The cycle resets in ~4.5 days (May 7). New May 7 cycle begins with a clean counter and provides the first meaningful signal for any voice activity that begins in May.

3. **Performance status recovered after triage `a7fcb23f`.** Total budget raised 3,000 → 3,100 KB and initial-load budget raised 2,000 → 2,100 KB to reflect structural growth since the Apr 4 baseline. Current bundle (3,008 KB total) sits at +92 KB headroom under the new budget. P4 Supabase tree-shake reclassified — `eventsPerSecond: 0` does NOT tree-shake `@supabase/realtime-js`; tracked in #558. No code-only path to ~25 KB savings; new approach requires using `@supabase/auth-js` directly or lazy-loading the full Supabase client.

4. **Security clean.** 0 advisories, 0 exploitable. The `@anthropic-ai/sdk` Local Filesystem Memory advisory was patched in `52b8f484` + `3163f478`. License compliance passing. voyageai remains pinned at 0.1.0 (do not auto-bump).

5. **QA harness fix committed** (`a7fcb23f`). LLM safety test coverage should recover to 12/12 on the next QA run after 3 blocked cycles. Production CSRF enforcement is unchanged and correct.

6. **Coverage suite at all-time-high test count.** 6394 tests (+490 since Apr 20). 97.07% statements / 93.44% branch — all vitest thresholds passing. Coverage agent added 29 new tests on `stories-tab-panel.test.tsx` lifting it from 47.61% to 96.59% statements.

7. **Revenue and voice drought still unexplained.** No automated diagnostic has identified a root cause across 79 and 75 days respectively. Manual production verification of Pelayo widget and Day Pass flow on paisaxe.es remains the outstanding action.

---

## Recommendations

### Immediate Actions (Priority)

1. **Investigate the revenue and voice drought — 79 days is past critical threshold (P1)** — Three consecutive zero-revenue months locked in (Mar, Apr final, May trajectory). Manual checks required:
   - Is the Pelayo voice widget rendering and accessible on production (paisaxe.es)?
   - Is the Day Pass purchase flow functional end-to-end?
   - Are Vercel deployment logs showing errors on production?
   - Has organic traffic dropped? (PostHog / Vercel Analytics)

2. **Watch Twilio May 3-4 today and tomorrow for $0.24 anomaly recurrence (P2)** — Apr 3-4 saw a $0.24 balance drop not captured by the Usage Records API (now 30 days unresolved). If a similar drop hits May 3-4, the pattern is confirmed as a recurring monthly regulatory surcharge — update `src/config/recurring-costs.ts` Twilio cost from $1.15 to ~$1.39/mo.

3. **Check Anthropic billing manually (P2)** — Visit console.anthropic.com/settings/billing. Daily automated agents plus Claude Code Max development activity likely push actual Anthropic API usage above the $10/mo config estimate. This remains the single largest unmonitored cost surface.

4. **Run a fresh production build before next performance cycle (P3)** — Performance agent has skipped production builds for 8 cycles; the Apr 25 prod baseline (~2,067 KB initial) is the only authoritative initial-load number. `rm -rf .next && npm run build` will produce a current baseline and classify the still-unknown chunk 7 (`10e1-kbfg7iqw.js`, 122 KB).

### Cost Reduction Evaluation

5. **Evaluate Twilio phone number (P3)** — 75 days without a booking call. $1.15/mo unused. Next billing ~May 7. Consider releasing the number unless bookings are expected to resume imminently. ~$14–17/yr savings.

6. **Review Vercel Pro and Supabase Pro if drought continues into May (P3)** — At current scale (~50 visitors/mo), both Pro tiers may be overprovisioned:
   - Vercel Pro ($20/mo) — Hobby tier is free for personal projects.
   - Supabase Pro ($25/mo) — Free tier includes 500MB storage and 50K monthly active users.
   - Combined potential savings: up to $45/mo (~53% of operational costs).

### Long-Term Planning

7. **Revenue trajectory has crossed a multi-month threshold** — Three consecutive near-zero or zero-revenue months. Cumulative operational loss since Feb 2026: ~$380. At $84.41/mo operational with $0 revenue: $2.81/day in losses. Break-even requires ~3,150 monthly visitors at 5% Day Pass conversion — 63x current traffic. The platform requires either a growth event or cost reduction to achieve sustainability.

8. **ElevenLabs remains well-sized** — Creator tier at $22.18/mo effective (annual). Current cycle on track for 5–6% utilization. Scale tier ($99/mo) only warranted if sustained Paisaxe voice traffic exceeds 100 min/mo — currently at 0 min.

9. **May 7 cycle reset is the next signal** — ElevenLabs character counter resets May 7 ~14:36 UTC. The new cycle provides a clean counter for any voice activity that begins in May. Track Pelayo conversations from the reset date to distinguish May traffic from the 75-day dormancy period.

---

## Data Sources

| Source | Method | Last Queried | Status |
|--------|--------|-------------|--------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-05-03 01:02 UTC | OK — character_count 13,734 confirmed, reset timestamp confirmed |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=20` | 2026-05-03 01:02 UTC | OK — 20 conversations retrieved; most recent Apr 16 18:44 UTC (16.5-day silence) |
| ElevenLabs Character Stats | `/v1/usage/character-stats` | 2026-05-03 01:02 UTC | Subscription API used as authoritative source for character_count and limit |
| Twilio Balance API | `/Balance.json` | 2026-05-03 01:02 UTC | OK — $14.0646 confirmed |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json` | 2026-05-03 01:02 UTC | OK — 50 records retrieved; 0 non-zero records confirmed |
| Config: `service-tiers.ts` | File read | 2026-05-03 | OK |
| Config: `recurring-costs.ts` | File read | 2026-05-03 | OK |
| Config: `forecast.ts` | File read | 2026-05-03 | OK |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | — | Manual check required at console.anthropic.com/settings/billing |
| Cross-agent context | Agent shared context | 2026-05-03 | OK — May 2 / May 3 reports incorporated |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-05-04.*

---
