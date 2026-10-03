// Actual emitted-shell and native-reader regressions for the independent findings.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, chmodSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync, execFileSync } from 'node:child_process';
import vm from 'node:vm';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const require=createRequire(join(root,'package.json'));
const {parse}=require('yaml');
const workflow=name=>parse(readFileSync(join(root,'.github/workflows',name),'utf8'));
const {admitNightly,admissionDisposition}=await import(join(root,'scripts/ci-cadence-control.mjs'));
const {fixture,expected,policy,projection,nativeRun,nativeJob}=await import(join(root,'tests/fixtures/ci-cadence-adapter/native/integration-fixture.mjs'));

test('B-COMP-1 genuine native HTTP/ZIP reader/frozen skip keeps original disclosure',async()=>{
 const f=fixture();
 const result=await admitNightly({expected,policy,projection,workflow:policy.workflows[0].path,runId:124,attempt:1},{token:'fixture-token',fetchImpl:f.fetchImpl,now:()=>new Date('2026-10-02T03:00:00Z')});
 assert.equal(result.decision.action,'skip');assert.equal(result.admission,null);
 const output=admissionDisposition(result);
 for(const field of ['sourceSha','targetBranch','runId','attempt','completedAt','runUrl'])assert.equal(output[field],result.decision[field],field);
 assert.equal(output.publishCoverage,false);assert.equal(output.history,undefined);
});
test('B-COMP-1 genuine failed native history preserves original attempt without authorizing retry',async()=>{
 const f=fixture({run:{...nativeRun(),conclusion:'failure'},jobs:[nativeJob(1,'Lint','failure'),nativeJob(2,'Test','failure'),nativeJob(3,'Cadence admission')]});
 const result=await admitNightly({expected,policy,projection,workflow:policy.workflows[0].path,runId:124,attempt:1},{token:'fixture-token',fetchImpl:f.fetchImpl,now:()=>new Date('2026-10-02T03:00:00Z')});
 assert.equal(result.decision.action,'blocked');assert.equal(result.admission,null);
 const original=result.decision.history.receipts.find(row=>row.runId===result.decision.runId);
 assert.ok(original);const output=admissionDisposition(result);
 assert.equal(output.action,'blocked');assert.equal(output.runId,original.runId);assert.equal(output.attempt,original.attempt);
 assert.equal(output.runUrl,original.runUrl);assert.equal(output.completedAt,original.completedAt);
 assert.equal(output.publishCoverage,false);assert.equal(output.history,undefined);
});

