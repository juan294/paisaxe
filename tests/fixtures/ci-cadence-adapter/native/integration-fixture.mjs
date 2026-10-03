import { createHash } from 'node:crypto';
import { createGitHubCadenceReader } from '../../../../scripts/ci-cadence-github.mjs';
const repository = 'juan294/paisaxe';
const sha = value => value.repeat(40);
const workflow = '.github/workflows/ci-nightly.yml';
const expected = { repository, sourceSha: sha('a'), targetBranch: 'develop', definitionSha: sha('b'), policyFingerprint: 'policy:1', helperFingerprint: 'helper:1', lockfileFingerprint: 'lock:1', runtimeFingerprint: 'node24/npm11/linux' };
const policy = { schemaVersion: 1, repository, defaultBranch: 'main', integrationBranch: 'develop', productionBranch: 'main', owners: ['juan294'], refreshHours: 168, coverageMaxAgeHours: 192, changedHeadDeadlineHours: 36, workflows: [{ path: workflow, definitionSha: sha('c'), jobs: [{ id: 'lint', needs: [] }, { id: 'test', needs: ['lint'] }], contexts: { Lint: ['lint'], Test: ['test'] } }] };
const projection = { kind: 'full', jobs: { lint: 'Lint', test: 'Test' }, workflowPins: { [workflow]: sha('c'), '.github/workflows/ci.yml': sha('d') }, admissionJob: 'Cadence admission', admissionStep: 'Execute Cadence admission', measurementJob: 'Test', measurementStep: 'Upload measurement', workflowSources: { [workflow]: sha('b'), '.github/workflows/ci.yml': sha('b') }, referencedWorkflows: [{ path: 'juan294/paisaxe/.github/workflows/ci.yml@refs/heads/main', sha: sha('b'), ref: 'refs/heads/main' }], steps: { lint: ['Execute Lint'], test: ['Execute Test'] }, ignoredSteps: { lint: ['Complete job'], test: ['Complete job', 'Upload measurement'] } };
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
    return new Response(Buffer.isBuffer(row) ? row : JSON.stringify(row), { headers: { 'x-ratelimit-remaining': '4000' } });
  };
  return { fetchImpl: mock, reader: createGitHubCadenceReader({ token: 'fixture-secret-token', fetchImpl: mock, limits, now }), requests, routes, artifacts, bodies };
}

export { fixture, expected, policy, projection, nativeRun, nativeJob, admission, measurement, zip };
