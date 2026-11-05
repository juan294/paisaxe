import assert from 'node:assert/strict';
import { test } from 'node:test';
import { closeSync, existsSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createOwnedProcessScope } from './contract-owned-process.mjs';

const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; } };

test('owned command fd stdio writes directly without capture or output buffering limits', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'paisaxe-owned-fd-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const output = join(dir, 'command.log'), fd = openSync(output, 'w');
  const scope = createOwnedProcessScope();
  try {
    const result = await scope.run(process.execPath, ['-e', 'process.stdout.write("fd-stdout");process.stderr.write("fd-stderr")'], {
      stdio: ['ignore', fd, fd], maxBuffer: 1,
    });
    assert.equal(result.status, 0, 'direct fd output must not trip capture maxBuffer');
    assert.equal(result.error, undefined);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, '');
    assert.equal(result.child.settled, true);
    const written = readFileSync(output, 'utf8');
    assert.ok(written.includes('fd-stdout'));
    assert.ok(written.includes('fd-stderr'));
  } finally { scope.close(); closeSync(fd); }
});

test('owned command inherit stdio reaches the parent subprocess unchanged', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'paisaxe-owned-inherit-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const report = join(dir, 'result.json');
  const helper = new URL('./contract-owned-process.mjs', import.meta.url).href;
  const source = `import{createOwnedProcessScope}from ${JSON.stringify(helper)};import{writeFileSync}from'node:fs';
    const scope=createOwnedProcessScope();try{
      const result=await scope.run(process.execPath,['-e','process.stdout.write("inherited-stdout");process.stderr.write("inherited-stderr")'],{stdio:'inherit',maxBuffer:1});
      writeFileSync(${JSON.stringify(report)},JSON.stringify({status:result.status,stdout:result.stdout,stderr:result.stderr,settled:result.child.settled,error:result.error?.code??null}));
    }finally{scope.close()}`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', source], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.error, undefined);
  assert.equal(child.stdout, 'inherited-stdout');
  assert.equal(child.stderr, 'inherited-stderr');
  assert.deepEqual(JSON.parse(readFileSync(report, 'utf8')), { status: 0, stdout: '', stderr: '', settled: true, error: null });
});

test('per-command durable intent precedes spawn and settlement uses its own command ID', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'paisaxe-command-intent-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const marker = join(dir, 'intent');
  const calls = [];
  const commandTracker = {
    beforeLaunch() { calls.push('intent'); writeFileSync(marker, 'command-one'); return 'command-one'; },
    onStart(id, child) { calls.push(['start', id, child]); },
    onSettled(id, result) { calls.push(['settled', id, result.child]); },
  };
  const scope = createOwnedProcessScope();
  try {
    const result = await scope.run(process.execPath, ['-e', `const fs=require('node:fs');process.exitCode=fs.existsSync(${JSON.stringify(marker)})?0:17`], { commandTracker });
    assert.equal(result.status, 0, 'child must never execute before durable intent exists');
    assert.equal(readFileSync(marker, 'utf8'), 'command-one');
    assert.equal(calls[0], 'intent');
    assert.deepEqual(calls.slice(1).map((x) => x.slice(0, 2)), [['start', 'command-one'], ['settled', 'command-one']]);
    assert.equal(calls[1][2].pid, result.child.pid);
    assert.equal(calls[1][2].pgid, result.child.pgid);
    assert.equal(typeof calls[1][2].startedAt, 'string');
    assert.equal(calls[2][2].settled, true);
    assert.equal(Object.hasOwn(calls[1][2], 'args'), false);
    assert.equal(Object.hasOwn(calls[1][2], 'env'), false);
  } finally { scope.close(); }
});

test('failed durable intent prevents child creation rather than creating an untracked child', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'paisaxe-command-refusal-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const marker = join(dir, 'child-ran');
  const scope = createOwnedProcessScope();
  try {
    await assert.rejects(scope.run(process.execPath, ['-e', `require('node:fs').writeFileSync(${JSON.stringify(marker)},'ran')`], {
      commandTracker: { beforeLaunch() { throw new Error('receipt write refused'); } },
    }), /receipt write refused/);
    assert.equal(existsSync(marker), false);
  } finally { scope.close(); }
});

