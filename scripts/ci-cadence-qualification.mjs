import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, realpath, lstat, readdir } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { withLocalQaFixture, validateLocalQaProfile } from './ci-cadence-local-qa.mjs';
import { readMeasuredApplication } from './ci-cadence-producer.mjs';
import { createCandidateManifest, verifyCandidateManifest } from './ci-cadence-artifact.mjs';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw Error(message); };
const REPORT_BYTES = 32 * 1024 * 1024;

/** Playwright's actual JSON reporter recursively groups files/describe blocks.
 * Collection is a census, not a passing run. Every execution identity must join
 * that census; the only skips are the exact source-pinned original mobile rows. */
export function validateBrowserReports({ root, collected, executed, expectedCounts, inactive = [], sourceDigests = {} }) {
  if (!isAbsolute(root) || !record(expectedCounts) || !Object.keys(expectedCounts).length
      || Object.values(expectedCounts).some(n => !Number.isSafeInteger(n) || n < 1)
      || !Array.isArray(inactive) || !record(sourceDigests)) fail('browser contract invalid');
  const flatten = report => {
    if (!record(report) || !record(report.config) || !isAbsolute(report.config.rootDir) || !Array.isArray(report.suites)
        || !Array.isArray(report.errors) || report.errors.length) fail('browser reporter malformed or hook failed');
    const rows = [];
    const walk = (suites, ancestors = []) => {
      for (const suite of suites) {
        if (!record(suite) || typeof suite.title !== 'string' || (suite.specs !== undefined && !Array.isArray(suite.specs))
            || (suite.suites !== undefined && !Array.isArray(suite.suites))) fail('browser suite malformed');
        const titles = ancestors.concat(suite.title);
        for (const spec of suite.specs ?? []) {
          if (!record(spec) || typeof spec.id !== 'string' || !spec.id || typeof spec.title !== 'string' || typeof spec.file !== 'string'
              || !Number.isSafeInteger(spec.line) || spec.line < 1 || !Number.isSafeInteger(spec.column) || spec.column < 1
              || !Array.isArray(spec.tests) || !spec.tests.length) fail('browser spec malformed');
          const file = relative(root, resolve(report.config.rootDir, spec.file));
          if (!file || file.startsWith('..') || isAbsolute(file) || /[\x00-\x1f]/.test(file)) fail('browser file outside checkout');
          for (const test of spec.tests) {
            if (!record(test) || typeof test.projectName !== 'string' || !(test.projectName in expectedCounts) || !Array.isArray(test.results)) fail('browser project or results invalid');
            rows.push({ key: JSON.stringify([test.projectName, spec.id, file, spec.line, spec.column, titles, spec.title]), project: test.projectName, file, line: spec.line, title: spec.title, test });
          }
        }
        walk(suite.suites ?? [], titles);
      }
    };
    walk(report.suites);
    if (!rows.length || new Set(rows.map(row => row.key)).size !== rows.length) fail('browser zero or duplicate census');
    return rows;
  };
  if (collected?.config?.rootDir !== executed?.config?.rootDir) fail('browser reporter root changed');
  const census = flatten(collected), results = flatten(executed);
  if (!isDeepStrictEqual(census.map(row => row.key).sort(), results.map(row => row.key).sort())) fail('browser collection identity changed');
  const counts = Object.fromEntries(Object.keys(expectedCounts).map(project => [project, 0]));
  const used = new Set(); let skipped = 0;
  for (const row of results) {
    const exemptions = inactive.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.project === row.project && entry.file === row.file && entry.line === row.line && entry.title === row.title);
    if (exemptions.length) {
      if (exemptions.length !== 1 || used.has(exemptions[0].index) || sourceDigests[row.file] !== exemptions[0].entry.sourceSha256
          || row.test.status !== 'skipped' || row.test.expectedStatus !== 'skipped' || row.test.results.some(result => result.status !== 'skipped' || result.retry !== 0 || (result.errors ?? []).length)) fail('browser inactive predicate/source changed');
      used.add(exemptions[0].index); skipped++;
    } else {
      if (row.test.status !== 'expected' || row.test.expectedStatus !== 'passed' || row.test.results.length !== 1) fail('browser failed, flaky, skipped or repeated');
      const result = row.test.results[0];
      if (result.status !== 'passed' || result.retry !== 0 || !Array.isArray(result.errors) || result.errors.length) fail('browser result not a clean first-attempt pass');
      counts[row.project]++;
    }
  }
  if (used.size !== inactive.length || !isDeepStrictEqual(counts, expectedCounts)) fail('browser original applicability census changed');
  const passed = Object.values(counts).reduce((sum, n) => sum + n, 0);
  if (!record(executed.stats) || executed.stats.expected !== passed || executed.stats.skipped !== skipped || executed.stats.unexpected !== 0 || executed.stats.flaky !== 0) fail('browser totals disagree with actual cases');
  return Object.freeze({ passed, skipped, counts });
}

