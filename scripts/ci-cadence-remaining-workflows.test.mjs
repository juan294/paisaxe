import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { generateRemainingWorkflows } from './ci-cadence-remaining-workflows.mjs';
const inventory = { e2e: ['e2e', 'visual-regression'], lighthouse: ['lighthouse'], security: ['gitleaks', 'audit', 'vercel-env-safety'] };
for (const slug of Object.keys(inventory)) test('actual '+slug+' callable preserves canonical command bodies and requires every applicable child', () => {
  const original = parse(readFileSync(new URL('../.github/workflows/'+slug+'.yml', import.meta.url), 'utf8'));
  const generated = generateRemainingWorkflows().find(file => file.path.endsWith('/ci-cadence-'+slug+'-full.yml'));
  const actual = parse(generated.source);
  assert.equal(readFileSync(new URL('../'+generated.path, import.meta.url), 'utf8'), generated.source);
  assert.deepEqual(actual.permissions, { contents: 'read' });
  assert.deepEqual(actual.jobs['callable-full'].needs, ['callable-source', ...inventory[slug]]);
  assert.equal(actual.concurrency['cancel-in-progress'], false);
  for (const id of inventory[slug]) {
    assert.equal(actual.jobs[id]['runs-on'], 'ubuntu-latest');
    assert.deepEqual(actual.jobs[id].permissions, { contents: 'read' });
    assert.deepEqual(actual.jobs[id].steps.filter(step => !['Verify callable source checkout','Verify completed callable source checkout'].includes(step.name) && (step.name !== 'Checkout code' || original.jobs[id].steps.some(prior => prior.name === 'Checkout code'))).map(step => [step.name, step.run]), original.jobs[id].steps.map(step => [step.name, step.run]));
    assert.equal(actual.jobs[id].steps.find(step => step.name === 'Checkout code').with.ref, '${{ inputs.source_sha }}');
  }
  assert.ok(!generated.source.includes('secrets: inherit'));
  if (slug === 'e2e') {
    assert.match(actual.jobs.e2e.if, /3944118/);
    assert.match(actual.jobs.e2e.if, /1141286326/);
    assert.equal(actual.jobs.e2e.env.SECRETS_WITHHELD_PR, 'false');
    assert.equal(actual.on.workflow_call.secrets.SUPABASE_SERVICE_KEY.required, false);
    assert.match(actual.jobs.e2e.steps.find(step => step.name === 'Check authenticated QA secrets').run, /exit 1/);
  }
  if (slug === 'security') {
    assert.match(actual.jobs['vercel-env-safety'].if, /3944118/);
    assert.equal(actual.on.workflow_call.secrets.VERCEL_TOKEN.required, false);
    assert.ok(actual.jobs['vercel-env-safety'].steps.some(step => step.name === 'Assert legacy agent override is absent from Vercel env'));
  }
});
