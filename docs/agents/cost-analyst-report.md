# Cost Analyst Report

> **Generated**: 2026-07-15 01:03:28 UTC | **Period**: July 2026 (day 15 of 31) | **Status**: WATCH

---

## Executive Summary

Both live billing APIs (ElevenLabs, Twilio) queried successfully. The only moving number this cycle is again ElevenLabs: the current-cycle character counter advanced from **14,794** (Jul 13 report) to **19,598 / 300,000 characters (6.533%)**, an increase of **+4,804**. Daily-bucket character-stats attribute it to **Jul 13 (30 chars)** and **Jul 14 (4,774 chars)**. Critically, the ConvAI conversation list shows **zero new conversations since Jul 12** -- the entire Jul 14 bucket is **direct text-to-speech (TTS)**, not voice-agent activity. As with every prior uptick this cycle, it is **personal (non-Paisaxe)** usage on the flat annual Creator subscription, so it carries **$0 marginal cost**. No Paisaxe agent (Visitor/Booking Pelayo, Penny, Iris, Xander) appears anywhere in the 15-conversation window (which reaches back to Jun 20).

The cycle-to-date buckets reconcile exactly to the subscription counter: Jul 9 (5,241) + Jul 10 (1,651) + Jul 11 (2,193) + Jul 12 (5,709) + Jul 13 (30) + Jul 14 (4,774) = **19,598**. Six active days in the first ~7.4 days of the cycle -- the sporadic-burst pattern has become near-daily, but utilization remains low at 6.533% and a linear cycle-end projection (~2,645 chars/day -> ~82K, ~27.3%) stays far under the 300,000 ceiling. $0 overage confirmed via API.

Twilio is quiet and fully settled for July: balance held flat at **$9.8946** (unchanged since Jul 7 -- now the **9th consecutive stable day**), and the full-month usage scan (521 records) shows only the single expected **$1.15** base rental (regulatory fee $0.24 posted via balance adjustment), reconciling to July's **$1.39** total in `recurring-costs.ts`. The next release-decision gate is the **~Aug 7 charge (~23 days away)**.

July MTD confirmed operational spend is **~$48.22** (15 days of fixed accrual at $3.2145/day) against **$0.00 revenue**. Cumulative operational loss since the February launch: **~$529** (through Jul 15).

Revenue drought reaches **152 days** (no Day Pass sale since Feb 13). Paisaxe voice silence reaches **148 days** (since Feb 17). Both remain consistent with the platform's known pre-traction / passive-mode status. No cost-structure anomalies: no >20% operational-cost increase, no daily-spend spike with cost impact, no tier-limit proximity within 30 days, no unexpected new charges.

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

***Twilio config value $1.39/mo ($1.15 base rental + $0.24 regulatory fee). July balance held flat at $9.8946 with the $1.39 already fully posted; confirms the config value. No update needed.*

**Note**: Claude Code Max ($200/mo) is the primary development tool, categorized separately as "Development." Operational cost analysis focuses on the live service ($99.65/mo).

**Total Fixed Operational**: $99.65/mo | **Daily Burn Rate**: $3.2145/day (July = 31 days -> $99.65/31 = $3.2145/day)

### Variable / Usage-Based Costs (July 2026 -- Day 15)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (phone rental base) | Posted this month | $1.15 (within fixed $1.39) | Verified via Balance + Usage APIs |
| Twilio (regulatory fee) | Posted earlier this month | $0.24 (within fixed $1.39) | Reconciled via Balance API |
| Twilio (SMS) | 0 messages | $0.00 | Verified via API (521 records scanned) |
| Twilio (Calls) | 0 minutes | $0.00 | Verified via API |
| ElevenLabs (overage) | 19,598 chars in cycle (all non-Paisaxe / Aria + Archy + direct TTS) | $0.00 | Verified via API (current_overage=0) |
| Stripe (Processing Fees) | 0 charges | $0.00 | No credentials in this env; consistent with 5-month $0 pattern |
| Anthropic (Claude API) | Unknown | Unknown | No API on personal account |
| Voyage AI (Embeddings) | Unknown | Unknown | No dedicated billing API |
| **Total Variable (July MTD, incremental to fixed)** | | **$0.00** | Twilio's $1.39 is the cash realization of the recurring cost already inside the $99.65 fixed base |

### July 2026 Position (Day 15 of 31)

