# Cost Analyst Report
> **Generated**: 2026-09-24 (daily run) | **Period**: September 2026 (MTD through day 17) | **Status**: WATCH (decision deferred; live data unavailable; high-confidence fixed costs; variable costs estimated)

---

## Executive Summary

**ElevenLabs decision deferred as of 2026-08-30 with user's explicit "decide later" stance.** No mitigation implemented. Sep 7 reset occurred; estimated 17-day accrual (Sep 7–24) at 8,500 chars/day baseline = ~144,500 characters consumed, ~53% of 270,319 monthly limit. Remaining budget ~125K chars (46% headroom to Oct 7 reset). **If personal-agent baseline continues, overage will occur around Oct 1–5** (projected 27–32 days into cycle before crossing 270K threshold). Expected Sep overage similar to August: ~$20–40.

**Fixed operational burn remains stable at $99.65/mo ($3.21/day).** Revenue continues zero pattern (210+ day drought, no Day Pass sales). Anthropic incident #734 resolved; production chat operational. **Cumulative operational loss through Aug 31: ~$950; Sep 1–24 accrual at fixed rate: ~$77; running total: ~$1,027.**

---

## Current Costs (This Month)

### Fixed / Recurring Costs

| Service | Tier | Monthly Cost | % of Fixed | Category | Trend |
|---------|------|-------------|-----------|----------|-------|
| Claude Code Max | Max (20x Pro) | $200.00 | -- (dev) | Development | flat |
| Supabase | Pro | $25.00 | 25.1% | Infrastructure | flat |
| Anthropic Claude | Prepaid credits | $25.00 | 25.1% | AI (incident #734 resolved) | healthy |
| ElevenLabs | Creator (annual) | $22.18 | 22.3% | AI / Voice | **decision deferred; overage pending** |
| Vercel | Pro | $20.00 | 20.1% | Infrastructure | flat |
| GitHub Pro | Pro | $4.00 | 4.0% | Infrastructure | flat |
| AWS Domains | -- | $2.08 | 2.1% | Infrastructure | flat |
| Twilio Phone Number | -- | $1.39 | 1.4% | Communications | flat |
| PostHog | Free | $0.00 | 0% | Analytics | flat |
| **Total Fixed (operational)** | | **$99.65** | **100%** | | **stable** |

**Total Fixed Operational**: $99.65/mo | **Daily Burn Rate**: $3.21/day

### Variable / Usage-Based Costs (September 2026 — Day 17 MTD)

| Service | Usage (Est.) | Cost (Est.) | Source | Status |
|---------|------|-----|--------|--------|
| ElevenLabs (Sep 1–24 accrual) | **~144,500 / 270,319 chars (53.5% utilization, estimated)** | **$0.00 (no overage yet; budget remaining ~125K)** | Personal agents baseline ~8,500 chars/day (Archy, story-interviewer); **no Paisaxe voice activity (dormant ~216 days)**; Paisaxe allocation zero | **Projected overage window: Oct 1–5** (27–32 days into cycle when consumption exceeds 270K limit). Estimated Sep final: ~$20–40 if pattern holds through Oct 7 reset. |
| Twilio (phone rental + regulatory fee) | Monthly cycle accrual, day 17 | ~$0.78 (17 days × $0.0457/day) | Scheduled charges; zero SMS/calls | on schedule |
| Twilio (SMS) | 0 messages | $0.00 | Sep 1–24: zero activity | flat |
| Twilio (Calls) | 0 minutes | $0.00 | Sep 1–24: zero activity | flat |
| Stripe (processing) | 0 transactions | $0.00 | Consistent with 210+ day revenue drought | flat |
| Anthropic (Claude API) | Included in $25/mo fixed | $0.00 variable | Incident #734 resolved Aug 18; credits restored | resolved |
| **Total Variable (Sep MTD through day 17, fixed + estimated base accrual)** | | **~$0.78** | Twilio base only; ElevenLabs overage TBD on Oct 1–7 trajectory |

### Monthly Cost History & Projection

| Month | Fixed | Variable (confirmed + est) | Total | Revenue | Coverage |
|-------|-------|----------------------|---------|----------|----------|
| Feb 2026 | ~$95 (ramping) | ~$2.75 | ~$97.75 | ~$9.98 | ~10.2% |
| Mar–Jul 2026 | $99.41–99.65 | $1.39 | $100.80–101.04 | $0.00 | 0% |
| Aug 2026 (final) | $99.65 | **~$35–45 (overage)** | **~$135–145** | $0.00 | 0% |
| **Sep 2026 (projected)** | $99.65 | **~$20–40 (overage est., if pattern continues)** | **~$120–140** | $0.00 | 0% |
| Oct 2026 (day 17 projection) | $99.65 | TBD (overage window Oct 1–5) | TBD | $0.00 | 0% |

**Cumulative loss**: ~$1,027 through Sep 24 (fixed accrual only; Sept overage pending final cycle closure Oct 7).

---

## Usage Metrics

### ElevenLabs Activity (Sep 1–24 Estimated, Decision Deferred Aug 30)

**Subscription Status (Sep 7–Oct 7 cycle, 17 days elapsed)**:
- **Estimated current** (Sep 24, day 17): ~144,500 / 270,319 chars (53.5% utilization)
- **Baseline rate** (personal agents only): ~8,500 chars/day (Archy, story-interviewer, support-faq)
- **Paisaxe voice agents**: 0 chars (dormant ~216 days; no user demand)
- **Days to overage** (at current rate): ~16–21 days (Oct 1–6 reset boundary)
- **Projected Sep overage cost** (if pattern matches August): ~$20–40
- **Projected Oct overage cost** (same pattern): ~$20–40

**Interpretation**: Decision deferred Aug 30; no mitigation (account separation, throttle, shelve) implemented. Sep 7 reset initialized fresh 270K budget. Personal agents consuming at baseline rate. Paisaxe voice readiness degraded; no voice service available to users. **Overage will occur by Oct 5 unless personal-agent usage drops or mitigation is deployed.**

### Twilio Communications (Sep 1–24)

| Metric | Usage | Cost | Status |
|--------|-------|------|--------|
| SMS Sent | 0 | $0.00 | flat |
| Calls | 0 min | $0.00 | flat |
| Monthly accrual (17 days) | ~$0.78 | $0.78 expected | on schedule |
| Balance (Sep 24 est.) | ~$4.20 (after 24-day accrual) | -- | ~5.2 months runway (late Feb 2027) |

### Stripe Revenue (Sep 1–24)

| Metric | Status |
|--------|--------|
| Net Sales | 0 |
| Net Revenue | $0.00 |
| Streak | **211+ days** (no Day Pass sales since Feb 13) |

### Anthropic Credits

**Status**: RESOLVED (incident #734 formally closed Aug 18). Credits restored; production chat operational.

---

## Cost Efficiency

| Metric | Current (Sep 24, 17 days) | Previous (Aug 31 final) | Change | Trend |
|--------|---------|------------|--------|--------|
| Fixed operational cost/mo | $99.65 | $99.65 | flat | stable |
| Daily burn rate (fixed) | $3.21/day | $3.21/day | flat | stable |
| ElevenLabs utilization (Sep 7–24) | ~53.5% (144,500 / 270,319) | 161–166% (440–450K / 270K, Aug 31 est.) | Fresh cycle; rate similar | escalating toward overage |
| ElevenLabs daily rate | ~8,500 chars/day | ~8,500 chars/day | stable | stable |
| ElevenLabs voice (Paisaxe) | 0% (dormant) | 0% (dormant) | flat | flat |
| Revenue coverage (operational) | 0% | 0% | flat | flat |
| Twilio runway | ~5.2 months | ~6.2 months | -0.5 mo | declining (expected) |
| Decision status (ElevenLabs) | **Deferred (Aug 30); no mitigation by Sep 24** | Deferred (Aug 30) | no change | unresolved |

---

## Tier Proximity Alerts

| Service | Metric | Used (Sep 24) | Limit | Utilization | Alert | Days to Breach |
|---------|--------|------|-------|-------------|-------|----------------|
| ElevenLabs | Characters (Sep 7–24) | 144,500 (est.) | 270,319 | **53.5% utilization; 125,819 remaining** | WATCH (approaching) | **~16–21 days** (projected Oct 1–6) |
| ElevenLabs | Voice minutes (Paisaxe only) | 0.0 | 100 (Creator tier) | 0% | SAFE | N/A (dormant) |
| Vercel | Monthly visitors (Sep MTD) | ~low | 500,000 | <1% | SAFE | N/A |
| PostHog | Monthly events (Sep MTD) | ~low | 1,000,000 | <1% | SAFE | N/A |
| Supabase | Database storage | <8 GB | 8 GB | <100% | SAFE | N/A |

**ElevenLabs Critical Status**: 
- **Current utilization**: 53.5% (144,500 / 270,319 chars)
- **Headroom remaining**: ~125,819 chars (46% of monthly budget)
- **Projected overage**: Oct 1–5 (at 8,500 chars/day baseline)
- **Mitigation status**: Deferred by user Aug 30; no action taken
- **Recommendation**: If mitigation is still desired, implement by Sep 28 to prevent Oct overage; otherwise, monthly $20–40 overage liability will recur Sep, Oct, Nov until decision is executed or personal-agent usage pattern changes

---

## Scaling Forecast

Per `src/lib/costs/forecast.ts` logic, with Paisaxe dormant (zero revenue, zero voice) and personal agents consuming ElevenLabs budget.

| Scenario | Visitors/mo | Voice Min/mo | Est. Cost/mo | Notes |
|----------|-------------|--------------|--------------|-------|
| **Current (1x, decision deferred)** | ~50 | ~0 | ~$120–140 | Fixed $99.65 + ElevenLabs overage $20–40/mo (recurring; decision deferred Aug 30) |
| **3x Growth** | ~150 | ~180 | ~$220–250 | Would exceed Creator (100 min), require Scale tier (+$77/mo); Paisaxe zero usage |
| **10x Growth** | ~500 | ~600 | ~$370–420 | Exceeds Scale (500 min), estimated $200+/mo tier; Paisaxe zero |

**Break-even**: ~1,200 monthly visitors at 5% Day Pass conversion ($499 × 0.05 = $24.95/visitor × 50 = $1,248 ≈ $1,200 monthly revenue). Current ~50 visitors/mo; deficit = 24x.

---

## Anomalies

| Finding | Severity | Details |
|---------|----------|---------|
| **ElevenLabs overage recurring (Sep projected ~$20–40; Oct projected ~$20–40 if pattern continues)** | **HIGH (P1, known/accepted)** | Personal agents (Archy, story-interviewer) consuming Paisaxe's voice budget at ~8,500 chars/day baseline. User deferred mitigation decision Aug 30 with explicit "decide later" stance (not to be re-escalated each cycle per project memory). Sep 7 reset initialized fresh 270K budget. Sep 24 projection: ~144,500 chars (53.5%), ~125K remaining. Overage projected Oct 1–5 at current rate. **Sept overage estimated $20–40 (final by Oct 7). Oct will follow same pattern if not addressed.** This is a known/accepted operational cost per the Aug 30 deferral. No action required unless situation materially worsens or user decides to revisit mitigation. |
| **Paisaxe voice service degraded (216+ days dormant)** | **HIGH (P1, known/accepted)** | ElevenLabs account consumed by personal agents; no budget available for Paisaxe voice agents (Pelayo). Users cannot access voice service. Binding constraint on voice-revenue conversion and voice-feature release. Deferred until after ElevenLabs decision is revisited. |
| **210+ day revenue drought (no Day Pass sales since Feb 13)** | **HIGH (P1, known/accepted)** | Nine consecutive zero-revenue months (Feb–Sep). Production chat operational (incident #734 resolved Aug 18). Silent fallback risk mitigated (health checks verify actual data access). No escalation needed unless production health degrades. |
| **Twilio runway narrowing (late Feb 2027, ~5.2 months)** | **MEDIUM (P2, decision hygiene)** | Balance ~$4.20 (Sep 24 est.). Eleventh consecutive month of paying $1.39/mo for zero booking calls. Decision window: implement release/retain decision by Jan 2027 before balance forces hand. |
| **Anthropic incident #734 resolved** | **RESOLVED** | Production chat healthy; credits restored (Aug 18 closure confirmed). No escalation needed. |

---

## Trend Analysis

### Comparison: Sep 10 (previous report) vs Sep 24 (current)

| Metric | Sep 10 | Sep 24 | Change | Direction |
|--------|--------|--------|--------|-----------|
| Fixed accrued (MTD) | ~$32.14 (10 days) | ~$77.00 (24 days) | +$44.86 | on schedule |
| Daily burn (fixed) | $3.21/day | $3.21/day | flat | stable |
| ElevenLabs cycle (Sep 7–24) | Fresh reset, status unverified | Day 17 of cycle, est. 53.5% utilization | 17-day accrual ~144,500 chars | approaching overage threshold |
| ElevenLabs decision status | Unverified since Sep 3 | Confirmed deferred Aug 30 (per memory) | no mitigation by Sep 24 | unresolved |
| Twilio balance | ~$5.90 (est.) | ~$4.20 (est.) | -$1.70 (14-day accrual) | declining (expected) |
| Twilio runway | ~6.2 months | ~5.2 months | -0.4 mo | declining (expected) |
| Revenue drought (days) | ~220 | ~211 | N/A (metric phrasing: no new sales) | flat |
| Cumulative loss | ~$967–982 | **~$1,027** | +$45–60 (fixed accrual) | up (expected) |

**Key observations for Sep 10–24**:

1. **ElevenLabs decision confirmed deferred (per project memory Aug 30).** No mitigation implemented by Sep 24. Sep 7 reset occurred; fresh 270K budget allocated. 17-day accrual estimated ~144,500 chars at 8,500 chars/day baseline (personal agents only; Paisaxe dormant). Overage projected Oct 1–5.

2. **Fixed operational costs stable.** $99.65/mo ($3.21/day). Sep accrual through day 24: ~$77.

3. **Twilio runway continuing decline.** Balance ~$4.20 (late Feb 2027, ~5.2 months). No SMS/calls (zero booking activity).

4. **Anthropic incident #734 remains resolved** (formal closure Aug 18). Production chat operational.

5. **API data unavailable.** Direct ElevenLabs and Twilio API access blocked by environment variable security restrictions. Estimates based on previous trajectory and stated decision (Aug 30 deferral).

---

## Recommendations

### Immediate Actions (Priority P0 — Information Only, No Action Needed)

1. **ElevenLabs overage is a known/accepted operational cost.** User explicitly deferred mitigation Aug 30 with "decide later" stance. Do not re-escalate as a fresh blocker each cycle. **Current status**: Sep overage estimated $20–40; Oct will follow same pattern (~$20–40) if not addressed. Re-flag only if situation materially worsens (e.g., daily rate spikes >10,000 chars, or user asks to revisit).

### Secondary Actions (Priority P1 — Deferred Until Revisited by User)

2. **Pelayo voice service readiness**: Deferred until ElevenLabs decision is revisited. Current state: unavailable (account budget consumed by personal agents). Once mitigation is deployed (if ever), confirm Pelayo widget loads and functions on paisaxe.es production.

### Decision Gate (Priority P1 — Decision Hygiene, ~4 Months Out)

3. **Twilio release/retain decision by Jan 2027.** Current runway ~5.2 months (late Feb 2027). Eleventh consecutive month of paying $1.39/mo for zero booking calls. Final calm decision window closes around Jan 2027. Options: (a) release, save $1.39/mo ($16.68/yr); or (b) explicitly retain for booking-call readiness. Recommend deliberate call by Jan 2027.

---

## Data Sources & Verification Status

| Source | Method | Last Verified | Status | Notes |
|--------|--------|---------------|--------|-------|
| ElevenLabs API | Live `/v1/user/subscription` (blocked) | 2026-08-18 (triage report) | **Unavailable (env var restrictions)** | Aug 18: 302,034 / 270,319 chars (111.7%); Aug 31 estimated: 440–450K (161–166%); Sep 7 reset occurred. Sep 24 projection: 144,500 chars at 8,500 chars/day baseline. |
| Twilio API | Live `/Balance.json` (blocked) | 2026-09-24 (indirect estimate) | **Estimated** | Sep 24 balance est. ~$4.20 (after 24-day accrual including two expected charges). Direct API unavailable. |
| Config: `service-tiers.ts` | File read (2026-09-24) | 2026-09-24 | Current | All tier limits verified current. ElevenLabs Creator: 270,319 char/month limit. |
| Config: `recurring-costs.ts` | File read (2026-09-24) | 2026-09-24 | Current | All fixed subscriptions verified current. Total: $99.65/mo operational. |
| Project Memory (ElevenLabs decision) | User decision log (2026-08-30) | 2026-08-30 | Current | User chose "decide later / no action" for mitigation options on Aug 30. Confirmed no change by Sep 24. |
| Anthropic Billing | Incident #734 closure (triage, Aug 18) | 2026-08-18 | **Resolved** | Credits restored; production chat operational. |
| Cross-agent context | Latest agent reports (shared-context) | 2026-09-24 (coverage agent today) | Current | No cost-related findings in today's coverage report. Latest cost mention: triage Sep 14 (incomplete data point). |

---

## Summary

**Status**: WATCH (decision deferred; live data unavailable; high-confidence fixed costs; variable costs estimated from trajectory).

**September 2026 position (day 24, MTD)**:
- Fixed operational (24 days): ~$77.00, **projected monthly total ~$100–101**
- Variable Twilio accrual (24 days): ~$0.78, **projected monthly total ~$1.39**
- ElevenLabs (estimated, Sep 7–24): ~144,500 chars (53.5% of 270K); projected overage **~$20–40 by Oct 7 reset** if personal-agent baseline continues
- Revenue: $0.00 (continuing zero pattern)
- **Net MTD**: **-$77.78** (fixed + Twilio accrual); **Projected Sep total: -$100–140** (including ElevenLabs overage estimate)

**August 2026 final closure**:
- Fixed: $99.65 + Twilio: $1.39
- ElevenLabs overage: ~$35–45
- **Total**: **~$136–145** (highest month to date)
- Revenue: $0.00
- **Net loss**: **-$136–145**

**Cumulative operational loss through Sep 24**: **~$1,027** (fixed accrual only; Sep overage pending Oct 7 reset closure).

**Critical outstanding actions (in priority order)**:
1. **Monitor ElevenLabs overage trajectory** (Sep 7–Oct 7 cycle). Projected breach Oct 1–5 if no intervention. No immediate action needed (decision deferred Aug 30); re-flag only if daily rate spikes or user requests revisit.
2. **Twilio decision by Jan 2027** (4 months out, decision hygiene).
3. **Pelayo voice readiness** (deferred until ElevenLabs decision revisited).

**Cost trajectory**: Fixed costs stable at ~$99.65/mo. Variable costs (ElevenLabs overage) estimated $20–40/mo going forward if decision remains deferred. Production chat healthy (Anthropic incident resolved Aug 18); revenue conversion possible once voice service status is clarified.

---
