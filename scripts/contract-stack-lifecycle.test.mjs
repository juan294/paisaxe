import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrationInventory } from './run-contracts.mjs';
import { randomUUID } from 'node:crypto';
import {
  POLICY, UNKNOWN_PROCESS, acquireConsumerLease, isAlive, processIdentity, createLifecycleReceipt, disposeOwned, finishReusable, inspectOwnership, lifecycleRoot,
  readReceipt, recordInventory, releaseConsumerLease, runOneShot, setRecoveryHold, sweepOwnedStacks, updateReceipt,
} from './contract-stack-lifecycle.mjs';

const DAY = 86400000;
// Sweeps prune aged runner detail directories; tests must never scan the real temporary directory.
const ISOLATED_TMP = realpathSync(mkdtempSync(join(tmpdir(), 'contract-lifecycle-isolated-tmp-')));
process.on('exit', () => rmSync(ISOLATED_TMP, { recursive: true, force: true }));
const sweep = (options) => sweepOwnedStacks({ tmpRoot: ISOLATED_TMP, ...options });
const T0 = new Date('2026-10-14T12:00:00.000Z');
const at = (ms) => new Date(T0.getTime() + ms);
const hex = (c) => c.repeat(64);
const ALIVE = 'Wed Oct 14 12:00:00 2026';
// Process identity is a third-party boundary (ps); a fixed probe pins liveness.
const probe = (live) => (pid) => (live.has(pid) ? ALIVE : null);

/** In-memory Docker daemon for the exact CLI subset the lifecycle uses. */
function fakeDocker({ daemonId = 'daemon-a' } = {}) {
  const state = { daemonId, networks: new Map(), containers: new Map(), volumes: new Map(), calls: [], fail: null };
  const noSuch = (what) => Object.assign(new Error('docker failed'), { status: 1, stderr: `Error: No such ${what}` });
  const filterValue = (args, key) => args[args.indexOf('--filter') + 1].slice(key.length + 1);
  const docker = (args) => {
    state.calls.push(args);
    if (state.fail?.(args)) { state.fail = null; throw Object.assign(new Error('injected docker failure'), { status: 1, stderr: 'injected' }); }
    const [a, b, c] = args;
    if (a === 'info') return state.daemonId;
    if (a === 'network' && b === 'create') {
      const id = hex(String(state.networks.size + 1)); const name = args.at(-1);
      const label = args[args.indexOf('--label') + 1].split('=');
      state.networks.set(id, { Id: id, Name: name, Internal: args.includes('--internal'), Labels: { [label[0]]: label[1] }, Containers: {} });
      return id;
    }
    if (a === 'network' && b === 'inspect') {
      const net = state.networks.get(c) || [...state.networks.values()].find((n) => n.Name === c);
      if (!net) throw noSuch('network');
      // Like Docker, network inspect lists endpoints of running containers only.
      const Containers = Object.fromEntries([...state.containers.values()].filter((x) => x.State.Running && Object.keys(x.NetworkSettings.Networks).includes(net.Name)).map((x) => [x.Id, { Name: x.Name.slice(1) }]));
      return JSON.stringify([{ ...net, Containers }]);
    }
    if (a === 'network' && b === 'ls') return [...state.networks.values()].filter((n) => n.Name.includes(filterValue(args, 'name'))).map((n) => `${n.Id} ${n.Name}`).join('\n');
    if (a === 'network' && b === 'rm') {
      const net = state.networks.get(c); if (!net) throw noSuch('network');
      if ([...state.containers.values()].some((x) => Object.keys(x.NetworkSettings.Networks).includes(net.Name))) throw Object.assign(new Error('in use'), { stderr: 'has active endpoints' });
      state.networks.delete(c); return c;
    }
    if (a === 'ps') {
      const filter = args[args.indexOf('--filter') + 1];
      const all = [...state.containers.values()];
      const hits = filter.startsWith('label=com.supabase.cli.project=') ? all.filter((x) => x.Config.Labels['com.supabase.cli.project'] === filterValue(args, 'label=com.supabase.cli.project'))
        : filter.startsWith('volume=') ? all.filter((x) => x.Mounts.some((m) => m.Name === filterValue(args, 'volume')))
        : filter.startsWith('network=') ? all.filter((x) => { const ref = filterValue(args, 'network'); const net = state.networks.get(ref) || [...state.networks.values()].find((n) => n.Name === ref); return Boolean(net) && Object.keys(x.NetworkSettings.Networks).includes(net.Name); })
        : assert.fail('unexpected ps filter ' + filter);
      return hits.map((x) => x.Id).join('\n');
    }
    if (a === 'container' && b === 'inspect') {
      const x = state.containers.get(c) || [...state.containers.values()].find((y) => y.Name === '/' + c);
      if (!x) throw noSuch('container'); return JSON.stringify([x]);
    }
    if (a === 'stop') { for (const id of args.slice(3)) { const x = state.containers.get(id); if (!x) throw noSuch('container'); x.State.Running = false; } return ''; }
    if (a === 'rm') {
      assert.equal(args.length, 2, 'container removal must not use -v/-f or several targets');
      const x = state.containers.get(b); if (!x) throw noSuch('container');
      assert.equal(x.State.Running, false, 'a running container was removed'); state.containers.delete(b); return b;
    }
    if (a === 'volume' && b === 'ls') return [...state.volumes.values()].filter((v) => v.Labels?.['com.supabase.cli.project'] === filterValue(args, 'label=com.supabase.cli.project')).map((v) => v.Name).join('\n');
    if (a === 'volume' && b === 'inspect') { const v = state.volumes.get(c); if (!v) throw noSuch('volume'); return JSON.stringify([v]); }
    if (a === 'volume' && b === 'rm') {
      assert.equal(args.length, 3, 'volume removal must not force'); if (!state.volumes.has(c)) throw noSuch('volume');
      if ([...state.containers.values()].some((x) => x.Mounts.some((m) => m.Name === c))) throw Object.assign(new Error('in use'), { stderr: 'volume is in use' });
      state.volumes.delete(c); return c;
    }
    return assert.fail('unexpected docker call ' + args.join(' '));
  };
  const addContainer = (id, name, project, network, { mounts = [], running = true } = {}) => state.containers.set(id, {
    Id: id, Name: '/' + name, State: { Running: running }, Config: { Labels: project ? { 'com.supabase.cli.project': project } : {} },
    NetworkSettings: { Networks: { [network]: {} } }, Mounts: mounts.map((Name) => ({ Type: 'volume', Name })),
  });
  const addVolume = (name, labels, createdAt = '2026-10-14T11:00:00Z') => state.volumes.set(name, { Name: name, CreatedAt: createdAt, Labels: labels });
  // `supabase start` boundary: creates the owned project containers and volumes.
  const startProject = (projectId) => {
    addVolume(`supabase_db_${projectId}`, { 'com.supabase.cli.project': projectId });
    addVolume(hex('9').slice(0, 63) + projectId.slice(-1), { 'com.docker.volume.anonymous': '' });
    addContainer(hex('a').slice(0, 60) + projectId.slice(-4), `supabase_db_${projectId}`, projectId, projectId, { mounts: [`supabase_db_${projectId}`] });
    addContainer(hex('b').slice(0, 60) + projectId.slice(-4), `supabase_kong_${projectId}`, projectId, projectId, { mounts: [hex('9').slice(0, 63) + projectId.slice(-1)] });
  };
  return { state, docker, addContainer, addVolume, startProject };
}

