# Cost Analyst Report

> **Generated**: 2026-06-25 03:00 UTC | **Period**: June 2026 (day 25 of 30) | **Status**: WATCH

---

## Executive Summary

Both ElevenLabs and Twilio APIs queried successfully. Day 25 of June. ElevenLabs character count rose **+60 to 5,110 / 300,000 (1.703%)** after a fully flat Jun 24 — a small uptick, but still no new conversation visible in the last-10 window (last recorded conversation remains Jun 20 16:48 UTC, Coach agent, now the 5th consecutive day without a logged conversation). Twilio balance flat at **$11.2846** for the 18th consecutive day. The only non-zero June Twilio usage record is the $1.15 local-number base rental (posted Jun 7); the $0.24 regulatory fee reconciles via the balance drop but does not surface as a discrete usage record this cycle.

The platform's financial posture is unchanged and stable: fixed operational burn of **$99.65/mo ($3.32/day)**, variable spend of **$1.39** (Twilio recurring, fully posted), and **$0.00 revenue**. June day 25 has accrued approximately **$83.04** in operational costs. Cumulative operational loss since the February launch: **~$469.**

Revenue drought reaches **132 days** (since Feb 13). Paisaxe voice silence: **128 days** (since Feb 17). Both remain structurally unexplained by automated means — manual production verification of the Pelayo widget and Day Pass flow on paisaxe.es is the highest-priority outstanding action.

Twilio phone number evaluation window: **~12 days** until the next ~Jul 7 base rental charge. The release decision should be made before that date. The ElevenLabs cycle also resets ~Jul 7 15:15 UTC.

No new cost-structure anomalies detected. LLM quality signal remains GREEN (QA recovered 12/12 on Jun 22, stable through Jun 24; Jun 24 RAG miss is a content-language issue, not a cost or safety regression).

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

**ElevenLabs Creator billed annually at $266.20/yr (effective $22.18/mo). Next annual invoice: $266.20 on 2027-02-07 (Unix 1802012845, verified via API: amount_due_cents=26620, subtotal 22000). Current overage: $0.*

***Twilio config reflects actual recurring charge: $1.15 base + $0.24 regulatory fee = $1.39/mo. The $1.15 base appears as a usage record (posted Jun 7); the $0.24 fee reconciles via the balance drop.*

**Note**: Claude Code Max ($200/mo) is the primary development tool, categorized separately as "Development." Operational cost analysis focuses on the live service ($99.65/mo).

**Total Fixed Operational**: $99.65/mo | **Daily Burn Rate**: $3.32/day (June = 30 days)

### Variable / Usage-Based Costs (June 2026 — Day 25)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Phone rental base) | Posted Jun 7 | **$1.15** | Verified via API (only non-zero usage record) |
| Twilio (Regulatory fee) | Reconciled via balance | **$0.24** | Inferred from balance drop (no discrete record this cycle) |
| Twilio (SMS) | 0 messages | $0.00 | Verified via API (200 records scanned, 0 non-zero except base rental) |
| Twilio (Calls) | 0 minutes | $0.00 | Verified via API |
| ElevenLabs (overage) | 5,110 chars (within 300K) | $0.00 | Verified via API (current_overage = $0) |
| Stripe (Processing Fees) | 0 charges | $0.00 | — |
| Anthropic (Claude API) | Unknown | Unknown | No API on personal account |
| Voyage AI (Embeddings) | Unknown | Unknown | No dedicated API |
| **Total Variable (June day 25, confirmed)** | | **$1.39** | |

### June 2026 Position (Day 25 of 30)

| Category | Cost |
|----------|------|
| Fixed Operational (accrued, 25 days x $3.32) | ~$83.04 |
| Variable confirmed (Twilio base rental + reg fee, both posted) | $1.39 |
| **Total Operational (June MTD)** | **~$83.04** |
| Revenue | $0.00 |
| **Net (loss)** | **-$83.04** |

