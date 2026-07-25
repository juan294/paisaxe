# Phase 4 — Auth/privacy cutover, promotion, and closure

**Depends on:** Phases 2 and 3
**Batch:** no; auth/privacy are shared, unversioned settings.

## Outcome

Five accepted agent variants are promoted, signed-only access is enforced, voice recording is off, retention is 30 days non-retroactively, and git/live state is synchronized.

## Per-agent sequence

For Visitor, Booking, Penny, Iris, then Xander:

1. Save exact auth and privacy blocks.
2. Prove signed session immediately before cutover.
3. Set signed-only authentication. Do not combine with hostname allowlisting.
4. GET-readback; verify signed success and unsigned failure.
5. Promote versioned behavior at 10% → 25% → 50% → 100%, or use controlled branch sessions when the agent has no meaningful public traffic.
6. PATCH `record_voice=false`, `retention_days=30`, `apply_to_existing_conversations=false`.
7. Complete a conversation and prove transcript webhook, analytics, tool calls, and app completion still work.
8. Targeted-pull server-normalized Main into Paisaxe and record new version IDs.

## Verification

```bash
npm run test
npm run typecheck
npm run lint
npm run prelaunch
```

Run `npm run prelaunch:live` only when its live integration scope is authorized. Push once, monitor develop CI, and do not create/merge a production PR without current user authorization.

## Success criteria

- All five agents require signed initiation and reject public-ID starts.
- All accepted guardrail/v3/native-voice settings are on Main.
- Recording is off; retention is 30 days for new conversations.
- Pelayo production booking/weather/place/webhook flows and admin social sessions pass.
- Exact git SHA, agent branch/version, test invocation, traffic, privacy/auth readback, and rollback evidence are recorded.

## Rollback

Restore auth/privacy blocks first for access failures, route traffic to Main for behavioral failures, and use the Paisaxe production rollback procedure for app failures.
