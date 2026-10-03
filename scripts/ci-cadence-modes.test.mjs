import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, chmodSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyEvent } from './ci-cadence.mjs';
import { evaluate, interpolate, workflow, startedJobs, nativeContext } from '../tests/fixtures/ci-cadence-adapter/native/workflow-graph.mjs';

// Activation order (plan "Activation"): install under legacy, establish a real
// CI Fast, migrate required checks, then set lean. GitHub bills every started
// job rounded up to a minute, so a routine lean owner event must start exactly
// one. These oracles evaluate the installed YAML job predicates over the frozen
// phase-1 events and execute the actual entry/recovery shell.
const root = new URL('../', import.meta.url);
const policy = JSON.parse(readFileSync(new URL('.github/ci-cadence.json', root), 'utf8'));
const FULL_CHILDREN = ['ci', 'e2e', 'lighthouse', 'bundle-size', 'knip', 'license-check', 'security'];
const FAST = 'ci-cadence.yml: CI Fast';
// Pre-cadence workflow bytes: the oracle for "every original job still runs".
const originals = Object.fromEntries(JSON.parse(readFileSync(new URL('tests/fixtures/ci-cadence-adapter/native/routing-originals.json', root), 'utf8')).files.map(file => [file.path.split('/').at(-1), file.source]));
// Automatic model review is outside Actions-minute cadence (plan matrix note);
// the owner bundle comment is the original comment step split into its own job.
const outside = job => job.startsWith('claude-review.yml: ');
const started = (event, mode, decision = 'skip') => startedJobs(nativeContext(event, mode), { 'ci-cadence.yml:entry': { decision } }).filter(job => !outside(job));
const original = (event, mode) => startedJobs(nativeContext(event, mode), {}, originals).filter(job => !outside(job) && !job.startsWith('ci-cadence') && !job.startsWith('ci-nightly'));
const routedOriginals = jobs => jobs.filter(job => !job.startsWith('ci-cadence') && !job.startsWith('ci-nightly') && job !== 'bundle-size.yml: Publish owner bundle comment');
const push = (ref = 'refs/heads/develop', actor) => ({ kind: 'push', ref, ...(actor ? { actor } : {}) });
const pull = (baseBranch = 'develop', change = {}) => ({ kind: 'pull_request', ref: 'refs/pull/7/merge', baseBranch, ...change });
const cadenceJob = id => workflow('ci-cadence.yml').jobs[id];

test('CI Fast is hosted, read-only, six-minute bounded and free of app install/build/deploy work', () => {
  const job = cadenceJob('entry'), source = JSON.stringify(job);
  assert.equal(job.name, 'CI Fast'); assert.equal(job.uses, undefined);
  assert.deepEqual(job.permissions, { contents: 'read' });
  assert.equal(job['runs-on'], 'ubuntu-latest'); assert.equal(job['timeout-minutes'], 6);
  for (const forbidden of ['secrets.', 'npm ci', 'npm install', 'npm run build', 'next build', 'vercel', 'supabase', 'playwright', 'self-hosted']) assert.ok(!source.includes(forbidden), forbidden);
  // The mode variable routes full-suite ownership only; it never gates the check itself.
  assert.doesNotMatch(job.if, /CI_CADENCE_MODE/);
  const on = workflow('ci-cadence.yml').on;
  for (const kind of ['push', 'pull_request']) { assert.deepEqual(on[kind].branches, ['develop']); assert.equal(on[kind]['paths-ignore'], undefined); assert.equal(on[kind].paths, undefined); }
});
test('bootstrap pins the exact protected launcher and always runs the four checks', () => {
  const step = cadenceJob('entry').steps.find(entry => entry.name === 'Acquire reviewed protected launcher');
  assert.equal(step.env.LAUNCHER_SHA256, createHash('sha256').update(readFileSync(new URL('scripts/ci-cadence-launch.mjs', root))).digest('hex'));
  assert.equal(step.env.CI_CADENCE_MODE, 'lean');
  // GitHub's `==` ignores case, so LEAN skips the routed workflows. The shell and
  // launcher compare exactly, so they receive the value normalised by that same `==`.
  for (const [mode, expected] of [['lean', 'lean'], ['LEAN', 'lean'], ['Lean', 'lean'], ['legacy', 'legacy'], ['', 'legacy'], [undefined, 'legacy'], ['leaner', 'legacy'], ['lean ', 'legacy']]) assert.equal(evaluate(step.env.ROUTING_MODE, nativeContext(push(), mode)), expected, String(mode));
  for (const name of ['ci-cadence.yml', 'ci-nightly.yml', 'ci-cadence-finalize.yml', 'coverage.yml']) assert.ok(!readFileSync(new URL('.github/workflows/' + name, root), 'utf8').includes('${{ vars.CI_CADENCE_MODE }}'), name);
  assert.match(step.run, /event\['before'\] if kind == 'push' else event\['pull_request'\]\['base'\]\['sha'\]/);
  assert.match(step.run, /required=\['commit-secret-scan','policy-validation','lockfile-validation','cadence-contracts'\]/);
  assert.ok(!step.run.includes('node scripts/'));
});
test('no routed workflow keeps a per-workflow classifier job or a dynamic routing output', () => {
  for (const entry of policy.workflows) { const definition = workflow(entry.path.split('/').at(-1)); assert.equal(definition.jobs['cadence-route'], undefined, entry.path); assert.ok(!JSON.stringify(definition).includes('run_legacy'), entry.path); }
});

