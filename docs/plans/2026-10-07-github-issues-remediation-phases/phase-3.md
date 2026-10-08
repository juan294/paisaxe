# Phase 3: Database boundaries and booking retention

Parent: [backlog plan](../2026-10-07-github-issues-remediation.md). Owned issues: #885, #913, #922, #854, #921, #915, #920. Baseline: develop `fe1843713a49277bc66460e4ae7470025d01e1c6`; revalidate at entry. Status: final local verification in `.worktrees/issues-phase3-current` on develop base `30af84d0b40b1829461f2e44864fc1f79d9bcfc8`. The corrected fresh database tier passed all 936 cases across 20 suites with zero skips and clean stack/schema checks. The public-view grant repair and CI inventory refresh are independently approved; focused cadence 98/98 and full cadence 1038/1038 passed with zero skips. The migration checker now accepts equivalent compact empty-search-path syntax while rejecting unsafe overrides and quoted-value masking; 39 focused tests and the 125-file repository check passed without changing tested migration bytes. Production and ordinary builds, both bundle scans, real Auth UI (1/1), release-local probes (3/3), and desktop/mobile browser checks (377 passed, 28 unchanged explicit mobile skips, including all 11 QA journeys) passed on source digest `f5f377b196c4f201e9f12b1573eca24fbbd11e5a6f6ffa2c1d53498ede405846`. Phase 3 is not accepted: the full coverage command passed 10,466 tests but failed one native psql initial connection at its unchanged five-second limit. The repaired Realtime case passed; bounded transport controls do not establish the historical connection failure's root cause or qualify coverage. Recorded provider fixtures remain synthetic/unverified, so the combined contract gate also remains red. Final required-tier execution and guarded cleanup are recorded in the handoff. At the initial stop boundary, develop integration and worktree pruning were deferred. The owner subsequently authorized local consolidation of all previous `fix/*` worktrees into develop and safe pruning. This local consolidation preserves the failed coverage/provider evidence and does not constitute Phase 3 acceptance. No Phase 4, publication or production activation is authorized. Apply the parent's local-only authority, TDD/review/simplify loop, sequential verification, coverage ratchets and acceptance boundary in full.

## Scope and source evidence

Establish fresh-reset least privilege, actual pg_net transport, public flag projection and safe retention. Sources: `supabase/migrations/108_restore_notify_webhook_search_path.sql:63`, active function definitions identified in research #922; migration 104 translation retry at line 226 and migration 050 trigger at line 59; `supabase/migrations/126_phone_confirmation.sql:76`; `src/app/api/cron/fail-stale-bookings/route.ts:12`; `.agents/skills/supabase/SKILL.md:52`, `.claude/skills/supabase/SKILL.md:55`; `src/app/coming-soon/page.tsx:41`. Latest active definitions govern; historical migration 025 is not the current fix target.

## Design and ownership

One migration coordinator allocates new numbers after checking HEAD. Never edit applied migrations. One DB unit owns grants/RPC/view/retention integration. A documentation unit may be [batch-eligible] for the two repo-native Supabase skills and their guidance check, with no migration overlap.

Redefine notify_webhook and every active affected pg_net wakeup with JSONB body, empty search_path and existing secret/nonblocking semantics. Verify actual installed pg_net signatures, not only SQL text. Local HTTP receiver sees authenticated correct JSON only after COMMIT; ROLLBACK sends nothing. Preserve diagnostic request IDs and retry/revalidation path without logging secrets.

#913 is declared/fresh-reset parity: production service_role DML already exists. Inventory intended roles, add exact feature_flags DML grants only where absent, and keep anon column/private table restrictions. Separate grant checks from RLS. Replace blanket future anon SELECT examples in both repo skills with explicit table/column grants and owner-scoped default privilege explanation, aligned with the installed rule. A future private-table fixture must have no inherited public SELECT.

Create and extend the required real PostgREST matrix: anon, authenticated owner/nonowner, service_role, positive and negative read/write cases for every sensitive table/RPC discovered from actual schema catalog. Include admin_audit_log, elevenlabs_webhook_events and translate_webhook_events. Unknown relation, connectivity failure or wrong JWT cannot count as an RLS denial. Compare local schema posture with research's read-only production inventory; document legitimate differences.

Public flag config uses a service-role-owned allowlist relation keyed by flag and approved public keys, projected from canonical config. Unknown flags/keys emit empty config; safe enabled/environment metadata remains as required. Allowlist maintenance is privileged, not ordinary admin config editing. Preserve maintenance title/message/show_tagline, backend private prompts, realtime/SSR enabled reads and admin editing. Avoid independently mutable config_public copies that can drift.

