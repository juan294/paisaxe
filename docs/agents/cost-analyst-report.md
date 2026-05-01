# Cost Analyst Report

> **Generated**: 2026-04-30 03:00:00 | **Period**: April 2026 (day 30 of 30 — final) | **Status**: WATCH

---

## Executive Summary

**April closes today — final day of the month.** ElevenLabs character count holds at **13,734 / 270,783 (5.07%)** — unchanged for 14 consecutive days (confirmed via subscription API this run). Most recent conversation across all agents remains Archy on **Apr 16 18:43 UTC — now 13.2 days of full ElevenLabs account silence.** Character reset due **2026-05-07 ~14:36 UTC** (~7.6 days). Cycle-end utilization projected 5–7%.

**Twilio balance: $14.0646** (unchanged for 23 consecutive days). All April usage records confirmed at $0.00. ~12.2 months of runway.

**Revenue drought reaches 76 days** (since Feb 13). **Paisaxe voice silence: 72 days** (since Feb 17). April closes at $0 revenue — second consecutive full-zero month. Cumulative operational loss since Feb 2026: ~$371.

**Cross-agent findings incorporated this cycle:**
- QA Agent RED (Apr 29): Chat API returned 403 across all LLM tests; browser journeys 1/10 (/immersive story-title not found). Root cause: wave-2 remediation merges (1a3ba7c5, 5023f7eb) broke chat auth and /immersive story render. Commit `bab3c40e` ("fix(e2e): restore E2E coverage broken by Wave 2 CSRF hardening") landed post-report — QA harness status in current cycle unconfirmed. Safety guarantees cannot be asserted while Chat API is 403.
- Performance YELLOW (Apr 29): initial-load JS confirmed at **2,067 KB / 2,000 KB**; total JS 2,986 KB / 3,000 KB (**14 KB total headroom — critical**). +55 KB from wave-2 remediation PRs this cycle. P4 (Supabase realtime tree-shake, ~25 KB) still unimplemented.
- Security YELLOW (Apr 29): 0 advisories via npm audit — postcss and uuid chains cleared since Apr 27. 18 outdated production packages; voyageai intentionally pinned at 0.1.0 (ESM breakage). QA RED prevents confirming safety guardrails.
- Localization GREEN (Apr 29): 404 leaf keys (up from 395 — 9 keys added across all locales), 100 stories × 5 non-es locales = 500 entries complete.
- Documentation YELLOW→recovered (Apr 29): Story Details and Story Translations tabs added to features.md; back to GREEN state now.

**Financial health: WATCH** — business concern only. No platform cost anomalies. All tier limits safe.

| Metric | Value | vs. Apr 29 |
|--------|-------|-----------|
| Total Fixed Costs (all) | $284.41/mo | flat |
| Total Fixed Costs (operational) | **$84.41/mo** | flat |
| Variable Costs (Apr final, confirmed) | **$1.15** | flat |
| Daily Burn Rate (Apr fixed) | **$2.81/day** | flat |
| Revenue (Apr final) | **$0.00** | flat |
| Twilio Balance | **$14.0646** | flat (API confirmed) |
| ElevenLabs Characters | **13,734 / 270,783 (5.07%)** | flat (API confirmed) |
| ElevenLabs Voice Min (Paisaxe, Apr) | 0.0 / 100 | flat |
| Next Character Reset | **~2026-05-07 14:36 UTC** | ~7.6 days |
| Paisaxe Voice Silence | **72 days** | +1 |
| Revenue Drought | **76 days** | +1 |
| Last ElevenLabs Conversation | Apr 16 18:43 UTC | +13.2 days silence |
| npm audit advisories | **0** | improved (was 8 on Apr 27) |
| Cumulative Operational Loss (est.) | **~$371** | +$3 |

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

*\*ElevenLabs Creator billed annually. Effective rate $22.18/mo. Next annual invoice: $266.20 on ~2027-02-07 (next_payment_attempt_unix 1802012845, confirmed via API).*

*\*\*Anthropic $10/mo is a config estimate. No billing API on personal account. Manual check required at console.anthropic.com/settings/billing. Daily automated agents plus Claude Code Max development activity likely push actual usage above estimate.*

*\*\*\*Twilio phone rental charged Apr 7: balance dropped $15.2146 → $14.0646 (-$1.15). Next rental due ~May 7.*

**Note**: Claude Code Max ($200/mo) is the primary development tool, categorized separately as "Development." Operational cost analysis focuses on running the live service.

