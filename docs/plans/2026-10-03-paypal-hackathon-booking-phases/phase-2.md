# Phase 2: Access gate, voucher and metering

**Window:** 2026-10-13 to 10-16. Phase 3 may be prepared in parallel, but this phase merges first: Phase 3 imports its gate and metering and both phases add keys to the six locale files (F12)
**Revision 2:** access contract and Preview isolation (F10), existing redemption served before the cap and 24-hour voice pass (F13)
**Worktree:** `../paisaxe-hackathon-phase2` on `feature/voucher-gate` from `develop` (after Phase 1 merged)
**Depends on:** Phase 1 accepted and merged locally
**Owner action:** enable anonymous sign-ins on the Supabase project (see "Supabase setting")

## Goal

A judge with a voucher code can enter without Google, get voice access, and reach the
booking surface. Everyone else sees nothing, and on a Preview deployment nobody does,
voucher or not.

## Supabase setting (owner-authorized, external)

Anonymous sign-ins are a project auth setting outside the repository. With
authorization in the implementing conversation, the agent sets it through the
management API (`PATCH /v1/projects/<ref>/config/auth` with
`external_anonymous_users_enabled: true`, confirmed by a GET), using the owner's access
token; the fallback is the dashboard. Record the before and after values in the phase
evidence. Local Docker: set `[auth] enable_anonymous_sign_ins = true` in
`supabase/config.toml` so tests and E2E match production.

## Changes

### Feature flag and types

- `src/types/feature-flags.ts:1-17`: add `experience_booking` to the key union.
- `src/types/voice-access.ts`: add `voucher_pass` to the purchase type union.
- Translations: add namespace `booking.access.*` to all six locale files
  (`src/lib/i18n/{es,en,fr,de,pt,ast}.ts`); keys: `title`, `codePlaceholder`,
  `submit`, `invalid`, `expired`, `exhausted`, `anonFailed`, `limitReached`,
  `welcome`. Run `npm run generate-locale-coverage`.

### Server: `src/lib/booking/vouchers.ts` and routes

```
@ POST /api/booking/voucher/redeem {code} -> {ok, voicePassUntil, limits}
ctx: getUserFromRequest (src/lib/supabase-auth.ts:51-82), service client, rate limit
pre: flag experience_booking on (isFeatureFlagEnabled, src/lib/feature-flags-server.ts:69); user present (anonymous or Google)
do:
  1. checkRateLimit("voucher-redeem:" + ip, {maxRequests: 10}) (src/lib/rate-limit.ts:335)
  2. zod: code 8..64 chars, uppercase after trim
  3. lookup vouchers by sha256(code); active and not expired
  4. if this user already has a redemption for the voucher -> use it (served even when the voucher is at its cap, F13)
  5. else require redemptions_count < max_redemptions; insert redemption; increment the count
  6. rpc grant_voucher_voice_pass_idempotent(redemption_id, now() + 24 h) — renewable by redeeming again
  7. return limits snapshot and voicePassUntil
br: flag off or VERCEL_ENV preview -> 404; no user -> 401 with code "anon_required"; invalid/expired/exhausted -> 403 with reason
fx: voucher_redemptions, voice_purchases
fail: RPC error -> 500, log [VOUCHER_GRANT_FAILED]
risk: code brute force bounded by rate limit and 32-byte random codes
```

- `src/lib/booking/gate.ts` implements the access contract in the main plan (Access,
  item 7):
  - `requireBookingAccess(request) -> {userId, redemption} | Response(404)`: 404 when
    the flag is off, when `process.env.VERCEL_ENV === "preview"`, when there is no user,
    or when the user has no redemption of an unexpired voucher. Used by the booking
    chat, quote acceptance, payment-order creation and the booking list tool.
  - `requireBookingSurface() -> void | Response(404)`: flag and Preview checks only.
    Used by `/acceso` and the redemption route.
  - Capability routes (booking page, status, capture, cancellation) do **not** call
    either: they stay usable for an existing booking after the voucher expires or the
    flag is turned off, so a paying visitor is never locked out. They still return 404
    on a Preview.
