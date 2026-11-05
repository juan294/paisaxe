import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, realpathSync, rmSync, existsSync, cpSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createLifecycleReceipt, readReceipt } from '../contract-stack-lifecycle.mjs';
import { migrationInventory, sha256 } from '../run-contracts.mjs';
import net from 'node:net';

// Real entrypoints and receipt storage; only external CLI boundaries are fake.
// The selected task-consuming command records its live ownership, then fails.
export function managedCallerFixture(repository, failureAt = 'schema') {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'managed-caller-')));
  const taskDir = realpathSync(mkdtempSync(join(root, 'paisaxe-contracts-')));
  const state = join(root, 'lifecycle'), log = join(root, 'calls.jsonl'), bin = join(root, 'bin');
  mkdirSync(bin); mkdirSync(join(taskDir, 'supabase'));
  const manifest = { version: 1, taskDir, projectId: 'paisaxe-contracts-abcdef123456', nonce: randomUUID(),
    apiUrl: 'http://127.0.0.1:31351', dbPort: 31352, migrationDigest: migrationInventory(repository).digest,
    schemaDigest: sha256('fixture schema\n') };
  writeFileSync(join(taskDir, 'contracts-stack.json'), JSON.stringify(manifest));
  writeFileSync(join(taskDir, 'supabase/config.toml'), `project_id = "${manifest.projectId}"\n`);
  const qa = { project: manifest.projectId, nonce: manifest.nonce, email: 'qa-test-owned@paisaxe.dev', password: 'synthetic-password' };
  writeFileSync(join(taskDir, 'stripe-qa.json'), JSON.stringify(qa));
  createLifecycleReceipt(state, { ...manifest, disposable: false, task: 'reusable', candidate: {}, daemonId: 'fixture-daemon' });
  const receiptFile = join(state, 'tasks', manifest.projectId + '.json');
  const header = `#!${process.execPath}\nconst fs=require('node:fs');const args=process.argv.slice(2);const m=${JSON.stringify(manifest)};const r=JSON.parse(fs.readFileSync(${JSON.stringify(receiptFile)},'utf8'));fs.appendFileSync(${JSON.stringify(log)},JSON.stringify({tool:require('node:path').basename(process.argv[1]),args,pid:process.pid,leases:r.leases,commands:r.commandTracking?.commands??{}})+'\\n');`;
  writeFileSync(join(bin, 'docker'), header + `
if(args[0]==='context')console.log('[{"Endpoints":{"docker":{"Host":"unix:///tmp/fixture.sock"}}}]');
else if(args[0]==='network')console.log(JSON.stringify([{Internal:true,Labels:{'com.paisaxe.contracts.nonce':m.nonce},Containers:{db:{Name:'supabase_db_'+m.projectId},kong:{Name:'supabase_kong_'+m.projectId}}}]));
else if(args[0]==='ps')console.log('supabase_db_'+m.projectId+'\\n'+'supabase_kong_'+m.projectId);
else if(args[0]==='inspect'){const db=args[1].includes('supabase_db_');console.log(JSON.stringify([{Name:'/'+args[1],State:{Running:true},Config:{Labels:{'com.supabase.cli.project':m.projectId}},NetworkSettings:{Networks:{[m.projectId]:{}},Ports:{[db?'5432/tcp':'8000/tcp']:[{HostIp:'127.0.0.1',HostPort:db?String(m.dbPort):new URL(m.apiUrl).port}]}}}]));}
else if(args.includes('pg_dump')){if(${JSON.stringify(failureAt)}==='schema')process.exit(41);console.log('fixture schema');}
else if(args.includes('psql'))console.log('paisaxe-contracts:'+m.nonce+':'+m.migrationDigest);
else process.exit(42);`, { mode: 0o755 });
  writeFileSync(join(bin, 'supabase'), header + `console.error('synthetic status failure');process.exit(41);`, { mode: 0o755 });
  for (const name of ['npm', 'npx', 'openssl']) writeFileSync(join(bin, name), header + `process.exit(97);`, { mode: 0o755 });
  /** @type {NodeJS.ProcessEnv} */
  const env = { PATH: bin + ':' + process.env.PATH, HOME: root, NODE_ENV: 'test',
    PAISAXE_CONTRACT_LIFECYCLE_DIR: state, CONTRACT_STACK_DIR: taskDir,
    NEXT_PUBLIC_SUPABASE_URL: manifest.apiUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-anon', SUPABASE_SERVICE_KEY: 'synthetic-service',
    QA_TEST_USER_EMAIL: qa.email, QA_TEST_USER_PASSWORD: qa.password,
    STRIPE_TEST_SECRET_KEY: 'sk_test_synthetic', STRIPE_TEST_DAY_PASS_PRICE_ID: 'price_synthetic',
    NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY: 'pk_test_synthetic', STRIPE_TEST_WEBHOOK_SECRET: 'whsec_synthetic' };
  return { env, manifest, read: () => existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse) : [],
    receipt: () => readReceipt(state, manifest.projectId), close: () => rmSync(root, { recursive: true, force: true }) };
}

