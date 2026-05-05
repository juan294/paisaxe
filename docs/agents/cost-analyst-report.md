# Cost Analyst Report

> **Generated**: 2026-05-05 03:00 UTC | **Period**: May 2026 (day 5 of 31) | **Status**: WATCH

---

## Executive Summary

**May continues with a zero-revenue, zero-variable-spend baseline.** ElevenLabs character count holds at **13,734 / 270,783 (5.07%)** — unchanged for 19 consecutive days (Apr 17 through May 5), confirmed via subscription API. Most recent conversation across the entire account remains Archy on **Apr 16 18:44 UTC — now 18.5 days of full-account silence.** Character reset due **2026-05-07 ~14:36 UTC (~2.6 days from now).** Cycle utilization will close at 5.07% — well within Creator limits.

**Twilio balance: $14.0646** (unchanged, API confirmed). All May usage records $0.00 (50 records, 0 non-zero). ~12.2 months of phone runway. Next rental charge expected ~May 7 (-$1.15), coinciding with the ElevenLabs cycle reset.

**Revenue drought reaches 81 days** (since Feb 13). **Paisaxe voice silence: 77 days** (since Feb 17). May MTD revenue: $0.00. Cumulative operational loss since Feb 2026: ~**$386**.

**Cross-agent findings incorporated (May 4-5 runs):**
- Coverage (May 5): 6,520 tests passing, 0 failures. IPv6 SSRF paths and logger.ts now at 100% coverage. Overall: 98.08% stmts / 94.30% branch (up from 97.07% / 93.44% on May 3).
- Triage (May 4): Completed 6 code/test items, fresh production build confirmed. Performance baseline now current.
- Performance (May 4): Fresh prod build. Total 2,999 / 3,100 KB (+101 KB headroom). Initial load 2,067 / 2,100 KB. Chunk 7 classification still pending (122 KB, hash rotated).
- Security (May 4): GREEN — 0 advisories, 0 exploitable. 10th consecutive GREEN. voyageai pinned at 0.1.0 (do not include in any dep batch).
- Localization (May 4): 100% — 406 leaf keys per locale, 100 stories x 5 locales complete. 44th consecutive clean.
- Documentation (May 4): GREEN — 20th consecutive clean run.
- QA (May 3): YELLOW — 11/12 LLM tests (hallucination regex miss, not model failure), safety 3/3 Pass. Journey webServer timeout blocked Playwright run.

**Financial health: WATCH** — business concern only. No platform cost-structure anomalies. All tier limits safe. May 7 cycle reset is the next material ElevenLabs event.

| Metric | Value | vs. May 4 |
|--------|-------|-----------|
| Total Fixed Costs (all) | $284.41/mo | flat |
| Total Fixed Costs (operational) | **$84.41/mo** | flat |
| Variable Costs (May MTD, confirmed) | **$0.00** | flat |
| Daily Burn Rate (fixed) | **$2.81/day** | flat |
| Revenue (May MTD) | **$0.00** | flat |
| Twilio Balance | **$14.0646** | flat (API confirmed) |
| ElevenLabs Characters | **13,734 / 270,783 (5.07%)** | flat (API confirmed) |
| ElevenLabs Voice Min (Paisaxe, May MTD) | 0.0 / 100 | flat |
| Next Character Reset | **2026-05-07 ~14:36 UTC** | ~2.6 days |
| Paisaxe Voice Silence | **77 days** | +1 |
| Revenue Drought | **81 days** | +1 |
| Last ElevenLabs Conversation | Apr 16 18:44 UTC | +18.5 days silence |
| ElevenLabs Character Freeze | **19 consecutive days** | +1 |
| Twilio Phone Rental Due | **~May 7** | -2 days |
| npm audit advisories | **0** | flat |
| Cumulative Operational Loss (est.) | **~$386** | +$3 |

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

*\*ElevenLabs Creator billed annually. Effective rate $22.18/mo. Next annual invoice: $266.20 on ~2027-02-07 (API confirmed: next_payment_attempt_unix 1802012845).*

*\*\*Anthropic $10/mo is a config estimate. No billing API on personal account. Manual check required at platform.claude.com/settings/billing. Daily automated agents plus Claude Code Max development likely push actual usage above this estimate.*

