import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { classifyNativeEvent, protectedGitEnvironment } from './ci-cadence-native.mjs';

const WORK = ['commit-secret-scan', 'policy-validation', 'lockfile-validation', 'cadence-contracts'];
const scannerDigests = () => process.platform === 'linux' && process.arch === 'x64' ? ['88f91962aa2f93ac6ab281d553b9e125f5197bbbce38f9f2437f7299c32e5509'] : process.platform === 'darwin' && process.arch === 'arm64' ? ['ba52fb1bfabbcde42f032afad3d6e0b19dff8ed105229a16e7caa338bbc0e84f', 'f414bc2fb952be6c9072b75cb411e3368614ef4b16d48dbd9ad238034afd2302'] : [];
const CONTRACT_SHA = '3c6a2a44caa1cfbfda2a4ffd2c5e3ad56e0814c5def7aedc717fa16fecf93b57';
const FROZEN = ['scripts/ci-cadence.mjs', 'scripts/ci-cadence.test.mjs', 'scripts/measure-ci-cadence.mjs', 'scripts/measure-ci-cadence.test.mjs', 'scripts/validate-ci-cadence-fixtures.mjs', 'scripts/validate-ci-cadence-fixtures.test.mjs', ...['events', 'graph', 'history', 'jobs', 'policy'].map(name => `tests/fixtures/ci-cadence/${name}.json`)].sort();
// CI Fast's own default-rules config; the repository history scan keeps .gitleaks.toml.
const SCANNER_CONFIG = '.github/gitleaks-ci-fast.toml';
const MAX_BYTES = 16 * 1024 * 1024;
const MAX_SCANNER_BYTES = 32 * 1024 * 1024;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const safePath = path => typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !path.split('/').some(part => !part || part === '.' || part === '..') && !/[\x00-\x1f\x7f]/.test(path);
const installName = /^(?:package\.json|package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|yarn\.lock|bun\.lockb?|\.npmrc|\.yarnrc(?:\.yml)?|\.pnpmfile\.(?:cjs|js)|\.pnp\.(?:cjs|js)|\.nvmrc|\.node-version|\.tool-versions|lerna\.json)$/;

/** Definition is constructed only from successful actual native admission.
 * The protected launcher must acquire this module and its imports before import. */
export function readProtectedBlobs(root, definition, paths, timeout = 10000) {
  if (definition?.repository !== 'juan294/paisaxe' || !['develop', 'main'].includes(definition.branch) || !/^[a-f0-9]{40}$/.test(definition.sha ?? '') || (definition.pinRef !== undefined && definition.pinRef !== `refs/ci-cadence/protected/${definition.sha}`) || !Array.isArray(paths) || paths.some(path => !safePath(path)) || !Number.isSafeInteger(timeout) || timeout < 1 || timeout > 10000) throw Error('protected blob identity invalid');
  const deadline = performance.now() + timeout;
  const git = (...args) => { const remaining = Math.floor(deadline - performance.now()); if (remaining < 1) throw Error('protected blob deadline exceeded'); return execFileSync('git', ['--no-replace-objects', '-c', 'core.useReplaceRefs=false', '-c', 'core.fsmonitor=false', ...args], { cwd: root, env: protectedGitEnvironment(), encoding: 'utf8', timeout: remaining, maxBuffer: MAX_BYTES, stdio: ['ignore', 'pipe', 'pipe'] }); };
  const pin = () => { if (git('rev-parse', '--verify', `${definition.pinRef ?? `refs/remotes/origin/${definition.branch}`}^{commit}`).trim() !== definition.sha) throw Error('protected ref moved'); };
  pin(); const blobs = Object.fromEntries(paths.map(path => [path, git('show', `${definition.sha}:${path}`)])); pin(); return blobs;
}

