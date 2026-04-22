# Cost Analyst Report

> **Generated**: 2026-04-21 03:00:00 | **Period**: April 2026 (day 21 of 30) | **Status**: WATCH

---

## Executive Summary

**Day 21 of April.** ElevenLabs remains frozen at 13,734 characters (5.07% of cycle). The last conversation across all agents was still April 16 18:44 UTC — now **5 consecutive silent days**. No new Paisaxe voice activity in 63 days. The Apr 16 burst of 8 Archy conversations ended with a trailing 3/3 failure streak; since then every agent on the account has been quiet.

**Twilio balance steady at $14.0646** for the 14th consecutive day since the April 7 phone number rental. Zero non-zero usage records again this month.

**Revenue drought reaches 67 days** (since February 13). **Paisaxe voice silence: 63 days** (since February 17). Third consecutive zero-revenue month is locked in with 9 days remaining.

**Security advisories RESOLVED (since Apr 20)**: Per the Apr 20 Security Agent report, commit `e66e510` via `npm audit fix` upgraded transitive deps and cleared both protobufjs (Critical) and dompurify (Moderate) advisories. 0 vulnerabilities remaining. No cost impact.

**Financial health: WATCH** — business concern only. No platform cost anomalies. All tier limits well within range. Zero-activity projection continues to pull projected cycle-end utilization toward 5–8%.

| Metric | Value | vs. Apr 20 |
|--------|-------|-----------|
| Total Fixed Costs (all) | $284.41/mo | flat |
| Total Fixed Costs (operational) | **$84.41/mo** | flat |
| Variable Costs (Apr MTD, confirmed) | **$1.15** | flat |
| Daily Burn Rate (Apr fixed) | **$2.81/day** | flat |
| Revenue (Apr MTD) | **$0.00** | flat |
| Twilio Balance | **$14.0646** | flat (14th stable day) |
| ElevenLabs Characters (cycle) | **13,734 / 270,783 (5.07%)** | flat (5 days silent) |
| ElevenLabs Voice Min (Paisaxe, Apr) | 0.0 / 100 | flat |
| Next Character Reset | **~2026-05-07 14:36 UTC** | ~16 days |
| Paisaxe Voice Silence | **63 days** | +1 |
| Revenue Drought | **67 days** | +1 |
| Last ElevenLabs Conversation | Apr 16 18:44 UTC | +1 day silence |
| npm audit advisories | **0** | -2 (RESOLVED) |

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

*\*ElevenLabs Creator billed annually. Effective rate $22.18/mo. Next annual invoice confirmed via API: $266.20 on ~2027-02-07 (next_payment_attempt_unix 1802012845).*

*\*\*Anthropic $10/mo is a config estimate. No billing API on personal account. Manual check required at [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing). Daily agents plus Claude Code Max development likely push actual usage above the estimate.*

*\*\*\*Twilio phone rental charged Apr 7: balance dropped $15.2146 → $14.0646 (-$1.15). Monthly event. Balance now stable for 14 consecutive days.*

**Note**: Claude Code Max ($200/mo) is the primary development tool, categorized separately as "Development." Operational cost analysis focuses on running the live service.

### Variable / Usage-Based Costs (April 2026 MTD — Day 21)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Phone rental) | 1 number, April billing | **$1.15** | Balance delta (Apr 7) |
| Twilio (SMS) | 0 messages | $0.00 | API (all 50 records zero-valued) |
| Twilio (Calls) | 0 minutes | $0.00 | API |
| Stripe (Processing Fees) | 0 charges | $0.00 | — |
| Anthropic (Claude API) | Unknown | Unknown | — |
| Voyage AI (Embeddings) | Unknown | Unknown | — |
| **Total Variable (Apr MTD, confirmed)** | | **$1.15** | |

### April 2026 MTD Total (Day 21)

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
| Apr 2026 (day 21) | $84.41 | $1.15 | **$85.56** | $0.00 | 0% |

---

## Usage Metrics

### ElevenLabs Activity — Current Cycle (April 7 14:36 UTC → May 7 14:36 UTC)

**Character count at report time: 13,734 / 270,783 (5.07%).** Unchanged from Apr 20 — 5 days of complete ElevenLabs inactivity across all agents.

**Last conversation: April 16 18:44 UTC (Archy — success).** Five full days of silence since the Apr 16 burst.

**Last 20 conversations (API — unchanged from Apr 20 report):**

