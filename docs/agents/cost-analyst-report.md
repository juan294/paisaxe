# Cost Analyst Report

> **Generated**: 2026-05-14 03:00 UTC | **Period**: May 2026 (day 14 of 31) | **Status**: WATCH

---

## Executive Summary

Both ElevenLabs and Twilio APIs queried successfully. Financial position advances one more day of normal burn with no new variable charges and no new voice activity.

**ElevenLabs**: Creator tier, **0 / 300,000 characters (0.00%)** in the current billing cycle (started May 8 ~15:07 UTC, day 6). Full-account silence is now **28 days** — the most recent conversation across all agents remains Archy at April 16 2026 18:44:58 UTC. The last-10-conversations list is identical to May 13: no new conversations since Apr 16. Next cycle reset: June 7 2026 15:07 UTC. Next annual invoice: $266.20 on 2027-02-07.

**Twilio**: Balance **$12.6746** (unchanged from May 13). All May usage records $0.00 (50 records checked). Runway ~9.1 months.

**Revenue drought reaches 90 days** (since Feb 13 — three-month milestone). **Paisaxe voice silence: 86 days** (since Feb 17).

**Security alert from other agents**: Security Agent May 13 detected 2 moderate advisories (protobufjs transitive chain, re-introduced by dep batch `6706232c`). Not exploitable. Fix: `npm audit fix` (lockfile only).

**May 14 MTD financial position**: ~$46.39 in operational costs ($44.99 fixed proportional + $1.39 Twilio May 7 charge), $0.00 revenue.

**Cumulative operational loss since February launch: ~$345.** May is on track to close at ~$101.04 operational cost with $0 revenue — fourth consecutive zero-revenue month in progress.

**Financial health: WATCH** — no platform cost-structure anomalies, all tier limits safe. The outstanding concern remains the 90-day revenue drought and 86-day voice silence, which require manual production investigation on paisaxe.es.

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

**ElevenLabs Creator billed annually at $266.20/yr (effective $22.18/mo). Next annual invoice: $266.20 on 2027-02-07.*

***Twilio config reflects actual recurring charge: $1.15 base + $0.24 regulatory fee = $1.39/mo. Confirmed by Apr 3-4 and May 7 charges.*

**Note**: Claude Code Max ($200/mo) is the primary development tool, categorized separately as "Development." Operational cost analysis focuses on the live service ($99.65/mo).

**Total Fixed Operational**: $99.65/mo | **Daily Burn Rate**: $3.21/day

### Variable / Usage-Based Costs (May 2026 — MTD Day 14)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Phone rental + regulatory fee) | 1 charge May 7 | **$1.39** | Confirmed (balance $14.0646 -> $12.6746) |
| Twilio (SMS) | 0 messages | $0.00 | Verified via API |
| Twilio (Calls) | 0 minutes | $0.00 | Verified via API |
| Stripe (Processing Fees) | 0 charges | $0.00 | — |
| Anthropic (Claude API) | Unknown | Unknown | No API on personal account |
| Voyage AI (Embeddings) | Unknown | Unknown | No dedicated API |
| **Total Variable (May MTD, confirmed)** | | **$1.39** | |

### May 2026 MTD Summary (Day 14 of 31)

| Category | Cost |
|----------|------|
| Fixed Operational (proportional, 14/31 days x $99.65) | ~$44.99 |
| Variable confirmed (Twilio May 7 charge) | $1.39 |
| **Total Operational (May MTD est.)** | **~$46.38** |
| Revenue | $0.00 |
| **Net (loss MTD)** | **-$46.38** |

### Monthly Cost History

| Month | Operational Fixed | Variable (confirmed) | Total Operational | Revenue (net) | Coverage |
|-------|-------------------|----------------------|-------------------|---------------|----------|
| Feb 2026 | ~$95 (ramping) | ~$2.75 | ~$97.75 | ~$9.98 | ~10.2% |
| Mar 2026 (final) | $99.41 | $1.15 | **$100.56** | **$0.00** | **0%** |
| Apr 2026 (final) | $99.41 | $1.39 | **$100.80** | **$0.00** | **0%** |
| May 2026 (proj.) | $99.65 | $1.39 (recurring only) | **proj. ~$101.04** | $0.00 (proj.) | 0% |

**Cumulative operational loss since February launch: ~$345.**

---

