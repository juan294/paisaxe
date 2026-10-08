// The reviewed environment-gated groups are exactly the describe.skipIf(!dbReachable)
// groups in the sources, and they admit the actual skip census of a hosted nightly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { aggregateMeasuredSuites } from './ci-cadence-coverage.mjs';
import { ENVIRONMENT_GATED } from './ci-cadence-producer.mjs';

const root = fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, '');
const census = JSON.parse(readFileSync(new URL('../tests/fixtures/ci-cadence-adapter/native/nightly-gated-skips.json', import.meta.url), 'utf8'));
const key = entry => JSON.stringify([entry.file, entry.describe]);
const GATE = 'describe.skipIf(!dbReachable)(';

/** Every tracked test file's describe.skipIf(!dbReachable) group titles. */
function sourceGroups() {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')));
  const files = execFileSync('git', ['ls-files', '-z', '--', '*.test.ts', '*.test.tsx'], { cwd: root, encoding: 'utf8', env }).split('\0').filter(Boolean);
  const groups = [];
  for (const file of files) {
    const text = readFileSync(`${root}/${file}`, 'utf8');
    for (let at = text.indexOf(GATE); at >= 0; at = text.indexOf(GATE, at + 1)) {
      const literal = /^\s*(["'`])((?:\\.|(?!\1).)*)\1/s.exec(text.slice(at + GATE.length));
      assert.ok(literal && !literal[2].includes('${'), `${file}: a gated group needs a literal title`);
      groups.push({ file, describe: literal[2] });
    }
  }
  return groups;
}

test('the reviewed gated groups are exactly the describe.skipIf(!dbReachable) groups in the sources', () => {
  assert.deepEqual(ENVIRONMENT_GATED.map(key).sort(), sourceGroups().map(key).sort());
});

test('the hosted nightly skip census is wholly admitted, and only by the reviewed groups', () => {
  assert.equal(census.native.numPendingTests, census.skippedGroups.reduce((sum, group) => sum + group.cases, 0));
  assert.equal(census.native.numTodoTests, 0); assert.equal(census.native.numPendingTestSuites, 0);
  for (const group of census.skippedGroups) {
    assert.equal(group.status, 'skipped', key(group));
    assert.ok(ENVIRONMENT_GATED.some(entry => key(entry) === key(group)), `${key(group)} is not a reviewed gated group`);
  }
  // Replay the census shape through the aggregator: one executed file plus every skipped group.
  const files = [{ name: `${root}/src/executed.test.ts`, status: 'passed', message: '',
    assertionResults: [{ ancestorTitles: ['executed'], title: 'case', fullName: 'executed case', status: 'passed', failureMessages: [] }] }];
  for (const group of census.skippedGroups) files.push({ name: `${root}/${group.file}`, status: 'passed', message: '',
    assertionResults: Array.from({ length: group.cases }, (_, index) => ({ ancestorTitles: [group.describe], title: `case ${index}`, fullName: `${group.describe} case ${index}`, status: 'skipped', failureMessages: [] })) });
  const suite = { id: 'app', exitCode: 0, coverage: { [`${root}/src/a.ts`]: { path: `${root}/src/a.ts`, statementMap: { 0: { start: { line: 1 }, end: { line: 1 } } }, s: { 0: 1 } } },
    tests: { success: true, numTotalTests: 1 + census.native.numPendingTests, numPassedTests: 1, numFailedTests: 0, numPendingTests: census.native.numPendingTests, numTodoTests: 0,
      numTotalTestSuites: files.length, numPassedTestSuites: files.length, numFailedTestSuites: 0, numPendingTestSuites: 0, testResults: files } };
  const result = aggregateMeasuredSuites({ root, requiredSuites: ['app'], suites: [structuredClone(suite)], environmentGated: ENVIRONMENT_GATED });
  assert.equal(result.environmentGatedSkipped, 204); assert.equal(result.testCount, 1); assert.equal(result.testFiles, 1);
  // Without any one reviewed group the same nightly fails as incomplete.
  for (const omitted of ENVIRONMENT_GATED) assert.throws(() => aggregateMeasuredSuites({ root, requiredSuites: ['app'], suites: [structuredClone(suite)],
    environmentGated: ENVIRONMENT_GATED.filter(entry => entry !== omitted) }), /mandatory cases skipped or unfinished/, key(omitted));
});