| Agent | Count (in last 20) | Most Recent | Success/Fail | Project |
|-------|-------------------|-------------|------------|---------|
| Archy | 19 | Apr 16 18:44 UTC (success) | 13 success, 6 failures (32%) | Non-Paisaxe |
| Coach | 1 | Apr 11 06:38 UTC | 1 success (100%) | Non-Paisaxe |
| Pelayo (Visitor Guide) | 0 | Feb 17 | Dormant | Paisaxe |
| Pelayo (Booking) | 0 | Feb 10 | Dormant | Paisaxe |
| Penny, Iris, Xander | 0 | Never | Dormant | Paisaxe |

**All conversations are non-Paisaxe.** Paisaxe agents: **0 conversations since February 17 (63 days).**

**Archy failure pattern (last 20 observed):**
- Apr 16 18:22 UTC — custom_llm generation failed (15s, 2 messages)
- Apr 16 18:19 UTC — custom_llm generation failed (9s, 2 messages)
- Apr 16 18:19 UTC — custom_llm generation failed (16s, 2 messages)
- Apr 12 07:59 UTC — custom_llm generation failed (24s, 2 messages)
- Apr 11 16:50 UTC — LLM response took too long (32s, 2 messages)
- Apr 11 06:12 UTC — LLM response took too long (30s, 2 messages)

Failure rate in last 20: **6/20 (30%)**. Unchanged from Apr 20 (no new data).

### ElevenLabs Character Usage

| Metric | Value | vs. Apr 20 |
|--------|-------|-----------|
| Characters used (cycle) | **13,734 / 270,783 (5.07%)** | flat (5 days) |
| Character limit | **270,783** | flat |
| Next character reset | **~2026-05-07 14:36 UTC** | ~16 days |
| Characters used (Apr, Paisaxe) | 0 | flat |
| Characters remaining this cycle | **257,049** | flat |

**Cycle utilization projection:**
- Cycle start: Apr 7 14:36 UTC. Days elapsed: ~13.5.
- Cycle-average rate: 13,734 / 13.5 = ~1,017/day (down from ~1,099/day Apr 20).
- Conservative (assume cycle-avg rate continues × 16.5 days remaining): ~16,781 additional = ~30,515 total = **~11.3%**.
- Pessimistic/likely (zero activity continues): ~13,734 = **~5.07%**.
- Given 5 consecutive silent days, actual end-of-cycle utilization will likely be 5–8%.

### ElevenLabs Subscription Details (from API — 2026-04-21)

| Field | Value |
|-------|-------|
| Tier | Creator |
| Billing period | Annual |
| Status | Active |
| Next invoice amount | $266.20 |
| Next payment attempt | ~2027-02-07 |
| Next character reset | **~2026-05-07 14:36 UTC** |
| Character limit | **270,783** |

### Twilio Communications

| Metric | Apr 2026 (days 1-21) | Mar 2026 (final) | Change |
|--------|---------------------|-----------------|--------|
| SMS Sent | 0 | 0 | flat |
| Calls | 0 | 0 | flat |
| Usage Cost | $0.00 | $0.00 | flat |
| Phone Rental | **$1.15** (charged Apr 7) | $1.15 | Monthly expected |
| Balance | **$14.0646** | $15.4546 | -$1.40 MTD |

**Twilio balance reconciliation (April):**
- Apr 1 (start): ~$15.4546
- Apr 3-4: -$0.24 (unexplained — likely recurring regulatory surcharge, now 18 days unresolved)
- Apr 7: -$1.15 (phone number rental, confirmed)
- **Apr 21: $14.0646** — stable for 14 consecutive days. ~12.2 months of runway.

### Stripe Revenue

| Metric | Apr 2026 (days 1-21) | Mar 2026 (final) | Feb 2026 (final) |
|--------|---------------------|-----------------|-----------------|
| Net Sales | 0 | 0 | 6 |
| Gross Revenue | $0.00 | $0.00 | $13.93 |
| Net Revenue | $0.00 | $0.00 | $9.98 |

**67-day revenue drought** — No Day Pass sales since February 13. Three consecutive months of zero or near-zero revenue. April certain to close at $0 with 9 days remaining.

---

## Cost Efficiency

