import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aggregateMeasuredSuites } from './ci-cadence-coverage.mjs';

const root = '/task/candidate';
function suite(id, file = 'apps/a.test.ts', status = 'passed') {
  return { id, exitCode: status === 'failed' ? 1 : 0,
    tests: { success: status !== 'failed', numTotalTests: 1,
      numPassedTests: +(status === 'passed'), numFailedTests: +(status === 'failed'),
      numPendingTests: +(status === 'skipped'), numTodoTests: 0,
      numTotalTestSuites: 1, numPassedTestSuites: +(status !== 'failed'),
      numFailedTestSuites: +(status === 'failed'), numPendingTestSuites: 0,
      testResults: [{ name: `${root}/${file}`, status: status === 'failed' ? 'failed' : 'passed', message: '',
        assertionResults: [{ ancestorTitles: ['suite'], title: 'real case', fullName: 'suite real case', status, failureMessages: [] }] }] },
    coverage: { [`${root}/apps/a.ts`]: { path: `${root}/apps/a.ts`,
      statementMap: { 0: { start: { line: 1 }, end: { line: 1 } }, 1: { start: { line: 2 }, end: { line: 2 } } },
      s: { 0: 1, 1: 0 } } } };
}
const aggregate = (suites, requiredSuites = suites.map(s => s.id)) => aggregateMeasuredSuites({ root, requiredSuites, suites });

test('counts unique executed identities and unions actual line hits across overlapping reports', () => {
  const a = suite('app'), b = suite('scripts');
  b.coverage[`${root}/apps/a.ts`].s = { 0: 0, 1: 1 };
  assert.deepEqual(aggregate([a,b]), { testCount: 1, testFiles: 1, passed: 1, failed: 0,
    observedExecutions: 2, coverage: 100, coveredLines: 2, totalLines: 2, environmentGatedSkipped: 0,
    suites: [{ id: 'app', executed: 1, failed: 0 }, { id: 'scripts', executed: 1, failed: 0 }] });
});
test('distinct file identities count separately, failed repeated identity vetoes success', () => {
  assert.equal(aggregate([suite('app'),suite('scripts','scripts/a.test.ts')]).testCount, 2);
  const r = aggregate([suite('app'),suite('scripts','apps/a.test.ts','failed')]);
  assert.equal(r.failed, 1); assert.equal(r.passed, 0); assert.equal(r.testCount, 1);
});
for (const [name, mutate] of [
  ['skipped mandatory case', s => { s.tests.testResults[0].assertionResults[0].status='skipped'; s.tests.numPassedTests=0; s.tests.numPendingTests=1; }],
  ['missing native totals', s => { delete s.tests.numTotalTests; }],
  ['missing native suite census', s => { delete s.tests.numTotalTestSuites; delete s.tests.numPassedTestSuites; }],
  ['zero native suites despite file evidence', s => { s.tests.numTotalTestSuites=0; s.tests.numPassedTestSuites=0; }],
  ['contradictory native suite census', s => { s.tests.numTotalTestSuites=3; }],
  ['fabricated native totals', s => { s.tests.numPassedTests=2; }],
  ['missing structured identity', s => { delete s.tests.testResults[0].assertionResults[0].ancestorTitles; }],
  ['contradictory structured identity', s => { s.tests.testResults[0].assertionResults[0].title='different case'; }],
  ['zero-case green wrapper', s => { s.tests.testResults[0].assertionResults=[]; s.tests.numTotalTests=0; s.tests.numPassedTests=0; }],
  ['failed hook with passed cases', s => { s.tests.testResults[0].status='failed'; s.tests.testResults[0].message='hook failed'; s.tests.numFailedTestSuites=1; s.tests.success=false; s.exitCode=1; }],
  ['nonzero process despite green JSON', s => { s.exitCode=1; }],
  ['unknown process exit', s => { s.exitCode=null; }],
  ['success boolean inconsistency', s => { s.tests.success=false; }],
  ['duplicate file result', s => { s.tests.testResults.push(structuredClone(s.tests.testResults[0])); }],
  ['duplicate case within one file', s => { s.tests.testResults[0].assertionResults.push(structuredClone(s.tests.testResults[0].assertionResults[0])); }],
  ['outside checkout test', s => { s.tests.testResults[0].name='/other/a.test.ts'; }],
  ['traversing test path', s => { s.tests.testResults[0].name=`${root}/apps/../a.test.ts`; }],
  ['outside checkout coverage', s => { s.coverage['/other/a.ts']=s.coverage[`${root}/apps/a.ts`]; }],
  ['coverage path contradiction', s => { s.coverage[`${root}/apps/a.ts`].path=`${root}/apps/b.ts`; }],
  ['coverage summary cannot prove overlap', s => { s.coverage={total:{lines:{covered:1,total:2}}}; }],
  ['missing line hits', s => { delete s.coverage[`${root}/apps/a.ts`].s[0]; }],
  ['negative line hits', s => { s.coverage[`${root}/apps/a.ts`].s[0]=-1; }],
  ['fractional line', s => { s.coverage[`${root}/apps/a.ts`].statementMap[0].start.line=1.5; }],
  ['missing coverage', s => { s.coverage={}; }],
]) test(`rejects ${name}`, () => { const s=suite('app'); mutate(s); assert.throws(()=>aggregate([s])); });
test('requires exact complete unique suite inventory', () => {
  assert.throws(()=>aggregate([suite('app')], ['app','scripts']));
  assert.throws(()=>aggregate([suite('app'),suite('app')], ['app']));
  assert.throws(()=>aggregate([suite('app')], []));
  assert.throws(()=>aggregate([suite('app')], ['app','app']));
});
test('native suite census includes nested describe suites without inflating file count', () => {
  const s=suite('app'); s.tests.numTotalTestSuites=3; s.tests.numPassedTestSuites=3;
  const r=aggregate([s]); assert.equal(r.testFiles,1); assert.equal(r.testCount,1);
});
test('distinct structured identities with the same rendered name remain distinct', () => {
  const a=suite('app'), b=suite('scripts');
  Object.assign(a.tests.testResults[0].assertionResults[0], {ancestorTitles:['a b'],title:'c',fullName:'a b c'});
  Object.assign(b.tests.testResults[0].assertionResults[0], {ancestorTitles:['a'],title:'b c',fullName:'a b c'});
  assert.equal(aggregate([a,b]).testCount,2);
});
test('disjoint line reports retain weighted exact line totals', () => {
  const a=suite('app'),b=suite('scripts','scripts/a.test.ts');
  b.coverage[`${root}/scripts/a.ts`]=b.coverage[`${root}/apps/a.ts`];
  b.coverage[`${root}/scripts/a.ts`].path=`${root}/scripts/a.ts`;
  delete b.coverage[`${root}/apps/a.ts`];
  const r=aggregate([a,b]); assert.equal(r.coverage,50); assert.equal(r.totalLines,4); assert.equal(r.coveredLines,2);
});

