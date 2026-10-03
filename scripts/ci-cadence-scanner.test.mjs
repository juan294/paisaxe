import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm, readdir, chmod, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const scanner = () => import('./ci-cadence-scanner.mjs');
const SIZE = 21324882;
function header(name, size, mode = 0o644) {
  const out = Buffer.alloc(512);
  out.write(name); out.write(mode.toString(8).padStart(7, '0') + '\0', 100);
  for (const offset of [108, 116]) out.write('0000000\0', offset);
  out.write(size.toString(8).padStart(11, '0') + '\0', 124);
  out.write('00000000000\0', 136); out.fill(32, 148, 156);
  out[156] = 48; out.write('ustar\0', 257); out.write('00', 263);
  checksum(out); return out;
}
function checksum(out) {
  out.fill(32, 148, 156);
  const total = out.reduce((sum, byte) => sum + byte, 0);
  out.write(total.toString(8).padStart(6, '0') + '\0 ', 148);
}
function tar() {
  const entries = [['LICENSE', 1069, 0o644], ['README.md', 29998, 0o644], ['gitleaks', SIZE, 0o755]];
  return Buffer.concat([...entries.flatMap(([name, size, mode]) => [header(name, size, mode), Buffer.alloc(Math.ceil(size / 512) * 512)]), Buffer.alloc(1024)]);
}
test('actual bounded parser returns only the fixed regular executable member', async () => {
  const { parseScannerTar } = await scanner();
  const bytes = parseScannerTar(tar()); assert.equal(bytes.length, SIZE);
  assert.deepEqual(bytes.subarray(0, 8), Buffer.alloc(8));
});
test('actual parser rejects corrupt header checksum rather than treating it as pinned archive proof', async () => {
  const { parseScannerTar } = await scanner(); const bytes = tar(); bytes[0] = 97;
  assert.throws(() => parseScannerTar(bytes), /checksum/i);
});

for (const [name, offset] of [['LICENSE', 512 + 1069], ['README.md', 2560 + 29998], ['gitleaks', 33280 + SIZE]]) {
  test(`actual parser rejects nonzero ${name} member padding`, async () => {
    const { parseScannerTar } = await scanner(); const bytes = tar(); bytes[offset] = 1;
    assert.throws(() => parseScannerTar(bytes), /padding/i);
  });
}
for (const [label, change, error] of [
  ['duplicate member', h => { h.fill(0, 0, 100); h.write('LICENSE'); }, /member/i],
  ['traversal member', h => { h.fill(0, 0, 100); h.write('../gitleaks'); }, /member/i],
  ['absolute member', h => { h.fill(0, 0, 100); h.write('/gitleaks'); }, /member/i],
  ['unknown member', h => { h.fill(0, 0, 100); h.write('candidate'); }, /member/i],
  ['NUL tail junk', h => { h[12] = 65; }, /name/i],
  ['link target', h => { h[157] = 65; }, /regular/i],
  ['prefix', h => { h[345] = 65; }, /regular/i],
  ['reserved header data', h => { h[500] = 65; }, /regular/i],
  ['unsafe numeric encoding', h => { h[124] = 0x80; }, /numeric/i],
  ['high-bit numeric encoding', h => { h[124] |= 0x80; }, /numeric/i],
  ['wrong member size', h => { h.write('00000000001\0', 124); }, /size/i],
  ['wrong executable mode', h => { h.write('0000644\0', 100); }, /mode/i],
  ['unsupported magic', h => { h[257] = 65; }, /format/i],
  ['high-bit magic alias', h => { h[257] |= 0x80; }, /format/i],
]) test(`actual parser rejects ${label} with a recomputed valid checksum`, async () => {
  const { parseScannerTar } = await scanner(); const bytes = tar(); const h = bytes.subarray(32768, 33280);
  change(h); checksum(h); assert.throws(() => parseScannerTar(bytes), error);
});
for (const type of ['1', '2', '3', '4', '5', '6', 'x', 'g', 'S', '\0']) test(`actual parser rejects TAR type ${JSON.stringify(type)}`, async () => {
  const { parseScannerTar } = await scanner(); const bytes = tar(); const h = bytes.subarray(32768, 33280);
  h[156] = type.charCodeAt(0); checksum(h); assert.throws(() => parseScannerTar(bytes), /regular/i);
});
for (const [name, mutate, error] of [
  ['truncated executable', b => b.subarray(0, 33280), /truncated/i],
  ['missing end block', b => b.subarray(0, b.length - 512), /terminator/i],
  ['trailing nonzero', b => { b[b.length - 1] = 1; return b; }, /trailing/i],
  ['unaligned data', b => b.subarray(0, b.length - 1), /size/i],
  ['expanded bomb', () => Buffer.alloc(32 * 1024 * 1024 + 512), /size/i],
]) test(`actual parser rejects ${name}`, async () => {
  const { parseScannerTar } = await scanner(); assert.throws(() => parseScannerTar(mutate(tar())), error);
});
test('actual gzip decoder validates gzip and preserves parser input', async () => {
  const { decodeScannerArchive, parseScannerTar } = await scanner();
  assert.equal(parseScannerTar(await decodeScannerArchive(gzipSync(tar()))).length, SIZE);
});
test('actual gzip decoder rejects corrupt CRC', async () => {
  const { decodeScannerArchive } = await scanner(); const archive = gzipSync(tar()); archive[archive.length - 8] ^= 1;
  await assert.rejects(decodeScannerArchive(archive));
});
test('actual gzip decoder rejects truncated input', async () => {
  const { decodeScannerArchive } = await scanner(); const archive = gzipSync(tar());
  await assert.rejects(decodeScannerArchive(archive.subarray(0, archive.length - 5)));
});
test('actual gzip decoder stops an expanded-data bomb at the fixed bound', async () => {
  const { decodeScannerArchive } = await scanner();
  await assert.rejects(decodeScannerArchive(gzipSync(Buffer.alloc(32 * 1024 * 1024 + 512))), /limit/i);
});
test('actual gzip decoder rejects compressed input beyond its fixed bound', async () => {
  const { decodeScannerArchive } = await scanner();
  await assert.rejects(decodeScannerArchive(Buffer.alloc(8230403)), /bound/i);
});

