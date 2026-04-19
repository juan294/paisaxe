# ADR-001: Vercel Region Strategy and Supabase Collocation

**Status:** Accepted
**Date:** 2026-04-19
**Deciders:** Juan Gonzalez
**Finding ID:** DO-M6

---

## Context

Paisaxe is deployed on Vercel with a single region configured in `vercel.json`:

```json
"regions": ["cdg1"]
```

`cdg1` is Vercel's Paris data center (eu-west-3 in AWS terms). The Supabase project region has not been formally documented, which means every database query — auth refresh, chat RAG pipeline, feature flag reads — could be incurring unnecessary cross-region round-trip latency if Supabase is not colocated.

This ADR documents the current state, the tradeoffs evaluated, and the decision reached.

---

## Current State

### Vercel

| Setting | Value | Source |
|---------|-------|--------|
| Region | `cdg1` (Paris, France) | `vercel.json:3` |
| Deployment | Single-region | `vercel.json:3` |

### Supabase Region

The Supabase project region must be verified by the operator via:

**Supabase Dashboard → Project Settings → Infrastructure → Region**

Until verified, the region is unknown. If the project was created with default settings in early 2025, Supabase defaults at that time were typically `us-east-1` (North Virginia). A cross-Atlantic RTT of ~80–120 ms per query would compound:

- Auth session refresh on every server-rendered request (via `proxy.ts`)
- Chat SSE: vector search + rerank queries during each streaming response
- Feature flag reads (cached but cold-start penalty still applies)

---

## Options Evaluated

### Option A: Single region (cdg1) — status quo

- **Pros:** Simple, no configuration overhead, cheapest, Vercel manages failover within the region automatically via edge redundancy.
- **Cons:** cdg1 outage → site entirely down. No geographic redundancy.
- **Supabase impact:** If Supabase is already in eu-west-3 or eu-central-1, RTT is 5–20 ms. If in us-east-1, RTT is ~90–120 ms per query.

### Option B: Multi-region (cdg1 + lhr1 + fra1)

- **Pros:** Regional redundancy. If Paris goes down, London or Frankfurt can serve.
- **Cons:** Supabase remains single-region (Supabase does not offer multi-region on the Pro plan). Queries from lhr1/fra1 still hit the same Supabase endpoint. Cold functions in secondary regions add latency. Significantly more complex to reason about. Vercel charges per region for some resource types.
- **Verdict:** The complexity and cost increase is not justified for a solo-operated tourism site at current traffic levels.

### Option C: Migrate Supabase to eu-west-1 (Dublin) or eu-central-1 (Frankfurt)

- **Pros:** Colocation with cdg1. Minimizes RTT (Dublin ↔ Paris ~20 ms; Frankfurt ↔ Paris ~10 ms). No Vercel changes needed.
- **Cons:** Supabase project migration is destructive — requires creating a new project, re-running all migrations, re-seeding embeddings, updating all environment variables, and cutting over DNS. High operational risk.
- **Verdict:** Not worth the migration cost if the current Supabase region is already in Europe. Worth pursuing if verified to be in us-east-1 with measurable latency impact.

---

## Decision

**Maintain the single-region deployment on `cdg1` (Paris).**

Rationale:
1. Traffic volume does not justify multi-region complexity.
2. Vercel's infrastructure provides intra-region redundancy within cdg1.
3. The primary risk (Supabase cross-region latency) is addressable without a region change — by verifying Supabase is in a European AWS region.

**Action required (operator):** Verify the Supabase project region:

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → select the Paisaxe project.
2. Go to **Settings → Infrastructure**.
3. Note the **Region** field.

**If region is already `eu-west-1`, `eu-west-3`, or `eu-central-1`:** No action needed. Document the value in `docs/operations/vercel-regions.md`.

**If region is `us-east-1` or any non-European region:** File a follow-up issue to evaluate a Supabase project migration to `eu-central-1` (Frankfurt), which has the lowest RTT to cdg1 (~10 ms).

---

## Consequences

### Accepted risks

- **Full outage on cdg1 failure.** Vercel's historical uptime for cdg1 is high (>99.9%), but a regional AWS eu-west-3 event would take down the entire site. Recovery depends on Vercel's incident SLA, typically 15–60 minutes for regional issues.
- **Unknown Supabase RTT.** Until the operator verifies the Supabase region, database latency is unquantified. The performance findings PE-H3/PE-H4 (auth-refresh timeout, chat SSE latency) may be partially caused by cross-region queries.

### Mitigations in place

- Upptime monitors `paisaxe.es` and `paisaxe.es/api/health` every 5 minutes and opens GitHub Issues on downtime.
- Feature flags are read via a cached API route, reducing Supabase round-trips on repeat requests.
- The health endpoint (`/api/health`) reports Supabase latency — this is a leading indicator for region mismatch.

### Follow-up

- [ ] Operator verifies Supabase region (see `docs/operations/vercel-regions.md` for instructions)
- [ ] If Supabase is in us-east-1, file issue: "Migrate Supabase project to eu-central-1 to reduce RTT to cdg1"
- [ ] After verification, update `docs/operations/vercel-regions.md` with the confirmed Supabase region

---

## References

- `vercel.json:3` — current region configuration
- [Vercel Regions documentation](https://vercel.com/docs/edge-network/regions)
- [Supabase regions](https://supabase.com/docs/guides/platform/regions) — lists all supported regions including eu-central-1 (Frankfurt) and eu-west-1 (Ireland)
- Issues: PE-H3, PE-H4 (latency findings), DO-M6 (this finding)
- `docs/operations/vercel-regions.md` — operational runbook for region management
