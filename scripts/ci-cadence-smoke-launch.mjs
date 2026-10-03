import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm, lstat, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ORIGIN = 'https://github.com/juan294/paisaxe.git';
const API = 'https://api.github.com/repos/juan294/paisaxe';
const SHA = /^[a-f0-9]{40}$/;
const PINS = {
  "scripts/ci-cadence-artifact.mjs": "5e12b39aee4d6e7ee34c77dfc0563fd3884ad2a6980609953d646bfc21494b30",
  "scripts/ci-cadence-coverage.mjs": "f5a6fa57a388781c7d3714021f2196b83f1b54e59b611327956aa17e1b02bddf",
  "scripts/ci-cadence-local-qa.mjs": "353cf027d61b97321b82dfa1f53612e47b25a3a269ba1f9d56c3c0fab83e1afb",
  "scripts/ci-cadence-native.mjs": "95d90114925026bc3f5ea7f978080376625241bfece4971de9b906e8bba528b1",
  "scripts/ci-cadence-producer.mjs": "7b21806e84b690deb6ca889d79f60c0fefae1f1ca53a8b6073022970932a0f3e",
  "scripts/ci-cadence-qualification-cli.mjs": "000ece9b2d827d2a2defd874fc8e228201b94a8931b162a14577a44fd01dd7a5",
  "scripts/ci-cadence-qualification.mjs": "66ac5826a3568840aca5ec9ebbadfc2c0505d8eebbe0098ee5da5ad9a41f1805",
  "scripts/ci-cadence-smoke-controller.mjs": "f54503f7248a0c9326ee5b5ef199862c36f932a25ce38567ad5d2648577ffa30",
  "scripts/ci-cadence-smoke-host.mjs": "b7e114706222164d397204ba5f7de0d0a3577008e8fd028965177c6b502b683b",
  "scripts/ci-cadence-smoke-runtime/.dockerignore": "2f0d69d411109debc36e68a2247dbdfd9da7af176175325a74a8c9a63bbf211d",
  "scripts/ci-cadence-smoke-runtime/Dockerfile": "49a3bd5c3ee579b2dda655f6e837ad98ff0c2715a31d25f05b8c4b592fbcc7e1",
  "scripts/ci-cadence-smoke-runtime/bootstrap-config.toml": "9718566bfb764accd405c58ff1e75a085f433fa5e453eaa7acaf30416db7d674",
  "scripts/ci-cadence-smoke-runtime/namespace-policy.sh": "ddfe2dbbf22681748a2226b66ee35d703878273056e196614ad0a37fd82c032a",
  "scripts/ci-cadence-smoke-runtime/namespace-servers.mjs": "b3860318f305913cc4672992950ed240b07574b0c1485c918775d740e72c0bf5",
  "scripts/ci-cadence-smoke-runtime/public-inputs.json": "6a951da192a4a077a7d4285322d4135de832c266485d7b573c9cadb1361deff1",
  "scripts/ci-cadence-source-guard.mjs": "0ab975c41f8e2e08b3c1ed18b4b9ba7889d8a63e933f3b67098ab274eb4d8d88",
  "scripts/ci-cadence.mjs": "9f2da9ab55525a3ca4acc311feaf5426fc86d83258c5dda7754dc05405c9a7ab",
  "tests/fixtures/ci-cadence-adapter/local-qa/artifact-smoke.spec.ts": "6edb943dc4e71ff1859b797d58c7c9d884a578cb497af2948c2696f01e455025",
  "tests/fixtures/ci-cadence-adapter/local-qa/auth-proof.spec.ts": "3a452d47674389c56b5479ebae51e98cd8c9a07485e40e32c59436df02054a60",
  "tests/fixtures/ci-cadence-adapter/local-qa/profile-contract.json": "bee6a2f1f4d404aa59a6068fab63ff326c79b856aca65da1b9cdd91635fccfe1",
  "tests/fixtures/ci-cadence-adapter/local-qa/qualification.config.ts": "8aed00f5650761bb0907800053968b760988fdb81497f07feb2faf8198f7cb64",
  "tests/fixtures/ci-cadence/contract.json": "dc4d409ef86f17cd212e9d9b9de554dd324bafffebe4762af09929b3832feb16",
  "tests/fixtures/ci-cadence/events.json": "5c813313bb405b17aeceef795c6dfad28c55356989fc9107c792e24827809435",
  "tests/fixtures/ci-cadence/graph.json": "8690811b843779348f28b00af19ebbfde84388942d8f1a61e1cdba7f054b83d0",
  "tests/fixtures/ci-cadence/history.json": "0564cee7383330964ca764dae498743abb9d6cb21accd45b27c8b86c4ad25eff",
  "tests/fixtures/ci-cadence/jobs.json": "08af6060b239cac912889fffc6a5337795593e83381ed1f47e6d902bc0b9cd59",
  "tests/fixtures/ci-cadence/policy.json": "7f290ed3791c910948e489e297e4df1bf87b57ac8e4dc4e071b0fe44f9661e76"
};
const repository = value => value?.id === 1141286326 && value.full_name === 'juan294/paisaxe' && value.default_branch === 'main' && value.owner?.id === 3944118;
const environment = () => ({ PATH: '/usr/bin:/bin', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_NO_REPLACE_OBJECTS: '1', GIT_GRAFT_FILE: '/dev/null', GIT_TERMINAL_PROMPT: '0' });