export function assertManagedPreflight(fixture, purpose, failureAt) {
  const calls = fixture.read();
  assert.ok(calls.length > 0, 'actual caller reached external CLI');
  assert.ok(calls.every(call => call.leases.some(lease => lease.purpose === purpose)), 'lease must precede the first live stack inspection');
  const consumers = calls.filter(call => call.args.includes('pg_dump') || call.args.includes('psql') || call.tool === 'supabase');
  assert.ok(consumers.length > 0, 'fixture reached task-consuming command');
  if (failureAt === 'status') assert.ok(consumers.some(call => call.tool === 'supabase'), 'status boundary was reached');
  for (const call of consumers) {
    const entries = Object.values(call.commands);
    assert.equal(entries.length, 1, 'each task-consuming command must observe its own durable intent');
    assert.equal(entries[0].leaseId, call.leases.find(lease => lease.purpose === purpose).id);
    assert.ok(['launching', 'running'].includes(entries[0].state));
  }
  assert.equal(calls.some(call => ['npm', 'npx', 'openssl'].includes(call.tool)), false, 'preflight failure must prevent build/provider boundaries');
  assert.equal(fixture.receipt().leases.length, 0, 'failed consumer releases its own lease');
  assert.deepEqual(fixture.receipt().commandTracking.commands, {}, 'proved failed command settles independently of its exit code');
}

function enableWorkload(fixture) {
  const root=fixture.env.HOME,bin=fixture.env.PATH.split(':')[0];
  const receiptFile=join(fixture.env.PAISAXE_CONTRACT_LIFECYCLE_DIR,'tasks',fixture.manifest.projectId+'.json');
  const log=join(root,'calls.jsonl');
  const header=`#!${process.execPath}\nconst fs=require('node:fs');const args=process.argv.slice(2);const r=JSON.parse(fs.readFileSync(${JSON.stringify(receiptFile)},'utf8'));fs.appendFileSync(${JSON.stringify(log)},JSON.stringify({tool:require('node:path').basename(process.argv[1]),args,pid:process.pid,leases:r.leases,commands:r.commandTracking?.commands??{}})+'\\n');`;
  const jwt=role=>Buffer.from('{}').toString('base64url')+'.'+Buffer.from(JSON.stringify({iss:'supabase-demo',role,exp:4102444800})).toString('base64url')+'.fixture';
  fixture.env.NEXT_PUBLIC_SUPABASE_ANON_KEY=jwt('anon');fixture.env.SUPABASE_SERVICE_KEY=jwt('service_role');
  const status={API_URL:fixture.manifest.apiUrl,DB_URL:`postgresql://postgres:postgres@127.0.0.1:${fixture.manifest.dbPort}/postgres`,ANON_KEY:jwt('anon'),SERVICE_ROLE_KEY:jwt('service_role')};
  writeFileSync(join(bin,'supabase'),header+`console.log(${JSON.stringify(JSON.stringify(status))});`,{mode:0o755});
  return {root,bin,header,log,receiptFile};
}

/**
 * @param {string} repository
 * @param {{exit?: number, earlyServerExit?: number, failedServerRootWithChild?: boolean}} [options]
 */
export async function stripeWorkloadFixture(repository,{exit=0,earlyServerExit,failedServerRootWithChild=false}={}) {
  const fixture=managedCallerFixture(repository,'workload'),parts=enableWorkload(fixture);
  const reservation=net.createServer();
  await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));
  fixture.env.PLAYWRIGHT_PORT=String(reservation.address().port);
  await new Promise(resolve=>reservation.close(resolve));
  fixture.env.PLAYWRIGHT_JSON_OUTPUT_NAME=join(parts.root,'report.json');
  const serverChild=`const fs=require('node:fs');const server=require('node:http').createServer((req,res)=>res.end('fixture child'));const stop=signal=>server.close(()=>{fs.writeFileSync(${JSON.stringify(join(parts.root,'server-child-stopped'))},JSON.stringify({pid:process.pid,signal}));process.exit(0);});process.once('SIGTERM',()=>stop('SIGTERM'));server.listen(Number(process.env.PLAYWRIGHT_PORT),()=>fs.writeFileSync(${JSON.stringify(join(parts.root,'server-child-ready'))},JSON.stringify({pid:process.pid})));setTimeout(()=>stop('fixture-deadline'),5000).unref();`;
  writeFileSync(join(parts.bin,'npm'),parts.header+`
if(args[1]==='build')process.exit(0);
if(${earlyServerExit!==undefined})process.exit(${earlyServerExit??0});
if(${failedServerRootWithChild}){require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(serverChild)}],{stdio:'inherit',detached:false});process.exit(7);}
const server=require('node:http').createServer((req,res)=>res.end('fixture'));
const done=()=>server.close(()=>process.exit(0));
process.once('SIGTERM',()=>setTimeout(done,150));
server.listen(Number(process.env.PLAYWRIGHT_PORT));setTimeout(done,5000).unref();`,{mode:0o755});
  writeFileSync(join(parts.bin,'npx'),parts.header+`fs.writeFileSync(process.env.PLAYWRIGHT_JSON_OUTPUT_NAME,JSON.stringify({stats:{expected:1,unexpected:0,flaky:0,skipped:0}}));process.exit(${exit});`,{mode:0o755});
  return fixture;
}

