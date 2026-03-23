# Phase 9: JS Budget Restructure + Manual Reviews `[batch-eligible]`

> **Files**: Non-code (GitHub issues, decisions)
> **Estimated effort**: Small

## Problem

Three items from the agent reports require decisions rather than code changes, plus one process improvement for JS budget tracking.

## Actions

### 1. JS Budget Restructure

The current 2,500 KB budget measures total JS including deferred chunks. With 914 KB deferred behind dynamic imports, the initial load is ~1,500 KB — well under any performance threshold. The budget penalizes good code-splitting.

**Proposed new budgets:**
- **Initial load JS**: ≤ 1,800 KB (currently ~1,500 KB — 300 KB headroom)
- **Total JS**: ≤ 3,000 KB (currently ~2,726 KB — 274 KB headroom)

**Action**: Update the bundle size check in `.github/workflows/bundle-size.yml` or wherever the 2,500 KB budget is enforced. If it's only in the Performance Agent report, update the report template and `docs/operations/quality-agents.md`.

```bash
# Find where the budget is defined
grep -r "2500\|2,500" docs/ scripts/ .github/ --include="*.md" --include="*.yml" --include="*.sh"
```

### 2. Anthropic Billing Check (Manual)

**Action**: Juan checks Anthropic billing at [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing).

Record March MTD spend. With the platform dormant (no chat queries in 20+ days), spend should be minimal — only automated agents/cron triggering Claude API calls.

**File GitHub issue** to track adding a periodic billing check reminder to the cost analyst workflow if the manual check reveals any surprises.

### 3. Evaluate Vercel Pro ($20/mo)

**Context**: ~50 visitors/month. Hobby tier includes 50K visitors. Pro provides:
- Team features (not needed — solo dev)
- Analytics (have PostHog)
- Longer build times (10 min vs 45 min)
- Password protection for previews
- More serverless function duration (60s vs 10s)
- Web analytics (have PostHog)

**Key question**: Does any API route or cron job need >10s serverless execution? If yes, Pro is justified. If no, $240/year could be saved.

**Action**: Check if any serverless functions approach the 10s limit:
```bash
# Check Vercel function logs for execution times
vercel logs --limit 20
```

**File GitHub issue** with the finding and recommendation.

### 4. Evaluate Twilio Phone Number ($1.15/mo)

**Context**: Zero booking calls in 20+ days. $1.15/mo = $13.80/year. Twilio balance: $15.45 (~13.4 months at current rate).

**Key question**: Is the booking system actively marketed to users? If Pelayo's booking feature is behind a feature flag that's disabled, the phone number serves no purpose.

**Action**: Check booking feature flag status:
```bash
# Check if booking_system flag is enabled in production
curl -s https://paisaxe.es/api/feature-flags | jq '.booking_system'
```

**File GitHub issue** with the finding and recommendation. If booking is disabled, recommend releasing the number when the Twilio balance runs low (no urgency — 13 months of runway).

## Deliverables

| Item | Deliverable |
|------|-------------|
| JS budget | Updated budget numbers in docs/config |
| Anthropic billing | GitHub issue with March MTD spend |
| Vercel Pro | GitHub issue with keep/drop recommendation |
| Twilio number | GitHub issue with keep/drop recommendation |

## Notes

- None of these items block the other phases
- The GitHub issues ensure these decisions are tracked and revisited
- Vercel Pro and Twilio decisions are not urgent — file issues and move on
- The JS budget change is a documentation/config update, not a code change
