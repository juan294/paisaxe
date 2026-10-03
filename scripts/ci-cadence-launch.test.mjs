import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { launchNative, nativeScannerDigest } from './ci-cadence-launch.mjs';
import { user } from '../tests/fixtures/ci-cadence-adapter/native/fixture.mjs';
import { launchFixture } from '../tests/fixtures/ci-cadence-adapter/native/launch-fixture.mjs';
const each = (name, body) => test(name, async () => { const f = await launchFixture(); try { await body(f); } finally { await f.close(); } });
each('real protected modules classify full without candidate import', async f => { const x = await f.prepare(); x.input.mode = 'legacy'; const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'full'); assert.equal(r.definitionSha, x.base); assert.equal(r.sourceSha, x.source); assert.equal(f.fetches[0].url, 'https://github.com/juan294/paisaxe.git'); assert.ok(f.requests.every(r => r.method === 'GET')); });
each('real Fast executes all four works from protected modules', async f => { const x = await f.prepare(); const r = await launchNative(x.input, x.transports); assert.equal(r.success, true); assert.equal(r.completed.length, 4); });
each('hostile candidate import mutation never executes', async f => { const canary = join(f.root, 'canary'); const x = await f.prepare('push', { mutate: async f => { const source = `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(canary)}, 'executed'); throw Error('hostile');`; await f.put('scripts/ci-cadence-native.mjs', source); await f.put('scripts/ci-fast.mjs', source); await f.put('scripts/ci-cadence.mjs', source); } }); const r = await launchNative(x.input, x.transports); assert.equal(r.success, true); await assert.rejects(access(canary)); });
each('physical original PR merge is retained and never reusable', async f => { const x = await f.prepare('pull_request'); const before = f.git('rev-parse', 'HEAD'); x.input.mode = 'legacy'; const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'full'); assert.equal(r.testedCheckoutSha, x.checkout); assert.equal(r.reusable, false); assert.equal(f.git('rev-parse', 'HEAD'), before); });
each('schedule authentic develop ref resolves exactly once and pins its checkout', async f => { const x = await f.prepare('schedule'); const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'nightly'); assert.equal(r.sourceSha, x.source); assert.equal(r.definitionSha, x.base); assert.equal(f.requests.filter(r => r.url.endsWith('/git/ref/heads/develop')).length, 1); assert.equal(f.git('rev-parse', 'HEAD'), x.base); });
each('both absent preserves legacy full without import', async f => { const x = await f.prepare('push', { definition: f.absent }); const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'full'); assert.equal(r.protectedImported, false); });
each('absent installation disables new nightly without integration resolution', async f => { const x = await f.prepare('schedule', { definition: f.absent }); const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'disabled'); assert.equal(f.requests.filter(r => r.url.endsWith('/git/ref/heads/develop')).length, 0); });
each('partial installation blocks before code import', async f => { const x = await f.prepare('push', { definition: f.partial }); const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'blocked'); assert.equal(r.protectedImported, false); });
for (const fault of ['repository', 'ref', 'quota', 'redirect', 'throw']) each(`external HTTP ${fault} fails closed and redacts token`, async f => { const x = await f.prepare(); const request = async (url, init) => { if (fault === 'throw') throw Error('fixture-token'); if (fault === 'redirect') return new Response('', { status: 302 }); if (fault === 'quota') return new Response('{}', { headers: { 'x-ratelimit-remaining': '0' } }); const response = await x.transports.request(url, init); const data = await response.json(); if (fault === 'repository' && !url.includes('/git/')) data.id = 333; if (fault === 'ref' && url.includes('/git/ref/')) data.object.sha = 'a'.repeat(40); return new Response(JSON.stringify(data), { headers: { 'x-ratelimit-remaining': '5000' } }); }; const r = await launchNative(x.input, { ...x.transports, request }); assert.equal(r.lane, 'blocked'); assert.equal(r.protectedImported, false); assert.ok(!JSON.stringify(r).includes('fixture-token')); });
each('transport claiming success without exact commit/ref cannot import', async f => { const x = await f.prepare(); const r = await launchNative(x.input, { ...x.transports, gitTransport: () => {} }); assert.equal(r.lane, 'blocked'); assert.equal(r.protectedImported, false); });
each('candidate origin mismatch blocks before external transport', async f => { const x = await f.prepare(); f.git('remote', 'set-url', 'origin', 'https://evil.example/paisaxe.git'); assert.equal((await launchNative(x.input, x.transports)).lane, 'blocked'); assert.equal(f.fetches.length, 0); });
each('native context checkout mismatch blocks before import', async f => { const x = await f.prepare(); x.input.context.sha = x.base; const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'blocked'); assert.equal(r.protectedImported, false); });
each('modified protected module bytes block before import', async f => { f.git('checkout', '--quiet', '--force', '--detach', f.definition); await f.put('scripts/ci-fast.mjs', 'throw Error("wrong protected bytes")'); f.git('add', '.'); const changed = f.git('commit-tree', f.git('write-tree'), '-p', f.definition, '-m', 'changed module'); const x = await f.prepare('push', { definition: changed }); const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'blocked'); assert.equal(r.protectedImported, false); });
each('preload environment is rejected rather than trusted as clean Node startup', async f => { const x = await f.prepare(); const previous = process.env.NODE_OPTIONS; try { process.env.NODE_OPTIONS = '--require hostile.cjs'; assert.equal((await launchNative(x.input, x.transports)).lane, 'blocked'); } finally { if (previous === undefined) delete process.env.NODE_OPTIONS; else process.env.NODE_OPTIONS = previous; } });

