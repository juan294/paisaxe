import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, chmod } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { runFastChecks } from './ci-fast.mjs';
import { fastFixture } from '../tests/fixtures/ci-cadence-adapter/native/fast-fixture.mjs';

const each = (name, run) => test(name, async () => { const f = await fastFixture(); try { await run(f); } finally { await f.close(); } });
const secret = 'const token = "ghp_0123456789abcdef0123456789abcdef012345";\n';
each('actual four protected cheap works succeed without app installation', async f => {
  const input = await f.prepare(); const result = await runFastChecks(input);
  assert.equal(result.success, true); assert.deepEqual(result.completed, ['commit-secret-scan', 'policy-validation', 'lockfile-validation', 'cadence-contracts']); assert.equal(result.sourceSha, input.source); assert.equal(result.definitionSha, f.base); assert.equal(result.hostedBudgetMeasured, false);
});
each('hostile candidate helper policy and contract scripts are never executed', async f => { const i = await f.prepare(async x => { await x.put('scripts/ci-cadence.mjs', 'throw Error("candidate helper executed")'); await x.put('.github/ci-cadence.json', '{"owners":["outsider"],"productionBranch":"develop"}'); await x.put('scripts/validate-ci-cadence-fixtures.mjs', 'throw Error("candidate validator executed")'); }); assert.equal((await runFastChecks(i)).success, true); });
each('actual PR merge checkout stays distinct from source and nonreusable', async f => { const i = await f.prepare(undefined, 'pull_request'); const r = await runFastChecks(i); assert.equal(r.success, true); assert.equal(r.testedCheckoutSha, i.checkout); assert.equal(r.sourceSha, i.source); assert.equal(r.reusable, false); });
each('real scanner detects ordinary source even with hostile candidate config/inline allowance', async f => { const i = await f.prepare(async x => { await x.put('secret.ts', secret.trimEnd() + ' // gitleaks:allow\n'); await x.put('.github/gitleaks-ci-fast.toml', '[extend]\nuseDefault=false\n'); }); const r = await runFastChecks(i); assert.equal(r.success, false); assert.match(r.reason, /secret/); });
each('real protected existing README allowlist remains effective', async f => { const i = await f.prepare(x => x.put('supabase/functions/README.md', secret)); assert.equal((await runFastChecks(i)).success, true); });
each('test path has no invented exception under actual protected B config', async f => { const i = await f.prepare(x => x.put('placeholder.test.ts', secret)); assert.equal((await runFastChecks(i)).success, false); });
for (const [name, mutate] of [
  ['manifest engine', async f => { const p = JSON.parse(await readFile(join(f.root, 'package.json'))); p.engines.node = '>=26'; await f.put('package.json', JSON.stringify(p)); }],
  ['root lock removal', f => f.git('rm', 'package-lock.json')],
  ['root manifest removal', f => f.git('rm', 'package.json')],
  ['npm shrinkwrap addition', f => f.put('npm-shrinkwrap.json', '{}')],
  ['workspace manifest addition', f => f.put('packages/new/package.json', '{"engines":{"node":">=26"}}')],
  ['install hook addition', f => f.put('.pnpmfile.cjs', 'throw Error("must never execute")')],
  ['npm configuration addition', f => f.put('.npmrc', 'ignore-scripts=false\n')],
  ['runtime removal', f => f.git('rm', '.nvmrc')],
  ['workspace metadata addition', f => f.put('pnpm-workspace.yaml', 'packages: [candidate]\n')],
  ['mode change', f => chmod(join(f.root, 'package.json'), 0o755)],
]) each(`${name} requires full before missing candidate reads`, async f => { const i = await f.prepare(mutate); const r = await runFastChecks(i); assert.equal(r.success, false); assert.equal(r.lane, 'full'); assert.equal(r.fullRequired, true); });
for (const binary of [false, true]) each(`real merge-only secret is detected, candidate binary attributes ${binary}`, async f => {
  const i = await f.prepare(); await f.put('merge.ts', 'base\n'); const common = f.commit(); f.git('branch', 'side', common); await f.put('merge.ts', 'left\n'); const left = f.commit(); f.git('checkout', '--quiet', '--force', '--detach', common); await f.put('merge.ts', 'right\n'); const right = f.commit(); f.git('checkout', '--quiet', '--force', '--detach', left); await f.put('merge.ts', secret); if (binary) await f.put('.gitattributes', 'merge.ts -diff\n'); f.git('add', '.'); const merge = f.git('commit-tree', f.git('write-tree'), '-p', left, '-p', right, '-m', 'merge-only addition'); f.git('checkout', '--quiet', '--force', '--detach', merge); f.git('update-ref', 'refs/remotes/origin/develop', merge); i.event.after = i.context.sha = merge; const r = await runFastChecks(i); assert.equal(r.success, false); assert.match(r.reason, /secret/);
});
each('graft and replacement cannot hide physical merge-only secret', async f => {
  const i = await f.prepare(); await f.put('merge.ts', 'base\n'); const common = f.commit(); await f.put('merge.ts', 'left\n'); const left = f.commit(); f.git('checkout', '--quiet', '--force', '--detach', common); await f.put('merge.ts', 'right\n'); const right = f.commit(); await f.put('merge.ts', secret); f.git('add', '.'); const merge = f.git('commit-tree', f.git('write-tree'), '-p', left, '-p', right, '-m', 'secret merge'); f.git('checkout', '--quiet', '--force', '--detach', merge); f.git('update-ref', 'refs/remotes/origin/develop', merge); i.event.after = i.context.sha = merge; await writeFile(join(f.root, '.git/info/grafts'), `${merge} ${left}\n`); f.git('replace', merge, left); const r = await runFastChecks(i); assert.equal(r.success, false); assert.match(r.reason, /secret/);
});
each('removed protected-base secret is not introduced', async f => {
  const i = await f.prepare(); await f.put('removed.ts', secret); const base = f.commit(); f.git('update-ref', `refs/ci-cadence/protected/${base}`, base); await f.put('removed.ts', 'ordinary\n'); const source = f.commit(); i.trustedRevision = i.event.before = base; i.event.after = i.context.sha = source; assert.equal((await runFastChecks(i)).success, true);
});
each('candidate fingerprint ignore cannot suppress an introduced commit', async f => {
  const i = await f.prepare(x => x.put('secret.ts', secret)); const report = join(f.root, 'findings.json');
  assert.throws(() => execFileSync(i.scanner.executable, ['git', `--log-opts=--no-merges ${f.base}..${i.source}`, `--config=${join(f.root, '.github/gitleaks-ci-fast.toml')}`, '--redact', '--no-banner', '--report-format=json', `--report-path=${report}`], { cwd: f.root, stdio: ['ignore', 'pipe', 'pipe'], env: { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' } }));
  const findings = JSON.parse(await readFile(report)); assert.deepEqual(findings.map(x => x.RuleID).sort(), ['generic-api-key', 'github-pat']); assert.ok(findings.every(x => x.File === 'secret.ts'));
  await f.put('.gitleaksignore', findings.map(x => x.Fingerprint).join('\n') + '\n'); f.git('clean', '-f', '--', 'findings.json');
  // Prove these exact candidate fingerprints really suppress this binary's
  // ordinary candidate-worktree scanner, before exercising protected Fast.
  execFileSync(i.scanner.executable, ['git', `--log-opts=--no-merges ${f.base}..${i.source}`, `--config=${join(f.root, '.github/gitleaks-ci-fast.toml')}`, '--redact', '--no-banner'], { cwd: f.root, stdio: ['ignore', 'pipe', 'pipe'], env: { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' } });
  const source = f.commit(); i.event.after = i.context.sha = source; assert.equal((await runFastChecks(i)).success, false);
});
each('ordinary NUL-prefixed source cannot hide introduced token', async f => { const i = await f.prepare(x => x.put('binary.ts', Buffer.concat([Buffer.from([0]), Buffer.from(secret)]))); const r = await runFastChecks(i); assert.equal(r.success, false); assert.match(r.reason, /secret/); });
each('unrepresentable merge patch fails closed rather than changing its bytes', async f => {
  const i = await f.prepare(); await f.put('merge.txt', 'base\n'); const common = f.commit(); await f.put('merge.txt', 'left\n'); const left = f.commit(); f.git('checkout', '--quiet', '--force', '--detach', common); await f.put('merge.txt', 'right\n'); const right = f.commit(); await f.put('merge.txt', Buffer.from([0xff, 10])); f.git('add', '.'); const merge = f.git('commit-tree', f.git('write-tree'), '-p', left, '-p', right, '-m', 'unrepresentable merge'); f.git('checkout', '--quiet', '--force', '--detach', merge); f.git('update-ref', 'refs/remotes/origin/develop', merge); i.event.after = i.context.sha = merge; const r = await runFastChecks(i); assert.equal(r.success, false); assert.match(r.reason, /unrepresentable/);
});
each('real Fast ignores hostile ambient Git/scanner graft and config inputs', async f => {
  const i = await f.prepare(); const changes = { GIT_DIR: join(f.root, 'wrong.git'), GIT_WORK_TREE: '/invalid', GIT_GRAFT_FILE: '/invalid', GIT_CONFIG_GLOBAL: '/invalid', GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.useReplaceRefs', GIT_CONFIG_VALUE_0: 'true' }; const old = Object.fromEntries(Object.keys(changes).map(k => [k, process.env[k]]));
  try { Object.assign(process.env, changes); assert.equal((await runFastChecks(i)).success, true); }
  finally { for (const [k, v] of Object.entries(old)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
});
each('actual main push never selects cheap work', async f => { const i = await f.prepare(); i.event.ref = i.context.ref = 'refs/heads/main'; f.git('update-ref', 'refs/remotes/origin/main', i.source); const r = await runFastChecks(i); assert.equal(r.success, false); assert.equal(r.lane, 'release'); assert.deepEqual(r.completed, []); });
each('missing mode preserves full lane without scanner execution', async f => { const i = await f.prepare(); delete i.mode; const r = await runFastChecks(i); assert.equal(r.lane, 'full'); assert.deepEqual(r.completed, []); });
each('moving actual checkout during scanner transport cannot manufacture Fast success', async f => {
  const i = await f.prepare(); const scannerExecutor = (exe, args, text) => { try { const stdout = execFileSync(exe, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...(text === undefined ? {} : { input: text }), env: { PATH: process.env.PATH, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } }); if (args[0] === 'git') f.git('checkout', '--quiet', '--force', '--detach', f.base); return { status: 0, stdout, stderr: '' }; } catch (e) { return { status: e.status, stdout: e.stdout ?? '', stderr: e.stderr ?? '' }; } };
  const r = await runFastChecks(i, { scannerExecutor }); assert.equal(r.success, false); assert.match(r.reason, /identity moved/);
});
each('existing README allowlist applies to actual merge-only path', async f => {
  const i = await f.prepare(); const path = 'supabase/functions/README.md'; await f.put(path, 'base\n'); const common = f.commit(); await f.put(path, 'left\n'); const left = f.commit(); f.git('checkout', '--quiet', '--force', '--detach', common); await f.put(path, 'right\n'); const right = f.commit(); await f.put(path, secret); f.git('add', '.'); const merge = f.git('commit-tree', f.git('write-tree'), '-p', left, '-p', right, '-m', 'README merge'); f.git('checkout', '--quiet', '--force', '--detach', merge); f.git('update-ref', 'refs/remotes/origin/develop', merge); i.event.after = i.context.sha = merge; assert.equal((await runFastChecks(i)).success, true);
});
each('wrong authorized scanner digest withholds execution', async f => { const i = await f.prepare(); i.scanner = { ...i.scanner, sha256: 'a'.repeat(64) }; assert.equal((await runFastChecks(i)).success, false); });
for (const fault of ['version', 'canary', 'redaction']) each(`external scanner ${fault} fault blocks`, async f => { const i = await f.prepare(); const executor = (exe, args, text) => ({ status: args[0] === 'version' || !text?.startsWith('ghp_') ? 0 : fault === 'canary' ? 0 : 2, stdout: args[0] === 'version' ? fault === 'version' ? '0.0.0' : '8.30.1' : '', stderr: fault === 'redaction' ? text : '' }); assert.equal((await runFastChecks(i, { scannerExecutor: executor })).success, false); });

each('unsupported actual runtime rejects scanner even if caller supplies platform fields', async f => {
  const input = await f.prepare(); input.platform = 'darwin'; input.arch = 'arm64';
  const descriptor = Object.getOwnPropertyDescriptor(process, 'platform');
  try { Object.defineProperty(process, 'platform', { ...descriptor, value: 'unsupported' });
    const result = await runFastChecks(input); assert.equal(result.success, false); assert.match(result.reason, /scanner authorized digest/); assert.deepEqual(result.completed, []);
  } finally { Object.defineProperty(process, 'platform', descriptor); }
});
each('wrong-platform official digest cannot authorize current executable', async f => {
  const input = await f.prepare(); input.scanner = { ...input.scanner, sha256: process.platform === 'darwin' ? '88f91962aa2f93ac6ab281d553b9e125f5197bbbce38f9f2437f7299c32e5509' : 'ba52fb1bfabbcde42f032afad3d6e0b19dff8ed105229a16e7caa338bbc0e84f' };
  const result = await runFastChecks(input); assert.equal(result.success, false); assert.match(result.reason, /scanner authorized digest/); assert.deepEqual(result.completed, []);
});
each('scanner executable above 32 MiB cannot reach external execution', async f => {
  const input = await f.prepare(); const path = join(f.root, 'oversized-external-scanner'); await writeFile(path, Buffer.alloc(32 * 1024 * 1024 + 1)); input.scanner = { ...input.scanner, executable: path };
  let calls = 0; const result = await runFastChecks(input, { scannerExecutor: () => { calls++; throw Error('must not execute'); } });
  assert.equal(result.success, false); assert.match(result.reason, /scanner executable size/); assert.equal(calls, 0); assert.deepEqual(result.completed, []);
});
each('scanner digest cannot change after fixed runtime authorization during file I/O', async f => {
  const input = await f.prepare(); const path = join(f.root, 'external-scanner');
  const bytes = Buffer.from('unauthorized third-party executable'); await writeFile(path, bytes);
  const sha = (await import('node:crypto')).createHash('sha256').update(bytes).digest('hex');
  let reads = 0; let calls = 0; const changing = { sha256: input.scanner.sha256 };
  Object.defineProperty(changing, 'executable', { get() {
    if (++reads === 2) queueMicrotask(() => { changing.sha256 = sha; });
    return path;
  } });
  const result = await runFastChecks({ ...input, scanner: changing }, { scannerExecutor: (_exe, args, text) => {
    calls++; return { status: args[0] === 'version' || !text?.startsWith('ghp_') ? 0 : 2,
      stdout: args[0] === 'version' ? '8.30.1' : '', stderr: '' };
  } });
  assert.equal(result.success, false); assert.match(result.reason, /scanner.*digest/);
  assert.equal(calls, 0); assert.deepEqual(result.completed, []);
});

test('inherited Fast deadline rejects before any native or scanner work', async () => {
  const result = await runFastChecks({ deadline: performance.now() - 1 });
  assert.equal(result.success, false);
  assert.deepEqual(result.completed, []);
  assert.match(result.reason, /deadline/);
});

each('install drift cannot bypass introduced protected secret rejection before full recovery',async f=>{
 const input=await f.prepare(async x=>{await x.put('.npmrc','fund=false\n');await x.put('new-secret.ts',secret);await x.put('.github/gitleaks-ci-fast.toml','[extend]\nuseDefault=false\n');});
 const result=await runFastChecks(input);
 assert.equal(result.success,false);assert.equal(result.fullRequired,undefined);assert.match(result.reason,/secret/);
});

// CI Fast scans introduced commits with its own default-rules config. The
// repository history scan (security.yml) keeps .gitleaks.toml exactly as it was.
test('CI Fast config detects a real token shape; the repository history config is left without added rules', async () => {
  const { scanner } = await import('../tests/fixtures/ci-cadence-adapter/native/fast-fixture.mjs');
  const root = new URL('../', import.meta.url);
  const scan = (config, text) => { try { execFileSync(scanner.executable, ['stdin', `--config=${new URL(config, root).pathname}`, '--redact=100', '--no-banner', '--no-color', '--exit-code', '2'], { input: text, stdio: ['pipe', 'ignore', 'ignore'], timeout: 10000 }); return 0; } catch (error) { return error.status; } };
  assert.equal(scan('.github/gitleaks-ci-fast.toml', secret), 2);
  assert.equal(scan('.github/gitleaks-ci-fast.toml', 'ordinary repository text\n'), 0);
  assert.match(await readFile(new URL('.github/gitleaks-ci-fast.toml', root), 'utf8'), /^\[extend\]\n\s*useDefault = true$/m);
  assert.doesNotMatch(await readFile(new URL('.gitleaks.toml', root), 'utf8'), /useDefault|\[extend\]/);
});
each('a candidate that rewrites the CI Fast scanner config cannot weaken the protected scan', async f => {
  const i = await f.prepare(async x => { await x.put('new-secret.ts', secret); await x.put('.github/gitleaks-ci-fast.toml', '[extend]\nuseDefault=false\n'); await x.put('.gitleaks.toml', '[extend]\nuseDefault=false\n'); });
  const r = await runFastChecks(i); assert.equal(r.success, false); assert.match(r.reason, /secret/); assert.deepEqual(r.completed, []);
});
