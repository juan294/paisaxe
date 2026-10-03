import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const SCHEMA_VERSION = 1;
const SHA = /^[a-f0-9]{40}$/;
const BRANCH = /^(?!.*(?:\.\.|@\{|\/\/))[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const FAST_WORK = ['commit-secret-scan', 'policy-validation', 'lockfile-validation', 'cadence-contracts'];
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const positiveInteger = value => Number.isSafeInteger(value) && value > 0;
const timestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,19) === value.slice(0,19) ? Date.parse(value) : NaN;
const result = errors => ({ valid: errors.length === 0, errors });
const sameList = (left, right) => {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  const sortedRight = [...right].sort();
  return [...left].sort().every((entry, index) => entry === sortedRight[index]);
};

/** All routing inputs must come from an immutable protected definition. */
export function validatePolicy(policy) {
  const errors = [];
  if (!isRecord(policy)) return result(['policy: expected an object; repair the installed policy']);
  if (policy.schemaVersion !== SCHEMA_VERSION) errors.push('schemaVersion: expected 1');
  if (typeof policy.repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(policy.repository)) errors.push('repository: expected exact owner/repository identity');
  for (const field of ['integrationBranch', 'defaultBranch', 'productionBranch']) {
    if (typeof policy[field] !== 'string' || !BRANCH.test(policy[field]) || policy[field].startsWith('refs/') || policy[field].endsWith('/') || policy[field].endsWith('.') || policy[field].endsWith('.lock')) errors.push(`${field}: expected a branch name, not a ref`);
  }
  if (policy.integrationBranch === policy.productionBranch) errors.push('integrationBranch: must differ from productionBranch');
  if (![policy.integrationBranch, policy.productionBranch].includes(policy.defaultBranch)) errors.push('defaultBranch: expected documented integration or production branch');
  if (!Array.isArray(policy.owners) || policy.owners.length === 0 || policy.owners.some(owner => typeof owner !== 'string' || !/^[A-Za-z0-9-]+$/.test(owner)) || new Set(policy.owners).size !== policy.owners.length) errors.push('owners: expected unique trusted human identities');
  for (const field of ['refreshHours', 'coverageMaxAgeHours', 'changedHeadDeadlineHours']) if (!positiveInteger(policy[field])) errors.push(`${field}: expected positive integer hours`);
  if (policy.refreshHours !== 168) errors.push('refreshHours: frozen contract requires seven days (168 hours)');
  if (policy.coverageMaxAgeHours !== 192) errors.push('coverageMaxAgeHours: frozen contract requires eight days (192 hours)');
  if (policy.changedHeadDeadlineHours !== 36) errors.push('changedHeadDeadlineHours: frozen contract requires 36 hours');
  if (!Array.isArray(policy.workflows) || !policy.workflows.length) errors.push('workflows: expected full-suite inventory');
  else {
    const paths = new Set();
    const allIds = new Set();
    for (const [index, workflow] of policy.workflows.entries()) {
      const field = `workflows[${index}]`;
      if (!isRecord(workflow)) { errors.push(`${field}: expected object`); continue; }
      if (typeof workflow.path !== 'string' || !/^\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/.test(workflow.path) || paths.has(workflow.path)) errors.push(`${field}.path: expected unique local workflow path`);
      paths.add(workflow.path);
      if (!SHA.test(workflow.definitionSha ?? '')) errors.push(`${field}.definitionSha: expected workflow blob SHA`);
      if (!Array.isArray(workflow.jobs) || !workflow.jobs.length) { errors.push(`${field}.jobs: expected applicable full-job graph`); continue; }
      const ids = workflow.jobs.map(job => job?.id);
      for (const id of ids) {
        if (allIds.has(id)) errors.push(`${field}.jobs: qualify job IDs uniquely across workflows`);
        allIds.add(id);
      }
      if (ids.some(id => typeof id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(id)) || new Set(ids).size !== ids.length) errors.push(`${field}.jobs: expected unique job IDs`);
      for (const job of workflow.jobs) if (!Array.isArray(job?.needs) || new Set(job.needs).size !== job.needs.length || job.needs.some(dependency => !ids.includes(dependency) || dependency === job.id)) errors.push(`${field}.jobs: invalid dependency inventory`);
      const visiting = new Set(); const visited = new Set();
      const visit = id => {
        if (visiting.has(id)) { errors.push(`${field}.jobs: dependency cycle`); return; }
        if (visited.has(id)) return;
        visiting.add(id);
        const job = workflow.jobs.find(entry => entry?.id === id);
        for (const dependency of Array.isArray(job?.needs) ? job.needs : []) if (ids.includes(dependency)) visit(dependency);
        visiting.delete(id); visited.add(id);
      };
      ids.forEach(visit);
      if (!isRecord(workflow.contexts) || !Object.keys(workflow.contexts).length) errors.push(`${field}.contexts: required context inventory missing`);
      else for (const [context, children] of Object.entries(workflow.contexts)) if (!context || !Array.isArray(children) || !children.length || new Set(children).size !== children.length || children.some(id => !ids.includes(id))) errors.push(`${field}.contexts.${context}: invalid applicable children`);
    }
  }
  return result(errors);
}

export function classifyEvent(event, policy, mode, trustedDefinition) {
  const validation = validatePolicy(policy);
  const definitionSha = trustedDefinition?.sha;
  const common = { definitionSha, sourceSha: event?.headSha ?? event?.sourceSha, targetBranch: event?.baseBranch ?? (typeof event?.ref === 'string' ? event.ref.replace(/^refs\/heads\//, '') : undefined), baseSha: event?.baseSha, allowDeploy: false, allowPrivileged: false };
  const disposition = (lane, reason, extra = {}) => ({ ...common, lane, reason, ...extra });
  if (!validation.valid) return disposition('blocked', `invalid policy: ${validation.errors.join('; ')}; repair installed policy`);
  if (!isRecord(event) || event.repository !== policy.repository) return disposition('blocked', 'event repository identity mismatch');
  if (!isRecord(trustedDefinition) || trustedDefinition.repository !== policy.repository || !SHA.test(definitionSha ?? '') || ![policy.defaultBranch, policy.integrationBranch, policy.productionBranch].includes(trustedDefinition.branch)) return disposition('blocked', 'trusted definition must be pinned to protected base/default branch identity');
  if (event.kind === 'pull_request' && trustedDefinition.branch !== policy.defaultBranch && trustedDefinition.branch !== event.baseBranch) return disposition('blocked', 'definition branch must equal protected PR base or default branch');
  const supported = ['push', 'pull_request', 'schedule', 'workflow_dispatch'];
  if (!supported.includes(event.kind)) return disposition('blocked', 'unsupported event kind');
  if (event.kind === 'push' && (typeof event.ref !== 'string' || !event.ref.startsWith('refs/heads/'))) return disposition('blocked', 'ref: expected a native branch push ref');
  if (event.kind === 'push' && (event.baseBranch !== undefined || event.baseSha !== undefined || (event.headSha !== undefined && event.headSha !== event.sourceSha))) return disposition('blocked', 'push identity: conflicting PR fields or candidate SHA');
  const sourceSha = event.kind === 'schedule' ? event.resolvedHeadSha : common.sourceSha;
  if (!SHA.test(sourceSha ?? '')) return disposition('blocked', 'sourceSha: exact candidate SHA is required');
  common.sourceSha = sourceSha;
  if (event.kind === 'pull_request' && (!SHA.test(event.baseSha ?? '') || typeof event.baseBranch !== 'string')) return disposition('blocked', 'baseSha/baseBranch: exact PR base identity is required');
  const trustedOwner = policy.owners.includes(event.actor) && policy.owners.includes(event.author) && (event.kind !== 'pull_request' || event.headRepository === policy.repository);
  const production = common.targetBranch === policy.productionBranch;
  if (['push', 'pull_request'].includes(event.kind) && !trustedOwner) return disposition('untrusted', 'full isolated suite; authenticated/provider acceptance withheld until vetted integration', { releaseRequired: production, acceptanceBlocked: true, runner: 'standard-hosted', token: 'read-only' });
  if (production && ['push', 'pull_request'].includes(event.kind)) return disposition('release', 'production always executes exact candidate/base full suite', { releaseRequired: true, allowDeploy: event.kind === 'push', allowPrivileged: true });
  if (event.kind === 'schedule') {
    if (trustedDefinition.branch !== policy.defaultBranch || event.resolvedBranch !== policy.integrationBranch) return disposition('blocked', 'nightly requires default-branch definition and resolved integration branch');
    if (mode !== 'lean' || trustedDefinition.helperInstalled !== true) return disposition('blocked', 'new nightly is disabled under legacy mode or missing protected helper');
    return disposition('nightly', 'pinned integration identity; history determines full execution', { targetBranch: event.resolvedBranch });
  }
  if (event.kind === 'workflow_dispatch') return event.manualAuthorized === true && trustedOwner ? disposition('full', 'authorized diagnostic validation; not release evidence', { releaseRequired: false }) : disposition('blocked', 'manual validation requires explicit trusted authorization');
  if (common.targetBranch !== policy.integrationBranch) return disposition('full', 'non-integration event retains full validation');
  if (event.kind === 'push' && trustedDefinition.releaseCandidateSha === sourceSha) return disposition('release', 'exact trusted integration release candidate requires full native check', { releaseRequired: true });
  if (trustedDefinition.helperInstalled !== true) return disposition('full', 'protected helper absent; initial installation preserves legacy full');
  if (mode !== 'lean') return disposition('full', `CI_CADENCE_MODE=${String(mode ?? 'missing')}: legacy full; only validated lean reduces cadence`);
  return disposition('fast', 'trusted owner development in validated lean mode', { requiredFastCheck: 'CI Fast', fastWork: [...FAST_WORK] });
}

function inventoryErrors(jobs, contexts, workflows) {
  const errors = [];
  if (!isRecord(jobs)) return ['jobs: full-suite results missing'];
  if (!isRecord(contexts)) return ['contexts: required check results missing'];
  for (const workflow of workflows) {
    for (const job of workflow.jobs) {
      const observed = jobs[job.id];
      if (observed?.result !== 'success') errors.push(`jobs.${job.id}: expected actual success, got ${observed?.result ?? 'missing'}`);
      if (!sameList(observed?.needs, job.needs)) errors.push(`jobs.${job.id}.needs: dependency graph mismatch`);
    }
    for (const [context, children] of Object.entries(workflow.contexts)) {
      if (contexts[context] !== 'success') errors.push(`contexts.${context}: expected actual success`);
      if (children.some(id => jobs[id]?.result !== 'success')) errors.push(`contexts.${context}: applicable child did not pass`);
    }
  }
  return errors;
}

function receiptIdentityErrors(receipt, expected, policy) {
  const errors = [];
  if (!isRecord(receipt) || !isRecord(expected)) return ['receipt: missing identity'];
  if (receipt.schemaVersion !== SCHEMA_VERSION) errors.push('schemaVersion: expected receipt v1');
  for (const field of ['repository', 'sourceSha', 'targetBranch', 'baseSha', 'definitionSha', 'policyFingerprint', 'lockfileFingerprint', 'runtimeFingerprint']) {
    if (expected[field] === undefined && field === 'baseSha') continue;
    if (typeof expected[field] !== 'string' || !expected[field] || receipt[field] !== expected[field]) errors.push(`${field}: expected ${String(expected[field])}, got ${String(receipt[field])}`);
  }
  if (receipt.repository !== policy.repository) errors.push('repository: not allowlisted');
  if (!SHA.test(receipt.sourceSha ?? '') || !SHA.test(receipt.definitionSha ?? '') || (receipt.baseSha !== undefined && !SHA.test(receipt.baseSha))) errors.push('sourceSha/baseSha/definitionSha: malformed SHA');
  if (!['full', 'nightly', 'release'].includes(receipt.lane)) errors.push('lane: fast-only or unknown receipts cannot prove full validation');
  const workflow = policy.workflows.find(item => item.path === receipt.workflow);
  if (!workflow || workflow.definitionSha !== receipt.workflowDefinitionSha) errors.push('workflowDefinitionSha: measuring workflow is not installed trusted inventory');
  if (!positiveInteger(receipt.runId) || !positiveInteger(receipt.attempt)) errors.push('runId/attempt: expected native immutable run identity');
  if (!Number.isFinite(timestamp(receipt.completedAt))) errors.push('completedAt: immutable suite completion timestamp missing or invalid');
  if (receipt.runUrl !== `https://github.com/${policy.repository}/actions/runs/${receipt.runId}`) errors.push('runUrl: expected canonical allowlisted run link');
  if (!['push','pull_request','schedule','workflow_dispatch'].includes(receipt.nativeEvent)) errors.push('nativeEvent: native measuring event missing');
  if (receipt.testedCheckoutSha !== receipt.sourceSha) errors.push('testedCheckoutSha: actual tested checkout must equal pinned source');
  const nativeExpected = receipt.nativeEvent === 'schedule' ? receipt.definitionSha : receipt.sourceSha;
  if (receipt.nativeHeadSha !== nativeExpected) errors.push('nativeHeadSha: native event definition/candidate identity mismatch');
  if (receipt.nativeEvent === 'pull_request') {
    const expectedPrefix = `${policy.repository}/${typeof receipt.workflow === 'string' ? receipt.workflow : ''}@refs/pull/`;
    if (receipt.nativeWorkflowBranch !== receipt.targetBranch || typeof receipt.workflowRef !== 'string' || !receipt.workflowRef.startsWith(expectedPrefix) || !/^[1-9][0-9]*\/merge$/.test(receipt.workflowRef.slice(expectedPrefix.length))) errors.push('workflowRef/nativeWorkflowBranch: native PR provenance mismatch');
  } else {
    const branch = receipt.nativeEvent === 'schedule' ? policy.defaultBranch : receipt.targetBranch;
    if (receipt.nativeWorkflowBranch !== branch || receipt.workflowRef !== `${policy.repository}/${receipt.workflow}@refs/heads/${branch}`) errors.push('workflowRef/nativeWorkflowBranch: native branch measuring provenance mismatch');
  }
  if (receipt.nativeEvent === 'workflow_dispatch' || (receipt.lane === 'release' && !['push','pull_request'].includes(receipt.nativeEvent))) errors.push('nativeEvent: diagnostic/scheduled evidence cannot satisfy release admission');
  return errors;
}

export function validateReceipt(receipt, expected, policy) {
  const validation = validatePolicy(policy);
  if (!validation.valid) return validation;
  const errors = receiptIdentityErrors(receipt, expected, policy);
  if (receipt?.conclusion !== 'success') errors.push('conclusion: full suite did not succeed');
  if (isRecord(receipt)) {
    if (policy.workflows.length === 1) errors.push(...inventoryErrors(receipt.jobs, receipt.contexts, policy.workflows));
    else {
      const completionTimes = [];
      for (const workflow of policy.workflows) {
      const suite = receipt.suites?.[workflow.path];
      if (!isRecord(suite)) { errors.push(`suites.${workflow.path}: native per-workflow receipt missing`); continue; }
      const suitePolicy = {...policy,workflows:[workflow]};
      errors.push(...receiptIdentityErrors(suite,expected,suitePolicy).map(error=>`suites.${workflow.path}.${error}`));
      if (suite.conclusion !== 'success') errors.push(`suites.${workflow.path}.conclusion: actual success required`);
      errors.push(...inventoryErrors(suite.jobs,suite.contexts,[workflow]));
      if (timestamp(suite.completedAt) > timestamp(receipt.completedAt)) errors.push('completedAt: aggregate predates completed child suite');
      completionTimes.push(timestamp(suite.completedAt));
      }
      if (Math.max(...completionTimes) !== timestamp(receipt.completedAt)) errors.push('completedAt: aggregate must preserve latest actual suite measurement time');
    }
  }
  return result(errors);
}

export function chooseNightly(head, history, now, policy, options = {}) {
  const validation = validatePolicy(policy);
  if (!validation.valid) return { action: 'blocked', reason: `invalid policy: ${validation.errors.join('; ')}`, publishCoverage: false };
  const clock = timestamp(now);
  if (!Number.isFinite(clock) || !isRecord(head) || !SHA.test(head.sourceSha ?? '') || head.repository !== policy.repository || head.targetBranch !== policy.integrationBranch) return { action: 'blocked', reason: 'head/now: invalid pinned nightly identity or clock', publishCoverage: false };
  if (options.checkoutSha !== undefined && options.checkoutSha !== head.sourceSha) return { action: 'blocked', reason: 'checkout identity mismatch: expected pinned sourceSha', publishCoverage: false };
  const full = reason => ({ action: 'full', reason, sourceSha: head.sourceSha, targetBranch: head.targetBranch, publishCoverage: false });
  if (!isRecord(history) || !Array.isArray(history.receipts)) return full(`history unavailable: ${history?.error ?? 'missing, partial or invalid history'}; full fallback`);
  const matching = history.receipts.filter(receipt => receiptIdentityErrors(receipt, head, policy).length === 0 && timestamp(receipt.completedAt) <= clock).sort((a, b) => timestamp(b.completedAt) - timestamp(a.completedAt) || b.attempt - a.attempt);
  const success = matching.find(receipt => validateReceipt(receipt, head, policy).valid);
  const failure = matching.find(receipt => ['failure', 'timed_out', 'cancelled', 'action_required'].includes(receipt.conclusion));
  if (failure && (!success || timestamp(failure.completedAt) >= timestamp(success.completedAt))) {
    const retry = options.retry;
    if (history.available !== false && history.complete === true && retry?.authorized === true && retry.sourceSha === head.sourceSha && retry.failedRunId === failure.runId && retry.maxAttempts === failure.attempt + 1) return full('one explicitly authorized bounded retry of previous failed identity');
    return { action: 'blocked', reason: 'blocked: previous full suite failed; changed/fixed commit or specifically authorized bounded retry required', runId: failure.runId, runUrl: failure.runUrl, completedAt: failure.completedAt, publishCoverage: false };
  }
  if (history.available === false || history.complete !== true) return full(`history unavailable: ${history.error ?? 'partial lookup'}; full fallback`);
  if (!success) return full('no valid matching full-suite success; full fallback');
  if (clock - timestamp(success.completedAt) >= policy.refreshHours * 3600000) return full('seven-day environment/security refresh due');
  return { action: 'skip', reason: 'unchanged identity has recent immutable full-suite success', sourceSha: success.sourceSha, targetBranch: success.targetBranch, runId: success.runId, attempt: success.attempt, completedAt: success.completedAt, runUrl: success.runUrl, publishCoverage: false };
}

export function activationStatus(policy, installation) {
  const validation = validatePolicy(policy);
  const errors = [...validation.errors];
  if (installation?.branch !== policy?.defaultBranch) errors.push('branch: definitions not installed on actual default branch');
  if (installation?.repository !== policy?.repository) errors.push('repository: installation must match exact enrolled repository');
  if (!SHA.test(installation?.definitionSha ?? '')) errors.push('definitionSha: native installed identity missing');
  for (const field of ['helperInstalled', 'fastCheckProduced', 'rulesMigrated','consumerCompatible','repairDefaultOff']) if (installation?.[field] !== true) errors.push(`${field}: required before lean activation`);
  const fast = installation?.fastCheck;
  if (fast?.repository !== policy?.repository || fast?.definitionSha !== installation?.definitionSha || !SHA.test(fast?.sourceSha ?? '') || fast?.context !== 'CI Fast' || fast?.conclusion !== 'success' || !positiveInteger(fast?.runId)) errors.push('fastCheck: exact native successful context/identity missing');
  return { ready: errors.length === 0, errors };
}

export function cancellationPolicy(lane, identity) {
  if (!['fast', 'nightly', 'release', 'full', 'untrusted', 'blocked'].includes(lane) || !isRecord(identity) || typeof identity.repository !== 'string' || typeof identity.targetBranch !== 'string' || !SHA.test(identity.sourceSha ?? '')) throw new Error('lane/identity: invalid cancellation inputs');
  return { group: `ci-cadence:${identity.repository}:${lane}:${identity.targetBranch}${lane === 'release' ? `:${identity.sourceSha}` : ''}`, cancelInProgress: lane === 'fast' };
}

export function validateExecutionGraph(graph, classification, policy) {
  const validation = validatePolicy(policy);
  if (!validation.valid) return validation;
  const errors = [];
  if (!isRecord(graph) || !isRecord(classification)) return result(['graph/classification: missing execution evidence']);
  if (graph.schemaVersion !== SCHEMA_VERSION) errors.push('graph.schemaVersion: expected v1');
  for (const field of ['sourceSha', 'targetBranch', 'baseSha', 'definitionSha']) if (classification[field] !== undefined && graph[field] !== classification[field]) errors.push(`${field}: graph identity mismatch`);
  if (graph.privileged && !classification.allowPrivileged) errors.push('privileged: forbidden in this lane');
  if (graph.deploy && !classification.allowDeploy) errors.push('deploy: forbidden in this lane');
  if (classification.lane === 'blocked') errors.push('lane: blocked events cannot pass');
  else if (classification.lane === 'fast') {
    if (!isRecord(graph.jobs)) errors.push('jobs: bounded successful execution inventory missing');
    const fullIds = new Set(policy.workflows.flatMap(workflow => workflow.jobs.map(job => job.id)));
    if (Object.keys(graph.jobs ?? {}).some(id => fullIds.has(id))) errors.push('jobs: routine lean owner event executed a full shard');
    if (Object.keys(graph.jobs ?? {}).some(id => !FAST_WORK.includes(id))) errors.push('jobs: unexpected work outside bounded fast inventory');
    if (graph.contexts?.['CI Fast'] !== 'success') errors.push('contexts.CI Fast: bounded check missing');
    if (!sameList(graph.fastWork,FAST_WORK)) errors.push('fastWork: exact bounded real work inventory missing');
    for (const work of FAST_WORK) if (graph.jobs?.[work]?.result !== 'success') errors.push(`jobs.${work}: actual fast work did not pass`);
  } else errors.push(...inventoryErrors(graph.jobs, graph.contexts, policy.workflows));
  if (classification.acceptanceBlocked) errors.push('acceptance: authenticated/provider proof withheld; vetted full integration required');
  return result(errors);
}

/** Freeze bytes of the helper and public fixture files, including filenames. */
export async function contractChecksum(files, root) {
  const hash = createHash('sha256');
  for (const file of [...files].sort()) {
    hash.update(file.replaceAll('\\', '/')); hash.update('\0'); hash.update(await readFile(root ? new URL(file, root) : file)); hash.update('\0');
  }
  return hash.digest('hex');
}

export async function validateFixtures(directory = new URL('../tests/fixtures/ci-cadence/', import.meta.url)) {
  const base = directory instanceof URL ? directory : pathToFileURL(`${resolve(directory)}/`);
  const read = async name => JSON.parse(await readFile(new URL(`${name}.json`, base), 'utf8'));
  const policy = await read('policy'); const events = await read('events'); const history = await read('history'); const graph = await read('graph');
  const errors = [...validatePolicy(policy).errors];
  for (const [name, fixture] of Object.entries({ events, history, graph })) if (fixture.schemaVersion !== SCHEMA_VERSION) errors.push(`${name}.schemaVersion: expected v1`);
  if (!Array.isArray(events.cases) || !events.cases.length) errors.push('events.cases: missing behavioral oracles');
  else for (const fixture of events.cases) {
    const classification = classifyEvent(fixture.event, policy, fixture.mode, fixture.trustedDefinition);
    if (classification.lane !== fixture.expectedLane) errors.push(`events.${fixture.name}: expected ${fixture.expectedLane}, got ${classification.lane}`);
  }
  if (!Array.isArray(history.receipts) || !history.receipts.length) errors.push('history.receipts: missing full-suite evidence oracle');
  else for (const receipt of history.receipts) errors.push(...validateReceipt(receipt, history.head, policy).errors.map(error => `history.${error}`));
  const release = events.cases?.find(fixture => fixture.expectedLane === 'release' && fixture.event.kind === 'pull_request');
  if (!release) errors.push('events: production PR oracle missing');
  else errors.push(...validateExecutionGraph(graph, classifyEvent(release.event, policy, release.mode, release.trustedDefinition), policy).errors.map(error => `graph.${error}`));
  return { ...result(errors), schemaVersion: SCHEMA_VERSION, eventCases: events.cases?.length ?? 0 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] !== 'validate-fixtures') throw new Error('usage: node scripts/ci-cadence.mjs validate-fixtures [directory]');
    const validation = await validateFixtures(process.argv[3]);
    console.log(JSON.stringify(validation, null, 2));
    if (!validation.valid) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1;
  }
}
