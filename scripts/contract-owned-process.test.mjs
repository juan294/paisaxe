import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOwnedProcessScope } from './contract-owned-process.mjs';

const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; } };

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