### Variable / Usage-Based Costs (April 2026 Final — Day 30)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Phone rental) | 1 number, April billing | **$1.15** | Balance delta (Apr 7) |
| Twilio (SMS) | 0 messages | $0.00 | Twilio API (today — 50 records, all $0.00) |
| Twilio (Calls) | 0 minutes | $0.00 | Twilio API (today, confirmed) |
| Stripe (Processing Fees) | 0 charges | $0.00 | — |
| Anthropic (Claude API) | Unknown | Unknown | No API on personal account |
| Voyage AI (Embeddings) | Unknown | Unknown | — |
| **Total Variable (Apr final, confirmed)** | | **$1.15** | |

### April 2026 Final Total (Day 30)

| Category | Cost |
|----------|------|
| Fixed Operational | $84.41 |
| Variable (confirmed) | $1.15 |
| **Total Operational (April final)** | **$85.56** |
| Revenue | $0.00 |
| **Net (loss)** | **-$85.56** |

### Monthly Cost History (reference)

| Month | Operational Fixed | Variable (confirmed) | Total Operational | Revenue (net) | Coverage |
|-------|------------------|----------------------|-------------------|---------------|----------|
| Feb 2026 | $84.41 | ~$2.75 | ~$87.16 | ~$9.98 | ~11.4% |
| Mar 2026 (final) | $84.41 | $1.15 | **$85.56** | **$0.00** | **0%** |
| Apr 2026 (final) | $84.41 | $1.15 | **$85.56** | **$0.00** | **0%** |

---

## Usage Metrics

### ElevenLabs Activity — Current Cycle (Apr 7 14:36 UTC → May 7 ~14:36 UTC)

**Last 12 conversations across the account (API confirmed — no new conversations since Apr 16):**

| Time (UTC) | Agent | Status | Notes |
|------------|-------|--------|-------|
| Apr 16 18:43 | Archy | success | Most recent on account |
| Apr 16 18:41 | Archy | success | |
| Apr 16 18:22 | Archy | **failed** | custom_llm generation failed |
| Apr 16 18:19 | Archy | **failed** | custom_llm generation failed |
| Apr 16 18:19 | Archy | **failed** | custom_llm generation failed |
| Apr 16 18:04 | Archy | success | |
| Apr 16 18:02 | Archy | success | |
| Apr 16 17:35 | Archy | success | |
| Apr 12 08:00 | Archy | **failed** | custom_llm generation failed |
| Apr 11 16:50 | Archy | **failed** | LLM response took too long |
| Apr 11 06:38 | Coach | success | |
| Apr 11 06:12 | Archy | **failed** | LLM response took too long |

**Summary:**
- Archy: 11 (6 success, 5 failed — 45% failure rate)
- Coach: 1 (success)
- Pelayo (Visitor Guide): 0 — dormant since Feb 17
- Pelayo (Booking): 0 — dormant since Feb 10
- Penny, Iris, Xander: 0 — never used

**All conversations are non-Paisaxe.** Paisaxe agents: **0 conversations since Feb 17 (72 days).**

Full-account silence: **13.2 days** (no activity from any agent since Apr 16 18:43 UTC).

### ElevenLabs Character Usage

| Metric | Value | vs. Apr 29 |
|--------|-------|-----------|
| Characters used (cycle) | **13,734 / 270,783 (5.07%)** | flat (API confirmed) |
| Character limit | **270,783** | flat |
| Next character reset | **~2026-05-07 14:36 UTC** | ~7.6 days |
| Characters used (Apr, Paisaxe) | 0 | flat |
| Characters remaining this cycle | **257,049** | flat |

**Cycle utilization projection (Apr 30):**
- Cycle start: Apr 7 14:36 UTC. Days elapsed: ~22.4 days.
- Cycle-average rate: ~613/day (declining; 14 consecutive zero days Apr 17–30).
- If zero activity continues through reset: cycle ends at **5.07%**.
- Conservative estimate (~613/day × 7.6 days remaining): +4,659 = ~18,393 = **~6.8%**.
- Likely outcome: 5–7% — well within Creator limit (270,783 chars).

### ElevenLabs Subscription Details (API confirmed this run)

| Field | Value |
|-------|-------|
| Tier | Creator |
| Billing period | Annual |
| Status | Active |
| Next invoice amount | $266.20 |
| Next payment attempt | ~2027-02-07 |
| Next character reset | **~2026-05-07 14:36 UTC** |
| Character limit | **270,783** |
| Current overage | $0.00 |

### Twilio Communications

