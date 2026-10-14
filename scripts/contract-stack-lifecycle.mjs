// Ownership lifecycle for local contract stacks (docs/engineering/database-contracts.md).
// A private receipt is written before any Docker allocation and updated with each
// allocated identity. Ownership inspection is separate from running-service health,
// so stopped stacks and expired relays stay inspectable. Disposal removes only
// recorded, unchanged identities: containers by immutable ID without -v, then the
// exact unconsumed owned network, then separately checked owned volumes.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DAY = 86400000;
export const POLICY = Object.freeze({ failedRetentionMs: 7 * DAY, abandonAfterMs: DAY, terminalRetentionMs: 30 * DAY, idleReminderMs: DAY });
const PROJECT = /^paisaxe-contracts-[a-f0-9]{12}$/;
const NONCE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const PROJECT_LABEL = 'com.supabase.cli.project';
const NONCE_LABEL = 'com.paisaxe.contracts.nonce';
const IN_PROGRESS = ['preparing', 'running'];
const DISPOSABLE_EXPIRING = ['failed', 'preparation-failed', 'abandoned'];
const insist = (ok, message) => { if (!ok) throw new Error(message); };
const iso = (date) => date.toISOString();
const plus = (date, ms) => new Date(date.getTime() + ms);

export function lifecycleRoot(env = process.env) {
  return resolve(env.PAISAXE_CONTRACT_LIFECYCLE_DIR || join(env.HOME || homedir(), '.local/state/paisaxe/contract-stacks'));
}
const taskFile = (root, id) => join(root, 'tasks', id + '.json');
const terminalFile = (root, id) => join(root, 'terminal', id + '.json');

function writePrivate(path, value, flag) {
  mkdirSync(join(path, '..'), { recursive: true, mode: 0o700 });
  const body = JSON.stringify(value, null, 2) + '\n';
  if (flag === 'wx') return writeFileSync(path, body, { flag, mode: 0o600 });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, body, { flag: 'wx', mode: 0o600 });
  renameSync(temporary, path);
}

