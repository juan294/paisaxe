import { createClient } from '@supabase/supabase-js';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startTransport, stopTransport } from './contract-transport.mjs';
import { dockerSql, inspectStack, localDockerEnvironment, migrationInventory, schemaDigest } from './run-contracts.mjs';

export async function initializeRealtime(manifest, anonKey, env, clientFactory = createClient, timeoutMs = 15000) {
  const client = clientFactory(manifest.apiUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const channel = client.channel('contracts-readiness-' + manifest.nonce, { config: { private: false } });
  const deadline = Date.now() + timeoutMs;
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Realtime subscription readiness timed out')), timeoutMs);
      channel.subscribe(status => {
        if (status === 'SUBSCRIBED') { clearTimeout(timer); resolve(); }
        else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) { clearTimeout(timer); reject(new Error('Realtime subscription readiness failed')); }
      }, timeoutMs);
    });
    // A public channel initializes legitimate Realtime replication DDL.
    // Check explicit root membership: pg_publication_tables may expand partitions.
    // Let the legitimate service finish its DDL before taking the full baseline.
    while (Date.now() < deadline) {
      const ready = dockerSql(manifest.projectId, "SELECT count(*) FROM pg_publication p JOIN pg_publication_rel r ON r.prpubid=p.oid JOIN pg_class c ON c.oid=r.prrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE p.pubname='supabase_realtime_messages_publication' AND n.nspname='realtime' AND c.relname='messages';", env);
      if (ready === '1') return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Realtime messages publication readiness timed out');
  } finally {
    try {
      const result = await channel.unsubscribe(1000);
      if (result !== 'ok') throw new Error('Realtime readiness unsubscribe failed');
    } finally {
      channel.teardown();
      const result = await client.realtime.disconnect();
      if (result !== 'ok') throw new Error('Realtime readiness disconnect failed');
    }
  }
}

export async function prepareStack(root = process.cwd(), { clientFactory = createClient, readinessTimeoutMs = 15000 } = {}) {
  // No caller-provided directory or project: this command can only create a new disposable task.
  const taskDir = realpathSync(mkdtempSync(join(tmpdir(), 'paisaxe-contracts-')));
  const projectId = 'paisaxe-contracts-' + randomBytes(6).toString('hex');
  const nonce = randomUUID(); const basePort = randomInt(20000, 45000);
  const manifest = { version: 1, transport: 'docker-exec-v1', taskDir, projectId, nonce, apiUrl: `http://127.0.0.1:${basePort + 1}`,
    dbPort: basePort + 2, migrationDigest: migrationInventory(root).digest };
  mkdirSync(join(taskDir, 'supabase'), { recursive: true });
  cpSync(join(root, 'supabase/migrations'), join(taskDir, 'supabase/migrations'), { recursive: true, dereference: false });
  cpSync(join(root, 'supabase/seed.sql'), join(taskDir, 'supabase/seed.sql'));
  // A small local-only config avoids copying .env, project links, provider OAuth or SMTP settings.
  const config = `project_id = "${projectId}"
[api]
enabled = true
port = ${basePort + 1}
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
[db]
port = ${basePort + 2}
shadow_port = ${basePort}
major_version = 17
[db.pooler]
enabled = false
[db.seed]
enabled = true
sql_paths = ["./seed.sql"]
[auth]
enabled = true
site_url = "http://127.0.0.1:3000"
enable_anonymous_sign_ins = true
[auth.rate_limit]
anonymous_users = 1000
token_refresh = 1000
[studio]
enabled = false
[inbucket]
enabled = false
[analytics]
enabled = false
[edge_runtime]
enabled = false
[realtime]
enabled = true
[storage]
enabled = true
`;
  writeFileSync(join(taskDir, 'supabase/config.toml'), config);
  let transportStarted = false; let env; let stage = 'network';
  try {
    const cliHome = join(taskDir, '.local-cli-home'); mkdirSync(cliHome);
    env = { ...localDockerEnvironment(), HOME: cliHome };
    const cli = (args) => execFileSync('supabase', [...args, '--workdir', taskDir, '--network-id', projectId],
      { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 600000, maxBuffer: 32 * 1024 * 1024 });
    // Internal networking prevents migration 025's historical production webhook URL from sending traffic.
    execFileSync('docker', ['network', 'create', '--internal', '--label', `com.paisaxe.contracts.nonce=${nonce}`, projectId],
      { env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 });
    stage = 'transport'; await startTransport(manifest, env); transportStarted = true;
    stage = 'start'; cli(['start']);
    stage = 'inspect-start'; await inspectStack(manifest, env);
    // Reset only a newly generated project after Docker has proved its ownership and network identity.
    stage = 'reset'; cli(['db', 'reset', '--local', '--yes']);
    stage = 'inspect-reset'; await inspectStack(manifest, env);
    stage = 'sanitize';
    dockerSql(projectId, "BEGIN; UPDATE public.webhook_config SET value='' WHERE key IN ('base_url','secret'); SELECT cron.alter_job(jobid, active:=false) FROM cron.job WHERE active; " +
      `COMMENT ON DATABASE postgres IS 'paisaxe-contracts:${nonce}:${manifest.migrationDigest}'; COMMIT;`, env);
    stage = 'realtime';
    const status = JSON.parse(execFileSync('supabase', ['status', '--workdir', taskDir, '--output', 'json'],
      { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 }));
    if (status.API_URL !== manifest.apiUrl || typeof status.ANON_KEY !== 'string' || !status.ANON_KEY) throw new Error('Realtime local status identity mismatch');
    await initializeRealtime(manifest, status.ANON_KEY, env, clientFactory, readinessTimeoutMs);
    stage = 'schema'; manifest.schemaDigest = schemaDigest(projectId, env);
    writeFileSync(join(taskDir, 'contracts-stack.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
    return manifest;
  } catch (error) {
    // External command diagnostics may contain local credentials. Keep them
    // private in the mode-0700 task directory, never in public error messages.
    writeFileSync(join(taskDir, 'preparation-diagnostic.log'),
      [error.message, error.stdout, error.stderr].filter(Boolean).join('\n'), { mode: 0o600 });
    if (transportStarted) { try { await stopTransport(manifest, env); } catch { /* Preserve failed identity for inspection. */ } }
    // Preserve a failed task's identity for recovery; never reset, stop or delete an existing user stack.
    writeFileSync(join(taskDir, 'preparation-failed.json'), JSON.stringify({ projectId, nonce, taskDir, status: 'failed', stage,
      recovery: 'Restore local Docker access, then rerun preparation from the repository. Inspect this exact task before stopping its containers/network.' }, null, 2) + '\n', { mode: 0o600 });
    throw new Error(`Task stack preparation failed; no contract acceptance. Local-only recovery receipt: ${taskDir}/preparation-failed.json`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const manifest = await prepareStack();
    console.log(`Prepared disposable stack ${manifest.projectId}. From the repository directory run:`);
    console.log(`CONTRACT_STACK_DIR='${manifest.taskDir}' npm run test:contracts`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