| Metric | Apr 2026 (final) | Mar 2026 (final) | Change |
|--------|------------------|-----------------|--------|
| SMS Sent | 0 | 0 | flat |
| Calls | 0 | 0 | flat |
| Usage Cost | $0.00 | $0.00 | flat |
| Phone Rental | **$1.15** (charged Apr 7) | $1.15 | Monthly expected |
| Balance | **$14.0646** | $15.4546 | -$1.40 MTD |

**Twilio balance reconciliation (April, final):**
- Apr 1 (start): ~$15.4546
- Apr 3-4: -$0.24 (unexplained — likely recurring regulatory surcharge, now **27 days unresolved**)
- Apr 7: -$1.15 (phone number rental, confirmed)
- **Apr 30: $14.0646** — stable for 23 consecutive days. ~12.2 months of runway at $1.15/mo.

### Stripe Revenue

| Metric | Apr 2026 (final) | Mar 2026 (final) | Feb 2026 (final) |
|--------|------------------|-----------------|-----------------|
| Net Sales | 0 | 0 | 6 |
| Gross Revenue | $0.00 | $0.00 | $13.93 |
| Net Revenue | $0.00 | $0.00 | $9.98 |

**76-day revenue drought** — No Day Pass sales since Feb 13. April closes today at $0 revenue — second consecutive full-zero month.

---

## Cost Efficiency

| Metric | Current (Apr 30) | Previous (Apr 29) | Change | Trend |
|--------|----------------|------------------|--------|-------|
| Fixed operational cost/mo | $84.41 | $84.41 | flat | flat |
| Daily burn rate (fixed) | **$2.81/day** | $2.81/day | flat | flat |
| April variable spend (confirmed, final) | **$1.15** | $1.15 | flat | flat |
| Cost per voice conversation (Feb actuals) | ~$0.43 | ~$0.43 | flat | flat |
| Cost per voice minute (Feb actuals) | ~$0.37 | ~$0.37 | flat | flat |
| ElevenLabs char utilization (cycle) | **5.07%** | 5.07% | flat (14-day freeze) | flat |
| ElevenLabs voice min utilization (Paisaxe, Apr) | 0% | 0% | flat | flat |
| Revenue coverage (operational) | **0%** | 0% | flat | flat |
| Months of Twilio runway | ~12.2 mo | ~12.2 mo | flat | flat |
| Cumulative operational loss (Feb–Apr 30) | **~$371** | ~$368 | +$3 | down |

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Alert Level |
|---------|--------|------|-------|-------------|-------------|
| ElevenLabs | Characters (cycle) | 13,734 | 270,783 | **5.07%** | SAFE |
| ElevenLabs | Voice Minutes (Paisaxe, Apr) | 0.0 | 100 | **0%** | SAFE |
| Vercel | Monthly Visitors | ~low | 500,000 (Pro) | **<1%** | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | SAFE |

**All tier alerts cleared.** Cycle-end utilization will be 5–7% — well within Creator limit. Character reset in ~7.6 days (May 7) begins the new cycle.

### Upgrade Trigger Points

| Service | Current Tier | Trigger | Next Tier | Cost Jump |
|---------|-------------|---------|-----------|-----------|
| ElevenLabs | Creator ($22.18/mo eff.) | >100 min/mo | Scale ($99/mo) | +$77/mo |
| Supabase | Pro ($25/mo) | >8 GB storage | Team ($599/mo) | +$574/mo |
| PostHog | Free ($0) | >1M events/mo | Pay-as-you-go | Variable |

---

## Scaling Forecast

Based on `src/lib/costs/forecast.ts` logic. No April Paisaxe variable data; using February 2026 actuals as baseline with fallback per-unit costs.

**Per-unit costs (fallback — no April production data):**
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
| 76-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. April closes today at $0 — second consecutive full-zero month. Cumulative operational loss ~$371. |
| 72-day Paisaxe voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Platform dormant to visitors for over 2 months. |
| QA Agent RED (Apr 29) | **WARNING** | Chat API 403 regression and /immersive story-title failure from wave-2 merges. Safety guarantees unassertable while 403 persists. Fix commit `bab3c40e` landed; QA harness status in May cycle unconfirmed. |
| ElevenLabs full-account silence (13.2 days) | **WATCH** | No conversations on any agent since Apr 16 18:43 UTC. Character count frozen at 13,734 for 14 consecutive days (Apr 17–30). Reset in ~7.6 days — cycle utilization projected 5–7%. |
| Performance: total JS near budget ceiling | **WATCH** | Total JS 2,986 KB / 3,000 KB (14 KB headroom — critical). Initial load 2,067 KB / 2,000 KB (67 KB over). Wave-2 added +55 KB; P4 Supabase tree-shake (~25 KB) unimplemented. Budget ceiling breach imminent if wave-3 adds any significant JS. |
| Archy failure rate elevated | **WATCH** | 5/12 (45%) failures in last 12 observed conversations. All failures: "custom_llm generation failed" or "LLM response took too long". Non-Paisaxe; no new data since Apr 16 (13.2-day silence). |
| Twilio $0.24 drop (Apr 3-4, unresolved) | **WATCH** | Balance anomaly not captured in Usage Records API. Likely recurring regulatory surcharge. Now 27 days unresolved. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Daily automated agents (security, coverage, performance, cost-analyst, localization, docs, QA, triage) plus Claude Code Max development likely push actual usage above $10/mo estimate. |