function introducedLines(patch) {
  let parents = 0; let hunkSeen = false; const added = [];
  for (const line of patch.split('\n')) {
    if (line.startsWith('diff --')) { parents = 0; continue; }
    const hunk = /^(@{2,}) /.exec(line); if (hunk) { parents = hunk[1].length - 1; hunkSeen = true; continue; }
    if (parents > 0 && line.startsWith('+'.repeat(parents))) added.push(line.slice(parents));
  }
  if (/Binary files|GIT binary patch/.test(patch)) throw Error('introduced merge patch is unrepresentable');
  // Empty additions/deletions can legitimately have no hunk; nonempty textual
  // changes advertised by Git without a parseable hunk must not silently pass.
  if (!hunkSeen && /^index /m.test(patch) && /^diff --/m.test(patch)) throw Error('introduced merge extractor unavailable');
  return added.join('\n');
}

/** External scanner transport alone may be injected for fault oracles. No app
 * install/build/test, network acquisition, provider calls or retry occurs. */
export async function runFastChecks(input, { scannerExecutor } = {}) {
  const completed = []; const started = performance.now(); const deadline = input?.deadline === undefined ? started + 240000 : Math.min(started + 240000, input.deadline); let temporary; let classification;
  const remaining = () => { if (!Number.isFinite(deadline)) throw Error('Fast deadline invalid'); const value = Math.min(10000, Math.floor(deadline - performance.now())); if (value < 1) throw Error('Fast deadline exceeded'); return value; };
  const command = (exe, args, options = {}) => execFileSync(exe, exe === 'git' ? ['--no-replace-objects', '-c', 'core.useReplaceRefs=false', '-c', 'core.fsmonitor=false', ...args] : args, { cwd: input.root, encoding: 'utf8', timeout: remaining(), maxBuffer: MAX_BYTES, stdio: ['pipe', 'pipe', 'pipe'], ...options, ...(exe === 'git' ? { env: protectedGitEnvironment() } : {}) });
  const git = (...args) => command('git', args);
  try {
    remaining();
    classification = await classifyNativeEvent({ ...input, deadline });
    remaining();
    if (classification.lane !== 'fast') return { ...classification, success: false, completed };
    const { definitionSha, sourceSha, testedCheckoutSha } = classification;
    const definition = { repository: 'juan294/paisaxe', branch: classification.targetBranch, sha: definitionSha, ...(input.eventName === 'push' ? { pinRef: `refs/ci-cadence/protected/${definitionSha}` } : {}) };
    const tree = sha => command('git', ['ls-tree', '--full-tree', '-r', '-z', sha], { encoding: null });
    const records = bytes => { const text = bytes.toString('utf8'); if (!Buffer.from(text).equals(bytes)) throw Error('protected tree paths are unrepresentable'); return text.split('\0').filter(Boolean); };
    const protectedRecords = records(tree(definitionSha));
    const inventory = entries => entries.filter(entry => installName.test(entry.slice(entry.indexOf('\t') + 1).split('/').at(-1))).sort().join('\0');
    // Raw mode/type/OID/path records cover additions, deletion, chmod and bytes.
    // This happens before any candidate blob read, including missing lockfiles.
    const installDrift = inventory(protectedRecords) !== inventory(records(tree(testedCheckoutSha)));
    const manifestPath = 'tests/fixtures/ci-cadence/contract.json';
    const policy = JSON.parse(readProtectedBlobs(input.root, definition, ['.github/ci-cadence.json'], remaining())['.github/ci-cadence.json']);
    const manifest = JSON.parse(readProtectedBlobs(input.root, definition, [manifestPath], remaining())[manifestPath]);
    if (manifest.schemaVersion !== 1 || manifest.checksum !== CONTRACT_SHA || JSON.stringify(manifest.files) !== JSON.stringify(FROZEN)) throw Error('protected frozen manifest invalid');
    const paths = [...FROZEN, manifestPath, SCANNER_CONFIG, 'package.json', 'package-lock.json', '.nvmrc', ...policy.workflows.map(w => w.path)];
    const blobs = readProtectedBlobs(input.root, definition, paths, remaining());
    const hash = createHash('sha256'); for (const path of FROZEN) hash.update(path).update('\0').update(blobs[path]).update('\0'); if (hash.digest('hex') !== CONTRACT_SHA) throw Error('protected frozen bytes mismatch');
    temporary = await mkdtemp(join(tmpdir(), 'b-fast-protected-'));
    for (const path of [...FROZEN, manifestPath, SCANNER_CONFIG]) { await mkdir(dirname(join(temporary, path)), { recursive: true }); await writeFile(join(temporary, path), blobs[path], { mode: 0o600, flag: 'wx' }); }
    const ignore = protectedRecords.some(record => record.endsWith('\t.gitleaksignore')) ? readProtectedBlobs(input.root, definition, ['.gitleaksignore'], remaining())['.gitleaksignore'] : '';
    await writeFile(join(temporary, '.gitleaksignore'), ignore, { mode: 0o600, flag: 'wx' });
    const scannerPath = input.scanner?.executable; const scannerDigest = input.scanner?.sha256;
    if (typeof scannerPath !== 'string' || !scannerDigests().includes(scannerDigest)) throw Error('scanner authorized digest mismatch');
    const metadata = await stat(scannerPath); if (!metadata.isFile() || metadata.size > MAX_SCANNER_BYTES) throw Error('scanner executable size invalid');
    const scannerBytes = await readFile(scannerPath); if (scannerBytes.length > MAX_SCANNER_BYTES || digest(scannerBytes) !== scannerDigest) throw Error('scanner executable digest mismatch');
    const executable = join(temporary, 'gitleaks'); await writeFile(executable, scannerBytes, { mode: 0o700, flag: 'wx' });
    // Gitleaks 8.30.1 reads GIT_GRAFT_FILE=/dev/null as a false empty scan.
    // Its fresh bare view has no grafts/replacements; omit that variable here.
    const scannerEnv = { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_NO_REPLACE_OBJECTS: '1' };
    const execute = scannerExecutor ?? ((exe, args, text) => { try { return { status: 0, stdout: command(exe, args, { cwd: temporary, env: scannerEnv, ...(text === undefined ? {} : { input: text }) }), stderr: '' }; } catch (error) { return { status: error.status, stdout: error.stdout ?? '', stderr: error.stderr ?? '' }; } });
    const version = execute(executable, ['version']); if (version.status !== 0 || version.stdout.trim() !== '8.30.1') throw Error('scanner version mismatch');
    const scan = (args, text, expected = 0) => { const r = execute(executable, [...args, `--config=${join(temporary, SCANNER_CONFIG)}`, `--gitleaks-ignore-path=${temporary}`, '--ignore-gitleaks-allow', '--redact=100', '--no-banner', '--no-color', '--exit-code', '2'], text); if (r.status !== expected || (text?.startsWith('ghp_') && `${r.stdout}${r.stderr}`.includes(text))) throw Error('introduced secret scan failed or scanner canary/redaction invalid'); };
    scan(['stdin'], 'ordinary repository text'); scan(['stdin'], `ghp_${randomBytes(18).toString('hex')}`, 2);
    const bare = join(temporary, 'source.git'); git('init', '--bare', bare);
    const objects = git('rev-parse', '--path-format=absolute', '--git-path', 'objects').trim(); if (/[\r\n]/.test(objects)) throw Error('introduced object path invalid');
    await writeFile(join(bare, 'objects/info/alternates'), objects + '\n', { mode: 0o600, flag: 'wx' }); await writeFile(join(bare, '.gitleaksignore'), ignore, { mode: 0o600, flag: 'wx' });
    // ALL history/patch operations use this one physical view, never candidate
    // HEAD/worktree/info attributes or source graft/replace metadata.
    const physical = (...args) => command('git', ['--git-dir', bare, ...args]);
    physical('merge-base', '--is-ancestor', definitionSha, testedCheckoutSha);
    const range = `${definitionSha}..${testedCheckoutSha}`; if (Number(physical('rev-list', '--count', range).trim()) < 1) throw Error('introduced secret range empty');
    scan(['git', `--log-opts=--full-history --no-merges --text --no-ext-diff --no-textconv --diff-filter=ACMRT ${range}`, bare]);
    for (const merge of physical('rev-list', '--merges', range).trim().split('\n').filter(Boolean)) {
      const paths = physical('diff-tree', '-r', '--cc', '--text', '--no-ext-diff', '--no-textconv', '--name-only', '--no-commit-id', '--diff-filter=ACMRT', '-z', merge).split('\0').filter(Boolean);
      const extracted = join(temporary, 'merge-introduced', merge); let written = false;
      for (const path of paths) {
        if (!safePath(path)) throw Error('introduced merge path invalid');
        const bytes = command('git', ['--git-dir', bare, '--literal-pathspecs', 'show', '--cc', '--format=', '--unified=0', '--text', '--no-ext-diff', '--no-textconv', merge, '--', path], { encoding: null });
        const patch = bytes.toString('utf8'); if (!Buffer.from(patch).equals(bytes)) throw Error('introduced merge patch is unrepresentable');
        const added = introducedLines(patch); if (added) { await mkdir(dirname(join(extracted, path)), { recursive: true }); await writeFile(join(extracted, path), added, { mode: 0o600, flag: 'wx' }); written = true; }
      }
      if (written) scan(['dir', extracted]);
    }
    completed.push(WORK[0]);
    for (const w of policy.workflows) { const bytes = blobs[w.path]; if (createHash('sha1').update(`blob ${Buffer.byteLength(bytes)}\0`).update(bytes).digest('hex') !== w.definitionSha || !/^name:\s*\S+/m.test(bytes) || !/^on:/m.test(bytes) || !/^jobs:/m.test(bytes)) throw Error('protected workflow identity/shape invalid'); }
    completed.push(WORK[1]);
    const pkg = JSON.parse(blobs['package.json']); const lock = JSON.parse(blobs['package-lock.json']);
    if (pkg.packageManager !== 'npm@11.4.0' || pkg.engines?.node !== '>=24.0.0' || blobs['.nvmrc'].trim() !== '24' || lock.lockfileVersion !== 3 || lock.name !== pkg.name || lock.version !== pkg.version || lock.packages?.['']?.name !== pkg.name || lock.packages[''].engines?.node !== pkg.engines.node) throw Error('protected npm/runtime/lock baseline invalid');
    for (const key of ['dependencies', 'devDependencies', 'optionalDependencies']) if (JSON.stringify(lock.packages[''][key]) !== JSON.stringify(pkg[key])) throw Error('protected npm lock dependency maps differ');
    completed.push(WORK[2]);
    command(process.execPath, ['scripts/validate-ci-cadence-fixtures.mjs'], { cwd: temporary, env: scannerEnv });
    command(process.execPath, ['--test', 'scripts/ci-cadence.test.mjs', 'scripts/measure-ci-cadence.test.mjs', 'scripts/validate-ci-cadence-fixtures.test.mjs'], { cwd: temporary, env: scannerEnv });
    completed.push(WORK[3]);
    remaining(); const final = await classifyNativeEvent({ ...input, deadline }); remaining(); if (final.lane !== 'fast' || final.sourceSha !== sourceSha || final.testedCheckoutSha !== testedCheckoutSha || final.definitionSha !== definitionSha) throw Error('protected native identity moved during Fast');
    if (installDrift) return { success: false, lane: 'full', fullRequired: true, completed, sourceSha, testedCheckoutSha, definitionSha, reason: 'committed install/runtime/workspace drift requires full dependency validation' };
    return { success: true, lane: 'fast', completed, sourceSha, testedCheckoutSha, definitionSha, reusable: classification.reusable, elapsedMilliseconds: Math.ceil(performance.now() - started), hostedBudgetMeasured: false };
  } catch (error) { return { success: false, lane: classification?.lane ?? 'blocked', completed, reason: /^(scanner |introduced |protected |Fast deadline)/.test(error.message ?? '') ? error.message : 'Fast protected validation failed' }; }
  finally { if (temporary) await rm(temporary, { recursive: true, force: true }); }
}
