import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { verifyTransport } from './contract-transport.mjs';

export const REQUIRED_SUITES = [
  'src/lib/database-boundaries.postgrest-rls.test.ts',
  'src/lib/booking/retention.postgrest-integration.test.ts',
  'src/lib/pg-net.postgrest-integration.test.ts',
  'src/lib/feature-flag-consumers.postgrest-integration.test.ts',
  'src/lib/feature-flag-realtime.postgrest-integration.test.ts',
  'src/app/api/feature-flags/route.postgrest-rls.test.ts',
  'src/app/api/webhooks/stripe/route.postgrest-integration.test.ts',
  'src/lib/booking/booking.postgrest-integration.test.ts',
  'src/lib/booking/cancel.postgrest-integration.test.ts',
  'src/lib/booking/capture.postgrest-integration.test.ts',
  'src/lib/booking/invoice.postgrest-integration.test.ts',
  'src/lib/booking/operator.postgrest-integration.test.ts',
  'src/lib/booking/phone-confirmation.postgrest-integration.test.ts',
  'src/lib/booking/reconcile.postgrest-integration.test.ts',
  'src/lib/booking/tools.postgrest-integration.test.ts',
  'src/lib/booking/vouchers.postgrest-integration.test.ts',
  'src/lib/definer-function-privileges.postgrest-rls.test.ts',
  'src/lib/match-chunks.postgrest-rls.test.ts',
  'src/lib/proxy/maintenance.postgrest-integration.test.ts',
  'src/lib/stories-rls.postgrest-rls.test.ts',
];
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const insist = (condition, message) => { if (!condition) throw new Error(message); };
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));

export function discoverSuites(root, required = REQUIRED_SUITES) {
  const visit = (dir) => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    insist(!entry.isSymbolicLink(), `Symlink in required suite tree: ${path}`);
    return entry.isDirectory() ? visit(path) : /\.postgrest-(?:rls|integration)\.test\.ts$/.test(path) ? [path] : [];
  });
  const suites = visit('src').sort();
  insist(suites.length > 0, 'Discovered zero required PostgREST suites');
  for (const path of required) insist(suites.includes(path), `Missing required suite: ${path}`);
  return suites;
}

export function migrationInventory(root) {
  const directory = join(root, 'supabase/migrations');
  const files = readdirSync(directory).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
  insist(files.length > 0, 'No candidate migrations');
  const versions = files.map((name) => name.split('_')[0]);
  insist(new Set(versions).size === versions.length, 'Duplicate migration versions');
  const digest = sha256(files.map((name) => `${name}\0${sha256(readFileSync(join(directory, name)))}\n`).join(''));
  return { files, versions, digest };
}

/** Source identity includes adapters, tests, helpers, runner, fixtures and configuration, not just SQL. */
export function candidateDigest(root) {
  const files = [];
  const visit = (path) => {
    if (!existsSync(join(root, path))) return;
    const info = lstatSync(join(root, path));
    insist(!info.isSymbolicLink(), `Symlink in contract candidate inputs: ${path}`);
    if (info.isDirectory()) for (const name of readdirSync(join(root, path)).sort()) visit(join(path, name));
    else files.push(path);
  };
  for (const path of ['src', 'scripts', 'supabase/migrations', 'supabase/config.toml', 'supabase/seed.sql',
    'tests/fixtures', 'package.json', 'package-lock.json', 'vitest.config.ts', 'tsconfig.json', 'next.config.ts']) visit(path);
  return sha256(files.sort().map((path) => `${path}\0${sha256(readFileSync(join(root, path)))}\n`).join(''));
}

