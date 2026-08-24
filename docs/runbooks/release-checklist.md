# Release Checklist

> **The single procedural authority for shipping Paisaxe to production.**
> `CLAUDE.md`, `.claude/commands/release.md`, `.claude/skills/deploy/SKILL.md` and
> `docs/operations/rollback.md` delegate here. If any of them appears to describe a different
> sequence, this file wins — fix the other one.

Production is live. **Agents prepare; the user authorizes.** CI being green is necessary but
never sufficient, and authorization never carries over from a previous conversation.

## Ordering (do not reorder)

1. Identify the candidate
2. Pre-deployment gates
3. Merge and deploy
4. Verify the deployed identity
5. Run the required probes
6. Analyze the evidence
7. Obtain authorization
8. Tag — **last**

Tagging last is the point of the whole sequence: a tag is a claim that a specific tree was
verified in production. Tag before step 6 and the tag asserts something nobody checked.

---

## 1. Identify the candidate

The repo squash-merges, so the commit SHA that CI tested never reaches `main`. The **tree** does:
`strict: true` branch protection forces the PR branch up to date before merging, so the squashed
commit carries the tested tree. Releases are therefore identified by tree hash.

```bash
git fetch --all
CANDIDATE_TREE=$(npx tsx scripts/release/candidate-identity.ts --tree origin/develop)
echo "$CANDIDATE_TREE"
```

Record `CANDIDATE_TREE`. Every later step refers to it.

## 2. Pre-deployment gates

```bash
npm run what-would-ship              # commits + file-level diffstat since the last release
gh run list --branch develop --limit 3

npm run test && npm run typecheck && npm run lint
npm run check-migrations             # required probe: migration-posture
npm run check-required-probes        # manifest and Playwright must agree
npm run prelaunch
```

Before a release candidate can pass Preview smoke, configure the same
`HEALTH_PROBE_SECRET` in Vercel Preview and GitHub Actions. Production must use
the corresponding Vercel Production value. Configuration is an explicit
production boundary; do not weaken or skip the check when a value is missing.

`what-would-ship` (`scripts/release/what-would-ship.ts`) replaces a plain `git log main..develop`
(DO-M8, #835): because the repo squash-merges, `main..develop` never prunes — every commit ever
squash-merged stays "not an ancestor of main" forever, so the range grows monotonically release
after release regardless of tagging. The script instead resolves the develop commit whose tree
matches the last release tag's recorded tree (see step 8) and diffs from there, falling back
explicitly to the `main`/`develop` merge-base — and saying so — when no release tag resolves yet.

Mutating verification runs against the local Docker stack, never a deployed environment —
Preview shares the production Supabase project and holds live-mode Stripe keys.

```bash
npx supabase start                   # local Postgres on :54322
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
  npx playwright test --project=release-required-local
```

Present the summary to the user: commits since the last release, CI status, known risks, and a
recommendation. **Stop here.**

## 3. Merge and deploy

Only after the user says "go ahead" / "create the release PR":

```bash
gh pr create --base main --head develop --title "Release: <description>"
gh pr checks                          # all five required checks must pass
```

Required contexts: `Lint & Typecheck`, `Test`, `Build`, `Playwright E2E`,
`Smoke test Vercel preview`.

Report status and **stop**. Only after the user says "merge it":

```bash
gh pr merge --squash                  # allow_merge_commit is false; --merge fails
```

Never `--auto`: it merges unattended and bypasses the authorization gate.

## 4. Verify the deployed identity

Wait for the Vercel production deployment, then confirm the origin is actually serving the
candidate — not a stale build, not a cached one.

```bash
SHIPPED_TREE=$(npx tsx scripts/release/candidate-identity.ts --tree origin/main)
[ "$SHIPPED_TREE" = "$CANDIDATE_TREE" ] || echo "STOP: main is not the candidate"

npx tsx scripts/release/candidate-identity.ts \
  --verify --expected "$CANDIDATE_TREE" --url https://paisaxe.es
```

Requires `CRON_SECRET` in the local environment: `/api/health` reports its build identity only to
an authorized caller. A missing, `unknown`, or mismatched identity exits non-zero — an
unverifiable deployment is never a verified one.

A "Ready" Vercel deployment can still serve pre-fix chunks from build cache. If the identity
disagrees, force a rebuild rather than assuming: `vercel --prod --force --archive=tgz`, then
`vercel alias set <deploy-url> paisaxe.es`.

## 5. Run the required probes

`quality/required-probes.yaml` is the authority on what is required. Deployed probes are strictly
read-only.

```bash
RELEASE_TARGET_URL=https://paisaxe.es npx playwright test --project=release-required
RELEASE_TARGET_URL=https://paisaxe.es \
RELEASE_CANDIDATE_COMMIT="$DEPLOYED_COMMIT" \
RELEASE_GITHUB_DEPLOYMENT_ID="$GITHUB_DEPLOYMENT_ID" \
npm run check-elevenlabs-voice
```

The ElevenLabs command also requires `HEALTH_PROBE_SECRET` locally. Set
`DEPLOYED_COMMIT` from the successful candidate-identity check and
`GITHUB_DEPLOYMENT_ID` to the immutable numeric GitHub Deployment API ID. The check requires HTTPS,
rejects redirects, has a 45-second timeout, and fails unless the authenticated
voice endpoint reports the same commit. It requests
and discards signed URLs for Pelayo Visitor, Pelayo Booking, Penny, Iris, and
Xander. It prints one safe JSON object that is ready to copy into the evidence
manifest.

No probe may be skipped. A probe whose prerequisites are missing fails — that is deliberate, and
a skipped required probe blocks the release exactly like a failed one.

## 6. Analyze the evidence

Record what actually happened in `docs/release/evidence/<candidate-tree>.yaml` (see
`docs/release/evidence/README.md` for the shape), then:

```bash
npm run analyze-release -- --evidence "docs/release/evidence/${CANDIDATE_TREE}.yaml"
```

The analyzer blocks on: zero passes; any required probe failed, skipped or absent; disagreeing
candidate/shipped/deployed trees; a required probe missing its declared oracle evidence; fixture
data left behind; incomplete or unsafe ElevenLabs credential evidence; and any exception covering
a required probe. The `elevenlabs-voice-preflight` evidence must include `provider: ok`, a valid
fingerprint, `fingerprint_matches: true`, all five agent keys, and
`custom_llm: not_applicable`. Its target URL, response URL, GitHub deployment ID,
deployed commit, and timestamp must also match the release manifest. Exit 0 is
the only green.

The analyzer runs locally, not in CI — it consumes no CI minutes.

## 7. Obtain authorization

Present the analyzer output. The user authorizes the release by saying so explicitly in the
current conversation. Nothing below happens without it.

## 8. Tag

```bash
git tag -a "v<version>" -m "Release v<version> (tree ${CANDIDATE_TREE})"
git push origin "v<version>"
gh release create "v<version>" --generate-notes
```

Commit the evidence manifest alongside the tag. The tag and the evidence must name the same tree.

---

## If production is broken

**Roll back first, investigate second.**

```bash
vercel rollback <deployment-id>
```

Never `vercel deploy --prod` to fix forward during an incident — it triggers a fresh build and
prolonged the 2026-03-24 outage twice. Full procedure: `docs/operations/rollback.md`.

## Never, without explicit authorization in the current conversation

Push to `main` · create or merge a PR into `main` · run production `vercel` deploys · modify
production Supabase data, Vercel env vars, DNS, or external service config.

"Fix this bug" is not authorization. "Ship it" about a feature means merge to `develop`.
