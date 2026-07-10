# Cost Analyst Report

> **Generated**: 2026-07-10 03:00:00 UTC | **Period**: July 2026 (day 10 of 31) | **Status**: WATCH

---

## Executive Summary

Both live billing APIs (ElevenLabs, Twilio) queried successfully. The one moving number this cycle is ElevenLabs: the current character counter has advanced from **0** (Jul 8 report) to **5,241 / 300,000 characters (1.747%)**. Daily-bucket stats attribute the entire increase to a single **Jul 9 "Archy" personal-agent conversation** (15:37 UTC, 95 s, success; plus an 08:08 UTC 18 s failure). Archy is a personal (non-Paisaxe) agent and the plan is a flat annual Creator subscription, so this usage carries **$0 marginal cost**. No Paisaxe agent appears anywhere in the conversation window.

Twilio is quiet and fully settled for July: balance held flat at **$9.8946** (unchanged since Jul 7), and the full-month usage scan shows July's expected **$1.39** total ($1.15 base rental + $0.24 regulatory fee), reconciling exactly with `recurring-costs.ts`. The next release-decision gate is the **~Aug 7 charge (~28 days away)**.

July MTD confirmed operational spend is **~$32.15** (10 days of fixed accrual at $3.2145/day) against **$0.00 revenue**. Cumulative operational loss since the February launch: **~$514** (through Jul 10).

Revenue drought reaches **147 days** (no Day Pass sale since Feb 13). Paisaxe voice silence reaches **143 days** (since Feb 17). Both remain consistent with the platform's known pre-traction / passive-mode status. No cost-structure anomalies: no >20% operational-cost increase, no tier-limit proximity within 30 days, no unexpected new charges. The Jul 9 ElevenLabs burst is a usage spike in absolute terms but is non-Paisaxe personal activity with zero cost impact.

---

## Current Costs (This Month)

### Fixed / Recurring Costs

| Service | Tier | Monthly Cost | % of Operational | Category | Trend |
|---------|------|-------------|-----------------|----------|-------|
| Claude Code Max | Max (20x Pro) | $200.00 | -- (dev) | Development | flat |
| Supabase | Pro | $25.00 | 25.1% | Infrastructure | flat |
| Anthropic Claude | Prepaid credits | $25.00* | 25.1% | AI | flat |
| ElevenLabs | Creator (annual) | $22.18** | 22.3% | AI / Voice | flat |
| Vercel | Pro | $20.00 | 20.1% | Infrastructure | flat |
| GitHub Pro | Pro | $4.00 | 4.0% | Infrastructure | flat |
| AWS Domains | -- | $2.08 | 2.1% | Infrastructure | flat |
| Twilio Phone Number | -- | $1.39*** | 1.4% | Communications | flat |
| PostHog | Free | $0.00 | 0% | Analytics | flat |
| **Total Fixed (all, config)** | | **$299.65** | | | |
| **Total Fixed (operational)** | | **$99.65** | **100%** | | |

*Anthropic $25/mo is the config estimate (all projects combined). No per-project breakdown available on personal accounts. Manual check required at https://console.anthropic.com/settings/billing. Outstanding for multiple cycles.*

**ElevenLabs Creator billed annually at $266.20/yr (effective $22.18/mo). API-confirmed this run: amount_due_cents=26620, subtotal_cents=22000, next_payment_attempt_unix=1802012845 (2027-02-07 15:07 UTC). Current overage: $0.*

***Twilio config value $1.39/mo fully realized for July: $0.24 regulatory fee + $1.15 base rental = $1.39 exactly. Config accurate; no update needed.*

**Note**: Claude Code Max ($200/mo) is the primary development tool, categorized separately as "Development." Operational cost analysis focuses on the live service ($99.65/mo).

**Total Fixed Operational**: $99.65/mo | **Daily Burn Rate**: $3.2145/day (July = 31 days -> $99.65/31 = $3.2145/day)

