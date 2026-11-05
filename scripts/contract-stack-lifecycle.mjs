import { createOwnedProcessScope, processIdentity } from './contract-owned-process.mjs';
// Ownership lifecycle for local contract stacks (docs/engineering/database-contracts.md).
// A private receipt is written before any Docker allocation and updated with each
// allocated identity. Ownership inspection is separate from running-service health,
// so stopped stacks and expired relays stay inspectable. Disposal removes only
// recorded, unchanged identities: containers by immutable ID without -v, then the
// exact unconsumed owned network, then separately checked owned volumes.
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DAY = 86400000;
export const POLICY = Object.freeze({ failedRetentionMs: 7 * DAY, abandonAfterMs: DAY, terminalRetentionMs: 30 * DAY, idleReminderMs: DAY });
const PROJECT = /^paisaxe-contracts-[a-f0-9]{12}$/;
const NONCE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const PROJECT_LABEL = 'com.supabase.cli.project';
const NONCE_LABEL = 'com.paisaxe.contracts.nonce';
const IN_PROGRESS = ['preparing', 'running'];
const DISPOSABLE_EXPIRING = ['failed', 'preparation-failed', 'abandoned', 'interrupted'];
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

/** Process identity is (pid, start time) in a fixed locale/zone. Returns null only for an explicit
 * "no such process"; any other probe failure is UNKNOWN_PROCESS, which never proves death. */
export const UNKNOWN_PROCESS = 'unknown';
export { processIdentity };
const selfOwner = (probe = processIdentity) => ({ pid: process.pid, startedAt: probe(process.pid) });
/** Dead only on explicit absence, or a different start time (the PID now belongs to another process). */
export function isAlive(owner, probe) {
  if (!owner || !Number.isInteger(owner.pid) || owner.pid <= 0) return false;
  const current = probe(owner.pid);
  if (current === null) return false;
  if (current === UNKNOWN_PROCESS || !owner.startedAt || owner.startedAt === UNKNOWN_PROCESS) return true;
  return current === owner.startedAt;
}

