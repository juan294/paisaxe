import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, cpSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { validateNativeResources, dependencyPayloads } from './ci-cadence-smoke-host.mjs';
import { launchSmoke } from './ci-cadence-smoke-launch.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const projectId = 'ci-cadence-qa-' + 'a'.repeat(32), networkId = 'b'.repeat(64), work = '/private/owned';
const expectedImages = Object.fromEntries(['postgres','kong','gotrue','postgrest','realtime','storage-api','mailpit'].map((key,index) => [key, 'sha256:' + String(index + 1).repeat(64)]));
const nativeRows = () => Object.entries({ db:'postgres',kong:'kong',auth:'gotrue',rest:'postgrest',realtime:'realtime',storage:'storage-api',inbucket:'mailpit' }).map(([name,image],index) => ({ Id:String(index + 1).repeat(64),Name:'/' + (name==='realtime'?'realtime-dev.':'') + 'supabase_' + name + '_' + projectId.slice(0,40),Image:expectedImages[image],State:{Running:true,Pid:index+2,StartedAt:'2026-10-03T00:00:00Z',Health:{Status:'healthy'}},Config:{Labels:{'com.supabase.cli.project':projectId.slice(0,40),'com.supabase.cli.workdir':work}},Mounts:[],NetworkSettings:{Networks:{[projectId]:{NetworkID:networkId,IPAddress:'172.30.214.'+(index+2)}},Ports:{'5432/tcp':[{HostIp:'127.0.0.1',HostPort:'55422'}]}} }));
const resourceInput = () => ({projectId,work,networkId,expectedImages});
test('exact seven current physical resources are required; namespace claim is not runtime proof',()=>{
  assert.equal(Object.keys(validateNativeResources(nativeRows(),resourceInput())).length,7);
});
for (const fault of ['missing','duplicate','foreign-project','foreign-workdir','foreign-network','extra-network','public-bind','wrong-image','stopped','pid-replaced','started-replaced','mount-replaced']) test('live native identity rejects '+fault,()=>{
  const rows=nativeRows(), previous=structuredClone(rows);
  if(fault==='missing')rows.pop();
  if(fault==='duplicate')rows[1]=structuredClone(rows[0]);
  if(fault==='foreign-project')rows[0].Config.Labels['com.supabase.cli.project']='foreign';
  if(fault==='foreign-workdir')rows[0].Config.Labels['com.supabase.cli.workdir']='/foreign';
  if(fault==='foreign-network')rows[0].NetworkSettings.Networks[projectId].NetworkID='f'.repeat(64);
  if(fault==='extra-network')rows[0].NetworkSettings.Networks.extra={};
  if(fault==='public-bind')rows[0].NetworkSettings.Ports['5432/tcp'][0].HostIp='0.0.0.0';
  if(fault==='wrong-image')rows[0].Image='sha256:'+'f'.repeat(64);
  if(fault==='stopped')rows[0].State.Running=false;
  if(fault==='pid-replaced')rows[0].State.Pid++;
  if(fault==='started-replaced')rows[0].State.StartedAt='2026-10-03T00:01:00Z';
  if(fault==='mount-replaced')rows[0].Mounts=[{Type:'bind',Source:'/var/run/docker.sock'}];
  assert.throws(()=>validateNativeResources(rows,{...resourceInput(),previous}));
});
test('actual npm lock acquisition has a finite unique registry-integrity inventory',()=>{
  const lock=JSON.parse(readFileSync(join(root,'package-lock.json'),'utf8'));
  const payloads=dependencyPayloads(lock); assert.ok(payloads.length>800&&payloads.length<1000);
  assert.equal(new Set(payloads.map(row=>row.url)).size,payloads.length);
});
for(const fault of ['http','userinfo','private-host','query','missing-integrity','file','link','empty','conflicting'])test('public dependency acquisition rejects '+fault,()=>{
  const row={resolved:'https://registry.npmjs.org/example/-/example-1.0.0.tgz',integrity:'sha512-'+Buffer.alloc(64).toString('base64')};
  const lock={lockfileVersion:3,packages:{'':{},'node_modules/example':row}};
  if(fault==='http')row.resolved=row.resolved.replace('https:','http:');
  if(fault==='userinfo')row.resolved=row.resolved.replace('https://','https://secret@');
  if(fault==='private-host')row.resolved=row.resolved.replace('registry.npmjs.org','private.example');
  if(fault==='query')row.resolved+='?token=private';
  if(fault==='missing-integrity')delete row.integrity;
  if(fault==='file')row.resolved='file:///tmp/example.tgz';
  if(fault==='link')row.link=true;
  if(fault==='empty')lock.packages={'':{}};
  if(fault==='conflicting')lock.packages['node_modules/nested/node_modules/example']={...row,integrity:'sha512-'+Buffer.alloc(64,1).toString('base64')};
  assert.throws(()=>dependencyPayloads(lock));
});
test('shipped public manifests bind actual finite platform pins, without private paths',()=>{
  const source=readFileSync(join(root,'scripts/ci-cadence-smoke-runtime/public-inputs.json'),'utf8'),inputs=JSON.parse(source);
  assert.equal(inputs.inputs.length,13);assert.equal(inputs.nativeImages.length,7);
  assert.ok(!source.includes('/Users/'));assert.equal(inputs.playwrightAmd64,'sha256:bc6ab0d6d44ff4826e4cb8c1e6d801e185bfc42bb0753f8e2a30efc70db054c7');
  for(const row of inputs.nativeImages){assert.match(row.platforms.amd64.manifestDigest,/^sha256:[a-f0-9]{64}$/);assert.notEqual(row.platforms.amd64.manifestDigest,row.platforms.arm64.manifestDigest);}
  assert.equal(inputs.supabaseCli.binary.sha256,'2d142ea645f9fe1436b3b728e5873056b5390eeb2fc838024ae3d2905f5afd94');
});
test('every fixed protected closure pin matches current reviewed file bytes',()=>{
  const source=readFileSync(join(root,'scripts/ci-cadence-smoke-launch.mjs'),'utf8');
  const pins=JSON.parse(source.match(/const PINS = (\{[\s\S]*?\});/)[1]);assert.ok(Object.keys(pins).length>=25);
  for(const [path,pin]of Object.entries(pins))assert.equal(hash(readFileSync(join(root,path))),pin,path);
});