*Note: the $1.39/mo Twilio charge is embedded in the $3.32/day fixed burn rate; the "variable confirmed" line tracks the lumpy actual postings for reconciliation.*

### Monthly Cost History

| Month | Operational Fixed | Variable (confirmed) | Total Operational | Revenue (net) | Coverage |
|-------|-------------------|----------------------|-------------------|---------------|----------|
| Feb 2026 | ~$95 (ramping) | ~$2.75 | ~$97.75 | ~$9.98 | ~10.2% |
| Mar 2026 (final) | $99.41 | $1.15 | **$100.56** | **$0.00** | **0%** |
| Apr 2026 (final) | $99.41 | $1.39 | **$100.80** | **$0.00** | **0%** |
| May 2026 (final) | $99.65 | $1.39 | **$101.04** | **$0.00** | **0%** |
| Jun 2026 (day 25) | $99.65 (proj.) | $1.39 (both posted) | **~$101.04 (proj.)** | $0.00 (MTD) | 0% |

**Cumulative operational loss since February launch: ~$469.**

---

## Usage Metrics

### ElevenLabs Activity

API queried successfully. Live data:

- **Current cycle**: Started Jun 7 ~15:15 UTC. Characters used: **5,110 / 300,000 (1.703%)**. Day ~18 of ~30.
- **Change since Jun 24 report**: **+60 characters** (5,050 → 5,110) after a fully flat Jun 24. No new conversation visible in the last-10 window; last conversation remains Jun 20 16:48 UTC (5th consecutive day without a recorded conversation). The +60 likely reflects a small TTS/preview action not surfaced in the conversation log.
- **Paisaxe agents** (Visitor Pelayo, Booking Pelayo, Penny, Iris, Xander): **0 conversations since Feb 17** (128 days). No Paisaxe agent appears in the last-10 window.
- **Non-Paisaxe activity**: last-10 window is dominated by personal agents (Coach `agent_8201kmhr2vbef3`, Archy `agent_7901kk4r9v3wer`). No cost or security relevance to Paisaxe.
- Next reset: ~Jul 7 2026 15:15 UTC (Unix 1783437319).

### ElevenLabs Conversation Breakdown (Last 10, via API)

| Date (UTC) | Agent | Status | Call Result |
|------------|-------|--------|-------------|
| 2026-06-20 16:48 | Coach (agent_8201...) | done | failure |
| 2026-06-20 07:37 | Archy (agent_7901...) | done | success |
| 2026-06-20 07:36 | Archy (agent_7901...) | done | success |
| 2026-06-20 07:34 | Archy (agent_7901...) | done | success |
| 2026-06-20 07:27 | Archy (agent_7901...) | failed | failure (custom_llm generation failed) |
| ... | (older Archy / Coach entries) | mixed | mixed |

*No Paisaxe agent in the window. Latest conversation is 5 days stale.*

### ElevenLabs Subscription Details

| Field | Value |
|-------|-------|
| Tier | Creator |
| Billing period | Annual |
| Status | Active |
| Current cycle start | Jun 7 ~15:15 UTC |
| Next cycle reset | ~Jul 7 2026 15:15 UTC (Unix 1783437319) |
| Character limit | 300,000 |
| Characters used (current cycle) | 5,110 (+60 vs Jun 24, 1.703%) |
| Voice limit | 30 |
| Voice slots used | 0 / 30 |
| Current overage | $0.00 |
| Next annual invoice | $266.20 on 2027-02-07 (Unix 1802012845) |

### Twilio Communications

| Metric | June (day 25) | June (day 24) | Change |
|--------|--------------|---------------|--------|
| SMS Sent | 0 (verified) | 0 | flat |
| Calls | 0 (verified) | 0 | flat |
| Regulatory fee | $0.24 (reconciled) | $0.24 | flat |
| Phone Rental base | $1.15 (posted Jun 7) | $1.15 | flat |
| Balance | **$11.2846** (verified) | $11.2846 | flat (18th day) |