function snapshot(state) {
  return JSON.stringify({ n: [...state.networks.keys()].sort(), c: [...state.containers.keys()].sort(), v: [...state.volumes.keys()].sort() });
}

function workspace(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'contract-lifecycle-test-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const taskDir = realpathSync(mkdtempSync(join(root, 'paisaxe-contracts-')));
  return { root: join(root, 'state'), taskDir };
}

/** Simulates prepare: receipt before allocation, then network + start + inventory. */
function preparedTask(t, fake, { disposable = true, owner = { pid: 4242, startedAt: ALIVE }, now = T0, project = 'paisaxe-contracts-0123456789ab' } = {}) {
  const { root, taskDir } = workspace(t);
  const nonce = randomUUID();
  createLifecycleReceipt(root, { projectId: project, nonce, taskDir, disposable, task: disposable ? 'one-shot' : 'reusable', candidate: { head: null },
    daemonId: fake.state.daemonId, stack: { apiUrl: 'http://127.0.0.1:30001', dbPort: 30002, migrationDigest: hex('d'), transport: 'docker-exec-v1' }, owner, now });
  const networkId = fake.docker(['network', 'create', '--internal', '--label', `com.paisaxe.contracts.nonce=${nonce}`, project]);
  updateReceipt(root, project, (r) => { r.resources.network = { id: networkId, name: project }; }, now);
  fake.startProject(project);
  recordInventory(root, project, fake.docker, now);
  updateReceipt(root, project, (r) => { r.state = 'prepared'; r.owner = owner; }, now);
  return { root, taskDir, project, nonce, networkId };
}

function unrelated(fake) {
  fake.addVolume('supabase_db_paisaxe', { 'com.supabase.cli.project': 'paisaxe' });
  fake.addContainer(hex('f'), 'supabase_db_paisaxe', 'paisaxe', 'bridge', { mounts: ['supabase_db_paisaxe'] });
  fake.state.networks.set(hex('7'), { Id: hex('7'), Name: 'paisaxe-contracts-bd3fec64bc09', Internal: true, Labels: { 'com.paisaxe.contracts.nonce': randomUUID() }, Containers: {} });
}

test('receipt is created exclusively before allocation and never overwritten', (t) => {
  const fake = fakeDocker(); const { root, taskDir } = workspace(t);
  const args = { projectId: 'paisaxe-contracts-aaaaaaaaaaaa', nonce: randomUUID(), taskDir, disposable: true, task: 'one-shot', candidate: {}, daemonId: 'daemon-a', now: T0, owner: { pid: 1, startedAt: ALIVE } };
  const receipt = createLifecycleReceipt(root, args);
  assert.equal(receipt.state, 'preparing'); assert.deepEqual(receipt.resources, { network: null, containers: [], volumes: [] });
  assert.equal(readFileSync(join(root, 'tasks', args.projectId + '.json'), 'utf8').includes('"preparing"'), true);
  assert.throws(() => createLifecycleReceipt(root, args), /EEXIST|exists/);
  assert.throws(() => createLifecycleReceipt(root, { ...args, projectId: 'paisaxe' }), /project/);
  assert.throws(() => createLifecycleReceipt(root, { ...args, projectId: 'paisaxe-contracts-bbbbbbbbbbbb', nonce: 'x' }), /nonce/);
  assert.equal(fake.state.calls.length, 0);
});

test('lifecycle root defaults outside the task payload and honors the override', () => {
  assert.equal(lifecycleRoot({ PAISAXE_CONTRACT_LIFECYCLE_DIR: '/tmp/x' }), '/tmp/x');
  assert.match(lifecycleRoot({ HOME: '/Users/someone' }), /\/\.local\/state\/paisaxe\/contract-stacks$/);
});

test('successful disposable disposal removes only owned containers, network and volumes, then archives', async (t) => {
  const fake = fakeDocker(); unrelated(fake);
  const { root, taskDir, project } = preparedTask(t, fake);
  const before = snapshot(fake.state);
  writeFileSync(join(taskDir, 'contracts-stack.json'), '{}');
  const terminal = await disposeOwned(root, project, { docker: fake.docker, now: at(1000), processProbe: probe(new Set()) });
  assert.equal(terminal.terminalState, 'disposed');
  assert.equal([...fake.state.containers.keys()].join(), hex('f'));
  assert.deepEqual([...fake.state.volumes.keys()], ['supabase_db_paisaxe']);
  assert.deepEqual([...fake.state.networks.keys()], [hex('7')]);
  assert.notEqual(snapshot(fake.state), before);
  assert.equal(readReceipt(root, project), null, 'private receipt removed after archive');
  assert.equal(existsSync(taskDir), false, 'owned task payload removed');
  const archived = JSON.parse(readFileSync(join(root, 'terminal', project + '.json'), 'utf8'));
  assert.equal(archived.terminalState, 'disposed'); assert.equal(archived.expiresAt, at(1000 + POLICY.terminalRetentionMs).toISOString());
  assert.equal(JSON.stringify(archived).includes('nonce'), false, 'terminal receipt is sanitized');
  assert.ok(fake.state.calls.every((args) => !args.includes('-v') && !args.includes('-f') && !args.includes('--force') && args[1] !== 'prune'));
});

