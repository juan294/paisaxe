import { randomBytes } from 'node:crypto';
import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOOPBACK = ['127.0.0.1', 'localhost', '[::1]'];
const MASKED = ['SUPABASE_SERVICE_KEY', 'QA_TEST_USER_PASSWORD', 'CRON_SECRET'];

/** Synthetic environment for the Release artifact smoke: a task-owned local
 * Supabase stack and a throwaway QA user. Never accepts a remote datastore,
 * and never reads repository, QA or production secrets. */
export async function provisionSmokeEnvironment(status, { request = fetch, random = bytes => randomBytes(bytes).toString('hex') } = {}) {
  const { API_URL: api, ANON_KEY: anonKey, SERVICE_ROLE_KEY: serviceKey } = status ?? {};
  if (![api, anonKey, serviceKey].every(value => typeof value === 'string' && value)) throw Error('Smoke environment: local Supabase status lacks API_URL, ANON_KEY or SERVICE_ROLE_KEY; start the local stack first');
  const url = new URL(api);
  if (url.protocol !== 'http:' || !LOOPBACK.includes(url.hostname)) throw Error(`Smoke environment: refusing non-loopback datastore ${url.host}`);
  const email = `qa-test-${random(6)}@paisaxe.dev`, password = random(24);
  const response = await request(new URL('/auth/v1/admin/users', url), { method: 'POST', headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ email, password, email_confirm: true }) });
  if (!response.ok) throw Error(`Smoke environment: synthetic QA user creation failed with HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
  return { NEXT_PUBLIC_SUPABASE_URL: url.origin, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey, SUPABASE_SERVICE_KEY: serviceKey, QA_TEST_USER_EMAIL: email, QA_TEST_USER_PASSWORD: password, CRON_SECRET: random(24) };
}

// Usage: npx supabase status -o json | node scripts/ci-cadence-smoke-env.mjs
// Appends to $GITHUB_ENV on a runner; prints KEY=VALUE lines locally.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    let input = ''; for await (const chunk of process.stdin) input += chunk;
    const environment = await provisionSmokeEnvironment(JSON.parse(input));
    const lines = Object.entries(environment).map(([key, value]) => `${key}=${value}\n`).join('');
    if (process.env.GITHUB_ENV) { for (const key of MASKED) console.log(`::add-mask::${environment[key]}`); await appendFile(process.env.GITHUB_ENV, lines); }
    else process.stdout.write(lines);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
