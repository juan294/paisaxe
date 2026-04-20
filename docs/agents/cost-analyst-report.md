# Cost Analyst Report

> **Generated**: 2026-04-20 03:00:00 | **Period**: April 2026 (day 20 of 30) | **Status**: WATCH

---

## Executive Summary

**Day 20 of April.** ElevenLabs has been fully silent for 4 consecutive days: the last conversation (Archy) was April 16 18:44 UTC, and the character count remains frozen at 13,734 (5.07%) — exactly where it stood in the April 17 report. No new conversations in over three days across all agents.

**Twilio balance holds at $14.0646** for the 13th consecutive day since the April 7 phone number rental. Zero non-zero usage records this month.

**Revenue drought reaches 66 days** (since February 13). **Paisaxe voice silence: 62 days** (since February 17). Zero revenue in April through day 20. With 10 days remaining, $0 revenue in April is now certain. Third consecutive near-zero or zero-revenue month.

**Security alert (from Apr 17 Security Agent)**: 2 npm advisories detected in posthog-js transitive deps (protobufjs Critical, dompurify Moderate) — not exploitable in this codebase but warrant a priority upgrade to posthog-js 1.369.2+. This cycle's triage should batch this upgrade.

**Financial health: WATCH** — business concern only. No platform cost anomalies. All tier limits well within range. ElevenLabs overall silence (non-Paisaxe) is a new observation this cycle; if Archy stays quiet, projected cycle-end utilization drops further from ~16.0% toward 5–7%.

| Metric | Value | vs. Apr 17 |
|--------|-------|-----------|
| Total Fixed Costs (all) | $284.41/mo | → |
| Total Fixed Costs (operational) | **$84.41/mo** | → |
| Variable Costs (Apr MTD, confirmed) | **$1.15** | → |
| Daily Burn Rate (Apr fixed) | **$2.81/day** | → |
| Revenue (Apr MTD) | **$0.00** | → |
| Twilio Balance | **$14.0646** | → (13th stable day) |
| ElevenLabs Characters (cycle) | **13,734 / 270,783 (5.07%)** | → (unchanged, 4 days silent) |
| ElevenLabs Voice Min (Paisaxe, Apr) | 0.0 / 100 | → |
| Next Character Reset | **~2026-05-07 14:36 UTC** | ~17 days |
| Paisaxe Voice Silence | **62 days** | +3 |
| Revenue Drought | **66 days** | +3 |
| Last ElevenLabs Conversation | Apr 16 18:44 UTC | +3 days silence |

---

## Current Costs — Per-Service Breakdown

### Fixed / Recurring Costs

| Service | Tier | Monthly Cost | % of Operational | Category | Trend |
|---------|------|-------------|-----------------|----------|-------|
| Claude Code Max | Max (20x Pro) | $200.00 | — (dev) | Development | → |
| Supabase | Pro | $25.00 | 29.6% | Infrastructure | → |
| ElevenLabs | Creator (annual) | $22.18* | 26.3% | AI / Voice | → |
| Vercel | Pro | $20.00 | 23.7% | Infrastructure | → |
| Anthropic Claude | Prepaid credits | $10.00** | 11.8% | AI | → |
| GitHub Pro | Pro | $4.00 | 4.7% | Infrastructure | → |
| AWS Domains | — | $2.08 | 2.5% | Infrastructure | → |
| Twilio Phone Number | — | $1.15*** | 1.4% | Communications | → |
| PostHog | Free | $0.00 | 0% | Analytics | → |
| **Total Fixed (all)** | | **$284.41** | | | → |
| **Total Fixed (operational)** | | **$84.41** | **100%** | | → |

*\*ElevenLabs Creator billed annually. Effective rate $22.18/mo. Next annual invoice: $266.20 on ~2027-02-06 (confirmed via subscription API: next_payment_attempt_unix 1802012845).*

*\*\*Anthropic $10/mo is an estimate from config. No billing API available on personal accounts. Check [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing) manually. Daily automated agents plus Claude Code Max development activity may push actual usage above estimate.*

*\*\*\*Twilio phone number rental charged April 7: balance dropped $15.2146 → $14.0646 (-$1.15). Monthly billing event, expected. Balance stable for 13 consecutive days.*

