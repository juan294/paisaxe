# Cost Analyst Report

> **Generated**: 2026-07-18 01:01:15 UTC | **Period**: July 2026 (day 18 of 31) | **Status**: WATCH

---

## Executive Summary

Both live billing APIs (ElevenLabs, Twilio) queried successfully. The ElevenLabs cycle counter advanced from **21,500** (Jul 17 report) to **28,135 / 300,000 characters (9.378%)**, an increase of **+6,635** -- the largest single-day jump of the cycle. Unlike the Jul 16 direct-TTS bump, this one is fully explained by **10 new ConvAI conversations on Jul 17** (5 Archy, 3 story-interviewer, 2 support-faq -- all personal agents, all successful). Two notable non-cost observations: the agent previously listed as "Aria" now appears as **"story-interviewer"** (same historical conversation timestamps, so this is a rename, not a new agent), and a genuinely new personal agent **"support-faq"** made its first appearance. No Paisaxe agent (Visitor/Booking Pelayo, Penny, Iris, Xander) appears anywhere in the 15-conversation window. On the flat annual Creator subscription the increase carries **$0 marginal cost** (current_overage confirmed $0 via API).

The daily character buckets reconcile exactly to the subscription counter: Jul 8 (0) + Jul 9 (5,241) + Jul 10 (1,651) + Jul 11 (2,193) + Jul 12 (5,709) + Jul 13 (30) + Jul 14 (4,774) + Jul 15 (1,081) + Jul 16 (821) + Jul 17 (6,605) + Jul 18 partial (30) = **28,135**, matching `character_count` exactly. Cycle pace (~2,703 chars/day over ~10.4 elapsed cycle days) projects to roughly **~84K chars (~28%)** by the Aug 7 reset -- well under the 300,000 ceiling.

Twilio remains quiet and fully settled for July: balance flat at **$9.8946** (12th consecutive stable day), and the usage scan (521 records) again shows only the single expected **$1.15** base rental (regulatory fee $0.24 posted via balance adjustment), reconciling to July's **$1.39** total in `recurring-costs.ts`. The next release-decision gate is the **~Aug 7 charge (~20 days away)**.

July MTD confirmed operational spend is **~$54.79** (~17.0 days of fixed accrual at $3.2145/day; this run executed just after midnight UTC on day 18). Revenue: **$0.00**. Cumulative operational loss since the February launch: **~$535**.

Revenue drought reaches **155 days** (no Day Pass sale since Feb 13). Paisaxe voice silence reaches **151 days** (since Feb 17). Both remain consistent with the platform's known pre-traction / passive-mode status. One usage anomaly flagged at INFO severity (Jul 17 character spike >2x rolling average, zero cost impact); no cost-structure anomalies.

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

***Twilio config value $1.39/mo ($1.15 base rental + $0.24 regulatory fee). July balance flat at $9.8946 with the $1.39 fully posted; confirms the config value. No update needed.*

**Note**: Claude Code Max ($200/mo) is the primary development tool, categorized separately as "Development." Operational cost analysis focuses on the live service ($99.65/mo).

**Total Fixed Operational**: $99.65/mo | **Daily Burn Rate**: $3.2145/day (July = 31 days -> $99.65/31 = $3.2145/day)

### Variable / Usage-Based Costs (July 2026 -- Day 18)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (phone rental base) | Posted this month | $1.15 (within fixed $1.39) | Verified via Balance + Usage APIs |
| Twilio (regulatory fee) | Posted earlier this month | $0.24 (within fixed $1.39) | Reconciled via Balance API |
| Twilio (SMS) | 0 messages | $0.00 | Verified via API (521 records scanned) |
| Twilio (Calls) | 0 minutes | $0.00 | Verified via API |
| ElevenLabs (overage) | 28,135 chars in cycle (all non-Paisaxe -- personal-agent conversations + direct TTS) | $0.00 | Verified via API (current_overage=0) |
| Stripe (Processing Fees) | 0 charges | $0.00 | No credentials in this env; consistent with 5-month $0 pattern |
| Anthropic (Claude API) | Unknown | Unknown | No API on personal account |
| Voyage AI (Embeddings) | Unknown | Unknown | No dedicated billing API |
| **Total Variable (July MTD, incremental to fixed)** | | **$0.00** | Twilio's $1.39 is the cash realization of the recurring cost already inside the $99.65 fixed base |