### Variable / Usage-Based Costs (July 2026 -- Day 10)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (regulatory fee) | Posted Jul 3-4 | $0.24 (within fixed $1.39) | Verified via Balance API |
| Twilio (phone rental base) | Posted Jul 6-7 | $1.15 (within fixed $1.39) | Verified via Balance + Usage APIs |
| Twilio (SMS) | 0 messages | $0.00 | Verified via API (521 records scanned) |
| Twilio (Calls) | 0 minutes | $0.00 | Verified via API |
| ElevenLabs (overage) | 5,241 chars in cycle (all non-Paisaxe / Archy) | $0.00 | Verified via API (current_overage=0) |
| Stripe (Processing Fees) | 0 charges | $0.00 | -- |
| Anthropic (Claude API) | Unknown | Unknown | No API on personal account |
| Voyage AI (Embeddings) | Unknown | Unknown | No dedicated billing API |
| **Total Variable (July MTD, incremental to fixed)** | | **$0.00** | Twilio's $1.39 is the cash realization of the recurring cost already inside the $99.65 fixed base |

### July 2026 Position (Day 10 of 31)

| Category | Cost |
|----------|------|
| Fixed Operational accrued (10 days x $3.2145) | $32.15 |
| Variable incremental (July MTD) | $0.00 |
| **Total Operational (July MTD)** | **~$32.15** |
| Revenue | $0.00 |
| **Net (loss, MTD)** | **-$32.15** |

### Monthly Cost History

| Month | Operational Fixed | Variable (confirmed) | Total Operational | Revenue (net) | Coverage |
|-------|-------------------|----------------------|-------------------|---------------|----------|
| Feb 2026 | ~$95 (ramping) | ~$2.75 | ~$97.75 | ~$9.98 | ~10.2% |
| Mar 2026 (final) | $99.41 | $1.15 | **$100.56** | **$0.00** | **0%** |
| Apr 2026 (final) | $99.41 | $1.39 | **$100.80** | **$0.00** | **0%** |
| May 2026 (final) | $99.65 | $1.39 | **$101.04** | **$0.00** | **0%** |
| Jun 2026 (final) | $99.65 | $1.39 | **$101.04** | **$0.00** | **0%** |
| Jul 2026 (day 10, MTD) | $32.15 | $0.00 | **~$32.15** | **$0.00** | **0%** |

**Cumulative operational loss since February launch: ~$514 (through Jul 10).**

---

## Usage Metrics

### ElevenLabs Activity

API queried successfully. Live data:

- **Current cycle**: **5,241 / 300,000 characters (1.747%)**, day ~3 of ~31 (cycle opened Jul 7 15:15 UTC; next reset **Aug 7 2026 15:53 UTC**, unix 1786117985).
- **Source of the increase**: Daily-bucket character-stats (`/v1/usage/character-stats`) attribute **all 5,241 chars to Jul 9** (0 on Jul 8, 0 on Jul 10 so far). This matches the new **Archy** conversation on **Jul 9 15:37 UTC (95 s, success)**; an earlier Jul 9 08:08 UTC Archy attempt failed (18 s). Archy is a personal (non-Paisaxe) agent; the burst is entirely non-Paisaxe.
- **Paisaxe agents** (Visitor Pelayo, Booking Pelayo, Penny, Iris, Xander): **0 conversations since Feb 17** (143 days). No Paisaxe agent appears in any conversation window.
- **Cycle pace**: 5,241 chars over the first ~3 cycle days, but concentrated in a single Jul 9 burst rather than a steady rate. Even a naive linear projection (~54K/cycle) stays well under the 300K limit; a realistic burst-driven projection is ~10-20K (3-7%). $0 overage either way.

### ElevenLabs Conversation Breakdown (Last 10, via API)

