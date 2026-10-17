import './ci-cadence-test-git-env.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, chmodSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluate, workflow, nativeContext } from '../tests/fixtures/ci-cadence-adapter/native/workflow-graph.mjs';

// Live v2 oracles: hosted mode values have no routing authority. Frozen v1
// classifier/receipt behavior remains covered by its unchanged contract suites.
const root=new URL('../',import.meta.url);
const cadenceJob=id=>workflow('ci-cadence.yml').jobs[id];
const push=(ref='refs/heads/develop',actor)=>({kind:'push',ref,...(actor?{actor}:{})});
const pull=(baseBranch='develop',change={})=>({kind:'pull_request',ref:'refs/pull/7/merge',baseBranch,...change});
const policy=JSON.parse(readFileSync(new URL('.github/ci-cadence.json',root)));
const required={CI:['lint-and-typecheck','coverage-shard','coverage-merge','test','build'],'E2E Tests':['visual-regression'],'Lighthouse CI':['lighthouse'],'Bundle Size Analysis':['analyze'],'Dead Code Detection':['knip'],'License Compliance':['license-check'],'Security Scan':['gitleaks','audit']};
const context=(event,full,mode)=>({...nativeContext(event,mode),inputs:{profile:'',source_sha:'',invocation_id:''},needs:{routing:{result:'success',outputs:{full:String(full),reason:'ordinary-owner-integration'}},develop_push_source:{result:'skipped',outputs:{}},'callable-source':{result:'skipped'},'lint-and-typecheck':{result:'success'},'coverage-shard':{result:'success'},'coverage-merge':{result:'success'},test:{result:'success'},build:{result:'success'},analyze:{result:'success'}}});
test('CI Fast is protected readonly bounded work with no application/provider installation',()=>{
 const job=cadenceJob('entry');assert.equal(job.name,'CI Fast');assert.deepEqual(job.permissions,{contents:'read'});assert.equal(job['timeout-minutes'],6);assert.doesNotMatch(JSON.stringify(job),/secrets\.|npm ci|npm install|next build|self-hosted/);
 const step=job.steps.find(s=>s.id==='entry');assert.equal(step.env.LAUNCHER_SHA256,createHash('sha256').update(readFileSync(new URL('scripts/ci-cadence-launch.mjs',root))).digest('hex'));assert.equal(step.env.CI_CADENCE_MODE,undefined);assert.equal(step.env.ROUTING_MODE,undefined);
});
for(const mode of ['lean','legacy','LEAN',undefined])for(const event of [push(),pull()])test('protected fast/full dispositions are independent of obsolete mode '+mode+' '+event.kind,()=>{
 for(const entry of policy.workflows){const value=workflow(entry.path.split('/').at(-1));const ids=required[value.name];if(!ids)continue;for(const id of ids){for(const [full,expected]of [[false,false],[true,true]]){const c=context(event,full,mode);c.github.workflow_ref='juan294/paisaxe/'+entry.path+'@'+event.ref;assert.equal(Boolean(evaluate(value.jobs[id].if,c)),expected,id);}}assert.ok(value.jobs['ci-verification'].needs.includes('routing'));}
 assert.deepEqual(Object.keys(workflow('ci-cadence.yml').jobs),['entry','complete']);
});
for(const event of [push('refs/heads/main'),pull('main'),push('refs/heads/develop','outsider'),pull('develop',{actor:'dependabot[bot]'}),pull('develop',{headRepository:'outsider/paisaxe'}),pull('develop',{author:'outsider'})])test('mandatory full native boundary overrides a forged fast output '+JSON.stringify(event),()=>{
 const value=workflow('knip.yml');assert.equal(Boolean(evaluate(value.jobs.knip.if,context(event,false,'lean'))),true);
});
for(const state of ['failure','skipped','cancelled'])test('failed routing cannot suppress original work '+state,()=>{const c=context(push(),false);c.needs.routing.result=state;assert.equal(Boolean(evaluate(workflow('knip.yml').jobs.knip.if,c)),true);});
function entryStep(t, { install = 'complete', launcher, routing, pin, event: kind = 'push', definition: named, workflows, pins, change = {}, moved, merge = true } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'paisaxe-fast-entry-')); t.after(() => rmSync(directory, { recursive: true, force: true }));
  const repository = join(directory, 'repository'), bin = join(directory, 'bin'), temp = join(directory, 'temp');
  for (const path of [repository, bin, temp]) mkdirSync(path);
  const git = (...args) => execFileSync('git', ['-c', 'core.fsmonitor=false', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { cwd: repository, encoding: 'utf8', timeout: 5000 }).trim();
  git('init', '--quiet', '--template='); writeFileSync(join(repository, 'README.md'), 'fixture\n');
  const bytes = launcher ?? '';
  if (install !== 'absent') { mkdirSync(join(repository, 'scripts')); mkdirSync(join(repository, '.github')); writeFileSync(join(repository, '.github/ci-cadence.json'), workflows ? JSON.stringify({ workflows: Object.keys(workflows).map(path => ({ path })) }) : '{}\n'); if (pins) writeFileSync(join(repository, '.github/ci-cadence-native.json'), JSON.stringify({ workflowPins: Object.fromEntries(Object.keys(pins).map(path => [path, 'f'.repeat(40)])) })); for (const [path, text] of Object.entries({ ...workflows, ...pins })) { mkdirSync(join(repository, path, '..'), { recursive: true }); writeFileSync(join(repository, path), text); } writeFileSync(join(repository, 'scripts/ci-cadence.mjs'), '\n'); if (install === 'complete') writeFileSync(join(repository, 'scripts/ci-cadence-launch.mjs'), bytes); }
  git('add', '.'); git('commit', '--quiet', '-m', 'protected base'); const definition = named ?? git('rev-parse', 'HEAD');
  const apply = (files, message) => { for (const [path, text] of Object.entries(files)) { if (text === null) rmSync(join(repository, path)); else { mkdirSync(join(repository, path, '..'), { recursive: true }); writeFileSync(join(repository, path), text); } } git('add', '--all', '.'); git('commit', '--quiet', '--allow-empty', '-m', message); };
  // A pull request is checked out as GitHub builds refs/pull/N/merge: the PR head
  // merged onto the current base tip, which `moved` advances past base.sha.
  const base = git('rev-parse', 'HEAD'); git('checkout', '--quiet', '-b', 'fixture-head'); apply({ candidate: 'candidate\n', ...change }, 'candidate');
  if (kind === 'pull_request' && merge) { git('checkout', '--quiet', '--detach', base); if (moved) apply(moved, 'develop moved after base.sha'); git('merge', '--quiet', '--no-ff', '-m', 'native PR merge', 'fixture-head'); }
  writeFileSync(join(bin, 'sha256sum'), '#!/bin/bash\nexec shasum -a 256 "$@"\n'); chmodSync(join(bin, 'sha256sum'), 0o755);
  const eventPath = join(directory, 'event.json'), output = join(directory, 'output'), summary = join(directory, 'summary'), marker = join(directory, 'launcher-ran');
  writeFileSync(eventPath, JSON.stringify(kind === 'push' ? { before: definition } : { pull_request: { base: { sha: definition } } })); writeFileSync(output, ''); writeFileSync(summary, '');
  const step = cadenceJob('entry').steps.find(entry => entry.name === 'Acquire reviewed protected launcher');
  const result = spawnSync('/bin/bash', ['-e', '-o', 'pipefail', '-c', step.run], { cwd: repository, encoding: 'utf8', timeout: 20000, env: { PATH: `${bin}:${process.env.PATH}`, HOME: directory, RUNNER_TEMP: temp, GITHUB_EVENT_PATH: eventPath, GITHUB_EVENT_NAME: kind, GITHUB_SHA: git('rev-parse', 'HEAD'), GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary, GITHUB_TOKEN: 'fixture', LAUNCHER_SHA256: pin ?? createHash('sha256').update(bytes).digest('hex'), CI_CADENCE_MODE: step.env.CI_CADENCE_MODE, ...(routing === undefined ? {} : { ROUTING_MODE: routing }), FIXTURE_MARKER: marker } });
  const outputs = Object.fromEntries(readFileSync(output, 'utf8').split('\n').filter(Boolean).map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  let ran = null; try { ran = readFileSync(marker, 'utf8'); } catch {}
  return { status: result.status, stdout: result.stdout, outputs, summary: readFileSync(summary, 'utf8'), ran, definition };
}
const stub = (result, exit = 0) => `import{writeFileSync}from'node:fs';writeFileSync(process.env.FIXTURE_MARKER,String(process.env.CI_CADENCE_MODE));console.log(${JSON.stringify(JSON.stringify(result))});process.exitCode=${exit};\n`;
const identity = { sourceSha: 'a'.repeat(40), testedCheckoutSha: 'b'.repeat(40), definitionSha: 'c'.repeat(40) };
const passed = { ...identity, lane: 'fast', success: true, completed: ['commit-secret-scan', 'policy-validation', 'lockfile-validation', 'cadence-contracts'] };
const fullRequired = { ...identity, lane: 'full', success: false, fullRequired: true, completed: passed.completed, reason: 'committed install/runtime/workspace drift requires full dependency validation' };


for(const routing of ['lean','legacy',undefined])for(const kind of ['push','pull_request'])test('fast-only native acquisition fails closed without a protected launcher '+routing+' '+kind,t=>{
 const run=entryStep(t,{install:'absent',routing,event:kind});assert.notEqual(run.status,0);assert.equal(run.ran,null);assert.deepEqual(run.outputs,{});
});
for(const routing of ['lean','legacy',undefined])test('fast-only bootstrap accepts exactly completed checks regardless of old mode '+routing,t=>{
 const run=entryStep(t,{launcher:stub(passed),routing});assert.equal(run.status,0);assert.equal(run.outputs.decision,'skip');for(const key of ['source_sha','checkout_sha','definition_sha'])assert.match(run.outputs[key],/^[a-f0-9]{40}$/);
});
for(const result of [fullRequired,{...passed,completed:passed.completed.slice(0,3)},{...passed,success:false},{...passed,lane:'untrusted',acceptanceBlocked:true}])test('fast-only bootstrap rejects partial/full/untrusted native result '+JSON.stringify(result),t=>{const run=entryStep(t,{launcher:stub(result)});assert.notEqual(run.status,0);assert.deepEqual(run.outputs,{});});
for(const fault of ['missing-base','partial-install','wrong-pin'])test('protected acquisition rejects '+fault,t=>{const args={launcher:stub(passed)};if(fault==='missing-base')args.definition='e'.repeat(40);if(fault==='partial-install')args.install='partial';if(fault==='wrong-pin')args.pin='0'.repeat(64);const run=entryStep(t,args);assert.notEqual(run.status,0);assert.equal(run.ran,null);});
test('routine disposition never claims completed full proof and blocks failed entry',()=>{
 const job=cadenceJob('complete');assert.deepEqual(job.needs,['entry']);assert.match(job.steps[0].run,/not application or release evidence/);
 const step=job.steps[0];for(const decision of ['skip','originals'])assert.equal(spawnSync('bash',['-e','-c',step.run],{env:{...process.env,ENTRY:'success',DECISION:decision}}).status,0);
 for(const entry of ['failure','skipped','cancelled'])assert.notEqual(spawnSync('bash',['-e','-c',step.run],{env:{...process.env,ENTRY:entry,DECISION:'originals'}}).status,0);
});
test('Stripe retains owner/provider boundaries independent of old cadence mode',()=>{
 const job=workflow('e2e-stripe-integration.yml').jobs['e2e-stripe'];for(const mode of ['lean','legacy',undefined]){
 assert.equal(Boolean(evaluate(job.if,{...nativeContext(pull(),mode),needs:{}})),false);
 assert.equal(Boolean(evaluate(job.if,{...nativeContext(pull('main'),mode),needs:{}})),true);
 for(const event of [pull('main',{actor:'dependabot[bot]'}),pull('main',{headRepository:'outsider/paisaxe'}),pull('main',{author:'outsider'})])assert.equal(Boolean(evaluate(job.if,{...nativeContext(event,mode),needs:{}})),false);
 }
});
test('scheduled native graph and completed finalizer have no cadence toggle',()=>{
 for(const name of ['ci-nightly.yml','ci-cadence-finalize.yml','coverage.yml'])assert.doesNotMatch(JSON.stringify(workflow(name)),/vars\.CI_CADENCE_MODE/);
 assert.deepEqual(workflow('ci-cadence-finalize.yml').on.workflow_run.workflows,['CI nightly','Coverage']);
 const steps=workflow('coverage.yml').jobs.coverage.steps;assert.match(steps.find(s=>s.name==='Decide weekly native coverage eligibility').run,/date -u/);
});
