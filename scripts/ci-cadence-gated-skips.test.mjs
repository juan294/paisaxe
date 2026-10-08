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

const IMPORT = /import\s*\{[^}]*\bisLocalSupabaseReachable\b[^}]*\}\s*from\s*["'](?:@\/test\/local-supabase|(?:\.\.\/)+src\/test\/local-supabase)["']/;
const TITLE = /\bdescribe(?:\.\w+(?:\([^)]*\))?)?\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g;
test('each gated group is gated only by the local Supabase reachability probe, under a unique title', () => {
  for (const file of new Set(ENVIRONMENT_GATED.map(entry => entry.file))) {
    const text = readFileSync(`${root}/${file}`, 'utf8');
    assert.match(text, IMPORT, `${file}: isLocalSupabaseReachable must come from the shared local Supabase helper`);
    assert.equal(text.match(/\bdbReachable\s*=/g)?.length, 1, `${file}: dbReachable is bound once`);
    assert.match(text, /^const dbReachable = await isLocalSupabaseReachable\(\);$/m, `${file}: dbReachable is the reachability probe`);
    // Two describes with one title would merge into one admitted group.
    const titles = [...text.matchAll(TITLE)].map(match => match[2]);
    for (const entry of ENVIRONMENT_GATED.filter(item => item.file === file)) assert.equal(titles.filter(title => title === entry.describe).length, 1, `${key(entry)} title is unique in its file`);
  }
});

test('each reviewed group pins the number of cases it skips on a hosted runner', () => {
  for (const group of census.skippedGroups) assert.equal(ENVIRONMENT_GATED.find(entry => key(entry) === key(group))?.cases, group.cases, key(group));
  assert.equal(ENVIRONMENT_GATED.reduce((sum, entry) => sum + entry.cases, 0), census.native.numPendingTests);
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
