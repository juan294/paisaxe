import test from 'node:test';
import assert from 'node:assert/strict';
import { provisionSmokeEnvironment } from './ci-cadence-smoke-env.mjs';

const status = (change = {}) => ({ API_URL: 'http://127.0.0.1:54321', ANON_KEY: 'local-anon', SERVICE_ROLE_KEY: 'local-service', ...change });
const created = () => { const calls = []; return { calls, request: async (url, options) => { calls.push({ url: String(url), options }); return new Response('{}', { status: 200 }); } }; };

test('local stack yields loopback datastore, throwaway QA user and per-run health secret', async () => {
  const { calls, request } = created();
  const environment = await provisionSmokeEnvironment(status(), { request });
  assert.deepEqual(Object.keys(environment).sort(), ['CRON_SECRET', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'QA_TEST_USER_EMAIL', 'QA_TEST_USER_PASSWORD', 'SUPABASE_SERVICE_KEY']);
  assert.equal(environment.NEXT_PUBLIC_SUPABASE_URL, 'http://127.0.0.1:54321');
  // Same pattern e2e/fixtures/auth.ts accepts for its cleanup/sign-in guard.
  assert.match(environment.QA_TEST_USER_EMAIL, /^qa-test-[a-z0-9]+@paisaxe\.dev$/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://127.0.0.1:54321/auth/v1/admin/users');
  assert.deepEqual(JSON.parse(calls[0].options.body), { email: environment.QA_TEST_USER_EMAIL, password: environment.QA_TEST_USER_PASSWORD, email_confirm: true });
  const again = await provisionSmokeEnvironment(status(), { request });
  for (const key of ['QA_TEST_USER_EMAIL', 'QA_TEST_USER_PASSWORD', 'CRON_SECRET']) assert.notEqual(again[key], environment[key], key);
});
for (const api of ['https://project.supabase.co', 'http://example.supabase.co:54321', 'https://127.0.0.1:54321', 'http://127.0.0.1.evil.invalid:54321']) test('remote or non-loopback datastore is refused before any request: ' + api, async () => {
  const { calls, request } = created();
  await assert.rejects(provisionSmokeEnvironment(status({ API_URL: api }), { request }), /non-loopback/);
  assert.equal(calls.length, 0);
});
for (const missing of ['API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY']) test('incomplete local status fails instead of defaulting: ' + missing, async () => {
  const { calls, request } = created();
  await assert.rejects(provisionSmokeEnvironment(status({ [missing]: '' }), { request }), /local Supabase status/);
  assert.equal(calls.length, 0);
});
test('failed QA user creation fails the smoke environment', async () => {
  await assert.rejects(provisionSmokeEnvironment(status(), { request: async () => new Response('denied', { status: 403 }) }), /HTTP 403/);
});