| Category | Cost |
|----------|------|
| Fixed Operational accrued (15 days x $3.2145) | $48.22 |
| Variable incremental (July MTD) | $0.00 |
| **Total Operational (July MTD)** | **~$48.22** |
| Revenue | $0.00 |
| **Net (loss, MTD)** | **-$48.22** |

### Monthly Cost History

| Month | Operational Fixed | Variable (confirmed) | Total Operational | Revenue (net) | Coverage |
|-------|-------------------|----------------------|-------------------|---------------|----------|
| Feb 2026 | ~$95 (ramping) | ~$2.75 | ~$97.75 | ~$9.98 | ~10.2% |
| Mar 2026 (final) | $99.41 | $1.15 | **$100.56** | **$0.00** | **0%** |
| Apr 2026 (final) | $99.41 | $1.39 | **$100.80** | **$0.00** | **0%** |
| May 2026 (final) | $99.65 | $1.39 | **$101.04** | **$0.00** | **0%** |
| Jun 2026 (final) | $99.65 | $1.39 | **$101.04** | **$0.00** | **0%** |
| Jul 2026 (day 15, MTD) | $48.22 | $0.00 | **~$48.22** | **$0.00** | **0%** |

**Cumulative operational loss since February launch: ~$529 (through Jul 15).**

---

## Usage Metrics

### ElevenLabs Activity

API queried successfully. Live data:

- **Current cycle**: **19,598 / 300,000 characters (6.533%)**, day ~7.4 of ~31 (cycle opened Jul 7 15:15 UTC; next reset **Aug 7 2026 15:53 UTC**, unix 1786117985).
- **Source of the increase**: Daily-bucket character-stats (`/v1/usage/character-stats`) attribute the **+4,804** increase to **Jul 13 (30)** and **Jul 14 (4,774)**. The cycle-to-date breakdown reconciles exactly to the subscription counter: Jul 9 (5,241) + Jul 10 (1,651) + Jul 11 (2,193) + Jul 12 (5,709) + Jul 13 (30) + Jul 14 (4,774) = **19,598**. The conversation list shows **no new ConvAI conversation since Jul 12 10:15** -- the entire Jul 13-14 usage is **direct TTS**, non-Paisaxe either way.
- **Paisaxe agents** (Visitor Pelayo, Booking Pelayo, Penny, Iris, Xander): **0 conversations since Feb 17** (148 days). No Paisaxe agent appears in any conversation window (15-conversation scan back to Jun 20).
- **Cycle pace**: 19,598 chars over ~7.4 elapsed cycle days, six active days (Jul 9/10/11/12/13/14). A naive linear projection (~2,645/day -> ~82K/cycle, ~27.3%) stays well under the 300K limit. $0 overage either way.

### ElevenLabs Conversation Breakdown (Last 15, via API)

| Date (UTC) | Agent | Status | Call Result | Duration |
|------------|-------|--------|-------------|----------|
| 2026-07-12 10:15 | Aria | done | success | 56 s |
| 2026-07-10 15:24 | Aria | done | success | 107 s |
| 2026-07-10 15:20 | Aria | done | success | 119 s |
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
| 2026-06-28 18:06 | Coach | done | success | 50 s |
| 2026-06-20 16:48 | Coach | done | failure | 42 s |

*No Paisaxe agent in the conversation window. All ConvAI activity is from personal agents (Aria, Archy, Coach). No new conversation since Jul 12 -- the Jul 13-14 character usage (+4,804) is entirely direct TTS, not voice-agent conversations.*

### ElevenLabs Subscription Details

| Field | Value |
|-------|-------|
| Tier | Creator |
| Billing period | Annual |
| Status | Active |
| Current cycle start | Jul 7 2026 15:15 UTC |
| Next cycle reset | Aug 7 2026 15:53 UTC (unix 1786117985) |
| Character limit | 300,000 |
| Characters used (current cycle) | **19,598 (6.533%)** |
| Voice slots used | 0 / 30 |
| Current overage | $0.00 |
| Next annual invoice | $266.20 on 2027-02-07 15:07 UTC (unix 1802012845) |

### Twilio Communications

| Metric | Jul 15 (MTD) | June (final) | Change |
|--------|-------------|--------------|--------|
| SMS Sent | 0 (verified) | 0 | flat |
| Calls | 0 (verified) | 0 | flat |
| July base rental | Posted (-$1.15) | -- | posted |
| July regulatory fee | Posted (-$0.24) | -- | posted |
| Balance | **$9.8946** (verified, flat vs Jul 13) | $11.2846 | -$1.39 (July charges) |