| Date (UTC) | Agent | Status | Call Result | Duration |
|------------|-------|--------|-------------|----------|
| 2026-07-09 15:37 | Archy | done | success | 95 s |
| 2026-07-09 08:08 | Archy | failed | failure | 18 s |
| 2026-07-07 14:51 | Aria | done | success | 258 s |
| 2026-07-05 11:23 | Aria | done | success | 136 s |
| 2026-07-05 11:18 | Aria | done | success | 11 s |
| 2026-07-05 11:17 | Aria | done | success | 8 s |
| 2026-07-05 11:15 | Aria | done | success | 8 s |
| 2026-07-05 11:13 | Aria | done | success | 6 s |
| 2026-07-05 11:11 | Aria | done | success | 7 s |
| 2026-07-03 06:07 | Coach | done | failure | 99 s |

*No Paisaxe agent in the last-10 window. All activity is from personal agents (Archy, Aria, Coach). The two new Jul 9 Archy entries are the first listed conversations since Jul 7.*

### ElevenLabs Subscription Details

| Field | Value |
|-------|-------|
| Tier | Creator |
| Billing period | Annual |
| Status | Active |
| Current cycle start | Jul 7 2026 15:15 UTC |
| Next cycle reset | Aug 7 2026 15:53 UTC (unix 1786117985) |
| Character limit | 300,000 |
| Characters used (current cycle) | **5,241 (1.747%)** |
| Voice slots used | 0 / 30 |
| Current overage | $0.00 |
| Next annual invoice | $266.20 on 2027-02-07 15:07 UTC (unix 1802012845) |

### Twilio Communications

| Metric | Jul 10 (MTD) | June (final) | Change |
|--------|-------------|--------------|--------|
| SMS Sent | 0 (verified) | 0 | flat |
| Calls | 0 (verified) | 0 | flat |
| July regulatory fee | Posted (-$0.24) | -- | posted |
| July base rental | Posted (-$1.15) | -- | posted |
| Balance | **$9.8946** (verified, flat vs Jul 8) | $11.2846 | flat |

**Twilio balance reconciliation:**
- July charges fully settled: balance flat at **$9.8946** since Jul 7 (4th consecutive stable day).
- Usage scan re-confirmed: 521 records, 3 non-zero (`phonenumbers-local` / `phonenumbers` / `totalprice`, all the same single $1.15 base rental). Regulatory fee $0.24 posted earlier in the month.
- July total Twilio cash: $0.24 + $1.15 = **$1.39 -- exactly matching `recurring-costs.ts`.**
- Runway: $9.8946 / $1.39 = **~7.1 months** (depletion ~Feb 2027, coinciding with the ElevenLabs renewal).
- Next release-decision gate: **before the ~Aug 7 charge (~28 days away).**

### Stripe Revenue

| Metric | Jul 10 (MTD) | Jun 2026 | May 2026 | Apr 2026 | Mar 2026 |
|--------|-------------|---------|---------|---------|---------|
| Net Sales | 0 | 0 | 0 | 0 | 0 |
| Net Revenue | $0.00 | $0.00 | $0.00 | $0.00 | $0.00 |

**147-day revenue drought** -- No Day Pass sales since Feb 13. Four complete zero-revenue months (Mar-Jun), July opening at $0. Consistent with the site's known pre-traction / passive-mode status.

---

## Cost Efficiency

| Metric | Current (Jul 10) | Previous (Jul 8) | Change | Trend |
|--------|------------------|-------------------|--------|-------|
| Fixed operational cost/mo (config) | **$99.65** | $99.65 | flat | flat |
| Daily burn rate (fixed) | **$3.2145/day** | $3.2145/day | flat | flat |
| Monthly variable spend (incremental, MTD) | **$0.00** | $0.00 | flat | flat |
| ElevenLabs char utilization (cycle) | **1.747% (5,241 chars, day ~3)** | 0.000% (day 1) | +5,241 chars | up (non-Paisaxe) |
| ElevenLabs voice min utilization (Paisaxe MTD) | 0% | 0% | flat | flat |
| Revenue coverage (operational) | **0%** | 0% | flat | flat |
| Twilio runway | **~7.1 months** | ~7.1 months | flat | flat |