**Note**: Claude Code Max ($200/mo) is the primary development tool, categorized separately as "Development." Operational cost analysis focuses on running the live service.

### Variable / Usage-Based Costs (April 2026 MTD — Day 20)

| Service | Usage | Cost | Source |
|---------|-------|------|--------|
| Twilio (Phone rental) | 1 number, April billing | **$1.15** | Balance delta (Apr 7) |
| Twilio (SMS) | 0 messages | $0.00 | API (0 non-zero of 50 records) |
| Twilio (Calls) | 0 minutes | $0.00 | API |
| Stripe (Processing Fees) | 0 charges | $0.00 | — |
| Anthropic (Claude API) | Unknown | Unknown | — |
| Voyage AI (Embeddings) | Unknown | Unknown | — |
| **Total Variable (Apr MTD, confirmed)** | | **$1.15** | |

### April 2026 MTD Total (Day 20)

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
| Apr 2026 (day 20) | $84.41 | $1.15 | **$85.56** | $0.00 | 0% |

---

## Usage Metrics

### ElevenLabs Activity — Current Cycle (April 7 14:36 UTC → May 7 14:36 UTC)

**Character count at report time: 13,734 / 270,783 (5.07%).** Unchanged from April 17 report — 4 days of complete ElevenLabs inactivity (all agents, not just Paisaxe).

**Last conversation: April 16 18:44 UTC (Archy — success).** Three full days of silence since the April 16 burst.

**Last 20 conversations (API — unchanged from Apr 17 report):**

| Agent | Count (in last 20) | Most Recent | Success/Fail | Project |
|-------|-------------------|-------------|------------|---------|
| Archy | 19 | Apr 16 18:44 UTC (success) | 13 success, 6 failures (32%) | Non-Paisaxe |
| Coach | 1 | ~Apr 11 UTC | 1 success (100%) | Non-Paisaxe |
| Pelayo (Visitor Guide) | 0 | Feb 17 | Dormant | Paisaxe |
| Pelayo (Booking) | 0 | Feb 10 | Dormant | Paisaxe |
| Penny, Iris, Xander | 0 | Never | Dormant | Paisaxe |

**All conversations are non-Paisaxe.** Paisaxe agents: **0 conversations since February 17 (62 days).**

**Archy failure pattern (last 20):**
- Apr 16 18:22 UTC — custom_llm generation failed (16s, 2 messages)
- Apr 16 18:19 UTC — custom_llm generation failed (9s, 2 messages)
- Apr 16 18:19 UTC — custom_llm generation failed (16s, 2 messages)
- Apr 12 07:59 UTC — custom_llm generation failed (24s, 2 messages)
- Apr 11 16:49 UTC — LLM response took too long (32s, 2 messages)
- Apr 11 06:12 UTC — LLM response took too long (30s, 2 messages)

Failure rate in last 20: **6/20 (30%)**. Unchanged from Apr 17 report (no new data to update it).

### ElevenLabs Character Usage

| Metric | Value | vs. Apr 17 |
|--------|-------|-----------|
| Characters used (cycle) | **13,734 / 270,783 (5.07%)** | → (unchanged, 4 days) |
| Character limit | **270,783** | → |
| Next character reset | **~2026-05-07 14:36 UTC** | ~17 days |
| Characters used (Apr, Paisaxe) | 0 | → |
| Characters remaining this cycle | **257,049** | → |

**Cycle utilization projection:**
- Cycle start: Apr 7 14:36 UTC. Days elapsed: ~12.5.
- Average rate (cycle): 13,734 / 12.5 = ~1,099/day.
- Conservative (same rate × 17.5 days remaining): ~19,233 additional = ~32,967 total = ~12.2%.
- Pessimistic/likely (zero activity continues): ~13,734 = ~5.07%.
- Given 4 consecutive silent days, actual end-of-cycle utilization will likely be 6–12%.

### ElevenLabs Subscription Details (from API — 2026-04-20)