each('first-install PR with counterfeit same-repository ID blocks before import', async f => { const x = await f.prepare('pull_request', { definition: f.absent }); x.input.event.pull_request.head.repo.id = 999; const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'blocked'); assert.equal(r.protectedImported, false); });

for (const sender of [user('outsider'), user('dependabot[bot]')]) each(`native ${sender.login} keeps hosted read-only untrusted lane`, async f => { const x = await f.prepare('push', { sender }); const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'untrusted'); assert.equal(r.allowPrivileged, false); assert.equal(r.runner, 'standard-hosted'); assert.equal(r.token, 'read-only'); assert.equal(r.reusable, false); });
each('same-owner fork PR cannot obtain a fast lane', async f => { const x = await f.prepare('pull_request', { fork: true }); const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'untrusted'); assert.equal(r.allowPrivileged, false); assert.equal(r.reusable, false); });
each('production push always returns release classification without Fast work', async f => { const x = await f.prepare(); x.input.event.ref = x.input.context.ref = 'refs/heads/main'; const request = async (url, init) => { const response = await x.transports.request(url, init); const data = await response.json(); if (url.endsWith('/git/ref/heads/main')) data.object.sha = x.source; return new Response(JSON.stringify(data), { headers: { 'x-ratelimit-remaining': '5000' } }); }; const r = await launchNative(x.input, { ...x.transports, request }); assert.equal(r.lane, 'release'); assert.equal(r.releaseRequired, true); assert.equal(r.allowDeploy, true); assert.equal(r.completed, undefined); });
each('legacy installed nightly remains disabled without develop resolution', async f => { const x = await f.prepare('schedule'); x.input.mode = 'legacy'; const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'disabled'); assert.equal(r.protectedImported, false); assert.equal(f.requests.filter(x => x.url.endsWith('/git/ref/heads/develop')).length, 0); });
each('wrong authenticated immutable definition object blocks', async f => { const x = await f.prepare(); const request = async (url, init) => { if (url.includes('/git/commits/')) return new Response(JSON.stringify({ sha: x.source }), { headers: { 'x-ratelimit-remaining': '5000' } }); return x.transports.request(url, init); }; const r = await launchNative(x.input, { ...x.transports, request }); assert.equal(r.lane, 'blocked'); assert.equal(r.protectedImported, false); });
each('wrong fetched ref object cannot be accepted from a successful transport', async f => { const x = await f.prepare(); const gitTransport = p => { p.run(['fetch', '--no-tags', '--force', f.root, `${x.source}:${p.ref}`], p.root); }; const r = await launchNative(x.input, { ...x.transports, gitTransport }); assert.equal(r.lane, 'blocked'); assert.equal(r.protectedImported, false); });
each('protected pin movement during candidate fetch blocks before import', async f => { const x = await f.prepare(); let calls = 0; const gitTransport = async p => { await x.transports.gitTransport(p); if (++calls === 2) p.run(['update-ref', `refs/ci-cadence/protected/${x.base}`, x.source], p.root); }; const r = await launchNative(x.input, { ...x.transports, gitTransport }); assert.equal(r.lane, 'blocked'); assert.equal(r.protectedImported, false); });
each('oversized streamed HTTP body blocks before materialization', async f => { const x = await f.prepare(); const request = async () => new Response('x'.repeat(2000001), { headers: { 'x-ratelimit-remaining': '5000' } }); const r = await launchNative(x.input, { ...x.transports, request }); assert.equal(r.lane, 'blocked'); assert.equal(r.protectedImported, false); });
each('hanging external HTTP honors acquisition timeout and hides authorization', async f => { const x = await f.prepare(); const started = performance.now(); const r = await launchNative(x.input, { ...x.transports, request: () => new Promise(() => {}) }); assert.equal(r.lane, 'blocked'); assert.equal(r.protectedImported, false); assert.ok(performance.now() - started < 6500); assert.ok(!JSON.stringify(r).includes('fixture-token')); });
each('physical graft cannot manufacture original PR parent admission', async f => { const x = await f.prepare('pull_request'); await f.put('.git/info/grafts', `${x.checkout} ${x.source} ${x.base}\n`); x.input.mode = 'legacy'; const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'full'); assert.equal(r.testedCheckoutSha, x.checkout); });
each('altered frozen bytes cannot import even with valid native module pins', async f => { f.git('checkout', '--quiet', '--force', '--detach', f.definition); await f.put('tests/fixtures/ci-cadence/events.json', '{}'); f.git('add', '.'); const changed = f.git('commit-tree', f.git('write-tree'), '-p', f.definition, '-m', 'changed frozen input'); const x = await f.prepare('push', { definition: changed }); const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'blocked'); assert.equal(r.protectedImported, false); });

