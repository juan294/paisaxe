import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, chmodSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { parse } from 'yaml';

// Activation order (plan "Activation"): install under legacy, establish a real
// CI Fast, migrate required checks, then set lean. These oracles evaluate the
// actual installed job predicates and execute the actual entry/aggregate shell.
const root = new URL('../', import.meta.url);
const workflow = name => parse(readFileSync(new URL('.github/workflows/' + name, root), 'utf8'));
const policy = JSON.parse(readFileSync(new URL('.github/ci-cadence.json', root), 'utf8'));
const FULL_CHILDREN = ['ci', 'e2e', 'lighthouse', 'bundle-size', 'knip', 'license-check', 'security'];
// Routing/provenance helpers; never application install, build or test work.
const ROUTING = ['cadence-route', 'develop_push_source', 'callable-source', 'callable-full'];

/** GitHub expression semantics needed here: missing properties are null, not errors. */
function evaluate(expression, context) {
  const body = String(expression).replace(/^\$\{\{\s*|\s*\}\}$/g, '');
  const source = body.split(/('(?:[^']|'')*')/).map((part, index) => index % 2 ? part : part.replace(/needs\.([A-Za-z_][A-Za-z0-9_-]*)/g, (_, id) => `needs[${JSON.stringify(id)}]`).replace(/\.(?=[A-Za-z_])/g, '?.')).join('');
  return vm.runInNewContext(source, { ...context, always: () => true, success: () => true, failure: () => false, cancelled: () => false, format: (pattern, ...args) => pattern.replace(/\{(\d+)\}/g, (_, n) => args[Number(n)]), contains: (value, item) => String(value ?? '').includes(item), startsWith: (value, prefix) => String(value ?? '').startsWith(prefix), fromJSON: JSON.parse }, { timeout: 100 });
}
const owner = { id: 3944118, type: 'User', login: 'juan294' };
function event({ mode, kind = 'push', actor = owner, author = owner, headRepository = 1141286326, base = 'develop' } = {}) {
  const pull = kind === 'pull_request';
  return { vars: mode === undefined ? {} : { CI_CADENCE_MODE: mode }, inputs: { profile: '', source_sha: '', invocation_id: '' }, secrets: {}, matrix: {}, env: {},
    github: { repository: 'juan294/paisaxe', repository_id: '1141286326', repository_owner_id: '3944118', actor: actor.login, actor_id: String(actor.id), event_name: kind, ref: pull ? 'refs/pull/7/merge' : `refs/heads/${base}`, sha: 'a'.repeat(40), run_id: '42', run_attempt: '1', workflow: 'fixture',
      event: { sender: { type: actor.type, id: actor.id, login: actor.login }, ...(pull ? { pull_request: { user: author, base: { ref: base }, head: { repo: { id: headRepository, fork: headRepository !== 1141286326 } } } } : {}) } } };
}
// Path-scoped triggers (the owner-only live Stripe suite) are outside routine
// cadence routing: they keep their own authorized scope in both modes.
const triggered = (definition, context) => { const on = definition.on?.[context.github.event_name]; if (on === undefined || on?.paths) return false; const branches = on?.branches; return !branches || branches.includes(context.github.event_name === 'pull_request' ? context.github.event.pull_request.base.ref : context.github.ref.slice(11)); };
/** Job IDs of the original (pre-cadence) workflows whose predicate selects them for this event. */
function originalJobs(context, route) {
  const selected = [];
  for (const entry of policy.workflows) {
    const definition = workflow(entry.path.split('/').at(-1));
    const direct = { ...context, github: { ...context.github, workflow_ref: `juan294/paisaxe/${entry.path}@${context.github.ref}` } };
    if (!triggered(definition, direct)) continue;
    const routed = definition.jobs['cadence-route'] ? Boolean(evaluate(definition.jobs['cadence-route'].if, { ...direct, needs: {} })) : false;
    const needs = Object.fromEntries(Object.keys(definition.jobs).map(id => [id, { result: 'success', outputs: {} }]));
    needs['cadence-route'] = routed ? { result: 'success', outputs: { run_legacy: route } } : { result: 'skipped', outputs: {} };
    if (needs.develop_push_source) needs.develop_push_source.outputs.validated_by_pr = '';
    if (needs['callable-source']) needs['callable-source'].result = 'skipped';
    for (const [id, job] of Object.entries(definition.jobs)) if (!ROUTING.includes(id) && (job.if === undefined || Boolean(evaluate(job.if, { ...direct, needs })))) selected.push(`${entry.path.split('/').at(-1)}:${id}`);
  }
  return selected.sort();
}
const expectedOriginals = context => policy.workflows.flatMap(entry => { const name = entry.path.split('/').at(-1), definition = workflow(name); return triggered(definition, context) ? Object.keys(definition.jobs).filter(id => !ROUTING.includes(id)).map(id => `${name}:${id}`) : []; }).sort();
/** The CI cadence caller graph for one entry decision: which jobs start, and the real aggregate verdict. */
function cadence(context, decision, change = {}) {
  const definition = workflow('ci-cadence.yml'), fast = workflow('ci-fast.yml');
  const entry = Boolean(evaluate(definition.jobs.entry.if, context)) && Boolean(evaluate(fast.jobs.fast.if, context));
  const needs = { entry: { result: entry ? 'success' : 'skipped', outputs: entry ? { decision } : {} } };
  const state = id => ({ result: Boolean(evaluate(definition.jobs[id].if, { ...context, needs })) ? 'success' : 'skipped', outputs: {} });
  needs.admission = state('admission');
  for (const id of FULL_CHILDREN) needs[id] = state(id);
  needs.measurement = state('measurement');
  Object.assign(needs, change);
  const complete = definition.jobs.complete, produced = Boolean(evaluate(complete.if, { ...context, needs }));
  const step = complete.steps[0], env = Object.fromEntries(Object.entries(step.env).map(([key, value]) => [key, String(evaluate(value, { ...context, needs }) ?? '')]));
  const verdict = produced ? spawnSync('/bin/bash', ['-c', step.run], { env: { PATH: process.env.PATH, ...env }, encoding: 'utf8', timeout: 5000 }).status === 0 : null;
  return { entry, produced, name: complete.name, verdict, fullChildren: FULL_CHILDREN.filter(id => needs[id].result === 'success') };
}