const platform = `${process.platform}_${process.arch}`;
const archiveBytes = platform === 'darwin_arm64' ? 7897593 : 8230402;
const url = `https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_${platform}.tar.gz`;
const response = (requested, { status = 200, length = null, location = null, chunks = [], body } = {}) => ({
  status, url: requested, headers: { get: name => name === 'content-length' ? length : name === 'location' ? location : null },
  body: body ?? new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close(); } }),
});
async function temporary(run) {
  const raw = await mkdtemp(join(tmpdir(), 'c-scanner-')); const root = await realpath(raw);
  try { return await run(root); } finally { await rm(root, { recursive: true, force: true }); }
}
async function rejectedTransport(fetchImpl, milliseconds = 1000) {
  const { acquireScanner } = await scanner();
  return temporary(async directory => {
    await assert.rejects(acquireScanner({ directory, deadline: performance.now() + milliseconds, fetchImpl }), /failed or unavailable/i);
    assert.deepEqual(await readdir(directory), [], 'failure creates no executable or foreign cleanup');
  });
}
test('actual transport uses only the fixed URL and credential-free bounded request options', async () => {
  const requests = [];
  await rejectedTransport((requested, options) => {
    requests.push({ requested, options });
    return response(requested, { status: 503 });
  }); assert.equal(requests.length, 1);
  const { requested, options } = requests[0];
  assert.equal(requested, url); assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'manual');
  assert.equal(options.credentials, 'omit'); assert.equal(options.referrerPolicy, 'no-referrer');
  assert.deepEqual(options.headers, { Accept: 'application/octet-stream' }); assert.ok(options.signal instanceof AbortSignal);
});
for (const length of ['-1', '1.0', '1e3', '9007199254740993', String(archiveBytes + 1), 1, ['1']]) {
  test(`actual reader rejects malformed or mismatching length ${JSON.stringify(length)}`, async () => {
    await rejectedTransport(requested => response(requested, { length }));
  });
}
for (const [name, chunks] of [
  ['truncated', [new Uint8Array(3)]], ['overlong', [new Uint8Array(archiveBytes + 1)]],
  ['wrong digest at exact byte count', [new Uint8Array(archiveBytes)]], ['invalid chunk type', ['candidate']],
]) test(`actual reader rejects ${name} response body`, async () => {
  await rejectedTransport(requested => response(requested, { chunks }));
});
for (const target of ['http://release-assets.githubusercontent.com/a', 'https://evil.invalid/a', 'https://u:p@release-assets.githubusercontent.com/a', 'https://release-assets.githubusercontent.com:444/a', 'https://release-assets.githubusercontent.com/a#fragment', ' https://release-assets.githubusercontent.com/a', 'https://release-assets.githubusercontent.com/' + 'a'.repeat(4096)]) {
  test('actual reader rejects unapproved redirect ' + target.slice(0, 70), async () => {
    let calls = 0; await rejectedTransport(requested => { calls++; return response(requested, { status: 302, location: target }); });
    assert.equal(calls, 1);
  });
}
test('actual reader follows one approved redirect without forwarding credentials', async () => {
  const target = 'https://release-assets.githubusercontent.com/asset?signature=private-fixture'; const requests = []; const headers = [];
  await rejectedTransport((requested, options) => {
    requests.push(requested); headers.push(options.headers);
    return requested === url ? response(requested, { status: 302, location: target }) : response(requested, { chunks: [new Uint8Array(3)] });
  }); assert.deepEqual(requests, [url, target]);
  assert.deepEqual(headers, [{ Accept: 'application/octet-stream' }, { Accept: 'application/octet-stream' }]);
});
test('actual reader rejects a second redirect with exactly two GETs', async () => {
  let calls = 0; await rejectedTransport(requested => { calls++; return response(requested, { status: 302, location: 'https://release-assets.githubusercontent.com/asset' }); });
  assert.equal(calls, 2);
});
test('actual reader rejects inconsistent response URL', async () => {
  await rejectedTransport(() => response('https://evil.invalid/candidate'));
});
test('actual reader rejects missing stream body', async () => {
  await rejectedTransport(requested => ({ ...response(requested), body: null }));
});
test('actual reader aborts a hanging body even when external transport ignores signal', async () => {
  let calls = 0; let cancelled = false;
  await rejectedTransport(requested => { calls++; return response(requested, { body: new ReadableStream({ pull() { return new Promise(() => {}); }, cancel() { cancelled = true; } }) }); }, 200);
  assert.equal(calls, 1); assert.equal(cancelled, true);
});
test('actual reader aborts a hanging request that ignores signal', async () => {
  let calls = 0; await rejectedTransport(() => { calls++; return new Promise(() => {}); }, 200); assert.equal(calls, 1);
});
test('actual reader rejects empty chunks immediately instead of retaining unbounded empty buffers', async () => {
  let reads = 0;
  await rejectedTransport(requested => response(requested, { body: { getReader() { return {
    async read() { reads++; return reads === 1 ? { done: false, value: new Uint8Array(0) } : { done: true }; },
    releaseLock() {}, async cancel() {},
  }; } } })); assert.equal(reads, 1);
});
test('actual reader bounds fragmented chunk metadata independently of compressed bytes', async () => {
  let reads = 0;
  await rejectedTransport(requested => response(requested, { body: { getReader() { return {
    async read() { reads++; return reads <= 16385 ? { done: false, value: new Uint8Array(1) } : { done: true }; },
    releaseLock() {}, async cancel() {},
  }; } } })); assert.equal(reads, 16385);
});
test('expired deadline rejects before fetching or materializing', async () => {
  const { acquireScanner } = await scanner(); let calls = 0;
  await temporary(async directory => {
    await assert.rejects(acquireScanner({ directory, deadline: performance.now() - 1, fetchImpl() { calls++; } }), /expired/i);
    assert.deepEqual(await readdir(directory), []);
  }); assert.equal(calls, 0);
});
test('candidate runtime, URL, pin and bound overrides are not an acquisition input', async () => {
  const { acquireScanner } = await scanner(); let calls = 0;
  await temporary(async directory => {
    for (const key of ['platform', 'arch', 'url', 'sha256', 'archiveBytes', 'maxExpanded', 'headers']) {
      await assert.rejects(acquireScanner({ directory, deadline: performance.now() + 1000, fetchImpl() { calls++; }, [key]: 'candidate' }), /unsupported acquisition option/i);
    }
  }); assert.equal(calls, 0);
});
test('nonprivate or symlink directories are denied before fetching', async () => {
  const { acquireScanner } = await scanner(); let calls = 0;
  await temporary(async directory => {
    const link = directory + '-link'; await symlink(directory, link);
    try { await assert.rejects(acquireScanner({ directory: link, deadline: performance.now() + 1000, fetchImpl() { calls++; } }), /unavailable/i); }
    finally { await rm(link); }
    await chmod(directory, 0o755);
    await assert.rejects(acquireScanner({ directory, deadline: performance.now() + 1000, fetchImpl() { calls++; } }), /unavailable/i);
  }); assert.equal(calls, 0);
});
test('actual unsupported runtime predicate fails before external fetch', () => {
  const source = `Object.defineProperty(process, 'platform', { value: 'unsupported-runtime' });\nconst { acquireScanner } = await import(${JSON.stringify(new URL('./ci-cadence-scanner.mjs', import.meta.url).href)});\nlet calls=0;try {await acquireScanner({ fetchImpl(){calls++;} });process.exitCode=9;}catch(error){if(!error.message.includes('unsupported actual runtime')||calls!==0)process.exitCode=8;}\n`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], { encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
});

