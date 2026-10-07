import { createGitHubCadenceReader } from './ci-cadence-github.mjs';
import { chooseNightly } from './ci-cadence.mjs';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const identity = repository => record(repository) && repository.full_name === 'juan294/paisaxe' && repository.id === 1141286326 && repository.owner?.id === 3944118 && repository.owner?.login === 'juan294';
const unavailable = () => ({ available: false, publishCoverage: false, error: 'native completion identity or evidence unavailable' });

/** Protected caller supplies the independently acquired projected policy/head.
 * Only HTTP and clock are external seams; the real reader and frozen chooser
 * run eagerly. No retry, publication, mutation or app execution occurs here. */
export async function decideNightlyRun(input, options = {}) {
  const reader = createGitHubCadenceReader(options);
  const history = await reader.collectHistory(input);
  const running = history.receipts.find(receipt => receipt.kind === 'native-running-evidence');
  if (running) return { action: 'blocked', reason: 'matching authenticated full suite is in-progress; duplicate execution denied', runId: running.runId, attempt: running.attempt, publishCoverage: false, history };
  const decision = chooseNightly(input.expected, history, (options.now ?? (() => new Date()))().toISOString(), input.policy, { checkoutSha: input.expected.sourceSha });
  return { ...decision, history };
}

/** All compatible callers keep their own real workflow/BEFORE provenance.
 * The protected resolver reconstructs each state from actual Git; the frozen
 * chooser is invoked with the newest original matching identity, never a
 * relabeled nightly receipt. Partial lookup cannot authorize a skip. */
export async function decideCompatibleNightly(input,{resolveState,...options}={}) {
  const history=await createGitHubCadenceReader(options).collectCompatibleHistory({head:input.expected,runId:input.runId,attempt:input.attempt,resolveState});
  const matching=history.entries.filter(({receipt,expected})=>receipt.sourceSha===input.expected.sourceSha&&expected.lockfileFingerprint===input.expected.lockfileFingerprint&&expected.policyFingerprint===input.expected.policyFingerprint&&expected.helperFingerprint===input.expected.helperFingerprint&&expected.runtimeFingerprint===input.expected.runtimeFingerprint);
  const running=matching.find(e=>e.receipt.kind==='native-running-evidence');
  if(running)return{action:'blocked',reason:'matching authenticated original full suite is in-progress; duplicate execution denied',runId:running.receipt.runId,attempt:running.receipt.attempt,publishCoverage:false,history};
  matching.sort((a,b)=>Date.parse(b.receipt.completedAt)-Date.parse(a.receipt.completedAt)||b.receipt.runId-a.receipt.runId||b.receipt.attempt-a.receipt.attempt);
  const selected=matching[0],expected=selected?.expected??input.expected,policy=selected?.policy??input.policy;
  const receipts=matching.filter(e=>e.receipt.workflow===(selected?.receipt.workflow??input.workflow)&&e.expected.definitionSha===expected.definitionSha).map(e=>e.receipt);
  return {...chooseNightly(expected,{available:history.available,complete:history.complete,receipts,error:history.error},(options.now??(()=>new Date()))().toISOString(),policy,{checkoutSha:input.expected.sourceSha}),history};
}

/** Completion delivery is only a pointer. Original authenticated attempt,
 * protected uploaders, all app children and artifacts remain authoritative.
 * Returned publication data is a proposal, never an HTTP write capability. */
export async function finalizeCompletedRun(input, options = {}) {
  const delivery = input?.event?.workflow_run;
  if (input?.eventName !== 'workflow_run' || !identity(input.event.repository) || !record(delivery) || !identity(delivery.repository)
      || !identity(delivery.head_repository) || !Number.isSafeInteger(delivery.id) || delivery.id < 1
      || !Number.isSafeInteger(delivery.run_attempt) || delivery.run_attempt < 1 || delivery.status !== 'completed'
      || !['success','failure','cancelled','timed_out','action_required'].includes(delivery.conclusion)) return unavailable();
  const result = await createGitHubCadenceReader(options).readRun({ ...input, runId: delivery.id, attempt: delivery.run_attempt });
  if (!result.available || !result.receipt) return { ...result, publishCoverage: false };
  const receipt = result.receipt;
  if (delivery.path !== receipt.workflow || delivery.head_sha !== receipt.nativeHeadSha || delivery.head_branch !== receipt.nativeWorkflowBranch
      || delivery.event !== receipt.nativeEvent || delivery.conclusion !== receipt.conclusion) return unavailable();
  const metrics = result.measurement?.metrics;
  const validMetrics = record(metrics) && ['testCount','testFiles','passed','failed'].every(key => Number.isSafeInteger(metrics[key]) && metrics[key] >= 0)
    && metrics.testCount > 0 && metrics.testFiles > 0 && metrics.passed === metrics.testCount && metrics.failed === 0
    && Number.isFinite(metrics.coverage) && metrics.coverage >= 0 && metrics.coverage <= 100;
  const publishCoverage = validMetrics && receipt.targetBranch === 'main' && receipt.nativeWorkflowBranch === 'main'
    && receipt.testedCheckoutSha === receipt.sourceSha && receipt.nativeHeadSha === receipt.sourceSha
    && ((receipt.workflow === '.github/workflows/ci.yml' && receipt.nativeEvent === 'push')
      || (receipt.workflow === '.github/workflows/coverage.yml' && ['push','schedule'].includes(receipt.nativeEvent)))
    && receipt.conclusion === 'success';
  return { ...result, publishCoverage, ...(publishCoverage ? { coverage: {
    ...metrics, sourceCommitSha: receipt.sourceSha, sourceReportedAt: receipt.completedAt, sourceTargetBranch: 'main',
    coverageRunId: receipt.runId, coverageRunAttempt: receipt.attempt, coverageWorkflowRef: receipt.workflowRef,
  } } : {}) };
}
