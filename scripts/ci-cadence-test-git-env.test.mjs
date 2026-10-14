import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scripts = fileURLToPath(new URL('./', import.meta.url));
const guard = pathToFileURL(join(scripts, 'ci-cadence-test-git-env.mjs')).href;
const identity = ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid'];
const clean = () => Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')));

// Builds a fixture repository the way the cadence tests do: init, branch, config, commit.
const fixture = `
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = mkdtempSync(join(tmpdir(), 'git-env-fixture-'));
const git = (...args) => execFileSync('git', [...${JSON.stringify(identity)}, ...args], { cwd: root, encoding: 'utf8' });
try { git('init', '-q', '-b', 'fixture'); git('checkout', '-q', '-b', 'topic'); git('config', 'fixture.marker', 'set'); writeFileSync(join(root, 'f.txt'), 'f'); git('add', 'f.txt'); git('commit', '-q', '-m', 'fixture'); }
finally { rmSync(root, { recursive: true, force: true }); }
`;

// Runs the fixture with GIT_* pointed at a sentinel repository, as a hook would, and reports whether the sentinel changed.
function hookedFixture(imports) {
  const sentinel = realpathSync(mkdtempSync(join(tmpdir(), 'git-env-sentinel-')));
  try {
    const git = (...args) => execFileSync('git', [...identity, ...args], { cwd: sentinel, encoding: 'utf8', env: clean() });
    git('init', '-q', '-b', 'main'); writeFileSync(join(sentinel, 's.txt'), 's'); git('add', 's.txt'); git('commit', '-q', '-m', 'sentinel');
    const state = () => [git('for-each-ref'), git('symbolic-ref', 'HEAD'), git('config', '--local', '--list'), git('ls-files', '--stage')].join('\n');
    const before = state();
    const env = { ...clean(), GIT_DIR: join(sentinel, '.git'), GIT_WORK_TREE: sentinel, GIT_INDEX_FILE: join(sentinel, '.git', 'index') };
    const result = spawnSync(process.execPath, [...imports, '--input-type=module', '-e', fixture], { encoding: 'utf8', env, timeout: 10000 });
    return { status: result.status, stderr: result.stderr, changed: state() !== before };
  } finally { rmSync(sentinel, { recursive: true, force: true }); }
}

test('without the guard a hook environment redirects fixture git into the hook repository', () => {
  assert.equal(hookedFixture([]).changed, true);
});

test('the guard keeps fixture git away from the hook repository', () => {
  const run = hookedFixture(['--import', guard]);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.changed, false);
});

test('every cadence test that runs git drops inherited GIT_* variables first', () => {
  const spawnsGit = /(?:execFileSync|spawnSync|execFile|spawn)\(\s*['"]git['"]/;
  const unguarded = readdirSync(scripts)
    .filter(name => name.endsWith('.test.mjs'))
    .filter(name => {
      const source = readFileSync(join(scripts, name), 'utf8');
      return spawnsGit.test(source) && !source.startsWith("import './ci-cadence-test-git-env.mjs';") && !/startsWith\(['"]GIT_['"]\)/.test(source);
    });
  assert.deepEqual(unguarded, []);
});
