import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync, realpathSync, readFileSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverSuites, validateReport, validateManifest, isolatedEnvironment, migrationInventory, runContracts, REQUIRED_SUITES, sha256, candidateDigest } from './run-contracts.mjs';

const suite = 'src/lib/stories-rls.postgrest-rls.test.ts';
function report() {
  return { success: true, numTotalTests: 1, numPassedTests: 1, numFailedTests: 0,
    numPendingTests: 0, numTodoTests: 0, numFailedTestSuites: 0, numPendingTestSuites: 0,
    testResults: [{ name: '/candidate/' + suite, status: 'passed', message: '',
      assertionResults: [{ title: 'allowed read', fullName: 'allowed read', status: 'passed', failureMessages: [] }] }] };
}
test('valid report retains exact cases and suite paths', () => {
  assert.deepEqual(validateReport(report(), [suite], '/candidate'), [{ file: suite, cases: ['allowed read'] }]);
});
for (const state of ['pending', 'skipped', 'todo', 'failed']) {
  test(`required case ${state} is a failure even when the summary claims success`, () => {
    const data = report(); data.testResults[0].assertionResults[0].status = state;
    assert.throws(() => validateReport(data, [suite], '/candidate'), /case|passed/);
  });
}
test('zero cases, absent suite and unknown extra suite fail', () => {
  const zero = report(); zero.testResults[0].assertionResults = []; zero.numTotalTests = 0;
  assert.throws(() => validateReport(zero, [suite], '/candidate'), /zero|cases/);
  assert.throws(() => validateReport(report(), [suite, 'src/missing.postgrest-rls.test.ts'], '/candidate'), /suite/);
  assert.throws(() => validateReport(report(), [], '/candidate'), /suite|zero/);
});
test('hook/cleanup failure and malformed or inconsistent counters fail', () => {
  const hook = report(); hook.testResults[0].message = 'afterAll cleanup failed';
  assert.throws(() => validateReport(hook, [suite], '/candidate'), /hook|cleanup|suite/);
  for (const change of [{ numTotalTests: 2 }, { numPassedTests: '1' }, { numFailedTestSuites: 1 }, { success: false }]) {
    assert.throws(() => validateReport({ ...report(), ...change }, [suite], '/candidate'));
  }
  assert.throws(() => validateReport({}, [suite], '/candidate'));
});
test('discovers nested required files, rejects zero and a removed baseline suite', () => {
  const root = mkdtempSync(join(tmpdir(), 'contract-discovery-'));
  try {
    mkdirSync(join(root, 'src/lib'), { recursive: true });
    assert.throws(() => discoverSuites(root), /zero/);
    writeFileSync(join(root, suite), '');
    assert.deepEqual(discoverSuites(root, [suite]), [suite]);
    assert.throws(() => discoverSuites(root, [suite, 'src/missing.postgrest-rls.test.ts']), /Missing/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
for (const missing of [
  'src/lib/database-boundaries.postgrest-rls.test.ts',
  'src/lib/booking/retention.postgrest-integration.test.ts',
  'src/lib/pg-net.postgrest-integration.test.ts',
  'src/lib/feature-flag-consumers.postgrest-integration.test.ts',
  'src/lib/feature-flag-realtime.postgrest-integration.test.ts',
]) {
  test(`expanded authorization tier fails if required suite is removed: ${missing}`, () => {
    const root = mkdtempSync(join(tmpdir(), 'contract-required-matrix-'));
    try {
      for (const file of REQUIRED_SUITES) {
        if (file === missing) continue;
        mkdirSync(join(root, file, '..'), { recursive: true });
        writeFileSync(join(root, file), '// required suite fixture');
      }
      assert.throws(() => discoverSuites(root), error => error.message.includes(`Missing required suite: ${missing}`));
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}
test('only fresh task-owned loopback manifest identities are admitted', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'paisaxe-contracts-')));
  try {
    const base = { version: 1, taskDir: root, projectId: 'paisaxe-contracts-123456789abc',
      nonce: '12345678-1234-4234-9234-123456789abc', apiUrl: 'http://127.0.0.1:56321', dbPort: 56322,
      migrationDigest: 'a'.repeat(64), schemaDigest: 'b'.repeat(64) };
    assert.equal(validateManifest(base, root).projectId, base.projectId);
    for (const change of [{ projectId: 'paisaxe' }, { projectId: 'paisaxe-contracts' },
      { apiUrl: 'https://example.supabase.co' }, { apiUrl: 'http://localhost:54321' },
      { apiUrl: 'http://127.0.0.1:56321/remote' }, { dbPort: 54322 }, { nonce: 'x' }, { schemaDigest: '' }]) {
      assert.throws(() => validateManifest({ ...base, ...change }, root));
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('child environment excludes inherited provider secrets and pins local clients', () => {
  const env = isolatedEnvironment({ PATH: '/bin', HOME: '/tmp', STRIPE_SECRET_KEY: 'live-secret',
    NEXT_PUBLIC_SUPABASE_URL: 'https://remote.supabase.co', NODE_OPTIONS: '--require=/tmp/steal.cjs',
    PAYPAL_CLIENT_SECRET: 'live-secret', DOCKER_HOST: 'tcp://remote:2375' },
  { apiUrl: 'http://127.0.0.1:56321', projectId: 'paisaxe-contracts-123456789abc',
    nonce: '12345678-1234-4234-9234-123456789abc', migrationDigest: 'a'.repeat(64) },
  { anon: 'local-anon', service: 'local-service', dbUrl: 'postgresql://postgres:postgres@127.0.0.1:56322/postgres' }, 'unix:///tmp/docker.sock');
  assert.equal(env.STRIPE_SECRET_KEY, undefined);
  assert.equal(env.PAYPAL_CLIENT_SECRET, undefined);
  assert.equal(env.NODE_OPTIONS, undefined);
  assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, 'http://127.0.0.1:56321');
  assert.equal(env.DOCKER_HOST, 'unix:///tmp/docker.sock');
  assert.equal(env.SUPABASE_LOCAL_SERVICE_ROLE_KEY, 'local-service');
  assert.equal(env.SUPABASE_SERVICE_KEY, 'local-service');
  assert.equal(env.SUPABASE_LOCAL_DB_URL, 'postgresql://postgres:postgres@127.0.0.1:56322/postgres');
  assert.equal(env.SUPABASE_LOCAL_DB_MARKER, `paisaxe-contracts:12345678-1234-4234-9234-123456789abc:${'a'.repeat(64)}`);
});
test('migration digest detects content changes even with the same filename/version', () => {
  const root = mkdtempSync(join(tmpdir(), 'contract-migrations-'));
  try {
    mkdirSync(join(root, 'supabase/migrations'), { recursive: true });
    const file = join(root, 'supabase/migrations/001_initial.sql');
    writeFileSync(file, 'select 1;'); const before = migrationInventory(root);
    writeFileSync(file, 'select 2;'); const after = migrationInventory(root);
    assert.deepEqual(before.versions, ['001']);
    assert.notEqual(before.digest, after.digest);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('candidate identity changes for adapter bytes when migrations stay unchanged', () => {
  const root = mkdtempSync(join(tmpdir(), 'contract-source-'));
  try {
    mkdirSync(join(root, 'src/lib'), { recursive: true });
    writeFileSync(join(root, 'src/lib/adapter.ts'), 'export const value = 1;');
    const before = candidateDigest(root);
    writeFileSync(join(root, 'src/lib/adapter.ts'), 'export const value = 2;');
    assert.notEqual(candidateDigest(root), before);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('runner rejects missing/shared task before database commands and fails unavailable Docker visibly', async () => {
  const receipt = await runContracts({ root: new URL('..', import.meta.url).pathname, taskDir: undefined });
  assert.equal(receipt.status, 'failed');
  assert.match(receipt.failures.join(' '), /CONTRACT_STACK_DIR/);
});

test('real runner with third-party CLI/HTTP fixtures rejects bad reports, failed processes and cleanup; corrected rerun passes', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'contract-runner-fixture-')));
  const taskDir = realpathSync(mkdtempSync(join(tmpdir(), 'paisaxe-contracts-')));
  const priorPath = process.env.PATH; const priorHost = process.env.DOCKER_HOST; const priorFetch = globalThis.fetch;
  try {
    const bin = join(root, 'bin'); mkdirSync(bin);
    for (const file of REQUIRED_SUITES) { mkdirSync(join(root, file, '..'), { recursive: true }); writeFileSync(join(root, file), '// fixture suite'); }
    mkdirSync(join(root, 'supabase/migrations'), { recursive: true }); writeFileSync(join(root, 'supabase/migrations/001_initial.sql'), 'select 1;');
    mkdirSync(join(taskDir, 'supabase')); mkdirSync(join(root, 'node_modules/vitest'), { recursive: true }); mkdirSync(join(root, 'scripts'));
    cpSync(new URL('./check-provider-fixtures.mjs', import.meta.url), join(root, 'scripts/check-provider-fixtures.mjs'));
    mkdirSync(join(root, 'tests/fixtures/providers'), { recursive: true });
    writeFileSync(join(root, 'tests/fixtures/providers/example.json'), '{}');
    writeFileSync(join(root, 'tests/fixtures/providers/manifest.json'), JSON.stringify({ schema_version: 1, fixtures: [{
      id: 'fictional-test-recording', provider: 'Fixture provider', kind: 'recorded', api_version: 'fixture-v1', sanitized: true,
      captured_at: '2026-01-01T00:00:00Z', expires_at: '2099-01-01T00:00:00Z', upstream_change: 'fixture schema changes',
      refresh_owner: 'test owner', refresh_action: 'Replace test fixture metadata', file: 'tests/fixtures/providers/example.json', sha256: sha256('{}'),
    }] }));
    const manifest = { version: 1, taskDir, projectId: 'paisaxe-contracts-123456789abc', nonce: '12345678-1234-4234-9234-123456789abc',
      apiUrl: 'http://127.0.0.1:56321', dbPort: 56322, migrationDigest: migrationInventory(root).digest, schemaDigest: sha256('schema\n') };
    writeFileSync(join(taskDir, 'contracts-stack.json'), JSON.stringify(manifest)); writeFileSync(join(taskDir, 'supabase/config.toml'), `project_id = "${manifest.projectId}"`);
    const modeFile = join(root, 'mode.json'); const commandLog = join(root, 'commands.log'); const countFile = join(root, 'network-count');
    const scriptHeader = `#!/usr/bin/env node\nconst fs=require('node:fs');const args=process.argv.slice(2);const mode=JSON.parse(fs.readFileSync(${JSON.stringify(modeFile)},'utf8'));fs.appendFileSync(${JSON.stringify(commandLog)},JSON.stringify(args)+'\\n');`;
    writeFileSync(join(bin, 'docker'), scriptHeader + `
      if(mode.unavailable)process.exit(1);
      if(args[0]==='context')console.log(JSON.stringify([{Endpoints:{docker:{Host:'unix:///tmp/fixture-docker.sock'}}}]));
      else if(args[0]==='ps')console.log('supabase_db_'+${JSON.stringify(manifest.projectId)}+'\\n'+'supabase_kong_'+${JSON.stringify(manifest.projectId)});
      else if(args[0]==='network'){
        let n=fs.existsSync(${JSON.stringify(countFile)})?Number(fs.readFileSync(${JSON.stringify(countFile)})):0;fs.writeFileSync(${JSON.stringify(countFile)},String(n+1));
        console.log(JSON.stringify([{Internal:!(mode.cleanup&&n>0),Labels:{'com.paisaxe.contracts.nonce':${JSON.stringify(manifest.nonce)}},Containers:{db:{Name:'supabase_db_'+${JSON.stringify(manifest.projectId)}},kong:{Name:'supabase_kong_'+${JSON.stringify(manifest.projectId)}}}}]));
      }else if(args[0]==='inspect'){
        const db=args[1].includes('supabase_db_');console.log(JSON.stringify([{Name:'/'+args[1],State:{Running:true,Health:{Status:mode.unhealthy?'unhealthy':'healthy'}},Config:{Labels:{'com.supabase.cli.project':${JSON.stringify(manifest.projectId)}}},NetworkSettings:{Networks:{${JSON.stringify(manifest.projectId)}:{}},Ports:{[db?'5432/tcp':'8000/tcp']:mode.noBindings?[]:[{HostIp:'127.0.0.1',HostPort:db?'56322':'56321'}]}}}]));
      }else if(args.includes('pg_dump'))console.log('schema');
      else if(args.includes('psql')){
        const sql=args.at(-1);
        if(sql.includes('shobj_description'))console.log(${JSON.stringify(`paisaxe-contracts:${manifest.nonce}:${manifest.migrationDigest}`)});
        else if(sql.includes('schema_migrations'))console.log('["001"]');else console.log('0');
      }else process.exit(2);`, { mode: 0o755 });
    const jwt = (role) => Buffer.from('{}').toString('base64url') + '.' + Buffer.from(JSON.stringify({ iss: 'supabase-demo', role, exp: 4102444800 })).toString('base64url') + '.fixture';
    const status = { API_URL: manifest.apiUrl, DB_URL: 'postgresql://postgres:postgres@127.0.0.1:56322/postgres', ANON_KEY: jwt('anon'), SERVICE_ROLE_KEY: jwt('service_role') };
    writeFileSync(join(bin, 'supabase'), scriptHeader + `let status=${JSON.stringify(status)};if(mode.badDbUser)status.DB_URL=status.DB_URL.replace('postgres:postgres@','other:postgres@');console.log(mode.malformedStatus?'private-json-canary':JSON.stringify(status));`, { mode: 0o755 });
    writeFileSync(join(bin, 'psql'), scriptHeader + `if(mode.missingSqlClient)process.exit(1);console.log('psql (PostgreSQL) 17.11');`, { mode: 0o755 });
    const good = report(); good.testResults = REQUIRED_SUITES.map((file) => ({ ...good.testResults[0], name: join(root, file) }));
    good.numTotalTests = REQUIRED_SUITES.length; good.numPassedTests = REQUIRED_SUITES.length;
    writeFileSync(join(root, 'node_modules/vitest/vitest.mjs'), `import fs from 'node:fs';const mode=JSON.parse(fs.readFileSync(${JSON.stringify(modeFile)},'utf8'));let report=${JSON.stringify(good)};if(mode.mutate)fs.appendFileSync(${JSON.stringify(join(root, REQUIRED_SUITES[0]))},'\\n// changed during test');if(mode.skip)report.testResults[0].assertionResults[0].status='pending';if(mode.hook)report.testResults[0].message='cleanup failed';if(!mode.missing)fs.writeFileSync(process.argv[process.argv.indexOf('--outputFile')+1],mode.malformed?'private-json-canary':JSON.stringify(report));console.error('private-vitest-diagnostic');process.exit(mode.exit||0);`);
    process.env.PATH = bin + ':' + priorPath; delete process.env.DOCKER_HOST;
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => [{ flag_key: 'maintenance_mode', enabled: false }] });
    for (const [mode, expected] of [[{ unavailable: true }, 'failed'], [{ unhealthy: true }, 'failed'], [{ noBindings: true }, 'failed'], [{ missingRelay: true, noBindings: true }, 'failed'], [{ skip: true }, 'failed'], [{ hook: true }, 'failed'],
      [{ missing: true }, 'failed'], [{ malformed: true }, 'failed'], [{ malformedStatus: true }, 'failed'], [{ badDbUser: true }, 'failed'], [{ missingSqlClient: true }, 'failed'], [{ exit: 1 }, 'failed'], [{ cleanup: true }, 'failed'], [{ mutate: true }, 'failed'], [{}, 'passed']]) {
      if (mode.missingRelay) manifest.transport = 'docker-exec-v1'; else delete manifest.transport;
      writeFileSync(join(taskDir, 'contracts-stack.json'), JSON.stringify(manifest));
      writeFileSync(modeFile, JSON.stringify(mode)); rmSync(countFile, { force: true });
      const receipt = await runContracts({ root, taskDir, outputDir: join(root, 'receipts') });
      assert.equal(receipt.status, expected, JSON.stringify({ mode, failures: receipt.failures }));
      assert.equal(JSON.stringify(receipt).includes('private-json-canary'), false, 'Malformed JSON must not expose private payload excerpts');
      if (mode.missingRelay || mode.noBindings || mode.unhealthy) assert.equal(receipt.vitestExitCode, undefined, 'Unverified transport must fail before suite execution');
      if (expected === 'passed') {
        assert.equal(receipt.cases.length, REQUIRED_SUITES.length);
        assert.equal(receipt.nativeSqlClient, 'psql (PostgreSQL) 17.11');
        const diagnostic=join(receipt.receiptPath,'..','vitest-output.log');
        assert.equal(existsSync(diagnostic),true,'Private process output must be preserved for actual request-ID and failure diagnosis');
        assert.match(readFileSync(diagnostic,'utf8'),/private-vitest-diagnostic/);
        assert.equal(statSync(diagnostic).mode&0o777,0o600);
        assert.equal(JSON.stringify(receipt).includes('private-vitest-diagnostic'),false);
      }
    }
    globalThis.fetch = async () => ({ ok: false, status: 401 });
    const deniedPositive = await runContracts({ root, taskDir, outputDir: join(root, 'receipts') });
    assert.equal(deniedPositive.status, 'failed'); assert.match(deniedPositive.failures.join(' '), /positive/);
  } finally {
    process.env.PATH = priorPath;
    if (priorHost === undefined) delete process.env.DOCKER_HOST; else process.env.DOCKER_HOST = priorHost;
    globalThis.fetch = priorFetch; rmSync(root, { recursive: true, force: true }); rmSync(taskDir, { recursive: true, force: true });
  }
});
