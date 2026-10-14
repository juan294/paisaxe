// Exercise the installed Vitest/V8 glob behavior, not a second glob implementation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
test('native coverage includes application code but excludes root and nested test infrastructure', { timeout: 120_000 }, () => {
  const fixture = realpathSync(mkdtempSync(join(tmpdir(), 'paisaxe-coverage-scope-')));
  try {
    for (const path of ['src/lib', 'src/testing', 'src/test/nested']) mkdirSync(join(fixture, path), { recursive: true });
    symlinkSync(join(root, 'node_modules'), join(fixture, 'node_modules'), 'dir');
    for (const path of ['src/lib/production.ts', 'src/testing/production.ts', 'src/test/fixture.ts', 'src/test/nested/fixture.ts']) {
      writeFileSync(join(fixture, path), 'export function exercised() { return 1; }\nexport function unexercised() { return 2; }\n');
    }
    writeFileSync(join(fixture, 'src/scope.test.ts'), `import { test, expect } from 'vitest';
import { exercised as app } from './lib/production';
import { exercised as similarName } from './testing/production';
import { exercised as fixture } from './test/fixture';
import { exercised as nestedFixture } from './test/nested/fixture';
test('synthetic scope only', () => expect([app(), similarName(), fixture(), nestedFixture()]).toEqual([1, 1, 1, 1]));\n`);
    // Reuse the actual application's include/exclude contract. The synthetic
    // two-function modules deliberately have uncovered code; zero fixture-only
    // floors let this test inspect scope without changing application floors.
    writeFileSync(join(fixture, 'vitest.config.mjs'), `import actual from ${JSON.stringify(join(root, 'vitest.config.ts'))};
export default { test: { environment: 'node', include: ['src/scope.test.ts'], maxWorkers: 1,
coverage: { ...actual.test.coverage, reporter: ['json'], reportsDirectory: ${JSON.stringify(join(fixture, 'coverage'))}, thresholds: { lines: 0, functions: 0, statements: 0, branches: 0 } } } };\n`);
    const result = spawnSync(process.execPath, [join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--root', fixture, '--config', join(fixture, 'vitest.config.mjs'), '--coverage'], {
      cwd: fixture, encoding: 'utf8', timeout: 90_000, maxBuffer: 2 * 1024 * 1024,
      env: { PATH: process.env.PATH, HOME: fixture, TMPDIR: tmpdir(), CI: 'true', NODE_ENV: 'test' },
    });
    assert.equal(result.status, 0, `${result.error?.message ?? ''}\n${result.stdout}\n${result.stderr}`);
    const coverage = JSON.parse(readFileSync(join(fixture, 'coverage/coverage-final.json'), 'utf8'));
    assert.deepEqual(Object.keys(coverage).map(path => relative(fixture, path)).sort(), ['src/lib/production.ts', 'src/testing/production.ts']);
    for (const entry of Object.values(coverage)) assert.ok(Object.values(entry.f).includes(0), 'uncovered application functions must remain measured');
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