**Twilio balance reconciliation:**
- July charges fully settled: balance flat at **$9.8946** since Jul 7 (9th consecutive stable day).
- Usage scan re-confirmed: 521 records, 3 non-zero (`phonenumbers-local` / `phonenumbers` / `totalprice`, all the same single $1.15 base rental at `price=1.15`). Regulatory fee $0.24 posted earlier via balance adjustment.
- July total Twilio cash: $0.24 + $1.15 = **$1.39** -- matches the Jun->Jul balance drop ($11.2846 -> $9.8946) and `recurring-costs.ts`.
- Runway: $9.8946 / $1.39 = **~7.1 months** (depletion ~Feb 2027, coinciding with the ElevenLabs renewal).
- Next release-decision gate: **before the ~Aug 7 charge (~23 days away).**

### Stripe Revenue

| Metric | Jul 15 (MTD) | Jun 2026 | May 2026 | Apr 2026 | Mar 2026 |
|--------|-------------|---------|---------|---------|---------|
| Net Sales | 0 | 0 | 0 | 0 | 0 |
| Net Revenue | $0.00 | $0.00 | $0.00 | $0.00 | $0.00 |

**152-day revenue drought** -- No Day Pass sales since Feb 13. Four complete zero-revenue months (Mar-Jun), July opening at $0. Consistent with the site's known pre-traction / passive-mode status. (Stripe API not queried this cycle -- no credentials in the agent environment; figure carried from prior reports and consistent with the 5-month $0 pattern. QA's Jul 14 live re-check confirmed `/api/checkout/health` reachable and auth-enforced on production -- payments infrastructure is up.)

---

## Cost Efficiency

| Metric | Current (Jul 15) | Previous (Jul 13) | Change | Trend |
|--------|------------------|-------------------|--------|-------|
| Fixed operational cost/mo (config) | **$99.65** | $99.65 | flat | flat |
| Daily burn rate (fixed) | **$3.2145/day** | $3.2145/day | flat | flat |
| Monthly variable spend (incremental, MTD) | **$0.00** | $0.00 | flat | flat |
| ElevenLabs char utilization (cycle) | **6.533% (19,598 chars, day ~7.4)** | 4.931% (14,794 chars, day ~6) | +4,804 chars | up (non-Paisaxe) |
| ElevenLabs voice min utilization (Paisaxe MTD) | 0% | 0% | flat | flat |
| Revenue coverage (operational) | **0%** | 0% | flat | flat |
| Twilio runway | **~7.1 months** | ~7.1 months | flat | flat |

Cost-per-chat, cost-per-voice-minute, and cost-per-visitor remain unquantifiable from live Paisaxe data: the platform itself has zero variable usage (148 days of Paisaxe voice silence), and there is no per-project Anthropic billing API. All observed ElevenLabs activity is non-Paisaxe (personal agents plus direct TTS), so no Paisaxe cost-efficiency metric changes. Forecast scenarios continue to rely on the fallback per-unit rates defined in `src/lib/costs/forecast.ts` ($0.01/chat, $0.08/voice-minute).

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Alert Level |
|---------|--------|------|-------|-------------|-------------|
| ElevenLabs | Characters (cycle, day ~7.4) | 19,598 | 300,000 | **6.533%** | SAFE |
| ElevenLabs | Voice Minutes (Paisaxe, July MTD) | 0.0 | 100 | **0%** | SAFE |
| Vercel | Monthly Visitors | ~low | 500,000 (Pro) | **<1%** | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | SAFE |

All tier alerts clear. ElevenLabs character utilization at 6.533% even after six active days; a linear cycle-end projection (~27.3%) stays far under the limit. No service is within 30 days of a tier limit at current usage.

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
| ElevenLabs Jul 13-14 usage (+4,804 chars, zero new conversations) | **INFO (no cost impact)** | Daily buckets: Jul 13 = 30, Jul 14 = 4,774. No new ConvAI conversation since Jul 12 10:15 -- all direct TTS. Non-Paisaxe; flat annual Creator plan; overage $0. Six active days in ~7.4 cycle days -- the burst pattern has become near-daily, but the pace (~2,645/day) projects only ~27.3% of the 300K limit. Not a cost anomaly. |
| Twilio number: August decision gate open | **WATCH** | July's $1.39 is fully sunk and the balance is stable at $9.8946 (9th consecutive flat day). Next charge ~Aug 7 (~23 days). Fifth-plus consecutive month of paying for a number with zero booking calls -- a deliberate release-or-retain decision before Aug 7 remains recommended. Saving if released: $1.39/mo ($16.68/yr). |
| 152-day revenue drought | **WATCH (known/accepted)** | No Day Pass sales since Feb 13. Four complete zero-revenue months (Mar-Jun), July opening at $0. Consistent with pre-traction / passive-mode status -- tracked, not a new incident. Cumulative operational loss ~$529. |
| 148-day Paisaxe voice silence | **WATCH (known/accepted)** | No Paisaxe voice conversations since Feb 17. All observed ElevenLabs activity is from personal agents (Aria, Archy, Coach) plus direct TTS. Manual production verification of the Pelayo widget on paisaxe.es remains the highest-value confirmation. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual check required at https://console.anthropic.com/settings/billing. Config estimate $25/mo. Outstanding for multiple cycles. |

