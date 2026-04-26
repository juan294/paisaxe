# ADR-001: Vercel Region Strategy and Supabase Collocation

**Status:** Accepted
**Date:** 2026-04-19
**Deciders:** Juan Gonzalez
**Finding ID:** DO-M6

---

## Context

Paisaxe is deployed on Vercel with a single region configured in `vercel.json`:

```json
"regions": ["fra1"]
```

`fra1` is Vercel's Frankfurt data center (eu-central-1 in AWS terms). The linked Supabase project has now been verified as `Central Europe (Zurich)`. Vercel's current public region list does not expose a Zurich function region, so Frankfurt is the nearest supported deployment target.

This ADR documents the current state, the tradeoffs evaluated, and the decision reached.

---

## Current State

### Vercel

| Setting | Value | Source |
|---------|-------|--------|
| Region | `fra1` (Frankfurt, Germany) | `vercel.json:3` |
| Deployment | Single-region | `vercel.json:3` |

### Supabase Region

The linked Supabase project has been verified via `supabase projects list`:

| Setting | Value |
|---------|-------|
| Project | `asturias` |
| Region | `Central Europe (Zurich)` |

The remaining latency risk is therefore not cross-Atlantic placement, but using a Vercel region that is farther away than necessary. Every request still pays for the round-trip between Vercel Functions and Supabase on:

- Auth session refresh on every server-rendered request (via `proxy.ts`)
- Chat SSE: vector search + rerank queries during each streaming response
- Feature flag reads (cached but cold-start penalty still applies)

---

## Options Evaluated

### Option A: Single region (fra1) — central Europe alignment

- **Pros:** Simple, no configuration overhead, cheapest, Vercel manages failover within the region automatically via edge redundancy.
- **Cons:** `fra1` outage → site entirely down. No geographic redundancy.
- **Supabase impact:** Zurich ↔ Frankfurt should stay in the low-double-digit millisecond range and is the closest supported Vercel option.

### Option B: Multi-region (`fra1` + `cdg1` + `lhr1`)

- **Pros:** Regional redundancy. If Paris goes down, London or Frankfurt can serve.
- **Cons:** Supabase remains single-region. Queries from secondary regions still hit Zurich. Cold functions in secondary regions add latency. Significantly more complex to reason about. Vercel charges per region for some resource types.
- **Verdict:** The complexity and cost increase is not justified for a solo-operated tourism site at current traffic levels.

### Option C: Keep `cdg1` and accept the extra hop

- **Pros:** No deployment config change.
- **Cons:** Paris is farther from Zurich than Frankfurt, so every server-side data path keeps avoidable latency.
- **Verdict:** Inferior to moving the Vercel region to Frankfurt.

---

## Decision

**Maintain the single-region deployment, but move it to `fra1` (Frankfurt).**

Rationale:
1. Traffic volume does not justify multi-region complexity.
2. Vercel's infrastructure provides intra-region redundancy within a single function region.
3. Frankfurt is the closest Vercel-supported region to the verified Supabase location in Zurich.
4. This keeps the deployment simple while removing the avoidable Paris hop.

---

## Consequences

### Accepted risks

- **Full outage on `fra1` failure.** A regional AWS `eu-central-1` event would still take down the entire site. Recovery depends on Vercel's incident SLA, typically 15–60 minutes for regional issues.
- **No exact RTT measurement yet.** The region alignment is materially better on paper, but preview-vs-preview latency comparison still requires a deployment-side measurement.

### Mitigations in place

- Upptime monitors `paisaxe.es` and `paisaxe.es/api/health` every 5 minutes and opens GitHub Issues on downtime.
- Feature flags are read via a cached API route, reducing Supabase round-trips on repeat requests.
- The health endpoint (`/api/health`) reports Supabase latency — this is a leading indicator for region mismatch.

### Follow-up

- [x] Verify the linked Supabase region (`Central Europe (Zurich)`) and document it in `docs/operations/vercel-regions.md`
- [ ] After the next production deploy, compare `/api/health` Supabase RTT against the prior Paris deployment

---

## References

- `vercel.json:3` — current region configuration
- [Vercel Regions documentation](https://vercel.com/docs/edge-network/regions)
- [Supabase regions](https://supabase.com/docs/guides/platform/regions) — lists all supported regions including eu-central-1 (Frankfurt) and eu-west-1 (Ireland)
- Issues: PE-H3, PE-H4 (latency findings), DO-M6 (this finding)
- `docs/operations/vercel-regions.md` — operational runbook for region management
