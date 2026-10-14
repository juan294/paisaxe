import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { routeOriginalWorkflow } from './ci-cadence-route-originals.mjs';
import { projectFullGraph } from './ci-cadence-projection.mjs';
import { fixture, expected, policy, projection, nativeJob } from '../tests/fixtures/ci-cadence-adapter/native/integration-fixture.mjs';

const retained = readFileSync(new URL('../tests/fixtures/ci-cadence-adapter/native/routing-originals.json', import.meta.url));
const original = JSON.parse(retained).files.find(file => file.path === '.github/workflows/ci.yml');
const required = 'Run required database contracts';
test('full Test runs contracts after coverage with exact ordinary checkout and sanitized artifact', () => {
  const job = parse(routeOriginalWorkflow(original.source)).jobs.test;
  assert.equal(job['timeout-minutes'], 50);
  const names = job.steps.map(step => step.name);
  const checkout = names.indexOf('Checkout code');
  assert.equal(names[checkout + 1], 'Verify callable source checkout');
  const ordinary = job.steps.find(step => step.name === 'Checkout database contract source');
  assert.equal(ordinary.with.ref, '${{ github.sha }}');
  assert.equal(ordinary.with['persist-credentials'], false);
  assert.ok(names.indexOf(ordinary.name) > checkout + 1);
  assert.ok(names.indexOf(required) > names.indexOf('Verify callable test/coverage suite'));
  assert.ok(names.indexOf(required) < names.indexOf('Verify completed callable source checkout'));
  const gate = job.steps.find(step => step.name === required);
  assert.equal(gate.run, 'node scripts/ci-contracts.mjs');
  assert.equal(gate['continue-on-error'], undefined);
  assert.equal(gate.if, undefined);
  assert.equal(job.steps.find(step => step.name === 'Setup database contract Node').with['node-version'], '24.21.0');
  assert.equal(job.steps.find(step => step.name === 'Setup database contract Supabase').with.version, '2.120.0');
  const artifact = job.steps.find(step => step.name === 'Upload sanitized database contract receipt');
  assert.equal(artifact.if, '${{ always() }}');
  assert.equal(artifact.with.path, '${{ runner.temp }}/database-contracts-${{ github.run_id }}-${{ github.run_attempt }}-${{ inputs.invocation_id || \'ordinary\' }}/receipt.json');
});
test('native full projection requires the contract step and rejects a missing step census', () => {
  const protectedPolicy = JSON.parse(readFileSync(new URL('../.github/ci-cadence.json', import.meta.url)));
  const input = { protectedPolicy, profile: 'nightly', definitionSha: 'b'.repeat(40), caller: {path: '.github/workflows/ci-nightly.yml', blobSha: 'a'.repeat(40)},
    callees: Object.fromEntries(protectedPolicy.workflows.filter(w => !['coverage','e2e-stripe-integration','preview-smoke'].some(x => w.path.endsWith('/'+x+'.yml'))).map(w => [w.path, {path:w.path,blobSha:w.definitionSha,prefix:w.path.split('/').at(-1).slice(0,-4),definitionSha:'b'.repeat(40)}])),
    auxiliaryJobs: [], admissionJob:'Cadence admission',admissionStep:'Upload admission',measurementJob:'Cadence measurement',measurementStep:'Upload measurement' };
  const result = projectFullGraph(input);
  assert.ok(result.projection.steps['ci-test'].includes(required));
  const inventory = JSON.parse(readFileSync(new URL('../.github/ci-cadence-native.json', import.meta.url))).stepInventory;
  input.stepInventory = structuredClone(inventory);
  input.stepInventory['ci-test'] = input.stepInventory['ci-test'].filter(name => name !== required);
  assert.equal(projectFullGraph(input).available, false);
});
for (const conclusion of ['missing', 'skipped', 'failure']) test('native evidence rejects ' + conclusion + ' database contract step', async () => {
  const jobs = [nativeJob(1,'Lint'), nativeJob(2,'Test'), nativeJob(3,'Cadence admission')];
  if (conclusion !== 'missing') jobs[1].steps.push({...jobs[1].steps[0],number:3,name:required,conclusion});
  const f = fixture({jobs});
  const result = await f.reader.readRun({runId:123,attempt:1,expected,policy,projection:{...projection,steps:{...projection.steps,test:['Execute Test',required]}}});
  assert.equal(result.available, false);
});
test('native evidence accepts successful required database contract step', async () => {
  const jobs = [nativeJob(1,'Lint'), nativeJob(2,'Test'), nativeJob(3,'Cadence admission')];
  jobs[1].steps.splice(1,0,{...jobs[1].steps[0],number:2,name:required}); jobs[1].steps[2].number=3;
  const f=fixture({jobs});
  const result=await f.reader.readRun({runId:123,attempt:1,expected,policy,projection:{...projection,steps:{...projection.steps,test:['Execute Test',required]}}});
  assert.equal(result.available,true,JSON.stringify(result));
});
test('public receipt excludes private diagnostics and cleanup failure cannot report success', async () => {
  const { publicContractReceipt } = await import('./ci-contracts.mjs');
  const privateReceipt = {status:'passed',projectId:'paisaxe-contracts-012345abcdef',candidateDigest:'a'.repeat(64),migrationDigest:'b'.repeat(64),suites:['private SQL'],cases:[{private:'private SQL'}],providerFixtures:{exitCode:0,output:'private provider payload'},failures:['private secret'],receiptPath:'/private/path'};
  const receipt = publicContractReceipt(privateReceipt, 'cleanup');
  assert.equal(receipt.status, 'failed'); assert.equal(receipt.failure, 'cleanup');
  assert.equal(JSON.stringify(receipt).includes('private'), false);
  assert.equal(publicContractReceipt({...privateReceipt,status:'failed'},undefined).status,'failed');
});
for (const scenario of ['success','runner throws','provider qualification fails','cleanup throws','prepare throws']) test('CI lifecycle awaits preparation and cleans its exact new task: '+scenario, async t => {
  const { runCIContracts } = await import('./ci-contracts.mjs');
  const root=realpathSync(mkdtempSync(join(tmpdir(),'ci-contract-wrapper-'))); t.after(()=>rmSync(root,{recursive:true,force:true}));
  const manifest={taskDir:'/owned/task'}; const calls=[];
  const result=await runCIContracts({runnerTemp:root,directory:join(root,'public'),dockerEnvironment:()=>({DOCKER_HOST:'unix:///fixture'}),
    prepare:async()=>{await Promise.resolve(); calls.push('prepared'); if(scenario==='prepare throws') throw Error('private'); return manifest;},
    run:async options=>{assert.equal(calls.at(-1),'prepared');assert.equal(options.taskDir,manifest.taskDir);await Promise.resolve();calls.push('ran');if(scenario==='runner throws')throw Error('private');return {status:scenario==='provider qualification fails'?'failed':'passed'};},
    cleanup:async value=>{assert.equal(value,manifest);await Promise.resolve();calls.push('cleaned');if(scenario==='cleanup throws')throw Error('private');}});
  assert.equal(result,scenario==='success');
  assert.deepEqual(calls,scenario==='prepare throws'?['prepared']:['prepared','ran','cleaned']);
  const receipt=readFileSync(join(root,'public/receipt.json'),'utf8');assert.equal(receipt.includes('private'),false);
  assert.equal(JSON.parse(receipt).status,scenario==='success'?'passed':'failed');
});
for (const scenario of ['owned','wrong nonce','shared network']) test('CI cleanup stops only immutable owned IDs: '+scenario, async()=>{
  const {stopOwnedStack}=await import('./ci-contracts.mjs');
  const manifest={projectId:'paisaxe-contracts-012345abcdef',nonce:'owned'};const id='a'.repeat(64);const name='supabase_db_'+manifest.projectId;const calls=[];
  const command=(_binary,args)=>{calls.push(args);if(args[0]==='network')return JSON.stringify([{Internal:true,Labels:{'com.paisaxe.contracts.nonce':scenario==='wrong nonce'?'foreign':'owned'},Containers:{[id]:{Name:name}}}]);
    if(args[0]==='container')return JSON.stringify([{Id:id,Name:'/'+name,Config:{Labels:{'com.supabase.cli.project':manifest.projectId}},NetworkSettings:{Networks:{[manifest.projectId]:{},...(scenario==='shared network'?{bridge:{}}:{})}}}]);return '';};
  const cleanup=()=>stopOwnedStack(manifest,{}, {inspect:async()=>{},command,stop:async()=>{calls.push(['relay']);}});
  if(scenario==='owned'){await cleanup();assert.deepEqual(calls.slice(-2),[['relay'],['stop','--time','10',id]]);}
  else {await assert.rejects(cleanup);assert.equal(calls.some(args=>['stop','relay'].includes(args[0])),false);}
});
