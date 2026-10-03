import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';

const workflow = parse(readFileSync(new URL('../.github/workflows/security.yml', import.meta.url), 'utf8'));
const assertion = workflow.jobs['vercel-env-safety'].steps.find(step => step.name === 'Assert legacy agent override is absent from Vercel env');
const legacyKey = ['ALLOW', 'AGENT', 'RUN'].join('_');

function execute(t, body, curlExit = 0) {
  const directory = mkdtempSync(join(tmpdir(), 'paisaxe-vercel-env-contract-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const bin = join(directory, 'bin');
  mkdirSync(bin);
  const response = join(directory, 'response.json');
  writeFileSync(response, typeof body === 'string' ? body : JSON.stringify(body), { mode: 0o600 });
  // Replace only external Vercel HTTP transport. Execute the owned YAML shell,
  // its actual JSON parser and the real absence assertion unchanged.
  writeFileSync(join(bin, 'curl'), '#!/bin/sh\ncat "$RESPONSE_FILE"\nexit "$CURL_EXIT"\n', { mode: 0o700 });
  const environment = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'SHELL', 'LANG', 'LC_ALL', 'USER', 'LOGNAME'].filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
  return spawnSync('/bin/bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', assertion.run], {
    cwd: directory,
    env: { ...environment, PATH: `${bin}:${environment.PATH}`, RESPONSE_FILE: response, CURL_EXIT: String(curlExit), VERCEL_TOKEN: 'synthetic-transport-only', VERCEL_PROJECT_ID: 'synthetic-project', VERCEL_ORG_ID: 'synthetic-team' },
    encoding: 'utf8',
    timeout: 5000,
  });
}

// The step body is the pre-cadence one, byte for byte: cadence routing changes
// when the job runs, never what the release-path check does.
test('Vercel env assertion body is exactly the retained original step', () => {
  const retained = JSON.parse(readFileSync(new URL('../tests/fixtures/ci-cadence-adapter/native/routing-originals.json', import.meta.url), 'utf8')).files.find(file => file.path === '.github/workflows/security.yml');
  const original = parse(retained.source).jobs['vercel-env-safety'].steps.find(step => step.name === assertion.name);
  assert.equal(assertion.run, original.run);
  assert.match(assertion.run, /jq -r '\.envs\[\]\?\.key' > env-keys\.txt/);
  const callable = parse(readFileSync(new URL('../.github/workflows/ci-cadence-security-full.yml', import.meta.url), 'utf8')).jobs['vercel-env-safety'].steps.find(step => step.name === assertion.name);
  assert.equal(callable.run, original.run);
});
test('actual Vercel assertion passes without the legacy key and fails when it is present', t => {
  assert.equal(execute(t, { envs: [{ key: 'SAFE_KEY' }] }).status, 0);
  assert.notEqual(execute(t, { envs: [{ key: 'SAFE_KEY' }, { key: legacyKey }] }).status, 0);
});

test('actual Vercel assertion preserves HTTP transport failure', t => {
  const result = execute(t, { envs: [] }, 22);
  assert.notEqual(result.status, 0);
});

test('actual provider scope and secret-withheld branches remain explicit', () => {
  assert.deepEqual(workflow.on.push.branches, ['develop', 'main']);
  assert.deepEqual(workflow.on.pull_request.branches, ['develop', 'main']);
  assert.deepEqual(workflow.on.schedule, [{ cron: '0 8 * * *' }]);
  assert.deepEqual(Object.keys(workflow.jobs), ['develop_push_source', 'gitleaks', 'audit', 'vercel-env-safety']);
  for (const job of Object.values(workflow.jobs)) { assert.match(job.if, /CI_CADENCE_MODE == 'lean'/); assert.match(job.if, /3944118/); }
  assert.match(assertion.if, /env\.VERCEL_TOKEN != ''/);
  assert.match(assertion.run, /https:\/\/api\.vercel\.com\/v10\/projects\/\$VERCEL_PROJECT_ID\/env\?teamId=\$VERCEL_ORG_ID&limit=100/);
  assert.equal((assertion.run.match(/curl -fsS/g) ?? []).length, 1);
  assert.doesNotMatch(assertion.run, /scripts\/|import\(|require\(/);
});