No platform cost-structure anomalies. No >20% operational cost increase, no daily-spend spike with cost impact (the ElevenLabs uptick is non-Paisaxe, zero cost), no tier-limit proximity, no unexpected new service charges.

---

## Trend Analysis

### Comparison: Jul 13 vs Jul 15

| Metric | Jul 13 | Jul 15 | Change | Direction |
|--------|--------|--------|--------|-----------|
| Fixed accrued (MTD) | $41.79 (day 13) | $48.22 (day 15) | +$6.43 (2 days) | accruing |
| Variable costs (incremental MTD) | $0.00 | $0.00 | flat | flat |
| Daily burn rate (fixed) | $3.2145/day | $3.2145/day | flat | flat |
| Twilio balance | $9.8946 | **$9.8946** | flat | stable (July settled) |
| Twilio runway | ~7.1 months | ~7.1 months | flat | flat |
| ElevenLabs chars (cycle) | 14,794 / 300,000 (4.931%) | **19,598 / 300,000 (6.533%)** | +4,804 | up (non-Paisaxe) |
| Last ElevenLabs conversation (listed) | Jul 12 10:15 (Aria) | **Jul 12 10:15 (Aria)** | none new | flat (Jul 13-14 usage was direct TTS) |
| Paisaxe voice silence | 146 days | **148 days** | +2 | advancing |
| Revenue drought | 150 days | **152 days** | +2 | advancing |
| Cumulative operational loss | ~$523 | **~$529** | +$6.43 (2-day accrual) | up |

**Key observations:**

1. **The only moving number is non-Paisaxe direct TTS.** The cycle character count went 14,794 -> 19,598 with zero new ConvAI conversations -- the Jul 14 bucket (4,774) is pure direct TTS on the personal account. On the flat annual Creator plan this is $0 marginal cost. The plan remains heavily underutilized (6.5% of a 300K limit); spend is sunk until the 2027-02-07 renewal.

2. **The usage pattern has shifted from sporadic bursts to near-daily activity** (six active days of ~7.4 cycle days), and the composition has shifted from ConvAI calls toward direct TTS (Jul 12 and Jul 14 buckets are both mostly/entirely TTS). Behavioral note only -- zero cost, zero limit risk, zero Paisaxe relevance.

3. **Twilio is quiet and settled.** Balance flat at $9.8946 (9th consecutive stable day) with July's $1.39 fully posted and reconciled to config. The next decision moment is the ~Aug 7 charge -- ~23 days out, ample time for a deliberate release-or-retain call instead of a sixth silent rollover.

4. **July tracking the established pattern** -- $48.22 fixed MTD by day 15 (halfway point), $0 incremental variable, $0 revenue. The four prior complete months all closed at ~$100.56-$101.04 operational / $0 revenue; July is on the identical trajectory (projected ~$101.04).

5. **Cross-agent context (Jul 14-15)** -- QA (Jul 14): YELLOW on a Stripe probe curl transport failure (HTTP 000); live re-check confirmed `/api/checkout/health` healthy and auth-enforced -- infrastructure fine, not a payments outage, and no cost signal. Security (Jul 14): GREEN, 0 advisories; watch item is the failed Dependabot npm_and_yarn updater run (Jul 13) -- no cost impact. Performance (Jul 14): GREEN plateau, total JS byte-flat; ElevenLabs 591 KB chunk fully deferred, zero cost to current users. Coverage (Jul 15): plateau, test-only, no cost relevance. None has cost impact.

6. **Cumulative loss ~$529 entering day 15 of July.** Structural break-even (~1,200 monthly visitors at 5% conversion) remains ~24x current traffic. Cost base is stable and near its floor short of the deliberate shelving decisions itemized below.

---

