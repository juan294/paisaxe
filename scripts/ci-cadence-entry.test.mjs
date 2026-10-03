import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from 'yaml';
import {createHash} from 'node:crypto';
const workflow=()=>parse(readFileSync(new URL('../.github/workflows/ci-fast.yml',import.meta.url),'utf8'));
test('actual native Fast entry is hosted read-only and six-minute bounded without app dependencies',()=>{const w=workflow();assert.deepEqual(w.permissions,{contents:'read'});const j=w.jobs.fast;assert.equal(j.name,'Cadence entry');assert.equal(j['runs-on'],'ubuntu-latest');assert.equal(j['timeout-minutes'],6);assert.match(j.if,/CI_CADENCE_MODE/);assert.match(j.if,/3944118/);assert.match(j.if,/1141286326/);assert.ok(!JSON.stringify(w).includes('secrets.'));assert.ok(!JSON.stringify(w).includes('npm ci'));assert.ok(!JSON.stringify(w).includes('self-hosted'));});
test('native bootstrap acquires exact protected launcher before any candidate Node import',()=>{const w=workflow();const steps=w.jobs.fast.steps;const bootstrap=steps.find(s=>s.name==='Acquire reviewed protected launcher');assert.ok(bootstrap);const bytes=readFileSync(new URL('./ci-cadence-launch.mjs',import.meta.url));assert.equal(bootstrap.env.LAUNCHER_SHA256,createHash('sha256').update(bytes).digest('hex'));assert.match(bootstrap.run,/git --no-replace-objects/);assert.match(bootstrap.run,/event\.before/);assert.match(bootstrap.run,/pull_request\.base\.sha/);assert.match(bootstrap.run,/sha256sum/);assert.match(bootstrap.run,/unset NODE_OPTIONS/);assert.ok(!steps.some(s=>s.run?.includes('node scripts/ci-cadence-launch')));});
