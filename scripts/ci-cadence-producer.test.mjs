import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm, realpath, symlink, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { readMeasuredApplication } from './ci-cadence-producer.mjs';

// This is a genuine tiny installed Vitest process, not invented passing JSON or
// a mock of the owned producer/aggregator. It exercises no app/DB/provider code.
test('actual fresh Vitest JSON and real Git source produce measured counts; adverse bytes fail closed', async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'b-native-producer-'))), root = join(directory, 'candidate');
  await mkdir(root);
  const git = (...args) => execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { cwd: root, encoding: 'utf8', timeout: 5000 }).trim();
  try {
    const project = fileURLToPath(new URL('../', import.meta.url));
    await symlink(join(project, 'node_modules'), join(root, 'node_modules'));
    await writeFile(join(root, '.gitignore'), 'node_modules\ncoverage\nreports\n');
    await writeFile(join(root, 'sample.ts'), 'export function measured(value: number): number {\n  return value + 1;\n}\n');
    await writeFile(join(root, 'sample.test.ts'), "import { test, expect } from 'vitest';\nimport { measured } from './sample';\ntest('actual execution', () => expect(measured(1)).toBe(2));\n");
    await writeFile(join(root, 'vitest.config.mjs'), "export default { test: { include: ['sample.test.ts'], coverage: { provider: 'v8', include: ['sample.ts'], reporter: ['json'], reportsDirectory: 'coverage' } } };\n");
    git('init', '--quiet', '--template='); git('add', '.'); git('commit', '--quiet', '-m', 'owned tiny source');
    const candidateSha = git('rev-parse', 'HEAD'); await mkdir(join(root, 'reports'));
    const tests = join(root, 'reports/tests.json'), coverage = join(root, 'coverage/coverage-final.json'), exitReceipt = join(root, 'reports/exit.json');
    const processResult = spawnSync(process.execPath, [join(project, 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'vitest.config.mjs', '--coverage', '--reporter=json', `--outputFile=${tests}`], { cwd: root, encoding: 'utf8', timeout: 30000, maxBuffer: 2_000_000, env: { PATH: process.env.PATH, HOME: process.env.HOME, CI: 'true' } });
    await writeFile(join(root, 'reports/process.log'), processResult.stdout + processResult.stderr);
    assert.equal(processResult.status, 0, processResult.stderr);
    await writeFile(exitReceipt, JSON.stringify({ code: processResult.status, signal: processResult.signal, expired: false, overflow: false, spawnError: false }));
    const input = { root, candidateSha, tests, coverage, exitReceipt };
    const measured = await readMeasuredApplication(input);
    assert.equal(measured.metrics.testCount, 1); assert.equal(measured.metrics.testFiles, 1); assert.equal(measured.metrics.passed, 1); assert.equal(measured.metrics.failed, 0);
    assert.equal(measured.evidence.treeSha, git('rev-parse', 'HEAD^{tree}'));
    const original = await readFile(exitReceipt);
    await writeFile(exitReceipt, JSON.stringify({ code: 1, signal: null, expired: false, overflow: false, spawnError: false })); await assert.rejects(readMeasuredApplication(input));
    await writeFile(exitReceipt, original);
    await assert.rejects(readMeasuredApplication({ ...input, candidateSha: 'a'.repeat(40) }));
    await writeFile(join(root, 'sample.ts'), 'export const replaced = true;\n'); await assert.rejects(readMeasuredApplication(input));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