function withLock(root, id, action, probe = processIdentity) {
  const lock = join(root, 'tasks', id + '.lock'), recovery = lock + '.recovery';
  mkdirSync(join(root, 'tasks'), { recursive: true, mode: 0o700 });
  const token = randomUUID(), owner = { ...selfOwner(probe), token };
  const read = path => { try { return JSON.parse(readFileSync(path, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw new Error(`Lifecycle lock is unreadable; inspection required: ${id}`); } };
  const release = (path, expected) => { if (read(path)?.token === expected) rmSync(path); };
  const known = holder => holder && Number.isInteger(holder.pid) && holder.pid > 0 && typeof holder.startedAt === 'string' && holder.startedAt && holder.startedAt !== UNKNOWN_PROCESS;
  const deadline = Date.now() + 10000;
  for (;;) {
    insist(!existsSync(recovery), `Lifecycle recovery guard requires inspection: ${id}`);
    try { writeFileSync(lock, JSON.stringify(owner), { flag: 'wx', mode: 0o600 }); break; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const holder = read(lock);
      if (!holder) continue;
      insist(known(holder), `Lifecycle lock identity unknown; inspection required: ${id}`);
      if (!isAlive(holder, probe)) {
        const recoveryToken = randomUUID();
        try { writeFileSync(recovery, JSON.stringify({ ...owner, token: recoveryToken }), { flag: 'wx', mode: 0o600 }); }
        catch (error) { if (error.code === 'EEXIST') throw new Error(`Lifecycle recovery guard requires inspection: ${id}`); throw error; }
        try {
          const current = read(lock);
          if (current && known(current) && !isAlive(current, probe) && JSON.stringify(read(lock)) === JSON.stringify(current)) rmSync(lock);
          if (!existsSync(lock)) { writeFileSync(lock, JSON.stringify(owner), { flag: 'wx', mode: 0o600 }); break; }
        } finally { release(recovery, recoveryToken); }
      }
      insist(Date.now() < deadline, `Lifecycle receipt ${id} is locked by a live process`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  try { return action(); } finally { release(lock, token); }
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
    leases: [], commandTracking: { version: 1, commands: {} }, recoveryHold: null, diagnostics: [], result: null, failedAt: null, retainUntil: null, disposal: null };
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
function absent(read, { kind, id } = {}) {
  try { return read(); }
  catch (error) {
    const stderr = String(error.stderr ?? '').trim();
    // Docker network inspect uses this wording after removal. Bind it to the
    // exact requested identity; other not-found errors remain failures.
    if (/No such/i.test(stderr + error.message) ||
      (kind === 'network' && stderr === `Error response from daemon: network ${id} not found`)) return null;
    throw error;
  }
}
const inspect = (docker, kind, id) => absent(() => JSON.parse(docker([kind, 'inspect', id]))[0] ?? null, { kind, id });
const lines = (text) => text.split('\n').map((line) => line.trim()).filter(Boolean);
const projectContainers = (docker, id) => lines(docker(['ps', '-a', '--no-trunc', '--filter', `label=${PROJECT_LABEL}=${id}`, '--format', '{{.ID}}']));
// `network inspect` lists running endpoints only; stopped attached containers need ps -a.
const networkConsumers = (docker, id) => lines(docker(['ps', '-a', '--no-trunc', '--filter', `network=${id}`, '--format', '{{.ID}}']));
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

// Command records are independent of leases: pruning a dead lease cannot erase
// children which escaped its owner's process group before an uncatchable exit.
function commandMap(r) {
  const tracking = r.commandTracking;
  insist(tracking?.version === 1 && tracking.commands && typeof tracking.commands === 'object' && !Array.isArray(tracking.commands), 'Legacy or malformed command tracking requires inspection');
  return tracking.commands;
}
function commandRefusal(r) {
  let commands;
  try { commands = commandMap(r); } catch { return 'legacy or malformed command tracking requires inspection'; }
  const entries = Object.entries(commands);
  if (!entries.length) return null;
  return `unresolved command ownership (${entries.length}); child settlement requires inspection`;
}

export function createReceiptCommandTracker(root, projectId, { purpose, leaseId = null, settlement = 'process-group' } = {}) {
  insist(/^[a-z][a-z0-9-]{0,63}$/.test(purpose || ''), 'Invalid command purpose');
  insist(['process-group', 'explicit-consumer', 'managed-relay'].includes(settlement), 'Invalid command settlement mode');
  const owner = selfOwner(), issued = new Set();
  const currentOwner = () => insist(owner.startedAt && owner.startedAt !== UNKNOWN_PROCESS && processIdentity(owner.pid) === owner.startedAt, 'Command owner identity is unknown; inspection required');
  const entry = (r, id) => {
    currentOwner();
    const command = commandMap(r)[id];
    insist(issued.has(id) && command?.id === id && command.owner?.pid === owner.pid && command.owner?.startedAt === owner.startedAt && command.leaseId === leaseId && command.purpose === purpose, 'Command ownership changed; inspection required');
    return command;
  };
  return Object.freeze({
    beforeLaunch() {
      currentOwner();
      const id = randomUUID();
      updateReceipt(root, projectId, r => {
        const commands = commandMap(r);
        insist(!['disposing', 'stopping', 'finished'].includes(r.state) && !r.recoveryHold, 'Command admission closed by lifecycle transition or recovery hold');
        if (leaseId !== null) insist(r.leases.some(l => l.id === leaseId && l.pid === owner.pid && l.startedAt === owner.startedAt), 'Command requires its matching live consumer lease');
        commands[id] = { id, purpose, leaseId, owner, settlement, state: 'launching', child: null, launchedAt: iso(new Date()) };
      });
      issued.add(id);
      return id;
    },
    onStart(id, child) {
      updateReceipt(root, projectId, r => {
        const command = entry(r, id);
        insist(command.state === 'launching' && Number.isInteger(child?.pid) && child.pid > 1 && child.pgid === child.pid && typeof child.startedAt === 'string', 'Invalid launched child identity');
        command.state = 'running'; command.child = { pid: child.pid, pgid: child.pgid, startedAt: child.startedAt };
      });
    },
    onSettled(id, result) {
      updateReceipt(root, projectId, r => {
        const command = entry(r, id);
        const noSpawn = result.spawnFailed === true && command.state === 'launching' && command.child === null && result.child?.pid === null;
        const sameChild = command.child && result.child?.pid === command.child.pid && result.child?.pgid === command.child.pgid && result.child?.startedAt === command.child.startedAt;
        if (noSpawn || (settlement === 'process-group' && sameChild && result.settlementBasis === 'supervisor-observed' && result.child.settled === true)) delete commandMap(r)[id];
        else { command.state = 'unsettled'; command.reason = settlement === 'explicit-consumer' ? 'detached consumer closure unproven' : 'child settlement unproven'; }
      });
    },
    handoffRelay(id, proof) {
      insist(settlement === 'managed-relay', 'Only managed relay commands can transfer ownership');
      updateReceipt(root, projectId, r => {
        const command = entry(r, id), child = command.child;
        const sourceDigest = createHash('sha256').update(readFileSync(new URL('./contract-transport.mjs', import.meta.url))).digest('hex');
        insist(child && child.startedAt !== UNKNOWN_PROCESS && processIdentity(child.pid) === child.startedAt && proof?.ok === true && proof.pid === child.pid && proof.version === 1 &&
          proof.projectId === r.projectId && proof.nonce === r.nonce && proof.taskDir === r.taskDir && proof.apiUrl === r.stack?.apiUrl && proof.dbPort === r.stack?.dbPort && proof.migrationDigest === r.stack?.migrationDigest &&
          proof.sourceDigest === sourceDigest && /^unix:\/\/\/[^\r\n]+$/.test(proof.dockerHost || ''), 'Authenticated relay ownership handoff mismatch');
        r.managedRelay = { commandId: id, child, sourceDigest, dockerHost: proof.dockerHost, handedOffAt: iso(new Date()) };
        delete commandMap(r)[id];
      });
    },
  });
}

// ---- Leases ----------------------------------------------------------------------

/** Reusable callers hold a lease while using a stack. Legacy tasks (no receipt) take none. */
export function acquireConsumerLease(root, projectId, purpose, { owner = selfOwner(), now = new Date() } = {}) {
  if (!readReceipt(root, projectId)) return null;
  const lease = { id: randomUUID(), purpose, pid: owner.pid, startedAt: owner.startedAt, acquiredAt: iso(now) };
  updateReceipt(root, projectId, (r) => {
    insist(!['disposing', 'stopping', 'finished'].includes(r.state), `Contract stack ${projectId} is being disposed or stopping; prepare a fresh stack`);
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
  return Object.freeze({ root, projectId, id: lease?.id ?? null, commandTracker: lease ? createReceiptCommandTracker(root, projectId, { purpose, leaseId: lease.id }) : null, release: () => releaseConsumerLease(root, lease) });
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
    projectId, state: r.state, disposable: r.disposable, proof: Boolean(hasProof(r)), commandTracking: r.commandTracking ?? null, commandRefusal: commandRefusal(r), leases: r.leases.length, recoveryHold: r.recoveryHold, retainUntil: r.retainUntil,
    relay: existsSync(join(r.taskDir, 'transport.sock')) ? 'present' : 'absent',
    network: { id: r.resources.network?.id ?? null, present: Boolean(net), internal: net?.Internal === true, nonceMatches: net?.Labels?.[NONCE_LABEL] === r.nonce, attached: net ? [...new Set([...Object.keys(net.Containers || {}), ...networkConsumers(docker, net.Id)])] : [] },
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
    for (const id of new Set([...Object.keys(net.Containers || {}), ...networkConsumers(docker, net.Id)])) if (!recorded.has(id)) refusals.push(`new network consumer ${id}`);
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

function retryAction(projectId) {
  return `Inspect: npm run contracts:lifecycle -- inspect ${projectId}; retry: npm run contracts:finish -- ${projectId}`;
}

function assertIdle(r, processProbe) {
  insist(!commandRefusal(r), `Disposal refused: ${commandRefusal(r)}; ${retryAction(r.projectId)}`);
  insist(!r.recoveryHold, `Disposal refused: recovery hold on ${r.projectId}`);
  insist(liveLeases(r, processProbe).length === 0, `Disposal refused: live consumer lease on ${r.projectId}`);
  insist(r.interruption?.settled !== false, `Disposal refused: interrupted child settlement is unknown for ${r.projectId}; ${retryAction(r.projectId)}`);
}

function verifyPlan(r, docker) {
  const plan = planDisposal(r, docker);
  insist(plan.refusals.length === 0, `Disposal refused for ${r.projectId}: ${plan.refusals.join('; ')}`);
  return plan;
}

/** Closing admission is a receipt transition, not a lock held across external IO. */
function claimTransition(root, projectId, state, docker, processProbe, now) {
  const key = state === 'disposing' ? 'disposal' : 'preservationStop';
  const id = randomUUID();
  const before = readReceipt(root, projectId);
  insist(before && hasProof(before), `Disposal refused: ${projectId} receipt lacks ownership proof`);
  assertIdle(before, processProbe);
  verifyPlan(before, docker);
  const receipt = updateReceipt(root, projectId, (r) => {
    assertIdle(r, processProbe);
    if (['disposing', 'stopping'].includes(r.state)) {
      const active = r.state === 'disposing' ? r.disposal : r.preservationStop;
      insist(!active?.active || !isAlive(r.owner, processProbe), `Disposal refused: another live owner is ${r.state} ${projectId}`);
    }
    insist(state !== 'stopping' || r.disposable, `Preservation stop refused: reusable stack ${projectId}`);
    insist(state !== 'disposing' || r.disposable || r.state === 'finished' || r.disposal?.priorState === 'finished',
      `Disposal refused: reusable stack ${projectId} requires explicit finish (npm run contracts:finish -- ${projectId})`);
    r[key] ??= { startedAt: iso(now), priorState: r.state, outcomes: {}, retainUntil: r.retainUntil };
    Object.assign(r[key], { id, active: true });
    r.state = state; r.owner = selfOwner(processProbe); r.nextAction = retryAction(projectId);
  }, now);
  return { key, id, receipt };
}

function guardedPlan(root, projectId, claim, docker, processProbe) {
  const r = readReceipt(root, projectId);
  insist(r?.[claim.key]?.id === claim.id, `Disposal refused: lifecycle owner changed for ${projectId}`);
  assertIdle(r, processProbe);
  return verifyPlan(r, docker);
}

async function stopOwnedRelay(r, docker, stopRelay) {
  if (!existsSync(join(r.taskDir, 'transport.sock'))) return;
  try { await (stopRelay ?? ((m) => defaultStopRelay(m, docker)))(relayManifest(r)); }
  catch (error) {
    if (!['ECONNREFUSED', 'ENOENT'].includes(error.code)) throw new Error(`Disposal refused: owned relay could not be stopped (${error.message})`);
  }
}

function recordTransitionFailure(root, projectId, error, now) {
  if (readReceipt(root, projectId)) updateReceipt(root, projectId, (r) => {
    r.lastRefusal = { at: iso(now), reasons: [error.message], nextAction: retryAction(projectId) };
  }, now);
}

function releaseTransition(root, projectId, claim, now) {
  if (claim && readReceipt(root, projectId)) updateReceipt(root, projectId, (r) => {
    if (r[claim.key]?.id === claim.id) r[claim.key].active = false;
  }, now);
}

export async function disposeOwned(root, projectId, { docker, now = new Date(), processProbe = processIdentity, stopRelay } = {}) {
  docker ??= await createDocker();
  let claim;
  try {
    claim = claimTransition(root, projectId, 'disposing', docker, processProbe, now);
    await stopOwnedRelay(claim.receipt, docker, stopRelay);
    let plan = guardedPlan(root, projectId, claim, docker, processProbe);
    const outcome = (key, value) => updateReceipt(root, projectId, r => { r.disposal.outcomes[key] = value; }, now);
    const removed = args => (absent(() => docker(args), { kind: args[0], id: args.at(-1) }) === null ? 'already-absent' : 'removed');
    for (const { id } of claim.receipt.resources.containers) {
      plan = guardedPlan(root, projectId, claim, docker, processProbe);
      if (plan.containers.find(x => x.id === id)?.running) absent(() => docker(['stop', '--time', '10', id]));
      plan = guardedPlan(root, projectId, claim, docker, processProbe);
      outcome('container:' + id, plan.containers.some(x => x.id === id) ? removed(['rm', id]) : 'already-absent');
    }
    plan = guardedPlan(root, projectId, claim, docker, processProbe);
    if (plan.network) {
      insist(networkConsumers(docker, plan.network).length === 0, 'Owned network gained a consumer during disposal');
      outcome('network:' + plan.network, removed(['network', 'rm', plan.network]));
    }
    for (const { name } of claim.receipt.resources.volumes) {
      plan = guardedPlan(root, projectId, claim, docker, processProbe);
      outcome('volume:' + name, plan.volumes.some(x => x.name === name) ? removed(['volume', 'rm', name]) : 'already-absent');
    }
    const remaining = guardedPlan(root, projectId, claim, docker, processProbe);
    insist(!remaining.network && !remaining.containers.length && !remaining.volumes.length, 'Owned resources remain after disposal; retry finish');
    const r = readReceipt(root, projectId);
    const terminal = sanitizedTerminal(r, 'disposed', now, { disposedAt: iso(now), outcomes: r.disposal.outcomes });
    writePrivate(terminalFile(root, projectId), terminal);
    removeOwnedTaskDir(r.taskDir);
    withLock(root, projectId, () => rmSync(taskFile(root, projectId), { force: true }), processProbe);
    return terminal;
  } catch (error) {
    recordTransitionFailure(root, projectId, error, now);
    throw error;
  } finally { releaseTransition(root, projectId, claim, now); }
}

/** Stop verified unused services, retaining data and the original diagnostic deadline. */
export async function stopPreserved(root, projectId, { docker, now = new Date(), processProbe = processIdentity, stopRelay } = {}) {
  docker ??= await createDocker();
  let claim;
  try {
    claim = claimTransition(root, projectId, 'stopping', docker, processProbe, now);
    await stopOwnedRelay(claim.receipt, docker, stopRelay);
    for (const { id } of claim.receipt.resources.containers) {
      const plan = guardedPlan(root, projectId, claim, docker, processProbe);
      if (plan.containers.find(x => x.id === id)?.running) absent(() => docker(['stop', '--time', '10', id]));
      updateReceipt(root, projectId, r => { r.preservationStop.outcomes[id] = 'stopped-or-absent'; }, now);
    }
    guardedPlan(root, projectId, claim, docker, processProbe);
    updateReceipt(root, projectId, r => {
      r.state = r.preservationStop.priorState; r.retainUntil = r.preservationStop.retainUntil;
      r.preservation = 'stopped'; r.preservationStop.completedAt = iso(now);
    }, now);
    return 'stopped';
  } catch (error) { recordTransitionFailure(root, projectId, error, now); throw error; }
  finally { releaseTransition(root, projectId, claim, now); }
}

export async function finishReusable(root, projectId, { docker, now = new Date(), processProbe = processIdentity, stopRelay } = {}) {
  const r = readReceipt(root, projectId);
  if (!r) {
    const file = terminalFile(root, projectId);
    const terminal = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
    insist(terminal?.projectId === projectId && terminal.terminalState === 'disposed', `No lifecycle receipt for ${projectId}; legacy resources are inventory-only`);
    return terminal; // Already disposed; never inspect/adopt a later same-name resource.
  }
  assertIdle(r, processProbe);
  if (!r.disposable) updateReceipt(root, projectId, (x) => {
    assertIdle(x, processProbe);
    if (x.state !== 'disposing') x.state = 'finished'; x.finishedAt = iso(now);
  }, now);
  return disposeOwned(root, projectId, { docker, now, processProbe, stopRelay });
}

// ---- Scheduled owner verifier ------------------------------------------------------

export async function sweepOwnedStacks({ root = lifecycleRoot(), docker, now = new Date(), processProbe = processIdentity, dryRun = false, stopRelay, tmpRoot = tmpdir() } = {}) {
  docker ??= await createDocker();
  const report = { version: 1, checkedAt: iso(now), dryRun, tasks: [], legacy: [], prunedTerminal: [], prunedDetails: [], failures: [] };
  const protectedDiagnostics = [];
  const names = existsSync(join(root, 'tasks')) ? readdirSync(join(root, 'tasks')).filter((name) => /\.json$/.test(name)).sort() : [];
  const known = new Set();
  for (const name of names) {
    const projectId = name.slice(0, -5);
    let r; try { r = readReceipt(root, projectId); } catch { r = null; }
    if (r?.projectId) known.add(r.projectId);
    if (!hasProof(r)) { report.tasks.push({ projectId, action: 'inventory-only', reason: r ? 'legacy receipt lacks ownership proof' : 'unreadable receipt' }); continue; }
    known.add(projectId);
    // Compare canonical paths: macOS records /var/... while realpath is /private/var/...
    for (const path of r.diagnostics) if (typeof path === 'string') { try { protectedDiagnostics.push(realpathSync(path)); } catch { protectedDiagnostics.push(path); } }
    const entry = { projectId, state: r.state, disposable: r.disposable, retainUntil: r.retainUntil };
    report.tasks.push(entry);
    if (commandRefusal(r)) { Object.assign(entry, { action: 'preserve', reason: commandRefusal(r) }); continue; }
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
    else if (r.state === 'stopping') {
      if (ownerAlive && r.preservationStop?.active) Object.assign(entry, { action: 'live', reason: 'preservation stop in progress' });
      else if (dryRun) Object.assign(entry, { action: 'would-stop', reason: 'resume interrupted preservation stop' });
      else {
        try { await stopPreserved(root, projectId, { docker, now, processProbe, stopRelay }); entry.action = 'stopped'; }
        catch (error) { entry.action = 'failed'; report.failures.push({ projectId, error: error.message }); }
      }
    } else if (r.state === 'disposing') {
      if (ownerAlive && r.disposal?.active) Object.assign(entry, { action: 'live', reason: 'disposal in progress' });
      else await disposeNow('resume interrupted disposal');
    } else if (IN_PROGRESS.includes(r.state) || (r.disposable && r.state === 'prepared')) {
      if (ownerAlive) Object.assign(entry, { action: 'live', reason: 'owner process alive' });
      else if (now - new Date(r.updatedAt) < POLICY.abandonAfterMs) Object.assign(entry, { action: 'preserve', reason: `owner dead; abandoned after ${iso(plus(new Date(r.updatedAt), POLICY.abandonAfterMs))}` });
      else if (dryRun) Object.assign(entry, { action: 'would-abandon', reason: 'owner dead for 24 hours' });
      else {
        r = updateReceipt(root, projectId, (x) => { x.state = 'abandoned'; x.failedAt = iso(now); x.retainUntil = x.disposable ? iso(plus(now, POLICY.failedRetentionMs)) : null; }, now);
        writeTerminal(root, r, 'abandoned', now);
        Object.assign(entry, { action: 'abandoned', state: 'abandoned', retainUntil: r.retainUntil, reason: 'owner dead for 24 hours' });
        if (r.disposable) {
          try { entry.preservation = await stopPreserved(root, projectId, { docker, now, processProbe, stopRelay }); }
          catch (error) { entry.preservation = 'failed'; report.failures.push({ projectId, error: error.message }); }
        }
      }
    } else if (r.disposable && r.state === 'passed') {
      if (ownerAlive) Object.assign(entry, { action: 'live', reason: 'one-shot owner is archiving or disposing' });
      else await disposeNow('contracts passed; disposal was interrupted');
    } else if (r.disposable && DISPOSABLE_EXPIRING.includes(r.state)) {
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
    const path = join(terminalDir, name);
    let data; try { data = JSON.parse(readFileSync(path, 'utf8')); } catch { data = {}; }
    // Receipts without expiresAt expire 30 days after their terminal time (file time as last resort).
    const terminalAt = data.recordedAt || data.disposedAt || data.failedAt || statSync(path).mtime.toISOString();
    const expiresAt = data.expiresAt || iso(plus(new Date(terminalAt), POLICY.terminalRetentionMs));
    if (now >= new Date(expiresAt)) {
      if (!dryRun) unlinkSync(join(terminalDir, name));
      report.prunedTerminal.push(name.slice(0, -5));
    }
  }
  // Private runner detail directories (paisaxe-contract-receipt-*) follow the same 30-day retention,
  // unless a retained task still references them as diagnostics.
  const base = realpathSync(tmpRoot);
  for (const name of readdirSync(base).filter((x) => x.startsWith('paisaxe-contract-receipt-'))) {
    const dir = join(base, name); const info = lstatSync(dir);
    if (!info.isDirectory() || info.uid !== process.getuid() || now - info.mtime < POLICY.terminalRetentionMs) continue;
    if (protectedDiagnostics.some((path) => path.startsWith(dir + '/'))) continue;
    if (!dryRun) rmSync(dir, { recursive: true });
    report.prunedDetails.push(name);
  }
  if (!dryRun) writePrivate(join(root, 'sweep-latest.json'), report);
  return report;
}

// ---- One-shot flow -----------------------------------------------------------------

/** prepare -> contracts -> archive receipt -> release lease -> dispose. Success requires both
 * passing contracts and complete disposal; a failure preserves the task for seven days. */
export async function runOneShot(options = {}) {
  const scope = options.processScope ?? createOwnedProcessScope();
  try { return await runOneShotOwned({ ...options, processScope: scope }); }
  finally { if (!options.processScope) scope.close(); }
}

async function runOneShotOwned({ root = process.cwd(), lifecycleDir = lifecycleRoot(), prepare, run, docker, now = () => new Date(), processProbe = processIdentity, stopRelay, processScope } = {}) {
  prepare ??= (await import('./prepare-contract-stack.mjs')).prepareStack;
  run ??= (await import('./run-contracts.mjs')).runContracts;
  const { publicContractReceipt } = await import('./ci-contracts.mjs');
  docker ??= await createDocker();
  let manifest;
  try { manifest = await prepare(root, { lifecycle: { disposable: true, task: 'one-shot', root: lifecycleDir }, processScope }); processScope.checkpoint(); }
  catch (error) {
    const projectId = error.projectId ?? manifest?.projectId;
    let r = projectId ? readReceipt(lifecycleDir, projectId) : null;
    if (r && processScope.interruption) r = updateReceipt(lifecycleDir, projectId, x => { x.interruption = processScope.interruption; x.state = 'interrupted'; x.failedAt = iso(now()); x.retainUntil = iso(plus(now(), POLICY.failedRetentionMs)); });
    let preservation = null;
    if (r) {
      // Preserve (stop, never remove) whatever the failed preparation allocated.
      try { preservation = await stopPreserved(lifecycleDir, r.projectId, { docker, now: now(), processProbe, stopRelay }); } catch (stopError) { preservation = `not stopped: ${stopError.message}`; }
      r = updateReceipt(lifecycleDir, r.projectId, (x) => { x.preservation = preservation; });
    }
    return { ok: false, projectId: projectId ?? null, contracts: 'not-run', failure: processScope.interruption ? 'interrupted' : 'preparation', cleanup: 'preserved', retainUntil: r?.retainUntil ?? null, preservation, detail: error.message };
  }
  const { projectId } = manifest;
  const lease = acquireConsumerLease(lifecycleDir, projectId, 'one-shot', { owner: selfOwner(processProbe), now: now() });
  updateReceipt(lifecycleDir, projectId, (r) => { r.state = 'running'; r.owner = selfOwner(processProbe); }, now());
  let receipt; let failure;
  try { receipt = await run({ root, taskDir: manifest.taskDir, processScope, commandTracker: createReceiptCommandTracker(lifecycleDir, projectId, { purpose: 'one-shot', leaseId: lease?.id }) }); processScope.checkpoint(); if (receipt?.status !== 'passed') failure = 'contracts'; }
  catch { failure = 'contracts'; }
  if (processScope.interruption) failure = 'interrupted';
  const archivedAt = now();
  let r = updateReceipt(lifecycleDir, projectId, (x) => {
    x.result = publicContractReceipt(receipt, failure);
    if (receipt?.receiptPath) x.diagnostics.push(receipt.receiptPath);
    x.state = failure === 'interrupted' ? 'interrupted' : failure ? 'failed' : 'passed';
    if (processScope.interruption) x.interruption = processScope.interruption;
    if (failure) { x.failedAt = iso(archivedAt); x.retainUntil = iso(plus(archivedAt, POLICY.failedRetentionMs)); }
  }, archivedAt);
  releaseConsumerLease(lifecycleDir, lease, archivedAt);
  if (failure) {
    let stopped;
    try { stopped = await stopPreserved(lifecycleDir, projectId, { docker, now: archivedAt, processProbe, stopRelay }); }
    catch (error) { stopped = `not stopped: ${error.message}`; }
    r = updateReceipt(lifecycleDir, projectId, (x) => { x.preservation = stopped; }, archivedAt);
    writeTerminal(lifecycleDir, r, 'failed', archivedAt);
    return { ok: false, projectId, contracts: 'failed', failure, cleanup: 'preserved', retainUntil: r.retainUntil, preservation: stopped };
  }
  try {
    await disposeOwned(lifecycleDir, projectId, { docker, now: now(), processProbe, stopRelay });
    if (processScope.interruption) return { ok: false, projectId, contracts: 'passed', failure: 'interrupted', cleanup: 'disposed' };
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
