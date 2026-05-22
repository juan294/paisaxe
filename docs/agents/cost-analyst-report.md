# Cost Analyst Report

> **Generated**: 2026-05-22 03:00 UTC | **Period**: May 2026 (day 22 of 31) | **Status**: WATCH

---

## Executive Summary

Both ElevenLabs and Twilio APIs queried successfully. Day 22 of May brings another steady-state day: no new variable charges, no new voice activity, and no change in fixed service costs.

**ElevenLabs**: Creator tier, **0 / 300,000 characters (0.00%)** in the current billing cycle (started May 8 ~15:07 UTC, day 15 of 30). Full-account silence is now **36 days** — the most recent conversation across all agents remains Archy at Apr 16 2026 18:44:58 UTC. The last-10-conversations list is identical to the prior ten cycles (May 13-21): no new conversations since Apr 16. Next cycle reset: Jun 7 2026 15:07 UTC (Unix 1780844823). Next annual invoice: $266.20 on 2027-02-07 (Unix 1802012845).

**Twilio**: Balance **$12.6746** (unchanged from May 13-21, 15th consecutive stable day). All May SMS/call usage records $0.00 (50 records checked, 0 non-zero). Phone-number rental category confirms the $1.15 base charge for May; regulatory fee not yet posted (likely batched at month close, $0.24 expected). Runway ~9.1 months at $1.39/mo recurring.

**Revenue drought reaches 98 days** (since Feb 13). **Paisaxe voice silence: 94 days** (since Feb 17).

**Security carry-forward**: Security agent flagged 1 moderate advisory on May 19/20/21 — `brace-expansion@5.0.5` (regex DoS, GHSA-jxxr-4gwj-5jf2). Not exploitable (build/test-only path). One-line fix available (`"brace-expansion": ">=5.0.6"` override + `npm install`). Not a cost-structure concern; tracked here for triage visibility.

**May 22 MTD financial position**: ~$72.10 in operational costs ($70.71 fixed proportional + $1.39 expected variable), $0.00 revenue.

**Cumulative operational loss since February launch: ~$369.** May is on track to close at ~$101.04 operational cost with $0 revenue — fourth consecutive zero-revenue month in progress.

**Financial health: WATCH** — no platform cost-structure anomalies, all tier limits safe. The outstanding concern remains the 98-day revenue drought and 94-day Paisaxe voice silence, which require manual production investigation on paisaxe.es.

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

**ElevenLabs Creator billed annually at $266.20/yr (effective $22.18/mo). Next annual invoice: $266.20 on 2027-02-07 (verified via API).*

***Twilio config reflects actual recurring charge: $1.15 base + $0.24 regulatory fee = $1.39/mo. Confirmed by Apr 3-4 and May 7 charges.*

**Note**: Claude Code Max ($200/mo) is the primary development tool, categorized separately as "Development." Operational cost analysis focuses on the live service ($99.65/mo).

**Total Fixed Operational**: $99.65/mo | **Daily Burn Rate**: $3.21/day

### Variable / Usage-Based Costs (May 2026 — MTD Day 22)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Phone rental, base) | 1 number, May 1–22 | **$1.15** | Confirmed (Category=phonenumbers) |
| Twilio (Regulatory fee, batched at month close) | — | ~$0.24 expected | Inferred from prior months |
| Twilio (SMS) | 0 messages | $0.00 | Verified via API |
| Twilio (Calls) | 0 minutes | $0.00 | Verified via API |
| Stripe (Processing Fees) | 0 charges | $0.00 | — |
| Anthropic (Claude API) | Unknown | Unknown | No API on personal account |
| Voyage AI (Embeddings) | Unknown | Unknown | No dedicated API |
| **Total Variable (May MTD, expected)** | | **$1.39** | |

### May 2026 MTD Summary (Day 22 of 31)

| Category | Cost |
|----------|------|
| Fixed Operational (proportional, 22/31 days × $99.65) | ~$70.71 |
| Variable expected (Twilio May 7 charge + reg fee) | $1.39 |
| **Total Operational (May MTD est.)** | **~$72.10** |
| Revenue | $0.00 |
| **Net (loss MTD)** | **-$72.10** |

### Monthly Cost History

