import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,existsSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {artifactDigest} from './run-paid-voice-local.mjs';
import {spawnSync,spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {managedCallerFixture,assertManagedPreflight,paidVoiceWorkloadFixture} from './test-fixtures/managed-caller.mjs';
import {processIdentity} from './contract-owned-process.mjs';

for(const fault of ['tracking','interrupt','tracking-and-cleanup']){
 test('paid-voice zero-exit '+fault+' failure cannot create success proof',()=>{
  const f=paidVoiceWorkloadFixture(fileURLToPath(new URL('..',import.meta.url)),{settlementFault:fault});
  try{
   const child=spawnSync(process.execPath,[join(f.source,'scripts/run-paid-voice-local.mjs'),'--build-artifact'],{cwd:f.source,env:f.env,encoding:'utf8',timeout:20000});
   assert.equal(child.error,undefined);assert.notEqual(child.status,0,child.stderr);
   const receiptPath=join(f.env.PAID_VOICE_EVIDENCE_DIR,'receipt.json');
   if(fault==='tracking-and-cleanup'){
    assert.match(child.stderr,/settlement receipt failed/,'cleanup failure must preserve original tracking failure');
    assert.match(child.stderr,/fixture cleanup digest failure/,'cleanup diagnostic must also survive');
   }else{
    const receipt=JSON.parse(readFileSync(receiptPath,'utf8'));
    assert.equal(receipt.code,0,'retain original native process status');
    assert.notEqual(receipt.exitCode,0,'supervisor failure must invalidate receipt success');
   }
   assert.equal(existsSync(f.env.PAID_VOICE_BUILD_RECEIPT),false,'failed supervision must not publish an artifact seal');
   if(existsSync(receiptPath))assert.notEqual(JSON.parse(readFileSync(receiptPath,'utf8')).exitCode,0);
  }finally{f.close();}
 });
}

test('paid-voice owner SIGKILL leaves its still-running build durably protected',async()=>{
 const f=paidVoiceWorkloadFixture(fileURLToPath(new URL('..',import.meta.url)),{holdBuild:true});
 let owner,build,ownerExit;
 const waitFor=async(predicate,message)=>{const deadline=Date.now()+8000;while(!predicate()){if(Date.now()>=deadline)throw Error(message);await new Promise(resolve=>setTimeout(resolve,20));}};
 try{
  owner=spawn(process.execPath,[join(f.source,'scripts/run-paid-voice-local.mjs'),'--build-artifact'],{cwd:f.source,env:f.env,stdio:'ignore'});
  ownerExit=new Promise(resolve=>owner.once('exit',resolve));
  await waitFor(()=>existsSync(f.buildReady),'build never published readiness');
  build=JSON.parse(readFileSync(f.buildReady,'utf8'));
  assert.equal(processIdentity(build.pid),build.startedAt,'exact fixture child must be live before owner loss');
  owner.kill('SIGKILL');await ownerExit;
  assert.equal(processIdentity(build.pid),build.startedAt,'killing only owner must leave fixture build alive');
  const entries=Object.values(f.receipt().commandTracking.commands);
  assert.equal(entries.length,1,'owner loss cannot erase or omit the live child command');
  if(entries[0].child){assert.equal(entries[0].child.pid,build.pid);assert.equal(entries[0].child.startedAt,build.startedAt);assert.equal(entries[0].child.pgid,build.pid);}
  else assert.equal(entries[0].state,'launching','owner death in publication gap retains an unresolved intent');
  assert.notEqual(entries[0].owner.pid,build.pid);
 }finally{
  if(owner&&owner.exitCode===null&&owner.signalCode===null){owner.kill('SIGKILL');await ownerExit;}
  if(!build&&existsSync(f.buildReady))build=JSON.parse(readFileSync(f.buildReady,'utf8'));
  if(build){const identity=processIdentity(build.pid);if(identity===build.startedAt){process.kill(build.pid,'SIGTERM');await waitFor(()=>processIdentity(build.pid)===null,'exact fixture build did not settle');}else if(identity!==null)throw Error('Fixture child identity uncertain; retaining '+f.env.HOME);}
  f.close();
 }
});

for(const buildOnly of [true,false]){
 test('paid-voice '+(buildOnly?'build settles its durable command':'browser retains explicit detached-consumer uncertainty'),()=>{
  const f=paidVoiceWorkloadFixture(fileURLToPath(new URL('..',import.meta.url)));
  try{
   const child=spawnSync(process.execPath,[join(f.source,'scripts/run-paid-voice-local.mjs'),...(buildOnly?['--build-artifact']:[])],{
    cwd:f.source,env:{...f.env,...(!buildOnly?{PAID_VOICE_ARTIFACT_MODE:'development'}:{})},encoding:'utf8',timeout:20000,
   });
   assert.equal(child.error,undefined);assert.equal(child.status,0,child.stderr);
   const workload=f.read().find(call=>call.tool===(buildOnly?'npm':'cli.js'));
   assert.ok(workload,'actual runner reached external workload');
   const commands=Object.values(workload.commands);assert.equal(commands.length,1,'workload must observe durable launch intent');
   assert.equal(commands[0].leaseId,workload.leases.find(lease=>lease.purpose==='paid-voice').id);
   assert.equal(commands[0].settlement,buildOnly?'process-group':'explicit-consumer');
   const after=f.receipt();assert.equal(after.leases.length,0);
   if(buildOnly)assert.deepEqual(after.commandTracking.commands,{});
   else{
    const retained=Object.values(after.commandTracking.commands);assert.equal(retained.length,1);
    assert.equal(retained[0].state,'unsettled');assert.match(retained[0].reason,/detached|unproven/);
    assert.match(child.stdout+child.stderr,/retained|unproven/,'normal report success must disclose retained consumer ownership');
   }
  }finally{f.close();}
 });
}

for(const boundary of ['schema','status']){
 test('paid-voice records durable leased '+boundary+' preflight before external execution',()=>{
  const repository=fileURLToPath(new URL('..',import.meta.url));
  const f=managedCallerFixture(repository,boundary);
  try{
   const child=spawnSync(process.execPath,[fileURLToPath(new URL('./run-paid-voice-local.mjs',import.meta.url))],{cwd:repository,env:f.env,encoding:'utf8',timeout:15000});
   assert.equal(child.error,undefined);assert.equal(child.status,1,child.stderr);
   assertManagedPreflight(f,'paid-voice',boundary);
  }finally{f.close();}
 });
}

function fixture(t){
 const root=mkdtempSync(join(tmpdir(),'paid-voice-artifact-test-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 const write=(path,value)=>{const file=join(root,'.next',path);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,value);};
 write('BUILD_ID','original-build');
 write('server/app/page.js','compiled-server');
 write('static/chunks/page.js','compiled-client');
 return {root,write};
}

test('production seal ignores only the Next server runtime route cache',t=>{
 const {root,write}=fixture(t),before=artifactDigest(root);
 write('server/route-cache/APP_PAGE/runtime/pricing.html','runtime-render');
 assert.equal(artifactDigest(root),before);
 write('server/route-cache/APP_PAGE/runtime/pricing.html','updated-runtime-render');
 assert.equal(artifactDigest(root),before);
});

for(const path of ['BUILD_ID','server/app/page.js','static/chunks/page.js','static/route-cache/page.js','server/chunks/route-cache/page.js']){
 test('production seal detects changed compiled artifact '+path,t=>{
  const {root,write}=fixture(t);write(path,'before');const before=artifactDigest(root);
  write(path,'after');assert.notEqual(artifactDigest(root),before);
 });
}

test('production seal rejects a missing BUILD_ID',t=>{
 const {root}=fixture(t);rmSync(join(root,'.next/BUILD_ID'));
 assert.throws(()=>artifactDigest(root),{code:'ENOENT'});
});