*\*\*\*Twilio phone rental. Last charge Apr 7: balance $15.2146 -> $14.0646 (-$1.15). Next charge due ~May 7 (coincides with ElevenLabs character reset).*

**Note**: Claude Code Max ($200/mo) is the primary development tool, categorized separately as "Development." Operational cost analysis focuses on running the live service.

### Variable / Usage-Based Costs (May 2026 — MTD Day 5)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Phone rental) | Pending ~May 7 charge | $0.00 (MTD) | Balance $14.0646 (API confirmed) |
| Twilio (SMS) | 0 messages | $0.00 | Twilio API (50 records, all $0.00) |
| Twilio (Calls) | 0 minutes | $0.00 | Twilio API (confirmed) |
| Stripe (Processing Fees) | 0 charges | $0.00 | — |
| Anthropic (Claude API) | Unknown | Unknown | No API on personal account |
| Voyage AI (Embeddings) | Unknown | Unknown | — |
| **Total Variable (May MTD, confirmed)** | | **$0.00** | |

### May 2026 MTD (Day 5 of 31)

| Category | Cost |
|----------|------|
| Fixed Operational (proportional, 5/31 days) | ~$13.62 |
| Variable (confirmed MTD) | $0.00 |
| **Total Operational (May MTD est.)** | **~$13.62** |
| Revenue | $0.00 |
| **Net (loss MTD)** | **-$13.62** |

### Monthly Cost History (reference)

| Month | Operational Fixed | Variable (confirmed) | Total Operational | Revenue (net) | Coverage |
|-------|------------------|----------------------|-------------------|---------------|----------|
| Feb 2026 | $84.41 | ~$2.75 | ~$87.16 | ~$9.98 | ~11.4% |
| Mar 2026 (final) | $84.41 | $1.15 | **$85.56** | **$0.00** | **0%** |
| Apr 2026 (final) | $84.41 | $1.15 | **$85.56** | **$0.00** | **0%** |
| May 2026 (MTD day 5) | $84.41 (proj) | $0.00 (confirmed, +$1.15 due ~May 7) | proj. ~$85.56 | $0.00 | 0% |

---

## Usage Metrics

### ElevenLabs Activity — Current Cycle (Apr 7 14:36 UTC through May 7 ~14:36 UTC)

**20 most recent conversations (API confirmed — no new activity since Apr 16 18:44 UTC):**

| Time (UTC) | Agent | Status | Notes |
|------------|-------|--------|-------|
| Apr 16 18:44 | Archy | success | Most recent on entire account; 18.5 days ago |
| Apr 16 18:41 | Archy | success | |
| Apr 16 18:22 | Archy | **failed** | custom_llm generation failed |
| Apr 16 18:19 | Archy | **failed** | custom_llm generation failed |
| Apr 16 18:19 | Archy | **failed** | custom_llm generation failed |
| Apr 16 18:04 | Archy | success | |
| Apr 16 18:02 | Archy | success | |
| Apr 16 17:35 | Archy | success | |
| Apr 12 07:59 | Archy | **failed** | custom_llm generation failed |
| Apr 11 16:50 | Archy | **failed** | LLM response took too long |
| Apr 11 06:38 | Coach | success | Active Recovery Workout Plan |
| Apr 11 06:12 | Archy | **failed** | LLM response took too long |
| Apr 10 (x2) | Archy | success | Summon project queries |
| Apr 10 (x2) | Archy | success | CALPHA project queries |
| Apr 10 (x3) | Archy | success | Kalpha/Summon queries |
| Apr 8 (x2) | Archy | success | Summon project queries |

**Summary (last 20 observed):**
- Archy: 19 (13 success, 6 failed — 30% failure rate overall; 6/12 = 50% in most recent 12)
- Coach: 1 (success)
- Pelayo (Visitor Guide): 0 — dormant since Feb 17
- Pelayo (Booking): 0 — dormant since Feb 10
- Penny, Iris, Xander: 0 — never used

**All conversations are non-Paisaxe.** Paisaxe agents: **0 conversations since Feb 17 (77 days).**

Full-account silence: **18.5 days** (no activity from any agent since Apr 16 18:44 UTC).
Character freeze: **19 consecutive zero-change days** (Apr 17 through May 5).

### ElevenLabs Character Usage