### July 2026 Position (Day 18 of 31)

| Category | Cost |
|----------|------|
| Fixed Operational accrued (~17.0 days x $3.2145) | $54.79 |
| Variable incremental (July MTD) | $0.00 |
| **Total Operational (July MTD)** | **~$54.79** |
| Revenue | $0.00 |
| **Net (loss, MTD)** | **-$54.79** |

### Monthly Cost History

| Month | Operational Fixed | Variable (confirmed) | Total Operational | Revenue (net) | Coverage |
|-------|-------------------|----------------------|-------------------|---------------|----------|
| Feb 2026 | ~$95 (ramping) | ~$2.75 | ~$97.75 | ~$9.98 | ~10.2% |
| Mar 2026 (final) | $99.41 | $1.15 | **$100.56** | **$0.00** | **0%** |
| Apr 2026 (final) | $99.41 | $1.39 | **$100.80** | **$0.00** | **0%** |
| May 2026 (final) | $99.65 | $1.39 | **$101.04** | **$0.00** | **0%** |
| Jun 2026 (final) | $99.65 | $1.39 | **$101.04** | **$0.00** | **0%** |
| Jul 2026 (day 18, MTD) | $54.79 | $0.00 | **~$54.79** | **$0.00** | **0%** |

**Cumulative operational loss since February launch: ~$535 (through Jul 18 00:00 UTC).**

---

## Usage Metrics

### ElevenLabs Activity

API queried successfully (subscription endpoint + character-stats with explicit `start_unix`/`end_unix`). Live data:

- **Current cycle**: **28,135 / 300,000 characters (9.378%)**, day ~11 of ~31 (cycle opened Jul 7 15:15 UTC; next reset **Aug 7 2026 15:53 UTC**, unix 1786117985).
- **Source of the increase**: Daily buckets attribute **+6,605** to **Jul 17** and **+30** to the partial Jul 18 bucket. Unlike Jul 16 (direct TTS, no conversation), Jul 17's jump coincides with **10 new ConvAI conversations** spread across the day (08:47 to 17:20 UTC): 5 Archy, 3 story-interviewer, 2 support-faq -- all done/success. This is the busiest conversation day of the cycle.
- **Agent identity notes**: The agent previously reported as "Aria" now appears as **"story-interviewer"** -- the historical conversations (Jul 15 15:13 125 s, Jul 12 10:15 56 s, Jul 10 15:24/15:20) carry identical timestamps and durations, confirming a rename rather than new activity. **"support-faq"** is a genuinely new personal agent (first two conversations Jul 17 17:06/17:09). Neither is a Paisaxe agent.
- **Cycle-to-date reconciliation**: Jul 8 (0) + Jul 9 (5,241) + Jul 10 (1,651) + Jul 11 (2,193) + Jul 12 (5,709) + Jul 13 (30) + Jul 14 (4,774) + Jul 15 (1,081) + Jul 16 (821) + Jul 17 (6,605) + Jul 18 partial (30) = **28,135**, matching the subscription `character_count` exactly. The Jul 7 bucket (2,233) predates the 15:15 UTC cycle reset and is correctly excluded.
- **Paisaxe agents** (Visitor Pelayo, Booking Pelayo, Penny, Iris, Xander): **0 conversations since Feb 17** (151 days). No Paisaxe agent appears in any conversation window (15-conversation scan back to Jul 9).
- **Cycle pace**: 28,135 chars over ~10.4 elapsed cycle days (~2,703/day average) projects to **~84K chars (~28%)** by the Aug 7 reset -- well under the 300K limit. $0 overage confirmed via API.

### ElevenLabs Conversation Breakdown (Last 15, via API)