test('CI Fast entry is hosted, read-only, six-minute bounded and free of app install/build/deploy work', () => {
  const definition = workflow('ci-fast.yml'), job = definition.jobs.fast, source = JSON.stringify(definition);
  assert.deepEqual(definition.permissions, { contents: 'read' });
  assert.equal(job['runs-on'], 'ubuntu-latest'); assert.equal(job['timeout-minutes'], 6);
  for (const forbidden of ['secrets.', 'npm ci', 'npm install', 'npm run build', 'next build', 'vercel', 'supabase', 'playwright', 'self-hosted']) assert.ok(!source.includes(forbidden), forbidden);
  // The mode variable routes full-suite ownership only; it never gates the check itself.
  assert.doesNotMatch(job.if, /CI_CADENCE_MODE/);
  assert.doesNotMatch(workflow('ci-cadence.yml').jobs.entry.if, /CI_CADENCE_MODE/);
  assert.doesNotMatch(workflow('ci-cadence.yml').jobs.complete.if, /CI_CADENCE_MODE/);
  assert.equal(workflow('ci-cadence.yml').on.push['paths-ignore'], undefined); assert.equal(workflow('ci-cadence.yml').on.push.paths, undefined);
});
test('bootstrap pins the exact protected launcher and always runs the four checks', () => {
  const step = workflow('ci-fast.yml').jobs.fast.steps.find(entry => entry.name === 'Acquire reviewed protected launcher');
  assert.equal(step.env.LAUNCHER_SHA256, createHash('sha256').update(readFileSync(new URL('scripts/ci-cadence-launch.mjs', root))).digest('hex'));
  assert.equal(step.env.CI_CADENCE_MODE, 'lean'); assert.equal(step.env.ROUTING_MODE, '${{ vars.CI_CADENCE_MODE }}');
  assert.match(step.run, /event\['before'\] if kind == 'push' else event\['pull_request'\]\['base'\]\['sha'\]/);
  assert.match(step.run, /required=\['commit-secret-scan','policy-validation','lockfile-validation','cadence-contracts'\]/);
  assert.ok(!step.run.includes('node scripts/'));
});

