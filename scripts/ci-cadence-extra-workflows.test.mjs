import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { parse } from 'yaml';
import { canonicalSource } from './ci-cadence-route-originals.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const modulePath = join(root, 'scripts/ci-cadence-extra-workflows.mjs');
const implementation = existsSync(modulePath) ? await import('./ci-cadence-extra-workflows.mjs') : null;
const baselinePath = 'tests/fixtures/ci-cadence-adapter/native/extra-workflow-baselines.json';
const baseline = JSON.parse(readFileSync(join(root, baselinePath), 'utf8'));
const definitions = [
  ['bundle-size', 'analyze', 'Analyze Bundle Size'],
  ['knip', 'knip', 'Knip Dead Code Analysis'],
  ['license-check', 'license-check', 'License Compliance Check'],
];
const outputPath = slug => `.github/workflows/ci-cadence-${slug}-full.yml`;
function current(slug) {
  const path = join(root, outputPath(slug));
  return existsSync(path) ? parse(readFileSync(path, 'utf8')) : null;
}
function expression(value, context = {}) {
  const code = value.replace(/^\$\{\{\s*|\s*\}\}$/g, '').replace(/needs\.([a-zA-Z][a-zA-Z0-9_-]*)/g, (_, id) => `needs[${JSON.stringify(id)}]`);
  return vm.runInNewContext(code, { always: () => true, format: (pattern, ...args) => pattern.replace(/\{(\d+)\}/g, (_, n) => args[Number(n)]), ...context }, { timeout: 100 });
}
function shell(step, env, cwd = root) {
  return spawnSync('/bin/bash', ['-c', step.run], { env: { ...process.env, ...env }, cwd, encoding: 'utf8', timeout: 5000 });
}
const validEnv = change => ({ GITHUB_REPOSITORY: 'juan294/paisaxe', REPOSITORY_ID: '1141286326', OWNER_ID: '3944118', DEFAULT_BRANCH: 'main', SOURCE_SHA: 'a'.repeat(40), PROFILE: 'full', INVOCATION_ID: 'bundle_full', ...change });
function isolatedRoot(t) {
  const path = mkdtempSync(join(tmpdir(), 'paisaxe-generated-callees-'));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  for (const file of [...baseline.files.map(f => f.path), baselinePath,'scripts/ci-cadence-native.mjs']) {
    mkdirSync(dirname(join(path, file)), { recursive: true });
    writeFileSync(join(path, file), readFileSync(join(root, file)));
  }
  return path;
}