each('canonical Actions checkout HTTPS origin without dot-git is accepted', async f => { const x = await f.prepare(); f.git('remote', 'set-url', 'origin', 'https://github.com/juan294/paisaxe'); x.input.mode = 'legacy'; const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'full'); assert.ok(f.fetches.every(x => x.url === 'https://github.com/juan294/paisaxe.git')); });

each('wrong physical PR parent order blocks before HTTP or protected import', async f => { const x = await f.prepare('pull_request'); const wrong = f.git('commit-tree', f.git('rev-parse', `${x.checkout}^{tree}`), '-p', x.source, '-p', x.base, '-m', 'wrong physical parents'); f.git('checkout', '--quiet', '--force', '--detach', wrong); x.input.context.sha = wrong; const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'blocked'); assert.equal(r.protectedImported, false); assert.equal(f.requests.length, 0); });
each('missing mode cannot activate Fast or execute cheap works', async f => { const x = await f.prepare(); delete x.input.mode; const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'full'); assert.equal(r.completed, undefined); });
each('supplied resolver cannot replace the single authenticated scheduled snapshot', async f => { const x = await f.prepare('schedule'); x.input.resolveIntegrationHead = () => { throw Error('caller resolver used'); }; const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'nightly'); assert.equal(r.sourceSha, x.source); assert.equal(f.requests.filter(r => r.url.endsWith('/git/ref/heads/develop')).length, 1); });
each('streamed body timeout bounds reads as well as initial response', async f => { const x = await f.prepare(); const request = async () => new Response(new ReadableStream({ start() {}, cancel() { return new Promise(() => {}); } }), { headers: { 'x-ratelimit-remaining': '5000' } }); const started = performance.now(); const r = await launchNative(x.input, { ...x.transports, request }); assert.equal(r.lane, 'blocked'); assert.equal(r.protectedImported, false); assert.ok(performance.now() - started < 6500); });
each('hanging external Git transport is bounded and owned temporary root is removed', async f => { const x = await f.prepare(); let temporary; const gitTransport = p => { temporary = p.root; return new Promise(() => {}); }; const started = performance.now(); const r = await launchNative(x.input, { ...x.transports, gitTransport }); assert.equal(r.lane, 'blocked'); assert.equal(r.protectedImported, false); assert.ok(performance.now() - started < 12000); await assert.rejects(access(temporary)); assert.equal(f.git('rev-parse', 'HEAD'), x.checkout); });

each('first-install bot retains explicit hosted read-only untrusted outputs', async f => { const x = await f.prepare('push', { definition: f.absent, sender: user('dependabot[bot]') }); const r = await launchNative(x.input, x.transports); assert.equal(r.lane, 'untrusted'); assert.equal(r.runner, 'standard-hosted'); assert.equal(r.token, 'read-only'); assert.equal(r.acceptanceBlocked, true); assert.equal(r.allowPrivileged, false); });