| Date (UTC) | Agent | Status | Call Result | Duration |
|------------|-------|--------|-------------|----------|
| 2026-07-17 17:20 | story-interviewer | done | success | 9 s |
| 2026-07-17 17:14 | story-interviewer | done | success | 14 s |
| 2026-07-17 17:14 | story-interviewer | done | success | 3 s |
| 2026-07-17 17:09 | support-faq | done | success | 6 s |
| 2026-07-17 17:06 | support-faq | done | success | 18 s |
| 2026-07-17 16:27 | Archy | done | success | 77 s |
| 2026-07-17 16:27 | Archy | done | success | 6 s |
| 2026-07-17 11:43 | Archy | done | success | 24 s |
| 2026-07-17 11:41 | Archy | done | success | 50 s |
| 2026-07-17 08:47 | Archy | done | success | 41 s |
| 2026-07-15 15:13 | story-interviewer | done | success | 125 s |
| 2026-07-12 10:15 | story-interviewer | done | success | 56 s |
| 2026-07-10 15:24 | story-interviewer | done | success | 107 s |
| 2026-07-10 15:20 | story-interviewer | done | success | 119 s |
| 2026-07-09 15:37 | Archy | done | success | 95 s |

*No Paisaxe agent in the conversation window. All ConvAI activity is from personal agents (Archy, story-interviewer -- formerly listed as Aria -- and the new support-faq). 10 of the last 15 conversations occurred on Jul 17; all succeeded (failure rate 0/10 for the day, an improvement over prior cycles' 25-50% Archy failure samples).*

### ElevenLabs Subscription Details

| Field | Value |
|-------|-------|
| Tier | Creator |
| Billing period | Annual |
| Status | Active |
| Current cycle start | Jul 7 2026 15:15 UTC |
| Next cycle reset | Aug 7 2026 15:53 UTC (unix 1786117985) |
| Character limit | 300,000 |
| Characters used (current cycle) | **28,135 (9.378%)** |
| Voice slots used | 0 / 30 |
| Current overage | $0.00 |
| Next annual invoice | $266.20 on 2027-02-07 15:07 UTC (unix 1802012845) |

### Twilio Communications

| Metric | Jul 18 (MTD) | June (final) | Change |
|--------|-------------|--------------|--------|
| SMS Sent | 0 (verified) | 0 | flat |
| Calls | 0 (verified) | 0 | flat |
| July base rental | Posted (-$1.15) | -- | posted |
| July regulatory fee | Posted (-$0.24) | -- | posted |
| Balance | **$9.8946** (verified, flat vs Jul 17) | $11.2846 | -$1.39 (July charges) |

**Twilio balance reconciliation:**
- July charges fully settled: balance flat at **$9.8946** since Jul 7 (12th consecutive stable day).
- Usage scan re-confirmed: 521 records, 3 non-zero (`phonenumbers-local` / `phonenumbers` / `totalprice`, all the same single $1.15 base rental at `price=1.15`). Regulatory fee $0.24 posted earlier via balance adjustment.
- July total Twilio cash: $0.24 + $1.15 = **$1.39** -- matches the Jun->Jul balance drop ($11.2846 -> $9.8946) and `recurring-costs.ts`.
- Runway: $9.8946 / $1.39 = **~7.1 months** (depletion ~Feb 2027, coinciding with the ElevenLabs renewal).
- Next release-decision gate: **before the ~Aug 7 charge (~20 days away).**

### Stripe Revenue

| Metric | Jul 18 (MTD) | Jun 2026 | May 2026 | Apr 2026 | Mar 2026 |
|--------|-------------|---------|---------|---------|---------|
| Net Sales | 0 | 0 | 0 | 0 | 0 |
| Net Revenue | $0.00 | $0.00 | $0.00 | $0.00 | $0.00 |

**155-day revenue drought** -- No Day Pass sales since Feb 13. Four complete zero-revenue months (Mar-Jun), July opening at $0. Consistent with the site's known pre-traction / passive-mode status. (Stripe API not queried this cycle -- no credentials in the agent environment; figure carried from prior reports and consistent with the 5-month $0 pattern. QA's Jul 14 live re-check confirmed `/api/checkout/health` reachable and auth-enforced on production -- payments infrastructure is up.)

---

## Cost Efficiency

| Metric | Current (Jul 18) | Previous (Jul 17) | Change | Trend |
|--------|------------------|-------------------|--------|-------|
| Fixed operational cost/mo (config) | **$99.65** | $99.65 | flat | flat |
| Daily burn rate (fixed) | **$3.2145/day** | $3.2145/day | flat | flat |
| Monthly variable spend (incremental, MTD) | **$0.00** | $0.00 | flat | flat |
| ElevenLabs char utilization (cycle) | **9.378% (28,135 chars, day ~11)** | 7.167% (21,500 chars, day ~10) | +6,635 chars | up (non-Paisaxe) |
| ElevenLabs voice min utilization (Paisaxe MTD) | 0% | 0% | flat | flat |
| Revenue coverage (operational) | **0%** | 0% | flat | flat |
| Twilio runway | **~7.1 months** | ~7.1 months | flat | flat |

