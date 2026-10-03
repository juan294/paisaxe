import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { generateNativeWorkflows } from './ci-cadence-native-workflows.mjs';
test('concrete generated nightly calls all seven immutable same-definition app graphs, never inherits secrets',()=>{
  const files=generateNativeWorkflows(),nightly=files.find(file=>file.path.endsWith('/ci-nightly.yml'));
  assert.equal(readFileSync(nightly.path,'utf8'),nightly.source);
  const w=parse(nightly.source);
  assert.deepEqual(w.permissions,{contents:'read',actions:'read',checks:'read','pull-requests':'read'});
  const calls=Object.values(w.jobs).filter(job=>job.uses);
  assert.equal(calls.length,7);assert.equal(w.concurrency['cancel-in-progress'],false);
  for(const job of calls){assert.match(job.uses,/^\.\/\.github\/workflows\//);assert.equal(job.with.profile,'nightly');assert.equal(job.with.source_sha,'${{ needs.admission.outputs.source_sha }}');assert.match(job.if,/decision == 'full'/);assert.notEqual(job.secrets,'inherit');}
  assert.match(w.jobs.admission.if,/CI_CADENCE_MODE/);assert.match(w.jobs.admission.if,/3944118/);
  assert.equal(w.jobs.measurement.needs.length,8);
  assert.match(w.jobs.complete.steps[0].run,/test "\$MEASURED" = skipped/);
});
test('native catalogue contains exact seventeen leaves and all source guards without production publication',()=>{
  const files=generateNativeWorkflows(),value=JSON.parse(files.find(file=>file.path==='.github/ci-cadence-native.json').source);
  assert.equal(Object.keys(value.stepInventory).length,17);
  for(const steps of Object.values(value.stepInventory))assert.ok(steps.includes('Verify callable source checkout'));
  const finalizer=parse(files.find(file=>file.path.endsWith('/ci-cadence-finalize.yml')).source);
  assert.deepEqual(finalizer.on.workflow_run.workflows,['CI nightly','CI cadence','Coverage']);
  assert.match(JSON.stringify(finalizer),/workflow_run.path.*coverage\.yml/);assert.ok(!JSON.stringify(finalizer).includes('secrets:inherit'));
  assert.ok(!JSON.stringify(finalizer).includes('POST'));
});
test('native generator --check compares complete generated source rather than synthetic job labels',()=>{
  for(const file of generateNativeWorkflows())assert.equal(readFileSync(file.path,'utf8'),file.source,file.path);
});

test('routine root performs full recovery only after protected Fast and never treats a missing child as proof',()=>{
 const files=generateNativeWorkflows(),root=parse(files.find(f=>f.path.endsWith('/ci-cadence.yml')).source);
 assert.equal(root.jobs.entry.name,'CI Fast');assert.equal(root.jobs.entry.uses,undefined);assert.equal(root.jobs.complete.name,'CI Fast recovery');
 assert.deepEqual(parse(readFileSync('.github/ci-cadence-fast-job.yml','utf8')).steps,root.jobs.entry.steps);
 assert.equal(Object.values(root.jobs).filter(j=>j.uses).length,7);
 assert.match(root.jobs.complete.steps[0].run,/test "\$ENTRY" = success/);
 assert.match(root.jobs.complete.steps[0].run,/test "\$result" = success/);
 assert.match(root.jobs.measurement.if,/github.event_name == 'push'/);
});
test('main coverage completion has a concrete coverage-only reader instead of impersonating the full graph',async()=>{
 const {createGitHubCadenceReader}=await import('./ci-cadence-github.mjs');
 const reader=createGitHubCadenceReader({token:'fixture-only'});
 assert.equal(typeof reader.readStandaloneCoverage,'function');
});