test('failed child identity recording cancels the created group and leaves intent protected', async () => {
  const scope = createOwnedProcessScope({ settlementMs: 1000 });
  let started, settledCalled = false;
  try {
    const result = await scope.run(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {
      commandTracker: {
        beforeLaunch() { return 'durable-intent'; },
        onStart(id, child) { assert.equal(id, 'durable-intent'); started = child; throw new Error('identity write failed'); },
        onSettled() { settledCalled = true; },
      },
    });
    assert.equal(result.error.code, 'CONTRACT_TRACKING_FAILED');
    assert.equal(settledCalled, false, 'failed onStart must not be followed by intent deletion');
    assert.equal(alive(started.pid), false);
    assert.equal(scope.interruption.settled, false);
    assert.throws(() => scope.checkpoint(), { code: 'CONTRACT_CHILD_UNSETTLED' });
  } finally {
    if (started?.pid && alive(started.pid)) process.kill(-started.pgid, 'SIGKILL');
    scope.close();
  }
});

test('failed settlement recording is an explicit failure even after the child has exited', async () => {
  const scope = createOwnedProcessScope();
  try {
    const result = await scope.run(process.execPath, ['-e', ''], {
      commandTracker: { beforeLaunch() { return 'durable-intent'; }, onStart() {}, onSettled() { throw new Error('settlement write failed'); } },
    });
    assert.equal(result.status, 0);
    assert.equal(result.child.settled, true);
    assert.equal(result.error.code, 'CONTRACT_TRACKING_FAILED');
    assert.equal(scope.interruption.settled, false);
    assert.throws(() => scope.checkpoint(), { code: 'CONTRACT_CHILD_UNSETTLED' });
  } finally { scope.close(); }
});

test('observed no-PID spawn failure settles only its own durable intent', async () => {
  const scope = createOwnedProcessScope();
  const calls = [];
  try {
    const result = await scope.run('/nonexistent-paisaxe-synthetic-command', [], {
      commandTracker: { beforeLaunch() { return 'spawn-intent'; }, onStart() { assert.fail('missing binary has no child identity'); }, onSettled(id, outcome) { calls.push({ id, outcome }); } },
    });
    assert.equal(result.error.code, 'ENOENT');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].id, 'spawn-intent');
    assert.equal(calls[0].outcome.spawnFailed, true);
    assert.equal(calls[0].outcome.child.pid, null);
  } finally { scope.close(); }
});

test('owned commands retain nonzero result, capture output and remove handlers', async () => {
  const before = ['SIGTERM', 'SIGINT'].map((signal) => process.listenerCount(signal));
  const scope = createOwnedProcessScope();
  try {
    const result = await scope.run(process.execPath, ['-e', 'process.stdout.write("out"); process.stderr.write("err"); process.exitCode=7']);
    assert.equal(result.status, 7); assert.equal(result.stdout, 'out'); assert.equal(result.stderr, 'err');
    assert.equal(result.child.settled, true); assert.equal(scope.interruption, null);
  } finally { scope.close(); }
  assert.deepEqual(['SIGTERM', 'SIGINT'].map((signal) => process.listenerCount(signal)), before);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  test('actual ' + signal + ' forwards to the recorded child and proves settlement', async () => {
    const scope = createOwnedProcessScope({ settlementMs: 1000 });
    try {
      const result = await scope.run(process.execPath, ['-e', `process.kill(process.ppid, '${signal}'); setInterval(()=>{},1000)`]);
      assert.equal(result.signal, signal); assert.equal(result.child.settled, true);
      assert.equal(alive(result.child.pid), false);
      assert.equal(scope.interruption.signal, signal); assert.equal(scope.interruption.settled, true);
      assert.throws(() => scope.checkpoint(), { code: 'CONTRACT_INTERRUPTED' });
      await assert.rejects(scope.run(process.execPath, ['-e', '']), { code: 'CONTRACT_INTERRUPTED' });
    } finally { scope.close(); }
  });
}

test('command timeout settles the child and cannot become successful work', async () => {
  const scope = createOwnedProcessScope({ settlementMs: 1000 });
  try {
    const result = await scope.run(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeout: 100 });
    assert.equal(result.error.code, 'ETIMEDOUT'); assert.equal(result.child.settled, true);
    assert.equal(scope.interruption.reason, 'timeout');
    assert.throws(() => scope.checkpoint(), { code: 'CONTRACT_INTERRUPTED' });
  } finally { scope.close(); }
});

