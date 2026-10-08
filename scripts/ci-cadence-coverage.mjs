import { isAbsolute, relative, resolve, sep } from 'node:path';

function requireEvidence(condition, message) {
  if (!condition) throw new Error(`Incomplete coverage measurement: ${message}`);
}
function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function pathWithin(root, value) {
  requireEvidence(typeof value === 'string' && isAbsolute(value) && !value.includes('\0'), 'absolute evidence path required');
  requireEvidence(value === resolve(value), 'noncanonical evidence path');
  const name = relative(root, value);
  requireEvidence(name !== '' && name !== '..' && !name.startsWith(`..${sep}`) && !isAbsolute(name), 'evidence outside checkout');
  return name.split(sep).join('/');
}
function count(value) {
  requireEvidence(Number.isSafeInteger(value) && value >= 0, 'invalid native count');
  return value;
}

/** Fresh Vitest JSON results and Istanbul per-file line evidence only.
 * The caller supplies the reviewed mandatory suite inventory. Native run
 * admission, immutable artifact provenance and publisher authority remain
 * separate checks. Repeated executions cannot inflate unique test counts.
 * environmentGated lists the exact reviewed (file, top-level describe) groups
 * that skip as a whole without their environment (describe.skipIf), each with
 * its pinned case count; such a group's skipped cases are disclosed, never
 * counted, and any other skip, or a group that grew or shrank, fails.
 */
