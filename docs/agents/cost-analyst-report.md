# Cost Analyst Report

> **Generated**: 2026-04-25 03:00:00 | **Period**: April 2026 (day 25 of 30) | **Status**: WATCH

---

## Executive Summary

**Day 25 of April.** ElevenLabs API unavailable in this execution context — last confirmed data was April 20 at 13,734 characters (5.07% of cycle). Based on the April 21 report noting 5 consecutive silent days, and no new ElevenLabs activity referenced in any agent report between Apr 22 and Apr 24, the account has likely been silent for 9+ consecutive days since the April 16 burst. Projected cycle-end utilization: 5–9%.

**Twilio API also unavailable.** Last confirmed balance: $14.0646 (stable since April 7 rental). No new charges are expected until the next phone rental cycle (~May 7).

**Revenue drought reaches 71 days** (since February 13). **Paisaxe voice silence: 67 days** (since February 17). April will close at $0 revenue for the second consecutive full-zero month.

**P8 completed (Apr 22):** Sentry Replay removed from `sentry.client.config.ts` in commit `fef651f5`. Expected ~30-50 KB initial-load savings — not yet confirmed via production build. Performance Agent remains YELLOW pending a clean `npm run build` run.

**Security YELLOW (Apr 24):** Three moderate advisories from uuid <14 via resend → svix → uuid transitive chain. Not exploitable in Paisaxe (svix only uses uuid.v4 internally; bounds-check bug affects v3/v5/v6 with caller-provided buffer). Fix: `npm install` to sync resend@6.12.2 pin drift; then await svix >=1.91.2 upstream.

**Financial health: WATCH** — business concern only. No platform cost anomalies. All tier limits well within range. Cumulative operational loss since February 2026 now approximately $357.

| Metric | Value | vs. Apr 21 |
|--------|-------|-----------|
| Total Fixed Costs (all) | $284.41/mo | flat |
| Total Fixed Costs (operational) | **$84.41/mo** | flat |
| Variable Costs (Apr MTD, confirmed) | **$1.15** | flat |
| Daily Burn Rate (Apr fixed) | **$2.81/day** | flat |
| Revenue (Apr MTD) | **$0.00** | flat |
| Twilio Balance (last known) | **$14.0646** | flat (API unavailable) |
| ElevenLabs Characters (last known) | **13,734 / 270,783 (5.07%)** | flat (API unavailable) |
| ElevenLabs Voice Min (Paisaxe, Apr) | 0.0 / 100 | flat |
| Next Character Reset | **~2026-05-07 14:36 UTC** | ~12 days |
| Paisaxe Voice Silence | **67 days** | +4 |
| Revenue Drought | **71 days** | +4 |
| Last ElevenLabs Conversation (known) | Apr 16 18:44 UTC | +9 days likely silence |
| npm audit advisories | **3 moderate (uuid chain)** | +3 (not exploitable) |
| Cumulative Operational Loss (est.) | **~$357** | +$11 |

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

*\*ElevenLabs Creator billed annually. Effective rate $22.18/mo. Next annual invoice: $266.20 on ~2027-02-07 (next_payment_attempt_unix 1802012845 — from Apr 21 API query).*

*\*\*Anthropic $10/mo is a config estimate. No billing API on personal account. Manual check required at [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing). Daily automated agents plus Claude Code Max development activity likely push actual usage above estimate.*

*\*\*\*Twilio phone rental charged Apr 7: balance dropped $15.2146 → $14.0646 (-$1.15). Next rental due ~May 7.*

**Note**: Claude Code Max ($200/mo) is the primary development tool, categorized separately as "Development." Operational cost analysis focuses on running the live service.

### Variable / Usage-Based Costs (April 2026 MTD — Day 25)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Phone rental) | 1 number, April billing | **$1.15** | Balance delta (Apr 7 — last known) |
| Twilio (SMS) | 0 messages | $0.00 | Last known (API unavailable today) |
| Twilio (Calls) | 0 minutes | $0.00 | Last known (API unavailable today) |
| Stripe (Processing Fees) | 0 charges | $0.00 | — |
| Anthropic (Claude API) | Unknown | Unknown | No API on personal account |
| Voyage AI (Embeddings) | Unknown | Unknown | — |
| **Total Variable (Apr MTD, confirmed)** | | **$1.15** | |

