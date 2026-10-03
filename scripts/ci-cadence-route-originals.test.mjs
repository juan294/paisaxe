import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { parse } from 'yaml';
import vm from 'node:vm';
import { routeOriginalWorkflow } from './ci-cadence-route-originals.mjs';
import { launchFixture } from '../tests/fixtures/ci-cadence-adapter/native/launch-fixture.mjs';
import { user } from '../tests/fixtures/ci-cadence-adapter/native/fixture.mjs';
const nativePin=createHash('sha256').update(readFileSync(new URL('./ci-cadence-native.mjs',import.meta.url))).digest('hex');
const originalSource=JSON.parse(readFileSync(new URL('../tests/fixtures/ci-cadence-adapter/native/routing-originals.json',import.meta.url))).files.find(file=>file.path==='.github/workflows/knip.yml').source;
const source=()=>originalSource;
function evaluate(expression,context){return vm.runInNewContext(expression.replace(/^\$\{\{\s*|\s*\}\}$/g,'').replace(/needs\.([A-Za-z][A-Za-z0-9_-]*)/g,(_,id)=>`needs[${JSON.stringify(id)}]`),{...context,always:()=>true,success:()=>true,failure:()=>false,cancelled:()=>false},{timeout:100});}
test('actual original workflow has protected routing instead of unconditionally duplicating lean app work',()=>{
 const actual=parse(readFileSync(new URL('../.github/workflows/knip.yml',import.meta.url),'utf8'));assert.ok(actual.jobs['cadence-route']);
});
test('routing preserves exact canonical app step bodies and defaults full for every non-reducible event',()=>{
 const original=parse(source());
 const routed=parse(routeOriginalWorkflow(source(),nativePin));assert.deepEqual(routed.jobs.knip.steps,original.jobs.knip.steps);
 for(const [label,mode,actor,event]of [['legacy','legacy','3944118','push'],['outsider','lean','999','push'],['production','lean','3944118','push'],['schedule','lean','3944118','schedule']]){
  const c={vars:{CI_CADENCE_MODE:mode},github:{repository_id:'1141286326',repository_owner_id:'3944118',actor_id:actor,event_name:event,ref:label==='production'?'refs/heads/main':'refs/heads/develop',event:{sender:{type:'User'}}},needs:{'cadence-route':{outputs:{run_legacy:''}}}};
  assert.equal(evaluate(routed.jobs.knip.if,c),true,label);assert.equal(evaluate(routed.jobs['cadence-route'].if,c),false,label);
 }
});
for(const kind of ['installed','absent','partial','outsider','bot','fork','production'])test('real protected routing shell '+kind+' never imports hostile candidate module',async()=>{
 const f=await launchFixture();try{
  const x=await f.prepare(kind==='fork'?'pull_request':'push',{definition:kind==='absent'?f.absent:kind==='partial'?f.partial:f.definition,sender:kind==='outsider'?user('outsider'):kind==='bot'?user('renovate[bot]'):user(),fork:kind==='fork',mutate:async({put})=>put('scripts/ci-cadence-native.mjs','import {writeFileSync} from "node:fs";writeFileSync("candidate-imported","bad");')});
  f.git('update-ref','refs/remotes/origin/develop',kind==='fork'?x.base:x.source);
  if(kind==='production'){x.input.event.ref='refs/heads/main';x.input.context.ref='refs/heads/main';f.git('update-ref','refs/remotes/origin/main',x.source);}
  const script=parse(routeOriginalWorkflow(source(),nativePin)).jobs['cadence-route'].steps.at(-1).run;
  const event=join(f.root,'native-event.json'),output=join(f.root,'native-output');writeFileSync(event,JSON.stringify(x.input.event));
  const result=spawnSync('/bin/bash',['-c',script],{cwd:f.root,encoding:'utf8',timeout:10000,env:{PATH:process.env.PATH,HOME:process.env.HOME,GITHUB_EVENT_PATH:event,GITHUB_OUTPUT:output,CI_CADENCE_MODE:'lean',GITHUB_REPOSITORY:'juan294/paisaxe',GITHUB_REPOSITORY_ID:'1141286326',GITHUB_REPOSITORY_OWNER_ID:'3944118',GITHUB_EVENT_NAME:x.input.eventName,GITHUB_ACTOR:x.input.actor,GITHUB_ACTOR_ID:String(x.input.context.actorId),GITHUB_SHA:x.input.context.sha,GITHUB_REF:x.input.context.ref}});
  assert.equal(result.status,0,result.stderr);assert.equal(readFileSync(output,'utf8'),'run_legacy='+String(kind!=='installed')+'\n');assert.equal(existsSync(join(f.root,'candidate-imported')),false);
 }finally{await f.close();}
});

test('legacy scheduled app work is suppressed only under lean installed protected routing',()=>{
 const routed=parse(routeOriginalWorkflow(source(),nativePin));
 const c={vars:{CI_CADENCE_MODE:'lean'},github:{repository_id:'1141286326',repository_owner_id:'3944118',actor_id:'3944118',event_name:'schedule',ref:'refs/heads/main',event:{sender:{type:'User'}}},needs:{'cadence-route':{outputs:{run_legacy:'false'}}}};
 assert.equal(evaluate(routed.jobs['cadence-route'].if,c),true);
 assert.equal(evaluate(routed.jobs.knip.if,c),false);
 c.vars.CI_CADENCE_MODE='legacy';assert.equal(evaluate(routed.jobs.knip.if,c),true);
});