**No platform cost-structure anomalies.** All tier limits safe.

---

## Trend Analysis

### Comparison: Apr 29 → Apr 30 (final day of April)

| Metric | Apr 29 | Apr 30 | Change | Direction |
|--------|--------|--------|--------|-----------|
| Fixed costs/mo (operational) | $84.41 | $84.41 | flat | flat |
| Variable costs (confirmed final) | $1.15 | $1.15 | flat | flat |
| Daily burn rate (fixed) | $2.81/day | $2.81/day | flat | flat |
| ElevenLabs characters (cycle) | 13,734 (5.07%) | **13,734 (5.07%)** | 0 (API confirmed) | flat |
| Most recent ElevenLabs convo | Apr 16 18:43 UTC | **Apr 16 18:43 UTC** | +1 day silence | flat |
| Full-account silence duration | 12.3 days | **13.2 days** | +0.9 days | worsening |
| Days to ElevenLabs reset | ~8.6 days | **~7.6 days** | -1 day | approaching |
| Archy failure rate (last 12) | 5/12 (45%) | **5/12 (45%)** | flat | flat |
| Paisaxe voice conversations (MTD) | 0 | 0 | flat | flat |
| Twilio balance | $14.0646 | $14.0646 | flat (API confirmed) | flat |
| SMS sent (MTD) | 0 | 0 | flat | flat |
| Day Pass net sales (MTD) | 0 | 0 | flat | flat |
| Paisaxe voice dormancy streak | 71 days | **72 days** | +1 | down |
| Revenue drought streak | 75 days | **76 days** | +1 | down |
| Cumulative operational loss | ~$368 | **~$371** | +$3 | down |
| npm audit advisories | 8 moderate (Apr 27) | **0** | resolved | improved |
| Initial-load JS (last prod build, Apr 25) | 2,067 KB | **2,067 KB** | flat | YELLOW |
| Total JS headroom | ~59 KB (Apr 25) | **~14 KB (Apr 29 dev)** | -45 KB | CRITICAL |
| QA Agent status | YELLOW (Apr 27) | **RED (Apr 29)** | regressed | down |

**Key observations:**

1. **April closes at $85.56 operational spend, $0 revenue** — identical final figure to March. Two consecutive full-zero revenue months; cumulative operational loss reaches ~$371.

2. **ElevenLabs full-account silence now at 13.2 days.** Character count locked at 13,734 for 14 consecutive days. The cycle resets in ~7.6 days (May 7). New May cycle begins with a clean counter, providing the first meaningful voice activity signal for the month.

3. **QA regression is the most significant technical development.** The RED status from Apr 29 (Chat API 403 + /immersive story failure from wave-2 merges) leaves the automated safety monitoring layer non-functional. Commit `bab3c40e` targeted E2E coverage restoration. The May 1 QA agent run will be the first confirmation of recovery.

4. **Performance headroom collapsed.** Total JS headroom dropped from 59 KB (Apr 25 production) to 14 KB (Apr 29 dev cache) after wave-2 added +55 KB. Even without wave-3, the total budget is now at operational risk. P4 (Supabase realtime tree-shake, ~25 KB) is the only identified action that preserves the budget. Immediate implementation is needed before any wave-3 changes.

5. **Security advisories cleared to zero.** Both the postcss XSS chain and uuid bounds-check chain (8 moderate advisories) are now resolved per the Apr 29 security agent report. A clean npm audit for the new May cycle.

6. **Revenue and voice drought still unexplained.** No automated diagnostic has identified a root cause across 76 and 72 days respectively. Manual production verification of Pelayo widget and Day Pass flow on paisaxe.es remains the outstanding action.

---

## Recommendations

### Immediate Actions (Priority)