| Month | Operational Fixed | Variable (confirmed) | Total Operational | Revenue (net) | Coverage |
|-------|-------------------|----------------------|-------------------|---------------|----------|
| Feb 2026 | ~$95 (ramping) | ~$2.75 | ~$97.75 | ~$9.98 | ~10.2% |
| Mar 2026 (final) | $99.41 | $1.15 | **$100.56** | **$0.00** | **0%** |
| Apr 2026 (final) | $99.41 | $1.39 | **$100.80** | **$0.00** | **0%** |
| May 2026 (proj.) | $99.65 | $1.39 (recurring only) | **proj. ~$101.04** | $0.00 (proj.) | 0% |

**Cumulative operational loss since February launch: ~$369.**

---

## Usage Metrics

### ElevenLabs Activity

API queried successfully. Live data:

- **Current cycle**: Started May 8 ~15:07 UTC. Characters used: **0 / 300,000 (0.00%)**. Cycle on day 15 of 30 (50% of cycle elapsed).
- **Most recent conversation (all agents)**: Apr 16 2026 18:44:58 UTC (Archy). **36 days of full-account silence.**
- **Last 10 conversations**: All Archy (agent `agent_7901kk4r9v3wer0t7zp5g1zhdf6x`). 8 from the Apr 16 burst session (17:35–18:44 UTC), 1 from Apr 12, 1 from Apr 11. Identical list as reported May 13-21 — no new conversations across any agent.
- **Archy failure rate (last 10 sample)**: 5/10 (50%) — unchanged. Apr 16 burst: 3/8 (37.5%) failures. Apr 11-12: both failed. All failures `custom_llm generation failed` or LLM timeout.
- **Paisaxe agents** (Visitor Pelayo, Booking Pelayo, Penny, Iris, Xander): **0 conversations since Feb 17** (94 days).
- **No usage since new cycle began May 8.** Next reset: Jun 7 2026 15:07 UTC.

### ElevenLabs Conversation Breakdown (Last 10, via API — unchanged from May 13-21)

| Date | Status | Duration | Termination Reason |
|------|--------|----------|--------------------|
| 2026-04-16 18:44 UTC | done | 75s | Client disconnected: 1000 |
| 2026-04-16 18:41 UTC | done | 16s | Client disconnected: 1000 |
| 2026-04-16 18:22 UTC | **failed** | 15s | custom_llm generation failed |
| 2026-04-16 18:19 UTC | **failed** | 9s | custom_llm generation failed |
| 2026-04-16 18:19 UTC | **failed** | 16s | custom_llm generation failed |
| 2026-04-16 18:04 UTC | done | 77s | Client disconnected: 1000 |
| 2026-04-16 18:02 UTC | done | 17s | Client disconnected: 1000 |
| 2026-04-16 17:35 UTC | done | 16s | Client disconnected: 1000 |
| 2026-04-12 07:59 UTC | **failed** | 24s | custom_llm generation failed |
| 2026-04-11 16:50 UTC | **failed** | 32s | LLM response took too long |

### ElevenLabs Subscription Details

| Field | Value |
|-------|-------|
| Tier | Creator |
| Billing period | Annual |
| Status | Active |
| Current cycle start | May 8 ~15:07 UTC |
| Next cycle reset | Jun 7 2026 15:07 UTC (Unix 1780844823) |
| Character limit | 300,000 |
| Characters used (current cycle) | 0 |
| Voice limit | 30 |
| Voice slots used | 0 / 30 |
| Current overage | $0.00 |
| Next annual invoice | $266.20 on 2027-02-07 (Unix 1802012845) |

### Twilio Communications

| Metric | May MTD (day 22) | Apr 2026 (final) | Change |
|--------|------------------|------------------|--------|
| SMS Sent | 0 (verified) | 0 | flat |
| Calls | 0 (verified) | 0 | flat |
| Usage Cost (API records) | $1.15 (phone rental, verified) | $1.39 | -$0.24 (fee not yet posted) |
| Phone Rental + Fee | $1.39 (charged May 7) | $1.39 (Apr 7) | flat |
| Balance | **$12.6746** (verified) | $14.0646 (Apr 30) | -$1.39 |

**Twilio balance reconciliation:**
- May 1 (start): $14.0646
- May 7 (charged): $12.6746 — phone rental + $0.24 regulatory fee
- May 22 (today, verified): $12.6746 (no further activity, 15 stable days)
- Runway: $12.6746 / $1.39 = **~9.1 months**

### Stripe Revenue

| Metric | May MTD (day 22) | Apr 2026 | Mar 2026 | Feb 2026 |
|--------|------------------|---------|---------|---------|
| Net Sales | 0 | 0 | 0 | 6 |
| Net Revenue | $0.00 | $0.00 | $0.00 | $9.98 |