## Usage Metrics

### ElevenLabs Activity

API queried successfully. Live data:

- **Current cycle**: Started May 8 ~15:07 UTC. Characters used: **0 / 300,000 (0.00%)**. Cycle on day 6.
- **Most recent conversation (all agents)**: April 16 2026 18:44:58 UTC (Archy). **28 days of full-account silence.**
- **Last 10 conversations**: All Archy (agent `agent_7901kk4r9v3wer0t7zp5g1zhdf6x`). 8 from the Apr 16 burst session (17:35–18:44 UTC), 1 from Apr 12, 1 from Apr 11. Identical to May 13 — no new conversations.
- **Archy failure rate (last 10 sample)**: 5/10 (50%) — unchanged from May 13. Apr 16 burst: 3/8 (37.5%) failures. Apr 11-12: both failed.
- **Paisaxe agents** (Visitor Pelayo, Booking Pelayo, Penny, Iris, Xander): **0 conversations since Feb 17** (86 days).
- **No usage since new cycle began May 8.** Next reset: Jun 7 2026 15:07 UTC.

### ElevenLabs Conversation Breakdown (Last 10, via API — unchanged from May 13)

| Date | Status | Termination Reason |
|------|--------|--------------------|
| 2026-04-16 18:44 UTC | done | Client disconnected |
| 2026-04-16 18:41 UTC | done | Client disconnected |
| 2026-04-16 18:22 UTC | **failed** | custom_llm generation failed |
| 2026-04-16 18:19 UTC | **failed** | custom_llm generation failed |
| 2026-04-16 18:19 UTC | **failed** | custom_llm generation failed |
| 2026-04-16 18:04 UTC | done | Client disconnected |
| 2026-04-16 18:02 UTC | done | Client disconnected |
| 2026-04-16 17:35 UTC | done | Client disconnected |
| 2026-04-12 07:59 UTC | **failed** | custom_llm generation failed |
| 2026-04-11 16:50 UTC | **failed** | Generating the LLM response took too long |

### ElevenLabs Subscription Details

| Field | Value |
|-------|-------|
| Tier | Creator |
| Billing period | Annual |
| Status | Active |
| Current cycle start | May 8 ~15:07 UTC |
| Next cycle reset | Jun 7 2026 15:07 UTC |
| Character limit | 300,000 |
| Characters used (current cycle) | 0 |
| Voice limit | 30 |
| Voice slots used | 0 / 30 |
| Current overage | $0.00 |
| Next annual invoice | $266.20 on 2027-02-07 |

### Twilio Communications

| Metric | May MTD (day 14) | Apr 2026 (final) | Change |
|--------|----------------|------------------|--------|
| SMS Sent | 0 (verified) | 0 | flat |
| Calls | 0 (verified) | 0 | flat |
| Usage Cost (API records) | $0.00 (verified) | $0.00 | flat |
| Phone Rental + Fee | $1.39 (charged May 7) | $1.39 (Apr 7) | flat |
| Balance | **$12.6746** (verified) | $14.0646 (Apr 30) | -$1.39 |

**Twilio balance reconciliation:**
- May 1 (start): $14.0646
- May 7 (charged): $12.6746 — phone rental + $0.24 regulatory fee
- May 14 (today, verified): $12.6746 (no further activity)
- Runway: $12.6746 / $1.39 = **~9.1 months**

### Stripe Revenue

| Metric | May MTD (day 14) | Apr 2026 | Mar 2026 | Feb 2026 |
|--------|----------------|---------|---------|---------|
| Net Sales | 0 | 0 | 0 | 6 |
| Net Revenue | $0.00 | $0.00 | $0.00 | $9.98 |

**90-day revenue drought** — No Day Pass sales since Feb 13. Three-month milestone reached today (May 14).

---

## Cost Efficiency