export function validateManifest(data, taskDir) {
  insist(data?.version === 1, 'Missing or unsupported task stack marker');
  insist(/^paisaxe-contracts-[a-f0-9]{12}$/.test(data.projectId), 'Refusing shared/default project; prepare a fresh contracts stack');
  insist(!lstatSync(taskDir).isSymbolicLink() && realpathSync(taskDir) === data.taskDir,
    'Task directory identity mismatch or symlink');
  insist(basename(taskDir).startsWith('paisaxe-contracts-'), 'Task directory must be freshly prepared by prepare-contract-stack');
  insist(/^[a-f0-9-]{36}$/.test(data.nonce), 'Invalid task nonce');
  const api = new URL(data.apiUrl);
  insist(api.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(api.hostname) &&
    !api.username && !api.password && api.pathname === '/' && !api.search && !api.hash,
  'Only literal loopback HTTP stack URLs are allowed');
  insist(/^\d+$/.test(api.port) && Number(api.port) >= 1024 && Number(api.port) !== 54321, 'Shared/default API port refused');
  insist(Number.isInteger(data.dbPort) && data.dbPort >= 1024 && data.dbPort <= 65535 && data.dbPort !== 54322,
    'Shared/default or invalid database port refused');
  for (const name of ['migrationDigest', 'schemaDigest']) insist(/^[a-f0-9]{64}$/.test(data[name]), `Invalid ${name}`);
  insist(data.transport === undefined || data.transport === 'docker-exec-v1', 'Unknown task transport');
  return data;
}

export function isolatedEnvironment(inherited, manifest, keys, dockerHost) {
  const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'SYSTEMROOT'].filter((name) => inherited[name]).map((name) => [name, inherited[name]]));
  return { ...env, CI: '1', NODE_ENV: 'test', DOCKER_HOST: dockerHost, SUPABASE_TELEMETRY_DISABLED: '1',
    SUPABASE_LOCAL_API_URL: manifest.apiUrl, SUPABASE_LOCAL_REST_URL: `${manifest.apiUrl}/rest/v1`,
    SUPABASE_LOCAL_DB_CONTAINER: `supabase_db_${manifest.projectId}`,
    SUPABASE_LOCAL_DB_URL: keys.dbUrl,
    SUPABASE_LOCAL_DB_MARKER: `paisaxe-contracts:${manifest.nonce}:${manifest.migrationDigest}`,
    SUPABASE_LOCAL_ANON_KEY: keys.anon, SUPABASE_LOCAL_SERVICE_ROLE_KEY: keys.service,
    NEXT_PUBLIC_SUPABASE_URL: manifest.apiUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: keys.anon,
    SUPABASE_SERVICE_ROLE_KEY: keys.service, SUPABASE_SERVICE_KEY: keys.service, NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3000' };
}

export function validateReport(report, suites, root) {
  insist(suites.length > 0, 'Required suite selection is zero');
  insist(report?.success === true && Array.isArray(report.testResults), 'Missing/malformed or unsuccessful contract report');
  for (const field of ['numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'numTodoTests', 'numFailedTestSuites', 'numPendingTestSuites']) {
    insist(Number.isInteger(report[field]) && report[field] >= 0, `Malformed report counter ${field}`);
  }
  insist(report.numTotalTests > 0, 'Required contract run collected zero cases');
  for (const field of ['numFailedTests', 'numPendingTests', 'numTodoTests', 'numFailedTestSuites', 'numPendingTestSuites']) {
    insist(report[field] === 0, `Required contract report has ${field}: ${report[field]}`);
  }
  insist(report.numPassedTests === report.numTotalTests, 'Required cases did not all pass');
  const seen = new Set(); let count = 0;
  const results = report.testResults.map((suite) => {
    insist(typeof suite.name === 'string', 'Malformed suite path');
    const file = relative(root, resolve(root, suite.name));
    insist(suites.includes(file) && !seen.has(file), `Unknown or duplicate required suite: ${file}`); seen.add(file);
    insist(suite.status === 'passed' && suite.message === '', `Required suite/hook/cleanup failed: ${file}`);
    insist(Array.isArray(suite.assertionResults) && suite.assertionResults.length > 0, `Required suite has zero cases: ${file}`);
    const cases = suite.assertionResults.map((item) => {
      insist(item.status === 'passed' && Array.isArray(item.failureMessages) && item.failureMessages.length === 0,
        `Required case did not pass in ${file}`);
      insist(typeof item.fullName === 'string' && item.fullName.length > 0, `Malformed case in ${file}`);
      count++; return item.fullName;
    });
    return { file, cases };
  });
  insist(seen.size === suites.length, 'Missing required suite from report');
  insist(count === report.numTotalTests, 'Report case count does not match collected cases');
  return results;
}

export function localDockerEnvironment(inherited = process.env) {
  const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'SYSTEMROOT'].filter((name) => inherited[name]).map((name) => [name, inherited[name]]));
  const host = inherited.DOCKER_HOST || JSON.parse(execFileSync('docker', ['context', 'inspect'], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 }))[0]?.Endpoints?.docker?.Host;
  insist(typeof host === 'string' && host.startsWith('unix:///') && !host.includes('\n'), 'Refusing a remote Docker daemon; select a local Unix socket context');
  return { ...env, DOCKER_HOST: host, SUPABASE_TELEMETRY_DISABLED: '1' };
}

