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
    observedExecutions: 2, coverage: 100, coveredLines: 2, totalLines: 2,
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