| Metric | Current (May 14) | Previous (May 13) | Change | Trend |
|--------|----------------|------------------|--------|-------|
| Fixed operational cost/mo (config) | **$99.65** | $99.65 | flat | flat |
| Daily burn rate (fixed) | **$3.21/day** | $3.21/day | flat | flat |
| Monthly variable spend (MTD, confirmed) | **$1.39** | $1.39 | flat | flat |
| Cost per voice conversation (Feb actuals) | ~$0.43 | ~$0.43 | flat | flat |
| Cost per voice minute (Feb actuals) | ~$0.37 | ~$0.37 | flat | flat |
| ElevenLabs char utilization (current cycle) | **0.00%** | 0.00% | flat | flat |
| ElevenLabs voice min utilization (Paisaxe MTD) | 0% | 0% | flat | flat |
| Revenue coverage (operational) | **0%** | 0% | flat | flat |
| Twilio runway | **~9.1 months** | ~9.1 months | flat | flat |

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Alert Level |
|---------|--------|------|-------|-------------|-------------|
| ElevenLabs | Characters (current cycle) | 0 | 300,000 | **0.00%** | SAFE |
| ElevenLabs | Voice Minutes (Paisaxe, May MTD) | 0.0 | 100 | **0%** | SAFE |
| Vercel | Monthly Visitors | ~low | 500,000 (Pro) | **<1%** | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | SAFE |

All tier alerts clear. No service is approaching any limit at current usage trajectory.

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
| 90-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. Three-month milestone reached today. Three complete zero-revenue months (Mar, Apr; May trajectory). Cumulative operational loss ~$345. |
| 86-day Paisaxe voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Manual production verification of Pelayo widget and Day Pass flow on paisaxe.es remains the highest-priority outstanding action. |
| ElevenLabs full-account silence (28 days) | **WATCH** | Last activity Apr 16 18:44:58 UTC (Archy). New cycle started May 8; no usage in first 6 days. Conversation list identical to May 12-13. |
| Archy failure rate elevated | **WATCH** | Last-10-sample shows 50% failure rate (5/10), unchanged. All failures are `custom_llm generation failed` or LLM timeout — personal agent issue (Archy), not Paisaxe-specific. |
| 2 security advisories (protobufjs) | **WATCH** | Security Agent May 13 detected 2 moderate advisories re-introduced by dep batch `6706232c`. Not exploitable. Fix: `npm audit fix` (lockfile only). |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual check required at platform.claude.com/settings/billing. Config estimate $25/mo may be $40-60/mo based on observed credit grant frequency. |

**Resolved (carry-forward):**
- Twilio recurring-cost config discrepancy ($1.15 -> $1.39) — closed by May 8 triage.
- ElevenLabs prefetch eliminated — May 10 triage removed 493 KB ElevenLabs chunk from passive visitor sessions (P3 performance, `bd833288`). Performance P3 closed.
- Dep batch (13 packages) — closed by commit `6706232c`. Performance P2 closed. Includes: `@elevenlabs/react` 1.3->1.6, `@anthropic-ai/sdk` ->0.95.1, `posthog-js` ->1.372.10, `next` ->16.2.6, and 9 additional production deps.

---

## Trend Analysis

### Comparison: May 13 vs May 14

| Metric | May 13 | May 14 | Change | Direction |
|--------|--------|--------|--------|-----------|
| Variable costs (MTD confirmed) | $1.39 | $1.39 | flat | flat |
| Fixed proportional (MTD) | ~$41.78 | ~$44.99 | +$3.21 | normal burn |
| Total MTD operational | ~$43.17 | ~$46.38 | +$3.21 | normal burn |
| Twilio balance | $12.6746 | $12.6746 | flat | flat |
| Twilio runway | ~9.1 months | ~9.1 months | flat | flat |
| ElevenLabs chars (current cycle) | 0 / 300,000 | 0 / 300,000 | flat | flat |
| ElevenLabs account silence | 27 days | 28 days | +1 | down |
| Paisaxe voice silence | 85 days | 86 days | +1 | down |
| Revenue drought | 89 days | **90 days** | +1 | down |
| Cumulative operational loss | ~$342 | ~$345 | +$3 | down |
| Security advisories | 0 | 2 (not exploitable) | +2 | watch |

**Key observations:**

1. **90-day revenue drought milestone reached today.** Three months since the last Day Pass sale on Feb 13. At $3.21/day, cumulative operational losses since launch reach ~$345. April closed at $100.80 operational cost / $0 revenue. May tracking the same pattern.

2. **ElevenLabs API data identical to May 13.** The last-10-conversations list returned the exact same 10 conversations (all Archy from Apr 16/12/11). No new voice activity whatsoever across any agent since Apr 16.

3. **Security advisory reintroduced by dep batch.** Security Agent May 13 confirmed protobufjs transitive chain re-emerged after dep batch `6706232c`. Fix is lockfile-only (`npm audit fix`). Not exploitable.