| Metric | Value | vs. May 4 |
|--------|-------|-----------|
| Characters used (cycle) | **13,734 / 270,783 (5.07%)** | flat (API confirmed) |
| Character limit | **270,783** | flat |
| Next character reset | **2026-05-07 ~14:36 UTC** | ~2.6 days |
| Characters used (May MTD, Paisaxe) | 0 | flat |
| Characters remaining this cycle | **257,049** | flat |

**Cycle utilization projection (May 5):**
- Cycle start: Apr 7 14:36 UTC. Days elapsed: ~27.5 of 30 days in cycle.
- Characters added in last 19 days: 0. Cycle will close at exactly **5.07%** (13,734 chars).
- Well within Creator limit (100% = 270,783 chars).

### ElevenLabs Subscription Details (API confirmed this run)

| Field | Value |
|-------|-------|
| Tier | Creator |
| Billing period | Annual |
| Status | Active |
| Next character reset | **2026-05-07 ~14:36 UTC** (~2.6 days) |
| Character limit | **270,783** |
| Voice limit | 30 |
| Current overage | $0.00 |
| Next invoice | $266.20 on ~2027-02-07 |

### Twilio Communications

| Metric | May MTD (day 5) | Apr 2026 (final) | Change |
|--------|-----------------|-----------------|--------|
| SMS Sent | 0 | 0 | flat |
| Calls | 0 | 0 | flat |
| Usage Cost | $0.00 | $0.00 | flat |
| Phone Rental | Pending ~May 7 (-$1.15) | $1.15 (Apr 7) | pending |
| Balance | **$14.0646** | $14.0646 | flat (API confirmed) |

**Twilio balance reconciliation (May, MTD day 5):**
- May 1 (start): $14.0646 (carried from April 30)
- May 1-5: $0.00 usage confirmed (50 records, all zero)
- **May 5 (today): $14.0646** — stable for 28 consecutive days.
- Next phone rental charge expected ~May 7 (-$1.15 -> balance ~$12.9146).

### Stripe Revenue

| Metric | May MTD (day 5) | Apr 2026 (final) | Mar 2026 (final) | Feb 2026 (final) |
|--------|-----------------|-----------------|-----------------|-----------------|
| Net Sales | 0 | 0 | 0 | 6 |
| Gross Revenue | $0.00 | $0.00 | $0.00 | $13.93 |
| Net Revenue | $0.00 | $0.00 | $0.00 | $9.98 |

**81-day revenue drought** — No Day Pass sales since Feb 13. May continuing on the same trajectory as the closed March and April months.

---

## Cost Efficiency

| Metric | Current (May 5) | Previous (May 4) | Change | Trend |
|--------|----------------|-----------------|--------|-------|
| Fixed operational cost/mo | $84.41 | $84.41 | flat | flat |
| Daily burn rate (fixed) | **$2.81/day** | $2.81/day | flat | flat |
| Monthly variable spend (MTD confirmed) | **$0.00** | $0.00 | flat | flat |
| Cost per voice conversation (Feb actuals) | ~$0.43 | ~$0.43 | flat | flat |
| Cost per voice minute (Feb actuals) | ~$0.37 | ~$0.37 | flat | flat |
| ElevenLabs char utilization (cycle) | **5.07%** | 5.07% | flat (19-day freeze) | flat |
| ElevenLabs voice min utilization (Paisaxe, MTD) | 0% | 0% | flat | flat |
| Revenue coverage (operational) | **0%** | 0% | flat | flat |
| Months of Twilio runway | ~12.2 mo | ~12.2 mo | flat | flat |
| Cumulative operational loss (Feb-May 5) | **~$386** | ~$383 | +$3 | down |

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Alert Level |
|---------|--------|------|-------|-------------|-------------|
| ElevenLabs | Characters (cycle) | 13,734 | 270,783 | **5.07%** | SAFE |
| ElevenLabs | Voice Minutes (Paisaxe, May MTD) | 0.0 | 100 | **0%** | SAFE |
| Vercel | Monthly Visitors | ~low | 500,000 (Pro) | **<1%** | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | SAFE |

