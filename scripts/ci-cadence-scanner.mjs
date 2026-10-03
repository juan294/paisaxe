import { createHash } from 'node:crypto';
import { request } from 'node:https';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { constants } from 'node:fs';
import { lstat, realpath, mkdtemp, chmod, open, rm } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { performance } from 'node:perf_hooks';

const MAX_EXPANDED = 32 * 1024 * 1024;
const MAX_ACQUISITION_MS = 60000;
const VERSION = '8.30.1';
const PINS = Object.freeze({
  linux_x64: Object.freeze({ archiveBytes: 8230402, archiveSha256: '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb', bytes: 21958840, sha256: '88f91962aa2f93ac6ab281d553b9e125f5197bbbce38f9f2437f7299c32e5509' }),
  darwin_arm64: Object.freeze({ archiveBytes: 7897593, archiveSha256: 'b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5', bytes: 21324882, sha256: 'ba52fb1bfabbcde42f032afad3d6e0b19dff8ed105229a16e7caa338bbc0e84f' }),
});
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw new Error(`Scanner acquisition: ${message}`); };
const zero = bytes => bytes.every(byte => byte === 0);
function octal(bytes) {
  if (bytes.some(byte => byte > 127)) fail('invalid TAR numeric field');
  const text = bytes.toString('ascii');
  if (!/^[0-7]+\0? *$/.test(text)) fail('invalid TAR numeric field');
  const value = Number.parseInt(text, 8);
  if (!Number.isSafeInteger(value)) fail('unsafe TAR numeric field');
  return value;
}
function nameField(bytes) {
  const end = bytes.indexOf(0);
  if (end < 0 || !zero(bytes.subarray(end)) || bytes.subarray(0, end).some(byte => byte < 32 || byte > 126)) fail('invalid TAR name');
  return bytes.subarray(0, end).toString('ascii');
}

/** Structural parser only: production separately authenticates compressed and
 * executable hashes. Tests can therefore reach hostile TAR members directly. */
export function parseScannerTar(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length > MAX_EXPANDED || bytes.length % 512 !== 0) fail('TAR size bound');
  const expected = ['LICENSE', 'README.md', 'gitleaks']; let offset = 0; let executable;
  for (const name of expected) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.length !== 512 || zero(header)) fail('missing TAR member');
    const sum = header.reduce((total, byte, index) => total + (index >= 148 && index < 156 ? 32 : byte), 0);
    if (octal(header.subarray(148, 156)) !== sum) fail('TAR checksum mismatch');
    if (nameField(header.subarray(0, 100)) !== name) fail('unknown, duplicate or reordered TAR member');
    if (header[156] !== 48 || !zero(header.subarray(157, 257)) || !zero(header.subarray(345, 512))) fail('TAR member must be regular without links or prefix');
    if (!header.subarray(257, 265).equals(Buffer.from('ustar\0' + '00'))) fail('unsupported TAR format');
    for (const [start, end] of [[108, 116], [116, 124], [136, 148]]) octal(header.subarray(start, end));
    const size = octal(header.subarray(124, 136)); const mode = octal(header.subarray(100, 108));
    if (name === 'gitleaks' ? ![21958840, 21324882].includes(size) || mode !== 0o755 : size !== (name === 'LICENSE' ? 1069 : 29998) || mode !== 0o644) fail('unexpected TAR member size or mode');
    const start = offset + 512; const end = start + size; const next = start + Math.ceil(size / 512) * 512;
    if (next > bytes.length) fail('truncated TAR member');
    if (!zero(bytes.subarray(end, next))) fail('nonzero TAR member padding');
    if (name === 'gitleaks') executable = bytes.subarray(start, end);
    offset = next;
  }
  if (bytes.length - offset < 1024 || !zero(bytes.subarray(offset))) fail('TAR terminator or trailing data');
  return executable;
}

