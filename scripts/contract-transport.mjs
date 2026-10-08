import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { chmodSync, existsSync, lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import http from 'node:http';

const source = fileURLToPath(import.meta.url);
const digest = () => createHash('sha256').update(readFileSync(source)).digest('hex');
const insist = (ok, message) => { if (!ok) throw new Error(message); };
const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const controlPath = (m) => join(m.taskDir, 'transport.sock');
const launchPath = (m) => join(m.taskDir, 'transport.json');
const MAX_CONNECTIONS = 64;
const READINESS_MS = 30000;
const CONNECTION_MS = 120000;
const LIFETIME_MS = 3600000;

function validate(m, env) {
  insist(m?.version === 1 && /^paisaxe-contracts-[a-f0-9]{12}$/.test(m.projectId), 'Invalid transport task project');
  insist(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(m.nonce), 'Invalid transport nonce');
  insist(realpathSync(m.taskDir) === m.taskDir && !lstatSync(m.taskDir).isSymbolicLink() && basename(m.taskDir).startsWith('paisaxe-contracts-'), 'Invalid transport task directory');
  const api = new URL(m.apiUrl);
  insist(api.protocol === 'http:' && api.hostname === '127.0.0.1' && api.pathname === '/' && !api.search && !api.hash && !api.username && !api.password, 'Transport API must use literal IPv4 loopback');
  const ports = [m.dbPort, Number(api.port)];
  insist(ports.every(p => Number.isInteger(p) && p >= 1024 && p <= 65535 && ![54321, 54322].includes(p)) && ports[0] !== ports[1], 'Invalid/duplicate/shared transport ports');
  insist(/^[a-f0-9]{64}$/.test(m.migrationDigest), 'Invalid transport migration identity');
  insist(typeof env?.DOCKER_HOST === 'string' && /^unix:\/\/\/[^\r\n]+$/.test(env.DOCKER_HOST), 'Transport requires a pinned local Docker Unix socket');
  // Bound sockaddr_un length on macOS, including the terminating null.
  insist(Buffer.byteLength(controlPath(m)) < 104, 'Transport control socket path too long');
  return ports;
}
function identity(m, env) {
  return { version: 1, projectId: m.projectId, nonce: m.nonce, taskDir: m.taskDir,
    apiUrl: m.apiUrl, dbPort: m.dbPort, migrationDigest: m.migrationDigest, dockerHost: env.DOCKER_HOST, sourceDigest: digest() };
}
function same(actual, expected) {
  return Object.keys(expected).every(k => actual?.[k] === expected[k]);
}
function control(m, env, action) {
  validate(m, env);
  const path = controlPath(m);
  const info = lstatSync(path);
  insist(info.isSocket() && info.uid === process.getuid() && (info.mode & 0o077) === 0, 'Untrusted transport control socket');
  return new Promise((resolve, reject) => {
    const socket = net.connect(path); let result = '';
    socket.setTimeout(2000, () => socket.destroy(new Error('Transport control timeout')));
    socket.on('error', reject);
    socket.on('connect', () => socket.write(JSON.stringify({ action, identity: identity(m, env) }) + '\n'));
    socket.on('data', data => {
      result += data;
      if (result.length > 8192) socket.destroy(new Error('Invalid transport control response'));
      else if (result.includes('\n')) {
        try { const response = JSON.parse(result); insist(response.ok && same(response, identity(m, env)), 'Transport identity/source mismatch'); resolve(response); }
        catch (error) { reject(error); }
        socket.destroy();
      }
    });
    socket.on('end', () => { if (!result.includes('\n')) reject(new Error('Transport control closed')); });
  });
}
export async function verifyTransport(manifest, env) { return control(manifest, env, 'verify'); }
export async function stopTransport(manifest, env) {
  const receipt = await control(manifest, env, 'stop');
  for (let i = 0; i < 40 && existsSync(controlPath(manifest)); i++) await pause(50);
  insist(!existsSync(controlPath(manifest)), 'Transport cleanup incomplete');
  return receipt;
}
export async function startTransport(manifest, env) {
  validate(manifest, env);
  if (existsSync(controlPath(manifest))) return verifyTransport(manifest, env);
  // Exclusive creation avoids replacing a different launch identity or following a symlink.
  const file = launchPath(manifest);
  if (existsSync(file)) {
    insist(!lstatSync(file).isSymbolicLink() && same(JSON.parse(readFileSync(file, 'utf8')), identity(manifest, env)), 'Transport launch identity/source mismatch');
  } else writeFileSync(file, JSON.stringify(identity(manifest, env)), { flag: 'wx', mode: 0o600 });
  const child = spawn(process.execPath, [source, '--serve', file], { env, detached: true, stdio: 'ignore' });
  let failed = false; child.once('error', () => { failed = true; }); child.once('exit', () => { failed = true; }); child.unref();
  for (let i = 0; i < 100; i++) {
    if (existsSync(controlPath(manifest))) return verifyTransport(manifest, env);
    if (failed) break;
    await pause(50);
  }
  if (!failed) child.kill();
  throw new Error('Transport startup failed (occupied port, invalid identity or unavailable listener)');
}

// Docker Engine exec uses the documented non-TTY 8-byte stdout/stderr frame
// protocol. The Unix socket is pinned by localDockerEnvironment; no CLI inspect,
// name-based exec, pooled process, container cache or inherited Docker context.
const MAX_DOCKER_BYTES = 1024 * 1024;
function dockerJson(socketPath, method, path, body, signal) {
  return new Promise((resolve, reject) => {
    const bytes = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
    const request = http.request({ socketPath, method, path, agent: false, signal,
      headers: bytes ? { 'Content-Type': 'application/json', 'Content-Length': bytes.length } : {} }, response => {
      let length = 0; const chunks = [];
      response.on('data', chunk => {
        length += chunk.length;
        if (length > MAX_DOCKER_BYTES) request.destroy(new Error('Docker response exceeds limit'));
        else chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => {
        try {
          insist(response.statusCode >= 200 && response.statusCode < 300, 'Docker request unavailable');
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (error) { reject(error); }
      });
    });
    const timeout = setTimeout(() => request.destroy(new Error('Docker request deadline')), 5000);
    request.once('close', () => clearTimeout(timeout)); request.once('error', reject);
    request.end(bytes);
  });
}
function dockerStream(socketPath, execId, signal) {
  return new Promise((resolve, reject) => {
    const bytes = Buffer.from(JSON.stringify({ Detach: false, Tty: false }));
    const request = http.request({ socketPath, method: 'POST', path: `/exec/${execId}/start`, agent: false, signal,
      headers: { Connection: 'Upgrade', Upgrade: 'tcp', 'Content-Type': 'application/json', 'Content-Length': bytes.length } });
    const timeout = setTimeout(() => request.destroy(new Error('Docker exec start deadline')), 5000);
    request.once('upgrade', (response, socket, head) => {
      clearTimeout(timeout);
      if (response.statusCode !== 101) { socket.destroy(); reject(new Error('Docker exec refused upgrade')); return; }
      // Preserve bytes delivered with the upgrade before any stream listeners.
      socket.pause(); if (head.length) socket.unshift(head); resolve(socket);
    });
    request.once('response', response => { response.destroy(); reject(new Error('Docker exec did not upgrade')); });
    request.once('error', reject); request.once('close', () => clearTimeout(timeout)); request.end(bytes);
  });
}
function forwardFrames(upstream, client) {
  let pending = Buffer.alloc(0);
  upstream.on('data', bytes => {
    pending = pending.length ? Buffer.concat([pending, bytes]) : bytes;
    try {
      while (pending.length >= 8) {
        const size = pending.readUInt32BE(4), type = pending[0];
        insist(type <= 2 && pending[1] === 0 && pending[2] === 0 && pending[3] === 0 && size <= MAX_DOCKER_BYTES, 'Invalid Docker stream frame');
        if (pending.length < size + 8) break;
        const payload = pending.subarray(8, size + 8); pending = pending.subarray(size + 8);
        // Docker stream 0 (stdin echo) and 1 are stdout; stderr never reaches SQL/HTTP clients.
        if (type !== 2 && !client.write(payload)) upstream.pause();
      }
      insist(pending.length <= MAX_DOCKER_BYTES + 8, 'Docker stream buffer exceeds limit');
    } catch { client.destroy(); upstream.destroy(); }
  });
  client.on('drain', () => upstream.resume());
  upstream.once('end', () => { if (pending.length) client.destroy(); else client.end(); });
  upstream.once('close', () => { if (!upstream.readableEnded) client.destroy(); }); upstream.on('error', () => client.destroy());
}
async function serve(m, env) {
  const ports = validate(m, env); const proof = identity(m, env);
  insist(same(m, proof), 'Transport source changed before launch');
  const dockerSocket = env.DOCKER_HOST.slice('unix://'.length);
  const sockets = new Set(); const streams = new Set(); const controllers = new Set(); const servers = [];
  let stopping = false;
  const closeStream = stream => {
    if (stream.destroyed) return;
    stream.end();
    // Deliver stdin EOF before bounded teardown; BusyBox nc does not support -N.
    const timer = setTimeout(() => stream.destroy(), 250);
    stream.once('close', () => clearTimeout(timer));
  };
  const stop = async () => {
    if (stopping) return; stopping = true;
    for (const controller of controllers) controller.abort();
    for (const socket of sockets) socket.destroy();
    for (const stream of streams) closeStream(stream);
    await Promise.all(servers.map(server => new Promise(r => server.close(r))));
    clearTimeout(lifetime);
  };
  const lifetime = setTimeout(() => { void stop(); }, LIFETIME_MS);
  const ready = async (api, socket, signal) => {
    const deadline = Date.now() + READINESS_MS;
    const kinds = api ? ['db', 'kong'] : ['db'];
    const names = kinds.map(kind => `supabase_${kind}_${m.projectId}`);
    while (!stopping && !socket.destroyed && Date.now() < deadline) {
      try {
        const network = await dockerJson(dockerSocket, 'GET', `/networks/${m.projectId}`, undefined, signal);
        insist(network?.Internal === true && network.Labels?.['com.paisaxe.contracts.nonce'] === m.nonce && /^[a-f0-9]{64}$/.test(network.Id), 'Transport network ownership mismatch');
        const filters = encodeURIComponent(JSON.stringify({ name: names.map(name => `^/${name}$`) }));
        const containers = await dockerJson(dockerSocket, 'GET', `/containers/json?all=1&filters=${filters}`, undefined, signal);
        insist(Array.isArray(containers), 'Transport invalid container inventory');
        let dbId;
        for (const name of names) {
          const matches = containers.filter(container => container.Names?.includes('/' + name));
          if (matches.length === 0) throw new Error('Container not ready');
          insist(matches.length === 1, 'Transport ambiguous container identity');
          const container = matches[0]; const networks = container.NetworkSettings?.Networks || {};
          insist(/^[a-f0-9]{64}$/.test(container.Id) && container.Labels?.['com.supabase.cli.project'] === m.projectId &&
            JSON.stringify(Object.keys(networks)) === JSON.stringify([m.projectId]) && networks[m.projectId].NetworkID === network.Id,
          'Transport container ownership/network mismatch');
          const health = container.Health?.Status ?? (/\((healthy|unhealthy|health: starting)\)$/.exec(container.Status ?? '')?.[1]?.replace('health: ', ''));
          const isDb = name === names[0];
          // CLI bootstrap precedes the first Docker health probe. Only DB
          // traffic may reach its owned running container while it is starting.
          if (container.State !== 'running' || (isDb && !health) || (health && health !== 'healthy' && (api || health !== 'starting'))) throw new Error('Container not ready');
          if (name === names[0]) dbId = container.Id;
        }
        return dbId;
      } catch (error) {
        if (signal.aborted || error.message.startsWith('Transport ')) throw error;
        await pause(100);
      }
    }
    throw new Error('Transport readiness deadline');
  };
  const accept = api => async socket => {
    if (sockets.size >= MAX_CONNECTIONS || stopping) return socket.destroy();
    const controller = new AbortController(); controllers.add(controller);
    sockets.add(socket); socket.pause(); socket.setTimeout(CONNECTION_MS, () => socket.destroy());
    let upstream; const deadline = setTimeout(() => socket.destroy(), CONNECTION_MS);
    socket.on('error', () => {});
    socket.once('close', () => { clearTimeout(deadline); sockets.delete(socket); controllers.delete(controller); controller.abort(); if (upstream) closeStream(upstream); });
    try {
      const containerId = await ready(api, socket, controller.signal);
      if (socket.destroyed || stopping) return;
      const exec = await dockerJson(dockerSocket, 'POST', `/containers/${containerId}/exec`, {
        AttachStdin: true, AttachStdout: true, AttachStderr: true, Tty: false,
        Cmd: ['/usr/bin/nc', '-w', '120', api ? `supabase_kong_${m.projectId}` : '127.0.0.1', api ? '8000' : '5432'],
      }, controller.signal);
      insist(/^[a-f0-9]{64}$/.test(exec?.Id), 'Transport invalid exec identity');
      upstream = await dockerStream(dockerSocket, exec.Id, controller.signal);
      if (socket.destroyed || stopping) { closeStream(upstream); return; }
      streams.add(upstream); upstream.once('close', () => streams.delete(upstream));
      forwardFrames(upstream, socket); socket.pipe(upstream); upstream.resume(); socket.resume();
    } catch { socket.destroy(); }
  };
  const listen = (server, options) => new Promise((resolve, reject) => { server.once('error', reject); server.listen(options, resolve); });
  try {
    for (const [index, port] of ports.entries()) { const server = net.createServer(accept(index === 1)); servers.push(server); await listen(server, { host: '127.0.0.1', port, exclusive: true }); }
    const controlServer = net.createServer(socket => {
      let input = ''; socket.setTimeout(2000, () => socket.destroy()); socket.on('error', () => {});
      socket.on('data', data => {
        input += data;
        if (input.length > 8192) return socket.destroy();
        if (!input.includes('\n')) return;
        try {
          const request = JSON.parse(input);
          insist(same(request.identity, proof) && ['verify', 'stop'].includes(request.action), 'Untrusted control request');
          insist(servers.slice(0, 2).every((s, i) => s.listening && s.address().address === '127.0.0.1' && s.address().port === ports[i]), 'Transport listener ownership lost');
          socket.end(JSON.stringify({ ...proof, ok: true, pid: process.pid, connectionLimit: MAX_CONNECTIONS, lifetimeMs: LIFETIME_MS }) + '\n');
          if (request.action === 'stop') socket.once('close', () => { void stop(); });
        } catch { socket.destroy(); }
      });
    });
    servers.push(controlServer); await listen(controlServer, controlPath(m)); chmodSync(controlPath(m), 0o600);
    for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { void stop(); });
  } catch (error) { await stop(); throw error; }
}
if (process.argv[1] && resolve(process.argv[1]) === source) {
  try { insist(process.argv.length === 4 && process.argv[2] === '--serve', 'Invalid transport command'); await serve(JSON.parse(readFileSync(process.argv[3], 'utf8')), process.env); }
  catch { process.exitCode = 1; }
}