**Twilio balance reconciliation:**
- Jun 7: Balance fell to $11.2846 (June base phone-rental posted)
- Jun 8-25 (verified): **$11.2846** (flat — no new charge; 18th consecutive flat day)
- June recurring fully reconciled: $0.24 + $1.15 = $1.39 (matches config)
- Runway: $11.2846 / $1.39 = **~8.1 months**
- 200 usage records scanned, only the $1.15 base rental non-zero — consistent with all prior full scans.

### Stripe Revenue

| Metric | June (day 25) | May 2026 | Apr 2026 | Mar 2026 | Feb 2026 |
|--------|--------------|---------|---------|---------|---------|
| Net Sales | 0 | 0 | 0 | 0 | 6 |
| Net Revenue | $0.00 | $0.00 | $0.00 | $0.00 | $9.98 |

**132-day revenue drought** — No Day Pass sales since Feb 13.

---

## Cost Efficiency

| Metric | Current (Jun 25) | Previous (Jun 24) | Change | Trend |
|--------|------------------|-------------------|--------|-------|
| Fixed operational cost/mo (config) | **$99.65** | $99.65 | flat | flat |
| Daily burn rate (fixed) | **$3.32/day** | $3.32/day | flat | flat |
| Monthly variable spend (confirmed) | **$1.39** | $1.39 | flat | flat |
| ElevenLabs char utilization (current cycle) | **1.703%** | 1.683% | +0.020pp | up (marginal) |
| ElevenLabs voice min utilization (Paisaxe MTD) | 0% | 0% | flat | flat |
| Revenue coverage (operational) | **0%** | 0% | flat | flat |
| Twilio runway | **~8.1 months** | ~8.1 months | flat | flat |

ElevenLabs characters ticked up +60 to 5,110 after the first inter-day stall (Jun 24). Still $0 overage at 1.703% of the limit. Paisaxe voice efficiency remains unquantifiable — 128 consecutive days with zero Paisaxe voice conversations. Cost-per-chat and cost-per-visitor remain unquantifiable with no Paisaxe variable usage and no per-project Anthropic billing API.

**Cycle-average ElevenLabs rate (day ~18)**: 5,110 / 17.4 = ~293.5 chars/day. Projected cycle-end by Jul 7 (30 days from Jun 7): ~8,805 chars (2.94%). Rate continues the gentle deceleration trend (vs 297.1/day on Jun 24).

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Alert Level |
|---------|--------|------|-------|-------------|-------------|
| ElevenLabs | Characters (current cycle) | 5,110 | 300,000 | **1.703%** | SAFE |
| ElevenLabs | Voice Minutes (Paisaxe, June) | 0.0 | 100 | **0%** | SAFE |
| Vercel | Monthly Visitors | ~low | 500,000 (Pro) | **<1%** | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | SAFE |

All tier alerts clear. At the current cycle-average rate (~293 chars/day), the cycle will reach approximately 8,805 chars by Jul 7 — 2.94% of the 300K limit. No upgrade pressure on any service within 30 days at current usage.

### Upgrade Trigger Points

| Service | Current Tier | Trigger | Next Tier | Cost Jump |
|---------|--------------|---------|-----------|-----------|
| ElevenLabs | Creator ($22.18/mo eff.) | >100 min/mo | Scale ($99/mo) | +$77/mo |
| Supabase | Pro ($25/mo) | >8 GB storage | Team ($599/mo) | +$574/mo |
| PostHog | Free ($0) | >1M events/mo | Pay-as-you-go | Variable |

---

## Scaling Forecast

Based on `src/lib/costs/forecast.ts` logic (fixed costs constant, AI/voice variable costs scale linearly with the multiplier). With Paisaxe variable usage dormant, actual baseline usage is 0 — so a literal application of the forecast yields no variable growth. The scenarios below instead model a modest activation baseline (February-style traffic) with the file's fallback per-unit rates, to illustrate the cost shape if traffic resumes.