for (const [label, event] of [['push', push()], ['PR', pull()]]) test(`lean owner ${label}: exactly one job starts a runner, and it is CI Fast`, () => {
  for (const mode of ['lean', 'LEAN', 'Lean']) assert.deepEqual(started(event, mode), [FAST], mode);
  // Unfiltered: the only other runner is the separately accounted model review on PRs.
  assert.deepEqual(startedJobs(nativeContext(event, 'lean'), { 'ci-cadence.yml:entry': { decision: 'skip' } }).filter(outside), label === 'PR' ? ['claude-review.yml: claude-review'] : []);
});
for (const [label, event] of [['push', push()], ['PR', pull()]]) for (const mode of ['legacy', undefined, null, 'leaner', 'lean ', '']) test(`legacy (${JSON.stringify(mode)}) owner ${label}: every original job still starts, plus CI Fast`, () => {
  const before = original(event, mode), jobs = started(event, mode);
  assert.ok(before.length >= 13, String(before.length));
  for (const required of ['ci.yml: Lint & Typecheck', 'ci.yml: Test', 'ci.yml: Build', 'e2e.yml: Playwright E2E']) assert.ok(before.includes(required), required);
  assert.deepEqual(routedOriginals(jobs), before);
  assert.deepEqual(jobs.filter(job => job.startsWith('ci-cadence')), [FAST]);
  // A full-required Fast result under legacy starts no duplicate recovery children.
  assert.deepEqual(started(event, mode, 'legacy'), jobs);
});
for (const [label, event] of [['push', push()], ['PR', pull()]]) test(`lean owner ${label} needing full validation starts every recovery child once and the recovery aggregate`, () => {
  const jobs = started(event, 'lean', 'full');
  assert.deepEqual(routedOriginals(jobs), []);
  for (const child of FULL_CHILDREN) assert.ok(jobs.some(job => job.startsWith(`ci-cadence.yml: ${child} / `)), child);
  assert.ok(jobs.includes(FAST)); assert.ok(jobs.includes('ci-cadence.yml: CI Fast recovery'));
  assert.equal(jobs.includes('ci-cadence.yml: Cadence admission'), label === 'push');
});
for (const [label, event] of [['production PR', pull('main')], ['production push', push('refs/heads/main')], ['outsider push', push('refs/heads/develop', 'outsider')], ['Dependabot PR', pull('develop', { actor: 'dependabot[bot]' })], ['fork PR', pull('develop', { headRepository: 'outsider/paisaxe' })], ['outsider-authored PR', pull('develop', { author: 'outsider' })], ['fork release PR', pull('main', { headRepository: 'outsider/paisaxe' })]]) for (const mode of ['lean', 'legacy']) test(`${mode} ${label}: full original graph regardless of mode, and never Fast`, () => {
  const jobs = started(event, mode), before = original(event, mode);
  assert.ok(before.length >= 5, String(before.length));
  assert.deepEqual(routedOriginals(jobs), before);
  // CI Fast is a required develop context, so it is decided for untrusted develop
  // events too (its entry step blocks them in lean, below). It never runs for main.
  const develop = event.ref === 'refs/heads/develop' || event.baseBranch === 'develop';
  assert.deepEqual(jobs.filter(job => job.startsWith('ci-cadence.yml: ')), develop ? [FAST] : []);
  if (event.baseBranch === 'main') assert.ok(jobs.includes('preview-smoke.yml: Release artifact smoke'));
});
test('CI Fast holds no secrets and a read-only token, so deciding untrusted events is safe', () => {
  const definition = workflow('ci-cadence.yml'), job = cadenceJob('entry');
  assert.deepEqual(job.permissions, { contents: 'read' });
  assert.ok(!JSON.stringify(job).includes('secrets.'));
  assert.equal(definition.on.pull_request_target, undefined);
  // Only base-branch bytes are executed: the launcher is read from the protected definition and digest-checked.
  const run = job.steps.find(step => step.name === 'Acquire reviewed protected launcher').run;
  assert.match(run, /git --no-replace-objects show "\$definition:scripts\/ci-cadence-launch\.mjs" > "\$private\/launch\.mjs"/);
});