test('all three exact original workflows bind independently pinned source bytes', () => {
  assert.equal(baseline.schemaVersion, 1);
  assert.deepEqual(baseline.files.map(f => f.path), definitions.map(([slug]) => `.github/workflows/${slug}.yml`));
  for (const file of baseline.files) {
    assert.equal(createHash('sha256').update(file.source).digest('hex'), file.sha256);
    assert.equal(canonicalSource(root,file.path,file.source),file.source);
  }
});
for (const [slug, id, name] of definitions) {
  test(`${slug} generated readonly full definition has exact app context and complete narrow inputs`, () => {
    const workflow = current(slug);
    assert.ok(workflow, 'required generated callee is absent');
    assert.deepEqual(Object.keys(workflow.on), ['workflow_call']);
    assert.deepEqual(Object.keys(workflow.on.workflow_call.inputs).sort(), ['invocation_id', 'profile', 'source_sha']);
    for (const input of Object.values(workflow.on.workflow_call.inputs)) assert.deepEqual(Object.keys(input).sort(), ['description', 'required', 'type']);
    for (const input of Object.values(workflow.on.workflow_call.inputs)) { assert.equal(input.type, 'string'); assert.equal(input.required, true); }
    assert.equal(workflow.on.workflow_call.secrets, undefined);
    assert.deepEqual(workflow.permissions, { contents: 'read' });
    assert.deepEqual(Object.keys(workflow.jobs), ['callable-source', id, 'callable-full']);
    assert.equal(workflow.jobs[id].name, name);
    for (const job of Object.values(workflow.jobs)) { assert.deepEqual(job.permissions, { contents: 'read' }); assert.equal(job['runs-on'], 'ubuntu-latest'); assert.equal(job.environment, undefined); }
  });
  test(`${slug} parsed app body equals canonical work except exact checkout and bundle publication transforms`, () => {
    const workflow = current(slug); assert.ok(workflow);
    const original = parse(baseline.files.find(f => f.path.endsWith(`/${slug}.yml`)).source).jobs[id];
    const app = workflow.jobs[id];
    assert.equal(app['timeout-minutes'], original['timeout-minutes']);
    const steps = structuredClone(app.steps).filter(s => !['Verify callable source checkout','Verify completed callable source checkout'].includes(s.name));
    const originalSteps = original.steps.filter(s => s.name !== 'Comment on PR');
    steps[0] = structuredClone(originalSteps[0]);
    assert.deepEqual(steps, originalSteps);
    assert.deepEqual(app.needs, ['callable-source']);
    assert.equal(expression(app.if, { needs: { 'callable-source': { result: 'success' } } }), true);
    for (const result of ['failure', 'skipped', 'cancelled']) assert.equal(expression(app.if, { needs: { 'callable-source': { result } } }), false);
  });
  test(`${slug} source and physical checkout guards execute actual shell before any candidate work`, t => {
    const workflow = current(slug); assert.ok(workflow);
    const path = mkdtempSync(join(tmpdir(), 'paisaxe-callee-head-'));
    t.after(() => rmSync(path, { recursive: true, force: true }));
    const git = (...args) => execFileSync('git', ['-c', 'core.fsmonitor=false', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { cwd: path, encoding: 'utf8', timeout: 5000 }).trim();
    git('init', '--quiet', '--template=');
    const sha = git('commit-tree', git('mktree'), '-m', 'actual fixture commit');
    git('checkout', '--detach', '--quiet', sha);
    const [checkout, guard] = workflow.jobs[id].steps;
    assert.equal(checkout.uses, 'actions/checkout@v7');
    assert.deepEqual(checkout.with, { 'fetch-depth': 0, ref: '${{ inputs.source_sha }}', 'persist-credentials': false });
    assert.equal(guard.name, 'Verify callable source checkout');
    assert.equal(shell(guard, { SOURCE_SHA: sha }, path).status, 0);
    assert.equal(shell(guard, { SOURCE_SHA: 'b'.repeat(40) }, path).status, 1);
  });
  test(`${slug} full aggregate uses every actual prerequisite and rejects nonsuccess`, () => {
    const workflow = current(slug); assert.ok(workflow);
    const full = workflow.jobs['callable-full'];
    assert.deepEqual(full.needs, ['callable-source', id]);
    assert.equal(expression(full.if), true);
    const step = full.steps[0];
    assert.equal(step.env.SOURCE_RESULT, '${{ needs.callable-source.result }}');
    assert.equal(step.env.APP_RESULT, `\${{ needs.${id}.result }}`);
    assert.equal(shell(step, { SOURCE_RESULT: 'success', APP_RESULT: 'success' }).status, 0);
    for (const key of ['SOURCE_RESULT', 'APP_RESULT']) for (const result of ['failure', 'skipped', 'cancelled', '']) assert.equal(shell(step, { SOURCE_RESULT: 'success', APP_RESULT: 'success', [key]: result }).status, 1);
  });
  test(`${slug} concurrency isolates literal callee, actual run, attempt, and invocation without cancellation`, () => {
    const workflow = current(slug); assert.ok(workflow);
    const context = { github: { run_id: '42', run_attempt: '1', event_name: 'push', workflow: 'Nightly' }, inputs: { invocation_id: 'ci_full' } };
    const group = expression(workflow.concurrency.group, context);
    assert.equal(group, `paisaxe-${slug}-full-42-1-ci_full`);
    for (const [key, value] of [['run_id', '43'], ['run_attempt', '2']]) assert.notEqual(expression(workflow.concurrency.group, { ...context, github: { ...context.github, [key]: value } }), group);
    assert.notEqual(expression(workflow.concurrency.group, { ...context, inputs: { invocation_id: 'ci_full-2' } }), group);
    assert.equal(workflow.concurrency['cancel-in-progress'], false);
  });
}
test('bundle removes static PR write grant and only comment publication, never the blocking budget', () => {
  const original = parse(baseline.files[0].source);
  const workflow = current('bundle-size') ?? original;
  assert.equal(workflow.jobs.analyze.permissions['pull-requests'], undefined);
  assert.ok(workflow.jobs.analyze.steps.some(s => s.run === 'npm run check-bundle-budget'));
  assert.ok(!workflow.jobs.analyze.steps.some(s => s.name === 'Comment on PR' || s.uses?.startsWith('actions/github-script@')));
});
for (const change of [{ SOURCE_SHA: '' }, { SOURCE_SHA: '0'.repeat(40) }, { SOURCE_SHA: 'A'.repeat(40) }, { SOURCE_SHA: 'b'.repeat(39) }, { SOURCE_SHA: 'refs/heads/main' }, { PROFILE: '' }, { PROFILE: 'fast' }, { INVOCATION_ID: '' }, { INVOCATION_ID: 'x'.repeat(65) }, { INVOCATION_ID: 'x.y' }, { INVOCATION_ID: 'x/y' }, { INVOCATION_ID: '$(echo forged)' }, { INVOCATION_ID: 'é' }, { REPOSITORY_ID: '2' }, { OWNER_ID: '8' }, { DEFAULT_BRANCH: 'develop' }, { GITHUB_REPOSITORY: 'outsider/paisaxe' }]) test(`actual input shell rejects ${JSON.stringify(change)}`, () => {
  const workflow = current('knip'); assert.ok(workflow);
  assert.equal(shell(workflow.jobs['callable-source'].steps[0], validEnv(change)).status, 1);
});
test('actual input validator accepts full/nightly with bounded ASCII boundary identifiers', () => {
  for (const [slug] of definitions) {
    const workflow = current(slug); assert.ok(workflow);
    for (const profile of ['full', 'nightly']) assert.equal(shell(workflow.jobs['callable-source'].steps[0], validEnv({ PROFILE: profile, INVOCATION_ID: 'x'.repeat(64) })).status, 0);
  }
});
test('generator deterministically reproduces only the three complete current callees', () => {
  assert.ok(implementation);
  const generated = implementation.generateExtraWorkflows(root);
  assert.deepEqual(generated.map(f => f.path), definitions.map(([slug]) => outputPath(slug)));
  assert.deepEqual(implementation.generateExtraWorkflows(root), generated);
  for (const file of generated) assert.equal(canonicalSource(root,file.path,file.source),file.source);
});
for (const change of ['missing', 'command', 'context', 'unknown-job', 'permissions', 'baseline-hash', 'baseline-body', 'baseline-extra']) test(`generator rejects ${change} canonical authority drift before output`, t => {
  assert.ok(implementation);
  const fixture = isolatedRoot(t); const canonical = join(fixture, baseline.files[0].path);
  if (change === 'missing') rmSync(canonical);
  else if (change.startsWith('baseline-')) {
    const copy = JSON.parse(readFileSync(join(fixture, baselinePath), 'utf8'));
    if (change === 'baseline-hash') copy.files[0].sha256 = 'a'.repeat(64);
    if (change === 'baseline-body') { copy.files[0].source += '\n'; copy.files[0].sha256 = createHash('sha256').update(copy.files[0].source).digest('hex'); }
    if (change === 'baseline-extra') copy.files.push({ ...copy.files[0], path: '.github/workflows/security.yml' });
    writeFileSync(join(fixture, baselinePath), JSON.stringify(copy));
  } else {
    const source = readFileSync(canonical, 'utf8');
    const modified = change === 'command' ? source.replace('npm run check-bundle-budget', 'echo fake-success') : change === 'context' ? source.replace('Analyze Bundle Size', 'Auxiliary') : change === 'unknown-job' ? `${source}\n  unknown:\n    runs-on: ubuntu-latest\n    steps: [{run: echo fake}]\n` : source.replace('pull-requests: write', 'id-token: write');
    writeFileSync(canonical, modified);
  }
  assert.throws(() => implementation.generateExtraWorkflows(fixture));
  assert.ok(!existsSync(join(fixture, outputPath('bundle-size'))));
});
test('CLI check fails missing/modified generated bytes without writing, and write generates exact bytes', t => {
  assert.ok(implementation);
  const fixture = isolatedRoot(t);
  const invoke = (...args) => spawnSync(process.execPath, [modulePath, ...args], { cwd: fixture, encoding: 'utf8', timeout: 5000 });
  assert.equal(invoke('--check').status, 1);
  assert.ok(!existsSync(join(fixture, outputPath('bundle-size'))));
  assert.equal(invoke().status, 0);
  assert.equal(invoke('--check').status, 0);
  const generated = join(fixture, outputPath('knip')); writeFileSync(generated, readFileSync(generated, 'utf8') + '\n');
  assert.equal(invoke('--check').status, 1);
  assert.ok(readFileSync(generated, 'utf8').endsWith('\n\n'));
  assert.equal(invoke('--unknown').status, 1);
});
test('CLI refuses symlink output before writing any generated file or unrelated target', t => {
  assert.ok(implementation);
  const fixture = isolatedRoot(t);
  const marker = join(fixture, 'owned-unrelated-marker.txt');
  writeFileSync(marker, 'retain owned unrelated marker');
  symlinkSync(marker, join(fixture, outputPath('knip')));
  const result = spawnSync(process.execPath, [modulePath], { cwd: fixture, encoding: 'utf8', timeout: 5000 });
  const retained = readFileSync(marker, 'utf8');
  const earlierWritten = existsSync(join(fixture, outputPath('bundle-size')));
  assert.equal(result.status, 1, `Unexpected write result: ${result.stdout}`);
  assert.equal(retained, 'retain owned unrelated marker');
  assert.equal(earlierWritten, false);
});
