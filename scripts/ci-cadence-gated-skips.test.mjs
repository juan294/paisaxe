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
const reviewed = JSON.parse(readFileSync(new URL('../tests/fixtures/ci-cadence-adapter/native/phase3-gated-cases.json', import.meta.url), 'utf8'));
const GATE = /describe\.skipIf\(!(?<probe>dbReachable|reachable)\)\(/g;

/** Every tracked test file's describe.skipIf(!dbReachable) group titles. */
function sourceGroups() {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')));
  const files = execFileSync('git', ['ls-files', '-z', '--', '*.test.ts', '*.test.tsx'], { cwd: root, encoding: 'utf8', env }).split('\0').filter(Boolean);
  const groups = [];
  for (const file of files) {
    const text = readFileSync(`${root}/${file}`, 'utf8');
    for (const match of text.matchAll(GATE)) {
      const literal = /^\s*(["'`])((?:\\.|(?!\1).)*)\1/s.exec(text.slice(match.index + match[0].length));
      assert.ok(literal && !literal[2].includes('${'), `${file}: a gated group needs a literal title`);
      groups.push({ file, describe: literal[2], probe: match.groups.probe });
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
    const probes = new Set(sourceGroups().filter(group => group.file === file).map(group => group.probe));
    assert.equal(probes.size, 1, `${file}: one reachability binding gates the groups`);
    const [probe] = probes;
    assert.equal(text.match(new RegExp('\\b' + probe + '\\s*=', 'g'))?.length, 1, `${file}: probe is bound once`);
    assert.match(text, new RegExp('^const ' + probe + ' = await isLocalSupabaseReachable\\(\\);$', 'm'), `${file}: gate is the shared local reachability probe`);
    // Two describes with one title would merge into one admitted group.
    const titles = [...text.matchAll(TITLE)].map(match => match[2]);
    for (const entry of ENVIRONMENT_GATED.filter(item => item.file === file)) assert.equal(titles.filter(title => title === entry.describe).length, 1, `${key(entry)} title is unique in its file`);
  }
});

test('each reviewed group pins its actual qualified case count', () => {
  assert.deepEqual(ENVIRONMENT_GATED.map(entry => ({...entry})), reviewed.groups);
  assert.equal(reviewed.executedContractCases, 936);
  assert.equal(ENVIRONMENT_GATED.reduce((sum, entry) => sum + entry.cases, 0), 937);
});

function skippedSuite(groups) {
  const skipped = groups.reduce((sum, group) => sum + group.cases, 0);
  const files = [{ name: `${root}/src/executed.test.ts`, status: 'passed', message: '',
    assertionResults: [{ ancestorTitles: ['executed'], title: 'case', fullName: 'executed case', status: 'passed', failureMessages: [] }] }];
  for (const group of groups) files.push({ name: `${root}/${group.file}`, status: 'passed', message: '',
    assertionResults: Array.from({ length: group.cases }, (_, index) => ({ ancestorTitles: [group.describe], title: `case ${index}`, fullName: `${group.describe} case ${index}`, status: 'skipped', failureMessages: [] })) });
  return { id: 'app', exitCode: 0, coverage: { [`${root}/src/a.ts`]: { path: `${root}/src/a.ts`, statementMap: { 0: { start: { line: 1 }, end: { line: 1 } } }, s: { 0: 1 } } },
    tests: { success: true, numTotalTests: 1 + skipped, numPassedTests: 1, numFailedTests: 0, numPendingTests: skipped, numTodoTests: 0,
      numTotalTestSuites: files.length, numPassedTestSuites: files.length, numFailedTestSuites: 0, numPendingTestSuites: 0, testResults: files } };
}

test('historical hosted nightly retains its 204-case provenance and cannot qualify changed source counts', () => {
  assert.equal(census.native.numPendingTests, 204);
  assert.equal(census.native.numPendingTests, census.skippedGroups.reduce((sum, group) => sum + group.cases, 0));
  assert.equal(census.native.numTodoTests, 0); assert.equal(census.native.numPendingTestSuites, 0);
  assert.ok(census.skippedGroups.every(group => group.status === 'skipped'));
  const historical = census.skippedGroups.map(({file, describe, cases}) => ({file, describe, cases}));
  assert.equal(aggregateMeasuredSuites({root,requiredSuites:['app'],suites:[skippedSuite(historical)],environmentGated:historical}).environmentGatedSkipped,204);
  assert.throws(() => aggregateMeasuredSuites({root,requiredSuites:['app'],suites:[skippedSuite(historical)],environmentGated:ENVIRONMENT_GATED}), /mandatory cases skipped or unfinished/);
});

test('current ordinary measurement discloses only whole reviewed groups, never counts their skipped cases', () => {
  const suite=skippedSuite(reviewed.groups);
  const result=aggregateMeasuredSuites({root,requiredSuites:['app'],suites:[structuredClone(suite)],environmentGated:ENVIRONMENT_GATED});
  assert.equal(result.environmentGatedSkipped,937);assert.equal(result.testCount,1);assert.equal(result.testFiles,1);
  for(const omitted of ENVIRONMENT_GATED) assert.throws(() => aggregateMeasuredSuites({root,requiredSuites:['app'],suites:[structuredClone(suite)],environmentGated:ENVIRONMENT_GATED.filter(entry=>entry!==omitted)}), /mandatory cases skipped or unfinished/, key(omitted));
  const partial=structuredClone(suite);partial.tests.testResults.at(-1).assertionResults[0].status='passed';
  assert.throws(() => aggregateMeasuredSuites({root,requiredSuites:['app'],suites:[partial],environmentGated:ENVIRONMENT_GATED}), /mandatory cases skipped or unfinished/);
});
