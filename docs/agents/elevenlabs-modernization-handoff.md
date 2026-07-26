# ElevenLabs Modernization Handoff

Status date: 2026-07-26

## What Paisaxe owns

Paisaxe is the sole writable source for its five voice agents: Pelayo Visitor,
Pelayo Booking, Penny, Iris, and Xander. Their canonical configs live under
`agent_configs/`; Archy must not push them and Roots remains excluded.

## Current state

- All five modernization candidates exist as provider branches at 0% traffic.
  Their exact branch and version IDs are recorded in
  `docs/operations/evidence/elevenlabs/2026-07-25-modernization-status.md`.
- The candidates use v3/Expressive and prompt-injection protection. Booking,
  Penny, Iris, and Xander also use Focus; Pelayo Visitor keeps Focus off
  because the off-topic trade-off is not resolved.
- Pelayo Visitor's retained language presets use native-workspace voices for
  Spanish, English, French, and Brazilian Portuguese. German, Italian, and
  Portugal-Portuguese were removed because no native workspace voice resolved.
- Live Main was restored and read back unchanged. Authentication is still off,
  recording is still on, and retention is still indefinite on Main; those
  settings were deliberately not cut over without production proof.
- The application changes mint signed URLs for entitled visitors and admins,
  but production signed-session behavior and real audio remain unproven.

## Rules for future agents

1. Pull and snapshot Main before every provider write. Use the scoped branch
   operator and verify returned branch/version IDs; never perform a
   workspace-wide push.
2. Do not allocate traffic or change Main auth/privacy until the signed
   production entitlement and denial matrix passes.
3. Correct the language simulator so it starts with the same explicit language
   override as the app, then pass every retained language three times.
4. Require real-audio acceptance for accent, prosody, numbers, interruption,
   noise, and v3 latency. Provider locale metadata is not listening evidence.
5. Add applicable tests/evaluators for Penny, Iris, and Xander before any
   promotion and resolve the Pelayo Focus/off-topic trade-off explicitly.

## Detailed evidence

- `docs/operations/evidence/elevenlabs/2026-07-25-modernization-status.md`
- `docs/research/2026-07-25-elevenlabs-agent-modernization-audit.md`
- `docs/plans/2026-07-25-elevenlabs-agent-modernization.md`
- `docs/operations/elevenlabs-agents-as-code.md`