// Direct builtin HTTPS avoids environment-configured fetch proxies/dispatchers.
// No repository credentials, cookies, candidate headers or referrers are used.
function publicGet(url, options) {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: 'GET', agent: false, signal: options.signal, maxHeaderSize: 16384, headers: options.headers }, response => {
      resolve({ status: response.statusCode, url, headers: { get: name => response.headers[name.toLowerCase()] ?? null }, body: Readable.toWeb(response) });
    });
    req.on('error', () => reject(new Error('Scanner public request failed'))); req.end();
  });
}
function redirectUrl(value) {
  if (typeof value !== 'string' || value.length > 4096 || /[\s\x00-\x1f\x7f]/.test(value) || value.includes('#')) fail('invalid release redirect');
  let url; try { url = new URL(value); } catch { fail('invalid release redirect'); }
  if (url.protocol !== 'https:' || url.hostname !== 'release-assets.githubusercontent.com' || url.port || url.username || url.password) fail('unapproved release redirect');
  return value;
}
export async function decodeScannerArchive(archive, signal) {
  if (!Buffer.isBuffer(archive) || archive.length > 8230402) fail('compressed archive size bound');
  const chunks = []; let size = 0;
  const sink = new Writable({ write(chunk, encoding, done) {
    size += chunk.length;
    if (size > MAX_EXPANDED) done(new Error('Scanner expanded archive limit'));
    else { chunks.push(Buffer.from(chunk)); done(); }
  } });
  await pipeline(Readable.from([archive]), createGunzip({ chunkSize: 65536 }), sink, { signal });
  return Buffer.concat(chunks, size);
}

/** Caller supplies only its private directory, existing absolute monotonic
 * deadline, and an external HTTP seam. Runtime/pins/limits are source-owned. */