for (const scenario of ['wrong nonce', 'remote/changed daemon', 'new network consumer', 'stopped network consumer', 'foreign volume consumer', 'unrecorded project container', 'same-name replacement', 'replaced volume', 'missing proof']) {
  test('disposal refuses with zero mutations: ' + scenario, async (t) => {
    const fake = fakeDocker(); unrelated(fake);
    const { root, project, networkId } = preparedTask(t, fake);
    const ownedDb = [...fake.state.containers.values()].find((x) => x.Name === `/supabase_db_${project}`);
    if (scenario === 'wrong nonce') fake.state.networks.get(networkId).Labels['com.paisaxe.contracts.nonce'] = randomUUID();
    if (scenario === 'remote/changed daemon') fake.state.daemonId = 'daemon-b';
    if (scenario === 'new network consumer') fake.addContainer(hex('3'), 'intruder', null, project);
    if (scenario === 'stopped network consumer') fake.addContainer(hex('2'), 'stopped-intruder', null, project, { running: false });
    if (scenario === 'foreign volume consumer') fake.addContainer(hex('4'), 'reader', null, 'bridge', { mounts: [`supabase_db_${project}`] });
    if (scenario === 'unrecorded project container') fake.addContainer(hex('5'), `supabase_rest_${project}`, project, project);
    if (scenario === 'same-name replacement') { fake.state.containers.delete(ownedDb.Id); fake.addContainer(hex('6'), ownedDb.Name.slice(1), null, 'bridge'); }
    if (scenario === 'replaced volume') fake.state.volumes.get(`supabase_db_${project}`).CreatedAt = '2026-10-15T00:00:00Z';
    if (scenario === 'missing proof') updateReceipt(root, project, (r) => { delete r.daemonId; }, T0);
    const before = snapshot(fake.state);
    const mutations = () => fake.state.calls.filter((args) => ['stop', 'rm'].includes(args[0]) || args[1] === 'rm').length;
    const baseline = mutations();
    await assert.rejects(disposeOwned(root, project, { docker: fake.docker, now: at(1000), processProbe: probe(new Set()) }), /refused|proof/i);
    assert.equal(mutations(), baseline); assert.equal(snapshot(fake.state), before);
    assert.notEqual(readReceipt(root, project), null, 'receipt retained for inspection');
  });
}

test('default Docker factory refuses a remote daemon before any command', async () => {
  const { createDocker } = await import('./contract-stack-lifecycle.mjs');
  await assert.rejects(createDocker({ PATH: process.env.PATH, DOCKER_HOST: 'tcp://10.0.0.1:2375' }), /remote Docker daemon/);
});

test('interrupted disposal persists outcomes and the scheduled sweep resumes it without touching unrelated resources', async (t) => {
  const fake = fakeDocker(); unrelated(fake);
  const { root, project } = preparedTask(t, fake);
  fake.state.fail = (args) => args[0] === 'network' && args[1] === 'rm';
  await assert.rejects(disposeOwned(root, project, { docker: fake.docker, now: at(1000), processProbe: probe(new Set()) }), /injected/);
  const interrupted = readReceipt(root, project);
  assert.equal(interrupted.state, 'disposing');
  assert.ok(Object.values(interrupted.disposal.outcomes).filter((v) => v === 'removed').length >= 2, 'container removals recorded');
  assert.equal(fake.state.containers.size, 1);
  const report = await sweep({ root, docker: fake.docker, now: at(2000), processProbe: probe(new Set()) });
  assert.equal(report.tasks.find((x) => x.projectId === project).action, 'disposed');
  assert.equal(readReceipt(root, project), null);
  assert.equal([...fake.state.containers.keys()].join(), hex('f'));
  assert.deepEqual([...fake.state.volumes.keys()], ['supabase_db_paisaxe']);
  assert.deepEqual(report.legacy.map((x) => x.name), ['paisaxe-contracts-bd3fec64bc09']);
  assert.equal(report.legacy[0].action, 'inventory-only');
  assert.ok(fake.state.networks.has(hex('7')), 'legacy network without proof preserved');
});

test('preparation re-records identities recreated by its own reset so disposal still succeeds', async (t) => {
  const fake = fakeDocker(); unrelated(fake);
  const { root, project } = preparedTask(t, fake);
  // `supabase db reset` replaces the DB container and its labelled volume under the same names.
  const old = [...fake.state.containers.values()].find((x) => x.Name === `/supabase_db_${project}`);
  fake.state.containers.delete(old.Id);
  fake.state.volumes.get(`supabase_db_${project}`).CreatedAt = '2026-10-14T11:30:00Z';
  fake.addContainer(hex('8'), `supabase_db_${project}`, project, project, { mounts: [`supabase_db_${project}`] });
  await assert.rejects(disposeOwned(root, project, { docker: fake.docker, now: at(1), processProbe: probe(new Set()) }), /refused/);
  recordInventory(root, project, fake.docker, at(2));
  const receipt = readReceipt(root, project);
  assert.equal(receipt.resources.volumes.find((v) => v.name === `supabase_db_${project}`).createdAt, '2026-10-14T11:30:00Z');
  assert.ok(receipt.resources.containers.some((x) => x.id === old.Id), 'earlier identity stays recorded');
  await disposeOwned(root, project, { docker: fake.docker, now: at(3), processProbe: probe(new Set()) });
  assert.equal([...fake.state.containers.keys()].join(), hex('f')); assert.deepEqual([...fake.state.volumes.keys()], ['supabase_db_paisaxe']);
});

test('re-recording never adopts an unlabelled same-name volume', (t) => {
  const fake = fakeDocker();
  const { root, project } = preparedTask(t, fake);
  const anon = readReceipt(root, project).resources.volumes.find((v) => v.anonymous);
  fake.state.volumes.get(anon.name).CreatedAt = '2026-10-14T11:45:00Z';
  for (const x of fake.state.containers.values()) x.Mounts = [];
  recordInventory(root, project, fake.docker, at(1));
  assert.equal(readReceipt(root, project).resources.volumes.find((v) => v.name === anon.name).createdAt, anon.createdAt);
});

