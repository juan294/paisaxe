import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, chmod, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateLocalQaProfile, withLocalQaFixture } from './ci-cadence-local-qa.mjs';

const OWNED = '00000000-0000-4000-8000-000000000001';
const FOREIGN = '00000000-0000-4000-8000-000000000002';
const secret = { anonKey: 'local-anon-fixture', serviceKey: 'local-service-fixture' };

async function harness(t, faults = {}) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'local-qa-')));
  await chmod(directory, 0o700);
  t.after(() => rm(directory, { recursive: true, force: true }));
  const profile = {
    schemaVersion: 1, repositoryId: 1141286326, nonce: 'a'.repeat(32),
    checkoutSha: 'b'.repeat(40), inputDigest: 'c'.repeat(64), workspace: directory,
    projectId: `ci-cadence-qa-${'a'.repeat(32)}`, mode: 'loopback',
    apiOrigin: 'http://127.0.0.1:56331', appOrigin: 'http://127.0.0.1:3107',
    containers: ['d'.repeat(64)], networks: ['e'.repeat(64)], volumes: ['owned-volume'],
    baselineAuthUserIds: [FOREIGN], envFilesAbsent: true, providerEgressDenied: true,
    apiBinding: '127.0.0.1', appBinding: '127.0.0.1',
    migrationDigest: '1'.repeat(64), seedDigest: '2'.repeat(64), configDigest: '3'.repeat(64),
    acquiredAt: '2026-10-03T00:00:00.000Z', ownerProcessId: 12345,
  };
  const calls = [];
  const foreign = { id: FOREIGN, email: 'foreign@example.invalid', user_metadata: {} };
  let user;
  let favorites = 1;
  let inspections = 0;
  const response = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });
  const fetchImpl = async (url, init) => {
    const parsed = new URL(url), key = `${init.method} ${parsed.pathname}`;
    calls.push({ key, url, init });
    if (faults.transport) {
      const override = await faults.transport({ key, url, init, user, response });
      if (override) return override;
    }
    if (key === 'GET /auth/v1/admin/users') {
      const users = user ? [foreign, user] : [foreign];
      return response({ users }, 200, { 'x-total-count': String(users.length) });
    }
    if (key === 'POST /auth/v1/admin/users') {
      const input = JSON.parse(init.body);
      user = { id: OWNED, email: input.email, user_metadata: input.user_metadata, email_confirmed_at: '2026-10-03T00:00:00Z' };
      if (faults.createLost) throw new Error('external transport failed with local-service-fixture');
      return response(faults.badCreatedUser ? { ...user, email: 'someone@example.invalid' } : user);
    }
    if (key.startsWith('GET /rest/v1/user_profiles')) return response(user ? [{ user_id: OWNED, email: user.email, role: faults.admin ? 'admin' : 'user' }] : []);
    if (key === 'POST /auth/v1/token') return response({ access_token: 'local-session-fixture', refresh_token: 'local-refresh-fixture', expires_in: 3600, token_type: 'bearer', user: faults.wrongSession ? foreign : user });
    if (key === 'GET /auth/v1/user') return response(user);
    if (key === 'POST /auth/v1/logout') return new Response(null, { status: 204 });
    if (key === `GET /auth/v1/admin/users/${OWNED}`) return user ? response(user) : response({ code: 'user_not_found' }, 404);
    if (key === 'POST /rest/v1/rpc/cleanup_qa_test_user') throw new Error('unexpected email cleanup request');
    if (key === 'DELETE /rest/v1/user_favorites') {
      if (faults.favoritesDeleteFailure) return response({ error: 'service secret local-service-fixture' }, 500);
      favorites = 0;
      return new Response(null, { status: 204 });
    }
    if (key === 'GET /rest/v1/user_favorites') return response(favorites || faults.favoritesRemaining ? [{ id: 'favorite', user_id: OWNED }] : []);
    if (key === `DELETE /auth/v1/admin/users/${OWNED}`) { user = undefined; return new Response(null, { status: 204 }); }
    throw new Error(`Unexpected external request ${key}`);
  };
  const options = {
    secrets: secret, journalDirectory: directory, fetchImpl,
    inspectProfile: async () => {
      inspections++;
      return faults.inspection ? faults.inspection(profile, inspections) : structuredClone(profile);
    },
  };
  return { profile, options, calls, directory, alive: () => Boolean(user), inspections: () => inspections };
}