export async function acquireScanner(options) {
  const platform = `${process.platform}_${process.arch}`; const pin = PINS[platform];
  if (!pin) fail('unsupported actual runtime');
  if (!options || Object.keys(options).some(key => !['directory', 'deadline', 'fetchImpl'].includes(key))) fail('unsupported acquisition option');
  const { directory, deadline, fetchImpl = publicGet } = options;
  if (!Number.isFinite(deadline) || deadline <= performance.now() || typeof fetchImpl !== 'function') fail('invalid or expired deadline');
  if (typeof directory !== 'string' || !isAbsolute(directory)) fail('private absolute directory required');
  const end = Math.min(deadline, performance.now() + MAX_ACQUISITION_MS);
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), Math.max(1, end - performance.now()));
  const check = () => { if (controller.signal.aborted || performance.now() >= end) fail('deadline exceeded'); };
  async function bounded(operation) {
    check();
    const task = Promise.resolve().then(() => { check(); return operation(); }); let abort;
    const cancelled = new Promise((resolve, reject) => {
      abort = () => reject(new Error('Scanner acquisition deadline exceeded'));
      controller.signal.addEventListener('abort', abort, { once: true });
      if (controller.signal.aborted) abort();
    });
    try { const result = await Promise.race([task, cancelled]); check(); return result; }
    finally { controller.signal.removeEventListener('abort', abort); }
  }
  const bodies = new Map(); let terminated = false;
  function dispose(record) {
    if (record.disposal) return record.disposal;
    if (record.finished) return Promise.resolve();
    record.disposal = Promise.resolve().then(() => record.reader ? record.reader.cancel() : record.body.cancel()).finally(() => {
      if (record.reader) { try { record.reader.releaseLock(); } catch { /* Preserve the disposal result. */ } }
    });
    // Even a late response or ignored cancellation is observed without extending
    // the captured deadline. The same promise is joined while budget remains.
    record.disposal.catch(() => {});
    return record.disposal;
  }
  function remember(response) {
    const body = response?.body;
    if (body) {
      if (!bodies.has(body)) bodies.set(body, { body, finished: false });
      if (terminated || controller.signal.aborted || performance.now() >= end) dispose(bodies.get(body));
    }
    return response;
  }
  let owned; let ownedStat; let handle;
  try {
    const parent = await bounded(() => lstat(directory));
    if (!parent.isDirectory() || parent.isSymbolicLink() || parent.uid !== process.getuid() || (parent.mode & 0o077) !== 0 || await bounded(() => realpath(directory)) !== directory) fail('untrusted private directory');
    let url = `https://github.com/gitleaks/gitleaks/releases/download/v${VERSION}/gitleaks_${VERSION}_${platform}.tar.gz`;
    const get = () => bounded(async () => remember(await fetchImpl(url, { method: 'GET', redirect: 'manual', credentials: 'omit', referrerPolicy: 'no-referrer', headers: { Accept: 'application/octet-stream' }, signal: controller.signal })));
    let response = await get();
    if (!response || response.url !== url) fail('response URL mismatch');
    if (response.status === 302) {
      url = redirectUrl(response.headers?.get('location'));
      if (response.body) await bounded(() => dispose(bodies.get(response.body)));
      response = await get();
      if (!response || response.url !== url) fail('response URL mismatch');
    }
    if (response.status !== 200 || !response.body || typeof response.body.getReader !== 'function') fail('unexpected asset response');
    const length = response.headers?.get('content-length');
    if (length !== null && length !== undefined && (typeof length !== 'string' || !/^[0-9]+$/.test(length) || !Number.isSafeInteger(Number(length)) || Number(length) !== pin.archiveBytes)) fail('invalid asset Content-Length');
    const record = bodies.get(response.body); const reader = response.body.getReader(); record.reader = reader;
    const chunks = []; let size = 0;
    while (true) {
      const part = await bounded(() => reader.read());
      if (!part || typeof part.done !== 'boolean') fail('invalid asset stream');
      if (part.done) break;
      if (!(part.value instanceof Uint8Array) || part.value.byteLength === 0) fail('invalid asset chunk');
      if (chunks.length >= 16384) fail('asset fragment limit');
      size += part.value.byteLength;
      if (size > pin.archiveBytes) fail('asset stream limit');
      chunks.push(Buffer.from(part.value));
    }
    reader.releaseLock(); record.reader = undefined; record.finished = true;
    const archive = Buffer.concat(chunks, size); check();
    if (size !== pin.archiveBytes || digest(archive) !== pin.archiveSha256) fail('asset archive digest or length mismatch');
    const tar = await bounded(() => decodeScannerArchive(archive, controller.signal));
    const executable = parseScannerTar(tar); check();
    if (executable.length !== pin.bytes || digest(executable) !== pin.sha256) fail('executable digest or length mismatch');
    const currentParent = await lstat(directory);
    if (!currentParent.isDirectory() || currentParent.dev !== parent.dev || currentParent.ino !== parent.ino || currentParent.uid !== parent.uid || (currentParent.mode & 0o077) !== 0 || await realpath(directory) !== directory) fail('private parent changed');
    check(); owned = await mkdtemp(join(directory, 'ci-scanner-')); ownedStat = await lstat(owned);
    if (!ownedStat.isDirectory() || ownedStat.uid !== parent.uid || await realpath(owned) !== owned) fail('private scanner directory changed');
    await chmod(owned, 0o700); const path = join(owned, 'gitleaks');
    handle = await open(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o700);
    await handle.writeFile(executable); const created = await handle.stat(); await handle.close(); handle = undefined; check();
    const final = await lstat(path);
    if (!final.isFile() || final.isSymbolicLink() || final.nlink !== 1 || final.uid !== parent.uid || (final.mode & 0o777) !== 0o700 || final.size !== pin.bytes || final.dev !== created.dev || final.ino !== created.ino || await realpath(path) !== path) fail('private scanner file changed');
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const readStat = await handle.stat();
    if (!readStat.isFile() || readStat.dev !== created.dev || readStat.ino !== created.ino || readStat.size !== pin.bytes) fail('scanner read identity changed');
    if (digest(await handle.readFile()) !== pin.sha256) fail('materialized scanner digest mismatch');
    await handle.close(); handle = undefined;
    const readback = await lstat(path);
    if (readback.dev !== created.dev || readback.ino !== created.ino || readback.nlink !== 1 || readback.uid !== parent.uid || (readback.mode & 0o777) !== 0o700) fail('scanner readback changed');
    const finalParent = await lstat(directory); const finalOwned = await lstat(owned);
    if (finalParent.dev !== parent.dev || finalParent.ino !== parent.ino || (finalParent.mode & 0o077) !== 0 || finalOwned.dev !== ownedStat.dev || finalOwned.ino !== ownedStat.ino || finalOwned.uid !== parent.uid || (finalOwned.mode & 0o777) !== 0o700) fail('scanner ownership changed');
    check(); return Object.freeze({ path, sha256: pin.sha256, bytes: pin.bytes });
  } catch {
    terminated = true;
    const pending = [...bodies.values()].map(dispose);
    try { await bounded(() => Promise.allSettled(pending)); } catch { /* The original deadline also bounds cleanup. */ }
    if (handle) { try { await handle.close(); } catch { /* Continue ownership-checked cleanup. */ } }
    if (owned && ownedStat) {
      try { const current = await lstat(owned); if (current.isDirectory() && current.dev === ownedStat.dev && current.ino === ownedStat.ino && current.uid === ownedStat.uid) await rm(owned, { recursive: true, force: true }); } catch { /* Never remove an unverified foreign path. */ }
    }
    fail('failed or unavailable');
  } finally { terminated = true; clearTimeout(timer); controller.abort(); }
}
