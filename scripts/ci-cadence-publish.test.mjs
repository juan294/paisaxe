import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { publishCompletedCoverage } from './ci-cadence-publish.mjs';
import { fixture,expected,policy,projection,nativeRun,measurement,admission } from '../tests/fixtures/ci-cadence-adapter/native/integration-fixture.mjs';
function measuredMain(){
  const caller='.github/workflows/coverage.yml',identity={...expected,targetBranch:'main'};
  const projected={...projection,workflowPins:{[caller]:'c'.repeat(40),'.github/workflows/ci.yml':'d'.repeat(40)},workflowSources:{[caller]:expected.definitionSha,'.github/workflows/ci.yml':expected.definitionSha}};
  const run={...nativeRun(),path:caller,head_sha:expected.sourceSha,head_branch:'main',event:'push'};
  const f=fixture({run,admit:{...admission(),...identity,workflow:caller,workflowPins:projected.workflowPins},measured:{...measurement(),...identity,workflow:caller,metrics:{testCount:2,testFiles:1,passed:2,failed:0,coverage:100}},override:Object.fromEntries([expected.definitionSha,expected.sourceSha].map(sha=>[`/repos/juan294/paisaxe/contents/${caller}?ref=${sha}`,{type:'file',path:caller,sha:'c'.repeat(40)}]))});
  return{f,input:{expected:identity,policy:{...policy,workflows:[{...policy.workflows[0],path:caller}]},projection:projected,eventName:'workflow_run',event:{repository:run.repository,workflow_run:run}}};
}
test('one signed default-main payload carries original measuring numeric attempt and completion timestamp',async()=>{
  const {f,input}=measuredMain();const sent=[];
  const result=await publishCompletedCoverage(input,{secret:'signing-fixture',token:'fixture-token',fetchImpl:f.fetchImpl,request:async(url,options)=>{sent.push({url,options});return new Response('',{status:200});}});
  assert.equal(result.published,true);assert.equal(sent.length,1);assert.equal(sent[0].url,'https://portfolio.thecreativetoken.com/api/coverage');
  const body=JSON.parse(sent[0].options.body);assert.equal(body.source.attempt,1);assert.equal(body.source.runId,'123');assert.equal(body.source.targetBranch,'main');assert.equal(body.source.reportedAt,'2026-10-02T01:00:00.000Z');
  assert.equal(sent[0].options.headers['X-Coverage-Signature-256'],'sha256='+createHmac('sha256','signing-fixture').update(sent[0].options.body).digest('hex'));
  assert.ok(!sent[0].options.body.includes('signing-fixture'));assert.ok(f.requests.every(row=>row.options.method==='GET'));
});
test('publication failure never retries original immutable measuring attempt',async()=>{
  const {f,input}=measuredMain();let requests=0;
  await assert.rejects(publishCompletedCoverage(input,{secret:'signing-fixture',token:'fixture-token',fetchImpl:f.fetchImpl,request:async()=>{requests++;return new Response('',{status:503});}}));assert.equal(requests,1);
});
test('develop completion and invalid signing authority cannot POST',async()=>{
  const f=fixture(),run=nativeRun();let requests=0;
  for(const secret of ['','bad\nsecret','valid-fixture'])await assert.rejects(publishCompletedCoverage({expected,policy,projection,eventName:'workflow_run',event:{repository:run.repository,workflow_run:run}},{secret,token:'fixture-token',fetchImpl:f.fetchImpl,request:async()=>{requests++;return new Response('',{status:200});}}));
  assert.equal(requests,0);
});