**98-day revenue drought** — No Day Pass sales since Feb 13.

---

## Cost Efficiency

| Metric | Current (May 22) | Previous (May 21) | Change | Trend |
|--------|------------------|-------------------|--------|-------|
| Fixed operational cost/mo (config) | **$99.65** | $99.65 | flat | flat |
| Daily burn rate (fixed) | **$3.21/day** | $3.21/day | flat | flat |
| Monthly variable spend (MTD, expected) | **$1.39** | $1.39 | flat | flat |
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
| 98-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. Three complete zero-revenue months (Mar, Apr; May trajectory). Cumulative operational loss ~$369. |
| 94-day Paisaxe voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Manual production verification of Pelayo widget and Day Pass flow on paisaxe.es remains the highest-priority outstanding action. |
| ElevenLabs full-account silence (36 days) | **WATCH** | Last activity Apr 16 18:44:58 UTC (Archy). New cycle started May 8; no usage in first 15 days. Conversation list identical to May 13-21. |
| Archy failure rate elevated | **WATCH** | Last-10-sample shows 50% failure rate (5/10), unchanged. All failures are `custom_llm generation failed` or LLM timeout — personal agent issue (Archy), not Paisaxe-specific. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual check required at platform.claude.com/settings/billing. Config estimate $25/mo may be $40-60/mo based on observed credit grant frequency. |
| Security advisory (brace-expansion@5.0.5) carried | **WATCH** | Flagged by security agent on May 19/20/21. Not exploitable (build/test-only). One-line override fix available. Tracked for triage visibility. |

**Resolved (carry-forward from earlier cycles):**
- 2 security advisories (protobufjs transitive chain) — RESOLVED May 14 by triage `npm audit fix`.
- Twilio recurring-cost config discrepancy ($1.15 -> $1.39) — closed by May 8 triage.
- ElevenLabs prefetch eliminated — May 10 triage removed 493 KB ElevenLabs chunk from passive visitor sessions (P3 performance, `bd833288`). Performance P3 closed.
- Dep batch (13 packages) — closed by commit `6706232c`. Performance P2 closed.

---

## Trend Analysis

### Comparison: May 21 vs May 22 (1-day gap)

| Metric | May 21 | May 22 | Change | Direction |
|--------|--------|--------|--------|-----------|
| Variable costs (MTD expected) | $1.39 | $1.39 | flat | flat |
| Fixed proportional (MTD) | ~$67.51 | ~$70.71 | +$3.20 | normal burn (1 day) |
| Total MTD operational | ~$68.90 | ~$72.10 | +$3.20 | normal burn |
| Twilio balance | $12.6746 | $12.6746 | flat | flat |
| Twilio runway | ~9.1 months | ~9.1 months | flat | flat |
| ElevenLabs chars (current cycle) | 0 / 300,000 | 0 / 300,000 | flat | flat |
| ElevenLabs account silence | 35 days | **36 days** | +1 | down |
| Paisaxe voice silence | 93 days | **94 days** | +1 | down |
| Revenue drought | 97 days | **98 days** | +1 | down |
| Cumulative operational loss | ~$366 | ~$369 | +$3 | down |
| Security advisories | 1 (not exploitable) | 1 (not exploitable) | flat | flat |

**Key observations:**

1. **Steady-state burn, no surprises.** One day of $3.21/day fixed burn accrued; no variable activity. May 22 mirrors May 13-21 in every dimension except the proportional fixed accrual.

2. **36-day ElevenLabs account silence.** Apr 16 to May 22 = one month and 6 days with zero activity across any agent (Archy, Pelayo Visitor, Pelayo Booking, Penny, Iris, Xander). The last-10-conversations list is now ten consecutive cycles unchanged.

3. **98-day revenue drought continues.** Three months and 15 days since the last Day Pass sale on Feb 13. At $3.21/day, cumulative operational losses since launch reach ~$369. May tracking the same $100.80-ish monthly pattern as March and April. Centennial drought milestone arrives May 24 — within 48 hours.

4. **All tier limits well within bounds.** At ~50 visitors/month, no service is approaching any tier upgrade trigger. ElevenLabs char utilization at 0% for cycle day 15 of 30 (50% of cycle elapsed, 0 chars consumed).