| Field | Value |
|-------|-------|
| Tier | Creator |
| Billing period | Annual |
| Status | Active |
| Next invoice amount | $266.20 |
| Next payment attempt | ~2027-02-06 |
| Next character reset | **~2026-05-07 14:36 UTC** |
| Character limit | **270,783** |

### Twilio Communications

| Metric | Apr 2026 (days 1-20) | Mar 2026 (final) | Change |
|--------|---------------------|-----------------|--------|
| SMS Sent | 0 | 0 | → |
| Calls | 0 | 0 | → |
| Usage Cost | $0.00 | $0.00 | → |
| Phone Rental | **$1.15** (charged Apr 7) | $1.15 | Monthly expected |
| Balance | **$14.0646** | $15.4546 | -$1.40 MTD |

**Twilio balance reconciliation (April):**
- Apr 1 (start): ~$15.4546
- Apr 3-4: -$0.24 (unexplained — likely recurring regulatory surcharge, now 17 days unresolved)
- Apr 7: -$1.15 (phone number rental, confirmed)
- **Apr 20: $14.0646** — stable for 13 consecutive days. ~12.2 months of runway remaining.

### Stripe Revenue

| Metric | Apr 2026 (days 1-20) | Mar 2026 (final) | Feb 2026 (final) |
|--------|---------------------|-----------------|-----------------|
| Net Sales | 0 | 0 | 6 |
| Gross Revenue | $0.00 | $0.00 | $13.93 |
| Net Revenue | $0.00 | $0.00 | $9.98 |

**66-day revenue drought** — No Day Pass sales since February 13. Three consecutive months of zero or near-zero revenue. April certain to close at $0.

---

## Cost Efficiency

| Metric | Current (Apr 20) | Previous (Apr 17) | Change | Trend |
|--------|----------------|------------------|--------|-------|
| Fixed operational cost/mo | $84.41 | $84.41 | → | → |
| Daily burn rate (fixed) | **$2.81/day** | $2.81/day | → | → |
| April variable spend (confirmed) | **$1.15** | $1.15 | → | → |
| Cost per voice conversation (Feb actuals) | ~$0.43 | ~$0.43 | → | → |
| Cost per voice minute (Feb actuals) | ~$0.37 | ~$0.37 | → | → |
| ElevenLabs char utilization (cycle) | **5.07%** | 5.07% | → (4-day freeze) | → |
| ElevenLabs char utilization daily rate | ~1,099/day (cycle avg) | ~1,446/day | -24% | down |
| ElevenLabs voice min utilization (Paisaxe, Apr) | 0% | 0% | → | → |
| Revenue coverage (operational) | **0%** | 0% | → | → |
| Months of Twilio runway | ~12.2 mo | ~12.2 mo | → | → |
| Cumulative operational loss (Feb–Apr 20) | **~$343** | ~$300+ | -$43 more | down |

---

## Tier Proximity Alerts

| Service | Metric | Used | Limit | Utilization | Alert Level |
|---------|--------|------|-------|-------------|-------------|
| ElevenLabs | Characters (cycle) | 13,734 | 270,783 | **5.07%** | SAFE |
| ElevenLabs | Voice Minutes (Paisaxe, Apr) | 0.0 | 100 | **0%** | SAFE |
| Vercel | Monthly Visitors | ~low | 500,000 (Pro) | **<1%** | SAFE |
| PostHog | Monthly Events | ~low | 1,000,000 | **<1%** | SAFE |
| Supabase | Database Storage | <8 GB | 8 GB | **<100%** | SAFE |

