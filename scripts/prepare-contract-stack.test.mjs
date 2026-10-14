import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareStack, initializeRealtime } from './prepare-contract-stack.mjs';
import { stopTransport } from './contract-transport.mjs';

test('actual preparer isolates fresh project, validates before reset and preserves safe failures', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'contract-preparation-fixture-')));
  const saved = Object.fromEntries(['PATH', 'DOCKER_HOST', 'SUPABASE_ACCESS_TOKEN', 'STRIPE_SECRET_KEY'].map((key) => [key, process.env[key]]));
  const tasks = [];
  try {
    mkdirSync(join(root, 'bin')); mkdirSync(join(root, 'supabase/migrations'), { recursive: true });
    mkdirSync(join(root, 'supabase/.temp')); writeFileSync(join(root, 'supabase/.temp/project-ref'), 'production-reference');
    writeFileSync(join(root, '.env.local'), 'STRIPE_SECRET_KEY=live-secret');
    writeFileSync(join(root, 'supabase/migrations/001_fixture.sql'), 'select 1;'); writeFileSync(join(root, 'supabase/seed.sql'), '-- local fixture');
    const stateFile = join(root, 'state.json'); const logFile = join(root, 'calls.jsonl');
    const header = `#!/usr/bin/env node\nconst fs=require('node:fs');const args=process.argv.slice(2);const state=JSON.parse(fs.readFileSync(${JSON.stringify(stateFile)},'utf8'));fs.appendFileSync(${JSON.stringify(logFile)},JSON.stringify({program:require('node:path').basename(process.argv[1]),args,env:process.env})+'\\n');const save=()=>fs.writeFileSync(${JSON.stringify(stateFile)},JSON.stringify(state));`;
    writeFileSync(join(root, 'bin/docker'), header + `
      if(state.mode==='unavailable')process.exit(1);
      if(args[0]==='context')console.log('[{"Endpoints":{"docker":{"Host":"unix:///tmp/fixture.sock"}}}]');
      else if(args[0]==='network'&&args[1]==='create'){state.project=args.at(-1);state.nonce=args[args.indexOf('--label')+1].split('=')[1];save();console.log('fixture-network-id');}
      else if(args[0]==='network')console.log(JSON.stringify([{Internal:true,Labels:{'com.paisaxe.contracts.nonce':state.nonce},Containers:Object.fromEntries((state.mode==='detached'?['db','kong']:['db','kong','auth']).map(kind=>[kind,{Name:'supabase_'+kind+'_'+state.project}]))}]));
      else if(args[0]==='ps')console.log(['db','kong','auth'].map(kind=>'supabase_'+kind+'_'+state.project).join('\\n'));
      else if(args[0]==='inspect'){
        const kind=args[1].split('_')[1];const config=fs.readFileSync(state.taskDir+'/supabase/config.toml','utf8');const api=config.match(/\\[api\\][\\s\\S]*?port = (\\d+)/)[1];const db=config.match(/\\[db\\][\\s\\S]*?port = (\\d+)/)[1];
        const networks=state.mode==='detached'&&kind==='auth'?{bridge:{}}:{[state.project]:{}};if(state.mode==='escape'&&kind==='auth')networks.bridge={};
        console.log(JSON.stringify([{Name:'/'+args[1],State:{Running:true},Config:{Labels:{'com.supabase.cli.project':state.mode==='identity'?'paisaxe':state.project}},NetworkSettings:{Networks:networks,Ports:{[kind==='db'?'5432/tcp':'8000/tcp']:[]}}}]));
      }else if(args.includes('pg_dump'))console.log('fixture schema');else if(args.includes('psql')&&args.at(-1).includes('pg_publication_tables'))console.log('0');else if(args.includes('psql')&&args.at(-1).includes('pg_publication_rel')){console.log(state.mode==='missing-publication'?'0':'1');}else if(args.includes('psql')){if(state.mode==='cron-api'&&args.at(-1).includes('UPDATE cron.job'))process.exit(1);console.log('');}else process.exit(2);`, { mode: 0o755 });
    writeFileSync(join(root, 'bin/supabase'), header + `state.taskDir=args[args.indexOf('--workdir')+1];save();if(state.mode==='start-failure'){console.error('private-command-diagnostic');process.exit(1);}if(args[0]==='status'){const config=fs.readFileSync(state.taskDir+'/supabase/config.toml','utf8');console.log(JSON.stringify({API_URL:'http://127.0.0.1:'+config.match(/\\[api\\][\\s\\S]*?port = (\\d+)/)[1],ANON_KEY:'private-local-anon-key'}));}else console.log('fixture local CLI');`, { mode: 0o755 });
    process.env.PATH = join(root, 'bin') + ':' + saved.PATH; delete process.env.DOCKER_HOST;
    process.env.SUPABASE_ACCESS_TOKEN = 'production-token'; process.env.STRIPE_SECRET_KEY = 'live-secret';
    for (const mode of ['cron-api', 'success', 'start-failure', 'unavailable', 'identity', 'escape', 'detached', 'subscription-failure', 'missing-publication']) {
      writeFileSync(stateFile, JSON.stringify({ mode })); writeFileSync(logFile, '');
      let manifest; let failure;
      const events = [];
      const clientFactory = (url,key,options) => {
        assert.match(url,/^http:\/\/127\.0\.0\.1:\d+$/); assert.equal(key,'private-local-anon-key'); assert.equal(options.auth.persistSession,false);
        const channel={subscribe(callback){events.push('subscribe');writeFileSync(logFile,JSON.stringify({program:'websocket',args:['subscribe'],env:{}})+'\n',{flag:'a'});callback(mode==='subscription-failure'?'CHANNEL_ERROR':'SUBSCRIBED',new Error('private-websocket-error'));return this;},async unsubscribe(){events.push('unsubscribe');return 'ok';},teardown(){events.push('teardown');}};
        return {channel(){return channel;},realtime:{async disconnect(){events.push('disconnect');return 'ok';}}};
      };
      try { manifest = await prepareStack(root, { clientFactory, readinessTimeoutMs: 100 }); } catch (error) { failure = error; }
      if (manifest) tasks.push(manifest.taskDir);
      if (mode === 'success' || mode === 'cron-api') {
        assert.equal(failure, undefined, failure?.message);
        assert.match(manifest.projectId, /^paisaxe-contracts-[a-f0-9]{12}$/);
        assert.equal(manifest.transport, 'docker-exec-v1');
        const recorded = JSON.parse(readFileSync(join(manifest.taskDir, 'contracts-stack.json'), 'utf8'));
        assert.deepEqual(recorded, manifest); assert.match(manifest.schemaDigest, /^[a-f0-9]{64}$/);
        assert.match(manifest.migrationDigest, /^[a-f0-9]{64}$/);
        assert.equal(readFileSync(join(manifest.taskDir, 'supabase/migrations/001_fixture.sql'), 'utf8'), 'select 1;');
        for (const path of ['.env.local', 'supabase/.temp/project-ref']) assert.throws(() => readFileSync(join(manifest.taskDir, path)));
        assert.equal(JSON.stringify(recorded).includes('live-secret'), false);
      } else {
        assert.match(failure?.message ?? '', /Task stack preparation failed; no contract acceptance/);
        const path = failure.message.match(/receipt: (.+)\/preparation-failed\.json$/)[1]; tasks.push(path);
        const receipt = JSON.parse(readFileSync(join(path, 'preparation-failed.json'), 'utf8'));
        assert.equal(receipt.taskDir, path); assert.equal(receipt.status, 'failed'); assert.match(receipt.projectId, /^paisaxe-contracts-[a-f0-9]{12}$/);
        assert.equal(failure.message.includes('production-token'), false);
        if(mode==='subscription-failure'||mode==='missing-publication'){assert.equal(receipt.stage,'realtime');assert.throws(()=>readFileSync(join(path,'contracts-stack.json')));assert.equal(failure.message.includes('private-'),false);assert.equal(existsSync(join(path,'transport.sock')),false,'Failed readiness must stop its owned relay');}
        if(mode==='start-failure'){assert.equal(receipt.stage,'start');assert.ok(readFileSync(join(path,'preparation-diagnostic.log'),'utf8').includes('private-command-diagnostic'));assert.equal(statSync(join(path,'preparation-diagnostic.log')).mode&0o777,0o600);assert.equal(failure.message.includes('private-command-diagnostic'),false);}
      }
      if (manifest?.transport === 'docker-exec-v1') await stopTransport(manifest, { DOCKER_HOST: 'unix:///tmp/fixture.sock' });
      if(['success','cron-api','subscription-failure','missing-publication'].includes(mode))assert.deepEqual(events,['subscribe','unsubscribe','teardown','disconnect']);
      const calls = readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
      for (const call of calls) {
        assert.equal(call.env.SUPABASE_ACCESS_TOKEN, undefined); assert.equal(call.env.STRIPE_SECRET_KEY, undefined);
        assert.equal(call.env.SUPABASE_TELEMETRY_DISABLED, call.program === 'supabase' ? '1' : call.env.SUPABASE_TELEMETRY_DISABLED);
        if (call.program === 'supabase') assert.equal(call.env.HOME, join(JSON.parse(readFileSync(stateFile, 'utf8')).taskDir, '.local-cli-home'));
      }
      const resets = calls.filter((call) => call.program === 'supabase' && call.args[0] === 'db');
      assert.equal(resets.length, (['success','cron-api','subscription-failure','missing-publication'].includes(mode)) ? 1 : 0, `Unexpected reset after ${mode}`);
      if (mode === 'success' || mode === 'cron-api') {
        const create = calls.findIndex((call) => call.args[0] === 'network' && call.args[1] === 'create');
        const start = calls.findIndex((call) => call.program === 'supabase' && call.args[0] === 'start');
        const reset = calls.findIndex((call) => call.program === 'supabase' && call.args[0] === 'db');
        const subscribed=calls.findIndex(call=>call.program==='websocket');const dump=calls.findIndex(call=>call.args.includes('pg_dump'));const catalog=calls.findIndex(call=>call.args.includes('psql')&&call.args.at(-1).includes('pg_publication_rel'));assert.ok(reset<subscribed&&subscribed<catalog&&catalog<dump,'Realtime subscription and publication must be ready before the schema baseline');
        assert.ok(create < start && start < reset); assert.ok(calls[create].args.includes('--internal'));
        assert.ok(calls.slice(start, reset).some((call) => call.args[0] === 'inspect'));
        assert.ok(calls[reset].args.includes('--local')); assert.ok(calls[reset].args.includes(manifest.projectId));
        assert.ok(calls.some((call) => call.args.includes('psql') && call.args.at(-1).includes('cron.alter_job(jobid, active:=false)')));
      }
    }
    assert.equal(new Set(tasks).size, tasks.length);
  } finally {
    for (const [key, value] of Object.entries(saved)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
    for (const path of tasks) rmSync(path, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
});


test('Realtime warmup timeout tears down its third-party client before failing', async () => {
  const events=[];
  const channel={on(){return this;},subscribe(){events.push('subscribe');return this;},async unsubscribe(){events.push('unsubscribe');return 'ok';},teardown(){events.push('teardown');}};
  const clientFactory=()=>({channel(){return channel;},realtime:{async disconnect(){events.push('disconnect');return 'ok';}}});
  await assert.rejects(initializeRealtime({apiUrl:'http://127.0.0.1:32123',nonce:'fixture'},'private-key',{},clientFactory,20),/subscription readiness timed out/);
  assert.deepEqual(events,['subscribe','unsubscribe','teardown','disconnect']);
});