test('stopped stack with an expired relay is inspectable and disposable without restarting services', async (t) => {
  const fake = fakeDocker();
  const { root, taskDir, project } = preparedTask(t, fake);
  for (const x of fake.state.containers.values()) x.State.Running = false;
  const inspection = inspectOwnership(root, project, { docker: fake.docker });
  assert.equal(inspection.relay, 'absent');
  assert.equal(inspection.containers.every((x) => x.present && x.running === false && x.sameIdentity), true);
  assert.equal(inspection.network.present, true); assert.equal(inspection.network.nonceMatches, true);
  assert.equal(fake.state.calls.some((args) => ['start', 'restart'].includes(args[0])), false);
  writeFileSync(join(taskDir, 'transport.sock'), ''); // stale socket file of an expired relay
  let relayStops = 0;
  const stopRelay = async () => { relayStops++; throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }); };
  await disposeOwned(root, project, { docker: fake.docker, now: at(1000), processProbe: probe(new Set()), stopRelay });
  assert.equal(relayStops, 1); assert.equal(fake.state.containers.size, 0);
  assert.equal(fake.state.calls.some((args) => args[0] === 'stop'), false, 'already-stopped containers are not stopped again');
});

test('relay identity mismatch refuses disposal instead of orphaning a live relay', async (t) => {
  const fake = fakeDocker();
  const { root, taskDir, project } = preparedTask(t, fake);
  writeFileSync(join(taskDir, 'transport.sock'), '');
  const before = snapshot(fake.state);
  await assert.rejects(disposeOwned(root, project, { docker: fake.docker, now: at(1000), processProbe: probe(new Set()), stopRelay: async () => { throw new Error('Transport identity/source mismatch'); } }), /relay/i);
  assert.equal(snapshot(fake.state), before);
});

test('consumer leases block disposal while live, dead leases are released by the sweep', async (t) => {
  const fake = fakeDocker();
  const { root, project } = preparedTask(t, fake, { owner: { pid: 4242, startedAt: ALIVE } });
  updateReceipt(root, project, (r) => { r.state = 'failed'; r.failedAt = T0.toISOString(); r.retainUntil = at(POLICY.failedRetentionMs).toISOString(); }, T0);
  const lease = acquireConsumerLease(root, project, 'paid-voice', { owner: { pid: 777, startedAt: ALIVE }, now: T0 });
  assert.equal(readReceipt(root, project).leases.length, 1);
  await assert.rejects(disposeOwned(root, project, { docker: fake.docker, now: at(8 * DAY), processProbe: probe(new Set([777])) }), /live consumer lease/);
  let report = await sweep({ root, docker: fake.docker, now: at(8 * DAY), processProbe: probe(new Set([777])) });
  assert.equal(report.tasks[0].action, 'preserve'); assert.match(report.tasks[0].reason, /live consumer lease/);
  assert.equal(fake.state.containers.size, 2);
  report = await sweep({ root, docker: fake.docker, now: at(8 * DAY), processProbe: probe(new Set()) });
  assert.equal(report.tasks[0].releasedDeadLeases, 1); assert.equal(report.tasks[0].action, 'disposed');
  assert.equal(fake.state.containers.size, 0);
  assert.doesNotThrow(() => releaseConsumerLease(root, lease), 'release after disposal is idempotent');
});

test('legacy task without a lifecycle receipt takes no lease', (t) => {
  const { root } = workspace(t);
  assert.equal(acquireConsumerLease(root, 'paisaxe-contracts-cccccccccccc', 'contracts'), null);
  assert.doesNotThrow(() => releaseConsumerLease(root, null));
});

test('recovery hold blocks expiry until released', async (t) => {
  const fake = fakeDocker();
  const { root, project } = preparedTask(t, fake);
  updateReceipt(root, project, (r) => { r.state = 'failed'; r.retainUntil = at(POLICY.failedRetentionMs).toISOString(); }, T0);
  setRecoveryHold(root, project, 'investigating migration 140', at(1));
  let report = await sweep({ root, docker: fake.docker, now: at(30 * DAY), processProbe: probe(new Set()) });
  assert.equal(report.tasks[0].action, 'preserve'); assert.match(report.tasks[0].reason, /recovery hold/);
  setRecoveryHold(root, project, null, at(2));
  report = await sweep({ root, docker: fake.docker, now: at(30 * DAY), processProbe: probe(new Set()) });
  assert.equal(report.tasks[0].action, 'disposed');
});

test('failed disposable task is preserved for exactly seven days, then removed; terminal receipt survives 30 days', async (t) => {
  const fake = fakeDocker(); unrelated(fake);
  const { root, project } = preparedTask(t, fake);
  updateReceipt(root, project, (r) => { r.state = 'failed'; r.failedAt = T0.toISOString(); r.retainUntil = at(POLICY.failedRetentionMs).toISOString(); }, T0);
  let report = await sweep({ root, docker: fake.docker, now: at(POLICY.failedRetentionMs - 1), processProbe: probe(new Set()) });
  assert.equal(report.tasks[0].action, 'preserve'); assert.equal(fake.state.containers.size, 3);
  report = await sweep({ root, docker: fake.docker, now: at(POLICY.failedRetentionMs), processProbe: probe(new Set()) });
  assert.equal(report.tasks[0].action, 'disposed'); assert.equal(fake.state.containers.size, 1);
  const terminal = join(root, 'terminal', project + '.json');
  assert.equal(JSON.parse(readFileSync(terminal, 'utf8')).priorState, 'failed');
  const disposedAt = at(POLICY.failedRetentionMs).getTime() - T0.getTime();
  report = await sweep({ root, docker: fake.docker, now: at(disposedAt + POLICY.terminalRetentionMs - 1), processProbe: probe(new Set()) });
  assert.equal(existsSync(terminal), true);
  report = await sweep({ root, docker: fake.docker, now: at(disposedAt + POLICY.terminalRetentionMs), processProbe: probe(new Set()) });
  assert.deepEqual(report.prunedTerminal, [project]); assert.equal(existsSync(terminal), false);
  assert.ok(existsSync(join(root, 'sweep-latest.json')), 'latest sweep receipt written');
});