export function dockerSql(projectId, sql, env) {
  return execFileSync('docker', ['exec', '-i', `supabase_db_${projectId}`, 'psql', '-X', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-t', '-A', '-c', sql],
    { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 }).trim();
}

export function schemaDigest(projectId, env) {
  const dump = execFileSync('docker', ['exec', `supabase_db_${projectId}`, 'pg_dump', '-U', 'postgres', '--schema-only', '--no-owner', 'postgres'],
    { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  return sha256(dump.split('\n').filter((line) => !/^\\(?:un)?restrict\b/.test(line)).join('\n'));
}

export async function inspectStack(manifest, env) {
  if (manifest.transport === 'docker-exec-v1') await verifyTransport(manifest, env);
  const apiPort = new URL(manifest.apiUrl).port;
  const network = manifest.projectId;
  const [networkData] = JSON.parse(execFileSync('docker', ['network', 'inspect', network], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 }));
  insist(networkData?.Internal === true && networkData.Labels?.['com.paisaxe.contracts.nonce'] === manifest.nonce,
    'Task network must be private/internal with the matching ownership nonce');
  const containers = Object.values(networkData.Containers || {}).map((item) => item.Name);
  const projectContainers = execFileSync('docker', ['ps', '-a', '--filter', `label=com.supabase.cli.project=${manifest.projectId}`, '--format', '{{.Names}}'],
    { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 }).trim().split('\n').filter(Boolean);
  insist(JSON.stringify([...containers].sort()) === JSON.stringify(projectContainers.sort()),
    'Task project container inventory differs from its internal network; refusing detached/outbound containers');
  for (const kind of ['db', 'kong']) insist(containers.includes(`supabase_${kind}_${manifest.projectId}`), `Task network is missing its ${kind} container`);
  for (const name of containers) {
    insist(typeof name === 'string' && name.startsWith('supabase_') && name.endsWith('_' + manifest.projectId), 'Unexpected container on task network');
    const [data] = JSON.parse(execFileSync('docker', ['inspect', name], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 }));
    insist(data?.Config?.Labels?.['com.supabase.cli.project'] === manifest.projectId &&
      JSON.stringify(Object.keys(data.NetworkSettings?.Networks || {})) === JSON.stringify([network]),
    'Task container ownership/network mismatch; refusing outbound attachment');
  }
  for (const [kind, containerPort, hostPort] of [['db', '5432/tcp', String(manifest.dbPort)], ['kong', '8000/tcp', apiPort]]) {
    const name = `supabase_${kind}_${manifest.projectId}`;
    const [data] = JSON.parse(execFileSync('docker', ['inspect', name], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 }));
    insist(data?.Name === '/' + name && data.State?.Running === true && data.Config?.Labels?.['com.supabase.cli.project'] === manifest.projectId,
      `Docker ${kind} task identity/running state mismatch`);
    insist(!data.State.Health || data.State.Health.Status === 'healthy', `Docker ${kind} task is not healthy`);
    insist(JSON.stringify(Object.keys(data.NetworkSettings?.Networks || {})) === JSON.stringify([network]),
      `Docker ${kind} is attached to an unexpected outbound network`);
    const bindings = data.NetworkSettings?.Ports?.[containerPort];
    insist(manifest.transport === 'docker-exec-v1' || Array.isArray(bindings) && bindings.some((binding) => binding.HostPort === hostPort && ['127.0.0.1', '::1', '0.0.0.0', '::'].includes(binding.HostIp)),
      `Docker ${kind} port does not match task endpoint`);
  }
}