Cost-per-chat, cost-per-voice-minute, and cost-per-visitor remain unquantifiable from live Paisaxe data: the platform itself has zero variable usage (151 days of Paisaxe voice silence), and there is no per-project Anthropic billing API. All observed ElevenLabs activity is non-Paisaxe (personal agents plus direct TTS), so no Paisaxe cost-efficiency metric changes. Forecast scenarios continue to rely on the fallback per-unit rates defined in `src/lib/costs/forecast.ts` ($0.01/chat, $0.08/voice-minute).

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Alert Level |
|---------|--------|------|-------|-------------|-------------|
| ElevenLabs | Characters (cycle, day ~11) | 28,135 | 300,000 | **9.378%** | SAFE |
| ElevenLabs | Voice Minutes (Paisaxe, July MTD) | 0.0 | 100 | **0%** | SAFE |
| Vercel | Monthly Visitors | ~low | 500,000 (Pro) | **<1%** | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | SAFE |

All tier alerts clear. ElevenLabs character utilization at 9.378%; a linear cycle-end projection (~28%) stays well under the limit. Even sustaining Jul 17's peak rate (6,605/day) for the remaining ~20.6 cycle days would land at ~164K chars (~55%) -- still no breach. No service is within 30 days of a tier limit at current usage.

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
| ElevenLabs Jul 17 usage spike (+6,605 chars, >2x rolling average) | **INFO (no cost impact)** | Jul 17's 6,605 chars is ~2.8x the prior-7-day rolling average (~2,323/day) -- technically trips the >2x spike rule, but fully attributed to 10 new personal-agent conversations (Archy, story-interviewer, support-faq), all successful, none Paisaxe. Flat annual Creator plan; overage $0; marginal cost $0. Usage anomaly, not a spend anomaly. |
| New personal agent "support-faq" + "Aria" renamed to "story-interviewer" | **INFO** | support-faq's first 2 conversations appeared Jul 17. Timestamp/duration matching confirms story-interviewer is the former Aria (rename, not new usage). Neither is Paisaxe-related and neither adds cost; noted for continuity of future conversation attribution. |
| Twilio number: August decision gate open | **WATCH** | July's $1.39 is fully sunk and the balance is stable at $9.8946 (12th consecutive flat day). Next charge ~Aug 7 (~20 days). Fifth-plus consecutive month of paying for a number with zero booking calls -- a deliberate release-or-retain decision before Aug 7 remains recommended. Saving if released: $1.39/mo ($16.68/yr). |
| 155-day revenue drought | **WATCH (known/accepted)** | No Day Pass sales since Feb 13. Four complete zero-revenue months (Mar-Jun), July opening at $0. Consistent with pre-traction / passive-mode status -- tracked, not a new incident. Cumulative operational loss ~$535. |
| 151-day Paisaxe voice silence | **WATCH (known/accepted)** | No Paisaxe voice conversations since Feb 17. All observed ElevenLabs activity is from personal agents. Manual production verification of the Pelayo widget on paisaxe.es remains the highest-value confirmation. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Manual check required at https://console.anthropic.com/settings/billing. Config estimate $25/mo. Outstanding for multiple cycles. |

No platform cost-structure anomalies: no >20% operational cost increase, no spend spike (the character spike carries $0 marginal cost), no tier-limit proximity within 30 days, no unexpected new service charges.

---

## Trend Analysis

### Comparison: Jul 17 vs Jul 18

