# Phase 4: Add Bahrain Function Region

> **Goal**: Add a serverless function region closer to Middle East users to reduce cold-start latency.
> **Depends on**: None (independent of all other phases)
> **Batch**: [batch-eligible] — can run in parallel with Phase 1

## Context

The only function region is `cdg1` (Paris, France). Speed Insights shows traffic from UAE, which is ~5,000km from Paris. Adding `bah1` (Bahrain) puts a function instance ~500km from UAE users, reducing network latency by an order of magnitude.

With Phases 1-3 (ISR + PPR), most requests are served from CDN and never hit the function. But for cache misses and ISR revalidation, a closer function region means faster regeneration.

## Files Changed

| File | Action |
|------|--------|
| `vercel.json` | Add `"bah1"` to `regions` array |

## Implementation

### 1. `vercel.json`

```pseudo
CHANGE regions:
  BEFORE: "regions": ["cdg1"]
  AFTER:  "regions": ["cdg1", "bah1"]
```

## Verification

### Automated
```bash
# Verify vercel.json is valid JSON
node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('valid')"
```

### Manual
```bash
# After deploy: Verify function runs in both regions
# (requires Vercel dashboard or logs — check Function Logs for region header)

# TTFB from UAE should improve on cache misses
# Compare before/after via Vercel Speed Insights (requires 7+ days of data)
```

## Trade-offs

- **More cold starts**: With low traffic split across two regions, each region gets fewer requests = more cold starts per region. However, with ISR/PPR (Phases 1-3), cold starts are rare since most requests are CDN hits.
- **No cost increase**: Vercel Pro includes all regions at no extra charge.
- **Supabase latency**: The Supabase project's region doesn't change. If Supabase is in EU, the Bahrain function still needs to reach EU for data. With ISR data caching (60s), this only happens during revalidation, not on every request.

## Notes

- Vercel automatically routes users to the nearest function region. UAE users will hit `bah1`, European users will hit `cdg1`.
- This phase provides marginal benefit after Phases 1-3 (since CDN serves most requests). Its main value is for cache-miss scenarios and ISR background revalidation speed.
- If Vercel analytics show the additional region isn't being used (no traffic), it can be removed with no impact.