for (const reason of ['status', 'url', 'length', 'redirect']) test(`rejected ${reason} response disposes its obtained body before returning`, async () => {
  const { acquireScanner } = await scanner(); let cancellations = 0;
  const body = new ReadableStream({ cancel() { cancellations++; } });
  try {
    await temporary(async directory => {
      await assert.rejects(acquireScanner({ directory, deadline: performance.now() + 1000, fetchImpl: requested => response(reason === 'url' ? 'https://evil.invalid/response' : requested, {
        status: reason === 'status' ? 503 : reason === 'redirect' ? 302 : 200,
        length: reason === 'length' ? '-1' : null, location: 'https://evil.invalid/redirect', body,
      }) }), /failed or unavailable/);
      assert.deepEqual(await readdir(directory), []);
      assert.equal(cancellations, 1, 'an obtained rejected body remains undisposed');
    });
  } finally { if (!body.locked) await body.cancel(); }
});
test('finite reader cancellation is joined before early failure returns within its existing budget', async () => {
  let cancellation; let settled = false;
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(0)); }, cancel() {
    cancellation = delay(40).then(() => { settled = true; }); return cancellation;
  } });
  try {
    await rejectedTransport(requested => response(requested, { body }));
    assert.equal(settled, true, 'acquisition returned while finite cancellation was outstanding');
  } finally { await cancellation; }
});
test('finite response arriving after the deadline is disposed without late materialization', async () => {
  const { acquireScanner } = await scanner(); let pending; let cancellations = 0;
  const body = new ReadableStream({ cancel() { cancellations++; } });
  try {
    await temporary(async directory => {
      const started = performance.now();
      await assert.rejects(acquireScanner({ directory, deadline: started + 80, fetchImpl: requested => {
        pending = delay(160).then(() => response(requested, { body })); return pending;
      } }), /failed or unavailable/);
      assert.ok(performance.now() - started < 150, 'late response extended the captured deadline');
      await pending; await delay(10);
      assert.equal(cancellations, 1, 'late response body was never disposed');
      assert.deepEqual(await readdir(directory), []);
    });
  } finally { await pending; if (!body.locked) await body.cancel(); }
});
test('nonsettling cancellation cannot extend the captured deadline or cause a retry', async () => {
  const { acquireScanner } = await scanner(); let finish; let cancellation; let calls = 0; let cancellations = 0;
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(0)); }, cancel() {
    cancellations++; cancellation = new Promise(resolve => { finish = resolve; }); return cancellation;
  } });
  try {
    await temporary(async directory => {
      const started = performance.now();
      await assert.rejects(acquireScanner({ directory, deadline: started + 100, fetchImpl: requested => { calls++; return response(requested, { body }); } }), /failed or unavailable/);
      assert.ok(performance.now() - started < 300, 'cleanup exceeded the original budget');
      assert.equal(calls, 1); assert.equal(cancellations, 1); assert.deepEqual(await readdir(directory), []);
    });
  } finally { finish?.(); await cancellation; }
});