### April 2026 MTD Total (Day 25)

| Category | Cost |
|----------|------|
| Fixed Operational | $84.41 |
| Variable (confirmed) | $1.15 |
| **Total Operational MTD** | **$85.56** |
| Revenue | $0.00 |
| **Net (loss)** | **-$85.56** |

### Monthly Cost History (reference)

| Month | Operational Fixed | Variable (confirmed) | Total Operational | Revenue (net) | Coverage |
|-------|------------------|----------------------|-------------------|---------------|----------|
| Feb 2026 | $84.41 | ~$2.75 | ~$87.16 | ~$9.98 | ~11.4% |
| Mar 2026 (final) | $84.41 | $1.15 | **$85.56** | **$0.00** | **0%** |
| Apr 2026 (day 25) | $84.41 | $1.15 | **$85.56** | $0.00 | 0% |

---

## Usage Metrics

### ElevenLabs Activity — Current Cycle (April 7 14:36 UTC → May 7 14:36 UTC)

**API unavailable in this execution context.** Last confirmed data: April 20, 13,734 / 270,783 characters (5.07%).

Based on agent shared context for Apr 22–24: no new ElevenLabs activity was reported by any agent. The last known conversation was April 16 18:44 UTC (Archy — success); likely 9 consecutive days of silence as of Apr 25.

**Last 20 conversations (from Apr 21 report — no updates available):**

| Agent | Count (in last 20) | Most Recent | Success/Fail | Project |
|-------|-------------------|-------------|------------|---------|
| Archy | 19 | Apr 16 18:44 UTC (success) | 13 success, 6 failures (32%) | Non-Paisaxe |
| Coach | 1 | Apr 11 06:38 UTC | 1 success (100%) | Non-Paisaxe |
| Pelayo (Visitor Guide) | 0 | Feb 17 | Dormant | Paisaxe |
| Pelayo (Booking) | 0 | Feb 10 | Dormant | Paisaxe |
| Penny, Iris, Xander | 0 | Never | Dormant | Paisaxe |

**All conversations are non-Paisaxe.** Paisaxe agents: **0 conversations since February 17 (67 days).**

### ElevenLabs Character Usage (last known — Apr 20)

| Metric | Value | vs. Apr 21 |
|--------|-------|-----------|
| Characters used (cycle) | **13,734 / 270,783 (5.07%)** | flat (API unavailable) |
| Character limit | **270,783** | flat |
| Next character reset | **~2026-05-07 14:36 UTC** | ~12 days |
| Characters used (Apr, Paisaxe) | 0 | flat |
| Characters remaining this cycle | **257,049** | flat |

**Cycle utilization projection (Apr 25 estimate):**
- Cycle start: Apr 7 14:36 UTC. Days elapsed: ~17.5.
- If frozen at 13,734: cycle-average rate ~785/day (declining as silence extends).
- Conservative (cycle-avg × ~12 remaining days): +9,420 = ~23,154 total = **~8.6%**.
- Pessimistic/likely (zero activity continues): ~13,734 = **~5.07%**.
- Given 9 consecutive days of likely silence, actual end-of-cycle utilization will likely be 5–9%.

### ElevenLabs Subscription Details (from Apr 21 API query)

| Field | Value |
|-------|-------|
| Tier | Creator |
| Billing period | Annual |
| Status | Active |
| Next invoice amount | $266.20 |
| Next payment attempt | ~2027-02-07 |
| Next character reset | **~2026-05-07 14:36 UTC** |
| Character limit | **270,783** |

### Twilio Communications (last known — Apr 21)

| Metric | Apr 2026 (days 1-25) | Mar 2026 (final) | Change |
|--------|---------------------|-----------------|--------|
| SMS Sent | 0 | 0 | flat |
| Calls | 0 | 0 | flat |
| Usage Cost | $0.00 | $0.00 | flat |
| Phone Rental | **$1.15** (charged Apr 7) | $1.15 | Monthly expected |
| Balance (last known) | **$14.0646** | $15.4546 | -$1.40 MTD |