test('interrupted task with a dead owner becomes abandoned after 24 hours and expires seven days later', async (t) => {
  const fake = fakeDocker();
  const { root, project } = preparedTask(t, fake);
  updateReceipt(root, project, (r) => { r.state = 'running'; }, T0);
  let report = await sweep({ root, docker: fake.docker, now: at(POLICY.abandonAfterMs - 1), processProbe: probe(new Set()) });
  assert.equal(report.tasks[0].action, 'preserve'); assert.equal(readReceipt(root, project).state, 'running');
  report = await sweep({ root, docker: fake.docker, now: at(POLICY.abandonAfterMs), processProbe: probe(new Set()) });
  assert.equal(report.tasks[0].action, 'abandoned');
  const abandoned = readReceipt(root, project);
  assert.equal(abandoned.state, 'abandoned'); assert.equal(abandoned.retainUntil, at(POLICY.abandonAfterMs + POLICY.failedRetentionMs).toISOString());
  assert.equal(JSON.parse(readFileSync(join(root, 'terminal', project + '.json'), 'utf8')).terminalState, 'abandoned');
  report = await sweep({ root, docker: fake.docker, now: at(POLICY.abandonAfterMs + POLICY.failedRetentionMs - 1), processProbe: probe(new Set()) });
  assert.equal(fake.state.containers.size, 2);
  report = await sweep({ root, docker: fake.docker, now: at(POLICY.abandonAfterMs + POLICY.failedRetentionMs), processProbe: probe(new Set()) });
  assert.equal(report.tasks[0].action, 'disposed'); assert.equal(fake.state.containers.size, 0);
});

test('live owner keeps an in-progress task regardless of age', async (t) => {
  const fake = fakeDocker();
  const { root, project } = preparedTask(t, fake, { owner: { pid: 5, startedAt: ALIVE } });
  updateReceipt(root, project, (r) => { r.state = 'running'; }, T0);
  const report = await sweep({ root, docker: fake.docker, now: at(60 * DAY), processProbe: probe(new Set([5])) });
  assert.equal(report.tasks[0].action, 'live'); assert.equal(fake.state.containers.size, 2);
});

test('reusable stacks never expire automatically; idle reminder is visible; explicit finish enables disposal', async (t) => {
  const fake = fakeDocker();
  const { root, project } = preparedTask(t, fake, { disposable: false });
  let report = await sweep({ root, docker: fake.docker, now: at(POLICY.idleReminderMs - 1), processProbe: probe(new Set()) });
  assert.equal(report.tasks[0].action, 'live');
  report = await sweep({ root, docker: fake.docker, now: at(365 * DAY), processProbe: probe(new Set()) });
  assert.equal(report.tasks[0].action, 'reminder'); assert.match(report.tasks[0].reason, /contracts:finish -- paisaxe-contracts-0123456789ab/);
  assert.equal(fake.state.containers.size, 2);
  await assert.rejects(disposeOwned(root, project, { docker: fake.docker, now: at(1), processProbe: probe(new Set()) }), /explicit finish/);
  const lease = acquireConsumerLease(root, project, 'contracts', { owner: { pid: 9, startedAt: ALIVE }, now: at(1) });
  await assert.rejects(finishReusable(root, project, { docker: fake.docker, now: at(2), processProbe: probe(new Set([9])) }), /live consumer lease/);
  assert.equal(readReceipt(root, project).state, 'prepared', 'refused finish does not change state');
  releaseConsumerLease(root, lease, at(3));
  const terminal = await finishReusable(root, project, { docker: fake.docker, now: at(4), processProbe: probe(new Set()) });
  assert.equal(terminal.terminalState, 'disposed'); assert.equal(fake.state.containers.size, 0); assert.equal(fake.state.volumes.size, 0);
});

test('reusable lease marks the stack as in use and is refused once disposal started', (t) => {
  const fake = fakeDocker();
  const { root, project } = preparedTask(t, fake, { disposable: false });
  const lease = acquireConsumerLease(root, project, 'contracts', { owner: { pid: 9, startedAt: ALIVE }, now: at(10) });
  releaseConsumerLease(root, lease, at(20));
  assert.equal(readReceipt(root, project).lastUsedAt, at(20).toISOString());
  updateReceipt(root, project, (r) => { r.state = 'disposing'; }, at(21));
  assert.throws(() => acquireConsumerLease(root, project, 'contracts', { owner: { pid: 9, startedAt: ALIVE }, now: at(22) }), /being disposed/);
});

test('unreadable or proofless receipts stay unknown and inventory-only', async (t) => {
  const fake = fakeDocker();
  const { root, project } = preparedTask(t, fake);
  updateReceipt(root, project, (r) => { delete r.nonce; r.state = 'failed'; r.retainUntil = T0.toISOString(); }, T0);
  writeFileSync(join(root, 'tasks', 'paisaxe-contracts-ffffffffffff.json'), '{not json');
  const report = await sweep({ root, docker: fake.docker, now: at(30 * DAY), processProbe: probe(new Set()) });
  assert.deepEqual(report.tasks.map((x) => x.action).sort(), ['inventory-only', 'inventory-only']);
  assert.equal(fake.state.containers.size, 2);
});

test('dry-run sweep reports decisions without mutating receipts or Docker', async (t) => {
  const fake = fakeDocker();
  const { root, project } = preparedTask(t, fake);
  updateReceipt(root, project, (r) => { r.state = 'failed'; r.retainUntil = T0.toISOString(); }, T0);
  const before = readFileSync(join(root, 'tasks', project + '.json'), 'utf8');
  const report = await sweep({ root, docker: fake.docker, now: at(DAY), processProbe: probe(new Set()), dryRun: true });
  assert.equal(report.tasks[0].action, 'would-dispose');
  assert.equal(readFileSync(join(root, 'tasks', project + '.json'), 'utf8'), before); assert.equal(fake.state.containers.size, 2);
});

