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
const page = envs => ({ envs, pagination: { count: envs.length, next: null, prev: null } });

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

for (const [label, body] of [
  ['complete empty page', page([])],
  ['complete page with unrelated keys', page([{ key: 'SAFE_KEY', value: 'DO_NOT_PRINT_PRIVATE_VALUE' }])],
  ['documented complete hidden-count variant', { envs: [], hiddenProductionEnvCount: 0 }],
  ['same key in distinct environments', page([{ key: 'SAFE_KEY', target: ['production'] }, { key: 'SAFE_KEY', target: ['preview'] }])],
]) {
  test(`actual Vercel assertion accepts ${label}`, t => {
    const result = execute(t, body);
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout + result.stderr, /DO_NOT_PRINT_PRIVATE_VALUE/);
  });
}

for (const [label, body] of [
  ['missing list', {}],
  ['null list', { envs: null }],
  ['object list', { envs: {} }],
  ['primitive list item', page(['SAFE_KEY'])],
  ['missing key', page([{}])],
  ['numeric key', page([{ key: 5 }])],
  ['empty key', page([{ key: '' }])],
  ['control byte in key', page([{ key: 'SAFE\nKEY' }])],
  ['legacy override', page([{ key: legacyKey }])],
  ['incomplete next page', { envs: [], pagination: { count: 0, next: 1234, prev: null } }],
  ['malformed pagination', { envs: [], pagination: {} }],
  ['missing completeness metadata', { envs: [] }],
  ['wrong page count', { envs: [], pagination: { count: 1, next: null, prev: null } }],
  ['hidden production variables', { envs: [], hiddenProductionEnvCount: 1 }],
  ['hidden variables alongside terminal page', { ...page([]), hiddenProductionEnvCount: 1 }],
  ['invalid hidden count', { envs: [], hiddenProductionEnvCount: '0' }],
  ['provider error object', { error: { code: 'forbidden', message: 'DO_NOT_PRINT_PRIVATE_VALUE' } }],
  ['terminal page with provider error', { ...page([]), error: { code: 'forbidden', message: 'DO_NOT_PRINT_PRIVATE_VALUE' } }],
  ['hidden-count list with provider error', { envs: [], hiddenProductionEnvCount: 0, error: { code: 'forbidden', message: 'DO_NOT_PRINT_PRIVATE_VALUE' } }],
  ['terminal page with provider error array', { ...page([]), errors: [{ code: 'forbidden', message: 'DO_NOT_PRINT_PRIVATE_VALUE' }] }],
  ['unsupported single-variable variant', { key: 'SAFE_KEY', value: 'DO_NOT_PRINT_PRIVATE_VALUE' }],
  ['invalid JSON', '{'],
]) {
  test(`actual Vercel assertion rejects ${label}`, t => {
    const result = execute(t, body);
    assert.notEqual(result.status, 0, `absence cannot be established from ${label}`);
    assert.doesNotMatch(result.stdout + result.stderr, /DO_NOT_PRINT_PRIVATE_VALUE/);
  });
}

test('actual Vercel assertion preserves HTTP transport failure', t => {
  const result = execute(t, page([]), 22);
  assert.notEqual(result.status, 0);
});

test('actual provider scope and secret-withheld branches remain explicit', () => {
  assert.deepEqual(workflow.on.push.branches, ['develop', 'main']);
  assert.deepEqual(workflow.on.pull_request.branches, ['develop', 'main']);
  assert.deepEqual(workflow.on.schedule, [{ cron: '0 8 * * *' }]);
  assert.deepEqual(Object.keys(workflow.jobs), ['develop_push_source', 'gitleaks', 'audit', 'vercel-env-safety', 'cadence-route']);
  assert.match(workflow.jobs['cadence-route'].if, /CI_CADENCE_MODE/);
  assert.match(workflow.jobs['cadence-route'].if, /3944118/);
  assert.match(assertion.if, /env\.VERCEL_TOKEN != ''/);
  assert.match(assertion.run, /https:\/\/api\.vercel\.com\/v10\/projects\/\$VERCEL_PROJECT_ID\/env\?teamId=\$VERCEL_ORG_ID&limit=100/);
  assert.equal((assertion.run.match(/curl -fsS/g) ?? []).length, 1);
  assert.doesNotMatch(assertion.run, /scripts\/|import\(|require\(/);
});