const allGuards=()=>['ci.yml','ci-cadence-bundle-size-full.yml','ci-cadence-knip-full.yml','ci-cadence-license-check-full.yml','ci-cadence-e2e-full.yml','ci-cadence-lighthouse-full.yml','ci-cadence-security-full.yml','coverage.yml'].flatMap(file=>Object.entries(workflow(file).jobs).flatMap(([id,job])=>(job.steps??[]).filter(step=>/^Verify (?:completed )?callable source checkout$/.test(step.name??'')).map(step=>({file,id,step}))));
function gitFixture(t){
 const directory=mkdtempSync(join(tmpdir(),'B-review-physical-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const env={PATH:'/usr/bin:/bin',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_GRAFT_FILE:'/dev/null'};
 const git=(...args)=>execFileSync('/usr/bin/git',['-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false','-c','user.name=Fixture','-c','user.email=fixture@example.invalid',...args],{cwd:directory,env,encoding:'utf8',timeout:5000}).trim();
 git('init','--quiet','--template=');writeFileSync(join(directory,'source.ts'),'export const measured = 1;\n');git('add','source.ts');git('commit','--quiet','-m','physical fixture');
 return {directory,git,sha:git('rev-parse','HEAD')};
}
function actualShell(step,directory,env){
 // Execute emitted custom shell rather than silently substituting a safer one.
 const scripts=mkdtempSync(join(tmpdir(),'B-review-emitted-shell-'));
 const script=join(scripts,'guard.sh');writeFileSync(script,step.run);
 const command=step.shell??'bash --noprofile --norc -e -o pipefail {0}';
 const tokens=command.split(/\s+/);const executable=tokens.shift();
 const args=tokens.map(value=>value==='{0}'?script:value);
 const literals=Object.fromEntries(Object.entries(step.env??{}).filter(([,value])=>typeof value==='string'&&!value.includes('${{')));
 const result=spawnSync(executable,args,{cwd:directory,env:{...process.env,...env,...literals},encoding:'utf8',timeout:5000});
 rmSync(scripts,{recursive:true,force:true});return result;
}
test('B-COMP-2 actual clean all pre/post guards remain positive',t=>{
 const {directory,sha}=gitFixture(t);
 for(const {file,id,step}of allGuards())assert.equal(actualShell(step,directory,{SOURCE_SHA:sha}).status,0,file+'/'+id+'/'+step.name);
});
for(const fault of ['worktree','index','untracked','assume-unchanged','skip-worktree'])test('B-COMP-2 actual all pre/post guard rejection '+fault,t=>{
 const {directory,git,sha}=gitFixture(t);
 if(fault==='index'){writeFileSync(join(directory,'source.ts'),'staged different bytes\n');git('add','source.ts');}
 else if(fault==='untracked')writeFileSync(join(directory,'untracked-source.ts'),'different executable bytes\n');
 else{if(fault==='assume-unchanged')git('update-index','--assume-unchanged','source.ts');if(fault==='skip-worktree')git('update-index','--skip-worktree','source.ts');writeFileSync(join(directory,'source.ts'),'different executable bytes\n');}
 const guards=allGuards();assert.ok(guards.length>=20);
 for(const {file,id,step}of guards)assert.notEqual(actualShell(step,directory,{SOURCE_SHA:sha}).status,0,file+'/'+id+'/'+step.name);
});
for(const fault of ['BASH_ENV','PATH-git'])test('B-COMP-2 emitted shell prevents startup/Git override '+fault,t=>{
 const {directory,sha}=gitFixture(t),evil=mkdtempSync(join(tmpdir(),'B-review-hostile-startup-'));
 t.after(()=>rmSync(evil,{recursive:true,force:true}));
 const env={SOURCE_SHA:'b'.repeat(40)};
 if(fault==='BASH_ENV'){const startup=join(evil,'startup');writeFileSync(startup,'exit 0\n');env.BASH_ENV=startup;}
 else{const fake=join(evil,'git');writeFileSync(fake,'#!/bin/sh\nprintf "%s\\n" "$SOURCE_SHA"\n');chmodSync(fake,0o700);env.PATH=evil+':/usr/bin:/bin';}
 assert.notEqual(sha,env.SOURCE_SHA);
 for(const {file,id,step}of allGuards())assert.notEqual(actualShell(step,directory,env).status,0,file+'/'+id+'/'+step.name);
});
for(const fault of ['GIT_DIR','GIT_INDEX_FILE','GIT_CONFIG_COUNT'])test('B-COMP-2 emitted guard binds actual cwd despite ambient '+fault,t=>{
 const {directory,sha,git}=gitFixture(t),foreign=mkdtempSync(join(tmpdir(),'B-review-foreign-Git-'));
 t.after(()=>rmSync(foreign,{recursive:true,force:true}));
 cpSync(directory,join(foreign,'clean'),{recursive:true});
 const clean=join(foreign,'clean');writeFileSync(join(directory,'source.ts'),'actual candidate changed\n');
 const env={SOURCE_SHA:sha};
 if(fault==='GIT_DIR'){env.GIT_DIR=join(clean,'.git');env.GIT_WORK_TREE=clean;}
 if(fault==='GIT_INDEX_FILE'){git('add','source.ts');env.GIT_INDEX_FILE=join(clean,'.git/index');}
 if(fault==='GIT_CONFIG_COUNT'){env.GIT_CONFIG_COUNT='1';env.GIT_CONFIG_KEY_0='core.worktree';env.GIT_CONFIG_VALUE_0=clean;}
 for(const {file,id,step}of allGuards())assert.notEqual(actualShell(step,directory,env).status,0,file+'/'+id+'/'+step.name);
});

function evaluate(expression,context){
 if(typeof expression!=='string')return expression;
 return vm.runInNewContext(expression.replace(/^\$\{\{\s*|\s*\}\}$/g,''),{...context,always:()=>true,failure:()=>false,cancelled:()=>false},{timeout:100});
}
function event(change={}){
 const github={repository:'juan294/paisaxe',repository_id:'1141286326',repository_owner_id:'3944118',actor_id:'3944118',event_name:'pull_request',ref:'refs/pull/7/merge',event:{sender:{id:3944118,type:'User'},pull_request:{user:{id:3944118,type:'User'},head:{repo:{id:1141286326,fork:false}},base:{ref:'main'}}},...change};
 return {github,secrets:Object.fromEntries(['STRIPE_TEST_SECRET_KEY','STRIPE_TEST_DAY_PASS_PRICE_ID','NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY','STRIPE_TEST_WEBHOOK_SECRET','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_KEY','QA_TEST_USER_EMAIL','QA_TEST_USER_PASSWORD'].map(key=>[key,'must-withhold-'+key]))};
}
for(const fault of ['foreign-author','foreign-actor','fork','bot','wrong-owner','foreign-author-bot'])test('B-COMP-4 actual Stripe gate denies '+fault,()=>{
 const context=event();
 if(fault==='foreign-author')context.github.event.pull_request.user.id=123;
 if(fault==='foreign-actor')context.github.actor_id='123';
 if(fault==='fork'){context.github.event.pull_request.head.repo.id=123;context.github.event.pull_request.head.repo.fork=true;}
 if(fault==='bot'){context.github.event.sender.type='Bot';context.github.event.pull_request.user.type='Bot';}
 if(fault==='wrong-owner')context.github.repository_owner_id='123';
 if(fault==='foreign-author-bot'){context.github.event.pull_request.user.id=123;context.github.event.pull_request.user.type='Bot';}
 const job=workflow('e2e-stripe-integration.yml').jobs['e2e-stripe'];
 assert.equal(Boolean(evaluate(job.if??'true',context)),false);
 assert.deepEqual(job.permissions,{contents:'read'});
 for(const step of job.steps)for(const value of Object.values(step.env??{}))if(typeof value==='string'&&value.includes('secrets.'))assert.equal(evaluate(value,context),'');
});
for(const eventName of ['pull_request','schedule','workflow_dispatch'])test('B-COMP-4 owner authorized original '+eventName+' still reaches real mandatory suite',()=>{
 const context=event({event_name:eventName,ref:eventName==='pull_request'?'refs/pull/7/merge':'refs/heads/main'});
 const job=workflow('e2e-stripe-integration.yml').jobs['e2e-stripe'];
 assert.equal(Boolean(evaluate(job.if??'true',context)),true);
 const required=job.steps.find(step=>step.name==='Check required secrets');assert.match(required.run,/exit 1/);
 assert.ok(job.steps.some(step=>step.run?.includes('npm run test:e2e:stripe')));
 for(const [key,value]of Object.entries(required.env))assert.equal(evaluate(value,context),context.secrets[key]);
});

test('B-COMP-3 actual release PR job is a plain secret-free local artifact smoke rather than Preview transport',()=>{
 const w=workflow('preview-smoke.yml');assert.deepEqual(Object.keys(w.on),['pull_request']);assert.deepEqual(w.on.pull_request.branches,['main']);
 const job=w.jobs['preview-smoke'];assert.equal(job.name,'Release artifact smoke');assert.equal(job.if,undefined);
 const source=JSON.stringify(w);for(const forbidden of ['secrets.','github.token','VERCEL_AUTOMATION_BYPASS_SECRET','deployments','git show','sha256sum'])assert.ok(!source.includes(forbidden),forbidden);
 assert.deepEqual(job.permissions,{contents:'read'});
 // The context the policy inventories is the one this job actually produces.
 const policy=JSON.parse(readFileSync(join(root,'.github/ci-cadence.json'),'utf8')).workflows.find(entry=>entry.path==='.github/workflows/preview-smoke.yml');
 assert.deepEqual(policy.contexts,{'Release artifact smoke':['preview-smoke-preview-smoke']});
});
test('B-COMP-3 actual manifest cannot qualify a real Git candidate without its physical production build',async t=>{
 const {directory,sha}=gitFixture(t);
 const {createCandidateManifest}=await import(join(root,'scripts/ci-cadence-artifact.mjs'));
 await assert.rejects(()=>createCandidateManifest(directory,{candidateSha:sha}));
});
