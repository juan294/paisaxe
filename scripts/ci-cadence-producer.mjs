import { readFile, writeFile, lstat, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { isAbsolute, relative } from 'node:path';
import { aggregateMeasuredSuites } from './ci-cadence-coverage.mjs';
import { protectedGitEnvironment } from './ci-cadence-native.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const required = condition => { if (!condition) throw Error('Native producer evidence incomplete or changed'); };

/** The runner supplies paths to its actual exit receipt and fresh native JSON.
 * No console counting, averages, source-rewriting or successful fallback. */
export async function readMeasuredApplication({ root, candidateSha, tests, coverage, exitReceipt }) {
  required(isAbsolute(root) && await realpath(root) === root && /^[a-f0-9]{40}$/.test(candidateSha ?? ''));
  const git = (...args) => execFileSync('git', ['--no-replace-objects', '-c', 'core.useReplaceRefs=false', '-c', 'core.fsmonitor=false', ...args], { cwd: root, env: protectedGitEnvironment(), encoding: 'utf8', timeout: 5000, maxBuffer: 2_000_000 }).trim();
  const check = () => required(git('rev-parse', 'HEAD') === candidateSha && git('status', '--porcelain', '--untracked-files=all') === '');
  check();
  const read = async path => {
    required(isAbsolute(path) && await realpath(path) === path);
    const before = await lstat(path); required(before.isFile() && !before.isSymbolicLink() && before.nlink === 1 && before.size > 0 && before.size <= 64 * 1024 * 1024);
    const bytes = await readFile(path), after = await lstat(path);
    required(before.dev === after.dev && before.ino === after.ino && before.size === after.size && before.mtimeMs === after.mtimeMs && bytes.length === after.size);
    return { bytes, value: JSON.parse(bytes), sha256: hash(bytes) };
  };
  const native = await read(tests), lines = await read(coverage), exit = await read(exitReceipt);
  required(exit.value.code === 0 && exit.value.signal === null && exit.value.expired === false && exit.value.overflow === false && exit.value.spawnError === false);
  for(const [path,evidence]of Object.entries(lines.value)) {
    const child=relative(root,path);required(isAbsolute(path)&&child&&!child.startsWith('..')&&await realpath(path)===path&&evidence.path===path);
    const actual=await readFile(path),committed=execFileSync('git',['--no-replace-objects','-c','core.useReplaceRefs=false','show',`${candidateSha}:${child}`],{cwd:root,env:protectedGitEnvironment(),timeout:5000,maxBuffer:64*1024*1024});required(actual.equals(committed));
    const source=actual.toString('utf8').split('\n');
    const point=(value,end)=>{required(Number.isSafeInteger(value?.line)&&value.line>0&&value.line<=source.length);const column=end&&value.column===null?source[value.line-1].length:value.column;required(Number.isSafeInteger(column)&&column>=0&&column<=source[value.line-1].length);return{line:value.line,column};};
    for(const statement of Object.values(evidence.statementMap??{})){const start=point(statement.start,false),end=point(statement.end,true);required(end.line>start.line||end.line===start.line&&end.column>=start.column);}
  }
  const metrics = aggregateMeasuredSuites({ root, requiredSuites: ['app'], suites: [{ id: 'app', tests: native.value, coverage: lines.value, exitCode: exit.value.code }] });
  required(metrics.failed === 0 && metrics.passed === metrics.testCount);
  check();
  return { metrics, evidence: { testsSha256: native.sha256, coverageSha256: lines.sha256, exitSha256: exit.sha256, candidateSha, treeSha: git('rev-parse', 'HEAD^{tree}'), nodeVersion: process.version, architecture: process.arch, platform: process.platform } };
}

/** The current native attempt must be independently authenticated by the real
 * reader. This is an upload artifact, never a complete receipt or publication. */
export async function writeNativeMeasurement({ state, reader, application, output }) {
  required(state?.expected?.repository === 'juan294/paisaxe' && typeof reader?.readMeasurementInputs === 'function' && isAbsolute(output));
  const observed = await reader.readMeasurementInputs({ ...state, runId: state.runId, attempt: state.attempt });
  required(observed.available === true && observed.scope === 'measurement-inputs' && application.evidence.candidateSha === state.expected.sourceSha && application.metrics.failed === 0
    && application.evidence.nodeVersion === process.version && application.evidence.architecture === process.arch && application.evidence.platform === process.platform);
  const value = { schemaVersion: 1, kind: 'ci-cadence-measurement', ...state.expected, runId: state.runId, attempt: state.attempt, workflow: state.workflow,
    failing: application.metrics.failed, metrics: application.metrics, checkouts: observed.checkouts, evidence: application.evidence, measuredAppCompletedAt: observed.completedAt };
  await writeFile(output, JSON.stringify(value), { mode: 0o600, flag: 'wx' });
  return { measurementSha256: hash(JSON.stringify(value)), nativeQualified: false };
}
