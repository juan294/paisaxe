import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const protectedPolicy = JSON.parse(readFileSync(new URL('../.github/ci-cadence.json', import.meta.url)));
const project = () => import('./ci-cadence-projection.mjs');
const caller = { path: '.github/workflows/ci-nightly.yml', blobSha: 'a'.repeat(40) };
const input = () => ({ protectedPolicy, profile: 'nightly', definitionSha: 'b'.repeat(40), caller,
  callees: Object.fromEntries(protectedPolicy.workflows.filter(w => !['coverage','e2e-stripe-integration','preview-smoke'].some(x => w.path.endsWith('/'+x+'.yml'))).map(w => [w.path, { path: w.path, blobSha: w.definitionSha, prefix: w.path.split('/').at(-1).slice(0,-4), definitionSha: 'b'.repeat(40) }])),
  auxiliaryJobs: [], admissionJob: 'Cadence admission', admissionStep: 'Upload admission', measurementJob: 'Cadence measurement', measurementStep: 'Upload measurement',
});
test('nightly projects all seventeen original full leaves and exact four-shard dependencies', async () => {
  const { projectFullGraph } = await project(); const r = projectFullGraph(input());
  assert.equal(r.available,true); assert.equal(r.policy.workflows[0].jobs.length,17);
  assert.deepEqual(r.policy.workflows[0].jobs.find(j=>j.id==='ci-coverage-merge').needs, [1,2,3,4].map(n=>'ci-coverage-shard-'+n));
  assert.ok(r.projection.steps['e2e-e2e'].includes('Run E2E tests with authenticated journey'));
  assert.ok(r.projection.steps['security-vercel-env-safety'].includes('Assert legacy agent override is absent from Vercel env'));
  assert.equal(r.nativeNamesVerified,false);
});
for (const fault of ['callee-missing','wrong-commit','wrong-repository','missing-app','duplicate-prefix','caller-callee','aux-collision','aux-failure','profile']) test('protected projection rejects '+fault, async()=>{
 const {projectFullGraph}=await project(); const x=structuredClone(input());
 if(fault==='callee-missing')delete x.callees['.github/workflows/e2e.yml'];
 if(fault==='wrong-commit')x.callees['.github/workflows/e2e.yml'].definitionSha='c'.repeat(40);
 if(fault==='wrong-repository')x.protectedPolicy.repository='outsider/paisaxe';
 if(fault==='missing-app')x.protectedPolicy.workflows[0].jobs.pop();
 if(fault==='duplicate-prefix')x.callees['.github/workflows/e2e.yml'].prefix='ci';
 if(fault==='caller-callee')x.caller.path='.github/workflows/ci.yml';
 if(fault==='aux-collision')x.auxiliaryJobs=[{name:'ci / Test',conclusions:['skipped'],steps:[]}];
 if(fault==='aux-failure')x.auxiliaryJobs=[{name:'helper',conclusions:['failure'],steps:[]}];
 if(fault==='profile')x.profile='release';
 assert.equal(projectFullGraph(x).available,false);
});
test('caller identity stays original native root and never fabricated per-callee runs',async()=>{
 const {projectFullGraph}=await project();const r=projectFullGraph(input());
 assert.equal(r.policy.workflows.length,1);assert.equal(r.policy.workflows[0].path,caller.path);
 assert.equal(r.projection.workflowPins[caller.path],caller.blobSha);
 assert.equal(r.projection.referencedWorkflows.length,7);
 for(const ref of r.projection.referencedWorkflows)assert.equal(ref.sha,'b'.repeat(40));
});

// GitHub's native run lists every reusable workflow the run references, nested
// calls included, as path@<commit> with that commit in .sha (run 37721477388).
test('projected references equal GitHub\'s actual referenced_workflows for the pinned nightly head', async () => {
  const { projectFullGraph } = await project();
  const actual = JSON.parse(readFileSync(new URL('../tests/fixtures/ci-cadence-adapter/native/nightly-referenced-workflows.json', import.meta.url)));
  const catalogue = JSON.parse(readFileSync(new URL('../.github/ci-cadence-native.json', import.meta.url)));
  const definitionSha = actual.head_sha, nightly = '.github/workflows/ci-nightly.yml';
  const r = projectFullGraph({ protectedPolicy, profile: 'nightly', definitionSha, caller: catalogue.callers[nightly],
    callees: Object.fromEntries(Object.entries(catalogue.callees).map(([path, callee]) => [path, { ...callee, definitionSha }])),
    nestedCallees: Object.values(catalogue.nestedCallees ?? {}), auxiliaryJobs: catalogue.censusByCaller[nightly], stepInventory: catalogue.stepInventory,
    admissionJob: 'Cadence admission', admissionStep: 'Upload Cadence admission', measurementJob: 'Cadence measurement', measurementStep: 'Upload Cadence measurement' });
  assert.equal(r.available, true, r.error);
  const set = list => list.map(item => [item.path, item.ref, item.sha].join(' ')).sort();
  assert.deepEqual(set(r.projection.referencedWorkflows), set(actual.referenced_workflows));
  for (const ref of r.projection.referencedWorkflows) assert.equal(r.projection.workflowSources[ref.path.split('@')[0].slice('juan294/paisaxe/'.length)], ref.sha);
});