/** Process identity is (pid, start time): a reused PID never revives a dead owner. */
function processIdentity(pid) {
  try { return execFileSync('ps', ['-p', String(pid), '-o', 'lstart='], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim() || null; }
  catch { return null; }
}
const selfOwner = (probe = processIdentity) => ({ pid: process.pid, startedAt: probe(process.pid) });
const isAlive = (owner, probe) => Boolean(owner && Number.isInteger(owner.pid) && owner.startedAt && probe(owner.pid) === owner.startedAt);

function withLock(root, id, action, probe = processIdentity) {
  const lock = join(root, 'tasks', id + '.lock');
  mkdirSync(join(root, 'tasks'), { recursive: true, mode: 0o700 });
  const deadline = Date.now() + 10000;
  for (;;) {
    try { writeFileSync(lock, JSON.stringify(selfOwner(probe)), { flag: 'wx', mode: 0o600 }); break; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let holder; try { holder = JSON.parse(readFileSync(lock, 'utf8')); } catch { holder = null; }
      if (holder && !isAlive(holder, probe)) { rmSync(lock, { force: true }); continue; }
      insist(Date.now() < deadline, `Lifecycle receipt ${id} is locked by a live process`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  try { return action(); } finally { rmSync(lock, { force: true }); }
}

export function readReceipt(root, id) {
  try { return JSON.parse(readFileSync(taskFile(root, id), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export function updateReceipt(root, id, mutate, now = new Date()) {
  return withLock(root, id, () => {
    const receipt = readReceipt(root, id);
    insist(receipt, `No lifecycle receipt for ${id}`);
    mutate(receipt);
    receipt.updatedAt = iso(now);
    writePrivate(taskFile(root, id), receipt);
    return receipt;
  });
}

export function createLifecycleReceipt(root, { projectId, nonce, taskDir, disposable, task, candidate, daemonId, stack = null, owner = selfOwner(), now = new Date() }) {
  insist(PROJECT.test(projectId || ''), 'Lifecycle receipt requires a generated contracts project');
  insist(NONCE.test(nonce || ''), 'Lifecycle receipt requires an ownership nonce');
  insist(typeof disposable === 'boolean' && typeof daemonId === 'string' && daemonId, 'Lifecycle receipt requires disposability and daemon identity');
  const receipt = { version: 1, kind: 'paisaxe-contract-stack', repository: 'paisaxe', projectId, nonce, taskDir, disposable, task, candidate, daemonId,
    stack, owner, state: 'preparing', createdAt: iso(now), updatedAt: iso(now), resources: { network: null, containers: [], volumes: [] },
    leases: [], recoveryHold: null, diagnostics: [], result: null, failedAt: null, retainUntil: null, disposal: null };
  writePrivate(taskFile(root, projectId), receipt, 'wx');
  return receipt;
}

const hasProof = (r) => r?.version === 1 && r.kind === 'paisaxe-contract-stack' && PROJECT.test(r.projectId || '') && NONCE.test(r.nonce || '') &&
  typeof r.daemonId === 'string' && r.daemonId && typeof r.taskDir === 'string' && typeof r.disposable === 'boolean' && r.resources;

// ---- Docker boundary -------------------------------------------------------------

export async function createDocker(env = process.env) {
  const { localDockerEnvironment } = await import('./run-contracts.mjs');
  const dockerEnv = localDockerEnvironment(env);
  const docker = (args) => execFileSync('docker', args, { env: dockerEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 }).trim();
  docker.env = dockerEnv;
  return docker;
}
function absent(read) {
  try { return read(); }
  catch (error) { if (/No such/i.test(String(error.stderr ?? '') + error.message)) return null; throw error; }
}
const inspect = (docker, kind, id) => absent(() => JSON.parse(docker([kind, 'inspect', id]))[0] ?? null);
const lines = (text) => text.split('\n').map((line) => line.trim()).filter(Boolean);
const projectContainers = (docker, id) => lines(docker(['ps', '-a', '--no-trunc', '--filter', `label=${PROJECT_LABEL}=${id}`, '--format', '{{.ID}}']));
const volumeConsumers = (docker, name) => lines(docker(['ps', '-a', '--no-trunc', '--filter', `volume=${name}`, '--format', '{{.ID}}']));

/** Records every current owned identity during preparation; recorded identities are never dropped.
 * A labelled project volume that the owner's own `db reset` recreated keeps its name, so its
 * creation time is refreshed here (the random project label proves ownership). Disposal never
 * calls this: it compares against the recorded creation time. */
export function recordInventory(root, id, docker, now = new Date()) {
  const containers = []; const mounted = new Set();
  for (const containerId of projectContainers(docker, id)) {
    const data = inspect(docker, 'container', containerId);
    if (!data || data.Config?.Labels?.[PROJECT_LABEL] !== id) continue;
    containers.push({ id: data.Id, name: data.Name.replace(/^\//, '') });
    for (const mount of data.Mounts || []) if (mount.Type === 'volume' && mount.Name) mounted.add(mount.Name);
  }
  const labelled = lines(docker(['volume', 'ls', '--filter', `label=${PROJECT_LABEL}=${id}`, '--format', '{{.Name}}']));
  const volumes = [];
  for (const name of new Set([...labelled, ...mounted])) {
    const data = inspect(docker, 'volume', name);
    if (!data) continue;
    const anonymous = Object.hasOwn(data.Labels || {}, 'com.docker.volume.anonymous');
    if (data.Labels?.[PROJECT_LABEL] === id || (anonymous && mounted.has(name))) volumes.push({ name, createdAt: data.CreatedAt, anonymous });
  }
  return updateReceipt(root, id, (r) => {
    for (const item of containers) if (!r.resources.containers.some((x) => x.id === item.id)) r.resources.containers.push(item);
    for (const item of volumes) {
      const known = r.resources.volumes.find((x) => x.name === item.name);
      if (!known) r.resources.volumes.push(item);
      else if (!item.anonymous && !known.anonymous) known.createdAt = item.createdAt;
    }
  }, now);
}

// ---- Leases ----------------------------------------------------------------------

/** Reusable callers hold a lease while using a stack. Legacy tasks (no receipt) take none. */
export function acquireConsumerLease(root, projectId, purpose, { owner = selfOwner(), now = new Date() } = {}) {
  if (!readReceipt(root, projectId)) return null;
  const lease = { id: randomUUID(), purpose, pid: owner.pid, startedAt: owner.startedAt, acquiredAt: iso(now) };
  updateReceipt(root, projectId, (r) => {
    insist(!['disposing', 'finished'].includes(r.state), `Contract stack ${projectId} is being disposed; prepare a fresh stack`);
    r.leases.push(lease); r.lastUsedAt = iso(now);
  }, now);
  return { projectId, id: lease.id };
}

export function releaseConsumerLease(root, lease, now = new Date()) {
  if (!lease || !readReceipt(root, lease.projectId)) return;
  updateReceipt(root, lease.projectId, (r) => { r.leases = r.leases.filter((x) => x.id !== lease.id); r.lastUsedAt = iso(now); }, now);
}

/** Convenience for reusable callers: resolves the default lifecycle root from the environment. */
export function leaseForCaller(projectId, purpose, env = process.env) {
  const root = lifecycleRoot(env);
  const lease = acquireConsumerLease(root, projectId, purpose);
  return { release: () => releaseConsumerLease(root, lease) };
}

export function setRecoveryHold(root, projectId, reason, now = new Date()) {
  return updateReceipt(root, projectId, (r) => { r.recoveryHold = reason ? { reason, since: iso(now) } : null; }, now);
}

// ---- Ownership inspection (no health requirements) -------------------------------

export function inspectOwnership(root, projectId, { docker }) {
  const r = readReceipt(root, projectId);
  insist(r, `No lifecycle receipt for ${projectId}; legacy resources are inventory-only`);
  const net = r.resources.network ? inspect(docker, 'network', r.resources.network.id) : null;
  return {
    projectId, state: r.state, disposable: r.disposable, proof: Boolean(hasProof(r)), leases: r.leases.length, recoveryHold: r.recoveryHold, retainUntil: r.retainUntil,
    relay: existsSync(join(r.taskDir, 'transport.sock')) ? 'present' : 'absent',
    network: { id: r.resources.network?.id ?? null, present: Boolean(net), internal: net?.Internal === true, nonceMatches: net?.Labels?.[NONCE_LABEL] === r.nonce, attached: Object.keys(net?.Containers || {}) },
    containers: r.resources.containers.map(({ id, name }) => {
      const data = inspect(docker, 'container', id);
      return { id, name, present: Boolean(data), running: data ? data.State?.Running === true : null, sameIdentity: data ? data.Id === id && data.Name === '/' + name && data.Config?.Labels?.[PROJECT_LABEL] === projectId : null };
    }),
    volumes: r.resources.volumes.map(({ name, createdAt }) => {
      const data = inspect(docker, 'volume', name);
      return { name, present: Boolean(data), sameIdentity: data ? data.CreatedAt === createdAt : null, consumers: data ? volumeConsumers(docker, name) : [] };
    }),
  };
}

/** Fresh identity/attachment checks. Every refusal is found before any mutation. */
function planDisposal(r, docker) {
  const refusals = [];
  if (!hasProof(r)) return { refusals: ['receipt lacks ownership proof'] };
  if (docker(['info', '--format', '{{.ID}}']) !== r.daemonId) refusals.push('Docker daemon identity changed');
  const recorded = new Set(r.resources.containers.map((x) => x.id));
  for (const id of projectContainers(docker, r.projectId)) if (!recorded.has(id)) refusals.push(`unrecorded project container ${id}`);
  let network = null;
  const networkRef = r.resources.network?.id ?? r.projectId;
  const net = inspect(docker, 'network', networkRef);
  if (net) {
    if (net.Name !== r.projectId || net.Internal !== true || net.Labels?.[NONCE_LABEL] !== r.nonce) refusals.push('network ownership nonce/identity mismatch');
    else network = net.Id;
    for (const id of Object.keys(net.Containers || {})) if (!recorded.has(id)) refusals.push(`new network consumer ${id}`);
  }
  const containers = [];
  for (const { id, name } of r.resources.containers) {
    const data = inspect(docker, 'container', id);
    if (!data) {
      const sameName = inspect(docker, 'container', name);
      if (sameName && !recorded.has(sameName.Id)) refusals.push(`container name ${name} now belongs to a different identity`);
      continue;
    }
    const networks = Object.keys(data.NetworkSettings?.Networks || {});
    if (data.Id !== id || data.Name !== '/' + name || data.Config?.Labels?.[PROJECT_LABEL] !== r.projectId || networks.some((x) => x !== r.projectId)) {
      refusals.push(`container ${id} identity or attachment changed`);
    } else containers.push({ id, running: data.State?.Running === true });
  }
  const volumes = [];
  for (const { name, createdAt, anonymous } of r.resources.volumes) {
    const data = inspect(docker, 'volume', name);
    if (!data) continue;
    if (data.CreatedAt !== createdAt || (!anonymous && data.Labels?.[PROJECT_LABEL] !== r.projectId)) { refusals.push(`volume ${name} was replaced`); continue; }
    const foreign = volumeConsumers(docker, name).filter((id) => !recorded.has(id));
    if (foreign.length) refusals.push(`volume ${name} has unrecorded consumers`);
    else volumes.push({ name, createdAt });
  }
  return { refusals, containers, network, volumes };
}

function liveLeases(r, probe) {
  return r.leases.filter((lease) => isAlive({ pid: lease.pid, startedAt: lease.startedAt }, probe));
}

function relayManifest(r) {
  return { version: 1, projectId: r.projectId, nonce: r.nonce, taskDir: r.taskDir, ...(r.stack || {}) };
}
async function defaultStopRelay(manifest, docker) {
  const { stopTransport } = await import('./contract-transport.mjs');
  return stopTransport(manifest, docker.env);
}

function sanitizedTerminal(r, terminalState, now, extra = {}) {
  return { version: 1, projectId: r.projectId, repository: r.repository, task: r.task, candidate: r.candidate, disposable: r.disposable,
    terminalState, priorState: r.disposal?.priorState ?? r.state, createdAt: r.createdAt, failedAt: r.failedAt, retainUntil: r.retainUntil,
    result: r.result, resources: { network: r.resources.network?.id ?? null, containers: r.resources.containers.map((x) => x.id), volumes: r.resources.volumes.map((x) => x.name) },
    recordedAt: iso(now), expiresAt: iso(plus(now, POLICY.terminalRetentionMs)), ...extra };
}
function writeTerminal(root, r, terminalState, now, extra) {
  writePrivate(terminalFile(root, r.projectId), sanitizedTerminal(r, terminalState, now, extra));
}

function removeOwnedTaskDir(taskDir) {
  if (!existsSync(taskDir)) return;
  insist(!lstatSync(taskDir).isSymbolicLink() && realpathSync(taskDir) === taskDir && basename(taskDir).startsWith('paisaxe-contracts-'), 'Task payload identity mismatch; preserved');
  rmSync(taskDir, { recursive: true });
}

export async function disposeOwned(root, projectId, { docker, now = new Date(), processProbe = processIdentity, stopRelay } = {}) {
  docker ??= await createDocker();
  let r = readReceipt(root, projectId);
  insist(r, `No lifecycle receipt for ${projectId}; legacy resources are inventory-only`);
  insist(hasProof(r), `Disposal refused: ${projectId} receipt lacks ownership proof`);
  insist(r.disposable || r.state === 'finished' || r.disposal?.priorState === 'finished', `Disposal refused: reusable stack ${projectId} requires explicit finish (npm run contracts:finish -- ${projectId})`);
  insist(!r.recoveryHold, `Disposal refused: recovery hold on ${projectId}`);
  insist(liveLeases(r, processProbe).length === 0, `Disposal refused: live consumer lease on ${projectId}`);
  const plan = planDisposal(r, docker);
  if (plan.refusals.length) {
    updateReceipt(root, projectId, (x) => { x.lastRefusal = { at: iso(now), reasons: plan.refusals }; }, now);
    throw new Error(`Disposal refused for ${projectId}: ${plan.refusals.join('; ')}`);
  }
  if (existsSync(join(r.taskDir, 'transport.sock'))) {
    try { await (stopRelay ?? ((m) => defaultStopRelay(m, docker)))(relayManifest(r)); }
    catch (error) { if (!['ECONNREFUSED', 'ENOENT'].includes(error.code)) throw new Error(`Disposal refused: owned relay could not be stopped (${error.message})`); }
  }
  r = updateReceipt(root, projectId, (x) => {
    x.disposal ??= { startedAt: iso(now), priorState: x.state, outcomes: {} };
    x.state = 'disposing'; x.owner = selfOwner(processProbe);
  }, now);
  const outcome = (key, value) => updateReceipt(root, projectId, (x) => { x.disposal.outcomes[key] = value; }, now);
  const running = plan.containers.filter((x) => x.running).map((x) => x.id);
  if (running.length) docker(['stop', '--time', '10', ...running]);
  for (const { id } of r.resources.containers) {
    if (plan.containers.some((x) => x.id === id)) { docker(['rm', id]); outcome('container:' + id, 'removed'); }
    else outcome('container:' + id, 'already-absent');
  }
  if (plan.network) {
    const net = inspect(docker, 'network', plan.network);
    if (net) {
      insist(Object.keys(net.Containers || {}).length === 0, 'Owned network gained a consumer during disposal');
      docker(['network', 'rm', plan.network]);
    }
    outcome('network:' + plan.network, net ? 'removed' : 'already-absent');
  }
  for (const { name, createdAt } of plan.volumes) {
    const data = inspect(docker, 'volume', name);
    if (data) {
      insist(data.CreatedAt === createdAt && volumeConsumers(docker, name).length === 0, `Volume ${name} changed or gained a consumer during disposal`);
      docker(['volume', 'rm', name]);
    }
    outcome('volume:' + name, data ? 'removed' : 'already-absent');
  }
  r = readReceipt(root, projectId);
  const terminal = sanitizedTerminal(r, 'disposed', now, { disposedAt: iso(now), outcomes: r.disposal.outcomes });
  writePrivate(terminalFile(root, projectId), terminal);
  removeOwnedTaskDir(r.taskDir);
  withLock(root, projectId, () => rmSync(taskFile(root, projectId), { force: true }), processProbe);
  return terminal;
}

/** Stops (does not remove) a failed task's verified containers to free memory while preserving its data. */
function stopPreserved(r, docker) {
  const plan = planDisposal(r, docker);
  if (plan.refusals.length) return `not stopped: ${plan.refusals.join('; ')}`;
  const running = plan.containers.filter((x) => x.running).map((x) => x.id);
  if (running.length) docker(['stop', '--time', '10', ...running]);
  return 'stopped';
}

export async function finishReusable(root, projectId, { docker, now = new Date(), processProbe = processIdentity, stopRelay } = {}) {
  const r = readReceipt(root, projectId);
  insist(r, `No lifecycle receipt for ${projectId}; legacy resources are inventory-only`);
  insist(liveLeases(r, processProbe).length === 0, `Finish refused: live consumer lease on ${projectId}`);
  insist(!r.recoveryHold, `Finish refused: recovery hold on ${projectId}`);
  if (!r.disposable) updateReceipt(root, projectId, (x) => { if (x.state !== 'disposing') x.state = 'finished'; x.finishedAt = iso(now); }, now);
  return disposeOwned(root, projectId, { docker, now, processProbe, stopRelay });
}

// ---- Scheduled owner verifier ------------------------------------------------------

export async function sweepOwnedStacks({ root = lifecycleRoot(), docker, now = new Date(), processProbe = processIdentity, dryRun = false, stopRelay } = {}) {
  docker ??= await createDocker();
  const report = { version: 1, checkedAt: iso(now), dryRun, tasks: [], legacy: [], prunedTerminal: [], failures: [] };
  const names = existsSync(join(root, 'tasks')) ? readdirSync(join(root, 'tasks')).filter((name) => /\.json$/.test(name)).sort() : [];
  const known = new Set();
  for (const name of names) {
    const projectId = name.slice(0, -5);
    let r; try { r = readReceipt(root, projectId); } catch { r = null; }
    if (r?.projectId) known.add(r.projectId);
    if (!hasProof(r)) { report.tasks.push({ projectId, action: 'inventory-only', reason: r ? 'legacy receipt lacks ownership proof' : 'unreadable receipt' }); continue; }
    known.add(projectId);
    const entry = { projectId, state: r.state, disposable: r.disposable, retainUntil: r.retainUntil };
    report.tasks.push(entry);
    const dead = r.leases.length - liveLeases(r, processProbe).length;
    if (dead) {
      entry.releasedDeadLeases = dead;
      if (!dryRun) r = updateReceipt(root, projectId, (x) => { x.leases = liveLeases(x, processProbe); }, now);
    }
    const idleSince = new Date(r.lastUsedAt || r.updatedAt);
    const ownerAlive = isAlive(r.owner, processProbe);
    const disposeNow = async (reason) => {
      entry.reason = reason;
      if (dryRun) { entry.action = 'would-dispose'; return; }
      try { await disposeOwned(root, projectId, { docker, now, processProbe, stopRelay }); entry.action = 'disposed'; }
      catch (error) { entry.action = 'failed'; report.failures.push({ projectId, error: error.message }); }
    };
    if (r.recoveryHold) Object.assign(entry, { action: 'preserve', reason: `recovery hold: ${r.recoveryHold.reason}` });
    else if (liveLeases(r, processProbe).length) Object.assign(entry, { action: 'preserve', reason: 'live consumer lease' });
    else if (r.state === 'disposing') {
      if (ownerAlive) Object.assign(entry, { action: 'live', reason: 'disposal in progress' });
      else await disposeNow('resume interrupted disposal');
    } else if (IN_PROGRESS.includes(r.state)) {
      if (ownerAlive) Object.assign(entry, { action: 'live', reason: 'owner process alive' });
      else if (now - new Date(r.updatedAt) < POLICY.abandonAfterMs) Object.assign(entry, { action: 'preserve', reason: `owner dead; abandoned after ${iso(plus(new Date(r.updatedAt), POLICY.abandonAfterMs))}` });
      else if (dryRun) Object.assign(entry, { action: 'would-abandon', reason: 'owner dead for 24 hours' });
      else {
        r = updateReceipt(root, projectId, (x) => { x.state = 'abandoned'; x.failedAt = iso(now); x.retainUntil = x.disposable ? iso(plus(now, POLICY.failedRetentionMs)) : null; }, now);
        writeTerminal(root, r, 'abandoned', now);
        Object.assign(entry, { action: 'abandoned', state: 'abandoned', retainUntil: r.retainUntil, reason: 'owner dead for 24 hours' });
      }
    } else if (r.disposable && r.state === 'passed') await disposeNow('contracts passed; disposal was interrupted');
    else if (r.disposable && DISPOSABLE_EXPIRING.includes(r.state)) {
      if (r.retainUntil && now >= new Date(r.retainUntil)) await disposeNow('diagnostic retention expired');
      else Object.assign(entry, { action: 'preserve', reason: `diagnostic retention until ${r.retainUntil}` });
    } else if (!r.disposable && r.state === 'finished') await disposeNow('explicitly finished reusable stack');
    else if (!r.disposable && now - idleSince >= POLICY.idleReminderMs) {
      Object.assign(entry, { action: 'reminder', reason: `idle reusable stack since ${iso(idleSince)}; when done run npm run contracts:finish -- ${projectId}` });
    } else Object.assign(entry, { action: 'live', reason: r.disposable ? 'awaiting one-shot completion' : 'reusable stack in use' });
  }
  for (const line of lines(docker(['network', 'ls', '--no-trunc', '--filter', 'name=paisaxe-contracts-', '--format', '{{.ID}} {{.Name}}']))) {
    const [id, name] = line.split(' ');
    if (PROJECT.test(name) && !known.has(name)) report.legacy.push({ id, name, action: 'inventory-only', reason: 'no lifecycle receipt; ownership unproven' });
  }
  const terminalDir = join(root, 'terminal');
  for (const name of existsSync(terminalDir) ? readdirSync(terminalDir).filter((x) => x.endsWith('.json')) : []) {
    let expiresAt; try { expiresAt = JSON.parse(readFileSync(join(terminalDir, name), 'utf8')).expiresAt; } catch { continue; }
    if (expiresAt && now >= new Date(expiresAt)) {
      if (!dryRun) unlinkSync(join(terminalDir, name));
      report.prunedTerminal.push(name.slice(0, -5));
    }
  }
  if (!dryRun) writePrivate(join(root, 'sweep-latest.json'), report);
  return report;
}

// ---- One-shot flow -----------------------------------------------------------------

/** prepare -> contracts -> archive receipt -> release lease -> dispose. Success requires both
 * passing contracts and complete disposal; a failure preserves the task for seven days. */
export async function runOneShot({ root = process.cwd(), lifecycleDir = lifecycleRoot(), prepare, run, docker, now = () => new Date(), processProbe = processIdentity, stopRelay } = {}) {
  prepare ??= (await import('./prepare-contract-stack.mjs')).prepareStack;
  run ??= (await import('./run-contracts.mjs')).runContracts;
  const { publicContractReceipt } = await import('./ci-contracts.mjs');
  docker ??= await createDocker();
  let manifest;
  try { manifest = await prepare(root, { lifecycle: { disposable: true, task: 'one-shot', root: lifecycleDir } }); }
  catch (error) {
    const r = error.projectId ? readReceipt(lifecycleDir, error.projectId) : null;
    return { ok: false, projectId: error.projectId ?? null, contracts: 'not-run', failure: 'preparation', cleanup: 'preserved', retainUntil: r?.retainUntil ?? null, detail: error.message };
  }
  const { projectId } = manifest;
  const lease = acquireConsumerLease(lifecycleDir, projectId, 'one-shot', { owner: selfOwner(processProbe), now: now() });
  updateReceipt(lifecycleDir, projectId, (r) => { r.state = 'running'; r.owner = selfOwner(processProbe); }, now());
  let receipt; let failure;
  try { receipt = await run({ root, taskDir: manifest.taskDir }); if (receipt?.status !== 'passed') failure = 'contracts'; }
  catch { failure = 'contracts'; }
  const archivedAt = now();
  let r = updateReceipt(lifecycleDir, projectId, (x) => {
    x.result = publicContractReceipt(receipt, failure);
    if (receipt?.receiptPath) x.diagnostics.push(receipt.receiptPath);
    x.state = failure ? 'failed' : 'passed';
    if (failure) { x.failedAt = iso(archivedAt); x.retainUntil = iso(plus(archivedAt, POLICY.failedRetentionMs)); }
  }, archivedAt);
  releaseConsumerLease(lifecycleDir, lease, archivedAt);
  if (failure) {
    const stopped = stopPreserved(r, docker);
    r = updateReceipt(lifecycleDir, projectId, (x) => { x.preservation = stopped; }, archivedAt);
    writeTerminal(lifecycleDir, r, 'failed', archivedAt);
    return { ok: false, projectId, contracts: 'failed', failure, cleanup: 'preserved', retainUntil: r.retainUntil, preservation: stopped };
  }
  try {
    await disposeOwned(lifecycleDir, projectId, { docker, now: now(), processProbe, stopRelay });
    return { ok: true, projectId, contracts: 'passed', cleanup: 'disposed', caseCount: r.result.caseCount };
  } catch (error) {
    return { ok: false, projectId, contracts: 'passed', failure: 'cleanup', cleanup: 'failed', detail: error.message };
  }
}

// ---- CLI ------------------------------------------------------------------------------

const USAGE = 'Usage: contract-stack-lifecycle.mjs one-shot | inspect <project> | finish <project> | hold <project> <reason> | unhold <project> | sweep [--dry-run]';
async function main(argv = process.argv.slice(2)) {
  const [command, projectId, ...rest] = argv;
  const root = lifecycleRoot();
  const print = (value) => console.log(JSON.stringify(value, null, 2));
  if (command === 'one-shot') { const result = await runOneShot({ lifecycleDir: root }); print(result); return result.ok ? 0 : 1; }
  if (command === 'sweep') { const report = await sweepOwnedStacks({ root, dryRun: argv.includes('--dry-run') }); print(report); return report.failures.length ? 1 : 0; }
  insist(PROJECT.test(projectId || ''), USAGE);
  if (command === 'inspect') { print(inspectOwnership(root, projectId, { docker: await createDocker() })); return 0; }
  if (command === 'finish') { print(await finishReusable(root, projectId)); return 0; }
  if (command === 'hold') { insist(rest.length, USAGE); print(setRecoveryHold(root, projectId, rest.join(' ')).recoveryHold); return 0; }
  if (command === 'unhold') { setRecoveryHold(root, projectId, null); return 0; }
  throw new Error(USAGE);
}

// No top-level await: prepare/run import this module, so the entry must finish evaluating
// before main() dynamically imports them (a pending entry module would deadlock the cycle).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => { process.exitCode = code; }, (error) => { console.error(error.message); process.exitCode = 1; });
}