test('positive lifecycle uses actual response identity and private handoff then removes exact account', async t => {
  const h = await harness(t);
  let env;
  const result = await withLocalQaFixture(h.profile, h.options, async handoff => {
    env = handoff.env;
    assert.equal(handoff.userId, OWNED);
    assert.match(env.QA_TEST_USER_EMAIL, /^qa-test-[a-f0-9]{32}@paisaxe\.dev$/);
    assert.ok(env.QA_TEST_USER_PASSWORD.length >= 32);
    assert.equal(env.SUPABASE_SERVICE_KEY, secret.serviceKey);
  });
  assert.equal(result.cleanup, 'verified');
  assert.equal(h.alive(), false);
  assert.equal(h.calls.filter(c => c.key === 'POST /auth/v1/admin/users').length, 1);
  assert.ok(h.calls.some(c => c.key === `DELETE /auth/v1/admin/users/${OWNED}`));
  assert.ok(h.calls.every(c => !c.url.includes(FOREIGN)));
  assert.equal(JSON.stringify(result).includes(env.QA_TEST_USER_PASSWORD), false);
  const files = await readdir(h.directory);
  for (const file of files) assert.equal((await readFile(join(h.directory, file), 'utf8')).includes(secret.serviceKey), false);
});

test('rejected async operation still runs cleanup and preserves operation failure without raw secrets', async t => {
  const h = await harness(t);
  await assert.rejects(withLocalQaFixture(h.profile, h.options, async () => { throw new Error('browser failed local-session-fixture'); }), e => e.message.includes('operation_failed') && !e.message.includes('local-session-fixture'));
  assert.equal(h.alive(), false);
});

for (const [name, change] of [
  ['remote API', p => { p.apiOrigin = 'https://project.supabase.co'; }],
  ['userinfo URL', p => { p.apiOrigin = 'http://name@127.0.0.1:56331'; }],
  ['query URL', p => { p.apiOrigin += '?target=remote'; }],
  ['shared binding', p => { p.apiBinding = '0.0.0.0'; }],
  ['wrong repository', p => { p.repositoryId = 7; }],
  ['missing acquired resource', p => { p.containers = []; }],
  ['provider egress', p => { p.providerEgressDenied = false; }],
  ['env fallback', p => { p.envFilesAbsent = false; }],
  ['supplied QA email', p => { p.qaEmail = 'qa-test-production@paisaxe.dev'; }],
]) test(`${name} is rejected before a write or operation`, async t => {
  const h = await harness(t); change(h.profile);
  await assert.rejects(withLocalQaFixture(h.profile, h.options, async () => assert.fail('operation started')));
  assert.equal(h.calls.length, 0);
});