for (const kind of ['push', 'pull_request']) for (const mode of ['legacy', undefined, 'LEAN', '']) test(`legacy (${JSON.stringify(mode)}) owner ${kind}: CI Fast is produced AND every original job still runs`, () => {
  const context = event({ mode, kind });
  const graph = cadence(context, 'skip');
  assert.deepEqual({ entry: graph.entry, produced: graph.produced, name: graph.name, verdict: graph.verdict, fullChildren: graph.fullChildren }, { entry: true, produced: true, name: 'CI Fast', verdict: true, fullChildren: [] });
  const expected = expectedOriginals(context);
  assert.ok(expected.length >= (kind === 'push' ? 10 : 13), String(expected.length));
  assert.deepEqual(originalJobs(context, undefined), expected);
  // Every job the policy inventories for these workflows is among those produced.
  for (const entry of policy.workflows) { const name = entry.path.split('/').at(-1); if (!triggered(workflow(name), context)) continue; for (const job of entry.jobs) assert.ok(expected.some(id => id.startsWith(name + ':') && (job.id.endsWith(id.split(':')[1]) || job.id.startsWith('ci-coverage-shard-'))), job.id); }
});
for (const kind of ['push', 'pull_request']) test(`legacy owner ${kind} needing full validation defers to the original workflows without duplicate children`, () => {
  const graph = cadence(event({ mode: 'legacy', kind }), 'legacy');
  assert.equal(graph.verdict, true); assert.deepEqual(graph.fullChildren, []);
});
for (const kind of ['push', 'pull_request']) test(`lean owner ${kind}: CI Fast is produced and zero full-suite jobs start anywhere`, () => {
  const context = event({ mode: 'lean', kind });
  const graph = cadence(context, 'skip');
  assert.deepEqual({ entry: graph.entry, produced: graph.produced, verdict: graph.verdict, fullChildren: graph.fullChildren }, { entry: true, produced: true, verdict: true, fullChildren: [] });
  assert.deepEqual(originalJobs(context, 'false'), []);
});
for (const kind of ['push', 'pull_request']) test(`lean owner ${kind} needing full validation runs every recovery child exactly once`, () => {
  const context = event({ mode: 'lean', kind });
  const graph = cadence(context, 'full');
  assert.deepEqual(graph.fullChildren, FULL_CHILDREN); assert.equal(graph.verdict, true);
  assert.deepEqual(originalJobs(context, 'false'), []);
  for (const child of FULL_CHILDREN) for (const result of ['failure', 'cancelled', 'skipped']) assert.equal(cadence(context, 'full', { [child]: { result, outputs: {} } }).verdict, false, `${child} ${result}`);
});
test('first installation under lean: originals independently fall back to their complete graph', () => {
  // The protected route step reports run_legacy=true when the base lacks the helper.
  const context = event({ mode: 'lean' });
  assert.deepEqual(originalJobs(context, 'true'), expectedOriginals(context));
  const graph = cadence(context, 'legacy'); assert.equal(graph.verdict, true); assert.deepEqual(graph.fullChildren, []);
});
for (const mutation of [['entry failed', 'skip', { entry: { result: 'failure', outputs: {} } }], ['unknown decision', 'maybe', {}], ['empty decision', '', {}], ['skip with a started child', 'skip', { ci: { result: 'success', outputs: {} } }], ['legacy with a failed child', 'legacy', { e2e: { result: 'failure', outputs: {} } }]]) test('CI Fast aggregate rejects ' + mutation[0], () => {
  for (const mode of ['legacy', 'lean']) assert.equal(cadence(event({ mode }), mutation[1], mutation[2]).verdict, false, mode);
});
for (const [label, options] of [['outsider push', { actor: { id: 12345, type: 'User', login: 'outsider' } }], ['Dependabot PR', { kind: 'pull_request', actor: { id: 49699333, type: 'Bot', login: 'dependabot[bot]' }, author: { id: 49699333, type: 'Bot', login: 'dependabot[bot]' } }], ['fork PR', { kind: 'pull_request', headRepository: 999 }], ['outsider-authored PR', { kind: 'pull_request', author: { id: 12345, type: 'User', login: 'outsider' } }]]) for (const mode of ['legacy', 'lean']) test(`${mode} ${label} never enters Fast and keeps the complete original graph`, () => {
  const context = event({ mode, ...options });
  const graph = cadence(context, 'skip');
  assert.equal(graph.entry, false); assert.equal(graph.produced, false); assert.deepEqual(graph.fullChildren, []);
  // Mode cannot reduce an untrusted graph: lean selects exactly what legacy selects.
  const selected = originalJobs(context, 'false');
  assert.deepEqual(selected, originalJobs(event({ mode: 'legacy', ...options }), undefined));
  for (const required of ['ci.yml:lint-and-typecheck', 'ci.yml:test', 'ci.yml:build', 'e2e.yml:e2e', 'security.yml:gitleaks', 'security.yml:audit']) assert.ok(selected.includes(required), required);
});

