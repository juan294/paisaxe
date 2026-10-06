import test from 'node:test';
import assert from 'node:assert/strict';
import { admitNightly, buildFullState } from './ci-cadence-control.mjs';
import { fixture, expected, policy, projection } from '../tests/fixtures/ci-cadence-adapter/native/integration-fixture.mjs';
const state=()=>({expected,policy,projection,workflow:policy.workflows[0].path,runId:124,attempt:1});
test('actual native reader and frozen chooser skip recent complete history without creating admission',async()=>{
  const f=fixture();const result=await admitNightly(state(),{token:'fixture-token',fetchImpl:f.fetchImpl,now:()=>new Date('2026-10-02T03:00:00Z')});
  assert.equal(result.decision.action,'skip');assert.equal(result.admission,null);
});
test('invalid immutable native control identity blocks before Git',()=>{
  for(const key of ['sourceSha','definitionSha','authoritySha'])assert.throws(()=>buildFullState({root:'/missing-owned-fixture',definitionSha:'a'.repeat(40),sourceSha:'b'.repeat(40),authoritySha:'a'.repeat(40),runId:1,attempt:1,[key]:'bad'}));
});