test('no inspector cannot claim resource ownership', async t => {
  const h = await harness(t); delete h.options.inspectProfile;
  await assert.rejects(withLocalQaFixture(h.profile, h.options, async () => {}));
  assert.equal(h.calls.length, 0);
});
test('acquired resource replacement blocks before credentials or writes', async t => {
  const h = await harness(t, { inspection: p => ({ ...p, containers: ['f'.repeat(64)] }) });
  await assert.rejects(withLocalQaFixture(h.profile, h.options, async () => {}));
  assert.equal(h.calls.length, 0);
});
test('internal service requires exact inspected hostname and internal runner binding', () => {
  const profile = { schemaVersion: 1 };
  assert.throws(() => validateLocalQaProfile(profile));
});
for (const fault of ['admin', 'wrongSession', 'badCreatedUser', 'favoritesDeleteFailure', 'favoritesRemaining']) test(`${fault} cannot pass and exact owned cleanup is attempted`, async t => {
  const h = await harness(t, { [fault]: true });
  await assert.rejects(withLocalQaFixture(h.profile, h.options, async () => {}));
  assert.equal(h.alive(), false);
});
test('response lost after POST is reconciled once and cleans only exact intent account', async t => {
  const h = await harness(t, { createLost: true });
  await assert.rejects(withLocalQaFixture(h.profile, h.options, async () => assert.fail('must not execute')));
  assert.equal(h.calls.filter(c => c.key === 'POST /auth/v1/admin/users').length, 1);
  assert.equal(h.alive(), false);
});
test('foreign metadata after create cannot authorize UUID deletion', async t => {
  const h = await harness(t, { transport: ({ key, user, response }) => key === `GET /auth/v1/admin/users/${OWNED}` && user ? response({ ...user, user_metadata: {} }) : undefined });
  await assert.rejects(withLocalQaFixture(h.profile, h.options, async () => {}));
  assert.equal(h.calls.some(c => c.key === `DELETE /auth/v1/admin/users/${OWNED}`), false);
});
test('favorites deletion and operation failures aggregate, later account removal cannot erase failure', async t => {
  const h = await harness(t, { favoritesDeleteFailure: true });
  await assert.rejects(withLocalQaFixture(h.profile, h.options, async () => { throw new Error('failure'); }), e => e.message.includes('operation_failed') && e.message.includes('cleanup_favorites_failed') && e.message.includes('cleanup_unverified'));
  assert.equal(h.alive(), false);
  const deletion = h.calls.find(c => c.key === 'DELETE /rest/v1/user_favorites');
  assert.equal(new URL(deletion.url).searchParams.get('user_id'), `eq.${OWNED}`);
});
test('private journal rejects world-readable directory and symlink before writes', async t => {
  const h = await harness(t); await chmod(h.directory, 0o755);
  await assert.rejects(withLocalQaFixture(h.profile, h.options, async () => {}));
  assert.equal(h.calls.length, 0);
  await chmod(h.directory, 0o700);
  const link = join(h.directory, 'linked'); await symlink(h.directory, link);
  await assert.rejects(withLocalQaFixture(h.profile, { ...h.options, journalDirectory: link }, async () => {}));
  assert.equal(h.calls.length, 0);
});

test('internal profile binds exact acquired runner network and service names', async t => {
  const h = await harness(t);
  Object.assign(h.profile, { mode: 'internal', apiOrigin: `http://${h.profile.projectId}-auth:8000`, appOrigin: `http://${h.profile.projectId}-app:3000`, apiBinding: 'internal-only', appBinding: 'internal-only', runnerNetworkId: h.profile.networks[0] });
  assert.equal((await withLocalQaFixture(h.profile, h.options, async () => {})).cleanup, 'verified');
  h.profile.apiOrigin = 'http://host.docker.internal:8000';
  const prior = h.calls.length;
  await assert.rejects(withLocalQaFixture(h.profile, h.options, async () => {}));
  assert.equal(h.calls.length, prior);
});

for (const [name, response] of [
  ['redirect', () => new Response(null, { status: 302, headers: { location: 'https://remote.invalid' } })],
  ['non JSON', () => new Response('local-service-fixture invalid response')],
  ['oversize body', () => new Response('x'.repeat(1048577))],
  ['admin denied', () => new Response('local-service-fixture', { status: 403 })],
]) test(`external ${name} cannot run operation or expose response secrets`, async t => {
  const h = await harness(t, { transport: ({ key }) => key === 'GET /auth/v1/admin/users' ? response() : undefined });
  await assert.rejects(withLocalQaFixture(h.profile, h.options, async () => assert.fail('operation started')), e => !e.message.includes('local-service-fixture'));
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].init.redirect, 'error');
});

