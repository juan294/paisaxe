# Phase 2 — Agent Runner Trust Boundary

**Scope:** Remove the fragile `ALLOW_AGENT_RUN` override, gate the agent-runner exclusively on local-only execution (`VERCEL_ENV === undefined`) plus `validateAdminAuth`, and add CI assertion that `ALLOW_AGENT_RUN` is never set in any deployed environment.

**Addresses:** §3.3 (High), §4 bullet "runningAgents Map leak" (mooted by local-only scope).

**Batch eligibility:** `[batch-eligible]` — depends only on P1.

---

## Current State (verified 2026-04-20)

`src/app/api/admin/agents/run/route.ts`:
- L8-16 — `AGENT_SCRIPTS` allowlist (7 keys).
- L31 — `const runningAgents = new Map<string, RunningAgent>();` (module-scope leak in any env that runs this route).
- L51 / L167 / L215 — `validateAdminAuth()` on POST / GET / DELETE.
- L54 — `if (process.env.NODE_ENV !== "development" && !process.env.ALLOW_AGENT_RUN) return 403;` — fragile double-gate.
- L97-102 — `spawn("bash", [scriptPath], { cwd: projectRoot, detached: true, env: { ...process.env }, stdio: piped });`

Vercel `NODE_ENV` is always `production` on deployed envs. The real signal for "local dev" on Vercel is `VERCEL_ENV === undefined`.

## Target State

Single trust boundary: admin auth + local-only runtime check. `ALLOW_AGENT_RUN` deleted. CI step asserts the variable is not set in Vercel env.

## Implementation Steps

### Step 2.1 — Red: unit test for the new gate

`src/app/api/admin/agents/run/route.test.ts` (new file):

```ts
// Pseudocode
describe("agent runner route — environment gate", () => {
  beforeEach(() => {
    mockValidateAdminAuth.mockResolvedValue({ valid: true, userId: "admin-1" });
  });

  it("returns 403 when VERCEL_ENV is set (any deployed environment)", async () => {
    process.env.VERCEL_ENV = "preview";
    const res = await POST(buildRequest({ agentKey: "coverage" }));
    expect(res.status).toBe(403);
  });

  it("returns 403 when VERCEL_ENV is 'production'", async () => {
    process.env.VERCEL_ENV = "production";
    const res = await POST(buildRequest({ agentKey: "coverage" }));
    expect(res.status).toBe(403);
  });

  it("ignores ALLOW_AGENT_RUN entirely", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.ALLOW_AGENT_RUN = "1";
    const res = await POST(buildRequest({ agentKey: "coverage" }));
    expect(res.status).toBe(403);
  });

  it("allows the call when VERCEL_ENV is unset (local dev)", async () => {
    delete process.env.VERCEL_ENV;
    mockSpawn.mockReturnValue(fakeChild());
    const res = await POST(buildRequest({ agentKey: "coverage" }));
    expect(res.status).toBe(200);
  });

  it("still blocks when admin auth fails even locally", async () => {
    delete process.env.VERCEL_ENV;
    mockValidateAdminAuth.mockResolvedValue({ valid: false, error: new Response("x", { status: 401 }) });
    const res = await POST(buildRequest({ agentKey: "coverage" }));
    expect(res.status).toBe(401);
  });
});
```

### Step 2.2 — Green: rewrite the gate

`src/app/api/admin/agents/run/route.ts` L54 replacement:

```ts
// Pseudocode
const isLocal = process.env.VERCEL_ENV === undefined;
if (!isLocal) {
  logger.warn("[AGENT_RUNNER] Blocked: not running locally", { vercelEnv: process.env.VERCEL_ENV });
  return NextResponse.json(
    { error: "Agent runs are only allowed in local development." },
    { status: 403 }
  );
}
```

Delete every reference to `ALLOW_AGENT_RUN` in `src/` and `scripts/`. Search:

```bash
grep -rn "ALLOW_AGENT_RUN" src/ scripts/ .github/ docs/
```

Remove from any `.env.example` / Vercel env docs.

### Step 2.3 — Mute runningAgents Map leak

Since the route is now local-only, the in-memory `Map` is bounded by local dev lifetime. Still worth a cleanup: add explicit cleanup on child `exit` to remove finished entries (it's a 10-line change, prevents leaking for long-running local dev sessions):

```ts
// Pseudocode — inside spawn block after child is created
child.on("exit", (code) => {
  const entry = runningAgents.get(runId);
  if (entry) {
    entry.status = code === 0 ? "completed" : "failed";
    entry.finishedAt = Date.now();
  }
  // Purge entries older than 1h
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [key, value] of runningAgents) {
    if (value.finishedAt && value.finishedAt < cutoff) runningAgents.delete(key);
  }
});
```

### Step 2.4 — CI guard against accidental re-enable

Add a job to `.github/workflows/security.yml` (or create `.github/workflows/env-safety.yml`):

```yaml
# Pseudocode
- name: Assert ALLOW_AGENT_RUN is not in Vercel env
  env:
    VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
  run: |
    vercel env ls --token "$VERCEL_TOKEN" > env-list.txt
    if grep -q "ALLOW_AGENT_RUN" env-list.txt; then
      echo "::error::ALLOW_AGENT_RUN is set in Vercel env — must be removed (see Phase 2)"
      exit 1
    fi
```

If `VERCEL_TOKEN` is not available as a repo secret, skip the CI step and document the manual check in `docs/operations/operations.md` as part of the release checklist.

## Automated Success Criteria

```bash
cd <worktree>
npm install
npm run typecheck
npm run lint
npm run test -- src/app/api/admin/agents
grep -rn "ALLOW_AGENT_RUN" src/ scripts/ .github/ docs/ || echo "clean"
```

Expect: test suite green; grep returns nothing.

## Manual Success Criteria

1. `vercel env ls` output contains no `ALLOW_AGENT_RUN` in any environment (development / preview / production).
2. From local dev: `scripts/agent-ctl.sh status` still works (admin dashboard calls the runner route, which now requires `VERCEL_ENV` unset — i.e., `next dev`).

## Rollback

`git revert` the merge. `ALLOW_AGENT_RUN` can be re-added to any env if needed (but the plan's conclusion is that it should not exist).

## Files Touched

- `src/app/api/admin/agents/run/route.ts`
- `src/app/api/admin/agents/run/route.test.ts` (new)
- `.github/workflows/security.yml` (or `env-safety.yml` new)
- `docs/operations/operations.md` (if CI token unavailable — add manual check)

## Exit Gate

STOP. Confirm merge to `develop` with green CI.