export function paidVoiceWorkloadFixture(repository,{holdBuild=false,settlementFault}={}) {
  const source=realpathSync(mkdtempSync(join(tmpdir(),'paid-voice-caller-source-')));
  mkdirSync(join(source,'scripts'));mkdirSync(join(source,'supabase/migrations'),{recursive:true});
  mkdirSync(join(source,'e2e/fixtures'),{recursive:true});mkdirSync(join(source,'node_modules/@playwright/test'),{recursive:true});
  for(const name of ['run-paid-voice-local.mjs','run-contracts.mjs','contract-stack-lifecycle.mjs','contract-owned-process.mjs','contract-transport.mjs'])cpSync(join(repository,'scripts',name),join(source,'scripts',name));
  cpSync(join(repository,'e2e/fixtures/voice-provider-transport.mjs'),join(source,'e2e/fixtures/voice-provider-transport.mjs'));
  symlinkSync(realpathSync(join(repository,'node_modules/undici')),join(source,'node_modules/undici'),'dir');
  writeFileSync(join(source,'supabase/migrations/001_fixture.sql'),'select 1;');
  const fixture=managedCallerFixture(source,'workload'),parts=enableWorkload(fixture);
  fixture.env.PAID_VOICE_EVIDENCE_DIR=join(parts.root,'evidence');fixture.env.PAID_VOICE_BUILD_RECEIPT=join(parts.root,'seal.json');
  writeFileSync(join(parts.bin,'git'),`#!${process.execPath}\nif(require('node:fs').existsSync(${JSON.stringify(join(parts.root,'cleanup-fault'))})){console.error('fixture cleanup digest failure');process.exit(31);}process.exit(0);`,{mode:0o755});
  writeFileSync(join(parts.bin,'openssl'),`#!${process.execPath}\nrequire('node:child_process').execFileSync('/usr/bin/openssl',process.argv.slice(2),{stdio:'ignore'});`,{mode:0o755});
  writeFileSync(join(parts.bin,'npm'),parts.header+`
fs.writeFileSync(${JSON.stringify(join(parts.root,'build-ready'))},JSON.stringify({pid:process.pid,startedAt:require('node:child_process').execFileSync('ps',['-p',String(process.pid),'-o','lstart='],{env:{...process.env,LC_ALL:'C',TZ:'UTC'},encoding:'utf8'}).trim()}));
const finish=()=>{fs.mkdirSync(${JSON.stringify(join(source,'.next'))},{recursive:true});fs.writeFileSync(${JSON.stringify(join(source,'.next/BUILD_ID'))},'fixture-build');};
if(${holdBuild}){setTimeout(()=>{finish();process.exit(0);},5000);}else{
 finish();
 const fault=${JSON.stringify(settlementFault??'')};
 if(fault){
  const deadline=Date.now()+5000;
  const publish=()=>{
   const path=${JSON.stringify(parts.receiptFile)},receipt=JSON.parse(fs.readFileSync(path,'utf8'));
   const command=Object.values(receipt.commandTracking.commands).find(command=>command.child?.pid===process.pid);
   if(!command){if(Date.now()>=deadline)process.exit(92);else setTimeout(publish,10);return;}
   if(fault==='interrupt'){process.on('SIGTERM',()=>{});process.kill(process.ppid,'SIGTERM');setTimeout(()=>process.exit(0),100);}
   else{command.purpose='fixture-changed-ownership';fs.writeFileSync(path,JSON.stringify(receipt));if(fault==='tracking-and-cleanup')fs.writeFileSync(${JSON.stringify(join(parts.root,'cleanup-fault'))},'fail');}
  };publish();
 }
}`,{mode:0o755});
  // This stands in only for the external Playwright CLI. The actual paid runner,
  // receipt implementation, process supervisor and provider preload remain real.
  writeFileSync(join(source,'node_modules/@playwright/test/cli.js'),parts.header+`fs.writeFileSync(process.env.PLAYWRIGHT_JSON_OUTPUT_FILE,JSON.stringify({stats:{expected:1,unexpected:0,skipped:0}}));`);
  const close=fixture.close;
  return {...fixture,source,buildReady:join(parts.root,'build-ready'),close(){close();rmSync(source,{recursive:true,force:true});}};
}