test('hung external request respects a real bounded timeout and consumes eventual rejection', async t => {
  const h = await harness(t, { transport: ({ key, init }) => key === 'GET /auth/v1/admin/users' ? new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('local-service-fixture')), { once: true })) : undefined });
  const started = performance.now();
  await assert.rejects(withLocalQaFixture(h.profile, { ...h.options, requestTimeoutMs: 10 }, async () => {}));
  assert.ok(performance.now() - started < 1000);
  assert.equal(h.calls.length, 1);
});

test('body rejection after deadline is consumed without unhandled rejection', async t => {
  const h = await harness(t, { transport: ({ key }) => key === 'GET /auth/v1/admin/users' ? new Response(new ReadableStream({ start(controller) { setTimeout(() => controller.error(new Error('external body rejected')), 30); } })) : undefined });
  await assert.rejects(withLocalQaFixture(h.profile, { ...h.options, requestTimeoutMs: 10 }, async () => {}));
  await new Promise(resolve => setTimeout(resolve, 40));
});

test('incomplete initial account census cannot prove no existing ownership collision', async t => {
  const h = await harness(t, { transport: ({ key, response }) => key === 'GET /auth/v1/admin/users' ? response({ users: [] }, 200, { 'x-total-count': '101' }) : undefined });
  await assert.rejects(withLocalQaFixture(h.profile, h.options, async () => {}));
  assert.equal(h.calls.length, 1);
});

test('resource replacement during cleanup withholds every subsequent destructive request', async t => {
  let completed = false;
  const h = await harness(t, { inspection: p => completed ? { ...p, containers: ['f'.repeat(64)] } : structuredClone(p) });
  await assert.rejects(withLocalQaFixture(h.profile, h.options, async () => { completed = true; }));
  assert.equal(h.calls.some(c => c.init.method === 'DELETE'), false);
});

test('auth deletion failure survives a passed operation as cleanup_unverified', async t => {
  const h = await harness(t, { transport: ({ key, response }) => key === `DELETE /auth/v1/admin/users/${OWNED}` ? response({ error: 'private' }, 500) : undefined });
  await assert.rejects(withLocalQaFixture(h.profile, h.options, async () => {}), /cleanup_unverified/);
  assert.equal(h.alive(), true);
});

test('journal exclusivity never overwrites an existing invocation', async t => {
  const h = await harness(t);
  await withLocalQaFixture(h.profile, h.options, async () => {});
  const first = await readdir(h.directory);
  await withLocalQaFixture(h.profile, h.options, async () => {});
  const second = await readdir(h.directory);
  assert.equal(second.length, first.length + 1);
});

test('source acquisition manifests and owner observation are required, not just container claims', async t => {
  const h = await harness(t);
  for (const key of ['migrationDigest', 'seedDigest', 'configDigest', 'acquiredAt', 'ownerProcessId']) delete h.profile[key];
  assert.throws(() => validateLocalQaProfile(h.profile));
});

test('no inherited QA/provider credentials or release target enter private handoff', async t => {
  const h = await harness(t);
  await withLocalQaFixture(h.profile, h.options, async ({ env }) => {
    assert.equal(env.RELEASE_TARGET_URL, undefined);
    assert.equal(env.PLAYWRIGHT_USE_DEV_SERVER, undefined);
    for (const key of ['ANTHROPIC_API_KEY', 'VOYAGE_API_KEY', 'ELEVENLABS_API_KEY', 'GOOGLE_PLACES_API_KEY', 'STRIPE_SECRET_KEY']) assert.equal(env[key], '');
  });
});

test('native Auth error_code user_not_found readback accepts exact absence only', async t => {
  let deleted = false;
  const h = await harness(t, { transport: ({ key, response }) => {
    if (key === `DELETE /auth/v1/admin/users/${OWNED}`) deleted = true;
    if (key === `GET /auth/v1/admin/users/${OWNED}` && deleted) return response({ code: 404, error_code: 'user_not_found' }, 404);
    return undefined;
  } });
  assert.equal((await withLocalQaFixture(h.profile, h.options, async () => {})).cleanup, 'verified');
});