function oneShotHarness(t, { prepareFails = false, runResult = 'passed', runThrows = false, disposeFails = false } = {}) {
  const fake = fakeDocker(); unrelated(fake);
  const { root } = workspace(t);
  const calls = [];
  const prepare = async (_root, { lifecycle }) => {
    calls.push('prepare'); assert.equal(lifecycle.disposable, true); assert.equal(lifecycle.root, root);
    const taskDir = realpathSync(mkdtempSync(join(tmpdir(), 'paisaxe-contracts-'))); t.after(() => rmSync(taskDir, { recursive: true, force: true }));
    const project = 'paisaxe-contracts-' + 'e'.repeat(12); const nonce = randomUUID();
    createLifecycleReceipt(root, { projectId: project, nonce, taskDir, disposable: true, task: 'one-shot', candidate: {}, daemonId: 'daemon-a', owner: { pid: process.pid, startedAt: ALIVE }, now: T0 });
    const networkId = fake.docker(['network', 'create', '--internal', '--label', `com.paisaxe.contracts.nonce=${nonce}`, project]);
    updateReceipt(root, project, (r) => { r.resources.network = { id: networkId, name: project }; }, T0);
    fake.startProject(project); recordInventory(root, project, fake.docker, T0);
    if (prepareFails) {
      updateReceipt(root, project, (r) => { r.state = 'preparation-failed'; r.failedAt = T0.toISOString(); r.retainUntil = at(POLICY.failedRetentionMs).toISOString(); }, T0);
      throw Object.assign(new Error(`Task stack preparation failed; no contract acceptance. Local-only recovery receipt: ${taskDir}/preparation-failed.json`), { projectId: project, taskDir });
    }
    updateReceipt(root, project, (r) => { r.state = 'prepared'; }, T0);
    return { projectId: project, taskDir, nonce };
  };
  const run = async ({ taskDir }) => {
    calls.push('run'); assert.ok(taskDir);
    assert.equal(readReceipt(root, 'paisaxe-contracts-' + 'e'.repeat(12)).leases.length, 1, 'one-shot holds a consumer lease while contracts run');
    if (runThrows) throw new Error('private runner crash');
    return { status: runResult, suites: ['s'], cases: [{ cases: ['a'] }], projectId: 'paisaxe-contracts-' + 'e'.repeat(12), receiptPath: join(taskDir, 'private-receipt.json') };
  };
  if (disposeFails) fake.state.fail = (args) => args[0] === 'rm';
  return { fake, root, calls, options: { lifecycleDir: root, prepare, run, docker: fake.docker, now: () => at(1000), processProbe: probe(new Set()) } };
}

test('one-shot success: prepare -> contracts -> archive -> release lease -> dispose leaves zero owned resources', async (t) => {
  const h = oneShotHarness(t);
  const result = await runOneShot(h.options);
  assert.equal(result.ok, true); assert.equal(result.contracts, 'passed'); assert.equal(result.cleanup, 'disposed');
  assert.deepEqual(h.calls, ['prepare', 'run']);
  assert.equal([...h.fake.state.containers.keys()].join(), hex('f'));
  assert.deepEqual([...h.fake.state.volumes.keys()], ['supabase_db_paisaxe']);
  assert.ok(h.fake.state.networks.has(hex('7')));
  const archived = JSON.parse(readFileSync(join(h.root, 'terminal', result.projectId + '.json'), 'utf8'));
  assert.equal(archived.result.status, 'passed'); assert.equal(archived.result.caseCount, 1);
  assert.equal(JSON.stringify(archived).includes('private'), false);
});

for (const [name, opts] of [['contract failure', { runResult: 'failed' }], ['runner crash', { runThrows: true }]]) {
  test('one-shot test failure is never hidden by cleanup and preserves stopped resources for diagnosis: ' + name, async (t) => {
    const h = oneShotHarness(t, opts);
    const result = await runOneShot(h.options);
    assert.equal(result.ok, false); assert.equal(result.contracts, 'failed'); assert.equal(result.cleanup, 'preserved');
    assert.equal(result.retainUntil, at(1000 + POLICY.failedRetentionMs).toISOString());
    const receipt = readReceipt(h.root, result.projectId);
    assert.equal(receipt.state, 'failed'); assert.equal(receipt.leases.length, 0, 'lease released after archive');
    assert.equal(h.fake.state.containers.size, 3, 'owned containers preserved');
    assert.equal([...h.fake.state.containers.values()].filter((x) => x.Name.endsWith(result.projectId)).every((x) => x.State.Running === false), true, 'preserved containers stopped');
    assert.equal(h.fake.state.containers.get(hex('f')).State.Running, true, 'unrelated container untouched');
    assert.equal(JSON.parse(readFileSync(join(h.root, 'terminal', result.projectId + '.json'), 'utf8')).terminalState, 'failed');
  });
}

test('one-shot cleanup failure cannot report success even when contracts passed', async (t) => {
  const h = oneShotHarness(t, { disposeFails: true });
  const result = await runOneShot(h.options);
  assert.equal(result.contracts, 'passed'); assert.equal(result.cleanup, 'failed'); assert.equal(result.ok, false);
  assert.equal(readReceipt(h.root, result.projectId).state, 'disposing', 'interrupted disposal stays resumable');
  const report = await sweep({ root: h.root, docker: h.fake.docker, now: at(2000), processProbe: probe(new Set()) });
  assert.equal(report.tasks[0].action, 'disposed'); assert.equal(h.fake.state.containers.size, 1);
});

test('one-shot preparation failure keeps its useful receipt and reports cleanup eligibility', async (t) => {
  const h = oneShotHarness(t, { prepareFails: true });
  const result = await runOneShot(h.options);
  assert.equal(result.ok, false); assert.equal(result.contracts, 'not-run'); assert.equal(result.failure, 'preparation');
  assert.equal(result.cleanup, 'preserved'); assert.equal(result.retainUntil, at(POLICY.failedRetentionMs).toISOString());
  const receipt = readReceipt(h.root, result.projectId);
  assert.equal(receipt.state, 'preparation-failed');
  assert.equal(receipt.resources.containers.length, 2); assert.ok(receipt.resources.network.id);
  assert.deepEqual(h.calls, ['prepare']);
});

// Reusable callers: real runContracts and the paid-voice script take and release a lease.
function leaseObservingDocker(t, { manifestOverrides = {} } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'contract-lease-caller-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const state = join(root, 'state'); const bin = join(root, 'bin'); mkdirSync(bin);
  const taskDir = realpathSync(mkdtempSync(join(root, 'paisaxe-contracts-')));
  const projectId = 'paisaxe-contracts-' + 'd'.repeat(12); const nonce = randomUUID();
  // No relay transport: admission reaches Docker inspection directly. Real candidate migrations pass the digest check.
  const repository = fileURLToPath(new URL('..', import.meta.url));
  const manifest = { version: 1, taskDir, projectId, nonce, apiUrl: 'http://127.0.0.1:30101', dbPort: 30102, migrationDigest: migrationInventory(repository).digest, schemaDigest: hex('2'), ...manifestOverrides };
  writeFileSync(join(taskDir, 'contracts-stack.json'), JSON.stringify(manifest));
  mkdirSync(join(taskDir, 'supabase')); writeFileSync(join(taskDir, 'supabase/config.toml'), `project_id = "${projectId}"\n`);
  createLifecycleReceipt(state, { projectId, nonce, taskDir, disposable: false, task: 'reusable', candidate: {}, daemonId: 'daemon-a', now: T0, owner: { pid: 1, startedAt: ALIVE } });
  updateReceipt(state, projectId, (r) => { r.state = 'prepared'; }, T0);
  const log = join(root, 'observed.jsonl');
  // The fake docker records the lease state it observes, then fails like an unavailable daemon.
  writeFileSync(join(bin, 'docker'), `#!/usr/bin/env node
const fs=require('node:fs');const args=process.argv.slice(2);
if(args[0]==='context'){console.log('[{"Endpoints":{"docker":{"Host":"unix:///tmp/fixture.sock"}}}]');process.exit(0);}
const r=JSON.parse(fs.readFileSync(${JSON.stringify(join(state, 'tasks', projectId + '.json'))},'utf8'));
fs.appendFileSync(${JSON.stringify(log)},JSON.stringify({args,leases:r.leases.map(l=>l.purpose)})+'\\n');process.exit(1);`);
  chmodSync(join(bin, 'docker'), 0o755);
  const env = { ...process.env, PATH: bin + ':' + process.env.PATH, PAISAXE_CONTRACT_LIFECYCLE_DIR: state, CONTRACT_STACK_DIR: taskDir, TEST_RECEIPT_DIR: join(root, 'receipts') };
  const observed = () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').map((line) => JSON.parse(line)) : []);
  return { state, projectId, taskDir, env, observed };
}