function validateKeys(status, manifest) {
  insist(status.API_URL === manifest.apiUrl, 'Supabase status API endpoint differs from task marker');
  const db = new URL(status.DB_URL);
  insist(db.protocol === 'postgresql:' && db.hostname === '127.0.0.1' && db.port === String(manifest.dbPort) &&
    db.username === 'postgres' && db.pathname === '/postgres' && !db.search && !db.hash,
  'Supabase status database endpoint differs from task marker');
  const keys = { anon: status.ANON_KEY, service: status.SERVICE_ROLE_KEY };
  for (const [role, key] of Object.entries(keys)) {
    insist(typeof key === 'string' && key.split('.').length === 3, `Missing local ${role} JWT`);
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    insist(payload.iss === 'supabase-demo' && payload.role === (role === 'service' ? 'service_role' : 'anon') && payload.exp * 1000 > Date.now(), `Invalid/expired local ${role} JWT`);
  }
  return { ...keys, dbUrl: status.DB_URL };
}

async function positiveControls(manifest, keys) {
  for (const [role, table, key] of [['anon', 'feature_flags_public', keys.anon], ['service_role', 'feature_flags', keys.service]]) {
    const result = await fetch(`${manifest.apiUrl}/rest/v1/${table}?select=flag_key,enabled&flag_key=eq.maintenance_mode&environment=eq.development`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(5000) });
    insist(result.ok, `Failed ${role} positive data control (HTTP ${result.status})`);
    const rows = await result.json();
    insist(Array.isArray(rows) && rows.length === 1 && rows[0].flag_key === 'maintenance_mode' && typeof rows[0].enabled === 'boolean', `Failed ${role} positive data control: expected seeded maintenance flag`);
  }
}