// A describe.skipIf(!dbReachable) group skips as a whole on a runner without the
// local Supabase stack. Only exact reviewed (file, group) pairs may skip, and only whole.
const GATED = [{ file: 'src/lib/x.postgrest-integration.test.ts', describe: 'x against live local Supabase', cases: 2 }];
function gated(statuses = ['skipped', 'skipped'], describe = GATED[0].describe, file = GATED[0].file) {
  const s = suite('app');
  const cases = statuses.map((status, index) => ({ ancestorTitles: [describe, 'nested'], title: `case ${index}`, fullName: `${describe} nested case ${index}`, status, failureMessages: [] }));
  s.tests.testResults.push({ name: `${root}/${file}`, status: 'passed', message: '', assertionResults: cases });
  const skipped = statuses.filter(status => status !== 'passed').length;
  Object.assign(s.tests, { numTotalTests: 1 + statuses.length, numPassedTests: 1 + statuses.length - skipped, numPendingTests: skipped, numTotalTestSuites: 3, numPassedTestSuites: 3 });
  return s;
}
const aggregateGated = (s, environmentGated = GATED) => aggregateMeasuredSuites({ root, requiredSuites: ['app'], suites: [s], environmentGated });
test('a whole reviewed environment-gated group may skip; it is disclosed and never counted as a test', () => {
  const r = aggregateGated(gated());
  assert.equal(r.testCount, 1); assert.equal(r.passed, 1); assert.equal(r.testFiles, 1); assert.equal(r.observedExecutions, 1); assert.equal(r.environmentGatedSkipped, 2);
  // With the stack available the same group runs and counts like any other.
  const ran = aggregateGated(gated(['passed', 'passed']));
  assert.equal(ran.testCount, 3); assert.equal(ran.testFiles, 2); assert.equal(ran.environmentGatedSkipped, 0);
});
for (const [name, build, allowlist] of [
  ['a gated skip without the reviewed allowlist', () => gated(), []],
  ['a skip in another file', () => gated(['skipped'], GATED[0].describe, 'src/lib/y.postgrest-integration.test.ts')],
  ['a skip in another group of the reviewed file', () => gated(['skipped'], 'another group')],
  ['a partly skipped gated group', () => gated(['skipped', 'passed'])],
  ['a pending or todo case in a gated group', () => gated(['skipped', 'pending'])],
  ['a native pending total that exceeds the admitted skips', () => { const s = gated(); s.tests.numPendingTests += 1; s.tests.numTotalTests += 1; return s; }],
  ['a native pending count no case accounts for', () => { const s = gated(); s.tests.numPendingTests += 1; return s; }],
  ['a todo total', () => { const s = gated(); s.tests.numTodoTests = 1; return s; }],
  ['a case added to a skipped gated group', () => gated(['skipped', 'skipped', 'skipped'])],
  ['a case moved out of a skipped gated group', () => gated(['skipped'])],
  ['an allowlist entry without its pinned case count', () => gated(), [{ file: GATED[0].file, describe: GATED[0].describe }]],
  ['an allowlist entry with a non-positive case count', () => gated(), [{ ...GATED[0], cases: 0 }]],
  ['a skipped describe-level suite census', () => { const s = gated(); s.tests.numPendingTestSuites = 1; s.tests.numTotalTestSuites += 1; return s; }],
  ['a malformed allowlist', () => gated(), [{ file: GATED[0].file, cases: 2 }]],
  ['a duplicated allowlist entry', () => gated(), [GATED[0], GATED[0]]],
]) test(`rejects ${name}`, () => assert.throws(() => aggregateGated(build(), allowlist), /Incomplete coverage measurement/));