Cost-per-chat, cost-per-voice-minute, and cost-per-visitor remain unquantifiable from live Paisaxe data: the platform itself has zero variable usage (143 days of Paisaxe voice silence), and there is no per-project Anthropic billing API. All observed ElevenLabs activity is non-Paisaxe (personal agents Archy/Aria/Coach), so no Paisaxe cost-efficiency metric changes. Forecast scenarios continue to rely on the fallback per-unit rates defined in `src/lib/costs/forecast.ts` ($0.01/chat, $0.08/voice-minute).

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Alert Level |
|---------|--------|------|-------|-------------|-------------|
| ElevenLabs | Characters (cycle, day ~3) | 5,241 | 300,000 | **1.747%** | SAFE |
| ElevenLabs | Voice Minutes (Paisaxe, July MTD) | 0.0 | 100 | **0%** | SAFE |
| Vercel | Monthly Visitors | ~low | 500,000 (Pro) | **<1%** | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | SAFE |

All tier alerts clear. ElevenLabs character utilization at 1.747% even after the Jul 9 burst; no service is within 30 days of a tier limit at current usage.

### Upgrade Trigger Points

| Service | Current Tier | Trigger | Next Tier | Cost Jump |
|---------|--------------|---------|-----------|-----------|
| ElevenLabs | Creator ($22.18/mo eff.) | >100 min/mo | Scale ($99/mo) | +$77/mo |
| Supabase | Pro ($25/mo) | >8 GB storage | Team ($599/mo) | +$574/mo |
| PostHog | Free ($0) | >1M events/mo | Pay-as-you-go | Variable |

---

## Scaling Forecast

Based on `src/lib/costs/forecast.ts` logic (fixed costs constant, AI/voice variable costs scale linearly with the multiplier). With Paisaxe variable usage dormant, scenarios use fallback per-unit rates and illustrative traffic assumptions.

**Per-unit costs (fallback -- no active production data):**
- Cost per voice minute: ~$0.08 (ElevenLabs overage fallback rate)
- Cost per chat: ~$0.01 (Claude API estimate fallback)

| Scenario | Visitors/mo | Voice Convos/mo | Voice Min/mo | Est. Monthly Cost (operational) |
|----------|-------------|-----------------|--------------|---------------------------------|
| **Current (1x, dormant)** | ~50 | ~0 | ~0 | ~$99.65 |
| **3x Growth** | ~150 | ~15 | ~180 | ~$192* |
| **10x Growth** | ~500 | ~50 | ~600 | ~$330** |

*At 3x: Voice minutes (180/mo) exceed the Creator limit (100 min/mo). Requires the Scale tier ($99/mo vs $22.18/mo effective).

**At 10x: Voice at 600 min/mo exceeds the Scale tier (500 min). Estimated $200+ for voice alone.

### Cost Forecast vs. Revenue Potential

| Scenario | Monthly Cost (op.) | Day Passes Needed to Break Even | Revenue at 5% Conversion |
|----------|--------------------|--------------------------------|--------------------------|
| Current (~50 visitors) | ~$100 | ~60 passes | ~$4.15 (2.5 passes) |
| ~1,200 visitors | ~$100 | ~60 passes | ~$99.60 (60 passes) |
| 5,000 visitors | ~$192 | ~116 passes | ~$414 (250 passes) |

*Break-even: ~1,200 monthly visitors at 5% Day Pass conversion (~$1.66 net/pass after Stripe fees).*

---

## Anomalies