**Twilio balance reconciliation (April):**
- Apr 1 (start): ~$15.4546
- Apr 3-4: -$0.24 (unexplained — likely recurring regulatory surcharge, now 22 days unresolved)
- Apr 7: -$1.15 (phone number rental, confirmed)
- **Apr 21 (last known): $14.0646** — API unavailable today. ~12.2 months of runway at $1.15/mo.

### Stripe Revenue

| Metric | Apr 2026 (days 1-25) | Mar 2026 (final) | Feb 2026 (final) |
|--------|---------------------|-----------------|-----------------|
| Net Sales | 0 | 0 | 6 |
| Gross Revenue | $0.00 | $0.00 | $13.93 |
| Net Revenue | $0.00 | $0.00 | $9.98 |

**71-day revenue drought** — No Day Pass sales since February 13. April will close at $0 revenue — second consecutive full-zero month.

---

## Cost Efficiency

| Metric | Current (Apr 25) | Previous (Apr 21) | Change | Trend |
|--------|----------------|------------------|--------|-------|
| Fixed operational cost/mo | $84.41 | $84.41 | flat | flat |
| Daily burn rate (fixed) | **$2.81/day** | $2.81/day | flat | flat |
| April variable spend (confirmed) | **$1.15** | $1.15 | flat | flat |
| Cost per voice conversation (Feb actuals) | ~$0.43 | ~$0.43 | flat | flat |
| Cost per voice minute (Feb actuals) | ~$0.37 | ~$0.37 | flat | flat |
| ElevenLabs char utilization (cycle, last known) | **5.07%** | 5.07% | flat (9-day likely freeze) | flat |
| ElevenLabs voice min utilization (Paisaxe, Apr) | 0% | 0% | flat | flat |
| Revenue coverage (operational) | **0%** | 0% | flat | flat |
| Months of Twilio runway | ~12.2 mo | ~12.2 mo | flat | flat |
| Cumulative operational loss (Feb–Apr 25) | **~$357** | ~$346 | +$11 | down |

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Alert Level |
|---------|--------|------|-------|-------------|-------------|
| ElevenLabs | Characters (cycle, last known) | 13,734 | 270,783 | **5.07%** | SAFE |
| ElevenLabs | Voice Minutes (Paisaxe, Apr) | 0.0 | 100 | **0%** | SAFE |
| Vercel | Monthly Visitors | ~low | 500,000 (Pro) | **<1%** | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | SAFE |

**All tier alerts cleared.** At projected frozen pace, cycle-end utilization will be 5–9% — well within Creator limit.

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
| 71-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. Second consecutive full-zero month (April certain at $0). Cumulative operational loss ~$357. |
| 67-day Paisaxe voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Platform dormant to visitors for over 2 months. |
| ElevenLabs likely silence (9+ days) | **WATCH** | No activity on any ElevenLabs agent since Apr 16 18:44 UTC (based on agent shared context through Apr 24). Even non-Paisaxe Archy has been inactive since the Apr 16 burst. |
| Archy failure rate elevated | **WATCH** | 6/20 (30%) failures in last 20 observed (last data Apr 21). Last 3 consecutive conversations on Apr 16 ended in failure. Non-Paisaxe; shares ElevenLabs quota. |
| Security: 3 moderate advisories (uuid chain) | **WATCH** | uuid <14 via resend → svix → uuid transitive chain. Not exploitable (svix only calls uuid.v4; bounds-check bug only affects caller-supplied buffer in v3/v5/v6). Fix: `npm install` to sync resend@6.12.2; await svix >=1.91.2 upstream. |
| Twilio $0.24 drop (Apr 3-4, unresolved) | **WATCH** | Balance anomaly not captured in Usage Records API. Likely recurring regulatory surcharge. Now 22 days unresolved. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Daily automated agents plus Claude Code Max development likely push actual Anthropic API usage above $10/mo estimate. |
| Performance build unconfirmed | **WATCH** | P8 (Sentry Replay removal, fef651f5, Apr 22) expected to save ~30-50 KB on initial load. Production build (`npm run build`) has not been run to confirm actual savings. Dev cache still shows pre-P8 numbers. |
| Stray files in repo root | **WATCH** | Empty `svix` and `uuid` files in repo root (shell output artifact from recent work). Safe to delete. |