/** Builtins-only bootstrap acquired by reviewed native YAML before execution.
 * Trusting this loader is an explicit native-definition review boundary. It
 * cannot authenticate contributor-controlled copies of itself or its workflow. */
export async function launchSmoke({ root, event, context, candidateSha, baseSha, headSha, token, directory }, { request = fetch, gitTransport, hostExecute } = {}) {
  let temporary;
  const deadline = performance.now() + 60000;
  const time = maximum => { const value = Math.min(maximum, Math.floor(deadline - performance.now())); if (value < 1) throw Error('Smoke bootstrap deadline'); return value; };
  root = await realpath(root);
  const git = (cwd, ...args) => execFileSync('/usr/bin/git', ['--no-replace-objects', '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-c', 'core.useReplaceRefs=false', ...args], { cwd, env: environment(), encoding: 'utf8', timeout: time(10000), maxBuffer: 16_000_000, stdio: ['ignore', 'pipe', 'pipe'] });
  const identity = () => {
    if (git(root, 'rev-parse', '--is-shallow-repository').trim() !== 'false' || git(root, 'rev-parse', 'HEAD').trim() !== candidateSha || ![ORIGIN, ORIGIN.slice(0, -4)].includes(git(root, 'remote', 'get-url', 'origin').trim())
        || git(root, 'rev-list', '--parents', '-n', '1', candidateSha).trim() !== `${candidateSha} ${baseSha} ${headSha}`) throw Error('Physical original PR merge changed');
  };
  let requests = 0;
  const get = async path => {
    if (++requests > 4) throw Error('Smoke HTTP quota');
    const url = API + path, controller = new AbortController(), timer = setTimeout(() => controller.abort(), time(5000));
    const aborted = new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(Error('Smoke native deadline')), { once: true }));
    try {
      const response = await Promise.race([request(url, { method: 'GET', redirect: 'error', signal: controller.signal, headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } }), aborted]);
      const quota = response.headers.get('x-ratelimit-remaining');
      if (response.status !== 200 || response.redirected || response.url && response.url !== url || !/^\d+$/.test(quota ?? '') || Number(quota) < 1000) throw Error('Smoke native metadata unavailable');
      const chunks = []; let count = 0; const reader = response.body?.getReader(); if (!reader) throw Error('Smoke native body');
      try { for (;;) { const item = await Promise.race([reader.read(), aborted]); if (item.done) break; count += item.value.length; if (count > 2_000_000) throw Error('Smoke native body bound'); chunks.push(Buffer.from(item.value)); } } finally { void reader.cancel().catch(() => {}); }
      time(5000); return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } finally { clearTimeout(timer); }
  };
  try {
    if (process.env.NODE_OPTIONS?.trim() || process.env.NODE_PATH?.trim() || process.execArgv.some(value => /^--(?:require|import|loader|experimental-loader)(?:=|$)/.test(value) || value === '-r')) throw Error('Smoke Node startup hook');
    if (![candidateSha, baseSha, headSha].every(value => SHA.test(value ?? '') && value !== '0'.repeat(40)) || typeof token !== 'string' || !token.trim() || /[\r\n]/.test(token)
        || !repository(event?.repository) || context?.repositoryId !== 1141286326 || context.ownerId !== 3944118 || context.eventName !== 'pull_request' || context.sha !== candidateSha
        || !Number.isSafeInteger(event.number) || event.number < 1 || context.ref !== `refs/pull/${event.number}/merge` || event.pull_request?.number !== event.number
        || event.pull_request.base?.ref !== 'main' || !repository(event.pull_request.base.repo) || event.pull_request.base.sha !== baseSha || event.pull_request.head?.sha !== headSha) throw Error('Smoke native PR identity');
    identity();
    if (!repository(await get(''))) throw Error('Smoke authenticated repository');
    const actual = await get('/pulls/' + event.number);
    if (actual.number !== event.number || !repository(actual.base?.repo) || actual.base.ref !== 'main' || actual.base.sha !== baseSha || actual.head?.sha !== headSha || actual.merge_commit_sha !== candidateSha || actual.head?.repo?.id !== event.pull_request.head.repo?.id || actual.user?.id !== event.pull_request.user?.id) throw Error('Smoke authenticated PR changed');
    const commit = await get('/git/commits/' + baseSha); if (commit.sha !== baseSha) throw Error('Smoke protected commit');
    identity();
    temporary = await realpath(await mkdtemp(join(tmpdir(), 'B-protected-smoke-')));
    const objects = join(temporary, 'objects'); await mkdir(objects, { mode: 0o700 }); git(temporary, 'init', '--quiet', '--template=', objects); git(objects, 'remote', 'add', 'origin', ORIGIN);
    for (const id of [baseSha, candidateSha]) {
      const ref = `refs/ci-cadence/smoke/${id}`;
      const env = { ...environment(), GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader', GIT_CONFIG_VALUE_0: 'AUTHORIZATION: bearer ' + token };
      if (gitTransport) {
        let timer;
        try { await Promise.race([gitTransport({ root: objects, url: ORIGIN, sha: id, ref, env, timeout: time(10000) }), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Smoke Git acquisition deadline')), time(10000)); })]); }
        finally { clearTimeout(timer); }
      }
      else execFileSync('/usr/bin/git', ['--no-replace-objects', '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-c', 'protocol.file.allow=never', '-c', 'protocol.ssh.allow=never', '-c', 'http.followRedirects=false', '-c', 'credential.helper=', 'fetch', '--no-tags', '--no-recurse-submodules', '--force', ORIGIN, `${id}:${ref}`], { cwd: objects, env, timeout: time(10000), maxBuffer: 2_000_000, stdio: ['ignore', 'pipe', 'pipe'] });
      if (git(objects, 'rev-parse', ref + '^{commit}').trim() !== id || git(objects, 'remote', 'get-url', 'origin').trim() !== ORIGIN) throw Error('Smoke immutable fetch');
    }
    git(objects, 'checkout', '--quiet', '--detach', candidateSha);
    const modules = join(temporary, 'protected'); await mkdir(modules, { mode: 0o700 });
    if (!Object.keys(PINS).length) throw Error('Reviewed smoke closure missing');
    for (const [path, pin] of Object.entries(PINS)) {
      if (!/^100(?:644|755) blob [a-f0-9]{40}\t/.test(git(objects, 'ls-tree', baseSha, '--', path))) throw Error('Smoke protected mode');
      const bytes = execFileSync('/usr/bin/git', ['--no-replace-objects', 'show', `${baseSha}:${path}`], { cwd: objects, env: environment(), timeout: time(10000), maxBuffer: 16_000_000 });
      if (createHash('sha256').update(bytes).digest('hex') !== pin) throw Error('Reviewed smoke closure changed');
      const target = join(modules, path); await mkdir(dirname(target), { recursive: true, mode: 0o700 }); await writeFile(target, bytes, { flag: 'wx', mode: 0o600 });
    }
    identity();
    const guard = await import(pathToFileURL(join(modules, 'scripts/ci-cadence-source-guard.mjs')).href);
    execFileSync('/bin/bash', ['--noprofile', '--norc', '-p', '-e', '-o', 'pipefail', '-c', guard.SOURCE_GUARD], { cwd: root, env: { ...environment(), SOURCE_SHA: candidateSha }, timeout: time(10000), stdio: ['ignore', 'pipe', 'pipe'] });
    const host = await import(pathToFileURL(join(modules, 'scripts/ci-cadence-smoke-host.mjs')).href);
    const result = await host.acquireSmoke({ root: objects, candidateSha, directory, scope: 'artifact-smoke' }, { execute: hostExecute }); identity(); return result;
  } finally { if (temporary) await rm(temporary, { recursive: true, force: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const eventPath = process.env.GITHUB_EVENT_PATH, metadata = await lstat(eventPath);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 2_000_000) throw Error('Bounded event required');
    const result = await launchSmoke({ root: process.cwd(), event: JSON.parse(await readFile(eventPath, 'utf8')), context: { repositoryId: Number(process.env.GITHUB_REPOSITORY_ID), ownerId: Number(process.env.GITHUB_REPOSITORY_OWNER_ID), eventName: process.env.GITHUB_EVENT_NAME, sha: process.env.GITHUB_SHA, ref: process.env.GITHUB_REF }, candidateSha: process.env.candidate_sha, baseSha: process.env.base_sha, headSha: process.env.head_sha, token: process.env.GITHUB_TOKEN, directory: process.env.CI_CADENCE_SMOKE_EVIDENCE });
    console.log(JSON.stringify(result));
  } catch { console.error('Release artifact smoke acquisition or cleanup failed; private evidence retained.'); process.exitCode = 1; }
}