// A schedule payload is not guaranteed to carry sender, and its actor is whoever
// last touched the default branch.
for (const [label, event] of [['sender-less', { kind: 'schedule', ref: 'refs/heads/main', senderless: true }], ['foreign-actor', { kind: 'schedule', ref: 'refs/heads/main', actor: 'web-flow' }], ['sender-less foreign-actor', { kind: 'schedule', ref: 'refs/heads/main', actor: 'web-flow', senderless: true }]]) test(`${label} schedule: lean reaches the nightly decision once and originals stand down; legacy keeps the original schedules`, () => {
  const lean = started(event, 'lean');
  assert.ok(lean.includes('ci-nightly.yml: Cadence admission'));
  // No routed original starts on a lean schedule: that would double the nightly cost.
  assert.deepEqual(routedOriginals(lean).filter(job => !job.startsWith('coverage.yml') && !job.startsWith('e2e-stripe-integration.yml')), []);
  const legacy = started(event, 'legacy');
  assert.deepEqual(routedOriginals(legacy), original(event, 'legacy'));
  assert.ok(legacy.includes('security.yml: Gitleaks secret scan'));
  assert.ok(!legacy.some(job => job.startsWith('ci-nightly')));
  // Scheduled secret-backed work keeps its secrets without a sender.
  for (const mode of ['lean', 'legacy']) {
    const context = { ...nativeContext(event, mode), secrets: { STRIPE_TEST_SECRET_KEY: 'fixture', COVERAGE_SECRET: 'fixture' }, needs: {} };
    const stripe = workflow('e2e-stripe-integration.yml').jobs['e2e-stripe'];
    assert.equal(Boolean(evaluate(stripe.if, context)), true, mode);
    assert.equal(evaluate(stripe.steps.find(step => step.name === 'Check required secrets').env.STRIPE_TEST_SECRET_KEY, context), 'fixture', mode);
  }
});
test('sender-less schedule cannot make scheduled coverage daily or unpublished', () => {
  const steps = workflow('coverage.yml').jobs.coverage.steps, event = { kind: 'schedule', ref: 'refs/heads/main', actor: 'web-flow', senderless: true };
  const eligibility = steps.find(step => step.name === 'Decide weekly native coverage eligibility'), report = steps.find(step => step.name === 'Report coverage to Portfolio');
  for (const mode of ['lean', 'legacy']) assert.equal(String(evaluate(eligibility.env.NATIVE_OWNER, { ...nativeContext(event, mode), needs: {} })), 'true', mode);
  // Legacy keeps publishing from the scheduled main run exactly as before cadence.
  assert.equal(Boolean(evaluate(report.if, { ...nativeContext(event, 'legacy'), steps: { 'cadence-calendar': { outputs: { eligible: 'true' } } }, needs: {} })), true);
});