5. **Outstanding technical actions from prior cycles unchanged.** Per May 20/21 performance agent (YELLOW): total-JS 3,082 KB / 3,100 KB (18 KB headroom), 7th consecutive cycle with no fresh production build. `npm run build:analyze` now 17+ cycles overdue. Per May 21 security agent (YELLOW): 1 moderate advisory (brace-expansion@5.0.5, not exploitable) + 10-package non-CVE prod-dep batch (`@anthropic-ai/sdk` 0.96.0, `posthog-js` 1.374.3, `@stripe/stripe-js` 9.6.0, `@stripe/react-stripe-js` 6.4.0, `@supabase/supabase-js` 2.106.0, `@sentry/nextjs` 10.53.1, `@sentry/core`, `@elevenlabs/react` 1.6.0, `lucide-react` 1.16.0, `tailwind-merge` 3.6.0). One worktree session can resolve all three in a single attributable bundle delta.

---

## Recommendations

### Immediate Actions (Priority)

1. **Investigate the revenue and voice drought — 98 days (P1, CRITICAL).** Fourth consecutive zero-revenue month in progress. Centennial milestone in 48 hours. Manual checks required on paisaxe.es:
   - Is the Pelayo voice widget rendering and accessible on production?
   - Is the Day Pass purchase flow functional end-to-end?
   - Are Vercel deployment logs showing errors on production?
   - Has organic traffic dropped? (PostHog / Vercel Analytics dashboard)

2. **Check Anthropic billing manually (P2)** — Visit platform.claude.com/settings/billing. Config estimate is $25/mo; observed credit grant patterns suggest $40-60/mo across all projects. If actual spend is $40+/mo, cumulative loss estimates would be ~$399+.

3. **One worktree session: brace-expansion override + 10-package dep batch + `npm run build:analyze` (P1).** Per May 21 security and performance agents. Apply `"brace-expansion": ">=5.0.6"` override and `npm install` to clear the only advisory; pair with the 10-package zero-CVE dep batch and run a fresh production build + analyzer to confirm bundle delta in one attributable commit. Stop dev server and `rm -rf .next` first.

### Cost Reduction Evaluation

4. **Evaluate Twilio phone number (P3)** — 94 days without a booking call. $1.39/mo actual ($16.68/yr). Consider releasing the number unless bookings are expected to resume.

5. **June decision point: evaluate Vercel Pro and Supabase Pro if drought continues (P3)** — At ~50 visitors/mo, both Pro tiers may be overprovisioned:
   - Vercel Pro ($20/mo): Hobby tier is free with reduced limits.
   - Supabase Pro ($25/mo): Free tier includes 500MB storage and 50K MAU.
   - Combined potential savings: up to $45/mo (~45% of operational costs).

6. **ElevenLabs Creator tier correctly sized.** No upgrade pressure. Scale tier ($99/mo) only warranted if sustained voice traffic exceeds 100 min/mo — currently 94 days dormant.

### Long-Term Planning

7. **Revenue trajectory is structurally unsustainable (P1 escalation).** Three complete zero-revenue months. Daily burn: $3.21/day. Break-even requires ~1,200 monthly visitors at 5% Day Pass conversion (currently ~50 visitors). Platform requires a growth event, aggressive cost reduction, or both. June is the natural decision point: if revenue remains $0, evaluate tier downgrades (Vercel Hobby + Supabase Free) to reduce operational burn by ~$45/mo.

---

## Data Sources

| Source | Method | Last Queried | Status |
|--------|--------|--------------|--------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-05-22 03:00 UTC | Pass |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=10` | 2026-05-22 03:00 UTC | Pass |
| Twilio Balance API | `/Balance.json` | 2026-05-22 03:00 UTC | Pass ($12.6746) |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json` | 2026-05-22 03:00 UTC | Pass (50 records, 0 non-zero in unfiltered set) |
| Twilio Phone Numbers Category | `/Usage/Records/ThisMonth.json?Category=phonenumbers` | 2026-05-22 03:00 UTC | Pass ($1.15) |
| Config: `service-tiers.ts` | File read | 2026-05-22 | Pass |
| Config: `recurring-costs.ts` | File read | 2026-05-22 | Pass ($1.39 Twilio, config-aligned) |
| Config: `forecast.ts` | File read | 2026-05-22 | Pass |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | — | Manual check required at platform.claude.com/settings/billing |
| Cross-agent context | Agent shared context | 2026-05-22 | Pass — security YELLOW (May 21, 1 moderate non-exploitable), coverage GREEN (May 22 — 98.66% stmt, 95.40% br, unchanged), performance YELLOW (May 21 — 18 KB total-JS headroom, build:analyze 17+ cycles overdue), documentation GREEN x27 (May 19), localization GREEN x55 (May 21) |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-05-23.*

---
