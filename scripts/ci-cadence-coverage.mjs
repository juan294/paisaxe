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
 */
export function aggregateMeasuredSuites({ root, requiredSuites, suites }) {
  requireEvidence(typeof root === 'string' && isAbsolute(root) && root === resolve(root), 'canonical checkout root required');
  requireEvidence(Array.isArray(requiredSuites) && requiredSuites.length > 0
    && requiredSuites.every(id => typeof id === 'string' && /^[a-z][a-z0-9-]*$/.test(id))
    && new Set(requiredSuites).size === requiredSuites.length, 'unique mandatory suite inventory required');
  requireEvidence(Array.isArray(suites) && suites.length === requiredSuites.length, 'missing or extra suite');
  requireEvidence(suites.every(s => record(s) && requiredSuites.includes(s.id))
    && new Set(suites.map(s => s.id)).size === suites.length, 'wrong or repeated suite');
  const cases = new Map(), testFiles = new Set(), lineHits = new Map(), measured = [];
  let observedExecutions = 0;
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
    requireEvidence(total > 0 && pending === 0 && todo === 0 && pendingSuites === 0, 'mandatory cases skipped or unfinished');
    requireEvidence(Number.isInteger(suite.exitCode) && [0,1].includes(suite.exitCode), 'actual process exit required');
    const files = new Set(), localCases = new Set();
    let actualPassed = 0, actualFailed = 0, actualFailedFiles = 0;
    for (const file of results.testResults) {
      requireEvidence(record(file) && ['passed','failed'].includes(file.status)
        && typeof file.message === 'string' && file.message === ''
        && Array.isArray(file.assertionResults) && file.assertionResults.length > 0, 'empty file or hook failure');
      const name = pathWithin(root,file.name);
      requireEvidence(!files.has(name), 'duplicate test file');
      files.add(name); testFiles.add(name);
      let fileFailed = false;
      for (const assertion of file.assertionResults) {
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
    }
    requireEvidence(total === actualPassed + actualFailed && passed === actualPassed && failed === actualFailed
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
    coveredLines, totalLines: lineHits.size, suites: measured };
}
