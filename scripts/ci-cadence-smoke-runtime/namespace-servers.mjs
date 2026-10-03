import { createServer as tlsServer } from 'node:https';
import { createServer as tcpServer, connect } from 'node:net';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Run as a trusted sidecar in the APP network namespace. No upstream HTTP or
// arbitrary CONNECT exists: authentic pinned bytes keep the original font URLs.
const inputs = JSON.parse(await readFile('/trusted/public-inputs.json', 'utf8'));
const routes = new Map();
const routeKey = url => url.hostname + url.pathname + JSON.stringify([...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b)));
for (const row of inputs.inputs.filter(row => ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(new URL(row.url).hostname))) {
  const url = new URL(row.url), bytes = await readFile('/opt/font-inputs/' + row.name);
  if (createHash('sha256').update(bytes).digest('hex') !== row.sha256) throw Error('Font transport bytes');
  routes.set(routeKey(url), { bytes, type: row.name.endsWith('.css') ? 'text/css' : 'font/woff2' });
}
const server = tlsServer({ cert: await readFile('/trusted/fonts.crt'), key: await readFile('/trusted/fonts.key') }, (req, res) => {
  let row;
  try {
    const url = new URL(req.url, 'https://' + req.headers.host);
    if (url.username || url.password || url.port || url.hash || !['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) throw Error('Font URL');
    row = routes.get(routeKey(url));
  } catch { res.writeHead(403); res.end(); return; }
  if (req.method !== 'GET' || !row || req.headers['transfer-encoding'] || Number(req.headers['content-length'] ?? 0) !== 0) { res.writeHead(403); res.end(); return; }
  res.writeHead(200, { 'Content-Type': row.type, 'Content-Length': row.bytes.length }); res.end(row.bytes);
});
server.on('connect', (_, socket) => socket.destroy());
server.listen(443, '127.0.0.1');
const gateway = process.env.OWNED_GATEWAY;
if (!/^172\.30\.214\.(?:[2-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-4])$/.test(gateway ?? '')) throw Error('Owned gateway address');
tcpServer(socket => {
  const upstream = connect({ host: gateway, port: 8000 });
  const stop = () => { socket.destroy(); upstream.destroy(); };
  socket.setTimeout(5000, stop); upstream.setTimeout(5000, stop); socket.on('error', stop); upstream.on('error', stop);
  socket.pipe(upstream); upstream.pipe(socket);
}).listen(55421, '127.0.0.1');
