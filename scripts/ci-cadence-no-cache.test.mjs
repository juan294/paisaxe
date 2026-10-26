import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';

// CodeQL actions/cache-poisoning/poisonable-step: the callable full workflows
// check out a caller-supplied source_sha and also run on schedule, which can
// write the default-branch cache scope. They must not restore or save a cache.
const directory = new URL('../.github/workflows/', import.meta.url);
const callables = readdirSync(directory).filter(name => /^ci-cadence-.+-full\.yml$/.test(name));

test('every callable full workflow is present', () => {
  assert.deepEqual(callables.sort(), ['bundle-size', 'e2e', 'knip', 'license-check', 'lighthouse', 'security'].map(slug => `ci-cadence-${slug}-full.yml`));
});

for (const name of callables) test(`${name} setup-node steps do not use a dependency cache`, () => {
  const workflow = parse(readFileSync(new URL(name, directory), 'utf8'));
  const setups = Object.values(workflow.jobs).flatMap(job => job.steps ?? []).filter(step => step.uses?.startsWith('actions/setup-node@'));
  for (const step of setups) assert.equal(step.with?.cache, undefined, `${name}: ${step.name} enables a cache`);
  assert.doesNotMatch(readFileSync(new URL(name, directory), 'utf8'), /actions\/cache@/);
});