| Finding | Severity | Details |
|---------|----------|---------|
| ElevenLabs Jul 9 usage burst (5,241 chars) | **INFO (no cost impact)** | Absolute usage spike vs the ~0-400 chars/day baseline, but daily-bucket stats attribute all of it to a single Jul 9 Archy personal-agent conversation (95 s success). Non-Paisaxe; flat annual Creator plan; overage $0. Not a cost anomaly. |
| Twilio number: August decision gate open | **WATCH** | July's $1.39 is fully sunk and the balance is stable at $9.8946. Next charge ~Aug 7 (~28 days). Fifth-plus consecutive month of paying for a number with zero booking calls -- a deliberate release-or-retain decision before Aug 7 remains recommended. Saving if released: $1.39/mo ($16.68/yr). |
| 147-day revenue drought | **WATCH (known/accepted)** | No Day Pass sales since Feb 13. Four complete zero-revenue months (Mar-Jun), July opening at $0. Consistent with pre-traction / passive-mode status -- tracked, not a new incident. Cumulative operational loss ~$514. |
| 143-day Paisaxe voice silence | **WATCH (known/accepted)** | No Paisaxe voice conversations since Feb 17. All observed ElevenLabs activity is from personal agents (Archy, Aria, Coach). Manual production verification of the Pelayo widget on paisaxe.es remains the highest-value confirmation. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual check required at https://console.anthropic.com/settings/billing. Config estimate $25/mo. Outstanding for multiple cycles. |

No platform cost-structure anomalies. No >20% operational cost increase, no daily-spend spike (the ElevenLabs burst is non-Paisaxe, zero cost), no tier-limit proximity, no unexpected new service charges.

---

## Trend Analysis

### Comparison: Jul 8 vs Jul 10

| Metric | Jul 8 | Jul 10 | Change | Direction |
|--------|--------|--------|--------|-----------|
| Fixed accrued (MTD) | $25.72 (day 8) | $32.15 (day 10) | +$6.43 | accruing |
| Variable costs (incremental MTD) | $0.00 | $0.00 | flat | flat |
| Daily burn rate (fixed) | $3.2145/day | $3.2145/day | flat | flat |
| Twilio balance | $9.8946 | **$9.8946** | flat | stable (July settled) |
| Twilio runway | ~7.1 months | ~7.1 months | flat | flat |
| ElevenLabs chars (cycle) | 0 / 300,000 | **5,241 / 300,000 (1.747%)** | +5,241 | up (non-Paisaxe) |
| Last ElevenLabs conversation (listed) | Jul 7 14:51 (Aria) | **Jul 9 15:37 (Archy, 95 s)** | new entries | non-Paisaxe |
| Paisaxe voice silence | 141 days | **143 days** | +2 | advancing |
| Revenue drought | 145 days | **147 days** | +2 | advancing |
| Cumulative operational loss | ~$508 | **~$514** | +$6.43 (2-day accrual) | up |

**Key observations:**

1. **The only moving number is non-Paisaxe.** The cycle character count went 0 -> 5,241, driven entirely by a single Jul 9 Archy personal-agent call. On the flat annual Creator plan this is $0 marginal cost. The Creator plan remains heavily underutilized (1.7% of a 300K limit); spend is sunk until the 2027-02-07 renewal.

2. **Twilio is quiet and settled.** Balance flat at $9.8946 with July's $1.39 fully posted and reconciled to config. The next decision moment is the ~Aug 7 charge -- ~28 days out, ample time for a deliberate release-or-retain call instead of a sixth silent rollover.

3. **July tracking the established pattern** -- $32.15 fixed MTD by day 10, $0 incremental variable, $0 revenue. The four prior complete months all closed at ~$100.56-$101.04 operational / $0 revenue; July is on the identical trajectory (projected ~$101.04).

