import { request } from 'node:http';
import { readFile } from 'node:fs/promises';

// Materialized by the trusted host, outside the candidate. The bridge exposes
// two read-only operations for one already-acquired nonce; it cannot run Docker,
// select resources, forward HTTP, or authorize another project.
const bridge = JSON.parse(await readFile(new URL('./bridge.json', import.meta.url), 'utf8'));
if (!/^\/trusted\/bridge-[a-f0-9]{32}\.sock$/.test(bridge.socket ?? '') || !/^[a-f0-9]{64}$/.test(bridge.token ?? '')) throw Error('Private bridge identity');
async function call(operation) {
  return new Promise((resolve, reject) => {
    const req = request({ socketPath: bridge.socket, method: 'POST', path: '/' + operation, headers: { Authorization: 'Bearer ' + bridge.token, 'Content-Length': '0' } }, response => {
      const chunks = []; let bytes = 0;
      response.on('data', chunk => { bytes += chunk.length; if (bytes > 1048576) req.destroy(Error('Bridge body bound')); else chunks.push(chunk); });
      response.on('end', () => { try { if (response.statusCode !== 200) throw Error('Live acquisition unavailable'); resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (error) { reject(error); } });
    });
    req.setTimeout(5000, () => req.destroy(Error('Bridge deadline'))); req.on('error', reject); req.end();
  });
}
export const inspectProfile = () => call('inspectProfile');
export const acquireHandoff = () => call('acquireHandoff');
