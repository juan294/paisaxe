// Test-only preload. The real fetch URL/Host/TLS verification are retained;
// the one provider origin's TCP destination is an owned loopback TLS stand-in.
import net from 'node:net';
import { readFileSync, appendFileSync } from 'node:fs';
import { Agent, buildConnector, setGlobalDispatcher } from 'undici';
const port = Number(process.env.PAID_VOICE_TLS_PORT);
if (!process.env.PAID_VOICE_LOCAL_NONCE || !Number.isInteger(port) || port < 1024) throw Error('Local paid-voice boundary missing');
const ca = readFileSync(process.env.PAID_VOICE_TLS_CA);
const local = buildConnector({});
const provider = buildConnector({ ca });
const isLocal = host => ['127.0.0.1','localhost','::1','[::1]'].includes(host);
const original = net.Socket.prototype.connect;
net.Socket.prototype.connect = function(...args) {
  const options = Array.isArray(args[0]) ? args[0][0] : args[0];
  const host = options && typeof options === 'object' ? options.host ?? options.hostname ?? 'localhost' : typeof args[1] === 'string' ? args[1] : 'localhost';
  const unix = typeof options === 'string' && options.startsWith('/') || options?.path;
  if (!unix && !isLocal(host)) {
    appendFileSync(process.env.PAID_VOICE_NODE_DENIALS, JSON.stringify({pid:process.pid,host})+'\n');
    throw Error('External socket denied by local paid-voice harness');
  }
  return original.apply(this,args);
};
setGlobalDispatcher(new Agent({ connect(options, callback) {
  appendFileSync(process.env.PAID_VOICE_NODE_DENIALS, JSON.stringify({kind:'connect',pid:process.pid,hostname:options.hostname,port:options.port,protocol:options.protocol})+'\n');
  if (options.protocol === 'https:' && options.hostname === 'api.elevenlabs.io' && (!options.port || String(options.port) === '443')) {
    return provider({...options,hostname:'127.0.0.1',host:'127.0.0.1',port:String(port),servername:'api.elevenlabs.io'},(error,socket)=>{if(error)appendFileSync(process.env.PAID_VOICE_NODE_DENIALS,JSON.stringify({kind:'tls-error',code:error.code})+'\n');callback(error,socket);});
  }
  if (!isLocal(options.hostname)) return callback(Error('External fetch denied by local paid-voice harness'),null);
  return local(options,callback);
} }));
