import { randomBytes, createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, realpath, open } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const LIMITS = Object.freeze({ requests: 32, bodyBytes: 1048576, requestMs: 5000, phaseMs: 30000, census: 100 });
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const HEX32 = /^[a-f0-9]{32}$/;
const HEX64 = /^[a-f0-9]{64}$/;
const PROFILE_KEYS = new Set(['schemaVersion', 'repositoryId', 'nonce', 'checkoutSha', 'inputDigest', 'workspace', 'projectId', 'mode', 'apiOrigin', 'appOrigin', 'containers', 'networks', 'volumes', 'baselineAuthUserIds', 'envFilesAbsent', 'providerEgressDenied', 'apiBinding', 'appBinding', 'runnerNetworkId', 'migrationDigest', 'seedDigest', 'configDigest', 'acquiredAt', 'ownerProcessId']);
const PROVIDER_ENV = ['ANTHROPIC_API_KEY', 'VOYAGE_API_KEY', 'ELEVENLABS_API_KEY', 'CONVAI_AGENT_ID', 'NEXT_PUBLIC_CONVAI_AGENT_ID', 'NEXT_PUBLIC_ELEVENLABS_AGENT_ID', 'ELEVENLABS_AGENT_ID', 'GOOGLE_PLACES_API_KEY', 'OPENWEATHERMAP_API_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'RESEND_API_KEY', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'NEXT_PUBLIC_POSTHOG_KEY', 'POSTHOG_API_KEY', 'SENTRY_AUTH_TOKEN', 'SENTRY_DSN', 'NEXT_PUBLIC_SENTRY_DSN', 'STRIPE_SECRET_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'];

class FixtureError extends Error {
  constructor(code) { super(code); this.name = 'LocalQaFixtureError'; this.code = code; }
}
const fail = code => { throw new FixtureError(code); };
const matches = (pattern, value) => typeof value === 'string' && pattern.test(value);
const uniqueArray = (value, predicate, allowEmpty = false) => Array.isArray(value) && (allowEmpty || value.length > 0) && value.length <= 100 && new Set(value).size === value.length && value.every(predicate);
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function origin(value) {
  if (typeof value !== 'string') fail('profile_origin_invalid');
  let url;
  try { url = new URL(value); } catch { fail('profile_origin_invalid'); }
  if (url.protocol !== 'http:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || !url.port || url.origin !== value) fail('profile_origin_invalid');
  return url;
}

/** Root supplies a trusted fresh resource inspector. JSON/localhost alone is
 * never acquisition proof; this pure validator only checks the claim shape. */
export function validateLocalQaProfile(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !PROFILE_KEYS.has(k))) fail('profile_invalid');
  if (value.schemaVersion !== 1 || value.repositoryId !== 1141286326 || !matches(HEX32, value.nonce) || !matches(/^[a-f0-9]{40}$/, value.checkoutSha) || !matches(HEX64, value.inputDigest) || typeof value.workspace !== 'string' || !isAbsolute(value.workspace) || value.projectId !== `ci-cadence-qa-${value.nonce}`) fail('profile_identity_invalid');
  if (!['migrationDigest', 'seedDigest', 'configDigest'].every(k => matches(HEX64, value[k])) || !Number.isSafeInteger(value.ownerProcessId) || value.ownerProcessId <= 0 || !matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, value.acquiredAt) || !Number.isFinite(Date.parse(value.acquiredAt)) || new Date(value.acquiredAt).toISOString() !== value.acquiredAt || Date.parse(value.acquiredAt) > Date.now()) fail('profile_acquisition_invalid');
  if (!uniqueArray(value.containers, id => matches(HEX64, id)) || !uniqueArray(value.networks, id => matches(HEX64, id)) || !uniqueArray(value.volumes, id => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{1,100}$/.test(id)) || !uniqueArray(value.baselineAuthUserIds, id => matches(UUID, id), true) || value.envFilesAbsent !== true || value.providerEgressDenied !== true) fail('profile_resources_invalid');
  const api = origin(value.apiOrigin), app = origin(value.appOrigin);
  if (api.origin === app.origin) fail('profile_origins_collide');
  if (value.mode === 'loopback') {
    if (![api, app].every(url => ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) || value.apiBinding !== api.hostname || value.appBinding !== app.hostname || value.runnerNetworkId !== undefined) fail('profile_binding_invalid');
  } else if (value.mode === 'internal') {
    if (api.hostname !== `${value.projectId}-auth` || app.hostname !== `${value.projectId}-app` || value.apiBinding !== 'internal-only' || value.appBinding !== 'internal-only' || !value.networks.includes(value.runnerNetworkId)) fail('profile_binding_invalid');
  } else fail('profile_mode_invalid');
  return freeze(structuredClone(value));
}