test('plain runContracts holds a consumer lease while using the stack and releases it on failure; the stack survives', (t) => {
  const h = leaseObservingDocker(t);
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `import {runContracts} from ${JSON.stringify(new URL('./run-contracts.mjs', import.meta.url).href)};const r=await runContracts({taskDir:process.env.CONTRACT_STACK_DIR,outputDir:process.env.TEST_RECEIPT_DIR});console.log(r.status);`],
    { cwd: fileURLToPath(new URL('..', import.meta.url)), env: h.env, encoding: 'utf8', timeout: 60000 });
  assert.match(child.stdout, /failed/, child.stderr);
  const seen = h.observed();
  assert.ok(seen.length > 0, 'runner reached Docker'); assert.ok(seen.every((x) => x.leases.includes('contracts')), JSON.stringify(seen));
  const after = readReceipt(h.state, h.projectId);
  assert.equal(after.leases.length, 0); assert.equal(after.state, 'prepared'); assert.ok(after.lastUsedAt);
});

test('paid-voice runner holds a consumer lease and releases it when the stack check fails; the stack survives', (t) => {
  const h = leaseObservingDocker(t);
  const child = spawnSync(process.execPath, [fileURLToPath(new URL('./run-paid-voice-local.mjs', import.meta.url))],
    { cwd: fileURLToPath(new URL('..', import.meta.url)), env: h.env, encoding: 'utf8', timeout: 60000 });
  assert.notEqual(child.status, 0);
  const seen = h.observed();
  assert.ok(seen.length > 0, child.stderr); assert.ok(seen.every((x) => x.leases.includes('paid-voice')), JSON.stringify(seen));
  const after = readReceipt(h.state, h.projectId);
  assert.equal(after.leases.length, 0); assert.equal(after.state, 'prepared');
  assert.deepEqual(readdirSync(join(h.state, 'tasks')).filter((name) => name.endsWith('.lock')), []);
});

test('CLI one-shot completes module loading (no import-cycle deadlock) and reports a preparation failure', (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'contract-lifecycle-cli-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'bin'));
  // Local daemon context resolves, then the daemon identity probe fails before any allocation.
  writeFileSync(join(root, 'bin/docker'), `#!/usr/bin/env node
const args=process.argv.slice(2);if(args[0]==='context'){console.log('[{"Endpoints":{"docker":{"Host":"unix:///tmp/fixture.sock"}}}]');process.exit(0);}
if(['network','ps','volume','stop','rm'].includes(args[0])){console.error('unexpected allocation '+args.join(' '));process.exit(9);}process.exit(1);`);
  chmodSync(join(root, 'bin/docker'), 0o755);
  const child = spawnSync(process.execPath, [fileURLToPath(new URL('./contract-stack-lifecycle.mjs', import.meta.url)), 'one-shot'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8', timeout: 60000,
    env: { ...process.env, PATH: join(root, 'bin') + ':' + process.env.PATH, PAISAXE_CONTRACT_LIFECYCLE_DIR: join(root, 'state') } });
  const result = JSON.parse(child.stdout);
  const taskDir = /receipt: (.+)\/preparation-failed\.json/.exec(result.detail)?.[1];
  if (taskDir) rmSync(taskDir, { recursive: true, force: true });
  assert.equal(child.status, 1, child.stderr); assert.equal(result.ok, false); assert.equal(result.failure, 'preparation'); assert.equal(result.contracts, 'not-run');
  assert.equal(existsSync(join(root, 'state', 'tasks')), false, 'no receipt without a daemon identity');
});


test('real process probe: current process has a stable identity; an exited PID is explicitly dead', async () => {
  const first = processIdentity(process.pid);
  assert.equal(typeof first, 'string'); assert.notEqual(first, UNKNOWN_PROCESS); assert.equal(processIdentity(process.pid), first);
  assert.equal(isAlive({ pid: process.pid, startedAt: first }, processIdentity), true);
  const child = spawnSync(process.execPath, ['-e', 'console.log(process.pid)'], { encoding: 'utf8' });
  const dead = Number(child.stdout.trim());
  assert.equal(processIdentity(dead), null, 'no such process');
  assert.equal(isAlive({ pid: dead, startedAt: first }, processIdentity), false);
});

test('only explicit absence or a different start time proves a dead owner; unknown probe results count as alive', () => {
  assert.equal(isAlive({ pid: 10, startedAt: ALIVE }, () => UNKNOWN_PROCESS), true);
  assert.equal(isAlive({ pid: 10, startedAt: null }, () => 'Thu Jan  1 00:00:00 2026'), true, 'no recorded start time: cannot prove reuse');
  assert.equal(isAlive({ pid: 10, startedAt: ALIVE }, () => 'Thu Jan  1 00:00:00 2026'), false, 'PID reused by another process');
  assert.equal(isAlive({ pid: 10, startedAt: ALIVE }, () => null), false);
});