each('first-install production owner preserves independent mandatory release outputs', async f => { const x = await f.prepare('push', { definition: f.absent }); x.input.event.ref = x.input.context.ref = 'refs/heads/main'; const request = async (url, init) => { const response = await x.transports.request(url, init); const data = await response.json(); if (url.endsWith('/git/ref/heads/main')) data.object.sha = x.source; return new Response(JSON.stringify(data), { headers: { 'x-ratelimit-remaining': '5000' } }); }; const r = await launchNative(x.input, { ...x.transports, request }); assert.equal(r.lane, 'release'); assert.equal(r.releaseRequired, true); assert.equal(r.allowDeploy, true); assert.equal(r.allowPrivileged, true); assert.equal(r.protectedImported, false); });

for (const scenario of [
  { name: 'development HEAD', branch: 'develop', change: 'head' },
  { name: 'production HEAD', branch: 'main', change: 'head' },
  { name: 'development origin', branch: 'develop', change: 'origin' },
  { name: 'production origin', branch: 'main', change: 'origin' },
  { name: 'untrusted HEAD', branch: 'develop', change: 'head', sender: user('outsider') },
]) each(`first-install drift ${scenario.name} blocks before fallback privilege`, async f => {
  const x = await f.prepare('push', { definition: f.absent, sender: scenario.sender });
  x.input.mode = 'legacy';
  x.input.event.ref = x.input.context.ref = `refs/heads/${scenario.branch}`;
  let changed = false;
  const request = async (url, init) => {
    const response = await x.transports.request(url, init);
    const data = await response.json();
    if (url.endsWith(`/git/ref/heads/${scenario.branch}`)) data.object.sha = x.source;
    if (!changed) {
      changed = true;
      if (scenario.change === 'head') f.git('checkout', '--quiet', '--force', '--detach', x.base);
      else f.git('remote', 'set-url', 'origin', 'https://evil.example/paisaxe.git');
    }
    return new Response(JSON.stringify(data), { headers: { 'x-ratelimit-remaining': '5000' } });
  };
  const r = await launchNative(x.input, { ...x.transports, request });
  assert.equal(changed, true);
  assert.equal(r.lane, 'blocked');
  assert.equal(r.protectedImported, false);
  assert.equal(r.allowDeploy, false);
  assert.equal(r.allowPrivileged, false);
});
for (const remaining of [999, 1000, "9007199254740992"]) each(`bootstrap reserve boundary ${remaining} preserves quota`, async f => {
  const x = await f.prepare(); x.input.mode = 'legacy';
  const request = async (url, init) => {
    const response = await x.transports.request(url, init);
    return new Response(await response.text(), { headers: { 'x-ratelimit-remaining': String(remaining) } });
  };
  const r = await launchNative(x.input, { ...x.transports, request });
  const admissible = Number.isSafeInteger(Number(remaining)) && Number(remaining) >= 1000;
  assert.equal(r.lane, admissible ? 'full' : 'blocked');
  if (!admissible) assert.equal(r.protectedImported, false);
});

test('CLI scanner digest comes from actual supported runtime only', () => {
  for (const [platform, arch, expected] of [
    ['darwin', 'arm64', 'ba52fb1bfabbcde42f032afad3d6e0b19dff8ed105229a16e7caa338bbc0e84f'],
    ['linux', 'x64', '88f91962aa2f93ac6ab281d553b9e125f5197bbbce38f9f2437f7299c32e5509'],
    ['darwin', 'x64', null], ['linux', 'arm64', null], ['unsupported', 'x64', null],
  ]) {
    const p = Object.getOwnPropertyDescriptor(process, 'platform'), a = Object.getOwnPropertyDescriptor(process, 'arch');
    try { Object.defineProperty(process, 'platform', { ...p, value: platform }); Object.defineProperty(process, 'arch', { ...a, value: arch }); assert.equal(nativeScannerDigest(), expected); }
    finally { Object.defineProperty(process, 'platform', p); Object.defineProperty(process, 'arch', a); }
  }
});

each('shared expired launcher deadline blocks before any acquisition/import',async f=>{
 const x=await f.prepare();x.input.mode='legacy';x.input.deadline=performance.now()-1;
 const r=await launchNative(x.input,x.transports);assert.equal(r.lane,'blocked');assert.equal(r.protectedImported,false);assert.equal(f.requests.length,0);
});