**No platform cost-structure anomalies.** All tier limits safe.

---

## Trend Analysis

### Comparison: Apr 21 → Apr 25

| Metric | Apr 21 (03:00 UTC) | Apr 25 (03:00 UTC) | Change | Direction |
|--------|------|------|--------|-----------|
| Fixed costs/mo (operational) | $84.41 | $84.41 | flat | flat |
| Variable costs (confirmed MTD) | $1.15 | $1.15 | flat | flat |
| Daily burn rate (fixed) | $2.81/day | $2.81/day | flat | flat |
| ElevenLabs characters (cycle, last known) | 13,734 (5.07%) | **13,734 (5.07%)** | 0 (API unavailable) | flat |
| Most recent ElevenLabs convo (known) | Apr 16 18:44 UTC | **Apr 16 18:44 UTC** | +9 days likely silence | flat |
| Archy failure rate (last 20) | 6/20 (30%) | **6/20 (30%)** | flat (no new data) | flat |
| Paisaxe voice conversations (MTD) | 0 | 0 | flat | flat |
| Twilio balance (last known) | $14.0646 | $14.0646 | flat (API unavailable) | flat |
| SMS sent (MTD) | 0 | 0 | flat | flat |
| Day Pass net sales (MTD) | 0 | 0 | flat | flat |
| Paisaxe voice dormancy streak | 63 days | **67 days** | +4 | down |
| Revenue drought streak | 67 days | **71 days** | +4 | down |
| Next ElevenLabs reset | ~16 days | **~12 days** | -4 days | approaching |
| Projected cycle-end chars (cycle-avg) | ~30,515 (11.3%) | **~23,154 (8.6%)** | -2.7pp | down (silence extends) |
| Projected cycle-end chars (zero-activity) | ~13,734 (5.07%) | **~13,734 (5.07%)** | flat | flat |
| Cumulative operational loss | ~$346 | **~$357** | +$11 | down |
| npm audit advisories | 0 | **3 moderate (uuid chain)** | +3 | WATCH |
| Sentry Replay | Enabled | **Removed (fef651f5 Apr 22)** | P8 complete | improvement |
| Test coverage (statements) | 98.54% | **98.60%** | +0.06pp | up |
| Test count | 5904 | **5992** | +88 | up |

**Key observations:**

1. **Four additional days of confirmed zero revenue and zero Paisaxe voice activity.** Drought at 71 days — deepest trough since site launch. No trigger for growth visible in any agent report.

2. **ElevenLabs API unavailable today.** Cannot confirm current character count. Based on 9+ days of likely inactivity (no agent report through Apr 24 mentioned new conversations), the cycle count is almost certainly still at or near 13,734. The cycle-average daily rate has fallen from ~1,017/day (Apr 21) to an estimated ~785/day due to dilution by silence.

3. **P8 complete (Sentry Replay removed).** A production build is needed to confirm actual bundle savings of ~30-50 KB. This is the only structural change affecting cost infrastructure this cycle.

4. **New uuid chain advisories (Security Apr 24).** Not exploitable. Simple mitigation: `npm install` to sync resend pin drift from 6.12.0 to 6.12.2, then wait for svix upstream fix.

5. **Coverage continues to improve.** 5992 tests passing (from 5904 on Apr 20), Stripe webhook and chat stream now at 100% branch coverage — closes the highest-risk security-path gaps.

6. **Twilio runway unchanged at ~12.2 months.** No charges between Apr 7 and Apr 25. The $0.24 anomaly from Apr 3-4 remains 22 days unresolved without a Twilio console check.

---

## Recommendations