| Metric | Jul 17 | Jul 18 | Change | Direction |
|--------|--------|--------|--------|-----------|
| Fixed accrued (MTD) | $54.65 (day 17) | $54.79 (~17.0 days elapsed) | +$0.14 (run at 01:01 UTC) | accruing |
| Variable costs (incremental MTD) | $0.00 | $0.00 | flat | flat |
| Daily burn rate (fixed) | $3.2145/day | $3.2145/day | flat | flat |
| Twilio balance | $9.8946 | **$9.8946** | flat | stable (July settled) |
| Twilio runway | ~7.1 months | ~7.1 months | flat | flat |
| ElevenLabs chars (cycle) | 21,500 / 300,000 (7.167%) | **28,135 / 300,000 (9.378%)** | +6,635 | up (non-Paisaxe) |
| Last ElevenLabs conversation (listed) | Jul 15 15:13 (Aria/story-interviewer) | **Jul 17 17:20 (story-interviewer)** | 10 new conversations Jul 17 | up (personal agents) |
| Paisaxe voice silence | 150 days | **151 days** | +1 | advancing |
| Revenue drought | 154 days | **155 days** | +1 | advancing |
| Cumulative operational loss | ~$535 | **~$535** | +$0.14 (partial-day accrual) | up |

**Key observations:**

1. **Usage pattern flipped back to conversation-driven, at the cycle's highest volume.** After Jul 16's direct-TTS-only day (+821), Jul 17 produced 10 conversations and 6,605 chars -- the busiest day of the cycle. All activity is personal-account (Archy, story-interviewer, support-faq); all conversations succeeded (0/10 failures, an improvement over the 25-50% Archy failure rates sampled in April-May). On the flat annual Creator plan this is $0 marginal cost; the plan remains underutilized (9.4% of 300K) with spend sunk until the 2027-02-07 renewal.

2. **Cycle pace rose but stays comfortably under the ceiling.** ~2,703 chars/day average (up from ~2,170) projects ~28% utilization by the Aug 7 reset. Even a sustained Jul 17-peak rate lands near 55%. No tier risk.

3. **Twilio is quiet and settled.** Balance flat at $9.8946 (12th consecutive stable day) with July's $1.39 fully posted and reconciled to config. The ~Aug 7 charge is ~20 days out -- still ample time for a deliberate release-or-retain call instead of a sixth silent rollover.

4. **July tracking the established pattern** -- ~$54.79 fixed MTD entering day 18, $0 incremental variable, $0 revenue. The four prior complete months all closed at ~$100.56-$101.04 operational / $0 revenue; July is on the identical trajectory (projected ~$99.65-$101.04).

5. **Cross-agent context (Jul 17-18)** -- Coverage (Jul 18 00:20): suite green, 7,274 tests, branch coverage +0.52pp to 97.32%; 14 test files uncommitted awaiting review -- no cost signal. QA (Jul 17 06:25): YELLOW on latency/harness grounds (2 LLM timeouts, ANSI-parse counter bug), all safety and boundary tests passed -- no cost signal. Security (Jul 17 07:09): GREEN, 0 advisories; 11-package safe batch cleared, typescript major isolated -- no cost signal. Performance (Jul 17 08:07): bundle GREEN (3,071 KB vs 3,500 KB budget) but harness RED (fail-open mtime check, 3rd cycle) -- confirmed the ElevenLabs 605,634 B chunk remains deferred and costs current users nothing at 151-day silence. The shared agent-script hardening pass is now flagged P1 by four agents.

6. **Cumulative loss ~$535 entering day 18 of July.** Structural break-even (~1,200 monthly visitors at 5% conversion) remains ~24x current traffic. Cost base is stable and near its floor short of the deliberate shelving decisions itemized below.

---

## Recommendations

### Immediate Actions (Priority)

1. **Make the Twilio call before the ~Aug 7 gate (P1, decision hygiene).** With July sunk and ~20 days of runway to the next charge, this remains the calm window for a deliberate decision. Options: (a) release the number, save $1.39/mo ($16.68/yr), remove the `twilio` entry from `src/config/recurring-costs.ts`; or (b) explicitly confirm retention as the cost of keeping booking-call capability warm. Either outcome is fine; a sixth consecutive silent rollover is the only bad one.

2. **Manual production verification of Pelayo + Day Pass (P2, confirmatory).** Unchanged and still the highest-value manual check: confirm on paisaxe.es that the Pelayo widget loads and Day Pass checkout completes. The 155/151-day droughts are consistent with passive mode, but only a production spot-check rules out silent breakage masking latent demand. QA's Jul 14 live probe confirmed the checkout health route reachable and auth-enforced, which covers infrastructure but not the end-to-end purchase flow.