// Frozen phase-1 events, renamed onto this repository's native identities.
const fixtures = JSON.parse(readFileSync(new URL('tests/fixtures/ci-cadence/events.json', root), 'utf8').replaceAll('example/fleet-A', 'juan294/paisaxe').replaceAll('example-owner', 'juan294')).cases;
for (const fixture of fixtures) test(`phase-1 "${fixture.name}": static job predicates agree with the classifier lane ${fixture.expectedLane}`, () => {
  // The frozen helper compares the mode exactly; the workflows hand it the value
  // normalised by GitHub's case-insensitive `==`, so "LEAn" reaches it as lean.
  assert.equal(classifyEvent(fixture.event, policy, fixture.mode, fixture.trustedDefinition).lane, fixture.expectedLane);
  const normalised = evaluate("vars.CI_CADENCE_MODE == 'lean' && 'lean' || 'legacy'", nativeContext(push(), fixture.mode));
  const lane = classifyEvent(fixture.event, policy, normalised, fixture.trustedDefinition).lane;
  if (typeof fixture.mode !== 'string' || fixture.mode.toLowerCase() !== 'lean' || fixture.mode === 'lean') assert.equal(lane, fixture.expectedLane);
  const event = { kind: fixture.event.kind, actor: fixture.event.actor, author: fixture.event.author, ref: fixture.event.ref, baseBranch: fixture.event.baseBranch, headRepository: fixture.event.headRepository ?? 'juan294/paisaxe' };
  const jobs = started(event, fixture.mode), before = original(event, fixture.mode);
  if (lane === 'fast') return assert.deepEqual(jobs, [FAST]);
  if (lane === 'nightly') {
    // Lean schedule: the pinned nightly owns integration validation; scheduled originals stand down.
    assert.ok(jobs.includes('ci-nightly.yml: Cadence admission'));
    return assert.deepEqual(routedOriginals(jobs).filter(job => !job.startsWith('coverage.yml') && !job.startsWith('e2e-stripe-integration.yml')), []);
  }
  // The one lane static predicates cannot see is a lean base without the helper:
  // only CI Fast starts, and its entry step fails with the repair instruction (below).
  if (fixture.trustedDefinition.helperInstalled === false && normalised === 'lean') return assert.deepEqual(jobs, [FAST]);
  // full, release, untrusted, blocked: the complete original graph for that event.
  assert.deepEqual(routedOriginals(jobs), before);
  if (['push', 'pull_request'].includes(event.kind)) assert.ok(before.length >= 5, String(before.length));
  assert.equal(jobs.includes(FAST), ['push', 'pull_request'].includes(event.kind) && (event.ref === 'refs/heads/develop' || event.baseBranch === 'develop'));
});

test('the real Stripe suite stands down only for lean owner PRs into develop', () => {
  const job = workflow('e2e-stripe-integration.yml').jobs['e2e-stripe'], selects = (event, mode) => Boolean(evaluate(job.if, { ...nativeContext(event, mode), needs: {} }));
  for (const mode of ['lean', 'LEAN']) assert.equal(selects(pull(), mode), false, mode);
  for (const [label, event, mode] of [['legacy develop PR', pull(), 'legacy'], ['unset-mode develop PR', pull(), undefined], ['lean release PR', pull('main'), 'lean'], ['lean schedule', { kind: 'schedule', ref: 'refs/heads/main', senderless: true }, 'lean'], ['legacy schedule', { kind: 'schedule', ref: 'refs/heads/main' }, 'legacy'], ['lean manual run', { kind: 'workflow_dispatch', ref: 'refs/heads/develop' }, 'lean']]) assert.equal(selects(event, mode), true, label);
  for (const mode of ['lean', 'legacy']) for (const [label, event] of [['fork PR', pull('develop', { headRepository: 'outsider/paisaxe' })], ['Dependabot PR', pull('main', { actor: 'dependabot[bot]' })], ['outsider-authored PR', pull('develop', { author: 'outsider' })]]) assert.equal(selects(event, mode), false, `${mode} ${label}`);
});
test('completed-evidence finalizer never starts for CI cadence or pull-request runs, and only after a success', () => {
  const definition = workflow('ci-cadence-finalize.yml'), job = definition.jobs.finalize;
  assert.deepEqual(definition.on.workflow_run.workflows, ['CI nightly', 'Coverage']);
  const selects = (run, mode = 'lean') => { const base = nativeContext({ kind: 'push', ref: 'refs/heads/main' }, mode); return Boolean(evaluate(job.if, { ...base, github: { ...base.github, event_name: 'workflow_run', event: { workflow_run: run } }, needs: {} })); };
  assert.equal(selects({ event: 'schedule', conclusion: 'success' }), true);
  assert.equal(selects({ event: 'push', conclusion: 'success' }), true);
  for (const [label, run, mode] of [['pull-request run', { event: 'pull_request', conclusion: 'success' }, 'lean'], ['failed run', { event: 'schedule', conclusion: 'failure' }, 'lean'], ['cancelled run', { event: 'schedule', conclusion: 'cancelled' }, 'lean'], ['legacy mode', { event: 'schedule', conclusion: 'success' }, 'legacy']]) assert.equal(selects(run, mode), false, label);
  // startedJobs() models workflow_run listeners, so every "exactly one job" oracle above includes them.
  assert.ok(started({ kind: 'schedule', ref: 'refs/heads/main', senderless: true }, 'lean').includes('ci-cadence-finalize.yml: finalize (after CI nightly)'));
  for (const event of [push(), pull()]) assert.ok(!started(event, 'lean').some(job => job.includes('(after ')));
});