1. **Verify QA Agent recovery (P1)** — The RED status from Apr 29 (Chat API 403 + /immersive regression) left safety guarantees unassertable. Commit `bab3c40e` targeted E2E coverage restoration. Confirm the May 1 QA agent runs GREEN before assuming automated monitoring is restored. If 403 persists, `git diff HEAD~5 -- src/app/api/chat/route.ts` isolates the breaking change from wave-2 merges.

2. **Implement P4 (Supabase realtime tree-shake) before wave-3 (P1)** — Total JS headroom is 14 KB in dev cache after wave-2 added +55 KB. P4 saves ~25 KB on initial load (creating `src/lib/supabase/browser-public.ts` for public-facing pages). Run a fresh `rm -rf .next && npm run build` after P4 to get an accurate post-wave-2 production baseline before any wave-3 work. Also consider raising the initial-load budget from 2,000 KB to 2,100 KB to reflect structural growth since the Apr 4 baseline.

3. **Investigate the revenue and voice drought — 76 days is a critical threshold (P1)** — Three consecutive months (Feb partial, Mar full, Apr full) with near-zero revenue. Manual checks required:
   - Is the Pelayo voice widget rendering and accessible on production (paisaxe.es)?
   - Is the Day Pass purchase flow functional end-to-end?
   - Are Vercel deployment logs showing errors on production?
   - Has organic traffic dropped? (PostHog / Vercel Analytics)

4. **Check Anthropic billing manually (P2)** — Visit console.anthropic.com/settings/billing. Daily automated agents plus Claude Code Max development activity likely push actual Anthropic API usage above the $10/mo config estimate. This remains the single largest unmonitored cost surface.

5. **Resolve the Twilio $0.24 anomaly (P3)** — Now 27 days unresolved (Apr 3-4 balance drop). Check Twilio billing history for April 3-4. Likely a US local number regulatory surcharge (~$0.24/mo). If confirmed recurring, update `src/config/recurring-costs.ts` Twilio cost from $1.15 to ~$1.39/mo.

### Cost Reduction Evaluation

6. **Evaluate Twilio phone number (P3)** — 72 days without a booking call. $1.15/mo unused. Next billing ~May 7. Consider releasing the number unless bookings are expected to resume imminently. ~$14–17/yr savings.

7. **Review Vercel Pro and Supabase Pro if drought continues into May (P3)** — At current scale (~50 visitors/mo), both Pro tiers may be overprovisioned:
   - Vercel Pro ($20/mo) — Hobby tier is free for personal projects.
   - Supabase Pro ($25/mo) — Free tier includes 500MB storage and 50K monthly active users.
   - Combined potential savings: up to $45/mo (~53% of operational costs).

### Long-Term Planning

8. **Revenue trajectory requires escalation** — Three consecutive near-zero or zero-revenue months. Cumulative operational loss since Feb 2026: ~$371. At $84.41/mo operational with $0 revenue: $2.81/day in losses. Break-even requires ~3,150 monthly visitors at 5% Day Pass conversion — 63x current traffic. The platform requires either a growth event or cost reduction to achieve sustainability.

9. **ElevenLabs remains well-sized** — Creator tier at $22.18/mo effective (annual). Current cycle on track for 5–7% utilization. Scale tier ($99/mo) only warranted if sustained Paisaxe voice traffic exceeds 100 min/mo — currently at 0 min.

10. **May cycle reset opportunity** — ElevenLabs character counter resets May 7. The new cycle will provide a clean signal for any voice activity that begins in May. Track Pelayo conversations from the reset date to distinguish May traffic from the 72-day dormancy period.

---

## Data Sources

| Source | Method | Last Queried | Status |
|--------|--------|-------------|--------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-04-30 03:00 UTC | OK — character_count 13,734 confirmed, reset timestamp confirmed |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=20` | 2026-04-30 03:00 UTC | OK — 20 conversations retrieved; most recent Apr 16 18:43 UTC (13.2-day silence) |
| ElevenLabs Character Stats | `/v1/usage/character-stats` | 2026-04-30 03:00 UTC | Partial — returned empty usage object; subscription API used as authoritative source |
| Twilio Balance API | `/Balance.json` | 2026-04-30 03:00 UTC | OK — $14.0646 confirmed |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json` | 2026-04-30 03:00 UTC | OK — 50 records retrieved; all $0.00 confirmed |
| Config: `service-tiers.ts` | File read | 2026-04-30 | OK |
| Config: `recurring-costs.ts` | File read | 2026-04-30 | OK |
| Config: `forecast.ts` | File read | 2026-04-30 | OK |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | — | Manual check required at console.anthropic.com/settings/billing |
| Cross-agent context | Agent shared context | 2026-04-30 | OK — Apr 29 reports incorporated |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-05-01.*

---
