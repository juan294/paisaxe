import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { EventEmitter, once } from 'node:events';
import net from 'node:net';
import http from 'node:http';
import { startTransport, verifyTransport, stopTransport } from './contract-transport.mjs';
let manifest, env, taskDir, daemon, state, connections;
const DB_ID = 'd'.repeat(64), KONG_ID = 'c'.repeat(64), NETWORK_ID = 'e'.repeat(64);
const port = async () => { const server = net.createServer(); await new Promise(r => server.listen(0, '127.0.0.1', r)); const result = server.address().port; await new Promise(r => server.close(r)); return result; };
const frame = (type, payload) => { const bytes = Buffer.from(payload), header = Buffer.alloc(8); header[0] = type; header.writeUInt32BE(bytes.length, 4); return Buffer.concat([header, bytes]); };
const pause = ms => new Promise(r => setTimeout(r, ms));
beforeEach(async () => {
  taskDir = realpathSync(mkdtempSync(join(tmpdir(), 'paisaxe-contracts-')));
  manifest = { version: 1, taskDir, projectId: 'paisaxe-contracts-012345abcdef', nonce: randomUUID(), apiUrl: `http://127.0.0.1:${await port()}`, dbPort: await port(), migrationDigest: 'a'.repeat(64) };
  env = { PATH: process.env.PATH, HOME: taskDir, DOCKER_HOST: 'unix://' + join(taskDir, 'docker.sock') };
  state = { calls: [], execs: [], readyAt: 0, healthReady: true, healthProbes: new EventEmitter(), networkNonce: manifest.nonce, extraNetwork: false, wrongId: false, malformed: false, truncated: false, active: 0, eof: 0 };
  connections = new Set();
  daemon = http.createServer(async (req, res) => {
    state.calls.push(req.url);
    const url = new URL(req.url, 'http://docker');
    const reply = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
    if (url.pathname === '/networks/' + manifest.projectId) return reply(200, { Id: NETWORK_ID, Internal: true, Labels: { 'com.paisaxe.contracts.nonce': state.networkNonce } });
    if (url.pathname === '/containers/json') {
      const health = state.healthReady ? 'healthy' : 'starting';
      state.healthProbes.emit('probe', health);
      const filters = JSON.parse(url.searchParams.get('filters')); assert.ok(filters.name.includes('^/supabase_db_' + manifest.projectId + '$'));
      const containers = Date.now() < state.readyAt ? [] : ['db', 'kong'].map(kind => ({ Id: kind === 'db' ? DB_ID : KONG_ID, Names: ['/supabase_' + kind + '_' + manifest.projectId], Labels: { 'com.supabase.cli.project': manifest.projectId }, State: 'running', ...(state.legacy ? { Status: 'Up 2 seconds (' + (health === 'starting' ? 'health: starting' : health) + ')' } : {}), ...((state.noHealth || (kind === 'db' && state.missingDbHealth) || (kind === 'kong' && state.noKongHealth)) ? {} : { Health: { Status: state.unhealthy ? 'unhealthy' : health } }), NetworkSettings: { Networks: { [manifest.projectId]: { NetworkID: state.wrongId ? 'f'.repeat(64) : NETWORK_ID }, ...(state.extraNetwork ? { bridge: { NetworkID: 'other' } } : {}) } } }));
      return reply(200, containers);
    }
    if (url.pathname === '/containers/' + DB_ID + '/exec') {
      let body = ''; for await (const chunk of req) body += chunk;
      state.execs.push({ at: Date.now(), body: JSON.parse(body) }); return reply(201, { Id: String(state.execs.length).padStart(64, '0') });
    }
    reply(404, { message: 'unknown third-party endpoint' });
  });
  daemon.on('connection', socket => { connections.add(socket); socket.once('close', () => connections.delete(socket)); });
  daemon.on('upgrade', (req, socket, head) => {
    assert.deepEqual(JSON.parse(head.toString()), { Detach: false, Tty: false });
    assert.match(req.url, /^\/exec\/[a-f0-9]{64}\/start$/);
    socket.on('error', () => {});
    // The HTTP upgrade request body arrives as the upgrade head.
    const respond = () => {
      socket.write('HTTP/1.1 101 UPGRADED\r\nConnection: Upgrade\r\nUpgrade: tcp\r\n\r\n');
      state.active++; socket.once('close', () => state.active--);
      socket.on('end', () => { state.eof++; socket.end(); });
      socket.on('data', bytes => {
        if (state.malformed || state.oversized || state.reserved) { const invalid = Buffer.alloc(8); invalid[0] = state.malformed ? 9 : 1; if (state.oversized) invalid.writeUInt32BE(1024 * 1024 + 1, 4); if (state.reserved) invalid[1] = 1; socket.end(invalid); return; }
        if (state.truncated) { socket.end(frame(1, bytes).subarray(0, 9)); return; }
        if (state.finalResponse) { socket.end(frame(1, state.finalResponse)); return; }
        const stdout = frame(1, bytes); socket.write(frame(2, 'private stderr'));
        socket.write(stdout.subarray(0, 3)); socket.write(stdout.subarray(3, 9)); socket.write(stdout.subarray(9));
      });
    };
    respond();
  });
  await new Promise(r => daemon.listen(join(taskDir, 'docker.sock'), r));
});
afterEach(async () => { try { await stopTransport(manifest, env); } catch {} for (const socket of connections) socket.destroy(); await new Promise(r => daemon.close(r)); rmSync(taskDir, { recursive: true, force: true }); });
function exchange(port, bytes) { return new Promise((resolve, reject) => { const socket = net.connect(port, '127.0.0.1', () => socket.write(bytes)); socket.setTimeout(2000, () => socket.destroy(new Error('exchange timeout'))); socket.on('error', reject); socket.on('close', () => reject(new Error('closed'))); const chunks = []; let length = 0; socket.on('data', chunk => { chunks.push(chunk); length += chunk.length; if (length >= bytes.length) { resolve(Buffer.concat(chunks)); socket.destroy(); } }); }); }
test('direct Unix API forwards binary stdout, discards stderr and executes fixed targets by immutable container id', async () => {
  const proof = await startTransport(manifest, env); assert.equal((await verifyTransport(manifest, env)).sourceDigest, proof.sourceDigest);
  const bytes = Buffer.from([0, 255, 1, 13, 10, 128]);
  assert.deepEqual(await exchange(manifest.dbPort, bytes), bytes);
  assert.deepEqual(await exchange(Number(new URL(manifest.apiUrl).port), bytes), bytes);
  assert.deepEqual(state.execs.map(x => x.body.Cmd), [['/usr/bin/nc', '-w', '120', '127.0.0.1', '5432'], ['/usr/bin/nc', '-w', '120', 'supabase_kong_' + manifest.projectId, '8000']]);
  for (const { body } of state.execs) assert.deepEqual(body, { AttachStdin: true, AttachStdout: true, AttachStderr: true, Tty: false, Cmd: body.Cmd });
});
test('DB startup works before first health probe and waits for container creation', async () => { state.readyAt = Date.now() + 150; state.healthReady = false; await startTransport(manifest, env); assert.deepEqual(await exchange(manifest.dbPort, Buffer.from('bootstrap')), Buffer.from('bootstrap')); });
async function assertApiWaitsForHealth(bytes) {
  state.healthReady = false;
  await startTransport(manifest, env);
  const healthProbe = once(state.healthProbes, 'probe', { signal: AbortSignal.timeout(2000) });
  const result = exchange(Number(new URL(manifest.apiUrl).port), bytes);
  try {
    assert.equal((await healthProbe)[0], 'starting');
    // A second starting observation proves the relay polls rather than using
    // the first response to enqueue an exec while readiness remains withheld.
    const nextProbe = once(state.healthProbes, 'probe', { signal: AbortSignal.timeout(2000) });
    assert.equal((await nextProbe)[0], 'starting');
    assert.equal(state.execs.length, 0);
    state.healthReady = true;
    assert.deepEqual(await result, bytes);
    assert.equal(state.execs.length, 1);
  } finally {
    state.healthReady = true;
    await result.catch(() => {});
  }
}
test('API does not create exec before both containers are healthy', async () => { await assertApiWaitsForHealth(Buffer.from('ready')); });
for (const mode of ['nonce', 'outbound', 'network-id']) test(`refuses ${mode} mismatch before exec`, async () => { if (mode === 'nonce') state.networkNonce = randomUUID(); if (mode === 'outbound') state.extraNetwork = true; if (mode === 'network-id') state.wrongId = true; await startTransport(manifest, env); await assert.rejects(exchange(manifest.dbPort, Buffer.from('blocked'))); assert.equal(state.execs.length, 0); });
for (const mode of ['malformed', 'truncated', 'oversized', 'reserved']) test(`rejects ${mode} Docker multiplex frames`, async () => { state[mode] = true; await startTransport(manifest, env); await assert.rejects(exchange(manifest.dbPort, Buffer.from('frame payload'))); });
test('client EOF and active stop close owned hijacked streams', async () => { await startTransport(manifest, env); const socket = net.connect(manifest.dbPort, '127.0.0.1'); socket.on('error', () => {}); socket.write('active'); socket.resume(); for (let i = 0; !state.active && i < 40; i++) await pause(25); assert.equal(state.active, 1); socket.end(); for (let i = 0; state.active && i < 40; i++) await pause(25); assert.equal(state.active, 0); assert.equal(state.eof, 1); const second = net.connect(manifest.dbPort, '127.0.0.1'); second.on('error', () => {}); second.write('stop'); second.resume(); for (let i = 0; !state.active && i < 40; i++) await pause(25); assert.equal(state.active, 1); await stopTransport(manifest, env); for (let i = 0; state.active && i < 40; i++) await pause(25); assert.equal(state.active, 0); second.destroy(); });
test('wrong nonce cannot stop relay and occupied ports do not affect unrelated listener', async () => { await startTransport(manifest, env); await assert.rejects(stopTransport({ ...manifest, nonce: randomUUID() }, env)); await stopTransport(manifest, env); const server = net.createServer(); await new Promise(r => server.listen(manifest.dbPort, '127.0.0.1', r)); try { await assert.rejects(startTransport(manifest, env)); assert.equal(server.listening, true); } finally { await new Promise(r => server.close(r)); } });
test('remote endpoint, daemon, duplicate ports and default project are rejected', async () => { for (const [m, e] of [[manifest, { ...env, DOCKER_HOST: 'tcp://remote:2375' }], [{ ...manifest, apiUrl: 'http://example.com:12345' }, env], [{ ...manifest, dbPort: Number(new URL(manifest.apiUrl).port) }, env], [{ ...manifest, projectId: 'default' }, env]]) await assert.rejects(startTransport(m, e)); });

