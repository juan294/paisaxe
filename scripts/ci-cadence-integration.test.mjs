import test from 'node:test';
import assert from 'node:assert/strict';

for (const [file, exports] of [
  ['ci-cadence-scanner.mjs', ['acquireScanner']],
  ['ci-cadence-run.mjs', ['decideNightlyRun', 'finalizeCompletedRun']],
  ['ci-cadence-projection.mjs', ['projectFullGraph']],
]) test(`actual B integration module ${file} implements its concrete contract`, async () => {
  const module = await import(new URL(file, import.meta.url));
  for (const name of exports) assert.equal(typeof module[name], 'function');
});

test('protected policy pins actual current installed workflow bytes', async()=>{
 const { readFile }=await import('node:fs/promises');const {createHash}=await import('node:crypto');
 const policy=JSON.parse(await readFile(new URL('../.github/ci-cadence.json',import.meta.url)));
 for(const workflow of policy.workflows){const bytes=await readFile(new URL('../'+workflow.path,import.meta.url));const blob=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');assert.equal(workflow.definitionSha,blob,workflow.path);}
});
