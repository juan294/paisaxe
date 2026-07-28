# Paisaxe ElevenLabs modernization status — 2026-07-25

## Outcome

The five Paisaxe modernization candidates exist as zero-traffic branches.
Main was read back after implementation and retains its pre-modernization TTS,
Expressive Mode, Focus, and prompt-injection settings. Authentication remains
off and privacy remains `record_voice=true`, `retention_days=-1`; these shared
production settings were intentionally not cut over.

| Agent | Candidate branch | Candidate version | Candidate state | Traffic |
|---|---|---|---|---:|
| Pelayo Visitor | `agtbrch_1601kydfmhhgex7rmdakv76nbhpa` | `agtvrsn_9801kydhmshxfmxrh7n2wa1msjy2` | GPT-4o mini; v3/Expressive; prompt-injection on; Focus off; native es/en/fr/pt-BR voices | 0% |
| Pelayo Booking | `agtbrch_3601kydfmjcbfx9s6wbz7xgz6w9w` | `agtvrsn_1701kydhmv2bewcb2whhs2scraqq` | v3/Expressive; Focus and prompt-injection on | 0% |
| Penny | `agtbrch_2801kydfmk2xf8fre1n90msb5z6e` | `agtvrsn_6201kydhmwsxftyr7t82w4jxhnwt` | v3/Expressive; Focus and prompt-injection on | 0% |
| Iris | `agtbrch_8301kydfmkwmfavt22z6e96cmwhe` | `agtvrsn_9001kydhmyd8ez98r6n633vmt8gt` | v3/Expressive; Focus and prompt-injection on | 0% |
| Xander | `agtbrch_3701kydfmmkzfpbtry6mq7mn7bq4` | `agtvrsn_9701kydhn00negv9ghyyx4nzgze5` | v3/Expressive; Focus and prompt-injection on | 0% |

Pelayo language voices resolve in the workspace:

- Spanish default: Ignacio `uZAgv46kqRrZthdejCSf`
- English: Jack John `7EzWGsX10sAS4c9m9cPf`
- French: Lucie `YxrwjAKoUKULGd0g8K9Y`
- Brazilian Portuguese: Carla `oJebhZNaPllxk6W0LSBA`

German, Italian, and Portugal-Portuguese presets were removed from the
candidate because no native workspace voice resolved for them.

## Test evidence

- Initial complete suites before dynamic-variable reconciliation:
  `suite_6201kydfe2myf328rgv460f73mqe` and
  `suite_7701kydfe3mjeesasgrdkjsgm236`; 30 errors were missing fixture
  variables, not agent behavior.
- Corrected price evaluator:
  `suite_6501kydfqsf5e2jv06k0qyytywbx`; flaky 9.5 rerun
  `suite_7301kydfscjkfvr8yp32qecq0zym` passed 3/3.
- Corrected Booking close evaluator:
  `suite_6301kydfsj40fb0bbbzrj5ppchkk` passed 3/3.
- Correct branch Pelayo booking gates:
  `suite_0101kydhnb95ezf9s47ehepg3hyw` (7.3) and
  `suite_9901kydhngfsek4r94pzgj1ahwx0` (7.5), both 3/3.
- Correct branch prompt-injection and gibberish gates:
  `suite_4401kydhntygf2ebar6y2agsdbnk` (9.2) and
  `suite_2601kydhp0p3ep3sn5cvnyqv06fp` (9.4), both 3/3.
- Correct Booking branch full suite:
  `suite_4401kydhpgnnfe8v46s7zsn35p64`,
  `suite_0501kydhpnwhem3r0jx1gf4rjbzt`,
  `suite_7801kydhpv37fgsasb80sxg3ctmp`,
  `suite_9401kydhq0apfw1a2e9kmf0f26ka`, and
  `suite_7501kydhq5h7e5a84snbj1kep0kp`; 15/15.

Pelayo did not pass all promotion gates. Off-topic case 9.1 failed 0/3 with
Focus disabled. English case 10.1 failed 0/3 and French case 10.3 passed 1/3
because text simulations started in Spanish and did not exercise the
application's explicit language override. These failures, plus missing audio
evidence, prevent promotion.

## Implementation evidence

- Visitor and admin browser clients now request server-minted signed URLs.
- Visitor signing requires an authenticated user with an active voice
  purchase. Admin signing uses the existing admin authorization validator.
- ElevenLabs error classes are mapped without exposing the API key or upstream
  response body.
- Booking remains server-originated and API-key protected.
- The scoped branch writer PATCHes the exact registered branch, removes the
  deprecated inline `tools` field when `tool_ids` is present, checks returned
  branch/version IDs, and writes the candidate version into `agents.json`.
- During implementation, the documented CLI branch bug was followed by a
  direct-PATCH query-parameter mistake that briefly applied candidate settings
  to Booking, Penny, Iris, and Xander Main. Immediate readback detected it.
  All four were restored from their captured Main configs and read back with
  Expressive Mode, Focus, and prompt-injection disabled before branch work
  resumed. Pelayo Main was never changed.
- Pre-change, secret-redacted rollback snapshots are in
  `2026-07-25-pre-modernization/`.
- `save_favorite` remains deferred because its production endpoint returned
  404 and it was not attached live.

## Repository verification

- `npm test`: 387 files and 7,310 tests passed.
- Focused modernization tests: 7 files and 84 tests passed.
- `python3 -m unittest scripts/run_paisaxe_tests_test.py
  scripts/reconcile_paisaxe_tests_test.py`: 7 tests passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run prelaunch`: production build and browser gate passed with 256
  passed and 64 skipped tests.
- The browser gate initially exposed a hydration race in the shared privacy
  notice test helper. The helper now uses one bounded role-based click instead
  of a visibility-check/click race; the language-switch and multi-turn chat
  regressions passed in isolation before the complete gate passed.

## Promotion blockers

1. Deploy the signed-session application changes to production and prove:
   entitled Visitor success, non-entitled denial, admin success, unsigned
   direct initiation denial after cutover, and invalid/reused signed URL
   denial.
2. Run real audio sessions from the first word in es/en/fr/pt-BR and document
   accent, prosody, numbers, interruptions, noise behavior, and v3 latency.
3. Resolve or explicitly accept Pelayo's Focus false-positive trade-off and
   off-topic regression.
4. Correct the language test harness to start each simulation with the same
   explicit language override used by the application, then pass each retained
   language three times.
5. Add applicable test/evaluator coverage for Penny, Iris, and Xander before
   any traffic promotion.

Until those gates pass, do not change traffic, signed-only authentication,
voice recording, retention, or Main behavior.