test('legacy Docker summary health gates API before exec and permits its later healthy state', async () => {
  state.noHealth = true; state.legacy = true;
  await assertApiWaitsForHealth(Buffer.from('legacy'));
});
test('an explicitly unhealthy DB is not used for bootstrap', async () => {
  state.unhealthy = true; await startTransport(manifest, env);
  await assert.rejects(exchange(manifest.dbPort, Buffer.from('unhealthy'))); assert.equal(state.execs.length, 0);
});
test('ownership is rechecked on each connection without a container cache', async () => {
  await startTransport(manifest, env); assert.deepEqual(await exchange(manifest.dbPort, Buffer.from('first')), Buffer.from('first'));
  state.extraNetwork = true; await assert.rejects(exchange(manifest.dbPort, Buffer.from('second'))); assert.equal(state.execs.length, 1);
});

test('API requires positive DB health evidence but accepts Kong without a configured healthcheck', async () => {
  state.noKongHealth = true; await startTransport(manifest, env);
  assert.deepEqual(await exchange(Number(new URL(manifest.apiUrl).port), Buffer.from('kong')), Buffer.from('kong'));
  state.missingDbHealth = true;
  await assert.rejects(exchange(Number(new URL(manifest.apiUrl).port), Buffer.from('missing DB health')));
  assert.equal(state.execs.length, 1);
});

test('clean Docker EOF preserves the complete final response under client backpressure', async () => {
  state.finalResponse = Buffer.alloc(1024 * 1024, 0xa5); await startTransport(manifest, env);
  const result = await new Promise((resolve, reject) => {
    const socket = net.connect(manifest.dbPort, '127.0.0.1', () => { socket.write('query'); socket.pause(); setTimeout(() => socket.resume(), 300); });
    const chunks = []; const deadline = setTimeout(() => { socket.destroy(); reject(new Error('final response deadline; bytes=' + chunks.reduce((n, b) => n + b.length, 0))); }, 3000); socket.once('close', () => clearTimeout(deadline));
    socket.on('data', bytes => chunks.push(bytes)); socket.once('error', reject); socket.once('end', () => resolve(Buffer.concat(chunks))); socket.once('close', hadError => { reject(new Error('final response closed before complete EOF')); });
  });
  assert.equal(result.length, state.finalResponse.length); assert.ok(result.equals(state.finalResponse));
});
