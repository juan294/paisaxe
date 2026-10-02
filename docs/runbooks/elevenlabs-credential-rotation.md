# ElevenLabs runtime credential reliability and rotation

Use this runbook for planned rotation and for
`[ELEVENLABS_CREDENTIAL_REJECTED]` incidents. Paisaxe owns five agents:
Pelayo Visitor, Pelayo Booking, Penny, Iris, and Xander.

## Control model

Production uses one dedicated runtime key named
`paisaxe-production-runtime`. Store it only as `ELEVENLABS_API_KEY` in the
Vercel Production and Preview environments. Local agent management and
evaluation can use the same variable name, but must use a different operations
key. Never copy the production runtime value into `.env.local`, the ElevenLabs
CLI login, maintenance jobs, or another repository.

The runtime contract is:

| Variable | Purpose | Secret |
|---|---|---|
| `ELEVENLABS_API_KEY` | App-to-ElevenLabs runtime calls | Yes |
| `ELEVENLABS_API_KEY_FINGERPRINT` | Expected safe identity of the runtime key | No |
| `ELEVENLABS_BOOKING_AGENT_ID` | Expected booking-agent identity | No |
| `HEALTH_PROBE_SECRET` | Authenticates `/api/health/voice` | Yes |
| `CRON_SECRET` | Authenticates the scheduled canary | Yes |

The fingerprint format is `sha256:<first 16 lowercase hex characters>`. The
runtime rejects a production key before provider I/O when the fingerprint is
missing, malformed, or different from the configured key. It rejects a
booking-agent ID that differs from Paisaxe's owned ID in every Vercel
environment. Local operations must still use the intended instance ID.

Paisaxe does not have an application-owned custom LLM. All five agents use
ElevenLabs-hosted LLM selections. Release evidence must record
`custom_llm: not_applicable`; it must not claim that a custom-LLM handshake ran.
MCP tool calls use the independent `MCP_API_SECRET` boundary.

## Automated checks

- `GET /api/health/voice` authenticates with `HEALTH_PROBE_SECRET`, requests
  and discards signed URLs for all five owned agents, and returns only provider
  state, safe fingerprint, binding state, agent keys, and the safe deployment
  commit.
- `GET /api/cron/elevenlabs-voice-canary` runs every 15 minutes. It checks
  Pelayo Visitor as the shared-key sentinel, discards the signed URL, records a
  Sentry monitor check-in, and sends an explicit Sentry error event on failure.
- `npm run check-elevenlabs-voice` runs the authenticated five-agent release
  preflight and rejects incomplete or unsafe evidence. Set
  `RELEASE_TARGET_URL`, `RELEASE_CANDIDATE_COMMIT`, and
  `RELEASE_GITHUB_DEPLOYMENT_ID`; the check requires HTTPS, rejects redirects, and
  binds its JSON evidence to that exact target, commit, and deployment.

The billed behavioral evaluator suite remains separate. A signed-URL check does
not prove accent, listening quality, tool correctness, or real audio.

## Safe rotation

Use create, update, verify, disable. Never disable the old key first.

1. Create a dedicated ElevenLabs key named `paisaxe-production-runtime` with
   only the permissions needed by Paisaxe runtime calls. Keep the old key
   enabled.
2. Read the new key through a hidden terminal prompt and compute its
   fingerprint without putting the key in shell history:

   ```bash
   read -s PAISAXE_ELEVENLABS_ROTATION_KEY
   printf %s "$PAISAXE_ELEVENLABS_ROTATION_KEY" | shasum -a 256 | awk '{print "sha256:" substr($1,1,16)}'
   ```

3. Update `ELEVENLABS_API_KEY` and
   `ELEVENLABS_API_KEY_FINGERPRINT` together in Vercel Preview and Production.
   Clear the temporary shell variable after the CLI commands finish:

   ```bash
   unset PAISAXE_ELEVENLABS_ROTATION_KEY
   ```

4. Deploy through [the release checklist](./release-checklist.md). Do not use a
   direct production deployment.
5. Run the authenticated five-agent preflight against the candidate and the
   deployed production identity. Confirm the fingerprint equals the intended
   new value.
6. Confirm one successful `elevenlabs-voice-canary` check-in and test that a
   synthetic `[ELEVENLABS_CREDENTIAL_REJECTED]` event reaches the operator.
7. Disable the old key only after every check passes.
8. Record old and new fingerprints, candidate tree, deployed commit,
   GitHub deployment ID, verification time, and operator in release evidence.

If any check fails, keep the old key enabled, restore the prior Vercel values,
redeploy the last known-good configuration through the normal gate, and stop.

## Incident response

Treat any of these as an active voice outage:

- `[ELEVENLABS_CREDENTIAL_REJECTED]`;
- failed `elevenlabs-voice-canary` check-in;
- deep health provider state other than `ok`;
- fingerprint binding other than `true`.

Follow [the alerting runbook](../operations/alerting-runbook.md). Do not log or
copy an API key, bearer value, provider response body, or signed WebSocket URL
into incident or release evidence.

Reference: [ElevenLabs API key management](https://elevenlabs.io/docs/overview/administration/workspaces/api-keys).
