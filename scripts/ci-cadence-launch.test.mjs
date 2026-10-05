import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdtemp, rm, readdir, realpath, chmod } from 'node:fs/promises';
import { access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchNative, nativeScannerDigest, shareCheckoutObjects, LAUNCHER_REASONS } from './ci-cadence-launch.mjs';
import { launchControl, controlFailure, CONTROL_REASONS } from './ci-cadence-control-launch.mjs';
import { user } from '../tests/fixtures/ci-cadence-adapter/native/fixture.mjs';
import { launchFixture } from '../tests/fixtures/ci-cadence-adapter/native/launch-fixture.mjs';
import { workflow } from '../tests/fixtures/ci-cadence-adapter/native/workflow-graph.mjs';
const each = (name, body) => test(name, async () => { const f = await launchFixture(); try { await body(f); } finally { await f.close(); } });
// Origin unreachable: a git shim first on PATH records every invocation and
// refuses network subcommands, and both the proxy environment and the checkout's
// own http.proxy point at a closed port. Acquisition must succeed regardless.
// `ls-remote --get-url` (the scanner asks it) only prints configuration.
const NETWORK = ['fetch', 'ls-remote', 'clone', 'pull', 'fetch-pack', 'remote-https'];
const offline = async (f, body) => {
  const directory = await mkdtemp(join(tmpdir(), 'paisaxe-offline-')); const log = join(directory, 'git.log');
  const real = execFileSync('/bin/sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
  await writeFile(join(directory, 'git'), `#!/bin/sh\nprintf '<%s>' "$@" >> '${log}'; echo >> '${log}'\ncase " $* " in *' --get-url '*) ;; *) for a in "$@"; do case "$a" in ${NETWORK.join('|')}) echo 'origin unreachable' >&2; exit 128;; esac; done;; esac\nexec '${real}' "$@"\n`); await chmod(join(directory, 'git'), 0o755);
  f.git('config', 'http.proxy', 'http://127.0.0.1:9');
  const names = ['PATH', 'HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY']; const saved = Object.fromEntries(names.map(name => [name, process.env[name]]));
  process.env.PATH = `${directory}:${process.env.PATH}`; for (const name of names.slice(1)) process.env[name] = 'http://127.0.0.1:9';
  try { const result = await body(); const calls = (await readFile(log, 'utf8').catch(() => '')).split('\n').filter(Boolean); return { result, calls, network: calls.filter(line => !line.includes('<--get-url>') && NETWORK.some(word => line.includes(`<${word}>`))) }; }
  finally { for (const [name, value] of Object.entries(saved)) if (value === undefined) delete process.env[name]; else process.env[name] = value; await rm(directory, { recursive: true, force: true }); }
};
each('real protected modules classify full without candidate import', async f => { const x = await f.prepare(); x.input.mode = 'legacy'; const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'full'); assert.equal(r.definitionSha, x.base); assert.equal(r.sourceSha, x.source); assert.ok(f.requests.every(r => r.method === 'GET')); });
each('real Fast executes all four works from protected modules', async f => { const x = await f.prepare(); const r = await launchNative(x.input, x.transports); assert.equal(r.success, true); assert.equal(r.completed.length, 4); });
each('hostile candidate import mutation never executes', async f => { const canary = join(f.root, 'canary'); const x = await f.prepare('push', { mutate: async f => { const source = `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(canary)}, 'executed'); throw Error('hostile');`; await f.put('scripts/ci-cadence-native.mjs', source); await f.put('scripts/ci-fast.mjs', source); await f.put('scripts/ci-cadence.mjs', source); } }); const r = await launchNative(x.input, x.transports); assert.equal(r.success, true); await assert.rejects(access(canary)); });
each('physical original PR merge is retained and never reusable', async f => { const x = await f.prepare('pull_request'); const before = f.git('rev-parse', 'HEAD'); x.input.mode = 'legacy'; const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'full'); assert.equal(r.testedCheckoutSha, x.checkout); assert.equal(r.reusable, false); assert.equal(f.git('rev-parse', 'HEAD'), before); });
each('schedule authentic develop ref resolves exactly once and pins its checkout', async f => { const x = await f.prepare('schedule'); const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'nightly'); assert.equal(r.sourceSha, x.source); assert.equal(r.definitionSha, x.base); assert.equal(f.requests.filter(r => r.url.endsWith('/git/ref/heads/develop')).length, 1); assert.equal(f.git('rev-parse', 'HEAD'), x.base); });
each('both absent preserves legacy full without import', async f => { const x = await f.prepare('push', { definition: f.absent }); const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'full'); assert.equal(r.protectedImported, false); });
each('sender-less schedule payload authenticates by repository identity and reaches the nightly decision', async f => { const x = await f.prepare('schedule'); x.input.event = { schedule: x.input.event.schedule }; x.input.actor = 'web-flow'; x.input.context.actorId = 19864447; x.input.context.actorType = undefined; const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'nightly'); assert.equal(r.sourceSha, x.source); assert.equal(r.protectedImported, true); assert.equal(f.requests.filter(r => r.url.endsWith('/git/ref/heads/develop')).length, 1); });
each('sender-less push blocks: only schedule may omit sender', async f => { const x = await f.prepare('push'); delete x.input.event.sender; const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'blocked'); assert.equal(r.protectedImported, false); });
// pull_request.base.sha lags legitimately when develop moves after the PR's last sync.
for (const [label, compared, admitted] of [['an ancestor of the moved tip', base => ({ status: 'ahead', base_commit: { sha: base }, merge_base_commit: { sha: base } }), true], ['diverged from the tip', base => ({ status: 'diverged', base_commit: { sha: base }, merge_base_commit: { sha: 'c'.repeat(40) } }), false], ['ahead of the tip', base => ({ status: 'behind', base_commit: { sha: base }, merge_base_commit: { sha: 'c'.repeat(40) } }), false], ['compared against another base', () => ({ status: 'ahead', base_commit: { sha: 'c'.repeat(40) }, merge_base_commit: { sha: 'c'.repeat(40) } }), false]]) each(`pull request whose base is ${label} is ${admitted ? 'admitted' : 'blocked'}`, async f => {
  const x = await f.prepare('pull_request'); x.input.mode = 'legacy'; const tip = 'd'.repeat(40); const compares = [];
  const request = async (url, init) => {
    if (url.endsWith('/git/ref/heads/develop')) return new Response(JSON.stringify({ ref: 'refs/heads/develop', object: { type: 'commit', sha: tip } }), { headers: { 'x-ratelimit-remaining': '950' } });
    if (url.includes('/compare/')) { compares.push(url); return new Response(JSON.stringify(compared(x.base)), { headers: { 'x-ratelimit-remaining': '950' } }); }
    return x.transports.request(url, init);
  };
  const r = await launchNative(x.input, { ...x.transports, request });
  assert.deepEqual(compares.map(url => url.split('/compare/')[1]), [`${x.base}...${tip}`]);
  assert.equal(r.lane, admitted ? 'full' : 'blocked'); if (admitted) assert.equal(r.definitionSha, x.base);
});
// GitHub builds refs/pull/N/merge on the current develop tip, while the payload's
// base.sha can be older: the merge's first parent then descends from base.sha.
const rebuilt = (f, x, first) => { const merge = f.git('commit-tree', f.git('rev-parse', `${x.checkout}^{tree}`), '-p', first, '-p', x.source, '-m', 'native PR merge on moved base'); f.git('checkout', '--quiet', '--force', '--detach', merge); x.input.context.sha = merge; return merge; };
const tipAt = (x, tip, compared) => async (url, init) => {
  if (url.endsWith('/git/ref/heads/develop')) return new Response(JSON.stringify({ ref: 'refs/heads/develop', object: { type: 'commit', sha: tip } }), { headers: { 'x-ratelimit-remaining': '950' } });
  if (url.includes('/compare/')) return new Response(JSON.stringify(compared), { headers: { 'x-ratelimit-remaining': '950' } });
  return x.transports.request(url, init);
};
each('lagging base.sha: merge built on a newer develop commit is admitted with base.sha as the protected definition', async f => {
  const x = await f.prepare('pull_request'); x.input.mode = 'legacy';
  const moved = f.git('commit-tree', f.git('rev-parse', `${x.base}^{tree}`), '-p', x.base, '-m', 'develop moved after the PR synced');
  const merge = rebuilt(f, x, moved);
  const r = await launchNative(x.input, { ...x.transports, request: tipAt(x, moved) });
  assert.equal(r.lane, 'full'); assert.equal(r.definitionSha, x.base); assert.equal(r.testedCheckoutSha, merge); assert.equal(r.sourceSha, x.source); assert.equal(r.protectedImported, true);
  // The moved commit may itself be behind the tip, as long as it is on develop.
  const y = await launchNative(x.input, { ...x.transports, request: tipAt(x, 'd'.repeat(40), { status: 'ahead', base_commit: { sha: moved }, merge_base_commit: { sha: moved } }) });
  assert.equal(y.lane, 'full');
});
each('merge whose first parent does not descend from base.sha is blocked', async f => {
  const x = await f.prepare('pull_request'); x.input.mode = 'legacy';
  const unrelated = f.git('commit-tree', f.git('rev-parse', `${x.base}^{tree}`), '-p', f.absent, '-m', 'not a descendant of base.sha');
  rebuilt(f, x, unrelated);
  const r = await launchNative(x.input, { ...x.transports, request: tipAt(x, unrelated) });
  assert.equal(r.lane, 'blocked'); assert.equal(r.protectedImported, false);
});
each('merge whose first parent descends from base.sha but is not on develop is blocked', async f => {
  const x = await f.prepare('pull_request'); x.input.mode = 'legacy';
  const moved = f.git('commit-tree', f.git('rev-parse', `${x.base}^{tree}`), '-p', x.base, '-m', 'descendant that never reached develop');
  rebuilt(f, x, moved);
  const r = await launchNative(x.input, { ...x.transports, request: tipAt(x, 'd'.repeat(40), { status: 'diverged', base_commit: { sha: moved }, merge_base_commit: { sha: x.base } }) });
  assert.equal(r.lane, 'blocked');
});
each('merge with a third parent or a foreign second parent is blocked', async f => {
  const x = await f.prepare('pull_request'); x.input.mode = 'legacy';
  const tree = f.git('rev-parse', `${x.checkout}^{tree}`);
  for (const parents of [[x.base, x.source, f.absent], [x.base, f.absent]]) { const merge = f.git('commit-tree', tree, ...parents.flatMap(parent => ['-p', parent]), '-m', 'forged merge'); f.git('checkout', '--quiet', '--force', '--detach', merge); x.input.context.sha = merge; assert.equal((await launchNative(x.input, x.transports)).lane, 'blocked'); }
});
// A newer push does not cancel an older push's run; the older run must still scan
// its own before..after once develop has moved past it.
each('superseded push whose head is an ancestor of the develop tip completes all four Fast works on its own range', async f => {
  const x = await f.prepare('push'); const compares = [];
  const request = async (url, init) => { if (url.includes('/compare/')) compares.push(url.split('/compare/')[1]); return tipAt(x, 'd'.repeat(40), { status: 'ahead', base_commit: { sha: x.source }, merge_base_commit: { sha: x.source } })(url, init); };
  const r = await launchNative(x.input, { ...x.transports, request });
  assert.equal(r.lane, 'fast'); assert.equal(r.success, true); assert.deepEqual(r.completed, ['commit-secret-scan', 'policy-validation', 'lockfile-validation', 'cadence-contracts']);
  assert.equal(r.sourceSha, x.source); assert.equal(r.definitionSha, x.base); assert.deepEqual(compares, [`${x.source}...${'d'.repeat(40)}`]);
});
each('superseded push still fails on a secret introduced in its own range', async f => {
  const x = await f.prepare('push', { mutate: async ({ put }) => put('leak.ts', 'const token = "ghp_0123456789abcdef0123456789abcdef012345";\n') });
  const r = await launchNative(x.input, { ...x.transports, request: tipAt(x, 'd'.repeat(40), { status: 'ahead', base_commit: { sha: x.source }, merge_base_commit: { sha: x.source } }) });
  assert.equal(r.lane, 'fast'); assert.equal(r.success, false); assert.match(r.reason, /secret/);
});
for (const [label, compared] of [['diverged from develop', x => ({ status: 'diverged', base_commit: { sha: x.source }, merge_base_commit: { sha: x.base } })], ['ahead of develop', x => ({ status: 'behind', base_commit: { sha: x.source }, merge_base_commit: { sha: 'd'.repeat(40) } })], ['compared against another commit', x => ({ status: 'ahead', base_commit: { sha: x.base }, merge_base_commit: { sha: x.base } })]]) each(`pushed SHA ${label} blocks`, async f => {
  const x = await f.prepare('push');
  const r = await launchNative(x.input, { ...x.transports, request: tipAt(x, 'd'.repeat(40), compared(x)) });
  assert.equal(r.lane, 'blocked'); assert.equal(r.protectedImported, false);
});
// The launcher has no git transport at all: every object comes from the job's own
// fetch-depth 0 checkout through alternates, with the origin unreachable.
for (const [kind, mode, lane] of [['push', 'lean', 'fast'], ['push', 'legacy', 'full'], ['pull_request', 'legacy', 'full'], ['schedule', 'lean', 'nightly']]) each(`${kind} under ${mode} reaches ${lane} from the local checkout with no git network operation`, async f => {
  const x = await f.prepare(kind); x.input.mode = mode;
  const { result: r, calls, network } = await offline(f, () => launchNative(x.input, x.transports));
  assert.equal(r.lane, lane); assert.equal(r.protectedImported, true); assert.equal(r.definitionSha, x.base); assert.equal(r.sourceSha, x.source);
  if (lane === 'fast') { assert.equal(r.success, true); assert.deepEqual(r.completed, ['commit-secret-scan', 'policy-validation', 'lockfile-validation', 'cadence-contracts']); }
  assert.ok(calls.length > 0, 'git shim observed'); assert.deepEqual(network, []);
});
each('superseded offline push still fails on a secret in its own range: the store has history for the scan', async f => {
  const secret = ['gh', 'p_', '0123456789abcdef'.repeat(2), '01234567'].join('');
  const x = await f.prepare('push', { mutate: async ({ put }) => put('leak.ts', `const token = "${secret}";\n`) });
  const { result: r, network } = await offline(f, () => launchNative(x.input, x.transports));
  assert.equal(r.lane, 'fast'); assert.equal(r.success, false); assert.match(r.reason, /secret/); assert.deepEqual(network, []);
});
for (const [label, prepare] of [
  ['push whose protected base is missing', x => { x.input.event.before = 'e'.repeat(40); }],
  ['nightly whose develop head is missing', (x, f) => { x.transports.request = developAt(x, 'e'.repeat(40)); }],
  ['nightly whose develop head names a tree, not a commit', (x, f) => { x.transports.request = developAt(x, f.git('rev-parse', `${x.source}^{tree}`)); }],
]) each(`${label} from the checkout blocks with no network fallback`, async f => {
  const x = await f.prepare(label.startsWith('push') ? 'push' : 'schedule'); prepare(x, f);
  const { result: r, network } = await offline(f, () => launchNative(x.input, x.transports));
  assert.equal(r.lane, 'blocked'); assert.equal(r.protectedImported, false); assert.deepEqual(network, []);
  assert.equal(r.reason, label.startsWith('push') ? 'push ancestry' : 'object absent from full-history checkout');
});
const developAt = (x, sha) => { const original = x.transports.request; return async (url, init) => url.endsWith('/git/ref/heads/develop') ? new Response(JSON.stringify({ ref: 'refs/heads/develop', object: { type: 'commit', sha } }), { headers: { 'x-ratelimit-remaining': '950' } }) : original(url, init); };
each('alternates share the checkout objects without copying, and the store answers merge-base, rev-list and diff', async f => {
  const x = await f.prepare('push'); const store = await mkdtemp(join(tmpdir(), 'paisaxe-store-'));
  try {
    const run = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } });
    run(['init', '--quiet', '--template=', store], tmpdir());
    await shareCheckoutObjects(f.root, store, run);
    assert.equal(await readFile(join(store, '.git/objects/info/alternates'), 'utf8'), `${await realpath(join(f.root, '.git/objects'))}\n`);
    assert.equal(run(['merge-base', x.base, x.source], store).trim(), x.base);
    assert.equal(run(['rev-list', '--count', `${x.base}..${x.source}`], store).trim(), '1');
    assert.ok(run(['diff', '--name-only', x.base, x.source], store).split('\n').includes('ordinary.ts'));
    assert.deepEqual((await readdir(join(store, '.git/objects'))).sort(), ['info', 'pack']); assert.deepEqual(await readdir(join(store, '.git/objects/pack')), []);
    // A linked worktree checkout resolves to the common object directory.
    const linked = join(store, 'linked'); f.git('worktree', 'add', '--quiet', '--detach', linked, x.source); const other = await mkdtemp(join(tmpdir(), 'paisaxe-store-'));
    try { run(['init', '--quiet', '--template=', other], tmpdir()); await shareCheckoutObjects(linked, other, run); assert.equal(await readFile(join(other, '.git/objects/info/alternates'), 'utf8'), `${await realpath(join(f.root, '.git/objects'))}\n`); assert.equal(run(['cat-file', '-t', x.base], other).trim(), 'commit'); }
    finally { await rm(other, { recursive: true, force: true }); f.git('worktree', 'remove', '--force', linked); }
  } finally { await rm(store, { recursive: true, force: true }); }
});
each('pull request whose base is the current tip needs no comparison', async f => { const x = await f.prepare('pull_request'); x.input.mode = 'legacy'; const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'full'); assert.equal(f.requests.filter(r => r.url.includes('/compare/')).length, 0); });
test('protected launchers contain no git transport, credential header or injectable transport', async () => {
  for (const file of ['ci-cadence-launch.mjs', 'ci-cadence-control-launch.mjs']) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    for (const forbidden of [/'fetch'/, /'ls-remote'/, /'clone'/, /gitTransport/, /extraheader/i, /AUTHORIZATION/, /GIT_CONFIG_VALUE/]) assert.doesNotMatch(source, forbidden, `${file}: ${forbidden}`);
  }
});
// A blocked result names the failed check from a fixed vocabulary: the module's
// own constant messages, otherwise 'unclassified'. Never stderr, paths or tokens.
for (const [file, reasons] of [['ci-cadence-launch.mjs', LAUNCHER_REASONS], ['ci-cadence-control-launch.mjs', CONTROL_REASONS]]) test(`${file} blocked vocabulary is exactly its constant messages`, async () => {
  const source = await readFile(new URL(file, import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Error\(`/); assert.ok(Object.isFrozen(reasons));
  const thrown = [...source.matchAll(/Error\('([^']+)'\)/g)].map(match => match[1]);
  assert.deepEqual([...new Set(thrown)].sort(), [...reasons].sort());
});
test('control failure vocabulary passes constants and hides everything else', () => {
  assert.equal(controlFailure(Error('Control object absent from checkout')), 'Control object absent from checkout');
  for (const other of [Error('Command failed: git fetch https://x-access-token:fixture-token@github.com'), Error('fixture-token'), 'Control identity', undefined]) assert.equal(controlFailure(other), 'unclassified');
});
each('native identity failure carries its constant reason', async f => { const x = await f.prepare(); x.input.context.sha = x.base; const r = await launchNative(x.input, x.transports); assert.equal(r.reason, 'physical original checkout'); });
each('PR merge on a base outside base.sha history carries its constant reason', async f => { const x = await f.prepare('pull_request'); const unrelated = f.git('commit-tree', f.git('rev-parse', `${x.base}^{tree}`), '-p', f.absent, '-m', 'not a descendant'); const merge = f.git('commit-tree', f.git('rev-parse', `${x.checkout}^{tree}`), '-p', unrelated, '-p', x.source, '-m', 'merge'); f.git('checkout', '--quiet', '--force', '--detach', merge); x.input.context.sha = merge; const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'blocked'); assert.equal(r.reason, 'PR base ancestry'); });
// The control loader reads the same checkout in place: no store, no network.
const controlled = async (f, input) => { const saved = process.env.GITHUB_TOKEN; process.env.GITHUB_TOKEN = 'fixture-token'; try { return await launchControl(input).then(() => 'resolved', error => error.message); } finally { if (saved === undefined) delete process.env.GITHUB_TOKEN; else process.env.GITHUB_TOKEN = saved; } };
each('control loader acquires definition and source from the checkout with the origin unreachable', async f => {
  const x = await f.prepare('push');
  const { result, network } = await offline(f, () => controlled(f, { purpose: 'admit', root: f.root, definitionSha: x.base, sourceSha: x.source, originalSha: x.checkout }));
  // Acquisition passed: the fixture definition lacks the control closure, so the first pin read stops it.
  assert.equal(result, 'Control module mode'); assert.deepEqual(network, []);
  for (const id of [x.base, x.source]) assert.equal(f.git('rev-parse', `refs/ci-cadence/control/${id}`), id);
});
for (const [label, id] of [['missing', () => 'e'.repeat(40)], ['non-commit', (f, x) => f.git('rev-parse', `${x.source}^{tree}`)]]) each(`control loader blocks on a ${label} object with no network fallback`, async f => {
  const x = await f.prepare('push');
  const { result, network } = await offline(f, () => controlled(f, { purpose: 'admit', root: f.root, definitionSha: x.base, sourceSha: id(f, x), originalSha: x.checkout }));
  assert.equal(result, 'Control object absent from checkout'); assert.deepEqual(network, []);
});
test('every job that runs a protected launcher checks out full history', () => {
  const launcher = /scripts\/ci-cadence-(?:control-)?launch\.mjs/; let jobs = 0;
  for (const name of ['ci-cadence.yml', 'ci-nightly.yml', 'ci-cadence-finalize.yml']) for (const [id, job] of Object.entries(workflow(name).jobs)) {
    if (!(job.steps ?? []).some(step => launcher.test(step.run ?? ''))) continue; jobs++;
    const checkout = job.steps.find(step => step.uses?.startsWith('actions/checkout@'));
    assert.equal(checkout?.with?.['fetch-depth'], 0, `${name}:${id}`);
  }
  assert.equal(jobs, 6);
});
each('absent installation disables new nightly without integration resolution', async f => { const x = await f.prepare('schedule', { definition: f.absent }); const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'disabled'); assert.equal(f.requests.filter(r => r.url.endsWith('/git/ref/heads/develop')).length, 0); });
each('partial installation blocks before code import', async f => { const x = await f.prepare('push', { definition: f.partial }); const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'blocked'); assert.equal(r.protectedImported, false); });
for (const fault of ['repository', 'ref', 'quota', 'redirect', 'throw']) each(`external HTTP ${fault} fails closed and redacts token`, async f => { const x = await f.prepare(); const request = async (url, init) => { if (fault === 'throw') throw Error('fixture-token'); if (fault === 'redirect') return new Response('', { status: 302 }); if (fault === 'quota') return new Response('{}', { headers: { 'x-ratelimit-remaining': '0' } }); const response = await x.transports.request(url, init); const data = await response.json(); if (fault === 'repository' && !url.includes('/git/')) data.id = 333; if (fault === 'ref' && url.includes('/git/ref/')) data.object.sha = 'a'.repeat(40); return new Response(JSON.stringify(data), { headers: { 'x-ratelimit-remaining': '950' } }); }; const r = await launchNative(x.input, { ...x.transports, request }); assert.equal(r.lane, 'blocked'); assert.equal(r.protectedImported, false); assert.ok(!JSON.stringify(r).includes('fixture-token')); });
each('candidate origin mismatch blocks before external transport', async f => { const x = await f.prepare(); f.git('remote', 'set-url', 'origin', 'https://evil.example/paisaxe.git'); assert.equal((await launchNative(x.input, x.transports)).lane, 'blocked'); assert.equal(f.requests.length, 0); });
each('native context checkout mismatch blocks before import', async f => { const x = await f.prepare(); x.input.context.sha = x.base; const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'blocked'); assert.equal(r.protectedImported, false); });
each('modified protected module bytes block before import', async f => { f.git('checkout', '--quiet', '--force', '--detach', f.definition); await f.put('scripts/ci-fast.mjs', 'throw Error("wrong protected bytes")'); f.git('add', '.'); const changed = f.git('commit-tree', f.git('write-tree'), '-p', f.definition, '-m', 'changed module'); const x = await f.prepare('push', { definition: changed }); const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'blocked'); assert.equal(r.protectedImported, false); });
each('preload environment is rejected rather than trusted as clean Node startup', async f => { const x = await f.prepare(); const previous = process.env.NODE_OPTIONS; try { process.env.NODE_OPTIONS = '--require hostile.cjs'; assert.equal((await launchNative(x.input, x.transports)).lane, 'blocked'); } finally { if (previous === undefined) delete process.env.NODE_OPTIONS; else process.env.NODE_OPTIONS = previous; } });

each('first-install PR with counterfeit same-repository ID blocks before import', async f => { const x = await f.prepare('pull_request', { definition: f.absent }); x.input.event.pull_request.head.repo.id = 999; const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'blocked'); assert.equal(r.protectedImported, false); });

for (const sender of [user('outsider'), user('dependabot[bot]')]) each(`native ${sender.login} keeps hosted read-only untrusted lane`, async f => { const x = await f.prepare('push', { sender }); const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'untrusted'); assert.equal(r.allowPrivileged, false); assert.equal(r.runner, 'standard-hosted'); assert.equal(r.token, 'read-only'); assert.equal(r.reusable, false); });
each('same-owner fork PR cannot obtain a fast lane', async f => { const x = await f.prepare('pull_request', { fork: true }); const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'untrusted'); assert.equal(r.allowPrivileged, false); assert.equal(r.reusable, false); });
each('production push always returns release classification without Fast work', async f => { const x = await f.prepare(); x.input.event.ref = x.input.context.ref = 'refs/heads/main'; const request = async (url, init) => { const response = await x.transports.request(url, init); const data = await response.json(); if (url.endsWith('/git/ref/heads/main')) data.object.sha = x.source; return new Response(JSON.stringify(data), { headers: { 'x-ratelimit-remaining': '950' } }); }; const r = await launchNative(x.input, { ...x.transports, request }); assert.equal(r.lane, 'release'); assert.equal(r.releaseRequired, true); assert.equal(r.allowDeploy, true); assert.equal(r.completed, undefined); });
each('legacy installed nightly remains disabled without develop resolution', async f => { const x = await f.prepare('schedule'); x.input.mode = 'legacy'; const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'disabled'); assert.equal(r.protectedImported, false); assert.equal(f.requests.filter(x => x.url.endsWith('/git/ref/heads/develop')).length, 0); });
each('wrong authenticated immutable definition object blocks', async f => { const x = await f.prepare(); const request = async (url, init) => { if (url.includes('/git/commits/')) return new Response(JSON.stringify({ sha: x.source }), { headers: { 'x-ratelimit-remaining': '950' } }); return x.transports.request(url, init); }; const r = await launchNative(x.input, { ...x.transports, request }); assert.equal(r.lane, 'blocked'); assert.equal(r.protectedImported, false); });
each('oversized streamed HTTP body blocks before materialization', async f => { const x = await f.prepare(); const request = async () => new Response('x'.repeat(2000001), { headers: { 'x-ratelimit-remaining': '950' } }); const r = await launchNative(x.input, { ...x.transports, request }); assert.equal(r.lane, 'blocked'); assert.equal(r.protectedImported, false); });
each('hanging external HTTP honors acquisition timeout and hides authorization', async f => { const x = await f.prepare(); const started = performance.now(); const r = await launchNative(x.input, { ...x.transports, request: () => new Promise(() => {}) }); assert.equal(r.lane, 'blocked'); assert.equal(r.protectedImported, false); assert.ok(performance.now() - started < 6500); assert.ok(!JSON.stringify(r).includes('fixture-token')); });
each('physical graft cannot manufacture original PR parent admission', async f => { const x = await f.prepare('pull_request'); await f.put('.git/info/grafts', `${x.checkout} ${x.source} ${x.base}\n`); x.input.mode = 'legacy'; const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'full'); assert.equal(r.testedCheckoutSha, x.checkout); });
each('altered frozen bytes cannot import even with valid native module pins', async f => { f.git('checkout', '--quiet', '--force', '--detach', f.definition); await f.put('tests/fixtures/ci-cadence/events.json', '{}'); f.git('add', '.'); const changed = f.git('commit-tree', f.git('write-tree'), '-p', f.definition, '-m', 'changed frozen input'); const x = await f.prepare('push', { definition: changed }); const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'blocked'); assert.equal(r.protectedImported, false); });

each('canonical Actions checkout HTTPS origin without dot-git is accepted', async f => { const x = await f.prepare(); f.git('remote', 'set-url', 'origin', 'https://github.com/juan294/paisaxe'); x.input.mode = 'legacy'; const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'full'); });

each('wrong physical PR parent order blocks before HTTP or protected import', async f => { const x = await f.prepare('pull_request'); const wrong = f.git('commit-tree', f.git('rev-parse', `${x.checkout}^{tree}`), '-p', x.source, '-p', x.base, '-m', 'wrong physical parents'); f.git('checkout', '--quiet', '--force', '--detach', wrong); x.input.context.sha = wrong; const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'blocked'); assert.equal(r.protectedImported, false); assert.equal(f.requests.length, 0); });
each('missing mode cannot activate Fast or execute cheap works', async f => { const x = await f.prepare(); delete x.input.mode; const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'full'); assert.equal(r.completed, undefined); });
each('supplied resolver cannot replace the single authenticated scheduled snapshot', async f => { const x = await f.prepare('schedule'); x.input.resolveIntegrationHead = () => { throw Error('caller resolver used'); }; const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'nightly'); assert.equal(r.sourceSha, x.source); assert.equal(f.requests.filter(r => r.url.endsWith('/git/ref/heads/develop')).length, 1); });
each('streamed body timeout bounds reads as well as initial response', async f => { const x = await f.prepare(); const request = async () => new Response(new ReadableStream({ start() {}, cancel() { return new Promise(() => {}); } }), { headers: { 'x-ratelimit-remaining': '950' } }); const started = performance.now(); const r = await launchNative(x.input, { ...x.transports, request }); assert.equal(r.lane, 'blocked'); assert.equal(r.protectedImported, false); assert.ok(performance.now() - started < 6500); });
each('owned private store is removed after a blocked acquisition and the checkout is untouched', async f => { const x = await f.prepare('schedule'); x.transports.request = developAt(x, 'e'.repeat(40)); const before = new Set((await readdir(tmpdir())).filter(name => name.startsWith('paisaxe-launch-'))); const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'blocked'); assert.deepEqual((await readdir(tmpdir())).filter(name => name.startsWith('paisaxe-launch-') && !before.has(name)), []); assert.equal(f.git('rev-parse', 'HEAD'), x.base); });

each('first-install bot retains explicit hosted read-only untrusted outputs', async f => { const x = await f.prepare('push', { definition: f.absent, sender: user('dependabot[bot]') }); const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'untrusted'); assert.equal(r.runner, 'standard-hosted'); assert.equal(r.token, 'read-only'); assert.equal(r.acceptanceBlocked, true); assert.equal(r.allowPrivileged, false); });

each('first-install production owner preserves independent mandatory release outputs', async f => { const x = await f.prepare('push', { definition: f.absent }); x.input.event.ref = x.input.context.ref = 'refs/heads/main'; const request = async (url, init) => { const response = await x.transports.request(url, init); const data = await response.json(); if (url.endsWith('/git/ref/heads/main')) data.object.sha = x.source; return new Response(JSON.stringify(data), { headers: { 'x-ratelimit-remaining': '950' } }); }; const r = await launchNative(x.input, { ...x.transports, request }); assert.equal(r.lane, 'release'); assert.equal(r.releaseRequired, true); assert.equal(r.allowDeploy, true); assert.equal(r.allowPrivileged, true); assert.equal(r.protectedImported, false); });

for (const scenario of [
  { name: 'development HEAD', branch: 'develop', change: 'head' },
  { name: 'production HEAD', branch: 'main', change: 'head' },
  { name: 'development origin', branch: 'develop', change: 'origin' },
  { name: 'production origin', branch: 'main', change: 'origin' },
  { name: 'untrusted HEAD', branch: 'develop', change: 'head', sender: user('outsider') },
]) each(`first-install drift ${scenario.name} blocks before fallback privilege`, async f => {
  const x = await f.prepare('push', { definition: f.absent, sender: scenario.sender });
  x.input.mode = 'legacy';
  x.input.event.ref = x.input.context.ref = `refs/heads/${scenario.branch}`;
  let changed = false;
  const request = async (url, init) => {
    const response = await x.transports.request(url, init);
    const data = await response.json();
    if (url.endsWith(`/git/ref/heads/${scenario.branch}`)) data.object.sha = x.source;
    if (!changed) {
      changed = true;
      if (scenario.change === 'head') f.git('checkout', '--quiet', '--force', '--detach', x.base);
      else f.git('remote', 'set-url', 'origin', 'https://evil.example/paisaxe.git');
    }
    return new Response(JSON.stringify(data), { headers: { 'x-ratelimit-remaining': '950' } });
  };
  const r = await launchNative(x.input, { ...x.transports, request });
  assert.equal(changed, true);
  assert.equal(r.lane, 'blocked');
  assert.equal(r.protectedImported, false);
  assert.equal(r.allowDeploy, false);
  assert.equal(r.allowPrivileged, false);
});
for (const remaining of [50, 99, 100, 950, 999, 'garbage', "9007199254740992"]) each(`bootstrap reserve boundary ${remaining} preserves quota`, async f => {
  const x = await f.prepare(); x.input.mode = 'legacy';
  const request = async (url, init) => {
    const response = await x.transports.request(url, init);
    return new Response(await response.text(), { headers: { 'x-ratelimit-remaining': String(remaining) } });
  };
  const r = await launchNative(x.input, { ...x.transports, request });
  const admissible = Number.isSafeInteger(Number(remaining)) && Number(remaining) >= 100;
  assert.equal(r.lane, admissible ? 'full' : 'blocked');
  if (!admissible) assert.equal(r.protectedImported, false);
});

test('CLI scanner digest comes from actual supported runtime only', () => {
  for (const [platform, arch, expected] of [
    ['darwin', 'arm64', 'ba52fb1bfabbcde42f032afad3d6e0b19dff8ed105229a16e7caa338bbc0e84f'],
    ['linux', 'x64', '88f91962aa2f93ac6ab281d553b9e125f5197bbbce38f9f2437f7299c32e5509'],
    ['darwin', 'x64', null], ['linux', 'arm64', null], ['unsupported', 'x64', null],
  ]) {
    const p = Object.getOwnPropertyDescriptor(process, 'platform'), a = Object.getOwnPropertyDescriptor(process, 'arch');
    try { Object.defineProperty(process, 'platform', { ...p, value: platform }); Object.defineProperty(process, 'arch', { ...a, value: arch }); assert.equal(nativeScannerDigest(), expected); }
    finally { Object.defineProperty(process, 'platform', p); Object.defineProperty(process, 'arch', a); }
  }
});

each('shared expired launcher deadline blocks before any acquisition/import',async f=>{
 const x=await f.prepare();x.input.mode='legacy';x.input.deadline=performance.now()-1;
 const r=await launchNative(x.input,x.transports);assert.equal(r.lane,'blocked');assert.equal(r.protectedImported,false);assert.equal(f.requests.length,0);
});
