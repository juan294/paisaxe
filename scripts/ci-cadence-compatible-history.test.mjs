import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,realpath,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {buildFullState,admitNightly} from './ci-cadence-control.mjs';
import {decideCompatibleNightly} from './ci-cadence-run.mjs';
import {createGitHubCadenceReader} from './ci-cadence-github.mjs';
import {zip,nativeRun} from '../tests/fixtures/ci-cadence-adapter/native/integration-fixture.mjs';
const repository='https://api.github.com/repos/juan294/paisaxe';
const stamp=minute=>`2026-10-02T01:${String(minute).padStart(2,'0')}:00Z`;
async function fixture(kinds){
 const root=await realpath(await mkdtemp(join(tmpdir(),'B-compatible-native-')));
 const git=(...args)=>execFileSync('git',['-c','user.name=Fixture','-c','user.email=fixture@example.invalid',...args],{cwd:root,encoding:'utf8',timeout:5000}).trim();
 try{
  const catalogue=JSON.parse(await readFile(new URL('../.github/ci-cadence-native.json',import.meta.url)));
  for(const file of ['.github/ci-cadence-native.json','.github/ci-cadence.json','scripts/ci-cadence.mjs','package-lock.json',...Object.keys(catalogue.workflowPins)]){await mkdir(dirname(join(root,file)),{recursive:true});await writeFile(join(root,file),await readFile(new URL('../'+file,import.meta.url)));}
  git('init','--quiet','--template=');git('add','.');git('commit','--quiet','-m','protected current default');const authoritySha=git('rev-parse','HEAD');
  await writeFile(join(root,'ordinary.txt'),'before\n');git('add','.');git('commit','--quiet','-m','protected push before');const before=git('rev-parse','HEAD');
  await writeFile(join(root,'ordinary.txt'),'after\n');git('add','.');git('commit','--quiet','-m','actual integration source');const sourceSha=git('rev-parse','HEAD');
  const runtime={node:process.version,platform:'linux',architecture:'x64'};
  const resolveState=values=>buildFullState({root,authoritySha,runtime,...values});
  const headState=resolveState({definitionSha:authoritySha,sourceSha,runId:999,attempt:1});
  const routes={},runs={'.github/workflows/ci-nightly.yml':[],'.github/workflows/ci-cadence.yml':[]};
  for(const [index,kind]of kinds.entries()){
   const id=123+index,workflow=kind==='push'?'.github/workflows/ci-cadence.yml':'.github/workflows/ci-nightly.yml';
   const definitionSha=kind==='push'?before:authoritySha,measuredSource=kind==='different-source'?before:sourceSha;
   const state=resolveState({definitionSha,sourceSha:measuredSource,runId:id,attempt:1,callerPath:workflow});
   const run={...nativeRun(),id,path:workflow,head_sha:kind==='push'?sourceSha:authoritySha,event:kind==='push'?'push':'schedule',head_branch:kind==='push'?'develop':'main',html_url:`https://github.com/juan294/paisaxe/actions/runs/${id}`,referenced_workflows:state.projection.referencedWorkflows,conclusion:kind==='failed'?'failure':'success'};
   if(kind==='unadmitted-running'){run.status='in_progress';run.conclusion=null;}
   runs[workflow].push(run);routes[`/actions/runs/${id}/attempts/1`]=run;
   for(const[path,pin]of Object.entries(state.projection.workflowPins)){routes[`/contents/${path}?ref=${state.projection.workflowSources[path]}`]={type:'file',path,sha:pin};routes[`/contents/${path}?ref=${run.head_sha}`]={type:'file',path,sha:pin};}
   const makeJob=(number,name,steps,conclusion='success')=>({id:id*100+number,name,run_id:id,run_attempt:1,status:'completed',conclusion,started_at:stamp(0),completed_at:stamp(30),steps:steps.map((s,i)=>({name:typeof s==='string'?s:s.name,number:i+1,status:'completed',conclusion:typeof s==='string'?'success':s.conclusions[0],started_at:stamp(5),completed_at:stamp(10)}))});
   let jobs=[],artifacts=[];
   if(['unchanged-skip','unadmitted-running'].includes(kind)){
    jobs=[makeJob(1,'Cadence admission',['Actual protected skip']),makeJob(2,'Cadence measurement',[],'skipped'),makeJob(3,'Nightly disposition',['Require real full proof or unchanged skip']),makeJob(4,'ci',[],'skipped')];
    run.referenced_workflows=[];
   }else{
    jobs=Object.keys(state.projection.jobs).map((key,i)=>{const names=[...state.projection.steps[key],...state.projection.ignoredSteps[key]];const job=makeJob(i+1,state.projection.jobs[key],names);for(const step of job.steps){if(step.name==='Verify callable source checkout'){step.started_at=stamp(4);step.completed_at=stamp(4);}if(step.name==='Verify completed callable source checkout'){step.started_at=stamp(11);step.completed_at=stamp(11);}}return job;});
    if(kind==='failed'){jobs[0].conclusion='failure';jobs[0].steps.find(s=>state.projection.steps[Object.keys(state.projection.jobs)[0]].includes(s.name)).conclusion='failure';}
    const appJobs=[...jobs],admissionJob=makeJob(50,'Cadence admission',[state.projection.admissionStep]);admissionJob.steps[0].started_at=stamp(1);admissionJob.steps[0].completed_at=stamp(2);
    const measurementJob=makeJob(51,'Cadence measurement',[state.projection.measurementStep]);measurementJob.steps[0].started_at=stamp(20);measurementJob.steps[0].completed_at=stamp(25);
    jobs.push(admissionJob,measurementJob,...state.projection.census.auxiliaryJobs.map((j,i)=>makeJob(60+i,j.name,j.steps,j.conclusions[0])));
    const admit={schemaVersion:1,kind:'ci-cadence-admission',...state.expected,runId:id,attempt:1,workflow,testedCheckoutSha:measuredSource,lane:kind==='push'?'full':'nightly',workflowDefinitionSha:state.policy.workflows[0].definitionSha,workflowPins:state.projection.workflowPins,jobs:state.policy.workflows[0].jobs,contexts:state.policy.workflows[0].contexts};
    const measured={schemaVersion:1,kind:'ci-cadence-measurement',...state.expected,runId:id,attempt:1,workflow,failing:0,checkouts:Object.fromEntries(appJobs.map(j=>[j.id,measuredSource]))};
    for(const [n,name,value,filename,created]of [[1,'ci-cadence-admission',admit,'admission.json',stamp(1)],[2,'ci-cadence-measurement',measured,'measurement.json',stamp(22)]]){const artifactId=id*1000+n,bytes=zip(value,filename),artifact={id:artifactId,name,expired:false,size_in_bytes:bytes.length,digest:'sha256:'+createHash('sha256').update(bytes).digest('hex'),workflow_run:{id,head_repository_id:1141286326,head_sha:run.head_sha},created_at:created};artifacts.push(artifact);routes[`/actions/artifacts/${artifactId}`]=artifact;routes[`/actions/artifacts/${artifactId}/zip`]=bytes;}
   }
   routes[`/actions/runs/${id}/attempts/1/jobs?per_page=100&page=1`]={total_count:jobs.length,jobs};routes[`/actions/runs/${id}/artifacts?per_page=100&page=1`]={total_count:artifacts.length,artifacts};
  }
  for(const [workflow,list]of Object.entries(runs))routes[`/actions/workflows/${workflow.split('/').at(-1)}/runs?per_page=100&page=1`]={total_count:list.length,workflow_runs:list};
  const requests=[],fetchImpl=async(url,options)=>{requests.push({url,options});const key=url.slice(repository.length);return new Response(Buffer.isBuffer(routes[key])?routes[key]:JSON.stringify(routes[key]),{status:key in routes?200:404,headers:{'x-ratelimit-remaining':'5000'}});};
  return{root,authoritySha,sourceSha,headState,resolveState,fetchImpl,requests,close:()=>rm(root,{recursive:true,force:true})};
 }catch(error){await rm(root,{recursive:true,force:true});throw error;}
}
for(const [kinds,action]of [[['nightly'],'skip'],[['push'],'skip'],[['different-source','nightly'],'skip'],[['unchanged-skip'],'full'],[['failed'],'blocked'],[['unadmitted-running'],'full']])test('actual Git/HTTP/ZIP compatible original provenance '+kinds.join(','),async()=>{
 const f=await fixture(kinds);try{const result=await decideCompatibleNightly(f.headState,{resolveState:f.resolveState,token:'fixture-only',fetchImpl:f.fetchImpl,now:()=>new Date('2026-10-02T03:00:00Z')});assert.equal(result.action,action,JSON.stringify(result.history));assert.equal(result.publishCoverage,false);if(kinds.includes('unadmitted-running')){assert.equal(result.history.available,false);assert.match(result.reason,/history unavailable.*full fallback/);}assert.ok(f.requests.every(r=>r.options.method==='GET'));if(kinds.includes('push'))assert.equal(result.history.entries[0].receipt.workflow,'.github/workflows/ci-cadence.yml');}finally{await f.close();}
});
test('compatible collector missing trusted resolver blocks before HTTP',async()=>{const reader=createGitHubCadenceReader({token:'fixture-only',fetchImpl:()=>{throw Error('must not request');}});assert.equal((await reader.collectCompatibleHistory({head:{sourceSha:'a'.repeat(40),definitionSha:'b'.repeat(40)}})).available,false);});

test('actual protected admission handoff preserves unavailable-history full fallback warning',async()=>{
 const f=await fixture(['unadmitted-running']);
 try{
  const result=await admitNightly(f.headState,{resolveState:f.resolveState,token:'fixture-only',fetchImpl:f.fetchImpl,now:()=>new Date('2026-10-02T03:00:00Z')});
  assert.equal(result.decision.action,'full');assert.match(result.decision.reason,/history unavailable.*full fallback/);
  const module=await import('./ci-cadence-control.mjs');assert.equal(typeof module.admissionDisposition,'function');
  const output=module.admissionDisposition(result);assert.equal(output.action,'full');assert.match(output.reason,/history unavailable.*full fallback/);assert.equal(output.publishCoverage,false);
 }finally{await f.close();}
});