export function aggregateMeasuredSuites({ root, requiredSuites, suites, environmentGated = [] }) {
  requireEvidence(typeof root === 'string' && isAbsolute(root) && root === resolve(root), 'canonical checkout root required');
  requireEvidence(Array.isArray(requiredSuites) && requiredSuites.length > 0
    && requiredSuites.every(id => typeof id === 'string' && /^[a-z][a-z0-9-]*$/.test(id))
    && new Set(requiredSuites).size === requiredSuites.length, 'unique mandatory suite inventory required');
  requireEvidence(Array.isArray(suites) && suites.length === requiredSuites.length, 'missing or extra suite');
  requireEvidence(suites.every(s => record(s) && requiredSuites.includes(s.id))
    && new Set(suites.map(s => s.id)).size === suites.length, 'wrong or repeated suite');
  requireEvidence(Array.isArray(environmentGated) && environmentGated.every(entry => record(entry) && Object.keys(entry).length === 3
    && typeof entry.file === 'string' && /^[^/]/.test(entry.file) && !entry.file.split('/').includes('..') && typeof entry.describe === 'string' && entry.describe.trim().length > 0
    && Number.isSafeInteger(entry.cases) && entry.cases > 0)
    && new Set(environmentGated.map(entry => JSON.stringify([entry.file, entry.describe]))).size === environmentGated.length, 'invalid environment-gated inventory');
  const gatedGroups = new Map(environmentGated.map(entry => [JSON.stringify([entry.file, entry.describe]), entry.cases]));
  const cases = new Map(), testFiles = new Set(), lineHits = new Map(), measured = [];
  let observedExecutions = 0, environmentGatedSkipped = 0;
  for (const id of requiredSuites) {
    const suite = suites.find(s => s.id === id), results = suite.tests;
    requireEvidence(record(results) && typeof results.success === 'boolean'
      && Array.isArray(results.testResults) && results.testResults.length > 0, 'native JSON results required');
    const totals = ['numTotalTests','numPassedTests','numFailedTests','numPendingTests','numTodoTests',
      'numFailedTestSuites','numPendingTestSuites'].map(key => count(results[key]));
    const [total, passed, failed, pending, todo, failedSuites, pendingSuites] = totals;
    const totalSuites = count(results.numTotalTestSuites), passedSuites = count(results.numPassedTestSuites);
    requireEvidence(totalSuites >= results.testResults.length
      && totalSuites === passedSuites + failedSuites + pendingSuites, 'native suite census contradicts files');
    requireEvidence(total > 0 && todo === 0 && pendingSuites === 0, 'mandatory cases skipped or unfinished');
    requireEvidence(Number.isInteger(suite.exitCode) && [0,1].includes(suite.exitCode), 'actual process exit required');
    const files = new Set(), localCases = new Set();
    let actualPassed = 0, actualFailed = 0, actualFailedFiles = 0, actualSkipped = 0;
    for (const file of results.testResults) {
      requireEvidence(record(file) && ['passed','failed'].includes(file.status)
        && typeof file.message === 'string' && file.message === ''
        && Array.isArray(file.assertionResults) && file.assertionResults.length > 0, 'empty file or hook failure');
      const name = pathWithin(root,file.name);
      requireEvidence(!files.has(name), 'duplicate test file');
      files.add(name);
      // A gated group either ran completely or skipped completely.
      const groups = new Map();
      for (const assertion of file.assertionResults) {
        const group = JSON.stringify([name, Array.isArray(assertion?.ancestorTitles) ? assertion.ancestorTitles[0] : undefined]);
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group).push(assertion?.status);
      }
      for (const [group, statuses] of groups) {
        if (!statuses.includes('skipped')) continue;
        requireEvidence(gatedGroups.has(group) && statuses.every(status => status === 'skipped') && statuses.length === gatedGroups.get(group), 'mandatory cases skipped or unfinished');
      }
      let fileFailed = false, fileExecuted = false;
      for (const assertion of file.assertionResults) {
        if (record(assertion) && assertion.status === 'skipped') {
          requireEvidence(Array.isArray(assertion.ancestorTitles) && assertion.ancestorTitles.length > 0 && typeof assertion.title === 'string'
            && [...assertion.ancestorTitles, assertion.title].join(' ') === assertion.fullName, 'contradictory structured test identity');
          actualSkipped++; environmentGatedSkipped++;
          continue;
        }
        fileExecuted = true;
        requireEvidence(record(assertion) && typeof assertion.fullName === 'string'
          && assertion.fullName.trim().length > 0 && ['passed','failed'].includes(assertion.status), 'invalid or unexecuted test identity');
        requireEvidence(Array.isArray(assertion.ancestorTitles)
          && assertion.ancestorTitles.every(title => typeof title === 'string' && title.trim().length > 0)
          && typeof assertion.title === 'string' && assertion.title.trim().length > 0
          && [...assertion.ancestorTitles,assertion.title].join(' ') === assertion.fullName, 'contradictory structured test identity');
        const key = JSON.stringify([name,assertion.ancestorTitles,assertion.title]);
        requireEvidence(!localCases.has(key), 'duplicate case in one suite');
        localCases.add(key); observedExecutions++;
        const isFailed = assertion.status === 'failed';
        if (isFailed) { actualFailed++; fileFailed = true; } else actualPassed++;
        cases.set(key, cases.get(key) === true || isFailed);
      }
      requireEvidence((file.status === 'failed') === fileFailed, 'file conclusion contradicts cases');
      if (fileFailed) actualFailedFiles++;
      if (fileExecuted) testFiles.add(name);
    }
    requireEvidence(pending === actualSkipped, 'mandatory cases skipped or unfinished');
    requireEvidence(total === actualPassed + actualFailed + actualSkipped && passed === actualPassed && failed === actualFailed
      && failedSuites >= actualFailedFiles && (failedSuites === 0) === (actualFailedFiles === 0), 'native totals contradict executed cases');
    requireEvidence(results.success === (actualFailed === 0) && suite.exitCode === (actualFailed === 0 ? 0 : 1), 'process or success conclusion contradicts cases');
    requireEvidence(record(suite.coverage) && Object.keys(suite.coverage).length > 0, 'per-file coverage required');
    let suiteLines = 0;
    for (const [path, evidence] of Object.entries(suite.coverage)) {
      const name = pathWithin(root,path);
      requireEvidence(record(evidence) && evidence.path === path && record(evidence.statementMap) && record(evidence.s), 'invalid per-file line evidence');
      const statementIds = Object.keys(evidence.statementMap);
      requireEvidence(statementIds.length === Object.keys(evidence.s).length
        && statementIds.every(statement => Object.hasOwn(evidence.s,statement)), 'missing or extra statement hits');
      for (const statement of statementIds) {
        const line = evidence.statementMap[statement]?.start?.line;
        requireEvidence(Number.isSafeInteger(line) && line > 0, 'invalid source line');
        const hits = count(evidence.s[statement]);
        const key = JSON.stringify([name,line]);
        lineHits.set(key, (lineHits.get(key) ?? false) || hits > 0); suiteLines++;
      }
    }
    requireEvidence(suiteLines > 0, 'empty measured line inventory');
    measured.push({ id, executed: actualPassed + actualFailed, failed: actualFailed });
  }
  const failed = [...cases.values()].filter(Boolean).length;
  const coveredLines = [...lineHits.values()].filter(Boolean).length;
  return { testCount: cases.size, testFiles: testFiles.size, passed: cases.size - failed, failed,
    observedExecutions, coverage: Math.round(coveredLines / lineHits.size * 10000) / 100,
    coveredLines, totalLines: lineHits.size, environmentGatedSkipped, suites: measured };
}