## Recommendations

### Immediate Actions (Priority)

1. **Make the Twilio call before the ~Aug 7 gate (P1, decision hygiene).** With July sunk and ~23 days of runway to the next charge, this is the calm window for a deliberate decision. Options: (a) release the number, save $1.39/mo ($16.68/yr), remove the `twilio` entry from `src/config/recurring-costs.ts`; or (b) explicitly confirm retention as the cost of keeping booking-call capability warm. Either outcome is fine; a sixth consecutive silent rollover is the only bad one.

2. **Manual production verification of Pelayo + Day Pass (P2, confirmatory).** Unchanged and still the highest-value manual check: confirm on paisaxe.es that the Pelayo widget loads and Day Pass checkout completes. The 152/148-day droughts are consistent with passive mode, but only a production spot-check rules out silent breakage masking latent demand. QA's Jul 14 live probe confirmed the checkout health route reachable and auth-enforced, which covers infrastructure but not the end-to-end purchase flow.

3. **Verify Anthropic billing manually (P2).** Visit https://console.anthropic.com/settings/billing. Config estimate is $25/mo; if actual all-project spend is meaningfully higher, the ~$529 cumulative loss understates reality. Outstanding for multiple cycles -- no automated path exists on a personal account.

4. **No action on ElevenLabs (informational).** Cycle at 6.533%, $0 overage, the Jul 13-14 increase fully attributed to personal direct TTS (no new conversations). The near-daily activity streak is worth a passing eye but carries no cost and no limit risk. Next meaningful checkpoint is the 2027-02-07 annual renewal.

### Long-Term Planning

5. **Feb 2027 remains the single voice/booking-stack decision point (P3).** Twilio balance depletion (~Feb 2027 at current burn) coincides with the ElevenLabs annual renewal (2027-02-07). If no traction event occurs by then, evaluate the entire voice stack (ElevenLabs ~$22.18/mo effective + Twilio $1.39/mo) as one shelving decision worth ~$23.57/mo (~24% of operational cost).
   - Additional levers at their own renewal windows: Vercel Pro ($20/mo) -> Hobby (caveat: no commercial use), Supabase Pro ($25/mo) -> Free (caveat: loses daily backups). Combined ceiling: up to ~$45/mo additional.

6. **Revenue trajectory is a growth constraint, not a cost anomaly (context).** Daily burn is stable at $3.2145/day and near its floor. Break-even requires ~1,200 monthly visitors at 5% conversion (currently ~50). No cost-side action closes this gap -- it requires a traffic/growth event or a deliberate shelving decision.

---

## Data Sources

| Source | Method | Last Queried | Status |
|--------|--------|--------------|--------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-07-15 | Pass (19,598 / 300,000 chars, 6.533%; next reset Aug 7 15:53 UTC; overage $0; next invoice $266.20 on 2027-02-07) |
| ElevenLabs Character Stats API | `/v1/usage/character-stats` (daily buckets, start_unix/end_unix ms) | 2026-07-15 | Pass (Jul 9 = 5,241; Jul 10 = 1,651; Jul 11 = 2,193; Jul 12 = 5,709; Jul 13 = 30; Jul 14 = 4,774; Jul 15 = 0; cycle sum = 19,598) |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=15` | 2026-07-15 | Pass (most recent still Jul 12 10:15 Aria 56 s; Jul 13-14 chars are direct TTS; no Paisaxe agent) |
| Twilio Balance API | `/Balance.json` | 2026-07-15 | Pass ($9.8946, flat vs Jul 13 -- July fully settled, 9th stable day) |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json?PageSize=1000` | 2026-07-15 | Pass (521 records, 3 non-zero -- the single $1.15 base rental at price=1.15) |
| Config: `service-tiers.ts` | File read | 2026-07-15 | Pass |
| Config: `recurring-costs.ts` | File read | 2026-07-15 | Pass ($1.39 Twilio total; $99.65 operational total) |
| Config: `forecast.ts` | File read | 2026-07-15 | Pass |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | -- | Manual check required at https://console.anthropic.com/settings/billing |
| Stripe Revenue | **NOT QUERIED** (no credentials in agent env) | -- | Figure carried from prior reports; consistent with 5-month $0 pattern. QA Jul 14 confirmed checkout health route up on production |
| Cross-agent context | Agent shared context | 2026-07-15 | Pass -- Coverage Jul 15, QA/Security/Performance Jul 14, Documentation/Localization Jul 14 (none cost-relevant) |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-07-16.*

---
