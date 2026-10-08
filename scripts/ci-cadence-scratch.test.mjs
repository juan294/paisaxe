// The completed callable source guard fails on any untracked or changed file.
// These run the generated callee steps that used to write scratch output into
// the checkout, in a throwaway repository, and then apply the guard's checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';

const callee = slug => parse(readFileSync(new URL(`../.github/workflows/ci-cadence-${slug}-full.yml`, import.meta.url), 'utf8'));
const GUARD = 'Verify completed callable source checkout';
// No GIT_* variable from a hook may redirect these child processes to another repository.
const childEnv = extra => ({ ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))), ...extra });

/** A committed checkout with files a release tarball also carries, a separate RUNNER_TEMP and stub tools. */
function sandbox(body) {
  const base = mkdtempSync(join(tmpdir(), 'cadence-scratch-'));
  const root = join(base, 'checkout'), temp = join(base, 'runner-temp'), bin = join(base, 'bin');
  for (const directory of [root, temp, bin]) mkdirSync(directory);
  const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.test', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args], { cwd: root, encoding: 'utf8', env: childEnv({}) });
  writeFileSync(join(root, 'README.md'), 'tracked readme\n'); writeFileSync(join(root, 'LICENSE'), 'tracked license\n'); writeFileSync(join(root, '.gitignore'), 'node_modules/\n');
  git('init', '-q'); git('add', '.'); git('commit', '-qm', 'base');
  const tool = (name, script) => { writeFileSync(join(bin, name), `#!/bin/bash\n${script}`); chmodSync(join(bin, name), 0o755); };
  const run = (script, extra = {}) => spawnSync('bash', ['-e', '-c', script], { cwd: root, encoding: 'utf8', env: childEnv({ PATH: `${bin}:${process.env.PATH}`, RUNNER_TEMP: temp, ...extra }) });
  // The guard's own conditions: no untracked file and every committed byte unchanged.
  const clean = () => git('status', '--porcelain', '--untracked-files=all');
  try { return body({ root, temp, bin, tool, run, clean }); } finally { rmSync(base, { recursive: true, force: true }); }
}

test('Gitleaks downloads, unpacks and runs from RUNNER_TEMP, leaving the checkout untouched', () => sandbox(({ root, temp, tool, run, clean }) => {
  // A real release tarball also carries README.md and LICENSE, which would overwrite tracked files.
  const archive = mkdtempSync(join(tmpdir(), 'cadence-archive-'));
  try {
    writeFileSync(join(archive, 'gitleaks'), '#!/bin/bash\necho "$PWD $*" > "$RUNNER_TEMP/gitleaks-ran"\n'); chmodSync(join(archive, 'gitleaks'), 0o644);
    writeFileSync(join(archive, 'README.md'), 'upstream readme\n'); writeFileSync(join(archive, 'LICENSE'), 'upstream license\n');
    execFileSync('tar', ['czf', join(temp, 'fixture.tar.gz'), '-C', archive, 'gitleaks', 'README.md', 'LICENSE']);
  } finally { rmSync(archive, { recursive: true, force: true }); }
  // wget honours -P/--directory-prefix like the real tool, else writes into the working directory.
  tool('wget', 'dir=.; for ((i=1;i<=$#;i++)); do a=${!i}; case "$a" in -P) j=$((i+1)); dir=${!j};; --directory-prefix=*) dir=${a#*=};; http*) url=$a;; esac; done; cp "$RUNNER_TEMP/fixture.tar.gz" "$dir/${url##*/}"\n');
  const steps = callee('security').jobs.gitleaks.steps;
  const names = steps.map(step => step.name);
  assert.ok(names.indexOf('Run Gitleaks') < names.indexOf(GUARD));
  for (const name of ['Install Gitleaks', 'Run Gitleaks']) {
    const result = run(steps.find(step => step.name === name).run);
    assert.equal(result.status, 0, `${name}: ${result.stderr}`);
  }
  assert.ok(existsSync(join(temp, 'gitleaks-ran')), 'the scanner ran');
  assert.match(readFileSync(join(temp, 'gitleaks-ran'), 'utf8'), new RegExp(`^${realpathSync(root)} detect --source \\. --verbose`));
  assert.equal(clean(), '');
  assert.equal(readFileSync(join(root, 'README.md'), 'utf8'), 'tracked readme\n');
}));

test('the Vercel env assertion keeps its key list in RUNNER_TEMP and still fails on the legacy key', () => sandbox(({ temp, tool, run, clean }) => {
  const step = callee('security').jobs['vercel-env-safety'].steps.find(item => item.name === 'Assert legacy agent override is absent from Vercel env');
  const env = { VERCEL_TOKEN: 'synthetic', VERCEL_PROJECT_ID: 'prj_synthetic', VERCEL_ORG_ID: 'team_synthetic' };
  tool('curl', `cat "$RUNNER_TEMP/envs.json"\n`);
  writeFileSync(join(temp, 'envs.json'), JSON.stringify({ envs: [{ key: 'SAFE_KEY' }] }));
  const pass = run(step.run, env);
  assert.equal(pass.status, 0, pass.stderr); assert.equal(clean(), '');
  writeFileSync(join(temp, 'envs.json'), JSON.stringify({ envs: [{ key: ['ALLOW', 'AGENT', 'RUN'].join('_') }] }));
  const legacy = run(step.run, env);
  assert.equal(legacy.status, 1); assert.match(legacy.stdout, /Legacy agent runner override is still configured/); assert.equal(clean(), '');
}));

test('Lighthouse CI output is removed before the completed source guard', () => sandbox(({ root, run, clean }) => {
  const steps = callee('lighthouse').jobs.lighthouse.steps;
  const guard = steps.findIndex(step => step.name === GUARD), last = steps.findLastIndex(step => step.uses === 'treosh/lighthouse-ci-action@v12');
  assert.ok(last >= 0 && last < guard);
  // treosh/lighthouse-ci-action writes .lighthouseci into the working directory.
  mkdirSync(join(root, '.lighthouseci')); writeFileSync(join(root, '.lighthouseci', 'lhr-1.json'), '{}');
  for (const step of steps.slice(last + 1, guard)) {
    assert.ok(step.run && !step.if && !step.uses, `${step.name}: an unconditional shell step`);
    const result = run(step.run);
    assert.equal(result.status, 0, result.stderr);
  }
  assert.equal(clean(), '');
}));