test('unsettled child remains explicit and blocks further work', async () => {
  const scope = createOwnedProcessScope({ settlementMs: 80 });
  let result;
  try {
    result = await scope.run(process.execPath, ['-e', 'process.on("SIGTERM",()=>{}); process.kill(process.ppid,"SIGTERM"); setInterval(()=>{},1000)']);
    assert.equal(result.child.settled, false); assert.equal(result.error.code, 'CONTRACT_CHILD_UNSETTLED');
    assert.equal(scope.interruption.settled, false);
    process.emit('SIGINT');
    assert.equal(scope.interruption.settled, false);
    assert.equal(scope.interruption.child.pgid, result.child.pgid);
    process.emit('SIGTERM');
    assert.equal(scope.interruption.settled, false);
    assert.equal(scope.interruption.child.pgid, result.child.pgid);
    assert.throws(() => scope.checkpoint(), { code: 'CONTRACT_CHILD_UNSETTLED' });
  } finally {
    if (result?.child.pid && alive(result.child.pid)) process.kill(-result.child.pgid, 'SIGKILL');
    scope.close();
  }
});

test('signal reaches owned descendants and parent waits for their settlement', async () => {
  const scope = createOwnedProcessScope({ settlementMs: 1500 });
  try {
    const source = `const {spawn}=require('node:child_process');
      const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
      process.on('SIGTERM',()=>{child.once('exit',()=>process.exit(0)); child.kill('SIGTERM')});
      console.log(child.pid); setTimeout(()=>process.kill(process.ppid,'SIGTERM'),100);`;
    const result = await scope.run(process.execPath, ['-e', source]);
    const descendant = Number(result.stdout.trim());
    assert.ok(descendant > 0); assert.equal(alive(descendant), false);
    assert.equal(result.child.settled, true); assert.equal(scope.interruption.settled, true);
  } finally { scope.close(); }
});

test('an exited leader cannot hide a surviving descendant', async () => {
  const scope = createOwnedProcessScope({ settlementMs: 80 });
  let result;
  try {
    const source = `const {spawn}=require('node:child_process');
      const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
      child.unref(); console.log(child.pid);`;
    result = await scope.run(process.execPath, ['-e', source]);
    assert.equal(result.status, 0); assert.equal(result.child.settled, false);
    assert.equal(result.error.code, 'CONTRACT_CHILD_UNSETTLED');
    assert.equal(scope.interruption.settled, false);
    assert.equal(scope.interruption.child.pgid, result.child.pgid);
    process.emit('SIGTERM');
    assert.equal(scope.interruption.settled, false);
    assert.equal(scope.interruption.child.pgid, result.child.pgid);
    assert.throws(() => scope.checkpoint(), { code: 'CONTRACT_CHILD_UNSETTLED' });
  } finally {
    if (result?.child.pgid) { try { process.kill(-result.child.pgid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } }
    scope.close();
  }
});

test('signal after leader exit still reaches its surviving group', async () => {
  const scope = createOwnedProcessScope({ settlementMs: 1500 }); let result;
  try {
    const source = `const {spawn}=require('node:child_process');
      const child=spawn(process.execPath,['-e',"setTimeout(()=>process.kill(${process.pid},'SIGTERM'),200);setInterval(()=>{},1000)"],{stdio:'ignore'});
      child.unref(); console.log(child.pid);`;
    result = await scope.run(process.execPath, ['-e', source]);
    assert.equal(result.status, 0); assert.equal(result.child.settled, true);
    assert.equal(scope.interruption.signal, 'SIGTERM'); assert.equal(scope.interruption.settled, true);
    assert.equal(alive(Number(result.stdout.trim())), false);
  } finally {
    if (result?.child.pgid) { try { process.kill(-result.child.pgid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } }
    scope.close();
  }
});