4. **Cross-agent context (Jul 9)** -- QA: GREEN (LLM 12/12, journeys 10/10, first fully clean sweep since the Jul 5-8 flake sequence; #714 hallucination test not in today's sample, kept open). Security: GREEN, 0 advisories; Dependabot #73 (@babel/core, LOW) confirmed NOT stale -- it tracks `main` (whose lockfile still holds 7.29.0) and will clear only on the next develop->main release; not exploitable on either branch. Performance: GREEN, formal post-#717/#718 baseline 3,057 KB total JS (443 KB headroom), P1 Supabase deferral verified effective. Localization/Documentation: clean. None has cost impact.

5. **Cumulative loss ~$514 entering day 10 of July.** Structural break-even (~1,200 monthly visitors at 5% conversion) remains ~24x current traffic. Cost base is stable and near its floor short of the deliberate shelving decisions itemized below.

---

## Recommendations

### Immediate Actions (Priority)

1. **Make the Twilio call before the ~Aug 7 gate (P1, decision hygiene).** With July sunk and ~28 days of runway to the next charge, this is the calm window for a deliberate decision. Options: (a) release the number, save $1.39/mo ($16.68/yr), remove the `twilio` entry from `src/config/recurring-costs.ts`; or (b) explicitly confirm retention as the cost of keeping booking-call capability warm. Either outcome is fine; a sixth consecutive silent rollover is the only bad one.

2. **Manual production verification of Pelayo + Day Pass (P2, confirmatory).** Unchanged and still the highest-value manual check: confirm on paisaxe.es that the Pelayo widget loads and Day Pass checkout completes. The 147/143-day droughts are consistent with passive mode, but only a production spot-check rules out silent breakage masking latent demand. All automated QA signals are GREEN as of Jul 9, so this is now the only remaining probe for the drought.

3. **Verify Anthropic billing manually (P2).** Visit https://console.anthropic.com/settings/billing. Config estimate is $25/mo; if actual all-project spend is meaningfully higher, the ~$514 cumulative loss understates reality. Outstanding for multiple cycles -- no automated path exists on a personal account.

4. **No action on ElevenLabs (informational).** Cycle at 1.747%, $0 overage, the Jul 9 increase fully attributed to a personal (non-Paisaxe) Archy call. Next meaningful checkpoint is the 2027-02-07 annual renewal.

### Long-Term Planning

5. **Feb 2027 remains the single voice/booking-stack decision point (P3).** Twilio balance depletion (~Feb 2027 at current burn) coincides with the ElevenLabs annual renewal (2027-02-07). If no traction event occurs by then, evaluate the entire voice stack (ElevenLabs ~$22.18/mo effective + Twilio $1.39/mo) as one shelving decision worth ~$23.57/mo (~24% of operational cost).
   - Additional levers at their own renewal windows: Vercel Pro ($20/mo) -> Hobby (caveat: no commercial use), Supabase Pro ($25/mo) -> Free (caveat: loses daily backups). Combined ceiling: up to ~$45/mo additional.

6. **Revenue trajectory is a growth constraint, not a cost anomaly (context).** Daily burn is stable at $3.2145/day and near its floor. Break-even requires ~1,200 monthly visitors at 5% conversion (currently ~50). No cost-side action closes this gap -- it requires a traffic/growth event or a deliberate shelving decision.

---

## Data Sources

| Source | Method | Last Queried | Status |
|--------|--------|--------------|--------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-07-10 | Pass (5,241 / 300,000 chars, 1.747%; next reset Aug 7 15:53 UTC; overage $0; next invoice $266.20 on 2027-02-07) |
| ElevenLabs Character Stats API | `/v1/usage/character-stats` (daily buckets) | 2026-07-10 | Pass (Jul 9 = 5,241 chars; Jul 8 and Jul 10 = 0) |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=10` | 2026-07-10 | Pass (Jul 9 Archy 15:37 UTC 95 s success + 08:08 UTC 18 s failure account for the burst) |
| Twilio Balance API | `/Balance.json` | 2026-07-10 | Pass ($9.8946, flat vs Jul 8 -- July fully settled) |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json?PageSize=1000` | 2026-07-10 | Pass (521 records, 3 non-zero -- the single $1.15 base rental) |
| Config: `service-tiers.ts` | File read | 2026-07-10 | Pass |
| Config: `recurring-costs.ts` | File read | 2026-07-10 | Pass ($1.39 Twilio total confirmed by live July charges; $99.65 operational total) |
| Config: `forecast.ts` | File read | 2026-07-10 | Pass |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | -- | Manual check required at https://console.anthropic.com/settings/billing |
| Cross-agent context | Agent shared context | 2026-07-10 | Pass -- QA Jul 9 (GREEN, 12/12 + 10/10); Security Jul 9 (GREEN, 0 advisories, #73 tracks main); Performance Jul 9 (GREEN, 3,057 KB baseline); Localization/Documentation Jul 9 (clean) |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-07-11.*

---