| Metric | Current (Apr 21) | Previous (Apr 20) | Change | Trend |
|--------|----------------|------------------|--------|-------|
| Fixed operational cost/mo | $84.41 | $84.41 | flat | flat |
| Daily burn rate (fixed) | **$2.81/day** | $2.81/day | flat | flat |
| April variable spend (confirmed) | **$1.15** | $1.15 | flat | flat |
| Cost per voice conversation (Feb actuals) | ~$0.43 | ~$0.43 | flat | flat |
| Cost per voice minute (Feb actuals) | ~$0.37 | ~$0.37 | flat | flat |
| ElevenLabs char utilization (cycle) | **5.07%** | 5.07% | flat (5-day freeze) | flat |
| ElevenLabs char utilization daily rate | ~1,017/day (cycle avg) | ~1,099/day | -7.5% | down |
| ElevenLabs voice min utilization (Paisaxe, Apr) | 0% | 0% | flat | flat |
| Revenue coverage (operational) | **0%** | 0% | flat | flat |
| Months of Twilio runway | ~12.2 mo | ~12.2 mo | flat | flat |
| Cumulative operational loss (Feb–Apr 21) | **~$346** | ~$343 | -$3 more | down |

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Alert Level |
|---------|--------|------|-------|-------------|-------------|
| ElevenLabs | Characters (cycle) | 13,734 | 270,783 | **5.07%** | SAFE |
| ElevenLabs | Voice Minutes (Paisaxe, Apr) | 0.0 | 100 | **0%** | SAFE |
| Vercel | Monthly Visitors | ~low | 500,000 (Pro) | **<1%** | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | SAFE |

**All tier alerts cleared.** At current frozen pace, projected cycle-end is 5–11% — well within Creator limit.

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
| 67-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. Third consecutive zero-revenue month certain. Cumulative operational loss ~$346. |
| 63-day Paisaxe voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Platform dormant to visitors for over 2 months. |
| ElevenLabs total silence (5 days) | **WATCH** | No conversations on any agent since Apr 16 18:44 UTC. Even non-Paisaxe Archy silent for 5 days — longest streak tracked. |
| Archy failure rate elevated | **WATCH** | 6/20 (30%) failures in last 20 observed. No new data since Apr 16 burst (last 3 conversations = 3/3 failures = 100%). Non-Paisaxe. |
| Twilio $0.24 drop (Apr 3-4, unresolved) | **WATCH** | Balance anomaly not captured in Usage Records API. Likely recurring regulatory surcharge. Now 18 days unresolved. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Daily agents plus Claude Code Max development activity may push actual Anthropic API usage above $10/mo estimate. |
| ~~posthog-js security advisories~~ | **RESOLVED** | Commit `e66e510` (Apr 17-20 triage) via `npm audit fix` cleared both protobufjs (Critical) and dompurify (Moderate) advisories. 0 vulnerabilities remaining. |

**No platform cost-structure anomalies.** All tier limits safe.

---

## Trend Analysis

### Comparison: Apr 20 → Apr 21

| Metric | Apr 20 (03:00 UTC) | Apr 21 (03:00 UTC) | Change | Direction |
|--------|------|------|--------|-----------|
| Fixed costs/mo (operational) | $84.41 | $84.41 | flat | flat |
| Variable costs (confirmed MTD) | $1.15 | $1.15 | flat | flat |
| Daily burn rate (fixed) | $2.81/day | $2.81/day | flat | flat |
| ElevenLabs characters (cycle) | 13,734 (5.07%) | **13,734 (5.07%)** | 0 (5-day freeze) | flat |
| ElevenLabs char daily rate (cycle avg) | ~1,099/day | **~1,017/day** | -7.5% | down (diluted by silence) |
| Most recent ElevenLabs convo | Apr 16 18:44 UTC | **Apr 16 18:44 UTC** | +1 day silence | flat |
| Archy failure rate (last 20) | 6/20 (30%) | **6/20 (30%)** | flat (no new data) | flat |
| Paisaxe voice conversations (MTD) | 0 | 0 | flat | flat |
| Twilio balance | $14.0646 | $14.0646 | flat (14th day) | flat |
| SMS sent (MTD) | 0 | 0 | flat | flat |
| Day Pass net sales (MTD) | 0 | 0 | flat | flat |
| Paisaxe voice dormancy streak | 62 days | **63 days** | +1 | down |
| Revenue drought streak | 66 days | **67 days** | +1 | down |
| Next ElevenLabs reset | ~17 days | **~16 days** | -1 day | approaching |
| Projected cycle-end chars (cycle-avg projection) | ~32,967 (12.2%) | **~30,515 (11.3%)** | -0.9pp | down (decelerating) |
| Projected cycle-end chars (zero-activity) | ~13,734 (5.07%) | **~13,734 (5.07%)** | flat | flat |
| npm audit advisories | 2 (posthog-js transitive) | **0** | -2 | RESOLVED |

**Key observations:**

1. **Fifth consecutive day of total ElevenLabs silence.** The longest stretch of total account inactivity tracked. Paisaxe agents have been silent since Feb 17 (63 days); the non-Paisaxe Archy and Coach agents have now joined them for 5 days.