**All tier alerts cleared.** At current frozen pace (zero new chars for 4 days), projected cycle-end is 5–12% — well within Creator limit.

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
| 66-day revenue drought | **WARNING** | No Day Pass sales since Feb 13. Third consecutive zero-revenue month certain. Cumulative operational loss ~$343. |
| 62-day Paisaxe voice silence | **WARNING** | No Paisaxe voice conversations since Feb 17. Platform dormant to visitors for over 2 months. |
| ElevenLabs total silence (4 days) | **WATCH** | No conversations on any agent since Apr 16 18:44 UTC. Even non-Paisaxe Archy silent for 3+ days. New development. |
| Archy failure rate elevated | **WATCH** | 6/20 (30%) failures in last 20. No new data since Apr 16 burst (last 3 conversations in burst = 3/3 failures = 100%). Non-Paisaxe. |
| Twilio $0.24 drop (Apr 3-4, unresolved) | **WATCH** | Balance anomaly not captured in Usage Records API. Likely recurring regulatory surcharge. Now 17 days unresolved. |
| No Anthropic cost visibility | **WATCH** | Personal account has no billing API. Daily agents plus Claude Code Max development activity may push actual Anthropic API usage above $10/mo estimate. |
| posthog-js security advisories | **WATCH** | Security Agent (Apr 17) flagged protobufjs Critical + dompurify Moderate via posthog-js transitive deps. Not exploitable, but fix is available: upgrade posthog-js to 1.369.2+. |

**No platform cost-structure anomalies.** All tier limits safe.

---

## Trend Analysis

### Comparison: Apr 17 → Apr 20

| Metric | Apr 17 (03:00 UTC) | Apr 20 (03:00 UTC) | Change | Direction |
|--------|------|------|--------|-----------|
| Fixed costs/mo (operational) | $84.41 | $84.41 | → | → |
| Variable costs (confirmed MTD) | $1.15 | $1.15 | → | → |
| Daily burn rate (fixed) | $2.81/day | $2.81/day | → | → |
| ElevenLabs characters (cycle) | 13,734 (5.07%) | **13,734 (5.07%)** | 0 (4-day freeze) | → |
| ElevenLabs char daily rate (cycle avg) | ~1,446/day | **~1,099/day** | -24% | down (diluted by silence) |
| Most recent ElevenLabs convo | Apr 16 18:44 UTC | **Apr 16 18:44 UTC** | 3 days of silence | → |
| Archy failure rate (last 20) | 6/20 (30%) | **6/20 (30%)** | → (no new data) | → |
| Paisaxe voice conversations (MTD) | 0 | 0 | → | → |
| Twilio balance | $14.0646 | $14.0646 | → (13th day) | → |
| SMS sent (MTD) | 0 | 0 | → | → |
| Day Pass net sales (MTD) | 0 | 0 | → | → |
| Paisaxe voice dormancy streak | 59 days | **62 days** | +3 | down |
| Revenue drought streak | 63 days | **66 days** | +3 | down |
| Next ElevenLabs reset | ~20 days | **~17 days** | -3 days | approaching |
| Projected cycle-end chars (conservative) | ~43,400 (16.0%) | **~32,967 (12.2%)** | -3.8pp | down (decelerating) |
| Projected cycle-end chars (pessimistic/0 new) | — | **~13,734 (5.07%)** | — | new (if silence continues) |

**Key observations:**

1. **Complete ElevenLabs silence since Apr 16.** Four consecutive days with zero character consumption across all agents. The April 16 burst of 8 Archy conversations was the last activity. This is the longest ElevenLabs total silence period tracked — previously Paisaxe was silent but Archy was active.

2. **Character utilization cycle average declining rapidly.** Daily average dropped from ~2,126/day (Apr 13) → ~1,809/day (Apr 14) → ~1,616/day (Apr 15) → ~1,446/day (Apr 17) → **~1,099/day (Apr 20)**. Each passing silent day dilutes the burst impact further. If silence holds 17 more days, cycle ends at 5.07%.

3. **Revenue and voice drought milestone — 66 and 62 days.** These are the longest consecutive silent periods recorded. April will mark the third consecutive month of zero operational revenue. Cumulative operational loss since Feb 2026: ~$343 (at $2.81/day × days elapsed).

4. **Twilio 13-day stability streak.** Balance unchanged at $14.0646 since the April 7 phone rental. No new charges. The $0.24 anomaly from Apr 3-4 remains the only unexplained event this month — now 17 days unresolved.

5. **Coverage improvement (Apr 20):** Coverage Agent added 36 new tests (5904 total), coverage improved to 98.54% statements / 95.94% branch. No cost impact but indicates active development continues.

---

## Recommendations

### Immediate Actions (Priority)