**Per-unit costs (fallback — no active production data):**
- Cost per voice minute: ~$0.08 (ElevenLabs overage fallback rate)
- Cost per chat: ~$0.01 (Claude API estimate fallback)

| Scenario | Visitors/mo | Voice Convos/mo | Voice Min/mo | Est. Monthly Cost (operational) |
|----------|-------------|-----------------|--------------|---------------------------------|
| **Current (1x, dormant)** | ~50 | ~0 | ~0 | ~$101.04 |
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
| 132-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. Three complete zero-revenue months (Mar, Apr, May), plus June day 25 on the same trajectory. Cumulative operational loss ~$469. |
| 128-day Paisaxe voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Manual production verification of the Pelayo widget and Day Pass flow on paisaxe.es remains the highest-priority outstanding action. |
| Twilio number evaluation window — ~12 days | **WATCH** | Next ~Jul 7 base rental charge is approximately 12 days away. With 128 days of zero booking calls, the release decision should be made before that date. Saving: $1.39/mo. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual check required at platform.anthropic.com/settings/billing. Config estimate $25/mo may be $40-60/mo based on observed credit grant frequency. Outstanding for multiple cycles. |

No new platform cost-structure anomalies detected. No >20% operational cost increase, no daily spend spike >2x average, no tier-limit proximity, no unexpected new service charges. The +60 ElevenLabs character increment is well within normal noise and carries no cost impact.

---

## Trend Analysis

### Comparison: Jun 24 (day 24) vs Jun 25 (day 25)

| Metric | Jun 24 | Jun 25 | Change | Direction |
|--------|--------|--------|--------|-----------|
| Variable costs (confirmed MTD) | $1.39 | $1.39 | flat | flat |
| Fixed accrued | ~$79.72 | ~$83.04 | +$3.32 | up (1 day) |
| Daily burn rate (fixed) | $3.32/day | $3.32/day | flat | flat |
| Twilio balance | $11.2846 | **$11.2846** | flat (18th day) | flat |
| Twilio runway | ~8.1 months | ~8.1 months | flat | flat |
| ElevenLabs chars (current cycle) | 5,050 / 300,000 | **5,110 / 300,000** | +60 | up (marginal) |
| ElevenLabs char utilization | 1.683% | **1.703%** | +0.020pp | up (marginal) |
| ElevenLabs cycle-average rate | 297.1 chars/day | **~293.5 chars/day** | -3.6/day | down |
| Projected cycle-end | ~8,913 chars (2.97%) | **~8,805 chars (2.94%)** | -108 chars | down |
| Paisaxe voice silence | 127 days | **128 days** | +1 | down |
| Revenue drought | 131 days | **132 days** | +1 | down |
| Cumulative operational loss | ~$466 | **~$469** | +$3 | down |
| Security advisories | 0 | 0 | flat | GREEN |
| LLM quality signal | GREEN | **GREEN** | flat | stable |

**Key observations:**

1. **ElevenLabs +60 chars after a flat day** — A small uptick to 5,110 (1.703%) breaks the Jun 24 inter-day stall, but the last logged conversation is still Jun 20 16:48 UTC (5 days stale). The cycle-average rate continues to drift down (293.5/day). No cost impact (still $0 overage).

2. **June on track to close at ~$101.04 operational / $0 revenue** — Identical to the Mar-May pattern. With 5 days remaining, no variable spending beyond the already-posted $1.39 Twilio recurring is expected unless Paisaxe voice or chat traffic resumes.

3. **Revenue drought at 132 days / 4.4 months** — Mar, Apr, May all closed at $0. June day 25 at $0. The structural break-even (~1,200 monthly visitors) remains roughly 24x the current traffic level (~50 visitors/mo).

4. **Twilio evaluation window closing** — ~12 days until the next ~Jul 7 base rental charge. With 128 days of zero booking calls and 8.1 months of remaining Twilio runway, this is a product decision that should be made before Jul 7. The ElevenLabs cycle also resets the same day.