async function bounded(operation, milliseconds, abort) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => { timer = setTimeout(() => { abort?.(); reject(new FixtureError('transport_timeout')); }, Math.max(1, milliseconds)); }),
    ]);
  } finally { clearTimeout(timer); }
}
function createTransport(profile, options) {
  let count = 0, deadline = performance.now() + LIMITS.phaseMs;
  const timeout = options.requestTimeoutMs ?? LIMITS.requestMs;
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > LIMITS.requestMs) fail('request_timeout_invalid');
  const verify = async () => {
    const remaining = Math.min(timeout, deadline - performance.now());
    if (remaining <= 0) fail('phase_timeout');
    let current;
    try { current = await bounded(() => options.inspectProfile(), remaining); }
    catch (error) { if (error instanceof FixtureError) throw error; fail('profile_inspection_failed'); }
    if (!isDeepStrictEqual(current, profile)) fail('profile_drift');
  };
  const request = async (path, { method = 'GET', body, token = options.secrets.serviceKey, anon = false, allowNotFound = false } = {}) => {
    await verify();
    if (++count > LIMITS.requests) fail('request_budget');
    const url = new URL(path, profile.apiOrigin);
    if (url.origin !== profile.apiOrigin || !path.startsWith('/') || path.startsWith('//')) fail('transport_origin_invalid');
    const controller = new AbortController();
    const ms = Math.min(timeout, deadline - performance.now());
    if (ms <= 0) fail('phase_timeout');
    let reader;
    try {
      return await bounded(async () => {
        const response = await (options.fetchImpl ?? fetch)(url.href, {
          method, redirect: 'error', signal: controller.signal,
          headers: { apikey: anon ? options.secrets.anonKey : options.secrets.serviceKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (response.redirected || (response.url && new URL(response.url).origin !== profile.apiOrigin)) fail('transport_redirect');
        if (!(allowNotFound && response.status === 404) && !response.ok) fail('transport_http_failed');
        if (response.status === 204) return { data: null, status: 204, headers: response.headers };
        reader = response.body?.getReader();
        if (!reader) fail('transport_body_missing');
        const chunks = []; let length = 0;
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          length += chunk.value.length;
          if (length > LIMITS.bodyBytes) fail('transport_body_limit');
          chunks.push(Buffer.from(chunk.value));
        }
        let data;
        try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('transport_json_invalid'); }
        return { data, status: response.status, headers: response.headers };
      }, ms, () => { controller.abort(); if (reader) void reader.cancel().catch(() => {}); });
    } catch (error) {
      controller.abort(); if (reader) void reader.cancel().catch(() => {});
      if (error instanceof FixtureError) throw error;
      fail('transport_failed');
    }
  };
  return { request, verify, resetDeadline: () => { deadline = performance.now() + LIMITS.phaseMs; }, requestCount: () => count };
}
async function journal(directory, intent) {
  if (typeof directory !== 'string' || !isAbsolute(directory)) fail('journal_directory_invalid');
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o777) !== 0o700 || await realpath(directory) !== directory) fail('journal_directory_invalid');
  const handle = await open(join(directory, `${intent.nonce}.json`), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  return {
    save: async state => { await handle.truncate(0); await handle.write(JSON.stringify({ ...intent, ...state }) + '\n', 0, 'utf8'); await handle.sync(); },
    close: () => handle.close(),
  };
}
function ownedUser(user, intent) {
  return user && matches(UUID, user.id) && user.email === intent.email && user.user_metadata?.fixture === 'ci-cadence-local-qa-v1' && user.user_metadata?.nonce === intent.nonce && typeof user.email_confirmed_at === 'string' && Number.isFinite(Date.parse(user.email_confirmed_at));
}
async function census(transport) {
  const { data, headers } = await transport.request('/auth/v1/admin/users?page=1&per_page=100');
  const raw = headers.get('x-total-count');
  if (!raw || !/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) > LIMITS.census || !Array.isArray(data?.users) || Number(raw) !== data.users.length || !uniqueArray(data.users.map(u => u?.id), id => matches(UUID, id), true) || headers.get('link')?.includes('rel="next"')) fail('account_census_invalid');
  return data.users;
}
async function profileRows(transport, userId) {
  const { data } = await transport.request(`/rest/v1/user_profiles?user_id=eq.${userId}&select=user_id,email,role`);
  if (!Array.isArray(data)) fail('profile_schema_invalid');
  return data;
}
function checkProfile(rows, user, intent) {
  if (rows.length !== 1 || rows[0].user_id !== user.id || rows[0].email !== intent.email || rows[0].role !== 'user') fail('created_profile_invalid');
}