- `src/lib/booking/metering.ts`: `consume(redemptionId, counter: "chat_turns" | "booking_attempts") -> {allowed, remaining}`
  as one atomic `UPDATE … WHERE counter < limit RETURNING` through a small SECURITY
  DEFINER RPC `consume_voucher_counter` (add to migration 114 if Phase 1 is still open,
  else migration 118). `tool_iterations_per_turn` is enforced in code (Phase 3).
- `scripts/booking/create-voucher.ts` (admin-only local script, like `scripts/agent-ctl.sh`
  in spirit): prints a new code once, stores the hash; args `--label`, `--max 50`,
  `--expires 2026-12-16`, `--voice-hours 24` (or `--no-voice`, the fallback if the
  ElevenLabs backstop proves not to be a hard stop), `--turns 60`, `--attempts 10`. The same
  script with `--replace <label>` deactivates a voucher and issues a new one (the
  replacement procedure for a voucher at its cap or leaked).
  Runs with the service key against the target the owner names. Production use is an
  owner-authorized action.

### Client

- `src/app/acceso/page.tsx` (Spanish baseline URL; `/access` redirect): code input,
  submit calls `supabase.auth.signInAnonymously()` when `useAuth().user` is null
  (`src/components/auth/auth-provider.tsx` exposes `user`), then POSTs the redemption
  with `csrfHeaders()` (`src/lib/csrf-client`). On success it stores nothing locally;
  the server state is the truth. Redirects to `/immersive?booking=1`; Phase 3 makes
  that link open the text booking chat. Until Phase 3 merges the parameter is ignored.
- `src/hooks/use-booking-access.ts`: `GET /api/booking/access` → `{active, limits}`;
  used by Phase 3's UI to show the booking entry.
- `src/components/auth/auth-provider.tsx`: no change needed if anonymous sessions flow
  through `onAuthStateChange` (verify in the first test; if the profile trigger timing
  matters, retry the redemption once on `23503`).

## Tests (write first)

- `voucher/redeem/route.test.ts`: flag off → 404; no user → 401 `anon_required`;
  unknown code → 403 `invalid`; expired → 403 `expired`; cap reached → 403 `exhausted`;
  first redemption increments count; second redemption by the same user does not
  (returns ok); RPC failure → 500 and no counter change.
- `gate.test.ts`, each case failing if its check is removed: flag off; `VERCEL_ENV=preview`
  with a valid voucher; no user; no redemption; expired voucher; success returns the
  redemption. `requireBookingSurface` cases likewise.
- `voucher/redeem/route.test.ts` additions: a returning user is served at the cap while a
  new user gets `exhausted`; re-redeeming after 24 hours grants a new pass.
- Date-advanced test: with the clock at 2026-12-01 and 2026-12-14 the voucher redeems
  and the pass is granted; at 2026-12-17 it is `expired`.
- `metering.test.ts`: counter at limit → `allowed:false`; concurrent consumes do not
  exceed the limit (integration on local Docker).
- `vouchers.postgrest-integration.test.ts`: the voice pass row exists after redemption
  and `GET /api/voice-access` reports access for the anonymous user (reuse the existing
  route handler with a mocked session), and `purchase_type` is `voucher_pass`.
- `acceso/page.test.tsx`: anonymous sign-in failure shows `anonFailed`; invalid code
  shows `invalid`.
- Translations parity test passes.

## Acceptance gate

Automated: full local gates plus the integration tests above.

Manual: on local Docker with anonymous sign-ins enabled, a fresh incognito browser
redeems a voucher created by the script, `/api/voice-access` reports access, a second
browser redeems the same code, and a Google-signed-in user can redeem too. Record the
before/after of the Supabase production setting if it was changed in this phase; if the
owner defers it, record that production anonymous sign-in is still off and that Phase 7
cannot proceed until it is on.

Stop for acceptance.