3. **Verify Anthropic billing manually (P2).** Visit https://console.anthropic.com/settings/billing. Config estimate is $25/mo; if actual all-project spend is meaningfully higher, the ~$535 cumulative loss understates reality. Outstanding for multiple cycles -- no automated path exists on a personal account.

4. **Set `NEXT_PUBLIC_SENTRY_DSN` in Vercel production before the next release (P2, cross-agent from QA Jul 15).** No direct cost impact today, but leaving it unset will flip the production health endpoint to "degraded" on the next deploy -- worth closing before it becomes a false-alarm incident that consumes triage time.

5. **No action on ElevenLabs (informational).** Cycle at 9.378%, $0 overage, the Jul 17 spike fully attributed to successful personal-agent conversations. No cost or limit risk. Next meaningful checkpoint is the Aug 7 cycle reset, then the 2027-02-07 annual renewal. Future reports should attribute "story-interviewer" as the former "Aria" to keep conversation trends continuous.

### Long-Term Planning

6. **Feb 2027 remains the single voice/booking-stack decision point (P3).** Twilio balance depletion (~Feb 2027 at current burn) coincides with the ElevenLabs annual renewal (2027-02-07). If no traction event occurs by then, evaluate the entire voice stack (ElevenLabs ~$22.18/mo effective + Twilio $1.39/mo) as one shelving decision worth ~$23.57/mo (~24% of operational cost).
   - Additional levers at their own renewal windows: Vercel Pro ($20/mo) -> Hobby (caveat: no commercial use), Supabase Pro ($25/mo) -> Free (caveat: loses daily backups). Combined ceiling: up to ~$45/mo additional.

7. **Revenue trajectory is a growth constraint, not a cost anomaly (context).** Daily burn is stable at $3.2145/day and near its floor. Break-even requires ~1,200 monthly visitors at 5% conversion (currently ~50). No cost-side action closes this gap -- it requires a traffic/growth event or a deliberate shelving decision.

---

## Data Sources

| Source | Method | Last Queried | Status |
|--------|--------|--------------|--------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-07-18 | Pass (28,135 / 300,000 chars, 9.378%; next reset Aug 7 15:53 UTC; overage $0; next invoice $266.20 on 2027-02-07) |
| ElevenLabs Character Stats API | `/v1/usage/character-stats` (daily buckets, explicit start_unix/end_unix) | 2026-07-18 | Pass (Jul 7 = 2,233 [prior cycle]; Jul 8 = 0; Jul 9 = 5,241; Jul 10 = 1,651; Jul 11 = 2,193; Jul 12 = 5,709; Jul 13 = 30; Jul 14 = 4,774; Jul 15 = 1,081; Jul 16 = 821; Jul 17 = 6,605; Jul 18 = 30 [partial]; current-cycle sum = 28,135, matches subscription counter exactly) |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=15` | 2026-07-18 | Pass (10 new conversations Jul 17: 5 Archy, 3 story-interviewer, 2 support-faq, all success; "Aria" confirmed renamed to "story-interviewer"; no Paisaxe agent) |
| Twilio Balance API | `/Balance.json` | 2026-07-18 | Pass ($9.8946, flat vs Jul 17 -- July fully settled, 12th stable day) |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json?PageSize=1000` | 2026-07-18 | Pass (521 records, 3 non-zero -- the single $1.15 base rental at price=1.15) |
| Config: `service-tiers.ts` | File read | 2026-07-18 | Pass |
| Config: `recurring-costs.ts` | File read | 2026-07-18 | Pass ($1.39 Twilio total; $99.65 operational total) |
| Config: `forecast.ts` | File read | 2026-07-18 | Pass |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | -- | Manual check required at https://console.anthropic.com/settings/billing |
| Stripe Revenue | **NOT QUERIED** (no credentials in agent env) | -- | Figure carried from prior reports; consistent with 5-month $0 pattern. QA Jul 14 confirmed checkout health route up on production |
| Cross-agent context | Agent shared context | 2026-07-18 | Pass -- Coverage Jul 18 / QA, Security, Performance Jul 17 (no cost signal; agent-script hardening pass flagged P1 by four agents; Twilio/Anthropic decisions unchanged) |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-07-19.*

---