for (const late of ['lease', 'recovery hold']) {
  test('a ' + late + ' that appears after the pre-check still blocks disposal inside the locked transition', async (t) => {
    const fake = fakeDocker();
    const { root, taskDir, project } = preparedTask(t, fake);
    writeFileSync(join(taskDir, 'transport.sock'), '');
    const before = snapshot(fake.state);
    const stopRelay = async () => {
      if (late === 'lease') acquireConsumerLease(root, project, 'paid-voice', { owner: { pid: 777, startedAt: ALIVE }, now: at(1) });
      else setRecoveryHold(root, project, 'late hold', at(1));
    };
    await assert.rejects(disposeOwned(root, project, { docker: fake.docker, now: at(2), processProbe: probe(new Set([777])), stopRelay }), late === 'lease' ? /live consumer lease/ : /recovery hold/);
    assert.equal(snapshot(fake.state), before); assert.equal(readReceipt(root, project).state, 'prepared');
  });
}

test('a recorded container that vanished before removal is recorded as already-absent, not a failure', async (t) => {
  const fake = fakeDocker();
  const { root, taskDir, project } = preparedTask(t, fake);
  writeFileSync(join(taskDir, 'transport.sock'), '');
  const vanished = [...fake.state.containers.values()].find((x) => x.Name === `/supabase_kong_${project}`).Id;
  const stopRelay = async () => { fake.state.containers.delete(vanished); };
  const terminal = await disposeOwned(root, project, { docker: fake.docker, now: at(1), processProbe: probe(new Set()), stopRelay });
  assert.equal(terminal.outcomes['container:' + vanished], 'already-absent'); assert.equal(fake.state.containers.size, 0);
});

test('disposable task left prepared by a dead owner is abandoned after 24 hours; a live owner keeps a passed task', async (t) => {
  const fake = fakeDocker();
  const { root, project } = preparedTask(t, fake);
  let report = await sweep({ root, docker: fake.docker, now: at(POLICY.abandonAfterMs), processProbe: probe(new Set()) });
  assert.equal(report.tasks[0].action, 'abandoned'); assert.equal(fake.state.containers.size, 2);
  const other = preparedTask(t, fakeDocker(), { owner: { pid: 31, startedAt: ALIVE } });
  updateReceipt(other.root, other.project, (r) => { r.state = 'passed'; }, T0);
  const docker = fakeDocker(); // separate daemon state is irrelevant: a live owner prevents any Docker mutation
  report = await sweep({ root: other.root, docker: docker.docker, now: at(60 * DAY), processProbe: probe(new Set([31])) });
  assert.equal(report.tasks[0].action, 'live'); assert.equal(docker.state.calls.some((args) => ['rm', 'stop'].includes(args[0])), false);
});

test('one-shot preparation failure stops (never removes) the task containers', async (t) => {
  const h = oneShotHarness(t, { prepareFails: true });
  const result = await runOneShot(h.options);
  assert.equal(result.cleanup, 'preserved'); assert.equal(result.preservation, 'stopped');
  const owned = [...h.fake.state.containers.values()].filter((x) => x.Name.endsWith(result.projectId));
  assert.equal(owned.length, 2); assert.equal(owned.every((x) => x.State.Running === false), true);
  assert.equal(h.fake.state.containers.get(hex('f')).State.Running, true);
});

test('terminal receipts without expiresAt expire 30 days after their terminal time; old receipt detail dirs are pruned', async (t) => {
  const fake = fakeDocker();
  const { root } = workspace(t);
  mkdirSync(join(root, 'terminal'), { recursive: true });
  writeFileSync(join(root, 'terminal', 'paisaxe-contracts-111111111111.json'), JSON.stringify({ terminalState: 'disposed', disposedAt: T0.toISOString() }));
  const tmpRoot = realpathSync(mkdtempSync(join(tmpdir(), 'contract-lifecycle-tmp-'))); t.after(() => rmSync(tmpRoot, { recursive: true, force: true }));
  const oldDetail = join(tmpRoot, 'paisaxe-contract-receipt-old'); const newDetail = join(tmpRoot, 'paisaxe-contract-receipt-new'); const other = join(tmpRoot, 'unrelated-old');
  for (const dir of [oldDetail, newDetail, other]) mkdirSync(dir);
  const { utimesSync } = await import('node:fs');
  for (const dir of [oldDetail, other]) utimesSync(dir, T0, T0);
  utimesSync(newDetail, at(20 * DAY), at(20 * DAY));
  let report = await sweep({ root, docker: fake.docker, now: at(POLICY.terminalRetentionMs - 1), processProbe: probe(new Set()), tmpRoot });
  assert.deepEqual(report.prunedTerminal, []); assert.deepEqual(report.prunedDetails, []);
  report = await sweep({ root, docker: fake.docker, now: at(POLICY.terminalRetentionMs), processProbe: probe(new Set()), tmpRoot });
  assert.deepEqual(report.prunedTerminal, ['paisaxe-contracts-111111111111']);
  assert.deepEqual(report.prunedDetails, ['paisaxe-contract-receipt-old']);
  assert.equal(existsSync(oldDetail), false); assert.equal(existsSync(newDetail), true); assert.equal(existsSync(other), true);
});

test('a retained task protects its referenced detail directory even through a path alias', async (t) => {
  const fake = fakeDocker();
  const { root, project } = preparedTask(t, fake);
  const tmpRoot = realpathSync(mkdtempSync(join(tmpdir(), 'contract-lifecycle-tmp-'))); t.after(() => rmSync(tmpRoot, { recursive: true, force: true }));
  const alias = join(realpathSync(mkdtempSync(join(tmpdir(), 'contract-lifecycle-alias-'))), 'link'); t.after(() => rmSync(join(alias, '..'), { recursive: true, force: true }));
  const { symlinkSync, utimesSync } = await import('node:fs');
  symlinkSync(tmpRoot, alias);
  const detail = join(tmpRoot, 'paisaxe-contract-receipt-kept'); mkdirSync(join(detail, 'run-1'), { recursive: true }); writeFileSync(join(detail, 'run-1', 'receipt.json'), '{}');
  utimesSync(detail, T0, T0);
  updateReceipt(root, project, (r) => { r.state = 'failed'; r.retainUntil = at(400 * DAY).toISOString(); r.diagnostics.push(join(alias, 'paisaxe-contract-receipt-kept', 'run-1', 'receipt.json')); }, T0);
  const report = await sweepOwnedStacks({ root, docker: fake.docker, now: at(60 * DAY), processProbe: probe(new Set()), tmpRoot });
  assert.deepEqual(report.prunedDetails, []); assert.equal(existsSync(detail), true);
});