/** Concrete local runner. Root supplies a LIVE trusted inspector, nonce profile,
 * privately acquired credentials and immutable LHCI tool. No profile booleans or
 * successful mocks are runtime proof. Every child is awaited and re-inspected. */
export async function runLocalQualification({ profile: supplied, directory, deadline, lighthouseCli, scope = 'full' }, options = {}) {
  const profile = validateLocalQaProfile(supplied);
  if (!['full','artifact-smoke'].includes(scope) || process.platform !== 'linux' || typeof options.inspectProfile !== 'function' || !isAbsolute(directory)
      || !Number.isFinite(deadline) || deadline <= performance.now() || !record(lighthouseCli)
      || !isAbsolute(lighthouseCli.path) || !/^[a-f0-9]{64}$/.test(lighthouseCli.sha256 ?? '')) fail('qualified Linux acquisition handoff required');
  if (await realpath(profile.workspace) !== profile.workspace || directory === profile.workspace || !relative(profile.workspace, directory).startsWith('..')) fail('private evidence must be outside candidate');
  await mkdir(directory, { mode: 0o700 });
  const metadata = await lstat(directory);
  if (!metadata.isDirectory() || metadata.isSymbolicLink() || metadata.uid !== process.getuid() || (metadata.mode & 0o077) !== 0) fail('private evidence ownership');
  if (digest(await readFile(lighthouseCli.path)) !== lighthouseCli.sha256) fail('immutable LHCI tool changed');
  const contractPath = join(profile.workspace, 'tests/fixtures/ci-cadence-adapter/local-qa/profile-contract.json');
  const contractBytes = await readFile(contractPath), contract = JSON.parse(contractBytes);
  const root = profile.workspace;
  const inspect = async () => { if (performance.now() >= deadline || !isDeepStrictEqual(await options.inspectProfile(), profile)) fail('live owned acquisition changed'); };
  await inspect();
  const sourceDigests = {};
  for (const row of contract.inactiveOriginalMobileRows) sourceDigests[row.file] = digest(await readFile(join(root, row.file)));
  if (digest(await readFile(join(root, 'tests/fixtures/ci-cadence-adapter/local-qa/auth-proof.spec.ts'))) !== contract.authFixtureSha256) fail('authenticated prerequisite fixture changed');
  let measurements;
  const cleanup = await withLocalQaFixture(profile, { ...options, journalDirectory: directory }, async ({ env: fixtureEnv }) => {
    const env = { ...Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'PLAYWRIGHT_BROWSERS_PATH', 'FONTCONFIG_PATH', 'FONTCONFIG_FILE', 'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE', 'npm_config_nodedir'].filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]])), ...fixtureEnv,
      CRON_SECRET: randomBytes(32).toString('hex'), VERCEL_GIT_COMMIT_SHA: profile.checkoutSha,
      NODE_ENV: 'production', CI: 'true', PLAYWRIGHT_REUSE_SERVER: 'false', PLAYWRIGHT_USE_DEV_SERVER: 'false', PLAYWRIGHT_CHROME_CHANNEL: 'chrome' };
    const secrets = Object.entries(env).filter(([key, value]) => /KEY|PASSWORD|TOKEN|SECRET/.test(key) && value).map(([, value]) => value);
    const run = async (label, executable, args, extra = {}, cwd = root) => {
      await inspect();
      const milliseconds = Math.floor(deadline - performance.now());
      if (milliseconds < 1) fail('qualification deadline');
      const buffers = []; let bytes = 0; let overflow = false; let expired = false;
      const child = spawn(executable, args, { cwd, env: { ...env, ...extra }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
      const stop = () => { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Child may already be joined. */ } };
      const timer = setTimeout(() => { expired = true; stop(); }, milliseconds);
      const collect = chunk => { bytes += chunk.length; if (bytes > REPORT_BYTES) { overflow = true; stop(); } else buffers.push(chunk); };
      child.stdout.on('data', collect); child.stderr.on('data', collect);
      let spawnError;
      const exit = await new Promise(resolveExit => { child.once('error', error => { spawnError = error; }); child.once('close', (code, signal) => resolveExit({ code, signal })); });
      clearTimeout(timer);
      let output = Buffer.concat(buffers).toString('utf8'); for (const secret of secrets) output = output.split(secret).join('[redacted]');
      await writeFile(join(directory, `${label}.log`), output, { mode: 0o600, flag: 'wx' });
      await writeFile(join(directory, `${label}.exit.json`), JSON.stringify({ argv: [executable, ...args], cwd, ...exit, expired, overflow, spawnError: !!spawnError }), { mode: 0o600, flag: 'wx' });
      await inspect();
      if (spawnError || expired || overflow || exit.code !== 0 || exit.signal) fail(`qualification child failed: ${label}`);
    };
    const readReport = async name => { const bytes = await readFile(join(directory, name)); if (bytes.length > REPORT_BYTES) fail('report byte limit'); return JSON.parse(bytes); };
    const { execFileSync } = await import('node:child_process');
    const { protectedGitEnvironment } = await import('./ci-cadence-native.mjs');
    env.BUILD_TREE_HASH = execFileSync('git', ['--no-replace-objects', 'rev-parse', 'HEAD^{tree}'], { cwd: root, env: protectedGitEnvironment(), encoding: 'utf8', timeout: 5000 }).trim();
    const tests = join(directory, 'application-results.json');
    let application = null;
    if (scope === 'full') {
    await run('application-coverage', 'npm', ['run', 'test:coverage', '--', '--reporter=default', '--reporter=json', `--outputFile=${tests}`]);
    application = await readMeasuredApplication({ root, candidateSha: profile.checkoutSha, tests, coverage: join(root, 'coverage/coverage-final.json'), exitReceipt: join(directory, 'application-coverage.exit.json') });
    await writeFile(join(directory, 'application-measurement.json'), JSON.stringify(application), { mode: 0o600, flag: 'wx' });
    }
    await run('build', 'npm', ['run', 'build']);
    const manifest = await createCandidateManifest(root, { candidateSha: profile.checkoutSha });
    const manifestPath = join(directory, 'candidate-manifest.json'); await writeFile(manifestPath, JSON.stringify(manifest), { mode: 0o600, flag: 'wx' });
    const browser = async (label, script, expectedCounts, inactive, visual = false) => {
      const report = `${label}.json`, list = `${label}-collection.json`;
      const extra = { PLAYWRIGHT_JSON_OUTPUT_NAME: join(directory, list), ...(visual ? { PLAYWRIGHT_CHROME_CHANNEL: '' } : {}) };
      await run(`${label}-collection`, 'npm', ['run', script, '--', '--list', '--reporter=json'], extra);
      await run(label, 'npm', ['run', script, '--', '--retries=0', '--reporter=json'], { ...extra, PLAYWRIGHT_JSON_OUTPUT_NAME: join(directory, report) });
      await verifyCandidateManifest(root, manifest);
      return validateBrowserReports({ root, collected: await readReport(list), executed: await readReport(report), expectedCounts, inactive, sourceDigests });
    };
    const selection = contract.originalSelection.applicableExpected;
    const e2e = scope === 'full' ? await browser('e2e', 'test:e2e', Object.fromEntries(['desktop', 'mobile', 'qa-journey'].map(key => [key, selection[key]])), contract.inactiveOriginalMobileRows) : null;
    const visual = scope === 'full' ? await browser('visual', 'test:e2e:visual', Object.fromEntries(['visual-desktop', 'visual-mobile'].map(key => [key, selection[key]])), [], true) : null;
    const config = join(root, 'tests/fixtures/ci-cadence-adapter/local-qa/qualification.config.ts');
    const proofList = join(directory, 'proof-collection.json'), proofResult = join(directory, 'proof.json');
    await run('proof-collection', process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config', config, '--list', '--reporter=json'], { PLAYWRIGHT_JSON_OUTPUT_NAME: proofList, CI_CADENCE_ARTIFACT_MANIFEST: manifestPath });
    await run('proof', process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config', config, '--retries=0', '--reporter=json'], { PLAYWRIGHT_JSON_OUTPUT_NAME: proofResult, CI_CADENCE_ARTIFACT_MANIFEST: manifestPath });
    const proof = validateBrowserReports({ root, collected: await readReport('proof-collection.json'), executed: await readReport('proof.json'), expectedCounts: { 'cadence-desktop': 4, 'cadence-mobile': 4 }, inactive: [], sourceDigests });
    if (scope === 'full') for (const [label, original] of [['desktop', 'lighthouserc.json'], ['mobile', 'lighthouserc.mobile.json']]) {
      const config = JSON.parse(await readFile(join(root, original)));
      // Preserve all original assertions and three-run/settings selection. Only
      // the owned loopback port and evidence directory differ; never upload.
      delete config.ci.upload;
      const shellRoot = "'" + root.replaceAll("'", "'\\''") + "'";
      config.ci.collect.startServerCommand = `npm --prefix ${shellRoot} run start -- --port ${new URL(profile.appOrigin).port}`;
      config.ci.collect.url = [`${profile.appOrigin}/immersive`];
      const lhConfig = join(directory, `lighthouse-${label}.json`); await writeFile(lhConfig, JSON.stringify(config), { mode: 0o600, flag: 'wx' });
      const lhWorking = join(directory, `lighthouse-${label}-working`); await mkdir(lhWorking, { mode: 0o700 });
      await run(`lighthouse-${label}-collect`, process.execPath, [lighthouseCli.path, 'collect', `--config=${lhConfig}`], {}, lhWorking);
      await run(`lighthouse-${label}-assert`, process.execPath, [lighthouseCli.path, 'assert', `--config=${lhConfig}`], {}, lhWorking);
      // Retain desktop evidence before the subsequent mobile collect replaces
      // the CLI's default local output. No public upload command is invoked.
      const captured = join(directory, `lighthouse-${label}-results`); await mkdir(captured, { mode: 0o700 });
      const output = join(lhWorking, '.lighthouseci');
      const names = await readdir(output); if (!names.length || names.length > 100) fail('Lighthouse output inventory');
      for (const name of names) {
        if (!/^[A-Za-z0-9_.-]+$/.test(name)) fail('Lighthouse output path');
        const path = join(output, name), metadata = await lstat(path);
        if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1 || metadata.size > REPORT_BYTES) fail('Lighthouse output file');
        await writeFile(join(captured, name), await readFile(path), { mode: 0o600, flag: 'wx' });
      }
      await verifyCandidateManifest(root, manifest);
    }
    for (const row of contract.inactiveOriginalMobileRows) if (digest(await readFile(join(root, row.file))) !== sourceDigests[row.file]) fail('original mobile predicate changed during run');
    if (!contractBytes.equals(await readFile(contractPath))) fail('qualification contract changed');
    await inspect(); measurements = { manifest, application, e2e, visual, proof, scope };
  });
  return Object.freeze({ ...measurements, cleanup, nativeQualified: false });
}
