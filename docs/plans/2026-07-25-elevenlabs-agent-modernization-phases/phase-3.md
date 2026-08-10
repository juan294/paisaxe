# Phase 3 — Guardrails, native voices, v3, and pacing

**Depends on:** Phase 1; Phase 2 must be production-ready before public traffic.
**Batch:** no; one agent and one change class at a time.

## Outcome

All five agents have evidence-backed guardrails and v3 behavior; Pelayo's exposed languages use native voices and retain booking/tool integrity.

## Per-agent branch procedure

For each agent, create `modernization/2026-07-25/<agent>` from current Main at 0% traffic. Run tests with `branch_id` and `repeat_count=3`.

### Revision A — Focus

Enable Focus only. Run full tests, off-topic cases, and benign false-positive/audio latency rubric.

### Revision B — prompt injection

Enable Manipulation/prompt-injection only. Run security sections and prompt exfiltration/persona/tool-abuse cases.

### Revision C — domain custom guardrails

- Visitor: secret/tool-authorization boundary.
- Booking: never claim confirmation without a successful tool result.
- Social agents: platform guardrails only unless a measured domain failure justifies a custom rule.

Prefer streaming guardrails for voice. A blocking rule must prove acceptable latency.

### Revision D — native voices only

1. Enumerate every exposed preset and the runtime routes that can select it.
2. For Spanish retain Ignacio. Select workspace-resolvable native voices for English and any retained de/fr/it/pt/pt-br preset.
3. Remove a preset only if no supported runtime can select/test it and the removal is reflected in product docs.
4. Set only `language_presets.<lang>.overrides.tts.voice_id`.
5. Verify from the first spoken word in each language.

### Revision E — v3/Expressive only

Change TTS model/Expressive Mode without changing voices, prompts, tools, or pacing. Coach is the comparison control.

### Revision F — pacing

Keep the existing seven-second Pelayo and ten-second social baselines first. Change one parameter/version only if the v3 rubric demonstrates a defect.

## Automated success criteria

- 47 tests ×3 pass for each Pelayo accepted revision; social agent applicable suites pass.
- Security and booking integrity have zero failures.
- Tool and RAG attachments are unchanged unless Revision C explicitly changes them.
- Every preset voice resolves through the API.

## Manual success criteria

- Native accent, pronunciation, first message, local warmth, silence, interruption, noise, latency, weather/place output, booking call, and SMS pass.
- V3 improves or matches baseline without false booking confirmation.

## Rollback

Route traffic to known-good Main; restore the last accepted single-class branch version. Do not combine failed revisions.