/** Runs the real recovery aggregate for one set of needs results. */
function recovery(needs, kind = 'push', mode = 'lean') {
  const job = cadenceJob('complete'), context = { ...nativeContext(kind === 'push' ? push() : pull(), mode), needs };
  if (!evaluate(job.if, context)) return null;
  const step = job.steps[0], env = Object.fromEntries(Object.entries(step.env).map(([key, value]) => [key, String(evaluate(value, context) ?? '')]));
  return spawnSync('/bin/bash', ['-c', step.run], { env: { PATH: process.env.PATH, ...env }, encoding: 'utf8', timeout: 5000 }).status === 0;
}
const results = (kind, decision = 'full', change = {}) => ({ entry: { result: 'success', outputs: { decision } }, admission: { result: kind === 'push' ? 'success' : 'skipped' }, measurement: { result: kind === 'push' ? 'success' : 'skipped' }, ...Object.fromEntries(FULL_CHILDREN.map(id => [id, { result: 'success' }])), ...change });
for (const kind of ['push', 'pull_request']) test(`recovery aggregate (${kind}) requires every real child success and is not started without a full decision`, () => {
  assert.equal(cadenceJob('complete').name, 'CI Fast recovery');
  assert.deepEqual([...cadenceJob('complete').needs].sort(), ['entry', 'admission', 'measurement', ...FULL_CHILDREN].sort());
  assert.equal(recovery(results(kind), kind), true);
  for (const child of FULL_CHILDREN) for (const result of ['failure', 'cancelled', 'skipped']) assert.equal(recovery(results(kind, 'full', { [child]: { result } }), kind), false, `${child} ${result}`);
  if (kind === 'push') for (const id of ['admission', 'measurement']) for (const result of ['failure', 'cancelled', 'skipped']) assert.equal(recovery(results(kind, 'full', { [id]: { result } }), kind), false, `${id} ${result}`);
  for (const decision of ['skip', 'legacy', '']) assert.equal(recovery(results(kind, decision), kind), null, decision);
  // A failed CI Fast has no outputs: nothing recovers a red required context.
  assert.equal(recovery(results(kind, '', { entry: { result: 'failure', outputs: {} } }), kind), null);
  // Recovery children exist only in lean; the predicate alone would still demand them.
  for (const child of FULL_CHILDREN) assert.match(cadenceJob(child).if, /needs\.entry\.outputs\.decision == 'full'/);
});

/** Executes the real entry step, unmodified, in a real local repository: the step
 * performs no network operation. The launcher is a fixture whose digest is supplied
 * the same way the workflow supplies the reviewed one; `sha256sum` is the only shim
 * (GNU coreutils name, absent on macOS). */