function physical(t){
  const directory=mkdtempSync(join(tmpdir(),'B-smoke-acquisition-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const evidence=mkdtempSync(join(tmpdir(),'B-smoke-external-stop-'));t.after(()=>rmSync(evidence,{recursive:true,force:true}));
  const env={PATH:'/usr/bin:/bin',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_GRAFT_FILE:'/dev/null'};
  const git=(...args)=>execFileSync('/usr/bin/git',['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','-c','core.hooksPath=/dev/null',...args],{cwd:directory,env,encoding:'utf8',timeout:5000}).trim();
  git('init','--quiet','--template=');cpSync(join(root,'scripts'),join(directory,'scripts'),{recursive:true});cpSync(join(root,'tests'),join(directory,'tests'),{recursive:true});
  writeFileSync(join(directory,'app.ts'),'export const original=1;\n');git('add','.');git('commit','--quiet','-m','protected actual modules');const base=git('rev-parse','HEAD');
  git('checkout','--quiet','-b','candidate');const canary=join(directory,'hostile-executed');writeFileSync(join(directory,'scripts/ci-cadence-smoke-host.mjs'),`import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(canary)},'bad');throw Error('candidate executed');`);git('add','.');git('commit','--quiet','-m','hostile candidate module');const head=git('rev-parse','HEAD');
  git('checkout','--quiet','--detach',base);git('merge','--no-ff','--quiet','candidate','-m','original merge');const merge=git('rev-parse','HEAD');git('remote','add','origin','https://github.com/juan294/paisaxe.git');
  const repository={id:1141286326,full_name:'juan294/paisaxe',default_branch:'main',owner:{id:3944118}};
  const pr={number:7,base:{sha:base,ref:'main',repo:repository},head:{sha:head,repo:repository},user:{id:123},merge_commit_sha:merge};
  const event={repository,number:7,pull_request:pr};
  return{directory,evidence,git,canary,base,head,merge,event,repository,pr,context:{repositoryId:1141286326,ownerId:3944118,eventName:'pull_request',sha:merge,ref:'refs/pull/7/merge'}};
}
for(const fault of ['wrong-native-pr','http-failure','quota-999','metadata-head-drift','git-missing-object','git-wrong-object','protected-byte-drift','external-acquisition-stop'])test('actual physical acquisition prevents hostile candidate import: '+fault,async t=>{
  const f=physical(t);let calls=0;
  const request=async(url)=>{
    calls++;const value=url.endsWith('/pulls/7')?f.pr:url.includes('/git/commits/')?{sha:f.base}:f.repository;
    if(fault==='metadata-head-drift'&&calls===1)f.git('checkout','--quiet','--detach',f.base);
    const body=structuredClone(value);if(fault==='wrong-native-pr'&&url.endsWith('/pulls/7'))body.head.sha='f'.repeat(40);
    return new Response(JSON.stringify(body),{status:fault==='http-failure'?500:200,headers:{'x-ratelimit-remaining':fault==='quota-999'?'999':'5000'}});
  };
  const gitTransport=async({root:target,url,sha,ref})=>{
    assert.equal(url,'https://github.com/juan294/paisaxe.git');if(fault==='git-missing-object')return;
    const selected=fault==='git-wrong-object'?f.head:sha;
    execFileSync('/usr/bin/git',['-c','protocol.file.allow=always','fetch','--quiet',f.directory,selected+':'+ref],{cwd:target,env:{PATH:'/usr/bin:/bin',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'},timeout:5000,stdio:'pipe'});
  };
  if(fault==='protected-byte-drift')writeFileSync(join(f.directory,'scripts/ci-cadence-smoke-host.mjs'),'changed physical candidate bytes');
  // External process seam deliberately fails the first public download on Linux.
  // The actual protected loader/guard/import run; no Docker resource can start.
  await assert.rejects(()=>launchSmoke({root:f.directory,event:f.event,context:f.context,candidateSha:f.merge,baseSha:f.base,headSha:f.head,token:'read-only-fixture',directory:f.evidence},{request,gitTransport,hostExecute:async()=>({code:1,output:Buffer.from('external acquisition intentionally unavailable')})}));
  assert.throws(()=>readFileSync(f.canary));assert.ok(calls<=3);
});
