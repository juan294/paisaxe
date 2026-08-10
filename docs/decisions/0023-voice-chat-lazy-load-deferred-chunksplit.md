# ADR-0023: Voice Chat Lazy-Load Is Correct; Further Chunk-Splitting Deferred Post-Launch

**Status:** Accepted  
**Date:** 2026-06-20  
**Finding:** PE-L1 (performance, low severity)

---

## Context

A pre-launch performance audit (PE-L1) noted that `src/components/immersive/voice-chat.tsx`
(lines 46–54) loads the ElevenLabs/LiveKit chunk. The finding's own recommendation
was: *"optional, do not prioritize before launch."*

## Decision

**No code change is made.** The current implementation is already correct.

### Why the current lazy-load is sufficient

`voice-chat.tsx` is already lazy-loaded at the page level via `next/dynamic` in
the immersive page. The ElevenLabs/LiveKit bundle is NOT included in the initial
page load — it is fetched only when the voice agent panel is opened.

Further intra-component chunk-splitting (e.g., splitting the ElevenLabs SDK from
the LiveKit WebRTC layer into separate dynamic imports) would:

1. Add complexity with marginal measurable benefit for a feature used by a subset
   of paid users.
2. Introduce a risk of race conditions between the two dynamic imports on slow
   connections.
3. Require regression testing of the voice panel initialisation sequence.

### Post-launch deferral rationale

The ElevenLabs/LiveKit chunk is only fetched after:
- User is authenticated
- User has an active voice purchase
- User explicitly opens the voice panel

At that interaction point, a chunk fetch is expected and tolerated. The impact on
Lighthouse / Core Web Vitals is negligible because the chunk is not on the
critical render path.

## Consequences

- No performance regression risk.
- If voice usage grows and profiling shows the chunk size is a genuine bottleneck,
  revisit splitting after launch with real RUM data to justify the change.
- Future engineers who encounter PE-L1 in historical audit reports should treat
  it as resolved-by-documentation (this ADR).