function entryStep(t, { install = 'complete', launcher, routing, pin, event: kind = 'push', definition: named } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'paisaxe-fast-entry-')); t.after(() => rmSync(directory, { recursive: true, force: true }));
  const repository = join(directory, 'repository'), bin = join(directory, 'bin'), temp = join(directory, 'temp');
  for (const path of [repository, bin, temp]) mkdirSync(path);
  const git = (...args) => execFileSync('git', ['-c', 'core.fsmonitor=false', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { cwd: repository, encoding: 'utf8', timeout: 5000 }).trim();
  git('init', '--quiet', '--template='); writeFileSync(join(repository, 'README.md'), 'fixture\n');
  const bytes = launcher ?? '';
  if (install !== 'absent') { mkdirSync(join(repository, 'scripts')); mkdirSync(join(repository, '.github')); writeFileSync(join(repository, '.github/ci-cadence.json'), '{}\n'); writeFileSync(join(repository, 'scripts/ci-cadence.mjs'), '\n'); if (install === 'complete') writeFileSync(join(repository, 'scripts/ci-cadence-launch.mjs'), bytes); }
  git('add', '.'); git('commit', '--quiet', '-m', 'protected base'); const definition = named ?? git('rev-parse', 'HEAD');
  writeFileSync(join(repository, 'candidate'), 'candidate\n'); git('add', '.'); git('commit', '--quiet', '-m', 'candidate');
  writeFileSync(join(bin, 'sha256sum'), '#!/bin/bash\nexec shasum -a 256 "$@"\n'); chmodSync(join(bin, 'sha256sum'), 0o755);
  const eventPath = join(directory, 'event.json'), output = join(directory, 'output'), summary = join(directory, 'summary'), marker = join(directory, 'launcher-ran');
  writeFileSync(eventPath, JSON.stringify(kind === 'push' ? { before: definition } : { pull_request: { base: { sha: definition } } })); writeFileSync(output, ''); writeFileSync(summary, '');
  const step = cadenceJob('entry').steps.find(entry => entry.name === 'Acquire reviewed protected launcher');
  const result = spawnSync('/bin/bash', ['-e', '-o', 'pipefail', '-c', step.run], { cwd: repository, encoding: 'utf8', timeout: 20000, env: { PATH: `${bin}:${process.env.PATH}`, HOME: directory, RUNNER_TEMP: temp, GITHUB_EVENT_PATH: eventPath, GITHUB_EVENT_NAME: kind, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary, GITHUB_TOKEN: 'fixture', LAUNCHER_SHA256: pin ?? createHash('sha256').update(bytes).digest('hex'), CI_CADENCE_MODE: step.env.CI_CADENCE_MODE, ...(routing === undefined ? {} : { ROUTING_MODE: routing }), FIXTURE_MARKER: marker } });
  const outputs = Object.fromEntries(readFileSync(output, 'utf8').split('\n').filter(Boolean).map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  let ran = null; try { ran = readFileSync(marker, 'utf8'); } catch {}
  return { status: result.status, stdout: result.stdout, outputs, summary: readFileSync(summary, 'utf8'), ran, definition };
}
const stub = (result, exit = 0) => `import{writeFileSync}from'node:fs';writeFileSync(process.env.FIXTURE_MARKER,String(process.env.CI_CADENCE_MODE));console.log(${JSON.stringify(JSON.stringify(result))});process.exitCode=${exit};\n`;
const identity = { sourceSha: 'a'.repeat(40), testedCheckoutSha: 'b'.repeat(40), definitionSha: 'c'.repeat(40) };
const passed = { ...identity, lane: 'fast', success: true, completed: ['commit-secret-scan', 'policy-validation', 'lockfile-validation', 'cadence-contracts'] };
const fullRequired = { ...identity, lane: 'full', success: false, fullRequired: true, completed: passed.completed, reason: 'committed install/runtime/workspace drift requires full dependency validation' };

for (const kind of ['push', 'pull_request']) for (const routing of ['legacy', undefined]) test(`first installation (${kind}, routing ${routing}) defers to the still-running original workflows with a visible reason`, t => {
  const run = entryStep(t, { install: 'absent', routing, event: kind });
  assert.equal(run.status, 0); assert.deepEqual(run.outputs, { decision: 'legacy' }); assert.equal(run.ran, null);
  assert.match(run.stdout, /::notice title=CI Fast::first installation/); assert.match(run.summary, /first installation/);
});
for (const kind of ['push', 'pull_request']) test(`first installation (${kind}) under lean fails CI Fast with the repair instruction, since lean skips the originals`, t => {
  const run = entryStep(t, { install: 'absent', routing: 'lean', event: kind });
  assert.notEqual(run.status, 0); assert.deepEqual(run.outputs, {}); assert.equal(run.ran, null);
  assert.match(run.stdout, /::error title=CI Fast::first installation.*Set CI_CADENCE_MODE to legacy/); assert.match(run.summary, /Set CI_CADENCE_MODE to legacy/);
});
test('entry step performs no network or credentialed git operation', () => {
  const run = cadenceJob('entry').steps.find(entry => entry.name === 'Acquire reviewed protected launcher').run;
  assert.doesNotMatch(run, /\bfetch\b|https?:\/\/|\bclone\b|ls-remote|extraheader/);
  assert.match(run, /git --no-replace-objects cat-file -e "\$definition\^\{commit\}"/);
  assert.equal(cadenceJob('entry').steps.find(entry => entry.uses?.startsWith('actions/checkout@')).with['fetch-depth'], 0);
});
for (const kind of ['push', 'pull_request']) for (const routing of ['lean', 'legacy']) test(`protected base missing from the checkout (${kind}, ${routing}) fails with a clear message and runs nothing`, t => {
  const run = entryStep(t, { launcher: stub(passed), routing, event: kind, definition: 'e'.repeat(40) });
  assert.notEqual(run.status, 0); assert.deepEqual(run.outputs, {}); assert.equal(run.ran, null);
  assert.match(run.stdout, /::error title=CI Fast::protected base e{40} is not in this checkout/);
});
test('partial installation without the trusted launcher fails closed', t => {
  const run = entryStep(t, { install: 'partial', routing: 'lean' });
  assert.notEqual(run.status, 0); assert.equal(run.outputs.decision, undefined); assert.equal(run.ran, null);
});
test('launcher bytes differing from the reviewed digest are never executed', t => {
  const reviewed = cadenceJob('entry').steps.find(entry => entry.name === 'Acquire reviewed protected launcher').env.LAUNCHER_SHA256;
  const run = entryStep(t, { launcher: stub(passed), routing: 'lean', pin: reviewed });
  assert.notEqual(run.status, 0); assert.equal(run.ran, null); assert.equal(run.outputs.decision, undefined);
});
for (const routing of ['lean', 'legacy', undefined]) test(`four passed Fast checks yield skip under routing ${routing}, having run in lean classification`, t => {
  const run = entryStep(t, { launcher: stub(passed), routing });
  assert.equal(run.status, 0); assert.equal(run.ran, 'lean');
  assert.deepEqual(run.outputs.decision, 'skip'); assert.equal(run.outputs.source_sha, identity.sourceSha); assert.equal(run.outputs.checkout_sha, identity.testedCheckoutSha); assert.equal(run.outputs.definition_sha, identity.definitionSha);
});
for (const [routing, decision] of [['lean', 'full'], ['legacy', 'legacy'], [undefined, 'legacy']]) test(`full-required result under routing ${routing} yields ${decision}`, t => {
  const run = entryStep(t, { launcher: stub(fullRequired), routing });
  assert.equal(run.status, 0); assert.equal(run.outputs.decision, decision); assert.match(run.summary, /install\/runtime\/workspace drift/);
  // Legacy passes with a disclosure because the original workflows validate the event.
  assert.equal(/::notice title=CI Fast::full validation is required .*original full workflows/.test(run.stdout), decision === 'legacy');
});
const untrusted = { ...identity, lane: 'untrusted', acceptanceBlocked: true, protectedImported: true, runner: 'standard-hosted', token: 'read-only' };
for (const routing of ['legacy', undefined]) test(`untrusted event under routing ${routing} passes CI Fast with a disclosure and no recovery`, t => {
  const run = entryStep(t, { launcher: stub(untrusted), routing, event: 'pull_request' });
  assert.equal(run.status, 0); assert.equal(run.outputs.decision, 'legacy');
  assert.match(run.stdout, /::notice title=CI Fast::untrusted contribution: the original full workflows validate this event without secrets/); assert.match(run.summary, /untrusted contribution/);
});
test('untrusted event under lean blocks CI Fast', t => {
  const run = entryStep(t, { launcher: stub(untrusted), routing: 'lean', event: 'pull_request' });
  assert.notEqual(run.status, 0); assert.equal(run.outputs.decision, undefined);
  assert.match(run.stdout, /::error title=CI Fast::untrusted contribution: acceptance is blocked/);
});
for (const [label, result, exit] of [['failed Fast check', { ...passed, success: false, completed: ['commit-secret-scan'] }, 1], ['blocked admission', { lane: 'blocked', reason: 'native identity' }, 1], ['incomplete Fast work', { ...passed, completed: passed.completed.slice(0, 3) }, 0], ['legacy-full classification without Fast work', { ...identity, lane: 'full', reason: 'legacy full' }, 0], ['untrusted lane without protected classification', { ...identity, lane: 'untrusted', acceptanceBlocked: true }, 0], ['untrusted lane without blocked acceptance', { ...identity, lane: 'untrusted', protectedImported: true }, 0], ['malformed identity', { ...passed, sourceSha: 'short' }, 0]]) for (const routing of ['lean', 'legacy']) test(`${label} under ${routing} fails CI Fast instead of deferring`, t => {
  const run = entryStep(t, { launcher: stub(result, exit), routing });
  assert.notEqual(run.status, 0); assert.equal(run.outputs.decision, undefined);
});

// In a called workflow `github.workflow` is the CALLER's name, so a callee group
// built from it would collide with its caller or a sibling and cancel or queue it.
test('concurrency groups: no callee shares a group with its caller or a sibling, and develop / nightly / release are disjoint', () => {
  const definition = name => workflow(name);
  const group = (name, context) => interpolate(definition(name).concurrency.group, context);
  const callees = caller => Object.entries(definition(caller).jobs).filter(([, job]) => job.uses).map(([id, job]) => ({ id, name: job.uses.split('/').at(-1), inputs: job.with }));
  const lane = (caller, event, runId) => {
    const base = nativeContext(event, 'lean'), github = { ...base.github, run_id: runId, workflow: definition(caller).name, workflow_ref: `juan294/paisaxe/.github/workflows/${caller}@${event.ref}` };
    const groups = { [caller]: group(caller, { ...base, github, inputs: {} }) };
    for (const callee of callees(caller)) {
      assert.ok(!JSON.stringify(definition(callee.name).concurrency).includes('github.workflow') || callee.name === 'ci.yml', callee.name);
      groups[`${caller} > ${callee.id}`] = group(callee.name, { ...base, github, inputs: { profile: callee.inputs.profile, source_sha: 'b'.repeat(40), invocation_id: callee.inputs.invocation_id } });
    }
    return groups;
  };
  const nightly = lane('ci-nightly.yml', { kind: 'schedule', ref: 'refs/heads/main' }, '41');
  const develop = lane('ci-cadence.yml', push(), '42');
  assert.equal(Object.keys(nightly).length, 8); assert.equal(Object.keys(develop).length, 8);
  for (const [label, groups] of [['nightly', nightly], ['develop', develop]]) { const values = Object.values(groups); assert.equal(new Set(values).size, values.length, label + ' ' + JSON.stringify(groups)); for (const value of values) assert.ok(value && !value.includes('undefined') && !value.includes('null'), value); }
  // Original (direct) workflows: develop push under legacy and release events on main.
  const direct = (event, runId) => Object.fromEntries(policy.workflows.map(entry => entry.path.split('/').at(-1)).filter(name => definition(name).on[event.kind]).map(name => { const base = nativeContext(event, 'legacy'); return [name, group(name, { ...base, inputs: Object.fromEntries(Object.keys(definition(name).on.workflow_call?.inputs ?? {}).map(key => [key, ''])), github: { ...base.github, run_id: runId, workflow: definition(name).name, workflow_ref: `juan294/paisaxe/.github/workflows/${name}@${event.ref}` } })]; }));
  const lanes = { nightly: Object.values(nightly), develop: [...Object.values(develop), ...Object.values(direct(push(), '43'))], release: [...Object.values(direct(push('refs/heads/main'), '44')), ...Object.values(direct(pull('main'), '45'))] };
  for (const [left, right] of [['nightly', 'develop'], ['nightly', 'release'], ['develop', 'release']]) assert.deepEqual(lanes[left].filter(value => lanes[right].includes(value)), [], `${left} vs ${right}`);
  // Two nightly runs never share a group, and neither caller cancels evidence in progress on the nightly path.
  assert.deepEqual(Object.values(lane('ci-nightly.yml', { kind: 'schedule', ref: 'refs/heads/main' }, '46')).filter(value => Object.values(nightly).includes(value)), []);
  assert.equal(definition('ci-nightly.yml').concurrency['cancel-in-progress'], false);
  for (const callee of callees('ci-nightly.yml')) assert.equal(String(interpolate(definition(callee.name).concurrency['cancel-in-progress'], { ...nativeContext({ kind: 'schedule', ref: 'refs/heads/main' }, 'lean'), inputs: { profile: 'nightly', source_sha: 'b'.repeat(40), invocation_id: callee.inputs.invocation_id } })), 'false', callee.name);
});