2. **Cycle-average character rate continues to decelerate.** Daily average has slid from ~2,126 (Apr 13) → ~1,809 (Apr 14) → ~1,446 (Apr 17) → ~1,099 (Apr 20) → **~1,017 (Apr 21)**. Each silent day further dilutes the single Apr 16 burst.

3. **Revenue and voice drought at 67 and 63 days.** Cumulative operational loss since Feb 2026 now ~$346. Third zero-revenue month virtually certain. No trigger-of-growth observed.

4. **Twilio 14-day stability streak.** Balance unchanged at $14.0646 since Apr 7 rental. No new charges. The $0.24 anomaly from Apr 3-4 is now 18 days unresolved.

5. **Security advisories resolved.** The posthog-js transitive dep concerns flagged Apr 17 are cleared via `e66e510`. No cost impact, but removes one WATCH item.

6. **Development continues despite platform dormancy.** Apr 20 triage committed 36 new coverage tests, a pre-existing E2E fix, and a knip upgrade (coverage 98.54% statements, 95.94% branch). Non-cost-relevant but indicates active work.

---

## Recommendations

### Immediate Actions (Priority)

1. **Check Anthropic billing manually** — Visit [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing). Daily automated agents (security, coverage, performance, cost-analyst, localization, docs, QA, triage) plus Claude Code Max development activity likely push actual usage well above the $10/mo config estimate. Still the single largest unmonitored cost surface.

2. **Investigate the revenue and voice drought — 67 days is critical** — Over two full months with no revenue. Priority unchanged:
   - Is the Pelayo voice widget rendering and accessible on production?
   - Is the Day Pass purchase flow functional end-to-end?
   - Are Vercel deployment logs showing errors on production requests?
   - Has organic traffic dropped? (PostHog / Vercel Analytics)
   - QA Agent browser journeys pass E2E (stable since Mar 23) — production behavior for paying flows remains unverified.

3. **Resolve the Twilio $0.24 anomaly** — Check Twilio billing history for April 3-4. Likely a US local number regulatory surcharge (~$0.24/mo). If confirmed recurring, update `src/config/recurring-costs.ts` to reflect ~$1.39/mo Twilio cost instead of $1.15. Now 18 days old without resolution.

4. **Investigate Archy total silence** — 5 days of ElevenLabs silence across all agents is a new pattern. The last burst (Apr 16) ended with 3/3 consecutive failures. If Archy's custom LLM backend is down or misconfigured, this explains the sustained inactivity. Non-Paisaxe, but consumes the same ElevenLabs character pool and invoice.

### Cost Reduction Evaluation

5. **Evaluate Twilio phone number** — 63 days without a booking call. $1.15–1.39/mo unused. Consider releasing the number unless bookings are expected to resume. ~$14–17/yr savings.

6. **Review Vercel Pro and Supabase Pro** — At current dormant scale (~50 visitors/mo), both Pro tiers may be overprovisioned:
   - Vercel Pro ($20/mo) — Hobby tier is free for personal projects with limited bandwidth.
   - Supabase Pro ($25/mo) — Free tier includes 500MB storage and 50K monthly active users.
   - Combined potential savings: up to $45/mo (~53% of operational costs).

### Long-Term Planning

7. **Revenue trajectory remains critical** — Three consecutive near-zero or zero-revenue months. At $84.41/mo operational with $0 revenue: $2.81/day in losses. Break-even requires ~3,150 monthly visitors at 5% Day Pass conversion — 63x current traffic. Cumulative operational loss since Feb 2026: ~$346. The platform requires a growth event or cost reduction to achieve sustainability.

8. **ElevenLabs remains well-sized** — Creator tier at $22.18/mo effective (annual). Projected cycle utilization now 5–11% depending on future activity. Well within the 270,783 char limit. Scale tier ($99/mo) only needed if sustained Paisaxe voice traffic exceeds 100 min/mo — currently at 0 min.

---

## Data Sources

| Source | Method | Last Queried | Status |
|--------|--------|-------------|--------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-04-21 03:00 UTC | OK — tier: creator, chars: 13,734/270,783, status: active |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=20` | 2026-04-21 03:00 UTC | OK — no change from Apr 20, last convo Apr 16 18:44 UTC |
| Twilio Balance API | `/Balance.json` | 2026-04-21 03:00 UTC | OK — $14.0646, USD |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json` | 2026-04-21 03:00 UTC | OK — 0 non-zero records (50 of 50 categories) |
| Config: `service-tiers.ts` | File read | 2026-04-21 | OK |
| Config: `recurring-costs.ts` | File read | 2026-04-21 | OK |
| Config: `forecast.ts` | File read | 2026-04-21 | OK |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | — | Manual check required |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-04-22.*

---