export async function runContracts({ root = process.cwd(), taskDir = process.env.CONTRACT_STACK_DIR, outputDir } = {}) {
  const receiptDir = outputDir || mkdtempSync(join(tmpdir(), 'paisaxe-contract-receipt-'));
  mkdirSync(receiptDir, { recursive: true });
  // The report is always a new, private file. A report from an earlier run cannot pass this run.
  const runDir = mkdtempSync(join(receiptDir, 'run-'));
  const receipt = { version: 1, status: 'failed', startedAt: new Date().toISOString(), root: resolve(root), suites: [] };
  const failures = [];
  try {
    receipt.suites = discoverSuites(root);
    receipt.candidateDigest = candidateDigest(root);
    const fixtureCheck = join(root, 'scripts/check-provider-fixtures.mjs');
    if (existsSync(fixtureCheck)) {
      const provider = spawnSync(process.execPath, [fixtureCheck], { cwd: root, env: { PATH: process.env.PATH, HOME: process.env.HOME }, encoding: 'utf8', timeout: 30000 });
      receipt.providerFixtures = { exitCode: provider.status, output: provider.stdout };
      if (provider.status !== 0) failures.push('Provider fixture freshness/qualification is unverified; see providerFixtures receipt');
    } else failures.push('Required provider fixture freshness checker is missing');
    insist(taskDir, 'CONTRACT_STACK_DIR is required; run node scripts/prepare-contract-stack.mjs first');
    const manifest = validateManifest(json(join(taskDir, 'contracts-stack.json')), taskDir);
    const inventory = migrationInventory(root);
    insist(inventory.digest === manifest.migrationDigest, 'Candidate migrations changed; prepare a fresh contracts stack');
    receipt.migrationDigest = inventory.digest; receipt.projectId = manifest.projectId;
    const config = readFileSync(join(taskDir, 'supabase/config.toml'), 'utf8');
    insist(config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1] === manifest.projectId, 'Task Supabase project config mismatch');
    const dockerEnv = { ...localDockerEnvironment(), HOME: runDir }; await inspectStack(manifest, dockerEnv);
    const marker = `paisaxe-contracts:${manifest.nonce}:${manifest.migrationDigest}`;
    insist(dockerSql(manifest.projectId, "SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname=current_database();", dockerEnv) === marker, 'Database task marker mismatch; refusing database fixtures');
    const versions = JSON.parse(dockerSql(manifest.projectId, 'SELECT coalesce(json_agg(version ORDER BY version), \'[]\'::json) FROM supabase_migrations.schema_migrations;', dockerEnv));
    insist(JSON.stringify(versions) === JSON.stringify(inventory.versions), 'Actual database migration inventory differs from candidate');
    insist(schemaDigest(manifest.projectId, dockerEnv) === manifest.schemaDigest, 'Task database schema changed; prepare a fresh contracts stack');
    insist(dockerSql(manifest.projectId, "SELECT count(*) FROM public.webhook_config WHERE key IN ('base_url','secret') AND value <> '';", dockerEnv) === '0',
      'Task webhook outbound configuration is not disabled');
    insist(dockerSql(manifest.projectId, 'SELECT count(*) FROM cron.job WHERE active;', dockerEnv) === '0', 'Task cron jobs must be disabled');
    const status = JSON.parse(execFileSync('supabase', ['status', '--workdir', taskDir, '--output', 'json'], { env: dockerEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 }));
    const keys = validateKeys(status, manifest);
    const sqlVersion = execFileSync('psql', ['--version'], { env: dockerEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000 });
    const sqlClient = /^psql \(PostgreSQL\) \d+\.\d+(?:\.\d+)?/.exec(sqlVersion)?.[0];
    insist(sqlClient, 'Native PostgreSQL client is unavailable'); receipt.nativeSqlClient = sqlClient;
    await positiveControls(manifest, keys);
    receipt.positiveControls = ['anon seeded maintenance flag', 'service_role seeded maintenance flag'];
    const reportPath = join(runDir, 'vitest.json');
    const configPath = join(runDir, 'vitest.config.mjs');
    // Keep the repository's real adapters/config, but never load its ignored provider dotenv files.
    writeFileSync(configPath, `import original from ${JSON.stringify(pathToFileURL(join(root, 'vitest.config.ts')).href)};\nexport default {...original,root:${JSON.stringify(resolve(root))},envDir:${JSON.stringify(runDir)}};\n`);
    const result = spawnSync(process.execPath, [join(root, 'node_modules/vitest/vitest.mjs'), 'run', ...receipt.suites,
      '--config', configPath, '--maxWorkers=1', '--no-file-parallelism', '--reporter=json', '--outputFile', reportPath],
    { cwd: root, env: isolatedEnvironment({ ...process.env, HOME: runDir }, manifest, keys, dockerEnv.DOCKER_HOST), encoding: 'utf8', timeout: 1200000, maxBuffer: 32 * 1024 * 1024 });
    // Vitest output can contain query diagnostics. Preserve it privately while
    // keeping only the validated case inventory in the public receipt.
    writeFileSync(join(runDir, 'vitest-output.log'), [result.stdout ?? '', result.stderr ?? ''].join('\n'), { mode: 0o600 });
    receipt.vitestExitCode = result.status; receipt.vitestSignal = result.signal;
    if (result.error || result.status !== 0) failures.push('Vitest contract process failed, timed out or was terminated');
    try { receipt.cases = validateReport(json(reportPath), receipt.suites, resolve(root)); }
    catch (error) { failures.push(error instanceof SyntaxError ? 'Missing/malformed or unsuccessful contract report' : error.message); }
    try {
      await inspectStack(manifest, dockerEnv);
      insist(schemaDigest(manifest.projectId, dockerEnv) === manifest.schemaDigest, 'Cleanup left database schema changed');
    } catch { failures.push('Contract cleanup/stack health check failed'); }
    insist(candidateDigest(root) === receipt.candidateDigest, 'Candidate source inputs changed during contract run; rerun the complete tier');
  } catch (error) {
    // External command errors may embed credentials in stdout/stderr. Never serialize those fields.
    failures.push(error instanceof SyntaxError ? 'Malformed local contract data; inspect private diagnostics' :
      error.status !== undefined || error.code ? 'Local stack command unavailable/failed; check local Docker and prepare a fresh task stack' : error.message);
  }
  receipt.failures = failures; receipt.status = failures.length ? 'failed' : 'passed'; receipt.finishedAt = new Date().toISOString();
  writeFileSync(join(runDir, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
  return { ...receipt, receiptPath: join(runDir, 'receipt.json') };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const receipt = await runContracts();
  console.log(`Database contracts ${receipt.status}; receipt: ${receipt.receiptPath}`);
  for (const failure of receipt.failures) console.error(failure);
  if (receipt.status !== 'passed') process.exitCode = 1;
}