Retention redacts PII 90 days after an eligible terminal transition, as explicitly selected by the owner. Define an explicit terminal timestamp and eligibility view; include only truly terminal legacy phone bookings, exclude initiating/pending/orphaned/reconciliation, linked unfinished phone/payment work and outstanding SMS. Preserve `payments.phone_call_id` linkage (`supabase/migrations/126_phone_confirmation.sql:76`) and event replay identifiers. New terminal transitions write terminal_at atomically. Legacy rows backfill only from supported transition history; created_at or SMS-mutated updated_at is not an exact terminal timestamp (`supabase/migrations/053_pending_bookings.sql:19`, `supabase/migrations/085_atomic_outcome_message_and_stale_booking_cleanup.sql:51`). Unknown-anchor rows enter a reported hold with count/age and a visible supported-history review action. If no historical anchor can be established, start a new observed terminal timestamp at reviewed classification and wait the full 90 days; never invent earlier eligibility. Redact pending-booking personal fields and related completed/dead SMS to_phone/message/personal provider-error text together (`supabase/migrations/079_webhook_idempotency_rpcs.sql:33`); retain non-personal replay IDs/status. Prefer PII redaction with minimal replay tombstones; do not cascade-delete parents. Use deterministic bounded batches with row locking/CAS against late webhook writes. Existing retry/grant writers must honor the retained/tombstoned state so PII and SMS cannot be resurrected. Unknown-anchor and reconciliation holds are not silently discarded. No indefinite silent hold: report held counts/oldest age and a visible reconciliation action; expanding eligibility requires a separately approved policy.

```text
@ redactExpiredBookings(cutoff, batchLimit) -> safeCounts
ctx: DB transaction, terminal timestamps, reconciliation links
pre: owner duration accepted; dry-run manifest reviewed
do:
  1. lookup eligible terminal rows under locks
  2. validate no pending SMS or reconciliation dependency
  3. write replay tombstones and redact personal fields atomically
  4. emit counts and next cursor without personal data
br: concurrent writer or hold -> retain and report
fail: batch error -> rollback and retry from stable cursor
```

## Required contract runner and native cadence (#885)

- DB contract runner (#885): add a named `test:contracts` local command that discovers the actual required PostgREST/RLS suites, requires task-owned loopback stack identity/schema/keys, executes real adapters, and fails on zero cases, any required skip, failed positive control or cleanup failure. Do not reset an existing user's stack. This phase supplies the full authorization matrix. Ordinary unit tests retain honest skip disclosure.

DB fixtures prove loopback/task identity enforcement, unavailable-stack failure, zero/skip failure, positive and forbidden role cases, cleanup and corrected rerun. Required contract CI wiring is staged after this phase supplies the full matrix: integrate into existing full-validation/main/release and lean-nightly paths, never inflate CI Fast. Preserve protected projection/generator/source pins and exact-source checkout. Run `npm run test:ci-cadence` and `node scripts/ci-cadence-native-workflows.mjs --check`. A temporary advisory observation cannot count as required proof or issue closure; final named contract step must fail its full-validation gate on error. Inspect native exact-commit execution after a separately authorized push.

None for local acceptance. Hosted adoption requires an authorized push, actual native step counts/artifacts and measured execution cost/flake receipts. Recorded sanitized provider fixtures establish adapter compatibility only; live provider capture needs separate authority.

Third-party recorded fixtures carry provider/API version, sanitized capture time, refresh owner, expiry or upstream-change criterion. An offline freshness/report check runs with the contract tier and marks stale fixtures visibly unverified with the precise review/refresh action. Fixtures test stale disclosure and corrected metadata; live capture/provider scheduling remains separately authorized. Fixture compatibility never proves live availability.

## Automated criteria

Fresh task-stack reset, zero required skips; forbidden roles fail with exact permission/RLS class while known allowed operations succeed. New private table remains private. Real pg_net delivery/commit/rollback tests cover notify and translation wakeups, missing config and corrected retry. Secret canaries in every known flag, a new flag and a newly added config key never appear through direct public view, API, cache/realtime or UI; maintenance approved fields still render.

Retention fixtures cover exact 90-day boundary, supported/unsupported legacy backfill, reviewed new anchor and full subsequent wait, SMS PII redaction, old/recent/held/nonterminal/orphaned, linked phone bookings, pending SMS, late webhooks, replay after redaction, concurrent batches, failure rollback/resume and no PII resurrection. Dry run changes no rows and outputs no PII. Required local contract tier is fully wired and executed before accepting the phase.

## Manual and external criteria

After local review, prepare production dry-run counts and exact activation manifest. Production cron activation or first redaction requires separate authorization; this plan does not authorize deleting customer information. Read-only production parity comparison does not substitute for fresh local tests. Public flag view/grants migration rollout is separately authorized.

## Stuck states and recovery

Missing allowlist yields safe empty config with maintenance defaults, not a broken page; adding an approved key restores display in tests. Failed webhook leaves original update intact, operator sees request ID/error and retry instruction; restored receiver gets a subsequent delivery. Required DB unavailable fails visibly and starts/reset instructions recover the next run. Retention failures roll back and next tick resumes; holds surface named reconciliation work without exposing personal data.

## Phase acceptance and handoff

Run the parent's applicable sequential integration gates plus the automated criteria above on the integrated candidate. Record exact identity, commands, pass/fail/skip counts, review/simplify findings and fixes, and each issue's local/runtime disposition. Manual or provider evidence is separate; missing evidence leaves the issue open. Stop after acceptance, preserving the plan and implementation receipts; proceed only with authorized continuation. Consumer ownership and command inventory are in [consumer sweep](consumer-sweep.md).
