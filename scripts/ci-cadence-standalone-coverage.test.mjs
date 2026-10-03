import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createGitHubCadenceReader} from './ci-cadence-github.mjs';
import {nativeRun,zip} from '../tests/fixtures/ci-cadence-adapter/native/integration-fixture.mjs';
const sourceSha='a'.repeat(40),workflowPin='b'.repeat(40),path='.github/workflows/coverage.yml';
const stepInventory=['Verify callable source checkout','Run authoritative coverage suite','Verify completed callable source checkout','Produce measured standalone coverage','Upload measured standalone coverage','Report coverage to Portfolio'].map(name=>({name,conclusions:name==='Report coverage to Portfolio'?['skipped']:['success']}));
function fixture(fault){
 const run={...nativeRun(),path,head_sha:sourceSha,head_branch:'main',event:'push',referenced_workflows:[]};
 const intervals=[['00:30','00:30'],['00:30','01:00'],['01:00','01:00'],['01:00','01:01'],['01:02','01:04'],['01:04','01:04']];
 const stamp=time=>'2026-10-02T'+time+':00Z';
 const job={id:1,name:'Coverage report',run_id:123,run_attempt:1,status:'completed',conclusion:'success',started_at:stamp('00:30'),completed_at:stamp('01:04'),steps:stepInventory.map((s,i)=>({name:s.name,number:i+1,status:'completed',conclusion:s.conclusions[0],started_at:stamp(intervals[i][0]),completed_at:stamp(intervals[i][1])}))};
 const value={metrics:{testCount:2,testFiles:1,passed:2,failed:0,coverage:100},evidence:{candidateSha:sourceSha,treeSha:'c'.repeat(40),nodeVersion:'v24.21.0',architecture:'x64',platform:'linux',...Object.fromEntries(['testsSha256','coverageSha256','exitSha256'].map(k=>[k,'d'.repeat(64)]))}};
 if(fault==='failed-parent')run.conclusion='failure';
 if(fault==='nonowner')run.actor.id=7;
 if(fault==='failed-suite')job.steps[1].conclusion='failure';
 if(fault==='missing-final')job.steps.splice(2,1);
 if(fault==='wrong-attempt')job.run_attempt=2;
 if(fault==='bad-metrics')value.metrics.passed=1;
 if(fault==='early-upload'){job.steps[4].started_at=stamp('00:50');job.steps[4].completed_at=stamp('00:59');}
 const bytes=zip(value,'application.json');
 const artifact={id:10,name:'ci-cadence-coverage',expired:false,size_in_bytes:bytes.length,digest:'sha256:'+createHash('sha256').update(bytes).digest('hex'),workflow_run:{id:123,head_repository_id:run.head_repository.id,head_sha:run.head_sha},created_at:stamp('01:03')};
 if(fault==='digest')artifact.digest='sha256:'+'0'.repeat(64);
 const jobs=fault==='duplicate-job'?[job,{...job,id:2}]:[job];
 const artifacts=fault==='duplicate-artifact'?[artifact,{...artifact,id:11}]:[artifact];
 const routes={
 '/actions/runs/123/attempts/1':run,
 ['/contents/'+path+'?ref='+sourceSha]:{type:'file',path,sha:fault==='changed-root'?'e'.repeat(40):workflowPin},
 '/actions/runs/123/attempts/1/jobs?per_page=100&page=1':{total_count:jobs.length,jobs},
 '/actions/runs/123/artifacts?per_page=100&page=1':{total_count:artifacts.length,artifacts},
 '/actions/artifacts/10':artifact,'/actions/artifacts/10/zip':bytes,
 };
 const requests=[];
 const fetchImpl=async(url,options)=>{requests.push({url,options});const key=url.slice('https://api.github.com/repos/juan294/paisaxe'.length);return new Response(Buffer.isBuffer(routes[key])?routes[key]:JSON.stringify(routes[key]),{status:key in routes?200:404,headers:{'x-ratelimit-remaining':'5000'}});};
 return{reader:createGitHubCadenceReader({token:'external-fixture-only',fetchImpl,now:()=>new Date('2026-10-03T00:00:00Z')}),requests};
}
for(const fault of ['none','failed-parent','nonowner','failed-suite','missing-final','wrong-attempt','bad-metrics','early-upload','digest','duplicate-job','duplicate-artifact','changed-root'])test('actual standalone original HTTP/ZIP completion '+fault,async()=>{
 const f=fixture(fault),result=await f.reader.readStandaloneCoverage({runId:123,attempt:1,sourceSha,workflowPin,stepInventory});
 assert.equal(result.available,fault==='none',result.error);
 assert.equal(result.receipt,undefined);
 if(fault==='none'){assert.equal(result.scope,'coverage-only');assert.equal(result.reusable,false);assert.equal(result.coverage.coverageRunAttempt,1);assert.equal(result.coverage.sourceReportedAt,'2026-10-02T01:00:00.000Z');}
 assert.ok(f.requests.every(r=>r.options.method==='GET'));
});