1. **Upgrade posthog-js to resolve security advisories** — Security Agent (Apr 17) flagged 2 transitive advisories (protobufjs Critical, dompurify Moderate) resolvable by upgrading posthog-js 1.367.0 → 1.369.2+. Not exploitable, but a straightforward fix. Can batch with other pending dep upgrades (17 packages outdated as of Apr 17).

2. **Check Anthropic billing manually** — Visit [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing). Daily automated agents (security, coverage, performance, cost-analyst, localization, docs, QA, triage) plus Claude Code Max development activity may push actual usage well above the $10/mo config estimate.

3. **Investigate the revenue and voice drought — 66 days is critical** — Over two full months with no revenue. Priority unchanged:
   - Is the Pelayo voice widget rendering and accessible on production?
   - Is the Day Pass purchase flow functional end-to-end?
   - Are Vercel deployment logs showing errors on production requests?
   - Has organic traffic dropped? (PostHog / Vercel Analytics)
   - QA Agent browser journeys pass E2E (as of Mar 23, stable) — production behavior for paying flows remains unverified.

4. **Resolve the Twilio $0.24 anomaly** — Check Twilio billing history at the Twilio console for April 3-4. Likely a US local number regulatory surcharge (~$0.24/mo). If confirmed recurring, update `recurring-costs.ts` to reflect ~$1.39/mo Twilio cost instead of $1.15/mo. Anomaly is now 17 days old without resolution.

5. **Investigate Archy total silence and failure pattern** — Non-Paisaxe concern, but 4 days of ElevenLabs silence across all agents is new. The last burst (Apr 16) ended with 3/3 consecutive failures. If Archy's LLM backend is down or misconfigured, this explains the sustained silence.

### Cost Reduction Evaluation

6. **Evaluate Twilio phone number** — 62 days without a booking call. $1.15–1.39/mo unused. Consider releasing the number unless bookings are expected to resume. ~$14/yr savings.

7. **Review Vercel Pro and Supabase Pro** — At current dormant scale (~50 visitors/mo), both Pro tiers may be overprovisioned:
   - Vercel Pro ($20/mo) — Hobby tier is free for personal projects with limited bandwidth.
   - Supabase Pro ($25/mo) — Free tier includes 500MB storage and 50K monthly active users.
   - Combined potential savings: up to $45/mo (~53% of operational costs).

### Long-Term Planning

8. **Revenue trajectory remains critical** — Three consecutive near-zero or zero-revenue months. At $84.41/mo operational with $0 revenue: $2.81/day in losses. Break-even requires ~3,150 monthly visitors at 5% Day Pass conversion — 63x current traffic. Cumulative operational loss since Feb 2026: ~$343. The platform requires a growth event or cost reduction to achieve sustainability.

9. **ElevenLabs remains well-sized** — Creator tier at $22.18/mo effective (annual). Projected cycle utilization now 5–12% depending on future activity. Well within the 270,783 char limit. Scale tier ($99/mo) only needed if sustained Paisaxe voice traffic exceeds 100 min/mo — currently at 0 min.

---

## Data Sources

| Source | Method | Last Queried | Status |
|--------|--------|-------------|--------|
| ElevenLabs Subscription API | `/v1/user/subscription` | 2026-04-20 03:00 UTC | OK — tier: creator, chars: 13,734/270,783, status: active |
| ElevenLabs ConvAI API | `/v1/convai/conversations?page_size=20` | 2026-04-20 03:00 UTC | OK — no change from Apr 17, last convo Apr 16 18:44 UTC |
| Twilio Balance API | `/Balance.json` | 2026-04-20 03:00 UTC | OK — $14.0646, USD |
| Twilio Usage API (This Month) | `/Usage/Records/ThisMonth.json` | 2026-04-20 03:00 UTC | OK — 0 non-zero of all records |
| Config: `service-tiers.ts` | File read | 2026-04-20 | OK |
| Config: `recurring-costs.ts` | File read | 2026-04-20 | OK |
| Config: `forecast.ts` | File read | 2026-04-20 | OK |
| Anthropic Billing | **NOT AVAILABLE** (personal account) | — | Manual check required |

---

*Report generated by the Paisaxe Cost Analyst Agent. Next scheduled run: 2026-04-21.*

---