5. **LLM quality signal stable** — QA recovered 12/12 on Jun 22 and held LLM tests near-100% through Jun 24 (the Jun 24 RAG miss is an English-query / Spanish-corpus content issue; journey-test keyboard failures are harness-level). No quality-signal cost risk this cycle.

---

## Recommendations

### Immediate Actions (Priority)

1. **Investigate the revenue and voice drought — 132 days (P1, CRITICAL).** Three-plus consecutive months without revenue. Manual checks required on paisaxe.es:
   - Is the Pelayo voice widget rendering and accessible on production?
   - Is the Day Pass purchase flow functional end-to-end?
   - Are Vercel deployment logs showing errors on production?
   - Has organic traffic dropped? (PostHog / Vercel Analytics dashboard)

2. **Verify Anthropic billing manually (P2)** — Visit platform.anthropic.com/settings/billing. Config estimate is $25/mo; observed credit grant patterns suggest $40-60/mo across all projects. If actual spend is $40+/mo, cumulative loss would be ~$484+. This check has been outstanding for multiple cycles.

3. **Twilio number release decision — ~12 days until next charge (~Jul 7) (P2).** The June charge is sunk; no in-month saving available. With 128 days without a booking call, evaluate before the next ~Jul 7 base charge. Releasing saves $1.39/mo but removes booking capability. This is a product decision — decide before Jul 7.

4. **Tier-downgrade / voice-shelving decision (P3).** A pure cost/product decision. If no growth event is expected:
   - Vercel Pro ($20/mo) -> Hobby (free). Caveat: Hobby disallows commercial use and removes per-minute cron precision the agents rely on — weigh against the cron schedule before downgrading.
   - Supabase Pro ($25/mo) -> Free (500MB storage, 50K MAU).
   - Shelving the ElevenLabs voice integration saves ~$22/mo effective (at the next renewal decision — annual plan sunk until 2027-02-07) and removes the click-to-mount ElevenLabs chunk burden.
   - Combined potential savings: up to ~$45/mo (~45% of operational cost).

### Long-Term Planning

5. **Revenue trajectory remains structurally unsustainable (P1 escalation).** Three-plus complete zero-revenue months. Daily burn: $3.32/day. Break-even requires ~1,200 monthly visitors at 5% Day Pass conversion (currently ~50 visitors). The platform requires a growth event, aggressive cost reduction, or both.

---

## Data Sources

| Source | Method | Last Queried | Status |
|--------|--------|--------------|--------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-06-25 03:00 UTC | Pass (5,110 chars / 300,000 — +60 vs Jun 24; cycle day ~18; next reset ~Jul 7 15:15 UTC) |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=10` | 2026-06-25 03:00 UTC | Pass (no new conversations; last activity Jun 20 16:48 UTC; all non-Paisaxe agents) |
| Twilio Balance API | `/Balance.json` | 2026-06-25 03:00 UTC | Pass ($11.2846, flat — 18th consecutive flat day) |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json?PageSize=200` | 2026-06-25 03:00 UTC | Pass (200 records scanned; only $1.15 base rental non-zero) |
| Config: `service-tiers.ts` | File read | 2026-06-25 | Pass |
| Config: `recurring-costs.ts` | File read | 2026-06-25 | Pass ($1.39 Twilio total) |
| Config: `forecast.ts` | File read | 2026-06-25 | Pass |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | — | Manual check required at platform.anthropic.com/settings/billing |
| Cross-agent context | Agent shared context | 2026-06-25 | Pass — QA Jun 24 LLM 11/12 (RAG content miss, no safety fail); Security Jun 24 GREEN (0 advisories, 8th consecutive, 8 Dependabot alerts closed); Performance Jun 24 GREEN (3,003 KB, 497 KB headroom; node_modules one dep-batch behind lockfile); Localization Jun 24 GREEN (411 leaf keys, 60th consecutive); Triage Jun 24 GREEN (4 Dependabot PRs merged) |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-06-26.*

---
