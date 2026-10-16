import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { routeOriginalWorkflow } from './ci-cadence-route-originals.mjs';
import { evaluate, nativeContext } from '../tests/fixtures/ci-cadence-adapter/native/workflow-graph.mjs';
const retained=JSON.parse(readFileSync(new URL('../tests/fixtures/ci-cadence-adapter/native/routing-originals.json',import.meta.url))).files;
const source=()=>retained.find(file=>file.path==='.github/workflows/knip.yml').source;
const select=(job,event,mode)=>Boolean(evaluate(job.if,{...nativeContext(event,mode),needs:{routing:{result:'success',outputs:{full:'true',reason:'application'}}}}));
test('routing adds protected planning and keeps exact canonical app step bodies',()=>{
 for(const file of retained){
  const original=parse(file.source),routed=parse(routeOriginalWorkflow(file.source));
  assert.equal(routed.jobs['cadence-route'],undefined,file.path);assert.ok(!JSON.stringify(routed).includes('run_legacy'),file.path);
  assert.ok(routed.jobs.routing);assert.ok(routed.jobs['ci-verification']);
  for(const[id,job]of Object.entries(original.jobs))if(!['develop_push_source','callable-source','callable-full'].includes(id))assert.ok(routed.jobs[id].needs.includes('routing'),file.path+':'+id);
  assert.equal(readFileSync(new URL('../'+file.path,import.meta.url),'utf8'),routeOriginalWorkflow(file.source),file.path);
 }
 assert.deepEqual(parse(routeOriginalWorkflow(source())).jobs.knip.steps,parse(source()).jobs.knip.steps);
});
test('original work runs for every non-reducible event and stands down only for lean owner integration events',()=>{
 const job=parse(routeOriginalWorkflow(source())).jobs.knip,push={kind:'push',ref:'refs/heads/develop'},pull={kind:'pull_request',ref:'refs/pull/7/merge',baseBranch:'develop'};
 for(const[label,event,mode]of [['legacy push',push,'legacy'],['unset mode',push,undefined],['near-miss mode',push,'leaner'],['padded mode',push,'lean '],['outsider push',{...push,actor:'outsider'},'lean'],['bot PR',{...pull,actor:'dependabot[bot]'},'lean'],['fork PR',{...pull,headRepository:'outsider/paisaxe'},'lean'],['other author PR',{...pull,author:'outsider'},'lean'],['production push',{kind:'push',ref:'refs/heads/main'},'lean'],['production PR',{...pull,baseBranch:'main'},'lean'],['manual',{kind:'workflow_dispatch',ref:'refs/heads/develop'},'lean']])assert.equal(select(job,event,mode),true,label);
 for(const mode of ['lean','legacy',undefined])for(const event of [push,pull]){
  const context={...nativeContext(event,mode),needs:{routing:{result:'success',outputs:{full:'false',reason:'ordinary-owner-integration'}}}};
  assert.equal(Boolean(evaluate(job.if,context)),false);
 }
});
