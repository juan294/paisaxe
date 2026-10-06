import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, expected, policy, projection, nativeRun, nativeJob, measurement, admission } from '../tests/fixtures/ci-cadence-adapter/native/integration-fixture.mjs';
const module = () => import('./ci-cadence-run.mjs');
const options = f => ({ token: 'fixture-secret-token', fetchImpl: f.fetchImpl, now: () => new Date('2026-10-03T01:00:00Z') });
const input = () => ({ expected, policy, projection, workflow: policy.workflows[0].path });
const envelope = run => ({ repository: run.repository, workflow_run: run });

test('actual history reader plus frozen chooser skips complete recent identity without publishing', async () => {
  const f = fixture(); const { decideNightlyRun } = await module();
  const result = await decideNightlyRun(input(), options(f));
  assert.equal(result.action, 'skip'); assert.equal(result.publishCoverage, false); assert.equal(result.history.complete, true);
  assert.ok(f.requests.every(x => x.options.method === 'GET'));
});
test('known actual failure remains blocked even when subsequent history is unavailable', async () => {
  const run = { ...nativeRun(), conclusion: 'failure' }; const f = fixture({ run });
  const { decideNightlyRun } = await module(); const result = await decideNightlyRun(input(), options(f));
  assert.equal(result.action, 'blocked'); assert.equal(result.publishCoverage, false);
});
test('incomplete unknown history falls back full with no publication', async () => {
  const f = fixture({ override: { '/repos/juan294/paisaxe/actions/workflows/ci-nightly.yml/runs?per_page=100&page=1': new Response('{}', { status: 503, headers: { 'x-ratelimit-remaining': '950' } }) } });
  const { decideNightlyRun } = await module(); const result = await decideNightlyRun(input(), options(f));
  assert.equal(result.action, 'full'); assert.equal(result.publishCoverage, false); assert.equal(result.history.complete, false);
});
test('finalizer uses actual native attempt and child completion; develop is artifact-only', async () => {
  const f = fixture(); const { finalizeCompletedRun } = await module();
  const result = await finalizeCompletedRun({ ...input(), event: envelope(nativeRun()), eventName: 'workflow_run' }, options(f));
  assert.equal(result.available, true); assert.equal(result.receipt.completedAt, '2026-10-02T01:00:00.000Z');
  assert.equal(result.publishCoverage, false); assert.equal(result.receipt.runId, 123); assert.equal(result.receipt.attempt, 1);
});
for (const delta of [{ eventName: 'push' }, { event: {} }, { event: envelope({ ...nativeRun(), id: 9 }) }, { event: envelope({ ...nativeRun(), status: 'in_progress', conclusion: null }) }, { event: { ...envelope(nativeRun()), repository: { ...nativeRun().repository, id: 9 } } }]) test('invalid completion delivery never fetches or publishes '+JSON.stringify(delta), async () => {
  const f = fixture(); const { finalizeCompletedRun } = await module();
  const result = await finalizeCompletedRun({ ...input(), event: envelope(nativeRun()), eventName: 'workflow_run', ...delta }, options(f));
  assert.equal(result.available, false); assert.equal(result.publishCoverage, false);
  if (delta.event?.workflow_run?.id !== 9) assert.equal(f.requests.length, 0);
});
for (const conclusion of ['failure','cancelled','timed_out']) test(`completed ${conclusion} emits no full receipt or publication`, async () => {
  const run = { ...nativeRun(), conclusion }; const f = fixture({ run }); const { finalizeCompletedRun } = await module();
  const result = await finalizeCompletedRun({ ...input(), event: envelope(run), eventName: 'workflow_run' }, options(f));
  assert.equal(result.publishCoverage, false); assert.equal(result.receipt, undefined); assert.equal(result.knownFailed.conclusion, conclusion);
});
test('live measuring identity cannot be overridden by delivery data', async () => {
  const f = fixture(); const { finalizeCompletedRun } = await module();
  const result = await finalizeCompletedRun({ ...input(), event: envelope({ ...nativeRun(), head_sha: 'f'.repeat(40) }), eventName: 'workflow_run' }, options(f));
  assert.equal(result.available, false); assert.equal(result.publishCoverage, false);
});

test('actual current matching in-progress admission blocks duplicate full fallback', async () => {
  const run = { ...nativeRun(), status: 'in_progress', conclusion: null };
  const f = fixture({ run, jobs: [nativeJob(1,'Lint'), nativeJob(2,'Test'), nativeJob(3,'Cadence admission')] });
  const { decideNightlyRun } = await module(); const result = await decideNightlyRun(input(), options(f));
  assert.equal(result.action, 'blocked'); assert.match(result.reason,/in-progress/); assert.equal(result.publishCoverage,false);
});

test('coverage metrics cannot be smuggled through a develop artifact', async () => {
  const f = fixture({ measured: { ...measurement(), metrics: { testCount: 2, testFiles: 1, passed: 2, failed: 0, coverage: 100 } } });
  const { finalizeCompletedRun } = await module(); const result = await finalizeCompletedRun({ ...input(), event: envelope(nativeRun()), eventName: 'workflow_run' }, options(f));
  assert.equal(result.available,true); assert.equal(result.publishCoverage,false); assert.equal(result.coverage,undefined);
});

for (const workflow of ['.github/workflows/coverage.yml', '.github/workflows/ci-nightly.yml']) test('actual main completion publication allowlist '+workflow, async () => {
  const caller = workflow, expectedMain = { ...expected, targetBranch: 'main' };
  const projected = { ...projection, workflowPins: { [caller]: 'c'.repeat(40), '.github/workflows/ci.yml': 'd'.repeat(40) }, workflowSources: { [caller]: expected.definitionSha, '.github/workflows/ci.yml': expected.definitionSha } };
  const protectedPolicy = { ...policy, workflows: [{ ...policy.workflows[0], path: caller }] };
  const run = { ...nativeRun(), path: caller, head_sha: expected.sourceSha, head_branch: 'main', event: 'push' };
  const admit = { ...admission(), ...expectedMain, workflow: caller, workflowPins: projected.workflowPins };
  const measured = { ...measurement(), ...expectedMain, workflow: caller, metrics: { testCount: 2, testFiles: 1, passed: 2, failed: 0, coverage: 100 } };
  const routes = { [`/repos/juan294/paisaxe/contents/${caller}?ref=${expected.definitionSha}`]: { type: 'file', path: caller, sha: 'c'.repeat(40) }, [`/repos/juan294/paisaxe/contents/${caller}?ref=${expected.sourceSha}`]: { type: 'file', path: caller, sha: 'c'.repeat(40) } };
  const f = fixture({ run, admit, measured, override: routes });
  const { finalizeCompletedRun } = await module();
  const result = await finalizeCompletedRun({ expected: expectedMain, policy: protectedPolicy, projection: projected, eventName: 'workflow_run', event: envelope(run) }, options(f));
  assert.equal(result.available, true);
  assert.equal(result.publishCoverage, workflow === '.github/workflows/coverage.yml');
  if (result.publishCoverage) { assert.equal(result.coverage.sourceCommitSha, expected.sourceSha); assert.equal(result.coverage.sourceReportedAt, '2026-10-02T01:00:00.000Z'); }
});
