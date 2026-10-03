import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ORIGIN = 'https://github.com/juan294/paisaxe.git';
const API = 'https://api.github.com/repos/juan294/paisaxe';
const canonicalOrigin = url => url === ORIGIN || url === 'https://github.com/juan294/paisaxe';
const SHA = /^[a-f0-9]{40}$/;
// Reviewed executable pins are selected only from the actual host runtime.
export function nativeScannerDigest() {
  return process.platform === 'linux' && process.arch === 'x64' ? '88f91962aa2f93ac6ab281d553b9e125f5197bbbce38f9f2437f7299c32e5509' : process.platform === 'darwin' && process.arch === 'arm64' ? 'ba52fb1bfabbcde42f032afad3d6e0b19dff8ed105229a16e7caa338bbc0e84f' : null;
}
const PINS = {
  "scripts/ci-cadence.mjs": "9f2da9ab55525a3ca4acc311feaf5426fc86d83258c5dda7754dc05405c9a7ab",
  "scripts/ci-cadence.test.mjs": "4bf62367c0ab169dbed298d451bd8630804014f7de08d0192910f2bdb3bd0254",
  "scripts/measure-ci-cadence.mjs": "1b558fef76e6ff34b14cf9129632d57ff0b8d847ab7bf3ab3e57883ba38dba8d",
  "scripts/measure-ci-cadence.test.mjs": "cc19f6885eb72540063042de867ff8867e4dfa40ced8d40263e3e363bae6038b",
  "scripts/validate-ci-cadence-fixtures.mjs": "232eb58009e446c4ccd214688d87d546171b0996e30c82d780e53b3c6e20e814",
  "scripts/validate-ci-cadence-fixtures.test.mjs": "7f82535dc022ae1a5fa4f15381ef142dd39eaea52dcf420bdb3e6246696e7a45",
  "tests/fixtures/ci-cadence/events.json": "5c813313bb405b17aeceef795c6dfad28c55356989fc9107c792e24827809435",
  "tests/fixtures/ci-cadence/graph.json": "8690811b843779348f28b00af19ebbfde84388942d8f1a61e1cdba7f054b83d0",
  "tests/fixtures/ci-cadence/history.json": "0564cee7383330964ca764dae498743abb9d6cb21accd45b27c8b86c4ad25eff",
  "tests/fixtures/ci-cadence/jobs.json": "08af6060b239cac912889fffc6a5337795593e83381ed1f47e6d902bc0b9cd59",
  "tests/fixtures/ci-cadence/policy.json": "7f290ed3791c910948e489e297e4df1bf87b57ac8e4dc4e071b0fe44f9661e76",
  "tests/fixtures/ci-cadence/contract.json": "dc4d409ef86f17cd212e9d9b9de554dd324bafffebe4762af09929b3832feb16",
  "scripts/ci-cadence-native.mjs": "95d90114925026bc3f5ea7f978080376625241bfece4971de9b906e8bba528b1",
  "scripts/ci-fast.mjs": "0dba2914770c4d676a5ac98abe730f59ef4a5869396f1acfbd30514d9e8b4190",
  "scripts/ci-cadence-scanner.mjs": "6cf7da7f0c59020aaeed179131051fff931e2ff4ce1f8264a990a15916719e6b"
};
const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const repository = x => record(x) && x.full_name === 'juan294/paisaxe' && x.id === 1141286326 && x.default_branch === 'main' && x.owner?.id === 3944118 && x.owner?.login === 'juan294';
const sha = x => typeof x === 'string' && SHA.test(x);
const account = x => record(x) && /^[A-Za-z0-9][A-Za-z0-9-]*(?:\[bot\])?$/.test(x.login ?? '') && Number.isSafeInteger(x.id) && x.id > 0 && ['User', 'Bot'].includes(x.type) && (x.type === 'Bot') === x.login.endsWith('[bot]') && (x.login === 'juan294') === (x.id === 3944118);
const blocked = () => ({ lane: 'blocked', reason: 'protected launcher acquisition or native identity unavailable', protectedImported: false, allowDeploy: false, allowPrivileged: false, reusable: false });
const environment = () => ({ ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_') && !k.startsWith('NODE_'))), GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_NO_REPLACE_OBJECTS: '1', GIT_GRAFT_FILE: '/dev/null', GIT_TERMINAL_PROMPT: '0' });

/** This bootstrap MUST be obtained by a trusted native caller BEFORE execution.
 * It cannot authenticate a contributor-controlled copy of itself or its YAML.
 * Only external HTTP/Git transport may be injected; inspections/imports are real. */
export async function launchNative(input, { request = fetch, gitTransport, scannerFetch } = {}) {
  let temporary; let imported = false; let requests = 0; const deadline = input?.deadline === undefined ? performance.now() + 300000 : Math.min(performance.now() + 300000, input.deadline); const acquisitionDeadline = Math.min(deadline, performance.now() + 60000);
  const remaining = maximum => { const n = Math.min(maximum, Math.floor(deadline - performance.now())); if (!Number.isFinite(n) || n < 1) throw Error('acquisition deadline'); return n; };
  const acquisitionRemaining = maximum => { const n = Math.min(remaining(maximum), Math.floor(acquisitionDeadline - performance.now())); if (!Number.isFinite(n) || n < 1) throw Error('acquisition deadline'); return n; };
  const run = (args, root, options = {}) => execFileSync('git', ['--no-replace-objects', '-c', 'core.useReplaceRefs=false', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', ...args], { cwd: root, env: environment(), encoding: 'utf8', timeout: remaining(10000), maxBuffer: 2000000, stdio: ['ignore', 'pipe', 'pipe'], ...options });
  const get = async suffix => {
    if (++requests > 5) throw Error('HTTP request quota');
    const url = API + suffix; const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), acquisitionRemaining(5000)); let rejectTimeout;
    const aborted = new Promise((_, reject) => { rejectTimeout = () => reject(Error('HTTP deadline')); controller.signal.addEventListener('abort', rejectTimeout, { once: true }); });
    try {
      const response = await Promise.race([request(url, { method: 'GET', redirect: 'error', signal: controller.signal, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${input.token}`, 'X-GitHub-Api-Version': '2022-11-28' } }), aborted]);
      const quota = response.headers.get('x-ratelimit-remaining');
      if (response.status !== 200 || (response.url && response.url !== url) || !/^[0-9]+$/.test(quota ?? '') || !Number.isSafeInteger(Number(quota)) || Number(quota) < 1000) throw Error('HTTP identity or quota');
      const length = response.headers.get('content-length'); if (length && (!/^[0-9]+$/.test(length) || Number(length) > 2000000)) throw Error('HTTP body bound');
      const reader = response.body?.getReader(); if (!reader) throw Error('HTTP body missing'); let size = 0; const parts = [];
      try { for (;;) { const chunk = await Promise.race([reader.read(), aborted]); if (chunk.done) break; size += chunk.value.length; if (size > 2000000) throw Error('HTTP body bound'); parts.push(Buffer.from(chunk.value)); } } finally { void reader.cancel().catch(() => {}); }
      acquisitionRemaining(5000); return JSON.parse(Buffer.concat(parts).toString('utf8'));
    } finally { clearTimeout(timer); controller.signal.removeEventListener('abort', rejectTimeout); }
  };
  try {
    remaining(10000);
    const { root, event, context, eventName, actor, mode } = input;
    if (process.env.NODE_OPTIONS?.trim() || process.execArgv.some(a => /^--(?:require|import|loader|experimental-loader)(?:=|$)/.test(a) || a === '-r')) throw Error('Node startup hooks');
    if (typeof input.token !== 'string' || !input.token.trim() || /[\r\n]/.test(input.token) || !record(event) || !repository(event.repository) || !account(event.sender) || actor !== event.sender.login || !record(context) || context.repository !== 'juan294/paisaxe' || context.repositoryId !== 1141286326 || context.ownerId !== 3944118 || context.actorId !== event.sender.id || context.actorType !== event.sender.type || !sha(context.sha)) throw Error('native context');
    if (!canonicalOrigin(run(['remote', 'get-url', 'origin'], root).trim()) || run(['rev-parse', '--verify', 'HEAD'], root).trim() !== context.sha || run(['rev-parse', '--is-shallow-repository'], root).trim() !== 'false') throw Error('physical original checkout');
    let definition; let branch; let source; let checkout = context.sha; let author = event.sender;
    if (eventName === 'push') {
      if (!['refs/heads/develop', 'refs/heads/main'].includes(event.ref) || context.ref !== event.ref || event.deleted !== false || event.after !== context.sha || !sha(event.before)) throw Error('push binding');
      definition = event.before; branch = event.ref.slice(11); source = event.after;
      run(['merge-base', '--is-ancestor', definition, source], root);
    } else if (eventName === 'pull_request') {
      const p = event.pull_request;
      if (!record(p) || !Number.isSafeInteger(event.number) || event.number < 1 || p.number !== event.number || context.ref !== `refs/pull/${event.number}/merge` || !repository(p.base?.repo) || !['develop', 'main'].includes(p.base?.ref) || !sha(p.base.sha) || !sha(p.head?.sha) || !account(p.user) || !record(p.head.repo) || !Number.isSafeInteger(p.head.repo.id) || p.head.repo.id < 1 || typeof p.head.repo.full_name !== 'string' || (p.head.repo.full_name === 'juan294/paisaxe' && !repository(p.head.repo))) throw Error('PR binding');
      definition = p.base.sha; source = p.head.sha; branch = p.base.ref; author = p.user;
      if (run(['rev-list', '--parents', '-n', '1', checkout], root).trim() !== `${checkout} ${definition} ${source}`) throw Error('physical PR parents');
    } else if (eventName === 'schedule') {
      if (context.ref !== 'refs/heads/main' || typeof event.schedule !== 'string' || !event.schedule) throw Error('schedule binding');
      definition = context.sha; branch = 'main';
    } else throw Error('unsupported event');
    const metadata = await get(''); if (!repository(metadata)) throw Error('authenticated repository');
    const nativeRef = await get(`/git/ref/heads/${branch}`);
    if (nativeRef.ref !== `refs/heads/${branch}` || nativeRef.object?.type !== 'commit' || nativeRef.object.sha !== (eventName === 'push' ? source : definition)) throw Error('authenticated native ref');
    const commit = await get(`/git/commits/${definition}`); if (commit.sha !== definition) throw Error('authenticated definition commit');
    temporary = await realpath(await mkdtemp(join(tmpdir(), 'paisaxe-launch-')));
    const work = join(temporary, 'checkout'); await mkdir(work, { mode: 0o700 }); run(['init', '--quiet', '--template=', work], temporary); run(['remote', 'add', 'origin', ORIGIN], work);
    const acquire = async (id, ref) => {
      if (!sha(id) || !/^refs\/(?:ci-cadence\/(?:protected|candidate)\/[a-f0-9]{40}|remotes\/origin\/(?:main|develop))$/.test(ref)) throw Error('acquisition ref');
      const env = { ...environment(), GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader', GIT_CONFIG_VALUE_0: `AUTHORIZATION: bearer ${input.token}`, GIT_ASKPASS: '/usr/bin/false', SSH_ASKPASS: '/usr/bin/false' };
      if (gitTransport) { let timer; try { await Promise.race([gitTransport({ root: work, url: ORIGIN, sha: id, ref, env, timeout: acquisitionRemaining(10000), run }), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Git transport deadline')), acquisitionRemaining(10000)); })]); } finally { clearTimeout(timer); } }
      else run(['-c', 'protocol.file.allow=never', '-c', 'protocol.ssh.allow=never', '-c', 'http.followRedirects=false', '-c', 'http.sslVerify=true', '-c', 'credential.helper=', '-c', 'core.askPass=/usr/bin/false', 'fetch', '--no-tags', '--no-recurse-submodules', '--force', ORIGIN, `${id}:${ref}`], work, { env, timeout: acquisitionRemaining(10000) });
      acquisitionRemaining(10000);
      if (run(['rev-parse', '--verify', `${ref}^{commit}`], work).trim() !== id || run(['cat-file', '-t', id], work).trim() !== 'commit' || run(['remote', 'get-url', 'origin'], work).trim() !== ORIGIN) throw Error('fetched immutable ref');
    };
    const pin = `refs/ci-cadence/protected/${definition}`; await acquire(definition, pin);
    const revalidateIdentity = () => {
      if (run(['rev-parse', pin], work).trim() !== definition || run(['rev-parse', 'HEAD'], root).trim() !== context.sha || !canonicalOrigin(run(['remote', 'get-url', 'origin'], root).trim())) throw Error('original checkout or protected pin moved');
    };
    revalidateIdentity();
    const present = run(['ls-tree', '--name-only', '-z', definition, '--', '.github/ci-cadence.json', 'scripts/ci-cadence.mjs'], work).split('\0').filter(Boolean);
    const owner = actor === 'juan294' && event.sender.id === 3944118 && event.sender.type === 'User' && author.login === 'juan294' && author.id === 3944118 && author.type === 'User' && (eventName !== 'pull_request' || event.pull_request.head.repo.full_name === 'juan294/paisaxe');
    if (present.length === 0) {
      if (eventName === 'schedule') return { ...blocked(), lane: 'disabled', reason: 'new nightly disabled until protected installation' };
      return { ...blocked(), lane: !owner ? 'untrusted' : branch === 'main' ? 'release' : 'full', reason: 'first installation preserves legacy full', sourceSha: source, testedCheckoutSha: checkout, definitionSha: definition, releaseRequired: branch === 'main', acceptanceBlocked: !owner, ...(!owner ? { runner: 'standard-hosted', token: 'read-only' } : branch === 'main' ? { allowDeploy: eventName === 'push', allowPrivileged: true } : {}) };
    }
    if (present.length !== 2) throw Error('partial installation');
    if (eventName === 'schedule') {
      if (mode !== 'lean') return { ...blocked(), lane: 'disabled', reason: 'new nightly disabled under legacy mode' };
      if (!owner) throw Error('schedule owner');
      const integration = await get('/git/ref/heads/develop'); if (integration.ref !== 'refs/heads/develop' || integration.object?.type !== 'commit' || !sha(integration.object.sha)) throw Error('authenticated integration ref'); source = checkout = integration.object.sha;
    }
    await acquire(checkout, `refs/ci-cadence/candidate/${checkout}`);
    run(['update-ref', `refs/remotes/origin/${branch}`, eventName === 'push' ? source : definition], work);
    if (eventName === 'schedule') run(['update-ref', 'refs/remotes/origin/develop', source], work);
    run(['checkout', '--no-recurse-submodules', '--quiet', '--force', '--detach', checkout], work);
    const modules = join(temporary, 'modules'); await mkdir(modules, { mode: 0o700 });
    for (const [path, expected] of Object.entries(PINS)) {
      const entry = run(['ls-tree', definition, '--', path], work, { timeout: acquisitionRemaining(10000) }); if (!/^100(?:644|755) blob [a-f0-9]{40}\t/.test(entry)) throw Error('protected module mode');
      const bytes = run(['show', `${definition}:${path}`], work, { encoding: null, timeout: acquisitionRemaining(10000) }); if (createHash('sha256').update(bytes).digest('hex') !== expected) throw Error('reviewed protected module digest');
      const target = join(modules, path); await mkdir(dirname(target), { recursive: true, mode: 0o700 }); await writeFile(target, bytes, { mode: 0o600, flag: 'wx' });
    }
    revalidateIdentity();
    const admitted = { deadline, root: work, event: structuredClone(event), context: structuredClone(context), eventName, actor, mode, trustedRevision: definition, defaultSha: eventName === 'schedule' ? definition : undefined, resolveIntegrationHead: eventName === 'schedule' ? async () => ({ repository: structuredClone(metadata), ref: 'refs/heads/develop', sha: source }) : undefined };
    acquisitionRemaining(10000);
    const native = await import(pathToFileURL(join(modules, 'scripts/ci-cadence-native.mjs')).href); imported = true;
    const classification = await native.classifyNativeEvent(admitted);
    if (classification.lane === 'blocked') return { ...classification, protectedImported: true, acquisitionRequests: requests };
    let result = classification;
    if (classification.lane === 'fast') {
      let scanner = input.scanner;
      if (!scanner?.executable) {
        const acquisition = await import(pathToFileURL(join(modules, 'scripts/ci-cadence-scanner.mjs')).href);
        const acquired = await acquisition.acquireScanner({ directory: temporary, deadline, ...(scannerFetch ? { fetchImpl: scannerFetch } : {}) });
        scanner = { executable: acquired.path, sha256: acquired.sha256 };
      }
      remaining(10000);
      const fast = await import(pathToFileURL(join(modules, 'scripts/ci-fast.mjs')).href); result = await fast.runFastChecks({ ...admitted, scanner });
    }
    revalidateIdentity();
    return { ...result, protectedImported: true, acquisitionRequests: requests, nativeCallerInstallationVerified: false };
  } catch { return { ...blocked(), protectedImported: imported }; }
  finally { if (temporary) await rm(temporary, { recursive: true, force: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const metadata = await stat(process.env.GITHUB_EVENT_PATH); if (!metadata.isFile() || metadata.size > 2000000) throw Error('event bound');
    const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8')); const integer = x => typeof x === 'string' && /^[1-9][0-9]*$/.test(x) ? Number(x) : NaN;
    const result = await launchNative({ root: process.cwd(), event, eventName: process.env.GITHUB_EVENT_NAME, actor: process.env.GITHUB_ACTOR, mode: process.env.CI_CADENCE_MODE, token: process.env.GITHUB_TOKEN, scanner: { executable: process.env.CI_CADENCE_SCANNER_PATH, sha256: nativeScannerDigest() }, context: { repository: process.env.GITHUB_REPOSITORY, repositoryId: integer(process.env.GITHUB_REPOSITORY_ID), ownerId: integer(process.env.GITHUB_REPOSITORY_OWNER_ID), actorId: integer(process.env.GITHUB_ACTOR_ID), actorType: event.sender?.type, sha: process.env.GITHUB_SHA, ref: process.env.GITHUB_REF } });
    console.log(JSON.stringify(result)); if (result.lane === 'blocked' || (result.lane === 'fast' && !result.success)) process.exitCode = 1;
  } catch { console.error('protected launcher event acquisition failed'); process.exitCode = 1; }
}
