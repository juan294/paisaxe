# Plan: ElevenLabs Agent Modernization — Paisaxe

**Date:** 2026-07-25
**Research:** `docs/research/2026-07-25-elevenlabs-agent-modernization-audit.md`
**Goal:** Make Paisaxe the sole owner of its five agents, reconcile tools/tests, introduce signed sessions, guardrails, native multilingual voices, Eleven v3, and privacy-minimized retention while preserving booking integrity and existing visitor-time personalization.

## Implementation status — 2026-07-25

- [x] Canonical Paisaxe inventory, rollback snapshots, scoped agent/tool
  writers, and reconciled live test fixtures.
- [x] Signed visitor and admin session endpoints and browser-client migration.
- [x] Zero-traffic candidate branches for all five agents.
- [x] Candidate v3/Expressive Mode, prompt-injection protection, and
  workspace-resolvable native Pelayo voices.
- [x] Booking branch hard gates: 15/15; Pelayo booking confirmation and tool
  gates: 6/6.
- [ ] Pelayo full behavioral and retained-language gates. Off-topic and
  language simulations still fail; Focus was rejected on Pelayo after a
  regression trial.
- [ ] First-word native-language audio, v3 prosody, interruption, noise, and
  latency evidence.
- [ ] Production signed-session proof, signed-only auth, privacy cutover,
  staged traffic promotion, and Main synchronization. These remain gated; no
  Main traffic/auth/privacy promotion was performed.

Exact branch/version/test evidence and blockers are recorded in
`docs/operations/evidence/elevenlabs/2026-07-25-modernization-status.md`.

## Resolved design decisions

1. Paisaxe owns all five tracked agents. Archy and Portfolio copies are non-authoritative.
2. Pelayo Visitor and Booking are the customer-facing first wave; Penny, Iris, and Xander follow as a separate internal/social wave. All five remain in scope.
3. Existing `is_returning`, `time_of_day`, `current_time`, locale, and Madrid destination context are preserved. No second greeting system is added.
4. `save_favorite` remains intended product behavior, but is attached only after its endpoint/auth contract passes and the tool receives a real remote ID.
5. Agent-ID sessions are replaced by server-minted signed sessions before `enable_auth` changes. Visitor entitlement and admin authorization remain prerequisites to minting.
6. Focus and prompt-injection guardrails are separate branch versions. Booking/tool-integrity custom guardrails are a later isolated version.
7. Native per-language voices and v3 are separate versions. All exposed language presets must resolve to a native/workspace voice or be removed from the exposed surface.
8. Privacy target is recording off and 30-day retention for new conversations only; existing transcript webhooks remain functional.

## Phase index

| Phase | Title | Type | Batch |
|---|---|---|---|
| 1 | Canonical agents, tools, and clean test baseline | repository/platform | `[batch-eligible]` |
| 2 | Signed visitor/admin session path | application/security | `[batch-eligible]` with non-Paisaxe ownership work |
| 3 | Guardrails, native voices, v3, and pacing | agent behavior | Sequential |
| 4 | Auth/privacy cutover, promotion, and closure | live rollout | Sequential |

Detailed files: `docs/plans/2026-07-25-elevenlabs-agent-modernization-phases/phase-N.md`.

## Rollout order

Pelayo Visitor → Pelayo Booking → Penny → Iris → Xander. Every agent uses its own branch, tests, audio evidence, version description, and rollback snapshot. No broad five-agent push is used.

## Global success criteria

### Automated

- Manifests/versions and tool IDs match authenticated readback.
- The 47-scenario harness has zero hard failures before modernization; security/booking sections remain zero-failure after every change.
- Signed-session routes cover unauthorized, key-missing, wrong-agent, provider-failure, and success cases.
- Scoped dry runs select exactly one agent/tool set.
- `npm run test; npm run typecheck; npm run lint; npm run prelaunch` passes sequentially.

### Manual

- Pelayo preserves natural Asturias context, returning/time-of-day greetings, weather/place results, booking confirmation semantics, real phone/SMS flow, accent, interruptions, and background-noise behavior.
- Each exposed language starts with the correct native voice from the first word.
- Admin social-agent sessions still work after signed auth.
- No live agent/config change without `/implement` authorization.

## Privacy and destructive boundary

Retention changes use `apply_to_existing_conversations=false`. Retroactive deletion is excluded. If a transcript webhook or product path proves longer retention is required, that named agent keeps the minimum measured exception and documents it in the live readback.

## Out of scope

- Roots, Archy, Coach, and Spoken Letter agents.
- Changing booking business semantics or RAG documents.
- Workflow conversion.
- Publishing languages that the runtime cannot select and the rubric cannot verify.
