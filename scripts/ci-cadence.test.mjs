import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { activationStatus, cancellationPolicy, chooseNightly, classifyEvent, validateExecutionGraph, validateFixtures, validatePolicy, validateReceipt } from './ci-cadence.mjs';
const dir = new URL('../tests/fixtures/ci-cadence/', import.meta.url);
const load = async name => JSON.parse(await readFile(new URL(`${name}.json`, dir), 'utf8'));
const [policy, events, history, graph] = await Promise.all(['policy', 'events', 'history', 'graph'].map(load));
const clone = value => structuredClone(value);
const receipt = history.receipts[0];
const expected = history.head;
const trusted = events.cases[0].trustedDefinition;
const now = history.now;
test('legacy/missing helper schedules cannot execute or reuse new nightly', () => {
  const scheduled = events.cases.find(c => c.event.kind === 'schedule');
  assert.equal(classifyEvent(scheduled.event, policy, 'legacy', scheduled.trustedDefinition).lane, 'blocked');
  assert.equal(classifyEvent(scheduled.event, policy, 'lean', {...scheduled.trustedDefinition, helperInstalled:false}).lane, 'blocked');
});
test('unknown default topology and cross-workflow job collisions are invalid', () => {
  assert.equal(validatePolicy({...policy,defaultBranch:'unknown'}).valid,false);
  const changed=clone(policy); changed.workflows.push({...changed.workflows[0],path:'.github/workflows/other.yml'});
  assert.equal(validatePolicy(changed).valid,false);
});
test('partial history never reuses success', () => {
  assert.equal(chooseNightly(expected,{...history,complete:false,error:'pagination failed'},now,policy).action,'full');
});
test('partial history preserves known failure and cancelled identity blocks automatic execution', () => {
  for(const conclusion of ['failure','cancelled']) {
    const failed={...receipt,conclusion,completedAt:'2026-10-01T02:00:00Z'};
    assert.equal(chooseNightly(expected,{complete:false,error:'later page unavailable',receipts:[failed]},now,policy).action,'blocked');
    assert.equal(chooseNightly(expected,{complete:false,receipts:[failed]},now,policy,{retry:{authorized:true,sourceSha:expected.sourceSha,failedRunId:failed.runId,maxAttempts:2}}).action,'blocked');
  }
});
test('malformed receipt workflow gets a diagnostic instead of throwing', () => {
  assert.equal(validateReceipt({...receipt,nativeEvent:'pull_request',workflow:12},expected,policy).valid,false);
});
test('fast graphs reject unexpected application work', () => {
  const classification=classifyEvent(events.cases[0].event,policy,'lean',trusted);
  const fast={schemaVersion:1,sourceSha:classification.sourceSha,targetBranch:classification.targetBranch,definitionSha:classification.definitionSha,jobs:{'application-install':{result:'success',needs:[]}},contexts:{'CI Fast':'success'},fastWork:classification.fastWork};
  assert.equal(validateExecutionGraph(fast,classification,policy).valid,false);
});
test('malformed refs return a blocked field diagnostic', () => {
  assert.equal(classifyEvent({...events.cases[0].event,ref:12},policy,'lean',trusted).lane,'blocked');
});
test('event-kind fields cannot change push target or tested identity', () => {
  const event=events.cases[0].event;
  assert.equal(classifyEvent({...event,baseBranch:'main'},policy,'lean',trusted).lane,'blocked');
  assert.equal(classifyEvent({...event,headSha:'f'.repeat(40)},policy,'lean',trusted).lane,'blocked');
});
test('native measuring provenance and per-workflow receipts are mandatory', () => {
  for(const override of [{nativeEvent:'workflow_dispatch'},{nativeWorkflowBranch:'other'},{nativeHeadSha:'f'.repeat(40)},{workflowRef:'example/fleet-A/.github/workflows/ci.yml@refs/pull/9/merge'}]) assert.equal(validateReceipt({...receipt,...override},expected,policy).valid,false);
  const multi=clone(policy); multi.workflows.push({...multi.workflows[0],path:'.github/workflows/other.yml',jobs:[{id:'other_test',needs:[]}],contexts:{'other check':['other_test']}});
  const apparent=clone(receipt); apparent.jobs.other_test={result:'success',needs:[]}; apparent.contexts['other check']='success';
  assert.equal(validateReceipt(apparent,expected,multi).valid,false);
});
test('default-main scheduled receipt binds both native definition and actual develop checkout', () => {
  const scheduled={...receipt,nativeEvent:'schedule',nativeHeadSha:receipt.definitionSha,nativeWorkflowBranch:policy.defaultBranch,testedCheckoutSha:receipt.sourceSha,workflowRef:`${policy.repository}/${receipt.workflow}@refs/heads/${policy.defaultBranch}`};
  assert.equal(validateReceipt(scheduled,expected,policy).valid,true);
  assert.equal(chooseNightly(expected,{complete:true,receipts:[scheduled]},now,policy).action,'skip');
  assert.equal(validateReceipt({...scheduled,testedCheckoutSha:receipt.definitionSha},expected,policy).valid,false);
});
test('delayed aggregate receipt cannot refresh actual child measurement time', () => {
  const multi=clone(policy);multi.workflows.push({...multi.workflows[0],path:'.github/workflows/other.yml',jobs:[{id:'other_test',needs:[]}],contexts:{'other check':['other_test']}});
  const other={...receipt,workflow:'.github/workflows/other.yml',workflowRef:`${policy.repository}/.github/workflows/other.yml@refs/heads/develop`,runId:124,runUrl:`https://github.com/${policy.repository}/actions/runs/124`,jobs:{other_test:{result:'success',needs:[]}},contexts:{'other check':'success'}};
  const aggregate={...receipt,completedAt:'2026-10-02T00:00:00Z',suites:{[receipt.workflow]:receipt,[other.workflow]:other}};
  assert.equal(validateReceipt(aggregate,expected,multi).valid,false);
  assert.equal(validateReceipt({...aggregate,completedAt:receipt.completedAt},expected,multi).valid,true);
});
test('fast graphs require successful real bounded jobs and array work inventory', () => {
  const classification=classifyEvent(events.cases[0].event,policy,'lean',trusted);
  const fast={...graph,targetBranch:'develop',contexts:{'CI Fast':'success'},jobs:null};
  assert.equal(validateExecutionGraph(fast,classification,policy).valid,false);
  fast.jobs=Object.fromEntries(classification.fastWork.map(id=>[id,{result:'success',needs:[]} ]));
  fast.fastWork=classification.fastWork.join(' ');
  assert.equal(validateExecutionGraph(fast,classification,policy).valid,false);
});
test('policy validation names bad fields and corrected policy recovers', () => {
  assert.equal(validatePolicy(policy).valid, true);
  for (const [field, value] of [['schemaVersion', 2], ['owners', []], ['integrationBranch', 'refs/heads/develop'], ['refreshHours', 0], ['coverageMaxAgeHours', 1], ['workflows', []]]) {
    const result = validatePolicy({ ...policy, [field]: value });
    assert.equal(result.valid, false, field);
    assert.match(result.errors.join(' '), new RegExp(field));
  }
  assert.equal(classifyEvent(events.cases[0].event, {...policy, owners: []}, 'lean', trusted).lane, 'blocked');
});
for (const fixture of events.cases) test(`event: ${fixture.name}`, () => {
  const result = classifyEvent(fixture.event, policy, fixture.mode, fixture.trustedDefinition);
  assert.equal(result.lane, fixture.expectedLane);
  assert.equal(result.definitionSha, fixture.trustedDefinition.sha);
  if (result.lane === 'fast') assert.equal(result.requiredFastCheck, 'CI Fast');
  if (['fast', 'nightly', 'untrusted'].includes(result.lane)) {
    assert.equal(result.allowPrivileged, false);
    assert.equal(result.allowDeploy, false);
  }
});
test('master production PR/push execute release', () => {
  const master = {...policy, productionBranch: 'master', defaultBranch: 'master'};
  assert.equal(classifyEvent({...events.cases[1].event, baseBranch:'master'}, master, 'lean', {...trusted, branch:'master'}).lane, 'release');
  assert.equal(classifyEvent({...events.cases[0].event, ref:'refs/heads/master'}, master, 'lean', {...trusted, branch:'master'}).lane, 'release');
});
test('candidate policy edits cannot select owner or trusted definition', () => {
  const malicious = {...events.cases[1].event, author:'someone', candidatePolicy:{owners:['someone']}, definitionSha:'e'.repeat(40)};
  assert.equal(classifyEvent(malicious, policy, 'lean', trusted).lane, 'untrusted');
  assert.equal(classifyEvent(events.cases[0].event, policy, 'lean', {...trusted, branch:'feature'}).lane, 'blocked');
  assert.equal(classifyEvent(events.cases[0].event, policy, 'lean', {...trusted, repository:'other/repo'}).lane, 'blocked');
});
test('untrusted production PR retains release requirement but no credentials', () => {
  const result=classifyEvent({...events.cases[1].event, baseBranch:'main', headRepository:'other/fork'}, policy, 'lean', trusted);
  assert.equal(result.lane,'untrusted');
  assert.equal(result.releaseRequired,true);
  assert.equal(result.acceptanceBlocked,true);
});
test('approved E candidate marker is exact and owner-only', () => {
  const event=events.cases[0].event;
  assert.equal(classifyEvent(event,policy,'lean',{...trusted,releaseCandidateSha:event.sourceSha}).lane,'release');
  assert.equal(classifyEvent(event,policy,'lean',{...trusted,releaseCandidateSha:'f'.repeat(40)}).lane,'fast');
  assert.equal(classifyEvent({...event,author:'dependabot[bot]'},policy,'lean',{...trusted,releaseCandidateSha:event.sourceSha}).lane,'untrusted');
});
test('full receipts bind every immutable identity and all children', () => {
  assert.equal(validateReceipt(receipt, expected, policy).valid,true);
  for(const field of ['sourceSha','baseSha','repository','targetBranch','definitionSha','policyFingerprint','lockfileFingerprint','runtimeFingerprint']) {
    const result=validateReceipt({...receipt,[field]:'wrong'},expected,policy);
    assert.equal(result.valid,false,field);
    assert.match(result.errors.join(' '),new RegExp(field));
  }
  for(const result of ['skipped','failure','cancelled','pending']) {
    const changed=clone(receipt); changed.jobs.test.result=result;
    assert.equal(validateReceipt(changed,expected,policy).valid,false,result);
  }
  assert.equal(validateReceipt({...receipt,lane:'fast'},expected,policy).valid,false);
  assert.equal(validateReceipt({...receipt,workflowDefinitionSha:'f'.repeat(40)},expected,policy).valid,false);
});
test('receipt temporal provenance is immutable and future receipts cannot skip', () => {
  assert.equal(validateReceipt({...receipt,completedAt:'tomorrow'},expected,policy).valid,false);
  assert.equal(validateReceipt({...receipt,runId:0},expected,policy).valid,false);
  assert.equal(chooseNightly(expected,{receipts:[{...receipt,completedAt:'2026-10-03T01:00:00Z'}]},now,policy).action,'full');
});
test('dependency graph and context inventory are required', () => {
  const changed=clone(receipt); changed.jobs.build.needs=[];
  assert.equal(validateReceipt(changed,expected,policy).valid,false);
  const missing=clone(receipt); delete missing.contexts.check;
  assert.equal(validateReceipt(missing,expected,policy).valid,false);
});
test('nightly reuses matching success without refreshing time', () => {
  const result=chooseNightly(expected,history,now,policy);
  assert.equal(result.action,'skip');
  assert.equal(result.completedAt,receipt.completedAt);
  assert.equal(result.publishCoverage,false);
});
test('nightly executes changed, missing, invalid, expired, API-failed history', () => {
  for(const [head, records, clock] of [[{...expected,sourceSha:'f'.repeat(40)},history,now],[expected,{receipts:[]},now],[expected,{receipts:[{...receipt,lane:'fast'}]},now],[expected,history,'2026-10-08T01:00:00Z'],[expected,{available:false,error:'API unavailable'},now]]) {
    assert.equal(chooseNightly(head,records,clock,policy).action,'full');
  }
  assert.match(chooseNightly(expected,{available:false,error:'API unavailable'},now,policy).reason,/API unavailable/);
});
test('known failed identity blocks with link, changed identity recovers', () => {
  const failed={...receipt,conclusion:'failure',completedAt:'2026-10-01T02:00:00Z',jobs:{...receipt.jobs,test:{result:'failure',needs:['lint']}}};
  const records={complete:true,receipts:[receipt,failed]};
  const result=chooseNightly(expected,records,now,policy);
  assert.equal(result.action,'blocked');
  assert.equal(result.runUrl,receipt.runUrl);
  assert.match(result.reason,/previous full suite failed/);
  assert.equal(chooseNightly({...expected,sourceSha:'f'.repeat(40)},records,now,policy).action,'full');
  const retry={retry:{authorized:true,sourceSha:expected.sourceSha,failedRunId:123,maxAttempts:2}};
  assert.equal(chooseNightly(expected,records,now,policy,retry).action,'full');
  assert.equal(chooseNightly(expected,{complete:true,receipts:[{...failed,attempt:2}]},now,policy,retry).action,'blocked');
  assert.equal(chooseNightly(expected,records,now,policy,{retry:{...retry.retry,authorized:false}}).action,'blocked');
});
test('checkout mismatch blocks nightly rather than publishing definition SHA', () => {
  assert.equal(chooseNightly(expected,history,now,policy,{checkoutSha:trusted.sha}).action,'blocked');
});
test('activation requires actual default-branch definitions and fast context before lean', () => {
  const installation={repository:policy.repository,branch:'main',definitionSha:trusted.sha,helperInstalled:true,fastCheckProduced:true,rulesMigrated:true,consumerCompatible:true,repairDefaultOff:true,fastCheck:{repository:policy.repository,definitionSha:trusted.sha,sourceSha:expected.sourceSha,context:'CI Fast',conclusion:'success',runId:9}};
  assert.equal(activationStatus(policy,installation).ready,true);
  for(const override of [{branch:'develop'},{helperInstalled:false},{fastCheckProduced:false},{rulesMigrated:false}]) assert.equal(activationStatus(policy,{...installation,...override}).ready,false);
});
test('cancellation separates nightly, fast and release, release never cancels', () => {
  const identity={repository:policy.repository,targetBranch:'develop',sourceSha:expected.sourceSha};
  const groups=['fast','nightly','release'].map(lane=>cancellationPolicy(lane,identity));
  assert.equal(new Set(groups.map(value=>value.group)).size,3);
  assert.equal(groups[2].cancelInProgress,false);
});
test('graph mutations reject skipped release child, definition coverage and routine full shard', () => {
  const release=classifyEvent(events.cases[6].event,policy,'lean',trusted);
  assert.equal(validateExecutionGraph(graph,release,policy).valid,true);
  const skipped=clone(graph); skipped.jobs.test.result='skipped';
  assert.equal(validateExecutionGraph(skipped,release,policy).valid,false);
  assert.equal(validateExecutionGraph({...graph,sourceSha:trusted.sha},release,policy).valid,false);
  const fast=classifyEvent(events.cases[0].event,policy,'lean',trusted);
  assert.equal(validateExecutionGraph({...graph,targetBranch:'develop',contexts:{'CI Fast':'success'},jobs:Object.fromEntries(fast.fastWork.map(id=>[id,{result:'success',needs:[]}]))},fast,policy).valid,true);
  assert.equal(validateExecutionGraph(graph,fast,policy).valid,false);
  assert.equal(validateExecutionGraph({...graph,privileged:true},classifyEvent(events.cases.find(fixture=>fixture.name==='fork').event,policy,'lean',trusted),policy).valid,false);
});
test('versioned fixtures execute through validator', async () => {
  assert.equal((await validateFixtures(dir)).valid,true);
});
