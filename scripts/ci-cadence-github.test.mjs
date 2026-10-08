import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGitHubCadenceReader } from './ci-cadence-github.mjs';
import { chooseNightly } from './ci-cadence.mjs';

const repository = 'juan294/paisaxe';
const sha = value => value.repeat(40);
const workflow = '.github/workflows/ci-nightly.yml';
const expected = { repository, sourceSha: sha('a'), targetBranch: 'develop', definitionSha: sha('b'), policyFingerprint: 'policy:1', helperFingerprint: 'helper:1', lockfileFingerprint: 'lock:1', runtimeFingerprint: 'node24/npm11/linux' };
const policy = { schemaVersion: 1, repository, defaultBranch: 'main', integrationBranch: 'develop', productionBranch: 'main', owners: ['juan294'], refreshHours: 168, coverageMaxAgeHours: 192, changedHeadDeadlineHours: 36, workflows: [{ path: workflow, definitionSha: sha('c'), jobs: [{ id: 'lint', needs: [] }, { id: 'test', needs: ['lint'] }], contexts: { Lint: ['lint'], Test: ['test'] } }] };
const projection = { kind: 'full', jobs: { lint: 'Lint', test: 'Test' }, workflowPins: { [workflow]: sha('c'), '.github/workflows/ci.yml': sha('d') }, admissionJob: 'Cadence admission', admissionStep: 'Execute Cadence admission', measurementJob: 'Test', measurementStep: 'Upload measurement', workflowSources: { [workflow]: sha('b'), '.github/workflows/ci.yml': sha('b') }, referencedWorkflows: [{ path: `juan294/paisaxe/.github/workflows/ci.yml@${sha('b')}`, sha: sha('b'), ref: 'refs/heads/main' }], steps: { lint: ['Execute Lint'], test: ['Execute Test'] }, ignoredSteps: { lint: ['Complete job'], test: ['Complete job', 'Upload measurement'] } };
const at = '2026-10-02T01:00:00Z';
const nativeRun = () => ({ id: 123, run_attempt: 1, path: workflow, event: 'schedule', head_sha: expected.definitionSha, head_branch: 'main', status: 'completed', conclusion: 'success', html_url: `https://github.com/${repository}/actions/runs/123`, repository: { full_name: repository, id: 1141286326, owner: { login: 'juan294', id: 3944118, type: 'User' }, default_branch: 'main', fork: false }, head_repository: { full_name: repository, id: 1141286326, owner: { login: 'juan294', id: 3944118, type: 'User' }, default_branch: 'main', fork: false }, actor: { login: 'juan294', id: 3944118, type: 'User' }, check_suite_id: 99, referenced_workflows: projection.referencedWorkflows, updated_at: '2026-10-03T00:00:00Z' });
const nativeJob = (id, name, conclusion = 'success', completed = at) => {
  const admissionTime = '2026-10-02T00:25:00Z';
  const appTime = name === 'Cadence admission' ? admissionTime : completed;
  const job = { id, run_id: 123, run_attempt: 1, name, status: 'completed', conclusion, started_at: name === 'Cadence admission' ? '2026-10-02T00:20:00Z' : '2026-10-02T00:30:00Z', completed_at: appTime, steps: [{ number: 1, name: `Execute ${name}`, status: 'completed', conclusion, started_at: name === 'Cadence admission' ? '2026-10-02T00:20:00Z' : '2026-10-02T00:30:00Z', completed_at: appTime }] };
  if (name === 'Test') {
    job.completed_at = new Date(Date.parse(completed) + 5 * 60_000).toISOString();
    job.steps.push({ number: 2, name: 'Upload measurement', status: 'completed', conclusion: 'success', started_at: completed, completed_at: job.completed_at });
  }
  return job;
};
const admission = () => ({ schemaVersion: 1, kind: 'ci-cadence-admission', ...expected, testedCheckoutSha: expected.sourceSha, runId: 123, attempt: 1, workflow, workflowDefinitionSha: sha('c'), lane: 'nightly', workflowPins: projection.workflowPins, jobs: policy.workflows[0].jobs, contexts: policy.workflows[0].contexts });
const measurement = () => ({ schemaVersion: 1, kind: 'ci-cadence-measurement', ...expected, runId: 123, attempt: 1, workflow, checkouts: { 1: sha('a'), 2: sha('a') }, failing: 0 });
function crc32(bytes) { let value = 0xffffffff; for (const byte of bytes) { value ^= byte; for (let i = 0; i < 8; i++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0); } return (value ^ 0xffffffff) >>> 0; }
// Real ZIP bytes, not a mock of the owned archive parser.
function zip(value, name = 'admission.json') {
  const data = Buffer.from(JSON.stringify(value)); const file = Buffer.from(name); const crc = crc32(data);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(file.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(file.length, 28);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(central.length + file.length, 12); end.writeUInt32LE(local.length + file.length + data.length, 16);
  return Buffer.concat([local, file, data, central, file, end]);
}
function fixture({ run = nativeRun(), jobs = [nativeJob(1, 'Lint'), nativeJob(2, 'Test'), nativeJob(3, 'Cadence admission')], admit = admission(), measured = measurement(), override = {}, limits, fetchImpl, now = () => new Date('2026-10-03T01:00:00Z') } = {}) {
  const bodies = { 10: zip(admit), 11: zip(measured, 'measurement.json') };
  const artifacts = [10, 11].map(id => ({ id, name: id === 10 ? 'ci-cadence-admission' : 'ci-cadence-measurement', expired: false, size_in_bytes: bodies[id].length, digest: `sha256:${createHash('sha256').update(bodies[id]).digest('hex')}`, workflow_run: { id: 123, head_repository_id: run.head_repository.id, head_sha: run.head_sha }, created_at: id === 10 ? '2026-10-02T00:24:00Z' : new Date(Date.parse(jobs.find(job => job.name === 'Test' && Array.isArray(job.steps))?.steps.find(step => step.name === 'Upload measurement')?.started_at ?? at) + 60_000).toISOString() }));
  const routes = {
    [`/repos/juan294/paisaxe/contents/${workflow}?ref=${expected.definitionSha}`]: { type: 'file', path: workflow, sha: sha('c') },
    [`/repos/juan294/paisaxe/contents/.github/workflows/ci.yml?ref=${expected.definitionSha}`]: { type: 'file', path: '.github/workflows/ci.yml', sha: sha('d') },
    '/repos/juan294/paisaxe/actions/runs/123/attempts/1': run,
    '/repos/juan294/paisaxe/actions/runs/123/attempts/1/jobs?per_page=100&page=1': { total_count: jobs.length, jobs },
    '/repos/juan294/paisaxe/actions/runs/123/artifacts?per_page=100&page=1': { total_count: artifacts.length, artifacts },
    '/repos/juan294/paisaxe/actions/artifacts/10': artifacts[0],
    '/repos/juan294/paisaxe/actions/artifacts/11': artifacts[1],
    '/repos/juan294/paisaxe/actions/artifacts/10/zip': bodies[10],
    '/repos/juan294/paisaxe/actions/artifacts/11/zip': bodies[11],
    '/repos/juan294/paisaxe/actions/workflows/ci-nightly.yml/runs?per_page=100&page=1': { total_count: 1, workflow_runs: [run] },
    ...override,
  };
  const requests = [];
  const mock = async (url, options) => {
    requests.push({ url, options }); const key = new URL(url).pathname + new URL(url).search;
    if (fetchImpl) return fetchImpl(url, options, routes[key]);
    if (!(key in routes)) return new Response('not found', { status: 404 });
    const row = routes[key];
    if (row instanceof Response) return row;
    return new Response(Buffer.isBuffer(row) ? row : JSON.stringify(row), { headers: { 'x-ratelimit-remaining': '950' } });
  };
  return { reader: createGitHubCadenceReader({ token: 'fixture-secret-token', fetchImpl: mock, limits, now }), requests, routes, artifacts, bodies };
}
const read = (f, extra = {}) => f.reader.readRun({ runId: 123, attempt: 1, expected, policy, projection, ...extra });

for (const [label, remaining] of [['unsafe integer', '9007199254740992'], ['infinite conversion', '9'.repeat(400)], ['decimal', '950.0'], ['exponent', '1e4'], ['negative', '-950'], ['unparseable', 'unknown'], ['empty', ''], ['below floor', '99'], ['well below floor', '50']]) test(`BAPI-QUOTA: ${label} stops at the first GET without a receipt`, async () => {
  const make = () => fixture({ fetchImpl: async (url, options, row) => new Response(Buffer.isBuffer(row) ? row : JSON.stringify(row), { status: row === undefined ? 404 : 200, headers: { 'x-ratelimit-remaining': remaining } }) });
  const direct = make(); const result = await read(direct);
  assert.equal(result.available, false); assert.equal(result.receipt, undefined); assert.equal(result.knownFailed, undefined);
  assert.equal(direct.requests.length, 1);
  const collected = make(); const evidence = await history(collected); const decision = nightly(evidence);
  assert.equal(evidence.complete, false); assert.deepEqual(evidence.receipts, []);
  assert.equal(decision.action, 'full'); assert.equal(decision.publishCoverage, false);
  assert.equal(collected.requests.length, 1);
  assert.equal(JSON.stringify([result, evidence, decision]).includes('fixture-secret-token'), false);
});
// GITHUB_TOKEN allows 1,000 requests/hour per repository, so a healthy native
// session reports at most 999 remaining: the floor must sit well below that.
for (const remaining of ['100', '950', '999', '9007199254740991']) test(`BAPI-QUOTA: exact safe quota ${remaining} permits authenticated success`, async () => {
  const f = fixture({ fetchImpl: async (url, options, row) => new Response(Buffer.isBuffer(row) ? row : JSON.stringify(row), { status: row === undefined ? 404 : 200, headers: { 'x-ratelimit-remaining': remaining } }) });
  const evidence = await history(f); const decision = nightly(evidence);
  assert.equal(evidence.complete, true); assert.equal(evidence.receipts.length, 1);
  assert.equal(evidence.receipts[0].conclusion, 'success'); assert.equal(decision.action, 'skip'); assert.equal(decision.publishCoverage, false);
  assert.ok(f.requests.length > 1);
});

test('native exact-attempt successful children produce validated receipt and actual maximum child time', async () => {
  const f = fixture({ jobs: [nativeJob(1, 'Lint'), nativeJob(2, 'Test', 'success', '2026-10-02T02:00:00Z'), nativeJob(3, 'Cadence admission')] });
  const result = await read(f);
  assert.equal(result.available, true); assert.equal(result.receipt.conclusion, 'success'); assert.equal(Date.parse(result.receipt.completedAt), Date.parse('2026-10-02T02:00:00Z'));
  assert.equal(result.receipt.nativeHeadSha, expected.definitionSha); assert.equal(result.receipt.testedCheckoutSha, expected.sourceSha);
  assert.deepEqual(result.receipt.jobs.test.needs, ['lint']); assert.deepEqual(result.receipt.contexts, { Lint: 'success', Test: 'success' });
  assert.ok(f.requests.every(r => r.options.method === 'GET' && r.url.startsWith('https://api.github.com/repos/juan294/paisaxe/')));
  assert.ok(f.requests.some(r => r.url.endsWith('/attempts/1/jobs?per_page=100&page=1')));
});
for (const delta of [{ id: 999 }, { run_attempt: 2 }, { path: '.github/workflows/coverage.yml' }, { head_sha: sha('f') }, { head_branch: 'develop' }, { event: 'workflow_dispatch' }, { status: 'in_progress' }, { head_repository: { full_name: 'outsider/paisaxe' } }, { actor: { login: 'outsider' } }]) test(`native run mismatch ${JSON.stringify(delta)} cannot yield receipt`, async () => assert.equal((await read(fixture({ run: { ...nativeRun(), ...delta } }))).available, false));
for (const conclusion of ['failure', 'skipped', 'cancelled', 'neutral', 'timed_out']) test(`actual application child ${conclusion} rejects success`, async () => {
  const result = await read(fixture({ jobs: [nativeJob(1, 'Lint'), nativeJob(2, 'Test', conclusion), nativeJob(3, 'Cadence admission')] }));
  assert.equal(result.available, false); assert.equal(result.receipt, undefined);
});
for (const jobs of [[nativeJob(1, 'Lint'), nativeJob(3, 'Cadence admission')], [nativeJob(1, 'Lint'), nativeJob(1, 'Test'), nativeJob(3, 'Cadence admission')], [nativeJob(1, 'Lint'), nativeJob(2, 'Test'), nativeJob(3, 'Cadence admission'), nativeJob(4, 'Uninventoried app')]]) test(`missing/duplicate/unknown children ${jobs.length}`, async () => assert.equal((await read(fixture({ jobs }))).available, false));
for (const field of ['sourceSha', 'definitionSha', 'policyFingerprint', 'helperFingerprint', 'lockfileFingerprint', 'runtimeFingerprint']) test(`artifact admission ${field} cannot override protected identity`, async () => assert.equal((await read(fixture({ admit: { ...admission(), [field]: 'wrong' } }))).available, false));
for (const change of [{ lane: 'fast' }, { workflowPins: { [workflow]: sha('c') } }, { jobs: [{ id: 'lint', needs: [] }] }, { contexts: { Test: ['lint'] } }, { runId: 124 }, { attempt: 2 }]) test(`ineligible admission ${JSON.stringify(change)}`, async () => assert.equal((await read(fixture({ admit: { ...admission(), ...change } }))).available, false));
for (const change of [{ checkouts: { 1: sha('a'), 2: sha('f') } }, { checkouts: { 1: sha('a') } }, { failing: 1 }, { kind: 'coverage-only' }, { attempt: 2 }]) test(`measurement cannot fabricate full source checkout ${JSON.stringify(change)}`, async () => assert.equal((await read(fixture({ measured: { ...measurement(), ...change } }))).available, false));
test('PR merge head cannot substitute the expected exact measured source', async () => {
  const run = { ...nativeRun(), event: 'pull_request', head_branch: 'feature', head_sha: sha('f'), pull_requests: [{ number: 5, head: { sha: sha('a') }, base: { ref: 'develop', sha: sha('b') } }] };
  assert.equal((await read(fixture({ run }))).available, false);
});
test('success requires separate measurement artifact, not self-declared admission success', async () => {
  const f = fixture(); f.routes['/repos/juan294/paisaxe/actions/runs/123/artifacts?per_page=100&page=1'] = { total_count: 1, artifacts: [f.artifacts[0]] };
  assert.equal((await read(f)).available, false);
});
for (const change of [{ expired: true }, { digest: `sha256:${'f'.repeat(64)}` }, { workflow_run: { id: 999, head_sha: expected.definitionSha } }, { workflow_run: { id: 123, head_sha: sha('f') } }]) test(`artifact native provenance ${JSON.stringify(change)} rejects`, async () => {
  const f = fixture(); Object.assign(f.artifacts[0], change); assert.equal((await read(f)).available, false);
});
for (const name of ['../admission.json', 'payload.sh', '/admission.json']) test(`archive rejects executable/traversal ${name}`, async () => {
  const f = fixture(); const bytes = zip(admission(), name); f.routes['/repos/juan294/paisaxe/actions/artifacts/10/zip'] = bytes; f.artifacts[0].size_in_bytes = bytes.length; f.artifacts[0].digest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  assert.equal((await read(f)).available, false);
});
test('native failure plus admission remains known failed with no successful measurement artifact', async () => {
  const run = { ...nativeRun(), conclusion: 'failure' }; const f = fixture({ run, jobs: [nativeJob(1, 'Lint', 'failure'), nativeJob(3, 'Cadence admission')] });
  f.routes['/repos/juan294/paisaxe/actions/runs/123/artifacts?per_page=100&page=1'] = { total_count: 1, artifacts: [f.artifacts[0]] };
  const result = await read(f); assert.equal(result.knownFailed.sourceSha, expected.sourceSha); assert.equal(result.knownFailed.conclusion, 'failure'); assert.equal(result.receipt, undefined);
  const history = await f.reader.collectHistory({ workflow, expected, policy, projection });
  assert.equal(chooseNightly(expected, history, '2026-10-03T01:00:00Z', policy).action, 'blocked');
});
for (const conclusion of ['cancelled', 'timed_out']) test(`native ${conclusion} admission blocks known identity without fabricated success`, async () => {
  const result = await read(fixture({ run: { ...nativeRun(), conclusion }, jobs: [nativeJob(1, 'Lint', conclusion), nativeJob(3, 'Cadence admission')] }));
  assert.equal(result.knownFailed.conclusion, conclusion); assert.equal(result.receipt, undefined);
});
test('complete native paginated history feeds unchanged identity skip through frozen helper', async () => {
  const f = fixture(); const history = await f.reader.collectHistory({ workflow, expected, policy, projection });
  assert.equal(history.complete, true); assert.equal(history.receipts.length, 1);
  assert.equal(chooseNightly(expected, history, '2026-10-03T01:00:00Z', policy).action, 'skip');
});
for (const [label, page] of [['missing', { total_count: 1 }], ['duplicate', { total_count: 2, workflow_runs: [nativeRun(), nativeRun()] }], ['truncated', { total_count: 2, workflow_runs: [nativeRun()] }]]) test(`history ${label} cannot manufacture completeness`, async () => {
  const f = fixture({ override: { '/repos/juan294/paisaxe/actions/workflows/ci-nightly.yml/runs?per_page=100&page=1': page } });
  assert.equal((await f.reader.collectHistory({ workflow, expected, policy, projection })).complete, false);
});
test('jobs pagination requires next pages and stable counts', async () => {
  const jobs = [nativeJob(1, 'Lint'), nativeJob(2, 'Test'), nativeJob(3, 'Cadence admission')];
  const f = fixture({ override: {
    '/repos/juan294/paisaxe/actions/runs/123/attempts/1/jobs?per_page=100&page=1': new Response(JSON.stringify({ total_count: 3, jobs: jobs.slice(0, 1) }), { headers: { link: '<https://api.github.com/repos/juan294/paisaxe/actions/runs/123/attempts/1/jobs?per_page=100&page=2>; rel="next"', 'x-ratelimit-remaining': '950' } }),
    '/repos/juan294/paisaxe/actions/runs/123/attempts/1/jobs?per_page=100&page=2': { total_count: 3, jobs: jobs.slice(1) },
  } });
  assert.equal((await read(f)).available, true);
});
for (const total of [4, 2]) test(`changing page total ${total} rejected`, async () => {
  const f = fixture({ override: {
    '/repos/juan294/paisaxe/actions/runs/123/attempts/1/jobs?per_page=100&page=1': new Response(JSON.stringify({ total_count: 3, jobs: [nativeJob(1, 'Lint')] }), { headers: { link: '<https://api.github.com/repos/juan294/paisaxe/actions/runs/123/attempts/1/jobs?per_page=100&page=2>; rel="next"', 'x-ratelimit-remaining': '950' } }),
    '/repos/juan294/paisaxe/actions/runs/123/attempts/1/jobs?per_page=100&page=2': { total_count: total, jobs: [nativeJob(2, 'Test'), nativeJob(3, 'Cadence admission')] },
  } }); assert.equal((await read(f)).available, false);
});
test('page limit and cross-origin/repeated next links never followed', async () => {
  for (const url of ['https://evil.test/private', 'https://api.github.com/repos/juan294/paisaxe/actions/runs/123/attempts/1/jobs?per_page=100&page=1']) {
    const f = fixture({ override: { '/repos/juan294/paisaxe/actions/runs/123/attempts/1/jobs?per_page=100&page=1': new Response(JSON.stringify({ total_count: 3, jobs: [nativeJob(1, 'Lint')] }), { headers: { link: `<${url}>; rel="next"`, 'x-ratelimit-remaining': '950' } }) } });
    assert.equal((await read(f)).available, false); assert.equal(f.requests.some(r => r.url === 'https://evil.test/private'), false);
  }
});
test('request budget/HTTP/rate/body failures are unavailable and never disclose token or retry', async () => {
  for (const make of [() => fixture({ limits: { maxRequests: 1 } }), () => fixture({ fetchImpl: async () => { throw new Error('fixture-secret-token'); } }), () => fixture({ fetchImpl: async () => new Response('fixture-secret-token', { status: 403 }) }), () => fixture({ fetchImpl: async () => new Response('{}', { headers: { 'x-ratelimit-remaining': '0' } }) }), () => fixture({ limits: { maxBytes: 5 } })]) {
    const f = make(); const result = await read(f); assert.equal(result.available, false); assert.equal(JSON.stringify(result).includes('fixture-secret-token'), false);
  }
});
test('unknown workflow/repository/unsafe IDs fail before any external request', async () => {
  for (const extra of [{ expected: { ...expected, repository: 'outsider/paisaxe' } }, { runId: '../123' }, { attempt: 0 }, { projection: { ...projection, kind: 'coverage-only' } }, { policy: { ...policy, workflows: [...policy.workflows, { ...policy.workflows[0], path: '.github/workflows/other.yml' }] } }]) {
    const f = fixture(); assert.equal((await read(f, extra)).available, false); assert.equal(f.requests.length, 0);
  }
});

test('step inventory uses actual last application step time, excluding later parent cleanup/upload', async () => {
  const jobs = [nativeJob(1, 'Lint'), nativeJob(2, 'Test'), nativeJob(3, 'Cadence admission')];
  jobs[1].completed_at = '2026-10-02T04:00:00Z';
  jobs[1].steps.push({ number: 3, name: 'Complete job', status: 'completed', conclusion: 'success', started_at: '2026-10-02T03:00:00Z', completed_at: '2026-10-02T04:00:00Z' });
  const result = await read(fixture({ jobs })); assert.equal(result.available, true); assert.equal(Date.parse(result.receipt.completedAt), Date.parse(at));
});
for (const conclusion of ['failure', 'skipped', 'cancelled', 'neutral']) test(`required native app step ${conclusion} rejects parent success`, async () => {
  const jobs = [nativeJob(1, 'Lint'), nativeJob(2, 'Test'), nativeJob(3, 'Cadence admission')]; jobs[1].steps[0].conclusion = conclusion;
  assert.equal((await read(fixture({ jobs }))).available, false);
});
for (const steps of [[], [{ name: 'Echo pass', number: 1, status: 'completed', conclusion: 'success', started_at: at, completed_at: at }]]) test('missing or unreviewed step inventory cannot fabricate receipt', async () => {
  const jobs = [nativeJob(1, 'Lint'), nativeJob(2, 'Test'), nativeJob(3, 'Cadence admission')]; jobs[1].steps = steps;
  assert.equal((await read(fixture({ jobs }))).available, false);
});

for (const completed_at of [null, 'invalid', '2026-02-30T01:00:00Z']) test(`invalid parent completion ${completed_at} cannot grant receipt`, async () => {
  const jobs = [nativeJob(1, 'Lint'), nativeJob(2, 'Test'), nativeJob(3, 'Cadence admission')]; jobs[1].completed_at = completed_at;
  assert.equal((await read(fixture({ jobs }))).available, false);
});
test('missing pagination next link never hides remaining rows', async () => {
  const f = fixture({ override: { '/repos/juan294/paisaxe/actions/runs/123/attempts/1/jobs?per_page=100&page=1': { total_count: 3, jobs: [nativeJob(1, 'Lint')] } } });
  assert.equal((await read(f)).available, false);
});
test('known failure survives later partial history and cannot be retried automatically', async () => {
  const run = { ...nativeRun(), conclusion: 'failure' }; const f = fixture({ run, jobs: [nativeJob(1, 'Lint', 'failure'), nativeJob(3, 'Cadence admission')], override: {
    '/repos/juan294/paisaxe/actions/workflows/ci-nightly.yml/runs?per_page=100&page=1': new Response(JSON.stringify({ total_count: 2, workflow_runs: [run] }), { headers: { link: '<https://api.github.com/repos/juan294/paisaxe/actions/workflows/ci-nightly.yml/runs?per_page=100&page=2>; rel="next"', 'x-ratelimit-remaining': '950' } }),
    '/repos/juan294/paisaxe/actions/workflows/ci-nightly.yml/runs?per_page=100&page=2': new Response('unavailable', { status: 503 }),
  } });
  const history = await f.reader.collectHistory({ workflow, expected, policy, projection });
  assert.equal(history.complete, false); assert.equal(history.receipts[0].conclusion, 'failure');
  assert.equal(chooseNightly(expected, history, '2026-10-03T01:00:00Z', policy).action, 'blocked');
});
test('HTTP and body deadlines bound unresolved third-party promises', async () => {
  for (const fetchImpl of [async () => new Promise(() => {}), async () => new Response(new ReadableStream({ start() {} }), { headers: { 'x-ratelimit-remaining': '950' } })]) {
    const f = fixture({ fetchImpl, limits: { timeoutMs: 10 } }); const result = await read(f); assert.equal(result.available, false); assert.match(result.error, /deadline/);
  }
});
test('native artifact head repository ID binds same named repository identity', async () => {
  const f = fixture(); f.artifacts[0].workflow_run.head_repository_id = 88; assert.equal((await read(f)).available, false);
});

test('single-job native full suite can bind pre-suite admission despite later failed application step', async () => {
  const fullPolicy = { ...policy, workflows: [{ ...policy.workflows[0], jobs: [{ id: 'full', needs: [] }], contexts: { 'Full suite': ['full'] } }] };
  const fullProjection = { ...projection, jobs: { full: 'Full suite' }, steps: { full: ['Execute Lint', 'Execute Test'] }, ignoredSteps: { full: ['Publish admission'] }, admissionJob: 'Full suite', admissionStep: 'Publish admission' };
  const job = nativeJob(5, 'Full suite', 'failure'); job.started_at = '2026-10-02T00:20:00Z'; job.steps = [
    { number: 1, name: 'Publish admission', status: 'completed', conclusion: 'success', started_at: '2026-10-02T00:20:00Z', completed_at: '2026-10-02T00:25:00Z' },
    { number: 2, name: 'Execute Lint', status: 'completed', conclusion: 'success', started_at: at, completed_at: at },
    { number: 3, name: 'Execute Test', status: 'completed', conclusion: 'failure', started_at: at, completed_at: at },
  ];
  const admit = { ...admission(), jobs: fullPolicy.workflows[0].jobs, contexts: fullPolicy.workflows[0].contexts };
  const f = fixture({ run: { ...nativeRun(), conclusion: 'failure' }, jobs: [job], admit });
  const result = await read(f, { policy: fullPolicy, projection: fullProjection });
  assert.equal(result.knownFailed?.sourceSha, expected.sourceSha); assert.equal(result.receipt, undefined);
});
test('failed admission upload step cannot authenticate source claim despite successful parent', async () => {
  const jobs = [nativeJob(1, 'Lint'), nativeJob(2, 'Test'), nativeJob(3, 'Cadence admission')]; jobs[2].steps[0].conclusion = 'failure';
  assert.equal((await read(fixture({ jobs }))).available, false);
});
test('authenticated API ZIP redirect is bounded and storage GET never receives token', async () => {
  const f = fixture({ fetchImpl: async (url, options, row) => {
    if (url.endsWith('/artifacts/10/zip')) return new Response(null, { status: 302, headers: { location: 'https://productionresultssa1.blob.core.windows.net/fixture/archive.zip', 'x-ratelimit-remaining': '950' } });
    if (url.startsWith('https://productionresultssa1.blob.core.windows.net/')) { assert.equal(options.headers.Authorization, undefined); return new Response(f.bodies[10]); }
    return new Response(Buffer.isBuffer(row) ? row : JSON.stringify(row), { headers: { 'x-ratelimit-remaining': '950' } });
  } });
  assert.equal((await read(f)).available, true);
});
for (const location of ['https://evil.test/artifact.zip', 'http://productionresultssa1.blob.core.windows.net/archive', 'https://productionresultssa1.blob.core.windows.net.evil.test/a', 'https://user:pass@productionresultssa1.blob.core.windows.net/a']) test(`unapproved archive redirect ${location} never fetched`, async () => {
  const f = fixture({ override: { '/repos/juan294/paisaxe/actions/artifacts/10/zip': new Response(null, { status: 302, headers: { location } }) } });
  assert.equal((await read(f)).available, false); assert.equal(f.requests.some(r => r.url === location), false);
});

test('actual immutable definition blob readback rejects changed callee even when artifact claims expected pins', async () => {
  const f = fixture({ override: { [`/repos/juan294/paisaxe/contents/.github/workflows/ci.yml?ref=${expected.definitionSha}`]: { type: 'file', path: '.github/workflows/ci.yml', sha: sha('f') } } });
  assert.equal((await read(f)).available, false);
});
test('native referenced workflow commit cannot be replaced with forged artifact-only callee ref', async () => {
  const f = fixture({ run: { ...nativeRun(), referenced_workflows: [{ ...projection.referencedWorkflows[0], sha: sha('f') }] } });
  assert.equal((await read(f)).available, false);
});
// GitHub names each reference path@<commit> and lists them in no fixed order (run 37721477388).
test('native referenced workflows match in any order, but only as path@commit with that commit', async () => {
  const e2e = { path: `juan294/paisaxe/.github/workflows/e2e.yml@${sha('b')}`, sha: sha('b'), ref: 'refs/heads/main' };
  const twoCallees = { ...projection, workflowPins: { ...projection.workflowPins, '.github/workflows/e2e.yml': sha('e') },
    workflowSources: { ...projection.workflowSources, '.github/workflows/e2e.yml': sha('b') }, referencedWorkflows: [projection.referencedWorkflows[0], e2e] };
  const served = references => fixture({ run: { ...nativeRun(), referenced_workflows: references }, admit: { ...admission(), workflowPins: twoCallees.workflowPins },
    override: { [`/repos/juan294/paisaxe/contents/.github/workflows/e2e.yml?ref=${expected.definitionSha}`]: { type: 'file', path: '.github/workflows/e2e.yml', sha: sha('e') } } });
  const available = async (references, projected = twoCallees) => (await read(served(references), { projection: projected })).available;
  // GitHub's own key order and an arbitrary list order.
  assert.equal(await available([{ ref: e2e.ref, sha: e2e.sha, path: e2e.path }, projection.referencedWorkflows[0]]), true);
  // A branch-named path is not what GitHub reports, so it can neither be projected nor observed.
  const branchNamed = list => list.map(item => ({ ...item, path: item.path.replace(/@[a-f0-9]{40}$/, '@refs/heads/main') }));
  assert.equal(await available(branchNamed(twoCallees.referencedWorkflows), { ...twoCallees, referencedWorkflows: branchNamed(twoCallees.referencedWorkflows) }), false);
  assert.equal(await available(branchNamed(twoCallees.referencedWorkflows)), false);
  // A path naming one commit while .sha names another is rejected.
  assert.equal(await available([{ ...e2e, path: `juan294/paisaxe/.github/workflows/e2e.yml@${sha('f')}` }, projection.referencedWorkflows[0]]), false);
  // A missing reference, an unprojected extra one, a repeated one or an extra field is rejected.
  assert.equal(await available([projection.referencedWorkflows[0]]), false);
  assert.equal(await available([...twoCallees.referencedWorkflows, { ...e2e, path: `juan294/paisaxe/.github/workflows/other.yml@${sha('b')}` }]), false);
  assert.equal(await available([...twoCallees.referencedWorkflows, e2e]), false);
  assert.equal(await available([projection.referencedWorkflows[0], { ...e2e, extra: true }]), false);
  // The same path and commit reached through another branch ref is a different native reference.
  assert.equal(await available([projection.referencedWorkflows[0], { ...e2e, ref: 'refs/heads/develop' }]), false);
});

test('cancelled after authenticated pre-suite admission but before app work remains known blocked', async () => {
  const run = { ...nativeRun(), conclusion: 'cancelled' };
  const result = await read(fixture({ run, jobs: [nativeJob(3, 'Cadence admission')] }));
  assert.equal(result.knownFailed?.sourceSha, expected.sourceSha); assert.equal(result.knownFailed?.conclusion, 'cancelled'); assert.equal(result.receipt, undefined);
});
test('bounded history page cap preserves known failure and marks incompleteness', async () => {
  const run = { ...nativeRun(), conclusion: 'failure' };
  const f = fixture({ run, jobs: [nativeJob(1, 'Lint', 'failure'), nativeJob(3, 'Cadence admission')], limits: { maxPages: 1 }, override: {
    '/repos/juan294/paisaxe/actions/workflows/ci-nightly.yml/runs?per_page=100&page=1': new Response(JSON.stringify({ total_count: 2, workflow_runs: [run] }), { headers: { link: '<https://api.github.com/repos/juan294/paisaxe/actions/workflows/ci-nightly.yml/runs?per_page=100&page=2>; rel="next"', 'x-ratelimit-remaining': '950' } }),
  } });
  const history = await f.reader.collectHistory({ workflow, expected, policy, projection });
  assert.equal(history.complete, false); assert.equal(f.requests.some(r => r.url.endsWith('runs?per_page=100&page=2')), false);
  assert.equal(chooseNightly(expected, history, '2026-10-03T01:00:00Z', policy).action, 'blocked');
});
test('every original attempt is read; latest success does not erase missing earlier attempt', async () => {
  const run = { ...nativeRun(), run_attempt: 2 };
  const f = fixture({ override: { '/repos/juan294/paisaxe/actions/workflows/ci-nightly.yml/runs?per_page=100&page=1': { total_count: 1, workflow_runs: [run] } } });
  const history = await f.reader.collectHistory({ workflow, expected, policy, projection });
  assert.equal(history.complete, false);
  assert.ok(f.requests.some(r => r.url.endsWith('/attempts/1'))); assert.ok(f.requests.some(r => r.url.endsWith('/attempts/2')));
});
test('redirect API rate floor is enforced before storage request', async () => {
  const location = 'https://productionresultssa1.blob.core.windows.net/a';
  const f = fixture({ override: { '/repos/juan294/paisaxe/actions/artifacts/10/zip': new Response(null, { status: 302, headers: { location, 'x-ratelimit-remaining': '1' } }) } });
  assert.equal((await read(f)).available, false); assert.equal(f.requests.some(r => r.url === location), false);
});
test('caller metadata outside defined identity cannot leak into receipt', async () => {
  const f = fixture(); const result = await read(f, { expected: { ...expected, privateToken: 'fixture-secret-token' } });
  assert.equal(result.available, true); assert.equal(JSON.stringify(result).includes('fixture-secret-token'), false);
});

function streamingZip(value, name) {
  const base = zip(value, name); const localName = Buffer.from(name); const data = Buffer.from(JSON.stringify(value)); const compressed = deflateRawSync(data);
  const oldCentral = base.readUInt32LE(base.length - 6); const central = Buffer.from(base.subarray(oldCentral, base.length - 22));
  central.writeUInt16LE(8, 8); central.writeUInt16LE(8, 10); central.writeUInt32LE(compressed.length, 20);
  const local = Buffer.from(base.subarray(0, 30)); local.writeUInt16LE(8, 6); local.writeUInt16LE(8, 8); local.writeUInt32LE(0, 14); local.writeUInt32LE(0, 18); local.writeUInt32LE(0, 22);
  const descriptor = Buffer.alloc(16); descriptor.writeUInt32LE(0x08074b50); descriptor.writeUInt32LE(crc32(data), 4); descriptor.writeUInt32LE(compressed.length, 8); descriptor.writeUInt32LE(data.length, 12);
  const end = Buffer.from(base.subarray(base.length - 22)); end.writeUInt32LE(local.length + localName.length + compressed.length + descriptor.length, 16);
  return Buffer.concat([local, localName, compressed, descriptor, central, end]);
}
test('real deflated streaming ZIP data descriptor is parsed as bounded JSON without execution', async () => {
  const f = fixture(); const bytes = streamingZip(admission(), 'admission.json');
  f.routes['/repos/juan294/paisaxe/actions/artifacts/10/zip'] = bytes; f.artifacts[0].size_in_bytes = bytes.length; f.artifacts[0].digest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  assert.equal((await read(f)).available, true);
});
test('tampered streaming ZIP descriptor cannot override authenticated metadata and central sizes', async () => {
  const f = fixture(); const bytes = streamingZip(admission(), 'admission.json'); const central = bytes.readUInt32LE(bytes.length - 6); bytes.writeUInt32LE(123, central - 4);
  f.routes['/repos/juan294/paisaxe/actions/artifacts/10/zip'] = bytes; f.artifacts[0].size_in_bytes = bytes.length; f.artifacts[0].digest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  assert.equal((await read(f)).available, false);
});

test('admission must complete before application work rather than authenticate source retrospectively', async () => {
  const jobs = [nativeJob(1, 'Lint'), nativeJob(2, 'Test'), nativeJob(3, 'Cadence admission')];
  jobs[2].steps[0].completed_at = '2026-10-02T01:00:00Z'; jobs[2].completed_at = '2026-10-02T01:00:00Z';
  assert.equal((await read(fixture({ jobs }))).available, false);
});

test('partial child pagination still preserves authenticated known failure before history fallback', async () => {
  const run = { ...nativeRun(), conclusion: 'failure' };
  const f = fixture({ run, override: {
    '/repos/juan294/paisaxe/actions/runs/123/attempts/1/jobs?per_page=100&page=1': new Response(JSON.stringify({ total_count: 3, jobs: [nativeJob(3, 'Cadence admission'), nativeJob(1, 'Lint', 'failure')] }), { headers: { link: '<https://api.github.com/repos/juan294/paisaxe/actions/runs/123/attempts/1/jobs?per_page=100&page=2>; rel="next"', 'x-ratelimit-remaining': '950' } }),
    '/repos/juan294/paisaxe/actions/runs/123/attempts/1/jobs?per_page=100&page=2': new Response('unavailable', { status: 503 }),
  } });
  const result = await read(f); assert.equal(result.knownFailed?.sourceSha, expected.sourceSha); assert.equal(result.available, false);
  // Responses are single-use, so use a fresh fixture for complete collector evaluation.
  const f2 = fixture({ run, override: {
    '/repos/juan294/paisaxe/actions/runs/123/attempts/1/jobs?per_page=100&page=1': new Response(JSON.stringify({ total_count: 3, jobs: [nativeJob(3, 'Cadence admission'), nativeJob(1, 'Lint', 'failure')] }), { headers: { link: '<https://api.github.com/repos/juan294/paisaxe/actions/runs/123/attempts/1/jobs?per_page=100&page=2>; rel="next"', 'x-ratelimit-remaining': '950' } }),
    '/repos/juan294/paisaxe/actions/runs/123/attempts/1/jobs?per_page=100&page=2': new Response('unavailable', { status: 503 }),
  } });
  const history = await f2.reader.collectHistory({ workflow, expected, policy, projection }); assert.equal(history.complete, false);
  assert.equal(chooseNightly(expected, history, '2026-10-03T01:00:00Z', policy).action, 'blocked');
});
for (const testedCheckoutSha of [undefined, 'f'.repeat(40)]) test('pre-suite admission must disclose the actual pinned source checkout', async () => {
  assert.equal((await read(fixture({ admit: { ...admission(), testedCheckoutSha } }))).available, false);
});
test('admission artifact created after successful uploader step cannot be attributed to that step', async () => {
  const f = fixture(); f.artifacts[0].created_at = '2026-10-02T00:26:00Z'; assert.equal((await read(f)).available, false);
});

test('native reference projection cannot count one callee twice while omitting another pinned callee', async () => {
  const pins = { ...projection.workflowPins, '.github/workflows/e2e.yml': sha('e') };
  const refs = [projection.referencedWorkflows[0], { ...projection.referencedWorkflows[0], ref: 'refs/heads/develop' }];
  const f = fixture(); const result = await read(f, { projection: { ...projection, workflowPins: pins, workflowSources: { ...projection.workflowSources, '.github/workflows/e2e.yml': expected.definitionSha }, referencedWorkflows: refs } });
  assert.equal(result.available, false); assert.equal(f.requests.length, 0);
});

const history = f => f.reader.collectHistory({ workflow, expected, policy, projection });
const nightly = evidence => chooseNightly(expected, evidence, '2026-10-03T01:00:00Z', policy);
const failedFixture = options => fixture({ run: { ...nativeRun(), conclusion: 'failure' }, ...options });
function assertBlockedFailure(evidence, reason) {
  assert.equal(evidence.complete, false, reason); assert.equal(evidence.available, false, reason);
  assert.equal(evidence.receipts.length, 1, reason); assert.equal(evidence.receipts[0].kind, 'native-failure-evidence');
  assert.equal(evidence.receipts[0].sourceSha, expected.sourceSha); assert.equal(evidence.receipts[0].runId, 123); assert.equal(evidence.receipts[0].attempt, 1);
  assert.equal(evidence.receipts[0].provenance.admissionArtifactId, 10); assert.match(evidence.receipts[0].provenance.admissionDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(nightly(evidence).action, 'blocked', reason); assert.equal(nightly(evidence).publishCoverage, false);
}
test('BAPI-FAIL-ARTIFACT-PAGE: authenticated matching admission survives incomplete artifact census', async () => {
  const f = failedFixture(); f.routes['/repos/juan294/paisaxe/actions/runs/123/artifacts?per_page=100&page=1'].total_count = 3;
  assertBlockedFailure(await history(f), 'partial artifact page must not authorize repeat');
});
for (const steps of [{ unavailable: true }, null]) test('BAPI-FAIL-MALFORMED-CHILD: malformed nonproducer steps cannot erase known native failure', async () => {
  const jobs = [nativeJob(1, 'Lint'), nativeJob(2, 'Test'), nativeJob(3, 'Cadence admission')]; jobs[1].steps = steps;
  const evidence = await history(failedFixture({ jobs })); assertBlockedFailure(evidence, 'malformed app child must retain pre-suite failure anchor');
  assert.equal(evidence.receipts[0].completedAt, '2026-10-02T00:25:00.000Z');
});
for (const conclusion of ['failure', 'cancelled', 'timed_out']) test(`BAPI-FAIL-STEP: native green parent cannot erase actual required step ${conclusion}`, async () => {
  const jobs = [nativeJob(1, 'Lint'), nativeJob(2, 'Test'), nativeJob(3, 'Cadence admission')]; jobs[1].steps[0].conclusion = conclusion;
  const evidence = await history(fixture({ jobs })); assertBlockedFailure(evidence, 'actual step failure must block unchanged identity');
  assert.equal(evidence.receipts[0].conclusion, conclusion); assert.equal(evidence.receipts[0].nativeConclusion, 'success');
  assert.equal(evidence.receipts[0].observedFailure.jobId, 2); assert.equal(evidence.receipts[0].observedFailure.stepName, 'Execute Test');
});
for (const conclusion of ['failure', 'cancelled', 'timed_out']) test(`BAPI-FAIL-STEP: actual child ${conclusion} persists despite green native run`, async () => {
  const jobs = [nativeJob(1, 'Lint'), nativeJob(2, 'Test', conclusion), nativeJob(3, 'Cadence admission')];
  const evidence = await history(fixture({ jobs })); assertBlockedFailure(evidence, 'actual child failure must block');
  assert.equal(evidence.receipts[0].nativeConclusion, 'success');
});
test('BAPI-MEASUREMENT-PRODUCER: early artifact cannot self-attest post-suite checkout evidence', async () => {
  const f = fixture(); f.artifacts[1].created_at = '2026-10-02T00:01:00Z';
  const evidence = await history(f); assert.equal(evidence.complete, false); assert.equal(evidence.receipts.length, 0); assert.equal(nightly(evidence).action, 'full');
});
for (const change of ['missing', 'failed', 'early', 'late', 'wrong-native-attempt']) test(`BAPI-MEASUREMENT-PRODUCER: ${change} uploader cannot produce trusted receipt`, async () => {
  const jobs = [nativeJob(1, 'Lint'), nativeJob(2, 'Test'), nativeJob(3, 'Cadence admission')]; const upload = jobs[1].steps[1];
  if (change === 'missing') jobs[1].steps.pop();
  if (change === 'failed') upload.conclusion = 'failure';
  if (change === 'early') upload.started_at = '2026-10-02T00:45:00Z';
  if (change === 'late') upload.started_at = '2026-10-02T01:04:00Z';
  if (change === 'wrong-native-attempt') jobs[1].run_attempt = 2;
  const f = fixture({ jobs });
  if (change === 'late') f.artifacts[1].created_at = '2026-10-02T01:01:00Z';
  const evidence = await history(f); assert.equal(evidence.complete, false); assert.equal(evidence.receipts.length, 0); assert.equal(nightly(evidence).action, 'full');
});
for (const remaining of ['99', '50', 'unknown', null, '9007199254740992', '9'.repeat(400)]) test(`BAPI-RATE-FLOOR: ${remaining} stops all subsequent session reads`, async () => {
  const f = fixture({ override: { '/repos/juan294/paisaxe/actions/workflows/ci-nightly.yml/runs?per_page=100&page=1': { total_count: 1, workflow_runs: [{ ...nativeRun(), run_attempt: 3 }] } }, fetchImpl: async (url, options, row) => {
    if (url.endsWith('/attempts/1')) return new Response(JSON.stringify(nativeRun()), { headers: remaining === null ? {} : { 'x-ratelimit-remaining': remaining } });
    return new Response(Buffer.isBuffer(row) ? row : JSON.stringify(row), { status: row === undefined ? 404 : 200, headers: { 'x-ratelimit-remaining': '950' } });
  } });
  const evidence = await history(f); assert.equal(evidence.complete, false); assert.equal(nightly(evidence).action, 'full');
  assert.equal(f.requests.filter(row => /\/attempts\/[23]$/.test(row.url)).length, 0);
});
for (const remaining of ['99', '50', '9007199254740992', '9'.repeat(400)]) test(`BAPI-RATE-FLOOR: sticky ${remaining} stop preserves previously authenticated failed attempt`, async () => {
  const f = failedFixture({ override: { '/repos/juan294/paisaxe/actions/workflows/ci-nightly.yml/runs?per_page=100&page=1': { total_count: 1, workflow_runs: [{ ...nativeRun(), conclusion: 'failure', run_attempt: 3 }] } }, fetchImpl: async (url, options, row) => {
    if (url.endsWith('/attempts/2')) return new Response('{}', { headers: { 'x-ratelimit-remaining': remaining } });
    return new Response(Buffer.isBuffer(row) ? row : JSON.stringify(row), { status: row === undefined ? 404 : 200, headers: { 'x-ratelimit-remaining': '950' } });
  } });
  const evidence = await history(f); assertBlockedFailure(evidence, 'rate stop must retain first attempt failure');
  assert.equal(f.requests.some(row => row.url.endsWith('/attempts/3')), false);
});

test('BAPI-RATE-FLOOR: authenticates page-one failure before later history rate stop', async () => {
  const run = { ...nativeRun(), conclusion: 'failure' };
  const f = failedFixture({ override: {
    '/repos/juan294/paisaxe/actions/workflows/ci-nightly.yml/runs?per_page=100&page=1': new Response(JSON.stringify({ total_count: 2, workflow_runs: [run] }), { headers: { link: '<https://api.github.com/repos/juan294/paisaxe/actions/workflows/ci-nightly.yml/runs?per_page=100&page=2>; rel="next"', 'x-ratelimit-remaining': '950' } }),
    '/repos/juan294/paisaxe/actions/workflows/ci-nightly.yml/runs?per_page=100&page=2': new Response('{}', { headers: { 'x-ratelimit-remaining': '50' } }),
  } });
  const evidence = await history(f); assertBlockedFailure(evidence, 'later floor cannot erase authenticated failure');
  assert.ok(f.requests.findIndex(row => row.url.endsWith('/artifacts/10/zip')) < f.requests.findIndex(row => row.url.endsWith('runs?per_page=100&page=2')));
  assert.equal(f.requests.at(-1).url.endsWith('runs?per_page=100&page=2'), true);
});

test('all-green work with partial artifact census cannot become full successful reuse', async () => {
  const f = fixture(); f.routes['/repos/juan294/paisaxe/actions/runs/123/artifacts?per_page=100&page=1'].total_count = 3;
  const evidence = await history(f); assert.equal(evidence.complete, false); assert.equal(evidence.receipts.length, 0); assert.equal(nightly(evidence).action, 'full');
});
test('masked required failure survives simultaneous partial census and malformed sibling evidence', async () => {
  const jobs = [nativeJob(1, 'Lint'), nativeJob(2, 'Test'), nativeJob(3, 'Cadence admission')];
  jobs[0].steps = { unavailable: true }; jobs[1].steps[0].conclusion = 'failure';
  const f = fixture({ jobs }); f.routes['/repos/juan294/paisaxe/actions/runs/123/artifacts?per_page=100&page=1'].total_count = 3;
  const evidence = await history(f); assertBlockedFailure(evidence, 'combined later faults cannot erase authenticated app failure');
  assert.equal(evidence.receipts[0].nativeConclusion, 'success'); assert.equal(evidence.receipts[0].observedFailure.stepName, 'Execute Test');
  assert.equal(evidence.receipts[0].failureTimeSource, 'admission-uploader');
});
test('malformed protected admission producer cannot fabricate authenticated failed identity', async () => {
  const jobs = [nativeJob(1, 'Lint', 'failure'), nativeJob(2, 'Test'), nativeJob(3, 'Cadence admission')]; jobs[2].steps = { unavailable: true };
  const evidence = await history(failedFixture({ jobs })); assert.equal(evidence.complete, false); assert.equal(evidence.receipts.length, 0); assert.equal(nightly(evidence).action, 'full');
});
test('post-suite measurement producer success preserves original application timestamp and permits frozen skip', async () => {
  const f = fixture(); const evidence = await history(f);
  assert.equal(evidence.complete, true); assert.equal(nightly(evidence).action, 'skip'); assert.equal(nightly(evidence).publishCoverage, false);
  assert.equal(Date.parse(evidence.receipts[0].completedAt), Date.parse(at));
  assert.ok(Date.parse(f.artifacts[1].created_at) > Date.parse(evidence.receipts[0].completedAt));
});
for (const changes of [{ measurementJob: '' }, { measurementStep: '' }, { measurementStep: 'Execute Test' }]) test('protected projection must identify a separate reviewed measurement upload step', async () => {
  const f = fixture(); const evidence = await f.reader.collectHistory({ workflow, expected, policy, projection: { ...projection, ...changes } });
  assert.equal(evidence.complete, false); assert.equal(evidence.receipts.length, 0); assert.equal(nightly(evidence).action, 'full'); assert.equal(f.requests.length, 0);
});

// Real immutable BEFORE/AFTER Git objects underpin these HTTP fixtures. Only
// third-party HTTP and the existing clock seam are replaced; the owned reader,
// ZIP parser, receipt validator and frozen nightly decision execute normally.
async function executedRootFixture(t, variant = 'app-only', event = 'push', conclusion = 'success') {
  const directory = await mkdtemp(join(tmpdir(), 'paisaxe-executed-root-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const git = (args, input) => execFileSync('git', ['-c', 'core.fsmonitor=false', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { cwd: directory, input, encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  git(['init', '--quiet', '--bare']);
  const reviewed = 'name: Cadence full\non: [push]\njobs:\n  admission:\n    steps:\n      - run: node /protected/admission.mjs\n  test:\n    needs: [admission]\n    steps:\n      - run: npm test\n      - run: node /protected/measurement.mjs\n';
  const calleePath = '.github/workflows/ci.yml';
  const callee = git(['hash-object', '-w', '--stdin'], 'name: Protected callee\non: [workflow_call]\njobs:\n  lint:\n    steps:\n      - run: npm run lint\n');
  const commit = (caller, app, parent) => {
    const callerBlob = git(['hash-object', '-w', '--stdin'], caller);
    const appBlob = git(['hash-object', '-w', '--stdin'], app);
    const workflows = git(['mktree'], `100644 blob ${callerBlob}\tci-nightly.yml\n100644 blob ${callee}\tci.yml\n`);
    const github = git(['mktree'], `040000 tree ${workflows}\tworkflows\n`);
    const tree = git(['mktree'], `040000 tree ${github}\t.github\n100644 blob ${appBlob}\tapp.txt\n`);
    return git(['commit-tree', tree, ...(parent ? ['-p', parent] : [])], 'private executed-root fixture\n');
  };
  const before = commit(reviewed, 'app before\n');
  const hostile = reviewed.replace('npm test', 'echo fake-success').replace('node /protected/measurement.mjs', 'echo forged-checkout-and-measurement');
  const after = commit(variant === 'changed' ? hostile : reviewed, 'app after\n', before);
  const blobAt = (commitSha, path) => git(['rev-parse', `${commitSha}:${path}`]);
  const reviewedBlob = blobAt(before, workflow);
  const actualExpected = { ...expected, definitionSha: before, sourceSha: after };
  const actualPolicy = { ...policy, workflows: [{ ...policy.workflows[0], definitionSha: reviewedBlob }] };
  const actualProjection = { ...projection, workflowPins: { [workflow]: reviewedBlob, [calleePath]: callee }, workflowSources: { [workflow]: before, [calleePath]: before }, referencedWorkflows: [{ ...projection.referencedWorkflows[0], path: `juan294/paisaxe/.github/workflows/ci.yml@${before}`, sha: before }] };
  const run = { ...nativeRun(), event, conclusion, head_sha: event === 'push' ? after : before, head_branch: event === 'push' ? 'develop' : 'main', referenced_workflows: actualProjection.referencedWorkflows };
  const admit = { ...admission(), ...actualExpected, lane: event === 'push' ? 'full' : 'nightly', testedCheckoutSha: after, workflowDefinitionSha: reviewedBlob, workflowPins: actualProjection.workflowPins };
  const measured = { ...measurement(), ...actualExpected, checkouts: { 1: after, 2: after } };
  const f = fixture({ run, admit, measured, fetchImpl: async (url, options, row) => {
    const parsed = new URL(url);
    const prefix = `/repos/${repository}/contents/`;
    if (parsed.pathname.startsWith(prefix)) {
      const path = parsed.pathname.slice(prefix.length); const commitSha = parsed.searchParams.get('ref');
      if (commitSha === after && path === workflow && variant === 'unavailable') return new Response('unavailable', { status: 503, headers: { 'x-ratelimit-remaining': '950' } });
      const result = { type: 'file', path, sha: blobAt(commitSha, path) };
      if (commitSha === after && path === workflow && variant === 'wrong-blob') result.sha = callee;
      if (commitSha === after && path === workflow && variant === 'wrong-path') result.path = calleePath;
      if (commitSha === after && path === workflow && variant === 'wrong-type') result.type = 'dir';
      return new Response(JSON.stringify(result), { headers: { 'x-ratelimit-remaining': '950' } });
    }
    return new Response(Buffer.isBuffer(row) ? row : JSON.stringify(row), { status: row === undefined ? 404 : 200, headers: { 'x-ratelimit-remaining': '950' } });
  } });
  return { ...f, before, after, reviewedBlob, executedBlob: blobAt(after, workflow), actualExpected, actualPolicy, actualProjection };
}
const executedHistory = f => f.reader.collectHistory({ workflow, expected: f.actualExpected, policy: f.actualPolicy, projection: f.actualProjection });
const executedDecision = (f, evidence) => chooseNightly(f.actualExpected, evidence, '2026-10-03T01:00:00Z', f.actualPolicy);

test('BAPI-PUSH-EXECUTED-ROOT: real app-only AFTER preserves BEFORE authority and reviewed executed root', async t => {
  const f = await executedRootFixture(t); const evidence = await executedHistory(f); const decision = executedDecision(f, evidence);
  assert.notEqual(f.before, f.after); assert.equal(f.executedBlob, f.reviewedBlob);
  assert.equal(evidence.available, true); assert.equal(evidence.complete, true); assert.equal(decision.action, 'skip'); assert.equal(decision.publishCoverage, false);
  assert.equal(evidence.receipts[0].definitionSha, f.before); assert.equal(evidence.receipts[0].nativeHeadSha, f.after); assert.equal(evidence.receipts[0].sourceSha, f.after);
  assert.ok(f.requests.some(row => row.url.endsWith(`/contents/${workflow}?ref=${f.before}`)));
  assert.ok(f.requests.some(row => row.url.endsWith(`/contents/${workflow}?ref=${f.after}`)));
  assert.ok(f.requests.some(row => row.url.endsWith(`/contents/.github/workflows/ci.yml?ref=${f.before}`)));
});
for (const variant of ['changed', 'unavailable', 'wrong-blob', 'wrong-path', 'wrong-type']) test(`BAPI-PUSH-EXECUTED-ROOT: ${variant} actual AFTER caller cannot authenticate uploader claims`, async t => {
  const f = await executedRootFixture(t, variant); const evidence = await executedHistory(f); const decision = executedDecision(f, evidence);
  assert.equal(evidence.available, false); assert.equal(evidence.complete, false); assert.equal(evidence.receipts.length, 0); assert.equal(decision.action, 'full'); assert.equal(decision.publishCoverage, false);
  assert.ok(f.requests.some(row => row.url.endsWith(`/contents/${workflow}?ref=${f.after}`)));
  assert.equal(f.requests.some(row => row.url.includes('/artifacts')), false);
  if (variant === 'changed') assert.notEqual(f.executedBlob, f.reviewedBlob);
});
test('BAPI-PUSH-EXECUTED-ROOT: default schedule still authenticates its actual protected-definition head', async t => {
  const f = await executedRootFixture(t, 'app-only', 'schedule'); const evidence = await executedHistory(f); const decision = executedDecision(f, evidence);
  assert.equal(evidence.available, true); assert.equal(evidence.complete, true); assert.equal(decision.action, 'skip'); assert.equal(decision.publishCoverage, false);
  assert.equal(evidence.receipts[0].definitionSha, f.before); assert.equal(evidence.receipts[0].nativeHeadSha, f.before); assert.equal(evidence.receipts[0].sourceSha, f.after);
  assert.equal(f.requests.some(row => row.url.endsWith(`/contents/${workflow}?ref=${f.after}`)), false);
});
test('BAPI-PUSH-EXECUTED-ROOT: reviewed app-only AFTER retains authenticated failed-push blocking', async t => {
  const f = await executedRootFixture(t, 'app-only', 'push', 'failure'); const evidence = await executedHistory(f); const decision = executedDecision(f, evidence);
  assert.equal(evidence.receipts[0].kind, 'native-failure-evidence'); assert.equal(evidence.receipts[0].definitionSha, f.before); assert.equal(evidence.receipts[0].nativeHeadSha, f.after);
  assert.equal(decision.action, 'blocked'); assert.equal(decision.publishCoverage, false);
});

for (const [label, remaining] of [['unsafe integer', '9007199254740992'], ['infinite conversion', '9'.repeat(400)]]) test(`BAPI-QUOTA: ${label} artifact redirect never starts storage GET`, async () => {
  const location = 'https://productionresultssa1.blob.core.windows.net/fixture/archive.zip';
  const f = fixture({ override: { '/repos/juan294/paisaxe/actions/artifacts/10/zip': new Response(null, { status: 302, headers: { location, 'x-ratelimit-remaining': remaining } }) } });
  const evidence = await history(f);
  assert.equal(evidence.complete, false); assert.deepEqual(evidence.receipts, []);
  assert.equal(f.requests.some(row => row.url === location), false);
  assert.equal(f.requests.at(-1).url.endsWith('/artifacts/10/zip'), true);
  assert.equal(nightly(evidence).action, 'full'); assert.equal(nightly(evidence).publishCoverage, false);
});

// B native numeric/account joins are independent of caller policy and artifacts.
const nativeIdentityMutations = [
  ['renamed repository numeric identity', run => { run.repository.id = 7; run.head_repository.id = 7; }],
  ['missing repository owner', run => { delete run.repository.owner; }],
  ['missing head repository owner', run => { delete run.head_repository.owner; }],
  ['owner login with foreign ID', run => { run.repository.owner.id = 8; }],
  ['head owner login with foreign ID', run => { run.head_repository.owner.id = 8; }],
  ['owner ID with different login', run => { run.repository.owner.login = 'outsider'; }],
  ['actor owner login with foreign ID', run => { run.actor.id = 8; }],
  ['actor owner ID with different login', run => { run.actor.login = 'outsider'; }],
  ['actor bot type', run => { run.actor.type = 'Bot'; }],
  ['actor missing ID', run => { delete run.actor.id; }],
  ['actor missing type', run => { delete run.actor.type; }],
  ['actor integration account', run => { run.actor.type = 'Organization'; }],
  ['repository default conflict', run => { run.repository.default_branch = 'develop'; }],
  ['same named fork', run => { run.head_repository.fork = true; }],
  ['triggering actor foreign ID', run => { run.triggering_actor = { login: 'juan294', id: 8, type: 'User' }; }],
  ['triggering actor bot', run => { run.triggering_actor = { login: 'juan294', id: 3944118, type: 'Bot' }; }],
];
for (const [label, change] of nativeIdentityMutations) test(`BAPI-NUMERIC: ${label} cannot authenticate receipt or failure`, async () => {
  for (const conclusion of ['success', 'failure']) {
    const run = nativeRun(); run.conclusion = conclusion; change(run);
    const f = fixture({ run }); const evidence = await history(f); const decision = nightly(evidence);
    assert.equal(evidence.complete, false, label); assert.equal(evidence.receipts.length, 0, label);
    assert.equal(decision.action, 'full'); assert.equal(decision.publishCoverage, false);
    assert.equal(f.requests.some(r => r.url.includes('/artifacts')), false);
  }
});
test('BAPI-NUMERIC: real owner/User numeric identity and optional authenticated rerun actor preserve receipt', async () => {
  const run = nativeRun(); run.triggering_actor = { login: 'juan294', id: 3944118, type: 'User' };
  const f = fixture({ run }); const evidence = await history(f); const decision = nightly(evidence);
  assert.equal(evidence.complete, true); assert.equal(decision.action, 'skip');
  assert.equal(evidence.receipts[0].repository, 'juan294/paisaxe');
  assert.equal(f.requests.some(r => r.url.includes('spoken-letter')), false);
});
test('BAPI-NUMERIC: protected owner policy cannot expand native author trust', async () => {
  const f = fixture(); const evidence = await f.reader.collectHistory({ workflow, expected, policy: { ...policy, owners: ['juan294', 'outsider'] }, projection });
  const decision = nightly(evidence); assert.equal(evidence.complete, false); assert.equal(evidence.receipts.length, 0);
  assert.equal(decision.action, 'full'); assert.equal(f.requests.length, 0);
});

test('BAPI-NUMERIC: API minimal repositories retain required numeric owner proof without optional expanded fields', async () => {
  const run = nativeRun();
  for (const repo of [run.repository, run.head_repository]) { delete repo.default_branch; delete repo.fork; delete repo.owner.type; }
  const evidence = await history(fixture({ run }));
  assert.equal(evidence.complete, true); assert.equal(nightly(evidence).action, 'skip');
});
for (const [field, value] of [['default_branch', null], ['fork', null], ['fork', 'false']]) test(`BAPI-NUMERIC: supplied invalid optional metadata ${field}/${String(value)} cannot authenticate`, async () => {
  const run = nativeRun(); run.head_repository[field] = value;
  const f = fixture({ run }); const evidence = await history(f); const decision = nightly(evidence);
  assert.equal(evidence.complete, false); assert.equal(evidence.receipts.length, 0); assert.equal(decision.action, 'full');
});
for (const actor of [null, {}, { login: 'outsider', id: 8, type: 'User' }]) test(`BAPI-NUMERIC: incomplete or foreign triggering actor ${JSON.stringify(actor)} rejects`, async () => {
  const f = fixture({ run: { ...nativeRun(), triggering_actor: actor } }); const evidence = await history(f); const decision = nightly(evidence);
  assert.equal(evidence.complete, false); assert.equal(evidence.receipts.length, 0); assert.equal(decision.action, 'full');
});
test('BAPI-NUMERIC: foreign native repository and matching artifact IDs cannot substitute fixed B numeric identity', async () => {
  const run = nativeRun(); run.repository.id = 7; run.head_repository.id = 7;
  const f = fixture({ run }); assert.equal(f.artifacts[0].workflow_run.head_repository_id, 7);
  const evidence = await history(f); const decision = nightly(evidence);
  assert.equal(evidence.complete, false); assert.equal(evidence.receipts.length, 0); assert.equal(decision.action, 'full');
  assert.equal(f.requests.length, 2); assert.equal(f.requests.some(r => r.url.includes('/artifacts')), false);
});


// Only native GET responses and the clock are fixtures; chronology decisions use
// the real collector, ZIP artifact parser and frozen nightly helper.
const chronologyCases = [
  ['future-parent-end', jobs => { for (const job of jobs) job.completed_at = '2099-01-01T00:00:00Z'; }],
  ['app-before-job-start', jobs => { jobs.find(job => job.name === 'Test').started_at = '2026-10-02T01:02:00Z'; }],
  ['upload-before-producer-start', jobs => { jobs.find(job => job.name === 'Cadence admission').started_at = '2026-10-02T00:26:00Z'; }],
  ['missing-parent-start', jobs => { delete jobs.find(job => job.name === 'Test').started_at; }],
  ['invalid-calendar-parent-start', jobs => { jobs.find(job => job.name === 'Lint').started_at = '2026-02-30T00:30:00Z'; }],
  ['reversed-parent-interval', jobs => { jobs.find(job => job.name === 'Lint').started_at = '2026-10-02T01:01:00Z'; }],
  ['missing-parent-completion', jobs => { delete jobs.find(job => job.name === 'Lint').completed_at; }],
];
for (const [label, change] of chronologyCases) test(`BAPI-NATIVE-TIME: ${label} cannot authenticate successful reuse`, async () => {
  const jobs = [nativeJob(1, 'Lint'), nativeJob(2, 'Test'), nativeJob(3, 'Cadence admission')]; change(jobs);
  const f = fixture({ jobs }); const evidence = await history(f); const decision = nightly(evidence);
  assert.equal(evidence.complete, false); assert.deepEqual(evidence.receipts, []);
  assert.equal(decision.action, 'full'); assert.equal(decision.publishCoverage, false);
  assert.equal(f.requests.every(row => row.options.method === 'GET'), true);
});
for (const label of ['future-parent', 'start-after-upload', 'missing-parent-start']) test(`BAPI-NATIVE-TIME: separate measurement ${label} cannot authenticate checkout`, async () => {
  const producer = nativeJob(4, 'Measurement artifact');
  producer.started_at = at; producer.completed_at = '2026-10-02T01:05:00Z';
  producer.steps = [{ number: 1, name: 'Upload measurement', status: 'completed', conclusion: 'success', started_at: at, completed_at: producer.completed_at }];
  if (label === 'future-parent') producer.completed_at = '2099-01-01T00:00:00Z';
  if (label === 'start-after-upload') producer.started_at = '2026-10-02T01:06:00Z';
  if (label === 'missing-parent-start') delete producer.started_at;
  const f = fixture({ jobs: [nativeJob(1, 'Lint'), nativeJob(2, 'Test'), nativeJob(3, 'Cadence admission'), producer] });
  const evidence = await f.reader.collectHistory({ workflow, expected, policy, projection: { ...projection, measurementJob: 'Measurement artifact' } });
  assert.equal(evidence.complete, false); assert.deepEqual(evidence.receipts, []);
  assert.equal(nightly(evidence).action, 'full'); assert.equal(nightly(evidence).publishCoverage, false);
});
for (const label of ['missing-start', 'future-end', 'reversed']) test(`BAPI-NATIVE-TIME: incoherent admission ${label} cannot claim a known failed identity`, async () => {
  const jobs = [nativeJob(1, 'Lint', 'failure'), nativeJob(2, 'Test'), nativeJob(3, 'Cadence admission')];
  if (label === 'missing-start') delete jobs[2].started_at;
  if (label === 'future-end') jobs[2].completed_at = '2099-01-01T00:00:00Z';
  if (label === 'reversed') jobs[2].started_at = '2026-10-02T00:26:00Z';
  const evidence = await history(failedFixture({ jobs }));
  assert.equal(evidence.complete, false); assert.deepEqual(evidence.receipts, []);
  assert.equal(nightly(evidence).action, 'full'); assert.equal(nightly(evidence).publishCoverage, false);
});
for (const label of ['missing-sibling-start', 'future-sibling-end', 'invalid-failed-parent']) test(`BAPI-NATIVE-TIME: ${label} preserves authenticated required failure with honest fallback time`, async () => {
  const jobs = [nativeJob(1, 'Lint'), nativeJob(2, 'Test'), nativeJob(3, 'Cadence admission')]; jobs[1].steps[0].conclusion = 'failure';
  if (label === 'missing-sibling-start') delete jobs[0].started_at;
  if (label === 'future-sibling-end') jobs[0].completed_at = '2099-01-01T00:00:00Z';
  if (label === 'invalid-failed-parent') jobs[1].started_at = '2026-10-02T01:06:00Z';
  const evidence = await history(fixture({ jobs })); assertBlockedFailure(evidence, 'malformed native timing cannot erase authenticated failure');
  assert.equal(evidence.receipts[0].failureTimeSource, 'admission-uploader');
  assert.equal(evidence.receipts[0].completedAt, '2026-10-02T00:25:00.000Z');
  assert.equal(evidence.receipts[0].observedFailure.stepName, 'Execute Test');
});
test('BAPI-NATIVE-TIME: equal parent/step boundaries and observed clock preserve original app completion', async () => {
  const jobs = [nativeJob(1, 'Lint'), nativeJob(2, 'Test'), nativeJob(3, 'Cadence admission')];
  for (const job of jobs) { job.started_at = job.steps[0].started_at; job.completed_at = job.steps.at(-1).completed_at; }
  const f = fixture({ jobs, now: () => new Date('2026-10-02T01:05:00Z') }); const evidence = await history(f);
  assert.equal(evidence.complete, true); assert.equal(evidence.receipts.length, 1);
  assert.equal(evidence.receipts[0].completedAt, '2026-10-02T01:00:00.000Z');
  assert.equal(nightly(evidence).action, 'skip');
});
test('BAPI-NATIVE-TIME: observation clock is sampled once for one native attempt', async () => {
  let samples = 0; const f = fixture({ now: () => { samples++; return new Date('2026-10-03T01:00:00Z'); } });
  const evidence = await history(f); assert.equal(evidence.complete, true); assert.equal(samples, 1);
});
test('BAPI-NATIVE-TIME: invalid observation clock cannot authenticate admission or reuse', async () => {
  const evidence = await history(fixture({ now: () => new Date(NaN) }));
  assert.equal(evidence.complete, false); assert.deepEqual(evidence.receipts, []);
  assert.equal(nightly(evidence).action, 'full');
});

test('B integration current matching native run supplies authenticated in-progress evidence', async () => {
  const f = fixture({ run: { ...nativeRun(), status: 'in_progress', conclusion: null } });
  const result = await read(f);
  assert.equal(result.receipt, undefined);
  assert.equal(result.knownRunning?.kind, 'native-running-evidence');
  assert.equal(result.knownRunning?.runId, 123);
  const h = await history(f);
  assert.equal(h.receipts.some(row => row.kind === 'native-running-evidence'), true);
});

test('B integration successful measurement survives authenticated artifact parsing for finalizer', async () => {
  const measured = { ...measurement(), metrics: { testCount: 2, testFiles: 1, passed: 2, failed: 0, coverage: 100 } };
  const result = await read(fixture({ measured }));
  assert.deepEqual(result.measurement, measured);
});

test('B protected complete census admits only reviewed non-app skipped helper jobs',async()=>{
 const auxiliary={id:4,run_id:123,run_attempt:1,name:'callable-source-helper',status:'completed',conclusion:'skipped',steps:[]};
 const p={...projection,census:{schemaVersion:1,profile:'nightly',auxiliaryJobs:[{name:auxiliary.name,conclusions:['skipped'],steps:[]}]}};
 const f=fixture({jobs:[nativeJob(1,'Lint'),nativeJob(2,'Test'),nativeJob(3,'Cadence admission'),auxiliary]});
 const r=await read(f,{projection:p});assert.equal(r.available,true);assert.equal(r.receipt.conclusion,'success');
});

for (const fault of ['app-collision', 'unknown-job', 'failed-helper', 'failed-helper-step']) test('B reviewed helper census rejects '+fault, async () => {
  const helper = { id: 4, run_id: 123, run_attempt: 1, name: 'Readonly helper', status: 'completed', conclusion: 'success', steps: [] };
  const census = { schemaVersion: 1, profile: 'nightly', auxiliaryJobs: [{ name: helper.name, conclusions: ['success'], steps: [] }] };
  if (fault === 'app-collision') census.auxiliaryJobs[0].name = 'Lint';
  if (fault === 'unknown-job') helper.name = 'Unreviewed helper';
  if (fault === 'failed-helper') helper.conclusion = 'failure';
  if (fault === 'failed-helper-step') helper.steps = [{ name: 'Hidden failed work', status: 'completed', conclusion: 'failure' }];
  const f = fixture({ jobs: [nativeJob(1, 'Lint'), nativeJob(2, 'Test'), nativeJob(3, 'Cadence admission'), helper] });
  const result = await read(f, { projection: { ...projection, census } });
  assert.equal(result.available, false); assert.equal(result.receipt, undefined);
});

for (const fault of ['none', 'missing-guard', 'missing-final-guard', 'failed-final-guard', 'failed-child', 'wrong-attempt']) test('actual admitted measurement inputs '+fault, async () => {
 const run = { ...nativeRun(), status: 'in_progress', conclusion: null };
 const jobs = [nativeJob(1, 'Lint'), nativeJob(2, 'Test'), nativeJob(3, 'Cadence admission')];
 for (const job of jobs.slice(0, 2)) { for (const step of job.steps) step.number++; job.steps.unshift({ number: 1, name: 'Verify callable source checkout', status: 'completed', conclusion: 'success', started_at: job.started_at, completed_at: job.started_at });job.steps.push({number:job.steps.length+1,name:'Verify completed callable source checkout',status:'completed',conclusion:'success',started_at:job.completed_at,completed_at:job.completed_at}); }
 const projected = { ...projection, ignoredSteps: Object.fromEntries(Object.entries(projection.ignoredSteps).map(([id, names]) => [id, names.concat('Verify callable source checkout','Verify completed callable source checkout')])) };
 if (fault === 'missing-guard') jobs[0].steps.shift();
 if (fault === 'missing-final-guard') jobs[0].steps.pop();
 if (fault === 'failed-final-guard') jobs[0].steps.at(-1).conclusion='failure';
 if (fault === 'failed-child') jobs[0].conclusion = 'failure';
 if (fault === 'wrong-attempt') jobs[0].run_attempt = 2;
 const f = fixture({ run, jobs }); const result = await f.reader.readMeasurementInputs({ expected, policy, projection: projected, runId: 123, attempt: 1 });
 assert.equal(result.available, fault === 'none'); assert.equal(result.receipt, undefined);
 if (fault === 'none') { assert.equal(result.scope, 'measurement-inputs'); assert.deepEqual(result.checkouts, { 1: expected.sourceSha, 2: expected.sourceSha }); }
});

test('authenticated admission archive is only an untrusted lookup hint, never a receipt', async () => {
 const f = fixture(); const result = await f.reader.readAdmissionHint({ runId: 123, attempt: 1, workflow });
 assert.equal(result.available, true); assert.equal(result.trusted, false); assert.equal(result.kind, 'untrusted-admission-hint'); assert.equal(result.receipt, undefined);
});
for (const pointer of [{ runId: 0, attempt: 1, workflow }, { runId: 123, attempt: 4, workflow }, { runId: 123, attempt: 1, workflow: '.github/workflows/hostile.yml' }]) test('invalid admission hint pointer fails before transport '+JSON.stringify(pointer), async () => {
 const f = fixture(); assert.equal((await f.reader.readAdmissionHint(pointer)).available, false); assert.equal(f.requests.length, 0);
});

test('history excludes only its independently authenticated original current in-progress admission attempt',async()=>{
 const run={...nativeRun(),status:'in_progress',conclusion:null};
 const f=fixture({run,override:{'/repos/juan294/paisaxe/actions/runs/123/artifacts?per_page=100&page=1':{total_count:0,artifacts:[]}}});
 const result=await f.reader.collectHistory({expected,policy,projection,workflow,runId:123,attempt:1});
 assert.equal(result.complete,true);assert.deepEqual(result.receipts,[]);
 assert.equal(f.requests.some(r=>r.url.includes('/artifacts')),false);
});

for(const fault of ['completed','wrong-attempt','nonowner'])test('self-history exception fails closed '+fault,async()=>{
 const run={...nativeRun(),status:'in_progress',conclusion:null};
 if(fault==='completed'){run.status='completed';run.conclusion='success';}
 if(fault==='nonowner')run.actor.id=7;
 const f=fixture({run,override:{'/repos/juan294/paisaxe/actions/runs/123/artifacts?per_page=100&page=1':{total_count:0,artifacts:[]}}});
 const r=await f.reader.collectHistory({expected,policy,projection,workflow,runId:123,attempt:fault==='wrong-attempt'?2:1});
 assert.equal(r.complete,false);assert.deepEqual(r.receipts,[]);
});