**All tier alerts cleared.** Current cycle on track for exactly 5.07% utilization (19-day zero-activity run). Character reset in ~2.6 days (May 7) begins the new cycle — the first with a clean counter since early April.

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
| 81-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. Three consecutive zero-revenue months locked (Mar, Apr, May trajectory). Cumulative operational loss ~$386. |
| 77-day Paisaxe voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Platform dormant to visitors for over 2.5 months. Manual production verification of Pelayo widget and Day Pass flow remains the highest-priority outstanding action. |
| ElevenLabs full-account silence (18.5 days) | **WATCH** | No conversations on any agent since Apr 16 18:44 UTC. Character count frozen at 13,734 for 19 consecutive days. Cycle reset in ~2.6 days (May 7) will start a fresh counter. |
| Archy failure rate elevated | **WATCH** | 6/20 (30%) failures overall; 6/12 (50%) in most recent 12. All "custom_llm generation failed" or "LLM response too long." Non-Paisaxe; no new data since Apr 16 (18.5-day silence). |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Daily automated agents plus Claude Code Max development activity likely push actual usage above $10/mo estimate. Check at platform.claude.com/settings/billing. |

**No platform cost-structure anomalies.** All tier limits safe. Previous cycle's Twilio $0.24 anomaly watch: RESOLVED (confirmed non-recurring — watch closed May 4).

---

## Trend Analysis

### Comparison: May 4 -> May 5

| Metric | May 4 | May 5 | Change | Direction |
|--------|-------|-------|--------|-----------|
| Fixed costs/mo (operational) | $84.41 | $84.41 | flat | flat |
| Variable costs (MTD confirmed) | $0.00 | $0.00 | flat | flat |
| Daily burn rate (fixed) | $2.81/day | $2.81/day | flat | flat |
| ElevenLabs characters (cycle) | 13,734 (5.07%) | **13,734 (5.07%)** | 0 | flat |
| ElevenLabs character freeze | 18 days | **19 days** | +1 | flat |
| Most recent ElevenLabs convo | Apr 16 18:44 UTC | **Apr 16 18:44 UTC** | +1 day silence | flat |
| Full-account silence duration | 17.3 days | **18.5 days** | +1.2 days | flat |
| Days to ElevenLabs reset | ~3.6 days | **~2.6 days** | -1.0 day | approaching |
| Archy failure rate (last 20) | 6/20 (30%) | **6/20 (30%)** | flat (no new data) | flat |
| Paisaxe voice conversations (MTD) | 0 | 0 | flat | flat |
| Twilio balance | $14.0646 | $14.0646 | flat (API confirmed) | flat |
| SMS sent (MTD) | 0 | 0 | flat | flat |
| Day Pass net sales (MTD) | 0 | 0 | flat | flat |
| Paisaxe voice dormancy streak | 76 days | **77 days** | +1 | down |
| Revenue drought streak | 80 days | **81 days** | +1 | down |
| Cumulative operational loss | ~$383 | **~$386** | +$3 | down |

**Key observations:**

1. **May 5 is structurally identical to May 4.** Another day of $0 revenue, $0.00 confirmed variable spend, fixed-cost burn at $2.81/day. The cost picture has been completely static since Apr 17.

2. **ElevenLabs cycle reset in 2.6 days.** The character counter resets May 7 ~14:36 UTC. This is the single most significant event on the near-term cost horizon. The new cycle will provide a clean counter for any Paisaxe voice activity. Twilio phone rental is also expected ~May 7 (-$1.15).

3. **Coverage agent achieved meaningful gains (May 5).** 6,520 tests passing, 98.08% statements / 94.30% branch. IPv6 SSRF tests and logger.ts both reached 100%. No cost impact.

4. **Performance agent confirmed fresh prod build (May 4).** Total JS 2,999/3,100 KB (+101 KB headroom), initial load 2,067/2,100 KB. Triage completed 6 action items including the production build that was overdue for 9 cycles. No cost impact.

5. **Security remains GREEN (May 4, 10th consecutive).** 0 advisories. voyageai pinned at 0.1.0 — do not include in any dep batch (v0.2.x ESM build breaks embeddings pipeline).

6. **Revenue and voice drought still unexplained at 81/77 days.** No automated diagnostic has identified a root cause. Manual production verification remains the outstanding action.

---

## Recommendations

### Immediate Actions (Priority)