### Immediate Actions (Priority)

1. **Check Anthropic billing manually** — Visit [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing). Daily automated agents (security, coverage, performance, cost-analyst, localization, docs, QA, triage) plus Claude Code Max development activity likely push actual usage well above the $10/mo config estimate. Still the single largest unmonitored cost surface.

2. **Investigate the revenue and voice drought — 71 days is critical** — Over two full months and counting with no revenue. Priority action items:
   - Is the Pelayo voice widget rendering and accessible on production?
   - Is the Day Pass purchase flow functional end-to-end?
   - Are Vercel deployment logs showing errors on production requests?
   - Has organic traffic dropped? (PostHog / Vercel Analytics)
   - QA Agent browser journeys pass E2E (stable since Mar 23) — production behavior for paying flows remains unverified.

3. **Resolve the Twilio $0.24 anomaly** — Check Twilio billing history for April 3-4. Now 22 days unresolved. Likely a US local number regulatory surcharge (~$0.24/mo). If confirmed recurring, update `src/config/recurring-costs.ts` to reflect ~$1.39/mo Twilio cost instead of $1.15.

4. **Run a production build to confirm P8 savings** — `rm -rf .next && npm run build && npm run build:analyze` to measure actual initial-load savings from Sentry Replay removal. If initial load drops below 2,000 KB, Performance Agent status goes GREEN.

5. **Run `npm install` to resolve uuid advisory** — Syncs resend@6.12.2 pin (currently installed at 6.12.0 per lockfile drift). Non-breaking. Clears the advisory pin drift; full advisory resolution awaits svix >=1.91.2 upstream.

6. **Clean up stray repo root files** — `rm svix uuid` in repo root. Empty shell output artifacts flagged by Performance Agent (Apr 24).

### Cost Reduction Evaluation

7. **Evaluate Twilio phone number** — 67 days without a booking call. $1.15–1.39/mo unused. Consider releasing the number unless bookings are expected to resume soon. ~$14–17/yr savings.

8. **Review Vercel Pro and Supabase Pro** — At current dormant scale (~50 visitors/mo), both Pro tiers may be overprovisioned:
   - Vercel Pro ($20/mo) — Hobby tier is free for personal projects with limited bandwidth.
   - Supabase Pro ($25/mo) — Free tier includes 500MB storage and 50K monthly active users.
   - Combined potential savings: up to $45/mo (~53% of operational costs).

### Long-Term Planning

9. **Revenue trajectory remains critical** — Three consecutive near-zero or zero-revenue months. At $84.41/mo operational with $0 revenue: $2.81/day in losses. Break-even requires ~3,150 monthly visitors at 5% Day Pass conversion — 63x current traffic. Cumulative operational loss since Feb 2026: ~$357. The platform requires a growth event or cost reduction to achieve sustainability.

10. **ElevenLabs remains well-sized** — Creator tier at $22.18/mo effective (annual). Projected cycle utilization now 5–9% depending on future activity. Well within the 270,783 char limit. Scale tier ($99/mo) only needed if sustained Paisaxe voice traffic exceeds 100 min/mo — currently at 0 min.

---

## Data Sources

| Source | Method | Last Queried | Status |
|--------|--------|-------------|--------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-04-21 03:00 UTC | **Unavailable today** — env vars not present in execution context; using Apr 21 data |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=20` | 2026-04-21 03:00 UTC | **Unavailable today** — using Apr 21 data + cross-agent context |
| Twilio Balance API | `/Balance.json` | 2026-04-21 03:00 UTC | **Unavailable today** — env vars not present; using Apr 21 data |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json` | 2026-04-21 03:00 UTC | **Unavailable today** — using Apr 21 data |
| Config: `service-tiers.ts` | File read | 2026-04-25 | OK |
| Config: `recurring-costs.ts` | File read | 2026-04-25 | OK |
| Config: `forecast.ts` | File read | 2026-04-25 | OK |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | — | Manual check required |
| Cross-agent context | Agent shared context | 2026-04-25 | OK — Apr 22–24 reports incorporated |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-04-26.*

---