test('wrong returned session user cannot authorize revoking a foreign session', async t => {
  const h = await harness(t, { wrongSession: true });
  await assert.rejects(withLocalQaFixture(h.profile, h.options, async () => {}));
  assert.equal(h.calls.some(c => c.key === 'POST /auth/v1/logout'), false);
  assert.equal(h.alive(), false);
});

test('external resource inspector faults are sanitized before any transport', async t => {
  const h = await harness(t);
  h.options.inspectProfile = async () => { throw new Error(secret.serviceKey); };
  await assert.rejects(withLocalQaFixture(h.profile, h.options, async () => {}), e => !e.message.includes(secret.serviceKey));
  assert.equal(h.calls.length, 0);
});

test('missing app profile still attempts exact owned favorites deletion without email RPC', async t => {
  const h = await harness(t, { transport: ({ key, response }) => key === 'GET /rest/v1/user_profiles' ? response([]) : undefined });
  await assert.rejects(withLocalQaFixture(h.profile, h.options, async () => {}));
  assert.equal(h.calls.some(c => c.key === 'POST /rest/v1/rpc/cleanup_qa_test_user'), false);
  assert.equal(h.calls.some(c => c.key === 'DELETE /rest/v1/user_favorites'), true);
  assert.equal(h.alive(), false);
});


for (const fault of ['http', 'foreign']) test(`unverified post-sign-in ${fault} identity preserves session cleanup uncertainty`, async t => {
  const h = await harness(t, { transport: ({ key, response }) => {
    if (key !== 'GET /auth/v1/user') return undefined;
    return fault === 'http' ? response({ error: 'private-session-fault' }, 500) : response({ id: FOREIGN, email: 'foreign@example.invalid' });
  } });
  let operationRan = false;
  const error = await withLocalQaFixture(h.profile, h.options, async () => { operationRan = true; }).catch(e => e);
  assert.equal(operationRan, false);
  assert.equal(h.alive(), false);
  assert.equal(h.calls.some(c => c.key === 'POST /auth/v1/logout'), false);
  assert.match(error.message, /cleanup_session_unverified/);
  assert.match(error.message, /cleanup_unverified/);
  const files = await readdir(h.directory);
  assert.equal(files.length, 1);
  const journal = JSON.parse(await readFile(join(h.directory, files[0]), 'utf8'));
  assert.ok(journal.errors.includes('cleanup_session_unverified'));
  assert.ok(journal.errors.includes('cleanup_unverified'));
});

test('ambiguous sign-in transport preserves session cleanup uncertainty without revoking an unverified token', async t => {
  const h = await harness(t, { transport: ({ key }) => {
    if (key === 'POST /auth/v1/token') throw new Error('private-session-fault');
    return undefined;
  } });
  const error = await withLocalQaFixture(h.profile, h.options, async () => assert.fail('operation started')).catch(e => e);
  assert.equal(h.alive(), false);
  assert.equal(h.calls.some(c => c.key === 'POST /auth/v1/logout'), false);
  assert.match(error.message, /cleanup_session_unverified/);
  assert.match(error.message, /cleanup_unverified/);
  assert.equal(error.message.includes('private-session-fault'), false);
});

test('owned cleanup avoids nonunique email RPC and deletes favorites only by the recorded UUID', async t => {
  const h = await harness(t);
  assert.equal((await withLocalQaFixture(h.profile, h.options, async () => {})).cleanup, 'verified');
  assert.equal(h.calls.some(c => c.key === 'POST /rest/v1/rpc/cleanup_qa_test_user'), false);
  const calls = h.calls.filter(c => c.key === 'DELETE /rest/v1/user_favorites');
  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0].url).searchParams.get('user_id'), `eq.${OWNED}`);
  assert.ok(h.calls.every(c => !c.url.includes(FOREIGN)));
});