/** Operation is root's awaited, joined child boundary. This unit neither
 * starts services nor qualifies browser reports. Only operation receives the
 * private credentials; return/error/journal contain sanitized summaries. */
export async function withLocalQaFixture(input, options, operation) {
  const profile = validateLocalQaProfile(input);
  if (!options || typeof options.inspectProfile !== 'function' || typeof operation !== 'function' || !options.secrets || Object.keys(options.secrets).some(k => !['anonKey', 'serviceKey'].includes(k)) || !['anonKey', 'serviceKey'].every(k => typeof options.secrets[k] === 'string' && options.secrets[k].trim() === options.secrets[k] && options.secrets[k].length > 0 && !/[\r\n]/.test(options.secrets[k]))) fail('local_qa_options_invalid');
  // Snapshot secrets/options before any await; no inherited env fallback.
  options = { ...options, secrets: Object.freeze({ ...options.secrets }) };
  const transport = createTransport(profile, options);
  await transport.verify();
  const nonce = randomBytes(16).toString('hex');
  const intent = { nonce, email: `qa-test-${nonce}@paisaxe.dev`, profileDigest: createHash('sha256').update(JSON.stringify(profile)).digest('hex') };
  const record = await journal(options.journalDirectory, intent);
  let user, session, creationAttempted = false, signInAttempted = false;
  const errors = [];
  const capture = async (code, action) => {
    try { return await action(); } catch { errors.push(code); return undefined; }
  };
  try {
    await record.save({ state: 'intent' });
    const existing = await census(transport);
    if (!isDeepStrictEqual(existing.map(u => u.id).sort(), [...profile.baselineAuthUserIds].sort()) || existing.some(u => u.email === intent.email)) fail('account_baseline_drift');
    const password = randomBytes(32).toString('hex');
    creationAttempted = true;
    const created = (await transport.request('/auth/v1/admin/users', { method: 'POST', body: { email: intent.email, password, email_confirm: true, user_metadata: { fixture: 'ci-cadence-local-qa-v1', nonce } } })).data;
    if (!ownedUser(created, intent) || profile.baselineAuthUserIds.includes(created.id)) fail('created_user_invalid');
    user = created;
    await record.save({ state: 'created', userId: user.id });
    checkProfile(await profileRows(transport, user.id), user, intent);
    signInAttempted = true;
    const signedIn = (await transport.request('/auth/v1/token?grant_type=password', { method: 'POST', anon: true, token: options.secrets.anonKey, body: { email: intent.email, password } })).data;
    if (signedIn?.user?.id !== user.id || signedIn.user.email !== intent.email || !['access_token', 'refresh_token'].every(k => typeof signedIn[k] === 'string' && signedIn[k].length > 0) || !Number.isSafeInteger(signedIn.expires_in) || signedIn.expires_in <= 0 || signedIn.token_type !== 'bearer') fail('session_invalid');
    const authenticated = (await transport.request('/auth/v1/user', { anon: true, token: signedIn.access_token })).data;
    if (authenticated?.id !== user.id || authenticated.email !== intent.email) fail('session_identity_invalid');
    session = signedIn;
    const env = Object.fromEntries(PROVIDER_ENV.map(key => [key, '']));
    Object.assign(env, {
      CI: 'true', REQUIRE_AUTH_JOURNEYS: 'true', CI_CADENCE_LOCAL_QA: '1',
      CI_CADENCE_QA_USER_ID: user.id, CI_CADENCE_QA_NONCE: nonce,
      CI_CADENCE_QA_API_ORIGIN: profile.apiOrigin, CI_CADENCE_QA_APP_ORIGIN: profile.appOrigin,
      CI_CADENCE_QA_PROJECT_ID: profile.projectId, CI_CADENCE_QA_MODE: profile.mode,
      QA_TEST_USER_EMAIL: intent.email, QA_TEST_USER_PASSWORD: password,
      NEXT_PUBLIC_SUPABASE_URL: profile.apiOrigin, NEXT_PUBLIC_SUPABASE_ANON_KEY: options.secrets.anonKey,
      SUPABASE_SERVICE_KEY: options.secrets.serviceKey, MAINTENANCE_MODE: 'false',
      PLAYWRIGHT_REUSE_SERVER: 'false', PLAYWRIGHT_PORT: new URL(profile.appOrigin).port,
    });
    await record.save({ state: 'operation', userId: user.id });
    await capture('operation_failed', () => operation(Object.freeze({ userId: user.id, env: Object.freeze(env) })));
  } catch (error) { errors.push(error instanceof FixtureError ? error.code : 'provision_failed'); }
  finally {
    transport.resetDeadline();
    if (signInAttempted && !session) errors.push('cleanup_session_unverified');
    if (!user && creationAttempted) {
      const users = await capture('cleanup_reconciliation_failed', () => census(transport));
      const found = users?.filter(u => ownedUser(u, intent) && !profile.baselineAuthUserIds.includes(u.id));
      if (found?.length === 1) user = found[0];
      else errors.push('cleanup_unverified');
    }
    if (user) {
      const current = await capture('cleanup_identity_failed', async () => {
        const actual = (await transport.request(`/auth/v1/admin/users/${user.id}`)).data;
        if (!ownedUser(actual, intent) || actual.id !== user.id) fail('cleanup_ownership_invalid');
        return actual;
      });
      if (current) {
        if (session?.access_token) await capture('cleanup_revoke_failed', () => transport.request('/auth/v1/logout?scope=global', { method: 'POST', token: session.access_token, anon: true }));
        const rows = await capture('cleanup_profile_failed', () => profileRows(transport, user.id));
        if (rows?.length !== 1 || rows[0].user_id !== user.id || rows[0].email !== intent.email) errors.push('cleanup_profile_failed');
        // Profile email is nonunique; cleanup must use only the owned Auth UUID.
        await capture('cleanup_favorites_failed', () => transport.request(`/rest/v1/user_favorites?user_id=eq.${user.id}`, { method: 'DELETE' }));
        await capture('cleanup_favorites_readback_failed', async () => {
          const data = (await transport.request(`/rest/v1/user_favorites?user_id=eq.${user.id}&select=id,user_id`)).data;
          if (!Array.isArray(data) || data.length !== 0) fail('cleanup_favorites_remaining');
        });
        await capture('cleanup_auth_delete_failed', () => transport.request(`/auth/v1/admin/users/${user.id}`, { method: 'DELETE', body: { should_soft_delete: false } }));
        await capture('cleanup_auth_readback_failed', async () => {
          const response = await transport.request(`/auth/v1/admin/users/${user.id}`, { allowNotFound: true });
          if (response.status !== 404 || (response.data?.code !== 'user_not_found' && response.data?.error_code !== 'user_not_found')) fail('cleanup_auth_remaining');
        });
        await capture('cleanup_profile_readback_failed', async () => { if ((await profileRows(transport, user.id)).length !== 0) fail('cleanup_profile_remaining'); });
      }
      if (!current || errors.some(code => code.startsWith('cleanup_'))) errors.push('cleanup_unverified');
    }
    await capture('journal_write_failed', () => record.save({ state: errors.length ? 'failed' : 'verified', userId: user?.id, errors: [...new Set(errors)] }));
    await capture('journal_close_failed', () => record.close());
  }
  if (errors.length) throw new FixtureError([...new Set(errors)].join(','));
  return Object.freeze({ userId: user.id, cleanup: 'verified', requestCount: transport.requestCount(), profileDigest: intent.profileDigest });
}
