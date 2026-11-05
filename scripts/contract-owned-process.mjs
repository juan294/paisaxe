import { spawn, execFileSync } from 'node:child_process';

export function processIdentity(pid) {
  try { process.kill(pid, 0); }
  catch (error) { if (error.code === 'ESRCH') return null; if (error.code !== 'EPERM') return 'unknown'; }
  try { return execFileSync('ps', ['-p', String(pid), '-o', 'lstart='], { env: { ...process.env, LC_ALL: 'C', TZ: 'UTC' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim() || 'unknown'; }
  catch { return 'unknown'; }
}

const coded = (message, code) => Object.assign(new Error(message), { code });
// A process group belongs to one command launched by this scope. ESRCH alone
// proves it is gone; permission/probe failures leave it protected.
const groupAlive = (pid) => {
  try { process.kill(-pid, 0); return true; }
  catch (error) { return error.code !== 'ESRCH'; }
};

/** Own a sequence of commands, including descendants, without signal handlers
 * leaking into later imported calls. No unknown child is force-killed. */
export function createOwnedProcessScope({ settlementMs = 30000 } = {}) {
  if (!Number.isFinite(settlementMs) || settlementMs <= 0 || settlementMs > 30000) throw new Error('Invalid child settlement deadline');
  let active = null;
  let interruption = null;
  let uncertain = null;
  let closed = false;
  const interrupt = (signal, reason = 'signal') => {
    interruption ??= { signal, reason, child: active?.identity ?? null, settled: !active };
    active?.cancel(signal);
  };
  const handlers = new Map(['SIGINT', 'SIGTERM'].map((signal) => [signal, () => interrupt(signal)]));
  for (const [signal, handler] of handlers) process.on(signal, handler);

  const checkpoint = () => {
    if (uncertain) throw coded('Owned child termination is unproven; retain its resources and inspect the recorded process group', 'CONTRACT_CHILD_UNSETTLED');
    if (interruption) throw coded(`Contract work interrupted by ${interruption.signal}`, 'CONTRACT_INTERRUPTED');
    if (closed) throw new Error('Owned process scope is closed');
  };

  return {
    get interruption() { return uncertain ? { signal: interruption?.signal ?? null, reason: interruption?.reason ?? 'unsettled', child: uncertain, settled: false } : interruption; },
    checkpoint,
    stop(signal = 'SIGTERM') {
      if (!['SIGTERM', 'SIGINT'].includes(signal)) throw new Error('Unsupported owned stop signal');
      active?.cancel(signal);
    },
    close() {
      for (const [signal, handler] of handlers) process.removeListener(signal, handler);
      closed = true;
    },
    /**
     * @param {string} binary
     * @param {string[]} args
     * @param {{cwd?: string, env?: NodeJS.ProcessEnv, timeout?: number, maxBuffer?: number, encoding?: string, commandTracker?: import('./contract-stack-lifecycle.mjs').ReceiptCommandTracker | null, stdio?: import('node:child_process').StdioOptions}} [options]
     */
    async run(binary, args, { cwd, env, timeout, maxBuffer = 32 * 1024 * 1024, commandTracker, stdio = /** @type {import('node:child_process').StdioOptions} */ (['ignore', 'pipe', 'pipe']) } = {}) {
      checkpoint();
      if (active) throw new Error('Owned commands must run sequentially');
      if (process.platform === 'win32') throw new Error('Owned process groups require a Unix host');
      const commandId = commandTracker?.beforeLaunch();
      return new Promise((resolve, reject) => {
        let child;
        try { child = spawn(binary, args, { cwd, env, detached: true, stdio }); }
        catch (error) {
          try { commandTracker?.onSettled(commandId, { spawnFailed: true, child: { pid: null, pgid: null, startedAt: null, settled: true } }); }
          catch (trackingError) { return reject(trackingError); }
          return reject(error);
        }
        const identity = { pid: child.pid ?? null, pgid: child.pid ?? null, startedAt: child.pid ? processIdentity(child.pid) ?? 'unknown' : null };
        let trackingFailed = false;
        let stdout = ''; let stderr = ''; let bytes = 0;
        let status = null; let signal = null; let error;
        let exited = false; let streamsClosed = false; let done = false;
        let deadline = null; let cancellationSent = false; let poll; let timer;
        const finish = (settled) => {
          if (done) return;
          done = true;
          clearTimeout(timer); clearTimeout(poll);
          if (!settled) {
            uncertain = identity;
            error = coded('Owned child process group did not settle; resources must remain protected', 'CONTRACT_CHILD_UNSETTLED');
            // Let the command return with its recorded identity even if a child
            // ignores the signal and holds its output pipes open.
            child.stdout?.destroy(); child.stderr?.destroy(); child.unref();
          }
          if (interruption) interruption.settled = settled;
          active = null;
          const result = { status, signal, stdout, stderr, ...(error ? { error } : {}), child: { ...identity, settled }, settlementBasis: settled ? 'supervisor-observed' : 'unproven', ...(identity.pid === null ? { spawnFailed: true } : {}) };
          if (!trackingFailed) {
            try { commandTracker?.onSettled(commandId, result); }
            catch { uncertain = identity; result.error = coded('Owned command settlement receipt failed; resources remain protected', 'CONTRACT_TRACKING_FAILED'); }
          }
          resolve(result);
        };
        const inspect = () => {
          if (done) return;
          const alive = identity.pid !== null && groupAlive(identity.pid);
          if (exited && streamsClosed && !alive) return finish(true);
          if (deadline !== null && Date.now() >= deadline) return finish(false);
          poll = setTimeout(inspect, 20);
        };
        const cancel = (requestedSignal) => {
          if (cancellationSent) return;
          cancellationSent = true;
          deadline ??= Date.now() + settlementMs;
          if (identity.pid !== null) {
            try { process.kill(-identity.pgid, requestedSignal); }
            catch (cause) { if (cause.code !== 'ESRCH') error = coded('Owned child signal could not be delivered', 'CONTRACT_SIGNAL_FAILED'); }
          }
          clearTimeout(poll); inspect();
        };
        active = { identity, cancel };
        const capture = (target, chunk) => {
          bytes += chunk.length;
          if (bytes > maxBuffer) {
            error = coded('Owned command output exceeded its limit', 'ENOBUFS');
            interrupt('SIGTERM', 'output-limit');
            return;
          }
          if (target === 'stdout') stdout += chunk.toString(); else stderr += chunk.toString();
        };
        child.stdout?.on('data', (chunk) => capture('stdout', chunk));
        child.stderr?.on('data', (chunk) => capture('stderr', chunk));
        child.on('error', (cause) => {
          error = coded('Owned command could not start', cause.code ?? 'CONTRACT_SPAWN_FAILED');
          if (identity.pid === null) { exited = true; streamsClosed = true; finish(true); }
        });
        child.on('exit', (code, exitSignal) => {
          status = code; signal = exitSignal; exited = true;
          deadline ??= Date.now() + settlementMs;
          clearTimeout(poll); inspect();
        });
        child.on('close', () => { streamsClosed = true; clearTimeout(poll); inspect(); });
        if (identity.pid !== null) {
          try { commandTracker?.onStart(commandId, identity); }
          catch { trackingFailed = true; uncertain = identity; error = coded('Owned child identity receipt failed; resources remain protected', 'CONTRACT_TRACKING_FAILED'); cancel('SIGTERM'); }
        }
        if (timeout) timer = setTimeout(() => {
          error = coded('Owned command timed out', 'ETIMEDOUT');
          interrupt('SIGTERM', 'timeout');
        }, timeout);
      });
    },
  };
}
