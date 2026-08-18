# Vercel Region Management

Operational guidance for Paisaxe's Vercel deployment region, Supabase collocation, and regional incident response.

See [ADR-001](../decisions/ADR-001-vercel-region-strategy.md) for the full tradeoff analysis and the decision to maintain a single-region deployment.

---

## Current Configuration

| Setting | Value | File |
|---------|-------|------|
| Vercel region | `fra1` (Frankfurt, Germany — AWS eu-central-1) | `vercel.json:3` |
| Supabase region | `Central Europe (Zurich)` | verified via `supabase projects list` on 2026-04-23 |
| Deployment model | Single-region | `vercel.json:3` |

---

## Verifying the Supabase Region

The Supabase project region determines the round-trip time for every database query from the Vercel functions running in `fra1`.

**Steps:**

1. Open [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Select the **Paisaxe** project.
3. Go to **Settings** (gear icon in left sidebar) → **Infrastructure**.
4. The **Region** field shows the AWS region (e.g., `eu-west-3`, `us-east-1`).

**Target regions for lowest RTT to `fra1` (Frankfurt):**

| Supabase Region | AWS Name | Approx RTT to fra1 |
|-----------------|----------|---------------------|
| `eu-central-2` | Zurich, Switzerland | ~5–10 ms (adjacent region) |
| `eu-central-1` | Frankfurt, Germany | ~5 ms (same metro area) |
| `eu-west-3` | Paris, France | ~15 ms |
| `eu-west-1` | Dublin, Ireland | ~25–30 ms |
| `us-east-1` | N. Virginia, USA | ~90–120 ms |
| `us-west-1` | N. California, USA | ~150–170 ms |

**Desired outcome:** Supabase should be in `eu-central-2`, `eu-central-1`, `eu-west-3`, or `eu-west-1` to keep database RTT under 30 ms.

**Current verified outcome:** The linked Supabase project is already in `Central Europe (Zurich)`. Vercel does not currently expose a Zurich region, so Paisaxe uses `fra1` as the nearest supported function region.

---

## Checking Supabase RTT in Production

The public `/api/health` response no longer reports a per-service latency figure (the
`services.supabase.latency_ms` field was removed — see SE-M1's response minimization).
`checkSupabase()` in `src/app/api/health/route.ts` still performs a live `chunks` query
on every call, so timing the overall request is a genuine (if slightly padded, since it
also includes Vercel function overhead) proxy for Supabase RTT from `fra1`:

```bash
curl -s -o /dev/null -w '%{time_total}\n' https://paisaxe.es/api/health
# time_total is in seconds — multiply by 1000 for ms, e.g. 0.045 -> 45 ms
```

**Thresholds** (these now include HTTP + Vercel function overhead on top of the raw
Supabase round trip, so treat them as directional rather than precise — a consistent
increase across repeated runs is the actionable signal, not a single reading near a
boundary):

| Total request time | Diagnosis |
|---------|-----------|
| < 60 ms | Supabase colocated in same or adjacent AWS region |
| 60–150 ms | Supabase in nearby European region |
| > 200 ms | Supabase likely in a non-European region — investigate |
| > 800 ms | Connection degraded — check Supabase status page |

If latency is consistently > 80 ms, see the [migration guidance](#supabase-migration-guidance) below.

---

## Changing the Vercel Region

The region is set in `vercel.json:3`:

```json
{
  "regions": ["fra1"]
}
```

**To change the region:**

1. Open [https://vercel.com/docs/edge-network/regions](https://vercel.com/docs/edge-network/regions) and select the target region code.
2. Edit `vercel.json` and replace the current region with the target code (for example, `fra1` for Frankfurt).
3. Commit and push to `develop`. Let CI validate the build.
4. Create a PR from `develop` → `main` for production deployment.
5. After deployment, verify the health endpoint and check Supabase RTT.

**Supported European region codes:**

| Code | Location |
|------|----------|
| `fra1` | Frankfurt, Germany |
| `cdg1` | Paris, France |
| `lhr1` | London, UK |
| `arn1` | Stockholm, Sweden |
| `dub1` | Dublin, Ireland |

**Multi-region:** List multiple codes as an array, e.g., `["fra1", "cdg1"]`. This is not recommended for the current traffic level — see ADR-001 for rationale.

---

## Regional Outage Incident Response

### Status Pages to Monitor

| Service | Status URL |
|---------|-----------|
| Vercel | https://www.vercel-status.com/ |
| Supabase | https://status.supabase.com/ |
| Anthropic (Claude API) | https://status.anthropic.com/ |
| AWS eu-central-1 (underlying Vercel fra1 infra) | https://health.aws.amazon.com/health/status |

### Escalation

Sole operator: **Juan Gonzalez** (juan294@gmail.com). Communication channel: GitHub Issues — Upptime automatically opens one when `paisaxe.es` becomes unreachable.

### If Vercel fra1 is down

The entire site goes down — there is no automatic secondary region failover for a single-region deployment.

**Immediate steps:**

1. **Confirm the outage is Vercel, not the application.**
   - Check [https://www.vercel-status.com/](https://www.vercel-status.com/)
   - Check [https://health.aws.amazon.com/health/status](https://health.aws.amazon.com/health/status) for `eu-central-1` status
2. **Post a status update** if the outage is confirmed external:
   - Upptime will automatically open a GitHub Issue when `paisaxe.es` is unreachable.
   - Add a comment to the Upptime issue with "Confirmed Vercel fra1 outage — monitoring."
3. **Manual recovery option (if outage is prolonged > 1 hour):**
   - Edit `vercel.json` and change `"regions": ["fra1"]` to a nearby fallback such as `"cdg1"` (Paris) or `"lhr1"` (London).
   - Commit and push to `develop`, then create a PR to `main` and merge to trigger a redeployment in the new region.
   - Revert the region change once Vercel fra1 is restored.
4. **Wait for Vercel recovery.** Vercel's SLA for regional incidents is typically 15–60 minutes. Do not attempt to redeploy during an active platform outage unless using the manual recovery option above.
5. **After recovery:** Verify the health endpoint and confirm site is back.

```bash
curl -s https://paisaxe.es/api/health | jq '.status'
# Expected: "healthy"
```

### If Supabase is down (but Vercel is healthy)

The health endpoint will report top-level `status: "degraded"` (no `.services.supabase`
field to break this out per-service — see the RTT section above):

```bash
curl -s https://paisaxe.es/api/health | jq '.status'
```

1. Check [https://status.supabase.com/](https://status.supabase.com/).
2. The site remains reachable but chat, auth, and feature flags will fail.
3. Consider enabling `maintenance_mode` in the admin dashboard to show a friendly message rather than error states.

**To enable maintenance mode:**

```bash
# Via admin API (requires auth)
curl -X POST https://paisaxe.es/api/admin/feature-flags \
  -H "Content-Type: application/json" \
  -d '{"key": "maintenance_mode", "enabled": true}'

# Or via admin dashboard at https://paisaxe.es/admin
```

---

## Supabase Migration Guidance

Only pursue this if verified Supabase RTT is > 80 ms and it is impacting user-facing latency (PE-H3/PE-H4).

**Target region:** `eu-central-2` (Zurich) if Vercel ever adds support, otherwise keep Vercel in `fra1` and colocate Supabase in central Europe.

**Migration steps (high-level — requires operator execution):**

1. Create a new Supabase project in `eu-central-1`.
2. Export schema: run all migrations from `supabase/migrations/` in order.
3. Re-seed embeddings: `npm run seed-db` (this re-generates all Voyage embeddings — takes ~30–60 min).
4. Update environment variables in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Deploy to preview environment and verify all functionality.
6. Switch production environment variables and redeploy.
7. Decommission the old Supabase project after 30 days of stable operation.

**Warning:** This is a destructive operation. All data in the old project is not automatically migrated. The `chunks` table (embeddings) must be re-seeded. User data (profiles, feature flags) must be backed up and restored manually via `pg_dump` / `psql`.

---

## References

- [ADR-001: Vercel Region Strategy](../decisions/ADR-001-vercel-region-strategy.md)
- [Vercel Regions](https://vercel.com/docs/edge-network/regions)
- [Supabase Regions](https://supabase.com/docs/guides/platform/regions)
- [Vercel Status](https://www.vercel-status.com/)
- [Supabase Status](https://status.supabase.com/)
- `vercel.json` — region configuration
- `/api/health` — real-time Supabase latency reporting
