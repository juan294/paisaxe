import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { parse } from 'yaml';

const original = JSON.parse(readFileSync(new URL('../tests/fixtures/ci-cadence-adapter/native/workflow-baseline.json', import.meta.url), 'utf8'));
const baseline = parse(original.originalWorkflow);
const current = () => parse(readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'));
const direct = (ref = 'refs/heads/develop', event = 'push') => ({ vars:{CI_CADENCE_MODE:'legacy'}, inputs: { profile: '', source_sha: '', invocation_id: '' }, github: { actor_id:'3944118',event:{sender:{type:'User'},pull_request:{user:{id:3944118,type:'User'},head:{repo:{id:1141286326}}}}, repository: 'juan294/paisaxe', repository_id: '1141286326', repository_owner_id: '3944118', ref, event_name: event, workflow: 'CI', workflow_ref: `juan294/paisaxe/.github/workflows/ci.yml@${ref}`, run_id: '42', run_attempt: '1', sha: 'a'.repeat(40) }, needs: { develop_push_source: { result: 'skipped', outputs: { validated_by_pr: '' } }, 'callable-source': { result: 'skipped' }, 'lint-and-typecheck': { result: 'success' }, 'coverage-shard': { result: 'success' }, 'coverage-merge': { result: 'success' }, test: { result: 'success' }, build: { result: 'success' } } });
const called = (profile = 'nightly') => { const c = direct('refs/heads/main', 'schedule'); c.github.workflow = 'Nightly'; c.github.workflow_ref = 'juan294/paisaxe/.github/workflows/ci-nightly.yml@refs/heads/main'; c.inputs = { profile, source_sha: 'b'.repeat(40), invocation_id: 'ci_full' }; c.needs['callable-source'].result = 'success'; return c; };
function evaluate(expression, context) {
  if (typeof expression !== 'string') return expression;
  const interpolations = [...expression.matchAll(/\$\{\{([\s\S]*?)\}\}/g)];
  if (interpolations.length && (interpolations.length !== 1 || expression.trim() !== interpolations[0][0])) return expression.replace(/\$\{\{([\s\S]*?)\}\}/g, (_, value) => String(evaluate(value, context)));
  let source = expression.replace(/^\$\{\{\s*|\s*\}\}$/g, '').replace(/needs\.([A-Za-z][A-Za-z0-9_-]*)/g, (_, id) => `needs[${JSON.stringify(id)}]`);
  return vm.runInNewContext(source, { ...context, always: () => true, failure:()=>false,cancelled:()=>false, format: (pattern, ...args) => pattern.replace(/\{(\d+)\}/g, (_, n) => args[Number(n)]), fromJSON: JSON.parse }, { timeout: 100 });
}
function runner(value, context) { return typeof value === 'string' && value.includes('${{') ? evaluate(value, context) : value; }
function shell(script, env = {}, cwd = new URL('../', import.meta.url)) { return spawnSync('/bin/bash', ['-c', script], { cwd, env: { ...process.env, ...env }, encoding: 'utf8', timeout: 5000 }); }
const sourceStep = () => current().jobs['callable-source']?.steps.find(s => s.name === 'Validate callable inputs');
const sourceEnv = (change = {}) => ({ GITHUB_REPOSITORY: 'juan294/paisaxe', REPOSITORY_ID: '1141286326', OWNER_ID: '3944118', SOURCE_SHA: 'b'.repeat(40), PROFILE: 'nightly', INVOCATION_ID: 'ci_full', ...change });

test('baseline binds complete original CI and preserves original triggers', () => {
  assert.equal(createHash('sha256').update(original.originalWorkflow).digest('hex'), original.originalWorkflowSha256);
  assert.equal(original.originalWorkflowSha256, '6ffd53a7ebd8a4037a95a79d9b6a447a142b8cd943951b085687c7496c89042d');
  const w = current(); assert.deepEqual(w.on.push, baseline.on.push); assert.deepEqual(w.on.pull_request, baseline.on.pull_request);
});
test('callable schema requires three narrow strings and no inherited secrets', () => {
  const call = current().on.workflow_call; assert.ok(call);
  assert.deepEqual(Object.keys(call.inputs).sort(), ['invocation_id', 'profile', 'source_sha']);
  for (const input of Object.values(call.inputs)) { assert.equal(input.type, 'string'); assert.equal(input.required, true); assert.equal(input.default, undefined); }
  assert.equal(call.secrets, undefined);
});
for (const [ref, event] of [['refs/heads/develop', 'push'], ['refs/heads/main', 'push'], ['refs/pull/7/merge', 'pull_request']]) test(`direct ${event}/${ref} preserves original selector and concurrency results`, () => {
  const w = current(); const c = direct(ref, event);
  for (const id of Object.keys(baseline.jobs)) assert.equal(Boolean(evaluate(w.jobs[id].if, c)), Boolean(evaluate(baseline.jobs[id].if, c)), id);
  assert.equal(evaluate(w.concurrency.group, c), evaluate(baseline.concurrency.group, c));
  assert.equal(evaluate(w.concurrency['cancel-in-progress'], c), evaluate(baseline.concurrency['cancel-in-progress'], c));
  assert.equal(Boolean(evaluate(w.jobs['callable-source']?.if, c)), false);
});
for (const profile of ['full', 'nightly']) test(`callable ${profile} forces all four shards and original app leaves despite reuse`, () => {
  const w = current(); const c = called(profile); c.github.event_name = 'push'; c.github.ref = 'refs/heads/develop'; c.needs.develop_push_source.outputs.validated_by_pr = 'true';
  assert.equal(Boolean(evaluate(w.jobs.develop_push_source.if, c)), false);
  for (const id of ['lint-and-typecheck', 'coverage-shard', 'coverage-merge', 'test', 'build']) assert.equal(Boolean(evaluate(w.jobs[id].if, c)), true, id);
  assert.deepEqual(w.jobs['coverage-shard'].strategy, baseline.jobs['coverage-shard'].strategy);
  assert.equal(runner(w.jobs['coverage-shard']['runs-on'], c), 'ubuntu-latest');
});
test('all-empty inherited call is independently rejected instead of selecting direct legacy work', () => {
  const w = current(); const c = called(); c.inputs = { profile: '', source_sha: '', invocation_id: '' }; c.github.event_name = 'push'; c.github.ref = 'refs/heads/develop'; c.needs['callable-source'].result = 'failure';
  assert.equal(Boolean(evaluate(w.jobs['callable-source']?.if, c)), true);
  for (const id of ['lint-and-typecheck', 'coverage-shard', 'coverage-merge', 'test', 'build']) assert.equal(Boolean(evaluate(w.jobs[id].if, c)), id === 'test', id);
  assert.ok(sourceStep()); assert.notEqual(shell(sourceStep().run, sourceEnv({ SOURCE_SHA: '', PROFILE: '', INVOCATION_ID: '' })).status, 0);
});
for (const change of [{SOURCE_SHA:''},{SOURCE_SHA:'0'.repeat(40)},{SOURCE_SHA:'A'.repeat(40)},{SOURCE_SHA:'b'.repeat(39)},{SOURCE_SHA:'refs/heads/develop'},{PROFILE:''},{PROFILE:'fast'},{INVOCATION_ID:''},{INVOCATION_ID:'x'.repeat(65)},{INVOCATION_ID:'x/y'},{INVOCATION_ID:'$(echo forged)'},{INVOCATION_ID:'é'},{REPOSITORY_ID:'7'},{OWNER_ID:'8'},{GITHUB_REPOSITORY:'outsider/paisaxe'}]) test(`actual shell source validation rejects ${JSON.stringify(change)}`, () => {
  assert.ok(sourceStep()); assert.notEqual(shell(sourceStep().run, sourceEnv(change)).status, 0);
});
for (const profile of ['full','nightly']) test(`actual shell valid ${profile} accepts boundary invocation`, () => { assert.ok(sourceStep()); assert.equal(shell(sourceStep().run, sourceEnv({PROFILE:profile,INVOCATION_ID:'x'.repeat(64)})).status,0); });
test('all callable candidate checkouts immediately verify physical immutable HEAD before original work', t => {
  const directory = mkdtempSync(join(tmpdir(), 'paisaxe-callee-checkout-')); t.after(() => rmSync(directory,{recursive:true,force:true}));
  const git = (...args) => execFileSync('git',['-c','core.fsmonitor=false','-c','user.name=Fixture','-c','user.email=fixture@example.invalid',...args],{cwd:directory,encoding:'utf8',timeout:5000}).trim();
  git('init','--quiet','--template='); const tree = git('mktree'); const sha = git('commit-tree',tree,'-m','isolated fixture'); git('checkout','--quiet','--detach',sha);
  for (const id of ['lint-and-typecheck','coverage-shard','coverage-merge','test','build']) {
    const steps=current().jobs[id].steps; const index=steps.findIndex(s=>s.uses?.startsWith('actions/checkout@')); assert.ok(index>=0,id);
    const checkout=steps[index]; assert.equal(checkout.with.ref,'${{ inputs.source_sha || github.sha }}'); assert.equal(checkout.with['persist-credentials'],false); assert.equal(checkout.with['fetch-depth'],0);
    const guard=steps[index+1]; assert.equal(guard.name,'Verify callable source checkout'); assert.equal(shell(guard.run,{SOURCE_SHA:sha},directory).status,0,id); assert.notEqual(shell(guard.run,{SOURCE_SHA:'b'.repeat(40)},directory).status,0,id);
  }
});
test('original app step bodies and installation/runtime/coverage/artifacts remain unchanged', () => {
  const w=current();
  for (const id of ['lint-and-typecheck','coverage-shard','coverage-merge','test','build']) {
    const steps=w.jobs[id].steps.filter(s=>!['Verify callable source checkout','Verify callable test/coverage suite','Verify completed callable source checkout','Produce actual callable coverage JSON','Upload actual callable coverage'].includes(s.name) && !(id==='test' && (s.uses?.startsWith('actions/checkout@') || ['Setup database contract Node','Install database contract dependencies','Setup database contract Supabase','Check database contract PostgreSQL client','Run required database contracts','Upload sanitized database contract receipt'].includes(s.name)))).map(s=>{const v=structuredClone(s);if(v.uses?.startsWith('actions/checkout@'))delete v.with;if(id==='test')delete v.if;if(v.name==='Upload coverage blob')v.with.name=evaluate(v.with.name,{...direct(),matrix:{shard:'${{ matrix.shard }}'}});if(v.name==='Download coverage blobs')v.with.pattern=evaluate(v.with.pattern,direct());return v;});
    assert.deepEqual(steps,baseline.jobs[id].steps,id);
  }
});
for (const id of ['callable-source','lint-and-typecheck','coverage-shard','coverage-merge','test','build']) test(`callable ${id} grants contents read only`,()=>assert.deepEqual(current().jobs[id].permissions,{contents:'read'}));
for (const child of ['callable-source','lint-and-typecheck','coverage-shard','coverage-merge','test','build']) for(const result of ['failure','skipped','cancelled']) test(`full aggregate rejects ${child} ${result}`,()=>{
 const w=current();const aggregate=w.jobs['callable-full'];assert.ok(aggregate);assert.deepEqual([...aggregate.needs].sort(),['callable-source','lint-and-typecheck','coverage-shard','coverage-merge','test','build'].sort());const step=aggregate.steps[0];assert.ok(step.run);const env=Object.fromEntries(Object.entries(step.env).map(([key,value])=>[key,evaluate(value,called())]));const key=Object.keys(step.env).find(key=>step.env[key].includes(`needs.${child}.result`));assert.ok(key);env[key]=result;assert.notEqual(shell(step.run,env).status,0);
});
test('full aggregate accepts only every actual child success',()=>{const w=current();const step=w.jobs['callable-full']?.steps[0];assert.ok(step);const env=Object.fromEntries(Object.entries(step.env).map(([key,value])=>[key,evaluate(value,called())]));assert.equal(shell(step.run,env).status,0);assert.equal(Boolean(evaluate(w.jobs['callable-full'].if,called())),true);assert.equal(Boolean(evaluate(w.jobs['callable-full'].if,direct())),false);});
test('callee concurrency is literal CI identity plus run/attempt/invocation and never cancels caller',()=>{const w=current();const c=called();const first=evaluate(w.concurrency.group,c);assert.equal(first,'paisaxe-ci-full-call-42-1-ci_full');for(const [field,value] of [['run_id','43'],['run_attempt','2']]){const changed=structuredClone(c);changed.github[field]=value;assert.notEqual(evaluate(w.concurrency.group,changed),first);}const second=structuredClone(c);second.inputs.invocation_id='ci_other';assert.notEqual(evaluate(w.concurrency.group,second),first);assert.equal(evaluate(w.concurrency['cancel-in-progress'],c),false);});

test('callable artifact names isolate two invocations and match their download patterns', () => {
  const workflow = current();
  const upload = workflow.jobs['coverage-shard'].steps.find(step => step.name === 'Upload coverage blob');
  const download = workflow.jobs['coverage-merge'].steps.find(step => step.name === 'Download coverage blobs');
  const names = new Set();
  const patterns = new Map();
  for (const invocation of ['ci_full', 'ci_full-2']) {
    const context = called();
    context.inputs.invocation_id = invocation;
    const pattern = evaluate(download.with.pattern, context);
    assert.equal(pattern, `coverage-blob-${invocation}.shard-*`);
    patterns.set(invocation, pattern);
    for (const shard of [1, 2, 3, 4]) {
      const name = evaluate(upload.with.name, { ...context, matrix: { shard } });
      assert.equal(name, `coverage-blob-${invocation}.shard-${shard}`);
      assert.ok(name.startsWith(pattern.slice(0, -1)));
      assert.ok(!names.has(name));
      names.add(name);
    }
  }
  for (const [invocation, pattern] of patterns) {
    assert.deepEqual([...names].filter(name => name.startsWith(pattern.slice(0, -1))), [1, 2, 3, 4].map(shard => `coverage-blob-${invocation}.shard-${shard}`));
  }
  assert.equal(upload.with['if-no-files-found'], 'error');
  assert.equal(upload.with['include-hidden-files'], true);
});
test('direct artifact names and download pattern remain exactly original', () => {
  const workflow = current();
  const upload = workflow.jobs['coverage-shard'].steps.find(step => step.name === 'Upload coverage blob');
  const download = workflow.jobs['coverage-merge'].steps.find(step => step.name === 'Download coverage blobs');
  const originalUpload = baseline.jobs['coverage-shard'].steps.find(step => step.name === 'Upload coverage blob');
  const originalDownload = baseline.jobs['coverage-merge'].steps.find(step => step.name === 'Download coverage blobs');
  for (const shard of [1, 2, 3, 4]) {
    const context = { ...direct(), matrix: { shard } };
    assert.equal(evaluate(upload.with.name, context), evaluate(originalUpload.with.name, context));
  }
  assert.equal(download.with.pattern.includes('${{') ? evaluate(download.with.pattern, direct()) : download.with.pattern, originalDownload.with.pattern);
});

for(const [label,actor,sender,pr]of [['outsider','999','User',null],['bot','3944118','Bot',null],['fork','3944118','User',{user:{id:3944118,type:'User'},head:{repo:{id:999}}}]])test('mandatory native '+label+' never enters self-hosted direct legacy coverage',()=>{
 const c=direct(pr?'refs/pull/7/merge':'refs/heads/develop',pr?'pull_request':'push');c.github.actor_id=actor;c.github.event={sender:{type:sender},...(pr?{pull_request:pr}:{})};
 assert.equal(runner(current().jobs['coverage-shard']['runs-on'],c),'ubuntu-latest');
});
for (const [ref, event] of [['refs/heads/develop', 'push'], ['refs/pull/7/merge', 'pull_request']]) test(`public repository: trusted owner ${event} coverage runs on GitHub-hosted runners`, () => {
  assert.equal(runner(current().jobs['coverage-shard']['runs-on'], direct(ref, event)), 'ubuntu-latest');
});
