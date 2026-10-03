import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir, realpath, chmod, cp } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, request as httpRequest } from 'node:http';
import { isDeepStrictEqual } from 'node:util';
import { SOURCE_GUARD } from './ci-cadence-source-guard.mjs';

const SHA = /^[a-f0-9]{40}$/;
const ID = /^[a-f0-9]{64}$/;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw Error(message); };
const ports = { db: 5432, kong: 8000, auth: 9999, rest: 3000, realtime: 4000, storage: 5000, inbucket: 8025 };
const images = { db: 'postgres', kong: 'kong', auth: 'gotrue', rest: 'postgrest', realtime: 'realtime', storage: 'storage-api', inbucket: 'mailpit' };
const runtime = join(dirname(fileURLToPath(import.meta.url)), 'ci-cadence-smoke-runtime');
const safeEnvironment = home => ({ PATH: '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin', HOME: home, LANG: 'C.UTF-8', SUPABASE_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_GRAFT_FILE: '/dev/null', GIT_NO_REPLACE_OBJECTS: '1' });

export function validateNativeResources(rows, { projectId, work, networkId, expectedImages, previous = null }) {
  if (!Array.isArray(rows) || rows.length !== 7 || new Set(rows.map(row => row.Id)).size !== 7) fail('Seven distinct native resources required');
  const services = {};
  for (const row of rows) {
    const service = Object.keys(ports).find(key => row.Name === '/supabase_' + key + '_' + projectId.slice(0, 40) || (key === 'realtime' && row.Name === '/realtime-dev.supabase_realtime_' + projectId.slice(0, 40)));
    if (!service || services[service] || !ID.test(row.Id ?? '') || !row.State?.Running || row.State.Pid < 1 || row.State.Health?.Status === 'unhealthy'
        || row.Config?.Labels?.['com.supabase.cli.project'] !== projectId.slice(0, 40) || row.Config.Labels['com.supabase.cli.workdir'] !== work
        || Object.keys(row.NetworkSettings?.Networks ?? {}).join() !== projectId || row.NetworkSettings.Networks[projectId].NetworkID !== networkId
        || !/^172\.30\.214\.\d+$/.test(row.NetworkSettings.Networks[projectId].IPAddress)
        || row.Image !== expectedImages[images[service]] || Object.values(row.NetworkSettings.Ports ?? {}).some(bindings => bindings?.some(binding => binding.HostIp !== '127.0.0.1'))) fail('Native resource identity or boundary changed');
    if (previous) {
      const old = previous.find(old => old.Id === row.Id);
      if (!old || row.State.StartedAt !== old.State.StartedAt || row.State.Pid !== old.State.Pid || !isDeepStrictEqual(row.Config, old.Config) || !isDeepStrictEqual(row.Mounts, old.Mounts) || !isDeepStrictEqual(row.NetworkSettings.Networks, old.NetworkSettings.Networks)) fail('Native incarnation replaced');
    }
    services[service] = row;
  }
  return services;
}

export function dependencyPayloads(lock) {
  if (!lock || lock.lockfileVersion !== 3 || !lock.packages || typeof lock.packages !== 'object' || Array.isArray(lock.packages)) fail('Exact npm lockfile required');
  const payloads = new Map();
  for (const [path, row] of Object.entries(lock.packages)) {
    if (path === '') continue;
    if (!path.startsWith('node_modules/') || row.link || typeof row.resolved !== 'string' || typeof row.integrity !== 'string') fail('Unsupported dependency acquisition');
    const url = new URL(row.resolved);
    if (url.protocol !== 'https:' || url.hostname !== 'registry.npmjs.org' || url.username || url.password || url.port || url.hash || url.search || !/^\/(?:@[^/]+\/)?[^/]+\/-\/[^/]+\.tgz$/.test(url.pathname) || !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(row.integrity)) fail('Dependency origin or integrity unavailable');
    if (payloads.has(row.resolved) && payloads.get(row.resolved) !== row.integrity) fail('Conflicting dependency integrity');
    payloads.set(row.resolved, row.integrity);
  }
  if (!payloads.size || payloads.size > 2000) fail('Bounded dependency inventory');
  return [...payloads].map(([url, integrity]) => ({ url, integrity }));
}

/** Trusted host process, never loaded from candidate bytes. All Docker/CLI
 * authority stays here. Transport seams are external processes only; unit
 * responses cannot establish physical runtime qualification. */
