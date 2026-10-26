import {evaluate,nativeContext} from '../tests/fixtures/ci-cadence-adapter/native/workflow-graph.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';
import { routeOriginalWorkflow } from './ci-cadence-route-originals.mjs';

const retained = JSON.parse(readFileSync(new URL('../tests/fixtures/ci-cadence-adapter/native/routing-originals.json', import.meta.url)));
function original(name) { return parse(routeOriginalWorkflow(retained.files.find(file => file.path.endsWith('/'+name)).source)); }
test('full original application CI has protected route and an actual-child gate', () => {
  const value = original('ci.yml');
  assert.ok(value.jobs['routing']);
  const gate = value.jobs['ci-verification'];
  assert.equal(gate.name, 'CI Verification (CI)');
  assert.match(gate.if, /always\(\)/);
  for (const id of ['lint-and-typecheck','coverage-shard','coverage-merge','test','build']) assert.ok(gate.needs.includes(id), id);
  assert.equal(value.jobs['routing'].permissions.contents, 'read');
  assert.equal(JSON.stringify(value).includes('vars.CI_CADENCE_MODE'), false);
});
test('full original E2E discloses authenticated proof and requires actual visual work', () => {
  const value = original('e2e.yml');
  const gate=value.jobs['ci-verification'];
  assert.ok(gate);
  assert.ok(gate.needs.includes('visual-regression'));
  assert.match(JSON.stringify(gate), /authenticated|withheld/);
});
test('generated full verification join rejects a skipped application child', () => {
  const value=original('ci.yml'),gate=value.jobs['ci-verification'];assert.ok(gate);
  const needs=Object.fromEntries(gate.needs.map(id=>[id,{result:'success',outputs:id==='routing'?{full:'true'}:{}}]));
  const step=gate.steps.find(step=>step.run);
  for (const state of ['skipped','cancelled','failure']) {
    needs.test.result=state;
    const result=spawnSync('/bin/bash',['-e','-o','pipefail','-c',step.run],{env:{...process.env,NEEDS:JSON.stringify(needs),FORCE_FULL:'true'},encoding:'utf8'});
    assert.notEqual(result.status,0,state);
  }
});

test('ordinary fast requires actual four-check success, without legacy admission', () => {
 const job=parse(readFileSync('.github/ci-cadence-fast-job.yml','utf8'));
 const step=job.steps.find(step=>step.id==='entry');
 assert.match(step.run,/completed.*required/);
 assert.doesNotMatch(step.run,/decision='legacy'|decision='full'/);
 const parser=step.run.split("<<'PYTHON'\n")[1].split('\nPYTHON')[0];
 const result=spawnSync('python3',['-c',parser,'/dev/stdin'],{input:JSON.stringify({lane:'full',fullRequired:true,success:false}),encoding:'utf8'});
 assert.notEqual(result.status,0);
});
test('no active workflow reads a hosted cadence mode', () => {
 for(const name of readdirSync('.github/workflows').filter(name=>/\.ya?ml$/.test(name)))
  assert.doesNotMatch(readFileSync('.github/workflows/'+name,'utf8'),/vars\.CI_CADENCE_MODE/,name);
});

test('paid auxiliary review rejects App PRs even when a human reruns them',()=>{
 const v=parse(readFileSync('.github/workflows/claude-review.yml','utf8'));
 assert.match(v.jobs['claude-review'].if,/github.actor_id == '3944118'/);
 assert.match(v.jobs['claude-review'].if,/pull_request.user.id == 3944118/);
 assert.match(v.jobs['claude-review'].if,/head.repo.id == github.event.repository.id/);
 assert.doesNotMatch(v.jobs['claude-review'].if,/triggering_actor/);
 for(const change of [{actor:'sutura[bot]'},{author:'sutura[bot]'},{headRepository:'outsider/paisaxe'}]){
 const c=nativeContext({kind:'pull_request',ref:'refs/pull/7/merge',baseBranch:'develop',...change});
 c.github.triggering_actor='juan294';c.github.event.repository.full_name=c.github.repository;
 c.github.event.pull_request.base.repo={id:1141286326,full_name:c.github.repository};
 c.secrets={ANTHROPIC_API_KEY:'synthetic-withheld'};
 assert.equal(Boolean(evaluate(v.jobs['claude-review'].if,c)),false);
 const key=v.jobs['claude-review'].steps.find(s=>s.uses?.startsWith('anthropics/')).with.anthropic_api_key;
 assert.equal(evaluate(key,c),'');
 }

});

test('paid auxiliary action keeps the configured model through its supported input',()=>{
 const v=parse(readFileSync('.github/workflows/claude-review.yml','utf8'));
 const inputs=v.jobs['claude-review'].steps.find(s=>s.uses?.startsWith('anthropics/')).with;
 assert.equal(inputs.model,undefined);
 assert.equal(inputs.claude_args,'--model claude-sonnet-4-5-20250929');
});

test('managed original application jobs resolve to readonly token permissions',()=>{
 for(const file of retained.files){const v=original(file.path.split('/').at(-1));assert.ok(v.permissions);assert.ok(Object.values(v.permissions).every(x=>x==='read'));
 for(const id of v.jobs['ci-verification'].needs.filter(id=>id!=='routing'))assert.ok(Object.values(v.jobs[id].permissions??v.permissions).every(x=>x==='read'||x==='none'),file.path+'/'+id);
 }
});