4. **All tier limits well within bounds.** At ~50 visitors/month, no service is approaching any tier upgrade trigger. ElevenLabs char utilization at 0% for cycle day 6 of 30.

5. **Outstanding technical actions from prior cycles.** P1 `npm run build:analyze` (125 KB unclassified chunk) remains deferred (9+ cycles). Minor dep patches (`@anthropic-ai/sdk` 0.95.2, `tailwind-merge` 3.6.0) remain pending.

---

## Recommendations

### Immediate Actions (Priority)

1. **Investigate the revenue and voice drought — 90 days (P1, CRITICAL).** Three-month milestone reached. Fourth consecutive zero-revenue month in progress. Manual checks required on paisaxe.es:
   - Is the Pelayo voice widget rendering and accessible on production?
   - Is the Day Pass purchase flow functional end-to-end?
   - Are Vercel deployment logs showing errors on production?
   - Has organic traffic dropped? (PostHog / Vercel Analytics dashboard)

2. **Run `npm audit fix` to clear 2 security advisories (P2)** — Security Agent May 13 flagged protobufjs transitive chain (YELLOW). Lockfile-only fix, no bundle impact. Batch with `@anthropic-ai/sdk` 0.95.2 and `tailwind-merge` 3.6.0 patches.

3. **Check Anthropic billing manually (P2)** — Visit platform.claude.com/settings/billing. Config estimate is $25/mo; observed credit grant patterns suggest $40-60/mo across all projects. If actual spend is $40+/mo, cumulative loss estimates would be ~$375+.

4. **Run `npm run build:analyze` (P1 performance)** — The 125 KB unclassified chunk `0-zzfjv3~jbbq` has gone unclassified for 9+ cycles. Highest-priority outstanding performance action.

### Cost Reduction Evaluation

5. **Evaluate Twilio phone number (P3)** — 86 days without a booking call. $1.39/mo actual ($16.68/yr). Consider releasing the number unless bookings are expected to resume.

6. **June decision point: evaluate Vercel Pro and Supabase Pro if drought continues (P3)** — At ~50 visitors/mo, both Pro tiers may be overprovisioned:
   - Vercel Pro ($20/mo): Hobby tier is free with reduced limits.
   - Supabase Pro ($25/mo): Free tier includes 500MB storage and 50K MAU.
   - Combined potential savings: up to $45/mo (~45% of operational costs).

7. **ElevenLabs Creator tier correctly sized.** No upgrade pressure. Scale tier ($99/mo) only warranted if sustained voice traffic exceeds 100 min/mo — currently 86 days dormant.

### Long-Term Planning

8. **Revenue trajectory is structurally unsustainable (P1 escalation).** Three complete zero-revenue months. Daily burn: $3.21/day. Break-even requires ~1,200 monthly visitors at 5% Day Pass conversion (currently ~50 visitors). Platform requires a growth event, aggressive cost reduction, or both. June is the natural decision point: if revenue remains $0, evaluate tier downgrades (Vercel Hobby + Supabase Free) to reduce operational burn by ~$45/mo.

---

## Data Sources

| Source | Method | Last Queried | Status |
|--------|--------|--------------|--------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-05-14 03:00 UTC | Pass |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=10` | 2026-05-14 03:00 UTC | Pass |
| ElevenLabs Char Stats API | `/v1/user/subscription` (character_count field) | 2026-05-14 03:00 UTC | Pass (0 chars) |
| Twilio Balance API | `/Balance.json` | 2026-05-14 03:00 UTC | Pass ($12.6746) |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json` | 2026-05-14 03:00 UTC | Pass (all $0.00, 50 records) |
| Config: `service-tiers.ts` | File read | 2026-05-14 | Pass |
| Config: `recurring-costs.ts` | File read | 2026-05-14 | Pass ($1.39 Twilio, config-aligned) |
| Config: `forecast.ts` | File read | 2026-05-14 | Pass |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | — | Manual check required at platform.claude.com/settings/billing |
| Cross-agent context | Agent shared context | 2026-05-14 | Pass — security YELLOW (May 13, 2 advisories), performance YELLOW (May 12), coverage (May 11), documentation GREEN x26 (May 13), localization GREEN x51 (May 13) |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-05-15.*

---