export async function acquireSmoke({ root, candidateSha, directory, scope = 'artifact-smoke', deadline = performance.now() + 3_600_000 }, { execute } = {}) {
  if (process.platform !== 'linux' || process.arch !== 'x64' || !SHA.test(candidateSha ?? '') || candidateSha === '0'.repeat(40) || !['artifact-smoke', 'full'].includes(scope)) fail('Linux immutable smoke input required');
  root = await realpath(root); directory = resolve(directory);
  if (directory === root || directory.startsWith(root + '/')) fail('Host evidence must be outside candidate');
  await mkdir(directory, { mode: 0o700 }); await chmod(directory, 0o700);
  const nonce = randomBytes(16).toString('hex'), projectId = 'ci-cadence-qa-' + nonce;
  const work = join(directory, projectId), home = join(work, 'host-home'), candidate = join(work, 'candidate'), trusted = join(work, 'trusted'), evidence = join(work, 'evidence'), cache = join(work, 'cache');
  for (const path of [work, home, candidate, trusted, evidence, cache]) await mkdir(path, { mode: 0o700 });
  const journal = { schemaVersion: 1, nonce, projectId, ownerProcessId: process.pid, createdAt: new Date().toISOString(), state: 'public-preparation', candidateSha, containers: [], networks: [], volumes: [], commands: [] };
  const save = () => writeFile(join(work, 'journal.json'), JSON.stringify(journal, null, 2) + '\n', { mode: 0o600 });
  let cleanupDeadline;
  const command = async (argv, { cwd = work, input, milliseconds = 120_000, env = {} } = {}) => {
    const timeout = Math.min(milliseconds, Math.floor((cleanupDeadline ?? deadline) - performance.now())); if (timeout < 1) fail('Smoke acquisition deadline');
    const result = execute ? await execute(argv, { cwd, input, timeout, env: { ...safeEnvironment(home), ...env } }) : await new Promise((resolveResult, reject) => {
      const child = spawn(argv[0], argv.slice(1), { cwd, env: { ...safeEnvironment(home), ...env }, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
      const chunks = [], errors = []; let size = 0; let stopped = false; const kill = () => { stopped = true; try { process.kill(-child.pid, 'SIGKILL'); } catch { /* joined */ } };
      const timer = setTimeout(kill, timeout); const collect = parts => chunk => { size += chunk.length; if (size > 64 * 1024 * 1024) kill(); else parts.push(chunk); };
      child.stdout.on('data', collect(chunks)); child.stderr.on('data', collect(errors)); child.once('error', reject);
      child.once('close', (code, signal) => { clearTimeout(timer); resolveResult({ code, signal, stopped, output: Buffer.concat(chunks), stderr: Buffer.concat(errors) }); }); child.stdin.end(input);
    });
    const name = 'command-' + String(journal.commands.length).padStart(4, '0');
    await writeFile(join(work, name + '.log'), result.output ?? '', { mode: 0o600, flag: 'wx' });
    await writeFile(join(work, name + '.stderr.log'), result.stderr ?? '', { mode: 0o600, flag: 'wx' });
    journal.commands.push({ argv, cwd, code: result.code, signal: result.signal ?? null, stopped: !!result.stopped, log: name + '.log' }); await save();
    if (result.code !== 0 || result.signal || result.stopped) fail('Host command failed; private journal retained: ' + name);
    return Buffer.from(result.output ?? '').toString('utf8');
  };
  const docker = (...args) => command(['/usr/bin/docker', ...args]);
  const createNative = async (row, body) => {
    // Linux hosted daemon only. No candidate-selected Docker URL or API method.
    const result = await new Promise((resolveResult, reject) => {
      const bytes = Buffer.from(JSON.stringify(body));
      const req = httpRequest({ socketPath: '/var/run/docker.sock', method: 'POST', path: '/v1.43/containers/create?name=' + encodeURIComponent(row.Name.slice(1)), headers: { 'Content-Type': 'application/json', 'Content-Length': bytes.length } }, res => {
        const chunks = []; let count = 0;
        res.on('data', chunk => { count += chunk.length; if (count > 1048576) req.destroy(Error('Docker create body')); else chunks.push(chunk); });
        res.on('end', () => { try { if (res.statusCode !== 201) fail('Owned native recreate failed'); resolveResult(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (error) { reject(error); } });
      });
      req.setTimeout(30000, () => req.destroy(Error('Docker create deadline'))); req.on('error', reject); req.end(bytes);
    });
    if (!ID.test(result.Id ?? '')) fail('Native replacement identity'); return result.Id;
  };
  const inspect = async ids => JSON.parse(await docker('inspect', ...ids));
  let bridge; let policySnapshots; let nativeSnapshot; let appSnapshot; let serverSnapshot;
  const verifyOwnership = async () => {
    if (!nativeSnapshot) fail('Acquisition incomplete');
    const current = await inspect(nativeSnapshot.map(row => row.Id));
    validateNativeResources(current, { projectId, work, networkId: journal.networks[0], expectedImages: journal.expectedImages, previous: nativeSnapshot });
    const network = JSON.parse(await docker('network', 'inspect', journal.networks[0]))[0];
    if (network.Labels?.['ci-cadence.nonce'] !== nonce || network.Internal !== false || !isDeepStrictEqual(Object.keys(network.Containers).sort(), journal.containers.slice().sort())) fail('Owned network or attachment changed');
    for (const old of [appSnapshot, serverSnapshot].filter(Boolean)) {
      const row = (await inspect([old.Id]))[0];
      if (!row.State.Running || row.State.Pid !== old.State.Pid || row.State.StartedAt !== old.State.StartedAt || !isDeepStrictEqual(row.Config, old.Config) || !isDeepStrictEqual(row.HostConfig, old.HostConfig) || !isDeepStrictEqual(row.Mounts, old.Mounts)) fail('APP incarnation changed');
    }
    for (const [id, expected] of Object.entries(policySnapshots ?? {})) {
      const text = await rules(id); if (text !== expected) fail('Namespace policy changed');
    }
    if (physicalGit('rev-parse', 'HEAD').trim() !== candidateSha) fail('Physical candidate identity changed');
    await command(['/bin/bash', '--noprofile', '--norc', '-p', '-e', '-o', 'pipefail', '-c', SOURCE_GUARD], { cwd: candidate, env: { SOURCE_SHA: candidateSha } });
  };
  const physicalGit = (...args) => execFileSync('/usr/bin/git', ['--no-replace-objects', '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-c', 'core.useReplaceRefs=false', ...args], { cwd: candidate, env: safeEnvironment(home), encoding: 'utf8', timeout: 5000, maxBuffer: 16_000_000 });
  let tool;
  const sidecar = (id, args, { input } = {}) => command(['/usr/bin/docker', 'run', '--rm', '--network', 'container:' + id, '--user', '0', '--cap-drop', 'ALL', '--cap-add', 'NET_ADMIN', '--security-opt', 'no-new-privileges', '--read-only', '--tmpfs', '/run', '--tmpfs', '/tmp', '--mount', 'type=bind,source=' + runtime + ',target=/policy,readonly', '--entrypoint', '/bin/bash', tool, ...args], { input });
  const rules = async id => sidecar(id, ['-c', 'iptables-save; ip6tables-save']);
  const applyPolicy = async (id, management, peers) => {
    // A tool sidecar obtains the actual shared namespace identifier, including
    // distroless services which have no shell/readlink of their own.
    const namespace = (await sidecar(id, ['-c', 'readlink /proc/self/ns/net'])).trim();
    if (!/^net:\[\d+\]$/.test(namespace)) fail('Physical namespace unavailable');
    await sidecar(id, ['/policy/namespace-policy.sh', namespace, String(management), ...peers]);
    const text = await rules(id);
    if (!text.includes(':OUTPUT DROP') || !text.includes(':INPUT DROP') || !text.includes(':FORWARD DROP')) fail('Kernel deny readback');
    return text;
  };
  const deny = async id => {
    const code = `import socket\nfor family,address,port in [(socket.AF_INET,'1.1.1.1',443),(socket.AF_INET,'8.8.8.8',53),(socket.AF_INET,'127.0.0.11',53),(socket.AF_INET,'172.30.214.1',443),(socket.AF_INET6,'2606:4700:4700::1111',443)]:\n for kind in [socket.SOCK_STREAM,socket.SOCK_DGRAM]:\n  s=socket.socket(family,kind);s.settimeout(.5)\n  try:\n   if kind==socket.SOCK_STREAM:s.connect((address,port));raise RuntimeError('outbound connected')\n   else:s.sendto((b'\\x12\\x34\\x01\\x00\\x00\\x01\\x00\\x00\\x00\\x00\\x00\\x00\\x07example\\x03com\\x00\\x00\\x01\\x00\\x01' if port==53 else b'\\x01\\x00'), (address,port));s.recv(64);raise RuntimeError('outbound replied')\n  except (TimeoutError,OSError):pass\n  finally:s.close()\n`;
    await command(['/usr/bin/docker', 'run', '--rm', '--network', 'container:' + id, '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--read-only', '--entrypoint', '/usr/bin/python3', tool, '-I', '-c', code]);
  };
  try {
    const manifest = JSON.parse(await readFile(join(runtime, 'public-inputs.json'), 'utf8'));
    const build = join(work, 'public-build'); await mkdir(join(build, 'public'), { recursive: true, mode: 0o700 });
    for (const name of ['Dockerfile', '.dockerignore']) await cp(join(runtime, name), join(build, name));
    const acquire = async (row, path) => {
      const url = new URL(row.url); if (url.protocol !== 'https:' || url.username || url.password || !/^[a-f0-9]{64}$/.test(row.sha256 ?? '')) fail('Pinned public input required');
      await command(['/usr/bin/curl', '--disable', '--fail', '--silent', '--show-error', '--location', '--proto', '=https', '--proto-redir', '=https', '--max-time', '90', '--max-filesize', '536870912', ...(row.userAgent ? ['--user-agent', row.userAgent] : []), '--output', path, row.url]);
      const bytes = await readFile(path); if (digest(bytes) !== row.sha256 || (row.bytes && bytes.length !== row.bytes)) fail('Public payload digest');
    };
    for (const row of manifest.inputs) await acquire(row, join(build, 'public', row.name));
    await writeFile(join(build, 'public.sha256'), manifest.inputs.map(row => row.sha256 + '  ' + row.name).join('\n') + '\n');
    await command(['/usr/bin/docker', 'build', '--platform', 'linux/amd64', '--tag', projectId + '-public-tools', build], { milliseconds: 900_000 });
    const image = JSON.parse(await docker('image', 'inspect', projectId + '-public-tools'))[0];
    if (image.Os !== 'linux' || image.Architecture !== 'amd64' || !ID.test(image.Id?.replace(/^sha256:/, '') ?? '')) fail('Public Linux tool image'); tool = image.Id; journal.publicToolImage = image.Id;
    const archive = join(work, 'supabase.tar.gz'); await acquire(manifest.supabaseCli.asset, archive);
    await command(['/usr/bin/tar', '-xzf', archive, '-C', home, 'supabase']);
    const cli = join(home, 'supabase'); if (digest(await readFile(cli)) !== manifest.supabaseCli.binary.sha256) fail('Public CLI binary'); await chmod(cli, 0o700);
    if ((await command([cli, '--version'])).trim() !== '2.119.0') fail('Public CLI version');
    journal.expectedImages = {};
    for (const row of manifest.nativeImages) {
      const name = row.image.split('/').at(-1), pin = row.image + '@' + row.platforms.amd64.manifestDigest;
      await docker('pull', '--platform', 'linux/amd64', pin); await docker('tag', pin, row.image + ':' + row.version);
      const observed = JSON.parse(await docker('image', 'inspect', pin))[0];
      if (observed.Os !== 'linux' || observed.Architecture !== 'amd64' || !observed.RepoDigests?.includes(pin)) fail('Public native platform pin'); journal.expectedImages[name] = observed.Id;
    }
    const original = execFileSync('/usr/bin/git', ['--no-replace-objects', '-c', 'core.hooksPath=/dev/null', 'rev-parse', 'HEAD'], { cwd: root, env: safeEnvironment(home), encoding: 'utf8' }).trim();
    if (original !== candidateSha) fail('Smoke source changed before acquisition');
    await command(['/usr/bin/git', 'init', '--quiet', '--template=', candidate]);
    await command(['/usr/bin/git', '-c', 'protocol.file.allow=always', 'fetch', '--no-tags', '--no-recurse-submodules', root, candidateSha], { cwd: candidate });
    await command(['/usr/bin/git', '-c', 'core.hooksPath=/dev/null', 'checkout', '--quiet', '--detach', candidateSha], { cwd: candidate });
    const lockBytes = await readFile(join(candidate, 'package-lock.json')), payloads = dependencyPayloads(JSON.parse(lockBytes));
    // Acquire cache bodies before any lifecycle hook and without candidate
    // package config being interpreted by npm. Exact registry/integrity only.
    for (let i = 0; i < payloads.length; i++) {
      const row = payloads[i], path = join(cache, 'package-' + i + '.tgz');
      await command(['/usr/bin/curl', '--disable', '--fail', '--silent', '--show-error', '--proto', '=https', '--max-time', '60', '--max-filesize', '134217728', '--output', path, row.url]);
      if ('sha512-' + createHash('sha512').update(await readFile(path)).digest('base64') !== row.integrity) fail('Lock payload integrity');
      await docker('run', '--rm', '--network', 'none', '--user', String(process.getuid()), '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--mount', 'type=bind,source=' + cache + ',target=/cache', '--env', 'HOME=/cache', '--entrypoint', '/opt/node-v24.21.0/bin/npm', tool, 'cache', 'add', '/cache/package-' + i + '.tgz', '--cache=/cache/npm', '--ignore-scripts');
    }
    const config = (await readFile(join(runtime, 'bootstrap-config.toml'), 'utf8')).replace('ci-cadence-qa-bootstrap', projectId);
    if (!/\[db.seed\][\s\S]*?enabled = false/.test(config) || /\[db.seed\][\s\S]*?enabled = true/.test(config.split('[db.network_restrictions]')[0])) fail('Seed disabled bootstrap');
    await mkdir(join(work, 'supabase', 'migrations'), { recursive: true, mode: 0o700 }); await writeFile(join(work, 'supabase', 'config.toml'), config, { mode: 0o600 });
    const beforeContainers = new Set((await docker('ps', '-aq', '--no-trunc')).trim().split(/\s+/).filter(Boolean));
    const beforeVolumes = new Set((await docker('volume', 'ls', '-q')).trim().split(/\s+/).filter(Boolean));
    const existingNetworks = (await docker('network', 'ls', '-q')).trim().split(/\s+/).filter(Boolean);
    for (const id of existingNetworks) { const row = JSON.parse(await docker('network', 'inspect', id))[0]; if ((row.IPAM.Config ?? []).some(row => row.Subnet?.startsWith('172.30.214.'))) fail('Owned subnet overlaps existing network'); }
    const network = (await docker('network', 'create', '--driver', 'bridge', '--subnet', '172.30.214.0/24', '--gateway', '172.30.214.1', '--opt', 'com.docker.network.bridge.host_binding_ipv4=127.0.0.1', '--label', 'ci-cadence.nonce=' + nonce, projectId)).trim();
    journal.networks = [network]; journal.state = 'trusted-empty-baseline'; await save();
    await command([cli, 'start', '--workdir', work, '--network-id', network, '--exclude', 'studio,imgproxy,pgmeta,edge-runtime,logflare,vector,supavisor'], { milliseconds: 360_000 });
    const added = (await docker('ps', '-aq', '--no-trunc')).trim().split(/\s+/).filter(id => id && !beforeContainers.has(id));
    const rows = (await inspect(added)).filter(row => row.Config?.Labels?.['com.supabase.cli.workdir'] === work && row.Config.Labels['com.supabase.cli.project'] === projectId.slice(0, 40));
    // Linux bridge binding option must actually hold. A platform that ignores it
    // blocks here; the host never admits public bindings or silently recreates.
    if (rows.length !== 7 || rows.some(row => !ID.test(row.Id) || !Object.values(journal.expectedImages).includes(row.Image)
        || Object.keys(row.NetworkSettings.Networks).join() !== projectId || row.NetworkSettings.Networks[projectId].NetworkID !== network)) fail('Exact new baseline ownership');
    journal.containers = rows.map(row => row.Id); await save();
    const volumes = [...new Set(rows.flatMap(row => row.Mounts.filter(mount => mount.Type === 'volume').map(mount => mount.Name)))];
    if (volumes.some(name => beforeVolumes.has(name))) fail('Preexisting volume forbidden'); journal.volumes = volumes;
    const extraHosts = [...new Set(rows.flatMap(row => [row.Name.slice(1), ...row.NetworkSettings.Networks[projectId].Aliases].map(name => {
      if (!/^[A-Za-z0-9._-]+$/.test(name)) fail('Owned native host alias');
      return name + ':' + row.NetworkSettings.Networks[projectId].IPAddress;
    })))];
    // Preserve native writable-layer gateway files before any replacement.
    // The CLI's double-init TTL=5 overwrites its intended long static hosts; the
    // sole native env adjustment retains that original 10-year intent.
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index], kong = row.Name.startsWith('/supabase_kong_');
      const bindings = row.HostConfig.PortBindings ?? {};
      const needsBinding = Object.values(bindings).some(values => values?.some(value => value.HostIp !== '127.0.0.1'));
      if (!needsBinding && !kong) continue;
      const preserved = join(work, 'gateway-files');
      if (kong) {
        await mkdir(preserved, { mode: 0o700 });
        for (const name of ['kong.yml', 'localhost.crt', 'localhost.key']) await docker('cp', '--archive', row.Id + ':/home/kong/' + name, join(preserved, name));
      }
      const body = { ...structuredClone(row.Config), Image: row.Image, HostConfig: structuredClone(row.HostConfig), NetworkingConfig: { EndpointsConfig: { [projectId]: { IPAMConfig: { IPv4Address: row.NetworkSettings.Networks[projectId].IPAddress }, Aliases: row.NetworkSettings.Networks[projectId].Aliases } } } };
      if (kong) body.HostConfig.ExtraHosts = extraHosts;
      for (const values of Object.values(body.HostConfig.PortBindings ?? {})) for (const value of values ?? []) value.HostIp = '127.0.0.1';
      if (kong) body.Env = [...body.Env.filter(value => !value.startsWith('KONG_DNS_VALID_TTL=')), 'KONG_DNS_VALID_TTL=315360000'];
      await docker('stop', '--time', '10', row.Id); await docker('rm', row.Id);
      const id = await createNative(row, body); journal.containers[journal.containers.indexOf(row.Id)] = id; await save();
      if (kong) for (const name of ['kong.yml', 'localhost.crt', 'localhost.key']) await docker('cp', '--archive', join(preserved, name), id + ':/home/kong/' + name);
      await docker('start', id); rows[index] = (await inspect([id]))[0];
      const expected = { ...row.Config, Image: row.Image, ...(kong ? { Env: body.Env } : {}) };
      if (!isDeepStrictEqual(rows[index].Config, expected) || !isDeepStrictEqual(rows[index].HostConfig, body.HostConfig)) fail('Native config changed beyond reviewed boundary');
      if (!isDeepStrictEqual(rows[index].Mounts, row.Mounts)) fail('Native mounts changed during owned replacement');
      journal.nativeReplacements ??= []; journal.nativeReplacements.push({ originalId: row.Id, id, loopbackOnly: true, staticGatewayTtl: kong });
    }
    const services = validateNativeResources(rows, { projectId, work, networkId: network, expectedImages: journal.expectedImages });
    const peers = Object.entries(services).flatMap(([name, row]) => [row.NetworkSettings.Networks[projectId].IPAddress + ':' + ports[name], ...(name === 'inbucket' ? [row.NetworkSettings.Networks[projectId].IPAddress + ':1025'] : [])]);
    const hosts = Object.entries(services).map(([name, row]) => row.NetworkSettings.Networks[projectId].IPAddress + ' ' + [name, row.Name.slice(1), ...(name === 'realtime' ? ['realtime-dev'] : [])].join(' ')).join('\n') + '\n';
    // docker cp works for distroless services; no candidate process is used.
    const hostsFile = join(work, 'hosts'); await writeFile(hostsFile, '127.0.0.1 localhost\n::1 localhost\n' + hosts);
    for (const row of rows) await docker('cp', hostsFile, row.Id + ':/etc/hosts');
    policySnapshots = {};
    for (const [name, row] of Object.entries(services)) { policySnapshots[row.Id] = await applyPolicy(row.Id, name === 'db' ? 5432 : name === 'kong' ? 8000 : name === 'inbucket' ? 8025 : 0, peers); await deny(row.Id); }
    nativeSnapshot = await inspect(journal.containers);
    // APP contains no Docker socket, host credentials, or NET_ADMIN. Its public
    // sleep carrier executes before containment; candidate code starts later.
    const uid = String(process.getuid()), gid = String(process.getgid());
    const app = (await docker('run', '-d', '--name', projectId + '-app', '--label', 'ci-cadence.nonce=' + nonce, '--network', network, '--user', uid + ':' + gid, '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--sysctl', 'net.ipv4.ip_unprivileged_port_start=0', '--add-host', 'fonts.googleapis.com:127.0.0.1', '--add-host', 'fonts.gstatic.com:127.0.0.1', '--mount', 'type=bind,source=' + candidate + ',target=/candidate', '--mount', 'type=bind,source=' + trusted + ',target=/trusted,readonly', '--mount', 'type=bind,source=' + evidence + ',target=/evidence', '--mount', 'type=bind,source=' + cache + ',target=/cache', '--tmpfs', '/tmp', '--workdir', '/candidate', '--entrypoint', '/bin/sleep', tool, 'infinity')).trim();
    journal.containers.push(app); appSnapshot = (await inspect([app]))[0]; policySnapshots[app] = await applyPolicy(app, 0, [services.kong.NetworkSettings.Networks[projectId].IPAddress + ':8000']); await deny(app);
    // Namespace-local CA trusts only this finite font transport. No issuer key
    // is mounted into the candidate and no upstream TLS/CONNECT is possible.
    const tls = join(work, 'font-tls'); await mkdir(tls, { mode: 0o700 });
    await command(['/usr/bin/openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=ci-cadence-local-fonts', '-addext', 'subjectAltName=DNS:fonts.googleapis.com,DNS:fonts.gstatic.com', '-keyout', join(tls, 'fonts.key'), '-out', join(tls, 'fonts.crt')]);
    await cp(join(runtime, 'namespace-servers.mjs'), join(tls, 'namespace-servers.mjs')); await cp(join(runtime, 'public-inputs.json'), join(tls, 'public-inputs.json')); await cp(join(tls, 'fonts.crt'), join(trusted, 'fonts.crt'));
    const server = (await docker('run', '-d', '--name', projectId + '-namespace-servers', '--label', 'ci-cadence.nonce=' + nonce, '--network', 'container:' + app, '--user', uid + ':' + gid, '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--read-only', '--mount', 'type=bind,source=' + tls + ',target=/trusted,readonly', '--env', 'OWNED_GATEWAY=' + services.kong.NetworkSettings.Networks[projectId].IPAddress, '--entrypoint', '/opt/node-v24.21.0/bin/node', tool, '/trusted/namespace-servers.mjs')).trim();
    journal.sidecars = [server]; serverSnapshot = (await inspect([server]))[0];
    await command([cli, 'status', '--workdir', work, '-o', 'json']);
    const statusLog = await readFile(join(work, journal.commands.at(-1).log), 'utf8'); const status = JSON.parse(statusLog);
    if (status.API_URL !== 'http://127.0.0.1:55421' || !status.ANON_KEY || !status.SERVICE_ROLE_KEY) fail('Owned native Auth keys unavailable');
    const synthetic = { anonKey: status.ANON_KEY, serviceKey: status.SERVICE_ROLE_KEY };
    await verifyOwnership(); journal.state = 'DENIAL_PROVED_BEFORE_CANDIDATE_SQL_AND_HOOKS'; await save();
    const migrationFiles = (await readdir(join(candidate, 'supabase', 'migrations'))).filter(name => /^\d+_[A-Za-z0-9_.-]+\.sql$/.test(name)).sort();
    if (migrationFiles.length !== 107) fail('Reviewed complete migration inventory');
    const migrationHash = createHash('sha256');
    for (const name of migrationFiles) { const bytes = await readFile(join(candidate, 'supabase', 'migrations', name)); migrationHash.update(name).update('\0').update(bytes); await writeFile(join(work, 'supabase', 'migrations', name), bytes, { mode: 0o600 }); }
    const seed = await readFile(join(candidate, 'supabase', 'seed.sql')); await writeFile(join(work, 'supabase', 'seed.sql'), seed, { mode: 0o600 });
    const enabledConfig = config.replace(/(\[db.seed\][\s\S]*?enabled = )false/, '$1true'); await writeFile(join(work, 'supabase', 'config.toml'), enabledConfig, { mode: 0o600 });
    await command([cli, 'db', 'reset', '--local', '--workdir', work, '--skip-vault'], { milliseconds: 180_000 });
    await verifyOwnership();
    const auth = await fetch('http://127.0.0.1:55421/auth/v1/admin/users?page=1&per_page=100', { headers: { apikey: synthetic.serviceKey, Authorization: 'Bearer ' + synthetic.serviceKey }, redirect: 'error', signal: AbortSignal.timeout(5000) });
    const baseline = await auth.json(); if (!auth.ok || !Array.isArray(baseline.users) || baseline.users.length || auth.headers.get('x-total-count') !== '0') fail('Fresh empty Auth baseline required');
    const profile = { schemaVersion: 1, repositoryId: 1141286326, nonce, checkoutSha: candidateSha, inputDigest: digest(lockBytes), workspace: '/candidate', projectId, mode: 'loopback', apiOrigin: 'http://127.0.0.1:55421', appOrigin: 'http://127.0.0.1:3231', containers: journal.containers, networks: journal.networks, volumes, baselineAuthUserIds: [], envFilesAbsent: true, providerEgressDenied: true, apiBinding: '127.0.0.1', appBinding: '127.0.0.1', migrationDigest: migrationHash.digest('hex'), seedDigest: digest(seed), configDigest: digest(Buffer.from(enabledConfig)), acquiredAt: new Date().toISOString(), ownerProcessId: process.pid };
    // Candidate code is tested, but cannot redefine required local proof or its
    // auth prerequisite. Match those files to the closed protected definition.
    for (const name of ['profile-contract.json', 'qualification.config.ts', 'auth-proof.spec.ts', 'artifact-smoke.spec.ts']) {
      const path = join('tests', 'fixtures', 'ci-cadence-adapter', 'local-qa', name);
      if (!(await readFile(join(candidate, path))).equals(await readFile(join(dirname(dirname(runtime)), path)))) fail('Protected local proof fixture changed');
    }
    if ((await readdir(candidate)).some(name => name === '.env' || name.startsWith('.env.') && !name.endsWith('.example'))) fail('Candidate env files forbidden');
    const token = randomBytes(32).toString('hex'), socket = join(trusted, 'bridge-' + nonce + '.sock');
    const lighthousePath = '/opt/lhci-action/node_modules/@lhci/cli/src/cli.js';
    const toolHash = (await docker('exec', app, '/usr/bin/sha256sum', lighthousePath)).trim().split(' ')[0]; if (!ID.test(toolHash)) fail('Actual immutable Lighthouse bytes');
    bridge = createServer(async (req, res) => {
      try {
        if (req.method !== 'POST' || req.headers.authorization !== 'Bearer ' + token || req.headers['content-length'] !== '0' || req.headers['transfer-encoding'] || !['/inspectProfile', '/acquireHandoff'].includes(req.url)) fail('Bridge operation forbidden');
        await verifyOwnership();
        const data = req.url === '/inspectProfile' ? profile : { profile, secrets: synthetic, lighthouseCli: { path: lighthousePath, sha256: toolHash } };
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data));
      } catch { res.writeHead(503); res.end('{"error":"acquisition_changed"}'); }
    });
    await new Promise((resolveListen, reject) => { bridge.once('error', reject); bridge.listen(socket, resolveListen); }); await chmod(socket, 0o600);
    await writeFile(join(trusted, 'bridge.json'), JSON.stringify({ socket: '/trusted/bridge-' + nonce + '.sock', token }), { mode: 0o600, flag: 'wx' });
    const controllerBytes = await readFile(join(dirname(runtime), 'ci-cadence-smoke-controller.mjs')); await writeFile(join(trusted, 'controller.mjs'), controllerBytes, { mode: 0o600, flag: 'wx' });
    // Closed qualification source is already materialized from protected bytes
    // by the launcher. Import it from this private read-only mount, not candidate.
    await mkdir(join(trusted, 'scripts'), { mode: 0o700 });
    for (const name of ['ci-cadence-qualification-cli.mjs','ci-cadence-qualification.mjs','ci-cadence-local-qa.mjs','ci-cadence-producer.mjs','ci-cadence-coverage.mjs','ci-cadence-artifact.mjs','ci-cadence-native.mjs','ci-cadence.mjs']) await cp(join(dirname(runtime), name), join(trusted, 'scripts', name));
    const fixtureRoot = join(dirname(dirname(runtime)), 'tests', 'fixtures', 'ci-cadence');
    await cp(fixtureRoot, join(trusted, 'tests', 'fixtures', 'ci-cadence'), { recursive: true });
    const appEnvironment = { HOME: '/cache', npm_config_cache: '/cache/npm', npm_config_offline: 'true', npm_config_nodedir: '/opt/node-headers-v24.21.0', NODE_EXTRA_CA_CERTS: '/trusted/fonts.crt', SSL_CERT_FILE: '/trusted/fonts.crt', NEXT_TELEMETRY_DISABLED: '1' };
    await verifyOwnership();
    await docker('exec', ...Object.entries(appEnvironment).flatMap(([key, value]) => ['--env', key + '=' + value]), app, '/opt/node-v24.21.0/bin/npm', 'ci', '--offline');
    await verifyOwnership();
    await command(['/usr/bin/docker', 'exec', ...Object.entries(appEnvironment).flatMap(([key, value]) => ['--env', key + '=' + value]), app, '/opt/node-v24.21.0/bin/node', '/trusted/scripts/ci-cadence-qualification-cli.mjs', '/trusted/controller.mjs', digest(controllerBytes), '/evidence/qualification', String(Math.min(3_600_000, Math.floor(deadline - performance.now()))), ...(scope === 'artifact-smoke' ? ['artifact-smoke'] : [])], { milliseconds: 3_600_000 });
    await verifyOwnership(); journal.state = 'QUALIFICATION_PASSED_CLEANUP_PENDING'; await save();
    return { candidateSha, nonce, scope, evidence: join(evidence, 'qualification'), nativeQualified: false };
  } finally {
    cleanupDeadline = performance.now() + 180_000;
    if (bridge) await new Promise(resolveClose => bridge.close(resolveClose));
    // Remove only exact recorded physical IDs, never a global CLI stop/prune.
    // Replacements/foreign attachments block cleanup and remain journaled.
    try {
      if (nativeSnapshot) await verifyOwnership();
      for (const id of [...(journal.sidecars ?? []), ...journal.containers].reverse()) { if (!ID.test(id)) fail('Cleanup identity'); await docker('rm', '--force', id); }
      for (const id of journal.networks) { const row = JSON.parse(await docker('network', 'inspect', id))[0]; if (row.Labels?.['ci-cadence.nonce'] !== nonce || Object.keys(row.Containers).length) fail('Cleanup network ownership'); await docker('network', 'rm', id); }
      for (const name of journal.volumes) {
        const users = (await docker('ps', '-aq', '--filter', 'volume=' + name)).trim(); if (users) fail('Owned volume acquired foreign attachment');
        await docker('volume', 'rm', name);
      }
      const remaining = new Set((await docker('ps', '-aq', '--no-trunc')).trim().split(/\s+/));
      if ([...(journal.sidecars ?? []), ...journal.containers].some(id => remaining.has(id))) fail('Owned container cleanup incomplete');
      journal.cleanup = 'verified';
    } catch { journal.cleanup = 'unverified'; }
    await save(); if (journal.cleanup !== 'verified') fail('Owned cleanup unverified; private journal retained');
  }
}