/** Executes the real entry step. Only transport is replaced: `timeout … git fetch`
 * becomes a local pin, and the launcher is a fixture whose digest is supplied the
 * same way the workflow supplies the reviewed one. */
function entryStep(t, { install = 'complete', launcher, routing, pin, event: kind = 'push' } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'paisaxe-fast-entry-')); t.after(() => rmSync(directory, { recursive: true, force: true }));
  const repository = join(directory, 'repository'), bin = join(directory, 'bin'), temp = join(directory, 'temp');
  for (const path of [repository, bin, temp]) mkdirSync(path);
  const git = (...args) => execFileSync('git', ['-c', 'core.fsmonitor=false', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { cwd: repository, encoding: 'utf8', timeout: 5000 }).trim();
  git('init', '--quiet', '--template='); writeFileSync(join(repository, 'README.md'), 'fixture\n');
  const bytes = launcher ?? '';
  if (install !== 'absent') { mkdirSync(join(repository, 'scripts')); mkdirSync(join(repository, '.github')); writeFileSync(join(repository, '.github/ci-cadence.json'), '{}\n'); writeFileSync(join(repository, 'scripts/ci-cadence.mjs'), '\n'); if (install === 'complete') writeFileSync(join(repository, 'scripts/ci-cadence-launch.mjs'), bytes); }
  git('add', '.'); git('commit', '--quiet', '-m', 'protected base'); const definition = git('rev-parse', 'HEAD');
  writeFileSync(join(repository, 'candidate'), 'candidate\n'); git('add', '.'); git('commit', '--quiet', '-m', 'candidate');
  writeFileSync(join(bin, 'timeout'), '#!/bin/bash\nfor last; do :; done\nexec git update-ref "${last#*:}" "${last%%:*}"\n'); chmodSync(join(bin, 'timeout'), 0o755);
  writeFileSync(join(bin, 'sha256sum'), '#!/bin/bash\nexec shasum -a 256 "$@"\n'); chmodSync(join(bin, 'sha256sum'), 0o755);
  const eventPath = join(directory, 'event.json'), output = join(directory, 'output'), summary = join(directory, 'summary'), marker = join(directory, 'launcher-ran');
  writeFileSync(eventPath, JSON.stringify(kind === 'push' ? { before: definition } : { pull_request: { base: { sha: definition } } })); writeFileSync(output, ''); writeFileSync(summary, '');
  const step = workflow('ci-fast.yml').jobs.fast.steps.find(entry => entry.name === 'Acquire reviewed protected launcher');
  const result = spawnSync('/bin/bash', ['-e', '-o', 'pipefail', '-c', step.run], { cwd: repository, encoding: 'utf8', timeout: 20000, env: { PATH: `${bin}:${process.env.PATH}`, HOME: directory, RUNNER_TEMP: temp, GITHUB_EVENT_PATH: eventPath, GITHUB_EVENT_NAME: kind, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary, GITHUB_TOKEN: 'fixture', LAUNCHER_SHA256: pin ?? createHash('sha256').update(bytes).digest('hex'), CI_CADENCE_MODE: step.env.CI_CADENCE_MODE, ...(routing === undefined ? {} : { ROUTING_MODE: routing }), FIXTURE_MARKER: marker } });
  const outputs = Object.fromEntries(readFileSync(output, 'utf8').split('\n').filter(Boolean).map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  let ran = null; try { ran = readFileSync(marker, 'utf8'); } catch {}
  return { status: result.status, stdout: result.stdout, outputs, summary: readFileSync(summary, 'utf8'), ran, definition };
}
const stub = (result, exit = 0) => `import{writeFileSync}from'node:fs';writeFileSync(process.env.FIXTURE_MARKER,String(process.env.CI_CADENCE_MODE));console.log(${JSON.stringify(JSON.stringify(result))});process.exitCode=${exit};\n`;
const identity = { sourceSha: 'a'.repeat(40), testedCheckoutSha: 'b'.repeat(40), definitionSha: 'c'.repeat(40) };
const passed = { ...identity, lane: 'fast', success: true, completed: ['commit-secret-scan', 'policy-validation', 'lockfile-validation', 'cadence-contracts'] };
const fullRequired = { ...identity, lane: 'full', success: false, fullRequired: true, completed: passed.completed, reason: 'committed install/runtime/workspace drift requires full dependency validation' };

for (const kind of ['push', 'pull_request']) for (const routing of ['lean', 'legacy', undefined]) test(`first installation (${kind}, routing ${routing}) defers to existing full behaviour with a visible reason`, t => {
  const run = entryStep(t, { install: 'absent', routing, event: kind });
  assert.equal(run.status, 0); assert.deepEqual(run.outputs, { decision: 'legacy' }); assert.equal(run.ran, null);
  assert.match(run.stdout, /::notice title=CI Fast::first installation/); assert.match(run.summary, /first installation/);
});
test('partial installation without the trusted launcher fails closed', t => {
  const run = entryStep(t, { install: 'partial', routing: 'lean' });
  assert.notEqual(run.status, 0); assert.equal(run.outputs.decision, undefined); assert.equal(run.ran, null);
});
test('launcher bytes differing from the reviewed digest are never executed', t => {
  const reviewed = workflow('ci-fast.yml').jobs.fast.steps.find(entry => entry.name === 'Acquire reviewed protected launcher').env.LAUNCHER_SHA256;
  const run = entryStep(t, { launcher: stub(passed), routing: 'lean', pin: reviewed });
  assert.notEqual(run.status, 0); assert.equal(run.ran, null); assert.equal(run.outputs.decision, undefined);
});
for (const routing of ['lean', 'legacy', undefined, 'LEAN']) test(`four passed Fast checks yield skip under routing ${routing}, having run in lean classification`, t => {
  const run = entryStep(t, { launcher: stub(passed), routing });
  assert.equal(run.status, 0); assert.equal(run.ran, 'lean');
  assert.deepEqual(run.outputs.decision, 'skip'); assert.equal(run.outputs.source_sha, identity.sourceSha); assert.equal(run.outputs.checkout_sha, identity.testedCheckoutSha); assert.equal(run.outputs.definition_sha, identity.definitionSha);
});
for (const [routing, decision] of [['lean', 'full'], ['legacy', 'legacy'], [undefined, 'legacy'], ['LEAN', 'legacy']]) test(`full-required result under routing ${routing} yields ${decision}`, t => {
  const run = entryStep(t, { launcher: stub(fullRequired), routing });
  assert.equal(run.status, 0); assert.equal(run.outputs.decision, decision); assert.match(run.summary, /install\/runtime\/workspace drift/);
});
for (const [label, result, exit] of [['failed Fast check', { ...passed, success: false, completed: ['commit-secret-scan'] }, 1], ['blocked admission', { lane: 'blocked', reason: 'native identity' }, 1], ['incomplete Fast work', { ...passed, completed: passed.completed.slice(0, 3) }, 0], ['legacy-full classification without Fast work', { ...identity, lane: 'full', reason: 'legacy full' }, 0], ['untrusted lane', { ...identity, lane: 'untrusted' }, 0], ['malformed identity', { ...passed, sourceSha: 'short' }, 0]]) for (const routing of ['lean', 'legacy']) test(`${label} under ${routing} fails CI Fast instead of deferring`, t => {
  const run = entryStep(t, { launcher: stub(result, exit), routing });
  assert.notEqual(run.status, 0); assert.equal(run.outputs.decision, undefined);
});