1. **Investigate the revenue and voice drought — 81 days is critically overdue (P1).** Three consecutive zero-revenue months locked (Mar, Apr final, May trajectory). Manual checks required:
   - Is the Pelayo voice widget rendering and accessible on production (paisaxe.es)?
   - Is the Day Pass purchase flow functional end-to-end?
   - Are Vercel deployment logs showing errors on production?
   - Has organic traffic dropped? (PostHog / Vercel Analytics dashboard)
   - QA agent (Apr 29-May 3) confirmed journey tests pass in E2E — the issue is likely upstream of the application (traffic, discoverability, widget visibility, or a production-only configuration gap).

2. **Check Anthropic billing manually (P2)** — Visit platform.claude.com/settings/billing. Daily automated agents plus Claude Code Max development activity likely push actual Anthropic API usage significantly above the $10/mo config estimate. This remains the single largest unmonitored cost surface. The memory records recent grant amounts ($30-$60 per grant) suggesting actual usage may be $40-60/mo across all projects.

3. **Expand QA hallucination resistance regex (P2)** — QA agent May 3 identified a one-line fix in `src/tests/qa/llm-quality.test.ts:122` to expand `declines` and `redirects` regex patterns. Low-risk; unblocks consistent 12/12 LLM test results.

### Upcoming Events (This Week)

4. **ElevenLabs cycle reset May 7 ~14:36 UTC (2.6 days)** — New cycle provides a clean character counter. Monitor for any Paisaxe voice activity after the reset. Also: Twilio phone rental charge expected ~May 7 (-$1.15, balance will drop to ~$12.91).

### Cost Reduction Evaluation

5. **Evaluate Twilio phone number (P3)** — 77 days without a booking call. $1.15/mo unused, next charge in ~2 days. Consider releasing the number unless bookings are expected to resume imminently. ~$14-17/yr savings.

6. **Review Vercel Pro and Supabase Pro if drought continues into June (P3)** — At current scale (~50 visitors/mo), both Pro tiers may be overprovisioned:
   - Vercel Pro ($20/mo) — Hobby tier is free for personal projects with reduced limits.
   - Supabase Pro ($25/mo) — Free tier includes 500MB storage and 50K monthly active users.
   - Combined potential savings: up to $45/mo (~53% of operational costs).

### Long-Term Planning

7. **Revenue trajectory has crossed a two-month threshold (P1 escalation)** — Three consecutive near-zero or zero-revenue months. Cumulative operational loss since Feb 2026: ~$386. At $84.41/mo operational with $0 revenue: $2.81/day in losses. Break-even requires ~3,150 monthly visitors at 5% Day Pass conversion — 63x current traffic. The platform requires either a growth event or cost reduction to achieve sustainability before June (month 5 of the drought).

8. **ElevenLabs Creator tier remains well-sized** — At 5.07% cycle utilization with 100 min/mo limit, there is no pressure to upgrade. Scale tier ($99/mo) only warranted if sustained Paisaxe voice traffic exceeds 100 min/mo — currently at 0 min and 77 days dormant.

9. **May 7 is the next signal point** — ElevenLabs character reset + Twilio phone rental. Monitor the new ElevenLabs cycle for any Paisaxe voice activity that would indicate the voice drought has ended.

---

## Data Sources

| Source | Method | Last Queried | Status |
|--------|--------|-------------|--------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-05-05 03:00 UTC | Pass — character_count 13,734 confirmed, next_reset 1778164571 (May 7 ~14:36 UTC) |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=20` | 2026-05-05 03:00 UTC | Pass — 20 conversations retrieved; most recent Apr 16 18:44 UTC (18.5-day silence) |
| Twilio Balance API | `/Balance.json` | 2026-05-05 03:00 UTC | Pass — $14.0646 confirmed |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json` | 2026-05-05 03:00 UTC | Pass — 50 records retrieved; 0 non-zero records confirmed |
| Config: `service-tiers.ts` | File read | 2026-05-05 | Pass |
| Config: `recurring-costs.ts` | File read | 2026-05-05 | Pass |
| Config: `forecast.ts` | File read | 2026-05-05 | Pass |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | — | Manual check required at platform.claude.com/settings/billing |
| Cross-agent context | Agent shared context | 2026-05-05 | Pass — May 4-5 reports incorporated |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-05-06.*

---
